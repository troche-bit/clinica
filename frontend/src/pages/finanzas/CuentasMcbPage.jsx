import { useState } from 'react'
import { Landmark, ArrowLeft, Plus, Search, Pencil, Trash2, X, TrendingUp, TrendingDown } from 'lucide-react'
import { useCuentasMcb, useCreateCuenta, useUpdateCuenta, useDeleteCuenta } from '../../hooks/finanzas/useCuentasMcb'
import { useMovimientos, useCreateMovimiento, useUpdateMovimiento, useDeleteMovimiento } from '../../hooks/finanzas/useMovimientos'
import Modal from '../../components/ui/Modal'
import Toast from '../../components/ui/Toast'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../hooks/useToast'
import { extraerMensajeError } from '../../utils/errores'

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
          onClick={() => { if (validar()) onGuardar(form) }}
        >
          {guardando ? 'Guardando…' : modo === 'crear' ? 'Crear cuenta' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

const MOV_VACIO = { fecha: hoy(), voucher: '', monto_ingreso: '', monto_egreso: '', vuelto: '' }

function PanelMovimiento({ modo, item, ctaActual, onGuardar, onCancelar, guardando }) {
  const [form, setForm] = useState(
    modo === 'crear'
      ? MOV_VACIO
      : {
          fecha:          item?.fecha          || hoy(),
          voucher:        item?.voucher        || '',
          monto_ingreso:  item?.monto_ingreso  ?? '',
          monto_egreso:   item?.monto_egreso   ?? '',
          vuelto:         item?.vuelto         ?? '',
        }
  )
  const [errores, setErrores] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const soloNumero = (v) => v.replace(/[^\d.]/g, '')

  const validar = () => {
    const e = {}
    if (!form.fecha) e.fecha = 'La fecha es requerida.'
    const ing = Number(form.monto_ingreso) || 0
    const egr = Number(form.monto_egreso)  || 0
    if (ing === 0 && egr === 0) e.montos = 'Debe ingresar monto de ingreso o egreso.'
    if (ing > 0 && egr > 0)    e.montos = 'Solo puede tener ingreso o egreso, no ambos.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validar()) return
    onGuardar({
      cta:           ctaActual.id,
      fecha:         form.fecha,
      voucher:       form.voucher || null,
      monto_ingreso: Number(form.monto_ingreso) || 0,
      monto_egreso:  Number(form.monto_egreso)  || 0,
      vuelto:        Number(form.vuelto)         || 0,
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
        <label className="cta-label">Fecha *</label>
        <input
          type="date"
          className={`cta-input ${errores.fecha ? 'cta-input-error' : ''}`}
          value={form.fecha}
          onChange={e => set('fecha', e.target.value)}
        />
        {errores.fecha && <span className="cta-error-msg">{errores.fecha}</span>}
      </div>

      <div className="cta-form-group">
        <label className="cta-label">Voucher / Referencia</label>
        <input
          className="cta-input"
          placeholder="Nro. voucher o referencia (opcional)"
          value={form.voucher}
          onChange={e => set('voucher', e.target.value)}
        />
      </div>

      <div className="cta-grid-2">
        <div className="cta-form-group">
          <label className="cta-label">Monto ingreso</label>
          <input
            className={`cta-input cta-mono ${errores.montos ? 'cta-input-error' : ''}`}
            placeholder="0"
            value={form.monto_ingreso}
            onChange={e => set('monto_ingreso', soloNumero(e.target.value))}
          />
        </div>
        <div className="cta-form-group">
          <label className="cta-label">Monto egreso</label>
          <input
            className={`cta-input cta-mono ${errores.montos ? 'cta-input-error' : ''}`}
            placeholder="0"
            value={form.monto_egreso}
            onChange={e => set('monto_egreso', soloNumero(e.target.value))}
          />
        </div>
      </div>
      {errores.montos && <span className="cta-error-msg">{errores.montos}</span>}

      <div className="cta-form-group">
        <label className="cta-label">Vuelto</label>
        <input
          className="cta-input cta-mono"
          placeholder="0"
          value={form.vuelto}
          onChange={e => set('vuelto', soloNumero(e.target.value))}
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

function VistaCuentas({ onSeleccionar, onNuevaCuenta }) {
  const [search, setSearch] = useState('')
  const { data, isLoading } = useCuentasMcb({ search })
  const cuentas = data?.results ?? data ?? []

  return (
    <div className="cta-vista">
      <div className="cta-toolbar">
        <div className="cta-search-wrap">
          <Search size={14} color="#9ca3af" />
          <input
            className="cta-search-input"
            placeholder="Buscar cuenta…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className="cta-btn-primario" onClick={onNuevaCuenta}>
          <Plus size={15} /> Nueva cuenta
        </button>
      </div>

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
            const saldo = Number(c.saldo ?? 0)
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

function VistaMovimientos({ cuenta, onVolver, onEditarCuenta, onEliminarCuenta }) {
  const [filtros,      setFiltros]      = useState({ search: '', tipo: '', fecha_desde: '', fecha_hasta: '' })
  const [searchInput,  setSearchInput]  = useState('')
  const [panelModo,    setPanelModo]    = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const [guardando,    setGuardando]    = useState(false)
  const [confirmMov,   setConfirmMov]   = useState(null)

  const { toast, showToast } = useToast()

  const { data, isLoading } = useMovimientos(cuenta.id, filtros)
  const movimientos   = data?.results ?? data ?? []
  const crearMov      = useCreateMovimiento()
  const actualizarMov = useUpdateMovimiento()
  const eliminarMov   = useDeleteMovimiento()

  const cerrarPanel = () => { setPanelModo(null); setSeleccionado(null) }

  const handleBuscar = (e) => {
    e.preventDefault()
    setFiltros(f => ({ ...f, search: searchInput }))
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

  const saldo    = Number(cuenta.saldo ?? 0)
  const positivo = saldo >= 0

  return (
    <>
      <div className="cta-vista cta-vista-drill">
        <div className="cta-drill-topbar">
          <button className="cta-btn-volver" onClick={onVolver}>
            <ArrowLeft size={15} /> Cuentas
          </button>
          <span className="cta-breadcrumb">
            <span className="cta-bc-sep">/</span>
            {cuenta.descripcion}
          </span>
        </div>

        <div className="cta-cuenta-bar">
          <div className="cta-cuenta-bar-left">
            <div className="cta-cuenta-bar-icon">
              <Landmark size={18} color="#1a3a5c" />
            </div>
            <div>
              <div className="cta-cuenta-bar-nombre">{cuenta.descripcion}</div>
              <div className="cta-cuenta-bar-sub">
                <span className="cta-saldo-valor" style={{ color: positivo ? '#166534' : '#991b1b' }}>
                  Saldo: {formatGuarani(saldo)}
                </span>
                <span style={{ color: '#d1d5db' }}>·</span>
                <span>{cuenta.total_movimientos ?? 0} movimientos</span>
              </div>
            </div>
          </div>
          <div className="cta-cuenta-bar-actions">
            <button className="cta-btn-icon-edit" onClick={onEditarCuenta} title="Editar cuenta">
              <Pencil size={14} />
            </button>
            <button className="cta-btn-icon-del" onClick={onEliminarCuenta} title="Eliminar cuenta">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="cta-drill-body">
          <div className="cta-tabla-wrap">
            <div className="cta-drill-toolbar">
              <form className="cta-search-form" onSubmit={handleBuscar}>
                <div className="cta-search-wrap" style={{ flex: 1 }}>
                  <Search size={13} color="#9ca3af" />
                  <input
                    className="cta-search-input"
                    placeholder="Buscar voucher…"
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                  />
                </div>
                <button type="submit" className="cta-btn-buscar">
                  <Search size={13} /> Buscar
                </button>
              </form>

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
              />
              <input
                type="date"
                className="cta-filtro-date"
                value={filtros.fecha_hasta}
                onChange={e => setFiltros(f => ({ ...f, fecha_hasta: e.target.value }))}
                title="Hasta"
              />

              <button
                className="cta-btn-primario"
                onClick={() => { setSeleccionado(null); setPanelModo('crear') }}
              >
                <Plus size={14} /> Nuevo movimiento
              </button>
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
                    <th className="cta-th">Voucher</th>
                    <th className="cta-th" style={{ textAlign: 'right' }}>Ingreso</th>
                    <th className="cta-th" style={{ textAlign: 'right' }}>Egreso</th>
                    <th className="cta-th" style={{ textAlign: 'right' }}>Vuelto</th>
                    <th className="cta-th">Tipo</th>
                    <th className="cta-th" style={{ width: 72 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map(m => (
                    <tr
                      key={m.id}
                      className={`cta-tr ${seleccionado?.id === m.id ? 'active' : ''}`}
                    >
                      <td className="cta-td">{formatFecha(m.fecha)}</td>
                      <td className="cta-td cta-mono">{m.voucher || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                      <td className="cta-td cta-mono cta-ingreso">
                        {Number(m.monto_ingreso) > 0 ? formatGuarani(m.monto_ingreso) : ''}
                      </td>
                      <td className="cta-td cta-mono cta-egreso">
                        {Number(m.monto_egreso) > 0 ? formatGuarani(m.monto_egreso) : ''}
                      </td>
                      <td className="cta-td cta-mono" style={{ textAlign: 'right', color: '#6b7280' }}>
                        {Number(m.vuelto) > 0 ? formatGuarani(m.vuelto) : ''}
                      </td>
                      <td className="cta-td">
                        {m.tipo === 'ingreso' && <span className="cta-badge-tipo green">Ingreso</span>}
                        {m.tipo === 'egreso'  && <span className="cta-badge-tipo red">Egreso</span>}
                        {m.tipo === 'sin_movimiento' && <span className="cta-badge-tipo gray">—</span>}
                      </td>
                      <td className="cta-td cta-td-acciones">
                        <button
                          className="cta-row-btn"
                          title="Editar"
                          onClick={() => { setSeleccionado(m); setPanelModo('editar') }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="cta-row-btn danger"
                          title="Eliminar"
                          onClick={() => setConfirmMov(m)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
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
        description={`¿Eliminar el movimiento del ${confirmMov ? formatFecha(confirmMov.fecha) : ''}? Esta acción no se puede deshacer.`}
        onConfirm={handleEliminarConfirmado}
        onCancel={() => setConfirmMov(null)}
        loading={eliminarMov.isPending}
      />
    </>
  )
}

export default function CuentasMcbPage() {
  const [ctaActual,   setCtaActual]   = useState(null)
  const [panelCuenta, setPanelCuenta] = useState(null)
  const [guardando,   setGuardando]   = useState(false)
  const [confirmCta,  setConfirmCta]  = useState(false)

  const { toast, showToast } = useToast()
  const crearCuenta    = useCreateCuenta()
  const actualizarCuenta = useUpdateCuenta()
  const eliminarCuenta = useDeleteCuenta()

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

  return (
    <>
      <style>{`
        .cta-page { display: flex; flex-direction: column; height: 100%; }

        .cta-header {
          display: flex; align-items: center;
          padding: 20px 24px 0;
        }
        .cta-header-icon {
          width: 36px; height: 36px; background: #dbeafe;
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
          margin-right: 12px;
        }
        .cta-header-title { font-size: 20px; font-weight: 600; color: #111827; }
        .cta-header-sub   { font-size: 13px; color: #9ca3af; }

        .cta-vista {
          flex: 1; display: flex; flex-direction: column;
          overflow: hidden; padding: 14px 24px 24px;
        }
        .cta-vista-drill { gap: 0; }

        .cta-toolbar {
          display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
        }
        .cta-search-wrap {
          flex: 1; max-width: 320px;
          display: flex; align-items: center; gap: 8px;
          border: 1px solid #e5e7eb; border-radius: 8px;
          padding: 7px 12px; background: #fff;
        }
        .cta-search-input {
          flex: 1; border: none; outline: none;
          font-size: 13px; font-family: 'DM Sans', sans-serif;
          color: #374151; background: transparent;
        }
        .cta-search-input::placeholder { color: #9ca3af; }

        .cta-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px; overflow-y: auto;
        }
        .cta-card {
          display: flex; align-items: center; gap: 14px;
          background: #fff; border: 1px solid #e8edf2; border-radius: 12px;
          padding: 16px 14px; cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .cta-card:hover {
          border-color: #bfdbfe;
          box-shadow: 0 2px 8px rgba(26,58,92,0.07);
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
        .cta-card-arrow { font-size: 18px; color: #9ca3af; flex-shrink: 0; }

        .cta-drill-topbar {
          display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
        }
        .cta-btn-volver {
          display: inline-flex; align-items: center; gap: 5px;
          border: none; background: none; cursor: pointer;
          font-size: 13px; color: #1a3a5c; font-weight: 500;
          font-family: 'DM Sans', sans-serif; padding: 4px 8px;
          border-radius: 6px; transition: background 0.12s;
        }
        .cta-btn-volver:hover { background: #eff6ff; }
        .cta-breadcrumb { font-size: 13px; color: #374151; }
        .cta-bc-sep { color: #d1d5db; margin-right: 8px; }

        .cta-cuenta-bar {
          display: flex; align-items: center; justify-content: space-between;
          background: #fff; border: 1px solid #e8edf2; border-radius: 10px;
          padding: 12px 16px; margin-bottom: 14px;
        }
        .cta-cuenta-bar-left { display: flex; align-items: center; gap: 12px; }
        .cta-cuenta-bar-icon {
          width: 38px; height: 38px; background: #eff6ff;
          border-radius: 9px; display: flex; align-items: center; justify-content: center;
        }
        .cta-cuenta-bar-nombre { font-size: 15px; font-weight: 600; color: #111827; }
        .cta-cuenta-bar-sub {
          display: flex; align-items: center; gap: 8px;
          font-size: 12.5px; color: #6b7280; margin-top: 1px;
        }
        .cta-saldo-valor { font-weight: 700; font-family: 'Courier New', monospace; }
        .cta-cuenta-bar-actions { display: flex; gap: 6px; }
        .cta-btn-icon-edit, .cta-btn-icon-del {
          width: 30px; height: 30px; border-radius: 7px; border: 1px solid;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background 0.12s;
        }
        .cta-btn-icon-edit { border-color: #bfdbfe; background: #fff; color: #1a3a5c; }
        .cta-btn-icon-edit:hover { background: #eff6ff; }
        .cta-btn-icon-del  { border-color: #fecaca; background: #fff; color: #dc2626; }
        .cta-btn-icon-del:hover  { background: #fef2f2; }

        .cta-drill-body { flex: 1; display: flex; gap: 14px; overflow: hidden; }

        .cta-drill-toolbar {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          padding: 10px 12px; border-bottom: 1px solid #f3f4f6;
        }
        .cta-search-form { display: flex; gap: 8px; flex: 1; min-width: 200px; }
        .cta-btn-buscar {
          display: flex; align-items: center; gap: 4px;
          padding: 7px 12px; border-radius: 7px; border: none;
          background: #1a3a5c; color: #fff;
          font-size: 12.5px; font-family: 'DM Sans', sans-serif;
          font-weight: 500; cursor: pointer;
        }
        .cta-btn-buscar:hover { background: #15304d; }
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
        .cta-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

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
        }
        .cta-panel-backdrop {
          position: absolute; inset: 0; background: rgba(0,0,0,0.15);
        }
        .cta-panel-overlay .cta-panel {
          position: relative; z-index: 1;
          height: 100%; border-radius: 0; width: 340px;
          border-left: 1px solid #e8edf2;
          border-top: none; border-bottom: none; border-right: none;
        }
      `}</style>

      <div className="cta-page">
        <div className="cta-header">
          <div className="cta-header-icon">
            <Landmark size={18} color="#1a3a5c" />
          </div>
          <div>
            <div className="cta-header-title">Cuentas Caja/Banco</div>
            <div className="cta-header-sub">
              {ctaActual
                ? `Movimientos de "${ctaActual.descripcion}"`
                : 'Gestión de cuentas de caja y banco'}
            </div>
          </div>
        </div>

        {!ctaActual ? (
          <VistaCuentas
            onSeleccionar={c => { setCtaActual(c); setPanelCuenta(null) }}
            onNuevaCuenta={() => setPanelCuenta('crear')}
          />
        ) : (
          <VistaMovimientos
            cuenta={ctaActual}
            onVolver={() => { setCtaActual(null); setPanelCuenta(null) }}
            onEditarCuenta={() => setPanelCuenta('editar')}
            onEliminarCuenta={() => setConfirmCta(true)}
          />
        )}
      </div>

      {panelCuenta && (
        <div className="cta-panel-overlay">
          <div className="cta-panel-backdrop" onClick={() => setPanelCuenta(null)} />
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
