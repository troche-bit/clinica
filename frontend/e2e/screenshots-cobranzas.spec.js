const { test, expect } = require('@playwright/test')
const path = require('path')
const fs   = require('fs')

const OUT          = path.resolve(__dirname, '../../docs/imagenes/cobranzas')
const PERSONA_DOC  = 'E2ECOB0001'
const PERSONA_NOM  = 'E2E Cliente COB'
const TIMB_NRO     = '19400001'
const CTA_DESC     = 'E2E Caja COB'
const COB_NRO_VISTA = 4801

let token     = null
let personaId = null
let timbradoId = null
let grupoId   = null
let productoId = null
let ctaMcbId  = null
let cobId1    = null

test.use({ viewport: { width: 1440, height: 900 } })

function hoyStr() { return new Date().toISOString().split('T')[0] }
function enNDias(n) { return new Date(Date.now() + n * 86400000).toISOString().split('T')[0] }

async function obtenerToken(request) {
  const r = await request.post('http://localhost:8000/api/auth/token/', {
    data: { username: 'test_e2e_admin', password: 'TestAdmin1234!' },
  })
  const { access } = await r.json()
  return access
}

function authH() { return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }

async function apiGet(request, path) {
  const r = await request.get(`http://localhost:8000${path}`, { headers: { Authorization: `Bearer ${token}` } })
  return r.json()
}
async function apiPost(request, path, data) {
  const r = await request.post(`http://localhost:8000${path}`, { headers: authH(), data })
  return { status: r.status(), body: await r.json() }
}
async function apiDelete(request, path) {
  await request.delete(`http://localhost:8000${path}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
}

async function obtenerOCrearPersona(request) {
  const data = await apiGet(request, `/api/persona/?search=${PERSONA_DOC}&page_size=5`)
  const existe = (data.results ?? []).find(p => p.nro_documento === PERSONA_DOC)
  if (existe) return existe.id
  const tdData = await apiGet(request, '/api/tipo-documento/?page_size=5')
  const tipoDocId = (tdData.results ?? tdData)[0].id
  const { body } = await apiPost(request, '/api/persona/', {
    tipo_documento: tipoDocId, nro_documento: PERSONA_DOC, razon_social: PERSONA_NOM,
  })
  return body.id
}

async function obtenerOCrearTimbrado(request) {
  const data = await apiGet(request, `/api/timbrado/?search=${TIMB_NRO}&page_size=5`)
  const existe = (data.results ?? []).find(t => t.nro_timbrado === TIMB_NRO && !t.is_deleted)
  if (existe) return existe.id
  const { body } = await apiPost(request, '/api/timbrado/', {
    nro_timbrado: TIMB_NRO, inicio_vigencia: enNDias(-30), fin_vigencia: enNDias(365),
    punto_sucursal: '001', punto_expedicion: '001', nro_desde: 6800, nro_hasta: 6999, autoimpresor: false,
  })
  return body.id
}

async function obtenerOCrearGrupo(request) {
  const data = await apiGet(request, '/api/grupos/?search=E2E+Grupo+COB&page_size=5')
  const existe = (data.results ?? []).find(g => g.descripcion === 'E2E Grupo COB')
  if (existe) return existe.id
  const { body } = await apiPost(request, '/api/grupos/', { descripcion: 'E2E Grupo COB', activo: true })
  return body.id
}

async function obtenerOCrearProducto(request, gId) {
  const data = await apiGet(request, '/api/productos/?search=E2E+Consulta+COB&page_size=5')
  const existe = (data.results ?? []).find(p => p.descripcion === 'E2E Consulta COB' && !p.is_deleted)
  if (existe) return existe.id
  const { body } = await apiPost(request, '/api/productos/', {
    descripcion: 'E2E Consulta COB', grupo: gId, impuesto: '10', activo: true,
  })
  return body.id
}

async function obtenerOCrearCuenta(request) {
  const data = await apiGet(request, `/api/cuentas-mcb/?search=${CTA_DESC}&page_size=5`)
  const existe = (data.results ?? []).find(c => c.descripcion === CTA_DESC && !c.is_deleted)
  if (existe) return existe.id
  const { body } = await apiPost(request, '/api/cuentas-mcb/', { descripcion: CTA_DESC })
  return body.id
}

async function asegurarCuotasPendientes(request, cantidad) {
  let cuotas = await apiGet(request, `/api/cobranzas/cuotas-pendientes/?persona=${personaId}`)
  let nroBase = 6801
  while (cuotas.length < cantidad) {
    const data = await apiGet(request, `/api/facturacion/?search=${PERSONA_DOC}&page_size=50`)
    const lista = data.results ?? data ?? []
    const nroUsado = lista.find(f => f.nro_comprobante === nroBase && !f.is_deleted)
    if (!nroUsado) {
      await apiPost(request, '/api/facturacion/', {
        fecha: hoyStr(), condicion_vta: false,
        persona: personaId, timbrado: timbradoId, nro_comprobante: nroBase,
        detalle: [{ prs: productoId, cantidad: '1.00', monto: '110000.00' }],
        cuotas: { cant_cuota: 1, dias_entre_cuotas: 30 },
      })
    }
    nroBase++
    cuotas = await apiGet(request, `/api/cobranzas/cuotas-pendientes/?persona=${personaId}`)
    if (nroBase > 6899) break
  }
  return cuotas
}

async function irACobranzas(page) {
  await page.goto('/finanzas/cobranzas')
  await expect(page.locator('.cob-tabla-wrap').first()).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(600)
}

test.beforeAll(async ({ request }) => {
  fs.mkdirSync(OUT, { recursive: true })

  token      = await obtenerToken(request)
  personaId  = await obtenerOCrearPersona(request)
  timbradoId = await obtenerOCrearTimbrado(request)
  grupoId    = await obtenerOCrearGrupo(request)
  productoId = await obtenerOCrearProducto(request, grupoId)
  ctaMcbId   = await obtenerOCrearCuenta(request)

  const cuotas = await asegurarCuotasPendientes(request, 2)

  const cobranzas = await apiGet(request, `/api/cobranzas/?search=${PERSONA_DOC}&page_size=20`)
  const existe = (cobranzas.results ?? []).find(c => c.comprobante_nro === COB_NRO_VISTA && !c.is_deleted)
  if (existe) {
    cobId1 = existe.id
  } else if (cuotas.length > 0) {
    const { body } = await apiPost(request, '/api/cobranzas/', {
      fecha: hoyStr(), persona: personaId, comprobante_nro: COB_NRO_VISTA,
      detalle: [{ cta_cobrar_id: cuotas[0].id, monto_pagado: cuotas[0].saldo }],
      valores_recibidos: [{ forma_pago_id: 1, cta_id: ctaMcbId, monto: cuotas[0].saldo }],
    })
    cobId1 = body.id
  }
})

test.afterAll(async ({ request }) => {
  const cobranzas = await apiGet(request, `/api/cobranzas/?search=${PERSONA_DOC}&page_size=50`)
  for (const c of (cobranzas.results ?? [])) {
    if (!c.is_deleted) await apiDelete(request, `/api/cobranzas/${c.id}/`)
  }
  const facs = await apiGet(request, `/api/facturacion/?search=${PERSONA_DOC}&page_size=50`)
  for (const f of (facs.results ?? [])) {
    if (!f.is_deleted) await apiDelete(request, `/api/facturacion/${f.id}/`).catch(() => {})
  }
  if (productoId) await apiDelete(request, `/api/productos/${productoId}/`).catch(() => {})
  if (grupoId)    await apiDelete(request, `/api/grupos/${grupoId}/`).catch(() => {})
  if (ctaMcbId)   await apiDelete(request, `/api/cuentas-mcb/${ctaMcbId}/`).catch(() => {})
})

// ─── 01 Listado principal ─────────────────────────────────────────────────────

test('01 - listado principal', async ({ page }) => {
  await irACobranzas(page)
  await page.screenshot({ path: `${OUT}/01_listado.png` })
})

// ─── 02 Búsqueda con filtro activo ────────────────────────────────────────────

test('02 - busqueda con filtro cliente', async ({ page }) => {
  await irACobranzas(page)
  await page.fill('.cob-search-input', PERSONA_NOM)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/02_busqueda.png` })
  await page.fill('.cob-search-input', '')
})

