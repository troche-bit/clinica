const { test, expect } = require('@playwright/test')
const path = require('path')

const OUT = path.resolve(__dirname, '../../docs/imagenes/ubicaciones')

// Viewport idéntico al de screenshots-usuarios para consistencia
test.use({ viewport: { width: 1280, height: 800 } })

async function login(page) {
  await page.goto('/login')
  await page.fill('input[name="username"]', 'test_e2e_admin')
  await page.fill('input[name="password"]', 'TestAdmin1234!')
  await page.click('button[type="submit"]')
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 })
}

async function irAUbicaciones(page) {
  await page.goto('/mantenimiento/ubicaciones')
  // Esperar que la primera columna tenga ítems cargados
  await expect(page.locator('.ub-col').first().locator('.ub-item').first())
    .toBeVisible({ timeout: 10000 })
}

// ─── 01 Pantalla principal ────────────────────────────────────────────────────
test('01 - pantalla principal', async ({ page }) => {
  await login(page)
  await irAUbicaciones(page)
  // Pequeña pausa para que los datos terminen de cargar
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/01_pantalla_principal.png`, fullPage: false })
})

// ─── 02 Navegación en cascada — seleccionar un país ──────────────────────────
test('02 - navegacion cascada', async ({ page }) => {
  await login(page)
  await irAUbicaciones(page)

  // Hacer clic en el primer país disponible
  const primerPais = page.locator('.ub-col').nth(0).locator('.ub-item').first()
  await primerPais.click()

  // Esperar que la columna de departamentos se cargue
  await expect(page.locator('.ub-col').nth(1).locator('.ub-disabled-msg'))
    .not.toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(500)

  await page.screenshot({ path: `${OUT}/02_navegacion_cascada.png`, fullPage: false })
})

// ─── 03 Búsqueda local ───────────────────────────────────────────────────────
test('03 - busqueda local', async ({ page }) => {
  await login(page)
  await irAUbicaciones(page)

  // Seleccionar el primer país para cargar departamentos y ciudades
  await page.locator('.ub-col').nth(0).locator('.ub-item').first().click()
  await expect(page.locator('.ub-col').nth(1).locator('.ub-disabled-msg'))
    .not.toBeVisible({ timeout: 8000 })

  // Intentar seleccionar el primer departamento para cargar ciudades
  const primerDepto = page.locator('.ub-col').nth(1).locator('.ub-item').first()
  if (await primerDepto.isVisible()) {
    await primerDepto.click()
    await page.waitForTimeout(400)
  }

  // Buscar la columna con búsqueda visible (más de 5 ítems)
  const searchCol0 = page.locator('.ub-col').nth(0).locator('.ub-search-input')
  const searchCol1 = page.locator('.ub-col').nth(1).locator('.ub-search-input')
  const searchCol2 = page.locator('.ub-col').nth(2).locator('.ub-search-input')

  // Activar búsqueda en la columna que la tenga visible y escribir algo
  if (await searchCol2.isVisible()) {
    await searchCol2.fill('a')
    await page.waitForTimeout(300)
  } else if (await searchCol1.isVisible()) {
    await searchCol1.fill('a')
    await page.waitForTimeout(300)
  } else if (await searchCol0.isVisible()) {
    await searchCol0.fill('a')
    await page.waitForTimeout(300)
  }

  await page.screenshot({ path: `${OUT}/03_busqueda_local.png`, fullPage: false })
})

// ─── 04 Agregar país — fila editable ─────────────────────────────────────────
test('04 - agregar pais fila editable', async ({ page }) => {
  await login(page)
  await irAUbicaciones(page)

  // Clic en el botón "+" de la columna Países
  await page.locator('.ub-col').nth(0).locator('.ub-btn-agregar').click()

  // Esperar que el input aparezca
  const input = page.locator('.ub-col').nth(0).locator('input[type="text"]:not(.ub-search-input)')
  await expect(input).toBeFocused({ timeout: 4000 })

  // Escribir un nombre para que se vea realista
  await input.fill('Bolivia')

  await page.screenshot({ path: `${OUT}/04_agregar_pais.png`, fullPage: false })

  // Cancelar sin guardar
  await input.press('Escape')
})

// ─── 05 Editar país — fila en modo edición ───────────────────────────────────
test('05 - editar pais', async ({ page }) => {
  await login(page)
  await irAUbicaciones(page)

  // Hover sobre el primer país para que aparezcan los botones de acción
  const primerPais = page.locator('.ub-col').nth(0).locator('.ub-item').first()
  await expect(primerPais).toBeVisible({ timeout: 8000 })
  await primerPais.hover()

  // Clic en el botón de edición
  const btnEditar = primerPais.locator('.ub-action-btn.edit')
  await expect(btnEditar).toBeVisible({ timeout: 4000 })
  await btnEditar.click()

  // Esperar que el input aparezca con el valor precargado
  const input = page.locator('.ub-col').nth(0).locator('input[type="text"]:not(.ub-search-input)')
  await expect(input).toBeFocused({ timeout: 4000 })

  await page.screenshot({ path: `${OUT}/05_editar_pais.png`, fullPage: false })

  // Cancelar sin guardar
  await input.press('Escape')
})

// ─── 06 Diálogo de confirmación de eliminación ───────────────────────────────
test('06 - confirm dialog eliminar', async ({ page }) => {
  await login(page)
  await irAUbicaciones(page)

  // Hover sobre el primer país
  const primerPais = page.locator('.ub-col').nth(0).locator('.ub-item').first()
  await primerPais.hover()

  // Clic en el botón de eliminar (papelera)
  const btnEliminar = primerPais.locator('.ub-action-btn.trash')
  await expect(btnEliminar).toBeVisible({ timeout: 4000 })
  await btnEliminar.click()

  // Esperar el ConfirmDialog
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: `${OUT}/06_eliminar_confirm.png`, fullPage: false })

  // Cancelar para no eliminar nada
  const btnCancelar = page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i })
  await btnCancelar.click()
  await expect(page.locator('.cd-overlay')).not.toBeVisible({ timeout: 4000 })
})

// ─── 07 Agregar departamento — fila editable ─────────────────────────────────
test('07 - agregar departamento fila editable', async ({ page }) => {
  await login(page)
  await irAUbicaciones(page)

  // Seleccionar el primer país
  const primerPais = page.locator('.ub-col').nth(0).locator('.ub-item').first()
  await primerPais.click()
  await expect(page.locator('.ub-col').nth(1).locator('.ub-disabled-msg'))
    .not.toBeVisible({ timeout: 8000 })

  // Clic en "+" de la columna Departamentos
  await page.locator('.ub-col').nth(1).locator('.ub-btn-agregar').click()

  const input = page.locator('.ub-col').nth(1).locator('input[type="text"]:not(.ub-search-input)')
  await expect(input).toBeFocused({ timeout: 4000 })
  await input.fill('Central Norte')

  await page.screenshot({ path: `${OUT}/07_agregar_departamento.png`, fullPage: false })

  await input.press('Escape')
})

// ─── 08 Agregar ciudad — fila editable ───────────────────────────────────────
test('08 - agregar ciudad fila editable', async ({ page }) => {
  await login(page)
  await irAUbicaciones(page)

  // Seleccionar el primer país
  const primerPais = page.locator('.ub-col').nth(0).locator('.ub-item').first()
  await primerPais.click()
  await expect(page.locator('.ub-col').nth(1).locator('.ub-disabled-msg'))
    .not.toBeVisible({ timeout: 8000 })

  // Seleccionar el primer departamento
  const primerDepto = page.locator('.ub-col').nth(1).locator('.ub-item').first()
  await expect(primerDepto).toBeVisible({ timeout: 8000 })
  await primerDepto.click()
  await expect(page.locator('.ub-col').nth(2).locator('.ub-disabled-msg'))
    .not.toBeVisible({ timeout: 8000 })

  // Clic en "+" de la columna Ciudades
  await page.locator('.ub-col').nth(2).locator('.ub-btn-agregar').click()

  const input = page.locator('.ub-col').nth(2).locator('input[type="text"]:not(.ub-search-input)')
  await expect(input).toBeFocused({ timeout: 4000 })
  await input.fill('San Lorenzo')

  await page.screenshot({ path: `${OUT}/08_agregar_ciudad.png`, fullPage: false })

  await input.press('Escape')
})
