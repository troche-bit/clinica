const { test, expect } = require('@playwright/test')
const path = require('path')

const OUT = path.resolve(__dirname, '../../docs/imagenes/agenda')
const TS  = Date.now()

const DOC_PRES = `SRAG_P${TS}`
const NOM_PRES = `Romero Acosta, Valentina`
const DOC_PAC  = `SRAGPAC${TS}`
const NOM_PAC  = `Torres Benítez, Rodrigo`

// Próximo lunes al menos 14 días desde hoy
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

let prestId   = null
let pacId     = null
let horarioId = null
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

async function apiDelete(request, url, tk) {
  await request.delete(url, { headers: { Authorization: `Bearer ${tk}` } })
}

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeAll(async ({ request }) => {
  token     = await obtenerToken(request)
  const pId = await crearPersona(request, DOC_PRES, NOM_PRES, token)
  const rp  = await request.post('http://localhost:8000/api/personarrhh/', {
    data: { persona: pId, cargo: 'medico', tipo_contrato: 'dependencia' },
    headers: { Authorization: `Bearer ${token}` },
  })
  prestId   = (await rp.json()).id

  const rh  = await request.post('http://localhost:8000/api/horario-prestador/', {
    data: { persona_rrhh: prestId, dia_semana: 1, hora_desde: '08:00', hora_hasta: '11:00', intervalo: 30 },
    headers: { Authorization: `Bearer ${token}` },
  })
  horarioId = (await rh.json()).id

  // Generar turnos para FECHA_TURNO
  await request.post(`http://localhost:8000/api/horario-prestador/${horarioId}/generar/`, {
    data: { fecha_desde: FECHA_TURNO, fecha_hasta: FECHA_TURNO },
    headers: { Authorization: `Bearer ${token}` },
  })

  // Crear paciente para búsqueda
  const pPacId = await crearPersona(request, DOC_PAC, NOM_PAC, token)
  const rpac   = await request.post('http://localhost:8000/api/paciente/', {
    data: { persona: pPacId, sexo: 'M' },
    headers: { Authorization: `Bearer ${token}` },
  })
  pacId = (await rpac.json()).id
})

test.afterAll(async ({ request }) => {
  const tk = token || (await obtenerToken(request))
  const r  = await request.get(
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

// ─── helpers de navegación ───────────────────────────────────────────────────

async function irAAgenda(page) {
  await page.goto('/agenda/citas')
  await expect(page.locator('.ag-cal-card')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(1000)
}

async function seleccionarMedico(page) {
  const buscador = page.locator('.ag-search-input')
  if (await buscador.isVisible()) {
    await buscador.fill(NOM_PRES.slice(0, 16))
    await page.waitForTimeout(600)
  }
  const item = page.locator('.ag-medico-item', { hasText: NOM_PRES })
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
      await page.waitForTimeout(600)
      return
    }
  }
}

async function irAlDiaConTurnos(page) {
  await seleccionarMedico(page)
  await navegarAMes(page, anioT, mesT)
  await clickDia(page, diaT)
  await expect(page.locator('.ag-turno').first()).toBeVisible({ timeout: 8000 })
}

// ══════════════════════════════════════════════════════════════════════════════
// 01 — Calendario global (sin médico seleccionado)
// ══════════════════════════════════════════════════════════════════════════════
test('01 - calendario global', async ({ page }) => {
  await irAAgenda(page)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/01_calendario.png` })
})

// ══════════════════════════════════════════════════════════════════════════════
// 02 — Médico seleccionado — calendario con turnos
// ══════════════════════════════════════════════════════════════════════════════
test('02 - medico seleccionado con turnos en calendario', async ({ page }) => {
  await irAAgenda(page)
  await seleccionarMedico(page)
  await navegarAMes(page, anioT, mesT)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/02_medico_seleccionado.png` })
})

// ══════════════════════════════════════════════════════════════════════════════
// 03 — Panel de turnos del día
// ══════════════════════════════════════════════════════════════════════════════
test('03 - panel de turnos del dia', async ({ page }) => {
  await irAAgenda(page)
  await irAlDiaConTurnos(page)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/03_panel_dia.png` })
})

// ══════════════════════════════════════════════════════════════════════════════
// 04 — Turno disponible expandido — sección asignar
// ══════════════════════════════════════════════════════════════════════════════
test('04 - turno disponible expandido asignar', async ({ page }) => {
  await irAAgenda(page)
  await irAlDiaConTurnos(page)
  await page.locator('.ag-turno').first().locator('.ag-turno-head').click()
  await expect(page.locator('.ag-asignar')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/04_turno_asignar.png` })
})

// ══════════════════════════════════════════════════════════════════════════════
// 05 — Paciente buscado y seleccionado — Confirmar habilitado
// ══════════════════════════════════════════════════════════════════════════════
test('05 - paciente seleccionado confirmar habilitado', async ({ page }) => {
  await irAAgenda(page)
  await irAlDiaConTurnos(page)
  await page.locator('.ag-turno').first().locator('.ag-turno-head').click()
  await expect(page.locator('.ag-pac-input')).toBeVisible()
  await page.locator('.ag-pac-input').fill(DOC_PAC.slice(0, 6))
  await page.waitForTimeout(700)
  await expect(page.locator('.ag-pac-item').first()).toBeVisible({ timeout: 6000 })
  await page.locator('.ag-pac-item').first().click()
  await expect(page.locator('.ag-pac-sel')).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/05_asignar_completo.png` })
})

// ══════════════════════════════════════════════════════════════════════════════
// 06 — Chips de cambio de estado visibles
// ══════════════════════════════════════════════════════════════════════════════
test('06 - chips de cambio de estado', async ({ page }) => {
  await irAAgenda(page)
  await irAlDiaConTurnos(page)
  // Usar el segundo turno (08:30) para que el primero siga disponible
  await page.locator('.ag-turno').nth(1).locator('.ag-turno-head').click()
  await expect(page.locator('.ag-estado-actions')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/06_cambiar_estado.png` })
})

// ══════════════════════════════════════════════════════════════════════════════
// 07 — Modal Generar turnos con previsualización
// ══════════════════════════════════════════════════════════════════════════════
test('07 - modal generar turnos', async ({ page }) => {
  await irAAgenda(page)
  await seleccionarMedico(page)
  await page.locator('.ag-cal-action-gen').click()
  await expect(page.locator('.modal-box')).toBeVisible({ timeout: 4000 })

  // Calcular una semana futura sin turnos para la previsualización
  const d = new Date(FECHA_TURNO + 'T00:00:00')
  d.setDate(d.getDate() + 14)
  const fechaFut = d.toLocaleDateString('en-CA')

  const inputs = page.locator('.ag-gen-input')
  await inputs.first().fill(fechaFut)
  await inputs.nth(1).fill(fechaFut)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/07_generar_modal.png` })
})

// ══════════════════════════════════════════════════════════════════════════════
// 08 — Modal Gestionar con rango completado
// ══════════════════════════════════════════════════════════════════════════════
test('08 - modal gestionar rango', async ({ page }) => {
  await irAAgenda(page)
  await seleccionarMedico(page)
  await page.locator('.ag-cal-action-gest').click()
  await expect(page.locator('.modal-box')).toBeVisible({ timeout: 4000 })
  await expect(page.locator('.ag-gest-warn')).toBeVisible()

  // Ingresar el rango con los turnos existentes para mostrar el resumen
  const inputs = page.locator('.ag-gen-input[type="date"]')
  await inputs.first().fill(FECHA_TURNO)
  await inputs.nth(1).fill(FECHA_TURNO)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/08_gestionar_modal.png` })
})
