import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, ChevronRight, ChevronLeft, MapPin, Search } from 'lucide-react'
import { usePaises, useDepartamentos, useCiudades, useUbicacionMutations } from '../../hooks/mantenimiento/useUbicacion'
import Toast from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useNavigationGuard } from '../../hooks/useNavigationGuard'
import { useAuth } from '../../context/AuthContext'

function FilaEditable({ valor, onGuardar, onCancelar }) {
  const [texto, setTexto] = useState(valor || '')
  return (
    <tr>
      <td style={{ padding: '8px 16px' }} colSpan={2}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            autoFocus
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && texto.trim()) onGuardar(texto.trim())
              if (e.key === 'Escape') onCancelar()
            }}
            style={{
              flex: 1, padding: '7px 11px',
              border: '1.5px solid #1a3a5c', borderRadius: '8px',
              fontSize: '13.5px', fontFamily: 'DM Sans, sans-serif',
              outline: 'none', boxShadow: '0 0 0 3px rgba(26,58,92,0.08)',
            }}
          />
          <button
            onClick={() => texto.trim() && onGuardar(texto.trim())}
            disabled={!texto.trim()}
            style={{
              padding: '7px 14px', background: '#1a3a5c', color: '#fff',
              border: 'none', borderRadius: '8px', fontSize: '13px',
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              opacity: !texto.trim() ? 0.5 : 1,
            }}
          >
            Guardar
          </button>
          <button
            onClick={onCancelar}
            style={{
              padding: '7px 12px', background: '#f3f4f6',
              border: '1px solid #e5e7eb', borderRadius: '8px',
              fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', color: '#374151',
            }}
          >
            Cancelar
          </button>
        </div>
      </td>
    </tr>
  )
}

