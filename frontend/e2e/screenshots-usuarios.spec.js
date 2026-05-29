const { test, expect } = require('@playwright/test')
const path = require('path')

const OUT = path.join(__dirname, '../../docs/imagenes/usuarios')

test.describe('Capturas manual - Módulo Usuarios', () => {

  test('01 - listado de usuarios', async ({ page }) => {
    await page.goto('/sistema/usuarios')
    await page.waitForSelector('.usu-search-input', { timeout: 10000 })
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${OUT}/01_listado.png`, fullPage: false })
  })

  test('02 - búsqueda por nombre', async ({ page }) => {
    await page.goto('/sistema/usuarios')
    await page.waitForSelector('.usu-search-input', { timeout: 10000 })
    await page.fill('.usu-search-input', 'test_e2e_admin')
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/02_busqueda.png`, fullPage: false })
  })

  test('03 - filtro por rol', async ({ page }) => {
    await page.goto('/sistema/usuarios')
    await page.waitForSelector('.usu-search-input', { timeout: 10000 })
    await page.locator('select').first().selectOption('recepcionista')
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/03_filtro_rol.png`, fullPage: false })
  })

  test('04 - modal nuevo usuario (vacío)', async ({ page }) => {
    await page.goto('/sistema/usuarios')
    await page.waitForSelector('.usu-search-input', { timeout: 10000 })
    await page.getByRole('button', { name: /nuevo usuario/i }).click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/04_modal_nuevo_vacio.png`, fullPage: false })
  })

  test('05 - modal nuevo usuario (formulario completo)', async ({ page }) => {
    await page.goto('/sistema/usuarios')
    await page.waitForSelector('.usu-search-input', { timeout: 10000 })
    await page.getByRole('button', { name: /nuevo usuario/i }).click()
    await page.waitForTimeout(400)
    await page.fill('input[placeholder="nombre.apellido"]', 'juan.perez')
    await page.fill('input[placeholder="Nombre"]', 'Juan')
    await page.fill('input[placeholder="Apellido"]', 'Pérez')
    await page.fill('input[placeholder="correo@clinica.com"]', 'juan@clinica.com')
    await page.fill('input[placeholder="Mínimo 8 caracteres"]', 'Contraseña123!')
    await page.fill('input[placeholder="Repetí la contraseña"]', 'Contraseña123!')
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT}/05_modal_nuevo_completo.png`, fullPage: false })
  })

  test('06 - modal nuevo - error usuario duplicado', async ({ page }) => {
    await page.goto('/sistema/usuarios')
    await page.waitForSelector('.usu-search-input', { timeout: 10000 })
    await page.getByRole('button', { name: /nuevo usuario/i }).click()
    await page.waitForTimeout(400)
    await page.fill('input[placeholder="nombre.apellido"]', 'test_e2e_admin')
    await page.fill('input[placeholder="Mínimo 8 caracteres"]', 'TestPass1234!')
    await page.fill('input[placeholder="Repetí la contraseña"]', 'TestPass1234!')
    await page.getByRole('button', { name: /crear usuario/i }).click()
    await page.waitForSelector('.usu-error', { timeout: 6000 })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT}/06_modal_error_duplicado.png`, fullPage: false })
  })

  test('07 - ver detalle de usuario', async ({ page }) => {
    await page.goto('/sistema/usuarios')
    await page.waitForSelector('.usu-search-input', { timeout: 10000 })
    await page.fill('.usu-search-input', 'test_e2e_admin')
    await page.waitForTimeout(400)
    await page.locator('tbody tr').first().click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/07_ver_detalle.png`, fullPage: false })
  })

  test('08 - modal editar usuario', async ({ page }) => {
    await page.goto('/sistema/usuarios')
    await page.waitForSelector('.usu-search-input', { timeout: 10000 })
    await page.fill('.usu-search-input', 'test_e2e_recep')
    await page.waitForTimeout(400)
    // Click en el botón editar de la primera fila
    await page.locator('tbody tr').first().hover()
    await page.locator('tbody tr').first().locator('button').first().click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/08_modal_editar.png`, fullPage: false })
  })

  test('09 - confirmación cambio de estado', async ({ page }) => {
    await page.goto('/sistema/usuarios')
    await page.waitForSelector('.usu-search-input', { timeout: 10000 })
    await page.fill('.usu-search-input', 'test_e2e_recep')
    await page.waitForTimeout(400)
    // Click en botón toggle estado
    const toggleBtn = page.locator('tbody tr').first().locator('button').nth(2)
    await toggleBtn.click()
    await page.waitForTimeout(500)
    const cdVisible = await page.locator('.cd-overlay, [class*="confirm"]').isVisible()
    if (cdVisible) {
      await page.screenshot({ path: `${OUT}/09_confirm_estado.png`, fullPage: false })
      await page.locator('[class*="cancel"], button').filter({ hasText: /cancelar/i }).first().click()
    } else {
      await page.screenshot({ path: `${OUT}/09_confirm_estado.png`, fullPage: false })
    }
  })

  test('10 - modal resetear contraseña', async ({ page }) => {
    await page.goto('/sistema/usuarios')
    await page.waitForSelector('.usu-search-input', { timeout: 10000 })
    await page.fill('.usu-search-input', 'test_e2e_recep')
    await page.waitForTimeout(400)
    await page.locator('tbody tr').first().hover()
    // El 3er botón suele ser "resetear contraseña" (llave)
    const btns = page.locator('tbody tr').first().locator('button')
    const count = await btns.count()
    if (count >= 3) {
      await btns.nth(1).click()
      await page.waitForTimeout(600)
      await page.screenshot({ path: `${OUT}/10_modal_resetear.png`, fullPage: false })
    }
  })

})
