const { test, expect } = require('@playwright/test')
const path = require('path')

const OUT = path.resolve(__dirname, '../../docs/imagenes/consultorios')
const TS  = Date.now()
const NRO_DEMO = `Demo-${TS}`

// Crea un consultorio para las capturas y lo elimina al terminar
let consId = null
let token  = null

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
  const r = await request.post('http://localhost:8000/api/consultorio/', {
    data: { nro_consultorio: NRO_DEMO, descripcion: 'Atención general y pediatría' },
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await r.json()
  consId = body.id
})

test.afterAll(async ({ request }) => {
  if (consId) {
    await request.delete(`http://localhost:8000/api/consultorio/${consId}/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  }
})

async function irAConsultorios(page) {
  await page.goto('/mantenimiento/consultorios')
  await expect(page.locator('.con-btn-nuevo')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.con-table tbody td', { hasText: 'Cargando' }))
    .not.toBeVisible({ timeout: 8000 })
}

// ─── 01 Listado principal ─────────────────────────────────────────────────────
test('01 - listado principal', async ({ page }) => {
  await irAConsultorios(page)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/01_listado.png` })
})

// ─── 02 Búsqueda activa ───────────────────────────────────────────────────────
test('02 - busqueda activa', async ({ page }) => {
  await irAConsultorios(page)
  await page.fill('.con-search-input', NRO_DEMO)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/02_busqueda.png` })
})

// ─── 03 Panel detalle ─────────────────────────────────────────────────────────
test('03 - panel detalle', async ({ page }) => {
  await irAConsultorios(page)
  // Buscar el consultorio demo y hacer clic
  await page.fill('.con-search-input', NRO_DEMO)
  await page.waitForTimeout(500)
  const fila = page.locator('.con-table tbody tr', { hasText: NRO_DEMO })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.click()
  await expect(page.locator('.panel-root')).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/03_panel_detalle.png` })
})

// ─── 04 Panel crear ───────────────────────────────────────────────────────────
test('04 - panel crear vacio', async ({ page }) => {
  await irAConsultorios(page)
  await page.locator('.con-btn-nuevo').click()
  await expect(page.locator('.panel-root')).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/04_panel_crear.png` })
  // Cerrar sin guardar (panel limpio, no hay datos → NavigationGuard no actúa)
  await page.locator('.panel-close').click()
})

// ─── 05 Panel crear con botón Guardar habilitado ──────────────────────────────
test('05 - panel crear con datos', async ({ page }) => {
  await irAConsultorios(page)
  await page.locator('.con-btn-nuevo').click()
  await expect(page.locator('input[name="nro_consultorio"]')).toBeVisible()
  await page.fill('input[name="nro_consultorio"]', 'Consultorio 3')
  await page.fill('input[name="descripcion"]', 'Traumatología y ortopedia')
  await page.screenshot({ path: `${OUT}/05_panel_crear_completo.png` })
  // Cancelar → NavigationGuard actúa
  await page.locator('.panel-footer .panel-btn-secondary').click()
  const guard = page.locator('.cd-overlay')
  if (await guard.isVisible()) {
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
  }
})

// ─── 06 Panel editar ──────────────────────────────────────────────────────────
test('06 - panel editar', async ({ page }) => {
  await irAConsultorios(page)
  await page.fill('.con-search-input', NRO_DEMO)
  await page.waitForTimeout(500)
  const fila = page.locator('.con-table tbody tr', { hasText: NRO_DEMO })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.locator('.con-action-btn.edit').click()
  await expect(page.locator('.panel-root')).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/06_panel_editar.png` })
  // Cancelar sin cambios → no activa guard
  await page.locator('.panel-close').click()
})

// ─── 07 ConfirmDialog eliminar ────────────────────────────────────────────────
test('07 - confirm dialog eliminar', async ({ page }) => {
  await irAConsultorios(page)
  await page.fill('.con-search-input', NRO_DEMO)
  await page.waitForTimeout(500)
  const fila = page.locator('.con-table tbody tr', { hasText: NRO_DEMO })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.locator('.con-action-btn.trash').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/07_confirm_eliminar.png` })
  // Cancelar para no eliminar
  await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
})

// ─── 08 NavigationGuard al cancelar ──────────────────────────────────────────
test('08 - navigation guard cancelar', async ({ page }) => {
  await irAConsultorios(page)
  await page.locator('.con-btn-nuevo').click()
  await page.fill('input[name="nro_consultorio"]', 'Consultorio Temporal')
  // Cancelar activa el guard
  await page.locator('.panel-footer .panel-btn-secondary').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/08_navigation_guard.png` })
  await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
})
