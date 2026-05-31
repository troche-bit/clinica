const { test, expect } = require('@playwright/test')
const path = require('path')

const OUT = path.resolve(__dirname, '../../docs/imagenes/consultas')
const TS  = Date.now()

const DOC_PRES = `SRCS_P${TS}`
const NOM_PRES = `Ríos Paredes, Claudia`
const DOC_PAC  = `SRCS_Q${TS}`
const NOM_PAC  = `Aguilera Benítez, Mateo`

const HOY     = new Date().toLocaleDateString('en-CA')
const DIA_HOY = (() => { const d = new Date().getDay(); return d === 0 ? 7 : d })()

let prestId    = null
let horarioId  = null
let pacienteId = null
let agendaId   = null
let consultaId = null
let token      = null

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

async function apiDelete(request, url, tk) {
  await request.delete(url, { headers: { Authorization: `Bearer ${tk}` } })
}

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeAll(async ({ request }) => {
  token = await obtenerToken(request)

  const pId = await crearPersona(request, DOC_PRES, NOM_PRES, token)
  const rp  = await request.post('http://localhost:8000/api/personarrhh/', {
    data: { persona: pId, cargo: 'medico', tipo_contrato: 'dependencia' },
    headers: { Authorization: `Bearer ${token}` },
  })
  prestId = (await rp.json()).id

  const rh = await request.post('http://localhost:8000/api/horario-prestador/', {
    data: {
      persona_rrhh: prestId,
      dia_semana: DIA_HOY,
      hora_desde: '08:00',
      hora_hasta: '12:00',
      intervalo: 30,
    },
    headers: { Authorization: `Bearer ${token}` },
  })
  horarioId = (await rh.json()).id

  const pPacId = await crearPersona(request, DOC_PAC, NOM_PAC, token)
  const rpac   = await request.post('http://localhost:8000/api/paciente/', {
    data: { persona: pPacId, sexo: 'M' },
    headers: { Authorization: `Bearer ${token}` },
  })
  pacienteId = (await rpac.json()).id

  // Turno ocupado para hoy
  const rag = await request.post('http://localhost:8000/api/agenda/', {
    data: {
      horario_prestador: horarioId,
      paciente: pacienteId,
      fecha: HOY,
      hora_desde: '08:00',
      hora_hasta: '08:30',
      estado: 'ocupado',
    },
    headers: { Authorization: `Bearer ${token}` },
  })
  agendaId = (await rag.json()).id

  // Segundo turno ocupado para hoy (para mostrar más de uno en las capturas)
  await request.post('http://localhost:8000/api/agenda/', {
    data: {
      horario_prestador: horarioId,
      paciente: pacienteId,
      fecha: HOY,
      hora_desde: '08:30',
      hora_hasta: '09:00',
      estado: 'ocupado',
    },
    headers: { Authorization: `Bearer ${token}` },
  })

  // Crear consulta en_espera para el turno principal
  const rc = await request.post('http://localhost:8000/api/consultas/', {
    data: { agenda: agendaId },
    headers: { Authorization: `Bearer ${token}` },
  })
  consultaId = (await rc.json()).id
})

test.afterAll(async ({ request }) => {
  const tk = token || (await obtenerToken(request))
  // Limpiar consultas del prestador
  const rc = await request.get(
    `http://localhost:8000/api/consultas/?persona_rrhh=${prestId}&page_size=50`,
    { headers: { Authorization: `Bearer ${tk}` } }
  )
  const cuerpo = await rc.json()
  for (const c of (cuerpo.results || [])) {
    await apiDelete(request, `http://localhost:8000/api/consultas/${c.id}/`, tk)
  }
  // Limpiar agendas
  const ra = await request.get(
    `http://localhost:8000/api/agenda/?persona_rrhh=${prestId}&page_size=50`,
    { headers: { Authorization: `Bearer ${tk}` } }
  )
  const ag = await ra.json()
  for (const a of (ag.results || [])) {
    await apiDelete(request, `http://localhost:8000/api/agenda/${a.id}/`, tk)
  }
  if (horarioId)  await apiDelete(request, `http://localhost:8000/api/horario-prestador/${horarioId}/`, tk)
  if (prestId)    await apiDelete(request, `http://localhost:8000/api/personarrhh/${prestId}/`, tk)
  if (pacienteId) await apiDelete(request, `http://localhost:8000/api/paciente/${pacienteId}/`, tk)
})

async function irAConsultas(page) {
  await page.goto('/consultas')
  await expect(page.locator('.cs-page')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(800)
}

async function irARecep(page) {
  await irAConsultas(page)
  await page.locator('.cs-tab', { hasText: 'Vista recepcionista' }).click()
  await expect(page.locator('.cs-vista-recepcionista')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(600)
}

async function seleccionarMedico(page) {
  const input = page.locator('.cs-medico-input')
  await expect(input).toBeVisible({ timeout: 6000 })
  await input.fill(NOM_PRES.slice(0, 14))
  await page.waitForTimeout(600)
  const opcion = page.locator('.cs-medico-option', { hasText: NOM_PRES })
  await expect(opcion).toBeVisible({ timeout: 6000 })
  await opcion.click()
  await page.waitForTimeout(500)
}

// ══════════════════════════════════════════════════════════════════════════════
// 01 — Vista recepcionista con turnos del día
// ══════════════════════════════════════════════════════════════════════════════
test('01 - vista recepcionista turnos del dia', async ({ page }) => {
  await irARecep(page)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/01_vista_recepcionista.png` })
})

// ══════════════════════════════════════════════════════════════════════════════
// 02 — Vista recepcionista — filtro por médico activo
// ══════════════════════════════════════════════════════════════════════════════
test('02 - filtro por medico activo', async ({ page }) => {
  await irARecep(page)
  await page.fill('.cs-filtro-input', NOM_PRES.slice(0, 14))
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/02_filtro_medico.png` })
})

