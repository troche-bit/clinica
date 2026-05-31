const { test, expect } = require('@playwright/test')

const TS     = Date.now()
const TIPO_1 = `E2E-Ev-${TS}`
const TIPO_2 = `E2E-Ev2-${TS}`

let evId1 = null
let evId2 = null
let token = null

// ─── helpers ──────────────────────────────────────────────────────────────────

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

async function apiDelete(request, id, tk) {
  await request.delete(`http://localhost:8000/api/eventoclinico/${id}/`, {
    headers: { Authorization: `Bearer ${tk}` },
  })
}

async function irAEventosClinicos(page) {
  await page.goto('/consultas/eventos')
  await expect(page.locator('.ec-btn-nuevo')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.ec-table tbody td', { hasText: 'Cargando' }))
    .not.toBeVisible({ timeout: 8000 })
}

async function filtrarTipo(page, tipo) {
  await page.fill('.ec-search-input', tipo)
  await page.waitForTimeout(400)
  const fila = page.locator('.ec-table tbody tr', { hasText: tipo })
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

// ─── limpieza global ──────────────────────────────────────────────────────────

test.afterAll(async ({ request }) => {
  const tk = token || (await obtenerToken(request))
  if (evId1) await apiDelete(request, evId1, tk)
  if (evId2) await apiDelete(request, evId2, tk)
})

// ══════════════════════════════════════════════════════════════════════════════
// ESTRUCTURA INICIAL
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Estructura inicial', () => {

  test('01 - carga la página con tabla, buscador y botón Nuevo', async ({ page }) => {
    await irAEventosClinicos(page)
    await expect(page.locator('.ec-search-input')).toBeVisible()
    await expect(page.locator('.ec-btn-nuevo')).toBeVisible()
    await expect(page.locator('.ec-table')).toBeVisible()
  })

  test('02 - sin panel lateral al entrar', async ({ page }) => {
    await irAEventosClinicos(page)
    await expect(page.locator('.panel-root')).not.toBeVisible()
  })

  test('03 - tabla con encabezados Tipo de evento y Acciones', async ({ page }) => {
    await irAEventosClinicos(page)
    const headers = page.locator('.ec-table thead th')
    await expect(headers.nth(0)).toContainText('Tipo de evento')
    await expect(headers.nth(1)).toContainText('Acciones')
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// CREAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Crear evento clínico', () => {

  test('04 - botón Nuevo abre panel en modo crear', async ({ page }) => {
    await irAEventosClinicos(page)
    await page.locator('.ec-btn-nuevo').click()
    await expect(page.locator('.panel-root')).toBeVisible()
    await expect(page.locator('.panel-header-title')).toContainText('Nuevo evento clínico')
    await expect(page.locator('input[name="tipo_evento"]')).toBeVisible()
  })

  test('05 - botón Guardar deshabilitado con tipo vacío', async ({ page }) => {
    await irAEventosClinicos(page)
    await page.locator('.ec-btn-nuevo').click()
    await expect(page.locator('.panel-footer .panel-btn-primary')).toBeDisabled()
  })

  test('06 - crear evento válido aparece en la tabla', async ({ page, request }) => {
    await irAEventosClinicos(page)
    await page.locator('.ec-btn-nuevo').click()

    await page.fill('input[name="tipo_evento"]', TIPO_1)
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })

    const fila = await filtrarTipo(page, TIPO_1)
    await expect(fila).toBeVisible()

    token = token || await obtenerToken(request)
    const r = await request.get(`http://localhost:8000/api/eventoclinico/?search=${encodeURIComponent(TIPO_1)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json()
    evId1 = (body.results || body).find(e => e.tipo_evento === TIPO_1)?.id
  })

  test('07 - toast de confirmación al crear', async ({ page, request }) => {
    await irAEventosClinicos(page)
    await page.locator('.ec-btn-nuevo').click()
    await page.fill('input[name="tipo_evento"]', TIPO_2)
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })

    token = token || await obtenerToken(request)
    const r = await request.get(`http://localhost:8000/api/eventoclinico/?search=${encodeURIComponent(TIPO_2)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json()
    evId2 = (body.results || body).find(e => e.tipo_evento === TIPO_2)?.id
  })

  test('08 - tipo duplicado muestra error sin cerrar el panel', async ({ page }) => {
    await irAEventosClinicos(page)
    await page.locator('.ec-btn-nuevo').click()
    await page.fill('input[name="tipo_evento"]', TIPO_1)
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-root')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
  })

  test('09 - cancelar con NavigationGuard no guarda el evento', async ({ page }) => {
    const tipoCancelar = `E2E-Cancelado-${TS}`
    await irAEventosClinicos(page)
    await page.locator('.ec-btn-nuevo').click()
    await page.fill('input[name="tipo_evento"]', tipoCancelar)

    await page.locator('.panel-footer .panel-btn-secondary').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 4000 })
    await expect(page.locator('.ec-table tbody', { hasText: tipoCancelar })).not.toBeVisible()
  })

  test('10 - F10 guarda el evento clínico', async ({ page, request }) => {
    const tipoF10 = `E2E-F10-${TS}`
    await irAEventosClinicos(page)
    await page.locator('.ec-btn-nuevo').click()
    await page.fill('input[name="tipo_evento"]', tipoF10)
    await page.keyboard.press('F10')

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })
    const fila = await filtrarTipo(page, tipoF10)
    await expect(fila).toBeVisible()

    token = token || await obtenerToken(request)
    const r = await request.get(`http://localhost:8000/api/eventoclinico/?search=${encodeURIComponent(tipoF10)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json()
    const id = (body.results || body).find(e => e.tipo_evento === tipoF10)?.id
    if (id) await apiDelete(request, id, token)
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// VER DETALLE
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Ver detalle', () => {

  test('11 - clic en fila abre panel en modo Detalle', async ({ page }) => {
    await irAEventosClinicos(page)
    const fila = await filtrarTipo(page, TIPO_1)
    await fila.click()

    await expect(page.locator('.panel-root')).toBeVisible()
    await expect(page.locator('.panel-header-title')).toContainText('Detalle')
  })

  test('12 - detalle muestra el tipo de evento correcto', async ({ page }) => {
    await irAEventosClinicos(page)
    const fila = await filtrarTipo(page, TIPO_1)
    await fila.click()

    await expect(page.locator('.panel-body')).toContainText(TIPO_1)
  })

  test('13 - detalle tiene botones Editar y Eliminar para admin', async ({ page }) => {
    await irAEventosClinicos(page)
    const fila = await filtrarTipo(page, TIPO_1)
    await fila.click()

    await expect(page.locator('.panel-footer .panel-btn-primary')).toContainText('Editar')
    await expect(page.locator('.panel-footer .panel-btn-danger')).toContainText('Eliminar')
  })

  test('14 - hint visible en filas no seleccionadas', async ({ page }) => {
    await irAEventosClinicos(page)
    const fila = await filtrarTipo(page, TIPO_1)
    await expect(fila.locator('.ec-hint')).toContainText('Hacé clic para ver el detalle')
  })

  test('15 - fila activa se resalta al seleccionar', async ({ page }) => {
    await irAEventosClinicos(page)
    const fila = await filtrarTipo(page, TIPO_1)
    await fila.click()
    await expect(fila).toHaveClass(/activo/)
  })

  test('16 - X del panel cierra el detalle', async ({ page }) => {
    await irAEventosClinicos(page)
    const fila = await filtrarTipo(page, TIPO_1)
    await fila.click()
    await expect(page.locator('.panel-root')).toBeVisible()
    await page.locator('.panel-close').click()
    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 4000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// EDITAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Editar evento clínico', () => {

  test('17 - ícono lápiz abre panel en modo editar', async ({ page }) => {
    await irAEventosClinicos(page)
    const fila = await filtrarTipo(page, TIPO_1)
    await fila.locator('.ec-action-btn.edit').click()

    await expect(page.locator('.panel-root')).toBeVisible()
    await expect(page.locator('.panel-header-title')).toContainText('Editar evento clínico')
    await expect(page.locator('input[name="tipo_evento"]')).toBeVisible()
  })

  test('18 - panel de edición trae el tipo precargado', async ({ page }) => {
    await irAEventosClinicos(page)
    const fila = await filtrarTipo(page, TIPO_1)
    await fila.locator('.ec-action-btn.edit').click()

    await expect(page.locator('input[name="tipo_evento"]')).toHaveValue(TIPO_1)
  })

  test('19 - editar tipo de evento guarda el cambio', async ({ page }) => {
    const tipoEditado = `${TIPO_1}-Editado`
    await irAEventosClinicos(page)
    const fila = await filtrarTipo(page, TIPO_1)
    await fila.locator('.ec-action-btn.edit').click()

    await page.fill('input[name="tipo_evento"]', tipoEditado)
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })

    const filaEditada = await filtrarTipo(page, tipoEditado)
    await filaEditada.click()
    await expect(page.locator('.panel-body')).toContainText(tipoEditado)

    // Restaurar nombre original para los tests siguientes
    await page.locator('.panel-footer .panel-btn-primary').click()
    await page.fill('input[name="tipo_evento"]', TIPO_1)
    await page.locator('.panel-footer .panel-btn-primary').click()
    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })
  })

  test('20 - botón Editar del panel de detalle cambia al modo edición', async ({ page }) => {
    await irAEventosClinicos(page)
    const fila = await filtrarTipo(page, TIPO_1)
    await fila.click()
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-header-title')).toContainText('Editar evento clínico')
    await expect(page.locator('input[name="tipo_evento"]')).toBeVisible()
  })

  test('21 - editar con tipo duplicado de otro muestra error', async ({ page }) => {
    await irAEventosClinicos(page)
    const fila = await filtrarTipo(page, TIPO_2)
    await fila.locator('.ec-action-btn.edit').click()

    await page.fill('input[name="tipo_evento"]', TIPO_1)
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-root')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
  })

  test('22 - cancelar edición con guard no guarda cambios', async ({ page }) => {
    await irAEventosClinicos(page)
    const fila = await filtrarTipo(page, TIPO_1)
    await fila.locator('.ec-action-btn.edit').click()

    await page.fill('input[name="tipo_evento"]', `${TIPO_1}-NO-GUARDAR`)
    await page.locator('.panel-footer .panel-btn-secondary').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 4000 })
    await expect(await filtrarTipo(page, TIPO_1)).toBeVisible()
    await expect(page.locator('.ec-table tbody', { hasText: `${TIPO_1}-NO-GUARDAR` })).not.toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// ELIMINAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Eliminar evento clínico', () => {

  test('23 - ícono papelera muestra ConfirmDialog', async ({ page }) => {
    await irAEventosClinicos(page)
    const fila = await filtrarTipo(page, TIPO_2)
    await fila.locator('.ec-action-btn.trash').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.cd-backdrop')).toContainText('Eliminar evento clínico')
  })

  test('24 - ConfirmDialog menciona consultas vinculadas', async ({ page }) => {
    await irAEventosClinicos(page)
    const fila = await filtrarTipo(page, TIPO_2)
    await fila.locator('.ec-action-btn.trash').click()

    await expect(page.locator('.cd-backdrop')).toContainText('consultas')
    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
  })

  test('25 - cancelar eliminación mantiene el registro', async ({ page }) => {
    await irAEventosClinicos(page)
    const fila = await filtrarTipo(page, TIPO_2)
    await fila.locator('.ec-action-btn.trash').click()

    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
    await expect(page.locator('.cd-overlay')).not.toBeVisible({ timeout: 4000 })
    await expect(page.locator('.ec-table tbody tr', { hasText: TIPO_2 })).toBeVisible()
  })

  test('26 - confirmar eliminación quita el registro de la tabla', async ({ page }) => {
    await irAEventosClinicos(page)
    const fila = await filtrarTipo(page, TIPO_2)
    await fila.locator('.ec-action-btn.trash').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /eliminar/i }).click()

    await expect(page.locator('.ec-table tbody tr', { hasText: TIPO_2 })).not.toBeVisible({ timeout: 8000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
    evId2 = null
  })

  test('27 - botón Eliminar del panel dispara ConfirmDialog', async ({ page }) => {
    await irAEventosClinicos(page)
    const fila = await filtrarTipo(page, TIPO_1)
    await fila.click()
    await expect(page.locator('.panel-root')).toBeVisible()

    await page.locator('.panel-footer .panel-btn-danger').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })

    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// BÚSQUEDA
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Búsqueda', () => {

  test('28 - buscar por tipo de evento filtra la tabla', async ({ page }) => {
    await irAEventosClinicos(page)
    await page.fill('.ec-search-input', TIPO_1)
    await page.waitForTimeout(400)

    const filas = page.locator('.ec-table tbody tr')
    const count = await filas.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(filas.nth(i)).toContainText(TIPO_1)
    }
  })

  test('29 - búsqueda parcial filtra correctamente', async ({ page }) => {
    await irAEventosClinicos(page)
    await page.fill('.ec-search-input', 'E2E-Ev-')
    await page.waitForTimeout(400)

    await expect(page.locator('.ec-table tbody tr').first()).toBeVisible({ timeout: 6000 })
    await expect(page.locator('.ec-table tbody tr').first()).toContainText('E2E-Ev-')
  })

  test('30 - búsqueda sin resultados muestra estado vacío', async ({ page }) => {
    await irAEventosClinicos(page)
    await page.fill('.ec-search-input', 'XXXXXXXXXNOEXISTE')
    await page.waitForTimeout(400)

    await expect(page.locator('.ec-empty')).toBeVisible()
    await expect(page.locator('.ec-empty')).toContainText('Sin eventos')
  })

  test('31 - limpiar búsqueda restaura la lista', async ({ page }) => {
    await irAEventosClinicos(page)
    await page.fill('.ec-search-input', 'XXXXXXXXXNOEXISTE')
    await page.waitForTimeout(400)
    await expect(page.locator('.ec-empty')).toBeVisible()

    await page.fill('.ec-search-input', '')
    await page.waitForTimeout(400)
    await expect(page.locator('.ec-table tbody tr').first()).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// PERMISOS — RECEPCIONISTA
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Permisos recepcionista', () => {

  test('32 - recepcionista no ve el ícono papelera', async ({ page }) => {
    await loginComoRecep(page)
    await irAEventosClinicos(page)
    await expect(page.locator('.ec-action-btn.trash').first()).not.toBeVisible()
  })

  test('33 - recepcionista puede abrir panel crear', async ({ page }) => {
    await loginComoRecep(page)
    await irAEventosClinicos(page)
    await page.locator('.ec-btn-nuevo').click()

    await expect(page.locator('.panel-root')).toBeVisible()
    await expect(page.locator('input[name="tipo_evento"]')).toBeVisible()
  })

  test('34 - recepcionista no ve botón Eliminar en el panel de detalle', async ({ page }) => {
    await loginComoRecep(page)
    await irAEventosClinicos(page)

    const filas = page.locator('.ec-table tbody tr')
    await expect(page.locator('.ec-table tbody td', { hasText: 'Cargando' }))
      .not.toBeVisible({ timeout: 8000 })
    if (await filas.first().isVisible()) {
      await filas.first().click()
      await expect(page.locator('.panel-root')).toBeVisible()
      await expect(page.locator('.panel-footer .panel-btn-danger')).not.toBeVisible()
    }
  })

})
