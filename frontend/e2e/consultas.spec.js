const { test, expect } = require('@playwright/test')

const TS       = Date.now()
const DOC_PRES = `E2ECS_P${TS}`
const NOM_PRES = `Valdivia Cáceres ${TS}`
const DOC_PAC  = `E2ECS_Q${TS}`
const NOM_PAC  = `Fernández Torres ${TS}`

const HOY = new Date().toLocaleDateString('en-CA')

// DiaSemana django: 1=Lun...7=Dom; JS .getDay(): 0=Dom...6=Sáb
const DIA_HOY = (() => { const d = new Date().getDay(); return d === 0 ? 7 : d })()

let prestId    = null
let horarioId  = null
let pacienteId = null
let agendaId   = null
let consultaId = null  // creada por el test "Iniciar consulta"
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

async function irAConsultas(page) {
  await page.goto('/consultas')
  await expect(page.locator('.cs-page')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(800)
}

async function seleccionarMedico(page, nombre) {
  const input = page.locator('.cs-medico-input')
  await expect(input).toBeVisible({ timeout: 6000 })
  await input.fill(nombre.slice(0, 20))
  await page.waitForTimeout(600)
  const opcion = page.locator('.cs-medico-option', { hasText: nombre })
  await expect(opcion).toBeVisible({ timeout: 6000 })
  await opcion.click()
  await page.waitForTimeout(500)
}

// ─── setup y limpieza ──────────────────────────────────────────────────────────

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
})

test.afterAll(async ({ request }) => {
  const tk = token || (await obtenerToken(request))
  // Consultas creadas por los tests
  if (consultaId) await apiDelete(request, `http://localhost:8000/api/consultas/${consultaId}/`, tk)
  // Buscar y limpiar otras consultas para este prestador (por si algún test creó más)
  const rc = await request.get(
    `http://localhost:8000/api/consultas/?persona_rrhh=${prestId}&page_size=50`,
    { headers: { Authorization: `Bearer ${tk}` } }
  )
  const cuerpo = await rc.json()
  for (const c of (cuerpo.results || [])) {
    await apiDelete(request, `http://localhost:8000/api/consultas/${c.id}/`, tk)
  }
  if (agendaId)  await apiDelete(request, `http://localhost:8000/api/agenda/${agendaId}/`, tk)
  if (horarioId) await apiDelete(request, `http://localhost:8000/api/horario-prestador/${horarioId}/`, tk)
  if (prestId)   await apiDelete(request, `http://localhost:8000/api/personarrhh/${prestId}/`, tk)
  if (pacienteId) await apiDelete(request, `http://localhost:8000/api/paciente/${pacienteId}/`, tk)
})

