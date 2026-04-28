import { useState } from 'react'
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Users, FileText } from 'lucide-react'
import Modal           from '../../components/ui/Modal'
import ConfirmDialog   from '../../components/ui/ConfirmDialog'
import PersonaRRHHForm from '../../components/rrhh/PersonaRRHHForm'
import { usePersonasRRHH, usePersonaRRHHMutations } from '../../hooks/administracion/usePersonaRRHH'
import { useToast }    from '../../hooks/useToast'
import Toast           from '../../components/ui/Toast'
import apiClient       from '../../api/client'

const ESTADO_BADGE = {
  activo:   { bg: '#dcfce7', color: '#166534' },
  inactivo: { bg: '#f3f4f6', color: '#6b7280' },
  licencia: { bg: '#fef9c3', color: '#854d0e' },
}

const CARGO_LABEL = {
  medico:         'Médico',
  enfermero:      'Enfermero/a',
  administrativo: 'Administrativo',
  tecnico:        'Técnico',
  otro:           'Otro',
}

function Seccion({ titulo, children }) {
  return (
    <div className="rrhh-seccion">
      <div className="rrhh-seccion-titulo">{titulo}</div>
      {children}
    </div>
  )
}

function Campo({ label, valor }) {
  return (
    <div className="rrhh-campo">
      <div className="rrhh-campo-label">{label}</div>
      <div className="rrhh-campo-valor">{valor || '—'}</div>
    </div>
  )
}

function PrestadorDetalle({ prestador, onEditar }) {
  const p     = prestador.persona_detalle || {}
  const estado = prestador.estado ?? 'activo'
  const badge  = ESTADO_BADGE[estado] ?? ESTADO_BADGE.activo
  return (
    <div className="rrhh-detalle">
      <div className="rrhh-detalle-header">
        <div className="rrhh-detalle-avatar">
          {(prestador.nombre || p.razon_social || 'P').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
        </div>
        <div>
          <div className="rrhh-detalle-nombre">{prestador.nombre || p.razon_social || '—'}</div>
          <div className="rrhh-detalle-doc">{prestador.documento || p.nro_documento || '—'}</div>
          <span className="rrhh-badge" style={{ background: badge.bg, color: badge.color, marginTop: 4, display: 'inline-flex' }}>
            {estado.charAt(0).toUpperCase() + estado.slice(1)}
          </span>
        </div>
        <button className="rrhh-btn-editar-detalle" onClick={onEditar}>
          <Pencil size={13} /> Editar
        </button>
      </div>

      <Seccion titulo="Datos personales">
        <div className="rrhh-campos-grid">
          <Campo label="Documento"    valor={prestador.documento || p.nro_documento} />
          <Campo label="Teléfono"     valor={p.telefono} />
          <Campo label="Correo"       valor={p.correo_electronico} />
          <Campo label="Dirección"    valor={p.direccion} />
          <Campo label="País"         valor={p.pais_detalle?.nombre} />
          <Campo label="Departamento" valor={p.departamento_detalle?.nombre} />
          <Campo label="Ciudad"       valor={p.ciudad_detalle?.nombre} />
        </div>
      </Seccion>

      <Seccion titulo="Datos del prestador">
        <div className="rrhh-campos-grid">
          <Campo label="Cargo"            valor={CARGO_LABEL[prestador.cargo] ?? prestador.cargo} />
          <Campo label="Tipo de contrato" valor={prestador.tipo_contrato} />
          <Campo label="Nro. matrícula"   valor={prestador.nro_matricula} />
          <Campo label="Honorario ref."   valor={prestador.honorario ? `Gs. ${Number(prestador.honorario).toLocaleString()}` : null} />
          <Campo label="Fecha nacimiento" valor={prestador.fecha_nacimiento} />
          <Campo label="Fecha ingreso"    valor={prestador.fecha_ingreso} />
        </div>
      </Seccion>

      {prestador.especialidades_detalle?.length > 0 && (
        <Seccion titulo="Especialidades">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {prestador.especialidades_detalle.map(e => (
              <span key={e.id} className="rrhh-esp-chip">{e.descripcion}</span>
            ))}
          </div>
        </Seccion>
      )}

      {prestador.observacion && (
        <Seccion titulo="Observaciones">
          <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.5 }}>{prestador.observacion}</div>
        </Seccion>
      )}
    </div>
  )
}

