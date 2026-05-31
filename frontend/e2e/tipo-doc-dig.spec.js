const { test, expect } = require('@playwright/test')

const TS    = Date.now()
const DESC_1 = `E2E-TDD-${TS}`
const KEY_1  = `e2e_tdd_${TS}`
const DESC_2 = `E2E-TDD2-${TS}`
const KEY_2  = `e2e_tdd2_${TS}`

let tddId1 = null
let tddId2 = null
let token  = null

// ─── helpers ──────────────────────────────────────────────────────────────────

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

async function apiDelete(request, id, tk) {
  await request.delete(`http://localhost:8000/api/tipo-doc-dig/${id}/`, {
    headers: { Authorization: `Bearer ${tk}` },
  })
}

async function irATipoDocDig(page) {
  await page.goto('/mantenimiento/tipo-doc')
  await expect(page.locator('.tdd-btn-nuevo')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.tdd-table tbody td', { hasText: 'Cargando' }))
    .not.toBeVisible({ timeout: 8000 })
}

async function filtrarDesc(page, desc) {
  await page.fill('.tdd-search-input', desc)
  await page.waitForTimeout(400)
  const fila = page.locator('.tdd-table tbody tr', { hasText: desc })
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
  if (tddId1) await apiDelete(request, tddId1, tk)
  if (tddId2) await apiDelete(request, tddId2, tk)
})

