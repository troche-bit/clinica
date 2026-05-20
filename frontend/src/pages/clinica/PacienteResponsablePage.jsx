import { useState, useRef } from 'react'
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Users, FileText } from 'lucide-react'
import Modal           from '../../components/ui/Modal'
import ConfirmDialog   from '../../components/ui/ConfirmDialog'
import ResponsableForm from '../../components/responsable/ResponsableForm'
import { useResponsables, useResponsableMutations } from '../../hooks/clinica/useResponsable'
import { useToast }    from '../../hooks/useToast'
import Toast           from '../../components/ui/Toast'
import apiClient       from '../../api/client'
import { useAtajosTeclado } from '../../hooks/useAtajosTeclado'
import { useNavigationGuard } from '../../hooks/useNavigationGuard'
import { useAuth } from '../../context/AuthContext'

function Seccion({ titulo, children }) {
  return (
    <div className="pr-det-card">
      <div className="pr-det-card-titulo">{titulo}</div>
      {children}
    </div>
  )
}

function Campo({ label, valor }) {
  return (
    <div className="pr-det-campo">
      <div className="pr-det-label">{label}</div>
      <div className="pr-det-valor">{valor || '—'}</div>
    </div>
  )
}

function ResponsableDetalle({ responsable, onEditar }) {
  const p = responsable.persona_detalle || {}
  const initials = (responsable.nombre || p.razon_social || 'R')
    .split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="pr-det-root">
      <div className="pr-det-cabecera">
        <div className="pr-det-avatar">{initials}</div>
        <div className="pr-det-cabecera-info">
          <div className="pr-det-nombre">{responsable.nombre || p.razon_social || '—'}</div>
          <div className="pr-det-documento">
            {p.tipo_documento_detalle?.descripcion} · {responsable.documento || p.nro_documento || '—'}
          </div>
        </div>
        <button className="pr-det-btn-editar" onClick={onEditar}>
          <Pencil size={14} /> Editar
        </button>
      </div>

      <Seccion titulo="Datos personales">
        <div className="pr-det-grid">
          <Campo label="Teléfono"     valor={p.telefono} />
          <Campo label="Correo"       valor={p.correo_electronico} />
          <Campo label="País"         valor={p.pais_detalle?.descripcion} />
          <Campo label="Departamento" valor={p.departamento_detalle?.descripcion} />
          <Campo label="Ciudad"       valor={p.ciudad_detalle?.descripcion} />
          <Campo label="Dirección"    valor={p.direccion} />
        </div>
      </Seccion>

      <Seccion titulo="Datos del responsable">
        <div className="pr-det-grid">
          <div className="pr-det-campo">
            <div className="pr-det-label">Grupo sanguíneo</div>
            {responsable.grupo_sanguineo
              ? <span className="pr-badge-grupo" style={{ marginTop: 4 }}>{responsable.grupo_sanguineo}</span>
              : <div className="pr-det-valor">—</div>
            }
          </div>
          <Campo label="Ocupación"           valor={responsable.ocupacion} />
          <Campo label="Contacto emergencia" valor={responsable.es_contacto_emergencia ? 'Sí' : 'No'} />
        </div>
        {responsable.observacion && (
          <div style={{ marginTop: 10 }}>
            <Campo label="Observación" valor={responsable.observacion} />
          </div>
        )}
      </Seccion>
    </div>
  )
}

