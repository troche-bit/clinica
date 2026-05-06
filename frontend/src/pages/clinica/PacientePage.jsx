import { useState } from 'react'
import { useAtajosTeclado } from '../../hooks/useAtajosTeclado'
import { usePatients, usePacienteMutations } from '../../hooks/clinica/usePatients'
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Users, FileText } from 'lucide-react'
import apiClient from '../../api/client'
import Modal from '../../components/ui/Modal'
import PacienteForm from '../../components/paciente/PacienteForm'
import Toast from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const SEXO_LABEL = { M: 'Masculino', F: 'Femenino', O: 'Otro' }

function Campo({ label, valor }) {
  return (
    <div className="pac-det-campo">
      <div className="pac-det-label">{label}</div>
      <div className="pac-det-valor">{valor || '—'}</div>
    </div>
  )
}

function CampoDestacado({ label, valor, variante }) {
  return (
    <div className={`pac-det-campo-destacado pac-det-campo-${variante}`}>
      <div className="pac-det-label-dest">{label}</div>
      <div className="pac-det-valor-dest">{valor || 'Sin registro'}</div>
    </div>
  )
}

function Seccion({ titulo, children }) {
  return (
    <div className="pac-det-card">
      <div className="pac-det-card-titulo">{titulo}</div>
      {children}
    </div>
  )
}

