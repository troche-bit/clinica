import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet, FileText, Package, ChevronRight, Receipt, ShieldAlert, BarChart2, ClipboardList, BookOpen } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../hooks/useToast'
import Toast from '../../components/ui/Toast'
import apiClient from '../../api/client'

const FILTROS_PROD_INICIALES = { grupo: '' }

const CONDICION_OPCIONES = [
  { value: '',      label: 'Todas' },
  { value: 'true',  label: 'Contado' },
  { value: 'false', label: 'Crédito' },
]

function hoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDefaultFiltrosFact() {
  return { fecha_desde: hoy(), fecha_hasta: hoy(), condicion_vta: '', agrupar_cliente: false }
}

function getDefaultFiltrosControl() {
  return { fecha_desde: hoy(), fecha_hasta: hoy() }
}

function buildQS(obj) {
  const p = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => {
    if (v === true)  p.append(k, 'true')
    else if (v && v !== false) p.append(k, v)
  })
  const s = p.toString()
  return s ? '?' + s : ''
}

export default function InformesStockPage() {
  const navigate = useNavigate()
  const { toast, showToast } = useToast()

  // ── Productos ──
  const [productosAbierto, setProductosAbierto] = useState(false)
  const [filtrosProd, setFiltrosProd]           = useState(FILTROS_PROD_INICIALES)
  const [loadingProdPdf, setLoadingProdPdf]     = useState(false)
  const [loadingProdXls, setLoadingProdXls]     = useState(false)
  const [grupos, setGrupos]                     = useState([])

  // ── Facturas ──
  const [facturasAbierto, setFacturasAbierto]   = useState(false)
  const [filtrosFact, setFiltrosFact]           = useState(getDefaultFiltrosFact)
  const [loadingFacPdf, setLoadingFacPdf]       = useState(false)
  const [loadingFacXls, setLoadingFacXls]       = useState(false)

  // ── Control comprobantes ──
  const [controlAbierto, setControlAbierto]     = useState(false)
  const [filtrosControl, setFiltrosControl]     = useState(getDefaultFiltrosControl)
  const [loadingCtrlPdf, setLoadingCtrlPdf]     = useState(false)
  const [loadingCtrlXls, setLoadingCtrlXls]     = useState(false)

  // ── Estado de cuenta ──
  const [ectaAbierto,       setEctaAbierto]       = useState(false)
  const [ectaModo,          setEctaModo]          = useState('detallado')
  const [ectaUsarRango,     setEctaUsarRango]     = useState(true)
  const [ectaFechaDesde,    setEctaFechaDesde]    = useState(hoy)
  const [ectaFechaHasta,    setEctaFechaHasta]    = useState(hoy)
  const [ectaIncluirSaldo0, setEctaIncluirSaldo0] = useState(false)
  const [ectaClienteId,     setEctaClienteId]     = useState('')
  const [ectaClienteNombre, setEctaClienteNombre] = useState('')
  const [ectaClienteSearch, setEctaClienteSearch] = useState('')
  const [ectaClienteRes,    setEctaClienteRes]    = useState([])
  const [ectaClienteFocus,  setEctaClienteFocus]  = useState(-1)
  const [loadingEctaPdf,    setLoadingEctaPdf]    = useState(false)
  const [loadingEctaXls,    setLoadingEctaXls]    = useState(false)
  const ectaDebounceRef                           = useRef(null)
  const ectaListRef                               = useRef(null)

  // ── Cobranzas ──
  const [cobAbierto,       setCobAbierto]       = useState(false)
  const [cobFechaDesde,    setCobFechaDesde]    = useState(hoy)
  const [cobFechaHasta,    setCobFechaHasta]    = useState(hoy)
  const [cobClienteId,     setCobClienteId]     = useState('')
  const [cobClienteNombre, setCobClienteNombre] = useState('')
  const [cobClienteSearch, setCobClienteSearch] = useState('')
  const [cobClienteRes,    setCobClienteRes]    = useState([])
  const [cobClienteFocus,  setCobClienteFocus]  = useState(-1)
  const [loadingCobPdf,    setLoadingCobPdf]    = useState(false)
  const [loadingCobXls,    setLoadingCobXls]    = useState(false)
  const cobDebounceRef                          = useRef(null)
  const cobListRef                              = useRef(null)

  // ── Movimientos ──
  const [movAbierto,    setMovAbierto]    = useState(false)
  const [movCuenta,     setMovCuenta]     = useState('')
  const [movTipo,       setMovTipo]       = useState('')
  const [movFechaDesde, setMovFechaDesde] = useState(hoy)
  const [movFechaHasta, setMovFechaHasta] = useState(hoy)
  const [cuentas,       setCuentas]       = useState([])
  const [loadingMovPdf, setLoadingMovPdf] = useState(false)
  const [loadingMovXls, setLoadingMovXls] = useState(false)

  // ── Pagos a prestadores ──
  const [pagoAbierto,         setPagoAbierto]         = useState(false)
  const [pagoFechaDesde,      setPagoFechaDesde]      = useState(hoy)
  const [pagoFechaHasta,      setPagoFechaHasta]      = useState(hoy)
  const [pagoEstado,          setPagoEstado]          = useState('')
  const [pagoPrestadorId,     setPagoPrestadorId]     = useState('')
  const [pagoPrestadorNombre, setPagoPrestadorNombre] = useState('')
  const [pagoPrestadorSearch, setPagoPrestadorSearch] = useState('')
  const [pagoPrestadorRes,    setPagoPrestadorRes]    = useState([])
  const [pagoPrestadorFocus,  setPagoPrestadorFocus]  = useState(-1)
  const [loadingPagoPdf,      setLoadingPagoPdf]      = useState(false)
  const [loadingPagoXls,      setLoadingPagoXls]      = useState(false)
  const pagoDebounceRef                               = useRef(null)
  const pagoListRef                                   = useRef(null)

  // ── Extracto de cuenta ──
  const [extAbierto,       setExtAbierto]       = useState(false)
  const [extAgrupar,       setExtAgrupar]       = useState(false)
  const [extUsarRango,     setExtUsarRango]     = useState(true)
  const [extFechaDesde,    setExtFechaDesde]    = useState(hoy)
  const [extFechaHasta,    setExtFechaHasta]    = useState(hoy)
  const [extIncluirSaldo0, setExtIncluirSaldo0] = useState(false)
  const [extClienteId,     setExtClienteId]     = useState('')
  const [extClienteNombre, setExtClienteNombre] = useState('')
  const [extClienteSearch, setExtClienteSearch] = useState('')
  const [extClienteRes,    setExtClienteRes]    = useState([])
  const [extClienteFocus,  setExtClienteFocus]  = useState(-1)
  const [loadingExtPdf,    setLoadingExtPdf]    = useState(false)
  const [loadingExtXls,    setLoadingExtXls]    = useState(false)
  const extDebounceRef                          = useRef(null)
  const extListRef                              = useRef(null)

  // ── Cliente compartido (Facturas) ──
  const [clienteId, setClienteId]             = useState('')
  const [clienteNombre, setClienteNombre]     = useState('')
  const [clienteSearch, setClienteSearch]     = useState('')
  const [clienteRes, setClienteRes]           = useState([])
  const [clienteFocusIdx, setClienteFocusIdx] = useState(-1)
  const debounceRef                           = useRef(null)
  const clienteListRef                        = useRef(null)

  useEffect(() => {
    if (!productosAbierto) return
    if (grupos.length > 0) return
    apiClient.get('/grupos/', { params: { page_size: 200, activo: 'true' } })
      .then(r => setGrupos(r.data.results ?? r.data))
      .catch(() => {})
  }, [productosAbierto])

  useEffect(() => {
    const q = clienteSearch.trim()
    setClienteFocusIdx(-1)
    if (q.length < 2) { setClienteRes([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      apiClient.get('/persona/', { params: { search: q, page_size: 8, con_rol: 'true' } })
        .then(r => setClienteRes(r.data.results ?? r.data))
        .catch(() => {})
    }, 300)
  }, [clienteSearch])

  useEffect(() => {
    const q = ectaClienteSearch.trim()
    setEctaClienteFocus(-1)
    if (q.length < 2) { setEctaClienteRes([]); return }
    clearTimeout(ectaDebounceRef.current)
    ectaDebounceRef.current = setTimeout(() => {
      apiClient.get('/persona/', { params: { search: q, page_size: 8 } })
        .then(r => setEctaClienteRes(r.data.results ?? r.data))
        .catch(() => {})
    }, 300)
  }, [ectaClienteSearch])

  useEffect(() => {
    const q = cobClienteSearch.trim()
    setCobClienteFocus(-1)
    if (q.length < 2) { setCobClienteRes([]); return }
    clearTimeout(cobDebounceRef.current)
    cobDebounceRef.current = setTimeout(() => {
      apiClient.get('/persona/', { params: { search: q, page_size: 8 } })
        .then(r => setCobClienteRes(r.data.results ?? r.data))
        .catch(() => {})
    }, 300)
  }, [cobClienteSearch])

  useEffect(() => {
    const q = pagoPrestadorSearch.trim()
    setPagoPrestadorFocus(-1)
    if (q.length < 2) { setPagoPrestadorRes([]); return }
    clearTimeout(pagoDebounceRef.current)
    pagoDebounceRef.current = setTimeout(() => {
      apiClient.get('/personarrhh/', { params: { search: q, page_size: 8 } })
        .then(r => setPagoPrestadorRes(r.data.results ?? r.data))
        .catch(() => {})
    }, 300)
  }, [pagoPrestadorSearch])

  useEffect(() => {
    if (!movAbierto || cuentas.length > 0) return
    apiClient.get('/cuentas-mcb/', { params: { page_size: 100 } })
      .then(r => setCuentas(r.data.results ?? r.data))
      .catch(() => {})
  }, [movAbierto])

  useEffect(() => {
    const q = extClienteSearch.trim()
    setExtClienteFocus(-1)
    if (q.length < 2) { setExtClienteRes([]); return }
    clearTimeout(extDebounceRef.current)
    extDebounceRef.current = setTimeout(() => {
      apiClient.get('/persona/', { params: { search: q, page_size: 8 } })
        .then(r => setExtClienteRes(r.data.results ?? r.data))
        .catch(() => {})
    }, 300)
  }, [extClienteSearch])

  // ── Abrir modales ──
  function handleAbrirProductos() {
    setFiltrosProd(FILTROS_PROD_INICIALES)
    setProductosAbierto(true)
  }

  function handleAbrirFacturas() {
    setFiltrosFact(getDefaultFiltrosFact())
    setClienteId(''); setClienteNombre(''); setClienteSearch(''); setClienteRes([]); setClienteFocusIdx(-1)
    setFacturasAbierto(true)
  }

  function handleAbrirControl() {
    setFiltrosControl(getDefaultFiltrosControl())
    setControlAbierto(true)
  }

  function handleAbrirEcta() {
    setEctaModo('detallado')
    setEctaUsarRango(true)
    setEctaFechaDesde(hoy())
    setEctaFechaHasta(hoy())
    setEctaIncluirSaldo0(false)
    setEctaClienteId(''); setEctaClienteNombre(''); setEctaClienteSearch(''); setEctaClienteRes([]); setEctaClienteFocus(-1)
    setEctaAbierto(true)
  }

  function handleAbrirCob() {
    setCobFechaDesde(hoy()); setCobFechaHasta(hoy())
    setCobClienteId(''); setCobClienteNombre(''); setCobClienteSearch(''); setCobClienteRes([]); setCobClienteFocus(-1)
    setCobAbierto(true)
  }

  function handleAbrirMov() {
    setMovCuenta(''); setMovTipo('')
    setMovFechaDesde(hoy()); setMovFechaHasta(hoy())
    setMovAbierto(true)
  }

  function handleAbrirPago() {
    setPagoFechaDesde(hoy()); setPagoFechaHasta(hoy())
    setPagoEstado('')
    setPagoPrestadorId(''); setPagoPrestadorNombre(''); setPagoPrestadorSearch(''); setPagoPrestadorRes([]); setPagoPrestadorFocus(-1)
    setPagoAbierto(true)
  }

  function handleAbrirExt() {
    setExtAgrupar(false)
    setExtUsarRango(true)
    setExtFechaDesde(hoy())
    setExtFechaHasta(hoy())
    setExtIncluirSaldo0(false)
    setExtClienteId(''); setExtClienteNombre(''); setExtClienteSearch(''); setExtClienteRes([]); setExtClienteFocus(-1)
    setExtAbierto(true)
  }

  // ── Cliente (Facturas) ──
  function handleClienteKeyDown(e) {
    if (clienteRes.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setClienteFocusIdx(i => { const n = Math.min(i+1, clienteRes.length-1); scrollClienteItem(n); return n }) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setClienteFocusIdx(i => { const n = Math.max(i-1, 0); scrollClienteItem(n); return n }) }
    else if (e.key === 'Enter') { e.preventDefault(); if (clienteFocusIdx >= 0) seleccionarCliente(clienteRes[clienteFocusIdx]) }
    else if (e.key === 'Escape') { setClienteRes([]); setClienteFocusIdx(-1) }
  }
  function scrollClienteItem(idx) {
    if (!clienteListRef.current) return
    const item = clienteListRef.current.children[idx]
    if (item) item.scrollIntoView({ block: 'nearest' })
  }
  function seleccionarCliente(p) { setClienteId(String(p.id)); setClienteNombre(p.razon_social); setClienteSearch(''); setClienteRes([]) }
  function limpiarCliente() { setClienteId(''); setClienteNombre(''); setClienteSearch(''); setClienteRes([]) }

  // ── Cliente (Estado de cuenta) ──
  function handleEctaClienteKeyDown(e) {
    if (ectaClienteRes.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setEctaClienteFocus(i => { const n = Math.min(i+1, ectaClienteRes.length-1); scrollEctaItem(n); return n }) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setEctaClienteFocus(i => { const n = Math.max(i-1, 0); scrollEctaItem(n); return n }) }
    else if (e.key === 'Enter') { e.preventDefault(); if (ectaClienteFocus >= 0) seleccionarEctaCliente(ectaClienteRes[ectaClienteFocus]) }
    else if (e.key === 'Escape') { setEctaClienteRes([]); setEctaClienteFocus(-1) }
  }
  function scrollEctaItem(idx) {
    if (!ectaListRef.current) return
    const item = ectaListRef.current.children[idx]
    if (item) item.scrollIntoView({ block: 'nearest' })
  }
  function seleccionarEctaCliente(p) { setEctaClienteId(String(p.id)); setEctaClienteNombre(p.razon_social); setEctaClienteSearch(''); setEctaClienteRes([]) }
  function limpiarEctaCliente() { setEctaClienteId(''); setEctaClienteNombre(''); setEctaClienteSearch(''); setEctaClienteRes([]) }

  // ── Cliente (Cobranzas) ──
  function handleCobClienteKeyDown(e) {
    if (cobClienteRes.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setCobClienteFocus(i => { const n = Math.min(i+1, cobClienteRes.length-1); cobListRef.current?.children[n]?.scrollIntoView({ block: 'nearest' }); return n }) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCobClienteFocus(i => { const n = Math.max(i-1, 0); cobListRef.current?.children[n]?.scrollIntoView({ block: 'nearest' }); return n }) }
    else if (e.key === 'Enter') { e.preventDefault(); if (cobClienteFocus >= 0) seleccionarCobCliente(cobClienteRes[cobClienteFocus]) }
    else if (e.key === 'Escape') { setCobClienteRes([]); setCobClienteFocus(-1) }
  }
  function seleccionarCobCliente(p) { setCobClienteId(String(p.id)); setCobClienteNombre(p.razon_social); setCobClienteSearch(''); setCobClienteRes([]) }
  function limpiarCobCliente() { setCobClienteId(''); setCobClienteNombre(''); setCobClienteSearch(''); setCobClienteRes([]) }

  // ── Prestador (Pagos) ──
  function handlePagoPrestadorKeyDown(e) {
    if (pagoPrestadorRes.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setPagoPrestadorFocus(i => { const n = Math.min(i+1, pagoPrestadorRes.length-1); pagoListRef.current?.children[n]?.scrollIntoView({ block: 'nearest' }); return n }) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setPagoPrestadorFocus(i => { const n = Math.max(i-1, 0); pagoListRef.current?.children[n]?.scrollIntoView({ block: 'nearest' }); return n }) }
    else if (e.key === 'Enter') { e.preventDefault(); if (pagoPrestadorFocus >= 0) seleccionarPagoPrestador(pagoPrestadorRes[pagoPrestadorFocus]) }
    else if (e.key === 'Escape') { setPagoPrestadorRes([]); setPagoPrestadorFocus(-1) }
  }
  function seleccionarPagoPrestador(m) { setPagoPrestadorId(String(m.id)); setPagoPrestadorNombre(m.nombre ?? m.persona?.razon_social); setPagoPrestadorSearch(''); setPagoPrestadorRes([]) }
  function limpiarPagoPrestador() { setPagoPrestadorId(''); setPagoPrestadorNombre(''); setPagoPrestadorSearch(''); setPagoPrestadorRes([]) }

  // ── Cliente (Extracto) ──
  function handleExtClienteKeyDown(e) {
    if (extClienteRes.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setExtClienteFocus(i => { const n = Math.min(i+1, extClienteRes.length-1); scrollExtItem(n); return n }) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setExtClienteFocus(i => { const n = Math.max(i-1, 0); scrollExtItem(n); return n }) }
    else if (e.key === 'Enter') { e.preventDefault(); if (extClienteFocus >= 0) seleccionarExtCliente(extClienteRes[extClienteFocus]) }
    else if (e.key === 'Escape') { setExtClienteRes([]); setExtClienteFocus(-1) }
  }
  function scrollExtItem(idx) {
    if (!extListRef.current) return
    const item = extListRef.current.children[idx]
    if (item) item.scrollIntoView({ block: 'nearest' })
  }
  function seleccionarExtCliente(p) { setExtClienteId(String(p.id)); setExtClienteNombre(p.razon_social); setExtClienteSearch(''); setExtClienteRes([]) }
  function limpiarExtCliente() { setExtClienteId(''); setExtClienteNombre(''); setExtClienteSearch(''); setExtClienteRes([]) }

  // ── Build QS ──
  function buildFactQS() {
    const params = { ...filtrosFact }
    if (clienteId) params.persona = clienteId
    return buildQS(params)
  }

  function buildEctaQS() {
    const p = new URLSearchParams()
    p.set('modo', ectaModo)
    p.set('usar_rango', ectaUsarRango ? 'true' : 'false')
    if (ectaUsarRango && ectaFechaDesde) p.set('fecha_desde', ectaFechaDesde)
    if (ectaFechaHasta) p.set('fecha_hasta', ectaFechaHasta)
    if (ectaClienteId) p.set('persona', ectaClienteId)
    if (ectaIncluirSaldo0) p.set('incluir_saldo_cero', 'true')
    const s = p.toString()
    return s ? '?' + s : ''
  }

  function buildCobQS() {
    const p = new URLSearchParams()
    if (cobFechaDesde) p.set('fecha_desde', cobFechaDesde)
    if (cobFechaHasta) p.set('fecha_hasta', cobFechaHasta)
    if (cobClienteId)  p.set('search', cobClienteNombre)
    const s = p.toString(); return s ? '?' + s : ''
  }

  function buildMovQS() {
    const p = new URLSearchParams()
    if (movCuenta)     p.set('cta', movCuenta)
    if (movTipo)       p.set('tipo', movTipo)
    if (movFechaDesde) p.set('fecha_desde', movFechaDesde)
    if (movFechaHasta) p.set('fecha_hasta', movFechaHasta)
    const s = p.toString(); return s ? '?' + s : ''
  }

  function buildPagoQS() {
    const p = new URLSearchParams()
    if (pagoFechaDesde)  p.set('fecha_desde', pagoFechaDesde)
    if (pagoFechaHasta)  p.set('fecha_hasta', pagoFechaHasta)
    if (pagoEstado)      p.set('estado', pagoEstado)
    if (pagoPrestadorId) p.set('persona_rrhh', pagoPrestadorId)
    const s = p.toString(); return s ? '?' + s : ''
  }

  function buildExtQS() {
    const p = new URLSearchParams()
    p.set('agrupar_por_factura', extAgrupar ? 'true' : 'false')
    p.set('usar_rango', extUsarRango ? 'true' : 'false')
    if (extUsarRango && extFechaDesde) p.set('fecha_desde', extFechaDesde)
    if (extFechaHasta) p.set('fecha_hasta', extFechaHasta)
    if (extClienteId) p.set('persona', extClienteId)
    if (extIncluirSaldo0) p.set('incluir_saldo_cero', 'true')
    const s = p.toString()
    return s ? '?' + s : ''
  }

  // ── Handlers Productos ──
  async function handleProdPdf() {
    setLoadingProdPdf(true)
    try {
      const res = await apiClient.get(`/productos/reporte-productos/${buildQS(filtrosProd)}`, { responseType: 'blob' })
      window.open(URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })), '_blank')
    } catch { showToast('No se pudo generar el PDF.', 'error') }
    finally { setLoadingProdPdf(false) }
  }
  async function handleProdXls() {
    setLoadingProdXls(true)
    try {
      const tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const res  = await apiClient.get(`/productos/reporte-productos-excel/${buildQS(filtrosProd)}`, { responseType: 'blob' })
      const link = document.createElement('a')
      link.href  = URL.createObjectURL(new Blob([res.data], { type: tipo }))
      link.download = `productos_${hoy().replace(/-/g,'')}.xlsx`
      link.click()
    } catch { showToast('No se pudo generar el Excel.', 'error') }
    finally { setLoadingProdXls(false) }
  }

  // ── Handlers Control ──
  async function handleCtrlPdf() {
    setLoadingCtrlPdf(true)
    try {
      const res = await apiClient.get(`/facturacion/reporte-control-pdf/${buildQS(filtrosControl)}`, { responseType: 'blob' })
      window.open(URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })), '_blank')
    } catch { showToast('No se pudo generar el PDF.', 'error') }
    finally { setLoadingCtrlPdf(false) }
  }
  async function handleCtrlXls() {
    setLoadingCtrlXls(true)
    try {
      const tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const res  = await apiClient.get(`/facturacion/reporte-control-excel/${buildQS(filtrosControl)}`, { responseType: 'blob' })
      const link = document.createElement('a')
      link.href  = URL.createObjectURL(new Blob([res.data], { type: tipo }))
      link.download = `control_comprobantes_${hoy().replace(/-/g,'')}.xlsx`
      link.click()
    } catch { showToast('No se pudo generar el Excel.', 'error') }
    finally { setLoadingCtrlXls(false) }
  }

  // ── Handlers Facturas ──
  async function handleFacPdf() {
    setLoadingFacPdf(true)
    try {
      const res = await apiClient.get(`/facturacion/reporte-pdf/${buildFactQS()}`, { responseType: 'blob' })
      window.open(URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })), '_blank')
    } catch { showToast('No se pudo generar el PDF.', 'error') }
    finally { setLoadingFacPdf(false) }
  }
  async function handleFacXls() {
    setLoadingFacXls(true)
    try {
      const tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const res  = await apiClient.get(`/facturacion/reporte-excel/${buildFactQS()}`, { responseType: 'blob' })
      const link = document.createElement('a')
      link.href  = URL.createObjectURL(new Blob([res.data], { type: tipo }))
      link.download = `facturas_${hoy().replace(/-/g,'')}.xlsx`
      link.click()
    } catch { showToast('No se pudo generar el Excel.', 'error') }
    finally { setLoadingFacXls(false) }
  }

  // ── Handlers Cobranzas ──
  async function handleCobPdf() {
    setLoadingCobPdf(true)
    try {
      const res = await apiClient.get(`/cobranzas/reporte-pdf/${buildCobQS()}`, { responseType: 'blob' })
      window.open(URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })), '_blank')
    } catch { showToast('No se pudo generar el PDF.', 'error') }
    finally { setLoadingCobPdf(false) }
  }
  async function handleCobXls() {
    setLoadingCobXls(true)
    try {
      const tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const res  = await apiClient.get(`/cobranzas/reporte-excel/${buildCobQS()}`, { responseType: 'blob' })
      const link = document.createElement('a')
      link.href  = URL.createObjectURL(new Blob([res.data], { type: tipo }))
      link.download = `cobranzas_${hoy().replace(/-/g,'')}.xlsx`
      link.click()
    } catch { showToast('No se pudo generar el Excel.', 'error') }
    finally { setLoadingCobXls(false) }
  }

  // ── Handlers Movimientos ──
  async function handleMovPdf() {
    setLoadingMovPdf(true)
    try {
      const res = await apiClient.get(`/movimientos-caja/reporte-pdf/${buildMovQS()}`, { responseType: 'blob' })
      window.open(URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })), '_blank')
    } catch { showToast('No se pudo generar el PDF.', 'error') }
    finally { setLoadingMovPdf(false) }
  }
  async function handleMovXls() {
    setLoadingMovXls(true)
    try {
      const tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const res  = await apiClient.get(`/movimientos-caja/reporte-excel/${buildMovQS()}`, { responseType: 'blob' })
      const link = document.createElement('a')
      link.href  = URL.createObjectURL(new Blob([res.data], { type: tipo }))
      link.download = `movimientos_${hoy().replace(/-/g,'')}.xlsx`
      link.click()
    } catch { showToast('No se pudo generar el Excel.', 'error') }
    finally { setLoadingMovXls(false) }
  }

  // ── Handlers Pagos a Prestadores ──
  async function handlePagoPdf() {
    setLoadingPagoPdf(true)
    try {
      const res = await apiClient.get(`/pago-prestador/reporte-pdf/${buildPagoQS()}`, { responseType: 'blob' })
      window.open(URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })), '_blank')
    } catch { showToast('No se pudo generar el PDF.', 'error') }
    finally { setLoadingPagoPdf(false) }
  }
  async function handlePagoXls() {
    setLoadingPagoXls(true)
    try {
      const tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const res  = await apiClient.get(`/pago-prestador/reporte-excel/${buildPagoQS()}`, { responseType: 'blob' })
      const link = document.createElement('a')
      link.href  = URL.createObjectURL(new Blob([res.data], { type: tipo }))
      link.download = `pagos_prestadores_${hoy().replace(/-/g,'')}.xlsx`
      link.click()
    } catch { showToast('No se pudo generar el Excel.', 'error') }
    finally { setLoadingPagoXls(false) }
  }

  // ── Handlers Extracto de cuenta ──
  async function handleExtPdf() {
    setLoadingExtPdf(true)
    try {
      const res = await apiClient.get(`/facturacion/extracto-cuenta-pdf/${buildExtQS()}`, { responseType: 'blob' })
      window.open(URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })), '_blank')
    } catch { showToast('No se pudo generar el PDF.', 'error') }
    finally { setLoadingExtPdf(false) }
  }
  async function handleExtXls() {
    setLoadingExtXls(true)
    try {
      const tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const res  = await apiClient.get(`/facturacion/extracto-cuenta-excel/${buildExtQS()}`, { responseType: 'blob' })
      const link = document.createElement('a')
      link.href  = URL.createObjectURL(new Blob([res.data], { type: tipo }))
      link.download = `extracto_cuenta_${hoy().replace(/-/g,'')}.xlsx`
      link.click()
    } catch { showToast('No se pudo generar el Excel.', 'error') }
    finally { setLoadingExtXls(false) }
  }

  // ── Handlers Estado de cuenta ──
  async function handleEctaPdf() {
    setLoadingEctaPdf(true)
    try {
      const res = await apiClient.get(`/facturacion/estado-cuenta-pdf/${buildEctaQS()}`, { responseType: 'blob' })
      window.open(URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })), '_blank')
    } catch { showToast('No se pudo generar el PDF.', 'error') }
    finally { setLoadingEctaPdf(false) }
  }
  async function handleEctaXls() {
    setLoadingEctaXls(true)
    try {
      const tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const res  = await apiClient.get(`/facturacion/estado-cuenta-excel/${buildEctaQS()}`, { responseType: 'blob' })
      const link = document.createElement('a')
      link.href  = URL.createObjectURL(new Blob([res.data], { type: tipo }))
      link.download = `estado_cuenta_${hoy().replace(/-/g,'')}.xlsx`
      link.click()
    } catch { showToast('No se pudo generar el Excel.', 'error') }
    finally { setLoadingEctaXls(false) }
  }

  return (
    <>
      <style>{`
        .inf-stk-wrap { padding: 24px; }
        @media (max-width: 768px) { .inf-stk-wrap { padding: 14px; } }

        .inf-stk-page-header { margin-bottom: 24px; }
        .inf-stk-page-header h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
        .inf-stk-page-header p  { font-size: 14px; color: #6b7280; margin: 0; }

        .inf-stk-section { margin-bottom: 28px; }
        .inf-stk-section-label {
          display: flex; align-items: center; gap: 8px;
          font-size: 11px; font-weight: 700; letter-spacing: .08em;
          text-transform: uppercase; color: #6b7280; margin-bottom: 14px;
        }
        .inf-stk-section-line { flex: 1; height: 1px; background: #e8edf2; }

        .inf-stk-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 768px) { .inf-stk-grid { grid-template-columns: 1fr; gap: 10px; } }

        .inf-stk-card {
          background: #fff; border: 1px solid #e8edf2; border-radius: 10px;
          padding: 16px 18px; cursor: pointer; position: relative;
          display: flex; flex-direction: column; gap: 8px; transition: all 0.2s ease;
        }
        .inf-stk-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.10); border-color: #bfdbfe; transform: translateY(-2px); }
        .inf-stk-card-listado { border-left: 3px solid #1a3a5c; }
        .inf-stk-card-listado:hover { border-left-color: #1a3a5c; }

        .inf-stk-card-icon {
          background: #e8f0fe; border-radius: 10px; padding: 10px;
          display: inline-flex; align-items: center; justify-content: center;
          width: 44px; height: 44px; flex-shrink: 0;
        }
        .inf-stk-badge {
          position: absolute; top: 12px; right: 12px;
          font-size: 11px; font-weight: 500; border-radius: 4px; padding: 2px 6px; white-space: nowrap;
        }
        .inf-stk-badge-export { background: #f0fdf4; color: #16a34a; }
        @media (max-width: 768px) { .inf-stk-badge { position: static; align-self: flex-start; } }

        .inf-stk-card-title { font-size: 13px; font-weight: 600; color: #111827; }
        .inf-stk-card-desc  { font-size: 11.5px; color: #6b7280; line-height: 1.45; }
        .inf-stk-card-chevron { position: absolute; bottom: 10px; right: 10px; opacity: 0; transition: opacity 0.2s ease; }
        .inf-stk-card:hover .inf-stk-card-chevron { opacity: 1; }
        @media (max-width: 768px) { .inf-stk-card-chevron { display: none; } }

        .inf-stk-filtros-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .inf-stk-filtros-grid .full { grid-column: 1 / -1; }
        @media (max-width: 480px) { .inf-stk-filtros-grid { grid-template-columns: 1fr; } }

        .inf-stk-sep-label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; margin: 0 0 10px; }

        .inf-stk-footer {
          margin-top: 18px; display: flex; gap: 10px;
          justify-content: flex-end; flex-wrap: wrap;
          border-top: 1px solid #e8edf2; padding-top: 14px;
        }
        .inf-stk-btn-pdf {
          display: flex; align-items: center; gap: 7px; padding: 8px 16px;
          border-radius: 6px; font-size: 13px; font-weight: 500;
          background: #1a3a5c; color: #fff; border: none; cursor: pointer; transition: background .15s;
        }
        .inf-stk-btn-pdf:hover:not(:disabled) { background: #15304d; }
        .inf-stk-btn-pdf:disabled { opacity: .6; cursor: not-allowed; }
        .inf-stk-btn-xls {
          display: flex; align-items: center; gap: 7px; padding: 8px 16px;
          border-radius: 6px; font-size: 13px; font-weight: 500;
          background: #166534; color: #fff; border: none; cursor: pointer; transition: background .15s;
        }
        .inf-stk-btn-xls:hover:not(:disabled) { background: #14532d; }
        .inf-stk-btn-xls:disabled { opacity: .6; cursor: not-allowed; }

        .inf-stk-cli-dropdown {
          position: absolute; top: 100%; left: 0; right: 0; background: #fff;
          border: 1px solid #e5e7eb; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,.08);
          z-index: 50; max-height: 180px; overflow-y: auto; margin-top: 3px;
        }
        .inf-stk-cli-item { padding: 8px 12px; font-size: 13px; cursor: pointer; border-bottom: 1px solid #f3f4f6; }
        .inf-stk-cli-item:last-child { border-bottom: none; }
        .inf-stk-cli-item:hover, .inf-stk-cli-item.focus { background: #f0f5fb; }
        .inf-stk-cli-sub { font-size: 11px; color: #9ca3af; }
        .inf-stk-cli-clear { padding: 0 10px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; color: #374151; cursor: pointer; }
        .inf-stk-cli-clear:hover { background: #e5e7eb; }

        .inf-stk-check-row {
          display: flex; align-items: center; gap: 8px; padding: 10px 0 2px;
        }
        .inf-stk-check-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: #1a3a5c; cursor: pointer; }
        .inf-stk-check-row label { font-size: 13px; color: #374151; cursor: pointer; user-select: none; }
        .inf-stk-check-hint { font-size: 11px; color: #9ca3af; margin: 2px 0 10px 24px; line-height: 1.4; }

        .inf-stk-toggle { display: flex; background: #e8edf2; border-radius: 6px; padding: 2px; gap: 2px; margin-bottom: 6px; }
        .inf-stk-toggle-btn { flex: 1; padding: 6px 0; border-radius: 4px; font-size: 12px; font-weight: 500; border: none; background: transparent; color: #6b7280; cursor: pointer; transition: all .15s; text-align: center; }
        .inf-stk-toggle-btn.active { background: #fff; color: #1a3a5c; font-weight: 700; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
        .inf-stk-modo-desc { font-size: 11px; color: #9ca3af; margin-bottom: 14px; }

        .inf-stk-date-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; }
        .inf-stk-date-label { font-size: 12px; color: #6b7280; font-weight: 500; min-width: 44px; }
      `}</style>

      <div className="inf-stk-wrap">
        <div className="inf-stk-page-header">
          <h1>Informes — Gestión</h1>
          <p>Reportes y listados del módulo de facturación y stock</p>
        </div>

        <div className="inf-stk-section">
          <div className="inf-stk-section-label">
            <FileText size={14} color="#6b7280" />
            <span>Listados exportables</span>
            <div className="inf-stk-section-line" />
          </div>
          <div className="inf-stk-grid">

            <div className="inf-stk-card inf-stk-card-listado" onClick={handleAbrirProductos}>
              <div className="inf-stk-card-icon"><Package size={24} color="#1a3a5c" /></div>
              <div className="inf-stk-card-title">Productos por grupo</div>
              <span className="inf-stk-badge inf-stk-badge-export">PDF · Excel</span>
              <div className="inf-stk-card-desc">Listado agrupado por grupo, filtrable por grupo específico</div>
              <ChevronRight size={16} color="#1a3a5c" className="inf-stk-card-chevron" />
            </div>

            <div className="inf-stk-card inf-stk-card-listado" onClick={handleAbrirFacturas}>
              <div className="inf-stk-card-icon"><Receipt size={24} color="#1a3a5c" /></div>
              <div className="inf-stk-card-title">Listado de facturas</div>
              <span className="inf-stk-badge inf-stk-badge-export">PDF · Excel</span>
              <div className="inf-stk-card-desc">Filtrable por cliente, rango de fechas y condición. Opción de agrupar por cliente</div>
              <ChevronRight size={16} color="#1a3a5c" className="inf-stk-card-chevron" />
            </div>

            <div className="inf-stk-card inf-stk-card-listado" onClick={handleAbrirControl}>
              <div className="inf-stk-card-icon"><ShieldAlert size={24} color="#1a3a5c" /></div>
              <div className="inf-stk-card-title">Control de comprobantes</div>
              <span className="inf-stk-badge inf-stk-badge-export">PDF · Excel</span>
              <div className="inf-stk-card-desc">Anuladas y números no emitidos (salteados). Filtra anuladas por rango de fechas</div>
              <ChevronRight size={16} color="#1a3a5c" className="inf-stk-card-chevron" />
            </div>

            <div className="inf-stk-card inf-stk-card-listado" onClick={handleAbrirEcta}>
              <div className="inf-stk-card-icon"><ClipboardList size={24} color="#1a3a5c" /></div>
              <div className="inf-stk-card-title">Estado de cuenta</div>
              <span className="inf-stk-badge inf-stk-badge-export">PDF · Excel</span>
              <div className="inf-stk-card-desc">Cuotas a cobrar agrupadas por cliente, en modo detallado o resumido</div>
              <ChevronRight size={16} color="#1a3a5c" className="inf-stk-card-chevron" />
            </div>

            <div className="inf-stk-card inf-stk-card-listado" onClick={handleAbrirExt}>
              <div className="inf-stk-card-icon"><BookOpen size={24} color="#1a3a5c" /></div>
              <div className="inf-stk-card-title">Extracto de cuenta</div>
              <span className="inf-stk-badge inf-stk-badge-export">PDF · Excel</span>
              <div className="inf-stk-card-desc">Facturas y recibos por cliente — cronológico o agrupado por factura</div>
              <ChevronRight size={16} color="#1a3a5c" className="inf-stk-card-chevron" />
            </div>

            <div className="inf-stk-card inf-stk-card-listado" onClick={handleAbrirCob}>
              <div className="inf-stk-card-icon"><FileText size={24} color="#1a3a5c" /></div>
              <div className="inf-stk-card-title">Cobranzas / Recibos</div>
              <span className="inf-stk-badge inf-stk-badge-export">PDF · Excel</span>
              <div className="inf-stk-card-desc">Listado de recibos emitidos, filtrable por cliente y rango de fechas</div>
              <ChevronRight size={16} color="#1a3a5c" className="inf-stk-card-chevron" />
            </div>

            <div className="inf-stk-card inf-stk-card-listado" onClick={handleAbrirMov}>
              <div className="inf-stk-card-icon"><FileSpreadsheet size={24} color="#1a3a5c" /></div>
              <div className="inf-stk-card-title">Movimientos Caja/Banco</div>
              <span className="inf-stk-badge inf-stk-badge-export">PDF · Excel</span>
              <div className="inf-stk-card-desc">Movimientos por cuenta y período — filtrable por tipo (ingreso/egreso)</div>
              <ChevronRight size={16} color="#1a3a5c" className="inf-stk-card-chevron" />
            </div>

            <div className="inf-stk-card inf-stk-card-listado" onClick={handleAbrirPago}>
              <div className="inf-stk-card-icon"><Receipt size={24} color="#1a3a5c" /></div>
              <div className="inf-stk-card-title">Pagos a Prestadores</div>
              <span className="inf-stk-badge inf-stk-badge-export">PDF · Excel</span>
              <div className="inf-stk-card-desc">Pagos emitidos a prestadores, filtrable por prestador, estado y rango de fechas</div>
              <ChevronRight size={16} color="#1a3a5c" className="inf-stk-card-chevron" />
            </div>

          </div>
        </div>

        <div className="inf-stk-section">
          <div className="inf-stk-section-label">
            <BarChart2 size={14} color="#6b7280" />
            <span>Dashboards analíticos</span>
            <div className="inf-stk-section-line" />
          </div>
          <div className="inf-stk-grid">

            <div className="inf-stk-card" onClick={() => navigate('/informes/dashboard/facturacion')}
              style={{ borderLeft: '3px solid #d97706' }}>
              <div className="inf-stk-card-icon" style={{ background: '#fef3c7' }}>
                <BarChart2 size={24} color="#d97706" />
              </div>
              <div className="inf-stk-card-title">Dashboard Facturación</div>
              <div className="inf-stk-card-desc">Comprobantes emitidos por día, contado vs crédito, ticket promedio y top clientes del mes</div>
              <ChevronRight size={16} color="#d97706" className="inf-stk-card-chevron" />
            </div>

            <div className="inf-stk-card" onClick={() => navigate('/informes/dashboard/finanzas')}
              style={{ borderLeft: '3px solid #16a34a' }}>
              <div className="inf-stk-card-icon" style={{ background: '#dcfce7' }}>
                <BarChart2 size={24} color="#16a34a" />
              </div>
              <div className="inf-stk-card-title">Dashboard Finanzas</div>
              <div className="inf-stk-card-desc">Saldos por cuenta, ingresos vs egresos del mes y flujo diario</div>
              <ChevronRight size={16} color="#16a34a" className="inf-stk-card-chevron" />
            </div>

            <div className="inf-stk-card" onClick={() => navigate('/informes/dashboard/cobranzas')}
              style={{ borderLeft: '3px solid #7c3aed' }}>
              <div className="inf-stk-card-icon" style={{ background: '#ede9fe' }}>
                <BarChart2 size={24} color="#7c3aed" />
              </div>
              <div className="inf-stk-card-title">Dashboard Cobranzas</div>
              <div className="inf-stk-card-desc">Cobrado del mes, deuda pendiente, % de cobro y top deudores</div>
              <ChevronRight size={16} color="#7c3aed" className="inf-stk-card-chevron" />
            </div>

          </div>
        </div>
      </div>

      {/* ── Modal Productos ── */}
      <Modal isOpen={productosAbierto} onClose={() => setProductosAbierto(false)} title="Productos por grupo" size="sm">
        <div style={{ paddingBottom: 8 }}>
          <div className="form-group">
            <label className="form-label">Grupo</label>
            <select
              className="input"
              value={filtrosProd.grupo}
              onChange={e => setFiltrosProd(prev => ({ ...prev, grupo: e.target.value }))}
            >
              <option value="">Todos los grupos</option>
              {grupos.map(g => <option key={g.id} value={g.id}>{g.descripcion}</option>)}
            </select>
          </div>
          <div className="inf-stk-footer">
            <button className="inf-stk-btn-pdf" onClick={handleProdPdf} disabled={loadingProdPdf || loadingProdXls}>
              <FileText size={16} />{loadingProdPdf ? 'Generando...' : 'Ver PDF'}
            </button>
            <button className="inf-stk-btn-xls" onClick={handleProdXls} disabled={loadingProdPdf || loadingProdXls}>
              <FileSpreadsheet size={16} />{loadingProdXls ? 'Generando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Facturas ── */}
      <Modal isOpen={facturasAbierto} onClose={() => setFacturasAbierto(false)} title="Listado de facturas" size="md">
        <div style={{ paddingBottom: 8 }}>
          <div className="inf-stk-filtros-grid">

            <div className="form-group full">
              <label className="form-label">Cliente</label>
              {clienteId ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" readOnly value={clienteNombre} style={{ flex: 1 }} />
                  <button className="inf-stk-cli-clear" onClick={limpiarCliente}>✕</button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    placeholder="Buscar por nombre o documento..."
                    value={clienteSearch}
                    onChange={e => setClienteSearch(e.target.value)}
                    onKeyDown={handleClienteKeyDown}
                    autoComplete="off"
                  />
                  {clienteRes.length > 0 && (
                    <div className="inf-stk-cli-dropdown" ref={clienteListRef}>
                      {clienteRes.map((p, idx) => (
                        <div
                          key={p.id}
                          className={`inf-stk-cli-item${idx === clienteFocusIdx ? ' focus' : ''}`}
                          onClick={() => seleccionarCliente(p)}
                          onMouseEnter={() => setClienteFocusIdx(idx)}
                        >
                          {p.razon_social}
                          {p.nro_documento && <span style={{ color: '#9ca3af', fontSize: 11, marginLeft: 6 }}>{p.nro_documento}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="form-group full"><p className="inf-stk-sep-label">Rango de fechas</p></div>
            <div className="form-group">
              <label className="form-label">Desde</label>
              <input type="date" className="input" value={filtrosFact.fecha_desde}
                onChange={e => setFiltrosFact(prev => ({ ...prev, fecha_desde: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Hasta</label>
              <input type="date" className="input" value={filtrosFact.fecha_hasta}
                onChange={e => setFiltrosFact(prev => ({ ...prev, fecha_hasta: e.target.value }))} />
            </div>

            <div className="form-group full">
              <label className="form-label">Condición de venta</label>
              <select className="input" value={filtrosFact.condicion_vta}
                onChange={e => setFiltrosFact(prev => ({ ...prev, condicion_vta: e.target.value }))}>
                {CONDICION_OPCIONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="form-group full">
              <div className="inf-stk-check-row">
                <input
                  type="checkbox"
                  id="agrupar-cliente"
                  checked={filtrosFact.agrupar_cliente}
                  onChange={e => setFiltrosFact(prev => ({ ...prev, agrupar_cliente: e.target.checked }))}
                />
                <label htmlFor="agrupar-cliente">Agrupar por cliente</label>
              </div>
            </div>

          </div>
          <div className="inf-stk-footer">
            <button className="inf-stk-btn-pdf" onClick={handleFacPdf} disabled={loadingFacPdf || loadingFacXls}>
              <FileText size={16} />{loadingFacPdf ? 'Generando...' : 'Ver PDF'}
            </button>
            <button className="inf-stk-btn-xls" onClick={handleFacXls} disabled={loadingFacPdf || loadingFacXls}>
              <FileSpreadsheet size={16} />{loadingFacXls ? 'Generando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Control comprobantes ── */}
      <Modal isOpen={controlAbierto} onClose={() => setControlAbierto(false)} title="Control de comprobantes" size="sm">
        <div style={{ paddingBottom: 8 }}>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 14px', lineHeight: 1.5 }}>
            Muestra facturas <strong>anuladas</strong> en el rango de fechas seleccionado,
            y <strong>números no emitidos</strong> (salteados) en todos los timbrados con comprobantes activos.
          </p>
          <div className="inf-stk-filtros-grid">
            <div className="form-group full"><p className="inf-stk-sep-label">Rango de fechas (anuladas)</p></div>
            <div className="form-group">
              <label className="form-label">Desde</label>
              <input type="date" className="input" value={filtrosControl.fecha_desde}
                onChange={e => setFiltrosControl(prev => ({ ...prev, fecha_desde: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Hasta</label>
              <input type="date" className="input" value={filtrosControl.fecha_hasta}
                onChange={e => setFiltrosControl(prev => ({ ...prev, fecha_hasta: e.target.value }))} />
            </div>
          </div>
          <div className="inf-stk-footer">
            <button className="inf-stk-btn-pdf" onClick={handleCtrlPdf} disabled={loadingCtrlPdf || loadingCtrlXls}>
              <FileText size={16} />{loadingCtrlPdf ? 'Generando...' : 'Ver PDF'}
            </button>
            <button className="inf-stk-btn-xls" onClick={handleCtrlXls} disabled={loadingCtrlPdf || loadingCtrlXls}>
              <FileSpreadsheet size={16} />{loadingCtrlXls ? 'Generando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Estado de cuenta ── */}
      <Modal isOpen={ectaAbierto} onClose={() => setEctaAbierto(false)} title="Estado de cuenta" size="md">
        <div style={{ paddingBottom: 8 }}>

          {/* Modo */}
          <div className="form-group">
            <label className="form-label">Modo de informe</label>
            <div className="inf-stk-toggle">
              <button className={`inf-stk-toggle-btn${ectaModo === 'detallado' ? ' active' : ''}`} onClick={() => setEctaModo('detallado')}>
                Detallado
              </button>
              <button className={`inf-stk-toggle-btn${ectaModo === 'resumido' ? ' active' : ''}`} onClick={() => setEctaModo('resumido')}>
                Resumido
              </button>
            </div>
            <div className="inf-stk-modo-desc">
              {ectaModo === 'detallado'
                ? 'Muestra cada cuota con comprobante, fechas, monto y saldo agrupado por cliente.'
                : 'Muestra una línea por cliente con el total de cuotas y saldo acumulado.'}
            </div>
          </div>

          {/* Rango de fecha */}
          <div className="inf-stk-check-row">
            <input
              type="checkbox"
              id="ecta-usar-rango"
              checked={ectaUsarRango}
              onChange={e => setEctaUsarRango(e.target.checked)}
            />
            <label htmlFor="ecta-usar-rango">Rango de fecha</label>
          </div>
          <div className="inf-stk-check-hint">
            {ectaUsarRango
              ? 'Filtra por fecha de factura entre Desde y Hasta.'
              : 'Incluye todo hasta la fecha indicada, sin límite inferior.'}
          </div>

          <div className="inf-stk-date-row">
            {ectaUsarRango && (
              <>
                <span className="inf-stk-date-label">Desde</span>
                <input type="date" className="input" style={{ width: 150 }}
                  value={ectaFechaDesde} onChange={e => setEctaFechaDesde(e.target.value)} max="2099-12-31" />
              </>
            )}
            <span className="inf-stk-date-label">Hasta</span>
            <input type="date" className="input" style={{ width: 150 }}
              value={ectaFechaHasta} onChange={e => setEctaFechaHasta(e.target.value)} max="2099-12-31" />
          </div>

          {/* Cliente */}
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Cliente</label>
            {ectaClienteId ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="input" readOnly value={ectaClienteNombre} style={{ flex: 1 }} />
                <button className="inf-stk-cli-clear" onClick={limpiarEctaCliente}>✕</button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  placeholder="Buscar por nombre o documento..."
                  value={ectaClienteSearch}
                  onChange={e => setEctaClienteSearch(e.target.value)}
                  onKeyDown={handleEctaClienteKeyDown}
                  autoComplete="off"
                />
                {ectaClienteRes.length > 0 && (
                  <div className="inf-stk-cli-dropdown" ref={ectaListRef}>
                    {ectaClienteRes.map((p, idx) => (
                      <div
                        key={p.id}
                        className={`inf-stk-cli-item${idx === ectaClienteFocus ? ' focus' : ''}`}
                        onClick={() => seleccionarEctaCliente(p)}
                        onMouseEnter={() => setEctaClienteFocus(idx)}
                      >
                        {p.razon_social}
                        {p.nro_documento && <span className="inf-stk-cli-sub" style={{ marginLeft: 6 }}>{p.nro_documento}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Incluir saldo cero */}
          <div className="inf-stk-check-row" style={{ marginTop: 6 }}>
            <input
              type="checkbox"
              id="ecta-incluir-saldo0"
              checked={ectaIncluirSaldo0}
              onChange={e => setEctaIncluirSaldo0(e.target.checked)}
            />
            <label htmlFor="ecta-incluir-saldo0">Incluir saldo cero</label>
          </div>
          <div className="inf-stk-check-hint">
            {ectaIncluirSaldo0
              ? 'Se incluyen todos los registros, incluso los ya cancelados.'
              : 'Solo se muestran registros con saldo pendiente (saldo > 0).'}
          </div>

          <div className="inf-stk-footer">
            <button className="inf-stk-btn-pdf" onClick={handleEctaPdf} disabled={loadingEctaPdf || loadingEctaXls}>
              <FileText size={16} />{loadingEctaPdf ? 'Generando...' : 'Ver PDF'}
            </button>
            <button className="inf-stk-btn-xls" onClick={handleEctaXls} disabled={loadingEctaPdf || loadingEctaXls}>
              <FileSpreadsheet size={16} />{loadingEctaXls ? 'Generando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Cobranzas ── */}
      <Modal isOpen={cobAbierto} onClose={() => setCobAbierto(false)} title="Cobranzas / Recibos" size="md">
        <div style={{ paddingBottom: 8 }}>
          <div className="inf-stk-filtros-grid">
            <div className="form-group full"><p className="inf-stk-sep-label">Rango de fechas</p></div>
            <div className="form-group">
              <label className="form-label">Desde</label>
              <input type="date" className="input" value={cobFechaDesde}
                onChange={e => setCobFechaDesde(e.target.value)} max="2099-12-31" />
            </div>
            <div className="form-group">
              <label className="form-label">Hasta</label>
              <input type="date" className="input" value={cobFechaHasta}
                onChange={e => setCobFechaHasta(e.target.value)} max="2099-12-31" />
            </div>
            <div className="form-group full">
              <label className="form-label">Cliente (opcional)</label>
              {cobClienteId ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" readOnly value={cobClienteNombre} style={{ flex: 1 }} />
                  <button className="inf-stk-cli-clear" onClick={limpiarCobCliente}>✕</button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input className="input" placeholder="Buscar por nombre o documento..."
                    value={cobClienteSearch} onChange={e => setCobClienteSearch(e.target.value)}
                    onKeyDown={handleCobClienteKeyDown} autoComplete="off" />
                  {cobClienteRes.length > 0 && (
                    <div className="inf-stk-cli-dropdown" ref={cobListRef}>
                      {cobClienteRes.map((p, idx) => (
                        <div key={p.id} className={`inf-stk-cli-item${idx === cobClienteFocus ? ' focus' : ''}`}
                          onClick={() => seleccionarCobCliente(p)} onMouseEnter={() => setCobClienteFocus(idx)}>
                          {p.razon_social}
                          {p.nro_documento && <span className="inf-stk-cli-sub" style={{ marginLeft: 6 }}>{p.nro_documento}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="inf-stk-footer">
            <button className="inf-stk-btn-pdf" onClick={handleCobPdf} disabled={loadingCobPdf || loadingCobXls}>
              <FileText size={16} />{loadingCobPdf ? 'Generando...' : 'Ver PDF'}
            </button>
            <button className="inf-stk-btn-xls" onClick={handleCobXls} disabled={loadingCobPdf || loadingCobXls}>
              <FileSpreadsheet size={16} />{loadingCobXls ? 'Generando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Movimientos Caja/Banco ── */}
      <Modal isOpen={movAbierto} onClose={() => setMovAbierto(false)} title="Movimientos Caja / Banco" size="md">
        <div style={{ paddingBottom: 8 }}>
          <div className="inf-stk-filtros-grid">
            <div className="form-group">
              <label className="form-label">Cuenta</label>
              <select className="input" value={movCuenta} onChange={e => setMovCuenta(e.target.value)}>
                <option value="">Todas las cuentas</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.descripcion}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="input" value={movTipo} onChange={e => setMovTipo(e.target.value)}>
                <option value="">Todos</option>
                <option value="ingreso">Solo ingresos</option>
                <option value="egreso">Solo egresos</option>
              </select>
            </div>
            <div className="form-group full"><p className="inf-stk-sep-label">Rango de fechas</p></div>
            <div className="form-group">
              <label className="form-label">Desde</label>
              <input type="date" className="input" value={movFechaDesde}
                onChange={e => setMovFechaDesde(e.target.value)} max="2099-12-31" />
            </div>
            <div className="form-group">
              <label className="form-label">Hasta</label>
              <input type="date" className="input" value={movFechaHasta}
                onChange={e => setMovFechaHasta(e.target.value)} max="2099-12-31" />
            </div>
          </div>
          <div className="inf-stk-footer">
            <button className="inf-stk-btn-pdf" onClick={handleMovPdf} disabled={loadingMovPdf || loadingMovXls}>
              <FileText size={16} />{loadingMovPdf ? 'Generando...' : 'Ver PDF'}
            </button>
            <button className="inf-stk-btn-xls" onClick={handleMovXls} disabled={loadingMovPdf || loadingMovXls}>
              <FileSpreadsheet size={16} />{loadingMovXls ? 'Generando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Pagos a Prestadores ── */}
      <Modal isOpen={pagoAbierto} onClose={() => setPagoAbierto(false)} title="Pagos a Prestadores" size="md">
        <div style={{ paddingBottom: 8 }}>
          <div className="inf-stk-filtros-grid">
            <div className="form-group full"><p className="inf-stk-sep-label">Rango de fechas</p></div>
            <div className="form-group">
              <label className="form-label">Desde</label>
              <input type="date" className="input" value={pagoFechaDesde}
                onChange={e => setPagoFechaDesde(e.target.value)} max="2099-12-31" />
            </div>
            <div className="form-group">
              <label className="form-label">Hasta</label>
              <input type="date" className="input" value={pagoFechaHasta}
                onChange={e => setPagoFechaHasta(e.target.value)} max="2099-12-31" />
            </div>
            <div className="form-group full">
              <label className="form-label">Estado</label>
              <select className="input" value={pagoEstado} onChange={e => setPagoEstado(e.target.value)}>
                <option value="">Todos</option>
                <option value="pagado">Pagado</option>
                <option value="pendiente">Pendiente</option>
                <option value="parcial">Parcial</option>
              </select>
            </div>
            <div className="form-group full">
              <label className="form-label">Prestador (opcional)</label>
              {pagoPrestadorId ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" readOnly value={pagoPrestadorNombre} style={{ flex: 1 }} />
                  <button className="inf-stk-cli-clear" onClick={limpiarPagoPrestador}>✕</button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input className="input" placeholder="Buscar por nombre o documento..."
                    value={pagoPrestadorSearch} onChange={e => setPagoPrestadorSearch(e.target.value)}
                    onKeyDown={handlePagoPrestadorKeyDown} autoComplete="off" />
                  {pagoPrestadorRes.length > 0 && (
                    <div className="inf-stk-cli-dropdown" ref={pagoListRef}>
                      {pagoPrestadorRes.map((m, idx) => (
                        <div key={m.id} className={`inf-stk-cli-item${idx === pagoPrestadorFocus ? ' focus' : ''}`}
                          onClick={() => seleccionarPagoPrestador(m)} onMouseEnter={() => setPagoPrestadorFocus(idx)}>
                          {m.nombre ?? m.persona?.razon_social}
                          {(m.documento ?? m.persona?.nro_documento) && (
                            <span className="inf-stk-cli-sub" style={{ marginLeft: 6 }}>{m.documento ?? m.persona?.nro_documento}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="inf-stk-footer">
            <button className="inf-stk-btn-pdf" onClick={handlePagoPdf} disabled={loadingPagoPdf || loadingPagoXls}>
              <FileText size={16} />{loadingPagoPdf ? 'Generando...' : 'Ver PDF'}
            </button>
            <button className="inf-stk-btn-xls" onClick={handlePagoXls} disabled={loadingPagoPdf || loadingPagoXls}>
              <FileSpreadsheet size={16} />{loadingPagoXls ? 'Generando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Extracto de cuenta ── */}
      <Modal isOpen={extAbierto} onClose={() => setExtAbierto(false)} title="Extracto de cuenta — Clientes" size="md">
        <div style={{ paddingBottom: 8 }}>

          {/* Modo agrupación */}
          <div className="form-group">
            <label className="form-label">Modo de agrupación</label>
            <div className="inf-stk-toggle">
              <button className={`inf-stk-toggle-btn${!extAgrupar ? ' active' : ''}`} onClick={() => setExtAgrupar(false)}>
                Cronológico
              </button>
              <button className={`inf-stk-toggle-btn${extAgrupar ? ' active' : ''}`} onClick={() => setExtAgrupar(true)}>
                Por factura
              </button>
            </div>
            <div className="inf-stk-modo-desc">
              {extAgrupar
                ? 'Agrupado por cliente → factura → recibos aplicados a esa factura.'
                : 'Agrupado por cliente, listando facturas y recibos ordenados por fecha.'}
            </div>
          </div>

          {/* Rango de fecha */}
          <div className="inf-stk-check-row">
            <input
              type="checkbox"
              id="ext-usar-rango"
              checked={extUsarRango}
              onChange={e => setExtUsarRango(e.target.checked)}
            />
            <label htmlFor="ext-usar-rango">Rango de fecha</label>
          </div>
          <div className="inf-stk-check-hint">
            {extUsarRango
              ? 'Filtra movimientos con fecha entre Desde y Hasta.'
              : 'Incluye todo hasta la fecha indicada, sin límite inferior.'}
          </div>

          <div className="inf-stk-date-row">
            {extUsarRango && (
              <>
                <span className="inf-stk-date-label">Desde</span>
                <input type="date" className="input" style={{ width: 150 }}
                  value={extFechaDesde} onChange={e => setExtFechaDesde(e.target.value)} max="2099-12-31" />
              </>
            )}
            <span className="inf-stk-date-label">Hasta</span>
            <input type="date" className="input" style={{ width: 150 }}
              value={extFechaHasta} onChange={e => setExtFechaHasta(e.target.value)} max="2099-12-31" />
          </div>

          {/* Cliente */}
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Cliente</label>
            {extClienteId ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="input" readOnly value={extClienteNombre} style={{ flex: 1 }} />
                <button className="inf-stk-cli-clear" onClick={limpiarExtCliente}>✕</button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  placeholder="Buscar por nombre o documento..."
                  value={extClienteSearch}
                  onChange={e => setExtClienteSearch(e.target.value)}
                  onKeyDown={handleExtClienteKeyDown}
                  autoComplete="off"
                />
                {extClienteRes.length > 0 && (
                  <div className="inf-stk-cli-dropdown" ref={extListRef}>
                    {extClienteRes.map((p, idx) => (
                      <div
                        key={p.id}
                        className={`inf-stk-cli-item${idx === extClienteFocus ? ' focus' : ''}`}
                        onClick={() => seleccionarExtCliente(p)}
                        onMouseEnter={() => setExtClienteFocus(idx)}
                      >
                        {p.razon_social}
                        {p.nro_documento && <span className="inf-stk-cli-sub" style={{ marginLeft: 6 }}>{p.nro_documento}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Incluir saldo cero */}
          <div className="inf-stk-check-row" style={{ marginTop: 6 }}>
            <input
              type="checkbox"
              id="ext-incluir-saldo0"
              checked={extIncluirSaldo0}
              onChange={e => setExtIncluirSaldo0(e.target.checked)}
            />
            <label htmlFor="ext-incluir-saldo0">Incluir saldo cero</label>
          </div>
          <div className="inf-stk-check-hint">
            {extIncluirSaldo0
              ? 'Se incluyen todos los clientes, incluso los ya cancelados.'
              : 'Solo se muestran clientes con saldo pendiente (saldo > 0).'}
          </div>

          <div className="inf-stk-footer">
            <button className="inf-stk-btn-pdf" onClick={handleExtPdf} disabled={loadingExtPdf || loadingExtXls}>
              <FileText size={16} />{loadingExtPdf ? 'Generando...' : 'Ver PDF'}
            </button>
            <button className="inf-stk-btn-xls" onClick={handleExtXls} disabled={loadingExtPdf || loadingExtXls}>
              <FileSpreadsheet size={16} />{loadingExtXls ? 'Generando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  )
}
