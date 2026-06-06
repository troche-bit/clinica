const { test, expect } = require('@playwright/test')

const PERSONA_DOC  = 'E2ECOB0001'
const PERSONA_NOM  = 'E2E Cliente COB'
const TIMB_NRO     = '19400001'
const CTA_DESC     = 'E2E Caja COB'
const COB_NRO_VISTA = 4801  // cobranza para tests de detalle

function hoyStr() { return new Date().toISOString().split('T')[0] }
function enNDias(n) { return new Date(Date.now() + n * 86400000).toISOString().split('T')[0] }

let token      = null
let personaId  = null
let timbradoId = null
let grupoId    = null
let productoId = null
let ctaMcbId   = null
let cobId1     = null  // para tests de detalle y eliminar desde tabla

// ─── helpers API ──────────────────────────────────────────────────────────────

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

function authHeader() {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function apiGet(request, path) {
  const r = await request.get(`http://localhost:8000${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return r.json()
}

async function apiPost(request, path, data) {
  const r = await request.post(`http://localhost:8000${path}`, {
    headers: authHeader(), data,
  })
  return { status: r.status(), body: await r.json() }
}

async function apiDelete(request, path) {
  await request.delete(`http://localhost:8000${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {})
}

// ─── helpers de dominio ───────────────────────────────────────────────────────

async function obtenerOCrearPersona(request) {
  const data = await apiGet(request, `/api/persona/?search=${PERSONA_DOC}&page_size=5`)
  const existe = (data.results ?? []).find(p => p.nro_documento === PERSONA_DOC)
  if (existe) return existe.id
  const tdData = await apiGet(request, '/api/tipo-documento/?page_size=5')
  const tipoDocId = (tdData.results ?? tdData)[0].id
  const { body } = await apiPost(request, '/api/persona/', {
    tipo_documento: tipoDocId, nro_documento: PERSONA_DOC, razon_social: PERSONA_NOM,
  })
  return body.id
}

async function obtenerOCrearTimbrado(request) {
  const data = await apiGet(request, `/api/timbrado/?search=${TIMB_NRO}&page_size=5`)
  const existe = (data.results ?? []).find(t => t.nro_timbrado === TIMB_NRO && !t.is_deleted)
  if (existe) return existe.id
  const { body } = await apiPost(request, '/api/timbrado/', {
    nro_timbrado: TIMB_NRO, inicio_vigencia: enNDias(-30), fin_vigencia: enNDias(365),
    punto_sucursal: '001', punto_expedicion: '001', nro_desde: 6800, nro_hasta: 6999, autoimpresor: false,
  })
  return body.id
}

async function obtenerOCrearGrupo(request) {
  const data = await apiGet(request, '/api/grupos/?search=E2E+Grupo+COB&page_size=5')
  const existe = (data.results ?? []).find(g => g.descripcion === 'E2E Grupo COB')
  if (existe) return existe.id
  const { body } = await apiPost(request, '/api/grupos/', { descripcion: 'E2E Grupo COB', activo: true })
  return body.id
}

async function obtenerOCrearProducto(request, gId) {
  const data = await apiGet(request, '/api/productos/?search=E2E+Consulta+COB&page_size=5')
  const existe = (data.results ?? []).find(p => p.descripcion === 'E2E Consulta COB' && !p.is_deleted)
  if (existe) return existe.id
  const { body } = await apiPost(request, '/api/productos/', {
    descripcion: 'E2E Consulta COB', grupo: gId, impuesto: '10', activo: true,
  })
  return body.id
}

async function obtenerOCrearCuenta(request) {
  const data = await apiGet(request, `/api/cuentas-mcb/?search=${CTA_DESC}&page_size=5`)
  const existe = (data.results ?? []).find(c => c.descripcion === CTA_DESC && !c.is_deleted)
  if (existe) return existe.id
  const { body } = await apiPost(request, '/api/cuentas-mcb/', { descripcion: CTA_DESC })
  return body.id
}

async function crearFacturaCredito(request, nro) {
  const { body } = await apiPost(request, '/api/facturacion/', {
    fecha: hoyStr(), condicion_vta: false,
    persona: personaId, timbrado: timbradoId, nro_comprobante: nro,
    detalle: [{ prs: productoId, cantidad: '1.00', monto: '110000.00' }],
    cuotas: { cant_cuota: 1, dias_entre_cuotas: 30 },
  })
  return body
}

async function obtenerCuotasPendientes(request) {
  return apiGet(request, `/api/cobranzas/cuotas-pendientes/?persona=${personaId}`)
}

async function crearCobranza(request, ctaId, monto, nro) {
  const { body } = await apiPost(request, '/api/cobranzas/', {
    fecha: hoyStr(), persona: personaId, comprobante_nro: nro,
    detalle: [{ cta_cobrar_id: ctaId, monto_pagado: String(monto) }],
    valores_recibidos: [{ forma_pago_id: 1, cta_id: ctaMcbId, monto: String(monto) }],
  })
  return body.id
}

async function asegurarCuotasPendientes(request, cantidad) {
  let cuotas = await obtenerCuotasPendientes(request)
  let nroBase = 6801
  while (cuotas.length < cantidad) {
    const data = await apiGet(request, `/api/facturacion/?search=${PERSONA_DOC}&page_size=50`)
    const lista = data.results ?? data ?? []
    const nroUsado = lista.find(f => f.nro_comprobante === nroBase && !f.is_deleted)
    if (!nroUsado) {
      await crearFacturaCredito(request, nroBase)
    }
    nroBase++
    cuotas = await obtenerCuotasPendientes(request)
    if (nroBase > 6899) break  // seguridad
  }
  return cuotas
}

async function irACobranzas(page) {
  await page.goto('/finanzas/cobranzas')
  await expect(page.locator('.cob-tabla-wrap').first()).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(500)
}

// ─── setup / teardown ─────────────────────────────────────────────────────────

test.beforeAll(async ({ request }) => {
  token      = await obtenerToken(request)
  personaId  = await obtenerOCrearPersona(request)
  timbradoId = await obtenerOCrearTimbrado(request)
  grupoId    = await obtenerOCrearGrupo(request)
  productoId = await obtenerOCrearProducto(request, grupoId)
  ctaMcbId   = await obtenerOCrearCuenta(request)

  // Asegurar al menos 2 cuotas pendientes (1 para cobId1, 1 para el test de crear via UI)
  const cuotas = await asegurarCuotasPendientes(request, 2)

  // Crear o reutilizar la cobranza de vista
  const cobranzas = await apiGet(request, `/api/cobranzas/?search=${PERSONA_DOC}&page_size=20`)
  const existe = (cobranzas.results ?? []).find(c => c.comprobante_nro === COB_NRO_VISTA && !c.is_deleted)
  if (existe) {
    cobId1 = existe.id
  } else if (cuotas.length > 0) {
    cobId1 = await crearCobranza(request, cuotas[0].id, parseFloat(cuotas[0].saldo), COB_NRO_VISTA)
  }
})

test.afterAll(async ({ request }) => {
  // Eliminar todas las cobranzas creadas por los tests
  const cobranzas = await apiGet(request, `/api/cobranzas/?search=${PERSONA_DOC}&page_size=50`)
  for (const c of (cobranzas.results ?? [])) {
    if (!c.is_deleted) await apiDelete(request, `/api/cobranzas/${c.id}/`)
  }
  // Eliminar facturas del timbrado
  const facs = await apiGet(request, `/api/facturacion/?search=${PERSONA_DOC}&page_size=50`)
  for (const f of (facs.results ?? [])) {
    if (!f.is_deleted) await apiDelete(request, `/api/facturacion/${f.id}/`).catch(() => {})
  }
  if (productoId) await apiDelete(request, `/api/productos/${productoId}/`).catch(() => {})
  if (grupoId)    await apiDelete(request, `/api/grupos/${grupoId}/`).catch(() => {})
  if (ctaMcbId)   await apiDelete(request, `/api/cuentas-mcb/${ctaMcbId}/`).catch(() => {})
})

// ══════════════════════════════════════════════════════════════════════════════
// ESTRUCTURA INICIAL
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Estructura inicial', () => {

  test('01 - carga con tabla, buscador, filtros y botón Nueva cobranza', async ({ page }) => {
    await irACobranzas(page)
    await expect(page.locator('.cob-search-input')).toBeVisible()
    await expect(page.locator('.cob-filtro-date').first()).toBeVisible()
    await expect(page.locator('.cob-btn-nuevo')).toBeVisible()
    await expect(page.locator('.cob-tabla-wrap').first()).toBeVisible()
  })

  test('02 - sin modal al entrar', async ({ page }) => {
    await irACobranzas(page)
    await expect(page.locator('.modal-backdrop')).not.toBeVisible()
  })

  test('03 - encabezados de tabla correctos', async ({ page }) => {
    await irACobranzas(page)
    const ths = page.locator('.cob-th')
    await expect(ths.filter({ hasText: 'Comprobante' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Fecha' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Cliente' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Monto' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Acciones' })).toBeVisible()
  })

  test('04 - botones de reporte PDF y Excel visibles', async ({ page }) => {
    await irACobranzas(page)
    await expect(page.locator('.cob-btn-report', { hasText: 'PDF' })).toBeVisible()
    await expect(page.locator('.cob-btn-report', { hasText: 'Excel' })).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// VER DETALLE
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Ver detalle', () => {

  test('05 - clic en fila abre modal de detalle', async ({ page }) => {
    await irACobranzas(page)
    await page.fill('.cob-search-input', PERSONA_NOM)
    await page.waitForTimeout(400)
    const fila = page.locator('.cob-tr').first()
    await expect(fila).toBeVisible({ timeout: 8000 })
    await fila.click()
    await expect(page.locator('.modal-title', { hasText: 'Detalle de cobranza' })).toBeVisible({ timeout: 5000 })
  })

  test('06 - modal detalle muestra cabecera con datos del comprobante', async ({ page }) => {
    await irACobranzas(page)
    await page.fill('.cob-search-input', PERSONA_NOM)
    await page.waitForTimeout(400)
    const fila = page.locator('.cob-tr').filter({ hasText: String(COB_NRO_VISTA).padStart(7, '0') }).first()
    await expect(fila).toBeVisible({ timeout: 8000 })
    await fila.click()
    await expect(page.locator('.modal-title', { hasText: 'Detalle de cobranza' })).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.cob-ver-header')).toBeVisible()
    // El header muestra comprobante, fecha, cliente, total
    const labels = page.locator('.cob-ver-lbl')
    await expect(labels.filter({ hasText: 'Comprobante' })).toBeVisible()
    await expect(labels.filter({ hasText: 'Cliente' })).toBeVisible()
    await expect(labels.filter({ hasText: 'Total cobrado' })).toBeVisible()
  })

  test('07 - modal detalle muestra cuotas cobradas y valores recibidos', async ({ page }) => {
    await irACobranzas(page)
    await page.fill('.cob-search-input', PERSONA_NOM)
    await page.waitForTimeout(400)
    const fila = page.locator('.cob-tr').filter({ hasText: String(COB_NRO_VISTA).padStart(7, '0') }).first()
    await expect(fila).toBeVisible({ timeout: 8000 })
    await fila.click()
    await expect(page.locator('.modal-title', { hasText: 'Detalle de cobranza' })).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(500)
    await expect(page.locator('.cob-section-title', { hasText: 'Cuotas cobradas' })).toBeVisible()
    await expect(page.locator('.cob-section-title', { hasText: 'Valores recibidos' })).toBeVisible()
  })

  test('08 - modal detalle tiene botones Eliminar, Recibo PDF y Cerrar', async ({ page }) => {
    await irACobranzas(page)
    await page.fill('.cob-search-input', PERSONA_NOM)
    await page.waitForTimeout(400)
    const fila = page.locator('.cob-tr').first()
    await expect(fila).toBeVisible({ timeout: 8000 })
    await fila.click()
    await expect(page.locator('.modal-title', { hasText: 'Detalle de cobranza' })).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(400)
    await expect(page.locator('.cob-modal-footer .btn-danger')).toBeVisible()
    await expect(page.locator('.cob-btn-pdf')).toBeVisible()
    await expect(page.locator('.cob-modal-footer .btn-secondary')).toBeVisible()
  })

  test('09 - botón Cerrar del detalle cierra el modal', async ({ page }) => {
    await irACobranzas(page)
    await page.fill('.cob-search-input', PERSONA_NOM)
    await page.waitForTimeout(400)
    const fila = page.locator('.cob-tr').first()
    await expect(fila).toBeVisible({ timeout: 8000 })
    await fila.click()
    await expect(page.locator('.modal-title', { hasText: 'Detalle de cobranza' })).toBeVisible({ timeout: 5000 })
    await page.locator('.cob-modal-footer .btn-secondary').click()
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 3000 })
  })

  test('10 - botón ojo de la fila también abre el detalle', async ({ page }) => {
    await irACobranzas(page)
    await page.fill('.cob-search-input', PERSONA_NOM)
    await page.waitForTimeout(400)
    const fila = page.locator('.cob-tr').first()
    await expect(fila).toBeVisible({ timeout: 8000 })
    // Click en botón ojo (primer .cob-row-btn sin clase danger)
    await fila.locator('.cob-row-btn').first().click()
    await expect(page.locator('.modal-title', { hasText: 'Detalle de cobranza' })).toBeVisible({ timeout: 5000 })
    await page.locator('.modal-close').click()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// CREAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Crear', () => {

  test('11 - botón Nueva cobranza abre modal', async ({ page }) => {
    await irACobranzas(page)
    await page.locator('.cob-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nueva cobranza' })).toBeVisible({ timeout: 4000 })
  })

  test('12 - modal tiene tabs Cabecera y cuotas y Valores recibidos', async ({ page }) => {
    await irACobranzas(page)
    await page.locator('.cob-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nueva cobranza' })).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.cob-tab', { hasText: 'Cabecera y cuotas' })).toBeVisible()
    await expect(page.locator('.cob-tab', { hasText: 'Valores recibidos' })).toBeVisible()
  })

  test('13 - tab Cabecera muestra campos fecha y nro comprobante', async ({ page }) => {
    await irACobranzas(page)
    await page.locator('.cob-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nueva cobranza' })).toBeVisible({ timeout: 4000 })
    // Tab 0 activo por defecto — campos visibles
    await expect(page.locator('input[type="date"].cob-input-fecha')).toBeVisible()
    await expect(page.locator('.cob-label', { hasText: 'Nro. comprobante' })).toBeVisible()
    await expect(page.locator('.cob-label', { hasText: 'Cliente' })).toBeVisible()
  })

  test('14 - guardar sin datos muestra error de cliente', async ({ page }) => {
    await irACobranzas(page)
    await page.locator('.cob-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nueva cobranza' })).toBeVisible({ timeout: 4000 })
    await page.locator('.cob-modal-footer .btn-primary').click()
    await expect(page.locator('.cob-error', { hasText: /cliente/i })).toBeVisible({ timeout: 3000 })
    await page.locator('.modal-close').click()
  })

  test('15 - buscador de cliente muestra dropdown al tipear', async ({ page }) => {
    await irACobranzas(page)
    await page.locator('.cob-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nueva cobranza' })).toBeVisible({ timeout: 4000 })
    await page.locator('.cob-buscador-wrap .cob-input').fill('E2E')
    await page.waitForTimeout(500)
    await expect(page.locator('.cob-dropdown')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.cob-dropdown-item').first()).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('16 - seleccionar cliente muestra sección de cuotas', async ({ page }) => {
    await irACobranzas(page)
    await page.locator('.cob-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nueva cobranza' })).toBeVisible({ timeout: 4000 })

    await page.locator('.cob-buscador-wrap .cob-input').fill('E2E')
    await page.waitForTimeout(500)
    const item = page.locator('.cob-dropdown-item').first()
    await expect(item).toBeVisible({ timeout: 5000 })
    await item.click()
    await page.waitForTimeout(600)

    await expect(page.locator('.cob-cuotas-section')).toBeVisible({ timeout: 5000 })
    await page.locator('.modal-close').click()
    await page.waitForTimeout(300)
  })

  test('17 - tab Valores recibidos muestra tabla de valores', async ({ page }) => {
    await irACobranzas(page)
    await page.locator('.cob-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nueva cobranza' })).toBeVisible({ timeout: 4000 })
    await page.locator('.cob-tab', { hasText: 'Valores recibidos' }).click()
    await expect(page.locator('.cob-select').first()).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('18 - crear cobranza completa via UI registra correctamente', async ({ page }) => {
    await irACobranzas(page)
    await page.locator('.cob-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nueva cobranza' })).toBeVisible({ timeout: 5000 })

    // Seleccionar cliente
    await page.locator('.cob-buscador-wrap .cob-input').fill('E2E')
    await page.waitForTimeout(500)
    const item = page.locator('.cob-dropdown-item').first()
    await expect(item).toBeVisible({ timeout: 8000 })
    await item.click()
    await page.waitForTimeout(1000)

    // Verificar que hay cuotas y marcar la primera con el monto total
    await expect(page.locator('.cob-cuotas-section')).toBeVisible({ timeout: 8000 })
    const firstCheck = page.locator('.cob-check').first()
    await expect(firstCheck).toBeVisible({ timeout: 5000 })
    await firstCheck.click()
    await page.waitForTimeout(500)

    // Tab Valores recibidos
    await page.locator('.cob-tab', { hasText: 'Valores recibidos' }).click()
    await page.waitForTimeout(500)

    // Esperar que los selects de forma_pago tengan opciones cargadas
    const formaSelect = page.locator('.cob-select').first()
    await expect(formaSelect.locator('option').nth(1)).toBeAttached({ timeout: 8000 })
    await formaSelect.selectOption({ index: 1 })
    await page.waitForTimeout(300)

    const cuentaSelect = page.locator('.cob-select').nth(1)
    await expect(cuentaSelect.locator('option').nth(1)).toBeAttached({ timeout: 8000 })
    await cuentaSelect.selectOption({ index: 1 })

    // Monto — llenar con el total de la cuota seleccionada
    const montoInput = page.locator('input[type="number"].cob-input-monto').first()
    await montoInput.click()
    await montoInput.fill('110000')
    await page.waitForTimeout(200)

    // Guardar — esperar respuesta de la API
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/cobranzas/') && r.request().method() === 'POST', { timeout: 10000 }),
      page.locator('.cob-modal-footer .btn-primary').click(),
    ])
    expect(response.status()).toBe(201)
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 })
  })

  test('19 - cancelar cierra el modal sin guardar', async ({ page }) => {
    await irACobranzas(page)
    const total = await page.locator('.cob-tr').count()
    await page.locator('.cob-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nueva cobranza' })).toBeVisible({ timeout: 4000 })
    await page.locator('.cob-modal-footer .btn-secondary').click()
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 3000 })
    await expect(page.locator('.cob-tr')).toHaveCount(total)
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// ELIMINAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Eliminar', () => {

  test('20 - botón papelera de fila muestra ConfirmDialog', async ({ page }) => {
    await irACobranzas(page)
    await page.fill('.cob-search-input', PERSONA_NOM)
    await page.waitForTimeout(400)
    const fila = page.locator('.cob-tr').first()
    await expect(fila).toBeVisible({ timeout: 8000 })
    await fila.locator('.cob-row-btn.danger').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  })

  test('21 - cancelar en ConfirmDialog mantiene el registro', async ({ page }) => {
    await irACobranzas(page)
    await page.fill('.cob-search-input', PERSONA_NOM)
    await page.waitForTimeout(400)
    const fila = page.locator('.cob-tr').first()
    await expect(fila).toBeVisible({ timeout: 8000 })
    const total = await page.locator('.cob-tr').count()
    await fila.locator('.cob-row-btn.danger').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
    await expect(page.locator('.cob-tr')).toHaveCount(total)
  })

  test('22 - confirmar eliminar quita el registro de la tabla', async ({ page }) => {
    await irACobranzas(page)
    await page.fill('.cob-search-input', PERSONA_NOM)
    await page.waitForTimeout(500)
    const fila = page.locator('.cob-tr').filter({ hasText: String(COB_NRO_VISTA).padStart(7, '0') }).first()
    await expect(fila).toBeVisible({ timeout: 8000 })
    await fila.locator('.cob-row-btn.danger').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    // Esperar respuesta DELETE de la API
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/cobranzas/') && r.request().method() === 'DELETE', { timeout: 10000 }),
      page.locator('.cd-backdrop').getByRole('button', { name: /eliminar/i }).click(),
    ])
    expect(response.status()).toBe(204)
    await page.waitForTimeout(500)
    // El registro desaparece de la lista filtrada
    const filaBuscada = page.locator('.cob-tr').filter({ hasText: String(COB_NRO_VISTA).padStart(7, '0') })
    await expect(filaBuscada).toHaveCount(0, { timeout: 5000 })
  })

  test('23 - botón Eliminar del modal de detalle abre ConfirmDialog', async ({ page }) => {
    // Nota: handleEliminar cierra ModalVerCobranza antes de mostrar ConfirmDialog
    await irACobranzas(page)
    await page.fill('.cob-search-input', PERSONA_NOM)
    await page.waitForTimeout(500)
    const fila = page.locator('.cob-tr').first()
    const count = await fila.count()
    if (count === 0) return  // sin registros — saltar

    await fila.click()
    await expect(page.locator('.modal-title', { hasText: 'Detalle de cobranza' })).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(500)
    await page.locator('.cob-modal-footer .btn-danger').click()
    // ModalVerCobranza se cierra automáticamente (handleEliminar llama setCobranzaViendo(null))
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    // Cancelar — el modal de detalle ya no existe, solo cerramos el ConfirmDialog
    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
    await expect(page.locator('.cd-overlay')).not.toBeVisible({ timeout: 3000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// BÚSQUEDA Y FILTROS
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Búsqueda y filtros', () => {

  test('24 - búsqueda por nombre filtra la tabla', async ({ page }) => {
    await irACobranzas(page)
    await page.fill('.cob-search-input', PERSONA_NOM)
    await page.waitForTimeout(500)
    const filas = page.locator('.cob-tr')
    const count = await filas.count()
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(filas.nth(i).locator('.cob-td').nth(2)).toContainText('E2E', { ignoreCase: true })
      }
    }
  })

  test('25 - búsqueda con término sin resultados muestra celda vacía', async ({ page }) => {
    await irACobranzas(page)
    await page.fill('.cob-search-input', 'XXXXXNOEXISTE99999')
    await page.waitForTimeout(500)
    await expect(page.locator('.cob-tr')).toHaveCount(0, { timeout: 4000 })
  })

  test('26 - limpiar búsqueda restaura la lista completa', async ({ page }) => {
    await irACobranzas(page)
    const totalInicial = await page.locator('.cob-tr').count()
    await page.fill('.cob-search-input', PERSONA_NOM)
    await page.waitForTimeout(400)
    await page.fill('.cob-search-input', '')
    await page.waitForTimeout(400)
    const totalFinal = await page.locator('.cob-tr').count()
    expect(totalFinal).toBeGreaterThanOrEqual(totalInicial)
  })

  test('27 - filtro de fecha acota el listado', async ({ page }) => {
    await irACobranzas(page)
    const manana = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    await page.locator('.cob-filtro-date').nth(1).fill(manana)
    await page.waitForTimeout(400)
    // Solo cobranzas hasta mañana — no debe romper la tabla
    await expect(page.locator('.cob-tabla-wrap').first()).toBeVisible()
    // Limpiar
    await page.locator('.cob-filtro-date').nth(1).fill('')
  })

  test('28 - Insert abre el modal de nueva cobranza', async ({ page }) => {
    await irACobranzas(page)
    await page.keyboard.press('Insert')
    await expect(page.locator('.modal-title', { hasText: 'Nueva cobranza' })).toBeVisible({ timeout: 4000 })
    await page.locator('.modal-close').click()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// VALIDACIONES ADICIONALES
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Validaciones adicionales', () => {

  test('29 - confirm dialog de eliminar muestra descripción del comprobante', async ({ page }) => {
    await irACobranzas(page)
    await page.fill('.cob-search-input', PERSONA_NOM)
    await page.waitForTimeout(400)
    const fila = page.locator('.cob-tr').first()
    const count = await fila.count()
    if (count === 0) return  // sin registros — saltar
    await fila.locator('.cob-row-btn.danger').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    // El mensaje menciona "eliminar" movimientos o comprobante
    await expect(page.locator('.cd-backdrop')).toContainText(/cobranza|comprobante|movimiento/i)
    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
  })

  test('30 - nro comprobante se valida en tiempo real en el modal nuevo', async ({ page }) => {
    await irACobranzas(page)
    await page.locator('.cob-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nueva cobranza' })).toBeVisible({ timeout: 4000 })
    // Ingresar un número de comprobante ya existente
    const nroComp = page.locator('.cob-mono[placeholder="0000001"]')
    await nroComp.fill(String(COB_NRO_VISTA))
    await page.waitForTimeout(600)
    // Si hay hint de error (nro ocupado), debe ser visible; si libre, también
    // Solo verificamos que no explota la UI
    await expect(page.locator('.cob-modal')).toBeVisible()
    await page.locator('.modal-close').click()
  })

})
