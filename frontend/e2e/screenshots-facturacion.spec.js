const { test, expect } = require('@playwright/test')
const path = require('path')

const OUT = path.resolve(__dirname, '../../docs/imagenes/facturacion')

const PUNTO_SUC   = '003'
const PUNTO_EXP   = '001'
const PERSONA_DOC = 'E2EFAC0001'
const PROD_DESC   = 'E2E Consulta Fac'
const CTA_DESC    = 'E2E Caja Factura'

let token      = null
let personaId  = null
let timbradoId = null
let grupoId    = null
let productoId = null
let ctaId      = null
let facId1     = null  // contado (para detalle, editar, eliminar)
let facId2     = null  // crédito anulada (para mostrar badge anulado en listado)

test.use({ viewport: { width: 1440, height: 900 } })

// ─── helpers ──────────────────────────────────────────────────────────────────

function hoyStr() {
  return new Date().toISOString().split('T')[0]
}
function enNDias(n) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

function auth() { return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }

async function apiGet(request, path) {
  const r = await request.get(`http://localhost:8000${path}`, { headers: { Authorization: `Bearer ${token}` } })
  return r.json()
}

async function apiPost(request, path, data) {
  const r = await request.post(`http://localhost:8000${path}`, { headers: auth(), data })
  return { status: r.status(), body: await r.json() }
}

