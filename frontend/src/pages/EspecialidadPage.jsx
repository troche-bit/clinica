import { useState } from 'react'
import { Plus, Search, Stethoscope, Pencil, Trash2 } from 'lucide-react'
import PanelSimple from '../components/ui/PanelSimple'
import Toast from '../components/ui/Toast'
import { useEspecialidades, useEspecialidadMutations } from '../hooks/useEspecialidades'
import { useToast } from '../hooks/useToast'

// Campos del formulario de especialidad
const CAMPOS_ESPECIALIDAD = [
  { name: 'descripcion', label: 'Descripción', placeholder: 'Ej: Cardiología, Pediatría...', requerido: true },
]

// Títulos del panel según el modo activo
const TITULOS_PANEL = { nuevo: 'Nueva especialidad', editar: 'Editar especialidad', ver: 'Detalle' }

// Extrae el primer mensaje de error de una respuesta 400 de DRF
function extraerMensajeError(err) {
  const data = err?.response?.data
  if (!data) return 'Ocurrió un error inesperado.'
  if (typeof data === 'string') return data
  const valores = Object.values(data)
  if (valores.length === 0) return 'Error al guardar.'
  const primero = valores[0]
  if (typeof primero === 'object' && !Array.isArray(primero)) {
    const sub = Object.values(primero)[0]
    return Array.isArray(sub) ? sub[0] : String(sub)
  }
  return Array.isArray(primero) ? primero[0] : String(primero)
}

