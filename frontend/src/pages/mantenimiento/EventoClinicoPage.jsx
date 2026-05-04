import { useState } from 'react'
import { Plus, Search, Activity, Pencil, Trash2 } from 'lucide-react'
import PanelSimple from '../../components/ui/PanelSimple'
import Toast from '../../components/ui/Toast'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useEventosClinicos, useEventoClinicoMutations } from '../../hooks/mantenimiento/useEventosClinicos'
import { useToast } from '../../hooks/useToast'
import { extraerMensajeError } from '../../utils/errores'

const CAMPOS_EVENTO = [
  { name: 'tipo_evento', label: 'Tipo de evento', placeholder: 'Ej: Consulta, Cirugía, Urgencia...', requerido: true },
]

const TITULOS_PANEL = { nuevo: 'Nuevo evento clínico', editar: 'Editar evento clínico', ver: 'Detalle' }


export default function EventoClinicoPage() {
  const [search,       setSearch]       = useState('')
  const [searchInput,  setSearchInput]  = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [modo,         setModo]         = useState(null)
  const [confirmId,    setConfirmId]    = useState(null)

  const { data, isLoading }             = useEventosClinicos(search)
  const { crear, actualizar, eliminar } = useEventoClinicoMutations()
  const { toast, showToast }            = useToast()

  const eventos = data?.results || data || []

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
        showToast('Evento clínico creado correctamente.', 'success')
      } else {
        await actualizar.mutateAsync({ id: seleccionado.id, ...form })
        showToast('Evento clínico actualizado correctamente.', 'success')
      }
      cerrarPanel()
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    }
  }

  const handleEliminar = (id) => setConfirmId(id)

  const confirmarEliminar = () => {
    eliminar.mutate(confirmId, {
      onSuccess: () => { showToast('Evento clínico eliminado.', 'success'); cerrarPanel() },
      onError:   (err) => showToast(extraerMensajeError(err), 'error'),
    })
    setConfirmId(null)
  }

  const guardando = crear.isPending || actualizar.isPending

  return (
    <>
      <style>{`
        .ec-root { font-family: 'DM Sans', sans-serif; }
        .ec-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 24px; gap: 12px; flex-wrap: wrap;
        }
        .ec-title    { font-size: 22px; font-weight: 600; color: #1a3a5c; margin-bottom: 2px; }
        .ec-subtitle { font-size: 13px; color: #6b7280; }
        .ec-btn-nuevo {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; background: #1a3a5c; color: #fff;
          border: none; border-radius: 9px; font-size: 13.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; white-space: nowrap;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .ec-btn-nuevo:hover { background: #15304d; box-shadow: 0 4px 12px rgba(26,58,92,0.2); }
        .ec-search-row  { display: flex; gap: 8px; margin-bottom: 16px; }
        .ec-search-wrap { position: relative; flex: 1; max-width: 380px; }
        .ec-search-icon {
          position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
          color: #9ca3af; pointer-events: none;
        }
        .ec-search-input {
          width: 100%; padding: 9px 12px 9px 34px; border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #111827;
          background: #fff; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .ec-search-input:focus { border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08); }
        .ec-search-input::placeholder { color: #d1d5db; }
        .ec-btn-search {
          padding: 9px 16px; background: #f8fafc; border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #374151; cursor: pointer;
        }
        .ec-btn-search:hover { background: #f0f4f8; }
        .ec-layout { display: flex; gap: 16px; align-items: flex-start; }
        .ec-table-card {
          flex: 1; background: #fff; border: 1px solid #e8edf2;
          border-radius: 12px; overflow: hidden; min-width: 0;
        }
        .ec-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .ec-table thead { background: #f8fafc; border-bottom: 1px solid #e8edf2; }
        .ec-table th {
          text-align: left; padding: 11px 16px; font-size: 11px; font-weight: 600;
          letter-spacing: .05em; text-transform: uppercase; color: #9ca3af; white-space: nowrap;
        }
        .ec-table td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: middle; }
        .ec-table tbody tr:last-child td { border-bottom: none; }
        .ec-table tbody tr { cursor: pointer; transition: background 0.15s; }
        .ec-table tbody tr:hover  { background: #f8fafc; }
        .ec-table tbody tr.activo { background: #eff6ff; }
        .ec-table tbody tr.activo td { color: #1a3a5c; }
        .ec-hint  { font-size: 12px; color: #9ca3af; margin-top: 4px; font-style: italic; }
        .ec-empty { text-align: center; padding: 48px 16px; color: #9ca3af; font-size: 13.5px; }
        .ec-empty-icon {
          width: 40px; height: 40px; margin: 0 auto 12px; background: #f3f4f6;
          border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #d1d5db;
        }
        .ec-action-btn {
          width: 28px; height: 28px; border-radius: 7px; border: 1px solid #e8edf2;
          background: none; cursor: pointer; display: flex; align-items: center;
          justify-content: center; color: #6b7280; transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .ec-action-btn.edit:hover  { background: #eff6ff; color: #1a3a5c; border-color: #bfdbfe; }
        .ec-action-btn.trash:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
      `}</style>

      <Toast toast={toast} />

      <ConfirmDialog
        isOpen={confirmId !== null}
        title="Eliminar evento clínico"
        description="¿Estás seguro de que querés eliminar este evento clínico? Si tiene consultas vinculadas no se podrá eliminar."
        onConfirm={confirmarEliminar}
        onCancel={() => setConfirmId(null)}
        loading={eliminar.isPending}
      />

      <div className="ec-root">
        <div className="ec-header">
          <div>
            <div className="ec-title">Eventos Clínicos</div>
            <div className="ec-subtitle">
              {eventos.length > 0
                ? `${eventos.length} eventos clínicos registrados`
                : 'Gestión de eventos clínicos'}
            </div>
          </div>
          <button className="ec-btn-nuevo" onClick={() => { setSeleccionado(null); setModo('crear') }}>
            <Plus size={15} /> Nuevo evento clínico
          </button>
        </div>

        <form onSubmit={handleSearch} className="ec-search-row">
          <div className="ec-search-wrap">
            <Search size={15} className="ec-search-icon" />
            <input
              type="text"
              placeholder="Buscar por tipo de evento..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="ec-search-input"
            />
          </div>
          <button type="submit" className="ec-btn-search">Buscar</button>
        </form>

        <div className="ec-layout">
          <div className="ec-table-card">
            <table className="ec-table">
              <thead>
                <tr>
                  <th>Tipo de evento</th>
                  <th style={{ width: '80px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={2} className="ec-empty">Cargando...</td></tr>
                )}
                {!isLoading && eventos.length === 0 && (
                  <tr><td colSpan={2}>
                    <div className="ec-empty">
                      <div className="ec-empty-icon"><Activity size={18} /></div>
                      Sin eventos clínicos registrados
                    </div>
                  </td></tr>
                )}
                {eventos.map((ev) => (
                  <tr
                    key={ev.id}
                    className={seleccionado?.id === ev.id ? 'activo' : ''}
                    onClick={() => { setSeleccionado(ev); setModo('ver') }}
                  >
                    <td>
                      {ev.tipo_evento}
                      {seleccionado?.id !== ev.id && (
                        <div className="ec-hint">Hacé clic para ver el detalle</div>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="ec-action-btn edit"
                          onClick={(e) => { e.stopPropagation(); setSeleccionado(ev); setModo('editar') }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="ec-action-btn trash"
                          onClick={(e) => { e.stopPropagation(); handleEliminar(ev.id) }}
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

          {modo && (
            <PanelSimple
              titulos={TITULOS_PANEL}
              icono={<Activity size={22} color="#1a3a5c" />}
              campos={CAMPOS_EVENTO}
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
