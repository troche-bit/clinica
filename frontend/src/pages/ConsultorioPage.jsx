import { useState } from 'react'
import { Plus, Search, Building2, Pencil, Trash2 } from 'lucide-react'
import PanelSimple from '../components/ui/PanelSimple'
import Toast from '../components/ui/Toast'
import { useConsultorios, useConsultorioMutations } from '../hooks/useConsultorios'
import { useToast } from '../hooks/useToast'

// Definición de los campos del formulario de consultorio
const CAMPOS_CONSULTORIO = [
  { name: 'nro_consultorio', label: 'Nro. consultorio', placeholder: 'Ej: 01, A2...', requerido: true  },
  { name: 'descripcion',     label: 'Descripción',      placeholder: 'Descripción opcional...',        requerido: false },
]

// Títulos del panel según el modo activo
const TITULOS_PANEL = { nuevo: 'Nuevo consultorio', editar: 'Editar consultorio', ver: 'Detalle' }

// Extrae el primer mensaje de error de una respuesta 400 de DRF
function extraerMensajeError(err) {
  const data = err?.response?.data
  if (!data) return 'Ocurrió un error inesperado.'
  if (typeof data === 'string') return data
  // DRF devuelve { campo: [mensajes] } o { detail: 'msg' }
  const valores = Object.values(data)
  if (valores.length === 0) return 'Error al guardar.'
  const primero = valores[0]
  return Array.isArray(primero) ? primero[0] : String(primero)
}

