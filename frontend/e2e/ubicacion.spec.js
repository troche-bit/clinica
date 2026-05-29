const { test, expect } = require('@playwright/test')

// Datos únicos por ejecución para evitar colisiones
const TS          = Date.now()
const PAIS_NOMBRE  = `E2E País ${TS}`
const DEPTO_NOMBRE = `E2E Depto ${TS}`
const CIUD_NOMBRE  = `E2E Ciudad ${TS}`

// IDs creados durante los tests — usados en afterAll para limpieza
let paisId  = null
let deptoId = null
let ciudadId = null
let token   = null

// ─── helpers ──────────────────────────────────────────────────────────────────

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

async function apiDelete(request, path, tk) {
  await request.delete(`http://localhost:8000/api/${path}`, {
    headers: { Authorization: `Bearer ${tk}` },
  })
}

// Navega a la página y espera que haya al menos un ítem en Países
async function irAUbicaciones(page) {
  await page.goto('/mantenimiento/ubicaciones')
  await expect(page.locator('.ub-col').first().locator('.ub-item').first()).toBeVisible({ timeout: 10000 })
}

// Si el buscador de la columna está visible, filtra por el texto dado
// para que la fila del E2E esté dentro del viewport sin scroll
async function filtrarColumna(page, col, texto) {
  const searchInput = page.locator('.ub-col').nth(col).locator('.ub-search-input')
  if (await searchInput.isVisible()) {
    await searchInput.fill(texto)
    await page.waitForTimeout(300)
  }
}

// Hace hover en una fila y retorna sus botones de acción
function accionesDeItem(page, col, descripcion) {
  const fila = page.locator(`.ub-col`).nth(col).locator('.ub-item', { hasText: descripcion })
  return {
    fila,
    editar:   fila.locator('.ub-action-btn.edit'),
    eliminar: fila.locator('.ub-action-btn.trash'),
  }
}

// ─── limpieza global ──────────────────────────────────────────────────────────

test.afterAll(async ({ request }) => {
  const tk = token || (await obtenerToken(request))
  if (ciudadId) await apiDelete(request, `ciudad/${ciudadId}/`, tk)
  if (deptoId)  await apiDelete(request, `departamento/${deptoId}/`, tk)
  if (paisId)   await apiDelete(request, `pais/${paisId}/`, tk)
})

