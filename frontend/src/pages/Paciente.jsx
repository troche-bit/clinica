import { useState } from 'react'
import { usePatients, useDeletePatient } from '../hooks/usePatients'
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import Modal from '../components/ui/Modal'
import PacienteForm from '../components/paciente/PacienteForm'

export default function Paciente() {
  const [modalOpen,    setModalOpen]    = useState(false)
  const [pacienteEdit, setPacienteEdit] = useState(null) // null = crear, objeto = editar
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [searchInput,  setSearchInput]  = useState('')

  const { data, isLoading, isError }  = usePatients({ page, search })
  const { mutate: deletePatient }     = useDeletePatient()

  const totalPages = data ? Math.ceil(data.count / 20) : 0

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const handleNuevo = () => {
    setPacienteEdit(null)
    setModalOpen(true)
  }

  const handleEditar = (paciente) => {
    setPacienteEdit(paciente)
    setModalOpen(true)
  }

  const handleClose = () => {
    setModalOpen(false)
    setPacienteEdit(null)
  }

  const handleDelete = (id) => {
    if (window.confirm('¿Estás seguro de eliminar este paciente?')) {
      deletePatient(id)
    }
  }

  const sexoLabel = (sexo) => {
    if (sexo === 'M') return 'Masculino'
    if (sexo === 'F') return 'Femenino'
    if (sexo === 'O') return 'Otro'
    return '—'
  }

  return (
    <>
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
        .pac-table tbody tr:hover { background: #f8fafc; }

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
      `}</style>

      {/* Header */}
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

      {/* Buscador */}
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
      </form>

      {/* Tabla */}
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
                <tr key={paciente.id}>
                  <td>
                    <div className="pac-nombre-cell">
                      <div className="pac-avatar">{initials}</div>
                      <div>
                        <div className="pac-nombre">{nombre}</div>
                        <div className="pac-doc">{paciente.documento || paciente.persona?.nro_documento || '—'}</div>
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
                  <td>
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
                        onClick={() => handleDelete(paciente.id)}
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

        {/* Paginación */}
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

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleClose}
        title={pacienteEdit ? 'Editar paciente' : 'Nuevo paciente'}
        subtitle={pacienteEdit
          ? (pacienteEdit.nombre || pacienteEdit.persona?.razon_social)
          : 'Buscá por documento para comenzar'
        }
        size="lg"
      >
        <PacienteForm
          pacienteInicial={pacienteEdit}
          onSuccess={handleClose}
        />
      </Modal>
    </>
  )
}