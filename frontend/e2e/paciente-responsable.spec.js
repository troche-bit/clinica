const { test, expect } = require('@playwright/test')

const TS      = Date.now()
// Documento único para el responsable que crearemos y usaremos a lo largo de los tests
const DOC_1   = `E2ERESP${TS}`
const DOC_2   = `E2ERESP2${TS}`
// Persona para crear (sin responsable previo)
const DOC_NEW = `E2ERESPNEW${TS}`

let respId1  = null
let respId2  = null
let token    = null
let personaNewId = null

// ─── helpers ──────────────────────────────────────────────────────────────────

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

async function crearPersona(request, nro, razon_social, tk) {
  // Buscar o crear TipoDocumento CI
  const tipos = await request.get('http://localhost:8000/api/tipo-documento/', {
    headers: { Authorization: `Bearer ${tk}` },
  })
  const body = await tipos.json()
  const ci = (body.results || body).find(t => t.descripcion?.toLowerCase().includes('c'))
  const tipoId = ci?.id || (body.results || body)[0]?.id

  const r = await request.post('http://localhost:8000/api/persona/', {
    data: { tipo_documento: tipoId, nro_documento: nro, razon_social: razon_social },
    headers: { Authorization: `Bearer ${tk}` },
  })
  const p = await r.json()
  return p.id
}

async function crearResponsable(request, personaId, tk) {
  const r = await request.post('http://localhost:8000/api/pacienteresponsable/', {
    data: { persona: personaId, es_contacto_emergencia: true },
    headers: { Authorization: `Bearer ${tk}` },
  })
  const body = await r.json()
  return body.id
}

async function apiDeleteResponsable(request, id, tk) {
  await request.delete(`http://localhost:8000/api/pacienteresponsable/${id}/`, {
    headers: { Authorization: `Bearer ${tk}` },
  })
}

async function irAResponsables(page) {
  await page.goto('/pacienteresponsable')
  await expect(page.locator('.pr-btn-nuevo')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.pr-table tbody td', { hasText: 'Cargando' }))
    .not.toBeVisible({ timeout: 8000 })
}

async function filtrarDoc(page, doc) {
  await page.fill('.pr-search-input', doc)
  await page.waitForTimeout(400)
  const fila = page.locator('.pr-table tbody tr', { hasText: doc })
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
  // Persona para respId1 (se crea como responsable desde el inicio)
  const p1Id = await crearPersona(request, DOC_1, `E2E Resp Uno ${TS}`, token)
  respId1 = await crearResponsable(request, p1Id, token)
  // Persona para respId2 (se crea como responsable)
  const p2Id = await crearPersona(request, DOC_2, `E2E Resp Dos ${TS}`, token)
  respId2 = await crearResponsable(request, p2Id, token)
  // Persona sin responsable (para el test de crear)
  personaNewId = await crearPersona(request, DOC_NEW, `E2E Resp Nuevo ${TS}`, token)
})

