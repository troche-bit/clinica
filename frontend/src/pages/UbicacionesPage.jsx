import { useState } from 'react'
import { Plus, Pencil, Trash2, ChevronRight, MapPin } from 'lucide-react'
import { usePaises, useDepartamentos, useCiudades } from '../hooks/useUbicacion'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import apiClient from '../api/client'
import Toast from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'

// Extrae el primer mensaje de error de una respuesta DRF (400/403/500)
function extraerMensajeError(err) {
  const data = err?.response?.data
  if (!data) return 'Ocurrió un error inesperado.'
  if (typeof data === 'string') return data
  const valores = Object.values(data)
  if (valores.length === 0) return 'Error al guardar.'
  const primero = valores[0]
  if (Array.isArray(primero)) return primero[0]
  if (typeof primero === 'object') {
    const sub = Object.values(primero)[0]
    return Array.isArray(sub) ? sub[0] : String(sub)
  }
  return String(primero)
}

// Hook de mutaciones para las tres entidades de ubicación.
// Recibe showToast para notificar éxito/error directamente desde las mutaciones.
function useUbicacionMutations(showToast) {
  const qc = useQueryClient()

  const crearPais = useMutation({
    mutationFn: (d) => apiClient.post('/pais/', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['paises'] }); showToast('País creado.', 'success') },
    onError:   (err) => showToast(extraerMensajeError(err), 'error'),
  })
  const actualizarPais = useMutation({
    mutationFn: ({ id, ...d }) => apiClient.patch(`/pais/${id}/`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['paises'] }); showToast('País actualizado.', 'success') },
    onError:   (err) => showToast(extraerMensajeError(err), 'error'),
  })
  const eliminarPais = useMutation({
    mutationFn: (id) => apiClient.delete(`/pais/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['paises'] }); showToast('País eliminado.', 'success') },
    onError:   (err) => showToast(extraerMensajeError(err), 'error'),
  })

  const crearDepto = useMutation({
    mutationFn: (d) => apiClient.post('/departamento/', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departamentos'] }); showToast('Departamento creado.', 'success') },
    onError:   (err) => showToast(extraerMensajeError(err), 'error'),
  })
  const actualizarDepto = useMutation({
    mutationFn: ({ id, ...d }) => apiClient.patch(`/departamento/${id}/`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departamentos'] }); showToast('Departamento actualizado.', 'success') },
    onError:   (err) => showToast(extraerMensajeError(err), 'error'),
  })
  const eliminarDepto = useMutation({
    mutationFn: (id) => apiClient.delete(`/departamento/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departamentos'] }); showToast('Departamento eliminado.', 'success') },
    onError:   (err) => showToast(extraerMensajeError(err), 'error'),
  })

  const crearCiudad = useMutation({
    mutationFn: (d) => apiClient.post('/ciudad/', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ciudades'] }); showToast('Ciudad creada.', 'success') },
    onError:   (err) => showToast(extraerMensajeError(err), 'error'),
  })
  const actualizarCiudad = useMutation({
    mutationFn: ({ id, ...d }) => apiClient.patch(`/ciudad/${id}/`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ciudades'] }); showToast('Ciudad actualizada.', 'success') },
    onError:   (err) => showToast(extraerMensajeError(err), 'error'),
  })
  const eliminarCiudad = useMutation({
    mutationFn: (id) => apiClient.delete(`/ciudad/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ciudades'] }); showToast('Ciudad eliminada.', 'success') },
    onError:   (err) => showToast(extraerMensajeError(err), 'error'),
  })

  return {
    crearPais, actualizarPais, eliminarPais,
    crearDepto, actualizarDepto, eliminarDepto,
    crearCiudad, actualizarCiudad, eliminarCiudad,
  }
}

// Fila editable inline para crear o editar un registro directamente en la tabla
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

// Componente genérico de tabla para cada nivel de ubicación (País, Departamento, Ciudad)
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
                      onClick={() => setEditandoId(item.id)}
                      style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid #e8edf2', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#1a3a5c'; e.currentTarget.style.borderColor = '#bfdbfe' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#e8edf2' }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => onEliminar(item.id)}
                      style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid #e8edf2', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fecaca' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#e8edf2' }}
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

// Página principal de gestión de ubicaciones — jerarquía País → Departamento → Ciudad
export default function UbicacionesPage() {
  const [paisSeleccionado,  setPaisSeleccionado]  = useState(null)
  const [deptoSeleccionado, setDeptoSeleccionado] = useState(null)

  const [editandoPais,  setEditandoPais]  = useState(null)
  const [editandoDepto, setEditandoDepto] = useState(null)
  const [editandoCiud,  setEditandoCiud]  = useState(null)

  const [agregandoPais,  setAgregandoPais]  = useState(false)
  const [agregandoDepto, setAgregandoDepto] = useState(false)
  const [agregandoCiud,  setAgregandoCiud]  = useState(false)

  const { toast, showToast } = useToast()

  const { data: paises,        isLoading: loadPaises } = usePaises()
  const { data: departamentos, isLoading: loadDeptos } = useDepartamentos(paisSeleccionado?.id)
  const { data: ciudades,      isLoading: loadCiuds  } = useCiudades(deptoSeleccionado?.id)

  // Las mutaciones reciben showToast para notificar éxito y error
  const {
    crearPais, actualizarPais, eliminarPais,
    crearDepto, actualizarDepto, eliminarDepto,
    crearCiudad, actualizarCiudad, eliminarCiudad,
  } = useUbicacionMutations(showToast)

  // Al seleccionar un país se resetean departamento y ciudad
  const handleSeleccionarPais = (pais) => {
    setPaisSeleccionado(pais)
    setDeptoSeleccionado(null)
  }

  return (
    <>
      <style>{`
        /* ── UbicacionesPage — layout jerárquico de ubicaciones ── */
        .ub-root { font-family: 'DM Sans', sans-serif; }
        .ub-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
        .ub-title { font-size: 22px; font-weight: 600; color: #1a3a5c; margin-bottom: 2px; }
        .ub-subtitle { font-size: 13px; color: #6b7280; }
        /* Grid responsive de 3 columnas */
        .ub-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        @media (max-width: 900px) { .ub-grid { grid-template-columns: 1fr; } }
        @media (min-width: 901px) and (max-width: 1100px) { .ub-grid { grid-template-columns: 1fr 1fr; } }
        .ub-arrow { display: none; align-items: center; justify-content: center; color: #d1d5db; }
        @media (min-width: 901px) { .ub-arrow { display: flex; } }
      `}</style>

      {/* Notificación flotante */}
      <Toast toast={toast} />

      <div className="ub-root">
        <div className="ub-header">
          <div>
            <div className="ub-title">Ubicaciones</div>
            <div className="ub-subtitle">Gestión de países, departamentos y ciudades</div>
          </div>
        </div>

        {/* Breadcrumb de selección activa */}
        {(paisSeleccionado || deptoSeleccionado) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '13px', color: '#6b7280' }}>
            <MapPin size={13} />
            {paisSeleccionado && <span style={{ color: '#1a3a5c', fontWeight: 500 }}>{paisSeleccionado.descripcion}</span>}
            {deptoSeleccionado && <><ChevronRight size={13} /><span style={{ color: '#1a3a5c', fontWeight: 500 }}>{deptoSeleccionado.descripcion}</span></>}
          </div>
        )}

        <div className="ub-grid">

          {/* ── PAÍSES ── */}
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
              onEliminar={(id) => {
                if (window.confirm('¿Eliminar este país?')) {
                  eliminarPais.mutate(id)
                  if (paisSeleccionado?.id === id) handleSeleccionarPais(null)
                }
              }}
            />
          </div>

          {/* ── DEPARTAMENTOS ── */}
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
              onEliminar={(id) => {
                if (window.confirm('¿Eliminar este departamento?')) {
                  eliminarDepto.mutate(id)
                  if (deptoSeleccionado?.id === id) setDeptoSeleccionado(null)
                }
              }}
            />
          </div>

          {/* ── CIUDADES ── */}
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
              onEliminar={(id) => {
                if (window.confirm('¿Eliminar esta ciudad?')) eliminarCiudad.mutate(id)
              }}
            />
          </div>

        </div>
      </div>
    </>
  )
}