export default function ConsultorioPage() {
  const [search,       setSearch]       = useState('')
  const [searchInput,  setSearchInput]  = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [modo,         setModo]         = useState(null) // 'ver' | 'editar' | 'crear'

  const { data, isLoading }             = useConsultorios(search)
  const { crear, actualizar, eliminar } = useConsultorioMutations()
  const { toast, showToast }            = useToast()

  const consultorios = data?.results || data || []

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
        showToast('Consultorio creado correctamente.', 'success')
      } else {
        await actualizar.mutateAsync({ id: seleccionado.id, ...form })
        showToast('Consultorio actualizado correctamente.', 'success')
      }
      cerrarPanel()
    } catch (err) {
      // Mostrar el error del backend al usuario sin cerrar el panel
      showToast(extraerMensajeError(err), 'error')
    }
  }

  const handleEliminar = (id) => {
    if (window.confirm('¿Eliminar este consultorio?')) {
      eliminar.mutate(id, {
        onSuccess: () => showToast('Consultorio eliminado.', 'success'),
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
        /* ── ConsultorioPage — layout, encabezado y tabla ── */
        .con-root { font-family: 'DM Sans', sans-serif; }
        .con-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 24px; gap: 12px; flex-wrap: wrap;
        }
        .con-title    { font-size: 22px; font-weight: 600; color: #1a3a5c; margin-bottom: 2px; }
        .con-subtitle { font-size: 13px; color: #6b7280; }
        .con-btn-nuevo {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; background: #1a3a5c; color: #fff;
          border: none; border-radius: 9px; font-size: 13.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; white-space: nowrap;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .con-btn-nuevo:hover { background: #15304d; box-shadow: 0 4px 12px rgba(26,58,92,0.2); }
        /* Barra de búsqueda */
        .con-search-row  { display: flex; gap: 8px; margin-bottom: 16px; }
        .con-search-wrap { position: relative; flex: 1; max-width: 380px; }
        .con-search-icon {
          position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
          color: #9ca3af; pointer-events: none;
        }
        .con-search-input {
          width: 100%; padding: 9px 12px 9px 34px; border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #111827;
          background: #fff; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .con-search-input:focus { border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08); }
        .con-search-input::placeholder { color: #d1d5db; }
        .con-btn-search {
          padding: 9px 16px; background: #f8fafc; border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #374151; cursor: pointer;
        }
        .con-btn-search:hover { background: #f0f4f8; }
        /* Layout tabla + panel */
        .con-layout { display: flex; gap: 16px; align-items: flex-start; }
        .con-table-card {
          flex: 1; background: #fff; border: 1px solid #e8edf2;
          border-radius: 12px; overflow: hidden; min-width: 0;
        }
        /* Tabla de consultorios */
        .con-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .con-table thead { background: #f8fafc; border-bottom: 1px solid #e8edf2; }
        .con-table th {
          text-align: left; padding: 11px 16px; font-size: 11px; font-weight: 600;
          letter-spacing: .05em; text-transform: uppercase; color: #9ca3af; white-space: nowrap;
        }
        .con-table td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: middle; }
        .con-table tbody tr:last-child td { border-bottom: none; }
        .con-table tbody tr { cursor: pointer; transition: background 0.15s; }
        .con-table tbody tr:hover  { background: #f8fafc; }
        .con-table tbody tr.activo { background: #eff6ff; }
        .con-table tbody tr.activo td { color: #1a3a5c; }
        /* Badge para el número de consultorio */
        .con-nro {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 32px; height: 32px; background: #dbeafe; border-radius: 8px;
          font-size: 12px; font-weight: 600; color: #1a3a5c; padding: 0 10px;
        }
        .con-hint  { font-size: 12px; color: #9ca3af; margin-top: 4px; font-style: italic; }
        /* Estado vacío */
        .con-empty { text-align: center; padding: 48px 16px; color: #9ca3af; font-size: 13.5px; }
        .con-empty-icon {
          width: 40px; height: 40px; margin: 0 auto 12px; background: #f3f4f6;
          border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #d1d5db;
        }
      `}</style>

      {/* Notificación flotante */}
      <Toast toast={toast} />

      <div className="con-root">
        {/* Encabezado de la página */}
        <div className="con-header">
          <div>
            <div className="con-title">Consultorios</div>
            <div className="con-subtitle">
              {consultorios.length > 0
                ? `${consultorios.length} consultorios registrados`
                : 'Gestión de consultorios'}
            </div>
          </div>
          <button className="con-btn-nuevo" onClick={() => { setSeleccionado(null); setModo('crear') }}>
            <Plus size={15} /> Nuevo consultorio
          </button>
        </div>

        {/* Buscador */}
        <form onSubmit={handleSearch} className="con-search-row">
          <div className="con-search-wrap">
            <Search size={15} className="con-search-icon" />
            <input
              type="text"
              placeholder="Buscar por número de consultorio..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="con-search-input"
            />
          </div>
          <button type="submit" className="con-btn-search">Buscar</button>
        </form>

        {/* Tabla + Panel lateral */}
        <div className="con-layout">
          <div className="con-table-card">
            <table className="con-table">
              <thead>
                <tr>
                  <th>Nro.</th>
                  <th>Descripción</th>
                  <th style={{ width: '80px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={3} className="con-empty">Cargando...</td></tr>
                )}
                {!isLoading && consultorios.length === 0 && (
                  <tr><td colSpan={3}>
                    <div className="con-empty">
                      <div className="con-empty-icon"><Building2 size={18} /></div>
                      Sin consultorios registrados
                    </div>
                  </td></tr>
                )}
                {consultorios.map((c) => (
                  <tr
                    key={c.id}
                    className={seleccionado?.id === c.id ? 'activo' : ''}
                    onClick={() => { setSeleccionado(c); setModo('ver') }}
                  >
                    <td><span className="con-nro">{c.nro_consultorio}</span></td>
                    <td>
                      {c.descripcion}
                      {seleccionado?.id !== c.id && (
                        <div className="con-hint">Hacé clic para ver el detalle</div>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSeleccionado(c); setModo('editar') }}
                          style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid #e8edf2', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#1a3a5c'; e.currentTarget.style.borderColor = '#bfdbfe' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#e8edf2' }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEliminar(c.id) }}
                          style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid #e8edf2', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fecaca' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#e8edf2' }}
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
              icono={<Building2 size={22} color="#1a3a5c" />}
              campos={CAMPOS_CONSULTORIO}
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
