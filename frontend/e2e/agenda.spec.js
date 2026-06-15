const { test, expect } = require('@playwright/test')

const TS       = Date.now()
const DOC_PRES = `E2EAG_P${TS}`
const NOM_PRES = `E2E Medico Agenda ${TS}`
const DOC_PAC  = `E2EAGPAC${TS}`
const NOM_PAC  = `E2E Paciente Ag ${TS}`

// Lunes al menos 14 días en el futuro (para que el horario Lunes aplique)
function proximoLunesLejos() {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  const dow = d.getDay()
  if (dow !== 1) {
    const add = dow === 0 ? 1 : (8 - dow) % 7
    d.setDate(d.getDate() + add)
  }
  return d.toLocaleDateString('en-CA')
}

const FECHA_TURNO = proximoLunesLejos()
const [anioT, mesT, diaT] = FECHA_TURNO.split('-').map(Number)

const FECHA_GEN = (() => {
  const d = new Date(FECHA_TURNO + 'T00:00:00')
  d.setDate(d.getDate() + 7)
  return d.toLocaleDateString('en-CA')
})()

let prestId   = null
let pacId     = null
let horarioId = null
let turnoIds  = []
let token     = null

// ─── helpers ──────────────────────────────────────────────────────────────────

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

async function crearPersona(request, nro, nombre, tk) {
  const resp   = await request.get('http://localhost:8000/api/tipo-documento/', {
    headers: { Authorization: `Bearer ${tk}` },
  })
  const body   = await resp.json()
  const tipoId = (body.results || body)[0]?.id
  const r = await request.post('http://localhost:8000/api/persona/', {
    data: { tipo_documento: tipoId, nro_documento: nro, razon_social: nombre },
    headers: { Authorization: `Bearer ${tk}` },
  })
  return (await r.json()).id
}

async function crearPrestador(request, personaId, tk) {
  const r = await request.post('http://localhost:8000/api/personarrhh/', {
    data: { persona: personaId, cargo: 'medico', tipo_contrato: 'dependencia' },
    headers: { Authorization: `Bearer ${tk}` },
  })
  return (await r.json()).id
}

async function crearHorario(request, prestadorId, tk) {
  const r = await request.post('http://localhost:8000/api/horario-prestador/', {
    data: {
      persona_rrhh: prestadorId,
      dia_semana: 1,
      hora_desde: '08:00',
      hora_hasta: '10:00',
      intervalo: 30,
    },
    headers: { Authorization: `Bearer ${tk}` },
  })
  return (await r.json()).id
}

async function crearPaciente(request, tk) {
  const pId = await crearPersona(request, DOC_PAC, NOM_PAC, tk)
  const r = await request.post('http://localhost:8000/api/paciente/', {
    data: { persona: pId, sexo: 'M' },
    headers: { Authorization: `Bearer ${tk}` },
  })
  return (await r.json()).id
}

async function generarTurnos(request, horId, desde, hasta, tk) {
  await request.post(`http://localhost:8000/api/horario-prestador/${horId}/generar/`, {
    data: { fecha_desde: desde, fecha_hasta: hasta },
    headers: { Authorization: `Bearer ${tk}` },
  })
}

async function obtenerTurnos(request, pId, fecha, tk) {
  const r = await request.get(
    `http://localhost:8000/api/agenda/?persona_rrhh=${pId}&fecha=${fecha}&page_size=20`,
    { headers: { Authorization: `Bearer ${tk}` } }
  )
  const body = await r.json()
  return (body.results || []).sort((a, b) =>
    (a.hora_desde ?? '').localeCompare(b.hora_desde ?? '')
  )
}

async function apiDelete(request, url, tk) {
  await request.delete(url, { headers: { Authorization: `Bearer ${tk}` } })
}

async function loginComoRecep(page) {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  })
  await page.goto('/login')
  await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: 8000 })
  await page.fill('input[name="username"]', 'test_e2e_recep')
  await page.fill('input[name="password"]', 'TestRecep1234!')
  await page.click('button[type="submit"]')
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 })
}

