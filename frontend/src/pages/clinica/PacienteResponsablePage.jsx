import { useState } from 'react'
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Users, FileText } from 'lucide-react'
import Modal           from '../../components/ui/Modal'
import ConfirmDialog   from '../../components/ui/ConfirmDialog'
import ResponsableForm from '../../components/responsable/ResponsableForm'
import { useResponsables, useResponsableMutations } from '../../hooks/clinica/useResponsable'
import { useToast }    from '../../hooks/useToast'
import Toast           from '../../components/ui/Toast'
import apiClient       from '../../api/client'

function Seccion({ titulo, children }) {
  return (
    <div className="pr-seccion">
      <div className="pr-seccion-titulo">{titulo}</div>
      {children}
    </div>
  )
}

function Campo({ label, valor }) {
  return (
    <div className="pr-campo">
      <div className="pr-campo-label">{label}</div>
      <div className="pr-campo-valor">{valor || '—'}</div>
    </div>
  )
}

function ResponsableDetalle({ responsable, onEditar }) {
  const p = responsable.persona_detalle || {}
  return (
    <div className="pr-detalle">
      <div className="pr-detalle-header">
        <div className="pr-detalle-avatar">
          {(responsable.nombre || p.razon_social || 'R').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
        </div>
        <div>
          <div className="pr-detalle-nombre">{responsable.nombre || p.razon_social || '—'}</div>
          <div className="pr-detalle-doc">{responsable.documento || p.nro_documento || '—'}</div>
        </div>
        <button className="pr-btn-editar-detalle" onClick={onEditar}>
          <Pencil size={13} /> Editar
        </button>
      </div>

      <Seccion titulo="Datos personales">
        <div className="pr-campos-grid">
          <Campo label="Documento"    valor={responsable.documento || p.nro_documento} />
          <Campo label="Teléfono"     valor={p.telefono} />
          <Campo label="Correo"       valor={p.correo_electronico} />
          <Campo label="Dirección"    valor={p.direccion} />
          <Campo label="País"         valor={p.pais_detalle?.nombre} />
          <Campo label="Departamento" valor={p.departamento_detalle?.nombre} />
          <Campo label="Ciudad"       valor={p.ciudad_detalle?.nombre} />
        </div>
      </Seccion>

      <Seccion titulo="Datos del responsable">
        <div className="pr-campos-grid">
          <Campo label="Grupo sanguíneo"     valor={responsable.grupo_sanguineo} />
          <Campo label="Ocupación"           valor={responsable.ocupacion} />
          <Campo label="Contacto emergencia" valor={responsable.es_contacto_emergencia ? 'Sí' : 'No'} />
          <Campo label="Observación"         valor={responsable.observacion} />
        </div>
      </Seccion>
    </div>
  )
}

export default function PacienteResponsablePage() {
  const [modo,            setModo]            = useState(null)
  const [responsableSel,  setResponsableSel]  = useState(null)
  const [page,            setPage]            = useState(1)
  const [search,          setSearch]          = useState('')
  const [searchInput,     setSearchInput]     = useState('')
  const [confirmId,       setConfirmId]       = useState(null)
  const [loadingListado,  setLoadingListado]  = useState(false)

  const { toast, showToast }         = useToast()
  const { data, isLoading, isError } = useResponsables({ page, search })
  const { eliminar }                 = useResponsableMutations(showToast)

  const totalPages = data ? Math.ceil(data.count / 20) : 0

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const handleVerDetalle = (responsable) => {
    setResponsableSel(responsable)
    setModo('ver')
  }

  const handleEditar = (e, responsable) => {
    e.stopPropagation()
    setResponsableSel(responsable)
    setModo('editar')
  }

  const handleNuevo = () => {
    setResponsableSel(null)
    setModo('crear')
  }

  const handleClose = () => {
    setModo(null)
    setResponsableSel(null)
  }

  const handleSuccess = () => {
    handleClose()
    showToast('Responsable guardado correctamente.', 'success')
  }

  const handleConfirmEliminar = (e, id) => {
    e.stopPropagation()
    setConfirmId(id)
  }

  const handleEliminar = () => {
    eliminar.mutate(confirmId, {
      onSuccess: () => {
        setConfirmId(null)
        if (modo !== null) handleClose()
      },
      onError: () => setConfirmId(null),
    })
  }

  const handleVerListado = async () => {
    setLoadingListado(true)
    try {
      const res = await apiClient.get('/pacienteresponsable/reporte-lista/', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch {
      showToast('No se pudo generar el listado.', 'error')
    } finally {
      setLoadingListado(false)
    }
  }

  const tituloModal = modo === 'crear'
    ? 'Nuevo responsable'
    : modo === 'editar'
      ? 'Editar responsable'
      : 'Detalle del responsable'

  const subtituloModal = modo === 'crear'
    ? 'Buscá por documento para comenzar'
    : (responsableSel?.nombre || responsableSel?.persona_detalle?.razon_social || '')

  return (
    <>
      <Toast toast={toast} />

      <ConfirmDialog
        isOpen={confirmId !== null}
        title="Eliminar responsable"
        description="¿Confirmás la eliminación? Si tiene pacientes vinculados activos no se podrá eliminar."
        onConfirm={handleEliminar}
        onCancel={() => setConfirmId(null)}
        loading={eliminar.isPending}
      />

      <style>{`
        .pr-header {
          display: flex; align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 24px; gap: 12px; flex-wrap: wrap;
        }
        .pr-title    { font-size: 22px; font-weight: 600; color: #1a3a5c; margin-bottom: 2px; }
        .pr-subtitle { font-size: 13px; color: #6b7280; }
        .pr-btn-nuevo {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; background: #1a3a5c; color: #fff;
          border: none; border-radius: 9px; font-size: 13.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; white-space: nowrap;
          transition: background 0.15s, box-shadow 0.15s; flex-shrink: 0;
        }
        .pr-btn-nuevo:hover { background: #15304d; box-shadow: 0 4px 12px rgba(26,58,92,0.2); }
        .pr-search-row { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
        .pr-search-wrap { position: relative; flex: 1; max-width: 380px; }
        .pr-search-icon {
          position: absolute; left: 11px; top: 50%;
          transform: translateY(-50%); color: #9ca3af; pointer-events: none;
        }
        .pr-search-input {
          width: 100%; padding: 9px 12px 9px 34px;
          border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif;
          color: #111827; background: #fff; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .pr-search-input:focus { border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08); }
        .pr-search-input::placeholder { color: #d1d5db; }
        .pr-btn-search {
          padding: 9px 16px; background: #f8fafc;
          border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif;
          color: #374151; cursor: pointer; transition: background 0.15s;
        }
        .pr-btn-search:hover { background: #f0f4f8; }
        .pr-btn-listado {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 16px; margin-left: auto;
          background: #f8fafc; border: 1.5px solid #e5e7eb;
          border-radius: 9px; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; color: #374151;
          cursor: pointer; transition: background 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .pr-btn-listado:hover:not(:disabled) { background: #eff6ff; border-color: #bfdbfe; color: #1a3a5c; }
        .pr-btn-listado:disabled { opacity: 0.55; cursor: not-allowed; }
        .pr-table-card {
          background: #fff; border: 1px solid #e8edf2;
          border-radius: 12px; overflow: hidden;
        }
        .pr-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .pr-table thead { background: #f8fafc; border-bottom: 1px solid #e8edf2; }
        .pr-table th {
          text-align: left; padding: 11px 16px;
          font-size: 11px; font-weight: 600;
          letter-spacing: .05em; text-transform: uppercase;
          color: #9ca3af; white-space: nowrap;
        }
        .pr-table td {
          padding: 12px 16px; border-bottom: 1px solid #f3f4f6;
          color: #374151; vertical-align: middle;
        }
        .pr-table tbody tr:last-child td { border-bottom: none; }
        .pr-table tbody tr { cursor: pointer; transition: background 0.12s; }
        .pr-table tbody tr:hover { background: #f8fafc; }
        .pr-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: #dbeafe; display: flex; align-items: center;
          justify-content: center; font-size: 11px; font-weight: 600;
          color: #1a3a5c; flex-shrink: 0;
        }
        .pr-nombre-cell { display: flex; align-items: center; gap: 10px; }
        .pr-nombre { font-weight: 500; color: #111827; }
        .pr-doc   { font-size: 12px; color: #9ca3af; margin-top: 1px; }
        .pr-hint  { font-size: 11px; color: #c4cad4; margin-top: 2px; }
        .pr-actions { display: flex; align-items: center; gap: 6px; }
        .pr-action-btn {
          width: 30px; height: 30px; border-radius: 7px;
          border: 1px solid #e8edf2; background: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #6b7280; transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .pr-action-btn.edit:hover  { background: #eff6ff; color: #1a3a5c; border-color: #bfdbfe; }
        .pr-action-btn.trash:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
        .pr-empty {
          text-align: center; padding: 48px 16px;
          color: #9ca3af; font-size: 13.5px;
        }
        .pr-empty-icon {
          width: 40px; height: 40px; margin: 0 auto 12px;
          background: #f3f4f6; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; color: #d1d5db;
        }
        .pr-empty-title { font-weight: 500; color: #6b7280; margin-bottom: 4px; }
        .pr-pagination {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; border-top: 1px solid #e8edf2;
          font-size: 13px; color: #6b7280; flex-wrap: wrap; gap: 8px;
        }
        .pr-pag-btns { display: flex; align-items: center; gap: 6px; }
        .pr-pag-btn {
          width: 30px; height: 30px; border-radius: 7px;
          border: 1px solid #e8edf2; background: #fff; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #374151; transition: background 0.15s;
        }
        .pr-pag-btn:hover:not(:disabled) { background: #f0f4f8; }
        .pr-pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .pr-detalle { padding: 4px 0; }
        .pr-detalle-header {
          display: flex; align-items: center; gap: 14px;
          margin-bottom: 20px; padding-bottom: 16px;
          border-bottom: 1px solid #f3f4f6;
        }
        .pr-detalle-avatar {
          width: 48px; height: 48px; border-radius: 50%;
          background: #dbeafe; display: flex; align-items: center;
          justify-content: center; font-size: 16px; font-weight: 700;
          color: #1a3a5c; flex-shrink: 0;
        }
        .pr-detalle-nombre { font-size: 16px; font-weight: 600; color: #111827; }
        .pr-detalle-doc    { font-size: 12.5px; color: #6b7280; margin-top: 2px; }
        .pr-btn-editar-detalle {
          margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; background: #f8fafc;
          border: 1.5px solid #e5e7eb; border-radius: 8px;
          font-size: 13px; font-family: 'DM Sans', sans-serif;
          color: #374151; cursor: pointer; transition: background 0.15s;
        }
        .pr-btn-editar-detalle:hover { background: #eff6ff; border-color: #bfdbfe; color: #1a3a5c; }
        .pr-seccion {
          background: #fafbfc; border: 1px solid #e8edf2;
          border-radius: 10px; padding: 16px 18px; margin-bottom: 12px;
        }
        .pr-seccion-titulo {
          font-size: 10.5px; font-weight: 600; letter-spacing: .06em;
          text-transform: uppercase; color: #9ca3af; margin-bottom: 12px;
        }
        .pr-campos-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 20px;
        }
        .pr-campo-label {
          font-size: 10.5px; font-weight: 600; letter-spacing: .04em;
          text-transform: uppercase; color: #9ca3af; margin-bottom: 3px;
        }
        .pr-campo-valor { font-size: 13.5px; color: #111827; }
      `}</style>

      <div className="pr-header">
        <div>
          <div className="pr-title">Responsables</div>
          <div className="pr-subtitle">
            {data?.count !== undefined ? `${data.count} responsables registrados` : 'Gestión de responsables de pacientes'}
          </div>
        </div>
        <button className="pr-btn-nuevo" onClick={handleNuevo}>
          <Plus size={15} /> Nuevo responsable
        </button>
      </div>

      <form onSubmit={handleSearch} className="pr-search-row">
        <div className="pr-search-wrap">
          <Search size={15} className="pr-search-icon" />
          <input
            type="text"
            placeholder="Buscar por nombre o documento..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pr-search-input"
          />
        </div>
        <button type="submit" className="pr-btn-search">Buscar</button>
        <button
          type="button"
          className="pr-btn-listado"
          onClick={handleVerListado}
          disabled={loadingListado}
        >
          <FileText size={14} />
          {loadingListado ? 'Generando...' : 'Ver listado'}
        </button>
      </form>

      <div className="pr-table-card">
        <table className="pr-table">
          <thead>
            <tr>
              <th>Responsable</th>
              <th>Teléfono</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={3}>
                <div className="pr-empty">
                  <div className="pr-empty-icon"><Users size={18} /></div>
                  Cargando responsables...
                </div>
              </td></tr>
            )}
            {isError && (
              <tr><td colSpan={3} style={{ textAlign: 'center', padding: '32px', color: '#dc2626', fontSize: '13.5px' }}>
                Error al cargar los responsables. Intentá de nuevo.
              </td></tr>
            )}
            {!isLoading && !isError && data?.results?.length === 0 && (
              <tr><td colSpan={3}>
                <div className="pr-empty">
                  <div className="pr-empty-icon"><Users size={18} /></div>
                  <div className="pr-empty-title">No se encontraron responsables</div>
                  {search && <div>Probá con otro término de búsqueda</div>}
                </div>
              </td></tr>
            )}
            {data?.results?.map((responsable) => {
              const nombre   = responsable.nombre || responsable.persona_detalle?.razon_social || '—'
              const initials = nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
              return (
                <tr key={responsable.id} onClick={() => handleVerDetalle(responsable)}>
                  <td>
                    <div className="pr-nombre-cell">
                      <div className="pr-avatar">{initials}</div>
                      <div>
                        <div className="pr-nombre">{nombre}</div>
                        <div className="pr-doc">{responsable.documento || responsable.persona_detalle?.nro_documento || '—'}</div>
                        <div className="pr-hint">Click para ver detalle</div>
                      </div>
                    </div>
                  </td>
                  <td>{responsable.persona_detalle?.telefono || '—'}</td>
                  <td>
                    <div className="pr-actions">
                      <button
                        className="pr-action-btn edit"
                        onClick={(e) => handleEditar(e, responsable)}
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="pr-action-btn trash"
                        onClick={(e) => handleConfirmEliminar(e, responsable.id)}
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="pr-pagination">
            <span>Página {page} de {totalPages} — {data?.count} responsables</span>
            <div className="pr-pag-btns">
              <button className="pr-pag-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={15} />
              </button>
              <button className="pr-pag-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={modo !== null}
        onClose={handleClose}
        title={tituloModal}
        subtitle={subtituloModal}
        size="lg"
      >
        {modo === 'ver' && responsableSel && (
          <ResponsableDetalle
            responsable={responsableSel}
            onEditar={() => setModo('editar')}
          />
        )}
        {(modo === 'crear' || modo === 'editar') && (
          <ResponsableForm
            responsableInicial={modo === 'editar' ? responsableSel : null}
            onSuccess={handleSuccess}
          />
        )}
      </Modal>
    </>
  )
}