// ─── 03 Modal detalle de cobranza ────────────────────────────────────────────

test('03 - modal detalle de cobranza', async ({ page }) => {
  await irACobranzas(page)
  await page.fill('.cob-search-input', PERSONA_NOM)
  await page.waitForTimeout(500)
  const fila = page.locator('.cob-tr').filter({ hasText: String(COB_NRO_VISTA).padStart(7, '0') }).first()
  await expect(fila).toBeVisible({ timeout: 8000 })
  await fila.click()
  await expect(page.locator('.modal-title', { hasText: 'Detalle de cobranza' })).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/03_panel_detalle.png` })
  await page.locator('.modal-close').click()
  await page.fill('.cob-search-input', '')
})

// ─── 04 Modal nueva cobranza vacío (tab Cabecera) ────────────────────────────

test('04 - modal nueva cobranza vacio tab cabecera', async ({ page }) => {
  await irACobranzas(page)
  await page.locator('.cob-btn-nuevo').click()
  await expect(page.locator('.modal-title', { hasText: 'Nueva cobranza' })).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/04_panel_crear.png` })
  await page.locator('.modal-close').click()
})

// ─── 05 Modal con cliente y cuotas visibles ───────────────────────────────────

test('05 - modal con cliente seleccionado y cuotas visibles', async ({ page }) => {
  await irACobranzas(page)
  await page.locator('.cob-btn-nuevo').click()
  await expect(page.locator('.modal-title', { hasText: 'Nueva cobranza' })).toBeVisible({ timeout: 5000 })

  await page.locator('.cob-buscador-wrap .cob-input').fill('E2E')
  await page.waitForTimeout(500)
  const item = page.locator('.cob-dropdown-item').first()
  if (await item.isVisible({ timeout: 5000 }).catch(() => false)) {
    await item.click()
    await page.waitForTimeout(800)
  }

  await page.screenshot({ path: `${OUT}/05_panel_crear_completo.png` })
  await page.locator('.modal-close').click()
  await page.waitForTimeout(300)
  const guard = page.locator('.cd-backdrop button', { hasText: /descartar|continuar/i })
  if (await guard.isVisible({ timeout: 1000 }).catch(() => false)) await guard.click()
})

