import { useState, useRef, useEffect } from 'react'
import { Plus, Search, Trash2, Eye, X, AlertCircle, CheckCircle, Banknote, Printer, FileText, FileSpreadsheet } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Toast from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import {
  usePagosPrestador,
  useCreatePagoPrestador,
  useDeletePagoPrestador,
  useSiguienteNumeroPago,
  useBloquesPendientes,
  usePagoPrestadorDetalle,
  useMedicosConPendientes,
  useValidarNroComprobante,
} from '../../hooks/finanzas/usePagoPrestador'
import { useFormaPago } from '../../hooks/facturacion/useFacturacion'
import { useCuentasMcb } from '../../hooks/finanzas/useCuentasMcb'
import { extraerMensajeError } from '../../utils/errores'
import { useAtajosTeclado } from '../../hooks/useAtajosTeclado'
import apiClient from '../../api/client'

function hoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
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

function BuscadorMedico({ value, onSelect }) {
  const [query, setQuery]         = useState('')
  const [abierto, setAbierto]     = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [debouncedQ, setDebouncedQ]   = useState('')
  const timerRef = useRef(null)

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedQ(query), 300)
    return () => clearTimeout(timerRef.current)
  }, [query])

  const { data: resultados = [] } = useMedicosConPendientes(debouncedQ)

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
        onFocus={() => setAbierto(true)}
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

