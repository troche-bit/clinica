import { useState, useRef, useCallback } from 'react'
import { useAtajosTeclado } from '../../hooks/useAtajosTeclado'
import { usePatients, usePacienteMutations } from '../../hooks/clinica/usePatients'
import { useConsultasPaciente } from '../../hooks/clinica/useConsultas'
import { useDocumentosPorPaciente, useDocumentosPorConsulta } from '../../hooks/mantenimiento/useDocumentos'
import {
  Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight,
  Users, FileText, Phone, ClipboardList, FolderOpen,
  Download, Eye, Grid, List, ChevronDown, ChevronUp,
} from 'lucide-react'
import apiClient from '../../api/client'
import Modal from '../../components/ui/Modal'
import PacienteForm from '../../components/paciente/PacienteForm'
import Toast from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { useNavigationGuard } from '../../hooks/useNavigationGuard'

const SEXO_LABEL = { M: 'Masculino', F: 'Femenino', O: 'Otro' }
const EXTENSIONES_IMAGEN = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']

async function fetchDocumentoBlob(docId) {
  const token = localStorage.getItem('access_token')
  const res = await fetch(`/api/documentos/${docId}/descargar/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('No se pudo obtener el documento.')
  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  const buffer = await res.arrayBuffer()
  return new Blob([buffer], { type: contentType })
}

const ESTADO_CONSULTA = {
  en_espera:   { label: 'En espera',   cls: 'badge-warning' },
  en_consulta: { label: 'En consulta', cls: 'badge-info' },
  finalizada:  { label: 'Finalizada',  cls: 'badge-success' },
  pendiente:   { label: 'Pendiente',   cls: 'badge-gray' },
}

function formatFecha(iso) {
  if (!iso) return '—'
  const d = iso.split('T')[0]
  const [y, m, dd] = d.split('-')
  return y && m && dd ? `${dd}-${m}-${y}` : '—'
}

function gridIconoInfo(filename) {
  const ext = filename?.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return { label: 'PDF', bg: '#fee2e2', color: '#dc2626', border: '#fecaca' }
  if (EXTENSIONES_IMAGEN.includes(ext)) return { label: ext?.toUpperCase() || 'IMG', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }
  if (['docx', 'doc'].includes(ext)) return { label: 'DOC', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' }
  if (['xlsx', 'xls'].includes(ext)) return { label: 'XLS', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' }
  return { label: '—', bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' }
}

/* ── Helpers ── */

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

/* ── Timeline de consultas (desplegable) ── */

function TimelineItem({ consulta }) {
  const [expandido,   setExpandido]   = useState(false)
  const [abriendoDoc, setAbriendoDoc] = useState(null)

  const { data: docsData } = useDocumentosPorConsulta(consulta.id)
  const docs = Array.isArray(docsData) ? docsData : (docsData?.results || [])

  const estado       = ESTADO_CONSULTA[consulta.estado] || { label: consulta.estado, cls: 'badge-gray' }
  const tieneClinical = !!(consulta.motivo_consulta || consulta.diagnostico || consulta.tratamiento)
  const tieneDetalle  = tieneClinical || docs.length > 0

  const handleVerDoc = async (doc) => {
    setAbriendoDoc(doc.id)
    try {
      const blob = await fetchDocumentoBlob(doc.id)
      const url  = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch { /* silencioso */ }
    finally { setAbriendoDoc(null) }
  }

  return (
    <div className="pac-tl-item">
      <div className="pac-tl-left">
        <div className={`pac-tl-dot${expandido ? ' pac-tl-dot-abierto' : ''}`} />
        <div className="pac-tl-line" />
      </div>
      <div className="pac-tl-body">
        <div className={`pac-tl-card${expandido ? ' pac-tl-card-open' : ''}${tieneDetalle ? ' pac-tl-card-clickable' : ''}`}>
          <div
            className="pac-tl-card-top"
            onClick={() => tieneDetalle && setExpandido(v => !v)}
          >
            <div className="pac-tl-card-head">
              <div className="pac-tl-head-row">
                <span className="pac-tl-fecha">{formatFecha(consulta.agenda_detalle?.fecha)}</span>
                <span className={`badge ${estado.cls}`}>{estado.label}</span>
                {consulta.evento_clinico_nombre && (
                  <span className="pac-tl-evtclin">{consulta.evento_clinico_nombre}</span>
                )}
              </div>
              {(consulta.medico_nombre || consulta.especialidad_nombre) && (
                <div className="pac-tl-sub">
                  {consulta.medico_nombre && (
                    <span className="pac-tl-medico">{consulta.medico_nombre}</span>
                  )}
                  {consulta.especialidad_nombre && (
                    <span className="pac-tl-esp-badge">{consulta.especialidad_nombre}</span>
                  )}
                </div>
              )}
            </div>
            {tieneDetalle && (
              <div className="pac-tl-chevron-icon">
                {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            )}
          </div>

          {expandido && (
            <div className="pac-tl-card-body">
              {consulta.motivo_consulta && (
                <div className="pac-tl-campo">
                  <span className="pac-tl-label">Motivo</span>
                  <p className="pac-tl-valor">{consulta.motivo_consulta}</p>
                </div>
              )}
              {consulta.diagnostico && (
                <div className="pac-tl-campo">
                  <span className="pac-tl-label">Diagnóstico</span>
                  <p className="pac-tl-valor">{consulta.diagnostico}</p>
                </div>
              )}
              {consulta.tratamiento && (
                <div className="pac-tl-campo">
                  <span className="pac-tl-label">Tratamiento</span>
                  <p className="pac-tl-valor">{consulta.tratamiento}</p>
                </div>
              )}
              {docs.length > 0 && (
                <div className="pac-tl-docs">
                  <div className="pac-tl-docs-titulo">Documentos</div>
                  {docs.map(doc => {
                    const info = gridIconoInfo(doc.filename || '')
                    return (
                      <div key={doc.id} className="pac-tl-doc-row">
                        <div className="pac-tl-doc-icono" style={{ background: info.bg, color: info.color }}>
                          {info.label}
                        </div>
                        <span className="pac-tl-doc-nombre" title={doc.filename}>
                          {doc.filename || `Documento #${doc.id}`}
                        </span>
                        {doc.tipo_doc_dig_descripcion && (
                          <span className="pac-tl-doc-tipo">{doc.tipo_doc_dig_descripcion}</span>
                        )}
                        <button
                          className="pac-tl-doc-btn"
                          onClick={e => { e.stopPropagation(); handleVerDoc(doc) }}
                          disabled={abriendoDoc === doc.id}
                          title="Ver documento"
                        >
                          {abriendoDoc === doc.id ? '…' : <Eye size={12} />}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Vista de detalle ── */

function PacienteDetalle({ paciente, onEditar }) {
  const [tab,           setTab]           = useState('datos')
  const [espSelect,     setEspSelect]     = useState('')
  const [docVista,      setDocVista]      = useState('lista')
  const [docFiltro,     setDocFiltro]     = useState('todos')
  const [abriendoDoc,   setAbriendoDoc]   = useState(null)
  const [imagenPreview, setImagenPreview] = useState(null)

  const p   = paciente.persona_detalle || {}
  const res = paciente.responsable_detalle

  const { data: consultasData, isLoading: loadConsultas } = useConsultasPaciente(paciente.id)
  const { data: documentos,    isLoading: loadDocs }       = useDocumentosPorPaciente(paciente.id)

  const consultas = consultasData?.results || consultasData || []
  const docs      = documentos || []

  const initials = (paciente.nombre || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  const especialidades = [...new Set(
    consultas.map(c => c.especialidad_nombre).filter(Boolean)
  )].sort()

  const consultasFiltradas = espSelect
    ? consultas.filter(c => c.especialidad_nombre === espSelect)
    : consultas

  const docsFiltrados = docs.filter(doc => {
    if (docFiltro === 'por_consulta') return !!doc.consulta
    if (docFiltro === 'directo') return !doc.consulta
    return true
  })

  const handleVerDoc = useCallback(async (doc) => {
    setAbriendoDoc(doc.id)
    try {
      const blob = await fetchDocumentoBlob(doc.id)
      const url  = URL.createObjectURL(blob)
      const ext  = (doc.filename || '').split('.').pop().toLowerCase()
      if (EXTENSIONES_IMAGEN.includes(ext)) {
        setImagenPreview({ url, filename: doc.filename })
      } else {
        window.open(url, '_blank')
      }
    } catch {
      /* silencioso */
    } finally {
      setAbriendoDoc(null)
    }
  }, [])

  return (
    <div className="pac-det-root">
      {imagenPreview && (
        <div className="pac-img-overlay" onClick={() => setImagenPreview(null)}>
          <img
            src={imagenPreview.url}
            alt={imagenPreview.filename}
            className="pac-img-preview"
            onClick={e => e.stopPropagation()}
          />
          <button className="pac-img-close" onClick={() => setImagenPreview(null)}>✕</button>
        </div>
      )}

      <div className="pac-det-cabecera">
        <div className="pac-det-avatar">{initials}</div>
        <div className="pac-det-cabecera-info">
          <div className="pac-det-nombre">{paciente.nombre || '—'}</div>
          <div className="pac-det-documento">
            {p.tipo_documento_detalle?.descripcion} · {paciente.documento || '—'}
          </div>
        </div>
        <button className="pac-det-btn-editar" onClick={onEditar}>
          <Pencil size={14} /> Editar
        </button>
      </div>

      <div className="pac-tabs">
        {[
          { id: 'datos',      label: 'Datos del paciente', icono: <Users size={13} /> },
          { id: 'consultas',  label: 'Consultas',          icono: <ClipboardList size={13} /> },
          { id: 'documentos', label: 'Documentos',         icono: <FolderOpen size={13} /> },
        ].map(t => (
          <button
            key={t.id}
            className={`pac-tab-btn${tab === t.id ? ' pac-tab-activo' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.icono} {t.label}
          </button>
        ))}
      </div>

      {tab === 'datos' && (
        <div className="pac-tab-content">
          <Seccion titulo="Datos personales">
            <div className="pac-det-grid">
              <Campo label="Fecha de nacimiento" valor={formatFecha(paciente.fecha_nacimiento)} />
              <Campo label="Sexo"                valor={SEXO_LABEL[paciente.sexo]} />
              <div className="pac-det-campo">
                <div className="pac-det-label">Grupo sanguíneo</div>
                {paciente.grupo_sanguineo
                  ? <span className="pac-badge-grupo" style={{ marginTop: 4 }}>{paciente.grupo_sanguineo}</span>
                  : <div className="pac-det-valor">—</div>
                }
              </div>
              <Campo label="Teléfono"           valor={p.telefono} />
              <Campo label="Correo electrónico" valor={p.correo_electronico} />
              {p.ruc_dv && <Campo label="RUC / DV" valor={p.ruc_dv} />}
              <Campo label="País"               valor={p.pais_detalle?.descripcion} />
              <Campo label="Departamento"       valor={p.departamento_detalle?.descripcion} />
              <Campo label="Ciudad"             valor={p.ciudad_detalle?.descripcion} />
            </div>
            {p.direccion && (
              <div style={{ marginTop: 12 }}>
                <Campo label="Dirección" valor={p.direccion} />
              </div>
            )}
          </Seccion>

          <Seccion titulo="Información médica">
            <CampoDestacado label="Alergias conocidas"    valor={paciente.alergias_conocidas}    variante="amarillo" />
            <CampoDestacado label="Enfermedades crónicas" valor={paciente.enfermedades_cronicas} variante="rojo" />
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
        </div>
      )}

      {tab === 'consultas' && (
        <div className="pac-tab-content">
          {loadConsultas ? (
            <div className="pac-tab-loading">Cargando consultas...</div>
          ) : (
            <>
              {consultas.length > 0 && especialidades.length > 0 && (
                <div className="pac-esp-filtro">
                  <select
                    value={espSelect}
                    onChange={e => setEspSelect(e.target.value)}
                    className="pac-esp-select"
                  >
                    <option value="">Todas las especialidades</option>
                    {especialidades.map(esp => (
                      <option key={esp} value={esp}>{esp}</option>
                    ))}
                  </select>
                </div>
              )}
              {consultasFiltradas.length === 0 ? (
                <div className="pac-tab-empty">
                  <ClipboardList size={28} />
                  <span>
                    {consultas.length === 0
                      ? 'Sin consultas registradas'
                      : 'Sin resultados para el filtro'}
                  </span>
                </div>
              ) : (
                <div className="pac-timeline">
                  {consultasFiltradas.map(c => <TimelineItem key={c.id} consulta={c} />)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'documentos' && (
        <div className="pac-tab-content">
          {loadDocs ? (
            <div className="pac-tab-loading">Cargando documentos...</div>
          ) : (
            <>
              <div className="pac-docs-header">
                <div className="pac-docs-filtros">
                  {[
                    { k: 'todos',        label: 'Todos' },
                    { k: 'por_consulta', label: 'Por consulta' },
                    { k: 'directo',      label: 'Subidos directo' },
                  ].map(f => (
                    <button
                      key={f.k}
                      className={`pac-docs-filtro-btn${docFiltro === f.k ? ' pac-docs-filtro-activo' : ''}`}
                      onClick={() => setDocFiltro(f.k)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="pac-docs-toggle">
                  <button
                    className={`pac-docs-toggle-btn${docVista === 'lista' ? ' pac-docs-toggle-activo' : ''}`}
                    onClick={() => setDocVista('lista')}
                    title="Vista lista"
                  >
                    <List size={14} />
                  </button>
                  <button
                    className={`pac-docs-toggle-btn${docVista === 'cuadricula' ? ' pac-docs-toggle-activo' : ''}`}
                    onClick={() => setDocVista('cuadricula')}
                    title="Vista cuadrícula"
                  >
                    <Grid size={14} />
                  </button>
                </div>
              </div>

              {docsFiltrados.length === 0 ? (
                <div className="pac-tab-empty">
                  <FolderOpen size={28} />
                  <span>Sin documentos</span>
                </div>
              ) : docVista === 'cuadricula' ? (
                <div className="pac-docs-grid">
                  {docsFiltrados.map(doc => {
                    const info = gridIconoInfo(doc.filename)
                    return (
                      <div
                        key={doc.id}
                        className="pac-docs-card"
                        onClick={() => handleVerDoc(doc)}
                        style={{ opacity: abriendoDoc === doc.id ? 0.6 : 1 }}
                        title={doc.filename}
                      >
                        <div
                          className="pac-docs-card-icon"
                          style={{ background: info.bg, color: info.color, border: `1px solid ${info.border}` }}
                        >
                          {info.label}
                        </div>
                        <div className="pac-docs-card-nombre">{doc.filename}</div>
                        <div className="pac-docs-card-tipo">{doc.tipo_doc_dig_descripcion || '—'}</div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="pac-docs-list">
                  {docsFiltrados.map(doc => {
                    const info = gridIconoInfo(doc.filename)
                    return (
                      <div className="pac-doc-item" key={doc.id}>
                        <div
                          className="pac-doc-icono-box"
                          style={{ background: info.bg, color: info.color, border: `1px solid ${info.border}` }}
                        >
                          {info.label}
                        </div>
                        <div className="pac-doc-info">
                          <div className="pac-doc-nombre" title={doc.filename}>{doc.filename}</div>
                          <div className="pac-doc-tipo">{doc.tipo_doc_dig_descripcion || '—'}</div>
                        </div>
                        <div className="pac-doc-fecha">{formatFecha(doc.fecha_creacion)}</div>
                        <button
                          className="pac-doc-ver-btn"
                          onClick={() => handleVerDoc(doc)}
                          disabled={abriendoDoc === doc.id}
                          title="Ver documento"
                        >
                          {abriendoDoc === doc.id ? '...' : <Eye size={14} />}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Página principal ── */

export default function PacientePage() {
  const [pacienteEdit,   setPacienteEdit]   = useState(null)
  const [modo,           setModo]           = useState(null)
  const [page,           setPage]           = useState(1)
  const [search,         setSearch]         = useState('')
  const [confirmId,      setConfirmId]      = useState(null)
  const [loadingListado, setLoadingListado] = useState(false)
  const [loadingExcel,   setLoadingExcel]   = useState(false)
  const debounceRef = useRef(null)

  const { user }        = useAuth()
  const puedeEliminar   = user?.rol === 'admin'
  const { guardAction } = useNavigationGuard()

  const { toast, showToast }         = useToast()
  const { data, isLoading, isError } = usePatients({ page, search })
  const { eliminar }                 = usePacienteMutations(showToast)

  useAtajosTeclado({
    'Insert': { fn: () => { if (modo === null) guardAction(() => { setPacienteEdit(null); setModo('crear') }) } },
  })

  const totalPages = data ? Math.ceil(data.count / 20) : 0

  const handleSearchChange = (e) => {
    const val = e.target.value
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setSearch(val); setPage(1) }, 300)
  }

  const handleVerDetalle = (paciente) => guardAction(() => { setPacienteEdit(paciente); setModo('ver') })
  const handleEditar     = (paciente) => guardAction(() => { setPacienteEdit(paciente); setModo('editar') })
  const handleClose      = ()         => guardAction(() => { setPacienteEdit(null); setModo(null) })
  const handleSuccess    = ()         => { setPacienteEdit(null); setModo(null); showToast('Paciente guardado correctamente.', 'success') }

  const handleVerListado = async () => {
    setLoadingListado(true)
    try {
      const res = await apiClient.get('/paciente/reporte-lista/', { params: { search }, responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch {
      showToast('No se pudo generar el listado.', 'error')
    } finally {
      setLoadingListado(false)
    }
  }

  const handleVerExcel = async () => {
    setLoadingExcel(true)
    try {
      const res = await apiClient.get('/paciente/reporte-lista-excel/', { params: { search }, responseType: 'blob' })
      const obj  = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const link = document.createElement('a')
      link.href     = obj
      link.download = `pacientes_${new Date().toISOString().slice(0, 10)}.xlsx`
      link.click()
      URL.revokeObjectURL(obj)
    } catch {
      showToast('No se pudo generar el Excel.', 'error')
    } finally {
      setLoadingExcel(false)
    }
  }

  const handleEliminar    = (id) => setConfirmId(id)
  const confirmarEliminar = ()   => eliminar.mutate(confirmId, {
    onSuccess: () => { setConfirmId(null); setPacienteEdit(null); setModo(null) },
  })

  return (
    <>
      <Toast toast={toast} />
      <ConfirmDialog
        isOpen={confirmId !== null}
        title="Eliminar paciente"
        description="¿Estás seguro? Si tiene citas activas no se podrá eliminar."
        loading={eliminar.isPending}
        onConfirm={confirmarEliminar}
        onCancel={() => setConfirmId(null)}
      />

      <style>{`
        .pac-root { font-family: 'DM Sans', sans-serif; }

        /* ── Modal mobile fullscreen ── */
        @media (max-width: 767px) {
          .modal-backdrop { padding: 0 !important; align-items: flex-end !important; }
          .modal-box { border-radius: 16px 16px 0 0 !important; max-height: 95dvh !important; max-width: 100% !important; }
        }
        @media (max-width: 479px) {
          .modal-backdrop { align-items: stretch !important; }
          .modal-box { border-radius: 0 !important; max-height: 100dvh !important; height: 100dvh !important; }
        }

        /* ── Toolbar ── */
        .pac-toolbar {
          display: flex; align-items: flex-start; gap: 12px;
          margin-bottom: 16px; flex-wrap: wrap;
        }
        .pac-titles  { flex: 1; min-width: 0; order: 1; }
        .pac-title   { font-size: 22px; font-weight: 600; color: #1a3a5c; margin-bottom: 2px; }
        .pac-subtitle { font-size: 13px; color: #6b7280; }

        .pac-search-wrap { position: relative; flex: 1 1 200px; max-width: 360px; order: 2; }
        .pac-search-icon {
          position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
          color: #9ca3af; pointer-events: none;
        }
        .pac-search-input {
          width: 100%; padding: 9px 12px 9px 34px; border: 1.5px solid #e5e7eb;
          border-radius: 9px; font-size: 13.5px; font-family: 'DM Sans', sans-serif;
          color: #111827; background: #fff; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .pac-search-input:focus { border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08); }
        .pac-search-input::placeholder { color: #d1d5db; }

        /* align-items: flex-start asegura que todos los botones se alineen por la parte superior */
        .pac-toolbar-actions { display: flex; align-items: flex-start; gap: 8px; order: 3; flex-shrink: 0; }

        .pac-btn-pdf {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 14px; background: #dc2626; border: none; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #fff;
          cursor: pointer; white-space: nowrap; font-weight: 500;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .pac-btn-pdf:hover:not(:disabled) { background: #b91c1c; box-shadow: 0 4px 12px rgba(220,38,38,0.2); }
        .pac-btn-pdf:disabled { opacity: 0.6; cursor: not-allowed; }

        .pac-btn-excel {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 14px; background: #16a34a; border: none; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #fff;
          cursor: pointer; white-space: nowrap; font-weight: 500;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .pac-btn-excel:hover:not(:disabled) { background: #15803d; box-shadow: 0 4px 12px rgba(22,163,74,0.2); }
        .pac-btn-excel:disabled { opacity: 0.6; cursor: not-allowed; }

        .pac-btn-nuevo-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .pac-btn-nuevo {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 16px; background: #1a3a5c; color: #fff;
          border: none; border-radius: 9px; font-size: 13.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; white-space: nowrap;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .pac-btn-nuevo:hover { background: #15304d; box-shadow: 0 4px 12px rgba(26,58,92,0.2); }
        .pac-btn-nuevo-hint { font-size: 10.5px; color: #9ca3af; white-space: nowrap; }

        @media (max-width: 600px) {
          .pac-search-wrap { order: 4; flex-basis: 100%; max-width: 100%; }
          .pac-titles { display: none; }
        }

        /* ── Tabla ── */
        .pac-table-card {
          background: #fff; border: 1px solid #e8edf2;
          border-radius: 12px; overflow: hidden;
        }
        .pac-table-wrap { overflow-x: auto; }
        .pac-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .pac-table thead { background: #f8fafc; border-bottom: 1px solid #e8edf2; }
        .pac-table th {
          text-align: left; padding: 11px 16px; font-size: 11px; font-weight: 600;
          letter-spacing: .05em; text-transform: uppercase; color: #9ca3af; white-space: nowrap;
        }
        .pac-table td {
          padding: 12px 16px; border-bottom: 1px solid #f3f4f6;
          color: #374151; vertical-align: middle;
        }
        .pac-table tbody tr:last-child td { border-bottom: none; }
        .pac-table tbody tr { cursor: pointer; transition: background 0.15s; }
        .pac-table tbody tr:nth-child(odd)  { background: #ffffff; }
        .pac-table tbody tr:nth-child(even) { background: #f8fafc; }
        .pac-table tbody tr:hover           { background: #f0f4f8 !important; }

        .pac-nombre-cell { display: flex; align-items: center; gap: 10px; }
        .pac-avatar {
          width: 32px; height: 32px; border-radius: 50%; background: #dbeafe;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 600; color: #1a3a5c; flex-shrink: 0;
        }
        .pac-nombre { font-weight: 500; color: #111827; }
        .pac-doc    { font-size: 12px; color: #9ca3af; margin-top: 1px; }
        .pac-hint   { font-size: 11.5px; color: #9ca3af; margin-top: 3px; font-style: italic; }

        .pac-telefono { font-size: 13px; color: #374151; }

        .pac-badge { display: inline-flex; align-items: center; font-size: 11px; font-weight: 500; padding: 3px 9px; border-radius: 20px; }
        .pac-badge-m { background: #dbeafe; color: #1a3a5c; }
        .pac-badge-f { background: #fce7f3; color: #9d174d; }
        .pac-badge-o { background: #f3f4f6; color: #6b7280; }
        .pac-badge-grupo {
          display: inline-flex; align-items: center;
          background: #fee2e2; color: #dc2626;
          font-size: 11px; font-weight: 700;
          padding: 2px 9px; border-radius: 20px;
        }

        .pac-actions { display: flex; align-items: center; gap: 6px; }
        .pac-action-btn {
          width: 30px; height: 30px; border-radius: 7px; border: 1px solid #e8edf2;
          background: none; cursor: pointer; color: #6b7280;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .pac-action-btn.edit:hover  { background: #eff6ff; color: #1a3a5c; border-color: #bfdbfe; }
        .pac-action-btn.trash:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }

        @media (max-width: 640px) {
          .pac-col-grupo { display: none; }
          .pac-table th, .pac-table td { padding: 10px 10px; }
          .pac-nombre { font-size: 13px; }
          .pac-doc    { font-size: 11.5px; }
          .pac-hint   { display: none; }
        }
        @media (max-width: 480px) {
          .pac-title    { font-size: 18px; }
          .pac-subtitle { display: none; }
          .pac-toolbar-actions { gap: 4px; }
          .pac-btn-pdf   { padding: 8px 10px; font-size: 12px; }
          .pac-btn-excel { padding: 8px 10px; font-size: 12px; }
          .pac-btn-nuevo { padding: 8px 12px; font-size: 12.5px; }
          .pac-btn-nuevo-hint { display: none; }
        }

        .pac-empty { text-align: center; padding: 48px 16px; color: #9ca3af; font-size: 13.5px; }
        .pac-empty-icon {
          width: 40px; height: 40px; margin: 0 auto 12px; background: #f3f4f6;
          border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #d1d5db;
        }
        .pac-empty-title { font-weight: 500; color: #6b7280; margin-bottom: 4px; }

        .pac-pagination {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; border-top: 1px solid #e8edf2;
          font-size: 13px; color: #6b7280; flex-wrap: wrap; gap: 8px;
        }
        .pac-pag-btns { display: flex; align-items: center; gap: 6px; }
        .pac-pag-btn {
          width: 30px; height: 30px; border-radius: 7px; border: 1px solid #e8edf2;
          background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center;
          color: #374151; transition: background 0.15s;
        }
        .pac-pag-btn:hover:not(:disabled) { background: #f0f4f8; }
        .pac-pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Vista de detalle ── */
        .pac-det-root { font-family: 'DM Sans', sans-serif; }

        .pac-det-cabecera {
          display: flex; align-items: center; gap: 14px;
          margin: -24px -24px 16px;
          padding: 20px 24px 16px;
          border-bottom: 1px solid #e8edf2;
          flex-wrap: wrap;
          position: sticky;
          top: -24px;
          z-index: 5;
          background: #fff;
        }
        .pac-det-avatar {
          width: 56px; height: 56px; border-radius: 50%; background: #dbeafe;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 600; color: #1a3a5c; flex-shrink: 0;
        }
        .pac-det-cabecera-info { flex: 1; min-width: 0; }
        .pac-det-nombre    { font-size: 17px; font-weight: 600; color: #111827; }
        .pac-det-documento { font-size: 13px; color: #6b7280; margin-top: 3px; }

        .pac-det-btn-editar {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 8px 16px; background: #1a3a5c; color: #fff; border: none;
          border-radius: 9px; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s; flex-shrink: 0;
        }
        .pac-det-btn-editar:hover { background: #15304d; box-shadow: 0 4px 12px rgba(26,58,92,0.2); }

        /* ── Pestañas ── */
        .pac-tabs {
          display: flex; gap: 4px; margin-bottom: 16px;
          border-bottom: 1px solid #e8edf2; overflow-x: auto;
          scrollbar-width: none;
        }
        .pac-tabs::-webkit-scrollbar { display: none; }
        .pac-tab-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 14px; border: none; background: none; cursor: pointer;
          font-size: 13px; font-weight: 500; color: #6b7280;
          font-family: 'DM Sans', sans-serif; white-space: nowrap;
          border-bottom: 2px solid transparent; margin-bottom: -1px;
          transition: color 0.15s, border-color 0.15s;
        }
        .pac-tab-btn:hover  { color: #1a3a5c; }
        .pac-tab-activo { color: #1a3a5c !important; border-bottom-color: #1a3a5c !important; }

        .pac-tab-content { padding-bottom: 4px; }
        .pac-tab-loading, .pac-tab-empty {
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          padding: 40px 16px; color: #9ca3af; font-size: 13.5px; text-align: center;
        }

        /* Secciones */
        .pac-det-card {
          border: 1px solid #e8edf2; border-radius: 10px;
          padding: 14px 16px; margin-bottom: 12px; background: #fafbfc;
        }
        .pac-det-card-titulo {
          font-size: 10.5px; font-weight: 600; letter-spacing: .07em;
          text-transform: uppercase; color: #9ca3af; margin-bottom: 12px;
        }
        .pac-det-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 16px;
        }
        .pac-det-label {
          font-size: 10.5px; font-weight: 500; color: #9ca3af;
          text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2px;
        }
        .pac-det-valor { font-size: 13.5px; color: #111827; line-height: 1.4; }

        .pac-det-campo-destacado {
          border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; border-left: 3px solid transparent;
        }
        .pac-det-campo-amarillo { background: #fefce8; border-left-color: #ca8a04; }
        .pac-det-campo-rojo     { background: #fff5f5; border-left-color: #f87171; }
        .pac-det-label-dest {
          font-size: 10.5px; font-weight: 600; text-transform: uppercase;
          letter-spacing: .04em; margin-bottom: 4px;
        }
        .pac-det-campo-amarillo .pac-det-label-dest { color: #92400e; }
        .pac-det-campo-rojo     .pac-det-label-dest { color: #991b1b; }
        .pac-det-valor-dest { font-size: 13.5px; line-height: 1.5; white-space: pre-wrap; }
        .pac-det-campo-amarillo .pac-det-valor-dest { color: #78350f; }
        .pac-det-campo-rojo     .pac-det-valor-dest { color: #7f1d1d; }

        /* ── Filtro especialidad ── */
        .pac-esp-filtro { margin-bottom: 14px; }
        .pac-esp-select {
          width: 100%; padding: 9px 12px; border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13px; font-family: 'DM Sans', sans-serif; color: #111827;
          background: #fff; outline: none; transition: border-color 0.2s; cursor: pointer;
        }
        .pac-esp-select:focus { border-color: #1a3a5c; }

        /* ── Timeline desplegable ── */
        .pac-timeline { display: flex; flex-direction: column; }
        .pac-tl-item  { display: flex; gap: 12px; }
        .pac-tl-left  {
          display: flex; flex-direction: column; align-items: center;
          flex-shrink: 0; width: 18px;
        }
        .pac-tl-dot {
          width: 10px; height: 10px; border-radius: 50%;
          background: #1a3a5c; border: 2px solid #fff;
          box-shadow: 0 0 0 2px #1a3a5c;
          flex-shrink: 0; margin-top: 14px;
          transition: background 0.2s, box-shadow 0.2s;
        }
        .pac-tl-dot-abierto {
          background: #3b82f6;
          box-shadow: 0 0 0 2px #3b82f6;
        }
        .pac-tl-line {
          flex: 1; width: 2px; background: #e8edf2; margin-top: 4px; min-height: 8px;
        }
        .pac-tl-item:last-child .pac-tl-line { display: none; }
        .pac-tl-body  { flex: 1; padding-bottom: 10px; min-width: 0; }

        /* Card colapsable */
        .pac-tl-card {
          border: 1px solid #e8edf2; border-radius: 10px;
          background: #fff; overflow: hidden;
          transition: border-color 0.15s;
          margin-bottom: 2px;
        }
        .pac-tl-card-open { border-color: #bfdbfe; }
        .pac-tl-card-clickable .pac-tl-card-top:hover { background: #f8fafc; }
        .pac-tl-card-top {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 8px; padding: 10px 14px;
          transition: background 0.12s;
        }
        .pac-tl-card-clickable .pac-tl-card-top { cursor: pointer; }
        .pac-tl-card-head { flex: 1; min-width: 0; }
        .pac-tl-head-row {
          display: flex; align-items: center; gap: 8px;
          flex-wrap: wrap; margin-bottom: 4px;
        }
        .pac-tl-fecha    { font-size: 12px; color: #6b7280; font-weight: 500; flex-shrink: 0; }
        .pac-tl-evtclin  { font-size: 12px; color: #9ca3af; }
        .pac-tl-sub      { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .pac-tl-medico   { font-size: 13px; color: #374151; font-weight: 500; }
        .pac-tl-esp-badge {
          font-size: 11px; background: #eff6ff; color: #1d4ed8;
          padding: 2px 8px; border-radius: 20px; border: 1px solid #bfdbfe;
        }
        .pac-tl-chevron-icon { color: #9ca3af; flex-shrink: 0; margin-top: 2px; }

        .pac-tl-card-body {
          border-top: 1px solid #f0f4f8;
          padding: 10px 14px 12px; background: #fafbfc;
        }
        .pac-tl-campo    { margin-bottom: 8px; }
        .pac-tl-campo:last-child { margin-bottom: 0; }
        .pac-tl-label    {
          display: block; font-size: 10.5px; font-weight: 600;
          text-transform: uppercase; letter-spacing: .04em;
          color: #9ca3af; margin-bottom: 2px;
        }
        .pac-tl-valor    {
          margin: 0; font-size: 13px; color: #111827;
          white-space: pre-wrap; line-height: 1.5;
        }

        @media (max-width: 480px) {
          .pac-tl-card-top { padding: 9px 12px; }
          .pac-tl-fecha { font-size: 11px; }
          .pac-tl-medico { font-size: 12px; }
          .pac-tl-valor { font-size: 12.5px; }
        }

        /* Docs en timeline */
        .pac-tl-docs {
          margin-top: 10px; padding-top: 10px;
          border-top: 1px dashed #e8edf2;
        }
        .pac-tl-docs-titulo {
          font-size: 10px; font-weight: 600; text-transform: uppercase;
          letter-spacing: .06em; color: #9ca3af; margin-bottom: 6px;
        }
        .pac-tl-doc-row {
          display: flex; align-items: center; gap: 8px;
          padding: 5px 0; border-bottom: 1px solid #f3f4f6;
        }
        .pac-tl-doc-row:last-child { border-bottom: none; }
        .pac-tl-doc-icono {
          width: 26px; height: 26px; border-radius: 5px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 9px; font-weight: 700;
        }
        .pac-tl-doc-nombre {
          flex: 1; font-size: 12px; color: #374151; font-weight: 500;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
        }
        .pac-tl-doc-tipo {
          font-size: 10.5px; color: #9ca3af; flex-shrink: 0; white-space: nowrap;
        }
        .pac-tl-doc-btn {
          width: 24px; height: 24px; border-radius: 6px; border: 1px solid #e8edf2;
          background: none; cursor: pointer; color: #6b7280; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .pac-tl-doc-btn:hover:not(:disabled) { background: #eff6ff; color: #1a3a5c; border-color: #bfdbfe; }
        .pac-tl-doc-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Documentos tab ── */
        .pac-docs-header {
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px; margin-bottom: 12px; flex-wrap: wrap;
        }
        .pac-docs-filtros { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .pac-docs-filtro-btn {
          padding: 5px 12px; border: 1.5px solid #e5e7eb; border-radius: 20px;
          background: #fff; font-size: 12px; font-family: 'DM Sans', sans-serif;
          color: #374151; cursor: pointer; transition: all 0.15s;
        }
        .pac-docs-filtro-btn:hover { border-color: #1a3a5c; color: #1a3a5c; }
        .pac-docs-filtro-activo    { background: #1a3a5c; color: #fff !important; border-color: #1a3a5c !important; }

        .pac-docs-toggle { display: flex; gap: 2px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .pac-docs-toggle-btn {
          width: 30px; height: 30px; border: none; background: #fff;
          cursor: pointer; color: #9ca3af;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .pac-docs-toggle-btn:hover       { background: #f0f4f8; color: #1a3a5c; }
        .pac-docs-toggle-activo          { background: #f0f4f8; color: #1a3a5c; }

        /* Lista */
        .pac-docs-list { display: flex; flex-direction: column; gap: 6px; }
        .pac-doc-item {
          border: 1px solid #e8edf2; border-radius: 9px; padding: 10px 14px;
          background: #fff; display: flex; align-items: center; gap: 12px;
        }
        .pac-doc-icono-box {
          width: 36px; height: 36px; border-radius: 7px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700;
        }
        .pac-doc-info  { flex: 1; min-width: 0; }
        .pac-doc-nombre {
          font-size: 13px; font-weight: 500; color: #111827;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pac-doc-tipo  { font-size: 11.5px; color: #9ca3af; margin-top: 2px; }
        .pac-doc-fecha { font-size: 12px; color: #6b7280; flex-shrink: 0; }
        .pac-doc-ver-btn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 7px; border: 1px solid #e8edf2;
          background: none; cursor: pointer; color: #6b7280;
          transition: background 0.15s, color 0.15s, border-color 0.15s; flex-shrink: 0;
        }
        .pac-doc-ver-btn:hover:not(:disabled) { background: #eff6ff; color: #1a3a5c; border-color: #bfdbfe; }
        .pac-doc-ver-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Cuadrícula — altura fija para uniformidad */
        .pac-docs-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          grid-auto-rows: 118px;
          gap: 10px;
        }
        .pac-docs-card {
          border: 1px solid #e8edf2; border-radius: 10px;
          padding: 12px 8px; background: #fff; cursor: pointer;
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 6px;
          transition: border-color 0.15s, box-shadow 0.15s;
          text-align: center; overflow: hidden;
        }
        .pac-docs-card:hover { border-color: #bfdbfe; box-shadow: 0 2px 10px rgba(26,58,92,0.1); }
        .pac-docs-card-icon {
          width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700;
        }
        .pac-docs-card-nombre {
          font-size: 11px; font-weight: 500; color: #111827;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          max-width: 100%; width: 100%;
        }
        .pac-docs-card-tipo {
          font-size: 10px; color: #9ca3af;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          max-width: 100%; width: 100%;
        }

        @media (max-width: 640px) {
          .pac-docs-grid { grid-template-columns: repeat(2, 1fr); grid-auto-rows: 110px; }
          .pac-docs-filtro-btn { font-size: 11px; padding: 4px 10px; }
        }
        @media (max-width: 480px) {
          .pac-doc-fecha { display: none; }
        }

        /* ── Overlay imagen ── */
        .pac-img-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.82); z-index: 9999;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .pac-img-preview {
          max-width: 90vw; max-height: 90vh; border-radius: 8px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.5); cursor: default;
        }
        .pac-img-close {
          position: absolute; top: 16px; right: 16px;
          background: rgba(255,255,255,0.15); border: none; color: #fff;
          font-size: 18px; cursor: pointer; width: 36px; height: 36px;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .pac-img-close:hover { background: rgba(255,255,255,0.3); }

        /* ── Mobile detalle ── */
        @media (max-width: 640px) {
          .pac-det-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .pac-det-nombre { font-size: 15px; }
          .pac-det-btn-editar { padding: 6px 12px; font-size: 12px; }
          .pac-tab-btn { padding: 8px 10px; font-size: 12px; gap: 4px; }
          .pac-det-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="pac-root">
        <div className="pac-toolbar">
          <div className="pac-titles">
            <div className="pac-title">Pacientes</div>
            <div className="pac-subtitle">
              {data?.count !== undefined ? `${data.count} pacientes registrados` : 'Gestión de pacientes'}
            </div>
          </div>

          <div className="pac-search-wrap">
            <Search size={15} className="pac-search-icon" />
            <input
              type="text"
              placeholder="Buscar por nombre o documento..."
              onChange={handleSearchChange}
              className="pac-search-input"
            />
          </div>

          <div className="pac-toolbar-actions">
            <button
              className="pac-btn-pdf"
              onClick={handleVerListado}
              disabled={loadingListado}
              title="Exportar a PDF"
            >
              <FileText size={14} />
              {loadingListado ? 'Generando...' : 'PDF'}
            </button>
            <button
              className="pac-btn-excel"
              onClick={handleVerExcel}
              disabled={loadingExcel}
              title="Exportar a Excel"
            >
              <Download size={14} />
              {loadingExcel ? 'Generando...' : 'Excel'}
            </button>
            <div className="pac-btn-nuevo-wrap">
              <button
                className="pac-btn-nuevo"
                onClick={() => guardAction(() => { setPacienteEdit(null); setModo('crear') })}
              >
                <Plus size={15} /> Nuevo paciente
              </button>
              <span className="pac-btn-nuevo-hint">Presioná Ins para nuevo paciente</span>
            </div>
          </div>
        </div>

        <div className="pac-table-card">
          <div className="pac-table-wrap">
            <table className="pac-table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th><Phone size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Teléfono</th>
                  <th>Fecha nac.</th>
                  <th>Sexo</th>
                  <th className="pac-col-grupo">Grupo</th>
                  <th style={{ width: puedeEliminar ? '80px' : '52px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="pac-empty">
                      <div className="pac-empty-icon"><Users size={18} /></div>
                      Cargando pacientes...
                    </td>
                  </tr>
                )}
                {isError && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#dc2626', fontSize: '13.5px' }}>
                      Error al cargar los pacientes. Intentá de nuevo.
                    </td>
                  </tr>
                )}
                {!isLoading && !isError && data?.results?.length === 0 && (
                  <tr>
                    <td colSpan={6}>
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
                  const telefono = paciente.persona_detalle?.telefono || '—'
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
                      <td><span className="pac-telefono">{telefono}</span></td>
                      <td>{formatFecha(paciente.fecha_nacimiento)}</td>
                      <td>
                        <span className={`pac-badge ${
                          paciente.sexo === 'M' ? 'pac-badge-m'
                          : paciente.sexo === 'F' ? 'pac-badge-f'
                          : 'pac-badge-o'
                        }`}>
                          {SEXO_LABEL[paciente.sexo] || '—'}
                        </span>
                      </td>
                      <td className="pac-col-grupo">
                        {paciente.grupo_sanguineo
                          ? <span className="pac-badge-grupo">{paciente.grupo_sanguineo}</span>
                          : '—'}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="pac-actions">
                          <button
                            className="pac-action-btn edit"
                            onClick={() => handleEditar(paciente)}
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          {puedeEliminar && (
                            <button
                              className="pac-action-btn trash"
                              onClick={() => handleEliminar(paciente.id)}
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