// ══════════════════════════════════════════════════════════════════════════════
// ESTRUCTURA INICIAL (admin)
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Estructura inicial — admin', () => {

  test('01 - carga con dos tabs Vista médico y Vista recepcionista', async ({ page }) => {
    await irAConsultas(page)
    await expect(page.locator('.cs-tabs')).toBeVisible()
    await expect(page.locator('.cs-tab', { hasText: 'Vista médico' })).toBeVisible()
    await expect(page.locator('.cs-tab', { hasText: 'Vista recepcionista' })).toBeVisible()
  })

  test('02 - tab Vista médico activo por defecto para admin', async ({ page }) => {
    await irAConsultas(page)
    const tabMedico = page.locator('.cs-tab', { hasText: 'Vista médico' })
    await expect(tabMedico).toHaveClass(/active/)
  })

  test('03 - clic en Vista recepcionista muestra esa vista', async ({ page }) => {
    await irAConsultas(page)
    await page.locator('.cs-tab', { hasText: 'Vista recepcionista' }).click()
    await expect(page.locator('.cs-vista-recepcionista')).toBeVisible({ timeout: 4000 })
  })

  test('04 - vista recepcionista tiene stats grid', async ({ page }) => {
    await irAConsultas(page)
    await page.locator('.cs-tab', { hasText: 'Vista recepcionista' }).click()
    await expect(page.locator('.cs-stats-grid')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.cs-stats-grid .stat-card').first()).toBeVisible()
  })

  test('05 - vista recepcionista tiene filtros y tabla', async ({ page }) => {
    await irAConsultas(page)
    await page.locator('.cs-tab', { hasText: 'Vista recepcionista' }).click()
    await expect(page.locator('.cs-filtros')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.cs-filtro-input')).toBeVisible()
    await expect(page.locator('.cs-filtro-select')).toBeVisible()
    await expect(page.locator('table')).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// VISTA RECEPCIONISTA — tabla
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Vista recepcionista — tabla', () => {

  async function irARecep(page) {
    await irAConsultas(page)
    await page.locator('.cs-tab', { hasText: 'Vista recepcionista' }).click()
    await expect(page.locator('.cs-vista-recepcionista')).toBeVisible({ timeout: 4000 })
    await page.waitForTimeout(600)
  }

  test('06 - encabezados correctos en la tabla', async ({ page }) => {
    await irARecep(page)
    const ths = page.locator('.cs-th')
    await expect(ths.first()).toBeVisible()
    const textos = await ths.allTextContents()
    expect(textos.some(t => t.includes('Paciente'))).toBe(true)
    expect(textos.some(t => t.includes('Médico'))).toBe(true)
    expect(textos.some(t => t.includes('Estado'))).toBe(true)
  })

  test('07 - turno del test aparece en la tabla', async ({ page }) => {
    await irARecep(page)
    await expect(
      page.locator('td', { hasText: NOM_PAC.split(' ')[0] }).first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('08 - filtrar por médico filtra la tabla', async ({ page }) => {
    await irARecep(page)
    await page.fill('.cs-filtro-input', NOM_PRES.slice(0, 12))
    await page.waitForTimeout(400)
    // El turno del test debe seguir visible
    await expect(
      page.locator('td', { hasText: NOM_PAC.split(' ')[0] }).first()
    ).toBeVisible({ timeout: 4000 })
    // Texto que no existe → no hay filas con ese nombre
    await page.fill('.cs-filtro-input', 'XXXMEDICO_NO_EXISTE_XXX')
    await page.waitForTimeout(400)
    await expect(page.locator('.cs-td-empty')).toBeVisible({ timeout: 4000 })
  })

  test('09 - limpiar filtro de médico restaura la tabla', async ({ page }) => {
    await irARecep(page)
    await page.fill('.cs-filtro-input', 'XXXNOEXISTE')
    await page.waitForTimeout(400)
    await expect(page.locator('.cs-td-empty')).toBeVisible()
    await page.fill('.cs-filtro-input', '')
    await page.waitForTimeout(400)
    await expect(
      page.locator('td', { hasText: NOM_PAC.split(' ')[0] }).first()
    ).toBeVisible({ timeout: 4000 })
  })

  test('10 - filtrar por estado "Pendiente" muestra turno sin consulta', async ({ page }) => {
    await irARecep(page)
    await page.selectOption('.cs-filtro-select', 'pendiente')
    await page.waitForTimeout(400)
    // El turno existe sin consulta → debe aparecer como "Pendiente"
    await expect(
      page.locator('td', { hasText: NOM_PAC.split(' ')[0] }).first()
    ).toBeVisible({ timeout: 4000 })
  })

  test('11 - admin ve selector de fecha en vista recepcionista', async ({ page }) => {
    await irARecep(page)
    await expect(page.locator('.cs-date-input')).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// VISTA MÉDICO — estructura
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Vista médico — estructura', () => {

  test('12 - sin médico seleccionado muestra estado vacío', async ({ page }) => {
    await irAConsultas(page)
    await expect(page.locator('.cs-empty-state').first()).toBeVisible()
    await expect(
      page.locator('.cs-empty-state', { hasText: /Seleccioná un médico/ })
    ).toBeVisible({ timeout: 4000 })
  })

  test('13 - admin ve selector de fecha en vista médico', async ({ page }) => {
    await irAConsultas(page)
    await expect(page.locator('.cs-date-input')).toBeVisible()
  })

  test('14 - buscador de médico acepta texto y muestra dropdown', async ({ page }) => {
    await irAConsultas(page)
    const input = page.locator('.cs-medico-input')
    await expect(input).toBeVisible()
    await input.fill(NOM_PRES.slice(0, 12))
    await page.waitForTimeout(600)
    await expect(page.locator('.cs-medico-dropdown')).toBeVisible({ timeout: 6000 })
    await expect(page.locator('.cs-medico-option').first()).toBeVisible()
  })

  test('15 - seleccionar médico muestra columna de turnos', async ({ page }) => {
    await irAConsultas(page)
    await seleccionarMedico(page, NOM_PRES)
    await expect(page.locator('.cs-col-turnos')).toBeVisible({ timeout: 6000 })
  })

  test('16 - columna de turnos muestra header con fecha "Hoy"', async ({ page }) => {
    await irAConsultas(page)
    await seleccionarMedico(page, NOM_PRES)
    await expect(page.locator('.cs-col-turnos-header')).toBeVisible()
    await expect(page.locator('.cs-col-turnos-header')).toContainText('Hoy')
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// VISTA MÉDICO — turnos del día e iniciar consulta
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Vista médico — turnos y consulta', () => {

  async function irConMedico(page) {
    await irAConsultas(page)
    await seleccionarMedico(page, NOM_PRES)
    await expect(page.locator('.cs-turno-card').first()).toBeVisible({ timeout: 8000 })
  }

  test('17 - turno card muestra hora del turno', async ({ page }) => {
    await irConMedico(page)
    await expect(page.locator('.cs-turno-hora').first()).toBeVisible()
    await expect(page.locator('.cs-turno-hora').first()).toContainText('08:00')
  })

  test('18 - turno card muestra nombre del paciente', async ({ page }) => {
    await irConMedico(page)
    await expect(page.locator('.cs-turno-pac-nombre').first()).toBeVisible()
    // Contiene al menos el primer apellido del paciente
    await expect(page.locator('.cs-turno-pac-nombre').first()).toContainText(
      NOM_PAC.split(' ')[0]
    )
  })

  test('19 - turno sin consulta muestra botón Iniciar consulta', async ({ page }) => {
    await irConMedico(page)
    await expect(page.locator('.cs-btn-iniciar').first()).toBeVisible()
    await expect(page.locator('.cs-btn-iniciar').first()).toContainText('Iniciar')
  })

  test('20 - clic Iniciar consulta abre el panel activo', async ({ page }) => {
    await irConMedico(page)
    await page.locator('.cs-btn-iniciar').first().click()
    await expect(page.locator('.cs-panel-activa')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })

    // Guardar el ID de la consulta creada para limpiarla en afterAll
    const r = await page.request.get(
      `http://localhost:8000/api/consultas/?persona_rrhh=${prestId}&page_size=5`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const body = await r.json()
    if (body.results?.length) consultaId = body.results[0].id
  })

  test('21 - panel activo muestra campos de formulario', async ({ page }) => {
    await irConMedico(page)
    // Si ya hay una consulta en curso (del test anterior), el panel estará disponible
    // Si no, iniciar una nueva
    const btnIniciar = page.locator('.cs-btn-iniciar')
    if (await btnIniciar.isVisible()) {
      await btnIniciar.click()
      await expect(page.locator('.cs-panel-activa')).toBeVisible({ timeout: 10000 })
    } else {
      // Consulta ya en curso: clic en la tarjeta
      const tarjeta = page.locator('.cs-turno-card').first()
      await tarjeta.click()
      await expect(page.locator('.cs-panel-activa')).toBeVisible({ timeout: 6000 })
    }
    await expect(page.locator('.cs-panel-activa textarea').first()).toBeVisible({ timeout: 4000 })
  })

  test('22 - panel activo muestra datos del paciente', async ({ page }) => {
    await irConMedico(page)
    const btnIniciar = page.locator('.cs-btn-iniciar')
    if (await btnIniciar.isVisible()) {
      await btnIniciar.click()
      await expect(page.locator('.cs-panel-activa')).toBeVisible({ timeout: 10000 })
    } else {
      const tarjeta = page.locator('.cs-turno-card').first()
      await tarjeta.click()
      await expect(page.locator('.cs-panel-activa')).toBeVisible({ timeout: 6000 })
    }
    // El panel debe mostrar el nombre del paciente en algún lugar
    await expect(page.locator('.cs-panel-activa')).toContainText(
      NOM_PAC.split(' ')[0],
      { timeout: 4000 }
    )
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// PERMISOS — RECEPCIONISTA
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Permisos recepcionista', () => {

  test('23 - recepcionista no ve tabs (accede directo a vista recep)', async ({ page }) => {
    await loginComoRecep(page)
    await page.goto('/consultas')
    await expect(page.locator('.cs-page')).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(600)
    await expect(page.locator('.cs-tabs')).not.toBeVisible()
    await expect(page.locator('.cs-vista-recepcionista')).toBeVisible()
  })

  test('24 - recepcionista ve stats del día', async ({ page }) => {
    await loginComoRecep(page)
    await page.goto('/consultas')
    await expect(page.locator('.cs-stats-grid')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.cs-stats-grid .stat-card').first()).toBeVisible()
  })

  test('25 - recepcionista ve tabla con encabezados', async ({ page }) => {
    await loginComoRecep(page)
    await page.goto('/consultas')
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 })
    const ths = page.locator('.cs-th')
    await expect(ths.first()).toBeVisible()
  })

  test('26 - recepcionista ve el turno del test en la tabla', async ({ page }) => {
    await loginComoRecep(page)
    await page.goto('/consultas')
    await page.waitForTimeout(1200)
    // El turno del test (estado=ocupado para hoy) debe aparecer
    await expect(
      page.locator('td', { hasText: NOM_PAC.split(' ')[0] }).first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('27 - recepcionista no ve buscador para iniciar consultas', async ({ page }) => {
    await loginComoRecep(page)
    await page.goto('/consultas')
    await page.waitForTimeout(600)
    // La vista recep no tiene el selector de médico para iniciar consultas
    await expect(page.locator('.cs-medico-input')).not.toBeVisible()
    await expect(page.locator('.cs-btn-iniciar')).not.toBeVisible()
  })

  test('28 - recepcionista no ve selector de fecha', async ({ page }) => {
    await loginComoRecep(page)
    await page.goto('/consultas')
    await page.waitForTimeout(600)
    // La vista recep para recepcionista (esAdmin=false) no muestra SelectorFecha
    await expect(page.locator('.cs-date-input')).not.toBeVisible()
  })

})