export default function PersonaRRHHPage() {
  const [modo,           setModo]           = useState(null)
  const [prestadorSel,   setPrestadorSel]   = useState(null)
  const [page,           setPage]           = useState(1)
  const [search,         setSearch]         = useState('')
  const [searchInput,    setSearchInput]    = useState('')
  const [confirmId,      setConfirmId]      = useState(null)
  const [loadingListado, setLoadingListado] = useState(false)

  const { toast, showToast }         = useToast()
  const { data, isLoading, isError } = usePersonasRRHH({ page, search })
  const { eliminar }                 = usePersonaRRHHMutations(showToast)

  const totalPages = data ? Math.ceil(data.count / 20) : 0

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const handleVerDetalle = (prestador) => {
    setPrestadorSel(prestador)
    setModo('ver')
  }

  const handleEditar = (e, prestador) => {
    e.stopPropagation()
    setPrestadorSel(prestador)
    setModo('editar')
  }

  const handleNuevo = () => {
    setPrestadorSel(null)
    setModo('crear')
  }

  const handleClose = () => {
    setModo(null)
    setPrestadorSel(null)
  }

  const handleSuccess = () => {
    handleClose()
    showToast('Prestador guardado correctamente.', 'success')
  }

  const handleConfirmEliminar = (e, id) => {
    e.stopPropagation()
    setConfirmId(id)
  }

  const handleVerListado = async () => {
    setLoadingListado(true)
    try {
      const res = await apiClient.get('/personarrhh/reporte-lista/', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch {
      showToast('No se pudo generar el listado.', 'error')
    } finally {
      setLoadingListado(false)
    }
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

  const tituloModal = modo === 'crear'
    ? 'Nuevo prestador'
    : modo === 'editar'
      ? 'Editar prestador'
      : 'Detalle del prestador'

  const subtituloModal = modo === 'crear'
    ? 'Buscá por documento para comenzar'
    : (prestadorSel?.nombre || prestadorSel?.persona_detalle?.razon_social || '')

  return (
    <>
      <Toast toast={toast} />

      <ConfirmDialog
        isOpen={confirmId !== null}
        title="Eliminar prestador"
        description="¿Confirmás la eliminación? Si tiene turnos activos (disponible, ocupado o realizado) no se podrá eliminar."
        onConfirm={handleEliminar}
        onCancel={() => setConfirmId(null)}
        loading={eliminar.isPending}
      />

      <style>{`
        .rrhh-header {
          display: flex; align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 24px; gap: 12px; flex-wrap: wrap;
        }
        .rrhh-title    { font-size: 22px; font-weight: 600; color: #1a3a5c; margin-bottom: 2px; }
        .rrhh-subtitle { font-size: 13px; color: #6b7280; }
        .rrhh-btn-nuevo {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; background: #1a3a5c; color: #fff;
          border: none; border-radius: 9px; font-size: 13.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; white-space: nowrap;
          transition: background 0.15s, box-shadow 0.15s; flex-shrink: 0;
        }
        .rrhh-btn-nuevo:hover { background: #15304d; box-shadow: 0 4px 12px rgba(26,58,92,0.2); }
        .rrhh-search-row { display: flex; gap: 8px; margin-bottom: 16px; }
        .rrhh-search-wrap { position: relative; flex: 1; max-width: 380px; }
        .rrhh-search-icon {
          position: absolute; left: 11px; top: 50%;
          transform: translateY(-50%); color: #9ca3af; pointer-events: none;
        }
        .rrhh-search-input {
          width: 100%; padding: 9px 12px 9px 34px;
          border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif;
          color: #111827; background: #fff; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .rrhh-search-input:focus { border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08); }
        .rrhh-search-input::placeholder { color: #d1d5db; }
        .rrhh-btn-search {
          padding: 9px 16px; background: #f8fafc;
          border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif;
          color: #374151; cursor: pointer; transition: background 0.15s;
        }
        .rrhh-btn-search:hover { background: #f0f4f8; }
        .rrhh-btn-listado {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 16px; margin-left: auto;
          background: #f8fafc; border: 1.5px solid #e5e7eb;
          border-radius: 9px; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; color: #374151;
          cursor: pointer; transition: background 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .rrhh-btn-listado:hover:not(:disabled) { background: #eff6ff; border-color: #bfdbfe; color: #1a3a5c; }
        .rrhh-btn-listado:disabled { opacity: 0.55; cursor: not-allowed; }
        .rrhh-table-card {
          background: #fff; border: 1px solid #e8edf2;
          border-radius: 12px; overflow: hidden;
        }
        .rrhh-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .rrhh-table thead { background: #f8fafc; border-bottom: 1px solid #e8edf2; }
        .rrhh-table th {
          text-align: left; padding: 11px 16px;
          font-size: 11px; font-weight: 600;
          letter-spacing: .05em; text-transform: uppercase;
          color: #9ca3af; white-space: nowrap;
        }
        .rrhh-table td {
          padding: 12px 16px; border-bottom: 1px solid #f3f4f6;
          color: #374151; vertical-align: middle;
        }
        .rrhh-table tbody tr:last-child td { border-bottom: none; }
        .rrhh-table tbody tr { cursor: pointer; transition: background 0.12s; }
        .rrhh-table tbody tr:hover { background: #f8fafc; }
        .rrhh-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: #dbeafe; display: flex; align-items: center;
          justify-content: center; font-size: 11px; font-weight: 600;
          color: #1a3a5c; flex-shrink: 0;
        }
        .rrhh-nombre-cell { display: flex; align-items: center; gap: 10px; }
        .rrhh-nombre { font-weight: 500; color: #111827; }
        .rrhh-doc    { font-size: 12px; color: #9ca3af; margin-top: 1px; }
        .rrhh-hint   { font-size: 11px; color: #c4cad4; margin-top: 2px; }
        .rrhh-badge {
          display: inline-flex; align-items: center;
          font-size: 11px; font-weight: 500;
          padding: 3px 9px; border-radius: 20px;
        }
        .rrhh-esp-list { display: flex; flex-wrap: wrap; gap: 4px; }
        .rrhh-esp-chip {
          display: inline-block; font-size: 11px; font-weight: 500;
          padding: 2px 8px; border-radius: 20px;
          background: #dbeafe; color: #1a3a5c;
        }
        .rrhh-actions { display: flex; align-items: center; gap: 6px; }
        .rrhh-action-btn {
          width: 30px; height: 30px; border-radius: 7px;
          border: 1px solid #e8edf2; background: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #6b7280; transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .rrhh-action-btn.edit:hover  { background: #eff6ff; color: #1a3a5c; border-color: #bfdbfe; }
        .rrhh-action-btn.trash:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
        .rrhh-empty {
          text-align: center; padding: 48px 16px;
          color: #9ca3af; font-size: 13.5px;
        }
        .rrhh-empty-icon {
          width: 40px; height: 40px; margin: 0 auto 12px;
          background: #f3f4f6; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; color: #d1d5db;
        }
        .rrhh-empty-title { font-weight: 500; color: #6b7280; margin-bottom: 4px; }
        .rrhh-pagination {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; border-top: 1px solid #e8edf2;
          font-size: 13px; color: #6b7280; flex-wrap: wrap; gap: 8px;
        }
        .rrhh-pag-btns { display: flex; align-items: center; gap: 6px; }
        .rrhh-pag-btn {
          width: 30px; height: 30px; border-radius: 7px;
          border: 1px solid #e8edf2; background: #fff; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #374151; transition: background 0.15s;
        }
        .rrhh-pag-btn:hover:not(:disabled) { background: #f0f4f8; }
        .rrhh-pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .rrhh-detalle { padding: 4px 0; }
        .rrhh-detalle-header {
          display: flex; align-items: flex-start; gap: 14px;
          margin-bottom: 20px; padding-bottom: 16px;
          border-bottom: 1px solid #f3f4f6;
        }
        .rrhh-detalle-avatar {
          width: 48px; height: 48px; border-radius: 50%;
          background: #dbeafe; display: flex; align-items: center;
          justify-content: center; font-size: 16px; font-weight: 700;
          color: #1a3a5c; flex-shrink: 0;
        }
        .rrhh-detalle-nombre { font-size: 16px; font-weight: 600; color: #111827; }
        .rrhh-detalle-doc    { font-size: 12.5px; color: #6b7280; margin-top: 2px; }
        .rrhh-btn-editar-detalle {
          margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; background: #f8fafc;
          border: 1.5px solid #e5e7eb; border-radius: 8px;
          font-size: 13px; font-family: 'DM Sans', sans-serif;
          color: #374151; cursor: pointer; transition: background 0.15s;
          white-space: nowrap;
        }
        .rrhh-btn-editar-detalle:hover { background: #eff6ff; border-color: #bfdbfe; color: #1a3a5c; }
        .rrhh-seccion {
          background: #fafbfc; border: 1px solid #e8edf2;
          border-radius: 10px; padding: 16px 18px; margin-bottom: 12px;
        }
        .rrhh-seccion-titulo {
          font-size: 10.5px; font-weight: 600; letter-spacing: .06em;
          text-transform: uppercase; color: #9ca3af; margin-bottom: 12px;
        }
        .rrhh-campos-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 20px;
        }
        .rrhh-campo-label {
          font-size: 10.5px; font-weight: 600; letter-spacing: .04em;
          text-transform: uppercase; color: #9ca3af; margin-bottom: 3px;
        }
        .rrhh-campo-valor { font-size: 13.5px; color: #111827; }
      `}</style>

      <div className="rrhh-header">
        <div>
          <div className="rrhh-title">RRHH — Prestadores</div>
          <div className="rrhh-subtitle">
            {data?.count !== undefined ? `${data.count} prestadores registrados` : 'Gestión de personal de salud'}
          </div>
        </div>
        <button className="rrhh-btn-nuevo" onClick={handleNuevo}>
          <Plus size={15} /> Nuevo prestador
        </button>
      </div>

      <form onSubmit={handleSearch} className="rrhh-search-row">
        <div className="rrhh-search-wrap">
          <Search size={15} className="rrhh-search-icon" />
          <input
            type="text"
            placeholder="Buscar por nombre, documento o matrícula..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="rrhh-search-input"
          />
        </div>
        <button type="submit" className="rrhh-btn-search">Buscar</button>
        <button
          type="button"
          className="rrhh-btn-listado"
          onClick={handleVerListado}
          disabled={loadingListado}
        >
          <FileText size={14} />
          {loadingListado ? 'Generando...' : 'Ver listado'}
        </button>
      </form>

      <div className="rrhh-table-card">
        <table className="rrhh-table">
          <thead>
            <tr>
              <th>Prestador</th>
              <th>Cargo</th>
              <th>Especialidades</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5}>
                <div className="rrhh-empty">
                  <div className="rrhh-empty-icon"><Users size={18} /></div>
                  Cargando prestadores...
                </div>
              </td></tr>
            )}
            {isError && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#dc2626', fontSize: '13.5px' }}>
                Error al cargar los prestadores. Intentá de nuevo.
              </td></tr>
            )}
            {!isLoading && !isError && data?.results?.length === 0 && (
              <tr><td colSpan={5}>
                <div className="rrhh-empty">
                  <div className="rrhh-empty-icon"><Users size={18} /></div>
                  <div className="rrhh-empty-title">No se encontraron prestadores</div>
                  {search && <div>Probá con otro término de búsqueda</div>}
                </div>
              </td></tr>
            )}
            {data?.results?.map((prestador) => {
              const nombre   = prestador.nombre || prestador.persona_detalle?.razon_social || '—'
              const initials = nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
              const estado   = prestador.estado ?? 'activo'
              const badge    = ESTADO_BADGE[estado] ?? ESTADO_BADGE.activo
              return (
                <tr key={prestador.id} onClick={() => handleVerDetalle(prestador)}>
                  <td>
                    <div className="rrhh-nombre-cell">
                      <div className="rrhh-avatar">{initials}</div>
                      <div>
                        <div className="rrhh-nombre">{nombre}</div>
                        <div className="rrhh-doc">{prestador.documento || prestador.persona_detalle?.nro_documento || '—'}</div>
                        <div className="rrhh-hint">Click para ver detalle</div>
                      </div>
                    </div>
                  </td>
                  <td>{CARGO_LABEL[prestador.cargo] ?? prestador.cargo ?? '—'}</td>
                  <td>
                    {prestador.especialidades_detalle?.length > 0
                      ? (
                        <div className="rrhh-esp-list">
                          {prestador.especialidades_detalle.map(e => (
                            <span key={e.id} className="rrhh-esp-chip">{e.descripcion}</span>
                          ))}
                        </div>
                      )
                      : <span style={{ color: '#d1d5db' }}>—</span>
                    }
                  </td>
                  <td>
                    <span className="rrhh-badge" style={{ background: badge.bg, color: badge.color }}>
                      {estado.charAt(0).toUpperCase() + estado.slice(1)}
                    </span>
                  </td>
                  <td>
                    <div className="rrhh-actions">
                      <button
                        className="rrhh-action-btn edit"
                        onClick={(e) => handleEditar(e, prestador)}
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="rrhh-action-btn trash"
                        onClick={(e) => handleConfirmEliminar(e, prestador.id)}
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
          <div className="rrhh-pagination">
            <span>Página {page} de {totalPages} — {data?.count} prestadores</span>
            <div className="rrhh-pag-btns">
              <button className="rrhh-pag-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={15} />
              </button>
              <button className="rrhh-pag-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
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
        {modo === 'ver' && prestadorSel && (
          <PrestadorDetalle
            prestador={prestadorSel}
            onEditar={() => setModo('editar')}
          />
        )}
        {(modo === 'crear' || modo === 'editar') && (
          <PersonaRRHHForm
            prestadorInicial={modo === 'editar' ? prestadorSel : null}
            onSuccess={handleSuccess}
          />
        )}
      </Modal>
    </>
  )
}