export default function PacienteResponsablePage() {
  const [modo,             setModo]             = useState(null)
  const [responsableSel,   setResponsableSel]   = useState(null)
  const [page,             setPage]             = useState(1)
  const [search,           setSearch]           = useState('')
  const [confirmId,      setConfirmId]      = useState(null)
  const [loadingListado, setLoadingListado] = useState(false)
  const debounceRef = useRef(null)

  const { user }        = useAuth()
  const puedeEliminar   = user?.rol === 'admin'
  const { guardAction } = useNavigationGuard()

  const { toast, showToast }         = useToast()
  const { data, isLoading, isError } = useResponsables({ page, search })
  const { eliminar }                 = useResponsableMutations(showToast)

  const totalPages = data ? Math.ceil(data.count / 20) : 0

  const cerrarModal = () => { setResponsableSel(null); setModo(null) }

  useAtajosTeclado({
    'Insert': { fn: () => { if (modo === null) guardAction(() => { setResponsableSel(null); setModo('crear') }) } },
  })

  const handleSearchChange = (e) => {
    const val = e.target.value
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setSearch(val); setPage(1) }, 300)
  }

  const handleVerDetalle = (responsable) => guardAction(() => { setResponsableSel(responsable); setModo('ver') })
  const handleEditar     = (responsable) => guardAction(() => { setResponsableSel(responsable); setModo('editar') })
  const handleClose      = () => guardAction(() => cerrarModal())
  const handleCancelar   = () => guardAction(() => cerrarModal())
  const handleSuccess    = () => { cerrarModal(); showToast('Responsable guardado correctamente.', 'success') }

  const confirmarEliminar = () => eliminar.mutate(confirmId, {
    onSuccess: () => { setConfirmId(null); cerrarModal() },
    onError:   () => setConfirmId(null),
  })

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

  return (
    <>
      <Toast toast={toast} />

      <ConfirmDialog
        isOpen={confirmId !== null}
        title="Eliminar responsable"
        description="¿Confirmás la eliminación? Si tiene pacientes vinculados activos no se podrá eliminar."
        onConfirm={confirmarEliminar}
        onCancel={() => setConfirmId(null)}
        loading={eliminar.isPending}
      />

      <style>{`
        .pr-root { font-family: 'DM Sans', sans-serif; }

        @media (max-width: 767px) {
          .modal-backdrop { padding: 0 !important; align-items: flex-end !important; }
          .modal-box { border-radius: 16px 16px 0 0 !important; max-height: 95dvh !important; max-width: 100% !important; }
        }
        @media (max-width: 479px) {
          .modal-backdrop { align-items: stretch !important; }
          .modal-box { border-radius: 0 !important; max-height: 100dvh !important; height: 100dvh !important; }
        }

        .pr-toolbar {
          display: flex; align-items: flex-start; gap: 12px;
          margin-bottom: 16px; flex-wrap: wrap;
        }
        .pr-titles   { flex: 1; min-width: 0; order: 1; }
        .pr-title    { font-size: 22px; font-weight: 600; color: #1a3a5c; margin-bottom: 2px; }
        .pr-subtitle { font-size: 13px; color: #6b7280; }

        .pr-search-wrap { position: relative; flex: 1 1 200px; max-width: 360px; order: 2; }
        .pr-search-icon {
          position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
          color: #9ca3af; pointer-events: none;
        }
        .pr-search-input {
          width: 100%; padding: 9px 12px 9px 34px; border: 1.5px solid #e5e7eb;
          border-radius: 9px; font-size: 13.5px; font-family: 'DM Sans', sans-serif;
          color: #111827; background: #fff; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .pr-search-input:focus { border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08); }
        .pr-search-input::placeholder { color: #d1d5db; }

        .pr-toolbar-actions { display: flex; align-items: flex-start; gap: 8px; order: 3; flex-shrink: 0; }

        .pr-btn-pdf {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 14px; background: #dc2626; border: none; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #fff;
          cursor: pointer; white-space: nowrap; font-weight: 500;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .pr-btn-pdf:hover:not(:disabled) { background: #b91c1c; box-shadow: 0 4px 12px rgba(220,38,38,0.2); }
        .pr-btn-pdf:disabled { opacity: 0.6; cursor: not-allowed; }

        .pr-btn-nuevo-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .pr-btn-nuevo {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 16px; background: #1a3a5c; color: #fff;
          border: none; border-radius: 9px; font-size: 13.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; white-space: nowrap;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .pr-btn-nuevo:hover { background: #15304d; box-shadow: 0 4px 12px rgba(26,58,92,0.2); }
        .pr-btn-nuevo-hint { font-size: 10.5px; color: #9ca3af; white-space: nowrap; }

        @media (max-width: 600px) {
          .pr-search-wrap { order: 4; flex-basis: 100%; max-width: 100%; }
          .pr-titles { display: none; }
        }
        @media (max-width: 480px) {
          .pr-title    { font-size: 18px; }
          .pr-subtitle { display: none; }
          .pr-toolbar-actions { gap: 4px; }
          .pr-btn-pdf   { padding: 8px 10px; font-size: 12px; }
          .pr-btn-nuevo { padding: 8px 12px; font-size: 12.5px; }
          .pr-btn-nuevo-hint { display: none; }
        }

        .pr-table-card {
          background: #fff; border: 1px solid #e8edf2;
          border-radius: 12px; overflow: hidden;
        }
        .pr-table-wrap { overflow-x: auto; }
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
        .pr-table tbody tr { cursor: pointer; transition: background 0.15s; }
        .pr-table tbody tr:nth-child(odd)  { background: #ffffff; }
        .pr-table tbody tr:nth-child(even) { background: #f8fafc; }
        .pr-table tbody tr:hover           { background: #f0f4f8 !important; }

        .pr-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: #dbeafe; display: flex; align-items: center;
          justify-content: center; font-size: 11px; font-weight: 600;
          color: #1a3a5c; flex-shrink: 0;
        }
        .pr-nombre-cell { display: flex; align-items: center; gap: 10px; }
        .pr-nombre { font-weight: 500; color: #111827; }
        .pr-doc    { font-size: 12px; color: #9ca3af; margin-top: 1px; }
        .pr-hint   { font-size: 11.5px; color: #9ca3af; margin-top: 3px; font-style: italic; }

        .pr-actions { display: flex; align-items: center; gap: 6px; }
        .pr-action-btn {
          width: 30px; height: 30px; border-radius: 7px;
          border: 1px solid #e8edf2; background: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #6b7280; transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .pr-action-btn.edit:hover  { background: #eff6ff; color: #1a3a5c; border-color: #bfdbfe; }
        .pr-action-btn.trash:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }

        @media (max-width: 640px) {
          .pr-table th, .pr-table td { padding: 10px 10px; }
          .pr-nombre { font-size: 13px; }
          .pr-doc    { font-size: 11.5px; }
          .pr-hint   { display: none; }
        }

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

        .pr-det-root { font-family: 'DM Sans', sans-serif; }

        .pr-det-cabecera {
          display: flex; align-items: center; gap: 14px;
          margin: -24px -24px 16px;
          padding: 20px 24px 16px;
          border-bottom: 1px solid #e8edf2;
          flex-wrap: wrap;
          position: sticky; top: -24px; z-index: 5; background: #fff;
        }
        .pr-det-avatar {
          width: 56px; height: 56px; border-radius: 50%;
          background: #dbeafe; display: flex; align-items: center;
          justify-content: center; font-size: 18px; font-weight: 600;
          color: #1a3a5c; flex-shrink: 0;
        }
        .pr-det-cabecera-info { flex: 1; min-width: 0; }
        .pr-det-nombre    { font-size: 17px; font-weight: 600; color: #111827; }
        .pr-det-documento { font-size: 13px; color: #6b7280; margin-top: 3px; }

        .pr-det-btn-editar {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 8px 16px; background: #1a3a5c; color: #fff; border: none;
          border-radius: 9px; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s; flex-shrink: 0;
        }
        .pr-det-btn-editar:hover { background: #15304d; box-shadow: 0 4px 12px rgba(26,58,92,0.2); }

        .pr-det-card {
          border: 1px solid #e8edf2; border-radius: 10px;
          padding: 14px 16px; margin-bottom: 12px; background: #fafbfc;
        }
        .pr-det-card-titulo {
          font-size: 10.5px; font-weight: 600; letter-spacing: .07em;
          text-transform: uppercase; color: #9ca3af; margin-bottom: 12px;
        }
        .pr-det-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 16px;
        }
        .pr-det-label {
          font-size: 10.5px; font-weight: 500; color: #9ca3af;
          text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2px;
        }
        .pr-det-valor { font-size: 13.5px; color: #111827; line-height: 1.4; }

        .pr-badge-grupo {
          display: inline-flex; align-items: center;
          background: #fee2e2; color: #dc2626;
          font-size: 11px; font-weight: 700;
          padding: 2px 9px; border-radius: 20px;
        }

        @media (max-width: 640px) {
          .pr-det-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .pr-det-nombre { font-size: 15px; }
          .pr-det-btn-editar { padding: 6px 12px; font-size: 12px; }
          .pr-det-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="pr-root">
        <div className="pr-toolbar">
          <div className="pr-titles">
            <div className="pr-title">Responsables</div>
            <div className="pr-subtitle">
              {data?.count !== undefined ? `${data.count} responsables registrados` : 'Gestión de responsables de pacientes'}
            </div>
          </div>

          <div className="pr-search-wrap">
            <Search size={15} className="pr-search-icon" />
            <input
              type="text"
              placeholder="Buscar por nombre o documento..."
              onChange={handleSearchChange}
              className="pr-search-input"
            />
          </div>

          <div className="pr-toolbar-actions">
            <button
              className="pr-btn-pdf"
              onClick={handleVerListado}
              disabled={loadingListado}
              title="Exportar a PDF"
            >
              <FileText size={14} />
              {loadingListado ? 'Generando...' : 'PDF'}
            </button>
            <div className="pr-btn-nuevo-wrap">
              <button
                className="pr-btn-nuevo"
                onClick={() => guardAction(() => { setResponsableSel(null); setModo('crear') })}
              >
                <Plus size={15} /> Nuevo responsable
              </button>
              <span className="pr-btn-nuevo-hint">Presioná Ins para nuevo responsable</span>
            </div>
          </div>
        </div>

        <div className="pr-table-card">
          <div className="pr-table-wrap">
            <table className="pr-table">
              <thead>
                <tr>
                  <th>Responsable</th>
                  <th>Teléfono</th>
                  <th>Ocupación</th>
                  <th style={{ width: puedeEliminar ? '80px' : '52px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={4}>
                    <div className="pr-empty">
                      <div className="pr-empty-icon"><Users size={18} /></div>
                      Cargando responsables...
                    </div>
                  </td></tr>
                )}
                {isError && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: '#dc2626', fontSize: '13.5px' }}>
                    Error al cargar los responsables. Intentá de nuevo.
                  </td></tr>
                )}
                {!isLoading && !isError && data?.results?.length === 0 && (
                  <tr><td colSpan={4}>
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
                            <div className="pr-hint">Clic para ver detalle</div>
                          </div>
                        </div>
                      </td>
                      <td>{responsable.persona_detalle?.telefono || '—'}</td>
                      <td>{responsable.ocupacion || '—'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="pr-actions">
                          <button
                            className="pr-action-btn edit"
                            onClick={() => handleEditar(responsable)}
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          {puedeEliminar && (
                            <button
                              className="pr-action-btn trash"
                              onClick={() => setConfirmId(responsable.id)}
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

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
      </div>

      <Modal
        isOpen={modo !== null}
        onClose={handleClose}
        title={
          modo === 'crear'  ? 'Nuevo responsable' :
          modo === 'editar' ? 'Editar responsable' :
          'Detalle del responsable'
        }
        subtitle={
          modo === 'crear'
            ? 'Buscá por documento para comenzar'
            : (responsableSel?.nombre || responsableSel?.persona_detalle?.razon_social || '')
        }
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
            onCancel={handleCancelar}
          />
        )}
      </Modal>
    </>
  )
}