function TablaUbicacion({
  titulo, activa = false, datos, isLoading,
  editandoId, setEditandoId, agregando, setAgregando,
  onGuardar, onActualizar, onEliminar,
  deshabilitada = false, mensajeDeshabilitada = '',
  onSeleccionar, seleccionadoId,
  placeholder = 'Buscar...', resetKey,
  puedeEliminar = false,
}) {
  const [busqueda,        setBusqueda]        = useState('')
  const [confirmDescartar, setConfirmDescartar] = useState(null)

  useEffect(() => { setBusqueda('') }, [resetKey])

  const lista = (() => {
    const q = busqueda.trim().toLowerCase()
    if (!q || !datos) return datos
    return datos.filter(i => i.descripcion.toLowerCase().includes(q))
  })()

  const mostrarBusqueda = (datos?.length ?? 0) > 5
  const estaEditando    = editandoId !== null || agregando

  const handleIniciarEdicion = (itemId) => {
    if (editandoId !== null && editandoId !== itemId) {
      setConfirmDescartar({ fn: () => setEditandoId(itemId) })
    } else {
      setEditandoId(itemId)
    }
  }

  const handleAgregar = () => {
    if (editandoId !== null) {
      setConfirmDescartar({ fn: () => { setEditandoId(null); setAgregando(true) } })
    } else {
      setAgregando(true)
    }
  }

  if (deshabilitada) {
    return (
      <div className="ub-col-card ub-col-disabled">
        <div className="ub-col-header">
          <div className="ub-col-header-left">
            <div className="ub-col-bar" />
            <span className="ub-col-titulo ub-col-titulo-disabled">{titulo}</span>
          </div>
        </div>
        <div className="ub-disabled-msg">{mensajeDeshabilitada}</div>
      </div>
    )
  }

  return (
    <div className="ub-col-card">
      <ConfirmDialog
        isOpen={confirmDescartar !== null}
        title="¿Descartar cambios?"
        description="Tenés cambios sin guardar en este campo. Si continuás, se perderán."
        confirmText="Descartar y continuar"
        cancelText="Seguir editando"
        onConfirm={() => { confirmDescartar?.fn(); setConfirmDescartar(null) }}
        onCancel={() => setConfirmDescartar(null)}
      />

      <div className={`ub-col-header ${activa ? 'ub-col-header-activa' : ''}`}>
        <div className="ub-col-header-left">
          <div className="ub-col-bar" />
          <span className="ub-col-titulo">{titulo}</span>
          {datos?.length > 0 && (
            <span className="badge badge-info">{datos.length}</span>
          )}
        </div>
        <button className="ub-btn-agregar" onClick={handleAgregar}>
          <Plus size={13} /> Agregar
        </button>
      </div>

      {mostrarBusqueda && (
        <div className="ub-search-wrap">
          <Search size={13} className="ub-search-icon" />
          <input
            type="text"
            className="ub-search-input"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder={placeholder}
          />
        </div>
      )}

      <table className="ub-table">
        <tbody>
          {isLoading && (
            <tr><td colSpan={2} className="ub-empty">Cargando...</td></tr>
          )}
          {!isLoading && !lista?.length && !agregando && (
            <tr><td colSpan={2} className="ub-empty">
              {busqueda.trim() ? 'Sin resultados para la búsqueda' : 'Sin registros — agregá el primero'}
            </td></tr>
          )}
          {agregando && (
            <FilaEditable
              valor=""
              onGuardar={(texto) => { onGuardar(texto); setAgregando(false) }}
              onCancelar={() => setAgregando(false)}
            />
          )}
          {lista?.map((item) =>
            editandoId === item.id ? (
              <FilaEditable
                key={item.id}
                valor={item.descripcion}
                onGuardar={(texto) => { onActualizar(item.id, texto); setEditandoId(null) }}
                onCancelar={() => setEditandoId(null)}
              />
            ) : (
              <tr
                key={item.id}
                className={`ub-item ${seleccionadoId === item.id ? 'ub-activo' : ''}`}
                onClick={() => onSeleccionar && onSeleccionar(item)}
              >
                <td className="ub-item-td">
                  <div className="ub-item-label">
                    {seleccionadoId === item.id && <div className="ub-item-dot" />}
                    <span className={seleccionadoId === item.id ? 'ub-item-text-activo' : ''}>
                      {item.descripcion}
                    </span>
                  </div>
                </td>
                <td className="ub-item-actions-td">
                  <div className="ub-actions">
                    <button
                      className="ub-action-btn edit"
                      onClick={(e) => { e.stopPropagation(); handleIniciarEdicion(item.id) }}
                    >
                      <Pencil size={13} />
                    </button>
                    {puedeEliminar && (
                      <button
                        className="ub-action-btn trash"
                        onClick={(e) => { e.stopPropagation(); onEliminar(item.id) }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function UbicacionesPage() {
  const [paisSeleccionado,  setPaisSeleccionado]  = useState(null)
  const [deptoSeleccionado, setDeptoSeleccionado] = useState(null)
  const [mobileLevel,       setMobileLevel]       = useState(0)

  const [editandoPais,  setEditandoPais]  = useState(null)
  const [editandoDepto, setEditandoDepto] = useState(null)
  const [editandoCiud,  setEditandoCiud]  = useState(null)

  const [agregandoPais,  setAgregandoPais]  = useState(false)
  const [agregandoDepto, setAgregandoDepto] = useState(false)
  const [agregandoCiud,  setAgregandoCiud]  = useState(false)

  const [confirmPendiente, setConfirmPendiente] = useState(null)

  const { toast, showToast } = useToast()
  const { markDirty, markClean } = useNavigationGuard()
  const { user } = useAuth()
  const puedeEliminar = user?.rol === 'admin'

  const { data: paises,        isLoading: loadPaises } = usePaises()
  const { data: departamentos, isLoading: loadDeptos } = useDepartamentos(paisSeleccionado?.id)
  const { data: ciudades,      isLoading: loadCiuds  } = useCiudades(deptoSeleccionado?.id)

  const {
    crearPais, actualizarPais, eliminarPais,
    crearDepto, actualizarDepto, eliminarDepto,
    crearCiudad, actualizarCiudad, eliminarCiudad,
  } = useUbicacionMutations(showToast)

  const anyEdit = editandoPais !== null || editandoDepto !== null || editandoCiud !== null ||
                  agregandoPais || agregandoDepto || agregandoCiud

  useEffect(() => { anyEdit ? markDirty() : markClean() }, [anyEdit, markDirty, markClean])
  useEffect(() => () => markClean(), [markClean])

  const handleSeleccionarPais = (pais) => {
    setPaisSeleccionado(pais)
    setDeptoSeleccionado(null)
    if (pais) setMobileLevel(1)
  }

  const handleSeleccionarDepto = (depto) => {
    setDeptoSeleccionado(depto)
    if (depto) setMobileLevel(2)
  }

  const confirmarEliminar = () => {
    const { tipo, id } = confirmPendiente
    const opciones = {
      onSuccess: () => {
        if (tipo === 'pais'  && paisSeleccionado?.id  === id) handleSeleccionarPais(null)
        if (tipo === 'depto' && deptoSeleccionado?.id === id) setDeptoSeleccionado(null)
        setConfirmPendiente(null)
      },
    }
    if (tipo === 'pais') eliminarPais.mutate(id, opciones)
    else if (tipo === 'depto') eliminarDepto.mutate(id, opciones)
    else eliminarCiudad.mutate(id, opciones)
  }

  const listaPaises       = paises?.results       || paises       || []
  const listaDepartamentos = departamentos?.results || departamentos || []
  const listaCiudades     = ciudades?.results      || ciudades      || []

  return (
    <>
      <style>{`
        .ub-root { font-family: 'DM Sans', sans-serif; }

        .ub-header   { display: flex; align-items: flex-start; margin-bottom: 20px; }
        .ub-title    { font-size: 18px; font-weight: 600; color: #1a3a5c; }
        .ub-subtitle { font-size: 12px; color: #9ca3af; margin-top: 2px; }

        .ub-path {
          display: flex; align-items: center; gap: 5px;
          margin-bottom: 16px; font-size: 13px; color: #9ca3af;
        }
        .ub-path-sep  { color: #d1d5db; }
        .ub-path-item { color: #1a3a5c; font-weight: 500; }

        .ub-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        @media (min-width: 901px) and (max-width: 1100px) {
          .ub-grid { grid-template-columns: 1fr 1fr; }
        }

        .ub-col-card {
          background: #fff; border: 1px solid #e8edf2;
          border-radius: 12px; overflow: hidden;
        }
        .ub-col-disabled { opacity: 0.5; }

        .ub-col-header {
          padding: 13px 16px; border-bottom: 1px solid #e8edf2;
          display: flex; align-items: center; justify-content: space-between;
          border-left: 3px solid transparent;
          transition: border-left-color 0.2s;
        }
        .ub-col-header-activa { border-left-color: #1a3a5c; }
        .ub-col-header-left { display: flex; align-items: center; gap: 9px; }
        .ub-col-bar { width: 3px; height: 15px; background: #1a3a5c; border-radius: 4px; }
        .ub-col-titulo { font-size: 13px; font-weight: 600; color: #1a3a5c; }
        .ub-col-titulo-disabled { color: #9ca3af; }
        .ub-disabled-msg { padding: 32px 16px; text-align: center; color: #9ca3af; font-size: 13px; }

        .ub-btn-agregar {
          display: flex; align-items: center; gap: 5px;
          padding: 6px 12px; background: #1a3a5c; color: #fff;
          border: none; border-radius: 8px; font-size: 12.5px; font-weight: 500;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: background 0.15s;
        }
        .ub-btn-agregar:hover { background: #15304d; }

        .ub-search-wrap {
          position: relative; display: flex; align-items: center;
          padding: 8px 12px; border-bottom: 1px solid #f0f4f8;
        }
        .ub-search-icon { position: absolute; left: 22px; color: #9ca3af; pointer-events: none; }
        .ub-search-input {
          width: 100%; padding: 6px 10px 6px 28px;
          border: 1.5px solid #e5e7eb; border-radius: 7px;
          font-size: 12.5px; font-family: 'DM Sans', sans-serif;
          color: #111827; background: #f8fafc; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          box-sizing: border-box;
        }
        .ub-search-input:focus {
          border-color: #1a3a5c; background: #fff;
          box-shadow: 0 0 0 3px rgba(26,58,92,0.08);
        }
        .ub-search-input::placeholder { color: #d1d5db; }

        .ub-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .ub-empty  { padding: 24px 16px; text-align: center; color: #9ca3af; }

        .ub-item { border-bottom: 1px solid #f3f4f6; transition: background 0.12s; }
        .ub-item:last-child { border-bottom: none; }
        .ub-item:hover   { background: #f8fafc; }
        .ub-item.ub-activo { background: #eff6ff; }

        .ub-item-td { padding: 10px 16px; color: #374151; cursor: pointer; }
        .ub-item.ub-activo .ub-item-td { border-left: 3px solid #1a3a5c; padding-left: 13px; }
        .ub-item-label { display: flex; align-items: center; gap: 8px; }
        .ub-item-dot { width: 5px; height: 5px; border-radius: 50%; background: #1a3a5c; flex-shrink: 0; }
        .ub-item-text-activo { color: #1a3a5c; font-weight: 500; }

        .ub-item-actions-td { padding: 6px 12px; width: 72px; cursor: default; }
        .ub-actions {
          display: flex; align-items: center; justify-content: flex-end; gap: 5px;
          opacity: 0; transition: opacity 0.15s;
        }
        .ub-item:hover .ub-actions { opacity: 1; }

        .ub-action-btn {
          width: 26px; height: 26px; border-radius: 7px; border: 1px solid #e8edf2;
          background: none; cursor: pointer; display: flex; align-items: center;
          justify-content: center; color: #6b7280;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .ub-action-btn.edit:hover  { background: #eff6ff; color: #1a3a5c; border-color: #bfdbfe; }
        .ub-action-btn.trash:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }

        .ub-mobile-nav { display: none; }

        @media (max-width: 767px) {
          .ub-grid { grid-template-columns: 1fr; }
          .ub-col { display: none; }
          .ub-col.ub-col-visible { display: block; }

          .ub-mobile-nav {
            display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
          }
          .ub-back-btn {
            display: flex; align-items: center; gap: 3px;
            padding: 6px 11px; border: 1px solid #e5e7eb; border-radius: 8px;
            background: #fff; color: #374151; font-size: 13px; font-weight: 500;
            cursor: pointer; font-family: 'DM Sans', sans-serif;
            flex-shrink: 0; transition: background 0.15s;
          }
          .ub-back-btn:hover { background: #f3f4f6; }
          .ub-breadcrumb {
            display: flex; align-items: center; gap: 4px;
            font-size: 13px; flex: 1; min-width: 0; overflow: hidden;
          }
          .ub-breadcrumb-link {
            color: #3b82f6; cursor: pointer;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 1;
          }
          .ub-breadcrumb-link:hover { text-decoration: underline; }
          .ub-breadcrumb-current {
            color: #1a3a5c; font-weight: 600;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 1;
          }
          .ub-breadcrumb-sep { color: #d1d5db; flex-shrink: 0; }

          .ub-actions { opacity: 1; }
          .ub-path    { display: none; }
        }
      `}</style>

      <Toast toast={toast} />

      <ConfirmDialog
        isOpen={!!confirmPendiente}
        title={
          confirmPendiente?.tipo === 'pais'  ? '¿Eliminar este país?' :
          confirmPendiente?.tipo === 'depto' ? '¿Eliminar este departamento?' :
                                               '¿Eliminar esta ciudad?'
        }
        description={
          confirmPendiente?.tipo === 'pais'  ? 'Si tiene departamentos vinculados no se podrá eliminar.' :
          confirmPendiente?.tipo === 'depto' ? 'Si tiene ciudades vinculadas no se podrá eliminar.' :
                                               'Si tiene personas vinculadas no se podrá eliminar.'
        }
        onConfirm={confirmarEliminar}
        onCancel={() => setConfirmPendiente(null)}
        loading={
          confirmPendiente?.tipo === 'pais'  ? eliminarPais.isPending :
          confirmPendiente?.tipo === 'depto' ? eliminarDepto.isPending :
                                               eliminarCiudad.isPending
        }
      />

      <div className="ub-root">
        <div className="ub-header">
          <div>
            <div className="ub-title">Ubicaciones</div>
            <div className="ub-subtitle">Gestión de países, departamentos y ciudades</div>
          </div>
        </div>

        {(paisSeleccionado || deptoSeleccionado) && (
          <div className="ub-path">
            <MapPin size={12} />
            {paisSeleccionado && <span className="ub-path-item">{paisSeleccionado.descripcion}</span>}
            {deptoSeleccionado && (
              <>
                <span className="ub-path-sep"><ChevronRight size={12} /></span>
                <span className="ub-path-item">{deptoSeleccionado.descripcion}</span>
              </>
            )}
          </div>
        )}

        <div className="ub-mobile-nav">
          {mobileLevel > 0 && (
            <button className="ub-back-btn" onClick={() => setMobileLevel(l => l - 1)}>
              <ChevronLeft size={14} /> Volver
            </button>
          )}
          <div className="ub-breadcrumb">
            {mobileLevel === 0 ? (
              <span className="ub-breadcrumb-current">Países</span>
            ) : (
              <span className="ub-breadcrumb-link" onClick={() => setMobileLevel(0)}>Países</span>
            )}
            {mobileLevel >= 1 && paisSeleccionado && (
              <>
                <ChevronRight size={11} className="ub-breadcrumb-sep" />
                {mobileLevel === 1 ? (
                  <span className="ub-breadcrumb-current">{paisSeleccionado.descripcion}</span>
                ) : (
                  <span className="ub-breadcrumb-link" onClick={() => setMobileLevel(1)}>
                    {paisSeleccionado.descripcion}
                  </span>
                )}
              </>
            )}
            {mobileLevel === 2 && deptoSeleccionado && (
              <>
                <ChevronRight size={11} className="ub-breadcrumb-sep" />
                <span className="ub-breadcrumb-current">{deptoSeleccionado.descripcion}</span>
              </>
            )}
          </div>
        </div>

        <div className="ub-grid">

          <div className={`ub-col ${mobileLevel === 0 ? 'ub-col-visible' : ''}`}>
            <TablaUbicacion
              titulo="Países"
              activa={true}
              datos={listaPaises}
              isLoading={loadPaises}
              editandoId={editandoPais}
              setEditandoId={setEditandoPais}
              agregando={agregandoPais}
              setAgregando={setAgregandoPais}
              onSeleccionar={handleSeleccionarPais}
              seleccionadoId={paisSeleccionado?.id}
              placeholder="Buscar país..."
              onGuardar={(desc) => crearPais.mutate({ descripcion: desc })}
              onActualizar={(id, desc) => actualizarPais.mutate({ id, descripcion: desc })}
              onEliminar={(id) => setConfirmPendiente({ tipo: 'pais', id })}
              puedeEliminar={puedeEliminar}
            />
          </div>

          <div className={`ub-col ${mobileLevel === 1 ? 'ub-col-visible' : ''}`}>
            <TablaUbicacion
              titulo="Departamentos"
              activa={!!paisSeleccionado}
              datos={listaDepartamentos}
              isLoading={loadDeptos}
              editandoId={editandoDepto}
              setEditandoId={setEditandoDepto}
              agregando={agregandoDepto}
              setAgregando={setAgregandoDepto}
              deshabilitada={!paisSeleccionado}
              mensajeDeshabilitada="Seleccioná un país para ver sus departamentos"
              onSeleccionar={handleSeleccionarDepto}
              seleccionadoId={deptoSeleccionado?.id}
              placeholder="Buscar departamento..."
              resetKey={paisSeleccionado?.id}
              onGuardar={(desc) => crearDepto.mutate({ descripcion: desc, pais: paisSeleccionado.id })}
              onActualizar={(id, desc) => actualizarDepto.mutate({ id, descripcion: desc, pais: paisSeleccionado.id })}
              onEliminar={(id) => setConfirmPendiente({ tipo: 'depto', id })}
              puedeEliminar={puedeEliminar}
            />
          </div>

          <div className={`ub-col ${mobileLevel === 2 ? 'ub-col-visible' : ''}`}>
            <TablaUbicacion
              titulo="Ciudades"
              activa={!!deptoSeleccionado}
              datos={listaCiudades}
              isLoading={loadCiuds}
              editandoId={editandoCiud}
              setEditandoId={setEditandoCiud}
              agregando={agregandoCiud}
              setAgregando={setAgregandoCiud}
              deshabilitada={!deptoSeleccionado}
              mensajeDeshabilitada="Seleccioná un departamento para ver sus ciudades"
              placeholder="Buscar ciudad..."
              resetKey={deptoSeleccionado?.id}
              onGuardar={(desc) => crearCiudad.mutate({ descripcion: desc, departamento: deptoSeleccionado.id })}
              onActualizar={(id, desc) => actualizarCiudad.mutate({ id, descripcion: desc, departamento: deptoSeleccionado.id })}
              onEliminar={(id) => setConfirmPendiente({ tipo: 'ciudad', id })}
              puedeEliminar={puedeEliminar}
            />
          </div>

        </div>
      </div>
    </>
  )
}
