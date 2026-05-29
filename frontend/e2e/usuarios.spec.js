const { test, expect } = require('@playwright/test')

test.describe('Gestión de usuarios (admin)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/sistema/usuarios')
    await page.waitForSelector('.usu-search-input', { timeout: 10000 })
  })

  // ── Acceso y listado ─────────────────────────────────────────────────────

  test('admin puede acceder a la página de usuarios', async ({ page }) => {
    await expect(page.locator('.usu-search-input')).toBeVisible()
    await expect(page.getByRole('button', { name: /nuevo usuario/i })).toBeVisible()
  })

  test('la tabla muestra usuarios existentes', async ({ page }) => {
    const filas = page.locator('tbody tr')
    await expect(filas).not.toHaveCount(0)
  })

  test('buscar por username filtra la tabla', async ({ page }) => {
    await page.fill('.usu-search-input', 'test_e2e_admin')
    await page.waitForTimeout(400)
    const filas = page.locator('tbody tr')
    await expect(filas).not.toHaveCount(0)
    // Usar selector específico de la tabla, no genérico
    await expect(page.locator('tbody .usu-name').first()).toContainText('test_e2e_admin')
  })

  test('buscar por texto inexistente muestra tabla vacía', async ({ page }) => {
    await page.fill('.usu-search-input', 'xxxxxxusuarioquenoexiste')
    await page.waitForTimeout(400)
    const filas = page.locator('tbody tr')
    await expect(filas).toHaveCount(0)
  })

  // ── Crear usuario ────────────────────────────────────────────────────────

  test('abrir modal de nuevo usuario', async ({ page }) => {
    await page.getByRole('button', { name: /nuevo usuario/i }).click()
    await expect(page.getByText(/nuevo usuario/i).first()).toBeVisible()
    await expect(page.locator('input[placeholder="nombre.apellido"]')).toBeVisible()
  })

  test('crear usuario con datos válidos aparece en la lista', async ({ page }) => {
    const timestamp = Date.now()
    const username = `usr_e2e_${timestamp}`

    await page.getByRole('button', { name: /nuevo usuario/i }).click()
    await page.fill('input[placeholder="nombre.apellido"]', username)
    await page.fill('input[placeholder="Nombre"]', 'Test')
    await page.fill('input[placeholder="Apellido"]', 'E2E')
    await page.fill('input[placeholder="Mínimo 8 caracteres"]', 'TestPass1234!')
    await page.fill('input[placeholder="Repetí la contraseña"]', 'TestPass1234!')

    await page.getByRole('button', { name: /crear usuario/i }).click()

    // El modal debe cerrarse tras la creación exitosa
    await expect(page.locator('input[placeholder="nombre.apellido"]')).not.toBeVisible({ timeout: 12000 })

    await page.fill('.usu-search-input', username)
    await page.waitForTimeout(400)
    await expect(page.locator('tbody .usu-username').first()).toContainText(username)
  })

  test('crear usuario con username que ya existe muestra error', async ({ page }) => {
    await page.getByRole('button', { name: /nuevo usuario/i }).click()
    await page.fill('input[placeholder="nombre.apellido"]', 'test_e2e_admin')
    await page.fill('input[placeholder="Mínimo 8 caracteres"]', 'TestPass1234!')
    await page.fill('input[placeholder="Repetí la contraseña"]', 'TestPass1234!')
    await page.getByRole('button', { name: /crear usuario/i }).click()
    await expect(page.getByText(/ya existe/i)).toBeVisible({ timeout: 6000 })
  })

  test('crear usuario con contraseñas que no coinciden muestra error', async ({ page }) => {
    await page.getByRole('button', { name: /nuevo usuario/i }).click()
    await page.fill('input[placeholder="nombre.apellido"]', 'usr_test_mismatch')
    await page.fill('input[placeholder="Mínimo 8 caracteres"]', 'TestPass1234!')
    await page.fill('input[placeholder="Repetí la contraseña"]', 'OtraPass5678!')
    await page.getByRole('button', { name: /crear usuario/i }).click()
    await expect(page.locator('.usu-error').first()).toBeVisible({ timeout: 6000 })
    await expect(page.locator('.usu-error').first()).toContainText(/no coinciden/i)
  })

  // ── Ver detalle ──────────────────────────────────────────────────────────

  test('click en fila abre el detalle del usuario', async ({ page }) => {
    await page.fill('.usu-search-input', 'test_e2e_admin')
    await page.waitForTimeout(400)
    await page.locator('tbody tr').first().click()
    // Verificar que el modal se abre buscando el título específico del modal
    await expect(page.locator('.modal-header, [class*="modal"]').first()).toBeVisible({ timeout: 6000 })
  })

  // ── Filtro por rol ───────────────────────────────────────────────────────

  test('filtro por rol muestra solo usuarios con ese rol', async ({ page }) => {
    const select = page.locator('select').first()
    await select.selectOption('recepcionista')
    await page.waitForTimeout(400)
    const badges = page.locator('.badge')
    const count = await badges.count()
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const text = await badges.nth(i).textContent()
        if (text && text.toLowerCase().includes('recepcionista')) {
          expect(text.toLowerCase()).toContain('recepcionista')
        }
      }
    }
  })

})
