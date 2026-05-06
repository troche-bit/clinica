import { useState, useMemo, useEffect, useRef } from 'react'
import {
  FileText, Plus, Search, Trash2, CheckCircle, XCircle,
  AlertTriangle, Info, Pencil, Check, Printer, Eye,
} from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Toast from '../../components/ui/Toast'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../hooks/useToast'
import {
  useFacturas, useFacturaDetalle, useCreateFactura, useUpdateFactura, useDeleteFactura,
  useValidarTimbrado, useSiguienteNumero,
  useFormaPago, useBuscarPersonas, useBuscarProductos,
} from '../../hooks/facturacion/useFacturacion'
import { useCuentasMcb } from '../../hooks/finanzas/useCuentasMcb'
import { extraerMensajeError } from '../../utils/errores'

function hoy() { return new Date().toISOString().split('T')[0] }

function formatGs(v) {
  const n = Number(v) || 0
  return `₲ ${n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-PY', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function calcularItem(monto, impuesto) {
  const m = Math.round(Number(monto) * 100) / 100
  if (impuesto === '10') {
    const gra = Math.round(m / 1.10 * 100) / 100
    return { sub_gra_10: gra, sub_iva_10: Math.round((m - gra) * 100) / 100, sub_gra_5: 0, sub_iva_5: 0, exento: 0 }
  }
  if (impuesto === '5') {
    const gra = Math.round(m / 1.05 * 100) / 100
    return { sub_gra_5: gra, sub_iva_5: Math.round((m - gra) * 100) / 100, sub_gra_10: 0, sub_iva_10: 0, exento: 0 }
  }
  return { exento: m, sub_gra_5: 0, sub_iva_5: 0, sub_gra_10: 0, sub_iva_10: 0 }
}

function calcularTotales(detalle) {
  let grav_5 = 0, grav_10 = 0, iva_5 = 0, iva_10 = 0, exento = 0
  for (const it of detalle) {
    const total = Math.round((Number(it.cantidad) || 0) * (Number(it.precio) || 0) * 100) / 100
    const c = calcularItem(total, it.impuesto)
    grav_5  += c.sub_gra_5;  grav_10 += c.sub_gra_10
    iva_5   += c.sub_iva_5;  iva_10  += c.sub_iva_10
    exento  += c.exento
  }
  const total_gravada = grav_5 + grav_10
  const total_iva     = iva_5  + iva_10
  const monto_total   = total_gravada + total_iva + exento
  return { grav_5, grav_10, iva_5, iva_10, total_gravada, total_iva, monto_total }
}

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debouncedValue
}

function BuscadorPersona({ value, onChange }) {
  const [input, setInput]             = useState(value ? `${value.nro_documento} — ${value.razon_social}` : '')
  const [abierto, setAbierto]         = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const search   = useDebounce(input, 300)
  const { data } = useBuscarPersonas(search)
  const personas = data?.results ?? data ?? []
  const wrapRef  = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { setHighlighted(-1) }, [personas.length])

  const seleccionar = (p) => {
    onChange(p)
    setInput(`${p.nro_documento} — ${p.razon_social}`)
    setAbierto(false)
    setHighlighted(-1)
  }

  const handleKeyDown = (e) => {
    if (!abierto || !personas.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, personas.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (highlighted >= 0) seleccionar(personas[highlighted]) }
    else if (e.key === 'Escape') setAbierto(false)
  }

  return (
    <div className="fac-autocomplete" ref={wrapRef}>
      <input
        className="fac-input"
        placeholder="Buscar por nombre o documento…"
        value={input}
        onChange={e => { setInput(e.target.value); setAbierto(true); if (!e.target.value) onChange(null) }}
        onFocus={() => { if (input.length >= 2) setAbierto(true) }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {abierto && personas.length > 0 && (
        <div className="fac-dropdown">
          {personas.map((p, idx) => (
            <div
              key={p.id}
              className={`fac-dropdown-item ${highlighted === idx ? 'highlighted' : ''}`}
              onMouseDown={() => seleccionar(p)}
              onMouseEnter={() => setHighlighted(idx)}
            >
              <div className="fac-dropdown-nombre">{p.nro_documento} — {p.razon_social}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BuscadorProducto({ onSeleccionar }) {
  const [input, setInput]             = useState('')
  const [abierto, setAbierto]         = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const search    = useDebounce(input, 300)
  const { data }  = useBuscarProductos(search)
  const productos = data?.results ?? data ?? []
  const wrapRef   = useRef(null)
  const inputRef  = useRef(null)

  const impLabel = { '10': 'IVA 10%', '5': 'IVA 5%', 'exenta': 'Exenta' }

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { setHighlighted(-1) }, [productos.length])

  const seleccionar = (p) => {
    onSeleccionar(p)
    setInput('')
    setAbierto(false)
    setHighlighted(-1)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setHighlighted(h => Math.min(h + 1, productos.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (highlighted >= 0 && productos[highlighted]) seleccionar(productos[highlighted]) }
    else if (e.key === 'Escape') setAbierto(false)
  }

  return (
    <div className="fac-autocomplete" ref={wrapRef}>
      <div className="fac-prod-search-wrap">
        <Search size={13} color="#9ca3af" style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          className="fac-prod-search-input"
          placeholder="Agregar producto o servicio… (↑↓ navegar, Enter seleccionar)"
          value={input}
          onChange={e => { setInput(e.target.value); setAbierto(true) }}
          onFocus={() => { if (input.length >= 2) setAbierto(true) }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
      </div>
      {abierto && productos.length > 0 && (
        <div className="fac-dropdown">
          {productos.map((p, idx) => (
            <div
              key={p.id}
              className={`fac-dropdown-item ${highlighted === idx ? 'highlighted' : ''}`}
              onMouseDown={() => seleccionar(p)}
              onMouseEnter={() => setHighlighted(idx)}
            >
              <div className="fac-dropdown-nombre">{p.descripcion}</div>
              <div className="fac-dropdown-doc">{p.grupo_nombre} · {impLabel[p.impuesto] || p.impuesto}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TabCabecera({ form, setForm, detalle, setDetalle, errores }) {
  const { data: sigData } = useSiguienteNumero(form.estab, form.expedicion)
  const validar = useValidarTimbrado()

  useEffect(() => {
    if (form.estab.length === 3 && form.expedicion.length === 3 && String(form.nro_comprobante).length === 7) {
      validar.mutate(
        { establecimiento: form.estab, expedicion: form.expedicion, numero: Number(form.nro_comprobante) },
        {
          onSuccess: res => setForm(f => ({ ...f, timbrado_validacion: res })),
          onError:   ()  => setForm(f => ({ ...f, timbrado_validacion: { valido: false, mensaje: 'Error al validar.' } })),
        }
      )
    } else {
      setForm(f => ({ ...f, timbrado_validacion: null }))
    }
  }, [form.estab, form.expedicion, form.nro_comprobante])

  const agregarProducto = (prod) => {
    setDetalle(prev => [...prev, {
      key: Date.now(), prs: prod.id, descripcion: prod.descripcion,
      impuesto: prod.impuesto, cantidad: '1', precio: '', editando: true,
    }])
  }

  const actualizarItem  = (key, campo, valor) =>
    setDetalle(prev => prev.map(it => it.key === key ? { ...it, [campo]: valor } : it))

  const confirmarEdicion = (key) =>
    setDetalle(prev => prev.map(it => it.key === key ? { ...it, editando: false } : it))

  const iniciarEdicion  = (key) =>
    setDetalle(prev => prev.map(it => it.key === key ? { ...it, editando: true } : it))

  const eliminarItem    = (key) =>
    setDetalle(prev => prev.filter(it => it.key !== key))

  const totales  = useMemo(() => calcularTotales(detalle), [detalle])
  const impLabel = { '10': 'IVA 10%', '5': 'IVA 5%', 'exenta': 'Exenta' }

  return (
    <div className="fac-tab-body">
      <div className="fac-form-row" style={{ alignItems: 'flex-end', gap: 20 }}>
        <div className="fac-form-group">
          <label className="fac-label">Fecha *</label>
          <input
            type="date"
            className={`fac-input fac-input-date ${errores.fecha ? 'fac-input-error' : ''}`}
            value={form.fecha}
            onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
          />
          {errores.fecha && <span className="fac-error-msg">{errores.fecha}</span>}
        </div>
        <div className="fac-form-group" style={{ paddingBottom: 6 }}>
          <label className="fac-check-label">
            <input
              type="checkbox"
              className="fac-checkbox"
              checked={form.contado}
              onChange={e => setForm(f => ({ ...f, contado: e.target.checked }))}
            />
            <span className="fac-check-text">Contado</span>
          </label>
          <span className="fac-cond-hint">
            {form.contado ? 'Cobranza en la siguiente pestaña' : 'Cuotas en la siguiente pestaña'}
          </span>
        </div>
      </div>

      <div className="fac-form-group">
        <label className="fac-label">Cliente *</label>
        <BuscadorPersona value={form.persona} onChange={p => setForm(f => ({ ...f, persona: p }))} />
        {form.persona && (
          <div className="fac-persona-tag">
            <CheckCircle size={12} color="#16a34a" />
            {form.persona.nro_documento} — {form.persona.razon_social}
          </div>
        )}
        {errores.persona && <span className="fac-error-msg">{errores.persona}</span>}
      </div>

      <div className="fac-form-group">
        <label className="fac-label">Comprobante *</label>
        <div className="fac-timbrado-row">
          <input
            className="fac-input fac-mono fac-timbrado-pt"
            maxLength={3} placeholder="001"
            value={form.estab}
            onChange={e => setForm(f => ({ ...f, estab: e.target.value.replace(/\D/g, '') }))}
            onBlur={e => { const v = e.target.value; if (v) setForm(f => ({ ...f, estab: v.padStart(3, '0') })) }}
          />
          <span className="fac-timbrado-sep">-</span>
          <input
            className="fac-input fac-mono fac-timbrado-pt"
            maxLength={3} placeholder="001"
            value={form.expedicion}
            onChange={e => setForm(f => ({ ...f, expedicion: e.target.value.replace(/\D/g, '') }))}
            onBlur={e => { const v = e.target.value; if (v) setForm(f => ({ ...f, expedicion: v.padStart(3, '0') })) }}
          />
          <span className="fac-timbrado-sep">-</span>
          <input
            className="fac-input fac-mono fac-timbrado-nro"
            maxLength={7}
            placeholder={sigData?.siguiente ? String(sigData.siguiente).padStart(7, '0') : '0000001'}
            value={form.nro_comprobante}
            onChange={e => setForm(f => ({ ...f, nro_comprobante: e.target.value.replace(/\D/g, '') }))}
            onBlur={e => { const v = e.target.value; if (v) setForm(f => ({ ...f, nro_comprobante: v.padStart(7, '0') })) }}
          />
        </div>

        {sigData?.nro_timbrado && (
          <div className="fac-timbrado-info">
            <span className="fac-tim-lbl">Timbrado</span>
            <span className="fac-mono fac-tim-val">{sigData.nro_timbrado}</span>
            <span className="fac-tim-sep">·</span>
            <span className="fac-tim-lbl">Siguiente disponible</span>
            <span className="fac-mono fac-tim-val">{String(sigData.siguiente).padStart(7, '0')}</span>
          </div>
        )}

        {form.timbrado_validacion && (
          <div className={`fac-validacion ${form.timbrado_validacion.valido ? 'ok' : 'error'}`}>
            {form.timbrado_validacion.valido ? <CheckCircle size={13} /> : <XCircle size={13} />}
            {form.timbrado_validacion.mensaje}
          </div>
        )}
        {errores.timbrado && <span className="fac-error-msg">{errores.timbrado}</span>}
      </div>

      <div className="fac-form-group">
        <label className="fac-label">Observación</label>
        <textarea
          className="fac-input fac-textarea"
          rows={2}
          placeholder="Observaciones opcionales…"
          value={form.observacion}
          onChange={e => setForm(f => ({ ...f, observacion: e.target.value }))}
        />
      </div>

      <div className="fac-seccion-titulo">Detalle de ítems</div>

      <BuscadorProducto onSeleccionar={agregarProducto} />

      {detalle.length > 0 && (
        <div className="fac-det-wrap">
          <table className="fac-det-table">
            <thead>
              <tr>
                <th className="fac-det-th">Producto / Servicio</th>
                <th className="fac-det-th fac-det-th-c" style={{ width: 80 }}>Cant.</th>
                <th className="fac-det-th fac-det-th-c" style={{ width: 110 }}>Precio unit.</th>
                <th className="fac-det-th fac-det-th-r" style={{ width: 110 }}>Total</th>
                <th className="fac-det-th fac-det-th-c" style={{ width: 80 }}>IVA</th>
                <th className="fac-det-th" style={{ width: 56 }}></th>
              </tr>
            </thead>
            <tbody>
              {detalle.map(it => {
                const total = Math.round((Number(it.cantidad) || 0) * (Number(it.precio) || 0) * 100) / 100
                return (
                  <tr key={it.key} className={`fac-det-tr ${it.editando ? 'editing' : ''}`}>
                    <td className="fac-det-td">{it.descripcion}</td>
                    <td className="fac-det-td fac-det-td-c">
                      {it.editando
                        ? <input className="fac-input fac-input-sm fac-mono fac-det-input" value={it.cantidad}
                            onChange={e => actualizarItem(it.key, 'cantidad', e.target.value.replace(/[^\d.]/g, ''))}
                            onKeyDown={e => e.key === 'Enter' && confirmarEdicion(it.key)} autoFocus />
                        : <span className="fac-mono">{it.cantidad}</span>
                      }
                    </td>
                    <td className="fac-det-td fac-det-td-c">
                      {it.editando
                        ? <input className="fac-input fac-input-sm fac-mono fac-det-input" placeholder="0" value={it.precio}
                            onChange={e => actualizarItem(it.key, 'precio', e.target.value.replace(/[^\d.]/g, ''))}
                            onKeyDown={e => e.key === 'Enter' && confirmarEdicion(it.key)} />
                        : <span className="fac-mono">
                            {Number(it.precio) > 0 ? Number(it.precio).toLocaleString('es-PY') : <span style={{ color: '#9ca3af' }}>—</span>}
                          </span>
                      }
                    </td>
                    <td className="fac-det-td fac-mono fac-det-td-r">
                      {total > 0 ? total.toLocaleString('es-PY') : '—'}
                    </td>
                    <td className="fac-det-td fac-det-td-c">
                      <span className={`fac-badge-imp ${it.impuesto === '10' ? 'blue' : it.impuesto === '5' ? 'amber' : 'gray'}`}>
                        {impLabel[it.impuesto] || it.impuesto}
                      </span>
                    </td>
                    <td className="fac-det-td">
                      <div className="fac-det-acciones">
                        {it.editando
                          ? <button className="fac-row-action confirm" title="Confirmar" onClick={() => confirmarEdicion(it.key)}><Check size={13} /></button>
                          : <button className="fac-row-action edit"    title="Editar"    onClick={() => iniciarEdicion(it.key)}><Pencil size={12} /></button>
                        }
                        <button className="fac-row-action del" title="Eliminar" onClick={() => eliminarItem(it.key)}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {errores.detalle && <span className="fac-error-msg">{errores.detalle}</span>}

      {detalle.length > 0 && (
        <div className="fac-totales">
          <div className="fac-tot-grid">
            {totales.grav_5  > 0 && <>
              <div className="fac-tot-row"><span>Gravada 5%</span><span className="fac-mono">{formatGs(totales.grav_5)}</span></div>
              <div className="fac-tot-row"><span>IVA 5%</span><span className="fac-mono">{formatGs(totales.iva_5)}</span></div>
            </>}
            {totales.grav_10 > 0 && <>
              <div className="fac-tot-row"><span>Gravada 10%</span><span className="fac-mono">{formatGs(totales.grav_10)}</span></div>
              <div className="fac-tot-row"><span>IVA 10%</span><span className="fac-mono">{formatGs(totales.iva_10)}</span></div>
            </>}
            {(totales.monto_total - totales.total_gravada - totales.total_iva) > 0 && (
              <div className="fac-tot-row"><span>Exento</span><span className="fac-mono">{formatGs(totales.monto_total - totales.total_gravada - totales.total_iva)}</span></div>
            )}
            <div className="fac-tot-row fac-tot-total">
              <span>Total</span><span className="fac-mono">{formatGs(totales.monto_total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TabCobranza({ cobranza, setCobranza, montoTotal, errores }) {
  const { data: fpData }  = useFormaPago()
  const { data: ctaData } = useCuentasMcb()
  const formasPago = fpData?.results ?? fpData ?? []
  const cuentas    = ctaData?.results ?? ctaData ?? []

  const totalCobrado = cobranza.reduce((s, r) => s + (Number(r.monto) || 0), 0)
  const diferencia   = totalCobrado - montoTotal
  const vuelto       = Math.max(0, diferencia)
  const falta        = Math.max(0, -diferencia)

  const agregarFila = () => setCobranza(prev => [
    ...prev, { key: Date.now(), forma_pago: '', cta: '', monto: '', voucher: '', nro_comprobante: '' }
  ])
  const actualizarFila = (key, campo, valor) =>
    setCobranza(prev => prev.map(r => r.key === key ? { ...r, [campo]: valor } : r))
  const eliminarFila = (key) => setCobranza(prev => prev.filter(r => r.key !== key))
  const getFP = (id) => formasPago.find(f => String(f.id) === String(id))

  return (
    <div className="fac-tab-body">
      <div className="fac-seccion-titulo">Detalle de cobranza</div>

      {cobranza.map(fila => {
        const fp = getFP(fila.forma_pago)
        return (
          <div key={fila.key} className="fac-cobr-fila">
            <div className="fac-form-group" style={{ flex: 1 }}>
              <label className="fac-label">Forma de pago</label>
              <select className="fac-select" value={fila.forma_pago}
                onChange={e => actualizarFila(fila.key, 'forma_pago', e.target.value)}>
                <option value="">Seleccionar…</option>
                {formasPago.map(f => <option key={f.id} value={f.id}>{f.descripcion}</option>)}
              </select>
            </div>
            <div className="fac-form-group" style={{ flex: 1 }}>
              <label className="fac-label">Cuenta</label>
              <select className="fac-select" value={fila.cta}
                onChange={e => actualizarFila(fila.key, 'cta', e.target.value)}>
                <option value="">Seleccionar…</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.descripcion}</option>)}
              </select>
            </div>
            <div className="fac-form-group" style={{ width: 130 }}>
              <label className="fac-label">Monto</label>
              <input className="fac-input fac-mono" placeholder="0" value={fila.monto}
                onChange={e => actualizarFila(fila.key, 'monto', e.target.value.replace(/[^\d.]/g, ''))} />
            </div>
            {fp?.tipo === 'tarjeta' && (
              <div className="fac-form-group" style={{ flex: 1 }}>
                <label className="fac-label">Voucher</label>
                <input className="fac-input" placeholder="Nro. voucher" value={fila.voucher}
                  onChange={e => actualizarFila(fila.key, 'voucher', e.target.value)} />
              </div>
            )}
            {fp?.tipo === 'transferencia' && (
              <div className="fac-form-group" style={{ flex: 1 }}>
                <label className="fac-label">Nro. transferencia</label>
                <input className="fac-input" placeholder="Nro. referencia" value={fila.nro_comprobante}
                  onChange={e => actualizarFila(fila.key, 'nro_comprobante', e.target.value)} />
              </div>
            )}
            <button className="fac-row-action del fac-cobr-del" onClick={() => eliminarFila(fila.key)}>
              <Trash2 size={13} />
            </button>
          </div>
        )
      })}

      <button className="fac-btn-add-cobr" onClick={agregarFila}>
        <Plus size={14} /> Agregar forma de pago
      </button>

      {cobranza.length > 0 && (
        <div className="fac-cobr-resumen">
          <div className="fac-cobr-res-row"><span>Total factura</span><span className="fac-mono">{formatGs(montoTotal)}</span></div>
          <div className="fac-cobr-res-row"><span>Total cobrado</span><span className="fac-mono" style={{ fontWeight: 700 }}>{formatGs(totalCobrado)}</span></div>
          {falta > 0 && (
            <div className="fac-cobr-res-row fac-cobr-falta"><span><AlertTriangle size={12} /> Falta cubrir</span><span className="fac-mono">{formatGs(falta)}</span></div>
          )}
          {vuelto > 0 && (
            <div className="fac-cobr-res-row fac-cobr-vuelto"><span>Vuelto</span><span className="fac-mono">{formatGs(vuelto)}</span></div>
          )}
        </div>
      )}
      {errores.cobranza && <span className="fac-error-msg">{errores.cobranza}</span>}
    </div>
  )
}

function TabCuentaCobrar({ cuotas, setCuotas, montoTotal, fecha, errores }) {
  const preview = useMemo(() => {
    const cant = parseInt(cuotas.cant_cuota) || 0
    const dias = parseInt(cuotas.dias_entre_cuotas) || 0
    if (!cant || !dias || !montoTotal) return []
    const mc = Math.round(montoTotal / cant * 100) / 100
    return Array.from({ length: cant }, (_, i) => {
      const d = new Date(fecha + 'T00:00:00')
      d.setDate(d.getDate() + dias * (i + 1))
      return { nro: i + 1, cant, monto: mc, fecha_venc: d.toISOString().split('T')[0] }
    })
  }, [cuotas.cant_cuota, cuotas.dias_entre_cuotas, montoTotal, fecha])

  return (
    <div className="fac-tab-body">
      <div className="fac-seccion-titulo">Configuración de cuotas</div>
      <div className="fac-form-row">
        <div className="fac-form-group" style={{ flex: 1 }}>
          <label className="fac-label">Cantidad de cuotas *</label>
          <input type="number" min={1}
            className={`fac-input ${errores.cant_cuota ? 'fac-input-error' : ''}`}
            placeholder="Ej: 6" value={cuotas.cant_cuota}
            onChange={e => setCuotas(c => ({ ...c, cant_cuota: e.target.value }))} />
          {errores.cant_cuota && <span className="fac-error-msg">{errores.cant_cuota}</span>}
        </div>
        <div className="fac-form-group" style={{ flex: 1 }}>
          <label className="fac-label">Días entre cuotas *</label>
          <input type="number" min={1}
            className={`fac-input ${errores.dias_cuota ? 'fac-input-error' : ''}`}
            placeholder="Ej: 30" value={cuotas.dias_entre_cuotas}
            onChange={e => setCuotas(c => ({ ...c, dias_entre_cuotas: e.target.value }))} />
          {errores.dias_cuota && <span className="fac-error-msg">{errores.dias_cuota}</span>}
        </div>
      </div>
      {montoTotal > 0 && (
        <div className="fac-cuota-info">
          <Info size={12} /> Total a financiar: <strong>{formatGs(montoTotal)}</strong>
          {preview.length > 0 && <> · Cuota: <strong>{formatGs(preview[0].monto)}</strong></>}
        </div>
      )}
      {preview.length > 0 && (
        <div className="fac-cuotas-preview">
          <div className="fac-cuotas-header"><span>Cuota</span><span>Monto</span><span>Vencimiento</span></div>
          {preview.map(c => (
            <div key={c.nro} className="fac-cuota-row">
              <span className="fac-mono">{c.nro}/{c.cant}</span>
              <span className="fac-mono">{formatGs(c.monto)}</span>
              <span>{formatFecha(c.fecha_venc)}</span>
            </div>
          ))}
        </div>
      )}
      {errores.cuotas && <span className="fac-error-msg">{errores.cuotas}</span>}
    </div>
  )
}

function ModalVerFactura({ id, onClose, onEliminar, showToast, initialModo = 'ver' }) {
  const { data: fac, isLoading } = useFacturaDetalle(id)
  const actualizar = useUpdateFactura()

  const [modo, setModo]           = useState(initialModo)
  const [editForm, setEditForm]   = useState({ fecha: '', persona: null, observacion: '' })

  useEffect(() => {
    if (fac) {
      setEditForm({
        fecha:       fac.fecha,
        persona:     { id: fac.persona, nro_documento: fac.cliente_documento, razon_social: fac.cliente_nombre },
        observacion: fac.observacion || '',
      })
    }
  }, [fac])

  const handleGuardar = async () => {
    try {
      await actualizar.mutateAsync({
        id,
        fecha:       editForm.fecha,
        persona:     editForm.persona?.id,
        observacion: editForm.observacion,
      })
      showToast('Factura actualizada correctamente.', 'success')
      setModo('ver')
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    }
  }

  const impLabel = { '10': 'IVA 10%', '5': 'IVA 5%', 'exenta': 'Exenta' }

  if (isLoading) return <div className="fac-modal-loading">Cargando factura…</div>
  if (!fac) return null

  return (
    <div className="fac-ver-wrap">
      <div className="fac-ver-toolbar">
        {modo === 'ver' ? (
          <>
            <button className="fac-ver-btn edit" onClick={() => setModo('editar')}>
              <Pencil size={13} /> Editar
            </button>
            <button className="fac-ver-btn print" onClick={() => window.open(`/api/facturacion/${fac.id}/pdf/`, '_blank')}>
              <Printer size={13} /> Visualizar / Imprimir
            </button>
            <button className="fac-ver-btn del" onClick={() => onEliminar(fac)}>
              <Trash2 size={13} /> Eliminar
            </button>
          </>
        ) : (
          <>
            <button className="fac-ver-btn save" onClick={handleGuardar} disabled={actualizar.isPending}>
              <Check size={13} /> {actualizar.isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button className="fac-ver-btn cancel" onClick={() => setModo('ver')}>Cancelar</button>
          </>
        )}
      </div>

      <div className="fac-ver-section">
        <div className="fac-ver-grid-3">
          <div className="fac-ver-field">
            <span className="fac-ver-lbl">Comprobante</span>
            <span className="fac-ver-val fac-mono" style={{ fontWeight: 700 }}>{fac.nro_comprobante_formateado}</span>
          </div>
          <div className="fac-ver-field">
            <span className="fac-ver-lbl">Fecha</span>
            {modo === 'editar' ? (
              <input type="date" className="fac-input fac-input-date" value={editForm.fecha}
                onChange={e => setEditForm(f => ({ ...f, fecha: e.target.value }))} />
            ) : (
              <span className="fac-ver-val">{formatFecha(fac.fecha)}</span>
            )}
          </div>
          <div className="fac-ver-field">
            <span className="fac-ver-lbl">Condición</span>
            <span className={`fac-badge ${fac.condicion_vta ? 'contado' : 'credito'}`}>
              {fac.condicion_vta ? 'Contado' : 'Crédito'}
            </span>
          </div>
        </div>

        <div className="fac-ver-field" style={{ marginTop: 10 }}>
          <span className="fac-ver-lbl">Cliente</span>
          {modo === 'editar' ? (
            <div style={{ maxWidth: 420 }}>
              <BuscadorPersona value={editForm.persona} onChange={p => setEditForm(f => ({ ...f, persona: p }))} />
              {editForm.persona && (
                <div className="fac-persona-tag" style={{ marginTop: 4 }}>
                  <CheckCircle size={12} color="#16a34a" />
                  {editForm.persona.nro_documento} — {editForm.persona.razon_social}
                </div>
              )}
            </div>
          ) : (
            <span className="fac-ver-val">{fac.cliente_documento} — {fac.cliente_nombre}</span>
          )}
        </div>

        <div className="fac-ver-field" style={{ marginTop: 10 }}>
          <span className="fac-ver-lbl">Observación</span>
          {modo === 'editar' ? (
            <textarea className="fac-input fac-textarea" rows={2} value={editForm.observacion}
              onChange={e => setEditForm(f => ({ ...f, observacion: e.target.value }))} />
          ) : (
            <span className="fac-ver-val" style={{ color: fac.observacion ? '#374151' : '#9ca3af' }}>
              {fac.observacion || 'Sin observaciones'}
            </span>
          )}
        </div>
      </div>

      <div className="fac-ver-section">
        <div className="fac-ver-section-title">Detalle de ítems</div>
        <div className="fac-det-wrap">
          <table className="fac-det-table">
            <thead>
              <tr>
                <th className="fac-det-th">Producto / Servicio</th>
                <th className="fac-det-th fac-det-th-c" style={{ width: 80 }}>Cant.</th>
                <th className="fac-det-th fac-det-th-r" style={{ width: 120 }}>Monto línea</th>
                <th className="fac-det-th fac-det-th-c" style={{ width: 80 }}>IVA</th>
              </tr>
            </thead>
            <tbody>
              {(fac.detalle || []).map(it => (
                <tr key={it.id} className="fac-det-tr">
                  <td className="fac-det-td">{it.producto_descripcion}</td>
                  <td className="fac-det-td fac-det-td-c fac-mono">{it.cantidad}</td>
                  <td className="fac-det-td fac-det-td-r fac-mono">{Number(it.monto).toLocaleString('es-PY')}</td>
                  <td className="fac-det-td fac-det-td-c">
                    <span className={`fac-badge-imp ${it.impuesto === '10' ? 'blue' : it.impuesto === '5' ? 'amber' : 'gray'}`}>
                      {impLabel[it.impuesto] || it.impuesto}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="fac-ver-totales">
          {Number(fac.grav_5)  > 0 && <><div className="fac-tot-row"><span>Gravada 5%</span><span className="fac-mono">{formatGs(fac.grav_5)}</span></div>
          <div className="fac-tot-row"><span>IVA 5%</span><span className="fac-mono">{formatGs(fac.iva_5)}</span></div></>}
          {Number(fac.grav_10) > 0 && <><div className="fac-tot-row"><span>Gravada 10%</span><span className="fac-mono">{formatGs(fac.grav_10)}</span></div>
          <div className="fac-tot-row"><span>IVA 10%</span><span className="fac-mono">{formatGs(fac.iva_10)}</span></div></>}
          <div className="fac-tot-row fac-tot-total"><span>Total</span><span className="fac-mono">{formatGs(fac.monto_total)}</span></div>
          {Number(fac.vuelto) > 0 && (
            <div className="fac-tot-row" style={{ color: '#16a34a' }}><span>Vuelto</span><span className="fac-mono">{formatGs(fac.vuelto)}</span></div>
          )}
        </div>
      </div>

      {fac.condicion_vta && (fac.cobranza || []).length > 0 && (
        <div className="fac-ver-section">
          <div className="fac-ver-section-title">Cobranza</div>
          {(fac.cobranza || []).map(c => (
            <div key={c.id} className="fac-ver-cobr-row">
              <span className="fac-ver-cobr-fp">{c.forma_pago_descripcion}</span>
              <span className="fac-ver-cobr-cta">{c.cuenta_descripcion}</span>
              <span className="fac-mono" style={{ fontWeight: 600 }}>{formatGs(c.monto)}</span>
              {c.voucher && <span className="fac-ver-cobr-ref">Voucher: {c.voucher}</span>}
              {c.nro_comprobante && <span className="fac-ver-cobr-ref">Ref: {c.nro_comprobante}</span>}
            </div>
          ))}
        </div>
      )}

      {!fac.condicion_vta && (fac.cuotas || []).length > 0 && (
        <div className="fac-ver-section">
          <div className="fac-ver-section-title">Cuotas a cobrar</div>
          <div className="fac-cuotas-preview">
            <div className="fac-cuotas-header">
              <span>Cuota</span><span>Monto</span><span>Vencimiento</span><span>Estado</span>
            </div>
            {(fac.cuotas || []).map(c => (
              <div key={c.id} className="fac-cuota-row" style={{ gridTemplateColumns: '80px 1fr 1fr 80px' }}>
                <span className="fac-mono">{c.nro_cuota}/{c.cant_cuota}</span>
                <span className="fac-mono">{formatGs(c.monto_cuota)}</span>
                <span>{formatFecha(c.fecha_vencimiento)}</span>
                <span>
                  <span className={`fac-badge ${c.estado === 'pagado' ? 'contado' : c.estado === 'vencido' ? 'credito' : ''}`}
                    style={c.estado === 'pendiente' ? { background: '#f3f4f6', color: '#374151' } : {}}>
                    {c.estado}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const FORM_INIT = {
  fecha: hoy(), contado: true,
  persona: null,
  estab: '', expedicion: '', nro_comprobante: '',
  timbrado_validacion: null, observacion: '',
}
const COB_FILA    = () => ({ key: Date.now(), forma_pago: '', cta: '', monto: '', voucher: '', nro_comprobante: '' })
const CUOTAS_INIT = { cant_cuota: '', dias_entre_cuotas: '' }

function ModalFactura({ onClose, onCreado }) {
  const [tab,      setTab]      = useState(0)
  const [form,     setForm]     = useState(FORM_INIT)
  const [detalle,  setDetalle]  = useState([])
  const [cobranza, setCobranza] = useState([COB_FILA()])
  const [cuotas,   setCuotas]   = useState(CUOTAS_INIT)
  const [errores,  setErrores]  = useState({})
  const [guardando, setGuardando] = useState(false)

  const crear   = useCreateFactura()
  const totales = useMemo(() => calcularTotales(detalle), [detalle])

  useEffect(() => { if (tab !== 0) setTab(0) }, [form.contado])

  const TABS = [
    { label: 'Cabecera y Detalle', idx: 0 },
    ...(form.contado  ? [{ label: 'Cobranza',        idx: 1 }] : []),
    ...(!form.contado ? [{ label: 'Cuenta a Cobrar', idx: 2 }] : []),
  ]

  const validar = () => {
    const e = {}
    if (!form.fecha)    e.fecha   = 'Requerida.'
    if (!form.persona)  e.persona = 'Seleccione un cliente.'
    if (!form.estab || !form.expedicion) e.timbrado = 'Complete el punto de emisión.'
    if (!form.timbrado_validacion?.valido) e.timbrado = 'Número de comprobante inválido o no validado.'
    if (detalle.length === 0) e.detalle = 'Agregue al menos un ítem.'
    if (detalle.some(it => !it.precio || Number(it.precio) <= 0))
      e.detalle = 'Todos los ítems deben tener precio mayor a cero.'
    if (form.contado) {
      const totalCobrado = cobranza.reduce((s, r) => s + (Number(r.monto) || 0), 0)
      if (totalCobrado < totales.monto_total)
        e.cobranza = `El total cobrado (${formatGs(totalCobrado)}) es menor al total de la factura.`
      if (cobranza.some(r => !r.forma_pago || !r.cta))
        e.cobranza = 'Complete forma de pago y cuenta en todas las filas.'
    } else {
      if (!cuotas.cant_cuota || parseInt(cuotas.cant_cuota) < 1) e.cant_cuota = 'Requerido.'
      if (!cuotas.dias_entre_cuotas || parseInt(cuotas.dias_entre_cuotas) < 1) e.dias_cuota = 'Requerido.'
    }
    setErrores(e)
    return e
  }

  const handleEmitir = async () => {
    const e = validar()
    if (Object.keys(e).length > 0) {
      if (e.fecha || e.persona || e.timbrado || e.detalle) setTab(0)
      else if (e.cobranza) setTab(1)
      else setTab(2)
      return
    }
    setGuardando(true)
    try {
      const payload = {
        fecha:           form.fecha,
        condicion_vta:   form.contado,
        persona:         form.persona.id,
        timbrado:        form.timbrado_validacion.timbrado_id,
        observacion:     form.observacion,
        nro_comprobante: Number(form.nro_comprobante),
        detalle: detalle.map(it => ({
          prs:      it.prs,
          cantidad: it.cantidad,
          monto:    String(Math.round((Number(it.cantidad) || 0) * (Number(it.precio) || 0) * 100) / 100),
        })),
        cobranza: form.contado ? cobranza.map(r => ({
          forma_pago: Number(r.forma_pago), cta: Number(r.cta),
          monto: r.monto, voucher: r.voucher || '', nro_comprobante: r.nro_comprobante || '',
        })) : [],
        cuotas: !form.contado ? {
          cant_cuota:        parseInt(cuotas.cant_cuota),
          dias_entre_cuotas: parseInt(cuotas.dias_entre_cuotas),
        } : null,
      }
      await crear.mutateAsync(payload)
      onCreado()
    } catch (err) {
      setErrores({ _general: extraerMensajeError(err) })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fac-modal-wrap">
      <div className="fac-tabs">
        {TABS.map(t => (
          <button key={t.idx} className={`fac-tab ${tab === t.idx ? 'active' : ''}`} onClick={() => setTab(t.idx)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="fac-tab-content">
        {tab === 0 && <TabCabecera form={form} setForm={setForm} detalle={detalle} setDetalle={setDetalle} errores={errores} />}
        {tab === 1 && <TabCobranza cobranza={cobranza} setCobranza={setCobranza} montoTotal={totales.monto_total} errores={errores} />}
        {tab === 2 && <TabCuentaCobrar cuotas={cuotas} setCuotas={setCuotas} montoTotal={totales.monto_total} fecha={form.fecha} errores={errores} />}
      </div>

      {errores._general && (
        <div className="fac-error-banner"><AlertTriangle size={14} /> {errores._general}</div>
      )}
      <div className="fac-modal-footer">
        <div className="fac-footer-total">
          Total: <strong className="fac-mono">{formatGs(totales.monto_total)}</strong>
        </div>
        <div className="fac-footer-actions">
          <button className="fac-btn-secundario" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button className="fac-btn-primario"   onClick={handleEmitir} disabled={guardando}>
            {guardando ? 'Emitiendo…' : 'Emitir factura'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FacturacionPage() {
  const [modalAbierto, setModalAbierto]   = useState(false)
  const [facturaViendo, setFacturaViendo] = useState(null)
  const [confirmFac, setConfirmFac]       = useState(null)
  const [filtros, setFiltros]             = useState({ search: '', condicion_vta: '', fecha_desde: '', fecha_hasta: '' })
  const [searchInput, setSearchInput]     = useState('')

  const { toast, showToast } = useToast()
  const { data, isLoading }  = useFacturas(filtros)
  const eliminarFactura      = useDeleteFactura()
  const facturas = data?.results ?? data ?? []

  const handleSearch = (e) => { e.preventDefault(); setFiltros(f => ({ ...f, search: searchInput })) }

  const handleEliminar = (fac) => setConfirmFac(fac)

  const handleEliminarConfirmado = async () => {
    try {
      await eliminarFactura.mutateAsync(confirmFac.id)
      setConfirmFac(null)
      setFacturaViendo(null)
      showToast('Factura eliminada.', 'success')
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
      setConfirmFac(null)
    }
  }

  return (
    <>
      <style>{`
        .fac-page { display: flex; flex-direction: column; height: 100%; }
        .fac-header { display: flex; align-items: center; padding: 20px 24px 0; }
        .fac-header-left { display: flex; align-items: center; gap: 12px; }
        .fac-header-icon { width: 36px; height: 36px; background: #dbeafe; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .fac-header-title { font-size: 20px; font-weight: 600; color: #111827; }
        .fac-header-sub   { font-size: 13px; color: #9ca3af; }
        .fac-toolbar { display: flex; align-items: center; gap: 10px; padding: 14px 24px 0; flex-wrap: wrap; }
        .fac-search-form { display: flex; gap: 8px; flex: 1; max-width: 360px; }
        .fac-search-wrap { flex: 1; display: flex; align-items: center; gap: 8px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 7px 12px; background: #fff; }
        .fac-search-main { flex: 1; border: none; outline: none; font-size: 13px; font-family: 'DM Sans', sans-serif; background: transparent; color: #374151; }
        .fac-search-main::placeholder { color: #9ca3af; }
        .fac-btn-buscar { display: flex; align-items: center; gap: 4px; padding: 8px 14px; border-radius: 8px; border: none; background: #1a3a5c; color: #fff; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer; }
        .fac-btn-buscar:hover { background: #15304d; }
        .fac-filtro-select, .fac-filtro-date { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; background: #fff; color: #374151; }
        .fac-btn-nuevo { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; border: none; background: #1a3a5c; color: #fff; margin-left: auto; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer; white-space: nowrap; }
        .fac-btn-nuevo:hover { background: #15304d; }
        .fac-body { flex: 1; overflow: hidden; padding: 14px 24px 24px; }
        .fac-tabla-wrap { height: 100%; border: 1px solid #e8edf2; border-radius: 10px; background: #fff; overflow-y: auto; }
        .fac-tabla { width: 100%; border-collapse: collapse; }
        .fac-th { text-align: left; padding: 10px 14px; font-size: 11.5px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .04em; background: #f8fafc; border-bottom: 1px solid #e8edf2; position: sticky; top: 0; }
        .fac-td { padding: 12px 14px; font-size: 13px; color: #374151; vertical-align: middle; border-bottom: 1px solid #f3f4f6; }
        .fac-tr:last-child .fac-td { border-bottom: none; }
        .fac-tr:hover { background: #f9fafb; }
        .fac-tr-clickable { cursor: pointer; }
        .fac-tr-clickable:hover { background: #eff6ff; }
        .fac-td-acciones { display: flex; gap: 4px; justify-content: flex-end; }
        .fac-badge { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 11.5px; font-weight: 500; }
        .fac-badge.contado { background: #dcfce7; color: #166534; }
        .fac-badge.credito  { background: #fef3c7; color: #92400e; }
        .fac-row-btn { width: 28px; height: 28px; border-radius: 6px; border: 1px solid #e5e7eb; background: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #6b7280; }
        .fac-row-btn:hover { background: #f3f4f6; }
        .fac-row-btn.danger { border-color: #fecaca; color: #dc2626; }
        .fac-row-btn.danger:hover { background: #fef2f2; }
        .fac-empty   { text-align: center; color: #9ca3af; padding: 48px; font-size: 13.5px; }
        .fac-loading { text-align: center; color: #9ca3af; padding: 48px; font-size: 13px; }
        .fac-mono { font-family: 'Courier New', monospace; }
        .fac-modal-wrap { display: flex; flex-direction: column; height: 100%; }
        .fac-tabs { display: flex; border-bottom: 1px solid #e8edf2; flex-shrink: 0; }
        .fac-tab { padding: 11px 20px; border: none; background: none; font-size: 13.5px; font-family: 'DM Sans', sans-serif; font-weight: 500; color: #6b7280; cursor: pointer; border-bottom: 2px solid transparent; transition: color 0.12s, border-color 0.12s; white-space: nowrap; }
        .fac-tab:hover  { color: #1a3a5c; }
        .fac-tab.active { color: #1a3a5c; border-bottom-color: #1a3a5c; }
        .fac-tab-content { flex: 1; overflow-y: auto; }
        .fac-tab-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        .fac-form-row { display: flex; gap: 14px; align-items: flex-start; flex-wrap: wrap; }
        .fac-form-group { display: flex; flex-direction: column; gap: 5px; }
        .fac-label { font-size: 12.5px; font-weight: 500; color: #374151; }
        .fac-input { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; background: #fff; color: #374151; width: 100%; box-sizing: border-box; }
        .fac-input:focus { border-color: #1a3a5c; }
        .fac-input-error { border-color: #fca5a5 !important; }
        .fac-input-date { width: 148px; }
        .fac-input-sm { padding: 5px 7px; font-size: 12.5px; }
        .fac-select { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; background: #fff; color: #374151; width: 100%; }
        .fac-select:focus { border-color: #1a3a5c; }
        .fac-textarea { resize: vertical; min-height: 56px; }
        .fac-error-msg { font-size: 11.5px; color: #dc2626; }
        .fac-check-label { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }
        .fac-checkbox { width: 16px; height: 16px; accent-color: #1a3a5c; cursor: pointer; flex-shrink: 0; }
        .fac-check-text { font-size: 13.5px; font-weight: 500; color: #111827; }
        .fac-cond-hint { font-size: 11.5px; color: #6b7280; }
        .fac-autocomplete { position: relative; }
        .fac-dropdown { position: absolute; z-index: 50; top: calc(100% + 4px); left: 0; right: 0; background: #fff; border: 1px solid #e8edf2; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); max-height: 240px; overflow-y: auto; }
        .fac-dropdown-item { padding: 9px 12px; cursor: pointer; transition: background 0.1s; }
        .fac-dropdown-item:hover, .fac-dropdown-item.highlighted { background: #eff6ff; }
        .fac-dropdown-nombre { font-size: 13px; font-weight: 500; color: #111827; }
        .fac-dropdown-doc { font-size: 12px; color: #6b7280; margin-top: 1px; }
        .fac-persona-tag { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #166534; background: #dcfce7; border-radius: 6px; padding: 4px 8px; }
        .fac-timbrado-row { display: flex; align-items: center; gap: 4px; }
        .fac-timbrado-pt  { width: 64px; text-align: center; flex-shrink: 0; }
        .fac-timbrado-sep { color: #9ca3af; font-weight: 600; padding: 0 2px; flex-shrink: 0; }
        .fac-timbrado-nro { width: 100px; text-align: center; flex-shrink: 0; }
        .fac-timbrado-info { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e8edf2; border-radius: 7px; padding: 6px 12px; flex-wrap: wrap; }
        .fac-tim-lbl { font-size: 11.5px; color: #6b7280; font-weight: 500; }
        .fac-tim-val { font-size: 12.5px; color: #111827; font-weight: 600; }
        .fac-tim-sep { color: #d1d5db; }
        .fac-validacion { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 5px 10px; border-radius: 6px; }
        .fac-validacion.ok    { background: #dcfce7; color: #166534; }
        .fac-validacion.error { background: #fee2e2; color: #991b1b; }
        .fac-seccion-titulo { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; padding-bottom: 4px; border-bottom: 1px solid #f3f4f6; }
        .fac-prod-search-wrap { display: flex; align-items: center; gap: 8px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 7px 12px; background: #fff; }
        .fac-prod-search-input { flex: 1; border: none; outline: none; font-size: 13px; font-family: 'DM Sans', sans-serif; background: transparent; color: #374151; }
        .fac-prod-search-input::placeholder { color: #9ca3af; }
        .fac-det-wrap { border: 1px solid #e8edf2; border-radius: 8px; overflow: auto; }
        .fac-det-table { width: 100%; border-collapse: collapse; }
        .fac-det-th { text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .04em; background: #f8fafc; border-bottom: 1px solid #e8edf2; }
        .fac-det-th-c { text-align: center; }
        .fac-det-th-r { text-align: right; }
        .fac-det-td { padding: 7px 10px; font-size: 13px; color: #374151; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
        .fac-det-td-c { text-align: center; }
        .fac-det-td-r { text-align: right; }
        .fac-det-tr:last-child .fac-det-td { border-bottom: none; }
        .fac-det-tr.editing { background: #fafbff; }
        .fac-det-input { width: 80px; display: inline-block; }
        .fac-badge-imp { display: inline-block; padding: 1px 7px; border-radius: 20px; font-size: 11px; font-weight: 500; }
        .fac-badge-imp.blue  { background: #dbeafe; color: #1e40af; }
        .fac-badge-imp.amber { background: #fef3c7; color: #92400e; }
        .fac-badge-imp.gray  { background: #f3f4f6; color: #374151; }
        .fac-det-acciones { display: flex; gap: 4px; justify-content: flex-end; }
        .fac-row-action { width: 26px; height: 26px; border-radius: 6px; border: 1px solid #e5e7eb; background: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.1s; }
        .fac-row-action.edit    { color: #1a3a5c; border-color: #bfdbfe; }
        .fac-row-action.edit:hover    { background: #eff6ff; }
        .fac-row-action.confirm { color: #16a34a; border-color: #bbf7d0; }
        .fac-row-action.confirm:hover { background: #dcfce7; }
        .fac-row-action.del     { color: #dc2626; border-color: #fecaca; }
        .fac-row-action.del:hover     { background: #fef2f2; }
        .fac-totales { background: #f8fafc; border: 1px solid #e8edf2; border-radius: 8px; padding: 12px 14px; }
        .fac-tot-grid { display: flex; flex-direction: column; gap: 5px; }
        .fac-tot-row { display: flex; justify-content: space-between; font-size: 12.5px; color: #374151; }
        .fac-tot-total { font-size: 14px; font-weight: 700; color: #111827; border-top: 1px solid #e8edf2; padding-top: 6px; margin-top: 2px; }
        .fac-cobr-fila { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; padding: 12px; background: #f8fafc; border: 1px solid #e8edf2; border-radius: 8px; }
        .fac-cobr-del { align-self: flex-end; }
        .fac-btn-add-cobr { display: flex; align-items: center; gap: 5px; padding: 8px 14px; border-radius: 8px; border: 1px dashed #bfdbfe; background: #eff6ff; color: #1a3a5c; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer; }
        .fac-btn-add-cobr:hover { background: #dbeafe; }
        .fac-cobr-resumen { background: #f8fafc; border: 1px solid #e8edf2; border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
        .fac-cobr-res-row { display: flex; justify-content: space-between; font-size: 13px; color: #374151; }
        .fac-cobr-falta  { color: #dc2626; font-weight: 600; }
        .fac-cobr-vuelto { color: #16a34a; font-weight: 600; }
        .fac-cuota-info { display: flex; align-items: center; gap: 5px; font-size: 12.5px; color: #374151; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 8px 12px; }
        .fac-cuotas-preview { border: 1px solid #e8edf2; border-radius: 8px; overflow: hidden; }
        .fac-cuotas-header { display: grid; grid-template-columns: 80px 1fr 1fr; gap: 8px; padding: 8px 12px; background: #f8fafc; font-size: 11.5px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #e8edf2; }
        .fac-cuota-row { display: grid; grid-template-columns: 80px 1fr 1fr; gap: 8px; padding: 9px 12px; font-size: 13px; color: #374151; border-bottom: 1px solid #f3f4f6; }
        .fac-cuota-row:last-child { border-bottom: none; }
        .fac-modal-footer { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-top: 1px solid #e8edf2; flex-shrink: 0; background: #f8fafc; }
        .fac-footer-total { font-size: 14px; color: #374151; }
        .fac-footer-actions { display: flex; gap: 10px; }
        .fac-error-banner { display: flex; align-items: center; gap: 8px; background: #fee2e2; border-top: 1px solid #fecaca; padding: 10px 20px; font-size: 13px; color: #991b1b; flex-shrink: 0; }
        .fac-btn-primario { display: inline-flex; align-items: center; gap: 5px; padding: 8px 20px; border-radius: 8px; border: none; background: #1a3a5c; color: #fff; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer; }
        .fac-btn-primario:hover:not(:disabled) { background: #15304d; }
        .fac-btn-primario:disabled { background: #9ca3af; cursor: default; }
        .fac-btn-secundario { padding: 8px 16px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; color: #374151; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer; }
        .fac-btn-secundario:hover { background: #f9fafb; }
        .fac-modal-loading { padding: 48px; text-align: center; color: #9ca3af; font-size: 13px; }
        .fac-ver-wrap { display: flex; flex-direction: column; gap: 0; overflow-y: auto; max-height: 72vh; }
        .fac-ver-toolbar { display: flex; gap: 8px; padding: 14px 20px; border-bottom: 1px solid #e8edf2; flex-shrink: 0; background: #f8fafc; flex-wrap: wrap; }
        .fac-ver-btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 14px; border-radius: 8px; font-size: 12.5px; font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer; border: 1px solid #e5e7eb; background: #fff; transition: background 0.1s; }
        .fac-ver-btn.edit   { color: #1a3a5c; border-color: #bfdbfe; }
        .fac-ver-btn.edit:hover   { background: #eff6ff; }
        .fac-ver-btn.print  { color: #374151; }
        .fac-ver-btn.print:hover  { background: #f9fafb; }
        .fac-ver-btn.del    { color: #dc2626; border-color: #fecaca; margin-left: auto; }
        .fac-ver-btn.del:hover    { background: #fef2f2; }
        .fac-ver-btn.save   { color: #fff; background: #1a3a5c; border-color: #1a3a5c; }
        .fac-ver-btn.save:hover:not(:disabled) { background: #15304d; }
        .fac-ver-btn.save:disabled { background: #9ca3af; border-color: #9ca3af; cursor: default; }
        .fac-ver-btn.cancel { color: #374151; }
        .fac-ver-btn.cancel:hover { background: #f9fafb; }
        .fac-ver-section { padding: 16px 20px; border-bottom: 1px solid #f3f4f6; }
        .fac-ver-section:last-child { border-bottom: none; }
        .fac-ver-section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; margin-bottom: 10px; }
        .fac-ver-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .fac-ver-field { display: flex; flex-direction: column; gap: 4px; }
        .fac-ver-lbl { font-size: 11.5px; font-weight: 500; color: #6b7280; text-transform: uppercase; letter-spacing: .04em; }
        .fac-ver-val { font-size: 13.5px; color: #111827; }
        .fac-ver-totales { margin-top: 10px; background: #f8fafc; border: 1px solid #e8edf2; border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 5px; }
        .fac-ver-cobr-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f3f4f6; flex-wrap: wrap; }
        .fac-ver-cobr-row:last-child { border-bottom: none; }
        .fac-ver-cobr-fp  { font-size: 13px; font-weight: 500; color: #111827; }
        .fac-ver-cobr-cta { font-size: 12.5px; color: #6b7280; }
        .fac-ver-cobr-ref { font-size: 11.5px; color: #6b7280; background: #f3f4f6; border-radius: 4px; padding: 1px 6px; }
      `}</style>

      <div className="fac-page">
        <div className="fac-header">
          <div className="fac-header-left">
            <div className="fac-header-icon"><FileText size={18} color="#1a3a5c" /></div>
            <div>
              <div className="fac-header-title">Facturación</div>
              <div className="fac-header-sub">Emisión y gestión de facturas</div>
            </div>
          </div>
        </div>

        <div className="fac-toolbar">
          <form className="fac-search-form" onSubmit={handleSearch}>
            <div className="fac-search-wrap">
              <Search size={13} color="#9ca3af" />
              <input className="fac-search-main" placeholder="Buscar por cliente o comprobante…"
                value={searchInput} onChange={e => setSearchInput(e.target.value)} />
            </div>
            <button type="submit" className="fac-btn-buscar"><Search size={13} /> Buscar</button>
          </form>

          <select className="fac-filtro-select" value={filtros.condicion_vta}
            onChange={e => setFiltros(f => ({ ...f, condicion_vta: e.target.value }))}>
            <option value="">Todas</option>
            <option value="true">Contado</option>
            <option value="false">Crédito</option>
          </select>

          <input type="date" className="fac-filtro-date" value={filtros.fecha_desde} title="Desde"
            onChange={e => setFiltros(f => ({ ...f, fecha_desde: e.target.value }))} />
          <input type="date" className="fac-filtro-date" value={filtros.fecha_hasta} title="Hasta"
            onChange={e => setFiltros(f => ({ ...f, fecha_hasta: e.target.value }))} />

          <button className="fac-btn-nuevo" onClick={() => setModalAbierto(true)}>
            <Plus size={15} /> Nueva factura
          </button>
        </div>

        <div className="fac-body">
          <div className="fac-tabla-wrap">
            {isLoading ? (
              <div className="fac-loading">Cargando facturas…</div>
            ) : facturas.length === 0 ? (
              <div className="fac-empty">No hay facturas registradas.</div>
            ) : (
              <table className="fac-tabla">
                <thead>
                  <tr>
                    <th className="fac-th">Comprobante</th>
                    <th className="fac-th">Fecha</th>
                    <th className="fac-th">Cliente</th>
                    <th className="fac-th">Documento</th>
                    <th className="fac-th">Condición</th>
                    <th className="fac-th" style={{ textAlign: 'right' }}>Total</th>
                    <th className="fac-th" style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.map(f => (
                    <tr
                      key={f.id}
                      className="fac-tr fac-tr-clickable"
                      onClick={() => setFacturaViendo({ id: f.id, modo: 'ver' })}
                    >
                      <td className="fac-td fac-mono" style={{ fontWeight: 600 }}>{f.nro_comprobante_formateado}</td>
                      <td className="fac-td">{formatFecha(f.fecha)}</td>
                      <td className="fac-td">{f.cliente_nombre}</td>
                      <td className="fac-td fac-mono" style={{ color: '#6b7280' }}>{f.cliente_documento}</td>
                      <td className="fac-td">
                        <span className={`fac-badge ${f.condicion_vta ? 'contado' : 'credito'}`}>
                          {f.condicion_vta ? 'Contado' : 'Crédito'}
                        </span>
                      </td>
                      <td className="fac-td fac-mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatGs(f.monto_total)}
                      </td>
                      <td className="fac-td" onClick={e => e.stopPropagation()}>
                        <div className="fac-td-acciones">
                          <button className="fac-row-btn" title="Editar"
                            onClick={() => setFacturaViendo({ id: f.id, modo: 'editar' })}>
                            <Pencil size={12} />
                          </button>
                          <button className="fac-row-btn" title="Visualizar / Imprimir"
                            onClick={() => window.open(`/api/facturacion/${f.id}/pdf/`, '_blank')}>
                            <Printer size={12} />
                          </button>
                          <button className="fac-row-btn danger" title="Eliminar"
                            onClick={() => handleEliminar(f)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {modalAbierto && (
        <Modal isOpen={modalAbierto} onClose={() => setModalAbierto(false)}
          title="Nueva factura" subtitle="Complete los datos del comprobante" size="xl">
          <ModalFactura
            onClose={() => setModalAbierto(false)}
            onCreado={() => { setModalAbierto(false); showToast('Factura emitida correctamente.', 'success') }}
          />
        </Modal>
      )}

      {facturaViendo && (
        <Modal isOpen={!!facturaViendo} onClose={() => setFacturaViendo(null)}
          title="Detalle de factura" subtitle="Vista y edición del comprobante" size="xl">
          <ModalVerFactura
            id={facturaViendo.id}
            initialModo={facturaViendo.modo}
            onClose={() => setFacturaViendo(null)}
            onEliminar={handleEliminar}
            showToast={showToast}
          />
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!confirmFac}
        title="Eliminar factura"
        description={`¿Eliminar la factura ${confirmFac?.nro_comprobante_formateado}? Esta acción no se puede deshacer si no tiene movimientos de caja vinculados.`}
        onConfirm={handleEliminarConfirmado}
        onCancel={() => setConfirmFac(null)}
        loading={eliminarFactura.isPending}
      />

      <Toast toast={toast} />
    </>
  )
}
