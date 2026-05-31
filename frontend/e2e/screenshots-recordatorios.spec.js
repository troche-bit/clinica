const { test, expect } = require('@playwright/test')
const path = require('path')

const OUT = path.resolve(__dirname, '../../docs/imagenes/recordatorios')
const TS  = Date.now()

let token        = null
let tipoDocId    = null
let prestadorId  = null
let consultorioId = null
let horarioId    = null
let pacienteId   = null
let pacSinEmailId = null
let agendaId     = null
let agenda2Id    = null
let consultaId   = null
let consulta2Id  = null

test.use({ viewport: { width: 1440, height: 900 } })

// ─── helpers ──────────────────────────────────────────────────────────────────

function auth() {
  return { Authorization: `Bearer ${token}` }
}

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

async function irARecordatorios(page) {
  await page.goto('/agenda/recordatorios')
  await expect(page.locator('.rec-stats')).toBeVisible({ timeout: 10000 })
  await page.locator('.rec-periodo-tab', { hasText: 'Todos' }).click()
  await page.waitForTimeout(600)
}

async function irAConfig(page) {
  await page.goto('/agenda/recordatorios/configuracion')
  await expect(page.locator('.rec-cfg-wrap')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(400)
}

// ─── setup ────────────────────────────────────────────────────────────────────

test.beforeAll(async ({ request }) => {
  token = await obtenerToken(request)

  const tiposR = await request.get('http://localhost:8000/api/tipo-documento/?page_size=10', { headers: auth() })
  const tiposData = await tiposR.json()
  tipoDocId = (tiposData.results ?? tiposData)[0].id

  // Prestador
  const ppR = await request.post('http://localhost:8000/api/persona/', {
    headers: auth(),
    data: { tipo_documento: tipoDocId, nro_documento: `SS-PRES-${TS}`, razon_social: 'Dra. Ana González' },
  })
  const prestPersonaId = (await ppR.json()).id

  const prrR = await request.post('http://localhost:8000/api/personarrhh/', {
    headers: auth(),
    data: { persona: prestPersonaId, cargo: 'medico', tipo_contrato: 'dependencia' },
  })
  prestadorId = (await prrR.json()).id

  const cR = await request.post('http://localhost:8000/api/consultorio/', {
    headers: auth(),
    data: { nro_consultorio: `SS-C-${TS}` },
  })
  consultorioId = (await cR.json()).id

  const dsR  = await request.get('http://localhost:8000/api/diasemana/', { headers: auth() })
  const dias = await dsR.json()
  const diaId = (Array.isArray(dias) ? dias : dias.results).find(d => d.id === 1)?.id ?? 1

  const hR = await request.post('http://localhost:8000/api/horario-prestador/', {
    headers: auth(),
    data: { persona_rrhh: prestadorId, consultorio: consultorioId, dia_semana: diaId, hora_desde: '09:00', hora_hasta: '13:00', intervalo: 30 },
  })
  horarioId = (await hR.json()).id

  // Paciente CON email (para screenshot de confirmación inline)
  const pp1R = await request.post('http://localhost:8000/api/persona/', {
    headers: auth(),
    data: { tipo_documento: tipoDocId, nro_documento: `SS-PAC1-${TS}`, razon_social: 'María García López', correo_electronico: 'maria.garcia@example.com' },
  })
  const pacPersonaId = (await pp1R.json()).id
  const pac1R = await request.post('http://localhost:8000/api/paciente/', {
    headers: auth(),
    data: { persona: pacPersonaId, sexo: 'F' },
  })
  pacienteId = (await pac1R.json()).id

  // Paciente SIN email (para screenshot de modal manual)
  const pp2R = await request.post('http://localhost:8000/api/persona/', {
    headers: auth(),
    data: { tipo_documento: tipoDocId, nro_documento: `SS-PAC2-${TS}`, razon_social: 'Carlos Rodríguez Vera' },
  })
  const pacPersona2Id = (await pp2R.json()).id
  const pac2R = await request.post('http://localhost:8000/api/paciente/', {
    headers: auth(),
    data: { persona: pacPersona2Id, sexo: 'M' },
  })
  pacSinEmailId = (await pac2R.json()).id

  // Agenda y consulta para paciente con email
  const ag1R = await request.post('http://localhost:8000/api/agenda/', {
    headers: auth(),
    data: { horario_prestador: horarioId, fecha: '2099-06-02', hora_desde: '09:00', hora_hasta: '09:30', estado: 'disponible' },
  })
  agendaId = (await ag1R.json()).id
  await request.patch(`http://localhost:8000/api/agenda/${agendaId}/asignar/`, {
    headers: auth(), data: { paciente_id: pacienteId },
  })
  const con1R = await request.post('http://localhost:8000/api/consultas/', {
    headers: auth(), data: { agenda: agendaId, estado: 'finalizada' },
  })
  consultaId = (await con1R.json()).id
  const hoy = new Date(); hoy.setDate(hoy.getDate() + 5)
  await request.patch(`http://localhost:8000/api/consultas/${consultaId}/`, {
    headers: auth(),
    data: {
      proxima_cita: hoy.toISOString().split('T')[0],
      diagnostico: 'Control periódico — sin hallazgos relevantes',
      indicaciones: 'Mantener dieta balanceada y actividad física moderada.',
    },
  })

  // Agenda y consulta para paciente sin email
  const ag2R = await request.post('http://localhost:8000/api/agenda/', {
    headers: auth(),
    data: { horario_prestador: horarioId, fecha: '2099-06-03', hora_desde: '09:30', hora_hasta: '10:00', estado: 'disponible' },
  })
  agenda2Id = (await ag2R.json()).id
  await request.patch(`http://localhost:8000/api/agenda/${agenda2Id}/asignar/`, {
    headers: auth(), data: { paciente_id: pacSinEmailId },
  })
  const con2R = await request.post('http://localhost:8000/api/consultas/', {
    headers: auth(), data: { agenda: agenda2Id, estado: 'finalizada' },
  })
  consulta2Id = (await con2R.json()).id
  const hoy2 = new Date(); hoy2.setDate(hoy2.getDate() + 12)
  await request.patch(`http://localhost:8000/api/consultas/${consulta2Id}/`, {
    headers: auth(), data: { proxima_cita: hoy2.toISOString().split('T')[0] },
  })
})

test.afterAll(async ({ request }) => {
  for (const id of [consultaId, consulta2Id].filter(Boolean)) {
    await request.delete(`http://localhost:8000/api/consultas/${id}/`, { headers: auth() })
  }
  for (const id of [agendaId, agenda2Id].filter(Boolean)) {
    await request.delete(`http://localhost:8000/api/agenda/${id}/`, { headers: auth() })
  }
  for (const id of [pacienteId, pacSinEmailId].filter(Boolean)) {
    await request.delete(`http://localhost:8000/api/paciente/${id}/`, { headers: auth() })
  }
  if (horarioId)    await request.delete(`http://localhost:8000/api/horario-prestador/${horarioId}/`, { headers: auth() })
  if (consultorioId) await request.delete(`http://localhost:8000/api/consultorio/${consultorioId}/`, { headers: auth() })
  if (prestadorId)  await request.delete(`http://localhost:8000/api/personarrhh/${prestadorId}/`, { headers: auth() })
})

// ─── 01 Listado principal ─────────────────────────────────────────────────────
test('01 - listado principal', async ({ page }) => {
  await irARecordatorios(page)
  await page.screenshot({ path: `${OUT}/01_listado.png` })
})

// ─── 02 Búsqueda activa ───────────────────────────────────────────────────────
test('02 - busqueda activa', async ({ page }) => {
  await irARecordatorios(page)
  await page.fill('.rec-filtro-input', 'García')
  await page.waitForTimeout(400)
  await expect(page.locator('.rec-tabla tbody').getByText('María García López')).toBeVisible({ timeout: 6000 })
  await page.screenshot({ path: `${OUT}/02_busqueda.png` })
})

// ─── 03 Panel de detalle ──────────────────────────────────────────────────────
test('03 - panel detalle', async ({ page }) => {
  await irARecordatorios(page)
  const fila = page.locator('.rec-tr', { hasText: 'María García López' })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.click()
  await expect(page.locator('.rec-panel')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/03_panel_detalle.png` })
})

// ─── 04 Confirmación inline de envío (paciente con email) ────────────────────
test('04 - confirmacion inline envio email', async ({ page }) => {
  await irARecordatorios(page)
  const fila = page.locator('.rec-tr', { hasText: 'María García López' })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.click()
  await expect(page.locator('.rec-panel')).toBeVisible({ timeout: 4000 })
  await page.locator('.rec-btn-notif', { hasText: 'Recordatorio de cita' }).click()
  await expect(page.locator('.rec-btn-confirm-directo')).toBeVisible({ timeout: 3000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/04_panel_crear.png` })
  // Cancelar para no enviar
  await page.locator('.rec-btn-confirm-no').click()
})

