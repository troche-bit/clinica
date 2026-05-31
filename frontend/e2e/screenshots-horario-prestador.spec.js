const { test, expect } = require('@playwright/test')
const path = require('path')

const OUT = path.resolve(__dirname, '../../docs/imagenes/horario-prestador')
const TS  = Date.now()

// Nombres únicos por run (incluyen TS para evitar colisiones entre ejecuciones)
const DOC_DEMO  = `SRHP${TS}`
const NOM_DEMO  = `Guerrero Martínez ${TS}`
const DOC_VACIO = `SRHPV${TS}`
const NOM_VACIO = `Domínguez Soto ${TS}`

let prestId1   = null
let prestId2   = null
let horarioId1 = null
let token      = null

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

async function crearPersona(request, nro, nombre, tk) {
  const tipos  = await request.get('http://localhost:8000/api/tipo-documento/', {
    headers: { Authorization: `Bearer ${tk}` },
  })
  const body   = await tipos.json()
  const tipoId = (body.results || body)[0]?.id
  const r = await request.post('http://localhost:8000/api/persona/', {
    data: { tipo_documento: tipoId, nro_documento: nro, razon_social: nombre, fecha_nacimiento: '1980-04-12' },
    headers: { Authorization: `Bearer ${tk}` },
  })
  return (await r.json()).id
}

async function apiDelete(request, url, tk) {
  await request.delete(url, { headers: { Authorization: `Bearer ${tk}` } })
}

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeAll(async ({ request }) => {
  token = await obtenerToken(request)
  const p1 = await crearPersona(request, DOC_DEMO,  NOM_DEMO,  token)
  const r1 = await request.post('http://localhost:8000/api/personarrhh/', {
    data: { persona: p1, cargo: 'medico', tipo_contrato: 'dependencia', fecha_ingreso: '2019-03-01' },
    headers: { Authorization: `Bearer ${token}` },
  })
  prestId1 = (await r1.json()).id
  const r2 = await request.post('http://localhost:8000/api/horario-prestador/', {
    data: { persona_rrhh: prestId1, dia_semana: 1, hora_desde: '08:00', hora_hasta: '12:00', intervalo: 30 },
    headers: { Authorization: `Bearer ${token}` },
  })
  horarioId1 = (await r2.json()).id
  const p2 = await crearPersona(request, DOC_VACIO, NOM_VACIO, token)
  const r3 = await request.post('http://localhost:8000/api/personarrhh/', {
    data: { persona: p2, cargo: 'enfermero', tipo_contrato: 'honorarios', fecha_ingreso: '2021-01-15' },
    headers: { Authorization: `Bearer ${token}` },
  })
  prestId2 = (await r3.json()).id
})

test.afterAll(async ({ request }) => {
  if (horarioId1) await apiDelete(request, `http://localhost:8000/api/horario-prestador/${horarioId1}/`, token)
  const r = await request.get(`http://localhost:8000/api/horario-prestador/?persona_rrhh=${prestId2}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await r.json()
  for (const h of (body.results || body)) {
    await apiDelete(request, `http://localhost:8000/api/horario-prestador/${h.id}/`, token)
  }
  if (prestId1) await apiDelete(request, `http://localhost:8000/api/personarrhh/${prestId1}/`, token)
  if (prestId2) await apiDelete(request, `http://localhost:8000/api/personarrhh/${prestId2}/`, token)
})

