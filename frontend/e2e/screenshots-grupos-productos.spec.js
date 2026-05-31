const { test, expect } = require('@playwright/test')
const path = require('path')

const OUT = path.resolve(__dirname, '../../docs/imagenes/grupos-productos')

let token    = null
let grupoId1 = null
let grupoId2 = null
let prodId1  = null

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

async function limpiarGrupo(request, descripcion) {
  const r    = await request.get(`http://localhost:8000/api/grupos/?search=${encodeURIComponent(descripcion)}`, { headers: auth() })
  const data = await r.json()
  for (const g of (data.results ?? data)) {
    if (g.descripcion === descripcion) {
      const rp = await request.get(`http://localhost:8000/api/productos/?grupo=${g.id}`, { headers: auth() })
      const ps = await rp.json()
      for (const p of (ps.results ?? ps))
        await request.delete(`http://localhost:8000/api/productos/${p.id}/`, { headers: auth() })
      await request.delete(`http://localhost:8000/api/grupos/${g.id}/`, { headers: auth() })
    }
  }
}

async function crearGrupo(request, descripcion) {
  const r = await request.post('http://localhost:8000/api/grupos/', {
    headers: auth(),
    data: { descripcion, activo: true },
  })
  return (await r.json()).id
}

async function crearProducto(request, grupoId, descripcion, impuesto = '10') {
  const r = await request.post('http://localhost:8000/api/productos/', {
    headers: auth(),
    data: { descripcion, grupo: grupoId, impuesto, activo: true },
  })
  return (await r.json()).id
}

async function irAGrupos(page) {
  await page.goto('/facturacion/grupos')
  await expect(page.locator('.grp-cards-grid, .grp-empty')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(400)
}

async function irAProductos(page, nombreGrupo) {
  await irAGrupos(page)
  const card = page.locator('.grp-card', { hasText: nombreGrupo })
  await expect(card).toBeVisible({ timeout: 6000 })
  await card.click()
  await expect(page.locator('.grp-btn-volver')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(400)
}

// ─── setup / teardown ─────────────────────────────────────────────────────────

test.beforeAll(async ({ request }) => {
  token = await obtenerToken(request)
  await limpiarGrupo(request, 'Consultas Médicas')
  await limpiarGrupo(request, 'Laboratorio')
  grupoId1 = await crearGrupo(request, 'Consultas Médicas')
  grupoId2 = await crearGrupo(request, 'Laboratorio')
  prodId1  = await crearProducto(request, grupoId1, 'Consulta General', '10')
  await crearProducto(request, grupoId1, 'Consulta Especializada', '10')
  await crearProducto(request, grupoId1, 'Procedimiento Menor', 'exenta')
})

test.afterAll(async ({ request }) => {
  await limpiarGrupo(request, 'Consultas Médicas')
  await limpiarGrupo(request, 'Laboratorio')
})

// ─── 01 Listado de grupos ─────────────────────────────────────────────────────
test('01 - listado de grupos', async ({ page }) => {
  await irAGrupos(page)
  await expect(page.locator('.grp-card', { hasText: 'Consultas Médicas' })).toBeVisible({ timeout: 6000 })
  await page.screenshot({ path: `${OUT}/01_listado.png` })
})

// ─── 02 Búsqueda de grupos ────────────────────────────────────────────────────
test('02 - busqueda activa', async ({ page }) => {
  await irAGrupos(page)
  await page.fill('.grp-search-input', 'Consul')
  await page.waitForTimeout(500)
  await expect(page.locator('.grp-card', { hasText: 'Consultas Médicas' })).toBeVisible({ timeout: 6000 })
  await page.screenshot({ path: `${OUT}/02_busqueda.png` })
})

// ─── 03 Vista productos (detalle del grupo) ───────────────────────────────────
test('03 - vista productos del grupo', async ({ page }) => {
  await irAProductos(page, 'Consultas Médicas')
  await expect(page.locator('.grp-tr', { hasText: 'Consulta General' })).toBeVisible({ timeout: 6000 })
  await page.screenshot({ path: `${OUT}/03_panel_detalle.png` })
})

// ─── 04 Panel crear grupo vacío ───────────────────────────────────────────────
test('04 - panel crear grupo vacio', async ({ page }) => {
  await irAGrupos(page)
  await page.locator('button', { hasText: 'Nuevo grupo' }).click()
  await expect(page.locator('.grp-panel-overlay')).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/04_panel_crear.png` })
  await page.locator('.grp-panel-cerrar').click()
})

// ─── 05 Panel crear grupo con datos ──────────────────────────────────────────
test('05 - panel crear grupo con datos', async ({ page }) => {
  await irAGrupos(page)
  await page.locator('button', { hasText: 'Nuevo grupo' }).click()
  await expect(page.locator('.grp-panel-overlay')).toBeVisible()
  await page.locator('.grp-panel-overlay .grp-input').fill('Procedimientos Quirúrgicos')
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/05_panel_crear_completo.png` })
  await page.locator('.grp-panel-overlay .grp-btn-secundario').click()
})

// ─── 06 Panel editar grupo ────────────────────────────────────────────────────
test('06 - panel editar grupo', async ({ page }) => {
  await irAProductos(page, 'Consultas Médicas')
  await page.locator('.grp-btn-icon-edit').click()
  await expect(page.locator('.grp-panel-overlay')).toBeVisible()
  await expect(page.locator('.grp-panel-overlay .grp-input')).toHaveValue('Consultas Médicas')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/06_panel_editar.png` })
  await page.locator('.grp-panel-overlay .grp-btn-secundario').click()
})

// ─── 07 ConfirmDialog eliminar ────────────────────────────────────────────────
test('07 - confirm dialog eliminar producto', async ({ page }) => {
  await irAProductos(page, 'Consultas Médicas')
  const fila = page.locator('.grp-tr', { hasText: 'Consulta General' })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.locator('.grp-row-btn.danger').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/07_confirm_eliminar.png` })
  await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
})

// ─── 08 Panel crear producto con datos ───────────────────────────────────────
test('08 - panel crear producto con datos', async ({ page }) => {
  await irAProductos(page, 'Laboratorio')
  await page.locator('button', { hasText: 'Nuevo producto' }).click()
  await expect(page.locator('.grp-drill-body .grp-panel')).toBeVisible()
  await page.locator('.grp-drill-body .grp-panel .grp-input').fill('Hemograma Completo')
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/08_navigation_guard.png` })
  await page.locator('.grp-drill-body .grp-panel .grp-btn-secundario').click()
})
