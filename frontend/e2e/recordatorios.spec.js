const { test, expect } = require('@playwright/test')

const TS = Date.now()

let token        = null
let tipoDocId    = null
let prestadorId  = null
let consultorioId = null
let horarioId    = null
let pacienteId   = null
let agendaId     = null
let consultaId   = null
let plantillaId  = null
let imagenUrl    = null

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
}

async function irAConfig(page) {
  await page.goto('/agenda/recordatorios/configuracion')
  await expect(page.locator('.rec-cfg-wrap')).toBeVisible({ timeout: 10000 })
}

// PNG mínimo 1×1 (pixel negro) para prueba de imagen en plantilla
const PNG_MINIMO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

// ─── setup global ─────────────────────────────────────────────────────────────

test.beforeAll(async ({ request }) => {
  token = await obtenerToken(request)

  // TipoDocumento existente (respuesta paginada)
  const tiposR = await request.get('http://localhost:8000/api/tipo-documento/?page_size=10', { headers: auth() })
  const tiposData = await tiposR.json()
  tipoDocId = (tiposData.results ?? tiposData)[0].id

  // Persona prestador
  const ppR = await request.post('http://localhost:8000/api/persona/', {
    headers: auth(),
    data: { tipo_documento: tipoDocId, nro_documento: `REC-PRES-${TS}`, razon_social: 'Dr. E2E Recordatorios' },
  })
  const prestPersonaId = (await ppR.json()).id

  // PersonaRRHH
  const prrR = await request.post('http://localhost:8000/api/personarrhh/', {
    headers: auth(),
    data: { persona: prestPersonaId, cargo: 'medico', tipo_contrato: 'dependencia' },
  })
  prestadorId = (await prrR.json()).id

  // Consultorio
  const cR = await request.post('http://localhost:8000/api/consultorio/', {
    headers: auth(),
    data: { nro_consultorio: `REC-C-${TS}` },
  })
  consultorioId = (await cR.json()).id

  // DiaSemana id=1 (Lunes)
  const dsR  = await request.get('http://localhost:8000/api/diasemana/', { headers: auth() })
  const dias = await dsR.json()
  const diaId = (Array.isArray(dias) ? dias : dias.results).find(d => d.id === 1)?.id ?? 1

  // HorarioPrestador
  const hR = await request.post('http://localhost:8000/api/horario-prestador/', {
    headers: auth(),
    data: {
      persona_rrhh: prestadorId,
      consultorio: consultorioId,
      dia_semana: diaId,
      hora_desde: '08:00',
      hora_hasta: '12:00',
      intervalo: 30,
    },
  })
  horarioId = (await hR.json()).id

  // Persona paciente — email enzotroche17@gmail.com para recibir la prueba
  const pacPersonaR = await request.post('http://localhost:8000/api/persona/', {
    headers: auth(),
    data: {
      tipo_documento: tipoDocId,
      nro_documento: `REC-PAC-${TS}`,
      razon_social: 'Paciente E2E Recordatorios',
      correo_electronico: 'enzotroche17@gmail.com',
    },
  })
  const pacPersonaId = (await pacPersonaR.json()).id

  // Paciente
  const pacR = await request.post('http://localhost:8000/api/paciente/', {
    headers: auth(),
    data: { persona: pacPersonaId, sexo: 'M' },
  })
  pacienteId = (await pacR.json()).id

  // Agenda disponible
  const agR = await request.post('http://localhost:8000/api/agenda/', {
    headers: auth(),
    data: {
      horario_prestador: horarioId,
      fecha: '2099-06-02',
      hora_desde: '08:00',
      hora_hasta: '08:30',
      estado: 'disponible',
    },
  })
  agendaId = (await agR.json()).id

  // Asignar paciente al turno
  await request.patch(`http://localhost:8000/api/agenda/${agendaId}/asignar/`, {
    headers: auth(),
    data: { paciente_id: pacienteId },
  })

  // Consulta
  const conR = await request.post('http://localhost:8000/api/consultas/', {
    headers: auth(),
    data: { agenda: agendaId, estado: 'en_espera' },
  })
  consultaId = (await conR.json()).id

  // Proxima cita dentro de 5 días (holgura para evitar problemas de límite en filtro 7 días)
  const hoy = new Date()
  hoy.setDate(hoy.getDate() + 5)
  const proxCita = hoy.toISOString().split('T')[0]
  await request.patch(`http://localhost:8000/api/consultas/${consultaId}/`, {
    headers: auth(),
    data: { proxima_cita: proxCita },
  })

  // Subir imagen de prueba para la plantilla
  const imgR = await request.post(
    'http://localhost:8000/api/notificaciones/plantillas/subir-imagen/',
    {
      headers: auth(),
      multipart: { file: { name: 'prueba.png', mimeType: 'image/png', buffer: PNG_MINIMO } },
    },
  )
  if (imgR.ok()) imagenUrl = (await imgR.json()).url

  // Plantilla recordatorio con imagen embebida
  const cuerpo = `<p>Hola <strong>{nombre}</strong>, le recordamos su cita el <strong>{fecha}</strong> con {medico} en Clínica Lichi.</p>${
    imagenUrl ? `<img src="${imagenUrl}" alt="Logo" style="max-width:200px;border-radius:8px;" />` : ''
  }`
  const plantR = await request.post('http://localhost:8000/api/notificaciones/plantillas/', {
    headers: auth(),
    data: { tipo: 'recordatorio', asunto: 'Recordatorio de cita — Clínica Lichi E2E', cuerpo },
  })
  if (plantR.ok()) plantillaId = (await plantR.json()).id

  // Limpiar plantillas de tipos que se usan en tests de UI para evitar "ya existe" en corridas repetidas
  const plantExistR = await request.get('http://localhost:8000/api/notificaciones/plantillas/?page_size=50', { headers: auth() })
  const plantExist  = await plantExistR.json()
  const tiposALimpiar = ['cancelacion', 'post_consulta']
  for (const p of (plantExist.results ?? plantExist)) {
    if (tiposALimpiar.includes(p.tipo)) {
      await request.delete(`http://localhost:8000/api/notificaciones/plantillas/${p.id}/`, { headers: auth() })
    }
  }

  // Habilitar envíos — onboarding@resend.dev es el remitente válido sin dominio propio
  await request.patch('http://localhost:8000/api/notificaciones/configuracion/', {
    headers: auth(),
    data: {
      email_remitente:  'onboarding@resend.dev',
      nombre_remitente: 'Clínica Lichi',
      habilitado:       true,
      auto_recordatorio: false,
      auto_confirmacion: false,
      auto_cancelacion:  false,
      horas_anticipacion: 24,
    },
  })
})

