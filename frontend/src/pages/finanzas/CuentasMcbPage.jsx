import { useState, useRef } from 'react'
import { Landmark, ArrowLeft, Plus, Search, Pencil, Trash2, X, TrendingUp, TrendingDown } from 'lucide-react'
import { useCuentasMcb, useCreateCuenta, useUpdateCuenta, useDeleteCuenta } from '../../hooks/finanzas/useCuentasMcb'
import { useMovimientos, useCreateMovimiento, useUpdateMovimiento, useDeleteMovimiento } from '../../hooks/finanzas/useMovimientos'
import Toast from '../../components/ui/Toast'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../hooks/useToast'
import { extraerMensajeError } from '../../utils/errores'
import { useAuth } from '../../context/AuthContext'

function formatGuarani(valor) {
  if (valor === null || valor === undefined) return '₲ 0'
  const num = Number(valor)
  return `₲ ${num.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-PY', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function hoy() {
  return new Date().toISOString().split('T')[0]
}

function PanelCuenta({ modo, item, onGuardar, onCancelar, guardando }) {
  const [form, setForm]     = useState(
    modo === 'crear'
      ? { descripcion: '' }
      : { descripcion: item?.descripcion || '' }
  )
  const [errores, setErrores] = useState({})

  const validar = () => {
    const e = {}
    if (!form.descripcion.trim()) e.descripcion = 'La descripción es requerida.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  return (
    <div className="cta-panel-body">
      <div className="cta-form-group">
        <label className="cta-label">Descripción *</label>
        <input
          className={`cta-input ${errores.descripcion ? 'cta-input-error' : ''}`}
          placeholder="Ej: Caja principal, Banco XYZ cuenta corriente…"
          value={form.descripcion}
          onChange={e => setForm({ descripcion: e.target.value })}
          autoFocus
        />
        {errores.descripcion && <span className="cta-error-msg">{errores.descripcion}</span>}
      </div>

      <div className="cta-panel-acciones">
        <button className="cta-btn-secundario" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button
          className="cta-btn-primario"
          disabled={guardando}
          onClick={() => { if (validar()) onGuardar({ ...form, descripcion: form.descripcion.trim() }) }}
        >
          {guardando ? 'Guardando…' : modo === 'crear' ? 'Crear cuenta' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

const MOV_VACIO = { tipo: 'ingreso', fecha: hoy(), nro_comprobante: '', monto: '' }

function PanelMovimiento({ modo, item, ctaActual, onGuardar, onCancelar, guardando }) {
  const tipoInicial  = item && Number(item.monto_egreso) > 0 ? 'egreso' : 'ingreso'
  const montoInicial = item ? (tipoInicial === 'ingreso' ? item.monto_ingreso : item.monto_egreso) : ''

  const [form, setForm] = useState(
    modo === 'crear'
      ? MOV_VACIO
      : {
          tipo:            tipoInicial,
          fecha:           item?.fecha            || hoy(),
          nro_comprobante: item?.nro_comprobante  || '',
          monto:           montoInicial ?? '',
        }
  )
  const [errores, setErrores] = useState({})

  const set        = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const soloNumero = v => v.replace(/[^\d.]/g, '')

  const validar = () => {
    const e = {}
    if (!form.fecha) e.fecha = 'La fecha es requerida.'
    if (!(Number(form.monto) > 0)) e.monto = 'El monto debe ser mayor a cero.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validar()) return
    onGuardar({
      cta:             ctaActual.id,
      fecha:           form.fecha,
      nro_comprobante: form.nro_comprobante || null,
      monto_ingreso:   form.tipo === 'ingreso' ? Number(form.monto) || 0 : 0,
      monto_egreso:    form.tipo === 'egreso'  ? Number(form.monto) || 0 : 0,
    })
  }

  return (
    <div className="cta-panel-body">
      <div className="cta-form-group">
        <label className="cta-label">Cuenta</label>
        <div className="cta-cuenta-readonly">
          <Landmark size={13} color="#6b7280" />
          {ctaActual.descripcion}
        </div>
      </div>

      <div className="cta-form-group">
        <label className="cta-label">Tipo *</label>
        <div className="cta-tipo-toggle">
          <button
            type="button"
            className={`cta-tipo-btn ingreso-btn ${form.tipo === 'ingreso' ? 'active' : ''}`}
            onClick={() => set('tipo', 'ingreso')}
          >
            <TrendingUp size={13} /> Ingreso
          </button>
          <button
            type="button"
            className={`cta-tipo-btn egreso-btn ${form.tipo === 'egreso' ? 'active' : ''}`}
            onClick={() => set('tipo', 'egreso')}
          >
            <TrendingDown size={13} /> Egreso
          </button>
        </div>
      </div>

      <div className="cta-form-group">
        <label className="cta-label">Monto *</label>
        <input
          className={`cta-input cta-mono ${errores.monto ? 'cta-input-error' : ''}`}
          placeholder="0"
          value={form.monto}
          onChange={e => set('monto', soloNumero(e.target.value))}
          autoFocus
        />
        {errores.monto && <span className="cta-error-msg">{errores.monto}</span>}
      </div>

      <div className="cta-form-group">
        <label className="cta-label">Fecha *</label>
        <input
          type="date"
          className={`cta-input ${errores.fecha ? 'cta-input-error' : ''}`}
          value={form.fecha}
          onChange={e => set('fecha', e.target.value)}
          max="2099-12-31"
        />
        {errores.fecha && <span className="cta-error-msg">{errores.fecha}</span>}
      </div>

      <div className="cta-form-group">
        <label className="cta-label">Nro. Comprobante</label>
        <input
          className="cta-input"
          placeholder="Número de comprobante (opcional)"
          value={form.nro_comprobante}
          onChange={e => set('nro_comprobante', e.target.value)}
        />
      </div>

      <div className="cta-panel-acciones">
        <button className="cta-btn-secundario" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button className="cta-btn-primario" onClick={handleSubmit} disabled={guardando}>
          {guardando ? 'Guardando…' : modo === 'crear' ? 'Registrar movimiento' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

function VistaCuentas({ cuentas, isLoading, onSeleccionar }) {
  return (
    <div className="cta-vista">
      {isLoading ? (
        <div className="cta-loading">Cargando cuentas…</div>
      ) : cuentas.length === 0 ? (
        <div className="cta-empty">
          <Landmark size={32} color="#d1d5db" />
          <div>No hay cuentas registradas.</div>
          <div style={{ fontSize: 13, color: '#9ca3af' }}>Crea la primera cuenta para empezar.</div>
        </div>
      ) : (
        <div className="cta-cards-grid">
          {cuentas.map(c => {
            const saldo    = Number(c.saldo ?? 0)
            const positivo = saldo >= 0
            return (
              <div key={c.id} className="cta-card" onClick={() => onSeleccionar(c)}>
                <div className="cta-card-icon">
                  <Landmark size={20} color="#1a3a5c" />
                </div>
                <div className="cta-card-body">
                  <div className="cta-card-nombre">{c.descripcion}</div>
                  <div className="cta-card-saldo" style={{ color: positivo ? '#166534' : '#991b1b' }}>
                    {positivo ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {formatGuarani(saldo)}
                  </div>
                  <div className="cta-card-count">{c.total_movimientos ?? 0} movimientos</div>
                </div>
                <div className="cta-card-arrow">›</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function VistaMovimientos({ cuenta, esAdmin, puedeEditar }) {
  const [filtros,      setFiltros]      = useState({ search: '', tipo: '', fecha_desde: '', fecha_hasta: '' })
  const [panelModo,    setPanelModo]    = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const [guardando,    setGuardando]    = useState(false)
  const [confirmMov,   setConfirmMov]   = useState(null)
  const searchDebounce                  = useRef(null)

  const { toast, showToast } = useToast()

  const { data, isLoading } = useMovimientos(cuenta.id, filtros)
  const movimientos   = data?.results ?? data ?? []
  const crearMov      = useCreateMovimiento()
  const actualizarMov = useUpdateMovimiento()
  const eliminarMov   = useDeleteMovimiento()

  const cerrarPanel = () => { setPanelModo(null); setSeleccionado(null) }

  const handleSearchChange = e => {
    const val = e.target.value
    clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => setFiltros(f => ({ ...f, search: val })), 300)
  }

  const handleGuardar = async (form) => {
    setGuardando(true)
    try {
      if (panelModo === 'crear') {
        await crearMov.mutateAsync(form)
        showToast('Movimiento registrado correctamente.', 'success')
      } else {
        await actualizarMov.mutateAsync({ id: seleccionado.id, ...form })
        showToast('Movimiento actualizado correctamente.', 'success')
      }
      cerrarPanel()
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminarConfirmado = async () => {
    try {
      await eliminarMov.mutateAsync(confirmMov.id)
      showToast('Movimiento eliminado.', 'success')
      if (seleccionado?.id === confirmMov.id) cerrarPanel()
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setConfirmMov(null)
    }
  }

  return (
    <>
      <div className="cta-vista cta-vista-drill">
        <div className="cta-drill-body">
          <div className="cta-tabla-wrap">
            <div className="cta-drill-toolbar">
              <div className="cta-search-wrap cta-mov-search">
                <Search size={13} color="#9ca3af" />
                <input
                  className="cta-search-input"
                  placeholder="Buscar comprobante…"
                  onChange={handleSearchChange}
                />
              </div>

              <select
                className="cta-filtro-select"
                value={filtros.tipo}
                onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))}
              >
                <option value="">Todos</option>
                <option value="ingreso">Ingresos</option>
                <option value="egreso">Egresos</option>
              </select>

              <input
                type="date"
                className="cta-filtro-date"
                value={filtros.fecha_desde}
                onChange={e => setFiltros(f => ({ ...f, fecha_desde: e.target.value }))}
                title="Desde"
                max="2099-12-31"
              />
              <input
                type="date"
                className="cta-filtro-date"
                value={filtros.fecha_hasta}
                onChange={e => setFiltros(f => ({ ...f, fecha_hasta: e.target.value }))}
                title="Hasta"
                max="2099-12-31"
              />

              {puedeEditar && (
                <button
                  className="cta-btn-primario"
                  onClick={() => { setSeleccionado(null); setPanelModo('crear') }}
                >
                  <Plus size={14} /> Nuevo
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="cta-loading">Cargando movimientos…</div>
            ) : movimientos.length === 0 ? (
              <div className="cta-empty">
                <div>Sin movimientos para los filtros aplicados.</div>
              </div>
            ) : (
              <table className="cta-tabla">
                <thead>
                  <tr>
                    <th className="cta-th">Fecha</th>
                    <th className="cta-th cta-th-comp">Nro. Comprobante</th>
                    <th className="cta-th" style={{ textAlign: 'right' }}>Ingreso</th>
                    <th className="cta-th" style={{ textAlign: 'right' }}>Egreso</th>
                    <th className="cta-th">Tipo</th>
                    {(puedeEditar || esAdmin) && <th className="cta-th" style={{ width: 72 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map(m => (
                    <tr
                      key={m.id}
                      className={`cta-tr ${seleccionado?.id === m.id ? 'active' : ''}`}
                    >
                      <td className="cta-td">{formatFecha(m.fecha)}</td>
                      <td className="cta-td cta-mono cta-td-comp">
                        {m.nro_comprobante || <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td className="cta-td cta-mono cta-ingreso">
                        {Number(m.monto_ingreso) > 0 ? formatGuarani(m.monto_ingreso) : ''}
                      </td>
                      <td className="cta-td cta-mono cta-egreso">
                        {Number(m.monto_egreso) > 0 ? formatGuarani(m.monto_egreso) : ''}
                      </td>
                      <td className="cta-td">
                        {m.tipo === 'ingreso' && <span className="cta-badge-tipo green">Ingreso</span>}
                        {m.tipo === 'egreso'  && <span className="cta-badge-tipo red">Egreso</span>}
                        {m.tipo === 'sin_movimiento' && <span className="cta-badge-tipo gray">—</span>}
                      </td>
                      {(puedeEditar || esAdmin) && (
                        <td className="cta-td cta-td-acciones">
                          {puedeEditar && !m.vfdc_id && !m.vrc_id && !m.ppdc_id && (
                            <button
                              className="cta-row-btn"
                              title="Editar"
                              onClick={() => { setSeleccionado(m); setPanelModo('editar') }}
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {esAdmin && (
                            <button
                              className="cta-row-btn danger"
                              title="Eliminar"
                              onClick={() => setConfirmMov(m)}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {panelModo && (
            <div className="cta-panel">
              <div className="cta-panel-header">
                <div className="cta-panel-titulo">
                  {panelModo === 'crear' ? 'Nuevo movimiento' : 'Editar movimiento'}
                </div>
                <button className="cta-panel-cerrar" onClick={cerrarPanel}>
                  <X size={16} />
                </button>
              </div>
              <PanelMovimiento
                modo={panelModo}
                item={seleccionado}
                ctaActual={cuenta}
                onGuardar={handleGuardar}
                onCancelar={cerrarPanel}
                guardando={guardando}
              />
            </div>
          )}
        </div>
      </div>

      <Toast toast={toast} />

      <ConfirmDialog
        isOpen={!!confirmMov}
        title="Eliminar movimiento"
        description={`¿Eliminar el movimiento del ${confirmMov ? formatFecha(confirmMov.fecha) : ''}? No se puede eliminar si fue generado por ventas, cobranzas o pagos a prestadores.`}
        onConfirm={handleEliminarConfirmado}
        onCancel={() => setConfirmMov(null)}
        loading={eliminarMov.isPending}
      />
    </>
  )
}

export default function CuentasMcbPage() {
  const [ctaActual,     setCtaActual]     = useState(null)
  const [panelCuenta,   setPanelCuenta]   = useState(null)
  const [guardando,     setGuardando]     = useState(false)
  const [confirmCta,    setConfirmCta]    = useState(false)
  const [cuentasSearch, setCuentasSearch] = useState('')
  const searchDebounce = useRef(null)

  const { toast, showToast } = useToast()
  const { user } = useAuth()
  const esAdmin     = user?.rol === 'admin'
  const puedeEditar = esAdmin || user?.rol === 'recepcionista'

  const { data: cuentasData, isLoading: cuentasLoading } = useCuentasMcb({ search: cuentasSearch })
  const cuentas = cuentasData?.results ?? cuentasData ?? []

  const crearCuenta      = useCreateCuenta()
  const actualizarCuenta = useUpdateCuenta()
  const eliminarCuenta   = useDeleteCuenta()

  const handleCuentasSearch = e => {
    const val = e.target.value
    clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => setCuentasSearch(val), 300)
  }

  const handleGuardarCuenta = async (form) => {
    setGuardando(true)
    try {
      if (panelCuenta === 'crear') {
        await crearCuenta.mutateAsync(form)
        showToast('Cuenta creada correctamente.', 'success')
      } else {
        await actualizarCuenta.mutateAsync({ id: ctaActual.id, ...form })
        setCtaActual(prev => ({ ...prev, ...form }))
        showToast('Cuenta actualizada correctamente.', 'success')
      }
      setPanelCuenta(null)
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminarCuentaConfirmado = async () => {
    try {
      await eliminarCuenta.mutateAsync(ctaActual.id)
      showToast('Cuenta eliminada.', 'success')
      setCtaActual(null)
      setPanelCuenta(null)
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setConfirmCta(false)
    }
  }

  const saldo    = Number(ctaActual?.saldo ?? 0)
  const positivo = saldo >= 0

  return (
    <>
      <style>{`
        .cta-page { display: flex; flex-direction: column; height: 100%; }

        .cta-header {
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px; padding: 20px 24px 16px; flex-wrap: wrap;
        }
        .cta-header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .cta-header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .cta-header-icon {
          width: 36px; height: 36px; background: #dbeafe; flex-shrink: 0;
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
        }
        .cta-header-title {
          font-size: 20px; font-weight: 600; color: #111827;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cta-header-sub {
          font-size: 13px; color: #9ca3af;
          display: flex; align-items: center; gap: 6px;
        }
        .cta-saldo-header {
          display: inline-flex; align-items: center; gap: 4px;
          font-weight: 700; font-family: 'Courier New', monospace;
        }

        .cta-btn-volver {
          display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
          border: 1.5px solid #1a3a5c; background: #fff; cursor: pointer;
          font-size: 13px; color: #1a3a5c; font-weight: 600;
          font-family: 'DM Sans', sans-serif; padding: 7px 14px;
          border-radius: 8px; transition: background 0.15s, color 0.15s;
          white-space: nowrap;
        }
        .cta-btn-volver:hover { background: #1a3a5c; color: #fff; }

        .cta-search-wrap {
          display: flex; align-items: center; gap: 8px;
          border: 1px solid #e5e7eb; border-radius: 8px;
          padding: 7px 12px; background: #fff;
          min-width: 180px; max-width: 280px; flex: 1 1 200px;
        }
        .cta-search-input {
          flex: 1; border: none; outline: none;
          font-size: 13px; font-family: 'DM Sans', sans-serif;
          color: #374151; background: transparent;
        }
        .cta-search-input::placeholder { color: #9ca3af; }

        .cta-vista {
          flex: 1; display: flex; flex-direction: column;
          overflow: hidden; padding: 0 24px 24px;
        }
        .cta-vista-drill { }

        .cta-cards-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px; overflow-y: auto;
        }
        .cta-card {
          display: flex; align-items: center; gap: 14px;
          background: #fff; border: 1px solid #e8edf2; border-radius: 12px;
          padding: 16px 14px; cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
        }
        .cta-card:hover {
          border-color: #bfdbfe;
          box-shadow: 0 4px 16px rgba(0,0,0,0.10);
          transform: translateY(-2px);
        }
        .cta-card-icon {
          width: 44px; height: 44px; background: #eff6ff;
          border-radius: 11px; display: flex; align-items: center;
          justify-content: center; flex-shrink: 0;
        }
        .cta-card-body { flex: 1; min-width: 0; }
        .cta-card-nombre {
          font-size: 14px; font-weight: 600; color: #111827;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cta-card-saldo {
          display: flex; align-items: center; gap: 5px;
          font-size: 15px; font-weight: 700; margin-top: 3px;
          font-family: 'DM Mono', 'Courier New', monospace;
        }
        .cta-card-count { font-size: 12px; color: #9ca3af; margin-top: 2px; }
        .cta-card-arrow { font-size: 18px; color: #9ca3af; flex-shrink: 0; transition: color 0.2s; }
        .cta-card:hover .cta-card-arrow { color: #1a3a5c; }

        .cta-drill-body { flex: 1; display: flex; gap: 14px; overflow: hidden; }

        .cta-drill-toolbar {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          padding: 10px 12px; border-bottom: 1px solid #f3f4f6;
        }
        .cta-mov-search { flex: 0 1 240px; min-width: 0; max-width: 240px; }

        .cta-filtro-select, .cta-filtro-date {
          border: 1px solid #e5e7eb; border-radius: 7px;
          padding: 7px 8px; font-size: 12.5px;
          font-family: 'DM Sans', sans-serif; outline: none;
          background: #fff; color: #374151;
        }
        .cta-filtro-select:focus, .cta-filtro-date:focus { border-color: #1a3a5c; }

        .cta-tabla-wrap {
          flex: 1; overflow-y: auto;
          border: 1px solid #e8edf2; border-radius: 10px;
          background: #fff; display: flex; flex-direction: column;
        }
        .cta-tabla { width: 100%; border-collapse: collapse; }
        .cta-th {
          text-align: left; padding: 10px 12px;
          font-size: 11.5px; font-weight: 600; color: #6b7280;
          text-transform: uppercase; letter-spacing: .04em;
          background: #f8fafc; border-bottom: 1px solid #e8edf2;
          position: sticky; top: 0;
        }
        .cta-td {
          padding: 11px 12px; font-size: 13px; color: #374151;
          vertical-align: middle; border-bottom: 1px solid #f3f4f6;
        }
        .cta-tr:last-child .cta-td { border-bottom: none; }
        .cta-tr:hover { background: #f9fafb; }
        .cta-tr.active { background: #eff6ff; }

        .cta-mono { font-family: 'Courier New', monospace; }
        .cta-ingreso { text-align: right; color: #166534; font-weight: 600; }
        .cta-egreso  { text-align: right; color: #991b1b; font-weight: 600; }
        .cta-td-acciones { display: flex; gap: 4px; justify-content: flex-end; }

        .cta-row-btn {
          width: 28px; height: 28px; border-radius: 6px; border: 1px solid #e5e7eb;
          background: #fff; display: flex; align-items: center;
          justify-content: center; cursor: pointer; color: #6b7280;
          transition: background 0.12s;
        }
        .cta-row-btn:hover { background: #f3f4f6; color: #374151; }
        .cta-row-btn.danger { color: #dc2626; border-color: #fecaca; }
        .cta-row-btn.danger:hover { background: #fef2f2; }

        .cta-badge-tipo {
          display: inline-block; padding: 2px 9px; border-radius: 20px;
          font-size: 11.5px; font-weight: 500;
        }
        .cta-badge-tipo.green { background: #dcfce7; color: #166534; }
        .cta-badge-tipo.red   { background: #fee2e2; color: #991b1b; }
        .cta-badge-tipo.gray  { background: #f3f4f6; color: #6b7280; }

        .cta-panel {
          width: 320px; flex-shrink: 0;
          border: 1px solid #e8edf2; border-radius: 10px;
          background: #fff; display: flex; flex-direction: column; overflow: hidden;
        }
        .cta-panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 16px; border-bottom: 1px solid #e8edf2; flex-shrink: 0;
        }
        .cta-panel-titulo { font-size: 14px; font-weight: 600; color: #111827; }
        .cta-panel-cerrar {
          border: none; background: none; cursor: pointer;
          color: #9ca3af; padding: 4px; border-radius: 6px; display: flex;
        }
        .cta-panel-cerrar:hover { color: #374151; }
        .cta-panel-body {
          flex: 1; overflow-y: auto; padding: 16px;
          display: flex; flex-direction: column; gap: 14px;
        }

        .cta-form-group { display: flex; flex-direction: column; gap: 5px; }
        .cta-label { font-size: 12.5px; font-weight: 500; color: #374151; }
        .cta-input {
          border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px;
          font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none;
          background: #fff; color: #374151;
        }
        .cta-input:focus { border-color: #1a3a5c; }
        .cta-input-error { border-color: #fca5a5; }
        .cta-error-msg { font-size: 11.5px; color: #dc2626; }

        .cta-cuenta-readonly {
          display: flex; align-items: center; gap: 6px;
          background: #f8fafc; border: 1px solid #e8edf2; border-radius: 8px;
          padding: 8px 10px; font-size: 13px; color: #374151;
        }

        .cta-tipo-toggle {
          display: flex; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;
        }
        .cta-tipo-btn {
          flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
          padding: 9px 10px; border: none; background: #fff;
          font-size: 13px; font-family: 'DM Sans', sans-serif; color: #6b7280;
          cursor: pointer; transition: background 0.15s, color 0.15s; font-weight: 500;
        }
        .cta-tipo-btn + .cta-tipo-btn { border-left: 1px solid #e5e7eb; }
        .cta-tipo-btn.ingreso-btn.active { background: #dcfce7; color: #166534; }
        .cta-tipo-btn.egreso-btn.active  { background: #fee2e2; color: #991b1b; }
        .cta-tipo-btn:not(.active):hover { background: #f9fafb; }

        .cta-panel-acciones {
          display: flex; gap: 10px; justify-content: flex-end;
          padding-top: 4px; margin-top: auto;
        }

        .cta-btn-primario {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 8px 16px; border-radius: 8px; border: none;
          background: #1a3a5c; color: #fff;
          font-size: 13px; font-family: 'DM Sans', sans-serif;
          font-weight: 500; cursor: pointer; white-space: nowrap;
        }
        .cta-btn-primario:hover:not(:disabled) { background: #15304d; }
        .cta-btn-primario:disabled { background: #9ca3af; cursor: default; }
        .cta-btn-secundario {
          padding: 8px 14px; border-radius: 8px;
          border: 1px solid #e5e7eb; background: #fff; color: #374151;
          font-size: 13px; font-family: 'DM Sans', sans-serif;
          font-weight: 500; cursor: pointer;
        }
        .cta-btn-secundario:hover { background: #f9fafb; }

        .cta-btn-icon-edit, .cta-btn-icon-del {
          width: 32px; height: 32px; border-radius: 8px; border: 1px solid;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background 0.12s;
        }
        .cta-btn-icon-edit { border-color: #bfdbfe; background: #fff; color: #1a3a5c; }
        .cta-btn-icon-edit:hover { background: #eff6ff; }
        .cta-btn-icon-del  { border-color: #fecaca; background: #fff; color: #dc2626; }
        .cta-btn-icon-del:hover  { background: #fef2f2; }

        .cta-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 8px;
          color: #6b7280; font-size: 14px; flex: 1; padding: 48px;
          text-align: center;
        }
        .cta-loading { text-align: center; color: #9ca3af; padding: 48px; font-size: 13px; }

        .cta-panel-overlay {
          position: fixed; inset: 0; z-index: 100;
          display: flex; align-items: flex-start; justify-content: flex-end;
          pointer-events: none;
        }
        .cta-panel-overlay .cta-panel {
          pointer-events: auto;
          height: 100%; border-radius: 0;
          width: 340px; border-left: 1px solid #e8edf2;
          border-top: none; border-bottom: none; border-right: none;
          box-shadow: -4px 0 20px rgba(0,0,0,0.08);
        }

        @media (max-width: 1200px) {
          .cta-cards-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 1024px) {
          .cta-cards-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 767px) {
          .cta-cards-grid { grid-template-columns: 1fr; }
          .cta-header { padding: 16px 16px 12px; }
          .cta-vista  { padding: 0 16px 16px; }

          .cta-panel-overlay { pointer-events: auto; }
          .cta-panel-overlay .cta-panel { width: 100%; border-left: none; box-shadow: none; }

          .cta-tabla-wrap { overflow-x: auto; }
          .cta-th-comp, .cta-td-comp { display: none; }

          .cta-drill-body .cta-panel {
            position: fixed; inset: 0; z-index: 50;
            width: 100% !important; border-radius: 0; border: none;
            box-shadow: 0 4px 24px rgba(0,0,0,0.12);
          }

          .cta-mov-search { flex: 1 1 0; max-width: none; }
          .cta-header-right .cta-search-wrap { min-width: 0; flex: 1; }
        }
      `}</style>

      <div className="cta-page">
        <div className="cta-header">
          {!ctaActual ? (
            <>
              <div className="cta-header-left">
                <div className="cta-header-icon">
                  <Landmark size={18} color="#1a3a5c" />
                </div>
                <div>
                  <div className="cta-header-title">Cuentas Caja/Banco</div>
                  <div className="cta-header-sub">Gestión de cuentas de caja y banco</div>
                </div>
              </div>
              <div className="cta-header-right">
                <div className="cta-search-wrap">
                  <Search size={14} color="#9ca3af" />
                  <input
                    className="cta-search-input"
                    placeholder="Buscar cuenta…"
                    onChange={handleCuentasSearch}
                  />
                </div>
                {esAdmin && (
                  <button className="cta-btn-primario" onClick={() => setPanelCuenta('crear')}>
                    <Plus size={15} /> Nueva cuenta
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="cta-header-left">
                <button
                  className="cta-btn-volver"
                  onClick={() => { setCtaActual(null); setPanelCuenta(null) }}
                >
                  <ArrowLeft size={15} /> Cuentas
                </button>
                <div className="cta-header-icon">
                  <Landmark size={18} color="#1a3a5c" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="cta-header-title">{ctaActual.descripcion}</div>
                  <div className="cta-header-sub">
                    <span className="cta-saldo-header" style={{ color: positivo ? '#166534' : '#991b1b' }}>
                      {positivo ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {formatGuarani(saldo)}
                    </span>
                    <span style={{ color: '#d1d5db' }}>·</span>
                    <span>{ctaActual.total_movimientos ?? 0} movimientos</span>
                  </div>
                </div>
              </div>
              {esAdmin && (
                <div className="cta-header-right">
                  <button className="cta-btn-icon-edit" onClick={() => setPanelCuenta('editar')} title="Editar cuenta">
                    <Pencil size={14} />
                  </button>
                  <button className="cta-btn-icon-del" onClick={() => setConfirmCta(true)} title="Eliminar cuenta">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {!ctaActual ? (
          <VistaCuentas
            cuentas={cuentas}
            isLoading={cuentasLoading}
            onSeleccionar={c => { setCtaActual(c); setPanelCuenta(null) }}
          />
        ) : (
          <VistaMovimientos
            cuenta={ctaActual}
            esAdmin={esAdmin}
            puedeEditar={puedeEditar}
          />
        )}
      </div>

      {panelCuenta && (
        <div className="cta-panel-overlay">
          <div className="cta-panel">
            <div className="cta-panel-header">
              <div className="cta-panel-titulo">
                {panelCuenta === 'crear' ? 'Nueva cuenta' : `Editar: ${ctaActual?.descripcion}`}
              </div>
              <button className="cta-panel-cerrar" onClick={() => setPanelCuenta(null)}>
                <X size={16} />
              </button>
            </div>
            <PanelCuenta
              modo={panelCuenta}
              item={ctaActual}
              onGuardar={handleGuardarCuenta}
              onCancelar={() => setPanelCuenta(null)}
              guardando={guardando}
            />
          </div>
        </div>
      )}

      <Toast toast={toast} />

      <ConfirmDialog
        isOpen={confirmCta}
        title="Eliminar cuenta"
        description={`¿Eliminar la cuenta "${ctaActual?.descripcion}"? Solo se puede eliminar si no tiene movimientos activos.`}
        onConfirm={handleEliminarCuentaConfirmado}
        onCancel={() => setConfirmCta(false)}
        loading={eliminarCuenta.isPending}
      />
    </>
  )
}
