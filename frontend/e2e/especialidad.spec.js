const { test, expect } = require('@playwright/test')

const TS    = Date.now()
const DESC_1 = `E2E-Esp-${TS}`
const DESC_2 = `E2E-Esp2-${TS}`

let espId1 = null
let espId2 = null
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
  await request.delete(`http://localhost:8000/api/especialidad/${id}/`, {
    headers: { Authorization: `Bearer ${tk}` },
  })
}

async function irAEspecialidades(page) {
  await page.goto('/clinica/configuracion/especialidades')
  await expect(page.locator('.esp-btn-nuevo')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.esp-table tbody td', { hasText: 'Cargando' }))
    .not.toBeVisible({ timeout: 8000 })
}

// Filtra la tabla por descripción antes de interactuar con una fila
async function filtrarDesc(page, desc) {
  await page.fill('.esp-search-input', desc)
  await page.waitForTimeout(400)
  const fila = page.locator('.esp-table tbody tr', { hasText: desc })
  await expect(fila).toBeVisible({ timeout: 6000 })
  return fila
}

// Login como recepcionista limpiando el estado del admin
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
  if (espId1) await apiDelete(request, espId1, tk)
  if (espId2) await apiDelete(request, espId2, tk)
})

// ══════════════════════════════════════════════════════════════════════════════
// ESTRUCTURA INICIAL
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Estructura inicial', () => {

  test('01 - carga la página con tabla, buscador y botón Nueva especialidad', async ({ page }) => {
    await irAEspecialidades(page)
    await expect(page.locator('.esp-search-input')).toBeVisible()
    await expect(page.locator('.esp-btn-nuevo')).toBeVisible()
    await expect(page.locator('.esp-table')).toBeVisible()
  })

  test('02 - sin panel lateral al entrar', async ({ page }) => {
    await irAEspecialidades(page)
    await expect(page.locator('.panel-root')).not.toBeVisible()
  })

  test('03 - tabla con encabezados Descripción y Acciones', async ({ page }) => {
    await irAEspecialidades(page)
    const headers = page.locator('.esp-table thead th')
    await expect(headers.nth(0)).toContainText('Descripción')
    await expect(headers.nth(1)).toContainText('Acciones')
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// CREAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Crear especialidad', () => {

  test('04 - botón Nueva especialidad abre panel en modo crear', async ({ page }) => {
    await irAEspecialidades(page)
    await page.locator('.esp-btn-nuevo').click()
    await expect(page.locator('.panel-root')).toBeVisible()
    await expect(page.locator('.panel-header-title')).toContainText('Nueva especialidad')
    await expect(page.locator('input[name="descripcion"]')).toBeVisible()
  })

  test('05 - botón Guardar deshabilitado con descripción vacía', async ({ page }) => {
    await irAEspecialidades(page)
    await page.locator('.esp-btn-nuevo').click()
    await expect(page.locator('.panel-footer .panel-btn-primary')).toBeDisabled()
  })

  test('06 - crear especialidad válida aparece en la tabla', async ({ page, request }) => {
    await irAEspecialidades(page)
    await page.locator('.esp-btn-nuevo').click()

    await page.fill('input[name="descripcion"]', DESC_1)
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })

    const fila = await filtrarDesc(page, DESC_1)
    await expect(fila).toBeVisible()

    token = token || await obtenerToken(request)
    const r = await request.get(`http://localhost:8000/api/especialidad/?search=${encodeURIComponent(DESC_1)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json()
    espId1 = (body.results || body).find(e => e.descripcion === DESC_1)?.id
  })

  test('07 - toast de confirmación al crear', async ({ page, request }) => {
    await irAEspecialidades(page)
    await page.locator('.esp-btn-nuevo').click()
    await page.fill('input[name="descripcion"]', DESC_2)
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })

    token = token || await obtenerToken(request)
    const r = await request.get(`http://localhost:8000/api/especialidad/?search=${encodeURIComponent(DESC_2)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json()
    espId2 = (body.results || body).find(e => e.descripcion === DESC_2)?.id
  })

  test('08 - descripción duplicada muestra error sin cerrar el panel', async ({ page }) => {
    await irAEspecialidades(page)
    await page.locator('.esp-btn-nuevo').click()
    await page.fill('input[name="descripcion"]', DESC_1)
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-root')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
  })

  test('09 - cancelar con NavigationGuard no guarda la especialidad', async ({ page }) => {
    const descCancelar = `E2E-Cancelada-${TS}`
    await irAEspecialidades(page)
    await page.locator('.esp-btn-nuevo').click()
    await page.fill('input[name="descripcion"]', descCancelar)

    await page.locator('.panel-footer .panel-btn-secondary').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 4000 })
    await expect(page.locator('.esp-table tbody', { hasText: descCancelar })).not.toBeVisible()
  })

  test('10 - F10 guarda la especialidad', async ({ page, request }) => {
    const descF10 = `E2E-F10-${TS}`
    await irAEspecialidades(page)
    await page.locator('.esp-btn-nuevo').click()
    await page.fill('input[name="descripcion"]', descF10)
    await page.keyboard.press('F10')

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })
    const fila = await filtrarDesc(page, descF10)
    await expect(fila).toBeVisible()

    token = token || await obtenerToken(request)
    const r = await request.get(`http://localhost:8000/api/especialidad/?search=${encodeURIComponent(descF10)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json()
    const id = (body.results || body).find(e => e.descripcion === descF10)?.id
    if (id) await apiDelete(request, id, token)
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// VER DETALLE
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Ver detalle', () => {

  test('11 - clic en fila abre panel en modo Detalle', async ({ page }) => {
    await irAEspecialidades(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.click()

    await expect(page.locator('.panel-root')).toBeVisible()
    await expect(page.locator('.panel-header-title')).toContainText('Detalle')
  })

  test('12 - detalle muestra la descripción correcta', async ({ page }) => {
    await irAEspecialidades(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.click()

    await expect(page.locator('.panel-body')).toContainText(DESC_1)
  })

  test('13 - detalle tiene botones Editar y Eliminar para admin', async ({ page }) => {
    await irAEspecialidades(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.click()

    await expect(page.locator('.panel-footer .panel-btn-primary')).toContainText('Editar')
    await expect(page.locator('.panel-footer .panel-btn-danger')).toContainText('Eliminar')
  })

  test('14 - hint visible en filas no seleccionadas', async ({ page }) => {
    await irAEspecialidades(page)
    const fila = await filtrarDesc(page, DESC_1)
    await expect(fila.locator('.esp-hint')).toContainText('Hacé clic para ver el detalle')
  })

  test('15 - fila activa se resalta al seleccionar', async ({ page }) => {
    await irAEspecialidades(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.click()
    await expect(fila).toHaveClass(/activo/)
  })

  test('16 - X del panel cierra el detalle', async ({ page }) => {
    await irAEspecialidades(page)
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

test.describe('Editar especialidad', () => {

  test('17 - ícono lápiz abre panel en modo editar', async ({ page }) => {
    await irAEspecialidades(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.locator('.esp-action-btn.edit').click()

    await expect(page.locator('.panel-root')).toBeVisible()
    await expect(page.locator('.panel-header-title')).toContainText('Editar especialidad')
    await expect(page.locator('input[name="descripcion"]')).toBeVisible()
  })

  test('18 - panel de edición trae la descripción precargada', async ({ page }) => {
    await irAEspecialidades(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.locator('.esp-action-btn.edit').click()

    await expect(page.locator('input[name="descripcion"]')).toHaveValue(DESC_1)
  })

  test('19 - editar descripción guarda el cambio', async ({ page }) => {
    const descEditada = `${DESC_1}-Editada`
    await irAEspecialidades(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.locator('.esp-action-btn.edit').click()

    await page.fill('input[name="descripcion"]', descEditada)
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })

    const filaEditada = await filtrarDesc(page, descEditada)
    await filaEditada.click()
    await expect(page.locator('.panel-body')).toContainText(descEditada)

    // Restaurar el nombre original para los siguientes tests
    await page.locator('.panel-footer .panel-btn-primary').click()
    await page.fill('input[name="descripcion"]', DESC_1)
    await page.locator('.panel-footer .panel-btn-primary').click()
    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })
  })

  test('20 - botón Editar del panel de detalle cambia al modo edición', async ({ page }) => {
    await irAEspecialidades(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.click()
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-header-title')).toContainText('Editar especialidad')
    await expect(page.locator('input[name="descripcion"]')).toBeVisible()
  })

  test('21 - editar con descripción duplicada de otra muestra error', async ({ page }) => {
    await irAEspecialidades(page)
    const fila = await filtrarDesc(page, DESC_2)
    await fila.locator('.esp-action-btn.edit').click()

    await page.fill('input[name="descripcion"]', DESC_1)
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-root')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
  })

  test('22 - cancelar edición con guard no guarda cambios', async ({ page }) => {
    await irAEspecialidades(page)
    const fila = await filtrarDesc(page, DESC_1)
    await fila.locator('.esp-action-btn.edit').click()

    await page.fill('input[name="descripcion"]', `${DESC_1}-NO-GUARDAR`)
    await page.locator('.panel-footer .panel-btn-secondary').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 4000 })
    await expect(await filtrarDesc(page, DESC_1)).toBeVisible()
    await expect(page.locator('.esp-table tbody', { hasText: `${DESC_1}-NO-GUARDAR` })).not.toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// ELIMINAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Eliminar especialidad', () => {

  test('23 - ícono papelera muestra ConfirmDialog', async ({ page }) => {
    await irAEspecialidades(page)
    const fila = await filtrarDesc(page, DESC_2)
    await fila.locator('.esp-action-btn.trash').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.cd-backdrop')).toContainText('Eliminar especialidad')
  })

  test('24 - ConfirmDialog menciona prestadores asignados', async ({ page }) => {
    await irAEspecialidades(page)
    const fila = await filtrarDesc(page, DESC_2)
    await fila.locator('.esp-action-btn.trash').click()

    await expect(page.locator('.cd-backdrop')).toContainText('prestadores')
    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
  })

  test('25 - cancelar eliminación mantiene el registro', async ({ page }) => {
    await irAEspecialidades(page)
    const fila = await filtrarDesc(page, DESC_2)
    await fila.locator('.esp-action-btn.trash').click()

    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
    await expect(page.locator('.cd-overlay')).not.toBeVisible({ timeout: 4000 })
    await expect(page.locator('.esp-table tbody tr', { hasText: DESC_2 })).toBeVisible()
  })

  test('26 - confirmar eliminación quita el registro de la tabla', async ({ page }) => {
    await irAEspecialidades(page)
    const fila = await filtrarDesc(page, DESC_2)
    await fila.locator('.esp-action-btn.trash').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /eliminar/i }).click()

    await expect(page.locator('.esp-table tbody tr', { hasText: DESC_2 })).not.toBeVisible({ timeout: 8000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
    espId2 = null
  })

  test('27 - botón Eliminar del panel dispara ConfirmDialog', async ({ page }) => {
    await irAEspecialidades(page)
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

  test('28 - buscar por descripción filtra la tabla', async ({ page }) => {
    await irAEspecialidades(page)
    await page.fill('.esp-search-input', DESC_1)
    await page.waitForTimeout(400)

    const filas = page.locator('.esp-table tbody tr')
    const count = await filas.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(filas.nth(i)).toContainText(DESC_1)
    }
  })

  test('29 - búsqueda parcial (primeras letras) filtra correctamente', async ({ page }) => {
    await irAEspecialidades(page)
    // DESC_1 empieza con "E2E-Esp-"
    await page.fill('.esp-search-input', 'E2E-Esp-')
    await page.waitForTimeout(400)

    await expect(page.locator('.esp-table tbody tr').first()).toBeVisible({ timeout: 6000 })
    await expect(page.locator('.esp-table tbody tr').first()).toContainText('E2E-Esp-')
  })

  test('30 - búsqueda sin resultados muestra estado vacío', async ({ page }) => {
    await irAEspecialidades(page)
    await page.fill('.esp-search-input', 'XXXXXXXXXNOEXISTE')
    await page.waitForTimeout(400)

    await expect(page.locator('.esp-empty')).toBeVisible()
    await expect(page.locator('.esp-empty')).toContainText('Sin especialidades')
  })

  test('31 - limpiar búsqueda restaura la lista', async ({ page }) => {
    await irAEspecialidades(page)
    await page.fill('.esp-search-input', 'XXXXXXXXXNOEXISTE')
    await page.waitForTimeout(400)
    await expect(page.locator('.esp-empty')).toBeVisible()

    await page.fill('.esp-search-input', '')
    await page.waitForTimeout(400)
    await expect(page.locator('.esp-table tbody tr').first()).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// PERMISOS — RECEPCIONISTA
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Permisos recepcionista', () => {

  test('32 - recepcionista no ve el ícono papelera', async ({ page }) => {
    await loginComoRecep(page)
    await irAEspecialidades(page)
    await expect(page.locator('.esp-action-btn.trash').first()).not.toBeVisible()
  })

  test('33 - recepcionista puede abrir panel crear', async ({ page }) => {
    await loginComoRecep(page)
    await irAEspecialidades(page)
    await page.locator('.esp-btn-nuevo').click()

    await expect(page.locator('.panel-root')).toBeVisible()
    await expect(page.locator('input[name="descripcion"]')).toBeVisible()
  })

  test('34 - recepcionista no ve botón Eliminar en el panel de detalle', async ({ page }) => {
    await loginComoRecep(page)
    await irAEspecialidades(page)

    const filas = page.locator('.esp-table tbody tr')
    await expect(page.locator('.esp-table tbody td', { hasText: 'Cargando' }))
      .not.toBeVisible({ timeout: 8000 })
    if (await filas.first().isVisible()) {
      await filas.first().click()
      await expect(page.locator('.panel-root')).toBeVisible()
      await expect(page.locator('.panel-footer .panel-btn-danger')).not.toBeVisible()
    }
  })

})
