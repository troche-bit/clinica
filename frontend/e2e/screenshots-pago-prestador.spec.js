const { test, expect } = require('@playwright/test')
const path = require('path')
const fs   = require('fs')

const OUT      = path.resolve(__dirname, '../../docs/imagenes/pago-prestador')
const MEDICO_DOC = 'E2EPP0001'
const MEDICO_NOM = 'E2E Prestador PP'
const CTA_DESC   = 'E2E Caja PP'

let token       = null
let personaId   = null
let prestadorId = null
let horarioId   = null
let ctaId       = null
let pagoId1     = null  // pago principal para capturas de detalle y eliminar

test.use({ viewport: { width: 1440, height: 900 } })

// ─── helpers ──────────────────────────────────────────────────────────────────

function hoyStr() { return new Date().toISOString().split('T')[0] }
function enNDias(n) { return new Date(Date.now() + n * 86400000).toISOString().split('T')[0] }

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

async function obtenerOCrearPersona(request) {
  const data = await apiGet(request, `/api/persona/?search=${MEDICO_DOC}&page_size=5`)
  const existe = (data.results ?? []).find(p => p.nro_documento === MEDICO_DOC)
  if (existe) return existe.id
  const tdData = await apiGet(request, '/api/tipo-documento/?page_size=5')
  const tipoDocId = (tdData.results ?? tdData)[0].id
  const { body } = await apiPost(request, '/api/persona/', {
    tipo_documento: tipoDocId, nro_documento: MEDICO_DOC, razon_social: MEDICO_NOM,
  })
  return body.id
}

async function obtenerOCrearPrestador(request, pId) {
  const data = await apiGet(request, `/api/personarrhh/?search=${MEDICO_DOC}&page_size=5`)
  const existe = (data.results ?? []).find(p => p.documento === MEDICO_DOC && !p.is_deleted)
  if (existe) return existe.id
  const { body } = await apiPost(request, '/api/personarrhh/', {
    persona: pId, cargo: 'medico', tipo_contrato: 'honorarios', estado: 'activo',
  })
  return body.id
}

async function obtenerOCrearConsultorio(request) {
  const data = await apiGet(request, '/api/consultorio/?search=E2EPP&page_size=5')
  const existe = (data.results ?? []).find(c => c.descripcion === 'E2EPP Consul' && !c.is_deleted)
  if (existe) return existe.id
  const { body } = await apiPost(request, '/api/consultorio/', { descripcion: 'E2EPP Consul' })
  return body.id
}

async function obtenerOCrearHorario(request, prestId, consultId) {
  const data = await apiGet(request, `/api/horario-prestador/?persona_rrhh=${prestId}&page_size=20`)
  const existe = (data.results ?? []).find(h => !h.is_deleted && !h.excepcion)
  if (existe) return existe.id
  const diaData = await apiGet(request, '/api/diasemana/?page_size=10')
  const diaId = (diaData.results ?? diaData)[0].id
  const { body } = await apiPost(request, '/api/horario-prestador/', {
    persona_rrhh: prestId, consultorio: consultId, dia_semana: diaId,
    hora_desde: '08:00:00', hora_hasta: '12:00:00', intervalo: 30, estado: 'activo', excepcion: false,
  })
  return body.id
}

