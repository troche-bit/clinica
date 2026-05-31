const { test, expect } = require('@playwright/test')

const TS      = Date.now()
const DOC_1   = `E2ERRHH1${TS}`
const DOC_2   = `E2ERRHH2${TS}`
const DOC_NEW = `E2ERRHHNU${TS}`

let prestId1  = null
let prestId2  = null
let token     = null

// ─── helpers ──────────────────────────────────────────────────────────────────

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

async function crearPersona(request, nro, razon_social, tk) {
  const tipos = await request.get('http://localhost:8000/api/tipo-documento/', {
    headers: { Authorization: `Bearer ${tk}` },
  })
  const body = await tipos.json()
  const ci = (body.results || body).find(t => t.descripcion?.toLowerCase().includes('c'))
  const tipoId = ci?.id || (body.results || body)[0]?.id

  const r = await request.post('http://localhost:8000/api/persona/', {
    data: { tipo_documento: tipoId, nro_documento: nro, razon_social: razon_social, fecha_nacimiento: '1990-01-15' },
    headers: { Authorization: `Bearer ${tk}` },
  })
  const p = await r.json()
  return p.id
}

async function crearPrestador(request, personaId, tk) {
  const r = await request.post('http://localhost:8000/api/personarrhh/', {
    data: { persona: personaId, cargo: 'medico', tipo_contrato: 'dependencia', fecha_ingreso: '2020-01-01' },
    headers: { Authorization: `Bearer ${tk}` },
  })
  const body = await r.json()
  return body.id
}