// ══════════════════════════════════════════════════════════════════════════════
// ESTRUCTURA INICIAL
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Estructura inicial', () => {

  test('01 - carga la página con tabla, buscador y botón Nuevo', async ({ page }) => {
    await irATipoDocDig(page)
    await expect(page.locator('.tdd-search-input')).toBeVisible()
    await expect(page.locator('.tdd-btn-nuevo')).toBeVisible()
    await expect(page.locator('.tdd-table')).toBeVisible()
  })

  test('02 - sin panel lateral al entrar', async ({ page }) => {
    await irATipoDocDig(page)
    await expect(page.locator('.panel-root')).not.toBeVisible()
  })

  test('03 - tabla con encabezados Descripción, Clave y Acciones', async ({ page }) => {
    await irATipoDocDig(page)
    const headers = page.locator('.tdd-table thead th')
    await expect(headers.nth(0)).toContainText('Descripción')
    await expect(headers.nth(1)).toContainText('Clave')
    await expect(headers.nth(2)).toContainText('Acciones')
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// CREAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Crear tipo de documento', () => {

  test('04 - botón Nuevo abre panel en modo crear con ambos campos', async ({ page }) => {
    await irATipoDocDig(page)
    await page.locator('.tdd-btn-nuevo').click()
    await expect(page.locator('.panel-root')).toBeVisible()
    await expect(page.locator('.panel-header-title')).toContainText('Nuevo tipo de documento')
    await expect(page.locator('input[name="descripcion"]')).toBeVisible()
    await expect(page.locator('input[name="storage_key"]')).toBeVisible()
  })

  test('05 - botón Guardar deshabilitado con campos vacíos', async ({ page }) => {
    await irATipoDocDig(page)
    await page.locator('.tdd-btn-nuevo').click()
    await expect(page.locator('.panel-footer .panel-btn-primary')).toBeDisabled()
  })

  test('06 - crear tipo válido aparece en la tabla', async ({ page, request }) => {
    await irATipoDocDig(page)
    await page.locator('.tdd-btn-nuevo').click()

    await page.fill('input[name="descripcion"]', DESC_1)
    await page.fill('input[name="storage_key"]', KEY_1)
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })
    const fila = await filtrarDesc(page, DESC_1)
    await expect(fila).toBeVisible()

    token = token || await obtenerToken(request)
    const r = await request.get(`http://localhost:8000/api/tipo-doc-dig/?search=${encodeURIComponent(DESC_1)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json()
    tddId1 = (body.results || body).find(t => t.descripcion === DESC_1)?.id
  })

  test('07 - toast de confirmación al crear', async ({ page, request }) => {
    await irATipoDocDig(page)
    await page.locator('.tdd-btn-nuevo').click()
    await page.fill('input[name="descripcion"]', DESC_2)
    await page.fill('input[name="storage_key"]', KEY_2)
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })

    token = token || await obtenerToken(request)
    const r = await request.get(`http://localhost:8000/api/tipo-doc-dig/?search=${encodeURIComponent(DESC_2)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json()
    tddId2 = (body.results || body).find(t => t.descripcion === DESC_2)?.id
  })

  test('08 - descripción duplicada muestra error sin cerrar el panel', async ({ page }) => {
    await irATipoDocDig(page)
    await page.locator('.tdd-btn-nuevo').click()
    await page.fill('input[name="descripcion"]', DESC_1)
    await page.fill('input[name="storage_key"]', 'key_unico_dup_test')
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-root')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
  })

  test('09 - storage_key duplicada muestra error sin cerrar el panel', async ({ page }) => {
    await irATipoDocDig(page)
    await page.locator('.tdd-btn-nuevo').click()
    await page.fill('input[name="descripcion"]', 'Desc Unica Dup Key Test')
    await page.fill('input[name="storage_key"]', KEY_1)
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-root')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
  })

  test('10 - cancelar con NavigationGuard no guarda', async ({ page }) => {
    const descCanc = `E2E-TDD-Canc-${TS}`
    await irATipoDocDig(page)
    await page.locator('.tdd-btn-nuevo').click()
    await page.fill('input[name="descripcion"]', descCanc)

    await page.locator('.panel-footer .panel-btn-secondary').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 4000 })
    await expect(page.locator('.tdd-table tbody', { hasText: descCanc })).not.toBeVisible()
  })

  test('11 - F10 guarda el tipo de documento', async ({ page, request }) => {
    const descF10 = `E2E-TDD-F10-${TS}`
    const keyF10  = `e2e_tdd_f10_${TS}`
    await irATipoDocDig(page)
    await page.locator('.tdd-btn-nuevo').click()
    await page.fill('input[name="descripcion"]', descF10)
    await page.fill('input[name="storage_key"]', keyF10)
    await page.keyboard.press('F10')

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })
    const fila = await filtrarDesc(page, descF10)
    await expect(fila).toBeVisible()

    token = token || await obtenerToken(request)
    const r = await request.get(`http://localhost:8000/api/tipo-doc-dig/?search=${encodeURIComponent(descF10)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json()
    const id = (body.results || body).find(t => t.descripcion === descF10)?.id
    if (id) await apiDelete(request, id, token)
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// VER DETALLE
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Ver detalle', () => {

  test('12 - clic en fila abre panel en modo Detalle', async ({ page }) => {
    await irATipoDocDig(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.click()

    await expect(page.locator('.panel-root')).toBeVisible()
    await expect(page.locator('.panel-header-title')).toContainText('Detalle')
  })

  test('13 - detalle muestra descripción y clave de almacenamiento', async ({ page }) => {
    await irATipoDocDig(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.click()

    await expect(page.locator('.panel-body')).toContainText(DESC_1)
    await expect(page.locator('.panel-body')).toContainText(KEY_1)
  })

  test('14 - detalle tiene botones Editar y Eliminar para admin', async ({ page }) => {
    await irATipoDocDig(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.click()

    await expect(page.locator('.panel-footer .panel-btn-primary')).toContainText('Editar')
    await expect(page.locator('.panel-footer .panel-btn-danger')).toContainText('Eliminar')
  })

  test('15 - hint visible en filas no seleccionadas', async ({ page }) => {
    await irATipoDocDig(page)
    const fila = await filtrarDesc(page, DESC_1)
    await expect(fila.locator('.tdd-hint')).toContainText('Hacé clic para ver el detalle')
  })

  test('16 - fila activa se resalta al seleccionar', async ({ page }) => {
    await irATipoDocDig(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.click()
    await expect(fila).toHaveClass(/activo/)
  })

  test('17 - X del panel cierra el detalle', async ({ page }) => {
    await irATipoDocDig(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.click()
    await expect(page.locator('.panel-root')).toBeVisible()
    await page.locator('.panel-close').click()
    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 4000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// EDITAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Editar tipo de documento', () => {

  test('18 - ícono lápiz abre panel en modo editar', async ({ page }) => {
    await irATipoDocDig(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.locator('.tdd-action-btn.edit').click()

    await expect(page.locator('.panel-root')).toBeVisible()
    await expect(page.locator('.panel-header-title')).toContainText('Editar tipo de documento')
  })

  test('19 - panel de edición trae descripción precargada', async ({ page }) => {
    await irATipoDocDig(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.locator('.tdd-action-btn.edit').click()

    await expect(page.locator('input[name="descripcion"]')).toHaveValue(DESC_1)
  })

  test('20 - storage_key aparece como solo lectura en edición', async ({ page }) => {
    await irATipoDocDig(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.locator('.tdd-action-btn.edit').click()

    // soloLectura: true renderiza el campo como div.panel-value-readonly, no como input
    await expect(page.locator('.panel-value-readonly')).toBeVisible()
    await expect(page.locator('.panel-readonly-badge')).toContainText('No editable')
    await expect(page.locator('input[name="storage_key"]')).not.toBeVisible()
  })

  test('21 - editar descripción guarda el cambio', async ({ page }) => {
    const descEditada = `${DESC_1}-Edit`
    await irATipoDocDig(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.locator('.tdd-action-btn.edit').click()

    await page.fill('input[name="descripcion"]', descEditada)
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })
    const filaEditada = await filtrarDesc(page, descEditada)
    await filaEditada.click()
    await expect(page.locator('.panel-body')).toContainText(descEditada)

    // Restaurar nombre original
    await page.locator('.panel-footer .panel-btn-primary').click()
    await page.fill('input[name="descripcion"]', DESC_1)
    await page.locator('.panel-footer .panel-btn-primary').click()
    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })
  })

  test('22 - botón Editar del panel de detalle cambia al modo edición', async ({ page }) => {
    await irATipoDocDig(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.click()
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-header-title')).toContainText('Editar tipo de documento')
    await expect(page.locator('input[name="descripcion"]')).toBeVisible()
  })

  test('23 - editar con descripción duplicada de otro muestra error', async ({ page }) => {
    await irATipoDocDig(page)
    const fila = await filtrarDesc(page, DESC_2)
    await fila.locator('.tdd-action-btn.edit').click()

    await page.fill('input[name="descripcion"]', DESC_1)
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-root')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
  })

  test('24 - cancelar edición con guard no guarda cambios', async ({ page }) => {
    await irATipoDocDig(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.locator('.tdd-action-btn.edit').click()

    await page.fill('input[name="descripcion"]', `${DESC_1}-NO-GUARDAR`)
    await page.locator('.panel-footer .panel-btn-secondary').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 4000 })
    await expect(await filtrarDesc(page, DESC_1)).toBeVisible()
    await expect(page.locator('.tdd-table tbody', { hasText: `${DESC_1}-NO-GUARDAR` })).not.toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// ELIMINAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Eliminar tipo de documento', () => {

  test('25 - ícono papelera muestra ConfirmDialog', async ({ page }) => {
    await irATipoDocDig(page)
    const fila = await filtrarDesc(page, DESC_2)
    await fila.locator('.tdd-action-btn.trash').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.cd-backdrop')).toContainText('Eliminar')
  })

  test('26 - ConfirmDialog menciona documentos vinculados', async ({ page }) => {
    await irATipoDocDig(page)
    const fila = await filtrarDesc(page, DESC_2)
    await fila.locator('.tdd-action-btn.trash').click()

    await expect(page.locator('.cd-backdrop')).toContainText('documentos')
    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
  })

  test('27 - cancelar eliminación mantiene el registro', async ({ page }) => {
    await irATipoDocDig(page)
    const fila = await filtrarDesc(page, DESC_2)
    await fila.locator('.tdd-action-btn.trash').click()

    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
    await expect(page.locator('.cd-overlay')).not.toBeVisible({ timeout: 4000 })
    await expect(page.locator('.tdd-table tbody tr', { hasText: DESC_2 })).toBeVisible()
  })

  test('28 - confirmar eliminación quita el registro de la tabla', async ({ page }) => {
    await irATipoDocDig(page)
    const fila = await filtrarDesc(page, DESC_2)
    await fila.locator('.tdd-action-btn.trash').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /eliminar/i }).click()

    await expect(page.locator('.tdd-table tbody tr', { hasText: DESC_2 })).not.toBeVisible({ timeout: 8000 })
    tddId2 = null
  })

  test('29 - botón Eliminar del panel dispara ConfirmDialog', async ({ page }) => {
    await irATipoDocDig(page)
    const fila = await filtrarDesc(page, DESC_1)
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

  test('30 - buscar por descripción filtra la tabla', async ({ page }) => {
    await irATipoDocDig(page)
    await page.fill('.tdd-search-input', DESC_1)
    await page.waitForTimeout(400)

    const filas = page.locator('.tdd-table tbody tr')
    const count = await filas.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(filas.nth(i)).toContainText(DESC_1)
    }
  })

  test('31 - buscar por clave de almacenamiento filtra la tabla', async ({ page }) => {
    await irATipoDocDig(page)
    await page.fill('.tdd-search-input', KEY_1)
    await page.waitForTimeout(400)

    await expect(page.locator('.tdd-table tbody tr').first()).toBeVisible({ timeout: 6000 })
    await expect(page.locator('.tdd-table tbody tr').first()).toContainText(DESC_1)
  })

  test('32 - búsqueda sin resultados muestra estado vacío', async ({ page }) => {
    await irATipoDocDig(page)
    await page.fill('.tdd-search-input', 'XXXXXXXXXNOEXISTE')
    await page.waitForTimeout(400)

    await expect(page.locator('.tdd-empty')).toBeVisible()
    await expect(page.locator('.tdd-empty')).toContainText('Sin tipos de documento')
  })

  test('33 - limpiar búsqueda restaura la lista', async ({ page }) => {
    await irATipoDocDig(page)
    await page.fill('.tdd-search-input', 'XXXXXXXXXNOEXISTE')
    await page.waitForTimeout(400)
    await expect(page.locator('.tdd-empty')).toBeVisible()

    await page.fill('.tdd-search-input', '')
    await page.waitForTimeout(400)
    await expect(page.locator('.tdd-table tbody tr').first()).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// PERMISOS — RECEPCIONISTA
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Permisos recepcionista', () => {

  test('34 - recepcionista no ve el ícono papelera', async ({ page }) => {
    await loginComoRecep(page)
    await irATipoDocDig(page)
    await expect(page.locator('.tdd-action-btn.trash').first()).not.toBeVisible()
  })

  test('35 - recepcionista puede abrir panel crear', async ({ page }) => {
    await loginComoRecep(page)
    await irATipoDocDig(page)
    await page.locator('.tdd-btn-nuevo').click()

    await expect(page.locator('.panel-root')).toBeVisible()
    await expect(page.locator('input[name="descripcion"]')).toBeVisible()
    await expect(page.locator('input[name="storage_key"]')).toBeVisible()
  })

  test('36 - recepcionista no ve botón Eliminar en el panel de detalle', async ({ page }) => {
    await loginComoRecep(page)
    await irATipoDocDig(page)

    const filas = page.locator('.tdd-table tbody tr')
    await expect(page.locator('.tdd-table tbody td', { hasText: 'Cargando' }))
      .not.toBeVisible({ timeout: 8000 })
    if (await filas.first().isVisible()) {
      await filas.first().click()
      await expect(page.locator('.panel-root')).toBeVisible()
      await expect(page.locator('.panel-footer .panel-btn-danger')).not.toBeVisible()
    }
  })

})
