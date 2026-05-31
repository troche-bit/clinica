const { test, expect } = require('@playwright/test')

const TS            = Date.now()
// Prestador CON horario (Lunes 08:00-12:00)
const DOC_DEMO      = `E2EHP${TS}`
const NOM_DEMO      = `Villalba Ortiz ${TS}`   // TS en nombre para unicidad entre runs
// Prestador SIN horario — para tests de editar (test 14 y 20)
const DOC_VACIO     = `E2EHPV${TS}`
const NOM_VACIO     = `E2E HP Vacio ${TS}`
// Prestador SIN horario — solo para test de generar deshabilitado (test 21)
const DOC_GEN       = `E2EHPG${TS}`
const NOM_GEN       = `E2E HP Gen ${TS}`

let prestId1   = null
let prestId2   = null
let prestId3   = null
let horarioId1 = null
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
  const tipos  = await request.get('http://localhost:8000/api/tipo-documento/', {
    headers: { Authorization: `Bearer ${tk}` },
  })
  const body   = await tipos.json()
  const tipoId = (body.results || body)[0]?.id
  const r = await request.post('http://localhost:8000/api/persona/', {
    data: { tipo_documento: tipoId, nro_documento: nro, razon_social: nombre, fecha_nacimiento: '1985-06-10' },
    headers: { Authorization: `Bearer ${tk}` },
  })
  return (await r.json()).id
}

async function crearPrestador(request, personaId, tk) {
  const r = await request.post('http://localhost:8000/api/personarrhh/', {
    data: { persona: personaId, cargo: 'medico', tipo_contrato: 'dependencia', fecha_ingreso: '2018-01-01' },
    headers: { Authorization: `Bearer ${tk}` },
  })
  return (await r.json()).id
}