test.afterAll(async ({ request }) => {
  const tk = token || (await obtenerToken(request))
  if (respId1) await apiDeleteResponsable(request, respId1, tk)
  if (respId2) await apiDeleteResponsable(request, respId2, tk)
  // Eliminar persona nueva si quedó con responsable
  const r = await request.get(`http://localhost:8000/api/pacienteresponsable/buscar/?nro_documento=${DOC_NEW}`, {
    headers: { Authorization: `Bearer ${tk}` },
  })
  const body = await r.json()
  if (body.es_responsable && body.pacienteresponsable?.id) {
    await apiDeleteResponsable(request, body.pacienteresponsable.id, tk)
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// ESTRUCTURA INICIAL
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Estructura inicial', () => {

  test('01 - carga la página con tabla, buscador y botón Nuevo', async ({ page }) => {
    await irAResponsables(page)
    await expect(page.locator('.pr-search-input')).toBeVisible()
    await expect(page.locator('.pr-btn-nuevo')).toBeVisible()
    await expect(page.locator('.pr-table')).toBeVisible()
  })

  test('02 - sin modal abierto al entrar', async ({ page }) => {
    await irAResponsables(page)
    await expect(page.locator('.modal-box')).not.toBeVisible()
  })

  test('03 - tabla con encabezados Responsable, Teléfono, Ocupación y Acciones', async ({ page }) => {
    await irAResponsables(page)
    const headers = page.locator('.pr-table thead th')
    await expect(headers.nth(0)).toContainText('Responsable')
    await expect(headers.nth(1)).toContainText('Teléfono')
    await expect(headers.nth(2)).toContainText('Ocupación')
    await expect(headers.nth(3)).toContainText('Acciones')
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// CREAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Crear responsable', () => {

  test('04 - botón Nuevo abre modal con BuscadorPersona', async ({ page }) => {
    await irAResponsables(page)
    await page.locator('.pr-btn-nuevo').click()
    await expect(page.locator('.modal-box')).toBeVisible()
    await expect(page.locator('.modal-title')).toContainText('Nuevo responsable')
    await expect(page.locator('.bp-input')).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('05 - buscar persona existente muestra el formulario', async ({ page }) => {
    await irAResponsables(page)
    await page.locator('.pr-btn-nuevo').click()
    await expect(page.locator('.bp-input')).toBeVisible()

    await page.fill('.bp-input', DOC_NEW)
    await page.locator('.bp-btn').click()

    // Esperar a que aparezca el botón guardar (formulario cargado)
    await expect(page.locator('.rf-btn-save')).toBeVisible({ timeout: 8000 })
    // Cerrar sin guardar
    await page.locator('.modal-close').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
  })

  test('06 - crear responsable válido aparece en la tabla', async ({ page }) => {
    await irAResponsables(page)
    await page.locator('.pr-btn-nuevo').click()
    await expect(page.locator('.bp-input')).toBeVisible()

    await page.fill('.bp-input', DOC_NEW)
    await page.locator('.bp-btn').click()
    await expect(page.locator('.rf-btn-save')).toBeVisible({ timeout: 8000 })

    await page.locator('.rf-btn-save').click()
    await expect(page.locator('.modal-box')).not.toBeVisible({ timeout: 8000 })

    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
    const fila = await filtrarDoc(page, DOC_NEW)
    await expect(fila).toBeVisible()
  })

  test('07 - buscar documento inexistente muestra formulario de creación', async ({ page }) => {
    await irAResponsables(page)
    await page.locator('.pr-btn-nuevo').click()
    await page.fill('.bp-input', `NOEXISTE${TS}`)
    await page.locator('.bp-btn').click()
    // Modo 'crear_todo' muestra FormPersona
    await expect(page.locator('.fp-root, .rf-root')).toBeVisible({ timeout: 6000 })
    await page.locator('.modal-close').click()
    const guard = page.locator('.cd-overlay')
    if (await guard.isVisible()) {
      await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
    }
  })

  test('08 - NavigationGuard al cerrar modal con búsqueda realizada', async ({ page }) => {
    await irAResponsables(page)
    await page.locator('.pr-btn-nuevo').click()
    // Buscar y obtener resultado → markDirty se activa
    await page.fill('.bp-input', DOC_1)
    await page.locator('.bp-btn').click()
    await expect(page.locator('.rf-btn-save')).toBeVisible({ timeout: 8000 })

    // Cerrar modal activa el guard
    await page.locator('.modal-close').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
    await expect(page.locator('.modal-box')).not.toBeVisible({ timeout: 4000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// VER DETALLE
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Ver detalle', () => {

  test('09 - clic en fila abre modal en modo Detalle', async ({ page }) => {
    await irAResponsables(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.click()

    await expect(page.locator('.modal-box')).toBeVisible()
    await expect(page.locator('.modal-title')).toContainText('Detalle')
    await page.locator('.modal-close').click()
  })

  test('10 - detalle muestra datos del responsable', async ({ page }) => {
    await irAResponsables(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.click()

    await expect(page.locator('.modal-box')).toBeVisible()
    // El detalle muestra el documento o nombre del responsable
    await expect(page.locator('.modal-box')).toContainText(DOC_1)
    await page.locator('.modal-close').click()
  })

  test('11 - detalle tiene botón Editar', async ({ page }) => {
    await irAResponsables(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.click()

    await expect(page.locator('.pr-det-btn-editar')).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('12 - hint visible en filas no seleccionadas', async ({ page }) => {
    await irAResponsables(page)
    const fila = await filtrarDoc(page, DOC_1)
    await expect(fila.locator('.pr-hint')).toContainText('Clic para ver detalle')
  })

  test('13 - X del modal cierra el detalle', async ({ page }) => {
    await irAResponsables(page)
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

test.describe('Editar responsable', () => {

  test('14 - ícono lápiz abre modal en modo editar', async ({ page }) => {
    await irAResponsables(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.locator('.pr-action-btn.edit').click()

    await expect(page.locator('.modal-box')).toBeVisible()
    await expect(page.locator('.modal-title')).toContainText('Editar responsable')
    await expect(page.locator('.rf-btn-save')).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('15 - panel de edición muestra formulario con datos precargados', async ({ page }) => {
    await irAResponsables(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.locator('.pr-action-btn.edit').click()

    await expect(page.locator('.rf-btn-save')).toBeVisible({ timeout: 4000 })
    // El formulario debe mostrar la sección de datos del responsable
    await expect(page.locator('.fr-root')).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('16 - editar ocupación guarda el cambio', async ({ page }) => {
    await irAResponsables(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.locator('.pr-action-btn.edit').click()
    await expect(page.locator('.rf-btn-save')).toBeVisible({ timeout: 4000 })

    await page.fill('input[name="ocupacion"]', 'Ingeniero E2E')
    await page.locator('.rf-btn-save').click()

    await expect(page.locator('.modal-box')).not.toBeVisible({ timeout: 8000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
  })

  test('17 - botón Editar del detalle abre modo edición', async ({ page }) => {
    await irAResponsables(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.click()
    await expect(page.locator('.pr-det-btn-editar')).toBeVisible()
    await page.locator('.pr-det-btn-editar').click()

    await expect(page.locator('.modal-title')).toContainText('Editar responsable')
    await expect(page.locator('.rf-btn-save')).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('18 - cancelar edición con guard no guarda cambios', async ({ page }) => {
    await irAResponsables(page)
    const fila = await filtrarDoc(page, DOC_1)
    await fila.locator('.pr-action-btn.edit').click()
    await expect(page.locator('.rf-btn-save')).toBeVisible({ timeout: 4000 })

    await page.fill('input[name="ocupacion"]', 'NO-GUARDAR-ESTA-OCUPACION')
    await page.locator('.rf-btn-cancel').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()

    await expect(page.locator('.modal-box')).not.toBeVisible({ timeout: 4000 })
    // La tabla NO debe mostrar el texto no guardado
    await page.fill('.pr-search-input', DOC_1)
    await page.waitForTimeout(400)
    await expect(page.locator('.pr-table tbody', { hasText: 'NO-GUARDAR-ESTA-OCUPACION' })).not.toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// ELIMINAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Eliminar responsable', () => {

  test('19 - ícono papelera muestra ConfirmDialog', async ({ page }) => {
    await irAResponsables(page)
    const fila = await filtrarDoc(page, DOC_2)
    await fila.locator('.pr-action-btn.trash').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.cd-backdrop')).toContainText('eliminación')
  })

  test('20 - ConfirmDialog menciona pacientes vinculados', async ({ page }) => {
    await irAResponsables(page)
    const fila = await filtrarDoc(page, DOC_2)
    await fila.locator('.pr-action-btn.trash').click()

    await expect(page.locator('.cd-backdrop')).toContainText('pacientes')
    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
  })

  test('21 - cancelar eliminación mantiene el registro', async ({ page }) => {
    await irAResponsables(page)
    const fila = await filtrarDoc(page, DOC_2)
    await fila.locator('.pr-action-btn.trash').click()

    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
    await expect(page.locator('.cd-overlay')).not.toBeVisible({ timeout: 4000 })
    await expect(page.locator('.pr-table tbody tr', { hasText: DOC_2 })).toBeVisible()
  })

  test('22 - confirmar eliminación quita el registro de la tabla', async ({ page }) => {
    await irAResponsables(page)
    const fila = await filtrarDoc(page, DOC_2)
    await fila.locator('.pr-action-btn.trash').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /eliminar/i }).click()

    await expect(page.locator('.pr-table tbody tr', { hasText: DOC_2 })).not.toBeVisible({ timeout: 8000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
    respId2 = null
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// BÚSQUEDA
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Búsqueda', () => {

  test('23 - buscar por documento filtra la tabla', async ({ page }) => {
    await irAResponsables(page)
    await page.fill('.pr-search-input', DOC_1)
    await page.waitForTimeout(400)

    const filas = page.locator('.pr-table tbody tr')
    await expect(filas.first()).toBeVisible({ timeout: 6000 })
    // Todas las filas visibles deben contener el documento
    const count = await filas.count()
    for (let i = 0; i < count; i++) {
      await expect(filas.nth(i)).toContainText(DOC_1)
    }
  })

  test('24 - búsqueda parcial filtra correctamente', async ({ page }) => {
    await irAResponsables(page)
    await page.fill('.pr-search-input', 'E2ERESP')
    await page.waitForTimeout(400)

    await expect(page.locator('.pr-table tbody tr').first()).toBeVisible({ timeout: 6000 })
  })

  test('25 - búsqueda sin resultados muestra estado vacío', async ({ page }) => {
    await irAResponsables(page)
    await page.fill('.pr-search-input', 'XXXXXXXXXNOEXISTE')
    await page.waitForTimeout(400)

    await expect(page.locator('.pr-empty')).toBeVisible()
  })

  test('26 - limpiar búsqueda restaura la lista', async ({ page }) => {
    await irAResponsables(page)
    await page.fill('.pr-search-input', 'XXXXXXXXXNOEXISTE')
    await page.waitForTimeout(400)
    await expect(page.locator('.pr-empty')).toBeVisible()

    await page.fill('.pr-search-input', '')
    await page.waitForTimeout(400)
    await expect(page.locator('.pr-table tbody tr').first()).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// PERMISOS — RECEPCIONISTA
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Permisos recepcionista', () => {

  test('27 - recepcionista no ve el ícono papelera', async ({ page }) => {
    await loginComoRecep(page)
    await irAResponsables(page)
    await expect(page.locator('.pr-action-btn.trash').first()).not.toBeVisible()
  })

  test('28 - recepcionista puede abrir modal crear', async ({ page }) => {
    await loginComoRecep(page)
    await irAResponsables(page)
    await page.locator('.pr-btn-nuevo').click()

    await expect(page.locator('.modal-box')).toBeVisible()
    await expect(page.locator('.bp-input')).toBeVisible()
    await page.locator('.modal-close').click()
  })

  test('29 - recepcionista puede abrir edición desde fila', async ({ page }) => {
    await loginComoRecep(page)
    await irAResponsables(page)

    const filas = page.locator('.pr-table tbody tr')
    if (await filas.first().isVisible()) {
      await filas.first().locator('.pr-action-btn.edit').click()
      await expect(page.locator('.modal-box')).toBeVisible()
      await expect(page.locator('.modal-title')).toContainText('Editar')
      await page.locator('.modal-close').click()
    }
  })

})
