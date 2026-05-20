import { useState, useRef } from 'react'
import { Plus, Search, Stethoscope, Pencil, Trash2 } from 'lucide-react'
import PanelSimple from '../../../components/ui/PanelSimple'
import Toast from '../../../components/ui/Toast'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { useEspecialidades, useEspecialidadMutations } from '../../../hooks/clinica/useEspecialidades'
import { useToast } from '../../../hooks/useToast'
import { useAtajosTeclado } from '../../../hooks/useAtajosTeclado'
import { useAuth } from '../../../context/AuthContext'
import { extraerMensajeError } from '../../../utils/errores'
import { useNavigationGuard } from '../../../hooks/useNavigationGuard'

const CAMPOS_ESPECIALIDAD = [
  { name: 'descripcion', label: 'Descripción', placeholder: 'Ej: Cardiología, Pediatría...', requerido: true },
]

const TITULOS_PANEL = { nuevo: 'Nueva especialidad', editar: 'Editar especialidad', ver: 'Detalle' }

export default function EspecialidadPage() {
  const [search,       setSearch]       = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [modo,         setModo]         = useState(null)
  const [confirmId,    setConfirmId]    = useState(null)
  const debounceRef = useRef(null)

  const { user }                        = useAuth()
  const puedeEliminar                   = user?.rol === 'admin'
  const { guardAction }                 = useNavigationGuard()

  const { data, isLoading }             = useEspecialidades(search)
  const { crear, actualizar, eliminar } = useEspecialidadMutations()
  const { toast, showToast }            = useToast()

  const especialidades = data?.results || data || []

  const handleSearchChange = (e) => {
    const val = e.target.value
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearch(val), 300)
  }

  const cerrarPanel = () => { setSeleccionado(null); setModo(null) }

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
      showToast(extraerMensajeError(err), 'error')
    }
  }

  const handleEliminar = (id) => setConfirmId(id)

  const confirmarEliminar = () => {
    eliminar.mutate(confirmId, {
      onSuccess: () => { showToast('Especialidad eliminada.', 'success'); cerrarPanel() },
      onError:   (err) => showToast(extraerMensajeError(err), 'error'),
    })
    setConfirmId(null)
  }

  const guardando = crear.isPending || actualizar.isPending

  useAtajosTeclado({
    'Insert': { fn: () => { if (modo === null) { setSeleccionado(null); setModo('crear') } } },
  })

  return (
    <>
      <style>{`
        .esp-root { font-family: 'DM Sans', sans-serif; }
        .esp-toolbar {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 16px; flex-wrap: wrap;
        }
        .esp-title-group { flex: 1 1 auto; order: 1; min-width: 0; }
        .esp-title    { font-size: 18px; font-weight: 600; color: #1a3a5c; }
        .esp-subtitle { font-size: 12px; color: #9ca3af; margin-top: 2px; }
        .esp-search-wrap {
          position: relative; flex: 1 1 200px; max-width: 360px; order: 2;
        }
        .esp-search-icon {
          position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
          color: #9ca3af; pointer-events: none;
        }
        .esp-search-input {
          width: 100%; padding: 9px 12px 9px 34px; border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #111827;
          background: #fff; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .esp-search-input:focus { border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08); }
        .esp-search-input::placeholder { color: #d1d5db; }
        .esp-btn-nuevo {
          display: inline-flex; align-items: center; gap: 7px; order: 3; flex-shrink: 0;
          padding: 9px 18px; background: #1a3a5c; color: #fff;
          border: none; border-radius: 9px; font-size: 13.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; white-space: nowrap;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .esp-btn-nuevo:hover { background: #15304d; box-shadow: 0 4px 12px rgba(26,58,92,0.2); }
        @media (max-width: 600px) {
          .esp-search-wrap { flex: 0 0 100%; order: 4; max-width: none; }
        }
        .esp-layout { display: flex; gap: 16px; align-items: flex-start; }
        .esp-table-card {
          flex: 1; background: #fff; border: 1px solid #e8edf2;
          border-radius: 12px; overflow: hidden; min-width: 0;
        }
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
        .esp-empty { text-align: center; padding: 48px 16px; color: #9ca3af; font-size: 13.5px; }
        .esp-empty-icon {
          width: 40px; height: 40px; margin: 0 auto 12px; background: #f3f4f6;
          border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #d1d5db;
        }
        .esp-action-btn {
          width: 28px; height: 28px; border-radius: 7px; border: 1px solid #e8edf2;
          background: none; cursor: pointer; display: flex; align-items: center;
          justify-content: center; color: #6b7280; transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .esp-action-btn.edit:hover  { background: #eff6ff; color: #1a3a5c; border-color: #bfdbfe; }
        .esp-action-btn.trash:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
      `}</style>

      <Toast toast={toast} />

      <ConfirmDialog
        isOpen={confirmId !== null}
        title="Eliminar especialidad"
        description="¿Estás seguro de que querés eliminar esta especialidad? Si tiene prestadores asignados no se podrá eliminar."
        onConfirm={confirmarEliminar}
        onCancel={() => setConfirmId(null)}
        loading={eliminar.isPending}
      />

      <div className="esp-root">
        <div className="esp-toolbar">
          <div className="esp-title-group">
            <div className="esp-title">Especialidades</div>
            <div className="esp-subtitle">
              {especialidades.length > 0
                ? `${especialidades.length} especialidades registradas`
                : 'Gestión de especialidades'}
            </div>
          </div>
          <div className="esp-search-wrap">
            <Search size={15} className="esp-search-icon" />
            <input
              type="text"
              placeholder="Buscar por especialidad..."
              onChange={handleSearchChange}
              className="esp-search-input"
            />
          </div>
          <button className="esp-btn-nuevo" onClick={() => guardAction(() => { setSeleccionado(null); setModo('crear') })}>
            <Plus size={15} /> Nueva especialidad
          </button>
        </div>

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
                    onClick={() => guardAction(() => { setSeleccionado(e); setModo('ver') })}
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
                          className="esp-action-btn edit"
                          onClick={(ev) => { ev.stopPropagation(); guardAction(() => { setSeleccionado(e); setModo('editar') }) }}
                        >
                          <Pencil size={13} />
                        </button>
                        {puedeEliminar && (
                          <button
                            className="esp-action-btn trash"
                            onClick={(ev) => { ev.stopPropagation(); handleEliminar(e.id) }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
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
              icono={<Stethoscope size={22} color="#1a3a5c" />}
              campos={CAMPOS_ESPECIALIDAD}
              item={seleccionado}
              modo={modo}
              onCancelar={cerrarPanel}
              onGuardar={handleGuardar}
              onEditar={() => setModo('editar')}
              onEliminar={handleEliminar}
              guardando={guardando}
              ocultarEliminar={!puedeEliminar}
            />
          )}
        </div>
      </div>
    </>
  )
}