async function apiDelete(request, path) {
  await request.delete(`http://localhost:8000${path}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
}

async function obtenerPersonaTest(request) {
  const data = await apiGet(request, `/api/persona/?search=${PERSONA_DOC}&page_size=5`)
  const existing = (data.results ?? []).find(p => p.nro_documento === PERSONA_DOC)
  if (existing) return existing.id
  const tdData = await apiGet(request, '/api/tipo-documento/?page_size=5')
  const tipoDocId = (tdData.results ?? tdData)[0].id
  const { body } = await apiPost(request, '/api/persona/', {
    tipo_documento: tipoDocId, nro_documento: PERSONA_DOC, razon_social: 'Cliente E2E Factura',
  })
  return body.id
}

async function obtenerOCrearTimbrado(request) {
  const data = await apiGet(request, '/api/timbrado/?search=19200001&page_size=5')
  const existing = (data.results ?? data).find(t => t.nro_timbrado === '19200001' && !t.is_deleted)
  if (existing) return existing.id
  const { body } = await apiPost(request, '/api/timbrado/', {
    nro_timbrado: '19200001', inicio_vigencia: enNDias(-30), fin_vigencia: enNDias(365),
    punto_sucursal: PUNTO_SUC, punto_expedicion: PUNTO_EXP,
    nro_desde: 8001, nro_hasta: 8999, autoimpresor: false,
  })
  return body.id
}

async function obtenerOCrearGrupo(request) {
  const data = await apiGet(request, '/api/grupos/?search=E2E+Grupo+Fac&page_size=5')
  const existing = (data.results ?? data).find(g => g.descripcion === 'E2E Grupo Fac')
  if (existing) return existing.id
  const { body } = await apiPost(request, '/api/grupos/', { descripcion: 'E2E Grupo Fac', activo: true })
  return body.id
}

async function obtenerOCrearProducto(request, gId) {
  const data = await apiGet(request, `/api/productos/?search=E2E+Consulta+Fac&page_size=5`)
  const existing = (data.results ?? data).find(p => p.descripcion === PROD_DESC && !p.is_deleted)
  if (existing) return existing.id
  const { body } = await apiPost(request, '/api/productos/', {
    descripcion: PROD_DESC, grupo: gId, impuesto: '10', activo: true,
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
    fecha: hoyStr(), condicion_vta: true, persona: personaId, timbrado: timbradoId,
    nro_comprobante: nro,
    detalle: [{ prs: productoId, cantidad: '2.00', monto: '220000.00' }],
    cobranza: [{ forma_pago: 1, cta: ctaId, monto: '220000.00' }],
  })
  return body.id
}

async function crearFacturaCredito(request, nro) {
  const { body } = await apiPost(request, '/api/facturacion/', {
    fecha: hoyStr(), condicion_vta: false, persona: personaId, timbrado: timbradoId,
    nro_comprobante: nro,
    detalle: [{ prs: productoId, cantidad: '1.00', monto: '110000.00' }],
    cuotas: { cant_cuota: 3, dias_entre_cuotas: 30 },
  })
  return body.id
}

async function anularFactura(request, id) {
  await request.post(`http://localhost:8000/api/facturacion/${id}/anular/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function irAFacturacion(page) {
  await page.goto('/facturacion/ventas')
  await expect(page.locator('.fac-tabla, .fac-empty')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(600)
}

// ─── setup / teardown ─────────────────────────────────────────────────────────

test.beforeAll(async ({ request }) => {
  token      = await obtenerToken(request)
  personaId  = await obtenerPersonaTest(request)
  timbradoId = await obtenerOCrearTimbrado(request)
  grupoId    = await obtenerOCrearGrupo(request)
  productoId = await obtenerOCrearProducto(request, grupoId)
  ctaId      = await obtenerOCrearCuenta(request)

  // Facturas de prueba para las capturas
  const facs = await apiGet(request, `/api/facturacion/?search=${PERSONA_DOC}&page_size=20`)
  const lista = facs.results ?? []

  const f1 = lista.find(f => f.nro_comprobante === 8501 && !f.is_deleted)
  facId1 = f1 ? f1.id : await crearFacturaContado(request, 8501)

  // Segunda factura a crédito para anular y mostrar badge Anulada en listado
  let f2 = lista.find(f => f.nro_comprobante === 8502)
  if (!f2) {
    const id2 = await crearFacturaCredito(request, 8502)
    await anularFactura(request, id2)
    facId2 = id2
  } else {
    facId2 = f2.id
    if (!f2.is_anulado) await anularFactura(request, facId2)
  }
})

test.afterAll(async ({ request }) => {
  if (facId1) await apiDelete(request, `/api/facturacion/${facId1}/`)
  // facId2 ya está anulado; no se puede eliminar si tiene cobros, intentamos de todas formas
  if (facId2) await apiDelete(request, `/api/facturacion/${facId2}/`).catch(() => {})
})

// ─── 01 Listado principal ─────────────────────────────────────────────────────
test('01 - listado principal', async ({ page }) => {
  await irAFacturacion(page)
  await page.screenshot({ path: `${OUT}/01_listado.png` })
})

// ─── 02 Búsqueda y filtro activo ──────────────────────────────────────────────
test('02 - busqueda activa con filtro contado', async ({ page }) => {
  await irAFacturacion(page)
  await page.fill('.fac-search-main', 'Cliente E2E')
  await page.selectOption('.fac-filtro-select', 'true')
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/02_busqueda.png` })
  await page.fill('.fac-search-main', '')
  await page.selectOption('.fac-filtro-select', '')
})

// ─── 03 Modal detalle de factura ──────────────────────────────────────────────
test('03 - modal detalle factura contado', async ({ page }) => {
  await irAFacturacion(page)
  await page.fill('.fac-search-main', PERSONA_DOC)
  await page.waitForTimeout(500)
  const fila = page.locator('.fac-tr-clickable', { hasText: `${PUNTO_SUC}-${PUNTO_EXP}-0008501` })
  await expect(fila).toBeVisible({ timeout: 8000 })
  await fila.click()
  await expect(page.locator('.modal-title', { hasText: 'Detalle de factura' })).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/03_panel_detalle.png` })
  await page.locator('.modal-close').click()
  await page.fill('.fac-search-main', '')
})

