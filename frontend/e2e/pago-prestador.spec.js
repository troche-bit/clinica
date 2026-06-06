const { test, expect } = require('@playwright/test')

// Datos fijos de prueba
const MEDICO_DOC  = 'E2EPP0001'
const MEDICO_NOM  = 'E2E Prestador PP'
const CTA_DESC    = 'E2E Caja PP'
const NRO_PAGO_1  = 7701  // pago preexistente para detalle / eliminar
const NRO_PAGO_UI = 7750  // pago creado via UI

function hoyStr() {
  return new Date().toISOString().split('T')[0]
}
function enNDias(n) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}

// ─── estado compartido entre tests ────────────────────────────────────────────
let token       = null
let personaId   = null
let prestadorId = null
let horarioId   = null
let turnoId1    = null  // turno para el pago de prueba (preexistente)
let turnoUiId   = null  // turno para el pago creado por la UI
let ctaId       = null
let pagoId1     = null

// ─── helpers API ──────────────────────────────────────────────────────────────

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

async function apiPatch(request, path, data) {
  const r = await request.patch(`http://localhost:8000${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data,
  })
  return { status: r.status(), body: await r.json() }
}

async function apiDelete(request, path) {
  await request.delete(`http://localhost:8000${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {})
}

// ─── helpers de datos ─────────────────────────────────────────────────────────

async function obtenerOCrearPersona(request) {
  const data = await apiGet(request, `/api/persona/?search=${MEDICO_DOC}&page_size=5`)
  const lista = data.results ?? data ?? []
  const existe = lista.find(p => p.nro_documento === MEDICO_DOC)
  if (existe) return existe.id

  const tdData = await apiGet(request, '/api/tipo-documento/?page_size=5')
  const tipoDocId = (tdData.results ?? tdData)[0].id

  const { body } = await apiPost(request, '/api/persona/', {
    tipo_documento: tipoDocId,
    nro_documento:  MEDICO_DOC,
    razon_social:   MEDICO_NOM,
  })
  return body.id
}

async function obtenerOCrearPrestador(request, pId) {
  const data = await apiGet(request, `/api/personarrhh/?search=${MEDICO_DOC}&page_size=5`)
  const lista = data.results ?? data ?? []
  const existe = lista.find(p => p.documento === MEDICO_DOC && !p.is_deleted)
  if (existe) return existe.id

  const { body } = await apiPost(request, '/api/personarrhh/', {
    persona:       pId,
    cargo:         'medico',
    tipo_contrato: 'honorarios',
    estado:        'activo',
  })
  return body.id
}

async function obtenerOCrearConsultorio(request) {
  const data = await apiGet(request, '/api/consultorio/?search=E2EPP&page_size=5')
  const lista = data.results ?? data ?? []
  const existe = lista.find(c => c.descripcion === 'E2EPP Consul' && !c.is_deleted)
  if (existe) return existe.id

  const { body } = await apiPost(request, '/api/consultorio/', { descripcion: 'E2EPP Consul' })
  return body.id
}

async function obtenerDiaSemana(request) {
  const data = await apiGet(request, '/api/diasemana/?page_size=10')
  const lista = data.results ?? data ?? []
  return lista[0].id  // Lunes = id 1
}

async function obtenerOCrearHorario(request, prestId, consultId, diaId) {
  const data = await apiGet(request, `/api/horario-prestador/?persona_rrhh=${prestId}&page_size=20`)
  const lista = data.results ?? data ?? []
  const existe = lista.find(h => !h.is_deleted && h.excepcion === false)
  if (existe) return existe.id

  const { body } = await apiPost(request, '/api/horario-prestador/', {
    persona_rrhh: prestId,
    consultorio:  consultId,
    dia_semana:   diaId,
    hora_desde:   '08:00:00',
    hora_hasta:   '12:00:00',
    intervalo:    30,
    estado:       'activo',
    excepcion:    false,
  })
  return body.id
}

async function crearTurno(request, horId, hora = '09:00:00') {
  const { body } = await apiPost(request, '/api/agenda/', {
    horario_prestador: horId,
    fecha:             enNDias(-3),
    hora_desde:        hora,
    hora_hasta:        hora.replace('09', '09').replace(':00', ':30'),
    estado:            'disponible',
  })
  return body.id
}

async function obtenerOCrearCuenta(request) {
  const data = await apiGet(request, `/api/cuentas-mcb/?search=${CTA_DESC}&page_size=5`)
  const lista = data.results ?? data ?? []
  const existe = lista.find(c => c.descripcion === CTA_DESC && !c.is_deleted)
  if (existe) return existe.id

  const { body } = await apiPost(request, '/api/cuentas-mcb/', { descripcion: CTA_DESC })
  return body.id
}

async function crearPago(request, prestId, horId, turId, ctaId, nro) {
  const { body } = await apiPost(request, '/api/pago-prestador/', {
    persona_rrhh_id: prestId,
    nro_comprobante: nro,
    fecha_pago:      hoyStr(),
    monto_hora:      100000,
    bloques: [{
      horario_prestador_id: horId,
      fecha:      enNDias(-3),
      horas:      '4.00',
      agenda_ids: [turId],
    }],
    valores_pagados: [{
      forma_pago_id: 1,
      cta_id:        ctaId,
      monto:         400000,
      voucher:       '',
    }],
  })
  return body.id
}

async function limpiarPago(request, id) {
  if (!id) return
  await apiDelete(request, `/api/pago-prestador/${id}/`)
}

// ─── helpers de UI ────────────────────────────────────────────────────────────

async function irAPagoPrestador(page) {
  await page.goto('/finanzas/pago-prestador')
  await expect(page.locator('.pp-tabla-wrap').first()).toBeVisible({ timeout: 10000 })
}

async function buscarEnTabla(page, termino) {
  await page.fill('.pp-search-input', termino)
  await page.waitForTimeout(400)
}

// ─── setup / teardown ─────────────────────────────────────────────────────────

test.beforeAll(async ({ request }) => {
  token      = await obtenerToken(request)
  personaId  = await obtenerOCrearPersona(request)
  prestadorId = await obtenerOCrearPrestador(request, personaId)
  const consultId = await obtenerOCrearConsultorio(request)
  const diaId     = await obtenerDiaSemana(request)
  horarioId  = await obtenerOCrearHorario(request, prestadorId, consultId, diaId)
  ctaId      = await obtenerOCrearCuenta(request)

  // Crear turno para el pago preexistente
  turnoId1 = await crearTurno(request, horarioId, '09:00:00')

  // Crear pago preexistente para tests de detalle y eliminar
  const pagos = await apiGet(request, `/api/pago-prestador/?persona_rrhh=${prestadorId}&page_size=20`)
  const lista  = pagos.results ?? pagos ?? []
  const existe = lista.find(p => p.nro_comprobante === NRO_PAGO_1 && !p.is_deleted)
  if (existe) {
    pagoId1 = existe.id
  } else {
    pagoId1 = await crearPago(request, prestadorId, horarioId, turnoId1, ctaId, NRO_PAGO_1)
  }
})

test.afterAll(async ({ request }) => {
  await limpiarPago(request, pagoId1)
  if (turnoId1)  await apiDelete(request, `/api/agenda/${turnoId1}/`)
  if (turnoUiId) await apiDelete(request, `/api/agenda/${turnoUiId}/`)
  if (ctaId)     await apiDelete(request, `/api/cuentas-mcb/${ctaId}/`)
})

// ══════════════════════════════════════════════════════════════════════════════
// ESTRUCTURA INICIAL
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Estructura inicial', () => {

  test('01 - carga con tabla, buscador, filtros y botón Nuevo pago', async ({ page }) => {
    await irAPagoPrestador(page)
    await expect(page.locator('.pp-search-input')).toBeVisible()
    await expect(page.locator('.pp-filtro-sel')).toBeVisible()
    await expect(page.locator('.pp-btn-nuevo')).toBeVisible()
  })

  test('02 - sin modal al entrar', async ({ page }) => {
    await irAPagoPrestador(page)
    await expect(page.locator('.modal-backdrop')).not.toBeVisible()
  })

  test('03 - encabezados de tabla correctos', async ({ page }) => {
    await irAPagoPrestador(page)
    const ths = page.locator('.pp-th')
    await expect(ths.filter({ hasText: 'Médico' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Nro.' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Fecha pago' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Monto total' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Estado' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Acciones' })).toBeVisible()
  })

  test('04 - pago preexistente aparece en tabla', async ({ page }) => {
    await irAPagoPrestador(page)
    await buscarEnTabla(page, MEDICO_NOM.split(' ')[1])
    await expect(page.locator('.pp-tr').first()).toBeVisible({ timeout: 6000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// CREAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Crear', () => {

  test('05 - botón Nuevo pago abre modal', async ({ page }) => {
    await irAPagoPrestador(page)
    await page.locator('.pp-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nuevo pago a prestador' })).toBeVisible({ timeout: 5000 })
  })

  test('06 - modal tiene tabs Cabecera y Forma de pago', async ({ page }) => {
    await irAPagoPrestador(page)
    await page.locator('.pp-btn-nuevo').click()
    await expect(page.locator('.pp-tab', { hasText: 'Cabecera y bloques' })).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.pp-tab', { hasText: 'Forma de pago' })).toBeVisible()
  })

  test('07 - intentar guardar sin datos muestra errores', async ({ page }) => {
    await irAPagoPrestador(page)
    await page.locator('.pp-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nuevo pago a prestador' })).toBeVisible({ timeout: 5000 })
    await page.locator('.btn.btn-primary', { hasText: 'Registrar pago' }).click()
    await expect(page.locator('.pp-error').first()).toBeVisible({ timeout: 3000 })
    await expect(page.locator('.modal-backdrop')).toBeVisible()
  })

  test('08 - cancelar cierra modal sin crear pago', async ({ page }) => {
    await irAPagoPrestador(page)
    await page.locator('.pp-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nuevo pago a prestador' })).toBeVisible({ timeout: 5000 })
    await page.locator('.btn.btn-secondary', { hasText: 'Cancelar' }).click()
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 3000 })
  })

  test('09 - X del modal cierra sin guardar', async ({ page }) => {
    await irAPagoPrestador(page)
    await page.locator('.pp-btn-nuevo').click()
    await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 5000 })
    await page.locator('.modal-close').click()
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 3000 })
  })

  test('10 - nro comprobante se prerrellena automáticamente', async ({ page }) => {
    await irAPagoPrestador(page)
    await page.locator('.pp-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nuevo pago a prestador' })).toBeVisible({ timeout: 5000 })
    const nroInput = page.locator('.pp-input.pp-mono')
    await expect(nroInput).toBeVisible({ timeout: 4000 })
    const valor = await nroInput.inputValue()
    expect(valor.length).toBeGreaterThan(0)
  })

  test('11 - crear pago via API aparece en tabla', async ({ page, request }) => {
    // Crear un turno nuevo y un pago temporal via API
    const turnoTemp = await crearTurno(request, horarioId, '10:00:00')
    const pagoTemp  = await crearPago(request, prestadorId, horarioId, turnoTemp, ctaId, 7790)

    await irAPagoPrestador(page)
    await buscarEnTabla(page, MEDICO_NOM.split(' ')[1])
    await expect(page.locator('.pp-tr').first()).toBeVisible({ timeout: 8000 })

    // Verificar que el comprobante 7790 está en la tabla
    await expect(page.locator('.pp-tr').filter({ hasText: '0007790' })).toBeVisible({ timeout: 6000 })

    // Limpiar
    await limpiarPago(request, pagoTemp)
    await apiDelete(request, `/api/agenda/${turnoTemp}/`)
    await page.fill('.pp-search-input', '')
  })

  test('12 - búsqueda de médico en buscador muestra resultados', async ({ page }) => {
    await irAPagoPrestador(page)
    await page.locator('.pp-btn-nuevo').click()
    await expect(page.locator('.modal-title', { hasText: 'Nuevo pago a prestador' })).toBeVisible({ timeout: 5000 })

    const buscadorInput = page.locator('.pp-buscador-wrap .pp-input')
    await buscadorInput.fill('Prestador')
    await page.waitForTimeout(500)
    await expect(page.locator('.pp-dropdown')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.pp-dropdown-item').first()).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// VER DETALLE
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Ver detalle', () => {

  test('13 - clic en fila abre modal de detalle', async ({ page }) => {
    await irAPagoPrestador(page)
    await buscarEnTabla(page, MEDICO_NOM.split(' ')[1])
    const fila = page.locator('.pp-tr').first()
    await expect(fila).toBeVisible({ timeout: 6000 })
    await fila.click()
    await expect(page.locator('.modal-title', { hasText: 'Detalle de pago' })).toBeVisible({ timeout: 5000 })
  })

  test('14 - modal detalle muestra datos del pago', async ({ page }) => {
    await irAPagoPrestador(page)
    await buscarEnTabla(page, MEDICO_NOM.split(' ')[1])
    await page.locator('.pp-tr').first().click()
    await expect(page.locator('.pp-ver-header')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.pp-ver-val').first()).toBeVisible()
  })

  test('15 - toolbar de detalle tiene botones Recibo PDF y Eliminar', async ({ page }) => {
    await irAPagoPrestador(page)
    await buscarEnTabla(page, MEDICO_NOM.split(' ')[1])
    await page.locator('.pp-tr').first().click()
    await expect(page.locator('.pp-ver-toolbar')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.pp-ver-btn.print')).toBeVisible()
    await expect(page.locator('.pp-ver-btn.del')).toBeVisible()
  })

  test('16 - botón Eliminar está en el extremo derecho del toolbar', async ({ page }) => {
    await irAPagoPrestador(page)
    await buscarEnTabla(page, MEDICO_NOM.split(' ')[1])
    await page.locator('.pp-tr').first().click()
    await expect(page.locator('.pp-ver-toolbar')).toBeVisible({ timeout: 5000 })
    // El botón del tiene margin-left: auto, por lo que es el último del toolbar
    const toolbar = page.locator('.pp-ver-toolbar')
    const btnDel  = toolbar.locator('.pp-ver-btn.del')
    await expect(btnDel).toBeVisible()
    // Verificar que Eliminar está a la derecha de Recibo PDF
    const printBox = await toolbar.locator('.pp-ver-btn.print').boundingBox()
    const delBox   = await btnDel.boundingBox()
    expect(delBox.x).toBeGreaterThan(printBox.x + printBox.width)
  })

  test('17 - detalle muestra tabla de cobranza', async ({ page }) => {
    await irAPagoPrestador(page)
    await buscarEnTabla(page, MEDICO_NOM.split(' ')[1])
    await page.locator('.pp-tr').first().click()
    await expect(page.locator('.pp-ver-section')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.pp-section-title', { hasText: 'Detalle de cobranza' })).toBeVisible()
  })

  test('18 - X cierra el modal de detalle', async ({ page }) => {
    await irAPagoPrestador(page)
    await buscarEnTabla(page, MEDICO_NOM.split(' ')[1])
    await page.locator('.pp-tr').first().click()
    await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 5000 })
    await page.locator('.modal-close').click()
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 3000 })
  })

  test('19 - botón Ver en fila abre modal de detalle', async ({ page }) => {
    await irAPagoPrestador(page)
    await buscarEnTabla(page, MEDICO_NOM.split(' ')[1])
    const fila = page.locator('.pp-tr').first()
    await expect(fila).toBeVisible({ timeout: 6000 })
    await fila.locator('.pp-row-btn').first().click()
    await expect(page.locator('.modal-title', { hasText: 'Detalle de pago' })).toBeVisible({ timeout: 5000 })
  })

  test('20 - badge de estado visible en detalle', async ({ page }) => {
    await irAPagoPrestador(page)
    await buscarEnTabla(page, MEDICO_NOM.split(' ')[1])
    await page.locator('.pp-tr').first().click()
    await expect(page.locator('.pp-ver-header .pp-badge')).toBeVisible({ timeout: 5000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// ELIMINAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Eliminar', () => {

  test('21 - botón Eliminar en fila abre ConfirmDialog', async ({ page }) => {
    await irAPagoPrestador(page)
    await buscarEnTabla(page, MEDICO_NOM.split(' ')[1])
    const fila = page.locator('.pp-tr').first()
    await expect(fila).toBeVisible({ timeout: 6000 })
    // El botón danger en la fila es el de eliminar
    await fila.locator('.pp-row-btn.danger').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.cd-backdrop')).toContainText('Eliminar')
  })

  test('22 - cancelar en ConfirmDialog mantiene el registro', async ({ page }) => {
    await irAPagoPrestador(page)
    await buscarEnTabla(page, MEDICO_NOM.split(' ')[1])
    const fila = page.locator('.pp-tr').first()
    await expect(fila).toBeVisible({ timeout: 6000 })
    await fila.locator('.pp-row-btn.danger').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
    await expect(page.locator('.cd-overlay')).not.toBeVisible()
    await expect(fila).toBeVisible()
  })

  test('23 - botón Eliminar en toolbar de detalle abre ConfirmDialog', async ({ page }) => {
    await irAPagoPrestador(page)
    await buscarEnTabla(page, MEDICO_NOM.split(' ')[1])
    await page.locator('.pp-tr').first().click()
    await expect(page.locator('.pp-ver-btn.del')).toBeVisible({ timeout: 5000 })
    await page.locator('.pp-ver-btn.del').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  })

  test('24 - confirmar elimina y quita pago de tabla', async ({ page, request }) => {
    const turnoTemp = await crearTurno(request, horarioId, '11:00:00')
    const pagoTemp  = await crearPago(request, prestadorId, horarioId, turnoTemp, ctaId, 7780)

    await irAPagoPrestador(page)
    await buscarEnTabla(page, MEDICO_NOM.split(' ')[1])
    await page.waitForTimeout(300)

    const fila = page.locator('.pp-tr').filter({ hasText: '0007780' }).first()
    await expect(fila).toBeVisible({ timeout: 8000 })
    await fila.locator('.pp-row-btn.danger').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })

    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/pago-prestador/') && r.request().method() === 'DELETE'),
      page.locator('.cd-backdrop').getByRole('button', { name: /eliminar/i }).click(),
    ])
    expect(response.status()).toBe(204)
    await expect(page.locator('.cd-overlay')).not.toBeVisible({ timeout: 4000 })
    await expect(page.locator('[class*="toast"]').first()).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.pp-tr').filter({ hasText: '0007780' })).not.toBeVisible()

    await apiDelete(request, `/api/agenda/${turnoTemp}/`)
    await page.fill('.pp-search-input', '')
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// BÚSQUEDA Y FILTROS
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Búsqueda y filtros', () => {

  test('25 - búsqueda filtra por nombre de médico', async ({ page }) => {
    await irAPagoPrestador(page)
    await buscarEnTabla(page, 'Prestador PP')
    await page.waitForTimeout(200)
    await expect(page.locator('.pp-tr').first()).toBeVisible({ timeout: 6000 })
    const filas = page.locator('.pp-tr')
    const count = await filas.count()
    for (let i = 0; i < Math.min(count, 5); i++) {
      await expect(filas.nth(i)).toContainText('Prestador')
    }
  })

  test('26 - búsqueda sin resultados muestra estado vacío', async ({ page }) => {
    await irAPagoPrestador(page)
    await buscarEnTabla(page, 'NORESULTADOSE2EPP99999')
    await expect(page.locator('.pp-td', { hasText: 'Sin registros' })).toBeVisible({ timeout: 5000 })
  })

  test('27 - limpiar búsqueda restaura la lista', async ({ page }) => {
    await irAPagoPrestador(page)
    await buscarEnTabla(page, 'NORESULTADOSE2EPP99999')
    await page.waitForTimeout(300)
    await page.fill('.pp-search-input', '')
    await page.waitForTimeout(400)
    await expect(page.locator('.pp-tr').first()).toBeVisible({ timeout: 6000 })
  })

  test('28 - filtro por estado Pagado muestra solo pagados', async ({ page }) => {
    await irAPagoPrestador(page)
    await page.selectOption('.pp-filtro-sel', 'pagado')
    await page.waitForTimeout(400)
    const badges = page.locator('.pp-badge')
    const count  = await badges.count()
    for (let i = 0; i < Math.min(count, 5); i++) {
      const texto = await badges.nth(i).textContent()
      expect(texto?.trim()).toBe('Pagado')
    }
    await page.selectOption('.pp-filtro-sel', '')
  })

  test('29 - filtro por fecha desde funciona', async ({ page }) => {
    await irAPagoPrestador(page)
    const hoy = hoyStr()
    await page.fill('.pp-filtro-date', hoy)
    await page.waitForTimeout(400)
    const filas = page.locator('.pp-tr')
    const count = await filas.count()
    for (let i = 0; i < Math.min(count, 5); i++) {
      const texto = await filas.nth(i).locator('.pp-td').nth(2).textContent()
      // La fecha en tabla está en formato dd/mm/yyyy, verificamos que existe
      expect(texto?.length).toBeGreaterThan(0)
    }
    // Limpiar filtro
    await page.fill('.pp-filtro-date', '')
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

  test('30 - recepcionista puede listar pagos', async ({ page }) => {
    await loginRecep(page)
    await irAPagoPrestador(page)
    await expect(page.locator('.pp-tabla-wrap')).toBeVisible({ timeout: 6000 })
  })

  test('31 - recepcionista NO ve botón Nuevo pago', async ({ page }) => {
    await loginRecep(page)
    await irAPagoPrestador(page)
    await expect(page.locator('.pp-btn-nuevo')).not.toBeVisible({ timeout: 5000 })
  })

  test('32 - recepcionista NO ve botón papelera en filas', async ({ page }) => {
    await loginRecep(page)
    await irAPagoPrestador(page)
    await expect(page.locator('.pp-row-btn.danger').first()).not.toBeVisible({ timeout: 5000 })
  })

  test('33 - recepcionista puede abrir detalle (clic en fila)', async ({ page, request }) => {
    await loginRecep(page)

    // El recep necesita que haya datos para ver — hacer login admin primero solo para API
    const tokenAdmin = await obtenerToken(request)
    const _apiGet = async (path) => {
      const r = await request.get(`http://localhost:8000${path}`, {
        headers: { Authorization: `Bearer ${tokenAdmin}` },
      })
      return r.json()
    }
    const pagos = await _apiGet(`/api/pago-prestador/?page_size=1`)
    const lista  = pagos.results ?? pagos ?? []
    if (lista.length === 0) {
      test.skip()
      return
    }

    await irAPagoPrestador(page)
    const fila = page.locator('.pp-tr').first()
    await expect(fila).toBeVisible({ timeout: 6000 })
    await fila.click()
    await expect(page.locator('.modal-title', { hasText: 'Detalle de pago' })).toBeVisible({ timeout: 5000 })
  })

  test('34 - recepcionista NO ve botón Eliminar en toolbar del detalle', async ({ page }) => {
    await loginRecep(page)
    await irAPagoPrestador(page)
    const fila = page.locator('.pp-tr').first()
    await expect(fila).toBeVisible({ timeout: 6000 })
    await fila.click()
    await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.pp-ver-btn.del')).not.toBeVisible({ timeout: 3000 })
  })

})
