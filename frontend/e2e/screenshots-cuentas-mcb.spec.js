const { test, expect } = require('@playwright/test')
const path = require('path')
const fs   = require('fs')

const OUT       = path.resolve(__dirname, '../../docs/imagenes/cuentas-mcb')
const CTA_DESC  = 'E2E Caja MCB'
const MOV_NRO   = 'E2ESCBMC-001'

let token  = null
let ctaId  = null
let movId  = null

test.use({ viewport: { width: 1440, height: 900 } })

function hoyStr() { return new Date().toISOString().split('T')[0] }

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

function authH() { return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }

async function apiGet(request, path) {
  const r = await request.get(`http://localhost:8000${path}`, { headers: { Authorization: `Bearer ${token}` } })
  return r.json()
}
async function apiPost(request, path, data) {
  const r = await request.post(`http://localhost:8000${path}`, { headers: authH(), data })
  return { status: r.status(), body: await r.json() }
}
async function apiDelete(request, path) {
  await request.delete(`http://localhost:8000${path}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
}

async function obtenerOCrearCuenta(request) {
  const data = await apiGet(request, `/api/cuentas-mcb/?search=${encodeURIComponent(CTA_DESC)}&page_size=10`)
  const existe = (data.results ?? []).find(c => c.descripcion === CTA_DESC && !c.is_deleted)
  if (existe) return existe.id
  const { body } = await apiPost(request, '/api/cuentas-mcb/', { descripcion: CTA_DESC })
  return body.id
}

async function obtenerOCrearMovimiento(request) {
  const data = await apiGet(request, `/api/movimientos-caja/?search=${MOV_NRO}&page_size=10`)
  const existe = (data.results ?? []).find(m => m.nro_comprobante === MOV_NRO && !m.is_deleted)
  if (existe) return existe.id
  const { body } = await apiPost(request, '/api/movimientos-caja/', {
    cta: ctaId, fecha: hoyStr(), nro_comprobante: MOV_NRO, monto_ingreso: 120000, monto_egreso: 0,
  })
  return body.id
}

async function irACuentas(page) {
  await page.goto('/finanzas/cuentas')
  await expect(page.locator('.cta-header')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(600)
}

async function irAMovimientos(page) {
  await irACuentas(page)
  const card = page.locator('.cta-card').filter({ hasText: CTA_DESC })
  await expect(card).toBeVisible({ timeout: 8000 })
  await card.click()
  await expect(page.locator('.cta-vista-drill')).toBeVisible({ timeout: 6000 })
  await page.waitForTimeout(500)
}

test.beforeAll(async ({ request }) => {
  fs.mkdirSync(OUT, { recursive: true })
  token = await obtenerToken(request)
  ctaId = await obtenerOCrearCuenta(request)
  movId = await obtenerOCrearMovimiento(request)
})

test.afterAll(async ({ request }) => {
  if (movId) await apiDelete(request, `/api/movimientos-caja/${movId}/`)
  const extras = await apiGet(request, `/api/movimientos-caja/?cta=${ctaId}&page_size=50`)
  for (const m of (extras.results ?? [])) {
    if (!m.is_deleted) await apiDelete(request, `/api/movimientos-caja/${m.id}/`)
  }
  if (ctaId) await apiDelete(request, `/api/cuentas-mcb/${ctaId}/`).catch(() => {})
})

// ─── 01 Vista principal de cuentas ────────────────────────────────────────────

test('01 - listado de cuentas', async ({ page }) => {
  await irACuentas(page)
  await page.screenshot({ path: `${OUT}/01_listado.png` })
})

// ─── 02 Búsqueda activa ───────────────────────────────────────────────────────

test('02 - búsqueda con filtro activo', async ({ page }) => {
  await irACuentas(page)
  await page.fill('.cta-search-input', 'E2E')
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/02_busqueda.png` })
  await page.fill('.cta-search-input', '')
})

// ─── 03 Vista de movimientos (drill) ─────────────────────────────────────────

test('03 - vista de movimientos de una cuenta', async ({ page }) => {
  await irAMovimientos(page)
  await page.screenshot({ path: `${OUT}/03_panel_detalle.png` })
})

// ─── 04 Panel nueva cuenta vacío ─────────────────────────────────────────────

test('04 - panel nueva cuenta vacío', async ({ page }) => {
  await irACuentas(page)
  await page.locator('.cta-btn-primario', { hasText: 'Nueva cuenta' }).click()
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Nueva cuenta' })).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/04_panel_crear.png` })
  await page.locator('.cta-panel-cerrar').click()
})

// ─── 05 Panel nueva cuenta con datos ─────────────────────────────────────────

test('05 - panel nueva cuenta con datos', async ({ page }) => {
  await irACuentas(page)
  await page.locator('.cta-btn-primario', { hasText: 'Nueva cuenta' }).click()
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Nueva cuenta' })).toBeVisible({ timeout: 5000 })
  await page.fill('.cta-input', 'Banco Nacional — Cta. Corriente 001')
  await page.screenshot({ path: `${OUT}/05_panel_crear_completo.png` })
  await page.locator('.cta-panel-cerrar').click()
})

// ─── 06 Panel nuevo movimiento con datos ─────────────────────────────────────

test('06 - panel nuevo movimiento con datos', async ({ page }) => {
  await irAMovimientos(page)
  await page.locator('.cta-btn-primario', { hasText: 'Nuevo' }).click()
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Nuevo movimiento' })).toBeVisible({ timeout: 5000 })
  await page.locator('.cta-tipo-btn.ingreso-btn').click()
  await page.fill('.cta-input.cta-mono', '250000')
  await page.fill('input[type="date"].cta-input', hoyStr())
  await page.fill('input.cta-input:not(.cta-mono):not([type="date"])', 'REC-2026-0001')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/06_panel_editar.png` })
  await page.locator('.cta-panel-cerrar').click()
})

// ─── 07 ConfirmDialog eliminar movimiento ────────────────────────────────────

test('07 - confirm dialog eliminar movimiento', async ({ page }) => {
  await irAMovimientos(page)
  await expect(page.locator('.cta-tabla')).toBeVisible({ timeout: 8000 })
  const fila = page.locator('.cta-tr').first()
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.locator('.cta-row-btn.danger').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/07_confirm_eliminar.png` })
  await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
})

// ─── 08 Panel editar cuenta ───────────────────────────────────────────────────

test('08 - panel editar cuenta', async ({ page }) => {
  await irAMovimientos(page)
  await page.locator('.cta-btn-icon-edit').click()
  await expect(page.locator('.cta-panel-titulo')).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/08_navigation_guard.png` })
  await page.locator('.cta-panel-cerrar').click()
})