export default function EspecialidadPage() {
  const [search,       setSearch]       = useState('')
  const [searchInput,  setSearchInput]  = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [modo,         setModo]         = useState(null) // 'ver' | 'editar' | 'crear'

  const { data, isLoading }             = useEspecialidades(search)
  const { crear, actualizar, eliminar } = useEspecialidadMutations()
  const { toast, showToast }            = useToast()

  const especialidades = data?.results || data || []

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  const cerrarPanel = () => {
    setSeleccionado(null)
    setModo(null)
  }

  const handleGuardar = async (form) => {
    try {
      if (modo === 'crear') {
        await crear.mutateAsync(form)
        showToast('Especialidad creada correctamente.', 'success')
      } else {
        await actualizar.mutateAsync({ id: seleccionado.id, ...form })
        showToast('Especialidad actualizada correctamente.', 'success')
      }
      cerrarPanel()
    } catch (err) {
      // Muestra el error del backend sin cerrar el panel
      showToast(extraerMensajeError(err), 'error')
    }
  }

  const handleEliminar = (id) => {
    if (window.confirm('¿Eliminar esta especialidad?')) {
      eliminar.mutate(id, {
        onSuccess: () => showToast('Especialidad eliminada.', 'success'),
        onError:   (err) => showToast(extraerMensajeError(err), 'error'),
      })
      cerrarPanel()
    }
  }

  // Estado de carga para deshabilitar el botón Guardar mientras se procesa la petición
  const guardando = crear.isPending || actualizar.isPending

  return (
    <>
      <style>{`
        /* ── EspecialidadPage — layout, encabezado y tabla ── */
        .esp-root { font-family: 'DM Sans', sans-serif; }
        .esp-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 24px; gap: 12px; flex-wrap: wrap;
        }
        .esp-title    { font-size: 22px; font-weight: 600; color: #1a3a5c; margin-bottom: 2px; }
        .esp-subtitle { font-size: 13px; color: #6b7280; }
        .esp-btn-nuevo {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; background: #1a3a5c; color: #fff;
          border: none; border-radius: 9px; font-size: 13.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; white-space: nowrap;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .esp-btn-nuevo:hover { background: #15304d; box-shadow: 0 4px 12px rgba(26,58,92,0.2); }
        /* Barra de búsqueda */
        .esp-search-row  { display: flex; gap: 8px; margin-bottom: 16px; }
        .esp-search-wrap { position: relative; flex: 1; max-width: 380px; }
        .esp-search-icon {
          position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
          color: #9ca3af; pointer-events: none;
        }
        .esp-search-input {
          width: 100%; padding: 9px 12px 9px 34px; border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #111827;
          background: #fff; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .esp-search-input:focus { border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08); }
        .esp-search-input::placeholder { color: #d1d5db; }
        .esp-btn-search {
          padding: 9px 16px; background: #f8fafc; border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #374151; cursor: pointer;
        }
        .esp-btn-search:hover { background: #f0f4f8; }
        /* Layout tabla + panel */
        .esp-layout { display: flex; gap: 16px; align-items: flex-start; }
        .esp-table-card {
          flex: 1; background: #fff; border: 1px solid #e8edf2;
          border-radius: 12px; overflow: hidden; min-width: 0;
        }
        /* Tabla de especialidades */
        .esp-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .esp-table thead { background: #f8fafc; border-bottom: 1px solid #e8edf2; }
        .esp-table th {
          text-align: left; padding: 11px 16px; font-size: 11px; font-weight: 600;
          letter-spacing: .05em; text-transform: uppercase; color: #9ca3af; white-space: nowrap;
        }
        .esp-table td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: middle; }
        .esp-table tbody tr:last-child td { border-bottom: none; }
        .esp-table tbody tr { cursor: pointer; transition: background 0.15s; }
        .esp-table tbody tr:hover  { background: #f8fafc; }
        .esp-table tbody tr.activo { background: #eff6ff; }
        .esp-table tbody tr.activo td { color: #1a3a5c; }
        .esp-hint  { font-size: 12px; color: #9ca3af; margin-top: 4px; font-style: italic; }
        /* Estado vacío */
        .esp-empty { text-align: center; padding: 48px 16px; color: #9ca3af; font-size: 13.5px; }
        .esp-empty-icon {
          width: 40px; height: 40px; margin: 0 auto 12px; background: #f3f4f6;
          border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #d1d5db;
        }
      `}</style>

      {/* Notificación flotante */}
      <Toast toast={toast} />

      <div className="esp-root">
        {/* Encabezado de la página */}
        <div className="esp-header">
          <div>
            <div className="esp-title">Especialidades</div>
            <div className="esp-subtitle">
              {especialidades.length > 0
                ? `${especialidades.length} especialidades registradas`
                : 'Gestión de especialidades'}
            </div>
          </div>
          <button className="esp-btn-nuevo" onClick={() => { setSeleccionado(null); setModo('crear') }}>
            <Plus size={15} /> Nueva especialidad
          </button>
        </div>

        {/* Buscador */}
        <form onSubmit={handleSearch} className="esp-search-row">
          <div className="esp-search-wrap">
            <Search size={15} className="esp-search-icon" />
            <input
              type="text"
              placeholder="Buscar por especialidad..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="esp-search-input"
            />
          </div>
          <button type="submit" className="esp-btn-search">Buscar</button>
        </form>

        {/* Tabla + Panel lateral */}
        <div className="esp-layout">
          <div className="esp-table-card">
            <table className="esp-table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th style={{ width: '80px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={2} className="esp-empty">Cargando...</td></tr>
                )}
                {!isLoading && especialidades.length === 0 && (
                  <tr><td colSpan={2}>
                    <div className="esp-empty">
                      <div className="esp-empty-icon"><Stethoscope size={18} /></div>
                      Sin especialidades registradas
                    </div>
                  </td></tr>
                )}
                {especialidades.map((e) => (
                  <tr
                    key={e.id}
                    className={seleccionado?.id === e.id ? 'activo' : ''}
                    onClick={() => { setSeleccionado(e); setModo('ver') }}
                  >
                    <td>
                      {e.descripcion}
                      {seleccionado?.id !== e.id && (
                        <div className="esp-hint">Hacé clic para ver el detalle</div>
                      )}
                    </td>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={(ev) => { ev.stopPropagation(); setSeleccionado(e); setModo('editar') }}
                          style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid #e8edf2', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}
                          onMouseEnter={(ev) => { ev.currentTarget.style.background = '#eff6ff'; ev.currentTarget.style.color = '#1a3a5c'; ev.currentTarget.style.borderColor = '#bfdbfe' }}
                          onMouseLeave={(ev) => { ev.currentTarget.style.background = 'none'; ev.currentTarget.style.color = '#6b7280'; ev.currentTarget.style.borderColor = '#e8edf2' }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={(ev) => { ev.stopPropagation(); handleEliminar(e.id) }}
                          style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid #e8edf2', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}
                          onMouseEnter={(ev) => { ev.currentTarget.style.background = '#fef2f2'; ev.currentTarget.style.color = '#dc2626'; ev.currentTarget.style.borderColor = '#fecaca' }}
                          onMouseLeave={(ev) => { ev.currentTarget.style.background = 'none'; ev.currentTarget.style.color = '#6b7280'; ev.currentTarget.style.borderColor = '#e8edf2' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Panel lateral — se muestra cuando hay un modo activo */}
          {modo && (
            <PanelSimple
              titulos={TITULOS_PANEL}
              icono={<Stethoscope size={22} color="#1a3a5c" />}
              campos={CAMPOS_ESPECIALIDAD}
              item={seleccionado}
              modo={modo}
              onCancelar={cerrarPanel}
              onGuardar={handleGuardar}
              onEditar={() => setModo('editar')}
              onEliminar={handleEliminar}
              guardando={guardando}
            />
          )}
        </div>
      </div>
    </>
  )
}
