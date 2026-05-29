const { test } = require('@playwright/test')
const path = require('path')

const AUTH_FILE = path.join(__dirname, '.auth/admin.json')

test('autenticar como admin y guardar estado', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="username"]', 'test_e2e_admin')
  await page.fill('input[name="password"]', 'TestAdmin1234!')
  await page.click('button[type="submit"]')
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 })
  await page.context().storageState({ path: AUTH_FILE })
})
