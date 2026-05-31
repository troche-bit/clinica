const { test, expect } = require('@playwright/test')

const TS    = Date.now()
const NRO_1 = `E2E-C-${TS}`
const NRO_2 = `E2E-C2-${TS}`

let consId1 = null
let consId2 = null
let token   = null

// ─── helpers ──────────────────────────────────────────────────────────────────

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

async function apiDelete(request, id, tk) {
  await request.delete(`http://localhost:8000/api/consultorio/${id}/`, {
    headers: { Authorization: `Bearer ${tk}` },
  })
}

async function irAConsultorios(page) {
  await page.goto('/mantenimiento/consultorios')
  await expect(page.locator('.con-btn-nuevo')).toBeVisible({ timeout: 10000 })
  // Esperar que el estado "Cargando..." desaparezca antes de interactuar
  await expect(page.locator('.con-table tbody td', { hasText: 'Cargando' }))
    .not.toBeVisible({ timeout: 8000 })
}

// Filtra por nro antes de interactuar — evita fallos si la lista es larga
async function filtrarNro(page, nro) {
  await page.fill('.con-search-input', nro)
  await page.waitForTimeout(400)
  const fila = page.locator('.con-table tbody tr', { hasText: nro })
  await expect(fila).toBeVisible({ timeout: 6000 })
  return fila
}

// Cierra el panel manejando el ConfirmDialog del NavigationGuard si aparece
async function cerrarPanelConGuard(page) {
  const guardVisible = await page.locator('.cd-overlay').isVisible().catch(() => false)
  if (guardVisible) {
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()
  }
}

// ─── limpieza global ──────────────────────────────────────────────────────────

test.afterAll(async ({ request }) => {
  const tk = token || (await obtenerToken(request))
  if (consId1) await apiDelete(request, consId1, tk)
  if (consId2) await apiDelete(request, consId2, tk)
})

