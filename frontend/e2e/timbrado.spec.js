const { test, expect } = require('@playwright/test')

// Usamos números fijos lejos del rango real para no interferir con datos reales
const NRO_1 = '98765432'
const NRO_2 = '98765433'

let timId1 = null
let timId2 = null
let token  = null

// ─── helpers ──────────────────────────────────────────────────────────────────

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

async function apiDelete(request, id) {
  await request.delete(`http://localhost:8000/api/timbrado/${id}/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function crearTimbrado(request, nro, extra = {}) {
  const r = await request.post('http://localhost:8000/api/timbrado/', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      nro_timbrado:     nro,
      autoimpresor:     false,
      inicio_vigencia:  '2099-01-01',
      fin_vigencia:     '2099-12-31',
      punto_sucursal:   '001',
      punto_expedicion: '001',
      nro_desde:        1,
      nro_hasta:        999,
      ...extra,
    },
  })
  const body = await r.json()
  return body.id
}

async function limpiarTimbrado(request, nro) {
  const r = await request.get(`http://localhost:8000/api/timbrado/?search=${nro}&page_size=10`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await r.json()
  for (const t of (data.results ?? data)) {
    if (t.nro_timbrado === nro) {
      await request.delete(`http://localhost:8000/api/timbrado/${t.id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  }
}

async function irATimbrado(page) {
  await page.goto('/facturacion/timbrado')
  await expect(page.locator('.tim-tabla, .tim-empty')).toBeVisible({ timeout: 10000 })
}

async function filtrarNro(page, nro) {
  await page.fill('.tim-search-input', nro)
  await page.waitForTimeout(400)
  const fila = page.locator('.tim-tr', { hasText: nro })
  await expect(fila).toBeVisible({ timeout: 6000 })
  return fila
}

async function llenarFormulario(page, nro) {
  await page.fill('input[placeholder="12345678"]', nro)
  await page.fill('input[type="date"]', '2099-01-01')         // inicio_vigencia
  await page.locator('input[type="date"]').nth(1).fill('2099-12-31')  // fin_vigencia
  await page.fill('input[placeholder="001"]', '001')           // punto_sucursal
  await page.locator('input[placeholder="001"]').nth(1).fill('001')   // punto_expedicion
  await page.fill('input[placeholder="0000001"]', '0000001')
  await page.fill('input[placeholder="0000999"]', '0000999')
}

// ─── setup / teardown ─────────────────────────────────────────────────────────

test.beforeAll(async ({ request }) => {
  token = await obtenerToken(request)
  // Limpiar registros de corridas anteriores antes de crear
  await limpiarTimbrado(request, NRO_1)
  await limpiarTimbrado(request, NRO_2)
  timId1 = await crearTimbrado(request, NRO_1)
  timId2 = await crearTimbrado(request, NRO_2)
})

test.afterAll(async ({ request }) => {
  if (timId1) await apiDelete(request, timId1)
  if (timId2) await apiDelete(request, timId2)
})

// ══════════════════════════════════════════════════════════════════════════════
// ESTRUCTURA INICIAL
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Estructura inicial', () => {

  test('01 - carga con tabla, buscador, filtro y botón Nuevo', async ({ page }) => {
    await irATimbrado(page)
    await expect(page.locator('.tim-search-input')).toBeVisible()
    await expect(page.locator('.tim-filtro-select')).toBeVisible()
    await expect(page.locator('.tim-btn-nuevo')).toBeVisible()
  })

  test('02 - sin panel al entrar', async ({ page }) => {
    await irATimbrado(page)
    await expect(page.locator('.tim-panel')).not.toBeVisible()
  })

  test('03 - encabezados de tabla correctos', async ({ page }) => {
    await irATimbrado(page)
    const ths = page.locator('.tim-th')
    await expect(ths.filter({ hasText: 'Nro. Timbrado' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Tipo' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Vigencia' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Comprobantes' })).toBeVisible()
    await expect(ths.filter({ hasText: 'Estado' })).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// CREAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Crear', () => {

  test('04 - botón Nuevo abre panel en modo crear', async ({ page }) => {
    await irATimbrado(page)
    await page.locator('.tim-btn-nuevo').click()
    await expect(page.locator('.tim-panel')).toBeVisible()
    await expect(page.locator('.tim-panel-titulo')).toContainText('Nuevo timbrado')
  })

  test('05 - campos vacíos muestran errores de validación sin llamar a la API', async ({ page }) => {
    await irATimbrado(page)
    await page.locator('.tim-btn-nuevo').click()
    await page.locator('.tim-btn-primario').click()
    await expect(page.locator('.tim-error-msg').first()).toBeVisible()
    // No debe cerrar el panel
    await expect(page.locator('.tim-panel')).toBeVisible()
  })

  test('06 - crear timbrado válido aparece en tabla con toast', async ({ page }) => {
    await irATimbrado(page)
    await page.locator('.tim-btn-nuevo').click()
    await llenarFormulario(page, '11223344')

    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/timbrado/') && r.request().method() === 'POST'),
      page.locator('.tim-btn-primario').click(),
    ])
    expect(response.status()).toBe(201)
    const { id } = await response.json()

    await expect(page.locator('.tim-panel')).not.toBeVisible({ timeout: 3000 })
    await filtrarNro(page, '11223344')
    await expect(page.locator('[class*="toast"]').first()).toBeVisible({ timeout: 3000 })

    // Limpiar
    if (id) await apiDelete(page.request, id)
  })

  test('07 - duplicado exacto muestra error sin cerrar panel', async ({ page }) => {
    await irATimbrado(page)
    // Esperar que los datos carguen (timbrados debe incluir NRO_1 para detectar duplicado)
    await expect(page.locator('.tim-tr').first()).toBeVisible({ timeout: 6000 })
    await page.locator('.tim-btn-nuevo').click()
    // Mismos datos que NRO_1 ya existe en DB
    await page.fill('input[placeholder="12345678"]', NRO_1)
    await page.fill('input[type="date"]', '2099-01-01')
    await page.locator('input[type="date"]').nth(1).fill('2099-12-31')
    await page.fill('input[placeholder="001"]', '001')
    await page.locator('input[placeholder="001"]').nth(1).fill('001')
    await page.fill('input[placeholder="0000001"]', '0000001')
    await page.fill('input[placeholder="0000999"]', '0000999')
    await page.locator('.tim-btn-primario').click()
    // La validación client-side muestra toast de error
    await expect(page.locator('[class*="toast"]').first()).toBeVisible({ timeout: 3000 })
    await expect(page.locator('.tim-panel')).toBeVisible()
  })

  test('08 - cancelar cierra el panel sin guardar', async ({ page }) => {
    await irATimbrado(page)
    await page.locator('.tim-btn-nuevo').click()
    await page.fill('input[placeholder="12345678"]', '55555555')
    await page.locator('.tim-btn-secundario').click()
    await expect(page.locator('.tim-panel')).not.toBeVisible()
    // No debe aparecer en tabla
    await page.fill('.tim-search-input', '55555555')
    await page.waitForTimeout(400)
    await expect(page.locator('.tim-empty, .tim-tr')).toBeVisible()
    const filas = await page.locator('.tim-tr', { hasText: '55555555' }).count()
    expect(filas).toBe(0)
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// VER DETALLE
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Ver detalle', () => {

  test('09 - clic en fila abre panel con datos correctos', async ({ page }) => {
    await irATimbrado(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.click()
    await expect(page.locator('.tim-panel')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.tim-panel-titulo')).toContainText(NRO_1)
  })

  test('10 - panel muestra nro. timbrado, tipo y estado', async ({ page }) => {
    await irATimbrado(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.click()
    await expect(page.locator('.tim-panel')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.tim-detalle-nro')).toBeVisible()
    await expect(page.locator('.tim-panel .tim-badge-tipo')).toBeVisible()
    await expect(page.locator('.tim-panel .tim-badge-estado')).toBeVisible()
  })

  test('11 - admin ve botones Editar y Eliminar en panel', async ({ page }) => {
    await irATimbrado(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.click()
    await expect(page.locator('.tim-panel')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.tim-panel button', { hasText: 'Editar' })).toBeVisible()
    await expect(page.locator('.tim-panel button', { hasText: 'Eliminar' })).toBeVisible()
  })

  test('12 - X cierra el panel', async ({ page }) => {
    await irATimbrado(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.click()
    await expect(page.locator('.tim-panel')).toBeVisible()
    await page.locator('.tim-panel-cerrar').click()
    await expect(page.locator('.tim-panel')).not.toBeVisible()
  })

  test('13 - fila activa queda resaltada mientras el panel está abierto', async ({ page }) => {
    await irATimbrado(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.click()
    await expect(fila).toHaveClass(/active/)
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// EDITAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Editar', () => {

  test('14 - botón Editar del panel abre modo edición con datos precargados', async ({ page }) => {
    await irATimbrado(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.click()
    await expect(page.locator('.tim-panel')).toBeVisible()
    await page.locator('.tim-panel button', { hasText: 'Editar' }).click()
    await expect(page.locator('.tim-panel-titulo')).toContainText('Editar timbrado')
    await expect(page.locator('input[placeholder="12345678"]')).toHaveValue(NRO_1)
  })

  test('15 - editar fin de vigencia y guardar actualiza el registro', async ({ page }) => {
    await irATimbrado(page)
    const fila = await filtrarNro(page, NRO_2)
    await fila.click()
    await page.locator('.tim-panel button', { hasText: 'Editar' }).click()
    // Esperar que el formulario esté listo antes de llenar
    await expect(page.locator('.tim-panel .tim-btn-primario')).toBeVisible({ timeout: 3000 })
    await page.locator('input[type="date"]').nth(1).fill('2099-06-30')

    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/timbrado/') && r.request().method() === 'PATCH'),
      page.locator('.tim-btn-primario').click(),
    ])
    expect(response.status()).toBe(200)
    await expect(page.locator('.tim-panel')).not.toBeVisible({ timeout: 3000 })
  })

  test('16 - guardar con mismo número no falla (excluye propio)', async ({ page }) => {
    await irATimbrado(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.click()
    await page.locator('.tim-panel button', { hasText: 'Editar' }).click()
    // Guardar sin cambiar nada
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/timbrado/') && r.request().method() === 'PATCH'),
      page.locator('.tim-btn-primario').click(),
    ])
    expect(response.status()).toBe(200)
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// ELIMINAR
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Eliminar', () => {

  test('17 - botón Eliminar abre ConfirmDialog', async ({ page }) => {
    await irATimbrado(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.click()
    await expect(page.locator('.tim-panel')).toBeVisible()
    await page.locator('.tim-panel button', { hasText: 'Eliminar' }).click()
    await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.cd-backdrop')).toContainText('Eliminar este timbrado')
  })

  test('18 - cancelar en ConfirmDialog mantiene el registro', async ({ page }) => {
    await irATimbrado(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.click()
    await page.locator('.tim-panel button', { hasText: 'Eliminar' }).click()
    await expect(page.locator('.cd-overlay')).toBeVisible()
    await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
    await expect(page.locator('.cd-overlay')).not.toBeVisible()
    // El panel sigue abierto con el registro
    await expect(page.locator('.tim-panel')).toBeVisible()
  })

  test('19 - confirmar elimina y quita de tabla con toast', async ({ page, request }) => {
    const nroTemp = '77665544'
    await limpiarTimbrado(request, nroTemp)
    await crearTimbrado(request, nroTemp)
    await irATimbrado(page)
    const fila = await filtrarNro(page, nroTemp)
    await fila.click()
    await page.locator('.tim-panel button', { hasText: 'Eliminar' }).click()
    await expect(page.locator('.cd-overlay')).toBeVisible()
    await page.locator('.cd-backdrop').getByRole('button', { name: /eliminar/i }).click()
    await expect(page.locator('.cd-overlay')).not.toBeVisible({ timeout: 4000 })
    // Ya no aparece en tabla
    await page.fill('.tim-search-input', nroTemp)
    await page.waitForTimeout(400)
    await expect(page.locator('.tim-tr', { hasText: nroTemp })).not.toBeVisible()
    await expect(page.locator('[class*="toast"]').first()).toBeVisible({ timeout: 3000 })
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// BÚSQUEDA Y FILTRO
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Búsqueda y filtro', () => {

  test('20 - búsqueda filtra por nro. timbrado', async ({ page }) => {
    await irATimbrado(page)
    await page.fill('.tim-search-input', NRO_1)
    await page.waitForTimeout(400)
    await expect(page.locator('.tim-tr', { hasText: NRO_1 })).toBeVisible()
  })

  test('21 - búsqueda sin resultados muestra estado vacío', async ({ page }) => {
    await irATimbrado(page)
    await page.fill('.tim-search-input', '00000000')
    await page.waitForTimeout(400)
    await expect(page.locator('.tim-empty')).toBeVisible()
  })

  test('22 - limpiar búsqueda restaura la lista', async ({ page }) => {
    await irATimbrado(page)
    await page.fill('.tim-search-input', '00000000')
    await page.waitForTimeout(300)
    await page.fill('.tim-search-input', '')
    await page.waitForTimeout(400)
    await expect(page.locator('.tim-tr').first()).toBeVisible()
  })

  test('23 - filtro Vigentes muestra solo timbrados vigentes', async ({ page }) => {
    await irATimbrado(page)
    await page.selectOption('.tim-filtro-select', 'true')
    await page.waitForTimeout(400)
    const badges = page.locator('.tim-badge-estado')
    const count  = await badges.count()
    for (let i = 0; i < count; i++) {
      await expect(badges.nth(i)).toContainText('Vigente')
    }
  })

  test('24 - filtro Expirados muestra solo timbrados vencidos', async ({ page }) => {
    await irATimbrado(page)
    await page.selectOption('.tim-filtro-select', 'false')
    await page.waitForTimeout(400)
    const badges = page.locator('.tim-badge-estado')
    const count  = await badges.count()
    // Puede haber 0 vencidos en test — si hay, todos deben ser Vencido
    for (let i = 0; i < count; i++) {
      await expect(badges.nth(i)).toContainText('Vencido')
    }
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// PERMISOS RECEPCIONISTA
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Permisos recepcionista', () => {

  test.use({ storageState: undefined })

  async function loginRecep(page) {
    await page.goto('/login')
    await page.fill('input[name="username"]', 'test_e2e_recep')
    await page.fill('input[name="password"]', 'TestRecep1234!')
    await page.click('button[type="submit"]')
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 })
  }

  test('25 - recepcionista no ve botón Nuevo', async ({ page }) => {
    await loginRecep(page)
    await irATimbrado(page)
    await expect(page.locator('.tim-btn-nuevo')).not.toBeVisible()
  })

  test('26 - recepcionista puede abrir detalle pero no ve Editar ni Eliminar', async ({ page }) => {
    await loginRecep(page)
    await irATimbrado(page)
    const fila = await filtrarNro(page, NRO_1)
    await fila.click()
    await expect(page.locator('.tim-panel')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.tim-panel button', { hasText: 'Editar' })).not.toBeVisible()
    await expect(page.locator('.tim-panel button', { hasText: 'Eliminar' })).not.toBeVisible()
  })

})
