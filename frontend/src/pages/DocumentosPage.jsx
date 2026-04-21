import { useState, useCallback } from 'react'
import { FileText, Search, Eye, X, FolderOpen, Trash2 } from 'lucide-react'
import { usePacientesConDocumentos, useDocumentosPorPaciente, useDeleteDocumento } from '../hooks/useDocumentos'
import Toast from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'

// ── Ícono según extensión del archivo ────────────────────────────────────────

function iconoArchivo(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️'
  if (ext === 'pdf') return '📄'
  return '📎'
}

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-PY', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function iniciales(nombre) {
  if (!nombre) return '??'
  return nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

// ── Visualizar documento (fetch con token → blob URL) ────────────────────────

async function abrirDocumento(docId) {
  const token = localStorage.getItem('access_token')
  const res = await fetch(`/api/documentos/${docId}/descargar/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('No se pudo obtener el documento.')
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  window.open(url, '_blank')
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function DocumentosPage() {
  const [search, setSearch]               = useState('')
  const [pacienteSeleccionado, setPaciente] = useState(null)
  const [filtroDocs, setFiltroDocs]       = useState('')
  const [abriendo, setAbriendo]           = useState(null) // docId en proceso
  const [eliminando, setEliminando]       = useState(null) // docId en proceso
  const { toast, showToast } = useToast()

  const { data: pacientes = [], isLoading: loadingPac } = usePacientesConDocumentos(search)
  const { data: documentos = [], isLoading: loadingDocs } = useDocumentosPorPaciente(
    pacienteSeleccionado?.id
  )
  const deleteDocumento = useDeleteDocumento()

  const docsVisibles = filtroDocs
    ? documentos.filter(d =>
        d.tipo_doc_dig_descripcion?.toLowerCase().includes(filtroDocs.toLowerCase()) ||
        d.filename?.toLowerCase().includes(filtroDocs.toLowerCase())
      )
    : documentos

  const handleVerDocumento = useCallback(async (doc) => {
    setAbriendo(doc.id)
    try {
      await abrirDocumento(doc.id)
    } catch {
      showToast('No se pudo abrir el documento.', 'error')
    } finally {
      setAbriendo(null)
    }
  }, [showToast])

  const handleEliminarDocumento = useCallback(async (doc) => {
    if (!window.confirm(`¿Eliminar "${doc.filename}"? Esta acción no se puede deshacer.`)) return
    setEliminando(doc.id)
    try {
      await deleteDocumento.mutateAsync(doc.id)
      showToast('Documento eliminado correctamente.', 'success')
    } catch {
      showToast('No se pudo eliminar el documento.', 'error')
    } finally {
      setEliminando(null)
    }
  }, [deleteDocumento, showToast])

  const handleSeleccionarPaciente = (pac) => {
    setPaciente(pac)
    setFiltroDocs('')
  }

  return (
    <>
      <style>{`
        /* ── Layout ── */
        .dd-page { display: flex; flex-direction: column; height: 100%; }

        .dd-header {
          display: flex; align-items: center; gap: 12px;
          padding: 20px 24px 0;
        }
        .dd-header-icon {
          width: 36px; height: 36px; background: #dbeafe;
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
        }
        .dd-header-title { font-size: 20px; font-weight: 600; color: #111827; }
        .dd-header-sub   { font-size: 13px; color: #9ca3af; }

        .dd-body {
          flex: 1; display: flex; gap: 0; overflow: hidden;
          padding: 16px 24px 24px;
        }

        /* ── Lista de pacientes ── */
        .dd-col-pacientes {
          width: 300px; flex-shrink: 0;
          display: flex; flex-direction: column; gap: 10px;
          border-right: 1px solid #e8edf2;
          padding-right: 16px;
        }
        .dd-search-wrap {
          display: flex; align-items: center; gap: 8px;
          background: #fff; border: 1px solid #e5e7eb;
          border-radius: 8px; padding: 0 10px;
        }
        .dd-search-input {
          flex: 1; border: none; outline: none; padding: 8px 0;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; background: transparent;
        }
        .dd-pac-list {
          flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;
        }
        .dd-pac-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 10px; border-radius: 8px; cursor: pointer;
          transition: background 0.12s; border: 1px solid transparent;
        }
        .dd-pac-item:hover { background: #f0f4f8; }
        .dd-pac-item.active {
          background: #eff6ff; border-color: #bfdbfe;
        }
        .dd-pac-avatar {
          width: 34px; height: 34px; border-radius: 50%;
          background: #dbeafe; color: #1a3a5c;
          font-size: 12px; font-weight: 600; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .dd-pac-info { flex: 1; min-width: 0; }
        .dd-pac-nombre {
          font-size: 13.5px; font-weight: 500; color: #111827;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .dd-pac-doc { font-size: 11.5px; color: #9ca3af; }
        .dd-pac-badge {
          background: #e0e7ff; color: #3730a3;
          font-size: 11px; font-weight: 600; padding: 2px 7px;
          border-radius: 20px; flex-shrink: 0;
        }
        .dd-pac-empty {
          text-align: center; color: #9ca3af;
          font-size: 13px; padding: 32px 0;
        }

        /* ── Panel derecho ── */
        .dd-col-detalle {
          flex: 1; display: flex; flex-direction: column;
          padding-left: 20px; overflow: hidden;
        }
        .dd-empty-state {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 10px; color: #9ca3af;
        }
        .dd-empty-state p { font-size: 14px; }

        /* ── Encabezado del panel ── */
        .dd-detalle-header {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 14px;
        }
        .dd-detalle-pac {
          display: flex; align-items: center; gap: 10px;
        }
        .dd-detalle-avatar {
          width: 38px; height: 38px; border-radius: 50%;
          background: #dbeafe; color: #1a3a5c;
          font-size: 13px; font-weight: 600;
          display: flex; align-items: center; justify-content: center;
        }
        .dd-detalle-nombre { font-size: 16px; font-weight: 600; color: #111827; }
        .dd-detalle-doc    { font-size: 12px; color: #9ca3af; }
        .dd-cerrar-btn {
          border: none; background: none; cursor: pointer;
          color: #9ca3af; padding: 4px; border-radius: 6px;
          display: flex; transition: color 0.12s;
        }
        .dd-cerrar-btn:hover { color: #374151; }

        /* ── Filtro de docs ── */
        .dd-docs-filtro {
          display: flex; align-items: center; gap: 8px;
          background: #fff; border: 1px solid #e5e7eb;
          border-radius: 8px; padding: 0 10px;
          max-width: 320px; margin-bottom: 12px;
        }
        .dd-docs-filtro input {
          flex: 1; border: none; outline: none; padding: 7px 0;
          font-size: 13px; font-family: 'DM Sans', sans-serif; background: transparent;
        }

        /* ── Tabla de documentos ── */
        .dd-tabla-wrap {
          flex: 1; overflow-y: auto;
          border: 1px solid #e8edf2; border-radius: 10px; background: #fff;
        }
        .dd-tabla {
          width: 100%; border-collapse: collapse;
        }
        .dd-th {
          text-align: left; padding: 11px 14px;
          font-size: 11.5px; font-weight: 600;
          color: #6b7280; text-transform: uppercase; letter-spacing: .04em;
          background: #f8fafc; border-bottom: 1px solid #e8edf2;
          position: sticky; top: 0;
        }
        .dd-td {
          padding: 12px 14px; font-size: 13.5px; color: #374151;
          vertical-align: middle; border-bottom: 1px solid #f3f4f6;
        }
        .dd-tr:last-child .dd-td { border-bottom: none; }
        .dd-tr:hover { background: #f9fafb; }

        .dd-archivo-cell {
          display: flex; align-items: center; gap: 8px;
        }
        .dd-archivo-icono { font-size: 18px; line-height: 1; }
        .dd-archivo-nombre {
          font-size: 13px; color: #374151;
          white-space: nowrap; overflow: hidden;
          text-overflow: ellipsis; max-width: 200px;
        }

        .dd-tipo-badge {
          background: #f0f4f8; color: #1a3a5c;
          font-size: 11.5px; font-weight: 500;
          padding: 3px 9px; border-radius: 20px;
          white-space: nowrap;
        }

        .dd-btn-ver {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 12px; border-radius: 6px; border: none;
          background: #1a3a5c; color: #fff;
          font-size: 12px; font-family: 'DM Sans', sans-serif;
          font-weight: 500; cursor: pointer;
          transition: background 0.15s; white-space: nowrap;
        }
        .dd-btn-ver:hover { background: #15304d; }
        .dd-btn-ver:disabled { background: #9ca3af; cursor: default; }

        .dd-btn-eliminar {
          display: inline-flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border-radius: 6px; border: 1px solid #fecaca;
          background: #fff; color: #dc2626; cursor: pointer;
          transition: background 0.15s, color 0.15s; flex-shrink: 0;
        }
        .dd-btn-eliminar:hover { background: #fef2f2; }
        .dd-btn-eliminar:disabled { opacity: 0.4; cursor: default; }

        .dd-acciones { display: flex; align-items: center; gap: 6px; }

        .dd-docs-empty {
          text-align: center; color: #9ca3af;
          font-size: 13px; padding: 32px;
        }
        .dd-loading { text-align: center; color: #9ca3af; font-size: 13px; padding: 32px; }
      `}</style>

      <div className="dd-page">
        {/* Header */}
        <div className="dd-header">
          <div className="dd-header-icon">
            <FolderOpen size={18} color="#1a3a5c" />
          </div>
          <div>
            <div className="dd-header-title">Documentos Digitalizados</div>
            <div className="dd-header-sub">Historial de archivos por paciente</div>
          </div>
        </div>

        <div className="dd-body">
          {/* Columna izquierda: pacientes */}
          <div className="dd-col-pacientes">
            <div className="dd-search-wrap">
              <Search size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />
              <input
                className="dd-search-input"
                placeholder="Buscar paciente…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="dd-pac-list">
              {loadingPac ? (
                <div className="dd-pac-empty">Cargando…</div>
              ) : pacientes.length === 0 ? (
                <div className="dd-pac-empty">
                  {search ? 'Sin resultados.' : 'No hay pacientes con documentos.'}
                </div>
              ) : (
                pacientes.map(pac => (
                  <div
                    key={pac.id}
                    className={`dd-pac-item ${pacienteSeleccionado?.id === pac.id ? 'active' : ''}`}
                    onClick={() => handleSeleccionarPaciente(pac)}
                  >
                    <div className="dd-pac-avatar">{iniciales(pac.nombre)}</div>
                    <div className="dd-pac-info">
                      <div className="dd-pac-nombre">{pac.nombre}</div>
                      <div className="dd-pac-doc">{pac.nro_documento}</div>
                    </div>
                    <span className="dd-pac-badge">{pac.cantidad_documentos}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Columna derecha: documentos */}
          <div className="dd-col-detalle">
            {!pacienteSeleccionado ? (
              <div className="dd-empty-state">
                <FileText size={42} style={{ opacity: 0.15 }} />
                <p>Seleccioná un paciente para ver sus documentos</p>
              </div>
            ) : (
              <>
                {/* Encabezado paciente seleccionado */}
                <div className="dd-detalle-header">
                  <div className="dd-detalle-pac">
                    <div className="dd-detalle-avatar">{iniciales(pacienteSeleccionado.nombre)}</div>
                    <div>
                      <div className="dd-detalle-nombre">{pacienteSeleccionado.nombre}</div>
                      <div className="dd-detalle-doc">{pacienteSeleccionado.nro_documento}</div>
                    </div>
                  </div>
                  <button className="dd-cerrar-btn" onClick={() => setPaciente(null)}>
                    <X size={16} />
                  </button>
                </div>

                {/* Filtro de documentos */}
                <div className="dd-docs-filtro">
                  <Search size={13} style={{ color: '#9ca3af', flexShrink: 0 }} />
                  <input
                    placeholder="Filtrar por tipo o nombre…"
                    value={filtroDocs}
                    onChange={e => setFiltroDocs(e.target.value)}
                  />
                </div>

                {/* Tabla */}
                <div className="dd-tabla-wrap">
                  {loadingDocs ? (
                    <div className="dd-loading">Cargando documentos…</div>
                  ) : docsVisibles.length === 0 ? (
                    <div className="dd-docs-empty">
                      {filtroDocs ? 'Sin resultados para ese filtro.' : 'Este paciente no tiene documentos.'}
                    </div>
                  ) : (
                    <table className="dd-tabla">
                      <thead>
                        <tr>
                          <th className="dd-th">Archivo</th>
                          <th className="dd-th">Tipo de documento</th>
                          <th className="dd-th">Fecha de carga</th>
                          <th className="dd-th" style={{ width: 120 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {docsVisibles.map(doc => (
                          <tr key={doc.id} className="dd-tr">
                            <td className="dd-td">
                              <div className="dd-archivo-cell">
                                <span className="dd-archivo-icono">{iconoArchivo(doc.filename)}</span>
                                <span className="dd-archivo-nombre" title={doc.filename}>
                                  {doc.filename}
                                </span>
                              </div>
                            </td>
                            <td className="dd-td">
                              <span className="dd-tipo-badge">
                                {doc.tipo_doc_dig_descripcion || '—'}
                              </span>
                            </td>
                            <td className="dd-td">{formatFecha(doc.fecha_creacion)}</td>
                            <td className="dd-td">
                              <div className="dd-acciones">
                                <button
                                  className="dd-btn-ver"
                                  onClick={() => handleVerDocumento(doc)}
                                  disabled={abriendo === doc.id || eliminando === doc.id}
                                >
                                  {abriendo === doc.id ? <>Abriendo…</> : <><Eye size={13} /> Ver</>}
                                </button>
                                <button
                                  className="dd-btn-eliminar"
                                  onClick={() => handleEliminarDocumento(doc)}
                                  disabled={eliminando === doc.id || abriendo === doc.id}
                                  title="Eliminar documento"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Toast toast={toast} />
    </>
  )
}
