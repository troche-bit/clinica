const { test, expect } = require('@playwright/test')
const path = require('path')

const OUT  = path.resolve(__dirname, '../../docs/imagenes/prestador')
const TS   = Date.now()

const DOC_DEMO  = `SRRHH${TS}`
const NOM_DEMO  = `Benítez Vera, Rodrigo`
const DOC_NUEVO = `SRRHHNU${TS}`
const NOM_NUEVO = `Cáceres Duarte, Valeria`

let prestId = null
let token   = null

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
    data: { tipo_documento: tipoId, nro_documento: nro, razon_social: nombre, fecha_nacimiento: '1985-03-20' },
    headers: { Authorization: `Bearer ${tk}` },
  })
  return (await r.json()).id
}

async function setDateInput(page, selector, value) {
  await page.locator(selector).evaluate((el, val) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, val)
    el.dispatchEvent(new Event('input',  { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeAll(async ({ request }) => {
  token = await obtenerToken(request)
  const p1Id = await crearPersona(request, DOC_DEMO, NOM_DEMO, token)
  const r = await request.post('http://localhost:8000/api/personarrhh/', {
    data: {
      persona: p1Id,
      cargo: 'medico',
      tipo_contrato: 'dependencia',
      fecha_ingreso: '2018-06-01',
      nro_matricula: 'MED-12345',
      estado: 'activo',
    },
    headers: { Authorization: `Bearer ${token}` },
  })
  prestId = (await r.json()).id
  await crearPersona(request, DOC_NUEVO, NOM_NUEVO, token)
})

test.afterAll(async ({ request }) => {
  if (prestId) {
    await request.delete(`http://localhost:8000/api/personarrhh/${prestId}/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  }
  const r = await request.get(
    `http://localhost:8000/api/personarrhh/buscar/?nro_documento=${DOC_NUEVO}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const body = await r.json()
  if (body.es_prestador && body.personarrhh?.id) {
    await request.delete(
      `http://localhost:8000/api/personarrhh/${body.personarrhh.id}/`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
  }
})

async function irAPrestadores(page) {
  await page.goto('/rrhh/personal')
  await expect(page.locator('.rrhh-btn-nuevo')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.rrhh-table tbody td', { hasText: 'Cargando' }))
    .not.toBeVisible({ timeout: 8000 })
}

// ─── 01 Listado principal ─────────────────────────────────────────────────────
test('01 - listado principal', async ({ page }) => {
  await irAPrestadores(page)
  await page.fill('.rrhh-search-input', DOC_DEMO)
  await page.waitForTimeout(500)
  await expect(page.locator('.rrhh-table tbody tr', { hasText: DOC_DEMO })).toBeVisible()
  await page.fill('.rrhh-search-input', '')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/01_listado.png` })
})

// ─── 02 Búsqueda activa ───────────────────────────────────────────────────────
test('02 - busqueda activa', async ({ page }) => {
  await irAPrestadores(page)
  await page.fill('.rrhh-search-input', NOM_DEMO)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/02_busqueda.png` })
})

// ─── 03 Modal detalle ─────────────────────────────────────────────────────────
test('03 - modal detalle', async ({ page }) => {
  await irAPrestadores(page)
  await page.fill('.rrhh-search-input', DOC_DEMO)
  await page.waitForTimeout(500)
  const fila = page.locator('.rrhh-table tbody tr', { hasText: DOC_DEMO })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.click()
  await expect(page.locator('.modal-box')).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/03_modal_detalle.png` })
  await page.locator('.modal-close').click()
})

// ─── 04 Modal crear — BuscadorPersona vacío ───────────────────────────────────
test('04 - modal crear vacio', async ({ page }) => {
  await irAPrestadores(page)
  await page.locator('.rrhh-btn-nuevo').click()
  await expect(page.locator('.modal-box')).toBeVisible()
  await expect(page.locator('.bp-input')).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/04_modal_crear_buscador.png` })
  await page.locator('.modal-close').click()
})

// ─── 05 Modal crear — formulario tras buscar ─────────────────────────────────
test('05 - modal crear con formulario', async ({ page }) => {
  await irAPrestadores(page)
  await page.locator('.rrhh-btn-nuevo').click()
  await page.fill('.bp-input', DOC_NUEVO)
  await page.locator('.bp-btn').click()
  await expect(page.locator('.prf-btn-save')).toBeVisible({ timeout: 8000 })
  await setDateInput(page, 'input[type="date"].fr-input', '2022-03-15')
  await page.locator('select.fr-select').nth(0).selectOption('medico')
  await page.locator('select.fr-select').nth(1).selectOption('honorarios')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/05_modal_crear_formulario.png` })
  await page.locator('.modal-close').click()
  const guard = page.locator('.cd-overlay')
  if (await guard.isVisible()) {
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
  }
})

// ─── 06 Modal editar ──────────────────────────────────────────────────────────
test('06 - modal editar', async ({ page }) => {
  await irAPrestadores(page)
  await page.fill('.rrhh-search-input', DOC_DEMO)
  await page.waitForTimeout(500)
  const fila = page.locator('.rrhh-table tbody tr', { hasText: DOC_DEMO })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.locator('.rrhh-action-btn.edit').click()
  await expect(page.locator('.modal-box')).toBeVisible()
  await expect(page.locator('.prf-btn-save')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/06_modal_editar.png` })
  await page.locator('.modal-close').click()
})

// ─── 07 ConfirmDialog eliminar ────────────────────────────────────────────────
test('07 - confirm dialog eliminar', async ({ page }) => {
  await irAPrestadores(page)
  await page.fill('.rrhh-search-input', DOC_DEMO)
  await page.waitForTimeout(500)
  const fila = page.locator('.rrhh-table tbody tr', { hasText: DOC_DEMO })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.locator('.rrhh-action-btn.trash').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/07_confirm_eliminar.png` })
  await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
})

// ─── 08 NavigationGuard ───────────────────────────────────────────────────────
test('08 - navigation guard', async ({ page }) => {
  await irAPrestadores(page)
  await page.locator('.rrhh-btn-nuevo').click()
  await page.fill('.bp-input', DOC_DEMO)
  await page.locator('.bp-btn').click()
  await expect(page.locator('.prf-btn-save')).toBeVisible({ timeout: 8000 })
  await page.locator('.modal-close').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/08_navigation_guard.png` })
  await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
})
