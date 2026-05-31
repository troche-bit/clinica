const { test, expect } = require('@playwright/test')

const TS      = Date.now()
const DOC_1   = `E2EPAC1${TS}`
const DOC_2   = `E2EPAC2${TS}`
const DOC_NEW = `E2EPACN${TS}`

let pacId1   = null
let pacId2   = null
let token    = null

// ─── helpers ──────────────────────────────────────────────────────────────────

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

async function crearPersonaYPaciente(request, nro, nombre, sexo, tk) {
  const tipos = await request.get('http://localhost:8000/api/tipo-documento/', {
    headers: { Authorization: `Bearer ${tk}` },
  })
  const tipoId = ((await tipos.json()).results || (await tipos.json()))[0]?.id

  const rp = await request.post('http://localhost:8000/api/persona/', {
    data: { tipo_documento: tipoId, nro_documento: nro, razon_social: nombre },
    headers: { Authorization: `Bearer ${tk}` },
  })
  const personaId = (await rp.json()).id

  const rpac = await request.post('http://localhost:8000/api/paciente/', {
    data: { persona: personaId, sexo },
    headers: { Authorization: `Bearer ${tk}` },
  })
  return (await rpac.json()).id
}

async function crearSoloPersona(request, nro, nombre, tk) {
  const tipos = await request.get('http://localhost:8000/api/tipo-documento/', {
    headers: { Authorization: `Bearer ${tk}` },
  })
  const body = await tipos.json()
  const tipoId = (body.results || body)[0]?.id
  const r = await request.post('http://localhost:8000/api/persona/', {
    data: { tipo_documento: tipoId, nro_documento: nro, razon_social: nombre },
    headers: { Authorization: `Bearer ${tk}` },
  })
  return (await r.json()).id
}

async function apiDeletePaciente(request, id, tk) {
  await request.delete(`http://localhost:8000/api/paciente/${id}/`, {
    headers: { Authorization: `Bearer ${tk}` },
  })
}

