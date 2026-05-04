import { useState } from 'react'
import { Plus, Pencil, Trash2, ChevronRight, MapPin } from 'lucide-react'
import { usePaises, useDepartamentos, useCiudades, useUbicacionMutations } from '../../hooks/mantenimiento/useUbicacion'
import Toast from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

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

function TablaUbicacion({ titulo, color, datos, isLoading, editandoId, setEditandoId, agregando, setAgregando, onGuardar, onActualizar, onEliminar, deshabilitada = false, mensajeDeshabilitada = '', onSeleccionar, seleccionadoId }) {

  if (deshabilitada) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e8edf2', borderRadius: '12px', overflow: 'hidden', opacity: 0.5 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e8edf2', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '3px', height: '16px', background: '#d1d5db', borderRadius: '4px' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af' }}>{titulo}</span>
        </div>
        <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
          {mensajeDeshabilitada}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e8edf2', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #e8edf2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '3px', height: '16px', background: color, borderRadius: '4px' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a3a5c' }}>{titulo}</span>
          {datos?.length > 0 && (
            <span style={{ fontSize: '11px', background: '#f0f4f8', color: '#6b7280', padding: '2px 8px', borderRadius: '20px' }}>
              {datos.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setAgregando(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '6px 12px', background: '#1a3a5c', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '12.5px',
            cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
          }}
        >
          <Plus size={13} /> Agregar
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
        <tbody>
          {isLoading && (
            <tr><td colSpan={2} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>Cargando...</td></tr>
          )}

          {!isLoading && datos?.length === 0 && !agregando && (
            <tr><td colSpan={2} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
              Sin registros — agregá el primero
            </td></tr>
          )}

          {agregando && (
            <FilaEditable
              valor=""
              onGuardar={(texto) => { onGuardar(texto); setAgregando(false) }}
              onCancelar={() => setAgregando(false)}
            />
          )}

          {datos?.map((item) => (
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
                onClick={() => onSeleccionar && onSeleccionar(item)}
                style={{
                    borderBottom: '1px solid #f3f4f6',
                    background: seleccionadoId === item.id ? '#eff6ff' : '',
                    cursor: onSeleccionar ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => {
                    if (seleccionadoId !== item.id) e.currentTarget.style.background = '#f8fafc'
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = seleccionadoId === item.id ? '#eff6ff' : ''
                }}
              >
                <td style={{ padding: '10px 16px', color: seleccionadoId === item.id ? '#1a3a5c' : '#374151', fontWeight: seleccionadoId === item.id ? 500 : 400 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {seleccionadoId === item.id && (
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#1a3a5c', flexShrink: 0 }} />
                        )}
                        {item.descripcion}
                    </div>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                    <button
                      className="ub-action-btn edit"
                      onClick={(e) => { e.stopPropagation(); setEditandoId(item.id) }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      className="ub-action-btn trash"
                      onClick={(e) => { e.stopPropagation(); onEliminar(item.id) }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function UbicacionesPage() {
  const [paisSeleccionado,  setPaisSeleccionado]  = useState(null)
  const [deptoSeleccionado, setDeptoSeleccionado] = useState(null)

  const [editandoPais,  setEditandoPais]  = useState(null)
  const [editandoDepto, setEditandoDepto] = useState(null)
  const [editandoCiud,  setEditandoCiud]  = useState(null)

  const [agregandoPais,  setAgregandoPais]  = useState(false)
  const [agregandoDepto, setAgregandoDepto] = useState(false)
  const [agregandoCiud,  setAgregandoCiud]  = useState(false)

  const [confirmPendiente, setConfirmPendiente] = useState(null)

  const { toast, showToast } = useToast()

  const { data: paises,        isLoading: loadPaises } = usePaises()
  const { data: departamentos, isLoading: loadDeptos } = useDepartamentos(paisSeleccionado?.id)
  const { data: ciudades,      isLoading: loadCiuds  } = useCiudades(deptoSeleccionado?.id)

  const {
    crearPais, actualizarPais, eliminarPais,
    crearDepto, actualizarDepto, eliminarDepto,
    crearCiudad, actualizarCiudad, eliminarCiudad,
  } = useUbicacionMutations(showToast)

  const handleSeleccionarPais = (pais) => {
    setPaisSeleccionado(pais)
    setDeptoSeleccionado(null)
  }

  const confirmarEliminar = () => {
    const { tipo, id } = confirmPendiente
    const opciones = {
      onSuccess: () => {
        if (tipo === 'pais' && paisSeleccionado?.id === id) handleSeleccionarPais(null)
        if (tipo === 'depto' && deptoSeleccionado?.id === id) setDeptoSeleccionado(null)
        setConfirmPendiente(null)
      },
    }
    if (tipo === 'pais') eliminarPais.mutate(id, opciones)
    else if (tipo === 'depto') eliminarDepto.mutate(id, opciones)
    else eliminarCiudad.mutate(id, opciones)
  }

  return (
    <>
      <style>{`
        .ub-root { font-family: 'DM Sans', sans-serif; }
        .ub-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
        .ub-title { font-size: 22px; font-weight: 600; color: #1a3a5c; margin-bottom: 2px; }
        .ub-subtitle { font-size: 13px; color: #6b7280; }
        .ub-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        @media (max-width: 900px) { .ub-grid { grid-template-columns: 1fr; } }
        @media (min-width: 901px) and (max-width: 1100px) { .ub-grid { grid-template-columns: 1fr 1fr; } }
        .ub-arrow { display: none; align-items: center; justify-content: center; color: #d1d5db; }
        @media (min-width: 901px) { .ub-arrow { display: flex; } }
        .ub-action-btn {
          width: 28px; height: 28px; border-radius: 7px; border: 1px solid #e8edf2;
          background: none; cursor: pointer; display: flex; align-items: center;
          justify-content: center; color: #6b7280;
        }
        .ub-action-btn.edit:hover { background: #eff6ff; color: #1a3a5c; border-color: #bfdbfe; }
        .ub-action-btn.trash:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '13px', color: '#6b7280' }}>
            <MapPin size={13} />
            {paisSeleccionado && <span style={{ color: '#1a3a5c', fontWeight: 500 }}>{paisSeleccionado.descripcion}</span>}
            {deptoSeleccionado && <><ChevronRight size={13} /><span style={{ color: '#1a3a5c', fontWeight: 500 }}>{deptoSeleccionado.descripcion}</span></>}
          </div>
        )}

        <div className="ub-grid">

          <div>
            <TablaUbicacion
              titulo="Países"
              color="#1a3a5c"
              datos={paises?.results || paises}
              isLoading={loadPaises}
              editandoId={editandoPais}
              setEditandoId={setEditandoPais}
              agregando={agregandoPais}
              setAgregando={setAgregandoPais}
              onSeleccionar={handleSeleccionarPais}
              seleccionadoId={paisSeleccionado?.id}
              onGuardar={(desc) => crearPais.mutate({ descripcion: desc })}
              onActualizar={(id, desc) => actualizarPais.mutate({ id, descripcion: desc })}
              onEliminar={(id) => setConfirmPendiente({ tipo: 'pais', id })}
            />
          </div>

          <div>
            <TablaUbicacion
              titulo={paisSeleccionado ? `Departamentos — ${paisSeleccionado.descripcion}` : 'Departamentos'}
              color="#3b82f6"
              datos={departamentos?.results || departamentos}
              isLoading={loadDeptos}
              editandoId={editandoDepto}
              setEditandoId={setEditandoDepto}
              agregando={agregandoDepto}
              setAgregando={setAgregandoDepto}
              deshabilitada={!paisSeleccionado}
              mensajeDeshabilitada="Seleccioná un país para ver sus departamentos"
              onSeleccionar={setDeptoSeleccionado}
              seleccionadoId={deptoSeleccionado?.id}
              onGuardar={(desc) => crearDepto.mutate({ descripcion: desc, pais: paisSeleccionado.id })}
              onActualizar={(id, desc) => actualizarDepto.mutate({ id, descripcion: desc, pais: paisSeleccionado.id })}
              onEliminar={(id) => setConfirmPendiente({ tipo: 'depto', id })}
            />
          </div>

          <div>
            <TablaUbicacion
              titulo={deptoSeleccionado ? `Ciudades — ${deptoSeleccionado.descripcion}` : 'Ciudades'}
              color="#06b6d4"
              datos={ciudades?.results || ciudades}
              isLoading={loadCiuds}
              editandoId={editandoCiud}
              setEditandoId={setEditandoCiud}
              agregando={agregandoCiud}
              setAgregando={setAgregandoCiud}
              deshabilitada={!deptoSeleccionado}
              mensajeDeshabilitada="Seleccioná un departamento para ver sus ciudades"
              onGuardar={(desc) => crearCiudad.mutate({ descripcion: desc, departamento: deptoSeleccionado.id })}
              onActualizar={(id, desc) => actualizarCiudad.mutate({ id, descripcion: desc, departamento: deptoSeleccionado.id })}
              onEliminar={(id) => setConfirmPendiente({ tipo: 'ciudad', id })}
            />
          </div>

        </div>
      </div>
    </>
  )
}
