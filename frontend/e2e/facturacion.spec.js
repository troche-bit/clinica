const { test, expect } = require('@playwright/test')

const PUNTO_SUC  = '003'
const PUNTO_EXP  = '001'
const NRO_1      = 8001   // detalle / editar
const NRO_2      = 8002   // anular
const NRO_UI     = 8100   // crear via UI
const PERSONA_DOC = 'E2EFAC0001'
const PROD_DESC  = 'E2E Consulta Fac'
const CTA_DESC   = 'E2E Caja Factura'

function hoyStr() {
  return new Date().toISOString().split('T')[0]
}
function enNDias(n) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}

let token     = null
let personaId = null
let timbradoId = null
let grupoId   = null
let productoId = null
let ctaId     = null
let facId1    = null
let facId2    = null

// ─── helpers de API ───────────────────────────────────────────────────────────

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

async function apiGet(request, path) {
  const r = await request.get(`http://localhost:8000${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return r.json()
}

async function apiPost(request, path, data) {
  const r = await request.post(`http://localhost:8000${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data,
  })
  return { status: r.status(), body: await r.json() }
}

async function apiDelete(request, path) {
  await request.delete(`http://localhost:8000${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function obtenerPersonaTest(request) {
  const data = await apiGet(request, `/api/persona/?search=${PERSONA_DOC}&page_size=5`)
  const personas = data.results ?? data ?? []
  const existing = personas.find(p => p.nro_documento === PERSONA_DOC)
  if (existing) return existing.id

  const tdData = await apiGet(request, '/api/tipo-documento/?page_size=5')
  const tipoDocId = (tdData.results ?? tdData)[0].id

  const { body } = await apiPost(request, '/api/persona/', {
    tipo_documento: tipoDocId,
    nro_documento:  PERSONA_DOC,
    razon_social:   'Cliente E2E Factura',
  })
  return body.id
}

async function obtenerOCrearTimbrado(request) {
  const data = await apiGet(request, '/api/timbrado/?search=19200001&page_size=5')
  const existing = (data.results ?? data).find(t => t.nro_timbrado === '19200001' && !t.is_deleted)
  if (existing) return existing.id
  const { body } = await apiPost(request, '/api/timbrado/', {
    nro_timbrado:    '19200001',
    inicio_vigencia: enNDias(-30),
    fin_vigencia:    enNDias(365),
    punto_sucursal:  PUNTO_SUC,
    punto_expedicion: PUNTO_EXP,
    nro_desde:       8001,
    nro_hasta:       8999,
    autoimpresor:    false,
  })
  return body.id
}

async function limpiarTimbradoFac(request) {
  const data = await apiGet(request, '/api/timbrado/?search=19200001&page_size=5')
  for (const t of (data.results ?? data)) {
    if (t.nro_timbrado === '19200001' && !t.is_deleted) {
      await apiDelete(request, `/api/timbrado/${t.id}/`).catch(() => {})
    }
  }
}

async function obtenerOCrearGrupo(request) {
  const data = await apiGet(request, '/api/grupos/?search=E2E+Grupo+Fac&page_size=5')
  const existing = (data.results ?? data).find(g => g.descripcion === 'E2E Grupo Fac')
  if (existing) return existing.id
  const { body } = await apiPost(request, '/api/grupos/', { descripcion: 'E2E Grupo Fac', activo: true })
  return body.id
}

async function obtenerOCrearProducto(request, grupoId) {
  const data = await apiGet(request, `/api/productos/?search=E2E+Consulta+Fac&page_size=5`)
  const existing = (data.results ?? data).find(p => p.descripcion === PROD_DESC && !p.is_deleted)
  if (existing) return existing.id
  const { body } = await apiPost(request, '/api/productos/', {
    descripcion: PROD_DESC,
    grupo:       grupoId,
    impuesto:    '10',
    activo:      true,
  })
  return body.id
}

async function obtenerOCrearCuenta(request) {
  const data = await apiGet(request, `/api/cuentas-mcb/?search=E2E+Caja+Factura&page_size=5`)
  const existing = (data.results ?? data).find(c => c.descripcion === CTA_DESC && !c.is_deleted)
  if (existing) return existing.id
  const { body } = await apiPost(request, '/api/cuentas-mcb/', { descripcion: CTA_DESC })
  return body.id
}

async function crearFacturaContado(request, nro) {
  const { body } = await apiPost(request, '/api/facturacion/', {
    fecha:           hoyStr(),
    condicion_vta:   true,
    persona:         personaId,
    timbrado:        timbradoId,
    nro_comprobante: nro,
    detalle: [{ prs: productoId, cantidad: '1.00', monto: '110000.00' }],
    cobranza: [{ forma_pago: 1, cta: ctaId, monto: '110000.00' }],
  })
  return body.id
}

async function crearFacturaCredito(request, nro) {
  const { body } = await apiPost(request, '/api/facturacion/', {
    fecha:           hoyStr(),
    condicion_vta:   false,
    persona:         personaId,
    timbrado:        timbradoId,
    nro_comprobante: nro,
    detalle: [{ prs: productoId, cantidad: '1.00', monto: '110000.00' }],
    cuotas:  { cant_cuota: 3, dias_entre_cuotas: 30 },
  })
  return body.id
}

async function limpiarFactura(request, id) {
  if (!id) return
  await apiDelete(request, `/api/facturacion/${id}/`).catch(() => {})
}

// ─── helpers de UI ────────────────────────────────────────────────────────────

async function irAFacturacion(page) {
  await page.goto('/facturacion/ventas')
  await expect(page.locator('.fac-tabla, .fac-empty')).toBeVisible({ timeout: 10000 })
}

async function filtrarFactura(page, termino) {
  await page.fill('.fac-search-main', termino)
  await page.waitForTimeout(400)
}

async function llenarModalNueva(page, nroComprobante) {
  await expect(page.locator('.modal-title', { hasText: 'Nueva factura' })).toBeVisible({ timeout: 6000 })

  // Cliente — usar fill con parte del nombre (igual que agenda.spec.js)
  const clienteInput = page.locator('.fac-autocomplete input.fac-input').first()
  await clienteInput.fill('Cliente E2E')
  await page.waitForTimeout(600)
  await expect(page.locator('.fac-dropdown-item').first()).toBeVisible({ timeout: 8000 })
  await page.locator('.fac-dropdown-item').first().click()

  // Comprobante
  await page.locator('.fac-timbrado-pt').first().fill(PUNTO_SUC)
  await page.locator('.fac-timbrado-pt').nth(1).fill(PUNTO_EXP)
  await page.locator('.fac-timbrado-nro').fill(String(nroComprobante).padStart(7, '0'))
  await expect(page.locator('.fac-validacion.ok')).toBeVisible({ timeout: 8000 })

  // Producto
  await page.fill('.fac-prod-search-input', PROD_DESC.substring(0, 6))
  await page.waitForTimeout(450)
  await expect(page.locator('.fac-dropdown-item').first()).toBeVisible({ timeout: 6000 })
  await page.locator('.fac-dropdown-item').first().click()

  // Precio
  await page.locator('.fac-input.fac-mono[placeholder="0"]').fill('110000')

  // Agregar ítem
  await page.locator('.fac-det-form-btns .fac-btn-primario').click()
  await expect(page.locator('.fac-det-tr').first()).toBeVisible({ timeout: 4000 })

  // Tab Cobranza
  await page.locator('.fac-tabs .fac-tab', { hasText: 'Cobranza' }).click()

  // Forma de pago
  await page.locator('.fac-cobr-fila .fac-select').first().selectOption({ index: 1 })

  // Cuenta
  await page.locator('.fac-cobr-fila .fac-select').nth(1).selectOption({ index: 1 })

  // Monto
  await page.locator('.fac-cobr-fila .fac-input.fac-mono').fill('110000')
}

// ─── setup / teardown ─────────────────────────────────────────────────────────

test.beforeAll(async ({ request }) => {
  token      = await obtenerToken(request)
  personaId  = await obtenerPersonaTest(request)
  timbradoId = await obtenerOCrearTimbrado(request)
  grupoId    = await obtenerOCrearGrupo(request)
  productoId = await obtenerOCrearProducto(request, grupoId)
  ctaId      = await obtenerOCrearCuenta(request)

  // Crear facturas de prueba si no existen ya
  const facs = await apiGet(request, `/api/facturacion/?search=${PERSONA_DOC}&page_size=20`)
  const lista = facs.results ?? facs ?? []
  const fac1  = lista.find(f => f.nro_comprobante === NRO_1 && !f.is_deleted)
  const fac2  = lista.find(f => f.nro_comprobante === NRO_2 && !f.is_deleted)
  facId1 = fac1 ? fac1.id : await crearFacturaContado(request, NRO_1)
  facId2 = fac2 ? fac2.id : await crearFacturaCredito(request, NRO_2)
})

test.afterAll(async ({ request }) => {
  await limpiarFactura(request, facId1)
  await limpiarFactura(request, facId2)
  if (productoId) await apiDelete(request, `/api/productos/${productoId}/`).catch(() => {})
  if (grupoId)    await apiDelete(request, `/api/grupos/${grupoId}/`).catch(() => {})
  if (ctaId)      await apiDelete(request, `/api/cuentas-mcb/${ctaId}/`).catch(() => {})
  await limpiarTimbradoFac(request)
})

// ══════════════════════════════════════════════════════════════════════════════
// ESTRUCTURA INICIAL
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Estructura inicial', () => {

  test('01 - carga con tabla, buscador, filtros y botón Nueva factura', async ({ page }) => {
    await irAFacturacion(page)
    await expect(page.locator('.fac-search-main')).toBeVisible()
    await expect(page.locator('.fac-filtro-select')).toBeVisible()
    await expect(page.locator('.fac-btn-nuevo')).toBeVisible()
  })

  test('02 - sin modal al entrar', async ({ page }) => {
    await irAFacturacion(page)
    await expect(page.locator('.modal-backdrop')).not.toBeVisible()
  })

  test('03 - encabezados de tabla correctos', async ({ page }) => {
    await irAFacturacion(page)
    const ths = page.locator('.fac-th')
    await expect(ths.filter({ hasText: 'Comprobante' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Fecha' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Cliente' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Condición' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Total' })).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// CREAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Crear', () => {

  test('04 - botón Nueva factura abre modal', async ({ page }) => {
    await irAFacturacion(page)
    await page.locator('.fac-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nueva factura' })).toBeVisible({ timeout: 4000 })
  })

  test('05 - modal tiene tabs Cabecera y Cobranza', async ({ page }) => {
    await irAFacturacion(page)
    await page.locator('.fac-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nueva factura' })).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.fac-tab', { hasText: 'Cabecera y Detalle' })).toBeVisible()
    await expect(page.locator('.fac-tab', { hasText: 'Cobranza' })).toBeVisible()
  })

  test('06 - emitir sin datos muestra errores de validación', async ({ page }) => {
    await irAFacturacion(page)
    await page.locator('.fac-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nueva factura' })).toBeVisible({ timeout: 4000 })
    await page.locator('.fac-footer-actions .fac-btn-primario').click()
    await expect(page.locator('.fac-error-msg').first()).toBeVisible({ timeout: 3000 })
    await expect(page.locator('.modal-backdrop')).toBeVisible()
  })

  test('07 - factura creada via API aparece en tabla con comprobante correcto', async ({ page, request }) => {
    const nroTemp = 8050
    const idTemp  = await crearFacturaContado(request, nroTemp)
    await irAFacturacion(page)

    // Filtrar por el cliente de prueba
    await filtrarFactura(page, PERSONA_DOC)
    await expect(page.locator('.fac-tr', { hasText: '003-001-0008050' })).toBeVisible({ timeout: 8000 })

    // El badge de condición muestra Contado
    const fila = page.locator('.fac-tr', { hasText: '003-001-0008050' })
    await expect(fila.locator('.fac-badge.contado')).toBeVisible()

    await limpiarFactura(request, idTemp)
    await page.fill('.fac-search-main', '')
  })

  test('08 - cancelar cierra modal sin crear factura', async ({ page }) => {
    await irAFacturacion(page)
    await page.locator('.fac-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nueva factura' })).toBeVisible({ timeout: 4000 })
    await page.locator('.fac-footer-actions .fac-btn-secundario').click()
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 3000 })
  })

  test('09 - X del modal cierra sin guardar', async ({ page }) => {
    await irAFacturacion(page)
    await page.locator('.fac-btn-nuevo').click()
    await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 4000 })
    await page.locator('.modal-close').click()
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 3000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// VER DETALLE
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Ver detalle', () => {

  test('10 - clic en fila abre modal de detalle', async ({ page }) => {
    await irAFacturacion(page)
    await filtrarFactura(page, PERSONA_DOC)
    const fila = page.locator('.fac-tr-clickable').first()
    await expect(fila).toBeVisible({ timeout: 6000 })
    await fila.click()
    await expect(page.locator('.modal-title', { hasText: 'Detalle de factura' })).toBeVisible({ timeout: 5000 })
  })

  test('11 - modal detalle muestra datos del comprobante', async ({ page }) => {
    await irAFacturacion(page)
    await filtrarFactura(page, PERSONA_DOC)
    await page.locator('.fac-tr-clickable').first().click()
    await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.fac-ver-val').first()).toBeVisible({ timeout: 4000 })
  })

  test('12 - admin ve botones Editar, Anular y Eliminar', async ({ page }) => {
    await irAFacturacion(page)
    await filtrarFactura(page, PERSONA_DOC)
    await page.locator('.fac-tr-clickable').first().click()
    await expect(page.locator('.fac-ver-toolbar')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.fac-ver-btn.edit')).toBeVisible()
    await expect(page.locator('.fac-ver-btn.del')).toBeVisible()
  })

  test('13 - X cierra el modal de detalle', async ({ page }) => {
    await irAFacturacion(page)
    await filtrarFactura(page, PERSONA_DOC)
    await page.locator('.fac-tr-clickable').first().click()
    await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 5000 })
    await page.locator('.modal-close').click()
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 3000 })
  })

  test('14 - botón Imprimir está disponible en detalle', async ({ page }) => {
    await irAFacturacion(page)
    await filtrarFactura(page, PERSONA_DOC)
    await page.locator('.fac-tr-clickable').first().click()
    await expect(page.locator('.fac-ver-toolbar')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.fac-ver-btn.print')).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// EDITAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Editar', () => {

  test('15 - botón Editar en fila abre modal en modo edición', async ({ page }) => {
    await irAFacturacion(page)
    await filtrarFactura(page, PERSONA_DOC)
    const fila = page.locator('.fac-tr-clickable').first()
    await expect(fila).toBeVisible({ timeout: 6000 })
    await fila.locator('.fac-row-btn').first().click()
    await expect(page.locator('.modal-title', { hasText: 'Detalle de factura' })).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.fac-ver-btn.save')).toBeVisible({ timeout: 4000 })
  })

  test('16 - botón Editar en detalle cambia a modo edición', async ({ page }) => {
    await irAFacturacion(page)
    await filtrarFactura(page, PERSONA_DOC)
    await page.locator('.fac-tr-clickable').first().click()
    await expect(page.locator('.fac-ver-toolbar')).toBeVisible({ timeout: 5000 })
    await page.locator('.fac-ver-btn.edit').click()
    await expect(page.locator('.fac-ver-btn.save')).toBeVisible({ timeout: 3000 })
  })

  test('17 - editar observación y guardar actualiza el registro', async ({ page }) => {
    await irAFacturacion(page)
    await filtrarFactura(page, PERSONA_DOC)
    await page.locator('.fac-tr-clickable').first().click()
    await expect(page.locator('.fac-ver-btn.edit')).toBeVisible({ timeout: 5000 })
    await page.locator('.fac-ver-btn.edit').click()
    await expect(page.locator('.fac-ver-btn.save')).toBeVisible({ timeout: 3000 })

    const obsInput = page.locator('.fac-input:not(.fac-mono)').last()
    await obsInput.fill('Obs E2E Test')

    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/facturacion/') && r.request().method() === 'PATCH'),
      page.locator('.fac-ver-btn.save').click(),
    ])
    expect(response.status()).toBe(200)
    // El modal vuelve a modo 'ver' (no se cierra)
    await expect(page.locator('.fac-ver-btn.edit')).toBeVisible({ timeout: 4000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// ANULAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Anular', () => {

  test('18 - botón Anular en fila abre ConfirmDialog', async ({ page }) => {
    await irAFacturacion(page)
    await filtrarFactura(page, PERSONA_DOC)
    const fila = page.locator('.fac-tr-clickable').first()
    await expect(fila).toBeVisible({ timeout: 6000 })
    // Botón anular: fac-row-btn con Ban icon (sin title "Editar" ni "Imprimir" ni "Eliminar")
    await fila.locator('.fac-row-btn[title="Anular"]').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.cd-backdrop')).toContainText('Anular')
  })

  test('19 - cancelar en ConfirmDialog de anular mantiene la factura activa', async ({ page }) => {
    await irAFacturacion(page)
    await filtrarFactura(page, PERSONA_DOC)
    const fila = page.locator('.fac-tr-clickable').first()
    await expect(fila).toBeVisible({ timeout: 6000 })
    await fila.locator('.fac-row-btn[title="Anular"]').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
    await expect(page.locator('.cd-overlay')).not.toBeVisible()
    await expect(fila).toBeVisible()
    await expect(fila.locator('.fac-badge.anulado')).not.toBeVisible()
  })

  test('20 - confirmar anulación marca factura como Anulada', async ({ page, request }) => {
    const nroTemp = 8200
    const idTemp = await crearFacturaContado(request, nroTemp)
    await irAFacturacion(page)
    await filtrarFactura(page, PERSONA_DOC)
    await page.waitForTimeout(300)

    // Buscar la fila que tiene el comprobante de la factura temporal
    const fila = page.locator('.fac-tr-clickable', { hasText: '003-001-0008200' }).first()
    await expect(fila).toBeVisible({ timeout: 6000 })
    await fila.locator('.fac-row-btn[title="Anular"]').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /anular/i }).click()
    await expect(page.locator('.cd-overlay')).not.toBeVisible({ timeout: 4000 })
    await expect(page.locator('[class*="toast"]').first()).toBeVisible({ timeout: 4000 })

    // La fila sigue visible pero con badge Anulada
    await expect(page.locator('.fac-badge.anulado').first()).toBeVisible({ timeout: 4000 })

    await limpiarFactura(request, idTemp)
    await page.fill('.fac-search-main', '')
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// ELIMINAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Eliminar', () => {

  test('21 - botón Eliminar en detalle abre ConfirmDialog', async ({ page }) => {
    await irAFacturacion(page)
    await filtrarFactura(page, PERSONA_DOC)
    await page.locator('.fac-tr-clickable').first().click()
    await expect(page.locator('.fac-ver-btn.del')).toBeVisible({ timeout: 5000 })
    await page.locator('.fac-ver-btn.del').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.cd-backdrop')).toContainText('Eliminar')
  })

  test('22 - cancelar en ConfirmDialog mantiene la factura', async ({ page }) => {
    await irAFacturacion(page)
    await filtrarFactura(page, PERSONA_DOC)
    await page.locator('.fac-tr-clickable').first().click()
    await expect(page.locator('.fac-ver-btn.del')).toBeVisible({ timeout: 5000 })
    await page.locator('.fac-ver-btn.del').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
    await expect(page.locator('.cd-overlay')).not.toBeVisible()
    await expect(page.locator('.modal-backdrop')).toBeVisible()
  })

  test('23 - confirmar elimina y quita la factura de la tabla', async ({ page, request }) => {
    const nroTemp = 8300
    const idTemp  = await crearFacturaContado(request, nroTemp)
    await irAFacturacion(page)
    await filtrarFactura(page, PERSONA_DOC)
    await page.waitForTimeout(300)

    const fila = page.locator('.fac-tr-clickable', { hasText: '003-001-0008300' }).first()
    await expect(fila).toBeVisible({ timeout: 6000 })
    await fila.click()
    await expect(page.locator('.fac-ver-btn.del')).toBeVisible({ timeout: 5000 })
    await page.locator('.fac-ver-btn.del').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })

    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/facturacion/') && r.request().method() === 'DELETE'),
      page.locator('.cd-backdrop').getByRole('button', { name: /eliminar/i }).click(),
    ])
    expect(response.status()).toBe(204)
    await expect(page.locator('.cd-overlay')).not.toBeVisible({ timeout: 4000 })
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 3000 })
    await expect(page.locator('[class*="toast"]').first()).toBeVisible({ timeout: 4000 })

    // Ya no aparece en tabla con ese comprobante
    await expect(page.locator('.fac-tr-clickable', { hasText: '003-001-0008300' })).not.toBeVisible()

    await limpiarFactura(request, idTemp)
    await page.fill('.fac-search-main', '')
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// BÚSQUEDA Y FILTROS
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Búsqueda y filtros', () => {

  test('24 - búsqueda filtra por nombre de cliente', async ({ page }) => {
    await irAFacturacion(page)
    await filtrarFactura(page, 'Cliente E2E')
    await page.waitForTimeout(200)
    await expect(page.locator('.fac-tr').first()).toBeVisible({ timeout: 6000 })
    const filas = page.locator('.fac-tr')
    const count = await filas.count()
    for (let i = 0; i < Math.min(count, 5); i++) {
      await expect(filas.nth(i)).toContainText('E2E')
    }
  })

  test('25 - búsqueda sin resultados muestra estado vacío', async ({ page }) => {
    await irAFacturacion(page)
    await filtrarFactura(page, 'NORESULTADOSE2EFAC')
    await expect(page.locator('.fac-empty')).toBeVisible({ timeout: 5000 })
  })

  test('26 - limpiar búsqueda restaura la lista', async ({ page }) => {
    await irAFacturacion(page)
    await filtrarFactura(page, 'NORESULTADOSE2EFAC')
    await page.waitForTimeout(300)
    await page.fill('.fac-search-main', '')
    await page.waitForTimeout(400)
    await expect(page.locator('.fac-tr').first()).toBeVisible({ timeout: 6000 })
  })

  test('27 - filtro Contado muestra solo facturas contado', async ({ page }) => {
    await irAFacturacion(page)
    await page.selectOption('.fac-filtro-select', 'true')
    await page.waitForTimeout(400)
    const badges = page.locator('.fac-badge:not(.anulado)')
    const count  = await badges.count()
    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = await badges.nth(i).textContent()
      expect(['Contado', 'Anulada']).toContain(text?.trim())
    }
    await page.selectOption('.fac-filtro-select', '')
  })

  test('28 - filtro Crédito muestra solo facturas crédito', async ({ page }) => {
    await irAFacturacion(page)
    await page.selectOption('.fac-filtro-select', 'false')
    await page.waitForTimeout(400)
    const badges = page.locator('.fac-badge:not(.anulado)')
    const count  = await badges.count()
    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = await badges.nth(i).textContent()
      expect(['Crédito']).toContain(text?.trim())
    }
    await page.selectOption('.fac-filtro-select', '')
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

  test('29 - recepcionista ve botón Nueva factura (puede crear)', async ({ page }) => {
    await loginRecep(page)
    await irAFacturacion(page)
    await expect(page.locator('.fac-btn-nuevo')).toBeVisible()
  })

  test('30 - recepcionista puede ver detalle de factura', async ({ page }) => {
    await loginRecep(page)
    await irAFacturacion(page)
    await filtrarFactura(page, PERSONA_DOC)
    await page.locator('.fac-tr-clickable').first().click()
    await expect(page.locator('.fac-ver-toolbar')).toBeVisible({ timeout: 6000 })
    await expect(page.locator('.fac-ver-btn.print')).toBeVisible()
  })

})
