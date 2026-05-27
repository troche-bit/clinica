import { useState, useRef } from 'react'
import { Layers, ChevronRight, ArrowLeft, Plus, Search, Pencil, Trash2, X, Package } from 'lucide-react'
import { useGrupos, useCreateGrupo, useUpdateGrupo, useDeleteGrupo } from '../../hooks/stock/useGrupos'
import { useProductos, useCreateProducto, useUpdateProducto, useDeleteProducto } from '../../hooks/stock/useProductos'
import Toast from '../../components/ui/Toast'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../hooks/useToast'
import { extraerMensajeError } from '../../utils/errores'
import { useAuth } from '../../context/AuthContext'

const IMPUESTO_OPTS = [
  { value: '10',     label: 'IVA 10%' },
  { value: '5',      label: 'IVA 5%' },
  { value: 'exenta', label: 'Exenta' },
]

function badgeImpuesto(impuesto) {
  if (impuesto === '10') return <span className="grp-badge-imp blue">IVA 10%</span>
  if (impuesto === '5')  return <span className="grp-badge-imp green">IVA 5%</span>
  return <span className="grp-badge-imp gray">Exenta</span>
}

function Switch({ checked, onChange }) {
  return (
    <div className="grp-switch-wrap">
      <label className="grp-switch">
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span className="grp-switch-pill" />
      </label>
      <span className="grp-switch-label">{checked ? 'Activo' : 'Inactivo'}</span>
    </div>
  )
}