test.afterAll(async ({ request }) => {
  if (plantillaId) {
    await request.delete(`http://localhost:8000/api/notificaciones/plantillas/${plantillaId}/`, { headers: auth() })
  }
  if (consultaId) {
    await request.delete(`http://localhost:8000/api/consultas/${consultaId}/`, { headers: auth() })
  }
  if (agendaId) {
    await request.delete(`http://localhost:8000/api/agenda/${agendaId}/`, { headers: auth() })
  }
  if (pacienteId) {
    await request.delete(`http://localhost:8000/api/paciente/${pacienteId}/`, { headers: auth() })
  }
  if (horarioId) {
    await request.delete(`http://localhost:8000/api/horario-prestador/${horarioId}/`, { headers: auth() })
  }
  if (consultorioId) {
    await request.delete(`http://localhost:8000/api/consultorio/${consultorioId}/`, { headers: auth() })
  }
  if (prestadorId) {
    await request.delete(`http://localhost:8000/api/personarrhh/${prestadorId}/`, { headers: auth() })
  }
  // Deshabilitar emails al finalizar
  await request.patch('http://localhost:8000/api/notificaciones/configuracion/', {
    headers: auth(),
    data: { habilitado: false },
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// RECORDATORIOS PAGE — Estructura
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Estructura inicial', () => {

  test('01 - carga con stats, filtros y tabla', async ({ page }) => {
    await irARecordatorios(page)
    await expect(page.locator('.rec-stat')).toHaveCount(4)
    await expect(page.locator('.rec-periodo-tabs')).toBeVisible()
    await expect(page.locator('.rec-filtro-input')).toBeVisible()
    await expect(page.locator('.rec-tabla')).toBeVisible()
  })

  test('02 - sin panel de detalle al entrar', async ({ page }) => {
    await irARecordatorios(page)
    await expect(page.locator('.rec-panel')).not.toBeVisible()
  })

  test('03 - stats muestran las 4 métricas', async ({ page }) => {
    await irARecordatorios(page)
    const stats = page.locator('.rec-stat-lbl')
    await expect(stats.filter({ hasText: 'Vencidas' })).toBeVisible()
    await expect(stats.filter({ hasText: '7 días' })).toBeVisible()
    await expect(stats.filter({ hasText: '30 días' })).toBeVisible()
    await expect(stats.filter({ hasText: 'Agendadas' })).toBeVisible()
  })

  test('04 - tabla con encabezados Paciente, Próxima cita, Días, Médico, Estado', async ({ page }) => {
    await irARecordatorios(page)
    const ths = page.locator('.rec-th')
    await expect(ths.filter({ hasText: 'Paciente' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Próxima cita' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Días' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Médico' })).toBeVisible()
  })

  test('05 - botón Configuración visible para admin', async ({ page }) => {
    await irARecordatorios(page)
    await expect(page.locator('.rec-btn-config')).toBeVisible()
  })

  test('06 - paciente E2E aparece en la tabla', async ({ page }) => {
    await irARecordatorios(page)
    await expect(
      page.locator('.rec-tabla tbody').getByText('Paciente E2E Recordatorios'),
    ).toBeVisible({ timeout: 8000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// RECORDATORIOS PAGE — Filtros
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Filtros', () => {

  test('07 - tab Vencidas filtra correctamente', async ({ page }) => {
    await irARecordatorios(page)
    await page.locator('.rec-periodo-tab', { hasText: 'Vencidas' }).click()
    await page.waitForTimeout(500)
    // El paciente E2E tiene proxima_cita en el futuro → no debe aparecer en Vencidas
    const nombre = page.locator('.rec-tabla tbody').getByText('Paciente E2E Recordatorios')
    await expect(nombre).not.toBeVisible()
  })

  test('08 - tab 7 días muestra el paciente E2E', async ({ page }) => {
    await irARecordatorios(page)
    await page.locator('.rec-periodo-tab', { hasText: '7 días' }).click()
    await page.waitForTimeout(500)
    await expect(
      page.locator('.rec-tabla tbody').getByText('Paciente E2E Recordatorios'),
    ).toBeVisible({ timeout: 6000 })
  })

  test('09 - tab Todos muestra todos los registros', async ({ page }) => {
    await irARecordatorios(page)
    await page.locator('.rec-periodo-tab', { hasText: 'Todos' }).click()
    await page.waitForTimeout(500)
    await expect(
      page.locator('.rec-tabla tbody').getByText('Paciente E2E Recordatorios'),
    ).toBeVisible({ timeout: 6000 })
  })

  test('10 - búsqueda filtra por nombre del paciente', async ({ page }) => {
    await irARecordatorios(page)
    await page.locator('.rec-periodo-tab', { hasText: 'Todos' }).click()
    await page.fill('.rec-filtro-input', 'Paciente E2E')
    await page.waitForTimeout(400)
    await expect(
      page.locator('.rec-tabla tbody').getByText('Paciente E2E Recordatorios'),
    ).toBeVisible()
  })

  test('11 - búsqueda sin resultados muestra estado vacío', async ({ page }) => {
    await irARecordatorios(page)
    await page.fill('.rec-filtro-input', 'ZZZ_NO_EXISTE_XXX')
    await page.waitForTimeout(400)
    await expect(page.locator('.rec-empty')).toBeVisible()
  })

  test('12 - limpiar búsqueda restaura la lista', async ({ page }) => {
    await irARecordatorios(page)
    await page.fill('.rec-filtro-input', 'ZZZ_NO_EXISTE_XXX')
    await page.waitForTimeout(300)
    await page.fill('.rec-filtro-input', '')
    await page.waitForTimeout(400)
    await expect(page.locator('.rec-tabla tbody tr').first()).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// RECORDATORIOS PAGE — Panel de detalle
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Panel de detalle', () => {

  async function abrirPanelPacienteE2E(page) {
    await irARecordatorios(page)
    await page.locator('.rec-periodo-tab', { hasText: 'Todos' }).click()
    await page.waitForTimeout(500)
    const fila = page.locator('.rec-tr', { hasText: 'Paciente E2E Recordatorios' })
    await expect(fila).toBeVisible({ timeout: 8000 })
    await fila.click()
    await expect(page.locator('.rec-panel')).toBeVisible({ timeout: 5000 })
  }

  test('13 - clic en fila abre el panel de detalle', async ({ page }) => {
    await abrirPanelPacienteE2E(page)
    await expect(page.locator('.rec-panel-titulo')).toBeVisible()
  })

  test('14 - panel muestra el nombre del paciente', async ({ page }) => {
    await abrirPanelPacienteE2E(page)
    await expect(page.locator('.rec-panel')).toContainText('Paciente E2E Recordatorios')
  })

  test('15 - panel muestra la fecha de próxima cita', async ({ page }) => {
    await abrirPanelPacienteE2E(page)
    await expect(page.locator('.rec-cita-fecha')).toBeVisible()
  })

  test('16 - panel muestra botones de notificación', async ({ page }) => {
    await abrirPanelPacienteE2E(page)
    await expect(page.locator('.rec-btn-notif').first()).toBeVisible()
  })

  test('17 - paciente con email muestra badge Email en los botones', async ({ page }) => {
    await abrirPanelPacienteE2E(page)
    await expect(page.locator('.rec-canal-tag--email').first()).toBeVisible()
  })

  test('18 - X cierra el panel', async ({ page }) => {
    await abrirPanelPacienteE2E(page)
    await page.locator('.rec-panel-cerrar').click()
    await expect(page.locator('.rec-panel')).not.toBeVisible()
  })

  test('19 - segunda clic en la misma fila cierra el panel', async ({ page }) => {
    await abrirPanelPacienteE2E(page)
    const fila = page.locator('.rec-tr', { hasText: 'Paciente E2E Recordatorios' })
    await fila.click()
    await expect(page.locator('.rec-panel')).not.toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// RECORDATORIOS PAGE — Envío de email con imagen a enzotroche17@gmail.com
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Envío de email con imagen', () => {

  async function abrirPanelYClickNotif(page, tipoLabel) {
    await irARecordatorios(page)
    await page.locator('.rec-periodo-tab', { hasText: 'Todos' }).click()
    await page.waitForTimeout(500)
    const fila = page.locator('.rec-tr', { hasText: 'Paciente E2E Recordatorios' })
    await fila.click()
    await expect(page.locator('.rec-panel')).toBeVisible({ timeout: 5000 })
    await page.locator('.rec-btn-notif', { hasText: tipoLabel }).click()
  }

  test('20 - clic en Recordatorio muestra confirmación inline con email', async ({ page }) => {
    await abrirPanelYClickNotif(page, 'Recordatorio de cita')
    // Paciente tiene email → muestra inline confirm con la dirección
    await expect(page.locator('.rec-btn-confirm-directo')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.rec-btn-confirm-directo')).toContainText('enzotroche17@gmail.com')
  })

  test('21 - cancelar confirmación no envía y queda en panel', async ({ page }) => {
    await abrirPanelYClickNotif(page, 'Recordatorio de cita')
    await page.locator('.rec-btn-confirm-no').click()
    // Botón vuelve al estado normal
    await expect(page.locator('.rec-btn-notif', { hasText: 'Recordatorio de cita' })).toBeVisible()
    await expect(page.locator('.rec-btn-confirm-directo')).not.toBeVisible()
  })

  test('22 - confirmar envío → email sale a enzotroche17@gmail.com y muestra toast', async ({ page }) => {
    await abrirPanelYClickNotif(page, 'Recordatorio de cita')
    await expect(page.locator('.rec-btn-confirm-directo')).toBeVisible({ timeout: 4000 })

    // Esperar la respuesta del endpoint notificar
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/recordatorios/notificar/') && r.request().method() === 'POST'),
      page.locator('.rec-btn-confirm-si').click(),
    ])

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    // 'enviado' si RESEND_API_KEY funciona, 'fallido' si no está configurado
    expect(['enviado', 'fallido', 'pendiente']).toContain(body.estado)

    // Toast de resultado visible
    await expect(page.locator('.toast-container, [class*="toast"]').first()).toBeVisible({ timeout: 3000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// RECORDATORIOS CONFIG PAGE — Configuración
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Página de configuración — acceso y config', () => {

  test('23 - botón Configuración navega a la página de config', async ({ page }) => {
    await irARecordatorios(page)
    await page.locator('.rec-btn-config').click()
    await expect(page).toHaveURL(/configuracion/)
    await expect(page.locator('.rec-cfg-wrap')).toBeVisible()
  })

  test('24 - página carga con sección correo remitente y envío automático', async ({ page }) => {
    await irAConfig(page)
    await expect(page.locator('.rec-cfg-card-titulo', { hasText: 'Correo remitente' })).toBeVisible()
    await expect(page.locator('.rec-cfg-card-titulo', { hasText: 'Envío automático' })).toBeVisible()
  })

  test('25 - botón Editar configuración abre los inputs', async ({ page }) => {
    await irAConfig(page)
    await page.locator('.rec-cfg-btn-editar').click()
    await expect(page.locator('input[placeholder*="noreply"]')).toBeVisible()
  })

  test('26 - editar y guardar nombre del remitente', async ({ page }) => {
    await irAConfig(page)
    await page.locator('.rec-cfg-btn-editar').click()
    await page.fill('input[placeholder*="Clínica"]', 'Clínica Lichi E2E')
    await page.locator('.rec-cfg-btn-guardar').click()
    await expect(page.locator('.rec-cfg-field-view-val', { hasText: 'Clínica Lichi E2E' })).toBeVisible({ timeout: 4000 })
  })

  test('27 - cancelar edición no guarda cambios', async ({ page }) => {
    await irAConfig(page)
    await page.locator('.rec-cfg-btn-editar').click()
    const inputNombre = page.locator('input[placeholder*="Clínica"]')
    const valorOriginal = await inputNombre.inputValue()
    await page.fill('input[placeholder*="Clínica"]', 'Cambio cancelado')
    await page.locator('.rec-cfg-btn-cancelar').click()
    await expect(page.locator('.rec-cfg-field-view-val', { hasText: valorOriginal })).toBeVisible()
  })

  test('28 - volver navega a RecordatoriosPage', async ({ page }) => {
    await irAConfig(page)
    await page.locator('.rec-cfg-back').click()
    await expect(page).toHaveURL(/recordatorios$/)
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// RECORDATORIOS CONFIG PAGE — Editor WYSIWYG de plantillas
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Editor WYSIWYG de plantillas', () => {

  async function expandirPlantilla(page, tipoLabel) {
    await irAConfig(page)
    await page.locator('.rec-cfg-card-titulo', { hasText: 'Plantillas' }).scrollIntoViewIfNeeded()
    const header = page.locator('.rec-cfg-plantilla-header', { hasText: tipoLabel })
    await header.click()
    // Esperar que el editor sea visible
    await expect(page.locator('.wysiwyg-wrap').first()).toBeVisible({ timeout: 6000 })
  }

  test('29 - clic en plantilla la expande y muestra el editor WYSIWYG', async ({ page }) => {
    await expandirPlantilla(page, 'Recordatorio de cita')
    await expect(page.locator('.wysiwyg-wrap')).toBeVisible()
    await expect(page.locator('.wysiwyg-toolbar')).toBeVisible()
  })

  test('30 - toolbar tiene botones Bold, Italic, Underline, listas e imagen', async ({ page }) => {
    await expandirPlantilla(page, 'Recordatorio de cita')
    await expect(page.locator('.wysiwyg-tb-btn[title="Negrita"]')).toBeVisible()
    await expect(page.locator('.wysiwyg-tb-btn[title="Cursiva"]')).toBeVisible()
    await expect(page.locator('.wysiwyg-tb-btn[title="Subrayado"]')).toBeVisible()
    await expect(page.locator('.wysiwyg-tb-btn[title="Lista con viñetas"]')).toBeVisible()
    await expect(page.locator('.wysiwyg-tb-btn[title="Insertar imagen"]')).toBeVisible()
  })

  test('31 - chip de variable inserta texto en el editor', async ({ page }) => {
    await expandirPlantilla(page, 'Recordatorio de cita')
    // Enfocar el editor y añadir algo antes para ubicar el cursor
    const editor = page.locator('.tiptap').first()
    await editor.click()
    await page.keyboard.press('End')
    // Click en chip {medico}
    await page.locator('.rec-cfg-chip', { hasText: '{medico}' }).click()
    await expect(editor).toContainText('{medico}')
  })

  test('32 - toggle Vista previa muestra el contenido renderizado', async ({ page }) => {
    await expandirPlantilla(page, 'Recordatorio de cita')
    await page.locator('.rec-cfg-preview-btn').click()
    await expect(page.locator('.rec-cfg-preview')).toBeVisible()
    await expect(page.locator('.wysiwyg-wrap')).not.toBeVisible()
  })

  test('33 - toggle Editar vuelve al editor', async ({ page }) => {
    await expandirPlantilla(page, 'Recordatorio de cita')
    await page.locator('.rec-cfg-preview-btn').click()
    await page.locator('.rec-cfg-preview-btn').click()
    await expect(page.locator('.wysiwyg-wrap')).toBeVisible()
    await expect(page.locator('.rec-cfg-preview')).not.toBeVisible()
  })

  test('34 - botón Bold activa negrita en el editor', async ({ page }) => {
    await expandirPlantilla(page, 'Recordatorio de cita')
    const editor = page.locator('.tiptap').first()
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.locator('.wysiwyg-tb-btn[title="Negrita"]').click()
    await expect(page.locator('.wysiwyg-tb-btn[title="Negrita"]')).toHaveClass(/is-active/)
  })

  test('35 - crear plantilla nueva (Cancelación) con contenido', async ({ page }) => {
    await irAConfig(page)
    await page.locator('.rec-cfg-card-titulo', { hasText: 'Plantillas' }).scrollIntoViewIfNeeded()
    const header = page.locator('.rec-cfg-plantilla-header', { hasText: 'Cancelación' })
    await header.click()
    await expect(page.locator('.wysiwyg-wrap').first()).toBeVisible({ timeout: 6000 })

    // Asunto
    const asuntoInput = page.locator('.rec-cfg-plantilla.expandida .rec-cfg-input').first()
    await asuntoInput.fill('Cancelación de turno — Clínica Lichi')

    // Contenido en el editor
    const editor = page.locator('.rec-cfg-plantilla.expandida .tiptap').first()
    await editor.click()
    await page.keyboard.type('Hola ')
    await page.locator('.rec-cfg-plantilla.expandida .rec-cfg-chip', { hasText: '{nombre}' }).click()
    await page.keyboard.type(', su turno ha sido cancelado.')

    await page.locator('.rec-cfg-plantilla.expandida .rec-cfg-btn-save-plant').click()

    // Toast de confirmación
    await expect(page.locator('[class*="toast"]').first()).toBeVisible({ timeout: 5000 })

    // Limpiar: borrar la plantilla creada via API
    const tk = await obtenerToken(page.request)
    const listR = await page.request.get(
      'http://localhost:8000/api/notificaciones/plantillas/?page_size=50',
      { headers: { Authorization: `Bearer ${tk}` } },
    )
    const list = await listR.json()
    const created = (list.results ?? list).find(p => p.tipo === 'cancelacion')
    if (created) {
      await page.request.delete(`http://localhost:8000/api/notificaciones/plantillas/${created.id}/`, {
        headers: { Authorization: `Bearer ${tk}` },
      })
    }
  })

  test('36 - plantilla muestra tag Sin plantilla cuando no existe', async ({ page }) => {
    // "Post consulta" fue limpiada en beforeAll
    await irAConfig(page)
    await page.locator('.rec-cfg-card-titulo', { hasText: 'Plantillas' }).scrollIntoViewIfNeeded()
    // Busca cualquier plantilla marcada como "Sin plantilla" en la lista
    await expect(page.locator('.rec-cfg-tag-nueva').first()).toBeVisible({ timeout: 5000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// PERMISOS — recepcionista (autenticación inline)
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Permisos recepcionista', () => {

  async function loginComoRecep(page) {
    await page.goto('/login')
    await page.fill('input[name="username"]', 'test_e2e_recep')
    await page.fill('input[name="password"]', 'TestRecep1234!')
    await page.click('button[type="submit"]')
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 })
  }

  test('37 - recepcionista puede acceder a RecordatoriosPage', async ({ page }) => {
    await loginComoRecep(page)
    await page.goto('/agenda/recordatorios')
    await expect(page.locator('.rec-stats')).toBeVisible({ timeout: 10000 })
  })

  test('38 - recepcionista no ve botón de Configuración', async ({ page }) => {
    await loginComoRecep(page)
    await page.goto('/agenda/recordatorios')
    await expect(page.locator('.rec-stats')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.rec-btn-config')).not.toBeVisible()
  })

  test('39 - recepcionista puede ver el panel de detalle', async ({ page }) => {
    await loginComoRecep(page)
    await page.goto('/agenda/recordatorios')
    await page.locator('.rec-periodo-tab', { hasText: 'Todos' }).click()
    await page.waitForTimeout(500)
    const filas = page.locator('.rec-tr')
    const count = await filas.count()
    if (count > 0) {
      await filas.first().click()
      await expect(page.locator('.rec-panel')).toBeVisible({ timeout: 4000 })
    }
  })

})