// ═══════════════════════════════════════════════════════════════════════════════
// ESTRUCTURA INICIAL
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Estructura inicial de la página', () => {

  test('01 - carga las tres columnas y departamentos/ciudades inician deshabilitadas', async ({ page, request }) => {
    token = token || await obtenerToken(request)
    await irAUbicaciones(page)

    // Países: columna activa, tiene botón Agregar
    const cols = page.locator('.ub-col')
    await expect(cols).toHaveCount(3)
    await expect(cols.nth(0).locator('.ub-btn-agregar')).toBeVisible()

    // Departamentos y Ciudades: deshabilitadas con mensaje
    await expect(cols.nth(1).locator('.ub-disabled-msg')).toContainText('Seleccioná un país')
    await expect(cols.nth(2).locator('.ub-disabled-msg')).toContainText('Seleccioná un departamento')
  })

  test('02 - seleccionar un país habilita departamentos y muestra breadcrumb', async ({ page }) => {
    await irAUbicaciones(page)

    // Click en el primer país disponible
    const primeraFila = page.locator('.ub-col').nth(0).locator('.ub-item').first()
    await expect(primeraFila).toBeVisible({ timeout: 8000 })
    const nombrePais = await primeraFila.locator('.ub-item-td').innerText()
    await primeraFila.click()

    // Departamentos ya no muestra el mensaje deshabilitado
    await expect(page.locator('.ub-col').nth(1).locator('.ub-disabled-msg')).not.toBeVisible()
    // Breadcrumb muestra el país
    await expect(page.locator('.ub-path-item').first()).toContainText(nombrePais.trim())
  })

  test('03 - seleccionar departamento habilita ciudades', async ({ page }) => {
    await irAUbicaciones(page)

    await page.locator('.ub-col').nth(0).locator('.ub-item').first().click()
    // Espera que haya al menos una fila en departamentos
    const primeraFilaDepto = page.locator('.ub-col').nth(1).locator('.ub-item').first()
    await expect(primeraFilaDepto).toBeVisible({ timeout: 8000 })
    await primeraFilaDepto.click()

    // Ciudades se habilita
    await expect(page.locator('.ub-col').nth(2).locator('.ub-disabled-msg')).not.toBeVisible()
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD — PAÍSES
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('CRUD Países', () => {

  test('04 - agregar país nuevo con Enter aparece en la lista', async ({ page, request }) => {
    await irAUbicaciones(page)

    await page.locator('.ub-col').nth(0).locator('.ub-btn-agregar').click()
    const input = page.locator('.ub-col').nth(0).locator('input[type="text"]:not(.ub-search-input)')
    await expect(input).toBeFocused({ timeout: 4000 })

    await input.fill(PAIS_NOMBRE)
    await input.press('Enter')

    // El input desaparece y el nuevo país aparece en la lista
    await expect(input).not.toBeVisible({ timeout: 8000 })
    const fila = page.locator('.ub-col').nth(0).locator('.ub-item', { hasText: PAIS_NOMBRE })
    await expect(fila).toBeVisible({ timeout: 6000 })

    // Guardar el ID para cleanup
    const r = await request.get(`http://localhost:8000/api/pais/?search=${encodeURIComponent(PAIS_NOMBRE)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json()
    paisId = (body.results || body).find(p => p.descripcion === PAIS_NOMBRE)?.id
  })

  test('05 - Escape cancela el agregar sin crear el registro', async ({ page }) => {
    await irAUbicaciones(page)

    await page.locator('.ub-col').nth(0).locator('.ub-btn-agregar').click()
    const input = page.locator('.ub-col').nth(0).locator('input[type="text"]:not(.ub-search-input)')
    await input.fill('País Cancelado E2E')
    await input.press('Escape')

    await expect(input).not.toBeVisible({ timeout: 4000 })
    await expect(page.locator('.ub-col').nth(0).locator('.ub-item', { hasText: 'País Cancelado E2E' })).not.toBeVisible()
  })

  test('06 - botón Cancelar en fila editable descarta el agregar', async ({ page }) => {
    await irAUbicaciones(page)

    await page.locator('.ub-col').nth(0).locator('.ub-btn-agregar').click()
    const input = page.locator('.ub-col').nth(0).locator('input[type="text"]:not(.ub-search-input)')
    await input.fill('País Cancelado Botón E2E')
    await page.locator('.ub-col').nth(0).getByRole('button', { name: /cancelar/i }).click()

    await expect(input).not.toBeVisible({ timeout: 4000 })
  })

  test('07 - editar nombre de un país', async ({ page }) => {
    await irAUbicaciones(page)
    await filtrarColumna(page, 0, String(TS))

    // Buscar y hacer hover sobre la fila del país creado
    const { fila, editar } = accionesDeItem(page, 0, PAIS_NOMBRE)
    await expect(fila).toBeVisible({ timeout: 8000 })
    await fila.hover()
    await editar.click()

    const input = page.locator('.ub-col').nth(0).locator('input[type="text"]:not(.ub-search-input)')
    await expect(input).toBeFocused({ timeout: 4000 })
    await input.fill(`${PAIS_NOMBRE} editado`)
    await input.press('Enter')

    await expect(input).not.toBeVisible({ timeout: 6000 })
    await expect(page.locator('.ub-col').nth(0).locator('.ub-item', { hasText: `${PAIS_NOMBRE} editado` })).toBeVisible()

    // Restaurar el nombre original para el resto de los tests
    const { fila: filaEd, editar: editarEd } = accionesDeItem(page, 0, `${PAIS_NOMBRE} editado`)
    await filaEd.hover()
    await editarEd.click()
    const input2 = page.locator('.ub-col').nth(0).locator('input[type="text"]:not(.ub-search-input)')
    await input2.fill(PAIS_NOMBRE)
    await input2.press('Enter')
    await expect(input2).not.toBeVisible({ timeout: 6000 })
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD — DEPARTAMENTOS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('CRUD Departamentos', () => {

  test('08 - agregar departamento usando botón Guardar', async ({ page, request }) => {
    await irAUbicaciones(page)
    await filtrarColumna(page, 0, String(TS))

    // Seleccionar el país creado
    const filaPais = page.locator('.ub-col').nth(0).locator('.ub-item', { hasText: PAIS_NOMBRE })
    await expect(filaPais).toBeVisible({ timeout: 8000 })
    await filaPais.click()

    // Agregar departamento
    await page.locator('.ub-col').nth(1).locator('.ub-btn-agregar').click()
    const input = page.locator('.ub-col').nth(1).locator('input[type="text"]:not(.ub-search-input)')
    await expect(input).toBeFocused({ timeout: 4000 })
    await input.fill(DEPTO_NOMBRE)
    await page.locator('.ub-col').nth(1).getByRole('button', { name: /guardar/i }).click()

    await expect(input).not.toBeVisible({ timeout: 8000 })
    const filaDepto = page.locator('.ub-col').nth(1).locator('.ub-item', { hasText: DEPTO_NOMBRE })
    await expect(filaDepto).toBeVisible({ timeout: 6000 })

    const r = await request.get(`http://localhost:8000/api/departamento/?search=${encodeURIComponent(DEPTO_NOMBRE)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json()
    deptoId = (body.results || body).find(d => d.descripcion === DEPTO_NOMBRE)?.id
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD — CIUDADES
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('CRUD Ciudades', () => {

  test('09 - agregar ciudad al departamento creado', async ({ page, request }) => {
    await irAUbicaciones(page)
    await filtrarColumna(page, 0, String(TS))

    // Seleccionar país y depto
    const filaPais = page.locator('.ub-col').nth(0).locator('.ub-item', { hasText: PAIS_NOMBRE })
    await expect(filaPais).toBeVisible({ timeout: 8000 })
    await filaPais.click()

    const filaDepto = page.locator('.ub-col').nth(1).locator('.ub-item', { hasText: DEPTO_NOMBRE })
    await expect(filaDepto).toBeVisible({ timeout: 8000 })
    await filaDepto.click()

    // Agregar ciudad
    await page.locator('.ub-col').nth(2).locator('.ub-btn-agregar').click()
    const input = page.locator('.ub-col').nth(2).locator('input[type="text"]:not(.ub-search-input)')
    await expect(input).toBeFocused({ timeout: 4000 })
    await input.fill(CIUD_NOMBRE)
    await input.press('Enter')

    await expect(input).not.toBeVisible({ timeout: 8000 })
    await expect(page.locator('.ub-col').nth(2).locator('.ub-item', { hasText: CIUD_NOMBRE })).toBeVisible({ timeout: 6000 })

    const r = await request.get(`http://localhost:8000/api/ciudad/?search=${encodeURIComponent(CIUD_NOMBRE)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json()
    ciudadId = (body.results || body).find(c => c.descripcion === CIUD_NOMBRE)?.id
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// ELIMINACIÓN CON CONFIRMACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Eliminar con ConfirmDialog', () => {

  test('10 - cancelar eliminación deja el registro intacto', async ({ page }) => {
    await irAUbicaciones(page)
    await filtrarColumna(page, 0, String(TS))

    const filaPais = page.locator('.ub-col').nth(0).locator('.ub-item', { hasText: PAIS_NOMBRE })
    await expect(filaPais).toBeVisible({ timeout: 8000 })
    await filaPais.hover()
    await filaPais.locator('.ub-action-btn.trash').click()

    // ConfirmDialog aparece
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    // Cancelar
    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
    await expect(page.locator('.cd-overlay')).not.toBeVisible({ timeout: 4000 })

    // El país sigue en la lista
    await expect(page.locator('.ub-col').nth(0).locator('.ub-item', { hasText: PAIS_NOMBRE })).toBeVisible()
  })

  test('11 - eliminar ciudad y verificar que desaparece de la lista', async ({ page }) => {
    await irAUbicaciones(page)
    await filtrarColumna(page, 0, String(TS))

    // Navegar hasta la ciudad
    await page.locator('.ub-col').nth(0).locator('.ub-item', { hasText: PAIS_NOMBRE }).click()
    await expect(page.locator('.ub-col').nth(1).locator('.ub-item', { hasText: DEPTO_NOMBRE })).toBeVisible({ timeout: 8000 })
    await page.locator('.ub-col').nth(1).locator('.ub-item', { hasText: DEPTO_NOMBRE }).click()
    await expect(page.locator('.ub-col').nth(2).locator('.ub-item', { hasText: CIUD_NOMBRE })).toBeVisible({ timeout: 8000 })

    const { fila, eliminar } = accionesDeItem(page, 2, CIUD_NOMBRE)
    await fila.hover()
    await eliminar.click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /eliminar/i }).click()

    await expect(page.locator('.ub-col').nth(2).locator('.ub-item', { hasText: CIUD_NOMBRE })).not.toBeVisible({ timeout: 8000 })
    ciudadId = null // Ya eliminada
  })

  test('12 - país con departamento activo no puede eliminarse — muestra error', async ({ page }) => {
    await irAUbicaciones(page)
    await filtrarColumna(page, 0, String(TS))

    const { fila, eliminar } = accionesDeItem(page, 0, PAIS_NOMBRE)
    await expect(fila).toBeVisible({ timeout: 8000 })
    await fila.hover()
    await eliminar.click()

    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await page.locator('.cd-backdrop').getByRole('button', { name: /eliminar/i }).click()

    // El backend rechaza con 400 — aparece toast de error, el país permanece
    await expect(page.locator('.toast-wrap').first()).toBeVisible({ timeout: 6000 })
    await expect(page.locator('.ub-col').nth(0).locator('.ub-item', { hasText: PAIS_NOMBRE })).toBeVisible()
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// CASCADA Y SELECCIÓN
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Cascada de selección', () => {

  test('13 - cambiar país resetea la selección de departamento y ciudades', async ({ page, request }) => {
    await irAUbicaciones(page)

    // Verificar que el país existe en la API antes de buscarlo
    const tkVerif = token || (await obtenerToken(request))
    const rVerif = await request.get(`http://localhost:8000/api/pais/?search=${encodeURIComponent(PAIS_NOMBRE)}`, {
      headers: { Authorization: `Bearer ${tkVerif}` },
    })
    const bodyVerif = await rVerif.json()
    const existe = (bodyVerif.results || []).some(p => p.descripcion === PAIS_NOMBRE)
    if (!existe) throw new Error(`País "${PAIS_NOMBRE}" no encontrado en la API — puede haber sido eliminado por un test anterior`)

    // Seleccionar el país creado y un depto
    const filaPaisEl = page.locator('.ub-col').nth(0).locator('.ub-item', { hasText: PAIS_NOMBRE })
    await expect(filaPaisEl).toBeVisible({ timeout: 8000 })
    await filaPaisEl.click()
    await expect(page.locator('.ub-col').nth(1).locator('.ub-item', { hasText: DEPTO_NOMBRE })).toBeVisible({ timeout: 8000 })
    await page.locator('.ub-col').nth(1).locator('.ub-item', { hasText: DEPTO_NOMBRE }).click()
    // Ciudades está habilitada
    await expect(page.locator('.ub-col').nth(2).locator('.ub-disabled-msg')).not.toBeVisible()

    // Seleccionar otro país (el primero de la lista general que NO sea el nuestro)
    const primerPais = page.locator('.ub-col').nth(0).locator('.ub-item').first()
    await primerPais.click()

    // Ciudades vuelve a estar deshabilitada
    await expect(page.locator('.ub-col').nth(2).locator('.ub-disabled-msg')).toBeVisible({ timeout: 4000 })
  })

  test('14 - item seleccionado tiene clase ub-activo', async ({ page }) => {
    await irAUbicaciones(page)

    const filaPais = page.locator('.ub-col').nth(0).locator('.ub-item', { hasText: PAIS_NOMBRE })
    await expect(filaPais).toBeVisible({ timeout: 8000 })
    await filaPais.click()

    await expect(filaPais).toHaveClass(/ub-activo/)
  })

})
