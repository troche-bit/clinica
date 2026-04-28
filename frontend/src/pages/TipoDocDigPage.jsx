import { useState } from 'react'
import { Plus, Search, FileText, Pencil, Trash2 } from 'lucide-react'
import PanelSimple from '../components/ui/PanelSimple'
import Toast from '../components/ui/Toast'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useTipoDocDig, useTipoDocDigMutations } from '../hooks/useTipoDocDig'
import { useToast } from '../hooks/useToast'

const CAMPOS_TIPO_DOC = [
  {
    name:        'descripcion',
    label:       'Descripción',
    placeholder: 'Ej: Historia Clínica, Receta Médica...',
    requerido:   true,
  },
  {
    name:        'storage_key',
    label:       'Clave de almacenamiento',
    placeholder: 'Ej: historia_clinica (solo minúsculas y guiones bajos)',
    requerido:   true,
    soloLectura: true, // no editable después de la creación — cambiarla rompe rutas de archivos
  },
]

const TITULOS_PANEL = {
  nuevo:  'Nuevo tipo de documento',
  editar: 'Editar tipo de documento',
  ver:    'Detalle',
}

export default function TipoDocDigPage() {
  const [search,       setSearch]       = useState('')
  const [searchInput,  setSearchInput]  = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [modo,         setModo]         = useState(null)
  const [confirmId,    setConfirmId]    = useState(null)

  const { data, isLoading }             = useTipoDocDig(search)
  const { toast, showToast }            = useToast()
  const { crear, actualizar, eliminar } = useTipoDocDigMutations(showToast)

  const tipos = data?.results || data || []

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  const cerrarPanel = () => {
    setSeleccionado(null)
    setModo(null)
  }

  const handleGuardar = (form) => {
    if (modo === 'crear') {
      crear.mutate(form, { onSuccess: cerrarPanel })
    } else {
      actualizar.mutate({ id: seleccionado.id, ...form }, { onSuccess: cerrarPanel })
    }
  }

  const handleEliminar = (id) => setConfirmId(id)

  const confirmarEliminar = () => {
    eliminar.mutate(confirmId, {
      onSuccess: () => {
        cerrarPanel()
        setConfirmId(null)
      },
    })
  }

  const guardando = crear.isPending || actualizar.isPending

  return (
    <>
      <style>{`
        .tdd-root { font-family: 'DM Sans', sans-serif; }
        .tdd-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 24px; gap: 12px; flex-wrap: wrap;
        }
        .tdd-title    { font-size: 22px; font-weight: 600; color: #1a3a5c; margin-bottom: 2px; }
        .tdd-subtitle { font-size: 13px; color: #6b7280; }
        .tdd-btn-nuevo {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; background: #1a3a5c; color: #fff;
          border: none; border-radius: 9px; font-size: 13.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; white-space: nowrap;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .tdd-btn-nuevo:hover { background: #15304d; box-shadow: 0 4px 12px rgba(26,58,92,0.2); }
        .tdd-search-row  { display: flex; gap: 8px; margin-bottom: 16px; }
        .tdd-search-wrap { position: relative; flex: 1; max-width: 380px; }
        .tdd-search-icon {
          position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
          color: #9ca3af; pointer-events: none;
        }
        .tdd-search-input {
          width: 100%; padding: 9px 12px 9px 34px; border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #111827;
          background: #fff; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .tdd-search-input:focus { border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08); }
        .tdd-search-input::placeholder { color: #d1d5db; }
        .tdd-btn-search {
          padding: 9px 16px; background: #f8fafc; border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #374151; cursor: pointer;
        }
        .tdd-btn-search:hover { background: #f0f4f8; }
        .tdd-layout { display: flex; gap: 16px; align-items: flex-start; }
        .tdd-table-card {
          flex: 1; background: #fff; border: 1px solid #e8edf2;
          border-radius: 12px; overflow: hidden; min-width: 0;
        }
        .tdd-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .tdd-table thead { background: #f8fafc; border-bottom: 1px solid #e8edf2; }
        .tdd-table th {
          text-align: left; padding: 11px 16px; font-size: 11px; font-weight: 600;
          letter-spacing: .05em; text-transform: uppercase; color: #9ca3af; white-space: nowrap;
        }
        .tdd-table td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: middle; }
        .tdd-table tbody tr:last-child td { border-bottom: none; }
        .tdd-table tbody tr { cursor: pointer; transition: background 0.15s; }
        .tdd-table tbody tr:hover  { background: #f8fafc; }
        .tdd-table tbody tr.activo { background: #eff6ff; }
        .tdd-table tbody tr.activo td { color: #1a3a5c; }
        .tdd-key {
          font-size: 11.5px; font-family: 'Courier New', monospace;
          color: #6b7280; background: #f3f4f6; border-radius: 5px;
          padding: 2px 7px; display: inline-block;
        }
        .tdd-hint  { font-size: 12px; color: #9ca3af; margin-top: 4px; font-style: italic; }
        .tdd-empty { text-align: center; padding: 48px 16px; color: #9ca3af; font-size: 13.5px; }
        .tdd-empty-icon {
          width: 40px; height: 40px; margin: 0 auto 12px; background: #f3f4f6;
          border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #d1d5db;
        }
        .tdd-action-btn {
          width: 28px; height: 28px; border-radius: 7px; border: 1px solid #e8edf2;
          background: none; cursor: pointer; display: flex; align-items: center;
          justify-content: center; color: #6b7280;
        }
        .tdd-action-btn.edit:hover  { background: #eff6ff; color: #1a3a5c; border-color: #bfdbfe; }
        .tdd-action-btn.trash:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
      `}</style>

      <Toast toast={toast} />

      <ConfirmDialog
        isOpen={!!confirmId}
        title="¿Eliminar este tipo de documento?"
        description="Si tiene documentos vinculados no se podrá eliminar."
        onConfirm={confirmarEliminar}
        onCancel={() => setConfirmId(null)}
        loading={eliminar.isPending}
      />

      <div className="tdd-root">
        <div className="tdd-header">
          <div>
            <div className="tdd-title">Tipos de documento digitalizado</div>
            <div className="tdd-subtitle">
              {tipos.length > 0
                ? `${tipos.length} tipos registrados`
                : 'Gestión de tipos de documento digitalizado'}
            </div>
          </div>
          <button className="tdd-btn-nuevo" onClick={() => { setSeleccionado(null); setModo('crear') }}>
            <Plus size={15} /> Nuevo tipo
          </button>
        </div>

        <form onSubmit={handleSearch} className="tdd-search-row">
          <div className="tdd-search-wrap">
            <Search size={15} className="tdd-search-icon" />
            <input
              type="text"
              placeholder="Buscar por descripción o clave..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="tdd-search-input"
            />
          </div>
          <button type="submit" className="tdd-btn-search">Buscar</button>
        </form>

        <div className="tdd-layout">
          <div className="tdd-table-card">
            <table className="tdd-table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Clave</th>
                  <th style={{ width: '80px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={3} className="tdd-empty">Cargando...</td></tr>
                )}
                {!isLoading && tipos.length === 0 && (
                  <tr><td colSpan={3}>
                    <div className="tdd-empty">
                      <div className="tdd-empty-icon"><FileText size={18} /></div>
                      Sin tipos de documento registrados
                    </div>
                  </td></tr>
                )}
                {tipos.map((t) => (
                  <tr
                    key={t.id}
                    className={seleccionado?.id === t.id ? 'activo' : ''}
                    onClick={() => { setSeleccionado(t); setModo('ver') }}
                  >
                    <td>
                      {t.descripcion}
                      {seleccionado?.id !== t.id && (
                        <div className="tdd-hint">Hacé clic para ver el detalle</div>
                      )}
                    </td>
                    <td><span className="tdd-key">{t.storage_key}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="tdd-action-btn edit"
                          onClick={(e) => { e.stopPropagation(); setSeleccionado(t); setModo('editar') }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="tdd-action-btn trash"
                          onClick={(e) => { e.stopPropagation(); handleEliminar(t.id) }}
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
              icono={<FileText size={22} color="#1a3a5c" />}
              campos={CAMPOS_TIPO_DOC}
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