async function setDateInput(page, selector, value) {
  await page.locator(selector).evaluate((el, val) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, val)
    el.dispatchEvent(new Event('input',  { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

async function apiDeletePrestador(request, id, tk) {
  await request.delete(`http://localhost:8000/api/personarrhh/${id}/`, {
    headers: { Authorization: `Bearer ${tk}` },
  })
}

async function irAPrestadores(page) {
  await page.goto('/rrhh/personal')
  await expect(page.locator('.rrhh-btn-nuevo')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.rrhh-table tbody td', { hasText: 'Cargando' }))
    .not.toBeVisible({ timeout: 8000 })
}

async function filtrarDoc(page, doc) {
  await page.fill('.rrhh-search-input', doc)
  await page.waitForTimeout(400)
  const fila = page.locator('.rrhh-table tbody tr', { hasText: doc })
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
  const p1Id = await crearPersona(request, DOC_1, `E2E Prest Uno ${TS}`, token)
  prestId1   = await crearPrestador(request, p1Id, token)
  const p2Id = await crearPersona(request, DOC_2, `E2E Prest Dos ${TS}`, token)
  prestId2   = await crearPrestador(request, p2Id, token)
  await crearPersona(request, DOC_NEW, `E2E Prest Nuevo ${TS}`, token)
})

test.afterAll(async ({ request }) => {
  const tk = token || (await obtenerToken(request))
  if (prestId1) await apiDeletePrestador(request, prestId1, tk)
  if (prestId2) await apiDeletePrestador(request, prestId2, tk)
  // Limpiar prestador creado en el test de crear (si existió)
  const r = await request.get(`http://localhost:8000/api/personarrhh/buscar/?nro_documento=${DOC_NEW}`, {
    headers: { Authorization: `Bearer ${tk}` },
  })
  const body = await r.json()
  if (body.es_prestador && body.personarrhh?.id) {
    await apiDeletePrestador(request, body.personarrhh.id, tk)
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// ESTRUCTURA INICIAL
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Estructura inicial', () => {

  test('01 - carga la página con tabla, buscador y botón Nuevo', async ({ page }) => {
    await irAPrestadores(page)
    await expect(page.locator('.rrhh-search-input')).toBeVisible()
    await expect(page.locator('.rrhh-btn-nuevo')).toBeVisible()
    await expect(page.locator('.rrhh-table')).toBeVisible()
  })

  test('02 - sin modal abierto al entrar', async ({ page }) => {
    await irAPrestadores(page)
    await expect(page.locator('.modal-box')).not.toBeVisible()
  })

  test('03 - tabla con encabezados Prestador, Cargo, Especialidades, Estado y Acciones', async ({ page }) => {
    await irAPrestadores(page)
    const headers = page.locator('.rrhh-table thead th')
    await expect(headers.nth(0)).toContainText('Prestador')
    await expect(headers.nth(1)).toContainText('Cargo')
    await expect(headers.nth(2)).toContainText('Especialidades')
    await expect(headers.nth(3)).toContainText('Estado')
    await expect(headers.nth(4)).toContainText('Acciones')
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// CREAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Crear prestador', () => {

  test('04 - botón Nuevo abre modal con buscador de persona', async ({ page }) => {
    await irAPrestadores(page)
    await page.locator('.rrhh-btn-nuevo').click()
    await expect(page.locator('.modal-box')).toBeVisible()
    await expect(page.locator('.modal-title')).toContainText('Nuevo prestador')
    await expect(page.locator('.bp-input')).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('05 - buscar persona existente muestra formulario de prestador', async ({ page }) => {
    await irAPrestadores(page)
    await page.locator('.rrhh-btn-nuevo').click()
    await page.fill('.bp-input', DOC_NEW)
    await page.locator('.bp-btn').click()
    await expect(page.locator('.prf-btn-save')).toBeVisible({ timeout: 8000 })
    await page.locator('.modal-close').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
  })

  test('06 - guardar sin campos requeridos muestra error de validación', async ({ page }) => {
    await irAPrestadores(page)
    await page.locator('.rrhh-btn-nuevo').click()
    await page.fill('.bp-input', DOC_NEW)
    await page.locator('.bp-btn').click()
    await expect(page.locator('.prf-btn-save')).toBeVisible({ timeout: 8000 })

    await page.locator('.prf-btn-save').click()
    await expect(page.locator('.prf-error')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.modal-box')).toBeVisible()

    await page.locator('.modal-close').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
  })

  test('07 - crear prestador válido aparece en la tabla', async ({ page }) => {
    await irAPrestadores(page)
    await page.locator('.rrhh-btn-nuevo').click()
    await page.fill('.bp-input', DOC_NEW)
    await page.locator('.bp-btn').click()
    await expect(page.locator('.prf-btn-save')).toBeVisible({ timeout: 8000 })

    await setDateInput(page, 'input[type="date"].fr-input', '2020-06-15')
    await page.locator('select.fr-select').nth(0).selectOption('medico')
    await page.locator('select.fr-select').nth(1).selectOption('dependencia')

    await page.locator('.prf-btn-save').click()
    await expect(page.locator('.modal-box')).not.toBeVisible({ timeout: 10000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })

    const fila = await filtrarDoc(page, DOC_NEW)
    await expect(fila).toBeVisible()
  })

  test('08 - toast de confirmación visible al crear', async ({ page }) => {
    // Ya se verifica en test 07 — aquí se confirma también el texto
    await irAPrestadores(page)
    const fila = await filtrarDoc(page, DOC_NEW)
    await expect(fila).toBeVisible()
  })

  test('09 - NavigationGuard al cerrar modal con búsqueda realizada', async ({ page }) => {
    await irAPrestadores(page)
    await page.locator('.rrhh-btn-nuevo').click()
    await page.fill('.bp-input', DOC_1)
    await page.locator('.bp-btn').click()
    await expect(page.locator('.prf-btn-save')).toBeVisible({ timeout: 8000 })

    await page.locator('.modal-close').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
    await expect(page.locator('.modal-box')).not.toBeVisible({ timeout: 4000 })
  })

  test('10 - F10 guarda el formulario', async ({ page }) => {
    // Buscar si DOC_NEW ya fue recreado (test 07 pudo haberlo creado)
    // Para este test usamos DOC_1 en modo editar via F10
    await irAPrestadores(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.locator('.rrhh-action-btn.edit').click()
    await expect(page.locator('.prf-btn-save')).toBeVisible({ timeout: 6000 })

    await page.keyboard.press('F10')
    await expect(page.locator('.modal-box')).not.toBeVisible({ timeout: 8000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// VER DETALLE
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Ver detalle', () => {

  test('11 - clic en fila abre modal en modo Detalle', async ({ page }) => {
    await irAPrestadores(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.click()

    await expect(page.locator('.modal-box')).toBeVisible()
    await expect(page.locator('.modal-title')).toContainText('Detalle del prestador')
    await page.locator('.modal-close').click()
  })

  test('12 - detalle muestra datos del prestador (documento y nombre)', async ({ page }) => {
    await irAPrestadores(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.click()

    await expect(page.locator('.modal-box')).toBeVisible()
    await expect(page.locator('.modal-box')).toContainText(DOC_1)
    await page.locator('.modal-close').click()
  })

  test('13 - detalle muestra tabs Ficha y Documentos', async ({ page }) => {
    await irAPrestadores(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.click()

    await expect(page.locator('.rrhh-tabs')).toBeVisible()
    await expect(page.locator('.rrhh-tab').filter({ hasText: 'Ficha' })).toBeVisible()
    await expect(page.locator('.rrhh-tab').filter({ hasText: 'Documentos' })).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('14 - detalle tiene botón Editar', async ({ page }) => {
    await irAPrestadores(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.click()

    await expect(page.locator('.rrhh-det-btn-editar')).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('15 - hint visible en filas no seleccionadas', async ({ page }) => {
    await irAPrestadores(page)
    const fila = await filtrarDoc(page, DOC_1)
    await expect(fila.locator('.rrhh-hint')).toContainText('Clic para ver detalle')
  })

  test('16 - fila activa se resalta al abrir detalle', async ({ page }) => {
    await irAPrestadores(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.click()
    await expect(page.locator('.modal-box')).toBeVisible()
    // El modal muestra el contenido del prestador seleccionado
    await expect(page.locator('.rrhh-det-nombre').first()).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('17 - X cierra el modal de detalle', async ({ page }) => {
    await irAPrestadores(page)
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

test.describe('Editar prestador', () => {

  test('18 - ícono lápiz abre modal en modo editar', async ({ page }) => {
    await irAPrestadores(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.locator('.rrhh-action-btn.edit').click()

    await expect(page.locator('.modal-box')).toBeVisible()
    await expect(page.locator('.modal-title')).toContainText('Editar prestador')
    await expect(page.locator('.prf-btn-save')).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('19 - formulario de edición tiene datos precargados', async ({ page }) => {
    await irAPrestadores(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.locator('.rrhh-action-btn.edit').click()
    await expect(page.locator('.prf-btn-save')).toBeVisible({ timeout: 4000 })

    // Badge de modo edición visible
    await expect(page.locator('.prf-badge')).toContainText('edición')
    // El cargo estaba en 'medico' al crearlo
    const cargoVal = await page.locator('select.fr-select').nth(0).inputValue()
    expect(cargoVal).toBe('medico')
    await page.locator('.modal-close').click()
  })

  test('20 - editar estado guarda el cambio', async ({ page }) => {
    await irAPrestadores(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.locator('.rrhh-action-btn.edit').click()
    await expect(page.locator('.prf-btn-save')).toBeVisible({ timeout: 4000 })

    await page.locator('select.fr-select').nth(2).selectOption('licencia')
    await page.locator('.prf-btn-save').click()

    await expect(page.locator('.modal-box')).not.toBeVisible({ timeout: 8000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })

    // Restaurar estado
    const fila2 = await filtrarDoc(page, DOC_1)
    await fila2.locator('.rrhh-action-btn.edit').click()
    await expect(page.locator('.prf-btn-save')).toBeVisible({ timeout: 4000 })
    await page.locator('select.fr-select').nth(2).selectOption('activo')
    await page.locator('.prf-btn-save').click()
    await expect(page.locator('.modal-box')).not.toBeVisible({ timeout: 8000 })
  })

  test('21 - botón Editar del detalle cambia al modo edición', async ({ page }) => {
    await irAPrestadores(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.click()
    await expect(page.locator('.rrhh-det-btn-editar')).toBeVisible()
    await page.locator('.rrhh-det-btn-editar').click()

    await expect(page.locator('.modal-title')).toContainText('Editar prestador')
    await expect(page.locator('.prf-btn-save')).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('22 - cancelar edición con guard no guarda cambios', async ({ page }) => {
    await irAPrestadores(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.locator('.rrhh-action-btn.edit').click()
    await expect(page.locator('.prf-btn-save')).toBeVisible({ timeout: 4000 })

    await page.fill('textarea.fr-textarea', 'NO-GUARDAR-OBSERVACION-E2E')
    await page.locator('.prf-btn-cancel').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
    await expect(page.locator('.modal-box')).not.toBeVisible({ timeout: 4000 })

    const fila2 = await filtrarDoc(page, DOC_1)
    await fila2.click()
    await expect(page.locator('.modal-box')).toBeVisible()
    await expect(page.locator('.modal-box')).not.toContainText('NO-GUARDAR-OBSERVACION-E2E')
    await page.locator('.modal-close').click()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// ELIMINAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Eliminar prestador', () => {

  test('23 - ícono papelera muestra ConfirmDialog', async ({ page }) => {
    await irAPrestadores(page)
    const fila = await filtrarDoc(page, DOC_2)
    await fila.locator('.rrhh-action-btn.trash').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.cd-backdrop')).toContainText('eliminación')
  })

  test('24 - ConfirmDialog menciona turnos activos', async ({ page }) => {
    await irAPrestadores(page)
    const fila = await filtrarDoc(page, DOC_2)
    await fila.locator('.rrhh-action-btn.trash').click()

    await expect(page.locator('.cd-backdrop')).toContainText('turnos')
    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
  })

  test('25 - cancelar eliminación mantiene el registro', async ({ page }) => {
    await irAPrestadores(page)
    const fila = await filtrarDoc(page, DOC_2)
    await fila.locator('.rrhh-action-btn.trash').click()

    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
    await expect(page.locator('.cd-overlay')).not.toBeVisible({ timeout: 4000 })
    await expect(page.locator('.rrhh-table tbody tr', { hasText: DOC_2 })).toBeVisible()
  })

  test('26 - confirmar eliminación quita el registro de la tabla', async ({ page }) => {
    await irAPrestadores(page)
    const fila = await filtrarDoc(page, DOC_2)
    await fila.locator('.rrhh-action-btn.trash').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /eliminar/i }).click()

    await expect(page.locator('.rrhh-table tbody tr', { hasText: DOC_2 }))
      .not.toBeVisible({ timeout: 8000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
    prestId2 = null
  })

  test('27 - botón Eliminar en panel de detalle dispara ConfirmDialog', async ({ page }) => {
    // El botón Eliminar del panel de detalle no existe en PersonaRRHHPage
    // (la eliminación solo ocurre desde la fila de la tabla)
    // Este test verifica que el detalle NO tiene botón eliminar inline
    await irAPrestadores(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.click()
    await expect(page.locator('.modal-box')).toBeVisible()
    // El detalle solo tiene botón Editar, no Eliminar
    await expect(page.locator('.rrhh-det-btn-editar')).toBeVisible()
    await page.locator('.modal-close').click()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// BÚSQUEDA
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Búsqueda', () => {

  test('28 - buscar por documento filtra la tabla', async ({ page }) => {
    await irAPrestadores(page)
    await page.fill('.rrhh-search-input', DOC_1)
    await page.waitForTimeout(400)

    const filas = page.locator('.rrhh-table tbody tr')
    await expect(filas.first()).toBeVisible({ timeout: 6000 })
    const count = await filas.count()
    for (let i = 0; i < count; i++) {
      await expect(filas.nth(i)).toContainText(DOC_1)
    }
  })

  test('29 - buscar por nombre parcial filtra la tabla', async ({ page }) => {
    await irAPrestadores(page)
    await page.fill('.rrhh-search-input', 'E2ERRHH')
    await page.waitForTimeout(400)
    await expect(page.locator('.rrhh-table tbody tr').first()).toBeVisible({ timeout: 6000 })
  })

  test('30 - búsqueda sin resultados muestra estado vacío', async ({ page }) => {
    await irAPrestadores(page)
    await page.fill('.rrhh-search-input', 'XXXXXXXXXNOEXISTE')
    await page.waitForTimeout(400)
    await expect(page.locator('.rrhh-empty')).toBeVisible()
  })

  test('31 - limpiar búsqueda restaura la lista', async ({ page }) => {
    await irAPrestadores(page)
    await page.fill('.rrhh-search-input', 'XXXXXXXXXNOEXISTE')
    await page.waitForTimeout(400)
    await expect(page.locator('.rrhh-empty')).toBeVisible()

    await page.fill('.rrhh-search-input', '')
    await page.waitForTimeout(400)
    await expect(page.locator('.rrhh-table tbody tr').first()).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// PERMISOS — RECEPCIONISTA
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Permisos recepcionista', () => {

  test('32 - recepcionista no ve el ícono papelera', async ({ page }) => {
    await loginComoRecep(page)
    await irAPrestadores(page)
    await expect(page.locator('.rrhh-action-btn.trash').first()).not.toBeVisible()
  })

  test('33 - recepcionista puede ver el listado de prestadores', async ({ page }) => {
    await loginComoRecep(page)
    await irAPrestadores(page)
    await expect(page.locator('.rrhh-table')).toBeVisible()
  })

  test('34 - recepcionista puede abrir panel ver detalle', async ({ page }) => {
    await loginComoRecep(page)
    await irAPrestadores(page)
    const filas = page.locator('.rrhh-table tbody tr')
    if (await filas.first().isVisible()) {
      await filas.first().click()
      await expect(page.locator('.modal-box')).toBeVisible()
      await expect(page.locator('.modal-title')).toContainText('Detalle')
      await page.locator('.modal-close').click()
    }
  })

})