async function crearHorario(request, prestadorId, tk) {
  const r = await request.post('http://localhost:8000/api/horario-prestador/', {
    data: { persona_rrhh: prestadorId, dia_semana: 1, hora_desde: '08:00', hora_hasta: '12:00', intervalo: 30 },
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

async function irAHorarios(page) {
  await page.goto('/agenda/horarios')
  await expect(page.locator('.hp-table')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.hp-table tbody td', { hasText: 'Cargando' }))
    .not.toBeVisible({ timeout: 8000 })
}

// Busca en el campo de búsqueda y encuentra la fila por el texto visible en tabla
async function filtrarPrestador(page, buscarTexto, textFila) {
  const textoBuscar = buscarTexto
  const textoFila   = textFila || buscarTexto
  await page.fill('.hp-search-input', textoBuscar)
  await page.waitForTimeout(400)
  const fila = page.locator('.hp-table tbody tr', { hasText: textoFila })
  await expect(fila).toBeVisible({ timeout: 6000 })
  return fila
}

// ─── setup y limpieza ──────────────────────────────────────────────────────────

test.beforeAll(async ({ request }) => {
  token      = await obtenerToken(request)
  const p1   = await crearPersona(request, DOC_DEMO,  NOM_DEMO,  token)
  prestId1   = await crearPrestador(request, p1, token)
  horarioId1 = await crearHorario(request, prestId1, token)
  const p2   = await crearPersona(request, DOC_VACIO, NOM_VACIO, token)
  prestId2   = await crearPrestador(request, p2, token)
  const p3   = await crearPersona(request, DOC_GEN,   NOM_GEN,   token)
  prestId3   = await crearPrestador(request, p3, token)
})

test.afterAll(async ({ request }) => {
  if (horarioId1) await apiDelete(request, `http://localhost:8000/api/horario-prestador/${horarioId1}/`, token)
  for (const pid of [prestId2, prestId3]) {
    if (!pid) continue
    const r = await request.get(`http://localhost:8000/api/horario-prestador/?persona_rrhh=${pid}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json()
    for (const h of (body.results || body)) {
      await apiDelete(request, `http://localhost:8000/api/horario-prestador/${h.id}/`, token)
    }
  }
  if (prestId1) await apiDelete(request, `http://localhost:8000/api/personarrhh/${prestId1}/`, token)
  if (prestId2) await apiDelete(request, `http://localhost:8000/api/personarrhh/${prestId2}/`, token)
  if (prestId3) await apiDelete(request, `http://localhost:8000/api/personarrhh/${prestId3}/`, token)
})

// ══════════════════════════════════════════════════════════════════════════════
// ESTRUCTURA INICIAL
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Estructura inicial', () => {

  test('01 - carga la página con tabla y buscador', async ({ page }) => {
    await irAHorarios(page)
    await expect(page.locator('.hp-search-input')).toBeVisible()
    await expect(page.locator('.hp-table')).toBeVisible()
  })

  test('02 - sin panel abierto al entrar', async ({ page }) => {
    await irAHorarios(page)
    await expect(page.locator('.hp-panel')).not.toBeVisible()
  })

  test('03 - tabla con encabezados correctos', async ({ page }) => {
    await irAHorarios(page)
    const ths = page.locator('.hp-table thead th')
    await expect(ths.nth(0)).toContainText('Prestador')
    await expect(ths.nth(1)).toContainText('Horarios')
    await expect(ths.nth(2)).toContainText('Acciones')
  })

  test('04 - fila del prestador muestra pill con horario configurado', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_DEMO)
    await expect(fila.locator('.hp-nombre')).toContainText(NOM_DEMO)
    await expect(fila.locator('.hp-dia-pill').first()).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// VER DETALLE
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Ver detalle del prestador', () => {

  test('05 - clic en fila abre el panel en modo ver', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_DEMO)
    await fila.click()
    await expect(page.locator('.hp-panel')).toBeVisible()
    await expect(page.locator('.hp-panel-title')).toContainText(NOM_DEMO)
  })

  test('06 - panel muestra los horarios configurados del prestador', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_DEMO)
    await fila.click()
    await expect(page.locator('.hp-panel')).toBeVisible()
    await expect(page.locator('.hp-ver-dia').first()).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.hp-ver-row').first()).toBeVisible()
  })

  test('07 - botón ver abre el panel', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_DEMO)
    await fila.locator('.hp-btn-ver').click()
    await expect(page.locator('.hp-panel')).toBeVisible()
  })

  test('08 - fila seleccionada resalta con clase activa', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_DEMO)
    await fila.click()
    await expect(fila).toHaveClass(/hp-row-active/)
  })

  test('09 - X cierra el panel en modo ver (sin guard)', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_DEMO)
    await fila.click()
    await expect(page.locator('.hp-panel')).toBeVisible()
    await page.locator('.hp-panel-close').click()
    await expect(page.locator('.hp-panel')).not.toBeVisible({ timeout: 4000 })
  })

  test('10 - panel tiene botón Editar horarios en modo ver', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_DEMO)
    await fila.click()
    await expect(page.locator('.hp-btn-editar')).toBeVisible()
  })

  test('11 - sección generar turnos visible en modo ver', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_DEMO)
    await fila.click()
    await expect(page.locator('.hp-gen-section')).toBeVisible()
    await expect(page.locator('.hp-btn-generar')).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// EDITAR HORARIOS
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Editar horarios', () => {

  test('12 - botón lápiz abre el panel en modo editar', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_DEMO)
    await fila.locator('.hp-btn-edit').click()
    await expect(page.locator('.hp-panel')).toBeVisible()
    await expect(page.locator('.hp-panel-title')).toContainText('Editar horarios')
    await expect(page.locator('.hp-bloque')).toBeVisible()
  })

  test('13 - bloque de edición tiene datos precargados', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_DEMO)
    await fila.locator('.hp-btn-edit').click()
    await expect(page.locator('.hp-bloque')).toBeVisible({ timeout: 4000 })
    // Toggle de estado visible
    await expect(page.locator('.hp-toggle')).toBeVisible()
    // Hora desde precargada (08:00)
    const horaDesde = await page.locator('.hp-bloque .hp-input').first().inputValue()
    expect(horaDesde).toBe('08:00')
  })

  test('14 - guardar sin campos requeridos muestra error de validación', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_VACIO, NOM_VACIO)
    await fila.locator('.hp-btn-edit').click()
    await expect(page.locator('.hp-panel')).toBeVisible()

    await page.locator('.hp-btn-agregar').click()
    await expect(page.locator('.hp-bloque')).toBeVisible({ timeout: 4000 })

    await page.locator('.hp-btn-save').click()
    await expect(page.locator('.hp-error')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.hp-panel')).toBeVisible()

    await page.locator('.hp-panel-close').click()
    const guard = page.locator('.cd-overlay')
    if (await guard.isVisible()) {
      await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
    }
  })

  test('15 - editar intervalo guarda el cambio', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_DEMO)
    await fila.locator('.hp-btn-edit').click()
    await expect(page.locator('.hp-bloque')).toBeVisible({ timeout: 4000 })

    await page.locator('.hp-intervalo-btn', { hasText: '20 min' }).click()
    await expect(page.locator('.hp-intervalo-btn-on')).toContainText('20 min')

    await page.locator('.hp-btn-save').click()
    await expect(page.locator('.hp-panel-title'))
      .not.toContainText('Editar horarios', { timeout: 8000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
  })

  test('16 - botón Editar horarios del panel ver cambia al modo editar', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_DEMO)
    await fila.click()
    await expect(page.locator('.hp-btn-editar')).toBeVisible()
    await page.locator('.hp-btn-editar').click()
    await expect(page.locator('.hp-panel-title')).toContainText('Editar horarios')
    await expect(page.locator('.hp-bloque')).toBeVisible()
  })

  test('17 - cancelar edición activa NavigationGuard', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_DEMO)
    await fila.locator('.hp-btn-edit').click()
    await expect(page.locator('.hp-bloque')).toBeVisible({ timeout: 4000 })

    await page.locator('.hp-btn-cancel').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()

    // Vuelve a modo ver (título es el nombre del prestador)
    await expect(page.locator('.hp-panel-title')).toContainText(NOM_DEMO, { timeout: 4000 })
  })

  test('18 - cerrar con X en modo editar activa NavigationGuard', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_DEMO)
    await fila.locator('.hp-btn-edit').click()
    await expect(page.locator('.hp-bloque')).toBeVisible({ timeout: 4000 })

    await page.locator('.hp-panel-close').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()

    await expect(page.locator('.hp-panel')).not.toBeVisible({ timeout: 4000 })
  })

  test('19 - F10 guarda el formulario de edición', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_DEMO)
    await fila.locator('.hp-btn-edit').click()
    await expect(page.locator('.hp-bloque')).toBeVisible({ timeout: 4000 })

    // Cambiar el toggle de estado para marcar el formulario como "modificado"
    await page.locator('.hp-toggle').click()

    await page.keyboard.press('F10')
    await expect(page.locator('.hp-panel-title'))
      .not.toContainText('Editar horarios', { timeout: 8000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
  })

  test('20 - agregar horario nuevo al prestador sin horarios', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_VACIO, NOM_VACIO)
    await fila.locator('.hp-btn-edit').click()
    await expect(page.locator('.hp-panel')).toBeVisible()

    await page.locator('.hp-btn-agregar').click()
    await expect(page.locator('.hp-bloque')).toBeVisible({ timeout: 4000 })

    await page.locator('.hp-bloque .hp-select').first().selectOption('2')
    await page.locator('.hp-bloque .hp-input').first().fill('09:00')
    await page.locator('.hp-bloque .hp-input').last().fill('13:00')

    await page.locator('.hp-btn-save').click()
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.hp-panel-title')).not.toContainText('Editar', { timeout: 6000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// GENERAR TURNOS
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Generar turnos', () => {

  test('21 - botón generar deshabilitado cuando no hay horarios activos', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_GEN, NOM_GEN)
    await fila.click()
    await expect(page.locator('.hp-panel')).toBeVisible()
    await expect(page.locator('.hp-btn-generar')).toBeDisabled()
  })

  test('22 - generar turnos muestra resultado', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_DEMO)
    await fila.click()
    await expect(page.locator('.hp-panel')).toBeVisible()
    await expect(page.locator('.hp-btn-generar')).toBeEnabled({ timeout: 4000 })

    await page.locator('.hp-btn-generar').click()
    await expect(page.locator('.hp-gen-result')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.hp-gen-result')).toContainText('turno')
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
  })

  test('23 - segunda generación con mismas fechas produce 0 creados', async ({ page }) => {
    await irAHorarios(page)
    const fila = await filtrarPrestador(page, NOM_DEMO)
    await fila.click()
    await expect(page.locator('.hp-panel')).toBeVisible()
    await expect(page.locator('.hp-btn-generar')).toBeEnabled({ timeout: 4000 })

    await page.locator('.hp-btn-generar').click()
    await expect(page.locator('.hp-gen-result')).toBeVisible({ timeout: 10000 })

    await page.locator('.hp-btn-generar').click()
    await expect(page.locator('.hp-gen-result')).toContainText('0', { timeout: 10000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// BÚSQUEDA
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Búsqueda', () => {

  test('24 - buscar por documento filtra y muestra el prestador', async ({ page }) => {
    await irAHorarios(page)
    await page.fill('.hp-search-input', DOC_DEMO)
    await page.waitForTimeout(400)
    // La tabla muestra el prestador cuyo documento es DOC_DEMO; el nombre es visible en la fila
    await expect(page.locator('.hp-table tbody tr', { hasText: NOM_DEMO }))
      .toBeVisible({ timeout: 6000 })
  })

  test('25 - buscar por nombre filtra la tabla', async ({ page }) => {
    await irAHorarios(page)
    await page.fill('.hp-search-input', NOM_DEMO)
    await page.waitForTimeout(400)
    await expect(page.locator('.hp-table tbody tr').first()).toBeVisible({ timeout: 6000 })
  })

  test('26 - búsqueda sin resultados muestra estado vacío', async ({ page }) => {
    await irAHorarios(page)
    await page.fill('.hp-search-input', 'XXXXXXXXXNOEXISTE')
    await page.waitForTimeout(400)
    await expect(page.locator('.hp-empty')).toBeVisible()
  })

  test('27 - limpiar búsqueda restaura la lista', async ({ page }) => {
    await irAHorarios(page)
    await page.fill('.hp-search-input', 'XXXXXXXXXNOEXISTE')
    await page.waitForTimeout(400)
    await expect(page.locator('.hp-empty')).toBeVisible()

    await page.fill('.hp-search-input', '')
    await page.waitForTimeout(400)
    await expect(page.locator('.hp-table tbody tr').first()).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// PERMISOS — RECEPCIONISTA
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Permisos recepcionista', () => {

  test('28 - recepcionista ve la tabla de prestadores', async ({ page }) => {
    await loginComoRecep(page)
    await irAHorarios(page)
    await expect(page.locator('.hp-table')).toBeVisible()
  })

  test('29 - recepcionista puede abrir el panel en modo ver', async ({ page }) => {
    await loginComoRecep(page)
    await irAHorarios(page)
    const filas = page.locator('.hp-table tbody tr')
    if (await filas.first().isVisible()) {
      await filas.first().locator('.hp-btn-ver').click()
      await expect(page.locator('.hp-panel')).toBeVisible()
      await page.locator('.hp-panel-close').click()
    }
  })

  test('30 - recepcionista puede abrir el panel en modo editar', async ({ page }) => {
    await loginComoRecep(page)
    await irAHorarios(page)
    const filas = page.locator('.hp-table tbody tr')
    if (await filas.first().isVisible()) {
      await filas.first().locator('.hp-btn-edit').click()
      await expect(page.locator('.hp-panel')).toBeVisible()
      await expect(page.locator('.hp-panel-title')).toContainText('Editar')
      await page.locator('.hp-panel-close').click()
      const guard = page.locator('.cd-overlay')
      if (await guard.isVisible()) {
        await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
      }
    }
  })

})