async function irAAgenda(page) {
  await page.goto('/agenda/citas')
  await expect(page.locator('.ag-cal-card')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(800)
}

async function seleccionarMedico(page, nombre) {
  const buscador = page.locator('.ag-search-input')
  if (await buscador.isVisible()) {
    await buscador.fill(nombre.slice(0, 18))
    await page.waitForTimeout(500)
  }
  const item = page.locator('.ag-medico-item', { hasText: nombre })
  await expect(item).toBeVisible({ timeout: 8000 })
  await item.click()
  await page.waitForTimeout(400)
}

async function navegarAMes(page, anio, mes) {
  const hoy  = new Date()
  const diff = (anio - hoy.getFullYear()) * 12 + (mes - (hoy.getMonth() + 1))
  if (diff > 0) {
    const btn = page.locator('.ag-cal-nav-btn').last()
    for (let i = 0; i < diff; i++) { await btn.click(); await page.waitForTimeout(300) }
  } else if (diff < 0) {
    const btn = page.locator('.ag-cal-nav-btn').first()
    for (let i = 0; i < Math.abs(diff); i++) { await btn.click(); await page.waitForTimeout(300) }
  }
}

async function clickDia(page, diaNum) {
  const cells = page.locator('.ag-cal-celda-activa')
  const count = await cells.count()
  for (let i = 0; i < count; i++) {
    const num = await cells.nth(i).locator('.ag-cal-num').textContent()
    if (num?.trim() === String(diaNum)) {
      await cells.nth(i).click()
      await page.waitForTimeout(500)
      return
    }
  }
  throw new Error(`Día ${diaNum} no encontrado en el calendario`)
}

async function irAlTurnoDia(page) {
  await seleccionarMedico(page, NOM_PRES)
  await navegarAMes(page, anioT, mesT)
  await clickDia(page, diaT)
  await expect(page.locator('.ag-turno').first()).toBeVisible({ timeout: 8000 })
}

// ─── setup y limpieza ──────────────────────────────────────────────────────────

test.beforeAll(async ({ request }) => {
  token     = await obtenerToken(request)
  const pId = await crearPersona(request, DOC_PRES, NOM_PRES, token)
  prestId   = await crearPrestador(request, pId, token)
  horarioId = await crearHorario(request, prestId, token)
  pacId     = await crearPaciente(request, token)
  await generarTurnos(request, horarioId, FECHA_TURNO, FECHA_TURNO, token)
  const turnos = await obtenerTurnos(request, prestId, FECHA_TURNO, token)
  turnoIds = turnos.map(t => t.id)
})

test.afterAll(async ({ request }) => {
  const tk = token || (await obtenerToken(request))
  // Eliminar todos los turnos activos del prestador
  const r = await request.get(
    `http://localhost:8000/api/agenda/?persona_rrhh=${prestId}&page_size=200`,
    { headers: { Authorization: `Bearer ${tk}` } }
  )
  const body = await r.json()
  for (const t of (body.results || [])) {
    await request.delete(`http://localhost:8000/api/agenda/${t.id}/`, {
      headers: { Authorization: `Bearer ${tk}` },
    })
  }
  if (horarioId) await apiDelete(request, `http://localhost:8000/api/horario-prestador/${horarioId}/`, tk)
  if (prestId)   await apiDelete(request, `http://localhost:8000/api/personarrhh/${prestId}/`, tk)
  if (pacId)     await apiDelete(request, `http://localhost:8000/api/paciente/${pacId}/`, tk)
})

// ══════════════════════════════════════════════════════════════════════════════
// ESTRUCTURA INICIAL
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Estructura inicial', () => {

  test('01 - carga el calendario y la lista de médicos', async ({ page }) => {
    await irAAgenda(page)
    await expect(page.locator('.ag-cal-card')).toBeVisible()
    await expect(page.locator('.ag-medico-list')).toBeVisible()
  })

  test('02 - estadísticas del mes visibles en el header', async ({ page }) => {
    await irAAgenda(page)
    await expect(page.locator('.ag-stats-inline')).toBeVisible()
    await expect(page.locator('.ag-stat-pill').first()).toBeVisible()
  })

  test('03 - botones Generar y Gestionar visibles', async ({ page }) => {
    await irAAgenda(page)
    await expect(page.locator('.ag-cal-action-gen')).toBeVisible()
    await expect(page.locator('.ag-cal-action-gest')).toBeVisible()
  })

  test('04 - encabezados de días de la semana en el calendario', async ({ page }) => {
    await irAAgenda(page)
    const headers = page.locator('.ag-cal-dia-hdr')
    await expect(headers.first()).toBeVisible()
    await expect(headers).toHaveCount(7)
    await expect(headers.first()).toContainText('Lun')
    await expect(headers.last()).toContainText('Dom')
  })

  test('05 - panel muestra estado vacío sin día seleccionado', async ({ page }) => {
    await irAAgenda(page)
    await expect(page.locator('.ag-panel-empty')).toBeVisible()
    await expect(page.locator('.ag-panel-titulo')).toContainText('Detalle del día')
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// SELECCIONAR MÉDICO
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Seleccionar médico', () => {

  test('06 - clic en médico lo resalta con clase activa', async ({ page }) => {
    await irAAgenda(page)
    await seleccionarMedico(page, NOM_PRES)
    const item = page.locator('.ag-medico-item', { hasText: NOM_PRES })
    await expect(item).toHaveClass(/ag-medico-item-on/)
  })

  test('07 - calendario muestra el nombre del médico seleccionado', async ({ page }) => {
    await irAAgenda(page)
    await seleccionarMedico(page, NOM_PRES)
    await expect(page.locator('.ag-cal-titulo')).toContainText(NOM_PRES)
  })

  test('08 - búsqueda en lista filtra por nombre', async ({ page }) => {
    await irAAgenda(page)
    const buscador = page.locator('.ag-search-input')
    if (await buscador.isVisible()) {
      await buscador.fill('XXXXXNOEXISTE')
      await page.waitForTimeout(500)
      await expect(page.locator('.ag-medico-item', { hasText: NOM_PRES })).not.toBeVisible()
    }
  })

  test('09 - segundo clic en médico seleccionado lo deselecciona', async ({ page }) => {
    await irAAgenda(page)
    await seleccionarMedico(page, NOM_PRES)
    // Segundo clic deselecciona
    const item = page.locator('.ag-medico-item', { hasText: NOM_PRES })
    await item.click()
    await page.waitForTimeout(300)
    await expect(item).not.toHaveClass(/ag-medico-item-on/)
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// CALENDARIO
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Calendario', () => {

  test('10 - botón siguiente navega al mes siguiente', async ({ page }) => {
    await irAAgenda(page)
    const label = page.locator('.ag-cal-mes-label')
    const textoActual = await label.textContent()
    await page.locator('.ag-cal-nav-btn').last().click()
    await page.waitForTimeout(300)
    await expect(label).not.toHaveText(textoActual ?? '')
  })

  test('11 - botón anterior navega al mes anterior', async ({ page }) => {
    await irAAgenda(page)
    const label = page.locator('.ag-cal-mes-label')
    const textoActual = await label.textContent()
    await page.locator('.ag-cal-nav-btn').last().click()
    await page.waitForTimeout(300)
    await page.locator('.ag-cal-nav-btn').first().click()
    await page.waitForTimeout(300)
    await expect(label).toHaveText(textoActual ?? '')
  })

  test('12 - clic en día resalta la celda con clase sel', async ({ page }) => {
    await irAAgenda(page)
    await seleccionarMedico(page, NOM_PRES)
    await navegarAMes(page, anioT, mesT)
    await clickDia(page, diaT)
    await expect(
      page.locator('.ag-cal-celda-activa')
        .filter({ has: page.locator('.ag-cal-num').getByText(String(diaT), { exact: true }) })
        .first()
    ).toHaveClass(/ag-cal-celda-sel/)
  })

  test('13 - panel actualiza título al seleccionar día', async ({ page }) => {
    await irAAgenda(page)
    await seleccionarMedico(page, NOM_PRES)
    await navegarAMes(page, anioT, mesT)
    await clickDia(page, diaT)
    await expect(page.locator('.ag-panel-titulo')).not.toContainText('Detalle del día')
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// TURNOS DEL DÍA EN EL PANEL
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Turnos del día', () => {

  test('14 - con médico y día con turnos se muestran en el panel', async ({ page }) => {
    await irAAgenda(page)
    await irAlTurnoDia(page)
    await expect(page.locator('.ag-turno').first()).toBeVisible()
  })

  test('15 - cada turno muestra hora y badge de estado', async ({ page }) => {
    await irAAgenda(page)
    await irAlTurnoDia(page)
    const turno = page.locator('.ag-turno').first()
    await expect(turno.locator('.ag-turno-hora')).toBeVisible()
    await expect(turno.locator('.ag-turno-badge')).toBeVisible()
    await expect(turno.locator('.ag-turno-hora')).toContainText('08:00')
    await expect(turno.locator('.ag-turno-badge')).toContainText('Disponible')
  })

  test('16 - clic en turno lo expande mostrando ag-turno-sel', async ({ page }) => {
    await irAAgenda(page)
    await irAlTurnoDia(page)
    const turno = page.locator('.ag-turno').first()
    await turno.locator('.ag-turno-head').click()
    await expect(turno).toHaveClass(/ag-turno-sel/)
  })

  test('17 - turno disponible expandido muestra sección "Asignar paciente"', async ({ page }) => {
    await irAAgenda(page)
    await irAlTurnoDia(page)
    const turno = page.locator('.ag-turno').first()
    await turno.locator('.ag-turno-head').click()
    await expect(page.locator('.ag-asignar')).toBeVisible()
    await expect(page.locator('.ag-asignar-titulo')).toContainText('Asignar')
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// ASIGNAR PACIENTE
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Asignar paciente', () => {

  test('18 - botón Confirmar deshabilitado sin paciente seleccionado', async ({ page }) => {
    await irAAgenda(page)
    await irAlTurnoDia(page)
    await page.locator('.ag-turno').first().locator('.ag-turno-head').click()
    await expect(page.locator('.ag-btn-confirmar')).toBeDisabled()
  })

  test('19 - buscar paciente con 3+ chars muestra dropdown', async ({ page }) => {
    await irAAgenda(page)
    await irAlTurnoDia(page)
    await page.locator('.ag-turno').first().locator('.ag-turno-head').click()
    await expect(page.locator('.ag-pac-input')).toBeVisible()
    await page.locator('.ag-pac-input').fill(DOC_PAC.slice(0, 6))
    await page.waitForTimeout(600)
    await expect(page.locator('.ag-pac-results')).toBeVisible({ timeout: 6000 })
    await expect(page.locator('.ag-pac-item').first()).toBeVisible()
  })

  test('20 - seleccionar paciente del dropdown habilita Confirmar', async ({ page }) => {
    await irAAgenda(page)
    await irAlTurnoDia(page)
    await page.locator('.ag-turno').first().locator('.ag-turno-head').click()
    await page.locator('.ag-pac-input').fill(DOC_PAC.slice(0, 6))
    await page.waitForTimeout(600)
    await expect(page.locator('.ag-pac-item').first()).toBeVisible({ timeout: 6000 })
    await page.locator('.ag-pac-item').first().click()
    await expect(page.locator('.ag-pac-sel')).toBeVisible()
    await expect(page.locator('.ag-btn-confirmar')).toBeEnabled()
  })

  // Usa el segundo turno (08:30) para no interferir con otros tests
  test('21 - confirmar cita cambia estado a ocupado y muestra toast', async ({ page }) => {
    await irAAgenda(page)
    await irAlTurnoDia(page)

    // Expandir el turno de las 08:30 (índice 1)
    const turno = page.locator('.ag-turno').nth(1)
    await turno.locator('.ag-turno-head').click()
    await expect(page.locator('.ag-pac-input')).toBeVisible()

    await page.locator('.ag-pac-input').fill(DOC_PAC.slice(0, 6))
    await page.waitForTimeout(600)
    await expect(page.locator('.ag-pac-item').first()).toBeVisible({ timeout: 6000 })
    await page.locator('.ag-pac-item').first().click()
    await expect(page.locator('.ag-btn-confirmar')).toBeEnabled()

    await page.locator('.ag-btn-confirmar').click()
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 8000 })

    // El turno ahora debería mostrar "ocupado"
    await expect(turno.locator('.ag-turno-badge')).toContainText('Confirmado', { timeout: 6000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// CAMBIAR ESTADO
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Cambiar estado', () => {

  test('22 - turno disponible expandido muestra chips de cambio de estado', async ({ page }) => {
    await irAAgenda(page)
    await irAlTurnoDia(page)
    await page.locator('.ag-turno').first().locator('.ag-turno-head').click()
    await expect(page.locator('.ag-estado-actions')).toBeVisible()
    await expect(page.locator('.ag-estado-chip').first()).toBeVisible()
  })

  test('23 - chip Bloquear muestra ConfirmDialog', async ({ page }) => {
    await irAAgenda(page)
    await irAlTurnoDia(page)
    await page.locator('.ag-turno').first().locator('.ag-turno-head').click()
    const chipBloquear = page.locator('.ag-estado-chip', { hasText: 'Bloquear' })
    await expect(chipBloquear).toBeVisible()
    await chipBloquear.click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  })

  test('24 - cancelar en ConfirmDialog mantiene el turno como disponible', async ({ page }) => {
    await irAAgenda(page)
    await irAlTurnoDia(page)
    const turno = page.locator('.ag-turno').first()
    await turno.locator('.ag-turno-head').click()
    await page.locator('.ag-estado-chip', { hasText: 'Bloquear' }).click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })

    // Cancelar (botón "Cancelar" en el dialog)
    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
    await expect(page.locator('.cd-overlay')).not.toBeVisible({ timeout: 3000 })
    await expect(turno.locator('.ag-turno-badge')).toContainText('Disponible')
  })

  // Usa el tercer turno (09:00) para no interferir con el test de asignar (que usó 08:30)
  test('25 - confirmar bloqueo cambia estado a inactivo y muestra toast', async ({ page }) => {
    await irAAgenda(page)
    await irAlTurnoDia(page)
    const turno = page.locator('.ag-turno').nth(2)
    await turno.locator('.ag-turno-head').click()
    await page.locator('.ag-estado-chip', { hasText: 'Bloquear' }).click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })

    await page.locator('.cd-backdrop').getByRole('button', { name: /bloquear/i }).click()
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 8000 })

    // El turno debe cambiar a inactivo
    await expect(turno.locator('.ag-turno-badge')).toContainText('Bloqueado', { timeout: 6000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// MODAL GENERAR TURNOS
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Generar turnos', () => {

  test('26 - botón Generar abre el modal', async ({ page }) => {
    await irAAgenda(page)
    await page.locator('.ag-cal-action-gen').click()
    await expect(page.locator('.modal-box')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.modal-box')).toContainText('Generar turnos')
  })

  test('27 - modal tiene campos Desde y Hasta', async ({ page }) => {
    await irAAgenda(page)
    await page.locator('.ag-cal-action-gen').click()
    await expect(page.locator('.modal-box')).toBeVisible({ timeout: 4000 })
    const inputs = page.locator('.ag-gen-input')
    await expect(inputs.first()).toBeVisible()
    await expect(inputs.nth(1)).toBeVisible()
  })

  test('28 - botón Generar deshabilitado sin fechas completadas', async ({ page }) => {
    await irAAgenda(page)
    await page.locator('.ag-cal-action-gen').click()
    await expect(page.locator('.modal-box')).toBeVisible({ timeout: 4000 })
    // Limpiar fecha desde (viene pre-seteada con hoy)
    await page.locator('.ag-gen-input').first().fill('')
    await expect(page.locator('.ag-btn-gen')).toBeDisabled()
  })

  test('29 - generar con fechas válidas muestra resultado', async ({ page }) => {
    await irAAgenda(page)
    await seleccionarMedico(page, NOM_PRES)
    await page.locator('.ag-cal-action-gen').click()
    await expect(page.locator('.modal-box')).toBeVisible({ timeout: 4000 })

    const inputs = page.locator('.ag-gen-input')
    await inputs.first().fill(FECHA_GEN)
    await inputs.nth(1).fill(FECHA_GEN)
    await page.waitForTimeout(500)

    await expect(page.locator('.ag-btn-gen')).toBeEnabled({ timeout: 4000 })
    await page.locator('.ag-btn-gen').click()
    await expect(page.locator('.ag-gen-result')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.ag-gen-result')).toContainText('turno')
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// MODAL GESTIONAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Gestionar turnos', () => {

  test('30 - botón Gestionar abre el modal con advertencia', async ({ page }) => {
    await irAAgenda(page)
    await page.locator('.ag-cal-action-gest').click()
    await expect(page.locator('.modal-box')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.ag-gest-warn')).toBeVisible()
    await expect(page.locator('.ag-gest-warn-title')).toContainText('Cancelación')
  })

  test('31 - modal gestionar tiene campos de rango de fechas', async ({ page }) => {
    await irAAgenda(page)
    await page.locator('.ag-cal-action-gest').click()
    await expect(page.locator('.modal-box')).toBeVisible({ timeout: 4000 })
    const inputs = page.locator('.ag-gen-input[type="date"]')
    await expect(inputs.first()).toBeVisible()
    await expect(inputs.nth(1)).toBeVisible()
  })

  test('32 - cerrar modal gestionar sin datos no activa NavigationGuard', async ({ page }) => {
    await irAAgenda(page)
    await page.locator('.ag-cal-action-gest').click()
    await expect(page.locator('.modal-box')).toBeVisible({ timeout: 4000 })

    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    // Sin datos en el form, el modal cierra sin guard
    await expect(page.locator('.cd-overlay')).not.toBeVisible()
    await expect(page.locator('.modal-box')).not.toBeVisible({ timeout: 3000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// PERMISOS — RECEPCIONISTA
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Permisos recepcionista', () => {

  test('33 - recepcionista ve el calendario y la lista de médicos', async ({ page }) => {
    await loginComoRecep(page)
    await irAAgenda(page)
    await expect(page.locator('.ag-cal-card')).toBeVisible()
    await expect(page.locator('.ag-medico-list')).toBeVisible()
  })

  test('34 - recepcionista puede seleccionar médico', async ({ page }) => {
    await loginComoRecep(page)
    await irAAgenda(page)
    const buscador = page.locator('.ag-search-input')
    if (await buscador.isVisible()) {
      await buscador.fill(NOM_PRES.slice(0, 18))
      await page.waitForTimeout(500)
    }
    const item = page.locator('.ag-medico-item', { hasText: NOM_PRES })
    if (await item.isVisible()) {
      await item.click()
      await expect(page.locator('.ag-cal-titulo')).toContainText(NOM_PRES)
    }
  })

  test('35 - recepcionista ve botones Generar y Gestionar', async ({ page }) => {
    await loginComoRecep(page)
    await irAAgenda(page)
    await expect(page.locator('.ag-cal-action-gen')).toBeVisible()
    await expect(page.locator('.ag-cal-action-gest')).toBeVisible()
  })

  test('36 - recepcionista puede expandir turno disponible en el panel', async ({ page }) => {
    await loginComoRecep(page)
    await irAAgenda(page)
    const buscador = page.locator('.ag-search-input')
    if (await buscador.isVisible()) {
      await buscador.fill(NOM_PRES.slice(0, 18))
      await page.waitForTimeout(500)
    }
    const item = page.locator('.ag-medico-item', { hasText: NOM_PRES })
    await expect(item).toBeVisible({ timeout: 8000 })
    await item.click()
    await page.waitForTimeout(400)
    await navegarAMes(page, anioT, mesT)
    await clickDia(page, diaT)
    // El turno 08:00 está disponible (el 08:30 fue asignado en test 21, 09:00 bloqueado en test 25)
    const turno = page.locator('.ag-turno').first()
    await turno.locator('.ag-turno-head').click()
    await expect(page.locator('.ag-asignar')).toBeVisible()
  })

})