function PanelGrupo({ modo, item, onGuardar, onCancelar, guardando }) {
  const [form, setForm] = useState(
    modo === 'crear'
      ? { descripcion: '', activo: true }
      : { descripcion: item?.descripcion || '', activo: item?.activo ?? true }
  )
  const [errores, setErrores] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validar = () => {
    const e = {}
    if (!form.descripcion.trim()) e.descripcion = 'La descripción es requerida.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validar()) return
    onGuardar({ ...form, descripcion: form.descripcion.trim() })
  }

  return (
    <div className="grp-panel-body">
      <div className="grp-form-group">
        <label className="grp-label">Descripción *</label>
        <input
          className={`grp-input ${errores.descripcion ? 'grp-input-error' : ''}`}
          placeholder="Nombre del grupo"
          value={form.descripcion}
          onChange={e => set('descripcion', e.target.value)}
          autoFocus
        />
        {errores.descripcion && <span className="grp-error-msg">{errores.descripcion}</span>}
      </div>

      <div className="grp-form-group">
        <label className="grp-label">Estado</label>
        <Switch checked={form.activo} onChange={e => set('activo', e.target.checked)} />
      </div>

      <div className="grp-panel-acciones">
        <button className="grp-btn-secundario" onClick={onCancelar} disabled={guardando}>Cancelar</button>
        <button className="grp-btn-primario" onClick={handleSubmit} disabled={guardando}>
          {guardando ? 'Guardando…' : modo === 'crear' ? 'Crear grupo' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

function PanelProducto({ modo, item, grupoActual, onGuardar, onCancelar, guardando }) {
  const [form, setForm] = useState(
    modo === 'crear'
      ? { descripcion: '', impuesto: '10', activo: true }
      : { descripcion: item?.descripcion || '', impuesto: item?.impuesto || '10', activo: item?.activo ?? true }
  )
  const [errores, setErrores] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validar = () => {
    const e = {}
    if (!form.descripcion.trim()) e.descripcion = 'La descripción es requerida.'
    if (!form.impuesto)           e.impuesto    = 'Seleccione un tipo de impuesto.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validar()) return
    onGuardar({ ...form, descripcion: form.descripcion.trim(), grupo: grupoActual.id })
  }

  return (
    <div className="grp-panel-body">
      <div className="grp-form-group">
        <label className="grp-label">Grupo asignado</label>
        <div className="grp-grupo-readonly">
          <Layers size={14} color="#1a3a5c" />
          <strong>{grupoActual.descripcion}</strong>
        </div>
      </div>

      <div className="grp-form-group">
        <label className="grp-label">Descripción *</label>
        <input
          className={`grp-input ${errores.descripcion ? 'grp-input-error' : ''}`}
          placeholder="Nombre del producto o servicio"
          value={form.descripcion}
          onChange={e => set('descripcion', e.target.value)}
          autoFocus
        />
        {errores.descripcion && <span className="grp-error-msg">{errores.descripcion}</span>}
      </div>

      <div className="grp-form-group">
        <label className="grp-label">Tipo de impuesto *</label>
        <select
          className={`grp-select ${errores.impuesto ? 'grp-input-error' : ''}`}
          value={form.impuesto}
          onChange={e => set('impuesto', e.target.value)}
        >
          {IMPUESTO_OPTS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {errores.impuesto && <span className="grp-error-msg">{errores.impuesto}</span>}
      </div>

      <div className="grp-form-group">
        <label className="grp-label">Estado</label>
        <Switch checked={form.activo} onChange={e => set('activo', e.target.checked)} />
      </div>

      <div className="grp-panel-acciones">
        <button className="grp-btn-secundario" onClick={onCancelar} disabled={guardando}>Cancelar</button>
        <button className="grp-btn-primario" onClick={handleSubmit} disabled={guardando}>
          {guardando ? 'Guardando…' : modo === 'crear' ? 'Agregar producto' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

function VistaGrupos({ grupos, isLoading, onSeleccionarGrupo }) {
  return (
    <div className="grp-vista">
      {isLoading ? (
        <div className="grp-loading">Cargando grupos…</div>
      ) : grupos.length === 0 ? (
        <div className="grp-empty">
          <Layers size={32} color="#d1d5db" />
          <div>No hay grupos registrados.</div>
          <div style={{ fontSize: 13, color: '#9ca3af' }}>Crea el primer grupo para empezar.</div>
        </div>
      ) : (
        <div className="grp-cards-grid">
          {grupos.map(g => (
            <div key={g.id} className="grp-card" onClick={() => onSeleccionarGrupo(g)}>
              <div className="grp-card-icon">
                <Layers size={28} color="#1a3a5c" />
              </div>
              <div className="grp-card-body">
                <div className="grp-card-nombre">{g.descripcion}</div>
                <div className="grp-card-meta">
                  {(g.total_productos ?? 0) > 0 ? (
                    <span className="grp-badge-count blue">{g.total_productos} productos activos</span>
                  ) : (
                    <span className="grp-badge-count gray">Sin productos</span>
                  )}
                  <span className={`grp-badge-estado ${g.activo ? 'green' : 'gray'}`}>
                    {g.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="grp-card-arrow" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function VistaProductos({ grupo, esAdmin, puedeEditar }) {
  const [search,       setSearch]       = useState('')
  const debounceRef                     = useRef(null)
  const [panelModo,    setPanelModo]    = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const [guardando,    setGuardando]    = useState(false)
  const [confirmProd,  setConfirmProd]  = useState(null)

  const { toast, showToast } = useToast()

  const { data, isLoading } = useProductos(grupo.id, { search })
  const productos      = data?.results ?? data ?? []
  const crearProd      = useCreateProducto()
  const actualizarProd = useUpdateProducto()
  const eliminarProd   = useDeleteProducto()

  const handleSearchChange = (e) => {
    const val = e.target.value
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearch(val), 300)
  }
  const cerrarPanel = () => { setPanelModo(null); setSeleccionado(null) }

  const handleGuardar = async (form) => {
    setGuardando(true)
    try {
      if (panelModo === 'crear') {
        await crearProd.mutateAsync(form)
        showToast('Producto agregado correctamente.', 'success')
      } else {
        await actualizarProd.mutateAsync({ id: seleccionado.id, ...form })
        showToast('Producto actualizado correctamente.', 'success')
      }
      cerrarPanel()
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminarConfirmado = async () => {
    if (!confirmProd) return
    try {
      await eliminarProd.mutateAsync(confirmProd.id)
      showToast('Producto eliminado.', 'success')
      if (seleccionado?.id === confirmProd.id) cerrarPanel()
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setConfirmProd(null)
    }
  }

  return (
    <>
      <div className="grp-vista">
        <div className="grp-drill-body">
          <div className="grp-tabla-wrap">
            <div className="grp-drill-toolbar">
              <div className="grp-search-wrap grp-prod-search">
                <Search size={13} color="#9ca3af" className="grp-search-icon" />
                <input
                  className="grp-search-input"
                  placeholder="Buscar producto…"
                  onChange={handleSearchChange}
                />
              </div>
              {puedeEditar && (
                <button
                  className="grp-btn-primario"
                  onClick={() => { setSeleccionado(null); setPanelModo('crear') }}
                >
                  <Plus size={14} /> Nuevo producto
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="grp-loading">Cargando productos…</div>
            ) : productos.length === 0 ? (
              <div className="grp-empty">
                <Package size={28} color="#d1d5db" />
                <div>Sin productos en este grupo.</div>
              </div>
            ) : (
              <table className="grp-tabla">
                <thead>
                  <tr>
                    <th className="grp-th">Descripción</th>
                    <th className="grp-th">Impuesto</th>
                    <th className="grp-th grp-th-estado">Estado</th>
                    <th className="grp-th" style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map(p => (
                    <tr
                      key={p.id}
                      className={`grp-tr ${!p.activo ? 'inactivo' : ''} ${seleccionado?.id === p.id ? 'active' : ''}`}
                    >
                      <td className="grp-td"><span className="grp-prod-nombre">{p.descripcion}</span></td>
                      <td className="grp-td">{badgeImpuesto(p.impuesto)}</td>
                      <td className="grp-td grp-td-estado">
                        <span className={`grp-badge-estado ${p.activo ? 'green' : 'gray'}`}>
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      {puedeEditar && (
                        <td className="grp-td grp-td-acciones">
                          <button
                            className="grp-row-btn"
                            title="Editar"
                            onClick={() => { setSeleccionado(p); setPanelModo('editar') }}
                          >
                            <Pencil size={13} />
                          </button>
                          {esAdmin && (
                            <button
                              className="grp-row-btn danger"
                              title="Eliminar"
                              onClick={() => setConfirmProd(p)}
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
            <div className="grp-panel">
              <div className="grp-panel-header">
                <div className="grp-panel-titulo">
                  {panelModo === 'crear' ? 'Nuevo producto' : 'Editar producto'}
                </div>
                <button className="grp-panel-cerrar" onClick={cerrarPanel}><X size={16} /></button>
              </div>
              <PanelProducto
                modo={panelModo}
                item={seleccionado}
                grupoActual={grupo}
                onGuardar={handleGuardar}
                onCancelar={cerrarPanel}
                guardando={guardando}
              />
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!confirmProd}
        title="Eliminar producto"
        description={`¿Eliminar "${confirmProd?.descripcion}"? No se puede eliminar si tiene facturas emitidas vinculadas.`}
        onConfirm={handleEliminarConfirmado}
        onCancel={() => setConfirmProd(null)}
        loading={eliminarProd.isPending}
      />

      <Toast toast={toast} />
    </>
  )
}

export default function GruposPage() {
  const [grupoActual,          setGrupoActual]          = useState(null)
  const [panelGrupo,           setPanelGrupo]           = useState(null)
  const [guardando,            setGuardando]            = useState(false)
  const [confirmEliminarGrupo, setConfirmEliminarGrupo] = useState(false)
  const [gruposSearch,         setGruposSearch]         = useState('')
  const gruposDebounceRef = useRef(null)

  const { toast, showToast } = useToast()
  const { user } = useAuth()
  const esAdmin     = user?.rol === 'admin'
  const puedeEditar = esAdmin || user?.rol === 'recepcionista'

  const { data: gruposData, isLoading: gruposLoading } = useGrupos({ search: gruposSearch })
  const grupos = gruposData?.results ?? gruposData ?? []

  const crearGrupo      = useCreateGrupo()
  const actualizarGrupo = useUpdateGrupo()
  const eliminarGrupo   = useDeleteGrupo()

  const handleGruposSearch = (e) => {
    const val = e.target.value
    clearTimeout(gruposDebounceRef.current)
    gruposDebounceRef.current = setTimeout(() => setGruposSearch(val), 300)
  }

  const handleGuardarGrupo = async (form) => {
    setGuardando(true)
    try {
      if (panelGrupo === 'crear') {
        await crearGrupo.mutateAsync(form)
        showToast('Grupo creado correctamente.', 'success')
      } else {
        await actualizarGrupo.mutateAsync({ id: grupoActual.id, ...form })
        setGrupoActual(prev => ({ ...prev, ...form }))
        showToast('Grupo actualizado correctamente.', 'success')
      }
      setPanelGrupo(null)
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminarGrupoConfirmado = async () => {
    if (!grupoActual) return
    try {
      await eliminarGrupo.mutateAsync(grupoActual.id)
      showToast('Grupo eliminado.', 'success')
      setGrupoActual(null)
      setPanelGrupo(null)
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setConfirmEliminarGrupo(false)
    }
  }

  return (
    <>
      <style>{`
        .grp-page { display: flex; flex-direction: column; height: 100%; }

        .grp-header {
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px; padding: 20px 24px 16px; flex-wrap: wrap;
        }
        .grp-header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .grp-header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .grp-header-icon {
          width: 36px; height: 36px; background: #dbeafe; flex-shrink: 0;
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
        }
        .grp-header-title {
          font-size: 20px; font-weight: 600; color: #111827;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .grp-header-sub { font-size: 13px; color: #9ca3af; display: flex; align-items: center; gap: 6px; }

        .grp-btn-volver {
          display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
          border: 1.5px solid #1a3a5c; background: #fff; cursor: pointer;
          font-size: 13px; color: #1a3a5c; font-weight: 600;
          font-family: 'DM Sans', sans-serif; padding: 7px 14px;
          border-radius: 8px; transition: background 0.15s, color 0.15s;
          white-space: nowrap;
        }
        .grp-btn-volver:hover { background: #1a3a5c; color: #fff; }

        .grp-search-wrap {
          display: flex; align-items: center; gap: 8px;
          border: 1px solid #e5e7eb; border-radius: 8px;
          padding: 7px 12px; background: #fff;
          min-width: 180px; max-width: 280px; flex: 1 1 200px;
        }
        .grp-search-icon { flex-shrink: 0; }
        .grp-search-input {
          flex: 1; border: none; outline: none;
          font-size: 13px; font-family: 'DM Sans', sans-serif;
          color: #374151; background: transparent;
        }
        .grp-search-input::placeholder { color: #9ca3af; }

        .grp-vista {
          flex: 1; display: flex; flex-direction: column;
          overflow: hidden; padding: 0 24px 24px;
        }

        .grp-cards-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px; overflow-y: auto;
        }
        .grp-card {
          display: flex; align-items: center; gap: 14px;
          background: #fff; border: 1px solid #e8edf2; border-radius: 12px;
          padding: 16px 14px; cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
        }
        .grp-card:hover {
          border-color: #bfdbfe;
          box-shadow: 0 4px 16px rgba(0,0,0,0.10);
          transform: translateY(-2px);
        }
        .grp-card-icon {
          width: 48px; height: 48px; background: #e8f0fe;
          border-radius: 8px; display: flex; align-items: center;
          justify-content: center; flex-shrink: 0;
        }
        .grp-card-body { flex: 1; min-width: 0; }
        .grp-card-nombre {
          font-size: 14px; font-weight: 600; color: #111827;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .grp-card-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
        .grp-badge-count {
          display: inline-block; padding: 2px 8px; border-radius: 20px;
          font-size: 11.5px; font-weight: 500;
        }
        .grp-badge-count.blue { background: #dbeafe; color: #1d4ed8; }
        .grp-badge-count.gray { background: #f3f4f6; color: #6b7280; }
        .grp-card-arrow { flex-shrink: 0; color: #9ca3af; transition: color 0.2s; }
        .grp-card:hover .grp-card-arrow { color: #1a3a5c; }

        .grp-drill-body { flex: 1; display: flex; gap: 14px; overflow: hidden; }

        .grp-drill-toolbar {
          display: flex; align-items: center; justify-content: flex-end; gap: 8px;
          padding: 10px 12px; border-bottom: 1px solid #f3f4f6;
        }
        .grp-prod-search { flex: 0 1 260px; min-width: 0; max-width: 260px; }

        .grp-tabla-wrap {
          flex: 1; overflow-y: auto;
          border: 1px solid #e8edf2; border-radius: 10px;
          background: #fff; display: flex; flex-direction: column;
        }
        .grp-tabla { width: 100%; border-collapse: collapse; }
        .grp-th {
          text-align: left; padding: 10px 14px;
          font-size: 11.5px; font-weight: 600; color: #6b7280;
          text-transform: uppercase; letter-spacing: .04em;
          background: #f8fafc; border-bottom: 1px solid #e8edf2;
          position: sticky; top: 0;
        }
        .grp-td {
          padding: 11px 14px; font-size: 13px; color: #374151;
          vertical-align: middle; border-bottom: 1px solid #f3f4f6;
        }
        .grp-tr:last-child .grp-td { border-bottom: none; }
        .grp-tr:nth-child(odd)  { background: #f8fafc; }
        .grp-tr:nth-child(even) { background: #fff; }
        .grp-tr:hover { background: #f0f4f8; }
        .grp-tr:hover .grp-prod-nombre { color: #1a3a5c; }
        .grp-tr.active  { background: #eff6ff !important; }
        .grp-tr.inactivo { opacity: 0.55; }
        .grp-prod-nombre { font-weight: 500; }
        .grp-td-acciones { display: flex; gap: 4px; justify-content: flex-end; }
        .grp-row-btn {
          width: 28px; height: 28px; border-radius: 6px; border: 1px solid #e5e7eb;
          background: #fff; display: flex; align-items: center;
          justify-content: center; cursor: pointer; color: #6b7280;
          transition: background 0.12s;
        }
        .grp-row-btn:hover { background: #f3f4f6; color: #374151; }
        .grp-row-btn.danger { color: #dc2626; border-color: #fecaca; }
        .grp-row-btn.danger:hover { background: #fef2f2; }

        .grp-badge-imp {
          display: inline-block; padding: 2px 9px; border-radius: 20px;
          font-size: 11.5px; font-weight: 500;
        }
        .grp-badge-imp.blue  { background: #dbeafe; color: #1d4ed8; }
        .grp-badge-imp.green { background: #dcfce7; color: #16a34a; }
        .grp-badge-imp.gray  { background: #f3f4f6; color: #6b7280; }

        .grp-badge-estado {
          display: inline-block; padding: 2px 9px; border-radius: 20px;
          font-size: 11.5px; font-weight: 500;
        }
        .grp-badge-estado.green { background: #dcfce7; color: #166534; }
        .grp-badge-estado.gray  { background: #f3f4f6; color: #6b7280; }

        .grp-panel {
          width: 320px; flex-shrink: 0;
          border: 1px solid #e8edf2; border-radius: 10px;
          background: #fff; display: flex; flex-direction: column; overflow: hidden;
        }
        .grp-panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 16px; border-bottom: 1px solid #e8edf2; flex-shrink: 0;
        }
        .grp-panel-titulo { font-size: 14px; font-weight: 600; color: #111827; }
        .grp-panel-cerrar {
          border: none; background: none; cursor: pointer;
          color: #9ca3af; padding: 4px; border-radius: 6px; display: flex;
        }
        .grp-panel-cerrar:hover { color: #374151; }
        .grp-panel-body {
          flex: 1; overflow-y: auto; padding: 16px;
          display: flex; flex-direction: column; gap: 14px;
        }

        .grp-form-group { display: flex; flex-direction: column; gap: 5px; }
        .grp-label { font-size: 12.5px; font-weight: 500; color: #374151; }
        .grp-input, .grp-select {
          border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px;
          font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none;
          background: #fff; color: #374151;
        }
        .grp-input:focus, .grp-select:focus { border-color: #1a3a5c; }
        .grp-input-error { border-color: #fca5a5; }
        .grp-error-msg { font-size: 11.5px; color: #dc2626; }

        .grp-grupo-readonly {
          display: flex; align-items: center; gap: 6px;
          background: #f8fafc; border: 1px solid #e8edf2; border-radius: 8px;
          padding: 8px 10px; font-size: 13px; color: #374151;
        }

        .grp-switch-wrap { display: flex; align-items: center; gap: 10px; }
        .grp-switch {
          position: relative; display: inline-block;
          width: 40px; height: 22px; cursor: pointer; flex-shrink: 0;
        }
        .grp-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
        .grp-switch-pill {
          position: absolute; inset: 0; background: #d1d5db; border-radius: 20px;
          transition: background 0.2s;
        }
        .grp-switch-pill::before {
          content: ''; position: absolute; width: 16px; height: 16px;
          border-radius: 50%; background: #fff; top: 3px; left: 3px;
          transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .grp-switch input:checked + .grp-switch-pill { background: #1a3a5c; }
        .grp-switch input:checked + .grp-switch-pill::before { transform: translateX(18px); }
        .grp-switch-label { font-size: 13px; color: #374151; }

        .grp-panel-acciones {
          display: flex; gap: 10px; justify-content: flex-end;
          padding-top: 4px; margin-top: auto;
        }

        .grp-btn-primario {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 8px 16px; border-radius: 8px; border: none;
          background: #1a3a5c; color: #fff;
          font-size: 13px; font-family: 'DM Sans', sans-serif;
          font-weight: 500; cursor: pointer; white-space: nowrap;
        }
        .grp-btn-primario:hover:not(:disabled) { background: #15304d; }
        .grp-btn-primario:disabled { background: #9ca3af; cursor: default; }
        .grp-btn-secundario {
          padding: 8px 14px; border-radius: 8px;
          border: 1px solid #e5e7eb; background: #fff; color: #374151;
          font-size: 13px; font-family: 'DM Sans', sans-serif;
          font-weight: 500; cursor: pointer;
        }
        .grp-btn-secundario:hover { background: #f9fafb; }

        .grp-btn-icon-edit, .grp-btn-icon-del {
          width: 32px; height: 32px; border-radius: 8px; border: 1px solid;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background 0.12s;
        }
        .grp-btn-icon-edit { border-color: #bfdbfe; background: #fff; color: #1a3a5c; }
        .grp-btn-icon-edit:hover { background: #eff6ff; }
        .grp-btn-icon-del  { border-color: #fecaca; background: #fff; color: #dc2626; }
        .grp-btn-icon-del:hover  { background: #fef2f2; }

        .grp-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 8px;
          color: #6b7280; font-size: 14px; flex: 1; padding: 48px;
          text-align: center;
        }
        .grp-loading { text-align: center; color: #9ca3af; padding: 48px; font-size: 13px; }

        .grp-panel-overlay {
          position: fixed; inset: 0; z-index: 100;
          display: flex; align-items: flex-start; justify-content: flex-end;
          pointer-events: none;
        }
        .grp-panel-overlay .grp-panel {
          pointer-events: auto;
          height: 100%; border-radius: 0;
          width: 340px; border-left: 1px solid #e8edf2;
          border-top: none; border-bottom: none; border-right: none;
          box-shadow: -4px 0 20px rgba(0,0,0,0.08);
        }

        @media (max-width: 1024px) {
          .grp-cards-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 767px) {
          .grp-cards-grid { grid-template-columns: 1fr; }
          .grp-header { padding: 16px 16px 12px; }
          .grp-vista  { padding: 0 16px 16px; }

          .grp-panel-overlay { pointer-events: auto; }
          .grp-panel-overlay .grp-panel { width: 100%; border-left: none; box-shadow: none; }

          .grp-tabla-wrap { overflow-x: auto; }
          .grp-th-estado, .grp-td-estado { display: none; }

          .grp-drill-body .grp-panel {
            position: fixed; inset: 0; z-index: 50;
            width: 100% !important; border-radius: 0; border: none;
            box-shadow: 0 4px 24px rgba(0,0,0,0.12);
          }

          .grp-prod-search { flex: 1 1 0; max-width: none; }
          .grp-header-right .grp-search-wrap { min-width: 0; flex: 1; }
        }
      `}</style>

      <div className="grp-page">
        <div className="grp-header">
          {!grupoActual ? (
            <>
              <div className="grp-header-left">
                <div className="grp-header-icon">
                  <Layers size={18} color="#1a3a5c" />
                </div>
                <div>
                  <div className="grp-header-title">Grupos y Productos</div>
                  <div className="grp-header-sub">Organización de productos y servicios por grupo</div>
                </div>
              </div>
              <div className="grp-header-right">
                <div className="grp-search-wrap">
                  <Search size={14} color="#9ca3af" className="grp-search-icon" />
                  <input
                    className="grp-search-input"
                    placeholder="Buscar grupo…"
                    onChange={handleGruposSearch}
                  />
                </div>
                {puedeEditar && (
                  <button className="grp-btn-primario" onClick={() => setPanelGrupo('crear')}>
                    <Plus size={15} /> Nuevo grupo
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="grp-header-left">
                <button className="grp-btn-volver" onClick={() => { setGrupoActual(null); setPanelGrupo(null) }}>
                  <ArrowLeft size={15} /> Grupos
                </button>
                <div className="grp-header-icon">
                  <Layers size={18} color="#1a3a5c" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="grp-header-title">{grupoActual.descripcion}</div>
                  <div className="grp-header-sub">
                    {grupoActual.total_productos ?? 0} productos activos
                    <span className={`grp-badge-estado ${grupoActual.activo ? 'green' : 'gray'}`}>
                      {grupoActual.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              </div>
              {puedeEditar && (
                <div className="grp-header-right">
                  <button className="grp-btn-icon-edit" onClick={() => setPanelGrupo('editar')} title="Editar grupo">
                    <Pencil size={14} />
                  </button>
                  {esAdmin && (
                    <button className="grp-btn-icon-del" onClick={() => setConfirmEliminarGrupo(true)} title="Eliminar grupo">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {!grupoActual ? (
          <VistaGrupos
            grupos={grupos}
            isLoading={gruposLoading}
            onSeleccionarGrupo={g => { setGrupoActual(g); setPanelGrupo(null) }}
          />
        ) : (
          <VistaProductos
            grupo={grupoActual}
            esAdmin={esAdmin}
            puedeEditar={puedeEditar}
          />
        )}
      </div>

      {panelGrupo && (
        <div className="grp-panel-overlay">
          <div className="grp-panel">
            <div className="grp-panel-header">
              <div className="grp-panel-titulo">
                {panelGrupo === 'crear' ? 'Nuevo grupo' : `Editar: ${grupoActual?.descripcion}`}
              </div>
              <button className="grp-panel-cerrar" onClick={() => setPanelGrupo(null)}>
                <X size={16} />
              </button>
            </div>
            <PanelGrupo
              modo={panelGrupo}
              item={grupoActual}
              onGuardar={handleGuardarGrupo}
              onCancelar={() => setPanelGrupo(null)}
              guardando={guardando}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmEliminarGrupo}
        title="Eliminar grupo"
        description={`¿Eliminar el grupo "${grupoActual?.descripcion}"? Si tiene productos activos vinculados no se podrá eliminar.`}
        onConfirm={handleEliminarGrupoConfirmado}
        onCancel={() => setConfirmEliminarGrupo(false)}
        loading={eliminarGrupo.isPending}
      />

      <Toast toast={toast} />
    </>
  )
}