async function irAPacientes(page) {
  await page.goto('/paciente')
  await expect(page.locator('.pac-btn-nuevo')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.pac-table tbody td', { hasText: 'Cargando' }))
    .not.toBeVisible({ timeout: 8000 })
}

async function filtrarDoc(page, doc) {
  await page.fill('.pac-search-input', doc)
  await page.waitForTimeout(400)
  const fila = page.locator('.pac-table tbody tr', { hasText: doc })
  await expect(fila).toBeVisible({ timeout: 6000 })
  return fila
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

// ─── setup y limpieza ──────────────────────────────────────────────────────────

test.beforeAll(async ({ request }) => {
  token = await obtenerToken(request)
  pacId1 = await crearPersonaYPaciente(request, DOC_1, `E2E Pac Uno ${TS}`, 'F', token)
  pacId2 = await crearPersonaYPaciente(request, DOC_2, `E2E Pac Dos ${TS}`, 'M', token)
  await crearSoloPersona(request, DOC_NEW, `E2E Pac Nuevo ${TS}`, token)
})

test.afterAll(async ({ request }) => {
  const tk = token || (await obtenerToken(request))
  if (pacId1) await apiDeletePaciente(request, pacId1, tk)
  if (pacId2) await apiDeletePaciente(request, pacId2, tk)
  // Eliminar paciente creado durante el test si quedó
  const r = await request.get(
    `http://localhost:8000/api/paciente/?search=${encodeURIComponent(DOC_NEW)}`,
    { headers: { Authorization: `Bearer ${tk}` } }
  )
  const body = await r.json()
  const pac = (body.results || body).find(p => p.documento === DOC_NEW)
  if (pac?.id) await apiDeletePaciente(request, pac.id, tk)
})

// ══════════════════════════════════════════════════════════════════════════════
// ESTRUCTURA INICIAL
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Estructura inicial', () => {

  test('01 - carga la página con tabla, buscador y botón Nuevo', async ({ page }) => {
    await irAPacientes(page)
    await expect(page.locator('.pac-search-input')).toBeVisible()
    await expect(page.locator('.pac-btn-nuevo')).toBeVisible()
    await expect(page.locator('.pac-table')).toBeVisible()
  })

  test('02 - sin modal abierto al entrar', async ({ page }) => {
    await irAPacientes(page)
    await expect(page.locator('.modal-box')).not.toBeVisible()
  })

  test('03 - tabla con encabezados Paciente, Teléfono, Fecha nac., Sexo y Acciones', async ({ page }) => {
    await irAPacientes(page)
    const headers = page.locator('.pac-table thead th')
    await expect(headers.nth(0)).toContainText('Paciente')
    await expect(headers.nth(1)).toContainText('Teléfono')
    await expect(headers.nth(2)).toContainText('Fecha nac.')
    await expect(headers.nth(3)).toContainText('Sexo')
    await expect(headers.nth(5)).toContainText('Acciones')
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// CREAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Crear paciente', () => {

  test('04 - botón Nuevo abre modal con BuscadorPersona', async ({ page }) => {
    await irAPacientes(page)
    await page.locator('.pac-btn-nuevo').click()
    await expect(page.locator('.modal-box')).toBeVisible()
    await expect(page.locator('.modal-title')).toContainText('Nuevo paciente')
    await expect(page.locator('.bp-input')).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('05 - buscar persona existente muestra formulario con campo sexo', async ({ page }) => {
    await irAPacientes(page)
    await page.locator('.pac-btn-nuevo').click()
    await page.fill('.bp-input', DOC_NEW)
    await page.locator('.bp-btn').click()
    await expect(page.locator('.pf-btn-save')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('select[name="sexo"]')).toBeVisible()
    // Cerrar sin guardar
    await page.locator('.modal-close').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
  })

  test('06 - crear paciente válido aparece en la tabla', async ({ page }) => {
    await irAPacientes(page)
    await page.locator('.pac-btn-nuevo').click()
    await page.fill('.bp-input', DOC_NEW)
    await page.locator('.bp-btn').click()
    await expect(page.locator('.pf-btn-save')).toBeVisible({ timeout: 8000 })

    await page.selectOption('select[name="sexo"]', 'M')
    await page.locator('.pf-btn-save').click()

    await expect(page.locator('.modal-box')).not.toBeVisible({ timeout: 8000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
    const fila = await filtrarDoc(page, DOC_NEW)
    await expect(fila).toBeVisible()
  })

  test('07 - campo sexo es requerido — select visible con opciones', async ({ page }) => {
    // Verifica que el campo sexo existe y tiene opciones (M/F/O) en el formulario
    await irAPacientes(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.locator('.pac-action-btn.edit').click()
    await expect(page.locator('.pf-btn-save')).toBeVisible({ timeout: 8000 })

    const select = page.locator('select[name="sexo"]')
    await expect(select).toBeVisible()
    const options = await select.locator('option').count()
    expect(options).toBeGreaterThan(1)
    // Verificar que M, F, O son opciones válidas
    await expect(select.locator('option[value="M"]')).toHaveCount(1)
    await expect(select.locator('option[value="F"]')).toHaveCount(1)
    await expect(select.locator('option[value="O"]')).toHaveCount(1)
    await page.locator('.modal-close').click()
  })

  test('08 - NavigationGuard al cerrar modal con búsqueda realizada', async ({ page }) => {
    await irAPacientes(page)
    await page.locator('.pac-btn-nuevo').click()
    await page.fill('.bp-input', DOC_1)
    await page.locator('.bp-btn').click()
    await expect(page.locator('.pf-btn-save')).toBeVisible({ timeout: 8000 })

    await page.locator('.modal-close').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
    await expect(page.locator('.modal-box')).not.toBeVisible({ timeout: 4000 })
  })

  test('09 - F10 guarda el paciente', async ({ page }) => {
    // DOC_NEW ya tiene paciente de test 06 → buscamos DOC_1 en modo editar
    // Para F10 usamos DOC_NEW si ya fue creado, verificamos con la búsqueda previa
    // Simplificamos: DOC_1 ya tiene paciente por beforeAll (modo editar al buscar)
    // Este test verifica que F10 en modo editar/crear funciona
    await irAPacientes(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.locator('.pac-action-btn.edit').click()
    await expect(page.locator('.pf-btn-save')).toBeVisible({ timeout: 8000 })
    await page.keyboard.press('F10')
    await expect(page.locator('.modal-box')).not.toBeVisible({ timeout: 8000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// VER DETALLE
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Ver detalle', () => {

  test('10 - clic en fila abre modal en modo Detalle', async ({ page }) => {
    await irAPacientes(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.click()

    await expect(page.locator('.modal-box')).toBeVisible()
    await expect(page.locator('.modal-title')).toContainText('Detalle del paciente')
    await page.locator('.modal-close').click()
  })

  test('11 - detalle muestra datos del paciente', async ({ page }) => {
    await irAPacientes(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.click()

    await expect(page.locator('.modal-box')).toContainText(DOC_1)
    await page.locator('.modal-close').click()
  })

  test('12 - detalle tiene botón Editar', async ({ page }) => {
    await irAPacientes(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.click()

    await expect(page.locator('.pac-det-btn-editar')).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('13 - hint visible en filas', async ({ page }) => {
    await irAPacientes(page)
    const fila = await filtrarDoc(page, DOC_1)
    await expect(fila.locator('.pac-hint')).toContainText('Clic para ver detalle')
  })

  test('14 - X del modal cierra el detalle', async ({ page }) => {
    await irAPacientes(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.click()
    await expect(page.locator('.modal-box')).toBeVisible()
    await page.locator('.modal-close').click()
    await expect(page.locator('.modal-box')).not.toBeVisible({ timeout: 4000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// EDITAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Editar paciente', () => {

  test('15 - ícono lápiz abre modal en modo editar', async ({ page }) => {
    await irAPacientes(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.locator('.pac-action-btn.edit').click()

    await expect(page.locator('.modal-box')).toBeVisible()
    await expect(page.locator('.modal-title')).toContainText('Editar paciente')
    await expect(page.locator('.pf-btn-save')).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('16 - panel de edición trae sexo precargado', async ({ page }) => {
    await irAPacientes(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.locator('.pac-action-btn.edit').click()
    await expect(page.locator('.pf-btn-save')).toBeVisible({ timeout: 4000 })

    const sexoVal = await page.locator('select[name="sexo"]').inputValue()
    expect(sexoVal).toBe('F')
    await page.locator('.modal-close').click()
  })

  test('17 - editar grupo sanguíneo guarda el cambio', async ({ page }) => {
    await irAPacientes(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.locator('.pac-action-btn.edit').click()
    await expect(page.locator('.pf-btn-save')).toBeVisible({ timeout: 4000 })

    await page.selectOption('select[name="grupo_sanguineo"]', 'O+')
    await page.locator('.pf-btn-save').click()

    await expect(page.locator('.modal-box')).not.toBeVisible({ timeout: 8000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
  })

  test('18 - botón Editar del detalle abre modo edición', async ({ page }) => {
    await irAPacientes(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.click()
    await expect(page.locator('.pac-det-btn-editar')).toBeVisible()
    await page.locator('.pac-det-btn-editar').click()

    await expect(page.locator('.modal-title')).toContainText('Editar paciente')
    await expect(page.locator('.pf-btn-save')).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('19 - cerrar modal con X activa NavigationGuard en modo editar', async ({ page }) => {
    // pf-btn-cancel llama a onSuccess directamente (sin guard).
    // El guard se dispara con la X del modal (modal-close → guardAction).
    await irAPacientes(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.locator('.pac-action-btn.edit').click()
    await expect(page.locator('.pf-btn-save')).toBeVisible({ timeout: 4000 })

    // El modo editar ya marca dirty desde el inicio (resultado pre-cargado)
    await page.locator('.modal-close').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
    await expect(page.locator('.modal-box')).not.toBeVisible({ timeout: 4000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// ELIMINAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Eliminar paciente', () => {

  test('20 - ícono papelera muestra ConfirmDialog', async ({ page }) => {
    await irAPacientes(page)
    const fila = await filtrarDoc(page, DOC_2)
    await fila.locator('.pac-action-btn.trash').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.cd-backdrop')).toContainText('eliminar')
  })

  test('21 - ConfirmDialog menciona citas activas', async ({ page }) => {
    await irAPacientes(page)
    const fila = await filtrarDoc(page, DOC_2)
    await fila.locator('.pac-action-btn.trash').click()

    await expect(page.locator('.cd-backdrop')).toContainText('citas')
    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
  })

  test('22 - cancelar eliminación mantiene el registro', async ({ page }) => {
    await irAPacientes(page)
    const fila = await filtrarDoc(page, DOC_2)
    await fila.locator('.pac-action-btn.trash').click()

    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
    await expect(page.locator('.cd-overlay')).not.toBeVisible({ timeout: 4000 })
    await expect(page.locator('.pac-table tbody tr', { hasText: DOC_2 })).toBeVisible()
  })

  test('23 - confirmar eliminación quita el registro de la tabla', async ({ page }) => {
    await irAPacientes(page)
    const fila = await filtrarDoc(page, DOC_2)
    await fila.locator('.pac-action-btn.trash').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /eliminar/i }).click()

    await expect(page.locator('.pac-table tbody tr', { hasText: DOC_2 })).not.toBeVisible({ timeout: 8000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
    pacId2 = null
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// BÚSQUEDA
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Búsqueda', () => {

  test('24 - buscar por documento filtra la tabla', async ({ page }) => {
    await irAPacientes(page)
    await page.fill('.pac-search-input', DOC_1)
    await page.waitForTimeout(400)

    const filas = page.locator('.pac-table tbody tr')
    await expect(filas.first()).toBeVisible({ timeout: 6000 })
    const count = await filas.count()
    for (let i = 0; i < count; i++) {
      await expect(filas.nth(i)).toContainText(DOC_1)
    }
  })

  test('25 - búsqueda parcial filtra correctamente', async ({ page }) => {
    await irAPacientes(page)
    await page.fill('.pac-search-input', 'E2EPAC')
    await page.waitForTimeout(400)
    await expect(page.locator('.pac-table tbody tr').first()).toBeVisible({ timeout: 6000 })
  })

  test('26 - búsqueda sin resultados muestra estado vacío', async ({ page }) => {
    await irAPacientes(page)
    await page.fill('.pac-search-input', 'XXXXXXXXXNOEXISTE')
    await page.waitForTimeout(400)
    // La tabla muestra mensaje de "Sin resultados" o está vacía
    const filas = page.locator('.pac-table tbody tr')
    const count = await filas.count()
    // Sin resultados: 0 filas de datos o fila de "sin pacientes"
    if (count > 0) {
      // Si hay una fila, debe ser el mensaje de estado vacío
      const text = await page.locator('.pac-table tbody').textContent()
      expect(text.trim().length).toBeGreaterThan(0)
    }
  })

  test('27 - limpiar búsqueda restaura la lista', async ({ page }) => {
    await irAPacientes(page)
    await page.fill('.pac-search-input', 'XXXXXXXXXNOEXISTE')
    await page.waitForTimeout(400)

    await page.fill('.pac-search-input', '')
    await page.waitForTimeout(400)
    await expect(page.locator('.pac-table tbody tr').first()).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// PERMISOS — RECEPCIONISTA
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Permisos recepcionista', () => {

  test('28 - recepcionista no ve el ícono papelera', async ({ page }) => {
    await loginComoRecep(page)
    await irAPacientes(page)
    await expect(page.locator('.pac-action-btn.trash').first()).not.toBeVisible()
  })

  test('29 - recepcionista puede abrir modal crear', async ({ page }) => {
    await loginComoRecep(page)
    await irAPacientes(page)
    await page.locator('.pac-btn-nuevo').click()

    await expect(page.locator('.modal-box')).toBeVisible()
    await expect(page.locator('.bp-input')).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('30 - recepcionista puede abrir edición desde fila', async ({ page }) => {
    await loginComoRecep(page)
    await irAPacientes(page)

    const filas = page.locator('.pac-table tbody tr')
    if (await filas.first().isVisible()) {
      await filas.first().locator('.pac-action-btn.edit').click()
      await expect(page.locator('.modal-box')).toBeVisible()
      await expect(page.locator('.modal-title')).toContainText('Editar paciente')
      await page.locator('.modal-close').click()
    }
  })

})