function PacienteDetalle({ paciente, onEditar }) {
  const p   = paciente.persona_detalle || {}
  const res = paciente.responsable_detalle

  return (
    <div className="pac-det-root">
      <div className="pac-det-cabecera">
        <div className="pac-det-avatar">
          {(paciente.nombre || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
        </div>
        <div>
          <div className="pac-det-nombre">{paciente.nombre || '—'}</div>
          <div className="pac-det-documento">
            {p.tipo_documento_detalle?.descripcion} · {paciente.documento || '—'}
          </div>
        </div>
      </div>

      <Seccion titulo="Datos personales">
        <div className="pac-det-grid">
          <Campo label="Fecha de nacimiento" valor={paciente.fecha_nacimiento} />
          <Campo label="Sexo"                valor={SEXO_LABEL[paciente.sexo]} />
          <Campo label="Grupo sanguíneo"     valor={paciente.grupo_sanguineo} />
          <Campo label="Teléfono"            valor={p.telefono} />
          <Campo label="Correo electrónico"  valor={p.correo_electronico} />
          <Campo label="RUC / DV"            valor={p.ruc_dv} />
          <Campo label="País"                valor={p.pais_detalle?.descripcion} />
          <Campo label="Departamento"        valor={p.departamento_detalle?.descripcion} />
          <Campo label="Ciudad"              valor={p.ciudad_detalle?.descripcion} />
        </div>
        {p.direccion && (
          <div style={{ marginTop: 12 }}>
            <Campo label="Dirección" valor={p.direccion} />
          </div>
        )}
      </Seccion>

      <Seccion titulo="Información médica">
        <CampoDestacado
          label="Alergias conocidas"
          valor={paciente.alergias_conocidas}
          variante="amarillo"
        />
        <CampoDestacado
          label="Enfermedades crónicas"
          valor={paciente.enfermedades_cronicas}
          variante="rojo"
        />
        {paciente.observacion && (
          <div style={{ marginTop: 10 }}>
            <Campo label="Observación" valor={paciente.observacion} />
          </div>
        )}
      </Seccion>

      {res && (
        <Seccion titulo="Responsable">
          <div className="pac-det-grid">
            <Campo label="Nombre"     valor={res.nombre} />
            <Campo label="Parentesco" valor={paciente.parentesco} />
            <Campo label="Teléfono"   valor={res.telefono} />
            <Campo label="Ocupación"  valor={res.ocupacion} />
          </div>
        </Seccion>
      )}

      <div className="pac-det-footer">
        <button className="pac-det-btn-editar" onClick={onEditar}>
          <Pencil size={14} />
          Editar paciente
        </button>
      </div>
    </div>
  )
}

export default function PacientePage() {
  const [pacienteEdit, setPacienteEdit] = useState(null)
  const [modo,         setModo]         = useState(null)
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [searchInput,  setSearchInput]  = useState('')
  const [confirmId,      setConfirmId]      = useState(null)
  const [loadingListado, setLoadingListado] = useState(false)

  const { toast, showToast }          = useToast()
  const { data, isLoading, isError }  = usePatients({ page, search })
  const { eliminar }                  = usePacienteMutations(showToast)

  useAtajosTeclado({
    'Insert': { fn: () => { if (modo === null) handleNuevo() } },
  })

  const totalPages = data ? Math.ceil(data.count / 20) : 0

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const handleNuevo = () => {
    setPacienteEdit(null)
    setModo('crear')
  }

  const handleVerDetalle = (paciente) => {
    setPacienteEdit(paciente)
    setModo('ver')
  }

  const handleEditar = (paciente) => {
    setPacienteEdit(paciente)
    setModo('editar')
  }

  const handleClose = () => {
    setPacienteEdit(null)
    setModo(null)
  }

  const handleSuccess = () => {
    handleClose()
    showToast('Paciente guardado correctamente.', 'success')
  }

  const handleVerListado = async () => {
    setLoadingListado(true)
    try {
      const res = await apiClient.get('/paciente/reporte-lista/', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch {
      showToast('No se pudo generar el listado.', 'error')
    } finally {
      setLoadingListado(false)
    }
  }

  const handleEliminar = (id) => setConfirmId(id)

  const confirmarEliminar = () => eliminar.mutate(confirmId, {
    onSuccess: () => setConfirmId(null),
  })

  const sexoLabel = (sexo) => SEXO_LABEL[sexo] || '—'

  return (
    <>
      <Toast toast={toast} />
      <ConfirmDialog
        isOpen={confirmId !== null}
        title="Eliminar paciente"
        description="¿Estás seguro de que querés eliminar este paciente? Si tiene citas activas no se podrá eliminar."
        loading={eliminar.isPending}
        onConfirm={confirmarEliminar}
        onCancel={() => setConfirmId(null)}
      />

      <style>{`
        .pac-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 24px;
          gap: 12px;
          flex-wrap: wrap;
        }
        .pac-title { font-size: 22px; font-weight: 600; color: #1a3a5c; margin-bottom: 2px; }
        .pac-subtitle { font-size: 13px; color: #6b7280; }

        .pac-btn-nuevo {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 18px;
          background: #1a3a5c;
          color: #fff;
          border: none;
          border-radius: 9px;
          font-size: 13.5px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s, box-shadow 0.15s;
          flex-shrink: 0;
        }
        .pac-btn-nuevo:hover {
          background: #15304d;
          box-shadow: 0 4px 12px rgba(26,58,92,0.2);
        }

        .pac-search-row {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        .pac-search-wrap {
          position: relative;
          flex: 1;
          max-width: 380px;
        }
        .pac-search-icon {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          pointer-events: none;
        }
        .pac-search-input {
          width: 100%;
          padding: 9px 12px 9px 34px;
          border: 1.5px solid #e5e7eb;
          border-radius: 9px;
          font-size: 13.5px;
          font-family: 'DM Sans', sans-serif;
          color: #111827;
          background: #fff;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .pac-search-input:focus {
          border-color: #1a3a5c;
          box-shadow: 0 0 0 3px rgba(26,58,92,0.08);
        }
        .pac-search-input::placeholder { color: #d1d5db; }
        .pac-btn-search {
          padding: 9px 16px;
          background: #f8fafc;
          border: 1.5px solid #e5e7eb;
          border-radius: 9px;
          font-size: 13.5px;
          font-family: 'DM Sans', sans-serif;
          color: #374151;
          cursor: pointer;
          transition: background 0.15s;
        }
        .pac-btn-search:hover { background: #f0f4f8; }
        .pac-btn-listado {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 16px;
          background: #f8fafc;
          border: 1.5px solid #e5e7eb;
          border-radius: 9px;
          font-size: 13.5px;
          font-family: 'DM Sans', sans-serif;
          color: #374151;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
          margin-left: auto;
        }
        .pac-btn-listado:hover:not(:disabled) { background: #eff6ff; border-color: #bfdbfe; color: #1a3a5c; }
        .pac-btn-listado:disabled { opacity: 0.6; cursor: not-allowed; }

        .pac-table-card {
          background: #fff;
          border: 1px solid #e8edf2;
          border-radius: 12px;
          overflow: hidden;
        }
        .pac-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .pac-table thead { background: #f8fafc; border-bottom: 1px solid #e8edf2; }
        .pac-table th {
          text-align: left;
          padding: 11px 16px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .05em;
          text-transform: uppercase;
          color: #9ca3af;
          white-space: nowrap;
        }
        .pac-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #f3f4f6;
          color: #374151;
          vertical-align: middle;
        }
        .pac-table tbody tr:last-child td { border-bottom: none; }
        .pac-table tbody tr { cursor: pointer; transition: background 0.15s; }
        .pac-table tbody tr:hover { background: #f0f4f8; }

        .pac-avatar {
          width: 32px; height: 32px;
          border-radius: 50%;
          background: #dbeafe;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 600;
          color: #1a3a5c;
          flex-shrink: 0;
        }
        .pac-nombre-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .pac-nombre { font-weight: 500; color: #111827; }
        .pac-doc { font-size: 12px; color: #9ca3af; margin-top: 1px; }
        .pac-hint { font-size: 11.5px; color: #9ca3af; margin-top: 3px; font-style: italic; }

        .pac-badge {
          display: inline-flex;
          align-items: center;
          font-size: 11px;
          font-weight: 500;
          padding: 3px 9px;
          border-radius: 20px;
        }
        .pac-badge-m { background: #dbeafe; color: #1a3a5c; }
        .pac-badge-f { background: #fce7f3; color: #9d174d; }
        .pac-badge-o { background: #f3f4f6; color: #6b7280; }

        .pac-actions { display: flex; align-items: center; gap: 6px; }
        .pac-btn-edit {
          width: 30px; height: 30px;
          border-radius: 7px;
          border: 1px solid #e8edf2;
          background: none;
          cursor: pointer;
          color: #6b7280;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .pac-btn-edit:hover { background: #eff6ff; color: #1a3a5c; border-color: #bfdbfe; }
        .pac-btn-del {
          width: 30px; height: 30px;
          border-radius: 7px;
          border: 1px solid #e8edf2;
          background: none;
          cursor: pointer;
          color: #6b7280;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .pac-btn-del:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }

        .pac-empty {
          text-align: center;
          padding: 48px 16px;
          color: #9ca3af;
          font-size: 13.5px;
        }
        .pac-empty-icon {
          width: 40px; height: 40px;
          margin: 0 auto 12px;
          background: #f3f4f6;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #d1d5db;
        }
        .pac-empty-title { font-weight: 500; color: #6b7280; margin-bottom: 4px; }

        .pac-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-top: 1px solid #e8edf2;
          font-size: 13px;
          color: #6b7280;
          flex-wrap: wrap;
          gap: 8px;
        }
        .pac-pag-btns { display: flex; align-items: center; gap: 6px; }
        .pac-pag-btn {
          width: 30px; height: 30px;
          border-radius: 7px;
          border: 1px solid #e8edf2;
          background: #fff;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #374151;
          transition: background 0.15s;
        }
        .pac-pag-btn:hover:not(:disabled) { background: #f0f4f8; }
        .pac-pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Vista detalle */
        .pac-det-root { font-family: 'DM Sans', sans-serif; }

        .pac-det-cabecera {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e8edf2;
        }
        .pac-det-avatar {
          width: 48px; height: 48px;
          border-radius: 50%;
          background: #dbeafe;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 600;
          color: #1a3a5c;
          flex-shrink: 0;
        }
        .pac-det-nombre    { font-size: 17px; font-weight: 600; color: #111827; }
        .pac-det-documento { font-size: 13px; color: #6b7280; margin-top: 3px; }

        /* Sección card */
        .pac-det-card {
          border: 1px solid #e8edf2;
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 12px;
          background: #fafbfc;
        }
        .pac-det-card-titulo {
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: .07em;
          text-transform: uppercase;
          color: #9ca3af;
          margin-bottom: 12px;
        }

        /* Campos estándar */
        .pac-det-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px 16px;
        }
        .pac-det-label {
          font-size: 10.5px;
          font-weight: 500;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: .04em;
          margin-bottom: 2px;
        }
        .pac-det-valor {
          font-size: 13.5px;
          color: #111827;
          line-height: 1.4;
        }

        /* Campos destacados */
        .pac-det-campo-destacado {
          border-radius: 8px;
          padding: 10px 12px;
          margin-bottom: 8px;
          border-left: 3px solid transparent;
        }
        .pac-det-campo-amarillo {
          background: #fefce8;
          border-left-color: #ca8a04;
        }
        .pac-det-campo-rojo {
          background: #fff5f5;
          border-left-color: #f87171;
        }
        .pac-det-label-dest {
          font-size: 10.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: .04em;
          margin-bottom: 4px;
        }
        .pac-det-campo-amarillo .pac-det-label-dest { color: #92400e; }
        .pac-det-campo-rojo     .pac-det-label-dest { color: #991b1b; }
        .pac-det-valor-dest {
          font-size: 13.5px;
          line-height: 1.5;
          white-space: pre-wrap;
        }
        .pac-det-campo-amarillo .pac-det-valor-dest { color: #78350f; }
        .pac-det-campo-rojo     .pac-det-valor-dest { color: #7f1d1d; }

        .pac-det-footer {
          display: flex;
          justify-content: flex-end;
          padding-top: 4px;
        }
        .pac-det-btn-editar {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 18px;
          background: #1a3a5c;
          color: #fff;
          border: none;
          border-radius: 9px;
          font-size: 13.5px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .pac-det-btn-editar:hover {
          background: #15304d;
          box-shadow: 0 4px 12px rgba(26,58,92,0.2);
        }
      `}</style>

      <div className="pac-header">
        <div>
          <div className="pac-title">Pacientes</div>
          <div className="pac-subtitle">
            {data?.count !== undefined ? `${data.count} pacientes registrados` : 'Gestión de pacientes'}
          </div>
        </div>
        <button className="pac-btn-nuevo" onClick={handleNuevo}>
          <Plus size={15} />
          Nuevo paciente
        </button>
      </div>

      <form onSubmit={handleSearch} className="pac-search-row">
        <div className="pac-search-wrap">
          <Search size={15} className="pac-search-icon" />
          <input
            type="text"
            placeholder="Buscar por nombre o documento..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pac-search-input"
          />
        </div>
        <button type="submit" className="pac-btn-search">Buscar</button>
        <button
          className="pac-btn-listado"
          onClick={handleVerListado}
          disabled={loadingListado}
        >
          <FileText size={14} />
          {loadingListado ? 'Generando...' : 'Ver listado'}
        </button>
      </form>

      <div className="pac-table-card">
        <table className="pac-table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Fecha nac.</th>
              <th>Sexo</th>
              <th>Grupo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="pac-empty">
                  <div className="pac-empty-icon">
                    <Users size={18} />
                  </div>
                  Cargando pacientes...
                </td>
              </tr>
            )}

            {isError && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#dc2626', fontSize: '13.5px' }}>
                  Error al cargar los pacientes. Intentá de nuevo.
                </td>
              </tr>
            )}

            {!isLoading && !isError && data?.results?.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="pac-empty">
                    <div className="pac-empty-icon"><Users size={18} /></div>
                    <div className="pac-empty-title">No se encontraron pacientes</div>
                    {search && <div>Probá con otro término de búsqueda</div>}
                  </div>
                </td>
              </tr>
            )}

            {data?.results?.map((paciente) => {
              const nombre   = paciente.nombre || paciente.persona?.razon_social || '—'
              const initials = nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
              return (
                <tr key={paciente.id} onClick={() => handleVerDetalle(paciente)}>
                  <td>
                    <div className="pac-nombre-cell">
                      <div className="pac-avatar">{initials}</div>
                      <div>
                        <div className="pac-nombre">{nombre}</div>
                        <div className="pac-doc">{paciente.documento || paciente.persona?.nro_documento || '—'}</div>
                        <div className="pac-hint">Clic para ver detalle</div>
                      </div>
                    </div>
                  </td>
                  <td>{paciente.fecha_nacimiento ?? '—'}</td>
                  <td>
                    <span className={`pac-badge ${
                      paciente.sexo === 'M' ? 'pac-badge-m'
                      : paciente.sexo === 'F' ? 'pac-badge-f'
                      : 'pac-badge-o'
                    }`}>
                      {sexoLabel(paciente.sexo)}
                    </span>
                  </td>
                  <td>{paciente.grupo_sanguineo || '—'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="pac-actions">
                      <button
                        className="pac-btn-edit"
                        onClick={() => handleEditar(paciente)}
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="pac-btn-del"
                        onClick={() => handleEliminar(paciente.id)}
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
          <div className="pac-pagination">
            <span>Página {page} de {totalPages} — {data?.count} pacientes</span>
            <div className="pac-pag-btns">
              <button
                className="pac-pag-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={15} />
              </button>
              <button
                className="pac-pag-btn"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={modo !== null}
        onClose={handleClose}
        title={
          modo === 'crear'  ? 'Nuevo paciente' :
          modo === 'editar' ? 'Editar paciente' :
          'Detalle del paciente'
        }
        subtitle={
          modo === 'crear'
            ? 'Buscá por documento para comenzar'
            : (pacienteEdit?.nombre || pacienteEdit?.persona?.razon_social)
        }
        size="lg"
      >
        {modo === 'ver' ? (
          <PacienteDetalle
            paciente={pacienteEdit}
            onEditar={() => setModo('editar')}
          />
        ) : (
          <PacienteForm
            pacienteInicial={pacienteEdit}
            onSuccess={handleSuccess}
          />
        )}
      </Modal>
    </>
  )
}
