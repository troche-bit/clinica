const { test, expect } = require('@playwright/test')
const path = require('path')

const OUT       = path.resolve(__dirname, '../../docs/imagenes/eventoclinico')
const TS        = Date.now()
const TIPO_DEMO = `Consulta Clínica Demo-${TS}`

let evId = null
let token = null

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeAll(async ({ request }) => {
  token = await obtenerToken(request)
  const r = await request.post('http://localhost:8000/api/eventoclinico/', {
    data: { tipo_evento: TIPO_DEMO },
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await r.json()
  evId = body.id
})

test.afterAll(async ({ request }) => {
  if (evId) {
    await request.delete(`http://localhost:8000/api/eventoclinico/${evId}/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  }
})

async function irAEventosClinicos(page) {
  await page.goto('/consultas/eventos')
  await expect(page.locator('.ec-btn-nuevo')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.ec-table tbody td', { hasText: 'Cargando' }))
    .not.toBeVisible({ timeout: 8000 })
}

// ─── 01 Listado principal ─────────────────────────────────────────────────────
test('01 - listado principal', async ({ page }) => {
  await irAEventosClinicos(page)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/01_listado.png` })
})

// ─── 02 Búsqueda activa ───────────────────────────────────────────────────────
test('02 - busqueda activa', async ({ page }) => {
  await irAEventosClinicos(page)
  await page.fill('.ec-search-input', TIPO_DEMO)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/02_busqueda.png` })
})

// ─── 03 Panel detalle ─────────────────────────────────────────────────────────
test('03 - panel detalle', async ({ page }) => {
  await irAEventosClinicos(page)
  await page.fill('.ec-search-input', TIPO_DEMO)
  await page.waitForTimeout(500)
  const fila = page.locator('.ec-table tbody tr', { hasText: TIPO_DEMO })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.click()
  await expect(page.locator('.panel-root')).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/03_panel_detalle.png` })
})

// ─── 04 Panel crear vacío ─────────────────────────────────────────────────────
test('04 - panel crear vacio', async ({ page }) => {
  await irAEventosClinicos(page)
  await page.locator('.ec-btn-nuevo').click()
  await expect(page.locator('.panel-root')).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/04_panel_crear.png` })
  await page.locator('.panel-close').click()
})

// ─── 05 Panel crear con datos ─────────────────────────────────────────────────
test('05 - panel crear con datos', async ({ page }) => {
  await irAEventosClinicos(page)
  await page.locator('.ec-btn-nuevo').click()
  await expect(page.locator('input[name="tipo_evento"]')).toBeVisible()
  await page.fill('input[name="tipo_evento"]', 'Cirugía Programada')
  await page.screenshot({ path: `${OUT}/05_panel_crear_completo.png` })
  await page.locator('.panel-footer .panel-btn-secondary').click()
  const guard = page.locator('.cd-overlay')
  if (await guard.isVisible()) {
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
  }
})

// ─── 06 Panel editar ──────────────────────────────────────────────────────────
test('06 - panel editar', async ({ page }) => {
  await irAEventosClinicos(page)
  await page.fill('.ec-search-input', TIPO_DEMO)
  await page.waitForTimeout(500)
  const fila = page.locator('.ec-table tbody tr', { hasText: TIPO_DEMO })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.locator('.ec-action-btn.edit').click()
  await expect(page.locator('.panel-root')).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/06_panel_editar.png` })
  await page.locator('.panel-close').click()
})

// ─── 07 ConfirmDialog eliminar ────────────────────────────────────────────────
test('07 - confirm dialog eliminar', async ({ page }) => {
  await irAEventosClinicos(page)
  await page.fill('.ec-search-input', TIPO_DEMO)
  await page.waitForTimeout(500)
  const fila = page.locator('.ec-table tbody tr', { hasText: TIPO_DEMO })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.locator('.ec-action-btn.trash').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/07_confirm_eliminar.png` })
  await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
})

// ─── 08 NavigationGuard al cancelar ──────────────────────────────────────────
test('08 - navigation guard cancelar', async ({ page }) => {
  await irAEventosClinicos(page)
  await page.locator('.ec-btn-nuevo').click()
  await page.fill('input[name="tipo_evento"]', 'Evento Temporal')
  await page.locator('.panel-footer .panel-btn-secondary').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/08_navigation_guard.png` })
  await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
})