// ─── 04 Modal nueva factura vacío ─────────────────────────────────────────────
test('04 - modal nueva factura vacio', async ({ page }) => {
  await irAFacturacion(page)
  await page.locator('.fac-btn-nuevo').click()
  await expect(page.locator('.modal-title', { hasText: 'Nueva factura' })).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/04_panel_crear.png` })
  await page.locator('.modal-close').click()
})

// ─── 05 Modal nueva factura con datos del comprobante ─────────────────────────
test('05 - modal nueva factura con comprobante validado', async ({ page }) => {
  await irAFacturacion(page)
  await page.locator('.fac-btn-nuevo').click()
  await expect(page.locator('.modal-title', { hasText: 'Nueva factura' })).toBeVisible({ timeout: 5000 })

  // Llenar comprobante
  await page.locator('.fac-timbrado-pt').first().fill(PUNTO_SUC)
  await page.locator('.fac-timbrado-pt').nth(1).fill(PUNTO_EXP)
  await page.locator('.fac-timbrado-nro').fill('0008600')
  await page.waitForTimeout(800)

  // Buscar y seleccionar producto
  await page.fill('.fac-prod-search-input', 'E2E')
  await page.waitForTimeout(500)
  const prodItem = page.locator('.fac-dropdown-item').first()
  if (await prodItem.isVisible({ timeout: 3000 }).catch(() => false)) {
    await prodItem.click()
    await page.locator('.fac-input.fac-mono[placeholder="0"]').fill('110000')
    await page.locator('.fac-det-form-btns .fac-btn-primario').click()
    await page.waitForTimeout(400)
  }

  await page.screenshot({ path: `${OUT}/05_panel_crear_completo.png` })
  await page.locator('.modal-close').click()
})

// ─── 06 Modal editar factura ──────────────────────────────────────────────────
test('06 - modal editar factura', async ({ page }) => {
  await irAFacturacion(page)
  await page.fill('.fac-search-main', PERSONA_DOC)
  await page.waitForTimeout(500)
  const fila = page.locator('.fac-tr-clickable', { hasText: `${PUNTO_SUC}-${PUNTO_EXP}-0008501` })
  await expect(fila).toBeVisible({ timeout: 8000 })
  await fila.click()
  await expect(page.locator('.fac-ver-toolbar')).toBeVisible({ timeout: 5000 })
  await page.locator('.fac-ver-btn.edit').click()
  await expect(page.locator('.fac-ver-btn.save')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/06_panel_editar.png` })

  // Cancelar puede disparar "Descartar cambios" — aceptar si aparece
  await page.locator('.fac-ver-btn.cancel').click()
  await page.waitForTimeout(300)
  const descartarBtn = page.locator('button', { hasText: /descartar/i })
  if (await descartarBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await descartarBtn.click()
    await page.waitForTimeout(200)
  }
  await page.locator('.modal-close').click()
  await page.fill('.fac-search-main', '')
})

// ─── 07 ConfirmDialog anular ──────────────────────────────────────────────────
test('07 - confirm dialog anular factura', async ({ page }) => {
  await irAFacturacion(page)
  await page.fill('.fac-search-main', PERSONA_DOC)
  await page.waitForTimeout(500)
  const fila = page.locator('.fac-tr-clickable', { hasText: `${PUNTO_SUC}-${PUNTO_EXP}-0008501` })
  await expect(fila).toBeVisible({ timeout: 8000 })
  await fila.locator('.fac-row-btn[title="Anular"]').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/07_confirm_eliminar.png` })
  await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
  await page.fill('.fac-search-main', '')
})

// ─── 08 NavigationGuard al cerrar modal con datos ─────────────────────────────
test('08 - navigation guard al cerrar modal con cambios', async ({ page }) => {
  await irAFacturacion(page)
  await page.locator('.fac-btn-nuevo').click()
  await expect(page.locator('.modal-title', { hasText: 'Nueva factura' })).toBeVisible({ timeout: 5000 })

  // Escribir algo para marcar el formulario como dirty
  await page.locator('.fac-timbrado-pt').first().fill(PUNTO_SUC)
  await page.waitForTimeout(200)

  // Intentar cerrar → debe aparecer el diálogo de protección
  await page.locator('.modal-close').click()
  await page.waitForTimeout(400)

  // Si hay guard, tomar captura con el diálogo visible; si no, capturar estado actual
  await page.screenshot({ path: `${OUT}/08_navigation_guard.png` })

  // Limpiar: aceptar descarte si el diálogo está presente
  const confirmBtn = page.locator('.cd-backdrop button', { hasText: /continuar|descartar|salir/i })
  if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await confirmBtn.click()
  } else {
    await page.keyboard.press('Escape')
  }
})