function FilaValor({ val, formasPago, cuentas, onChange, onRemove, intentoEnvio }) {
  const fp        = formasPago.find(f => f.id === parseInt(val.forma_pago)) || null
  const esTarjeta = fp?.tipo === 'tarjeta'
  const tieneAlgo = val.forma_pago || val.cta || parseFloat(val.monto || '0') > 0
  const errFP     = intentoEnvio && tieneAlgo && !val.forma_pago
  const errCta    = intentoEnvio && tieneAlgo && !val.cta
  const errMonto  = intentoEnvio && tieneAlgo && parseFloat(val.monto || '0') <= 0
  return (
    <tr className="pp-vr-fila">
      <td className="pp-td">
        <select className={`pp-select${errFP ? ' pp-input-error' : ''}`} value={val.forma_pago}
          onChange={e => onChange('forma_pago', e.target.value)}>
          <option value="">Forma de pago</option>
          {formasPago.map(f => <option key={f.id} value={f.id}>{f.descripcion}</option>)}
        </select>
        {errFP && <span className="pp-error">Requerido</span>}
      </td>
      <td className="pp-td">
        <select className={`pp-select${errCta ? ' pp-input-error' : ''}`} value={val.cta}
          onChange={e => onChange('cta', e.target.value)}>
          <option value="">Cuenta</option>
          {cuentas.map(c => <option key={c.id} value={c.id}>{c.descripcion}</option>)}
        </select>
        {errCta && <span className="pp-error">Requerido</span>}
      </td>
      <td className="pp-td">
        <input type="number" className={`pp-input pp-input-monto${errMonto ? ' pp-input-error' : ''}`}
          placeholder="0" min="0" step="any"
          value={val.monto} onChange={e => onChange('monto', e.target.value)} />
        {errMonto && <span className="pp-error">Requerido</span>}
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

const VALOR_INIT = () => ({ forma_pago: '', cta: '', monto: '', voucher: '' })

function ModalNuevoPago({ onClose, onCreado, showToast, onIsDirtyChange }) {
  const [tab, setTab]               = useState(0)
  const [medico, setMedico]         = useState(null)
  const [fechaHasta, setFechaHasta] = useState(hoy())
  const [montoHora, setMontoHora]   = useState('')
  const [seleccionados, setSeleccionados] = useState({})
  const [valores, setValores]       = useState([VALOR_INIT()])
  const [errores, setErrores]       = useState({})
  const [guardando, setGuardando]   = useState(false)
  const [nroComprobante, setNroComprobante] = useState('')
  const [nroAValidar, setNroAValidar]       = useState(null)
  const [intentoEnvio, setIntentoEnvio]     = useState(false)
  const prevSigNroRef                       = useRef(null)

  const { data: sigNro }                              = useSiguienteNumeroPago()
  const { data: bloques, isLoading: cargandoBloques } = useBloquesPendientes(medico?.id, fechaHasta)
  const { data: formasPago = [] }                     = useFormaPago()
  const { data: cuentasMcb }                          = useCuentasMcb({})
  const cuentas                                       = cuentasMcb?.results ?? cuentasMcb ?? []
  const createPago                                    = useCreatePagoPrestador()

  useEffect(() => {
    if (sigNro?.siguiente == null) return
    const formatted = String(sigNro.siguiente).padStart(7, '0')
    if (nroComprobante === '' || nroComprobante === prevSigNroRef.current) {
      prevSigNroRef.current = formatted
      setNroComprobante(formatted)
    }
  }, [sigNro])

  useEffect(() => {
    const nroInt = parseInt(nroComprobante)
    if (!nroInt || nroInt < 1) { setNroAValidar(null); return }
    const t = setTimeout(() => setNroAValidar(nroInt), 400)
    return () => clearTimeout(t)
  }, [nroComprobante])

  const { data: validacionNro, isFetching: validandoNro } = useValidarNroComprobante(nroAValidar)
  const nroError = nroAValidar && validacionNro && !validacionNro.disponible
    ? validacionNro.mensaje
    : ''

  useEffect(() => {
    if (!bloques) return
    const sel = {}
    bloques.forEach(b => { sel[`${b.horario_prestador_id}_${b.fecha}`] = true })
    setSeleccionados(sel)
  }, [bloques])

  const isDirty = !!(medico || montoHora || valores.some(v => v.forma_pago || v.cta || v.monto))

  const bloquesSeleccionados = (bloques || []).filter(b => seleccionados[`${b.horario_prestador_id}_${b.fecha}`])
  const totalHoras   = bloquesSeleccionados.reduce((acc, b) => acc + parseFloat(b.horas || 0), 0)
  const montoHoraNum = parseFloat(montoHora || '0')
  const montoTotal   = totalHoras * montoHoraNum
  const totalPagado  = valores.reduce((acc, v) => acc + parseFloat(v.monto || '0'), 0)
  const cubierto     = totalPagado === montoTotal && montoTotal > 0
  const excede       = totalPagado > montoTotal && montoTotal > 0

  const actualizarValor = (idx, key, val) =>
    setValores(prev => prev.map((v, i) => i === idx ? { ...v, [key]: val } : v))

  const validar = () => {
    setIntentoEnvio(true)
    const e = {}
    const nroInt = parseInt(nroComprobante)
    if (!nroInt || nroInt < 1)  e.nroComprobante = 'Ingrese un número de comprobante válido.'
    else if (nroError)          e.nroComprobante = nroError
    else if (validandoNro)      e.nroComprobante = 'Verificando número, aguarde un momento.'
    if (!medico)                           e.medico    = 'Seleccione un médico.'
    if (!montoHora || montoHoraNum <= 0)   e.montoHora = 'Ingrese el monto por hora.'
    if (bloquesSeleccionados.length === 0) e.bloques   = 'Seleccione al menos un bloque.'
    const valOk = valores.filter(v => v.forma_pago && v.cta && parseFloat(v.monto || '0') > 0)
    if (valOk.length === 0)                e.valores   = 'Ingrese al menos un valor de pago completo.'
    if (montoTotal > 0 && totalPagado > montoTotal)
      e.valores_monto = `El total pagado (Gs. ${fmt(totalPagado)}) supera el monto a pagar (Gs. ${fmt(montoTotal)}). No se permite pago en exceso.`
    else if (montoTotal > 0 && totalPagado < montoTotal)
      e.valores_monto = `El total pagado (Gs. ${fmt(totalPagado)}) es menor al monto a pagar (Gs. ${fmt(montoTotal)}).`
    setErrores(e)
    return e
  }

  useEffect(() => {
    onIsDirtyChange(isDirty)
  }, [isDirty])

  useEffect(() => () => onIsDirtyChange(false), [])

  const handleGuardar = async () => {
    const e = validar()
    if (Object.keys(e).length > 0) {
      if (e.medico || e.montoHora || e.bloques) setTab(0)
      else setTab(1)
      return
    }
    const nroInt = parseInt(nroComprobante) || undefined
    const payload = {
      persona_rrhh_id: medico.id,
      nro_comprobante: nroInt,
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
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setGuardando(false)
    }
  }

  useAtajosTeclado({
    'F10': { fn: () => { if (!guardando) handleGuardar() }, soloFueraDeInputs: false },
  })

  return (
    <div className="pp-modal">
      <div className="pp-tabs">
        <button className={`pp-tab${tab === 0 ? ' pp-tab--active' : ''}`} onClick={() => setTab(0)}>
          Cabecera y bloques
        </button>
        <button className={`pp-tab${tab === 1 ? ' pp-tab--active' : ''}`} onClick={() => setTab(1)}>
          Forma de pago
          {montoTotal > 0 && <span className={`pp-tab-badge${cubierto ? ' pp-tab-badge--ok' : excede ? ' pp-tab-badge--error' : ''}`}>{fmt(montoTotal)}</span>}
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
              <div style={{ position: 'relative' }}>
                <input
                  className={`pp-input pp-mono${errores.nroComprobante || nroError ? ' pp-input-error' : ''}`}
                  value={nroComprobante}
                  maxLength={7}
                  placeholder="0000001"
                  inputMode="numeric"
                  onChange={e => {
                    const digits = e.target.value.replace(/[^\d]/g, '').replace(/^0+/, '') || ''
                    setNroComprobante(digits)
                  }}
                  onBlur={e => {
                    const v = parseInt(e.target.value)
                    if (v >= 1) setNroComprobante(String(v).padStart(7, '0'))
                  }}
                />
                {validandoNro && (
                  <span className="pp-nro-checking">verificando...</span>
                )}
              </div>
              {(errores.nroComprobante || nroError) && (
                <span className="pp-error">{errores.nroComprobante || nroError}</span>
              )}
              {!nroError && !validandoNro && nroAValidar && (
                <span className="pp-nro-ok">Número disponible</span>
              )}
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
                    intentoEnvio={intentoEnvio}
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
              <span className="pp-mono">Gs. {fmt(montoTotal)}</span>
            </div>
            <div className="pp-totales-fila">
              <span className="pp-totales-lbl">Total ingresado</span>
              <span className={`pp-mono${(excede || (!cubierto && totalPagado > 0)) ? ' pp-val-error' : ''}`}>Gs. {fmt(totalPagado)}</span>
            </div>
            {cubierto && (
              <div className="pp-totales-fila pp-totales-ok">
                <CheckCircle size={14} />
                <span>Monto exacto</span>
              </div>
            )}
            {excede && (
              <div className="pp-totales-fila pp-totales-excede">
                <AlertCircle size={14} />
                <span>Supera el monto a pagar en Gs. {fmt(totalPagado - montoTotal)}</span>
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

function ModalVerPago({ id, onClose, onEliminar, showToast, puedeEliminar }) {
  const { data: pago, isLoading } = usePagoPrestadorDetalle(id)
  const [generandoPdf, setGenerandoPdf] = useState(false)

  if (isLoading) return <div className="pp-loading-modal">Cargando...</div>
  if (!pago) return null

  const handleReciboPdf = async () => {
    setGenerandoPdf(true)
    try {
      const res = await apiClient.get(`/pago-prestador/${pago.id}/recibo-pdf/`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch {
      showToast('No se pudo generar el recibo.', 'error')
    } finally {
      setGenerandoPdf(false)
    }
  }

  const ESTADOS = { pendiente: 'pp-badge-warn', parcial: 'pp-badge-info', pagado: 'pp-badge-ok' }

  return (
    <div className="pp-ver">
      <div className="pp-ver-toolbar">
        <button className="pp-ver-btn print" onClick={handleReciboPdf} disabled={generandoPdf}>
          <Printer size={14} />
          {generandoPdf ? 'Generando...' : 'Recibo PDF'}
        </button>
        {puedeEliminar && (
          <button className="pp-ver-btn del" onClick={() => onEliminar(pago)}>
            <Trash2 size={14} />
            Eliminar
          </button>
        )}
      </div>
      <div className="pp-ver-header">
        <div className="pp-ver-campo">
          <span className="pp-ver-lbl">Nro. comprobante</span>
          <span className="pp-ver-val pp-mono">{pago.nro_comprobante ? String(pago.nro_comprobante).padStart(7, '0') : '—'}</span>
        </div>
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

    </div>
  )
}

const ESTADOS_BADGE = { pendiente: 'badge-warning', parcial: 'badge-info', pagado: 'badge-success' }

export default function PagoPrestadorPage() {
  const { user }                      = useAuth()
  const puedeEliminar                 = user?.rol === 'admin'
  const { toast, showToast }          = useToast()
  const [modalAbierto, setModalAbierto]         = useState(false)
  const [pagoViendo, setPagoViendo]             = useState(null)
  const [confirmando, setConfirmando]           = useState(null)
  const [confirmDescartarNuevo, setConfirmDescartarNuevo] = useState(false)
  const [filtros, setFiltros]         = useState({ search: '', estado: '', fecha_desde: '', fecha_hasta: '' })
  const modalIsDirtyRef               = useRef(false)
  const debounceRef                   = useRef(null)
  const [generandoPdfLista,   setGenerandoPdfLista]   = useState(false)
  const [generandoExcelLista, setGenerandoExcelLista] = useState(false)
  const [generandoReciboId,   setGenerandoReciboId]   = useState(null)

  useAtajosTeclado({
    'Insert': { fn: () => { if (puedeEliminar && !modalAbierto && !pagoViendo) setModalAbierto(true) } },
  })

  const _params = () => {
    const p = {}
    if (filtros.search)       p.search       = filtros.search
    if (filtros.estado)       p.estado       = filtros.estado
    if (filtros.fecha_desde)  p.fecha_desde  = filtros.fecha_desde
    if (filtros.fecha_hasta)  p.fecha_hasta  = filtros.fecha_hasta
    return p
  }

  const handlePdfLista = async () => {
    setGenerandoPdfLista(true)
    try {
      const res = await apiClient.get('/pago-prestador/reporte-pdf/', { responseType: 'blob', params: _params() })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch {
      showToast('No se pudo generar el listado PDF.', 'error')
    } finally {
      setGenerandoPdfLista(false)
    }
  }

  const handleExcelLista = async () => {
    setGenerandoExcelLista(true)
    try {
      const res = await apiClient.get('/pago-prestador/reporte-excel/', { responseType: 'blob', params: _params() })
      const url  = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `pagos_prestadores_${new Date().toISOString().split('T')[0].replace(/-/g,'')}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      showToast('No se pudo generar el listado Excel.', 'error')
    } finally {
      setGenerandoExcelLista(false)
    }
  }

  const handleReciboFila = async (e, pago) => {
    e.stopPropagation()
    setGenerandoReciboId(pago.id)
    try {
      const res = await apiClient.get(`/pago-prestador/${pago.id}/recibo-pdf/`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch {
      showToast('No se pudo generar el recibo.', 'error')
    } finally {
      setGenerandoReciboId(null)
    }
  }

  const handleCerrarModalNuevo = () => {
    if (modalIsDirtyRef.current) setConfirmDescartarNuevo(true)
    else setModalAbierto(false)
  }

  const { data, isLoading } = usePagosPrestador(filtros)
  const deletePago          = useDeletePagoPrestador()
  const lista               = data?.results ?? data ?? []

  const handleEliminar = (pago) => {
    setConfirmando(pago)
    setPagoViendo(null)
  }

  const confirmarEliminar = async () => {
    try {
      await deletePago.mutateAsync(confirmando.id)
      showToast('Pago eliminado.', 'success')
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setConfirmando(null)
    }
  }

  return (
    <>
      <style>{`
        .pp-page { display: flex; flex-direction: column; height: 100%; }

        .pp-toolbar { display: flex; align-items: center; gap: 10px; padding: 12px 20px; flex-wrap: wrap; border-bottom: 1px solid #e8edf2; }
        .pp-toolbar-icon { width: 36px; height: 36px; background: #e8f0fe; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #1a3a5c; flex-shrink: 0; }
        .pp-toolbar-titles { flex: 1; min-width: 160px; display: flex; flex-direction: column; gap: 1px; }
        .pp-toolbar-title { font-size: 15px; font-weight: 700; color: #1a3a5c; }
        .pp-toolbar-subtitle { font-size: 11px; color: #9ca3af; }
        .pp-search-wrap { flex: 1 1 200px; max-width: 300px; position: relative; }
        .pp-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none; }
        .pp-search-input { width: 100%; padding: 9px 12px 9px 34px; border: 1.5px solid #e5e7eb; border-radius: 9px; font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #111827; background: #fff; outline: none; box-sizing: border-box; transition: border-color 0.2s, box-shadow 0.2s; }
        .pp-search-input:focus { border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08); }
        .pp-search-input::placeholder { color: #d1d5db; }
        .pp-filtros { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .pp-filtro-sel { border: 1.5px solid #e5e7eb; border-radius: 9px; padding: 8px 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; background: #fff; color: #374151; height: 38px; }
        .pp-filtro-sel:focus { border-color: #1a3a5c; }
        .pp-filtro-date { border: 1.5px solid #e5e7eb; border-radius: 9px; padding: 0 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; background: #fff; color: #374151; height: 38px; width: 138px; }
        .pp-filtro-date:focus { border-color: #1a3a5c; }
        .pp-toolbar-right { margin-left: auto; display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .pp-btn-report { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 9px; border: none; background: #dc2626; color: #fff; font-size: 13.5px; font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer; white-space: nowrap; transition: background 0.15s, box-shadow 0.15s; }
        .pp-btn-report:hover:not(:disabled) { background: #b91c1c; box-shadow: 0 4px 12px rgba(220,38,38,0.2); }
        .pp-btn-report.excel { background: #16a34a; }
        .pp-btn-report.excel:hover:not(:disabled) { background: #15803d; box-shadow: 0 4px 12px rgba(22,163,74,0.2); }
        .pp-btn-report:disabled { opacity: 0.6; cursor: not-allowed; }
        .pp-btn-nuevo { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 9px; border: none; background: #1a3a5c; color: #fff; font-size: 13.5px; font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer; white-space: nowrap; transition: background 0.15s, box-shadow 0.15s; }
        .pp-btn-nuevo:hover { background: #15304d; box-shadow: 0 4px 12px rgba(26,58,92,0.2); }
        @media (max-width: 600px) { .pp-search-wrap { max-width: 100%; flex-basis: 100%; } .pp-toolbar-titles { display: none; } }

        .pp-body { flex: 1; overflow: hidden; padding: 0 24px 24px; }
        .pp-tabla-wrap { height: 100%; border: 1px solid #e8edf2; border-radius: 12px; background: #fff; overflow-y: auto; }
        .pp-table-wrap { overflow-x: auto; border: 1px solid #e8edf2; border-radius: 8px; background: #fff; }
        .pp-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .pp-th { padding: 11px 16px; background: #f8fafc; color: #9ca3af; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid #e8edf2; white-space: nowrap; position: sticky; top: 0; z-index: 1; }
        .pp-th-right { text-align: right; }
        .pp-th-center { text-align: center; }
        .pp-td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: middle; }
        .pp-td-right { text-align: right; }
        .pp-td-center { text-align: center; }
        .pp-td-hint { font-size: 11.5px; color: #9ca3af; margin-top: 3px; font-style: italic; }
        .pp-tr { cursor: pointer; transition: background 0.15s; }
        .pp-tr:nth-child(odd)  .pp-td { background: #ffffff; }
        .pp-tr:nth-child(even) .pp-td { background: #f8fafc; }
        .pp-tr:hover .pp-td { background: #f0f4f8 !important; }
        .pp-tr:last-child .pp-td { border-bottom: none; }
        .pp-mono { font-family: 'Courier New', monospace; font-size: 12px; }
        .pp-bold { font-weight: 600; }

        .pp-td-acciones { display: flex; gap: 6px; justify-content: flex-end; }
        .pp-row-btn { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 7px; border: 1px solid #e8edf2; background: none; cursor: pointer; color: #6b7280; transition: background .15s, color .15s, border-color .15s; }
        .pp-row-btn:hover { background: #f0f4f8; }
        .pp-row-btn.print:hover { background: #eff6ff; color: #1a3a5c; border-color: #bfdbfe; }
        .pp-row-btn.danger { border-color: #fecaca; color: #dc2626; }
        .pp-row-btn.danger:hover { background: #fef2f2; border-color: #fca5a5; }

        .pp-modal { display: flex; flex-direction: column; min-height: 0; }
        .pp-tabs { display: flex; border-bottom: 2px solid #e8edf2; }
        .pp-tab { padding: 10px 20px; font-size: 13px; font-weight: 500; color: #6b7280; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; display: flex; align-items: center; gap: 8px; transition: all .15s; }
        .pp-tab--active { color: #1a3a5c; border-bottom-color: #1a3a5c; }
        .pp-tab-badge { font-size: 11px; font-family: 'Courier New', monospace; background: #fef3c7; color: #92400e; border-radius: 4px; padding: 1px 6px; }
        .pp-tab-badge--ok { background: #d1fae5; color: #065f46; }
        .pp-tab-badge--error { background: #fee2e2; color: #991b1b; }
        .pp-tab-body { padding: 20px 0 0; display: flex; flex-direction: column; gap: 14px; }

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
        .pp-select.pp-input-error { border-color: #dc2626 !important; }
        .pp-error { font-size: 11px; color: #dc2626; }
        .pp-nro-checking { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font-size: 10px; color: #9ca3af; pointer-events: none; }
        .pp-nro-ok { font-size: 11px; color: #16a34a; }

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

        .pp-totales { display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-top: 1px solid #e8edf2; align-items: flex-end; }
        .pp-totales-fila { display: flex; gap: 20px; align-items: center; justify-content: flex-end; }
        .pp-totales-fila--total { border-top: 1px dashed #e8edf2; padding-top: 6px; margin-top: 4px; }
        .pp-totales-lbl { font-size: 12px; color: #6b7280; }
        .pp-total-val { font-size: 15px; color: #1a3a5c; }
        .pp-totales-bloque { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; padding: 14px 0; border-top: 1px solid #e8edf2; }
        .pp-totales-ok { color: #16a34a; font-size: 13px; font-weight: 500; gap: 6px; }
        .pp-totales-excede { color: #dc2626; font-size: 13px; font-weight: 500; gap: 6px; }
        .pp-val-error { color: #dc2626; }

        .pp-btn-add-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #1a3a5c; background: none; border: 1px dashed #bfdbfe; border-radius: 6px; padding: 6px 14px; cursor: pointer; margin-top: 6px; }
        .pp-btn-add-row:hover { background: #eff6ff; }
        .pp-btn-remove { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 5px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer; color: #6b7280; }
        .pp-btn-remove:hover { background: #fef2f2; border-color: #fecaca; color: #dc2626; }
        .pp-modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 0 0; border-top: 1px solid #e8edf2; margin-top: auto; }

        .pp-ver-toolbar { display: flex; gap: 8px; padding: 14px 20px; border-bottom: 1px solid #e8edf2; flex-shrink: 0; background: #f8fafc; flex-wrap: wrap; }
        .pp-ver-btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 14px; border-radius: 8px; font-size: 12.5px; font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer; border: 1px solid #e5e7eb; background: #fff; transition: background 0.1s; }
        .pp-ver-btn.print { color: #1a3a5c; border-color: #bfdbfe; }
        .pp-ver-btn.print:hover { background: #eff6ff; }
        .pp-ver-btn.print:disabled { opacity: .6; cursor: default; }
        .pp-ver-btn.del { color: #dc2626; border-color: #fecaca; margin-left: auto; }
        .pp-ver-btn.del:hover { background: #fef2f2; }

        .pp-ver { display: flex; flex-direction: column; gap: 20px; }
        .pp-ver-header { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e8edf2; }
        .pp-ver-campo { display: flex; flex-direction: column; gap: 4px; }
        .pp-ver-lbl { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: .06em; }
        .pp-ver-val { font-size: 13px; color: #111827; }
        .pp-total-ver { font-size: 16px; font-weight: 700; color: #1a3a5c; }
        .pp-ver-section { display: flex; flex-direction: column; gap: 10px; }
        .pp-ver-fila td { padding: 8px 14px; }

        .pp-badge { font-size: 11px; font-weight: 600; border-radius: 5px; padding: 2px 8px; display: inline-block; }
        .pp-badge-ok { background: #d1fae5; color: #065f46; }
        .pp-badge-warn { background: #fef3c7; color: #92400e; }
        .pp-badge-info { background: #dbeafe; color: #1e40af; }
      `}</style>

      <div className="pp-page">
        <div className="pp-toolbar">
          <div className="pp-toolbar-icon"><Banknote size={18} /></div>
          <div className="pp-toolbar-titles">
            <span className="pp-toolbar-title">Pago a prestadores</span>
            <span className="pp-toolbar-subtitle">Gestión de honorarios médicos por bloques de atención</span>
          </div>
          <div className="pp-search-wrap">
            <Search size={14} className="pp-search-icon" />
            <input className="pp-search-input" placeholder="Médico o documento..."
              onChange={e => {
                const val = e.target.value
                clearTimeout(debounceRef.current)
                debounceRef.current = setTimeout(() => setFiltros(f => ({ ...f, search: val })), 300)
              }}
            />
          </div>
          <div className="pp-filtros">
            <select className="pp-filtro-sel" value={filtros.estado}
              onChange={e => setFiltros(f => ({ ...f, estado: e.target.value }))}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
              <option value="pagado">Pagado</option>
            </select>
            <input type="date" className="pp-filtro-date" value={filtros.fecha_desde}
              onChange={e => setFiltros(f => ({ ...f, fecha_desde: e.target.value }))} />
            <input type="date" className="pp-filtro-date" value={filtros.fecha_hasta}
              onChange={e => setFiltros(f => ({ ...f, fecha_hasta: e.target.value }))} />
          </div>
          <div className="pp-toolbar-right">
            <button className="pp-btn-report" onClick={handlePdfLista} disabled={generandoPdfLista} title="Exportar listado PDF">
              <FileText size={14} />{generandoPdfLista ? 'Generando...' : 'PDF'}
            </button>
            <button className="pp-btn-report excel" onClick={handleExcelLista} disabled={generandoExcelLista} title="Exportar listado Excel">
              <FileSpreadsheet size={14} />{generandoExcelLista ? 'Generando...' : 'Excel'}
            </button>
            {puedeEliminar && (
              <button className="pp-btn-nuevo" onClick={() => setModalAbierto(true)}>
                <Plus size={15} /> Nuevo pago
              </button>
            )}
          </div>
        </div>

        <div className="pp-body">
          <div className="pp-tabla-wrap">
            <table className="pp-table">
              <thead>
                <tr>
                  <th className="pp-th">Médico</th>
                  <th className="pp-th">Nro.</th>
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
                  <tr><td colSpan={8} className="pp-td" style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>Cargando...</td></tr>
                ) : lista.length === 0 ? (
                  <tr><td colSpan={8} className="pp-td" style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>Sin registros</td></tr>
                ) : lista.map(p => (
                  <tr key={p.id} className="pp-tr" onClick={() => setPagoViendo(p.id)}>
                    <td className="pp-td">
                      <div style={{ fontWeight: 500, color: '#111827' }}>{p.medico_nombre}</div>
                      <div className="pp-td-hint">Click para ver detalle</div>
                    </td>
                    <td className="pp-td pp-mono">{p.nro_comprobante ? String(p.nro_comprobante).padStart(7, '0') : '—'}</td>
                    <td className="pp-td">{fmtFecha(p.fecha_pago)}</td>
                    <td className="pp-td pp-td-right pp-mono">{p.total_hora}h</td>
                    <td className="pp-td pp-td-right pp-mono">{fmt(p.monto_hora)}</td>
                    <td className="pp-td pp-td-right pp-mono pp-bold">Gs. {fmt(p.monto_total)}</td>
                    <td className="pp-td pp-td-center">
                      <span className={`pp-badge ${ESTADOS_BADGE[p.estado] || ''}`}>{p.estado_display}</span>
                    </td>
                    <td className="pp-td pp-td-center">
                      <div className="pp-td-acciones" onClick={e => e.stopPropagation()}>
                        <button className="pp-row-btn" title="Ver detalle" onClick={() => setPagoViendo(p.id)}>
                          <Eye size={12} />
                        </button>
                        <button className="pp-row-btn print" title="Recibo PDF"
                          disabled={generandoReciboId === p.id}
                          onClick={e => handleReciboFila(e, p)}>
                          {generandoReciboId === p.id ? '…' : <Printer size={12} />}
                        </button>
                        {puedeEliminar && (
                          <button className="pp-row-btn danger" title="Eliminar" onClick={() => handleEliminar(p)}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalAbierto && (
        <Modal isOpen={modalAbierto} onClose={handleCerrarModalNuevo}
          title="Nuevo pago a prestador" subtitle="Honorarios por bloques de atención" size="xl">
          <ModalNuevoPago
            onClose={handleCerrarModalNuevo}
            onCreado={() => { setModalAbierto(false); showToast('Pago registrado correctamente.', 'success') }}
            showToast={showToast}
            onIsDirtyChange={(v) => { modalIsDirtyRef.current = v }}
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
            showToast={showToast}
            puedeEliminar={puedeEliminar}
          />
        </Modal>
      )}

      <ConfirmDialog
        isOpen={confirmDescartarNuevo}
        title="Descartar cambios"
        description="¿Desea descartar los cambios y cerrar el formulario? Los datos ingresados se perderán."
        onConfirm={() => { setConfirmDescartarNuevo(false); setModalAbierto(false) }}
        onCancel={() => setConfirmDescartarNuevo(false)}
        confirmText="Descartar"
        cancelText="Seguir editando"
      />

      <ConfirmDialog
        isOpen={!!confirmando}
        title="Eliminar pago a prestador"
        description={confirmando
          ? `${confirmando.medico_nombre} — ${fmtFecha(confirmando.fecha_pago)}. También se eliminarán los movimientos de caja y se desmarcarán los turnos de agenda vinculados.`
          : ''}
        onConfirm={confirmarEliminar}
        onCancel={() => setConfirmando(null)}
        loading={deletePago.isPending}
      />

      <Toast toast={toast} />
    </>
  )
}
