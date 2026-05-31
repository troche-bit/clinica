const { test, expect } = require('@playwright/test')
const path = require('path')

const OUT  = path.resolve(__dirname, '../../docs/imagenes/paciente-responsable')
const TS   = Date.now()

// Persona con responsable (para capturas de listado, detalle, editar, eliminar)
const DOC_DEMO  = `SRESP${TS}`
const NOM_DEMO  = `Ramírez Villalba, Patricia`
// Persona sin responsable (para captura de formulario crear)
const DOC_NUEVO = `SRESPN${TS}`
const NOM_NUEVO = `Torres Benítez, Carlos`

let respId   = null
let token    = null

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

async function crearPersona(request, nro, nombre, tk) {
  const tipos = await request.get('http://localhost:8000/api/tipo-documento/', {
    headers: { Authorization: `Bearer ${tk}` },
  })
  const body  = await tipos.json()
  const tipoId = (body.results || body)[0]?.id
  const r = await request.post('http://localhost:8000/api/persona/', {
    data: { tipo_documento: tipoId, nro_documento: nro, razon_social: nombre },
    headers: { Authorization: `Bearer ${tk}` },
  })
  return (await r.json()).id
}

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeAll(async ({ request }) => {
  token = await obtenerToken(request)
  const p1Id = await crearPersona(request, DOC_DEMO, NOM_DEMO, token)
  const r = await request.post('http://localhost:8000/api/pacienteresponsable/', {
    data: { persona: p1Id, ocupacion: 'Contadora', es_contacto_emergencia: true },
    headers: { Authorization: `Bearer ${token}` },
  })
  respId = (await r.json()).id
  // Persona sin responsable para el flujo de crear
  await crearPersona(request, DOC_NUEVO, NOM_NUEVO, token)
})

test.afterAll(async ({ request }) => {
  if (respId) {
    await request.delete(`http://localhost:8000/api/pacienteresponsable/${respId}/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  }
  // Limpiar responsable creado en la captura 05 si quedó
  const r = await request.get(
    `http://localhost:8000/api/pacienteresponsable/buscar/?nro_documento=${DOC_NUEVO}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const body = await r.json()
  if (body.es_responsable && body.pacienteresponsable?.id) {
    await request.delete(
      `http://localhost:8000/api/pacienteresponsable/${body.pacienteresponsable.id}/`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
  }
})

async function irAResponsables(page) {
  await page.goto('/pacienteresponsable')
  await expect(page.locator('.pr-btn-nuevo')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.pr-table tbody td', { hasText: 'Cargando' }))
    .not.toBeVisible({ timeout: 8000 })
}

// ─── 01 Listado principal ─────────────────────────────────────────────────────
test('01 - listado principal', async ({ page }) => {
  await irAResponsables(page)
  await page.fill('.pr-search-input', DOC_DEMO)
  await page.waitForTimeout(500)
  await expect(page.locator('.pr-table tbody tr', { hasText: DOC_DEMO })).toBeVisible()
  await page.fill('.pr-search-input', '')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/01_listado.png` })
})

// ─── 02 Búsqueda activa ───────────────────────────────────────────────────────
test('02 - busqueda activa', async ({ page }) => {
  await irAResponsables(page)
  await page.fill('.pr-search-input', NOM_DEMO)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/02_busqueda.png` })
})

// ─── 03 Modal detalle ─────────────────────────────────────────────────────────
test('03 - modal detalle', async ({ page }) => {
  await irAResponsables(page)
  await page.fill('.pr-search-input', DOC_DEMO)
  await page.waitForTimeout(500)
  const fila = page.locator('.pr-table tbody tr', { hasText: DOC_DEMO })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.click()
  await expect(page.locator('.modal-box')).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/03_modal_detalle.png` })
  await page.locator('.modal-close').click()
})

// ─── 04 Modal crear — BuscadorPersona vacío ───────────────────────────────────
test('04 - modal crear vacio', async ({ page }) => {
  await irAResponsables(page)
  await page.locator('.pr-btn-nuevo').click()
  await expect(page.locator('.modal-box')).toBeVisible()
  await expect(page.locator('.bp-input')).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/04_modal_crear_buscador.png` })
  await page.locator('.modal-close').click()
})

// ─── 05 Modal crear — formulario tras buscar ─────────────────────────────────
test('05 - modal crear con formulario', async ({ page }) => {
  await irAResponsables(page)
  await page.locator('.pr-btn-nuevo').click()
  await page.fill('.bp-input', DOC_NUEVO)
  await page.locator('.bp-btn').click()
  await expect(page.locator('.rf-btn-save')).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/05_modal_crear_formulario.png` })
  // Cerrar sin guardar
  await page.locator('.modal-close').click()
  const guard = page.locator('.cd-overlay')
  if (await guard.isVisible()) {
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
  }
})

// ─── 06 Modal editar ──────────────────────────────────────────────────────────
test('06 - modal editar', async ({ page }) => {
  await irAResponsables(page)
  await page.fill('.pr-search-input', DOC_DEMO)
  await page.waitForTimeout(500)
  const fila = page.locator('.pr-table tbody tr', { hasText: DOC_DEMO })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.locator('.pr-action-btn.edit').click()
  await expect(page.locator('.modal-box')).toBeVisible()
  await expect(page.locator('.rf-btn-save')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/06_modal_editar.png` })
  await page.locator('.modal-close').click()
})

// ─── 07 ConfirmDialog eliminar ────────────────────────────────────────────────
test('07 - confirm dialog eliminar', async ({ page }) => {
  await irAResponsables(page)
  await page.fill('.pr-search-input', DOC_DEMO)
  await page.waitForTimeout(500)
  const fila = page.locator('.pr-table tbody tr', { hasText: DOC_DEMO })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.locator('.pr-action-btn.trash').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/07_confirm_eliminar.png` })
  await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
})

// ─── 08 NavigationGuard ───────────────────────────────────────────────────────
test('08 - navigation guard', async ({ page }) => {
  await irAResponsables(page)
  await page.locator('.pr-btn-nuevo').click()
  await page.fill('.bp-input', DOC_DEMO)
  await page.locator('.bp-btn').click()
  await expect(page.locator('.rf-btn-save')).toBeVisible({ timeout: 8000 })
  // Cerrar activa el guard (markDirty fue llamado al llegar el resultado)
  await page.locator('.modal-close').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/08_navigation_guard.png` })
  await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
})
