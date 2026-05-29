import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, FileSpreadsheet, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useToast } from '../../hooks/useToast'
import Toast from '../../components/ui/Toast'
import apiClient from '../../api/client'

function hoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function useBuscarPersonas(search) {
  return useQuery({
    queryKey: ['personas-buscar-ecta', search],
    queryFn: async () => {
      const { data } = await apiClient.get('/persona/', { params: { search, page_size: 8 } })
      return data
    },
    enabled: search?.length >= 2,
    staleTime: 10000,
  })
}

export default function EstadoCuentaPage() {
  const navigate          = useNavigate()
  const { toast, showToast } = useToast()

  const [modo,              setModo]             = useState('detallado')
  const [usarRango,         setUsarRango]         = useState(true)
  const [fechaDesde,        setFechaDesde]        = useState(hoy())
  const [fechaHasta,        setFechaHasta]        = useState(hoy())
  const [persona,           setPersona]           = useState(null)
  const [busquedaPersona,   setBusquedaPersona]   = useState('')
  const [dropPersona,       setDropPersona]       = useState(false)
  const [incluirSaldoCero,  setIncluirSaldoCero]  = useState(false)
  const [loadingPdf,        setLoadingPdf]        = useState(false)
  const [loadingXls,        setLoadingXls]        = useState(false)

  const dropRef  = useRef(null)
  const inputRef = useRef(null)

  const { data: personaResultados } = useBuscarPersonas(busquedaPersona)
  const resultados = Array.isArray(personaResultados?.results)
    ? personaResultados.results
    : Array.isArray(personaResultados) ? personaResultados : []

  function buildParams() {
    const p = new URLSearchParams()
    p.set('modo', modo)
    p.set('usar_rango', usarRango ? 'true' : 'false')
    if (usarRango && fechaDesde) p.set('fecha_desde', fechaDesde)
    if (fechaHasta) p.set('fecha_hasta', fechaHasta)
    if (persona) p.set('persona', String(persona.id))
    if (incluirSaldoCero) p.set('incluir_saldo_cero', 'true')
    return p.toString()
  }

  async function handlePdf() {
    setLoadingPdf(true)
    try {
      const res = await apiClient.get(`/facturacion/estado-cuenta-pdf/?${buildParams()}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch {
      showToast('No se pudo generar el PDF.', 'error')
    } finally {
      setLoadingPdf(false)
    }
  }

  async function handleExcel() {
    setLoadingXls(true)
    try {
      const res = await apiClient.get(`/facturacion/estado-cuenta-excel/?${buildParams()}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a   = document.createElement('a')
      a.href = url
      a.download = `estado_cuenta_${hoy()}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showToast('No se pudo generar el Excel.', 'error')
    } finally {
      setLoadingXls(false)
    }
  }

  function seleccionarPersona(p) {
    setPersona(p)
    setBusquedaPersona('')
    setDropPersona(false)
  }

  function limpiarPersona() {
    setPersona(null)
    setBusquedaPersona('')
  }

  return (
    <>
      <style>{`
        .ecta-wrap { padding: 24px; max-width: 720px; }

        .ecta-back {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 12px; font-weight: 500; color: #fff;
          background: #1a3a5c; border: none; border-radius: 8px;
          cursor: pointer; padding: 8px 16px; flex-shrink: 0;
          transition: background .15s; align-self: flex-start;
        }
        .ecta-back:hover { background: #15304d; }

        .ecta-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
        .ecta-header-text { flex: 1; }
        .ecta-header h1 { font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 3px; }
        .ecta-header p  { font-size: 13px; color: #6b7280; margin: 0; }

        .ecta-card { background: #f8fafc; border: 1px solid #e8edf2; border-radius: 10px; padding: 20px 22px; margin-bottom: 16px; }
        .ecta-section-title { font-size: 10.5px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 14px; }

        .ecta-toggle { display: flex; background: #e8edf2; border-radius: 7px; padding: 3px; gap: 3px; width: fit-content; margin-bottom: 4px; }
        .ecta-toggle-btn { padding: 6px 20px; border-radius: 5px; font-size: 12px; font-weight: 500; border: none; background: transparent; color: #6b7280; cursor: pointer; transition: all .15s; }
        .ecta-toggle-btn.active { background: #fff; color: #1a3a5c; font-weight: 700; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
        .ecta-modo-desc { font-size: 11px; color: #9ca3af; margin-top: 6px; }

        .ecta-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
        .ecta-label { font-size: 12px; font-weight: 600; color: #374151; min-width: 80px; }
        .ecta-check-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; cursor: pointer; }
        .ecta-check-row input[type=checkbox] { width: 15px; height: 15px; accent-color: #1a3a5c; cursor: pointer; }
        .ecta-check-label { font-size: 13px; color: #374151; font-weight: 500; user-select: none; }
        .ecta-check-sub { font-size: 11px; color: #9ca3af; margin-left: 23px; margin-top: -6px; margin-bottom: 8px; }

        .ecta-input { height: 34px; border: 1px solid #e5e7eb; border-radius: 7px; padding: 0 10px; font-size: 13px; color: #111827; background: #fff; outline: none; }
        .ecta-input:focus { border-color: #1a3a5c; }
        .ecta-input-date { width: 140px; }

        .ecta-persona-wrap { position: relative; flex: 1; min-width: 200px; }
        .ecta-persona-selected { display: flex; align-items: center; gap: 8px; background: #eef2f7; border: 1px solid #1a3a5c; border-radius: 7px; padding: 0 10px; height: 34px; }
        .ecta-persona-selected span { font-size: 13px; color: #1a3a5c; font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ecta-persona-clear { background: none; border: none; cursor: pointer; color: #6b7280; padding: 2px; display: flex; align-items: center; }
        .ecta-persona-clear:hover { color: #dc2626; }
        .ecta-persona-input { width: 100%; }

        .ecta-drop { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #fff; border: 1px solid #e8edf2; border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,.1); z-index: 100; overflow: hidden; max-height: 200px; overflow-y: auto; }
        .ecta-drop-item { padding: 8px 12px; cursor: pointer; font-size: 12.5px; color: #374151; border-bottom: 1px solid #f3f4f6; }
        .ecta-drop-item:hover { background: #f0f5fb; color: #1a3a5c; }
        .ecta-drop-item:last-child { border-bottom: none; }
        .ecta-drop-sub { font-size: 10.5px; color: #9ca3af; }

        .ecta-separator { height: 1px; background: #e8edf2; margin: 6px 0 16px; }

        .ecta-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .ecta-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; border: none; cursor: pointer; transition: background .15s; }
        .ecta-btn-pdf  { background: #1a3a5c; color: #fff; }
        .ecta-btn-pdf:hover  { background: #15304d; }
        .ecta-btn-xlsx { background: #16a34a; color: #fff; }
        .ecta-btn-xlsx:hover { background: #15803d; }
        .ecta-btn:disabled { opacity: .6; cursor: not-allowed; }

        @media (max-width: 600px) {
          .ecta-wrap { padding: 14px; }
          .ecta-header h1 { font-size: 18px; }
          .ecta-row { flex-direction: column; align-items: flex-start; }
          .ecta-input-date { width: 100%; }
        }
      `}</style>

      <div className="ecta-wrap">
        <div className="ecta-header">
          <div className="ecta-header-text">
            <h1>Estado de Cuenta</h1>
            <p>Cuotas a cobrar agrupadas por cliente — detallado o resumido</p>
          </div>
          <button className="ecta-back" onClick={() => navigate('/informes/stock')}>
            <ArrowLeft size={14} /> Volver a Informes
          </button>
        </div>

        {/* Modo */}
        <div className="ecta-card">
          <div className="ecta-section-title">Modo de informe</div>
          <div className="ecta-toggle">
            <button className={`ecta-toggle-btn${modo === 'detallado' ? ' active' : ''}`} onClick={() => setModo('detallado')}>
              Detallado
            </button>
            <button className={`ecta-toggle-btn${modo === 'resumido' ? ' active' : ''}`} onClick={() => setModo('resumido')}>
              Resumido
            </button>
          </div>
          <div className="ecta-modo-desc">
            {modo === 'detallado'
              ? 'Muestra cada cuota con comprobante, fechas, monto y saldo por cliente.'
              : 'Muestra una línea por cliente con el total de cuotas y saldo acumulado.'}
          </div>
        </div>

        {/* Filtros */}
        <div className="ecta-card">
          <div className="ecta-section-title">Filtros</div>

          {/* Rango de fecha */}
          <label className="ecta-check-row">
            <input type="checkbox" checked={usarRango} onChange={e => setUsarRango(e.target.checked)} />
            <span className="ecta-check-label">Rango de fecha</span>
          </label>
          <div className="ecta-check-sub">
            {usarRango ? 'Filtra por rango desde/hasta en la fecha de la factura.' : 'Filtra solo hasta la fecha indicada (incluye todo lo anterior).'}
          </div>

          <div className="ecta-row" style={{ marginBottom: 16 }}>
            {usarRango && (
              <>
                <span className="ecta-label">Desde</span>
                <input type="date" className="ecta-input ecta-input-date" value={fechaDesde}
                  onChange={e => setFechaDesde(e.target.value)} max="2099-12-31" />
              </>
            )}
            <span className="ecta-label">{usarRango ? 'Hasta' : 'Hasta'}</span>
            <input type="date" className="ecta-input ecta-input-date" value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)} max="2099-12-31" />
          </div>

          <div className="ecta-separator" />

          {/* Cliente */}
          <div className="ecta-row">
            <span className="ecta-label">Cliente</span>
            <div className="ecta-persona-wrap" ref={dropRef}>
              {persona ? (
                <div className="ecta-persona-selected">
                  <span>{persona.razon_social}</span>
                  <button className="ecta-persona-clear" onClick={limpiarPersona} title="Quitar filtro">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <input
                  ref={inputRef}
                  className="ecta-input ecta-persona-input"
                  placeholder="Buscar cliente… (mínimo 2 caracteres)"
                  value={busquedaPersona}
                  onChange={e => { setBusquedaPersona(e.target.value); setDropPersona(true) }}
                  onFocus={() => setDropPersona(true)}
                />
              )}
              {dropPersona && !persona && resultados.length > 0 && (
                <div className="ecta-drop">
                  {resultados.map(p => (
                    <div key={p.id} className="ecta-drop-item" onMouseDown={() => seleccionarPersona(p)}>
                      <div>{p.razon_social}</div>
                      <div className="ecta-drop-sub">{p.nro_documento}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="ecta-separator" />

          {/* Incluir saldo cero */}
          <label className="ecta-check-row">
            <input type="checkbox" checked={incluirSaldoCero} onChange={e => setIncluirSaldoCero(e.target.checked)} />
            <span className="ecta-check-label">Incluir saldo cero</span>
          </label>
          <div className="ecta-check-sub">
            {incluirSaldoCero
              ? 'Se muestran todos los registros, incluyendo los ya cancelados (saldo = 0).'
              : 'Solo se muestran registros con saldo pendiente (saldo > 0).'}
          </div>
        </div>

        {/* Descarga */}
        <div className="ecta-actions">
          <button className="ecta-btn ecta-btn-pdf" onClick={handlePdf} disabled={loadingPdf || loadingXls}>
            <FileText size={15} />
            {loadingPdf ? 'Generando…' : 'Ver PDF'}
          </button>
          <button className="ecta-btn ecta-btn-xlsx" onClick={handleExcel} disabled={loadingPdf || loadingXls}>
            <FileSpreadsheet size={15} />
            {loadingXls ? 'Generando…' : 'Descargar Excel'}
          </button>
        </div>
      </div>

      <Toast toast={toast} />
    </>
  )
}
