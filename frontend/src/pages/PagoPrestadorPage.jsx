import { useState, useRef, useEffect } from 'react'
import { Plus, Search, Trash2, Eye, X, AlertCircle, CheckCircle } from 'lucide-react'
import Modal from '../components/ui/Modal'
import Toast from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import {
  usePagosPrestador,
  useCreatePagoPrestador,
  useDeletePagoPrestador,
  useSiguienteNumeroPago,
  useBloquesPendientes,
  usePagoPrestadorDetalle,
} from '../hooks/usePagoPrestador'
import { useFormaPago } from '../hooks/useFacturacion'
import apiClient from '../api/client'

// ── Utilidades ────────────────────────────────────────────────────────────────
function hoy() { return new Date().toISOString().split('T')[0] }
function fmt(n) { if (n == null) return '—'; return Number(n).toLocaleString('es-PY') }
function fmtFecha(d) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
function diaSemana(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number)
  return DIAS[new Date(y, m - 1, d).getDay()]
}

// ── Buscador de médico (PersonaRRHH) ─────────────────────────────────────────
function BuscadorMedico({ value, onSelect }) {
  const [query, setQuery] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [debouncedQ, setDebouncedQ] = useState('')
  const timerRef = useRef(null)

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedQ(query), 300)
    return () => clearTimeout(timerRef.current)
  }, [query])

  const [resultados, setResultados] = useState([])
  useEffect(() => {
    if (debouncedQ.length < 2) { setResultados([]); return }
    apiClient.get('/personarrhh/', { params: { search: debouncedQ, page_size: 8 } })
      .then(r => setResultados(r.data?.results ?? r.data ?? []))
      .catch(() => setResultados([]))
  }, [debouncedQ])

  const handleSelect = (m) => {
    onSelect(m)
    setQuery(''); setDebouncedQ(''); setAbierto(false)
  }

  const handleKeyDown = (e) => {
    if (!abierto || resultados.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(i => Math.min(i + 1, resultados.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); handleSelect(resultados[highlighted]) }
    if (e.key === 'Escape')    { setAbierto(false) }
  }

  if (value) {
    return (
      <div className="pp-persona-sel">
        <span className="pp-persona-nombre">{value.documento} — {value.nombre}</span>
        <button className="pp-persona-clear" onClick={() => onSelect(null)} title="Cambiar médico"><X size={14} /></button>
      </div>
    )
  }

  return (
    <div className="pp-buscador-wrap">
      <input className="pp-input" placeholder="Buscar médico por nombre o documento..."
        value={query}
        onChange={e => { setQuery(e.target.value); setAbierto(true); setHighlighted(0) }}
        onKeyDown={handleKeyDown}
        onFocus={() => query.length >= 2 && setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 200)}
        autoComplete="off"
      />
      {abierto && resultados.length > 0 && (
        <ul className="pp-dropdown">
          {resultados.map((m, i) => (
            <li key={m.id}
              className={`pp-dropdown-item${i === highlighted ? ' pp-dropdown-item--hl' : ''}`}
              onMouseDown={() => handleSelect(m)}
              onMouseEnter={() => setHighlighted(i)}
            >
              <span className="pp-dd-doc">{m.documento}</span>
              <span className="pp-dd-nom">{m.nombre}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Fila de valor pagado ──────────────────────────────────────────────────────
function FilaValor({ val, formasPago, cuentas, onChange, onRemove }) {
  const fp = formasPago.find(f => f.id === parseInt(val.forma_pago)) || null
  const esTarjeta = fp?.tipo === 'tarjeta'
  return (
    <tr className="pp-vr-fila">
      <td className="pp-td">
        <select className="pp-select" value={val.forma_pago} onChange={e => onChange('forma_pago', e.target.value)}>
          <option value="">Forma de pago</option>
          {formasPago.map(f => <option key={f.id} value={f.id}>{f.descripcion}</option>)}
        </select>
      </td>
      <td className="pp-td">
        <select className="pp-select" value={val.cta} onChange={e => onChange('cta', e.target.value)}>
          <option value="">Cuenta</option>
          {cuentas.map(c => <option key={c.id} value={c.id}>{c.descripcion}</option>)}
        </select>
      </td>
      <td className="pp-td">
        <input type="number" className="pp-input pp-input-monto" placeholder="0" min="0" step="any"
          value={val.monto} onChange={e => onChange('monto', e.target.value)} />
      </td>
      <td className="pp-td">
        <input className="pp-input" placeholder="Voucher" disabled={!esTarjeta}
          value={val.voucher} onChange={e => onChange('voucher', e.target.value)} />
      </td>
      <td className="pp-td pp-td-center">
        <button className="pp-btn-remove" onClick={onRemove}><X size={14} /></button>
      </td>
    </tr>
  )
}

// ── Modal Nuevo Pago ──────────────────────────────────────────────────────────
const VALOR_INIT = () => ({ forma_pago: '', cta: '', monto: '', voucher: '' })

function ModalNuevoPago({ onClose, onCreado, showToast }) {
  const [tab, setTab] = useState(0)
  const [medico, setMedico] = useState(null)
  const [fechaHasta, setFechaHasta] = useState(hoy())
  const [montoHora, setMontoHora] = useState('')
  const [seleccionados, setSeleccionados] = useState({}) // bloqueKey → bool
  const [valores, setValores] = useState([VALOR_INIT()])
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)

  const { data: sigNro }  = useSiguienteNumeroPago()
  const { data: bloques, isLoading: cargandoBloques } = useBloquesPendientes(medico?.id, fechaHasta)
  const { data: formasPago = [] } = useFormaPago()
  const [cuentas, setCuentas] = useState([])
  const createPago = useCreatePagoPrestador()

  useEffect(() => {
    apiClient.get('/cuentas-mcb/').then(r => setCuentas(r.data?.results ?? r.data ?? [])).catch(() => {})
  }, [])

  // Al recibir nuevos bloques: seleccionar todos por defecto
  useEffect(() => {
    if (!bloques) return
    const sel = {}
    bloques.forEach(b => { sel[`${b.horario_prestador_id}_${b.fecha}`] = true })
    setSeleccionados(sel)
  }, [bloques])

  const bloquesSeleccionados = (bloques || []).filter(b =>
    seleccionados[`${b.horario_prestador_id}_${b.fecha}`]
  )
  const totalHoras   = bloquesSeleccionados.reduce((acc, b) => acc + parseFloat(b.horas || 0), 0)
  const montoHoraNum = parseFloat(montoHora || '0')
  const montoTotal   = totalHoras * montoHoraNum
  const totalPagado  = valores.reduce((acc, v) => acc + parseFloat(v.monto || '0'), 0)
  const cubierto     = totalPagado >= montoTotal && montoTotal > 0

  const actualizarValor = (idx, key, val) =>
    setValores(prev => prev.map((v, i) => i === idx ? { ...v, [key]: val } : v))

  const validar = () => {
    const e = {}
    if (!medico)                          e.medico     = 'Seleccione un médico.'
    if (!montoHora || montoHoraNum <= 0)  e.montoHora  = 'Ingrese el monto por hora.'
    if (bloquesSeleccionados.length === 0) e.bloques   = 'Seleccione al menos un bloque.'
    const valOk = valores.filter(v => v.forma_pago && v.cta && parseFloat(v.monto || '0') > 0)
    if (valOk.length === 0)               e.valores    = 'Ingrese al menos un valor de pago completo.'
    if (montoTotal > 0 && totalPagado < montoTotal)
      e.valores_monto = `Total pagado (${fmt(totalPagado)}) menor al monto total (${fmt(montoTotal)}).`
    setErrores(e)
    return e
  }

  const handleGuardar = async () => {
    const e = validar()
    if (Object.keys(e).length > 0) {
      if (e.medico || e.montoHora || e.bloques) setTab(0)
      else setTab(1)
      return
    }
    const payload = {
      persona_rrhh_id: medico.id,
      fecha_pago:      fechaHasta,
      monto_hora:      montoHoraNum,
      bloques: bloquesSeleccionados.map(b => ({
        horario_prestador_id: b.horario_prestador_id,
        fecha:      b.fecha,
        horas:      parseFloat(b.horas),
        agenda_ids: b.agenda_ids,
      })),
      valores_pagados: valores
        .filter(v => v.forma_pago && v.cta && parseFloat(v.monto || '0') > 0)
        .map(v => ({
          forma_pago_id: parseInt(v.forma_pago),
          cta_id:        parseInt(v.cta),
          monto:         parseFloat(v.monto),
          voucher:       v.voucher || '',
        })),
    }
    setGuardando(true)
    try {
      await createPago.mutateAsync(payload)
      onCreado()
    } catch (err) {
      const msg = err?.response?.data?.detail
        || Object.values(err?.response?.data || {}).flat().join(' ')
        || 'Error al guardar.'
      showToast(msg, 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="pp-modal">
      <div className="pp-tabs">
        <button className={`pp-tab${tab === 0 ? ' pp-tab--active' : ''}`} onClick={() => setTab(0)}>
          Cabecera y bloques
        </button>
        <button className={`pp-tab${tab === 1 ? ' pp-tab--active' : ''}`} onClick={() => setTab(1)}>
          Forma de pago
          {montoTotal > 0 && <span className={`pp-tab-badge${cubierto ? ' pp-tab-badge--ok' : ''}`}>{fmt(montoTotal)}</span>}
        </button>
      </div>

      {tab === 0 && (
        <div className="pp-tab-body">
          <div className="pp-cab-grid">
            <div className="pp-form-group">
              <label className="pp-label">Fecha hasta</label>
              <input type="date" className="pp-input pp-input-fecha"
                value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
            </div>
            <div className="pp-form-group">
              <label className="pp-label">Nro. comprobante</label>
              <input className="pp-input pp-mono" readOnly
                value={sigNro?.siguiente ? String(sigNro.siguiente).padStart(7, '0') : '—'} />
            </div>
            <div className="pp-form-group">
              <label className="pp-label">Monto por hora (Gs.)</label>
              <input type="number" className={`pp-input pp-input-monto${errores.montoHora ? ' pp-input-error' : ''}`}
                placeholder="0" min="0" step="any"
                value={montoHora} onChange={e => setMontoHora(e.target.value)} />
              {errores.montoHora && <span className="pp-error">{errores.montoHora}</span>}
            </div>
          </div>

          <div className="pp-form-group pp-form-group--full">
            <label className="pp-label">Médico / Prestador</label>
            <BuscadorMedico value={medico} onSelect={setMedico} />
            {errores.medico && <span className="pp-error">{errores.medico}</span>}
          </div>

          {medico && (
            <div className="pp-bloques-section">
              <div className="pp-section-title">
                Bloques pendientes
                {bloques && bloques.length > 0 && (
                  <span className="pp-section-count">{bloques.length} bloque{bloques.length !== 1 ? 's' : ''}</span>
                )}
              </div>
              {cargandoBloques ? (
                <div className="pp-loading">Cargando bloques...</div>
              ) : !bloques || bloques.length === 0 ? (
                <div className="pp-empty">
                  <AlertCircle size={16} />
                  No hay bloques pendientes de pago hasta la fecha seleccionada.
                </div>
              ) : (
                <div className="pp-table-wrap">
                  <table className="pp-table">
                    <thead>
                      <tr>
                        <th className="pp-th pp-th-center">
                          <input type="checkbox" className="pp-check"
                            checked={bloquesSeleccionados.length === bloques.length}
                            onChange={e => {
                              const s = {}
                              bloques.forEach(b => { s[`${b.horario_prestador_id}_${b.fecha}`] = e.target.checked })
                              setSeleccionados(s)
                            }}
                          />
                        </th>
                        <th className="pp-th">Fecha</th>
                        <th className="pp-th">Horario</th>
                        <th className="pp-th pp-th-right">Horas</th>
                        <th className="pp-th">Especialidad</th>
                        <th className="pp-th pp-th-right">Monto bloque</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bloques.map(b => {
                        const key = `${b.horario_prestador_id}_${b.fecha}`
                        const sel = seleccionados[key] ?? true
                        const montoBloque = parseFloat(b.horas) * montoHoraNum
                        return (
                          <tr key={key} className={`pp-bloque-fila${!sel ? ' pp-bloque-nosel' : ''}`}
                            onClick={() => setSeleccionados(prev => ({ ...prev, [key]: !prev[key] }))}>
                            <td className="pp-td pp-td-center" onClick={e => e.stopPropagation()}>
                              <input type="checkbox" className="pp-check" checked={sel}
                                onChange={e => setSeleccionados(prev => ({ ...prev, [key]: e.target.checked }))} />
                            </td>
                            <td className="pp-td">
                              <span className="pp-fecha-val">{fmtFecha(b.fecha)}</span>
                              <span className="pp-dia-semana">{diaSemana(b.fecha)}</span>
                            </td>
                            <td className="pp-td pp-mono">{b.hora_desde} → {b.hora_hasta}</td>
                            <td className="pp-td pp-td-right pp-mono pp-bold">{b.horas}h</td>
                            <td className="pp-td pp-esp">{b.especialidad || '—'}</td>
                            <td className="pp-td pp-td-right pp-mono">
                              {montoHoraNum > 0 ? fmt(montoBloque) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {bloquesSeleccionados.length > 0 && (
                <div className="pp-totales">
                  <div className="pp-totales-fila">
                    <span className="pp-totales-lbl">Total horas seleccionadas</span>
                    <span className="pp-mono pp-bold">{totalHoras.toFixed(2)}h</span>
                  </div>
                  {montoHoraNum > 0 && (
                    <div className="pp-totales-fila pp-totales-fila--total">
                      <span className="pp-totales-lbl">Monto total</span>
                      <span className="pp-mono pp-bold pp-total-val">Gs. {fmt(montoTotal)}</span>
                    </div>
                  )}
                </div>
              )}
              {errores.bloques && <span className="pp-error">{errores.bloques}</span>}
            </div>
          )}
        </div>
      )}

      {tab === 1 && (
        <div className="pp-tab-body">
          <div className="pp-section-title">Forma de pago</div>
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead>
                <tr>
                  <th className="pp-th">Forma de pago</th>
                  <th className="pp-th">Cuenta</th>
                  <th className="pp-th">Monto</th>
                  <th className="pp-th">Voucher</th>
                  <th className="pp-th"></th>
                </tr>
              </thead>
              <tbody>
                {valores.map((v, i) => (
                  <FilaValor key={i} val={v}
                    formasPago={formasPago?.results ?? formasPago ?? []}
                    cuentas={cuentas}
                    onChange={(k, val) => actualizarValor(i, k, val)}
                    onRemove={() => setValores(prev => prev.filter((_, j) => j !== i))}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <button className="pp-btn-add-row" onClick={() => setValores(prev => [...prev, VALOR_INIT()])}>
            <Plus size={14} /> Agregar fila
          </button>

          <div className="pp-totales-bloque">
            <div className="pp-totales-fila">
              <span className="pp-totales-lbl">Monto total a pagar</span>
              <span className="pp-mono">{fmt(montoTotal)}</span>
            </div>
            <div className="pp-totales-fila">
              <span className="pp-totales-lbl">Total ingresado</span>
              <span className={`pp-mono${!cubierto && totalPagado > 0 ? ' pp-val-error' : ''}`}>{fmt(totalPagado)}</span>
            </div>
            {cubierto && (
              <div className="pp-totales-fila pp-totales-ok">
                <CheckCircle size={14} />
                <span>Monto cubierto</span>
              </div>
            )}
          </div>
          {errores.valores       && <span className="pp-error">{errores.valores}</span>}
          {errores.valores_monto && <span className="pp-error">{errores.valores_monto}</span>}
        </div>
      )}

      <div className="pp-modal-footer">
        <button className="btn btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleGuardar} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Registrar pago'}
        </button>
      </div>
    </div>
  )
}

// ── Modal Ver Pago ────────────────────────────────────────────────────────────
function ModalVerPago({ id, onClose, onEliminar }) {
  const { data: pago, isLoading } = usePagoPrestadorDetalle(id)
  if (isLoading) return <div className="pp-loading-modal">Cargando...</div>
  if (!pago) return null

  const ESTADOS = { pendiente: 'pp-badge-warn', parcial: 'pp-badge-info', pagado: 'pp-badge-ok' }

  return (
    <div className="pp-ver">
      <div className="pp-ver-header">
        <div className="pp-ver-campo">
          <span className="pp-ver-lbl">Médico</span>
          <span className="pp-ver-val pp-bold">{pago.medico_nombre}</span>
        </div>
        <div className="pp-ver-campo">
          <span className="pp-ver-lbl">Fecha pago</span>
          <span className="pp-ver-val">{fmtFecha(pago.fecha_pago)}</span>
        </div>
        <div className="pp-ver-campo">
          <span className="pp-ver-lbl">Total horas</span>
          <span className="pp-ver-val pp-mono">{pago.total_hora}h</span>
        </div>
        <div className="pp-ver-campo">
          <span className="pp-ver-lbl">Monto/hora</span>
          <span className="pp-ver-val pp-mono">Gs. {fmt(pago.monto_hora)}</span>
        </div>
        <div className="pp-ver-campo">
          <span className="pp-ver-lbl">Monto total</span>
          <span className="pp-ver-val pp-mono pp-total-ver">Gs. {fmt(pago.monto_total)}</span>
        </div>
        <div className="pp-ver-campo">
          <span className="pp-ver-lbl">Estado</span>
          <span className={`pp-badge ${ESTADOS[pago.estado] || ''}`}>{pago.estado_display}</span>
        </div>
      </div>

      <div className="pp-ver-section">
        <div className="pp-section-title">Detalle de cobranza</div>
        <table className="pp-table">
          <thead>
            <tr>
              <th className="pp-th">Forma de pago</th>
              <th className="pp-th">Cuenta</th>
              <th className="pp-th pp-th-right">Monto</th>
              <th className="pp-th">Voucher</th>
            </tr>
          </thead>
          <tbody>
            {pago.detalle_cobranza.map(d => (
              <tr key={d.id} className="pp-ver-fila">
                <td className="pp-td">{d.forma_pago_descripcion}</td>
                <td className="pp-td">{d.cuenta_descripcion}</td>
                <td className="pp-td pp-td-right pp-mono">Gs. {fmt(d.monto)}</td>
                <td className="pp-td">{d.voucher || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pp-modal-footer">
        <button className="btn btn-danger" onClick={() => onEliminar(pago)}>Eliminar</button>
        <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
const ESTADOS_BADGE = { pendiente: 'badge-warning', parcial: 'badge-info', pagado: 'badge-success' }

export default function PagoPrestadorPage() {
  const { toast, showToast } = useToast()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [pagoViendo, setPagoViendo] = useState(null)
  const [confirmando, setConfirmando] = useState(null)
  const [filtros, setFiltros] = useState({ search: '', estado: '', fecha_desde: '', fecha_hasta: '' })

  const { data, isLoading } = usePagosPrestador(filtros)
  const deletePago = useDeletePagoPrestador()
  const lista = data?.results ?? data ?? []

  const handleEliminar = (pago) => {
    setConfirmando(pago)
    setPagoViendo(null)
  }

  const confirmarEliminar = async () => {
    try {
      await deletePago.mutateAsync(confirmando.id)
      showToast('Pago eliminado.', 'success')
    } catch (err) {
      showToast(err?.response?.data?.detail || 'No se pudo eliminar.', 'error')
    } finally {
      setConfirmando(null)
    }
  }

  return (
    <>
      <style>{`
        .pp-page { padding: 24px; max-width: 1200px; margin: 0 auto; }

        /* Filtros */
        .pp-filtros { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 20px; }
        .pp-filtro-group { display: flex; flex-direction: column; gap: 4px; }
        .pp-filtro-label { font-size: 11px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: .04em; }
        .pp-input-filtro { height: 36px; border: 1px solid #e5e7eb; border-radius: 7px; padding: 0 10px; font-size: 13px; background: #fff; outline: none; }
        .pp-input-filtro:focus { border-color: #1a3a5c; }
        .pp-btn-nuevo { margin-left: auto; height: 36px; display: flex; align-items: center; gap: 6px; }

        /* Tabla */
        .pp-table-wrap { overflow-x: auto; border: 1px solid #e8edf2; border-radius: 10px; background: #fff; }
        .pp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .pp-th { padding: 10px 14px; background: #f8fafc; color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid #e8edf2; white-space: nowrap; }
        .pp-th-right { text-align: right; }
        .pp-th-center { text-align: center; }
        .pp-td { padding: 10px 14px; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: middle; }
        .pp-td-right { text-align: right; }
        .pp-td-center { text-align: center; }
        .pp-row { cursor: pointer; transition: background .12s; }
        .pp-row:hover { background: #eff6ff; }
        .pp-row:last-child td { border-bottom: none; }
        .pp-mono { font-family: 'Courier New', monospace; font-size: 12px; }
        .pp-bold { font-weight: 600; }

        /* Botones de fila */
        .pp-td-acciones { display: flex; gap: 4px; justify-content: center; }
        .pp-row-btn { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 5px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer; transition: all .12s; color: #6b7280; }
        .pp-row-btn:hover { background: #fef2f2; border-color: #fecaca; color: #dc2626; }
        .pp-row-btn-eye:hover { background: #eff6ff; border-color: #bfdbfe; color: #1a3a5c; }

        /* Modal */
        .pp-modal { display: flex; flex-direction: column; min-height: 0; }
        .pp-tabs { display: flex; border-bottom: 2px solid #e8edf2; }
        .pp-tab { padding: 10px 20px; font-size: 13px; font-weight: 500; color: #6b7280; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; display: flex; align-items: center; gap: 8px; transition: all .15s; }
        .pp-tab--active { color: #1a3a5c; border-bottom-color: #1a3a5c; }
        .pp-tab-badge { font-size: 11px; font-family: 'Courier New', monospace; background: #fef3c7; color: #92400e; border-radius: 4px; padding: 1px 6px; }
        .pp-tab-badge--ok { background: #d1fae5; color: #065f46; }
        .pp-tab-body { padding: 20px 0 0; display: flex; flex-direction: column; gap: 14px; }

        /* Formulario */
        .pp-cab-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
        .pp-form-group { display: flex; flex-direction: column; gap: 5px; }
        .pp-form-group--full { }
        .pp-label { font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
        .pp-input { height: 36px; border: 1px solid #e5e7eb; border-radius: 7px; padding: 0 10px; font-size: 13px; background: #fff; outline: none; width: 100%; box-sizing: border-box; }
        .pp-input:focus { border-color: #1a3a5c; }
        .pp-input[readonly] { background: #f8fafc; color: #6b7280; cursor: default; }
        .pp-input-fecha { width: 160px; }
        .pp-input-monto { text-align: right; }
        .pp-input-error { border-color: #dc2626 !important; }
        .pp-select { height: 36px; border: 1px solid #e5e7eb; border-radius: 7px; padding: 0 8px; font-size: 13px; background: #fff; outline: none; width: 100%; }
        .pp-select:focus { border-color: #1a3a5c; }
        .pp-error { font-size: 11px; color: #dc2626; }

        /* Buscador médico */
        .pp-buscador-wrap { position: relative; }
        .pp-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #e8edf2; border-radius: 8px; box-shadow: 0 6px 24px rgba(0,0,0,.12); z-index: 100; max-height: 220px; overflow-y: auto; padding: 4px 0; list-style: none; margin: 4px 0 0; }
        .pp-dropdown-item { display: flex; gap: 10px; align-items: baseline; padding: 8px 14px; cursor: pointer; font-size: 13px; }
        .pp-dropdown-item--hl,.pp-dropdown-item:hover { background: #eff6ff; }
        .pp-dd-doc { font-family: 'Courier New', monospace; font-size: 12px; color: #6b7280; min-width: 80px; }
        .pp-dd-nom { color: #111827; }
        .pp-persona-sel { display: flex; align-items: center; justify-content: space-between; height: 36px; border: 1px solid #e5e7eb; border-radius: 7px; padding: 0 10px; background: #f0f4f8; font-size: 13px; }
        .pp-persona-nombre { color: #111827; font-weight: 500; }
        .pp-persona-clear { background: none; border: none; cursor: pointer; color: #6b7280; display: flex; align-items: center; padding: 2px; border-radius: 3px; }
        .pp-persona-clear:hover { color: #dc2626; background: #fef2f2; }

        /* Bloques */
        .pp-bloques-section { display: flex; flex-direction: column; gap: 10px; }
        .pp-section-title { font-size: 12px; font-weight: 600; color: #1a3a5c; text-transform: uppercase; letter-spacing: .06em; display: flex; align-items: center; gap: 8px; }
        .pp-section-count { font-weight: 400; color: #9ca3af; text-transform: none; letter-spacing: 0; }
        .pp-bloque-fila { cursor: pointer; transition: background .1s; }
        .pp-bloque-fila:hover td { background: #eff6ff; }
        .pp-bloque-fila td { padding: 7px 14px; border-bottom: 1px solid #f3f4f6; }
        .pp-bloque-nosel td { opacity: .45; }
        .pp-fecha-val { font-weight: 500; color: #111827; margin-right: 6px; }
        .pp-dia-semana { font-size: 11px; color: #9ca3af; }
        .pp-esp { font-size: 12px; color: #6b7280; }
        .pp-check { width: 16px; height: 16px; cursor: pointer; accent-color: #1a3a5c; }
        .pp-loading, .pp-empty { text-align: center; padding: 24px; color: #9ca3af; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .pp-loading-modal { padding: 40px; text-align: center; color: #9ca3af; }

        /* Totales */
        .pp-totales { display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-top: 1px solid #e8edf2; align-items: flex-end; }
        .pp-totales-fila { display: flex; gap: 20px; align-items: center; justify-content: flex-end; }
        .pp-totales-fila--total { border-top: 1px dashed #e8edf2; padding-top: 6px; margin-top: 4px; }
        .pp-totales-lbl { font-size: 12px; color: #6b7280; }
        .pp-total-val { font-size: 15px; color: #1a3a5c; }
        .pp-totales-bloque { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; padding: 14px 0; border-top: 1px solid #e8edf2; }
        .pp-totales-ok { color: #16a34a; font-size: 13px; font-weight: 500; gap: 6px; }
        .pp-val-error { color: #dc2626; }

        /* Botones */
        .pp-btn-add-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #1a3a5c; background: none; border: 1px dashed #bfdbfe; border-radius: 6px; padding: 6px 14px; cursor: pointer; margin-top: 6px; }
        .pp-btn-add-row:hover { background: #eff6ff; }
        .pp-btn-remove { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 5px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer; color: #6b7280; }
        .pp-btn-remove:hover { background: #fef2f2; border-color: #fecaca; color: #dc2626; }
        .pp-modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 0 0; border-top: 1px solid #e8edf2; margin-top: auto; }

        /* Ver pago */
        .pp-ver { display: flex; flex-direction: column; gap: 20px; }
        .pp-ver-header { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e8edf2; }
        .pp-ver-campo { display: flex; flex-direction: column; gap: 4px; }
        .pp-ver-lbl { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: .06em; }
        .pp-ver-val { font-size: 13px; color: #111827; }
        .pp-total-ver { font-size: 16px; font-weight: 700; color: #1a3a5c; }
        .pp-ver-section { display: flex; flex-direction: column; gap: 10px; }
        .pp-ver-fila td { padding: 8px 14px; }

        /* Badges */
        .pp-badge { font-size: 11px; font-weight: 600; border-radius: 5px; padding: 2px 8px; display: inline-block; }
        .pp-badge-ok { background: #d1fae5; color: #065f46; }
        .pp-badge-warn { background: #fef3c7; color: #92400e; }
        .pp-badge-info { background: #dbeafe; color: #1e40af; }

        /* Confirmación */
        .pp-confirm { text-align: center; display: flex; flex-direction: column; gap: 16px; align-items: center; padding: 8px; }
        .pp-confirm-title { font-size: 16px; font-weight: 600; color: #111827; }
        .pp-confirm-sub { font-size: 13px; color: #6b7280; }
        .pp-confirm-btns { display: flex; gap: 10px; }
      `}</style>

      <div className="pp-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Pago a prestadores</h1>
            <p className="page-subtitle">Gestión de honorarios médicos por bloques de atención</p>
          </div>
        </div>

        <div className="pp-filtros">
          <div className="pp-filtro-group">
            <span className="pp-filtro-label">Buscar</span>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 9, top: 11, color: '#9ca3af' }} />
              <input className="pp-input-filtro" style={{ paddingLeft: 30, width: 220 }}
                placeholder="Médico o documento..."
                value={filtros.search}
                onChange={e => setFiltros(f => ({ ...f, search: e.target.value }))} />
            </div>
          </div>
          <div className="pp-filtro-group">
            <span className="pp-filtro-label">Estado</span>
            <select className="pp-input-filtro" value={filtros.estado}
              onChange={e => setFiltros(f => ({ ...f, estado: e.target.value }))}>
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
              <option value="pagado">Pagado</option>
            </select>
          </div>
          <div className="pp-filtro-group">
            <span className="pp-filtro-label">Desde</span>
            <input type="date" className="pp-input-filtro"
              value={filtros.fecha_desde}
              onChange={e => setFiltros(f => ({ ...f, fecha_desde: e.target.value }))} />
          </div>
          <div className="pp-filtro-group">
            <span className="pp-filtro-label">Hasta</span>
            <input type="date" className="pp-input-filtro"
              value={filtros.fecha_hasta}
              onChange={e => setFiltros(f => ({ ...f, fecha_hasta: e.target.value }))} />
          </div>
          <button className="btn btn-primary pp-btn-nuevo" onClick={() => setModalAbierto(true)}>
            <Plus size={15} /> Nuevo pago
          </button>
        </div>

        <div className="pp-table-wrap">
          <table className="pp-table">
            <thead>
              <tr>
                <th className="pp-th">Médico</th>
                <th className="pp-th">Fecha pago</th>
                <th className="pp-th pp-th-right">Total horas</th>
                <th className="pp-th pp-th-right">Monto/hora</th>
                <th className="pp-th pp-th-right">Monto total</th>
                <th className="pp-th pp-th-center">Estado</th>
                <th className="pp-th pp-th-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="pp-td" style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>Cargando...</td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={7} className="pp-td" style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>Sin registros</td></tr>
              ) : lista.map(p => (
                <tr key={p.id} className="pp-row" onClick={() => setPagoViendo(p.id)}>
                  <td className="pp-td">
                    <div style={{ fontWeight: 500, color: '#111827' }}>{p.medico_nombre}</div>
                  </td>
                  <td className="pp-td">{fmtFecha(p.fecha_pago)}</td>
                  <td className="pp-td pp-td-right pp-mono">{p.total_hora}h</td>
                  <td className="pp-td pp-td-right pp-mono">{fmt(p.monto_hora)}</td>
                  <td className="pp-td pp-td-right pp-mono pp-bold">Gs. {fmt(p.monto_total)}</td>
                  <td className="pp-td pp-td-center">
                    <span className={`pp-badge ${ESTADOS_BADGE[p.estado] || ''}`}>{p.estado_display}</span>
                  </td>
                  <td className="pp-td pp-td-center">
                    <div className="pp-td-acciones" onClick={e => e.stopPropagation()}>
                      <button className="pp-row-btn pp-row-btn-eye" title="Ver detalle" onClick={() => setPagoViendo(p.id)}>
                        <Eye size={12} />
                      </button>
                      <button className="pp-row-btn" title="Eliminar" onClick={() => handleEliminar(p)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalAbierto && (
        <Modal isOpen={modalAbierto} onClose={() => setModalAbierto(false)}
          title="Nuevo pago a prestador" subtitle="Honorarios por bloques de atención" size="xl">
          <ModalNuevoPago
            onClose={() => setModalAbierto(false)}
            onCreado={() => { setModalAbierto(false); showToast('Pago registrado correctamente.', 'success') }}
            showToast={showToast}
          />
        </Modal>
      )}

      {pagoViendo && (
        <Modal isOpen={!!pagoViendo} onClose={() => setPagoViendo(null)}
          title="Detalle de pago" subtitle="Vista del comprobante" size="xl">
          <ModalVerPago
            id={pagoViendo}
            onClose={() => setPagoViendo(null)}
            onEliminar={handleEliminar}
          />
        </Modal>
      )}

      {confirmando && (
        <Modal isOpen={!!confirmando} onClose={() => setConfirmando(null)} title="Confirmar eliminación" size="sm">
          <div className="pp-confirm">
            <AlertCircle size={40} color="#dc2626" />
            <div className="pp-confirm-title">¿Eliminar este pago?</div>
            <div className="pp-confirm-sub">{confirmando.medico_nombre} — {fmtFecha(confirmando.fecha_pago)}</div>
            <div className="pp-confirm-btns">
              <button className="btn btn-secondary" onClick={() => setConfirmando(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={confirmarEliminar}>Eliminar</button>
            </div>
          </div>
        </Modal>
      )}

      <Toast toast={toast} />
    </>
  )
}