// ══════════════════════════════════════════════════════════════════════════════
// 03 — Vista médico — lista de turnos del día
// ══════════════════════════════════════════════════════════════════════════════
test('03 - vista medico turnos del dia', async ({ page }) => {
  await irAConsultas(page)
  await seleccionarMedico(page)
  await expect(page.locator('.cs-turno-card').first()).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/03_vista_medico_turnos.png` })
})

// ══════════════════════════════════════════════════════════════════════════════
// 04 — Vista médico — dropdown buscador de médico
// ══════════════════════════════════════════════════════════════════════════════
test('04 - buscador de medico con dropdown', async ({ page }) => {
  await irAConsultas(page)
  const input = page.locator('.cs-medico-input')
  await expect(input).toBeVisible({ timeout: 6000 })
  await input.fill(NOM_PRES.slice(0, 10))
  await page.waitForTimeout(600)
  await expect(page.locator('.cs-medico-dropdown')).toBeVisible({ timeout: 6000 })
  await page.screenshot({ path: `${OUT}/04_buscador_medico.png` })
})

// ══════════════════════════════════════════════════════════════════════════════
// 05 — Consulta en curso — panel activo con formulario
// ══════════════════════════════════════════════════════════════════════════════
test('05 - panel consulta activa formulario', async ({ page }) => {
  await irAConsultas(page)
  await seleccionarMedico(page)
  await expect(page.locator('.cs-turno-card').first()).toBeVisible({ timeout: 8000 })

  // Iniciar la consulta que está en_espera
  const btnIniciar = page.locator('.cs-btn-iniciar').first()
  await expect(btnIniciar).toBeVisible({ timeout: 4000 })
  await btnIniciar.click()
  await expect(page.locator('.cs-panel-activa')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/05_panel_consulta_activa.png` })
})

// ══════════════════════════════════════════════════════════════════════════════
// 06 — Panel activo con datos clínicos completados
// ══════════════════════════════════════════════════════════════════════════════
test('06 - panel con datos clinicos', async ({ page }) => {
  await irAConsultas(page)
  await seleccionarMedico(page)
  await expect(page.locator('.cs-turno-card').first()).toBeVisible({ timeout: 8000 })

  // La consulta está en_consulta: click en la tarjeta abre el panel directamente
  await page.locator('.cs-turno-card').first().click()
  await expect(page.locator('.cs-panel-activa')).toBeVisible({ timeout: 8000 })

  // Completar los campos clínicos
  const textareas = page.locator('.cs-panel-activa textarea')
  await textareas.nth(0).fill('Control de rutina anual. Paciente refiere malestar general.')
  await textareas.nth(1).fill('Hipertensión leve controlada. Sin complicaciones.')
  await textareas.nth(2).fill('Enalapril 10mg cada 24 horas.')
  await textareas.nth(3).fill('Dieta baja en sodio. Control en 3 meses.')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/06_datos_clinicos_completos.png` })
})

// ══════════════════════════════════════════════════════════════════════════════
// 07 — ConfirmDialog al intentar finalizar
// ══════════════════════════════════════════════════════════════════════════════
test('07 - confirm dialog finalizar consulta', async ({ page }) => {
  await irAConsultas(page)
  await seleccionarMedico(page)
  await expect(page.locator('.cs-turno-card').first()).toBeVisible({ timeout: 8000 })

  // Abrir el panel de la consulta en_consulta
  await page.locator('.cs-turno-card').first().click()
  await expect(page.locator('.cs-panel-activa')).toBeVisible({ timeout: 8000 })

  const textareas = page.locator('.cs-panel-activa textarea')
  await textareas.nth(0).fill('Dolor de cabeza recurrente.')
  await textareas.nth(1).fill('Cefalea tensional.')
  await textareas.nth(2).fill('Ibuprofeno 400mg cada 8h por 5 días.')
  await textareas.nth(3).fill('Reposo relativo. Evitar pantallas.')
  await page.waitForTimeout(200)

  // El botón usa clase cs-btn-finalizar y texto "Completar consulta"
  await expect(page.locator('.cs-btn-finalizar')).toBeVisible({ timeout: 4000 })
  await page.locator('.cs-btn-finalizar').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/07_confirm_finalizar.png` })
  // Cancelar para no finalizar la consulta
  await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
})

// ══════════════════════════════════════════════════════════════════════════════
// 08 — Vista recepcionista con consulta en curso (badge activo)
// ══════════════════════════════════════════════════════════════════════════════
test('08 - recep con consulta en curso badge', async ({ page }) => {
  await irARecep(page)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/08_recep_consulta_en_curso.png` })
})