async function crearTurno(request, horId, hora) {
  const minutos = parseInt(hora.split(':')[1]) + 30
  const hFin    = `${hora.split(':')[0]}:${String(minutos % 60).padStart(2, '0')}:00`
  const { body } = await apiPost(request, '/api/agenda/', {
    horario_prestador: horId, fecha: enNDias(-5),
    hora_desde: hora, hora_hasta: hFin, estado: 'disponible',
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

async function crearPago(request, prestId, horId, turId, ctaId, nro) {
  const { body } = await apiPost(request, '/api/pago-prestador/', {
    persona_rrhh_id: prestId, nro_comprobante: nro, fecha_pago: hoyStr(), monto_hora: 150000,
    bloques: [{ horario_prestador_id: horId, fecha: enNDias(-5), horas: '4.00', agenda_ids: [turId] }],
    valores_pagados: [{ forma_pago_id: 1, cta_id: ctaId, monto: 600000, voucher: '' }],
  })
  return body.id
}

async function irAPagoPrestador(page) {
  await page.goto('/finanzas/pago-prestador')
  await expect(page.locator('.pp-tabla-wrap').first()).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(600)
}

// ─── setup / teardown ─────────────────────────────────────────────────────────

test.beforeAll(async ({ request }) => {
  fs.mkdirSync(OUT, { recursive: true })

  token      = await obtenerToken(request)
  personaId  = await obtenerOCrearPersona(request)
  prestadorId = await obtenerOCrearPrestador(request, personaId)
  const consultId = await obtenerOCrearConsultorio(request)
  horarioId   = await obtenerOCrearHorario(request, prestadorId, consultId)
  ctaId       = await obtenerOCrearCuenta(request)

  // Verificar si ya existe un pago con nro 7601
  const pagos = await apiGet(request, `/api/pago-prestador/?persona_rrhh=${prestadorId}&page_size=20`)
  const lista  = pagos.results ?? pagos ?? []
  const existe = lista.find(p => p.nro_comprobante === 7601 && !p.is_deleted)
  if (existe) {
    pagoId1 = existe.id
  } else {
    const turnoId = await crearTurno(request, horarioId, '08:00:00')
    pagoId1 = await crearPago(request, prestadorId, horarioId, turnoId, ctaId, 7601)
  }
})

test.afterAll(async ({ request }) => {
  if (pagoId1) await apiDelete(request, `/api/pago-prestador/${pagoId1}/`)
})

// ─── 01 Listado principal ─────────────────────────────────────────────────────

test('01 - listado principal', async ({ page }) => {
  await irAPagoPrestador(page)
  await page.screenshot({ path: `${OUT}/01_listado.png` })
})

// ─── 02 Búsqueda con filtro activo ────────────────────────────────────────────

test('02 - busqueda con filtro estado pagado', async ({ page }) => {
  await irAPagoPrestador(page)
  await page.fill('.pp-search-input', 'Prestador PP')
  await page.selectOption('.pp-filtro-sel', 'pagado')
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/02_busqueda.png` })
  await page.fill('.pp-search-input', '')
  await page.selectOption('.pp-filtro-sel', '')
})

// ─── 03 Modal detalle con toolbar ─────────────────────────────────────────────

test('03 - modal detalle con toolbar recibo y eliminar', async ({ page }) => {
  await irAPagoPrestador(page)
  await page.fill('.pp-search-input', 'Prestador PP')
  await page.waitForTimeout(400)
  const fila = page.locator('.pp-tr').filter({ hasText: '0007601' }).first()
  await expect(fila).toBeVisible({ timeout: 8000 })
  await fila.click()
  await expect(page.locator('.modal-title', { hasText: 'Detalle de pago' })).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.pp-ver-toolbar')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/03_panel_detalle.png` })
  await page.locator('.modal-close').click()
  await page.fill('.pp-search-input', '')
})

// ─── 04 Modal nuevo pago vacío (tab 1) ────────────────────────────────────────

test('04 - modal nuevo pago vacio tab cabecera', async ({ page }) => {
  await irAPagoPrestador(page)
  await page.locator('.pp-btn-nuevo').click()
  await expect(page.locator('.modal-title', { hasText: 'Nuevo pago a prestador' })).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/04_panel_crear.png` })
  await page.locator('.modal-close').click()
})

// ─── 05 Modal con médico seleccionado y bloques cargados ──────────────────────

test('05 - modal con medico seleccionado y bloques visibles', async ({ page }) => {
  await irAPagoPrestador(page)
  await page.locator('.pp-btn-nuevo').click()
  await expect(page.locator('.modal-title', { hasText: 'Nuevo pago a prestador' })).toBeVisible({ timeout: 5000 })

  // Rellenar monto por hora
  await page.fill('input[placeholder="0"][type="number"]', '150000')

  // Buscar médico
  const buscadorInput = page.locator('.pp-buscador-wrap .pp-input')
  await buscadorInput.fill('Prestador')
  await page.waitForTimeout(500)
  const item = page.locator('.pp-dropdown-item').first()
  if (await item.isVisible({ timeout: 4000 }).catch(() => false)) {
    await item.click()
    await page.waitForTimeout(800)
  }

  await page.screenshot({ path: `${OUT}/05_panel_crear_completo.png` })
  await page.locator('.modal-close').click()
  await page.waitForTimeout(300)
  // Cerrar guard si aparece
  const guard = page.locator('.cd-backdrop button', { hasText: /descartar|continuar/i })
  if (await guard.isVisible({ timeout: 1000 }).catch(() => false)) await guard.click()
})

// ─── 06 Modal tab Forma de pago con datos ────────────────────────────────────

test('06 - modal tab forma de pago con datos', async ({ page }) => {
  await irAPagoPrestador(page)
  await page.locator('.pp-btn-nuevo').click()
  await expect(page.locator('.modal-title', { hasText: 'Nuevo pago a prestador' })).toBeVisible({ timeout: 5000 })

  // Ir directo a tab forma de pago
  await page.locator('.pp-tab', { hasText: 'Forma de pago' }).click()
  await page.waitForTimeout(300)

  // Completar primera fila de forma de pago
  await page.locator('.pp-select').first().selectOption({ index: 1 })
  await page.waitForTimeout(200)
  await page.locator('.pp-select').nth(1).selectOption({ index: 1 })
  await page.fill('input[type="number"].pp-input-monto', '600000')

  await page.screenshot({ path: `${OUT}/06_panel_editar.png` })
  await page.locator('.modal-close').click()
  await page.waitForTimeout(300)
  const guard = page.locator('.cd-backdrop button', { hasText: /descartar|continuar/i })
  if (await guard.isVisible({ timeout: 1000 }).catch(() => false)) await guard.click()
})

// ─── 07 ConfirmDialog eliminar ────────────────────────────────────────────────

test('07 - confirm dialog eliminar pago', async ({ page }) => {
  await irAPagoPrestador(page)
  await page.fill('.pp-search-input', 'Prestador PP')
  await page.waitForTimeout(400)
  const fila = page.locator('.pp-tr').filter({ hasText: '0007601' }).first()
  await expect(fila).toBeVisible({ timeout: 8000 })
  await fila.locator('.pp-row-btn.danger').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/07_confirm_eliminar.png` })
  await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
  await page.fill('.pp-search-input', '')
})

// ─── 08 NavigationGuard al cerrar modal con datos ingresados ──────────────────

test('08 - navigation guard al cerrar con datos', async ({ page }) => {
  await irAPagoPrestador(page)
  await page.locator('.pp-btn-nuevo').click()
  await expect(page.locator('.modal-title', { hasText: 'Nuevo pago a prestador' })).toBeVisible({ timeout: 5000 })

  // Ingresar monto para marcar el formulario como dirty
  await page.fill('input[placeholder="0"][type="number"]', '150000')
  await page.waitForTimeout(200)

  // Intentar cerrar → dispara el guard de descartar
  await page.locator('.modal-close').click()
  await page.waitForTimeout(400)

  await page.screenshot({ path: `${OUT}/08_navigation_guard.png` })

  // Limpiar
  const confirmBtn = page.locator('.cd-backdrop button', { hasText: /descartar|continuar|salir/i })
  if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await confirmBtn.click()
  } else {
    await page.keyboard.press('Escape')
  }
})
