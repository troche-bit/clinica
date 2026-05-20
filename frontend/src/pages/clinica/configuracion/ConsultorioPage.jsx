import { useState, useRef } from 'react'
import { Plus, Search, Building2, Pencil, Trash2 } from 'lucide-react'
import PanelSimple from '../../../components/ui/PanelSimple'
import Toast from '../../../components/ui/Toast'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { useConsultorios, useConsultorioMutations } from '../../../hooks/clinica/useConsultorios'
import { useToast } from '../../../hooks/useToast'
import { useAtajosTeclado } from '../../../hooks/useAtajosTeclado'
import { useAuth } from '../../../context/AuthContext'
import { extraerMensajeError } from '../../../utils/errores'
import { useNavigationGuard } from '../../../hooks/useNavigationGuard'

const CAMPOS_CONSULTORIO = [
  { name: 'nro_consultorio', label: 'Nro. consultorio', placeholder: 'Ej: 01, A2...', requerido: true  },
  { name: 'descripcion',     label: 'Descripción',      placeholder: 'Descripción opcional...',        requerido: false },
]

const TITULOS_PANEL = { nuevo: 'Nuevo consultorio', editar: 'Editar consultorio', ver: 'Detalle' }

export default function ConsultorioPage() {
  const [search,       setSearch]       = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [modo,         setModo]         = useState(null)
  const [confirmId,    setConfirmId]    = useState(null)
  const debounceRef = useRef(null)

  const { user }                        = useAuth()
  const puedeEliminar                   = user?.rol === 'admin'
  const { guardAction }                 = useNavigationGuard()

  const { data, isLoading }             = useConsultorios(search)
  const { crear, actualizar, eliminar } = useConsultorioMutations()
  const { toast, showToast }            = useToast()

  const consultorios = data?.results || data || []

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
        showToast('Consultorio creado correctamente.', 'success')
      } else {
        await actualizar.mutateAsync({ id: seleccionado.id, ...form })
        showToast('Consultorio actualizado correctamente.', 'success')
      }
      cerrarPanel()
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    }
  }

  const handleEliminar = (id) => setConfirmId(id)

  const confirmarEliminar = () => {
    eliminar.mutate(confirmId, {
      onSuccess: () => { showToast('Consultorio eliminado.', 'success'); cerrarPanel() },
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
        .con-root { font-family: 'DM Sans', sans-serif; }
        .con-toolbar {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 16px; flex-wrap: wrap;
        }
        .con-title-group { flex: 1 1 auto; order: 1; min-width: 0; }
        .con-title    { font-size: 18px; font-weight: 600; color: #1a3a5c; }
        .con-subtitle { font-size: 12px; color: #9ca3af; margin-top: 2px; }
        .con-search-wrap {
          position: relative; flex: 1 1 200px; max-width: 360px; order: 2;
        }
        .con-search-icon {
          position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
          color: #9ca3af; pointer-events: none;
        }
        .con-search-input {
          width: 100%; padding: 9px 12px 9px 34px; border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #111827;
          background: #fff; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .con-search-input:focus { border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08); }
        .con-search-input::placeholder { color: #d1d5db; }
        .con-btn-nuevo {
          display: inline-flex; align-items: center; gap: 7px; order: 3; flex-shrink: 0;
          padding: 9px 18px; background: #1a3a5c; color: #fff;
          border: none; border-radius: 9px; font-size: 13.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; white-space: nowrap;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .con-btn-nuevo:hover { background: #15304d; box-shadow: 0 4px 12px rgba(26,58,92,0.2); }
        @media (max-width: 600px) {
          .con-search-wrap { flex: 0 0 100%; order: 4; max-width: none; }
        }
        .con-layout { display: flex; gap: 16px; align-items: flex-start; }
        .con-table-card {
          flex: 1; background: #fff; border: 1px solid #e8edf2;
          border-radius: 12px; overflow: hidden; min-width: 0;
        }
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
        .con-nro {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 32px; height: 32px; background: #dbeafe; border-radius: 8px;
          font-size: 12px; font-weight: 600; color: #1a3a5c; padding: 0 10px;
        }
        .con-hint  { font-size: 12px; color: #9ca3af; margin-top: 4px; font-style: italic; }
        .con-empty { text-align: center; padding: 48px 16px; color: #9ca3af; font-size: 13.5px; }
        .con-empty-icon {
          width: 40px; height: 40px; margin: 0 auto 12px; background: #f3f4f6;
          border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #d1d5db;
        }
        .con-action-btn {
          width: 28px; height: 28px; border-radius: 7px; border: 1px solid #e8edf2;
          background: none; cursor: pointer; display: flex; align-items: center;
          justify-content: center; color: #6b7280; transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .con-action-btn.edit:hover  { background: #eff6ff; color: #1a3a5c; border-color: #bfdbfe; }
        .con-action-btn.trash:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
      `}</style>

      <Toast toast={toast} />

      <ConfirmDialog
        isOpen={confirmId !== null}
        title="Eliminar consultorio"
        description="¿Estás seguro de que querés eliminar este consultorio? Si tiene horarios de prestador activos no se podrá eliminar."
        onConfirm={confirmarEliminar}
        onCancel={() => setConfirmId(null)}
        loading={eliminar.isPending}
      />

      <div className="con-root">
        <div className="con-toolbar">
          <div className="con-title-group">
            <div className="con-title">Consultorios</div>
            <div className="con-subtitle">
              {consultorios.length > 0
                ? `${consultorios.length} consultorios registrados`
                : 'Gestión de consultorios'}
            </div>
          </div>
          <div className="con-search-wrap">
            <Search size={15} className="con-search-icon" />
            <input
              type="text"
              placeholder="Buscar por número o descripción..."
              onChange={handleSearchChange}
              className="con-search-input"
            />
          </div>
          <button className="con-btn-nuevo" onClick={() => guardAction(() => { setSeleccionado(null); setModo('crear') })}>
            <Plus size={15} /> Nuevo consultorio
          </button>
        </div>

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
                    onClick={() => guardAction(() => { setSeleccionado(c); setModo('ver') })}
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
                          className="con-action-btn edit"
                          onClick={(e) => { e.stopPropagation(); guardAction(() => { setSeleccionado(c); setModo('editar') }) }}
                        >
                          <Pencil size={13} />
                        </button>
                        {puedeEliminar && (
                          <button
                            className="con-action-btn trash"
                            onClick={(e) => { e.stopPropagation(); handleEliminar(c.id) }}
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
              icono={<Building2 size={22} color="#1a3a5c" />}
              campos={CAMPOS_CONSULTORIO}
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