async function irAHorarios(page) {
  await page.goto('/agenda/horarios')
  await expect(page.locator('.hp-table')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.hp-table tbody td', { hasText: 'Cargando' }))
    .not.toBeVisible({ timeout: 8000 })
}

// Busca por NOM_DEMO (incluye TS → único) y devuelve la fila
async function filtrarDemo(page) {
  await page.fill('.hp-search-input', NOM_DEMO)
  await page.waitForTimeout(500)
  const fila = page.locator('.hp-table tbody tr', { hasText: NOM_DEMO })
  await expect(fila).toBeVisible({ timeout: 6000 })
  return fila
}

async function filtrarVacio(page) {
  await page.fill('.hp-search-input', NOM_VACIO)
  await page.waitForTimeout(500)
  const fila = page.locator('.hp-table tbody tr', { hasText: NOM_VACIO })
  await expect(fila).toBeVisible({ timeout: 6000 })
  return fila
}

// ─── 01 Listado principal ─────────────────────────────────────────────────────
test('01 - listado principal', async ({ page }) => {
  await irAHorarios(page)
  await filtrarDemo(page)
  await page.fill('.hp-search-input', '')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/01_listado.png` })
})

// ─── 02 Búsqueda activa ───────────────────────────────────────────────────────
test('02 - busqueda activa', async ({ page }) => {
  await irAHorarios(page)
  await filtrarDemo(page)
  await page.screenshot({ path: `${OUT}/02_busqueda.png` })
})

// ─── 03 Panel ver con horarios ────────────────────────────────────────────────
test('03 - panel ver con horarios', async ({ page }) => {
  await irAHorarios(page)
  const fila = await filtrarDemo(page)
  await fila.click()
  await expect(page.locator('.hp-ver-dia').first()).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/03_panel_ver.png` })
  await page.locator('.hp-panel-close').click()
})

// ─── 04 Panel editar — bloque vacío al agregar ────────────────────────────────
test('04 - panel editar vacio', async ({ page }) => {
  await irAHorarios(page)
  const fila = await filtrarVacio(page)
  await fila.locator('.hp-btn-edit').click()
  await expect(page.locator('.hp-panel')).toBeVisible()
  await page.locator('.hp-btn-agregar').click()
  await expect(page.locator('.hp-bloque')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/04_panel_editar.png` })
  await page.locator('.hp-panel-close').click()
  const guard = page.locator('.cd-overlay')
  if (await guard.isVisible()) {
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
  }
})

// ─── 05 Panel editar — bloque completado ─────────────────────────────────────
test('05 - panel editar con bloque completo', async ({ page }) => {
  await irAHorarios(page)
  const fila = await filtrarDemo(page)
  await fila.locator('.hp-btn-edit').click()
  await expect(page.locator('.hp-bloque')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/05_panel_editar_completo.png` })
  await page.locator('.hp-panel-close').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 3000 })
  await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
})

// ─── 06 Generación de turnos con resultado ────────────────────────────────────
test('06 - generar turnos resultado', async ({ page }) => {
  await irAHorarios(page)
  const fila = await filtrarDemo(page)
  await fila.click()
  await expect(page.locator('.hp-btn-generar')).toBeEnabled({ timeout: 4000 })
  await page.locator('.hp-btn-generar').click()
  await expect(page.locator('.hp-gen-result')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/06_generar_resultado.png` })
  await page.locator('.hp-panel-close').click()
})

// ─── 07 ConfirmDialog al guardar eliminando horarios ─────────────────────────
test('07 - confirm dialog eliminar horario', async ({ page }) => {
  await irAHorarios(page)
  const fila = await filtrarDemo(page)
  await fila.locator('.hp-btn-edit').click()
  await expect(page.locator('.hp-bloque')).toBeVisible({ timeout: 4000 })

  // Quitar el bloque existente y guardar → aparece ConfirmDialog (tiene horarios a eliminar)
  await page.locator('.hp-bloque-del').click()
  await page.locator('.hp-btn-save').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/07_confirm_eliminar.png` })

  // Cancelar — no eliminar el horario, volver al estado anterior
  await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
  // Cancelar también la edición
  await page.locator('.hp-btn-cancel').click()
  const guard = page.locator('.cd-overlay')
  if (await guard.isVisible()) {
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
  }
})

// ─── 08 NavigationGuard ───────────────────────────────────────────────────────
test('08 - navigation guard', async ({ page }) => {
  await irAHorarios(page)
  const fila = await filtrarDemo(page)
  await fila.locator('.hp-btn-edit').click()
  await expect(page.locator('.hp-bloque')).toBeVisible({ timeout: 4000 })
  await page.locator('.hp-panel-close').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/08_navigation_guard.png` })
  await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
})
