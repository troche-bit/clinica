const { test, expect } = require('@playwright/test')

const GRUPO_1 = 'E2E Grupo Alpha Test'
const GRUPO_2 = 'E2E Grupo Beta Test'
const PROD_1  = 'E2E Producto Test Uno'

let grupoId1 = null
let grupoId2 = null
let prodId1  = null
let token    = null

// ─── helpers ──────────────────────────────────────────────────────────────────

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

async function apiDeleteGrupo(request, id) {
  await request.delete(`http://localhost:8000/api/grupos/${id}/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function apiDeleteProducto(request, id) {
  await request.delete(`http://localhost:8000/api/productos/${id}/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function crearGrupo(request, descripcion) {
  const r = await request.post('http://localhost:8000/api/grupos/', {
    headers: { Authorization: `Bearer ${token}` },
    data: { descripcion, activo: true },
  })
  const body = await r.json()
  return body.id
}

async function crearProducto(request, grupoId, descripcion, impuesto = '10') {
  const r = await request.post('http://localhost:8000/api/productos/', {
    headers: { Authorization: `Bearer ${token}` },
    data: { descripcion, grupo: grupoId, impuesto, activo: true },
  })
  const body = await r.json()
  return body.id
}

async function limpiarGrupo(request, descripcion) {
  const r = await request.get(
    `http://localhost:8000/api/grupos/?search=${encodeURIComponent(descripcion)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const data = await r.json()
  for (const g of (data.results ?? data)) {
    if (g.descripcion === descripcion) {
      const rProd = await request.get(
        `http://localhost:8000/api/productos/?grupo=${g.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const prods = await rProd.json()
      for (const p of (prods.results ?? prods)) {
        await request.delete(`http://localhost:8000/api/productos/${p.id}/`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      }
      await request.delete(`http://localhost:8000/api/grupos/${g.id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  }
}

async function irAGrupos(page) {
  await page.goto('/facturacion/grupos')
  await expect(page.locator('.grp-cards-grid, .grp-empty')).toBeVisible({ timeout: 10000 })
}

async function irAProductos(page, nombreGrupo) {
  await irAGrupos(page)
  const card = page.locator('.grp-card', { hasText: nombreGrupo })
  await expect(card).toBeVisible({ timeout: 6000 })
  await card.click()
  await expect(page.locator('.grp-btn-volver')).toBeVisible({ timeout: 4000 })
}

// ─── setup / teardown ─────────────────────────────────────────────────────────

test.beforeAll(async ({ request }) => {
  token    = await obtenerToken(request)
  await limpiarGrupo(request, GRUPO_1)
  await limpiarGrupo(request, GRUPO_2)
  grupoId1 = await crearGrupo(request, GRUPO_1)
  grupoId2 = await crearGrupo(request, GRUPO_2)
  prodId1  = await crearProducto(request, grupoId1, PROD_1)
})

test.afterAll(async ({ request }) => {
  if (prodId1)  await apiDeleteProducto(request, prodId1)
  if (grupoId1) await apiDeleteGrupo(request, grupoId1)
  if (grupoId2) await apiDeleteGrupo(request, grupoId2)
})

// ══════════════════════════════════════════════════════════════════════════════
// ESTRUCTURA INICIAL — GRUPOS
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Estructura inicial — Grupos', () => {

  test('01 - carga con grid de cards, buscador y botón Nuevo', async ({ page }) => {
    await irAGrupos(page)
    await expect(page.locator('.grp-search-input')).toBeVisible()
    await expect(page.locator('button', { hasText: 'Nuevo grupo' })).toBeVisible()
    await expect(page.locator('.grp-cards-grid')).toBeVisible()
  })

  test('02 - sin panel overlay al entrar', async ({ page }) => {
    await irAGrupos(page)
    await expect(page.locator('.grp-panel-overlay')).not.toBeVisible()
  })

  test('03 - la card muestra nombre y estado', async ({ page }) => {
    await irAGrupos(page)
    const card = page.locator('.grp-card', { hasText: GRUPO_1 })
    await expect(card).toBeVisible({ timeout: 6000 })
    await expect(card.locator('.grp-card-nombre')).toContainText(GRUPO_1)
    await expect(card.locator('.grp-badge-estado')).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// CREAR GRUPO
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Crear grupo', () => {

  test('04 - botón Nuevo abre panel en modo crear', async ({ page }) => {
    await irAGrupos(page)
    await page.locator('button', { hasText: 'Nuevo grupo' }).click()
    await expect(page.locator('.grp-panel-overlay')).toBeVisible()
    await expect(page.locator('.grp-panel-titulo')).toContainText('Nuevo grupo')
  })

  test('05 - descripción vacía muestra error sin cerrar panel', async ({ page }) => {
    await irAGrupos(page)
    await page.locator('button', { hasText: 'Nuevo grupo' }).click()
    await page.locator('button', { hasText: 'Crear grupo' }).click()
    await expect(page.locator('.grp-error-msg')).toBeVisible()
    await expect(page.locator('.grp-panel-overlay')).toBeVisible()
  })

  test('06 - crear grupo válido aparece en grid con toast', async ({ page }) => {
    await irAGrupos(page)
    await page.locator('button', { hasText: 'Nuevo grupo' }).click()
    await page.locator('.grp-panel-overlay .grp-input').fill('E2E Grupo Nuevo Test')

    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/grupos/') && r.request().method() === 'POST'),
      page.locator('button', { hasText: 'Crear grupo' }).click(),
    ])
    expect(response.status()).toBe(201)
    const { id } = await response.json()

    await expect(page.locator('.grp-panel-overlay')).not.toBeVisible({ timeout: 3000 })
    await page.fill('.grp-search-input', 'E2E Grupo Nuevo Test')
    await page.waitForTimeout(400)
    await expect(page.locator('.grp-card', { hasText: 'E2E Grupo Nuevo Test' })).toBeVisible({ timeout: 6000 })
    await expect(page.locator('[class*="toast"]').first()).toBeVisible({ timeout: 3000 })

    if (id) await apiDeleteGrupo(page.request, id)
  })

  test('07 - duplicado muestra error sin cerrar panel', async ({ page }) => {
    await irAGrupos(page)
    await page.locator('button', { hasText: 'Nuevo grupo' }).click()
    await page.locator('.grp-panel-overlay .grp-input').fill(GRUPO_1)
    await page.locator('button', { hasText: 'Crear grupo' }).click()
    await expect(page.locator('[class*="toast"]').first()).toBeVisible({ timeout: 3000 })
    await expect(page.locator('.grp-panel-overlay')).toBeVisible()
  })

  test('08 - cancelar cierra el panel sin guardar', async ({ page }) => {
    await irAGrupos(page)
    await page.locator('button', { hasText: 'Nuevo grupo' }).click()
    await page.locator('.grp-panel-overlay .grp-input').fill('E2E No Guardar Grupo')
    await page.locator('.grp-panel-overlay .grp-btn-secundario').click()
    await expect(page.locator('.grp-panel-overlay')).not.toBeVisible()
    await page.fill('.grp-search-input', 'E2E No Guardar Grupo')
    await page.waitForTimeout(400)
    await expect(page.locator('.grp-card', { hasText: 'E2E No Guardar Grupo' })).not.toBeVisible()
  })

  test('09 - X cierra el panel sin guardar', async ({ page }) => {
    await irAGrupos(page)
    await page.locator('button', { hasText: 'Nuevo grupo' }).click()
    await expect(page.locator('.grp-panel-overlay')).toBeVisible()
    await page.locator('.grp-panel-cerrar').click()
    await expect(page.locator('.grp-panel-overlay')).not.toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// NAVEGAR ENTRE VISTAS
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Navegación de vistas', () => {

  test('10 - click en card abre vista productos con nombre del grupo', async ({ page }) => {
    await irAGrupos(page)
    const card = page.locator('.grp-card', { hasText: GRUPO_1 })
    await card.click()
    await expect(page.locator('.grp-btn-volver')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.grp-header-title')).toContainText(GRUPO_1)
  })

  test('11 - botón Volver regresa a vista de grupos', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    await page.locator('.grp-btn-volver').click()
    await expect(page.locator('.grp-cards-grid')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.grp-btn-volver')).not.toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// EDITAR GRUPO
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Editar grupo', () => {

  test('12 - botón lápiz en header abre panel edición con datos precargados', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    await page.locator('.grp-btn-icon-edit').click()
    await expect(page.locator('.grp-panel-overlay')).toBeVisible()
    await expect(page.locator('.grp-panel-titulo')).toContainText('Editar')
    await expect(page.locator('.grp-panel-overlay .grp-input')).toHaveValue(GRUPO_1)
  })

  test('13 - editar descripción y guardar actualiza con toast', async ({ page }) => {
    await irAProductos(page, GRUPO_2)
    await page.locator('.grp-btn-icon-edit').click()
    const input = page.locator('.grp-panel-overlay .grp-input')
    await input.clear()
    await input.fill('E2E Grupo Beta Editado')

    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/grupos/') && r.request().method() === 'PATCH'),
      page.locator('button', { hasText: 'Guardar cambios' }).click(),
    ])
    expect(response.status()).toBe(200)
    await expect(page.locator('.grp-panel-overlay')).not.toBeVisible({ timeout: 3000 })
    await expect(page.locator('[class*="toast"]').first()).toBeVisible({ timeout: 3000 })

    // Restaurar nombre original para no afectar otros tests
    await page.locator('.grp-btn-icon-edit').click()
    const inputRestore = page.locator('.grp-panel-overlay .grp-input')
    await inputRestore.clear()
    await inputRestore.fill(GRUPO_2)
    await page.locator('button', { hasText: 'Guardar cambios' }).click()
    await expect(page.locator('.grp-panel-overlay')).not.toBeVisible({ timeout: 3000 })
  })

  test('14 - guardar con el mismo nombre no falla', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    await page.locator('.grp-btn-icon-edit').click()
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/grupos/') && r.request().method() === 'PATCH'),
      page.locator('button', { hasText: 'Guardar cambios' }).click(),
    ])
    expect(response.status()).toBe(200)
  })

  test('15 - duplicado de otro grupo muestra error', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    await page.locator('.grp-btn-icon-edit').click()
    const input = page.locator('.grp-panel-overlay .grp-input')
    await input.clear()
    await input.fill(GRUPO_2)
    await page.locator('button', { hasText: 'Guardar cambios' }).click()
    await expect(page.locator('[class*="toast"]').first()).toBeVisible({ timeout: 3000 })
    await expect(page.locator('.grp-panel-overlay')).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// ELIMINAR GRUPO
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Eliminar grupo', () => {

  test('16 - botón basura abre ConfirmDialog', async ({ page }) => {
    await irAProductos(page, GRUPO_2)
    await page.locator('.grp-btn-icon-del').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  })

  test('17 - cancelar en ConfirmDialog mantiene el grupo', async ({ page }) => {
    await irAProductos(page, GRUPO_2)
    await page.locator('.grp-btn-icon-del').click()
    await expect(page.locator('.cd-overlay')).toBeVisible()
    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
    await expect(page.locator('.cd-overlay')).not.toBeVisible()
    await expect(page.locator('.grp-btn-volver')).toBeVisible()
  })

  test('18 - confirmar elimina y vuelve a vista grupos con toast', async ({ page, request }) => {
    const nombreTemp = 'E2E Grupo Para Eliminar'
    await limpiarGrupo(request, nombreTemp)
    await crearGrupo(request, nombreTemp)

    await irAProductos(page, nombreTemp)
    await page.locator('.grp-btn-icon-del').click()
    await expect(page.locator('.cd-overlay')).toBeVisible()
    await page.locator('.cd-backdrop').getByRole('button', { name: /eliminar/i }).click()

    await expect(page.locator('.grp-cards-grid')).toBeVisible({ timeout: 6000 })
    await expect(page.locator('[class*="toast"]').first()).toBeVisible({ timeout: 3000 })

    await page.fill('.grp-search-input', nombreTemp)
    await page.waitForTimeout(400)
    await expect(page.locator('.grp-card', { hasText: nombreTemp })).not.toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// BÚSQUEDA DE GRUPOS
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Búsqueda de grupos', () => {

  test('19 - búsqueda filtra las cards por texto', async ({ page }) => {
    await irAGrupos(page)
    await page.fill('.grp-search-input', GRUPO_1)
    await page.waitForTimeout(400)
    await expect(page.locator('.grp-card', { hasText: GRUPO_1 })).toBeVisible()
  })

  test('20 - búsqueda sin resultados muestra estado vacío', async ({ page }) => {
    await irAGrupos(page)
    await page.fill('.grp-search-input', 'XYZ_NO_EXISTE_9999')
    await page.waitForTimeout(400)
    await expect(page.locator('.grp-empty')).toBeVisible()
  })

  test('21 - limpiar búsqueda restaura la lista', async ({ page }) => {
    await irAGrupos(page)
    await page.fill('.grp-search-input', 'XYZ_NO_EXISTE_9999')
    await page.waitForTimeout(300)
    await page.fill('.grp-search-input', '')
    await page.waitForTimeout(400)
    await expect(page.locator('.grp-card').first()).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// ESTRUCTURA INICIAL — PRODUCTOS
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Estructura inicial — Productos', () => {

  test('22 - vista productos muestra tabla con encabezados correctos', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    await expect(page.locator('.grp-tabla')).toBeVisible()
    await expect(page.locator('.grp-th', { hasText: 'Descripción' })).toBeVisible()
    await expect(page.locator('.grp-th', { hasText: 'Impuesto' })).toBeVisible()
    await expect(page.locator('.grp-th', { hasText: 'Estado' })).toBeVisible()
  })

  test('23 - buscador de productos y botón Nuevo visibles', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    await expect(page.locator('.grp-prod-search .grp-search-input')).toBeVisible()
    await expect(page.locator('button', { hasText: 'Nuevo producto' })).toBeVisible()
  })

  test('24 - sin panel lateral al entrar', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    await expect(page.locator('.grp-drill-body .grp-panel')).not.toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// CREAR PRODUCTO
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Crear producto', () => {

  test('25 - botón Nuevo producto abre panel', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    await page.locator('button', { hasText: 'Nuevo producto' }).click()
    await expect(page.locator('.grp-drill-body .grp-panel')).toBeVisible()
    await expect(page.locator('.grp-panel-titulo')).toContainText('Nuevo producto')
  })

  test('26 - descripción vacía muestra error sin cerrar panel', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    await page.locator('button', { hasText: 'Nuevo producto' }).click()
    await page.locator('button', { hasText: 'Agregar producto' }).click()
    await expect(page.locator('.grp-error-msg')).toBeVisible()
    await expect(page.locator('.grp-drill-body .grp-panel')).toBeVisible()
  })

  test('27 - crear producto válido aparece en tabla con toast', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    await page.locator('button', { hasText: 'Nuevo producto' }).click()
    await page.locator('.grp-drill-body .grp-panel .grp-input').fill('E2E Prod Nuevo Test')

    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/productos/') && r.request().method() === 'POST'),
      page.locator('button', { hasText: 'Agregar producto' }).click(),
    ])
    expect(response.status()).toBe(201)
    const { id } = await response.json()

    await expect(page.locator('.grp-drill-body .grp-panel')).not.toBeVisible({ timeout: 3000 })
    await expect(page.locator('.grp-tr', { hasText: 'E2E Prod Nuevo Test' })).toBeVisible({ timeout: 6000 })
    await expect(page.locator('[class*="toast"]').first()).toBeVisible({ timeout: 3000 })

    if (id) await apiDeleteProducto(page.request, id)
  })

  test('28 - duplicado en mismo grupo muestra error sin cerrar panel', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    await page.locator('button', { hasText: 'Nuevo producto' }).click()
    await page.locator('.grp-drill-body .grp-panel .grp-input').fill(PROD_1)
    await page.locator('button', { hasText: 'Agregar producto' }).click()
    await expect(page.locator('[class*="toast"]').first()).toBeVisible({ timeout: 3000 })
    await expect(page.locator('.grp-drill-body .grp-panel')).toBeVisible()
  })

  test('29 - cancelar cierra panel sin guardar', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    await page.locator('button', { hasText: 'Nuevo producto' }).click()
    await page.locator('.grp-drill-body .grp-panel .grp-input').fill('E2E No Guardar Prod')
    await page.locator('.grp-drill-body .grp-panel .grp-btn-secundario').click()
    await expect(page.locator('.grp-drill-body .grp-panel')).not.toBeVisible()
    await expect(page.locator('.grp-tr', { hasText: 'E2E No Guardar Prod' })).not.toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// EDITAR PRODUCTO
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Editar producto', () => {

  test('30 - lápiz en fila abre panel edición con datos precargados', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    const fila = page.locator('.grp-tr', { hasText: PROD_1 })
    await expect(fila).toBeVisible({ timeout: 6000 })
    await fila.locator('.grp-row-btn').first().click()
    await expect(page.locator('.grp-drill-body .grp-panel')).toBeVisible()
    await expect(page.locator('.grp-panel-titulo')).toContainText('Editar producto')
    await expect(page.locator('.grp-drill-body .grp-panel .grp-input')).toHaveValue(PROD_1)
  })

  test('31 - editar descripción y guardar actualiza con toast', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    const fila = page.locator('.grp-tr', { hasText: PROD_1 })
    await fila.locator('.grp-row-btn').first().click()
    const input = page.locator('.grp-drill-body .grp-panel .grp-input')
    await input.clear()
    await input.fill('E2E Producto Editado')

    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/productos/') && r.request().method() === 'PATCH'),
      page.locator('button', { hasText: 'Guardar cambios' }).click(),
    ])
    expect(response.status()).toBe(200)
    await expect(page.locator('.grp-drill-body .grp-panel')).not.toBeVisible({ timeout: 3000 })
    await expect(page.locator('[class*="toast"]').first()).toBeVisible({ timeout: 3000 })

    // Restaurar nombre original
    const filaEditada = page.locator('.grp-tr', { hasText: 'E2E Producto Editado' })
    await expect(filaEditada).toBeVisible({ timeout: 6000 })
    await filaEditada.locator('.grp-row-btn').first().click()
    const inputRestore = page.locator('.grp-drill-body .grp-panel .grp-input')
    await inputRestore.clear()
    await inputRestore.fill(PROD_1)
    await page.locator('button', { hasText: 'Guardar cambios' }).click()
    await expect(page.locator('.grp-drill-body .grp-panel')).not.toBeVisible({ timeout: 3000 })
  })

  test('32 - guardar con el mismo valor no falla', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    const fila = page.locator('.grp-tr', { hasText: PROD_1 })
    await fila.locator('.grp-row-btn').first().click()
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/productos/') && r.request().method() === 'PATCH'),
      page.locator('button', { hasText: 'Guardar cambios' }).click(),
    ])
    expect(response.status()).toBe(200)
  })

  test('33 - X del panel cierra sin guardar', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    const fila = page.locator('.grp-tr', { hasText: PROD_1 })
    await fila.locator('.grp-row-btn').first().click()
    await expect(page.locator('.grp-drill-body .grp-panel')).toBeVisible()
    await page.locator('.grp-panel-cerrar').click()
    await expect(page.locator('.grp-drill-body .grp-panel')).not.toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// ELIMINAR PRODUCTO
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Eliminar producto', () => {

  test('34 - botón basura en fila abre ConfirmDialog', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    const fila = page.locator('.grp-tr', { hasText: PROD_1 })
    await expect(fila).toBeVisible({ timeout: 6000 })
    await fila.locator('.grp-row-btn.danger').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  })

  test('35 - cancelar en ConfirmDialog mantiene el producto', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    const fila = page.locator('.grp-tr', { hasText: PROD_1 })
    await fila.locator('.grp-row-btn.danger').click()
    await expect(page.locator('.cd-overlay')).toBeVisible()
    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
    await expect(page.locator('.cd-overlay')).not.toBeVisible()
    await expect(page.locator('.grp-tr', { hasText: PROD_1 })).toBeVisible()
  })

  test('36 - confirmar elimina el producto con toast', async ({ page, request }) => {
    const idTemp = await crearProducto(request, grupoId1, 'E2E Prod Para Eliminar')

    await irAProductos(page, GRUPO_1)
    const fila = page.locator('.grp-tr', { hasText: 'E2E Prod Para Eliminar' })
    await expect(fila).toBeVisible({ timeout: 6000 })
    await fila.locator('.grp-row-btn.danger').click()
    await expect(page.locator('.cd-overlay')).toBeVisible()
    await page.locator('.cd-backdrop').getByRole('button', { name: /eliminar/i }).click()
    await expect(page.locator('.cd-overlay')).not.toBeVisible({ timeout: 4000 })
    await expect(page.locator('.grp-tr', { hasText: 'E2E Prod Para Eliminar' })).not.toBeVisible()
    await expect(page.locator('[class*="toast"]').first()).toBeVisible({ timeout: 3000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// BÚSQUEDA DE PRODUCTOS
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Búsqueda de productos', () => {

  test('37 - búsqueda filtra la tabla por texto', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    await page.fill('.grp-prod-search .grp-search-input', PROD_1)
    await page.waitForTimeout(400)
    await expect(page.locator('.grp-tr', { hasText: PROD_1 })).toBeVisible()
  })

  test('38 - búsqueda sin resultados muestra estado vacío', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    await page.fill('.grp-prod-search .grp-search-input', 'XYZ_NO_EXISTE_9999')
    await page.waitForTimeout(400)
    await expect(page.locator('.grp-empty')).toBeVisible()
  })

  test('39 - limpiar búsqueda restaura la lista', async ({ page }) => {
    await irAProductos(page, GRUPO_1)
    await page.fill('.grp-prod-search .grp-search-input', 'XYZ_NO_EXISTE_9999')
    await page.waitForTimeout(300)
    await page.fill('.grp-prod-search .grp-search-input', '')
    await page.waitForTimeout(400)
    await expect(page.locator('.grp-tr').first()).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// PERMISOS RECEPCIONISTA
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Permisos recepcionista', () => {

  test.use({ storageState: undefined })

  async function loginRecep(page) {
    await page.goto('/login')
    await page.fill('input[name="username"]', 'test_e2e_recep')
    await page.fill('input[name="password"]', 'TestRecep1234!')
    await page.click('button[type="submit"]')
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 })
  }

  test('40 - recepcionista ve botón Nuevo grupo', async ({ page }) => {
    await loginRecep(page)
    await irAGrupos(page)
    await expect(page.locator('button', { hasText: 'Nuevo grupo' })).toBeVisible()
  })

  test('41 - recepcionista puede abrir panel crear grupo', async ({ page }) => {
    await loginRecep(page)
    await irAGrupos(page)
    await page.locator('button', { hasText: 'Nuevo grupo' }).click()
    await expect(page.locator('.grp-panel-overlay')).toBeVisible()
  })

  test('42 - recepcionista ve botón editar grupo pero no eliminar', async ({ page }) => {
    await loginRecep(page)
    await irAProductos(page, GRUPO_1)
    await expect(page.locator('.grp-btn-icon-edit')).toBeVisible()
    await expect(page.locator('.grp-btn-icon-del')).not.toBeVisible()
  })

  test('43 - recepcionista ve botón Nuevo producto', async ({ page }) => {
    await loginRecep(page)
    await irAProductos(page, GRUPO_1)
    await expect(page.locator('button', { hasText: 'Nuevo producto' })).toBeVisible()
  })

  test('44 - recepcionista ve lápiz pero no basura en filas de productos', async ({ page }) => {
    await loginRecep(page)
    await irAProductos(page, GRUPO_1)
    const fila = page.locator('.grp-tr', { hasText: PROD_1 })
    await expect(fila).toBeVisible({ timeout: 6000 })
    await expect(fila.locator('.grp-row-btn')).toBeVisible()
    await expect(fila.locator('.grp-row-btn.danger')).not.toBeVisible()
  })

})