// ─── 05 Modal de notificación manual (paciente sin email) ────────────────────
test('05 - modal notificacion manual', async ({ page }) => {
  await irARecordatorios(page)
  const fila = page.locator('.rec-tr', { hasText: 'Carlos Rodríguez Vera' })
  await expect(fila).toBeVisible({ timeout: 6000 })
  await fila.click()
  await expect(page.locator('.rec-panel')).toBeVisible({ timeout: 4000 })
  await page.locator('.rec-btn-notif', { hasText: 'Recordatorio de cita' }).click()
  await expect(page.locator('.rec-modal')).toBeVisible({ timeout: 3000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/05_panel_crear_completo.png` })
  await page.locator('.rec-modal-close').click()
})

// ─── 06 Configuración — editor WYSIWYG de plantilla ──────────────────────────
test('06 - config editor wysiwyg', async ({ page }) => {
  await irAConfig(page)
  // Expandir la plantilla de Recordatorio de cita
  await page.locator('.rec-cfg-card-titulo', { hasText: 'Plantillas' }).scrollIntoViewIfNeeded()
  await page.locator('.rec-cfg-plantilla-header', { hasText: 'Recordatorio de cita' }).click()
  await expect(page.locator('.wysiwyg-wrap')).toBeVisible({ timeout: 6000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/06_panel_editar.png` })
  // Contraer
  await page.locator('.rec-cfg-plantilla-header', { hasText: 'Recordatorio de cita' }).click()
})

// ─── 07 Configuración — tarjetas de config con datos ─────────────────────────
test('07 - config tarjetas remitente y envio', async ({ page }) => {
  await irAConfig(page)
  await page.screenshot({ path: `${OUT}/07_confirm_eliminar.png` })
})

// ─── 08 Vista previa de plantilla ─────────────────────────────────────────────
test('08 - plantilla vista previa', async ({ page }) => {
  await irAConfig(page)
  await page.locator('.rec-cfg-card-titulo', { hasText: 'Plantillas' }).scrollIntoViewIfNeeded()
  await page.locator('.rec-cfg-plantilla-header', { hasText: 'Recordatorio de cita' }).click()
  await expect(page.locator('.wysiwyg-wrap')).toBeVisible({ timeout: 6000 })
  // Activar vista previa
  await page.locator('.rec-cfg-preview-btn').click()
  await expect(page.locator('.rec-cfg-preview')).toBeVisible({ timeout: 3000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/08_navigation_guard.png` })
})
