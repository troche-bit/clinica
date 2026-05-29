import { useState, useMemo, useEffect, useRef } from 'react'
import {
  FileText, Plus, Search, Trash2, CheckCircle, XCircle, X,
  AlertTriangle, Info, Pencil, Check, Printer, FileDown, Ban,
} from 'lucide-react'
import apiClient from '../../api/client'
import Modal from '../../components/ui/Modal'
import Toast from '../../components/ui/Toast'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../hooks/useToast'
import {
  useFacturas, useFacturaDetalle, useCreateFactura, useUpdateFactura, useDeleteFactura,
  useAnularFactura,
  useValidarTimbrado, useSiguienteNumero,
  useFormaPago, useBuscarPersonas, useBuscarProductos,
} from '../../hooks/facturacion/useFacturacion'
import { useCuentasMcb } from '../../hooks/finanzas/useCuentasMcb'
import { extraerMensajeError } from '../../utils/errores'
import { useAtajosTeclado } from '../../hooks/useAtajosTeclado'

function hoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

function TabItemsMasterDetail({ detalle, setDetalle, errores, impLabel }) {
  const ITEM_INIT_LOCAL = { prs: null, descripcion: '', impuesto: '', cantidad: '1', precio: '' }
  const [itemForm,   setItemForm]   = useState(ITEM_INIT_LOCAL)
  const [editingKey, setEditingKey] = useState(null)

  const handleSeleccionarProd = (prod) => {
    setItemForm({ prs: prod.id, descripcion: prod.descripcion, impuesto: prod.impuesto, cantidad: '1', precio: '' })
    setEditingKey(null)
  }
  const handleEditarItem = (it) => {
    setItemForm({ prs: it.prs, descripcion: it.descripcion, impuesto: it.impuesto, cantidad: it.cantidad, precio: it.precio })
    setEditingKey(it.key)
  }
  const handleConfirmarItem = () => {
    if (!itemForm.prs || !itemForm.precio || Number(itemForm.precio) <= 0) return
    if (editingKey) {
      setDetalle(prev => prev.map(it => it.key === editingKey ? { ...it, ...itemForm } : it))
      setEditingKey(null)
    } else {
      setDetalle(prev => [...prev, { key: Date.now(), ...itemForm }])
    }
    setItemForm(ITEM_INIT_LOCAL)
  }
  const eliminarItem = (key) => {
    if (editingKey === key) { setEditingKey(null); setItemForm(ITEM_INIT_LOCAL) }
    setDetalle(prev => prev.filter(it => it.key !== key))
  }

  return (
    <div className="fac-det-master">
      <div className="fac-det-panel-izq">
        <BuscadorProducto onSeleccionar={handleSeleccionarProd} />
        <div className="fac-det-item-form">
          <div className="fac-det-prod-info">
            {itemForm.prs ? (
              <>
                <div className="fac-det-item-nombre">{itemForm.descripcion}</div>
                <span className={`fac-badge-imp ${itemForm.impuesto === '10' ? 'blue' : itemForm.impuesto === '5' ? 'amber' : 'gray'}`}>
                  {impLabel[itemForm.impuesto] || itemForm.impuesto}
                </span>
              </>
            ) : (
              <div className="fac-det-prod-hint">Seleccioná un producto para continuar</div>
            )}
          </div>
          <div className="fac-form-group">
            <label className="fac-label">Cantidad</label>
            <input type="number" min="1" className="fac-input fac-mono"
              disabled={!itemForm.prs}
              value={itemForm.cantidad}
              onChange={e => setItemForm(f => ({ ...f, cantidad: e.target.value.replace(/[^\d]/g, '') || '1' }))} />
          </div>
          <div className="fac-form-group">
            <label className="fac-label">Precio unitario</label>
            <input className="fac-input fac-mono" placeholder="0"
              disabled={!itemForm.prs}
              value={itemForm.precio}
              onChange={e => setItemForm(f => ({ ...f, precio: e.target.value.replace(/[^\d.]/g, '') }))} />
          </div>
          {itemForm.prs && Number(itemForm.precio) > 0 && (
            <div className="fac-det-subtotal">
              Subtotal: <strong className="fac-mono">
                {(Math.round((Number(itemForm.cantidad) || 0) * Number(itemForm.precio) * 100) / 100).toLocaleString('es-PY')}
              </strong>
            </div>
          )}
          <div className="fac-det-form-btns">
            <button className="fac-btn-secundario" style={{ flex: 1 }}
              disabled={!itemForm.prs}
              onClick={() => { setItemForm(ITEM_INIT_LOCAL); setEditingKey(null) }}>
              Cancelar
            </button>
            <button className="fac-btn-primario" style={{ flex: 1 }}
              disabled={!itemForm.prs || !itemForm.precio || Number(itemForm.precio) <= 0}
              onClick={handleConfirmarItem}>
              {editingKey ? 'Actualizar' : 'Agregar →'}
            </button>
          </div>
        </div>
      </div>
      <div className="fac-det-panel-der">
        {detalle.length === 0 ? (
          <div className="fac-det-vacio">Seleccioná un producto o servicio desde el panel izquierdo</div>
        ) : (
          <div className="fac-det-wrap">
            <table className="fac-det-table">
              <thead>
                <tr>
                  <th className="fac-det-th">Producto / Servicio</th>
                  <th className="fac-det-th fac-det-th-c" style={{ width: 52 }}>Cant.</th>
                  <th className="fac-det-th fac-det-th-r" style={{ width: 96 }}>Precio</th>
                  <th className="fac-det-th fac-det-th-c" style={{ width: 72 }}>IVA</th>
                  <th className="fac-det-th fac-det-th-r" style={{ width: 96 }}>Subtotal</th>
                  <th className="fac-det-th" style={{ width: 52 }}></th>
                </tr>
              </thead>
              <tbody>
                {detalle.map(it => {
                  const subtotal = Math.round((Number(it.cantidad) || 0) * (Number(it.precio) || 0) * 100) / 100
                  const isEditing = editingKey === it.key
                  return (
                    <tr key={it.key} className={`fac-det-tr ${isEditing ? 'fac-det-tr-editing' : ''}`}>
                      <td className="fac-det-td">{it.descripcion}</td>
                      <td className="fac-det-td fac-det-td-c fac-mono">{it.cantidad}</td>
                      <td className="fac-det-td fac-mono fac-det-td-r">
                        {Number(it.precio) > 0 ? Number(it.precio).toLocaleString('es-PY') : '—'}
                      </td>
                      <td className="fac-det-td fac-det-td-c">
                        <span className={`fac-badge-imp ${it.impuesto === '10' ? 'blue' : it.impuesto === '5' ? 'amber' : 'gray'}`}>
                          {impLabel[it.impuesto] || it.impuesto}
                        </span>
                      </td>
                      <td className="fac-det-td fac-mono fac-det-td-r">
                        {subtotal > 0 ? subtotal.toLocaleString('es-PY') : <span style={{ color: '#9ca3af' }}>—</span>}
                      </td>
                      <td className="fac-det-td">
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className={`fac-row-action ${isEditing ? 'confirm' : 'edit'}`} title="Editar"
                            onClick={() => handleEditarItem(it)}>
                            <Pencil size={11} />
                          </button>
                          <button className="fac-row-action del" title="Quitar"
                            onClick={() => eliminarItem(it.key)}>
                            <X size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
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

  const ITEM_INIT = { prs: null, descripcion: '', impuesto: '', cantidad: '1', precio: '' }
  const [itemForm,   setItemForm]   = useState(ITEM_INIT)
  const [editingKey, setEditingKey] = useState(null)

  const handleSeleccionarProd = (prod) => {
    setItemForm({ prs: prod.id, descripcion: prod.descripcion, impuesto: prod.impuesto, cantidad: '1', precio: '' })
    setEditingKey(null)
  }

  const handleEditarItem = (it) => {
    setItemForm({ prs: it.prs, descripcion: it.descripcion, impuesto: it.impuesto, cantidad: it.cantidad, precio: it.precio })
    setEditingKey(it.key)
  }

  const handleConfirmarItem = () => {
    if (!itemForm.prs || !itemForm.precio || Number(itemForm.precio) <= 0) return
    if (editingKey) {
      setDetalle(prev => prev.map(it => it.key === editingKey ? { ...it, ...itemForm } : it))
      setEditingKey(null)
    } else {
      setDetalle(prev => [...prev, { key: Date.now(), ...itemForm }])
    }
    setItemForm(ITEM_INIT)
  }

  const eliminarItem = (key) => {
    if (editingKey === key) { setEditingKey(null); setItemForm(ITEM_INIT) }
    setDetalle(prev => prev.filter(it => it.key !== key))
  }

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

      <div className="fac-det-master">
        <div className="fac-det-panel-izq">
          <BuscadorProducto onSeleccionar={handleSeleccionarProd} />
          <div className="fac-det-item-form">
            <div className="fac-det-prod-info">
              {itemForm.prs ? (
                <>
                  <div className="fac-det-item-nombre">{itemForm.descripcion}</div>
                  <span className={`fac-badge-imp ${itemForm.impuesto === '10' ? 'blue' : itemForm.impuesto === '5' ? 'amber' : 'gray'}`}>
                    {impLabel[itemForm.impuesto] || itemForm.impuesto}
                  </span>
                </>
              ) : (
                <div className="fac-det-prod-hint">Seleccioná un producto para continuar</div>
              )}
            </div>
            <div className="fac-form-group">
              <label className="fac-label">Cantidad</label>
              <input
                type="number" min="1"
                className="fac-input fac-mono"
                disabled={!itemForm.prs}
                value={itemForm.cantidad}
                onChange={e => setItemForm(f => ({ ...f, cantidad: e.target.value.replace(/[^\d]/g, '') || '1' }))}
              />
            </div>
            <div className="fac-form-group">
              <label className="fac-label">Precio unitario</label>
              <input
                className="fac-input fac-mono"
                placeholder="0"
                disabled={!itemForm.prs}
                value={itemForm.precio}
                onChange={e => setItemForm(f => ({ ...f, precio: e.target.value.replace(/[^\d.]/g, '') }))}
              />
            </div>
            {itemForm.prs && Number(itemForm.precio) > 0 && (
              <div className="fac-det-subtotal">
                Subtotal: <strong className="fac-mono">
                  {(Math.round((Number(itemForm.cantidad) || 0) * Number(itemForm.precio) * 100) / 100).toLocaleString('es-PY')}
                </strong>
              </div>
            )}
            <div className="fac-det-form-btns">
              <button className="fac-btn-secundario" style={{ flex: 1 }}
                disabled={!itemForm.prs}
                onClick={() => { setItemForm(ITEM_INIT); setEditingKey(null) }}>
                Cancelar
              </button>
              <button className="fac-btn-primario" style={{ flex: 1 }}
                disabled={!itemForm.prs || !itemForm.precio || Number(itemForm.precio) <= 0}
                onClick={handleConfirmarItem}>
                {editingKey ? 'Actualizar' : 'Agregar →'}
              </button>
            </div>
          </div>
        </div>

        <div className="fac-det-panel-der">
          {detalle.length === 0 ? (
            <div className="fac-det-vacio">
              Seleccioná un producto o servicio desde el panel izquierdo para agregarlo a la factura
            </div>
          ) : (
            <div className="fac-det-wrap">
              <table className="fac-det-table">
                <thead>
                  <tr>
                    <th className="fac-det-th">Producto / Servicio</th>
                    <th className="fac-det-th fac-det-th-c" style={{ width: 52 }}>Cant.</th>
                    <th className="fac-det-th fac-det-th-r" style={{ width: 96 }}>Precio</th>
                    <th className="fac-det-th fac-det-th-c" style={{ width: 72 }}>IVA</th>
                    <th className="fac-det-th fac-det-th-r" style={{ width: 96 }}>Subtotal</th>
                    <th className="fac-det-th" style={{ width: 52 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.map(it => {
                    const subtotal = Math.round((Number(it.cantidad) || 0) * (Number(it.precio) || 0) * 100) / 100
                    const isEditing = editingKey === it.key
                    return (
                      <tr key={it.key} className={`fac-det-tr ${isEditing ? 'fac-det-tr-editing' : ''}`}>
                        <td className="fac-det-td">{it.descripcion}</td>
                        <td className="fac-det-td fac-det-td-c fac-mono">{it.cantidad}</td>
                        <td className="fac-det-td fac-mono fac-det-td-r">
                          {Number(it.precio) > 0 ? Number(it.precio).toLocaleString('es-PY') : '—'}
                        </td>
                        <td className="fac-det-td fac-det-td-c">
                          <span className={`fac-badge-imp ${it.impuesto === '10' ? 'blue' : it.impuesto === '5' ? 'amber' : 'gray'}`}>
                            {impLabel[it.impuesto] || it.impuesto}
                          </span>
                        </td>
                        <td className="fac-det-td fac-mono fac-det-td-r">
                          {subtotal > 0 ? subtotal.toLocaleString('es-PY') : <span style={{ color: '#9ca3af' }}>—</span>}
                        </td>
                        <td className="fac-det-td">
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button className={`fac-row-action ${isEditing ? 'confirm' : 'edit'}`} title="Editar"
                              onClick={() => handleEditarItem(it)}>
                              <Pencil size={11} />
                            </button>
                            <button className="fac-row-action del" title="Quitar"
                              onClick={() => eliminarItem(it.key)}>
                              <X size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {errores.detalle && <span className="fac-error-msg">{errores.detalle}</span>}

      {detalle.length > 0 && (
        <div className="fac-totales">
          <div className="fac-tot-grid">
            {totales.grav_10 > 0 && <>
              <div className="fac-tot-row"><span>Gravada 10%</span><span className="fac-mono">{formatGs(totales.grav_10)}</span></div>
              <div className="fac-tot-row"><span>IVA 10%</span><span className="fac-mono">{formatGs(totales.iva_10)}</span></div>
            </>}
            {totales.grav_5 > 0 && <>
              <div className="fac-tot-row"><span>Gravada 5%</span><span className="fac-mono">{formatGs(totales.grav_5)}</span></div>
              <div className="fac-tot-row"><span>IVA 5%</span><span className="fac-mono">{formatGs(totales.iva_5)}</span></div>
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
          {totalCobrado > 0 && (
            falta > 0
              ? <div className="fac-cobr-estado fac-cobr-estado--rojo"><AlertTriangle size={14} /> Faltan {formatGs(falta)} por cobrar</div>
              : vuelto > 0
                ? <div className="fac-cobr-estado fac-cobr-estado--azul"><CheckCircle size={14} /> Vuelto {formatGs(vuelto)}</div>
                : <div className="fac-cobr-estado fac-cobr-estado--verde"><CheckCircle size={14} /> Cobrado completo</div>
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
          <div className="fac-cuotas-header"><span>Cuota</span><span>Fecha vencimiento</span><span style={{ textAlign: 'right' }}>Monto</span></div>
          {preview.map(c => (
            <div key={c.nro} className="fac-cuota-row">
              <span className="fac-mono">{c.nro}/{c.cant}</span>
              <span>{formatFecha(c.fecha_venc)}</span>
              <span className="fac-mono" style={{ textAlign: 'right' }}>{formatGs(c.monto)}</span>
            </div>
          ))}
        </div>
      )}
      {errores.cuotas && <span className="fac-error-msg">{errores.cuotas}</span>}
    </div>
  )
}

function ModalVerFactura({ id, onClose, onEliminar, onAnular, showToast, initialModo = 'ver', onDirtyChange }) {
  const { data: fac, isLoading } = useFacturaDetalle(id)
  const actualizar      = useUpdateFactura()
  const validarTimbrado = useValidarTimbrado()

  const [modo, setModo]                         = useState(initialModo)
  const [tabVer, setTabVer]                     = useState(0)
  const [confirmDescartar, setConfirmDescartar] = useState(false)

  // Full-edit state
  const [editCondicion,     setEditCondicion]     = useState(null)
  const [editForm,          setEditForm]          = useState({ fecha: '', persona: null, observacion: '', nro_comprobante: '', estab: '', expedicion: '' })
  const [editDetalle,       setEditDetalle]       = useState([])
  const [editCobranza,      setEditCobranza]      = useState([])
  const [editCuotas,        setEditCuotas]        = useState({ cant_cuota: '', dias_entre_cuotas: '' })
  const [editTab,           setEditTab]           = useState(0)
  const [editErrores,       setEditErrores]       = useState({})
  const [guardando,         setGuardando]         = useState(false)
  const [editTimValidacion, setEditTimValidacion] = useState(null)

  useAtajosTeclado({
    'F10': { fn: () => { if (modo === 'editar' && !guardando) handleGuardar() }, soloFueraDeInputs: false },
  })

  useEffect(() => { onDirtyChange?.(modo === 'editar') }, [modo, onDirtyChange])

  // Precarga cuando el modal abre directamente en modo editar y fac acaba de cargar
  useEffect(() => {
    if (fac && modo === 'editar' && !editForm.fecha && editDetalle.length === 0) {
      if (!fac.condicion_vta && fac.cobros_nros?.length > 0) {
        setModo('ver')
        showToast(`No se puede editar: tiene cobros registrados (Cobranza N° ${fac.cobros_nros.join(', ')}). Elimine la cobranza primero.`, 'error')
        return
      }
      preCargarEdicion(fac)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fac, modo])

  // Validación en vivo del comprobante en modo edición (solo cuando cambia respecto al original)
  useEffect(() => {
    if (!fac) return
    const nroStr          = editForm.nro_comprobante
    const estab           = editForm.estab
    const expedicion      = editForm.expedicion
    const nroOriginal     = String(fac.nro_comprobante || '').padStart(7, '0')
    const sinCambios = nroStr === nroOriginal
      && estab === (fac.establecimiento || '')
      && expedicion === (fac.expedicion || '')
    if (!nroStr || sinCambios) { setEditTimValidacion(null); return }
    if (estab.length === 3 && expedicion.length === 3 && nroStr.length === 7) {
      validarTimbrado.mutate(
        { establecimiento: estab, expedicion: expedicion, numero: Number(nroStr) },
        {
          onSuccess: res => setEditTimValidacion(res),
          onError:   ()  => setEditTimValidacion({ valido: false, mensaje: 'Error al validar.' }),
        }
      )
    } else {
      setEditTimValidacion(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editForm.nro_comprobante, editForm.estab, editForm.expedicion, fac?.nro_comprobante])

  const preCargarEdicion = (facData) => {
    const detalle = (facData.detalle || []).map(it => ({
      key: it.id,
      prs: it.prs,
      descripcion: it.producto_descripcion,
      impuesto: it.impuesto,
      cantidad: String(Math.round(Number(it.cantidad))),
      precio: String(Math.round(Number(it.monto) / Math.max(Number(it.cantidad), 1))),
    }))
    const cobranza = (facData.cobranza || []).map(c => ({
      key: c.id,
      forma_pago: String(c.forma_pago),
      cta: String(c.cta),
      monto: String(c.monto),
      voucher: c.voucher || '',
      nro_comprobante: c.nro_comprobante || '',
    }))
    const cuotasArr = facData.cuotas || []
    let dias = '30'
    if (cuotasArr.length >= 2) {
      const d1 = new Date(cuotasArr[0].fecha_vencimiento + 'T00:00:00')
      const d2 = new Date(cuotasArr[1].fecha_vencimiento + 'T00:00:00')
      dias = String(Math.round((d2 - d1) / 86400000))
    }
    setEditCondicion(facData.condicion_vta)
    setEditForm({
      fecha: facData.fecha,
      persona: { id: facData.persona, nro_documento: facData.cliente_documento, razon_social: facData.cliente_nombre },
      observacion: facData.observacion || '',
      nro_comprobante: String(facData.nro_comprobante || ''),
      estab: facData.establecimiento || '',
      expedicion: facData.expedicion || '',
    })
    setEditDetalle(detalle)
    setEditCobranza(facData.condicion_vta
      ? cobranza
      : [{ key: Date.now(), forma_pago: '', cta: '', monto: '', voucher: '', nro_comprobante: '' }]
    )
    setEditCuotas({ cant_cuota: String(cuotasArr.length || 1), dias_entre_cuotas: dias })
    setEditTab(0)
    setEditErrores({})
  }

  const handleIniciarEdicion = () => {
    if (!fac.condicion_vta && fac.cobros_nros?.length > 0) {
      showToast(`No se puede editar: tiene cobros registrados (Cobranza N° ${fac.cobros_nros.join(', ')}). Elimine la cobranza primero.`, 'error')
      return
    }
    if (fac) preCargarEdicion(fac)
    setModo('editar')
  }

  const handleCancelarEdicion = () => setConfirmDescartar(true)

  const handleEliminarFac = () => {
    if (!fac.condicion_vta && fac.cobros_nros?.length > 0) {
      showToast(`No se puede eliminar: tiene cobros registrados (Cobranza N° ${fac.cobros_nros.join(', ')}). Elimine la cobranza primero.`, 'error')
      return
    }
    onEliminar(fac)
  }

  const handleAnularFac = () => onAnular(fac)

  const editTotales = useMemo(() => calcularTotales(editDetalle), [editDetalle])

  const condActual = editCondicion ?? fac?.condicion_vta

  const validarEdicion = () => {
    const e = {}
    if (!editForm.fecha)    e.fecha   = 'Requerida.'
    if (!editForm.persona)  e.persona = 'Seleccione un cliente.'
    if (editDetalle.length === 0) e.detalle = 'Agregue al menos un ítem.'
    if (editDetalle.some(it => !it.precio || Number(it.precio) <= 0))
      e.detalle = 'Todos los ítems deben tener precio mayor a cero.'
    if (condActual) {
      const totalCobrado = editCobranza.reduce((s, r) => s + (Number(r.monto) || 0), 0)
      if (Math.round(totalCobrado) < Math.round(editTotales.monto_total)) e.cobranza = 'Total cobrado insuficiente.'
      if (editCobranza.some(r => !r.forma_pago || !r.cta)) e.cobranza = 'Complete forma de pago y cuenta.'
    } else {
      if (!editCuotas.cant_cuota || parseInt(editCuotas.cant_cuota) < 1) e.cant_cuota = 'Requerido.'
      if (!editCuotas.dias_entre_cuotas || parseInt(editCuotas.dias_entre_cuotas) < 1) e.dias_cuota = 'Requerido.'
    }
    setEditErrores(e)
    return e
  }

  const handleGuardar = async () => {
    const e = validarEdicion()
    if (Object.keys(e).length > 0) {
      if (e.fecha || e.persona || e.detalle) setEditTab(0)
      else if (e.cobranza) setEditTab(1)
      else setEditTab(2)
      return
    }
    setGuardando(true)
    try {
      const nroEditado = editForm.nro_comprobante ? Number(editForm.nro_comprobante) : undefined
      await actualizar.mutateAsync({
        id,
        condicion_vta:   condActual,
        fecha:           editForm.fecha,
        persona:         editForm.persona.id,
        observacion:     editForm.observacion,
        establecimiento: editForm.estab,
        expedicion:      editForm.expedicion,
        ...(nroEditado !== undefined ? { nro_comprobante: nroEditado } : {}),
        detalle: editDetalle.map(it => ({
          prs: it.prs, cantidad: it.cantidad,
          monto: String(Math.round((Number(it.cantidad) || 0) * (Number(it.precio) || 0) * 100) / 100),
        })),
        cobranza: condActual ? editCobranza.map(r => ({
          forma_pago: Number(r.forma_pago), cta: Number(r.cta),
          monto: r.monto, voucher: r.voucher || '', nro_comprobante: r.nro_comprobante || '',
        })) : [],
        cuotas: !condActual ? {
          cant_cuota: parseInt(editCuotas.cant_cuota),
          dias_entre_cuotas: parseInt(editCuotas.dias_entre_cuotas),
        } : null,
      })
      showToast('Factura actualizada correctamente.', 'success')
      setModo('ver')
      setTabVer(0)
    } catch (err) {
      setEditErrores({ _general: extraerMensajeError(err) })
    } finally {
      setGuardando(false)
    }
  }

  const impLabel = { '10': 'IVA 10%', '5': 'IVA 5%', 'exenta': 'Exenta' }

  if (isLoading) return <div className="fac-modal-loading">Cargando factura…</div>
  if (!fac) return null

  const tieneCobranza = fac.condicion_vta && (fac.cobranza || []).length > 0
  const tieneCuotas   = !fac.condicion_vta && (fac.cuotas || []).length > 0
  // Solo bloquea la edición completa si la condición NO cambia y hay cuotas cobradas
  const tienePagos    = !fac.condicion_vta && (editCondicion ?? fac.condicion_vta) === fac.condicion_vta && (fac.cuotas || []).some(
    c => c.estado === 'pagado' || Number(c.saldo) < Number(c.monto_cuota)
  )

  if (modo === 'editar') {
    const TABS_EDIT = [
      { label: 'Cabecera y Detalle', idx: 0 },
      ...(condActual  ? [{ label: 'Cobranza',        idx: 1 }] : []),
      ...(!condActual ? [{ label: 'Cuenta a Cobrar', idx: 2 }] : []),
    ]
    return (
      <div className="fac-modal-wrap">
        <div className="fac-ver-toolbar">
          <span className="fac-mono" style={{ fontSize: 12.5, color: '#6b7280', fontWeight: 600 }}>
            {fac.nro_comprobante_formateado}
          </span>
          <span className={`fac-badge ${fac.condicion_vta ? 'contado' : 'credito'}`} style={{ fontSize: 11.5 }}>
            {fac.condicion_vta ? 'Contado' : 'Crédito'}
          </span>
          {tienePagos && (
            <span style={{ fontSize: 11.5, color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '2px 8px' }}>
              Hay cuotas cobradas — solo se puede cambiar fecha, cliente, observación o condición
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="fac-ver-btn save" onClick={handleGuardar} disabled={guardando}>
              <Check size={13} /> {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button className="fac-ver-btn cancel" onClick={handleCancelarEdicion}>Cancelar</button>
          </div>
        </div>

        <div className="fac-tabs">
          {TABS_EDIT.map(t => (
            <button key={t.idx} className={`fac-tab ${editTab === t.idx ? 'active' : ''}`} onClick={() => setEditTab(t.idx)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="fac-tab-content">
          {editTab === 0 && (
            <div className="fac-tab-body">
              <div className="fac-form-row" style={{ alignItems: 'flex-end', gap: 20 }}>
                <div className="fac-form-group">
                  <label className="fac-label">Fecha *</label>
                  <input type="date"
                    className={`fac-input fac-input-date ${editErrores.fecha ? 'fac-input-error' : ''}`}
                    value={editForm.fecha}
                    onChange={e => setEditForm(f => ({ ...f, fecha: e.target.value }))} />
                  {editErrores.fecha && <span className="fac-error-msg">{editErrores.fecha}</span>}
                </div>
                <div className="fac-form-group" style={{ paddingBottom: 6 }}>
                  <label className="fac-check-label">
                    <input type="checkbox" className="fac-checkbox"
                      checked={condActual ?? false}
                      onChange={e => {
                        const nuevo = e.target.checked
                        setEditCondicion(nuevo)
                        setEditTab(0)
                        if (nuevo) {
                          setEditCobranza([{ key: Date.now(), forma_pago: '', cta: '', monto: '', voucher: '', nro_comprobante: '' }])
                        } else {
                          setEditCuotas({ cant_cuota: '', dias_entre_cuotas: '' })
                        }
                      }}
                    />
                    <span className="fac-check-text">Contado</span>
                  </label>
                  <span className="fac-cond-hint">
                    {condActual ? 'Cobranza en la siguiente pestaña' : 'Cuotas en la siguiente pestaña'}
                  </span>
                  {condActual !== fac.condicion_vta && (
                    <span className="fac-cond-hint" style={{ color: '#b45309', fontWeight: 500 }}>
                      {condActual ? '⚠ Se eliminarán las cuotas al guardar' : '⚠ Se eliminará la cobranza al guardar'}
                    </span>
                  )}
                </div>
                <div className="fac-form-group">
                  <label className="fac-label">Nro. comprobante</label>
                  <div className="fac-timbrado-row">
                    <input className="fac-input fac-mono fac-timbrado-pt"
                      maxLength={3}
                      value={editForm.estab}
                      onChange={e => setEditForm(f => ({ ...f, estab: e.target.value.replace(/\D/g, '') }))}
                      onBlur={e => { const v = e.target.value; if (v) setEditForm(f => ({ ...f, estab: v.padStart(3, '0') })) }}
                    />
                    <span className="fac-timbrado-sep">-</span>
                    <input className="fac-input fac-mono fac-timbrado-pt"
                      maxLength={3}
                      value={editForm.expedicion}
                      onChange={e => setEditForm(f => ({ ...f, expedicion: e.target.value.replace(/\D/g, '') }))}
                      onBlur={e => { const v = e.target.value; if (v) setEditForm(f => ({ ...f, expedicion: v.padStart(3, '0') })) }}
                    />
                    <span className="fac-timbrado-sep">-</span>
                    <input className="fac-input fac-mono fac-timbrado-nro"
                      maxLength={7}
                      value={editForm.nro_comprobante}
                      onChange={e => setEditForm(f => ({ ...f, nro_comprobante: e.target.value.replace(/\D/g, '') }))}
                      onBlur={e => { const v = e.target.value; if (v) setEditForm(f => ({ ...f, nro_comprobante: v.padStart(7, '0') })) }}
                    />
                  </div>
                  {editTimValidacion && (
                    <div className={`fac-validacion ${editTimValidacion.valido ? 'ok' : 'error'}`}>
                      {editTimValidacion.valido ? <CheckCircle size={13} /> : <XCircle size={13} />}
                      {editTimValidacion.mensaje}
                    </div>
                  )}
                  {editErrores.nro_comprobante && <span className="fac-error-msg">{editErrores.nro_comprobante}</span>}
                </div>
              </div>
              <div className="fac-form-group">
                <label className="fac-label">Cliente *</label>
                <BuscadorPersona value={editForm.persona} onChange={p => setEditForm(f => ({ ...f, persona: p }))} />
                {editForm.persona && (
                  <div className="fac-persona-tag">
                    <CheckCircle size={12} color="#16a34a" />
                    {editForm.persona.nro_documento} — {editForm.persona.razon_social}
                  </div>
                )}
                {editErrores.persona && <span className="fac-error-msg">{editErrores.persona}</span>}
              </div>
              <div className="fac-form-group">
                <label className="fac-label">Observación</label>
                <textarea className="fac-input fac-textarea" rows={2}
                  value={editForm.observacion}
                  onChange={e => setEditForm(f => ({ ...f, observacion: e.target.value }))} />
              </div>
              {!tienePagos && (
                <>
                  <div className="fac-seccion-titulo">Detalle de ítems</div>
                  <TabItemsMasterDetail
                    detalle={editDetalle} setDetalle={setEditDetalle}
                    errores={editErrores} impLabel={impLabel}
                  />
                  {editErrores.detalle && <span className="fac-error-msg">{editErrores.detalle}</span>}
                  {editDetalle.length > 0 && (
                    <div className="fac-totales">
                      <div className="fac-tot-grid">
                        {editTotales.grav_10 > 0 && <>
                          <div className="fac-tot-row"><span>Gravada 10%</span><span className="fac-mono">{formatGs(editTotales.grav_10)}</span></div>
                          <div className="fac-tot-row"><span>IVA 10%</span><span className="fac-mono">{formatGs(editTotales.iva_10)}</span></div>
                        </>}
                        {editTotales.grav_5 > 0 && <>
                          <div className="fac-tot-row"><span>Gravada 5%</span><span className="fac-mono">{formatGs(editTotales.grav_5)}</span></div>
                          <div className="fac-tot-row"><span>IVA 5%</span><span className="fac-mono">{formatGs(editTotales.iva_5)}</span></div>
                        </>}
                        <div className="fac-tot-row fac-tot-total"><span>Total</span><span className="fac-mono">{formatGs(editTotales.monto_total)}</span></div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {editTab === 1 && condActual && !tienePagos && (
            <TabCobranza cobranza={editCobranza} setCobranza={setEditCobranza}
              montoTotal={editTotales.monto_total} errores={editErrores} />
          )}
          {editTab === 2 && !condActual && !tienePagos && (
            <TabCuentaCobrar cuotas={editCuotas} setCuotas={setEditCuotas}
              montoTotal={editTotales.monto_total} fecha={editForm.fecha} errores={editErrores} />
          )}
        </div>

        {editErrores._general && (
          <div className="fac-error-banner"><AlertTriangle size={14} /> {editErrores._general}</div>
        )}
        <div className="fac-modal-footer">
          <div className="fac-footer-total">
            Total: <strong className="fac-mono">{formatGs(editTotales.monto_total)}</strong>
          </div>
          <div className="fac-footer-actions">
            <button className="fac-btn-secundario" onClick={handleCancelarEdicion} disabled={guardando}>Cancelar</button>
            <button className="fac-btn-primario" onClick={handleGuardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>

        <ConfirmDialog
          isOpen={confirmDescartar}
          title="Descartar cambios"
          description="¿Deseas descartar los cambios realizados en la edición?"
          confirmText="Descartar"
          cancelText="Seguir editando"
          onConfirm={() => { setConfirmDescartar(false); setModo('ver') }}
          onCancel={() => setConfirmDescartar(false)}
        />
      </div>
    )
  }

  return (
    <div className="fac-ver-wrap">
      <div className="fac-ver-toolbar">
        {fac.is_anulado ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#991b1b', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px' }}>
            <Ban size={13} /> Factura anulada
          </span>
        ) : (
          <button className="fac-ver-btn edit" onClick={handleIniciarEdicion}>
            <Pencil size={13} /> Editar
          </button>
        )}
        <button className="fac-ver-btn print" onClick={() => window.open(`/api/facturacion/${fac.id}/pdf/`, '_blank')}>
          <Printer size={13} /> Visualizar / Imprimir
        </button>
        {!fac.is_anulado && (
          <button className="fac-ver-btn" style={{ color: '#b45309', borderColor: '#fde68a' }}
            onClick={handleAnularFac}>
            <Ban size={13} /> Anular
          </button>
        )}
        <button className="fac-ver-btn del" onClick={handleEliminarFac}>
          <Trash2 size={13} /> Eliminar
        </button>
      </div>

      {(tieneCobranza || tieneCuotas) && (
        <div className="fac-tabs" style={{ flexShrink: 0 }}>
          <button className={`fac-tab ${tabVer === 0 ? 'active' : ''}`} onClick={() => setTabVer(0)}>
            Detalle
          </button>
          {tieneCobranza && (
            <button className={`fac-tab ${tabVer === 1 ? 'active' : ''}`} onClick={() => setTabVer(1)}>
              Cobranza
            </button>
          )}
          {tieneCuotas && (
            <button className={`fac-tab ${tabVer === 2 ? 'active' : ''}`} onClick={() => setTabVer(2)}>
              Cuotas a cobrar
            </button>
          )}
        </div>
      )}

      <div className="fac-ver-content">
        {tabVer === 0 && (
          <>
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
                    {fac.observacion || '—'}
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
          </>
        )}

        {tabVer === 1 && tieneCobranza && (
          <div className="fac-ver-section">
            <div className="fac-ver-section-title">Detalle de cobranza</div>
            {(fac.cobranza || []).map(c => (
              <div key={c.id} className="fac-ver-cobr-row">
                <div className="fac-ver-cobr-izq">
                  <span className="fac-ver-cobr-fp">{c.forma_pago_descripcion}</span>
                  <span className="fac-ver-cobr-cta">
                    {c.cuenta_descripcion}
                    {c.voucher && ` · Voucher: ${c.voucher}`}
                    {c.nro_comprobante && ` · Ref: ${c.nro_comprobante}`}
                  </span>
                </div>
                <span className="fac-mono fac-ver-cobr-monto">{formatGs(c.monto)}</span>
              </div>
            ))}
            <div className="fac-ver-totales" style={{ marginTop: 12 }}>
              <div className="fac-tot-row fac-tot-total"><span>Total factura</span><span className="fac-mono">{formatGs(fac.monto_total)}</span></div>
              {Number(fac.vuelto) > 0 && (
                <div className="fac-tot-row" style={{ color: '#16a34a' }}><span>Vuelto</span><span className="fac-mono">{formatGs(fac.vuelto)}</span></div>
              )}
            </div>
          </div>
        )}

        {tabVer === 2 && tieneCuotas && (
          <div className="fac-ver-section">
            <div className="fac-ver-section-title">Cuotas a cobrar</div>
            <div className="fac-cuotas-preview" style={{ marginTop: 0 }}>
              <div className="fac-cuotas-header" style={{ gridTemplateColumns: '80px 1fr 1fr 80px' }}>
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

function ModalFactura({ onClose, onCreado, onDirtyChange }) {
  const [tab,      setTab]      = useState(0)
  const [form,     setForm]     = useState(FORM_INIT)
  const [detalle,  setDetalle]  = useState([])
  const [cobranza, setCobranza] = useState([COB_FILA()])
  const [cuotas,   setCuotas]   = useState(CUOTAS_INIT)
  const [errores,  setErrores]  = useState({})
  const [guardando, setGuardando] = useState(false)

  const isDirty = useMemo(() =>
    form.persona !== null ||
    detalle.length > 0 ||
    form.observacion !== '' ||
    form.estab !== '' || form.expedicion !== '' || form.nro_comprobante !== '' ||
    cobranza.some(r => r.monto !== '')
  , [form, detalle, cobranza])

  useEffect(() => { onDirtyChange?.(isDirty) }, [isDirty, onDirtyChange])

  const crear   = useCreateFactura()
  const totales = useMemo(() => calcularTotales(detalle), [detalle])

  useAtajosTeclado({
    'F10': { fn: () => { if (!guardando) handleEmitir() }, soloFueraDeInputs: false },
  })

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
  const [confirmAnularFac, setConfirmAnularFac] = useState(null)
  const [filtros, setFiltros]             = useState({ search: '', condicion_vta: '', fecha_desde: '', fecha_hasta: '' })
  const debounceRef                       = useRef(null)
  const [confirmDescartarNueva, setConfirmDescartarNueva] = useState(false)
  const [confirmDescartarVer,   setConfirmDescartarVer]   = useState(false)
  const facturaDirtyRef = useRef(false)
  const verDirtyRef     = useRef(false)
  const [loadingPdf,   setLoadingPdf]   = useState(false)
  const [loadingExcel, setLoadingExcel] = useState(false)

  const { toast, showToast } = useToast()
  const { data, isLoading }  = useFacturas(filtros)
  const eliminarFactura      = useDeleteFactura()
  const anularFactura        = useAnularFactura()
  const facturas = data?.results ?? data ?? []

  useAtajosTeclado({
    'Insert': { fn: () => { if (!modalAbierto && !facturaViendo) setModalAbierto(true) } },
  })

  const handleSearchChange = (e) => {
    const val = e.target.value
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setFiltros(f => ({ ...f, search: val })), 300)
  }

  const handleCloseModalNueva = () => {
    if (facturaDirtyRef.current) setConfirmDescartarNueva(true)
    else setModalAbierto(false)
  }

  const handleCloseModalVer = () => {
    if (verDirtyRef.current) setConfirmDescartarVer(true)
    else setFacturaViendo(null)
  }

  const buildQueryString = () => {
    const p = new URLSearchParams()
    if (filtros.search)        p.set('search',        filtros.search)
    if (filtros.condicion_vta) p.set('condicion_vta', filtros.condicion_vta)
    if (filtros.fecha_desde)   p.set('fecha_desde',   filtros.fecha_desde)
    if (filtros.fecha_hasta)   p.set('fecha_hasta',   filtros.fecha_hasta)
    const qs = p.toString()
    return qs ? `?${qs}` : ''
  }

  const handleVerPdf = async () => {
    setLoadingPdf(true)
    try {
      const res = await apiClient.get(`/facturacion/reporte-pdf/${buildQueryString()}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch {
      showToast('No se pudo generar el PDF.', 'error')
    } finally {
      setLoadingPdf(false)
    }
  }

  const handleDescargarExcel = async () => {
    setLoadingExcel(true)
    try {
      const res  = await apiClient.get(`/facturacion/reporte-excel/${buildQueryString()}`, { responseType: 'blob' })
      const obj  = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const link = document.createElement('a')
      link.href     = obj
      link.download = `facturas_${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
      URL.revokeObjectURL(obj)
    } catch {
      showToast('No se pudo generar el Excel.', 'error')
    } finally {
      setLoadingExcel(false)
    }
  }

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

  const handleAnular = (fac) => setConfirmAnularFac(fac)

  const handleAnularConfirmado = async () => {
    try {
      await anularFactura.mutateAsync(confirmAnularFac.id)
      setConfirmAnularFac(null)
      setFacturaViendo(null)
      showToast('Factura anulada correctamente.', 'success')
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
      setConfirmAnularFac(null)
    }
  }

  return (
    <>
      <style>{`
        .fac-page { display: flex; flex-direction: column; height: 100%; }
        .fac-header-icon { width: 36px; height: 36px; background: #dbeafe; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .fac-header-titles { display: flex; flex-direction: column; gap: 1px; flex-shrink: 0; margin-right: 4px; }
        .fac-header-title { font-size: 17px; font-weight: 600; color: #111827; white-space: nowrap; }
        .fac-header-sub   { font-size: 12px; color: #9ca3af; white-space: nowrap; }
        .fac-toolbar { display: flex; align-items: center; gap: 10px; padding: 12px 20px; flex-wrap: wrap; border-bottom: 1px solid #f3f4f6; }
        .fac-search-wrap { flex: 1; min-width: 200px; max-width: 340px; display: flex; align-items: center; gap: 8px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 7px 12px; background: #fff; }
        .fac-search-main { flex: 1; border: none; outline: none; font-size: 13px; font-family: 'DM Sans', sans-serif; background: transparent; color: #374151; }
        .fac-search-main::placeholder { color: #9ca3af; }
        .fac-filtro-select { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; background: #fff; color: #374151; height: 36px; }
        .fac-filtro-date { border: 1px solid #e5e7eb; border-radius: 8px; padding: 0 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; background: #fff; color: #374151; height: 36px; width: 138px; }
        .fac-btn-reporte { display: flex; align-items: center; gap: 5px; padding: 7px 13px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; color: #374151; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer; white-space: nowrap; }
        .fac-btn-reporte:hover:not(:disabled) { background: #f3f4f6; }
        .fac-btn-reporte.excel { color: #15803d; border-color: #bbf7d0; }
        .fac-btn-reporte.excel:hover:not(:disabled) { background: #dcfce7; }
        .fac-btn-reporte:disabled { opacity: 0.6; cursor: default; }
        .fac-btn-nuevo { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; border: none; background: #1a3a5c; color: #fff; margin-left: auto; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer; white-space: nowrap; }
        .fac-btn-nuevo:hover { background: #15304d; }
        .fac-body { flex: 1; overflow: hidden; padding: 14px 24px 24px; }
        .fac-tabla-wrap { height: 100%; border: 1px solid #e8edf2; border-radius: 10px; background: #fff; overflow-y: auto; }
        .fac-tabla { width: 100%; border-collapse: collapse; }
        .fac-th { text-align: left; padding: 10px 14px; font-size: 11.5px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .04em; background: #f8fafc; border-bottom: 1px solid #e8edf2; position: sticky; top: 0; }
        .fac-td { padding: 12px 14px; font-size: 13px; color: #374151; vertical-align: middle; border-bottom: 1px solid #f3f4f6; }
        .fac-tr:last-child .fac-td { border-bottom: none; }
        .fac-tr:nth-child(even) .fac-td { background: #f9fafb; }
        .fac-tr-clickable { cursor: pointer; }
        .fac-tr-clickable:hover .fac-td { background: #eff6ff !important; }
        .fac-tr-anulado .fac-td { background: #fff5f5 !important; }
        .fac-tr-anulado:hover .fac-td { background: #fee2e2 !important; }
        .fac-td-hint { font-size: 11px; color: #9ca3af; margin-top: 2px; }
        .fac-td-acciones { display: flex; gap: 4px; justify-content: flex-end; }
        .fac-badge { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 11.5px; font-weight: 500; }
        .fac-badge.contado  { background: #dcfce7; color: #166534; }
        .fac-badge.credito  { background: #fef3c7; color: #92400e; }
        .fac-badge.anulado  { background: #fee2e2; color: #991b1b; }
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
        .fac-det-input-num   { width: 56px; display: inline-block; text-align: center; }
        .fac-det-input-precio { width: 88px; display: inline-block; text-align: right; }
        input[type=number].fac-det-input-num { -moz-appearance: textfield; }
        input[type=number].fac-det-input-num::-webkit-inner-spin-button,
        input[type=number].fac-det-input-num::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
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
        .fac-cobr-del { align-self: flex-end; width: 32px !important; height: 32px !important; }
        .fac-btn-add-cobr { display: flex; align-items: center; gap: 5px; padding: 8px 14px; border-radius: 8px; border: 1px dashed #bfdbfe; background: #eff6ff; color: #1a3a5c; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer; }
        .fac-btn-add-cobr:hover { background: #dbeafe; }
        .fac-cobr-resumen { background: #f8fafc; border: 1px solid #e8edf2; border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
        .fac-cobr-res-row { display: flex; justify-content: space-between; font-size: 13px; color: #374151; }
        .fac-cobr-estado { display: flex; align-items: center; gap: 7px; border-radius: 8px; padding: 9px 14px; font-size: 13px; font-weight: 600; }
        .fac-cobr-estado--rojo  { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .fac-cobr-estado--verde { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .fac-cobr-estado--azul  { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
        .fac-cuota-info { display: flex; align-items: center; gap: 5px; font-size: 12.5px; color: #374151; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 8px 12px; }
        .fac-cuotas-preview { border: 1px solid #e8edf2; border-radius: 8px; overflow: hidden; }
        .fac-cuotas-header { display: grid; grid-template-columns: 70px 1fr 1fr; gap: 8px; padding: 8px 12px; background: #f8fafc; font-size: 11.5px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #e8edf2; }
        .fac-cuota-row { display: grid; grid-template-columns: 70px 1fr 1fr; gap: 8px; padding: 9px 12px; font-size: 13px; color: #374151; border-bottom: 1px solid #f3f4f6; }
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
        .fac-ver-wrap { display: flex; flex-direction: column; gap: 0; max-height: 72vh; overflow: hidden; }
        .fac-ver-content { flex: 1; overflow-y: auto; }
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
        .fac-ver-cobr-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid #f3f4f6; }
        .fac-ver-cobr-row:last-child { border-bottom: none; }
        .fac-ver-cobr-izq { display: flex; flex-direction: column; gap: 2px; }
        .fac-ver-cobr-fp  { font-size: 13px; font-weight: 500; color: #111827; }
        .fac-ver-cobr-cta { font-size: 12px; color: #6b7280; }
        .fac-ver-cobr-monto { font-size: 13.5px; font-weight: 700; color: #111827; white-space: nowrap; }
        .fac-ver-content { flex: 1; overflow-y: auto; }
        .fac-det-master { display: flex; gap: 14px; align-items: flex-start; }
        .fac-det-panel-izq { width: 270px; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px; border: 1px solid #e8edf2; border-radius: 10px; padding: 14px; background: #fafbfc; }
        .fac-det-panel-der { flex: 1; min-width: 0; }
        .fac-det-item-nombre { font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 3px; }
        .fac-det-item-form { display: flex; flex-direction: column; gap: 10px; }
        .fac-det-form-btns { display: flex; gap: 8px; margin-top: 2px; }
        .fac-det-subtotal { font-size: 12px; color: #1e40af; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 6px 10px; }
        .fac-det-vacio { padding: 32px 16px; text-align: center; color: #9ca3af; font-size: 12.5px; border: 1.5px dashed #e5e7eb; border-radius: 8px; }
        .fac-det-tr-editing .fac-det-td { background: #eff6ff !important; }
        .fac-det-prod-info { min-height: 34px; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; border-bottom: 1px solid #e8edf2; padding-bottom: 8px; }
        .fac-det-prod-hint { font-size: 12px; color: #9ca3af; font-style: italic; }
        .fac-det-panel-izq input:disabled { background: #f3f4f6; color: #9ca3af; cursor: not-allowed; opacity: 1; }
        @media (max-width: 767px) {
          .fac-toolbar { padding: 8px 14px; gap: 8px; }
          .fac-search-wrap { max-width: 100%; min-width: 0; margin-left: 0 !important; }
          .fac-body { padding: 10px 14px 14px; }
          .fac-det-master { flex-direction: column; }
          .fac-det-panel-izq { width: 100%; }
          .fac-tabla-wrap { overflow-x: auto; }
          .fac-th-doc { display: none; }
          .fac-td-doc { display: none; }
          .fac-tabs { overflow-x: auto; }
          .fac-tab { padding: 10px 14px; font-size: 13px; }
          .fac-det-wrap { overflow-x: auto; }
          .fac-ver-wrap { max-height: 100vh; }
        }
      `}</style>

      <div className="fac-page">
        <div className="fac-toolbar">
          <div className="fac-header-icon"><FileText size={18} color="#1a3a5c" /></div>
          <div className="fac-header-titles">
            <div className="fac-header-title">Facturación</div>
            <div className="fac-header-sub">Emisión y gestión de facturas</div>
          </div>

          <div className="fac-search-wrap" style={{ marginLeft: 'auto' }}>
            <Search size={13} color="#9ca3af" />
            <input
              className="fac-search-main"
              placeholder="Buscar por cliente o comprobante…"
              onChange={handleSearchChange}
              autoComplete="off"
            />
          </div>

          <select className="fac-filtro-select" value={filtros.condicion_vta}
            onChange={e => setFiltros(f => ({ ...f, condicion_vta: e.target.value }))}>
            <option value="">Todas</option>
            <option value="true">Contado</option>
            <option value="false">Crédito</option>
          </select>

          <input type="date" className="fac-filtro-date" title="Fecha desde"
            value={filtros.fecha_desde}
            onChange={e => setFiltros(f => ({ ...f, fecha_desde: e.target.value }))} />
          <input type="date" className="fac-filtro-date" title="Fecha hasta"
            value={filtros.fecha_hasta}
            onChange={e => setFiltros(f => ({ ...f, fecha_hasta: e.target.value }))} />

          <button className="fac-btn-reporte" onClick={handleVerPdf} disabled={loadingPdf}>
            <FileText size={14} /> {loadingPdf ? 'Generando…' : 'PDF'}
          </button>
          <button className="fac-btn-reporte excel" onClick={handleDescargarExcel} disabled={loadingExcel}>
            <FileDown size={14} /> {loadingExcel ? 'Generando…' : 'Excel'}
          </button>
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
                    <th className="fac-th fac-th-doc">Documento</th>
                    <th className="fac-th">Condición</th>
                    <th className="fac-th" style={{ textAlign: 'right' }}>Total</th>
                    <th className="fac-th" style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.map(f => (
                    <tr
                      key={f.id}
                      className={`fac-tr fac-tr-clickable${f.is_anulado ? ' fac-tr-anulado' : ''}`}
                      onClick={() => setFacturaViendo({ id: f.id, modo: 'ver' })}
                    >
                      <td className="fac-td fac-mono" style={{ fontWeight: 600 }}>{f.nro_comprobante_formateado}</td>
                      <td className="fac-td">{formatFecha(f.fecha)}</td>
                      <td className="fac-td">
                        {f.cliente_nombre}
                        <div className="fac-td-hint">Click para ver detalle</div>
                      </td>
                      <td className="fac-td fac-mono fac-td-doc" style={{ color: '#6b7280' }}>{f.cliente_documento}</td>
                      <td className="fac-td">
                        {f.is_anulado ? (
                          <span className="fac-badge anulado">Anulada</span>
                        ) : (
                          <span className={`fac-badge ${f.condicion_vta ? 'contado' : 'credito'}`}>
                            {f.condicion_vta ? 'Contado' : 'Crédito'}
                          </span>
                        )}
                      </td>
                      <td className="fac-td fac-mono" style={{ textAlign: 'right', fontWeight: 600, color: f.is_anulado ? '#9ca3af' : undefined, textDecoration: f.is_anulado ? 'line-through' : undefined }}>
                        {formatGs(f.monto_total)}
                      </td>
                      <td className="fac-td" onClick={e => e.stopPropagation()}>
                        <div className="fac-td-acciones">
                          {!f.is_anulado && (
                            <button className="fac-row-btn" title="Editar"
                              onClick={() => setFacturaViendo({ id: f.id, modo: 'editar' })}>
                              <Pencil size={12} />
                            </button>
                          )}
                          <button className="fac-row-btn" title="Imprimir"
                            onClick={() => window.open(`/api/facturacion/${f.id}/pdf/`, '_blank')}>
                            <Printer size={12} />
                          </button>
                          {!f.is_anulado && (
                            <button className="fac-row-btn" title="Anular" style={{ color: '#b45309', borderColor: '#fde68a' }}
                              onClick={() => handleAnular(f)}>
                              <Ban size={12} />
                            </button>
                          )}
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
        <Modal isOpen={modalAbierto} onClose={handleCloseModalNueva}
          title="Nueva factura" subtitle="Complete los datos del comprobante" size="xl">
          <ModalFactura
            onClose={handleCloseModalNueva}
            onCreado={() => {
              facturaDirtyRef.current = false
              setModalAbierto(false)
              showToast('Factura emitida correctamente.', 'success')
            }}
            onDirtyChange={(dirty) => { facturaDirtyRef.current = dirty }}
          />
        </Modal>
      )}

      {facturaViendo && (
        <Modal isOpen={!!facturaViendo} onClose={handleCloseModalVer}
          title="Detalle de factura" subtitle="Vista y edición del comprobante" size="xl">
          <ModalVerFactura
            id={facturaViendo.id}
            initialModo={facturaViendo.modo}
            onClose={handleCloseModalVer}
            onEliminar={handleEliminar}
            onAnular={handleAnular}
            showToast={showToast}
            onDirtyChange={(dirty) => { verDirtyRef.current = dirty }}
          />
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!confirmFac}
        title="Eliminar factura"
        description={`¿Eliminar la factura ${confirmFac?.nro_comprobante_formateado}? Se eliminarán también los movimientos de caja vinculados. Esta acción no se puede deshacer.`}
        onConfirm={handleEliminarConfirmado}
        onCancel={() => setConfirmFac(null)}
        loading={eliminarFactura.isPending}
      />

      <ConfirmDialog
        isOpen={!!confirmAnularFac}
        title="Anular factura"
        description={`¿Anular la factura ${confirmAnularFac?.nro_comprobante_formateado}? El comprobante quedará marcado como anulado. No se podrá editar, pero seguirá visible en el listado. Si tiene cobranza asociada, debe eliminarla primero.`}
        confirmText="Anular factura"
        onConfirm={handleAnularConfirmado}
        onCancel={() => setConfirmAnularFac(null)}
        loading={anularFactura.isPending}
      />

      <ConfirmDialog
        isOpen={confirmDescartarNueva}
        title="Descartar cambios"
        description="Hay datos ingresados en la nueva factura. ¿Deseas descartar los cambios?"
        confirmText="Descartar"
        cancelText="Seguir editando"
        onConfirm={() => { setConfirmDescartarNueva(false); facturaDirtyRef.current = false; setModalAbierto(false) }}
        onCancel={() => setConfirmDescartarNueva(false)}
      />

      <ConfirmDialog
        isOpen={confirmDescartarVer}
        title="Descartar cambios"
        description="Hay cambios sin guardar en la edición. ¿Deseas descartarlos?"
        confirmText="Descartar"
        cancelText="Seguir editando"
        onConfirm={() => { setConfirmDescartarVer(false); verDirtyRef.current = false; setFacturaViendo(null) }}
        onCancel={() => setConfirmDescartarVer(false)}
      />

      <Toast toast={toast} />
    </>
  )
}
