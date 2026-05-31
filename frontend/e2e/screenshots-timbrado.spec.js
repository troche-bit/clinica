const { test, expect } = require('@playwright/test')
const path = require('path')

const OUT = path.resolve(__dirname, '../../docs/imagenes/timbrado')
const TS  = Date.now()

let token  = null
let timId1 = null
let timId2 = null

test.use({ viewport: { width: 1440, height: 900 } })

// ─── helpers ──────────────────────────────────────────────────────────────────

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

function auth() { return { Authorization: `Bearer ${token}` } }

async function limpiar(request, nro) {
  const r    = await request.get(`http://localhost:8000/api/timbrado/?search=${nro}&page_size=10`, { headers: auth() })
  const data = await r.json()
  for (const t of (data.results ?? data)) {
    if (t.nro_timbrado === nro)
      await request.delete(`http://localhost:8000/api/timbrado/${t.id}/`, { headers: auth() })
  }
}

async function crear(request, nro, extra = {}) {
  const r = await request.post('http://localhost:8000/api/timbrado/', {
    headers: auth(),
    data: {
      nro_timbrado:     nro,
      autoimpresor:     false,
      inicio_vigencia:  '2099-01-01',
      fin_vigencia:     '2099-12-31',
      punto_sucursal:   '001',
      punto_expedicion: '001',
      nro_desde:        1,
      nro_hasta:        999999,
      ...extra,
    },
  })
  return (await r.json()).id
}

async function irATimbrado(page) {
  await page.goto('/facturacion/timbrado')
  await expect(page.locator('.tim-tabla, .tim-empty')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(500)
}

// ─── setup / teardown ─────────────────────────────────────────────────────────

test.beforeAll(async ({ request }) => {
  token  = await obtenerToken(request)
  await limpiar(request, '12399001')
  await limpiar(request, '12399002')
  timId1 = await crear(request, '12399001')
  timId2 = await crear(request, '12399002', {
    inicio_vigencia: '2020-01-01',
    fin_vigencia:    '2020-12-31',   // timbrado vencido para screenshot 08
  })
})

test.afterAll(async ({ request }) => {
  if (timId1) await request.delete(`http://localhost:8000/api/timbrado/${timId1}/`, { headers: auth() })
  if (timId2) await request.delete(`http://localhost:8000/api/timbrado/${timId2}/`, { headers: auth() })
})

// ─── 01 Listado principal ─────────────────────────────────────────────────────
test('01 - listado principal', async ({ page }) => {
  await irATimbrado(page)
  await page.screenshot({ path: `${OUT}/01_listado.png` })
})

// ─── 02 Búsqueda activa ───────────────────────────────────────────────────────
test('02 - busqueda activa', async ({ page }) => {
  await irATimbrado(page)
  await page.fill('.tim-search-input', '12399001')
  await page.waitForTimeout(500)
  await expect(page.locator('.tim-tr', { hasText: '12399001' })).toBeVisible({ timeout: 6000 })
  await page.screenshot({ path: `${OUT}/02_busqueda.png` })
})

// ─── 03 Panel detalle ─────────────────────────────────────────────────────────
test('03 - panel detalle', async ({ page }) => {
  await irATimbrado(page)
  await page.fill('.tim-search-input', '12399001')
  await page.waitForTimeout(500)
  const fila = page.locator('.tim-tr', { hasText: '12399001' })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.click()
  await expect(page.locator('.tim-panel')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/03_panel_detalle.png` })
})

// ─── 04 Panel crear vacío ─────────────────────────────────────────────────────
test('04 - panel crear vacio', async ({ page }) => {
  await irATimbrado(page)
  await page.locator('.tim-btn-nuevo').click()
  await expect(page.locator('.tim-panel-titulo', { hasText: 'Nuevo timbrado' })).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/04_panel_crear.png` })
  await page.locator('.tim-panel-cerrar').click()
})

// ─── 05 Panel crear con datos ─────────────────────────────────────────────────
test('05 - panel crear con datos completos', async ({ page }) => {
  await irATimbrado(page)
  await page.locator('.tim-btn-nuevo').click()
  await expect(page.locator('.tim-panel-titulo', { hasText: 'Nuevo timbrado' })).toBeVisible()
  await page.fill('input[placeholder="12345678"]', '99887766')
  await page.fill('input[type="date"]', '2099-01-01')
  await page.locator('input[type="date"]').nth(1).fill('2099-12-31')
  await page.fill('input[placeholder="001"]', '001')
  await page.locator('input[placeholder="001"]').nth(1).fill('001')
  await page.fill('input[placeholder="0000001"]', '0000001')
  await page.fill('input[placeholder="0000999"]', '0999999')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/05_panel_crear_completo.png` })
  await page.locator('.tim-btn-secundario').click()
})

// ─── 06 Panel editar ──────────────────────────────────────────────────────────
test('06 - panel editar', async ({ page }) => {
  await irATimbrado(page)
  await page.fill('.tim-search-input', '12399001')
  await page.waitForTimeout(500)
  const fila = page.locator('.tim-tr', { hasText: '12399001' })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.click()
  await expect(page.locator('.tim-panel')).toBeVisible({ timeout: 4000 })
  await page.locator('.tim-panel button', { hasText: 'Editar' }).click()
  await expect(page.locator('.tim-panel-titulo', { hasText: 'Editar timbrado' })).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/06_panel_editar.png` })
  await page.locator('.tim-btn-secundario').click()
})

// ─── 07 ConfirmDialog eliminar ────────────────────────────────────────────────
test('07 - confirm dialog eliminar', async ({ page }) => {
  await irATimbrado(page)
  await page.fill('.tim-search-input', '12399001')
  await page.waitForTimeout(500)
  const fila = page.locator('.tim-tr', { hasText: '12399001' })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.click()
  await expect(page.locator('.tim-panel')).toBeVisible({ timeout: 4000 })
  await page.locator('.tim-panel button', { hasText: 'Eliminar' }).click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/07_confirm_eliminar.png` })
  await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
})

// ─── 08 Filtro expirados con timbrado vencido ─────────────────────────────────
test('08 - filtro expirados', async ({ page }) => {
  await irATimbrado(page)
  await page.selectOption('.tim-filtro-select', 'false')
  await page.waitForTimeout(500)
  await expect(page.locator('.tim-tr', { hasText: '12399002' })).toBeVisible({ timeout: 6000 })
  await page.screenshot({ path: `${OUT}/08_navigation_guard.png` })
})