// ─── 06 Modal tab Valores recibidos ──────────────────────────────────────────

test('06 - modal tab valores recibidos con datos', async ({ page }) => {
  await irACobranzas(page)
  await page.locator('.cob-btn-nuevo').click()
  await expect(page.locator('.modal-title', { hasText: 'Nueva cobranza' })).toBeVisible({ timeout: 5000 })

  await page.locator('.cob-tab', { hasText: 'Valores recibidos' }).click()
  await page.waitForTimeout(400)

  const formaSelect = page.locator('.cob-select').first()
  await expect(formaSelect.locator('option').nth(1)).toBeAttached({ timeout: 5000 })
  await formaSelect.selectOption({ index: 1 })
  await page.waitForTimeout(200)
  await page.locator('.cob-select').nth(1).selectOption({ index: 1 })
  await page.fill('input[type="number"].cob-input-monto', '110000')

  await page.screenshot({ path: `${OUT}/06_panel_editar.png` })
  await page.locator('.modal-close').click()
  await page.waitForTimeout(300)
  const guard = page.locator('.cd-backdrop button', { hasText: /descartar|continuar/i })
  if (await guard.isVisible({ timeout: 1000 }).catch(() => false)) await guard.click()
})

// ─── 07 ConfirmDialog eliminar ────────────────────────────────────────────────

test('07 - confirm dialog eliminar cobranza', async ({ page }) => {
  await irACobranzas(page)
  await page.fill('.cob-search-input', PERSONA_NOM)
  await page.waitForTimeout(500)
  const fila = page.locator('.cob-tr').first()
  await expect(fila).toBeVisible({ timeout: 8000 })
  await fila.locator('.cob-row-btn.danger').click()
  await expect(page.locator('.cd-overlay')).toBeVisible({ timeout: 4000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/07_confirm_eliminar.png` })
  await page.locator('.cd-backdrop').getByRole('button', { name: /cancelar/i }).click()
  await page.fill('.cob-search-input', '')
})

// ─── 08 Filtro de fecha activo ────────────────────────────────────────────────

test('08 - filtros de fecha activos', async ({ page }) => {
  await irACobranzas(page)
  const primeroDeMes = hoyStr().substring(0, 8) + '01'
  await page.locator('.cob-filtro-date').first().fill(primeroDeMes)
  await page.locator('.cob-filtro-date').nth(1).fill(hoyStr())
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/08_navigation_guard.png` })
  await page.locator('.cob-filtro-date').first().fill('')
  await page.locator('.cob-filtro-date').nth(1).fill('')
})
