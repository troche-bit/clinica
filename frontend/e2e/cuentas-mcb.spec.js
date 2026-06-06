const { test, expect } = require('@playwright/test')

const CTA_DESC     = 'E2E Caja MCB'
const CTA_DEL_DESC = 'E2E Borrar MCB'
const MOV_NRO      = 'E2ECBMC-001'

let token    = null
let ctaId    = null
let ctaDelId = null
let movId    = null

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

function authH(tok) {
  return { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }
}

async function apiGet(request, path) {
  const r = await request.get(`http://localhost:8000${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return r.json()
}

async function apiPost(request, path, data) {
  const r = await request.post(`http://localhost:8000${path}`, {
    headers: authH(token), data,
  })
  return { status: r.status(), body: await r.json() }
}

async function apiDelete(request, path) {
  await request.delete(`http://localhost:8000${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {})
}

async function obtenerOCrearCuenta(request, desc) {
  const data = await apiGet(request, `/api/cuentas-mcb/?search=${encodeURIComponent(desc)}&page_size=10`)
  const existe = (data.results ?? []).find(c => c.descripcion === desc && !c.is_deleted)
  if (existe) return existe.id
  const { body } = await apiPost(request, '/api/cuentas-mcb/', { descripcion: desc })
  return body.id
}

async function obtenerOCrearMovimiento(request, ctaId) {
  const data = await apiGet(request, `/api/movimientos-caja/?search=${MOV_NRO}&page_size=10`)
  const existe = (data.results ?? []).find(m => m.nro_comprobante === MOV_NRO && !m.is_deleted)
  if (existe) return existe.id
  const { body } = await apiPost(request, '/api/movimientos-caja/', {
    cta: ctaId, fecha: new Date().toISOString().split('T')[0],
    nro_comprobante: MOV_NRO, monto_ingreso: 50000, monto_egreso: 0,
  })
  return body.id
}

async function irACuentas(page) {
  await page.goto('/finanzas/cuentas')
  await expect(page.locator('.cta-header')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(500)
}

async function irAMovimientos(page) {
  await irACuentas(page)
  const card = page.locator('.cta-card').filter({ hasText: CTA_DESC })
  await expect(card).toBeVisible({ timeout: 8000 })
  await card.click()
  await expect(page.locator('.cta-vista-drill')).toBeVisible({ timeout: 6000 })
  await expect(page.locator('.cta-tabla, .cta-empty, .cta-loading')).toBeVisible({ timeout: 6000 })
  await page.waitForTimeout(300)
}

test.beforeAll(async ({ request }) => {
  token    = await obtenerToken(request)
  ctaId    = await obtenerOCrearCuenta(request, CTA_DESC)
  ctaDelId = await obtenerOCrearCuenta(request, CTA_DEL_DESC)
  movId    = await obtenerOCrearMovimiento(request, ctaId)
})

test.afterAll(async ({ request }) => {
  const movs = await apiGet(request, `/api/movimientos-caja/?search=${MOV_NRO}&page_size=50`)
  for (const m of (movs.results ?? [])) {
    if (!m.is_deleted) await apiDelete(request, `/api/movimientos-caja/${m.id}/`)
  }
  if (movId) await apiDelete(request, `/api/movimientos-caja/${movId}/`)

  const movsCta = await apiGet(request, `/api/movimientos-caja/?cta=${ctaId}&page_size=100`)
  for (const m of (movsCta.results ?? [])) {
    if (!m.is_deleted) await apiDelete(request, `/api/movimientos-caja/${m.id}/`)
  }

  if (ctaDelId) await apiDelete(request, `/api/cuentas-mcb/${ctaDelId}/`).catch(() => {})
  if (ctaId)    await apiDelete(request, `/api/cuentas-mcb/${ctaId}/`).catch(() => {})

  const extras = await apiGet(request, `/api/cuentas-mcb/?search=E2E&page_size=50`)
  for (const c of (extras.results ?? [])) {
    if (!c.is_deleted && c.descripcion.startsWith('E2E')) {
      await apiDelete(request, `/api/cuentas-mcb/${c.id}/`).catch(() => {})
    }
  }
})

// ─── Vista de cuentas ─────────────────────────────────────────────────────────

test('01 - carga con grid de tarjetas y buscador', async ({ page }) => {
  await irACuentas(page)
  await expect(page.locator('.cta-cards-grid, .cta-empty')).toBeVisible({ timeout: 8000 })
  await expect(page.locator('.cta-search-input')).toBeVisible()
  await expect(page.locator('.cta-btn-primario', { hasText: 'Nueva cuenta' })).toBeVisible()
})

test('02 - búsqueda filtra tarjetas por nombre', async ({ page }) => {
  await irACuentas(page)
  const [r] = await Promise.all([
    page.waitForResponse(
      res => res.url().includes('/api/cuentas-mcb/') && res.url().includes('search='),
      { timeout: 8000 },
    ),
    page.locator('.cta-search-input').pressSequentially('E2E Caja', { delay: 40 }),
  ])
  await page.waitForTimeout(300)
  const card = page.locator('.cta-card').filter({ hasText: CTA_DESC })
  await expect(card).toBeVisible({ timeout: 6000 })
})

test('03 - búsqueda sin resultados muestra estado vacío', async ({ page }) => {
  await irACuentas(page)
  await page.fill('.cta-search-input', 'ZZZ_NO_EXISTE_CUENTA_XXXX')
  await page.waitForTimeout(400)
  await expect(page.locator('.cta-empty')).toBeVisible({ timeout: 5000 })
  await page.fill('.cta-search-input', '')
})

// ─── Cuenta — Crear ───────────────────────────────────────────────────────────

test('04 - panel nueva cuenta se abre con título correcto', async ({ page }) => {
  await irACuentas(page)
  await page.locator('.cta-btn-primario', { hasText: 'Nueva cuenta' }).click()
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Nueva cuenta' })).toBeVisible({ timeout: 5000 })
})

test('05 - campo descripción vacío muestra error de validación', async ({ page }) => {
  await irACuentas(page)
  await page.locator('.cta-btn-primario', { hasText: 'Nueva cuenta' }).click()
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Nueva cuenta' })).toBeVisible({ timeout: 5000 })
  await page.locator('.cta-panel-acciones .cta-btn-primario').click()
  await expect(page.locator('.cta-error-msg')).toBeVisible({ timeout: 3000 })
  await page.locator('.cta-panel-cerrar').click()
})

test('06 - crear cuenta válida aparece en grid', async ({ page }) => {
  await irACuentas(page)
  await page.locator('.cta-btn-primario', { hasText: 'Nueva cuenta' }).click()
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Nueva cuenta' })).toBeVisible({ timeout: 5000 })
  await page.fill('.cta-input', 'E2E Cuenta Nueva MCB')
  const [response] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/cuentas-mcb/') && r.request().method() === 'POST',
      { timeout: 10000 },
    ),
    page.locator('.cta-panel-acciones .cta-btn-primario').click(),
  ])
  expect(response.status()).toBe(201)
  await expect(page.locator('.cta-card').filter({ hasText: 'E2E Cuenta Nueva MCB' })).toBeVisible({ timeout: 5000 })
})

test('07 - duplicado muestra error sin cerrar panel', async ({ page }) => {
  await irACuentas(page)
  await page.locator('.cta-btn-primario', { hasText: 'Nueva cuenta' }).click()
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Nueva cuenta' })).toBeVisible({ timeout: 5000 })
  await page.fill('.cta-input', CTA_DESC)
  const [response] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/cuentas-mcb/') && r.request().method() === 'POST',
      { timeout: 10000 },
    ),
    page.locator('.cta-panel-acciones .cta-btn-primario').click(),
  ])
  expect(response.status()).toBe(400)
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Nueva cuenta' })).toBeVisible()
  await page.locator('.cta-panel-cerrar').click()
})

test('08 - cancelar cierra panel sin guardar', async ({ page }) => {
  await irACuentas(page)
  await page.locator('.cta-btn-primario', { hasText: 'Nueva cuenta' }).click()
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Nueva cuenta' })).toBeVisible({ timeout: 5000 })
  await page.fill('.cta-input', 'E2E No Guardar MCB')
  await page.locator('.cta-panel-acciones .cta-btn-secundario').click()
  await expect(page.locator('.cta-panel-overlay')).not.toBeVisible({ timeout: 3000 })
  await page.fill('.cta-search-input', 'E2E No Guardar MCB')
  await page.waitForTimeout(400)
  await expect(page.locator('.cta-empty')).toBeVisible({ timeout: 5000 })
  await page.fill('.cta-search-input', '')
})

// ─── Cuenta — Editar ──────────────────────────────────────────────────────────

test('09 - botón editar abre panel con datos precargados', async ({ page }) => {
  await irAMovimientos(page)
  await page.locator('.cta-btn-icon-edit').click()
  const titulo = page.locator('.cta-panel-titulo')
  await expect(titulo).toBeVisible({ timeout: 5000 })
  await expect(titulo).toContainText('Editar')
  const input = page.locator('.cta-input')
  await expect(input).toHaveValue(CTA_DESC)
  await page.locator('.cta-panel-cerrar').click()
})

test('10 - editar nombre de cuenta y guardar', async ({ page }) => {
  await irAMovimientos(page)
  await page.locator('.cta-btn-icon-edit').click()
  await expect(page.locator('.cta-panel-titulo')).toBeVisible({ timeout: 5000 })
  await page.locator('.cta-input').fill('E2E Caja MCB Editada')
  const [response] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/cuentas-mcb/') && r.request().method() === 'PATCH',
      { timeout: 10000 },
    ),
    page.locator('.cta-panel-acciones .cta-btn-primario').click(),
  ])
  expect(response.status()).toBe(200)
  await expect(page.locator('.cta-header-title')).toHaveText('E2E Caja MCB Editada', { timeout: 5000 })
  await page.locator('.cta-btn-icon-edit').click()
  await page.locator('.cta-input').fill(CTA_DESC)
  await page.locator('.cta-panel-acciones .cta-btn-primario').click()
  await expect(page.locator('.cta-header-title')).toHaveText(CTA_DESC, { timeout: 5000 })
})

test('11 - editar con nombre de otra cuenta muestra error', async ({ page }) => {
  await irAMovimientos(page)
  await page.locator('.cta-btn-icon-edit').click()
  await expect(page.locator('.cta-panel-titulo')).toBeVisible({ timeout: 5000 })
  await page.locator('.cta-input').fill(CTA_DEL_DESC)
  const [response] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/cuentas-mcb/') && r.request().method() === 'PATCH',
      { timeout: 10000 },
    ),
    page.locator('.cta-panel-acciones .cta-btn-primario').click(),
  ])
  expect(response.status()).toBe(400)
  await expect(page.locator('.cta-panel-titulo')).toBeVisible()
  await page.locator('.cta-panel-acciones .cta-btn-secundario').click()
})

// ─── Cuenta — Eliminar ────────────────────────────────────────────────────────

test('12 - botón eliminar abre ConfirmDialog', async ({ page }) => {
  await irAMovimientos(page)
  await page.locator('.cta-btn-icon-del').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 5000 })
  await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
})

test('13 - cancelar ConfirmDialog no elimina la cuenta', async ({ page }) => {
  await irAMovimientos(page)
  await page.locator('.cta-btn-icon-del').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 5000 })
  await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
  await expect(page.locator('.cd-overlay')).not.toBeVisible({ timeout: 3000 })
  await expect(page.locator('.cta-header-title')).toHaveText(CTA_DESC)
})

test('14 - confirmar eliminar cuenta la quita de la grilla', async ({ page }) => {
  await page.goto('/finanzas/cuentas')
  await expect(page.locator('.cta-header')).toBeVisible({ timeout: 10000 })
  const card = page.locator('.cta-card').filter({ hasText: CTA_DEL_DESC })
  await expect(card).toBeVisible({ timeout: 8000 })
  await card.click()
  await expect(page.locator('.cta-vista-drill')).toBeVisible({ timeout: 6000 })
  await page.locator('.cta-btn-icon-del').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 5000 })
  const [response] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/cuentas-mcb/') && r.request().method() === 'DELETE',
      { timeout: 10000 },
    ),
    page.locator('.cd-backdrop').getByRole('button', { name: /eliminar/i }).click(),
  ])
  expect(response.status()).toBe(204)
  ctaDelId = null
  await expect(page.locator('.cta-cards-grid, .cta-empty')).toBeVisible({ timeout: 8000 })
  await page.fill('.cta-search-input', CTA_DEL_DESC)
  await page.waitForTimeout(400)
  await expect(page.locator('.cta-card').filter({ hasText: CTA_DEL_DESC })).not.toBeVisible({ timeout: 4000 })
  await page.fill('.cta-search-input', '')
})

// ─── Drill — Movimientos ──────────────────────────────────────────────────────

test('15 - clic en tarjeta abre vista de movimientos', async ({ page }) => {
  await irACuentas(page)
  const card = page.locator('.cta-card').filter({ hasText: CTA_DESC })
  await expect(card).toBeVisible({ timeout: 8000 })
  await card.click()
  await expect(page.locator('.cta-vista-drill')).toBeVisible({ timeout: 6000 })
  await expect(page.locator('.cta-tabla-wrap')).toBeVisible()
})

test('16 - header muestra nombre de cuenta y botón Volver', async ({ page }) => {
  await irAMovimientos(page)
  await expect(page.locator('.cta-header-title')).toHaveText(CTA_DESC)
  await expect(page.locator('.cta-btn-volver')).toBeVisible()
})

test('17 - botón Volver regresa a la lista de cuentas', async ({ page }) => {
  await irAMovimientos(page)
  await page.locator('.cta-btn-volver').click()
  await expect(page.locator('.cta-cards-grid, .cta-empty')).toBeVisible({ timeout: 6000 })
  await expect(page.locator('.cta-btn-primario', { hasText: 'Nueva cuenta' })).toBeVisible()
})

test('18 - toolbar de movimientos tiene todos los controles', async ({ page }) => {
  await irAMovimientos(page)
  await expect(page.locator('.cta-search-input')).toBeVisible()
  await expect(page.locator('.cta-filtro-select')).toBeVisible()
  await expect(page.locator('.cta-filtro-date').first()).toBeVisible()
  await expect(page.locator('.cta-btn-primario', { hasText: 'Nuevo' })).toBeVisible()
})

test('19 - tabla muestra el movimiento de prueba', async ({ page }) => {
  await irAMovimientos(page)
  await expect(page.locator('.cta-tabla')).toBeVisible({ timeout: 8000 })
  const fila = page.locator('.cta-tr').filter({ hasText: MOV_NRO })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await expect(fila.locator('.cta-badge-tipo.green')).toBeVisible()
})

test('20 - encabezados de tabla son correctos', async ({ page }) => {
  await irAMovimientos(page)
  await expect(page.locator('.cta-th', { hasText: 'Fecha' })).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.cta-th', { hasText: 'Ingreso' })).toBeVisible()
  await expect(page.locator('.cta-th', { hasText: 'Egreso' })).toBeVisible()
  await expect(page.locator('.cta-th', { hasText: 'Tipo' })).toBeVisible()
})

// ─── Movimiento — Crear ───────────────────────────────────────────────────────

test('21 - panel nuevo movimiento se abre', async ({ page }) => {
  await irAMovimientos(page)
  await page.locator('.cta-btn-primario', { hasText: 'Nuevo' }).click()
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Nuevo movimiento' })).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.cta-tipo-toggle')).toBeVisible()
  await page.locator('.cta-panel-cerrar').click()
})

test('22 - sin monto muestra error de validación', async ({ page }) => {
  await irAMovimientos(page)
  await page.locator('.cta-btn-primario', { hasText: 'Nuevo' }).click()
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Nuevo movimiento' })).toBeVisible({ timeout: 5000 })
  await page.locator('.cta-panel-acciones .cta-btn-primario').click()
  await expect(page.locator('.cta-error-msg')).toBeVisible({ timeout: 3000 })
  await page.locator('.cta-panel-cerrar').click()
})

test('23 - crear movimiento de ingreso aparece con badge verde', async ({ page }) => {
  await irAMovimientos(page)
  await page.locator('.cta-btn-primario', { hasText: 'Nuevo' }).click()
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Nuevo movimiento' })).toBeVisible({ timeout: 5000 })
  await page.locator('.cta-tipo-btn.ingreso-btn').click()
  await page.fill('.cta-input.cta-mono', '75000')
  const [response] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/movimientos-caja/') && r.request().method() === 'POST',
      { timeout: 10000 },
    ),
    page.locator('.cta-panel-acciones .cta-btn-primario').click(),
  ])
  expect(response.status()).toBe(201)
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Nuevo movimiento' })).not.toBeVisible({ timeout: 4000 })
  const filas = page.locator('.cta-badge-tipo.green')
  await expect(filas.first()).toBeVisible({ timeout: 5000 })
})

test('24 - crear movimiento de egreso aparece con badge rojo', async ({ page }) => {
  await irAMovimientos(page)
  await page.locator('.cta-btn-primario', { hasText: 'Nuevo' }).click()
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Nuevo movimiento' })).toBeVisible({ timeout: 5000 })
  await page.locator('.cta-tipo-btn.egreso-btn').click()
  await page.fill('.cta-input.cta-mono', '30000')
  const [response] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/movimientos-caja/') && r.request().method() === 'POST',
      { timeout: 10000 },
    ),
    page.locator('.cta-panel-acciones .cta-btn-primario').click(),
  ])
  expect(response.status()).toBe(201)
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Nuevo movimiento' })).not.toBeVisible({ timeout: 4000 })
  const filas = page.locator('.cta-badge-tipo.red')
  await expect(filas.first()).toBeVisible({ timeout: 5000 })
})

test('25 - cerrar panel con X no guarda', async ({ page }) => {
  await irAMovimientos(page)
  const antes = await page.locator('.cta-tr').count()
  await page.locator('.cta-btn-primario', { hasText: 'Nuevo' }).click()
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Nuevo movimiento' })).toBeVisible({ timeout: 5000 })
  await page.fill('.cta-input.cta-mono', '99999')
  await page.locator('.cta-panel-cerrar').click()
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Nuevo movimiento' })).not.toBeVisible({ timeout: 3000 })
  const despues = await page.locator('.cta-tr').count()
  expect(despues).toBe(antes)
})

// ─── Movimiento — Editar ──────────────────────────────────────────────────────

test('26 - lápiz abre panel editar con datos precargados', async ({ page }) => {
  await irAMovimientos(page)
  const fila = page.locator('.cta-tr').filter({ hasText: MOV_NRO })
  await expect(fila).toBeVisible({ timeout: 8000 })
  await fila.locator('.cta-row-btn:not(.danger)').click()
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Editar movimiento' })).toBeVisible({ timeout: 5000 })
  const inputNro = page.locator('input.cta-input:not(.cta-mono)').last()
  await expect(inputNro).toHaveValue(MOV_NRO)
  await page.locator('.cta-panel-cerrar').click()
})

test('27 - editar movimiento y guardar refleja en tabla', async ({ page }) => {
  await irAMovimientos(page)
  const fila = page.locator('.cta-tr').filter({ hasText: MOV_NRO })
  await expect(fila).toBeVisible({ timeout: 8000 })
  await fila.locator('.cta-row-btn:not(.danger)').click()
  await expect(page.locator('.cta-panel-titulo', { hasText: 'Editar movimiento' })).toBeVisible({ timeout: 5000 })
  const inputNro = page.locator('input[placeholder="Número de comprobante (opcional)"]')
  await page.fill('.cta-input.cta-mono', '55000')
  await inputNro.fill('E2ECBMC-001-EDIT')
  const [response] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/movimientos-caja/') && r.request().method() === 'PATCH',
      { timeout: 10000 },
    ),
    page.locator('.cta-panel-acciones .cta-btn-primario').click(),
  ])
  expect(response.status()).toBe(200)
  await expect(page.locator('.cta-tr').filter({ hasText: 'E2ECBMC-001-EDIT' })).toBeVisible({ timeout: 5000 })
  const filaEdit = page.locator('.cta-tr').filter({ hasText: 'E2ECBMC-001-EDIT' })
  await filaEdit.locator('.cta-row-btn:not(.danger)').click()
  const inputNro2 = page.locator('input[placeholder="Número de comprobante (opcional)"]')
  await inputNro2.fill(MOV_NRO)
  await page.fill('.cta-input.cta-mono', '50000')
  await page.locator('.cta-panel-acciones .cta-btn-primario').click()
  await expect(page.locator('.cta-tr').filter({ hasText: MOV_NRO })).toBeVisible({ timeout: 5000 })
})

// ─── Movimiento — Eliminar ────────────────────────────────────────────────────

test('28 - papelera abre ConfirmDialog', async ({ page }) => {
  await irAMovimientos(page)
  const fila = page.locator('.cta-tr').first()
  await expect(fila).toBeVisible({ timeout: 8000 })
  await fila.locator('.cta-row-btn.danger').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 5000 })
  await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
})

test('29 - cancelar ConfirmDialog mantiene el movimiento', async ({ page }) => {
  await irAMovimientos(page)
  const antes = await page.locator('.cta-tr').count()
  const fila = page.locator('.cta-tr').first()
  await expect(fila).toBeVisible({ timeout: 8000 })
  await fila.locator('.cta-row-btn.danger').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 5000 })
  await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
  await expect(page.locator('.cd-overlay')).not.toBeVisible({ timeout: 3000 })
  expect(await page.locator('.cta-tr').count()).toBe(antes)
})

test('30 - confirmar eliminar quita el movimiento de la tabla', async ({ page }) => {
  await irAMovimientos(page)
  const antes = await page.locator('.cta-tr').count()
  const fila = page.locator('.cta-tr').first()
  await expect(fila).toBeVisible({ timeout: 8000 })
  await fila.locator('.cta-row-btn.danger').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 5000 })
  const [response] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/movimientos-caja/') && r.request().method() === 'DELETE',
      { timeout: 10000 },
    ),
    page.locator('.cd-backdrop').getByRole('button', { name: /eliminar/i }).click(),
  ])
  expect(response.status()).toBe(204)
  await page.waitForTimeout(400)
  expect(await page.locator('.cta-tr').count()).toBeLessThan(antes)
})

// ─── Filtros ──────────────────────────────────────────────────────────────────

test('31 - filtro tipo Ingresos muestra solo ingresos', async ({ page }) => {
  await irAMovimientos(page)
  await expect(page.locator('.cta-tabla, .cta-empty')).toBeVisible({ timeout: 8000 })
  await page.locator('.cta-filtro-select').selectOption('ingreso')
  await page.waitForTimeout(500)
  const badges = page.locator('.cta-badge-tipo.red')
  const count = await badges.count()
  expect(count).toBe(0)
})

test('32 - filtro tipo Egresos muestra solo egresos', async ({ page }) => {
  await irAMovimientos(page)
  await expect(page.locator('.cta-tabla, .cta-empty')).toBeVisible({ timeout: 8000 })
  await page.locator('.cta-filtro-select').selectOption('egreso')
  await page.waitForTimeout(500)
  const badges = page.locator('.cta-badge-tipo.green')
  const count = await badges.count()
  expect(count).toBe(0)
  await page.locator('.cta-filtro-select').selectOption('')
})

test('33 - búsqueda por comprobante sin resultados y limpiar restaura', async ({ page }) => {
  await irAMovimientos(page)
  await expect(page.locator('.cta-tabla, .cta-empty')).toBeVisible({ timeout: 10000 })
  if (!await page.locator('.cta-tabla').isVisible()) return
  await page.locator('.cta-search-input').pressSequentially('ZZZNOEXISTE', { delay: 30 })
  await page.waitForTimeout(600)
  await expect(page.locator('.cta-empty')).toBeVisible({ timeout: 5000 })
  await page.locator('.cta-search-input').fill('')
  await page.waitForTimeout(500)
  await expect(page.locator('.cta-tabla')).toBeVisible({ timeout: 5000 })
})

test('34 - filtro fecha_desde restringe resultados', async ({ page }) => {
  await irAMovimientos(page)
  await expect(page.locator('.cta-tabla, .cta-empty')).toBeVisible({ timeout: 8000 })
  const manana = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  await page.locator('.cta-filtro-date').first().fill(manana)
  await page.waitForTimeout(500)
  await expect(page.locator('.cta-empty')).toBeVisible({ timeout: 5000 })
  await page.locator('.cta-filtro-date').first().fill('')
})
