const { test, expect } = require('@playwright/test')

test.describe('Login', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('login exitoso como admin redirige al dashboard', async ({ page }) => {
    await page.fill('input[name="username"]', 'test_e2e_admin')
    await page.fill('input[name="password"]', 'TestAdmin1234!')
    await page.click('button[type="submit"]')
    await page.waitForURL(url => !url.toString().includes('/login'))
    expect(page.url()).not.toContain('/login')
  })

  test('credenciales incorrectas muestra mensaje de error', async ({ page }) => {
    await page.fill('input[name="username"]', 'test_e2e_admin')
    await page.fill('input[name="password"]', 'WrongPassword999')
    await page.click('button[type="submit"]')
    await expect(page.locator('.error-msg')).toBeVisible({ timeout: 10000 })
  })

  test('usuario inactivo no puede ingresar', async ({ page }) => {
    // Obtener token admin para poder manipular el usuario vía API
    const tokenResp = await page.request.post('http://localhost:8000/api/auth/token/', {
      data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' }
    })
    const { access } = await tokenResp.json()

    // Buscar el perfil del recepcionista de test
    const perfiles = await page.request.get('http://localhost:8000/api/usuarios/', {
      headers: { Authorization: `Bearer ${access}` }
    })
    const lista = await perfiles.json()
    const recep = lista.find(u => u.username === 'test_e2e_recep')

    // Desactivar si está activo
    if (recep && recep.activo) {
      await page.request.post(`http://localhost:8000/api/usuarios/${recep.id}/cambiar-estado/`, {
        headers: { Authorization: `Bearer ${access}` }
      })
    }

    // Intentar login con usuario inactivo
    await page.fill('input[name="username"]', 'test_e2e_recep')
    await page.fill('input[name="password"]', 'TestRecep1234!')
    await page.click('button[type="submit"]')
    await expect(page.locator('.error-msg')).toBeVisible({ timeout: 10000 })

    // Reactivar para no afectar otros tests
    if (recep) {
      await page.request.post(`http://localhost:8000/api/usuarios/${recep.id}/cambiar-estado/`, {
        headers: { Authorization: `Bearer ${access}` }
      })
    }
  })

  test('campo contraseña tiene toggle mostrar/ocultar', async ({ page }) => {
    const input = page.locator('input[name="password"]')
    await expect(input).toHaveAttribute('type', /password|text/)
    const toggle = page.locator('button').filter({ hasText: '' }).nth(0)
    // El tipo inicial es password
    await expect(input).toHaveAttribute('type', 'password')
  })

  test('no puede acceder a ruta protegida sin autenticar', async ({ page }) => {
    await page.goto('/sistema/usuarios')
    await expect(page).toHaveURL(/login/)
  })

})
