import { useState, useRef, useEffect } from 'react'
import { Plus, Search, Trash2, Eye, X, AlertCircle } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Toast from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import {
  useCobranzas,
  useCreateCobranza,
  useDeleteCobranza,
  useSiguienteNumeroCob,
  useCuotasPendientes,
  useCobranzaDetalle,
} from '../../hooks/finanzas/useCobranzas'
import { useBuscarPersonas, useFormaPago } from '../../hooks/facturacion/useFacturacion'
import { useCuentasMcb } from '../../hooks/finanzas/useCuentasMcb'
import { extraerMensajeError } from '../../utils/errores'

function hoy() {
  return new Date().toISOString().split('T')[0]
}
function fmt(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('es-PY')
}
function fmtFecha(d) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function esVencida(fechaStr) {
  return new Date(fechaStr) < new Date(hoy())
}

function BuscadorPersonaCob({ value, onChange, onSelect }) {
  const [query, setQuery]         = useState('')
  const [abierto, setAbierto]     = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef  = useRef(null)
  const timerRef  = useRef(null)
  const [debouncedQ, setDebouncedQ] = useState('')

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedQ(query), 300)
    return () => clearTimeout(timerRef.current)
  }, [query])

  const { data: personas } = useBuscarPersonas(debouncedQ)
  const lista = personas?.results ?? personas ?? []

  const handleSelect = (p) => {
    onSelect(p)
    setQuery('')
    setDebouncedQ('')
    setAbierto(false)
  }

  const handleKeyDown = (e) => {
    if (!abierto || lista.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(i => Math.min(i + 1, lista.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); handleSelect(lista[highlighted]) }
    if (e.key === 'Escape')    { setAbierto(false) }
  }

  if (value) {
    return (
      <div className="cob-persona-sel">
        <span className="cob-persona-nombre">{value.nro_documento} — {value.razon_social}</span>
        <button className="cob-persona-clear" onClick={() => { onChange(null); onSelect(null) }} title="Cambiar cliente">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="cob-buscador-wrap">
      <input
        ref={inputRef}
        className="cob-input"
        placeholder="Buscar por nombre o documento..."
        value={query}
        onChange={e => { setQuery(e.target.value); setAbierto(true); setHighlighted(0) }}
        onKeyDown={handleKeyDown}
        onFocus={() => query.length >= 2 && setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 200)}
        autoComplete="off"
      />
      {abierto && lista.length > 0 && (
        <ul className="cob-dropdown">
          {lista.map((p, i) => (
            <li
              key={p.id}
              className={`cob-dropdown-item${i === highlighted ? ' cob-dropdown-item--hl' : ''}`}
              onMouseDown={() => handleSelect(p)}
              onMouseEnter={() => setHighlighted(i)}
            >
              <span className="cob-dd-doc">{p.nro_documento}</span>
              <span className="cob-dd-nom">{p.razon_social}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FilaCuota({ cuota, seleccionada, monto, onToggle, onMonto, error }) {
  const vencida = esVencida(cuota.fecha_vencimiento)
  const saldo   = parseFloat(cuota.saldo)

  const handleCancelTotal = (checked) => {
    onToggle(checked)
    if (checked) onMonto(String(saldo))
    else onMonto('')
  }

  return (
    <tr className={`cob-cuota-fila${vencida ? ' cob-cuota-vencida' : ''}`}>
      <td className="cob-td">
        <span className="cob-factura-nro">{cuota.factura_nro}</span>
        <span className="cob-factura-fecha"> · {fmtFecha(cuota.factura_fecha)}</span>
      </td>
      <td className="cob-td cob-mono">{cuota.nro_cuota}/{cuota.cant_cuota}</td>
      <td className="cob-td cob-mono">{fmtFecha(cuota.fecha_vencimiento)}</td>
      <td className="cob-td cob-mono cob-td-right">{fmt(cuota.saldo)}</td>
      <td className="cob-td cob-td-center">
        <input
          type="checkbox"
          className="cob-check"
          checked={seleccionada}
          onChange={e => handleCancelTotal(e.target.checked)}
        />
      </td>
      <td className="cob-td">
        <div className="cob-monto-cell">
          <input
            type="number"
            className={`cob-input cob-input-monto${error ? ' cob-input-error' : ''}`}
            placeholder="0"
            min="0"
            max={saldo}
            step="any"
            value={monto}
            onChange={e => { onToggle(false); onMonto(e.target.value) }}
          />
          {error && <span className="cob-error-inline">{error}</span>}
        </div>
      </td>
    </tr>
  )
}

function FilaValor({ val, formasPago, cuentas, onChange, onRemove }) {
  const fp         = formasPago.find(f => f.id === parseInt(val.forma_pago)) || null
  const esTarjeta  = fp?.tipo === 'tarjeta'
  const esTransf   = fp?.tipo === 'transferencia'

  return (
    <tr className="cob-vr-fila">
      <td className="cob-td">
        <select className="cob-select" value={val.forma_pago} onChange={e => onChange('forma_pago', e.target.value)}>
          <option value="">Forma de pago</option>
          {formasPago.map(f => <option key={f.id} value={f.id}>{f.descripcion}</option>)}
        </select>
      </td>
      <td className="cob-td">
        <select className="cob-select" value={val.cta} onChange={e => onChange('cta', e.target.value)}>
          <option value="">Cuenta</option>
          {cuentas.map(c => <option key={c.id} value={c.id}>{c.descripcion}</option>)}
        </select>
      </td>
      <td className="cob-td">
        <input type="number" className="cob-input cob-input-monto" placeholder="0" min="0" step="any"
          value={val.monto} onChange={e => onChange('monto', e.target.value)} />
      </td>
      <td className="cob-td">
        <input className="cob-input" placeholder="Voucher" disabled={!esTarjeta}
          value={val.voucher} onChange={e => onChange('voucher', e.target.value)} />
      </td>
      <td className="cob-td">
        <input className="cob-input" placeholder="Nro. comprobante" disabled={!esTransf}
          value={val.nro_comprobante} onChange={e => onChange('nro_comprobante', e.target.value)} />
      </td>
      <td className="cob-td cob-td-center">
        <button className="cob-btn-remove" onClick={onRemove}><X size={14} /></button>
      </td>
    </tr>
  )
}

const VALOR_INIT = () => ({ forma_pago: '', cta: '', monto: '', voucher: '', nro_comprobante: '' })

function ModalNuevaCobranza({ onClose, onCreado, showToast }) {
  const [tab, setTab]           = useState(0)
  const [persona, setPersona]   = useState(null)
  const [fecha, setFecha]       = useState(hoy())
  // detalle: map por cuota.id → { seleccionada, monto }
  const [detalle, setDetalle]   = useState({})
  const [erroresDet, setErroresDet] = useState({})
  const [valores, setValores]   = useState([VALOR_INIT()])
  const [errores, setErrores]   = useState({})
  const [guardando, setGuardando] = useState(false)

  const { data: sigNro }                             = useSiguienteNumeroCob()
  const { data: cuotas, isLoading: cargandoCuotas }  = useCuotasPendientes(persona?.id)
  const { data: formasPago = [] }                    = useFormaPago()
  const { data: cuentasMcb }                         = useCuentasMcb({})
  const cuentas                                      = cuentasMcb?.results ?? cuentasMcb ?? []
  const createCobranza                               = useCreateCobranza()

  useEffect(() => { setDetalle({}) }, [persona])

  const setDetItem = (id, key, val) => setDetalle(prev => ({
    ...prev,
    [id]: { seleccionada: false, monto: '', ...prev[id], [key]: val }
  }))

  const cuotasSeleccionadas = cuotas?.filter(c => {
    const d = detalle[c.id]
    return d && parseFloat(d.monto || '0') > 0
  }) ?? []

  const totalCobrar   = cuotasSeleccionadas.reduce((acc, c) => acc + parseFloat(detalle[c.id]?.monto || '0'), 0)
  const totalRecibido = valores.reduce((acc, v) => acc + parseFloat(v.monto || '0'), 0)
  const vuelto        = Math.max(0, totalRecibido - totalCobrar)

  const actualizarValor = (idx, key, val) => {
    setValores(prev => prev.map((v, i) => i === idx ? { ...v, [key]: val } : v))
  }
  const agregarValor = () => setValores(prev => [...prev, VALOR_INIT()])
  const removerValor = (idx) => setValores(prev => prev.filter((_, i) => i !== idx))

  const validar = () => {
    const e = {}
    if (!persona)                          e.persona  = 'Seleccione un cliente.'
    if (!fecha)                            e.fecha    = 'Ingrese la fecha.'
    if (cuotasSeleccionadas.length === 0)  e.detalle  = 'Seleccione al menos una cuota con monto mayor a 0.'

    const errDet = {}
    cuotas?.forEach(c => {
      const d = detalle[c.id]
      if (!d) return
      const m = parseFloat(d.monto || '0')
      if (m <= 0) return
      if (m > parseFloat(c.saldo)) errDet[c.id] = `Supera el saldo (${fmt(c.saldo)})`
    })
    if (Object.keys(errDet).length > 0) {
      e.detalle_montos = true
      setErroresDet(errDet)
    } else {
      setErroresDet({})
    }

    const valoresValidos = valores.filter(v => v.forma_pago && v.cta && parseFloat(v.monto || '0') > 0)
    if (valoresValidos.length === 0) e.valores = 'Ingrese al menos un valor recibido completo.'
    if (totalRecibido < totalCobrar)  e.valores_monto = `Total recibido (${fmt(totalRecibido)}) menor al total a cobrar (${fmt(totalCobrar)}).`

    setErrores(e)
    return e
  }

  const handleGuardar = async () => {
    const e = validar()
    if (Object.keys(e).length > 0) {
      if (e.persona || e.fecha || e.detalle || e.detalle_montos) setTab(0)
      else if (e.valores || e.valores_monto) setTab(1)
      return
    }

    const payload = {
      fecha,
      persona: persona.id,
      detalle: cuotasSeleccionadas.map(c => ({
        cta_cobrar_id:   c.id,
        monto_pagado:    parseFloat(detalle[c.id].monto),
        nro_comprobante: '',
      })),
      valores_recibidos: valores
        .filter(v => v.forma_pago && v.cta && parseFloat(v.monto || '0') > 0)
        .map(v => ({
          forma_pago_id:   parseInt(v.forma_pago),
          cta_id:          parseInt(v.cta),
          monto:           parseFloat(v.monto),
          voucher:         v.voucher || '',
          nro_comprobante: v.nro_comprobante || '',
        })),
    }

    setGuardando(true)
    try {
      await createCobranza.mutateAsync(payload)
      onCreado()
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="cob-modal">
      <div className="cob-tabs">
        <button className={`cob-tab${tab === 0 ? ' cob-tab--active' : ''}`} onClick={() => setTab(0)}>
          Cabecera y cuotas
        </button>
        <button className={`cob-tab${tab === 1 ? ' cob-tab--active' : ''}`} onClick={() => setTab(1)}>
          Valores recibidos
          {totalCobrar > 0 && (
            <span className="cob-tab-badge">{fmt(totalCobrar)}</span>
          )}
        </button>
      </div>

      {tab === 0 && (
        <div className="cob-tab-body">
          <div className="cob-cab-grid">
            <div className="cob-form-group">
              <label className="cob-label">Fecha</label>
              <input type="date" className={`cob-input cob-input-fecha${errores.fecha ? ' cob-input-error' : ''}`}
                value={fecha} onChange={e => setFecha(e.target.value)} />
              {errores.fecha && <span className="cob-error">{errores.fecha}</span>}
            </div>
            <div className="cob-form-group">
              <label className="cob-label">Nro. comprobante</label>
              <input className="cob-input cob-mono" readOnly
                value={sigNro?.siguiente ? String(sigNro.siguiente).padStart(7, '0') : '—'} />
            </div>
          </div>

          <div className="cob-form-group cob-form-group--full">
            <label className="cob-label">Cliente</label>
            <BuscadorPersonaCob value={persona} onChange={setPersona} onSelect={setPersona} />
            {errores.persona && <span className="cob-error">{errores.persona}</span>}
          </div>

          {persona && (
            <div className="cob-cuotas-section">
              <div className="cob-section-title">Cuotas pendientes</div>
              {cargandoCuotas ? (
                <div className="cob-loading">Cargando cuotas...</div>
              ) : !cuotas || cuotas.length === 0 ? (
                <div className="cob-empty">
                  <AlertCircle size={16} />
                  Este cliente no tiene cuotas pendientes.
                </div>
              ) : (
                <div className="cob-table-wrap">
                  <table className="cob-table">
                    <thead>
                      <tr>
                        <th className="cob-th">Factura</th>
                        <th className="cob-th">Cuota</th>
                        <th className="cob-th">Vencimiento</th>
                        <th className="cob-th cob-th-right">Saldo</th>
                        <th className="cob-th cob-th-center">Total</th>
                        <th className="cob-th">Monto a pagar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuotas.map(c => (
                        <FilaCuota
                          key={c.id}
                          cuota={c}
                          seleccionada={detalle[c.id]?.seleccionada ?? false}
                          monto={detalle[c.id]?.monto ?? ''}
                          error={erroresDet[c.id]}
                          onToggle={v => setDetItem(c.id, 'seleccionada', v)}
                          onMonto={v => setDetItem(c.id, 'monto', v)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {cuotasSeleccionadas.length > 0 && (
                <div className="cob-totales">
                  <span className="cob-totales-lbl">Total a cobrar</span>
                  <span className="cob-totales-val cob-mono">{fmt(totalCobrar)}</span>
                </div>
              )}

              {errores.detalle && <span className="cob-error">{errores.detalle}</span>}
            </div>
          )}
        </div>
      )}

      {tab === 1 && (
        <div className="cob-tab-body">
          <div className="cob-section-title">Valores recibidos</div>
          <div className="cob-table-wrap">
            <table className="cob-table">
              <thead>
                <tr>
                  <th className="cob-th">Forma de pago</th>
                  <th className="cob-th">Cuenta</th>
                  <th className="cob-th">Monto</th>
                  <th className="cob-th">Voucher</th>
                  <th className="cob-th">Nro. comprobante</th>
                  <th className="cob-th"></th>
                </tr>
              </thead>
              <tbody>
                {valores.map((v, i) => (
                  <FilaValor
                    key={i}
                    val={v}
                    formasPago={formasPago?.results ?? formasPago ?? []}
                    cuentas={cuentas}
                    onChange={(k, val) => actualizarValor(i, k, val)}
                    onRemove={() => removerValor(i)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <button className="cob-btn-add-row" onClick={agregarValor}>
            <Plus size={14} /> Agregar fila
          </button>

          <div className="cob-totales-bloque">
            <div className="cob-totales-fila">
              <span className="cob-totales-lbl">Total a cobrar</span>
              <span className="cob-mono">{fmt(totalCobrar)}</span>
            </div>
            <div className="cob-totales-fila">
              <span className="cob-totales-lbl">Total recibido</span>
              <span className={`cob-mono${totalRecibido < totalCobrar ? ' cob-val-error' : ''}`}>{fmt(totalRecibido)}</span>
            </div>
            <div className="cob-totales-fila cob-totales-fila--vuelto">
              <span className="cob-totales-lbl">Vuelto</span>
              <span className="cob-mono cob-vuelto">{fmt(vuelto)}</span>
            </div>
          </div>

          {errores.valores       && <span className="cob-error">{errores.valores}</span>}
          {errores.valores_monto && <span className="cob-error">{errores.valores_monto}</span>}
        </div>
      )}

      <div className="cob-modal-footer">
        <button className="btn btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleGuardar} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Registrar cobranza'}
        </button>
      </div>
    </div>
  )
}

function ModalVerCobranza({ id, onEliminar }) {
  const { data: cob, isLoading } = useCobranzaDetalle(id)

  if (isLoading) return <div className="cob-loading-modal">Cargando...</div>
  if (!cob)      return null

  const totalRecibido = cob.valores_recibidos.reduce((acc, v) => acc + parseFloat(v.monto), 0)

  return (
    <div className="cob-ver">
      <div className="cob-ver-header">
        <div className="cob-ver-campo">
          <span className="cob-ver-lbl">Comprobante</span>
          <span className="cob-mono cob-ver-val">{String(cob.comprobante_nro).padStart(7, '0')}</span>
        </div>
        <div className="cob-ver-campo">
          <span className="cob-ver-lbl">Fecha</span>
          <span className="cob-ver-val">{fmtFecha(cob.fecha)}</span>
        </div>
        <div className="cob-ver-campo">
          <span className="cob-ver-lbl">Cliente</span>
          <span className="cob-ver-val">{cob.cliente_documento} — {cob.cliente_nombre}</span>
        </div>
        <div className="cob-ver-campo">
          <span className="cob-ver-lbl">Total cobrado</span>
          <span className="cob-mono cob-ver-val cob-ver-total">{fmt(cob.monto)}</span>
        </div>
      </div>

      <div className="cob-ver-section">
        <div className="cob-section-title">Cuotas cobradas</div>
        <table className="cob-table">
          <thead>
            <tr>
              <th className="cob-th">Factura</th>
              <th className="cob-th">Cuota</th>
              <th className="cob-th">Vencimiento</th>
              <th className="cob-th cob-th-right">Saldo anterior</th>
              <th className="cob-th cob-th-right">Monto pagado</th>
            </tr>
          </thead>
          <tbody>
            {cob.detalle.map(d => (
              <tr key={d.id} className="cob-ver-fila">
                <td className="cob-td cob-mono">{d.factura_nro}</td>
                <td className="cob-td cob-mono">{d.cuota_display}</td>
                <td className="cob-td">{fmtFecha(d.fecha_vencimiento)}</td>
                <td className="cob-td cob-mono cob-td-right">{fmt(d.monto_total)}</td>
                <td className="cob-td cob-mono cob-td-right cob-pagado">{fmt(d.monto_pagado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cob-ver-section">
        <div className="cob-section-title">Valores recibidos</div>
        <table className="cob-table">
          <thead>
            <tr>
              <th className="cob-th">Forma de pago</th>
              <th className="cob-th">Cuenta</th>
              <th className="cob-th cob-th-right">Monto</th>
              <th className="cob-th">Voucher</th>
            </tr>
          </thead>
          <tbody>
            {cob.valores_recibidos.map(v => (
              <tr key={v.id} className="cob-ver-fila">
                <td className="cob-td">{v.forma_pago_descripcion}</td>
                <td className="cob-td">{v.cuenta_descripcion}</td>
                <td className="cob-td cob-mono cob-td-right">{fmt(v.monto)}</td>
                <td className="cob-td">{v.voucher || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="cob-totales-bloque cob-totales-bloque--sm">
          <div className="cob-totales-fila">
            <span className="cob-totales-lbl">Total cobrado</span>
            <span className="cob-mono">{fmt(cob.monto)}</span>
          </div>
          <div className="cob-totales-fila">
            <span className="cob-totales-lbl">Total recibido</span>
            <span className="cob-mono">{fmt(totalRecibido)}</span>
          </div>
          {parseFloat(cob.vuelto) > 0 && (
            <div className="cob-totales-fila cob-totales-fila--vuelto">
              <span className="cob-totales-lbl">Vuelto</span>
              <span className="cob-mono cob-vuelto">{fmt(cob.vuelto)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="cob-modal-footer">
        <button className="btn btn-danger" onClick={() => onEliminar(cob)}>Eliminar</button>
      </div>
    </div>
  )
}

export default function CobranzasPage() {
  const { toast, showToast }        = useToast()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [cobranzaViendo, setCobranzaViendo] = useState(null)
  const [filtros, setFiltros]       = useState({ search: '', fecha_desde: '', fecha_hasta: '' })
  const [confirmando, setConfirmando] = useState(null)

  const { data, isLoading } = useCobranzas(filtros)
  const deleteCobranza      = useDeleteCobranza()

  const lista = data?.results ?? data ?? []

  const handleEliminar = (cob) => {
    setConfirmando(cob)
    setCobranzaViendo(null)
  }

  const confirmarEliminar = async () => {
    try {
      await deleteCobranza.mutateAsync(confirmando.id)
      showToast('Cobranza eliminada.', 'success')
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setConfirmando(null)
    }
  }

  return (
    <>
      <style>{`
        .cob-page { padding: 24px; max-width: 1200px; margin: 0 auto; }

        .cob-filtros { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 20px; }
        .cob-filtro-group { display: flex; flex-direction: column; gap: 4px; }
        .cob-filtro-label { font-size: 11px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: .04em; }
        .cob-input-filtro { height: 36px; border: 1px solid #e5e7eb; border-radius: 7px; padding: 0 10px; font-size: 13px; background: #fff; outline: none; }
        .cob-input-filtro:focus { border-color: #1a3a5c; }
        .cob-btn-nuevo { margin-left: auto; height: 36px; display: flex; align-items: center; gap: 6px; }

        .cob-table-wrap { overflow-x: auto; border: 1px solid #e8edf2; border-radius: 10px; background: #fff; }
        .cob-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .cob-th { padding: 10px 14px; background: #f8fafc; color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid #e8edf2; white-space: nowrap; }
        .cob-th-right { text-align: right; }
        .cob-th-center { text-align: center; }
        .cob-td { padding: 10px 14px; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: middle; }
        .cob-td-right { text-align: right; }
        .cob-td-center { text-align: center; }
        .cob-row { cursor: pointer; transition: background .12s; }
        .cob-row:hover { background: #eff6ff; }
        .cob-row:last-child td { border-bottom: none; }

        .cob-monto-val { font-family: 'Courier New', monospace; font-weight: 600; color: #1a3a5c; }
        .cob-mono { font-family: 'Courier New', monospace; font-size: 12px; }

        .cob-td-acciones { display: flex; gap: 4px; justify-content: center; }
        .cob-row-btn { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 5px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer; color: #6b7280; }
        .cob-row-btn:hover { background: #fef2f2; border-color: #fecaca; color: #dc2626; }
        .cob-row-btn-eye:hover { background: #eff6ff; border-color: #bfdbfe; color: #1a3a5c; }

        .cob-modal { display: flex; flex-direction: column; min-height: 0; }
        .cob-tabs { display: flex; border-bottom: 2px solid #e8edf2; margin-bottom: 0; }
        .cob-tab { padding: 10px 20px; font-size: 13px; font-weight: 500; color: #6b7280; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; display: flex; align-items: center; gap: 8px; transition: all .15s; }
        .cob-tab--active { color: #1a3a5c; border-bottom-color: #1a3a5c; }
        .cob-tab-badge { font-size: 11px; font-family: 'Courier New', monospace; background: #dbeafe; color: #1a3a5c; border-radius: 4px; padding: 1px 6px; }
        .cob-tab-body { padding: 20px 0 0; display: flex; flex-direction: column; gap: 14px; min-height: 0; }

        .cob-cab-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .cob-form-group { display: flex; flex-direction: column; gap: 5px; }
        .cob-form-group--full { grid-column: 1 / -1; }
        .cob-label { font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
        .cob-input { height: 36px; border: 1px solid #e5e7eb; border-radius: 7px; padding: 0 10px; font-size: 13px; background: #fff; outline: none; width: 100%; box-sizing: border-box; }
        .cob-input:focus { border-color: #1a3a5c; }
        .cob-input[readonly] { background: #f8fafc; color: #6b7280; cursor: default; }
        .cob-input-fecha { width: 160px; }
        .cob-input-monto { width: 120px; text-align: right; }
        .cob-input-error { border-color: #dc2626 !important; }
        .cob-select { height: 36px; border: 1px solid #e5e7eb; border-radius: 7px; padding: 0 8px; font-size: 13px; background: #fff; outline: none; width: 100%; }
        .cob-select:focus { border-color: #1a3a5c; }
        .cob-error { font-size: 11px; color: #dc2626; }
        .cob-error-inline { font-size: 10px; color: #dc2626; display: block; margin-top: 2px; }
        .cob-monto-cell { display: flex; flex-direction: column; }

        .cob-buscador-wrap { position: relative; }
        .cob-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #e8edf2; border-radius: 8px; box-shadow: 0 6px 24px rgba(0,0,0,.12); z-index: 100; max-height: 220px; overflow-y: auto; padding: 4px 0; list-style: none; margin: 4px 0 0; }
        .cob-dropdown-item { display: flex; gap: 10px; align-items: baseline; padding: 8px 14px; cursor: pointer; font-size: 13px; }
        .cob-dropdown-item--hl, .cob-dropdown-item:hover { background: #eff6ff; }
        .cob-dd-doc { font-family: 'Courier New', monospace; font-size: 12px; color: #6b7280; min-width: 80px; }
        .cob-dd-nom { color: #111827; }
        .cob-persona-sel { display: flex; align-items: center; justify-content: space-between; height: 36px; border: 1px solid #e5e7eb; border-radius: 7px; padding: 0 10px; background: #f0f4f8; font-size: 13px; }
        .cob-persona-nombre { color: #111827; font-weight: 500; }
        .cob-persona-clear { background: none; border: none; cursor: pointer; color: #6b7280; display: flex; align-items: center; padding: 2px; border-radius: 3px; }
        .cob-persona-clear:hover { color: #dc2626; background: #fef2f2; }

        .cob-cuotas-section { display: flex; flex-direction: column; gap: 10px; }
        .cob-section-title { font-size: 12px; font-weight: 600; color: #1a3a5c; text-transform: uppercase; letter-spacing: .06em; }
        .cob-cuota-fila td { padding: 8px 14px; }
        .cob-cuota-vencida { background: #fff5f5; }
        .cob-cuota-vencida td { color: #b91c1c; }
        .cob-factura-nro { font-family: 'Courier New', monospace; font-size: 12px; font-weight: 600; color: #1a3a5c; }
        .cob-factura-fecha { font-size: 11px; color: #9ca3af; }
        .cob-check { width: 16px; height: 16px; cursor: pointer; accent-color: #1a3a5c; }
        .cob-loading, .cob-empty { text-align: center; padding: 24px; color: #9ca3af; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 8px; }

        .cob-totales { display: flex; justify-content: flex-end; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid #e8edf2; margin-top: 4px; }
        .cob-totales-lbl { font-size: 12px; color: #6b7280; font-weight: 500; }
        .cob-totales-val { font-size: 15px; font-weight: 700; color: #1a3a5c; }
        .cob-totales-bloque { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; padding: 14px 0; border-top: 1px solid #e8edf2; }
        .cob-totales-bloque--sm { padding: 10px 0; }
        .cob-totales-fila { display: flex; gap: 24px; align-items: center; justify-content: flex-end; }
        .cob-totales-fila--vuelto { border-top: 1px dashed #e8edf2; padding-top: 6px; margin-top: 2px; }
        .cob-vuelto { color: #16a34a; font-weight: 700; }
        .cob-val-error { color: #dc2626; }
        .cob-pagado { color: #16a34a; font-weight: 600; }

        .cob-btn-add-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #1a3a5c; background: none; border: 1px dashed #bfdbfe; border-radius: 6px; padding: 6px 14px; cursor: pointer; margin-top: 6px; }
        .cob-btn-add-row:hover { background: #eff6ff; }
        .cob-btn-remove { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 5px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer; color: #6b7280; }
        .cob-btn-remove:hover { background: #fef2f2; border-color: #fecaca; color: #dc2626; }

        .cob-modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 0 0; border-top: 1px solid #e8edf2; margin-top: auto; }

        .cob-ver { display: flex; flex-direction: column; gap: 20px; }
        .cob-ver-header { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e8edf2; }
        .cob-ver-campo { display: flex; flex-direction: column; gap: 4px; }
        .cob-ver-lbl { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: .06em; }
        .cob-ver-val { font-size: 13px; color: #111827; }
        .cob-ver-total { font-size: 16px; font-weight: 700; color: #1a3a5c; }
        .cob-ver-section { display: flex; flex-direction: column; gap: 10px; }
        .cob-ver-fila td { padding: 8px 14px; }
        .cob-loading-modal { padding: 40px; text-align: center; color: #9ca3af; }
      `}</style>

      <div className="cob-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Cobranzas</h1>
            <p className="page-subtitle">Cobro de cuotas de facturas a crédito</p>
          </div>
        </div>

        <div className="cob-filtros">
          <div className="cob-filtro-group">
            <span className="cob-filtro-label">Buscar</span>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 9, top: 11, color: '#9ca3af' }} />
              <input className="cob-input-filtro" style={{ paddingLeft: 30, width: 220 }}
                placeholder="Nombre o documento..."
                value={filtros.search}
                onChange={e => setFiltros(f => ({ ...f, search: e.target.value }))} />
            </div>
          </div>
          <div className="cob-filtro-group">
            <span className="cob-filtro-label">Desde</span>
            <input type="date" className="cob-input-filtro"
              value={filtros.fecha_desde}
              onChange={e => setFiltros(f => ({ ...f, fecha_desde: e.target.value }))} />
          </div>
          <div className="cob-filtro-group">
            <span className="cob-filtro-label">Hasta</span>
            <input type="date" className="cob-input-filtro"
              value={filtros.fecha_hasta}
              onChange={e => setFiltros(f => ({ ...f, fecha_hasta: e.target.value }))} />
          </div>
          <button className="btn btn-primary cob-btn-nuevo" onClick={() => setModalAbierto(true)}>
            <Plus size={15} /> Nueva cobranza
          </button>
        </div>

        <div className="cob-table-wrap">
          <table className="cob-table">
            <thead>
              <tr>
                <th className="cob-th">Comprobante</th>
                <th className="cob-th">Fecha</th>
                <th className="cob-th">Cliente</th>
                <th className="cob-th cob-th-right">Monto</th>
                <th className="cob-th cob-th-right">Vuelto</th>
                <th className="cob-th cob-th-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="cob-td" style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>Cargando...</td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={6} className="cob-td" style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>Sin registros</td></tr>
              ) : lista.map(c => (
                <tr key={c.id} className="cob-row" onClick={() => setCobranzaViendo(c.id)}>
                  <td className="cob-td cob-mono">{String(c.comprobante_nro).padStart(7, '0')}</td>
                  <td className="cob-td">{fmtFecha(c.fecha)}</td>
                  <td className="cob-td">
                    <div style={{ fontWeight: 500, color: '#111827' }}>{c.cliente_nombre}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'Courier New' }}>{c.cliente_documento}</div>
                  </td>
                  <td className="cob-td cob-td-right cob-monto-val">{fmt(c.monto)}</td>
                  <td className="cob-td cob-td-right cob-mono">{fmt(c.vuelto)}</td>
                  <td className="cob-td cob-td-center">
                    <div className="cob-td-acciones" onClick={e => e.stopPropagation()}>
                      <button className="cob-row-btn cob-row-btn-eye" title="Ver detalle"
                        onClick={() => setCobranzaViendo(c.id)}>
                        <Eye size={12} />
                      </button>
                      <button className="cob-row-btn" title="Eliminar"
                        onClick={() => handleEliminar(c)}>
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
        <Modal
          isOpen={modalAbierto}
          onClose={() => setModalAbierto(false)}
          title="Nueva cobranza"
          subtitle="Cobro de cuotas a crédito"
          size="xl"
        >
          <ModalNuevaCobranza
            onClose={() => setModalAbierto(false)}
            onCreado={() => { setModalAbierto(false); showToast('Cobranza registrada correctamente.', 'success') }}
            showToast={showToast}
          />
        </Modal>
      )}

      {cobranzaViendo && (
        <Modal
          isOpen={!!cobranzaViendo}
          onClose={() => setCobranzaViendo(null)}
          title="Detalle de cobranza"
          subtitle="Vista del comprobante"
          size="xl"
        >
          <ModalVerCobranza
            id={cobranzaViendo}
            onEliminar={handleEliminar}
          />
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!confirmando}
        title="Eliminar cobranza"
        description={confirmando ? `Comprobante #${String(confirmando.comprobante_nro).padStart(7, '0')} — ${confirmando.cliente_nombre}. Esta acción también eliminará los movimientos de caja asociados.` : ''}
        onConfirm={confirmarEliminar}
        onCancel={() => setConfirmando(null)}
        loading={deleteCobranza.isPending}
      />

      <Toast toast={toast} />
    </>
  )
}