// ══════════════════════════════════════════════════════════════════════════════
// ESTRUCTURA INICIAL
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Estructura inicial', () => {

  test('01 - carga la página con tabla, buscador y botón Nuevo', async ({ page }) => {
    await irAConsultorios(page)
    await expect(page.locator('.con-search-input')).toBeVisible()
    await expect(page.locator('.con-btn-nuevo')).toBeVisible()
    await expect(page.locator('.con-table')).toBeVisible()
  })

  test('02 - sin panel lateral al entrar', async ({ page }) => {
    await irAConsultorios(page)
    await expect(page.locator('.panel-root')).not.toBeVisible()
  })

  test('03 - tabla con encabezados Nro., Descripción y Acciones', async ({ page }) => {
    await irAConsultorios(page)
    const headers = page.locator('.con-table thead th')
    await expect(headers.nth(0)).toContainText('Nro.')
    await expect(headers.nth(1)).toContainText('Descripción')
    await expect(headers.nth(2)).toContainText('Acciones')
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// CREAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Crear consultorio', () => {

  test('04 - botón Nuevo abre panel en modo crear', async ({ page }) => {
    await irAConsultorios(page)
    await page.locator('.con-btn-nuevo').click()
    await expect(page.locator('.panel-root')).toBeVisible()
    await expect(page.locator('.panel-header-title')).toContainText('Nuevo consultorio')
    await expect(page.locator('input[name="nro_consultorio"]')).toBeVisible()
    await expect(page.locator('input[name="descripcion"]')).toBeVisible()
  })

  test('05 - botón Guardar deshabilitado con nro vacío', async ({ page }) => {
    await irAConsultorios(page)
    await page.locator('.con-btn-nuevo').click()
    const btnGuardar = page.locator('.panel-footer .panel-btn-primary')
    await expect(btnGuardar).toBeDisabled()
  })

  test('06 - crear consultorio válido aparece en la tabla', async ({ page, request }) => {
    await irAConsultorios(page)
    await page.locator('.con-btn-nuevo').click()

    await page.fill('input[name="nro_consultorio"]', NRO_1)
    await page.fill('input[name="descripcion"]', 'Consultorio E2E descripción')
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })

    const fila = await filtrarNro(page, NRO_1)
    await expect(fila).toBeVisible()

    token = token || await obtenerToken(request)
    const r = await request.get(`http://localhost:8000/api/consultorio/?search=${encodeURIComponent(NRO_1)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json()
    consId1 = (body.results || body).find(c => c.nro_consultorio === NRO_1)?.id
  })

  test('07 - toast de confirmación al crear', async ({ page, request }) => {
    await irAConsultorios(page)
    await page.locator('.con-btn-nuevo').click()
    await page.fill('input[name="nro_consultorio"]', NRO_2)
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })

    token = token || await obtenerToken(request)
    const r = await request.get(`http://localhost:8000/api/consultorio/?search=${encodeURIComponent(NRO_2)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json()
    consId2 = (body.results || body).find(c => c.nro_consultorio === NRO_2)?.id
  })

  test('08 - nro duplicado muestra error sin cerrar el panel', async ({ page }) => {
    await irAConsultorios(page)
    await page.locator('.con-btn-nuevo').click()
    await page.fill('input[name="nro_consultorio"]', NRO_1)
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-root')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
  })

  test('09 - cancelar con NavigationGuard no guarda el consultorio', async ({ page }) => {
    const nroCancelar = `E2E-Cancelado-${TS}`
    await irAConsultorios(page)
    await page.locator('.con-btn-nuevo').click()
    await page.fill('input[name="nro_consultorio"]', nroCancelar)

    // Cancelar activa el NavigationGuard (form dirty)
    await page.locator('.panel-footer .panel-btn-secondary').click()

    // Confirmar "Continuar sin guardar" en el dialog del guard
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 4000 })
    await expect(page.locator('.con-table tbody', { hasText: nroCancelar })).not.toBeVisible()
  })

  test('10 - F10 guarda el formulario', async ({ page, request }) => {
    const nroF10 = `E2E-F10-${TS}`
    await irAConsultorios(page)
    await page.locator('.con-btn-nuevo').click()
    await page.fill('input[name="nro_consultorio"]', nroF10)
    await page.keyboard.press('F10')

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })
    const fila = await filtrarNro(page, nroF10)
    await expect(fila).toBeVisible()

    token = token || await obtenerToken(request)
    const r = await request.get(`http://localhost:8000/api/consultorio/?search=${encodeURIComponent(nroF10)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json()
    const id = (body.results || body).find(c => c.nro_consultorio === nroF10)?.id
    if (id) await apiDelete(request, id, token)
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// VER DETALLE
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Ver detalle', () => {

  test('11 - clic en fila abre panel en modo ver', async ({ page }) => {
    await irAConsultorios(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.click()

    await expect(page.locator('.panel-root')).toBeVisible()
    await expect(page.locator('.panel-header-title')).toContainText('Detalle')
  })

  test('12 - detalle muestra nro y descripción del consultorio', async ({ page }) => {
    await irAConsultorios(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.click()

    await expect(page.locator('.panel-body')).toContainText(NRO_1)
    await expect(page.locator('.panel-body')).toContainText('Consultorio E2E descripción')
  })

  test('13 - detalle tiene botones Editar y Eliminar para admin', async ({ page }) => {
    await irAConsultorios(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.click()

    await expect(page.locator('.panel-footer .panel-btn-primary')).toContainText('Editar')
    await expect(page.locator('.panel-footer .panel-btn-danger')).toContainText('Eliminar')
  })

  test('14 - hint visible en filas no seleccionadas', async ({ page }) => {
    await irAConsultorios(page)
    const fila = await filtrarNro(page, NRO_1)
    await expect(fila.locator('.con-hint')).toContainText('Hacé clic para ver el detalle')
  })

  test('15 - fila activa se resalta al seleccionar', async ({ page }) => {
    await irAConsultorios(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.click()
    await expect(fila).toHaveClass(/activo/)
  })

  test('16 - X del panel cierra el detalle', async ({ page }) => {
    await irAConsultorios(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.click()
    await expect(page.locator('.panel-root')).toBeVisible()
    await page.locator('.panel-close').click()
    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 4000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// EDITAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Editar consultorio', () => {

  test('17 - ícono lápiz abre panel en modo editar', async ({ page }) => {
    await irAConsultorios(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.locator('.con-action-btn.edit').click()

    await expect(page.locator('.panel-root')).toBeVisible()
    await expect(page.locator('.panel-header-title')).toContainText('Editar consultorio')
    await expect(page.locator('input[name="nro_consultorio"]')).toBeVisible()
  })

  test('18 - panel de edición trae datos precargados', async ({ page }) => {
    await irAConsultorios(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.locator('.con-action-btn.edit').click()

    await expect(page.locator('input[name="nro_consultorio"]')).toHaveValue(NRO_1)
    await expect(page.locator('input[name="descripcion"]')).toHaveValue('Consultorio E2E descripción')
  })

  test('19 - editar descripción guarda el cambio correctamente', async ({ page }) => {
    await irAConsultorios(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.locator('.con-action-btn.edit').click()

    await page.fill('input[name="descripcion"]', 'Descripción actualizada E2E')
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 8000 })

    const filaActualizada = await filtrarNro(page, NRO_1)
    await filaActualizada.click()
    await expect(page.locator('.panel-body')).toContainText('Descripción actualizada E2E')
  })

  test('20 - botón Editar del panel de detalle abre modo edición', async ({ page }) => {
    await irAConsultorios(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.click()
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-header-title')).toContainText('Editar consultorio')
    await expect(page.locator('input[name="nro_consultorio"]')).toBeVisible()
  })

  test('21 - editar con nro duplicado de otro consultorio muestra error', async ({ page }) => {
    await irAConsultorios(page)
    const fila = await filtrarNro(page, NRO_2)
    await fila.locator('.con-action-btn.edit').click()

    await page.fill('input[name="nro_consultorio"]', NRO_1)
    await page.locator('.panel-footer .panel-btn-primary').click()

    await expect(page.locator('.panel-root')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
  })

  test('22 - cancelar edición con guard no guarda cambios', async ({ page }) => {
    await irAConsultorios(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.locator('.con-action-btn.edit').click()

    await page.fill('input[name="nro_consultorio"]', `${NRO_1}-NO-GUARDAR`)

    // Cancelar activa el NavigationGuard (form dirty)
    await page.locator('.panel-footer .panel-btn-secondary').click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /continuar sin guardar/i }).click()

    await expect(page.locator('.panel-root')).not.toBeVisible({ timeout: 4000 })
    const filaOriginal = await filtrarNro(page, NRO_1)
    await expect(filaOriginal).toBeVisible()
    await expect(page.locator('.con-table tbody', { hasText: `${NRO_1}-NO-GUARDAR` })).not.toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// ELIMINAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Eliminar consultorio', () => {

  test('23 - ícono papelera muestra ConfirmDialog', async ({ page }) => {
    await irAConsultorios(page)
    const fila = await filtrarNro(page, NRO_2)
    await fila.locator('.con-action-btn.trash').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.cd-backdrop')).toContainText('Eliminar consultorio')
  })

  test('24 - cancelar eliminación mantiene el registro', async ({ page }) => {
    await irAConsultorios(page)
    const fila = await filtrarNro(page, NRO_2)
    await fila.locator('.con-action-btn.trash').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()

    await expect(page.locator('.cd-overlay')).not.toBeVisible({ timeout: 4000 })
    await expect(page.locator('.con-table tbody tr', { hasText: NRO_2 })).toBeVisible()
  })

  test('25 - confirmar eliminación quita el registro de la tabla', async ({ page }) => {
    await irAConsultorios(page)
    const fila = await filtrarNro(page, NRO_2)
    await fila.locator('.con-action-btn.trash').click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /eliminar/i }).click()

    await expect(page.locator('.con-table tbody tr', { hasText: NRO_2 })).not.toBeVisible({ timeout: 8000 })
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
    consId2 = null
  })

  test('26 - botón Eliminar del panel dispara ConfirmDialog', async ({ page }) => {
    await irAConsultorios(page)
    const fila = await filtrarNro(page, NRO_1)
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

  test('27 - buscar por nro filtra la tabla', async ({ page }) => {
    await irAConsultorios(page)
    await page.fill('.con-search-input', NRO_1)
    await page.waitForTimeout(400)

    const filas = page.locator('.con-table tbody tr')
    const count = await filas.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(filas.nth(i).locator('.con-nro')).toContainText(NRO_1)
    }
  })

  test('28 - buscar por descripción filtra la tabla', async ({ page }) => {
    await irAConsultorios(page)
    await page.fill('.con-search-input', 'Descripción actualizada E2E')
    await page.waitForTimeout(400)

    const filas = page.locator('.con-table tbody tr')
    await expect(filas.first()).toBeVisible({ timeout: 6000 })
    await expect(filas.first()).toContainText(NRO_1)
  })

  test('29 - búsqueda sin resultados muestra estado vacío', async ({ page }) => {
    await irAConsultorios(page)
    await page.fill('.con-search-input', 'XXXXXXXXXNOEXISTE')
    await page.waitForTimeout(400)

    await expect(page.locator('.con-empty')).toBeVisible()
    await expect(page.locator('.con-empty')).toContainText('Sin consultorios')
  })

  test('30 - limpiar búsqueda restaura la lista', async ({ page }) => {
    await irAConsultorios(page)
    await page.fill('.con-search-input', 'XXXXXXXXXNOEXISTE')
    await page.waitForTimeout(400)
    await expect(page.locator('.con-empty')).toBeVisible()

    await page.fill('.con-search-input', '')
    await page.waitForTimeout(400)
    await expect(page.locator('.con-table tbody tr').first()).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// PERMISOS — RECEPCIONISTA
// ══════════════════════════════════════════════════════════════════════════════

// Los tests de recepcionista limpian el localStorage del admin antes de loguearse
async function loginComoRecep(page) {
  // Limpiar tokens del admin para que la pantalla de login cargue limpia
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

test.describe('Permisos recepcionista', () => {

  test('31 - recepcionista no ve el ícono papelera en la tabla', async ({ page }) => {
    await loginComoRecep(page)
    await irAConsultorios(page)
    await expect(page.locator('.con-action-btn.trash').first()).not.toBeVisible()
  })

  test('32 - recepcionista puede abrir panel crear', async ({ page }) => {
    await loginComoRecep(page)
    await page.goto('/mantenimiento/consultorios')
    await expect(page.locator('.con-btn-nuevo')).toBeVisible({ timeout: 10000 })
    await page.locator('.con-btn-nuevo').click()

    await expect(page.locator('.panel-root')).toBeVisible()
    await expect(page.locator('input[name="nro_consultorio"]')).toBeVisible()
  })

  test('33 - recepcionista no ve botón Eliminar en el panel de detalle', async ({ page }) => {
    await loginComoRecep(page)
    await page.goto('/mantenimiento/consultorios')
    await expect(page.locator('.con-btn-nuevo')).toBeVisible({ timeout: 10000 })

    const filas = page.locator('.con-table tbody tr')
    await expect(page.locator('.con-table tbody td', { hasText: 'Cargando' }))
      .not.toBeVisible({ timeout: 8000 })
    if (await filas.first().isVisible()) {
      await filas.first().click()
      await expect(page.locator('.panel-root')).toBeVisible()
      await expect(page.locator('.panel-footer .panel-btn-danger')).not.toBeVisible()
    }
  })

})
