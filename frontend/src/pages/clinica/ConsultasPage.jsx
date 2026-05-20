import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Stethoscope, CheckCircle2,
  Upload, X, FileText, Download, Trash2,
  RefreshCw, Search, AlertTriangle, ChevronDown, ChevronUp, ClipboardList, Eye, Pencil,
} from 'lucide-react'
import Modal from '../../components/ui/Modal'
import apiClient from '../../api/client'
import { extraerMensajeError } from '../../utils/errores'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Toast from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../context/AuthContext'
import { usePersonasRRHH } from '../../hooks/administracion/usePersonaRRHH'
import { useAgendaDia, useAgendaDiaGlobal } from '../../hooks/clinica/useAgenda'
import {
  useConsultasDelDia, useConsultasHoy,
  useConsultasPaciente, useIniciarConsulta, useFinalizarConsulta,
  useAnularConsulta, useUpdateConsulta, useCrearConsulta,
} from '../../hooks/clinica/useConsultas'
import { useDocumentosPorConsulta, useSubirDocumento, useDeleteDocumento } from '../../hooks/mantenimiento/useDocumentos'
import { useEventosClinicos } from '../../hooks/mantenimiento/useEventosClinicos'
import { useTipoDocDig } from '../../hooks/mantenimiento/useTipoDocDig'

function fechaLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatFecha(fechaStr) {
  if (!fechaStr) return '—'
  const parts = fechaStr.split('-')
  if (parts.length !== 3) return fechaStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

const ESTADO_CONSULTA_MAP = {
  en_espera:   { label: 'En espera',   cls: 'badge-warning' },
  en_consulta: { label: 'En consulta', cls: 'badge-info' },
  finalizada:  { label: 'Finalizada',  cls: 'badge-success' },
  anulada:     { label: 'Anulada',     cls: 'badge-danger' },
  pendiente:   { label: 'Pendiente',   cls: 'badge-gray' },
}

const EXTENSIONES_IMAGEN = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']

const CAMPOS_REQ_CONSULTA = [
  { key: 'motivo_consulta', label: 'Motivo de consulta' },
  { key: 'diagnostico',     label: 'Diagnóstico' },
  { key: 'tratamiento',     label: 'Tratamiento' },
  { key: 'indicaciones',    label: 'Indicaciones' },
]

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

function gridIconoInfo(filename) {
  const ext = filename?.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return { label: 'PDF', bg: '#fee2e2', color: '#dc2626' }
  if (EXTENSIONES_IMAGEN.includes(ext)) return { label: ext?.toUpperCase() || 'IMG', bg: '#eff6ff', color: '#1d4ed8' }
  if (['docx', 'doc'].includes(ext)) return { label: 'DOC', bg: '#f0fdf4', color: '#16a34a' }
  if (['xlsx', 'xls'].includes(ext)) return { label: 'XLS', bg: '#f0fdf4', color: '#16a34a' }
  return { label: '—', bg: '#f9fafb', color: '#6b7280' }
}

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null
  const hoy = new Date()
  const nac = new Date(fechaNacimiento)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

function tiempoTranscurrido(horaDesde) {
  if (!horaDesde) return null
  const hoy = new Date().toISOString().slice(0, 10)
  const inicio = new Date(`${hoy}T${horaDesde}`)
  const diffMs = Date.now() - inicio.getTime()
  return Math.max(0, Math.floor(diffMs / 60000))
}

function formatHora(h) {
  if (!h) return '—'
  return h.slice(0, 5)
}

function iniciales(nombre) {
  if (!nombre) return '??'
  return nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function dentroDelLimite24h(consulta) {
  if (!consulta?.fecha_modificacion) return false
  const limite = new Date(consulta.fecha_modificacion).getTime() + 24 * 60 * 60 * 1000
  return Date.now() < limite
}

function tiempoRestante(consulta) {
  if (!consulta?.fecha_modificacion) return null
  const limite = new Date(consulta.fecha_modificacion).getTime() + 24 * 60 * 60 * 1000
  const ms = limite - Date.now()
  if (ms <= 0) return null
  const horas = Math.floor(ms / (60 * 60 * 1000))
  const mins  = Math.floor((ms % (60 * 60 * 1000)) / 60000)
  if (horas > 0) return `${horas}h ${mins}m`
  return `${mins} minutos`
}

function badgeEstado(estado) {
  const map = {
    en_espera:   { label: 'En espera',   cls: 'cs-badge-espera' },
    en_consulta: { label: 'En consulta', cls: 'cs-badge-consulta' },
    finalizada:  { label: 'Finalizada',  cls: 'cs-badge-finalizada' },
    anulada:     { label: 'Anulada',     cls: 'cs-badge-anulada' },
  }
  return map[estado] || { label: estado, cls: '' }
}

function Ticker({ horaDesde, conUrgencia = false }) {
  const [mins, setMins] = useState(() => tiempoTranscurrido(horaDesde))
  useEffect(() => {
    const iv = setInterval(() => setMins(tiempoTranscurrido(horaDesde)), 10_000)
    return () => clearInterval(iv)
  }, [horaDesde])
  if (mins === null) return null

  if (!conUrgencia) return <span className="cs-ticker">{mins} min</span>

  let tickBg, tickColor
  if (mins < 15)       { tickBg = '#dcfce7'; tickColor = '#16a34a' }
  else if (mins <= 30) { tickBg = '#fef9c3'; tickColor = '#ca8a04' }
  else                 { tickBg = '#fee2e2'; tickColor = '#dc2626' }

  return <span className="cs-ticker" style={{ background: tickBg, color: tickColor }}>{mins} min</span>
}

function TextareaConContador({ value, onChange, rows = 3, placeholder, invalido = false, disabled = false }) {
  return (
    <div className="cs-textarea-wrap">
      <textarea
        className={`input cs-textarea${invalido ? ' cs-input-invalido' : ''}`}
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
      />
      <span className="cs-char-counter">{value?.length || 0}</span>
    </div>
  )
}

function SelectorFecha({ valor, onChange }) {
  const hoy = fechaLocal()
  return (
    <div className="cs-date-row">
      <input
        type="date"
        className="cs-date-input"
        value={valor}
        onChange={e => onChange(e.target.value)}
      />
      {valor !== hoy && (
        <span className="cs-fecha-badge">📅 Viendo: {formatFecha(valor)}</span>
      )}
      {valor !== hoy && (
        <button className="cs-volver-hoy" type="button" onClick={() => onChange(hoy)}>
          Volver a hoy
        </button>
      )}
    </div>
  )
}

function TimelineConsulta({ consulta }) {
  const [expandido, setExpandido] = useState(false)
  const [abriendoDoc, setAbriendoDoc] = useState(null)

  const { data: docsData } = useDocumentosPorConsulta(consulta.id)
  const docs = Array.isArray(docsData) ? docsData : (docsData?.results || [])

  const estado = ESTADO_CONSULTA_MAP[consulta.estado] || { label: consulta.estado, cls: 'badge-gray' }
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
    <div className="cs-tl-item">
      <div className="cs-tl-left">
        <div className={`cs-tl-dot${expandido ? ' cs-tl-dot-open' : ''}`} />
        <div className="cs-tl-line" />
      </div>
      <div className="cs-tl-body">
        <div className={`cs-tl-card${expandido ? ' cs-tl-card-open' : ''}${tieneDetalle ? ' cs-tl-card-click' : ''}`}>
          <div
            className="cs-tl-card-top"
            onClick={() => tieneDetalle && setExpandido(v => !v)}
          >
            <div className="cs-tl-card-head">
              <div className="cs-tl-head-row">
                <span className="cs-tl-fecha">{formatFecha(consulta.agenda_detalle?.fecha)}</span>
                <span className={`badge ${estado.cls}`}>{estado.label}</span>
                {consulta.evento_clinico_nombre && (
                  <span className="cs-tl-evtclin">{consulta.evento_clinico_nombre}</span>
                )}
              </div>
              {(consulta.medico_nombre || consulta.especialidad_nombre) && (
                <div className="cs-tl-sub">
                  {consulta.medico_nombre && (
                    <span className="cs-tl-medico">{consulta.medico_nombre}</span>
                  )}
                  {consulta.especialidad_nombre && (
                    <span className="cs-tl-esp-badge">{consulta.especialidad_nombre}</span>
                  )}
                </div>
              )}
            </div>
            {tieneDetalle && (
              <div className="cs-tl-chevron">
                {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            )}
          </div>

          {expandido && (
            <div className="cs-tl-card-body">
              {consulta.motivo_consulta && (
                <div className="cs-tl-campo">
                  <span className="cs-tl-label">Motivo</span>
                  <p className="cs-tl-valor">{consulta.motivo_consulta}</p>
                </div>
              )}
              {consulta.diagnostico && (
                <div className="cs-tl-campo">
                  <span className="cs-tl-label">Diagnóstico</span>
                  <p className="cs-tl-valor">{consulta.diagnostico}</p>
                </div>
              )}
              {consulta.tratamiento && (
                <div className="cs-tl-campo">
                  <span className="cs-tl-label">Tratamiento</span>
                  <p className="cs-tl-valor">{consulta.tratamiento}</p>
                </div>
              )}
              {docs.length > 0 && (
                <div className="cs-tl-docs">
                  <div className="cs-tl-docs-titulo">Documentos</div>
                  {docs.map(doc => {
                    const info = gridIconoInfo(doc.filename || '')
                    return (
                      <div key={doc.id} className="cs-tl-doc-row">
                        <div className="cs-tl-doc-icono" style={{ background: info.bg, color: info.color }}>
                          {info.label}
                        </div>
                        <span className="cs-tl-doc-nombre" title={doc.filename}>
                          {doc.filename || `Documento #${doc.id}`}
                        </span>
                        {doc.tipo_doc_dig_descripcion && (
                          <span className="cs-tl-doc-tipo">{doc.tipo_doc_dig_descripcion}</span>
                        )}
                        <button
                          className="cs-tl-doc-btn"
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

function ModalHistoriaClinica({ paciente, especialidadFiltro, medicoNombre, onClose }) {
  const [espSelect, setEspSelect] = useState(especialidadFiltro || '')
  const { data: consultasData, isLoading } = useConsultasPaciente(paciente?.id)
  const todasConsultas = consultasData?.results || consultasData || []

  const consultasMedico = medicoNombre
    ? todasConsultas.filter(c => c.medico_nombre === medicoNombre)
    : todasConsultas

  const especialidades = [...new Set(
    consultasMedico.map(c => c.especialidad_nombre).filter(Boolean)
  )].sort()

  const consultasFiltradas = espSelect
    ? consultasMedico.filter(c => c.especialidad_nombre === espSelect)
    : consultasMedico

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Historia clínica — ${paciente?.nombre || ''}`}
      size="lg"
    >
      <div className="cs-historia-content">
        {consultasMedico.length > 0 && especialidades.length > 0 && (
          <div className="cs-esp-filtro">
            <select
              className="input"
              value={espSelect}
              onChange={e => setEspSelect(e.target.value)}
            >
              <option value="">Todas las especialidades</option>
              {especialidades.map(esp => (
                <option key={esp} value={esp}>{esp}</option>
              ))}
            </select>
          </div>
        )}
        {isLoading ? (
          <div className="cs-historia-empty">Cargando consultas…</div>
        ) : consultasFiltradas.length === 0 ? (
          <div className="cs-historia-empty">Sin consultas para mostrar.</div>
        ) : (
          <div className="cs-tl-list">
            {consultasFiltradas.map(c => <TimelineConsulta key={c.id} consulta={c} />)}
          </div>
        )}
      </div>
    </Modal>
  )
}

function PanelDocumentos({ consultaId, pacienteId, tiposDocDig, showToast }) {
  const { data: docsData, isLoading } = useDocumentosPorConsulta(consultaId)
  const subirDoc  = useSubirDocumento()
  const deleteDoc = useDeleteDocumento()
  const [dragging, setDragging] = useState(false)
  const [tipoSeleccionado, setTipoSeleccionado] = useState('')
  const [confirmDocId, setConfirmDocId] = useState(null)
  const [abriendoDoc,   setAbriendoDoc]   = useState(null)
  const [imagenPreview, setImagenPreview] = useState(null)
  const inputRef = useRef()

  const handleVerDoc = async (doc) => {
    setAbriendoDoc(doc.id)
    try {
      const blob = await fetchDocumentoBlob(doc.id)
      const url  = URL.createObjectURL(blob)
      const ext  = (doc.filename || '').split('.').pop().toLowerCase()
      if (EXTENSIONES_IMAGEN.includes(ext)) setImagenPreview({ url, filename: doc.filename })
      else window.open(url, '_blank')
    } catch { /* silencioso */ }
    finally { setAbriendoDoc(null) }
  }

  const documentos = docsData?.results || docsData || []

  const handleUpload = async (file) => {
    if (!tipoSeleccionado) {
      showToast('Seleccioná un tipo de documento antes de subir.', 'warning')
      return
    }
    const fd = new FormData()
    fd.append('archivo', file)
    fd.append('paciente', pacienteId)
    fd.append('tipo_doc_dig', tipoSeleccionado)
    fd.append('consulta', consultaId)
    if (inputRef.current) inputRef.current.value = ''
    try {
      await subirDoc.mutateAsync(fd)
      showToast('Documento subido correctamente.', 'success')
    } catch (e) {
      showToast(extraerMensajeError(e), 'error')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  const handleEliminarConfirmado = async () => {
    try {
      await deleteDoc.mutateAsync(confirmDocId)
      showToast('Documento eliminado.', 'success')
      setConfirmDocId(null)
    } catch (e) {
      showToast(extraerMensajeError(e), 'error')
    }
  }

  const handleDescargar = async (doc) => {
    try {
      const res = await apiClient.get(`/documentos/${doc.id}/descargar/`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a   = document.createElement('a')
      a.href     = url
      a.download = doc.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showToast('No se pudo descargar el documento.', 'error')
    }
  }

  return (
    <div className="cs-docs-panel">
      <div className="cs-docs-header">
        <FileText size={15} />
        <span>Documentos de la consulta</span>
        <span className="cs-docs-count">{documentos.length}</span>
      </div>

      <div className="cs-docs-tipo">
        <select
          className="input"
          value={tipoSeleccionado}
          onChange={e => setTipoSeleccionado(e.target.value)}
        >
          <option value="">Seleccioná tipo de documento…</option>
          {(tiposDocDig || []).map(t => (
            <option key={t.id} value={t.id}>{t.descripcion}</option>
          ))}
        </select>
      </div>

      <div
        className={`cs-dropzone ${dragging ? 'cs-dropzone-active' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={20} style={{ opacity: 0.5 }} />
        <span>Arrastrá un archivo o hacé click para seleccionar</span>
        <span style={{ fontSize: 11, opacity: 0.5 }}>PDF, JPG, JPEG, PNG</span>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) handleUpload(e.target.files[0]) }}
        />
      </div>

      {isLoading ? (
        <div className="cs-docs-empty">Cargando…</div>
      ) : documentos.length === 0 ? (
        <div className="cs-docs-empty">No hay documentos para esta consulta.</div>
      ) : (
        <div className="cs-docs-list">
          {documentos.map(doc => (
            <div key={doc.id} className="cs-doc-item">
              <FileText size={14} style={{ color: '#6b7280', flexShrink: 0 }} />
              <div className="cs-doc-info">
                <div className="cs-doc-nombre">{doc.filename}</div>
                <div className="cs-doc-tipo">{doc.tipo_doc_dig_descripcion}</div>
              </div>
              <div className="cs-doc-actions">
                <button className="cs-doc-btn" onClick={() => handleVerDoc(doc)} disabled={abriendoDoc === doc.id} title="Ver">
                  {abriendoDoc === doc.id ? '…' : <Eye size={13} />}
                </button>
                <button className="cs-doc-btn" onClick={() => handleDescargar(doc)} title="Descargar">
                  <Download size={13} />
                </button>
                <button className="cs-doc-btn cs-doc-btn-danger" onClick={() => setConfirmDocId(doc.id)} title="Eliminar">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDocId}
        title="Eliminar documento"
        description="¿Eliminar este documento? Esta acción no se puede deshacer."
        onConfirm={handleEliminarConfirmado}
        onCancel={() => setConfirmDocId(null)}
        loading={deleteDoc.isPending}
      />

      {imagenPreview && (
        <div className="cs-img-overlay" onClick={() => setImagenPreview(null)}>
          <button className="cs-img-close" onClick={e => { e.stopPropagation(); setImagenPreview(null) }}>✕</button>
          <img
            src={imagenPreview.url}
            alt={imagenPreview.filename}
            className="cs-img-preview"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

function PanelConsultaActiva({ consulta, onFinalizar, tiposDocDig, eventosClinicos, showToast }) {
  const updateConsulta    = useUpdateConsulta()
  const finalizarConsulta = useFinalizarConsulta()
  const anularConsulta    = useAnularConsulta()
  const hoy = fechaLocal()

  const esFinalizada    = consulta?.estado === 'finalizada'
  const esAnulada       = consulta?.estado === 'anulada'
  const esCerrada       = esFinalizada || esAnulada
  const puedeEditarAun  = esCerrada && dentroDelLimite24h(consulta)

  const [form, setForm] = useState({
    evento_clinico:  consulta?.evento_clinico  || '',
    proxima_cita:    consulta?.proxima_cita    || '',
    motivo_consulta: consulta?.motivo_consulta || '',
    diagnostico:     consulta?.diagnostico     || '',
    tratamiento:     consulta?.tratamiento     || '',
    indicaciones:    consulta?.indicaciones    || '',
  })
  const [finalizando, setFinalizando]               = useState(false)
  const [anulando, setAnulando]                     = useState(false)
  const [savingFinalizada, setSavingFinalizada]     = useState(false)
  const [confirmFinalizar, setConfirmFinalizar]     = useState(false)
  const [confirmAnular, setConfirmAnular]           = useState(false)
  const [intentoFinalizar, setIntentoFinalizar]     = useState(false)
  const [acordeonAbierto, setAcordeonAbierto]       = useState(false)
  const [modalHistoria, setModalHistoria]           = useState(false)
  const autoSaveRef = useRef(null)

  useEffect(() => {
    setForm({
      evento_clinico:  consulta?.evento_clinico  || '',
      proxima_cita:    consulta?.proxima_cita    || '',
      motivo_consulta: consulta?.motivo_consulta || '',
      diagnostico:     consulta?.diagnostico     || '',
      tratamiento:     consulta?.tratamiento     || '',
      indicaciones:    consulta?.indicaciones    || '',
    })
    setIntentoFinalizar(false)
  }, [consulta?.id])

  useEffect(() => {
    if (!consulta?.id || esCerrada) return
    autoSaveRef.current = setInterval(async () => {
      try {
        await updateConsulta.mutateAsync({ id: consulta.id, ...formPayload() })
      } catch {
        showToast('Error en autoguardado.', 'error')
      }
    }, 30_000)
    return () => clearInterval(autoSaveRef.current)
  }, [consulta?.id, form, esCerrada])

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const formPayload = () => ({ ...form, proxima_cita: form.proxima_cita || null })

  const handleClickFinalizar = () => {
    setIntentoFinalizar(true)
    const faltantes = CAMPOS_REQ_CONSULTA.filter(c => !form[c.key]?.trim())
    if (faltantes.length > 0) {
      showToast(`Completá los campos obligatorios: ${faltantes.map(c => c.label).join(', ')}`, 'warning')
      return
    }
    setConfirmFinalizar(true)
  }

  const handleFinalizar = async () => {
    setFinalizando(true)
    try {
      await updateConsulta.mutateAsync({ id: consulta.id, ...formPayload() })
      await finalizarConsulta.mutateAsync(consulta.id)
      showToast('Consulta finalizada correctamente.', 'success')
      setConfirmFinalizar(false)
      onFinalizar()
    } catch (e) {
      showToast(extraerMensajeError(e), 'error')
    } finally {
      setFinalizando(false)
    }
  }

  const handleGuardarFinalizada = async () => {
    setSavingFinalizada(true)
    try {
      await updateConsulta.mutateAsync({ id: consulta.id, ...formPayload() })
      showToast('Consulta actualizada correctamente.', 'success')
      onFinalizar()
    } catch (e) {
      showToast(extraerMensajeError(e), 'error')
    } finally {
      setSavingFinalizada(false)
    }
  }

  const handleAnular = async () => {
    setAnulando(true)
    try {
      await updateConsulta.mutateAsync({ id: consulta.id, ...formPayload() })
      await anularConsulta.mutateAsync(consulta.id)
      showToast('Consulta anulada.', 'success')
      setConfirmAnular(false)
      onFinalizar()
    } catch (e) {
      showToast(extraerMensajeError(e), 'error')
    } finally {
      setAnulando(false)
    }
  }

  if (!consulta) return null

  const paciente     = consulta.agenda_detalle?.paciente_detalle
  const agenda       = consulta.agenda_detalle
  const especialidad = agenda?.especialidades?.[0]
  const edad         = calcularEdad(paciente?.fecha_nacimiento)

  return (
    <div className="cs-panel-activa">
      <div className="cs-panel-activa-cols">

        <button
          type="button"
          className="cs-acordeon-trigger"
          onClick={() => setAcordeonAbierto(!acordeonAbierto)}
        >
          <span>Paciente: {paciente?.nombre || '—'}</span>
          <ChevronDown
            size={16}
            style={{ transform: acordeonAbierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          />
        </button>

        <div className={`cs-col-paciente ${acordeonAbierto ? 'cs-col-paciente-open' : ''}`}>
          <div className="cs-paciente-card">
            <div className="cs-avatar-grande">
              {iniciales(paciente?.nombre)}
            </div>
            <div className="cs-paciente-nombre">{paciente?.nombre || '—'}</div>
            {edad !== null && <div className="cs-paciente-edad">{edad} años</div>}
            <div className="cs-paciente-doc">Doc: {paciente?.nro_documento || '—'}</div>

            <div className="cs-info-row">
              <span className="cs-info-label">Turno:</span>
              <span>{formatHora(agenda?.hora_desde)} – {formatHora(agenda?.hora_hasta)}</span>
            </div>
            <div className="cs-info-row">
              <span className="cs-info-label">Médico:</span>
              <span>{agenda?.medico_detalle?.nombre || '—'}</span>
            </div>
            {agenda?.especialidades?.length > 0 && (
              <div className="cs-info-row">
                <span className="cs-info-label">Especialidad:</span>
                <span>{agenda.especialidades[0]}</span>
              </div>
            )}

            <div className="cs-clinicos">
              <div className="cs-clinicos-titulo">Datos clínicos</div>

              {paciente?.grupo_sanguineo && (
                <div className="cs-clinico-row">
                  <span className="cs-clinico-label">Tipo de sangre</span>
                  <span className="cs-badge cs-badge-sangre">{paciente.grupo_sanguineo}</span>
                </div>
              )}

              {paciente?.alergias_conocidas ? (
                <div className="cs-clinico-row cs-clinico-row-alerta">
                  <span className="cs-clinico-label">⚠ Alergias</span>
                  <span className="cs-clinico-valor">{paciente.alergias_conocidas}</span>
                </div>
              ) : (
                <div className="cs-clinico-row">
                  <span className="cs-clinico-label">Alergias</span>
                  <span className="cs-clinico-none">No registradas</span>
                </div>
              )}

              {paciente?.enfermedades_cronicas ? (
                <div className="cs-clinico-row">
                  <span className="cs-clinico-label">Enf. crónicas</span>
                  <span className="cs-clinico-valor">{paciente.enfermedades_cronicas}</span>
                </div>
              ) : (
                <div className="cs-clinico-row">
                  <span className="cs-clinico-label">Enf. crónicas</span>
                  <span className="cs-clinico-none">No registradas</span>
                </div>
              )}

              {paciente?.responsable_nombre && (
                <div className="cs-clinico-row cs-clinico-row-resp">
                  <span className="cs-clinico-label">Responsable</span>
                  <div className="cs-clinico-resp">
                    <span>{paciente.responsable_nombre}</span>
                    {paciente.responsable_telefono && (
                      <a href={`tel:${paciente.responsable_telefono}`} className="cs-clinico-tel">
                        📞 {paciente.responsable_telefono}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              className="cs-btn-historia"
              onClick={() => setModalHistoria(true)}
            >
              <ClipboardList size={14} />
              Historia clínica{especialidad ? ` — ${especialidad}` : ''}
            </button>
          </div>
        </div>

        <div className="cs-col-edicion">
          {paciente?.alergias_conocidas && (
            <div className="cs-alergias-banner">
              ⚠️ Paciente con alergias: {paciente.alergias_conocidas}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Evento clínico</label>
            <select
              className="input"
              value={form.evento_clinico}
              onChange={e => handleChange('evento_clinico', e.target.value)}
              disabled={esCerrada && !puedeEditarAun}
            >
              <option value="">Sin evento clínico</option>
              {eventosClinicos.map(ec => (
                <option key={ec.id} value={ec.id}>{ec.tipo_evento}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Próxima cita</label>
            <input
              type="date"
              className="input"
              value={form.proxima_cita}
              min={hoy}
              onChange={e => handleChange('proxima_cita', e.target.value)}
              disabled={esCerrada && !puedeEditarAun}
            />
          </div>

          <div className="form-group">
            <label className="form-label cs-label-req">Motivo de consulta</label>
            <TextareaConContador
              value={form.motivo_consulta}
              onChange={e => handleChange('motivo_consulta', e.target.value)}
              rows={3}
              placeholder="Motivo referido por el paciente…"
              invalido={intentoFinalizar && !form.motivo_consulta?.trim()}
              disabled={esCerrada && !puedeEditarAun}
            />
          </div>

          <div className="form-group">
            <label className="form-label cs-label-req">Diagnóstico</label>
            <TextareaConContador
              value={form.diagnostico}
              onChange={e => handleChange('diagnostico', e.target.value)}
              rows={3}
              placeholder="Diagnóstico del médico…"
              invalido={intentoFinalizar && !form.diagnostico?.trim()}
              disabled={esCerrada && !puedeEditarAun}
            />
          </div>

          <div className="form-group">
            <label className="form-label cs-label-req">Tratamiento</label>
            <TextareaConContador
              value={form.tratamiento}
              onChange={e => handleChange('tratamiento', e.target.value)}
              rows={3}
              placeholder="Tratamiento indicado…"
              invalido={intentoFinalizar && !form.tratamiento?.trim()}
              disabled={esCerrada && !puedeEditarAun}
            />
          </div>

          <div className="form-group">
            <label className="form-label cs-label-req">Indicaciones</label>
            <TextareaConContador
              value={form.indicaciones}
              onChange={e => handleChange('indicaciones', e.target.value)}
              rows={3}
              placeholder="Indicaciones y recomendaciones…"
              invalido={intentoFinalizar && !form.indicaciones?.trim()}
              disabled={esCerrada && !puedeEditarAun}
            />
          </div>

          {!esCerrada && (
            <div className="cs-acciones-consulta">
              <button
                className="btn cs-btn-completar cs-btn-finalizar"
                onClick={handleClickFinalizar}
                disabled={finalizando || anulando}
              >
                <CheckCircle2 size={16} />
                {finalizando ? 'Finalizando…' : 'Completar consulta'}
              </button>
              <button
                className="cs-btn-anular"
                onClick={() => setConfirmAnular(true)}
                disabled={finalizando || anulando}
              >
                <X size={14} />
                Anular
              </button>
            </div>
          )}
          {esFinalizada && puedeEditarAun && (
            <div className="cs-banner-finalizada">
              <CheckCircle2 size={14} />
              <span>Consulta finalizada · Tiempo restante para editar: <strong>{tiempoRestante(consulta)}</strong></span>
            </div>
          )}
          {esFinalizada && !puedeEditarAun && (
            <div className="cs-banner-vencido">
              <CheckCircle2 size={14} />
              <span>Consulta finalizada · El plazo de edición ha vencido (24 hs)</span>
            </div>
          )}
          {esAnulada && puedeEditarAun && (
            <div className="cs-banner-anulada">
              <X size={14} />
              <span>Consulta anulada · Tiempo restante para editar: <strong>{tiempoRestante(consulta)}</strong></span>
            </div>
          )}
          {esAnulada && !puedeEditarAun && (
            <div className="cs-banner-vencido">
              <X size={14} />
              <span>Consulta anulada · El plazo de edición ha vencido (24 hs)</span>
            </div>
          )}
          {puedeEditarAun && (
            <button
              className="btn cs-btn-guardar-fin"
              onClick={handleGuardarFinalizada}
              disabled={savingFinalizada}
            >
              <Pencil size={15} />
              {savingFinalizada ? 'Guardando…' : 'Guardar cambios'}
            </button>
          )}
        </div>
      </div>

      <PanelDocumentos
        consultaId={consulta.id}
        pacienteId={consulta.agenda_detalle?.paciente_detalle?.id}
        tiposDocDig={tiposDocDig}
        showToast={showToast}
      />

      <ConfirmDialog
        isOpen={confirmFinalizar}
        title="Completar consulta"
        description="¿Confirmar la finalización? El turno pasará al estado 'Realizado' y no se podrán registrar más cambios."
        onConfirm={handleFinalizar}
        onCancel={() => setConfirmFinalizar(false)}
        loading={finalizando}
        confirmText="Finalizar"
        cancelText="Cancelar"
      />

      <ConfirmDialog
        isOpen={confirmAnular}
        title="Anular consulta"
        description="¿Anular esta consulta? Se usará cuando el paciente no pudo completar la atención. Dentro de las 24 hs siguientes podrás editar los datos registrados."
        onConfirm={handleAnular}
        onCancel={() => setConfirmAnular(false)}
        loading={anulando}
        confirmText="Anular"
        cancelText="Cancelar"
      />

      {modalHistoria && (
        <ModalHistoriaClinica
          paciente={paciente}
          especialidadFiltro={especialidad}
          medicoNombre={agenda?.medico_detalle?.nombre}
          onClose={() => setModalHistoria(false)}
        />
      )}
    </div>
  )
}

function VistaMedico({ user, esMedico, esSecretaria, esRestringido, esAdmin, eventosClinicos, tiposDocDig, showToast }) {
  const hoy = fechaLocal()

  const [fechaSel, setFechaSel]                     = useState(hoy)
  const [medicoSearch, setMedicoSearch]             = useState('')
  const [medicoSeleccionado, setMedicoSeleccionado] = useState(null)
  const [showMedicoList, setShowMedicoList]         = useState(false)
  const [consultaActiva, setConsultaActiva]         = useState(null)

  useEffect(() => {
    if (!consultaActiva) return
    const fn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', fn)
    return () => window.removeEventListener('beforeunload', fn)
  }, [consultaActiva])

  useEffect(() => {
    if (!esMedico || !user?.persona_rrhh_id || medicoSeleccionado) return
    setMedicoSeleccionado({ id: user.persona_rrhh_id })
  }, [esMedico, user?.persona_rrhh_id])

  useEffect(() => {
    if (!esSecretaria || medicoSeleccionado) return
    if ((user?.medicos_asignados?.length ?? 0) > 1) return
    if (!user?.medico_asignado_id) return
    setMedicoSeleccionado({ id: user.medico_asignado_id })
  }, [esSecretaria, user?.medico_asignado_id, user?.medicos_asignados])

  const { data: medicosData } = usePersonasRRHH({ search: medicoSearch })
  const medicos = medicosData?.results || []

  const { data: consultasData, isLoading: loadingConsultas, refetch } = useConsultasDelDia(
    medicoSeleccionado?.id,
    fechaSel
  )
  const { data: turnosData } = useAgendaDia(
    medicoSeleccionado?.id,
    fechaSel
  )
  const crearConsulta   = useCrearConsulta()
  const iniciarConsulta = useIniciarConsulta()

  const consultas      = consultasData?.results ?? consultasData ?? []
  const turnosOcupados = useMemo(
    () => (turnosData ?? []).filter(t => ['ocupado', 'realizado'].includes(t.estado)),
    [turnosData]
  )

  const listaUnificada = useMemo(() => {
    const consultasByAgenda = {}
    for (const c of consultas) consultasByAgenda[c.agenda] = c
    return turnosOcupados
      .map(turno => ({ turno, consulta: consultasByAgenda[turno.id] ?? null }))
      .sort((a, b) => (a.turno.hora_desde || '').localeCompare(b.turno.hora_desde || ''))
  }, [turnosOcupados, consultas])

  const listaVisible = useMemo(
    () => {
      if (!esRestringido) return listaUnificada
      return listaUnificada.filter(({ turno, consulta }) => {
        if (consulta?.estado === 'finalizada' || consulta?.estado === 'anulada') {
          return esMedico && dentroDelLimite24h(consulta)
        }
        return turno.estado !== 'realizado'
      })
    },
    [listaUnificada, esRestringido, esMedico]
  )

  const hayConsultaEnCurso = listaUnificada.some(({ consulta }) => consulta?.estado === 'en_consulta')

  const handleSeleccionarMedico = (med) => {
    setMedicoSeleccionado(med)
    setShowMedicoList(false)
    setMedicoSearch(med._nombre ?? med.persona_detalle?.razon_social ?? '')
    setConsultaActiva(null)
  }

  const handleFechaCambio = (nuevaFecha) => {
    setFechaSel(nuevaFecha)
    setConsultaActiva(null)
  }

  const handleCrearEIniciar = async (turno) => {
    try {
      const nueva    = await crearConsulta.mutateAsync({ agenda: turno.id })
      const iniciada = await iniciarConsulta.mutateAsync(nueva.id)
      setConsultaActiva(iniciada)
      showToast('Consulta iniciada.', 'success')
    } catch (e) {
      showToast(extraerMensajeError(e), 'error')
    }
  }

  const handleIniciar = async (consulta) => {
    try {
      const iniciada = await iniciarConsulta.mutateAsync(consulta.id)
      setConsultaActiva(iniciada)
      showToast('Consulta iniciada.', 'success')
    } catch (e) {
      showToast(extraerMensajeError(e), 'error')
    }
  }

  const handleClickTurno = (consulta) => {
    if (consulta?.estado === 'en_consulta') {
      setConsultaActiva(consulta)
    } else if (
      (consulta?.estado === 'finalizada' || consulta?.estado === 'anulada') &&
      dentroDelLimite24h(consulta) && (esMedico || esAdmin)
    ) {
      setConsultaActiva(consulta)
    }
  }

  const sinAcceso = (esMedico && !user?.persona_rrhh_id) || (esSecretaria && !user?.medico_asignado_id)

  return (
    <div className="cs-vista-medico">
      {sinAcceso ? (
        <div className="cs-empty-state">
          <Stethoscope size={40} style={{ opacity: 0.2 }} />
          <p>
            {esMedico ? 'Tu usuario no tiene un prestador vinculado.' : 'Tu usuario no tiene un médico asignado.'}<br/>
            Consultá con el administrador del sistema.
          </p>
        </div>
      ) : (
      <>
      {(!esRestringido || (esSecretaria && (user?.medicos_asignados?.length ?? 0) > 1)) && (
        <div className="cs-medico-selector">
          <div className="cs-medico-search-wrap">
            <Search size={15} style={{ color: '#9ca3af' }} />
            <input
              className="cs-medico-input"
              placeholder="Buscar médico…"
              value={medicoSearch}
              onChange={e => { setMedicoSearch(e.target.value); setShowMedicoList(true) }}
              onFocus={() => setShowMedicoList(true)}
              onBlur={() => setTimeout(() => setShowMedicoList(false), 150)}
            />
            {medicoSeleccionado && (
              <button className="cs-clear-btn" onClick={() => {
                setMedicoSeleccionado(null)
                setMedicoSearch('')
                setConsultaActiva(null)
              }}>
                <X size={13} />
              </button>
            )}
          </div>
          {showMedicoList && medicos.length > 0 && (
            <div className="cs-medico-dropdown">
              {medicos.map(med => {
                const nombre = med.persona_detalle?.razon_social ?? `Médico #${med.id}`
                return (
                  <div
                    key={med.id}
                    className="cs-medico-option"
                    onMouseDown={() => handleSeleccionarMedico({ ...med, _nombre: nombre })}
                  >
                    <div className="cs-medico-avatar-sm">{iniciales(nombre)}</div>
                    <span>{nombre}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {esAdmin && (
        <SelectorFecha valor={fechaSel} onChange={handleFechaCambio} />
      )}

      {!medicoSeleccionado ? (
        <div className="cs-empty-state">
          <Stethoscope size={40} style={{ opacity: 0.2 }} />
          <p>Seleccioná un médico para ver sus turnos del día</p>
        </div>
      ) : (
        <div className="cs-medico-content">
          <div className="cs-col-turnos">
            <div className="cs-col-turnos-header">
              <span>Turnos — {fechaSel === hoy ? 'Hoy' : formatFecha(fechaSel)}</span>
              <button className="cs-refresh-btn" onClick={refetch}>
                <RefreshCw size={13} />
              </button>
            </div>
            {loadingConsultas ? (
              <div className="cs-loading">Cargando…</div>
            ) : listaVisible.length === 0 ? (
              <div className="cs-empty-turnos">No hay turnos pendientes para este día.</div>
            ) : (
              listaVisible.map(({ turno, consulta }) => {
                const pac = consulta?.agenda_detalle?.paciente_detalle ?? turno.paciente_detalle
                const { label, cls } = consulta
                  ? badgeEstado(consulta.estado)
                  : { label: 'Sin consulta', cls: 'cs-badge-gray' }
                const esActiva              = consulta && consultaActiva?.id === consulta.id
                const esCerradaCard         = consulta?.estado === 'finalizada' || consulta?.estado === 'anulada'
                const puedeEditarFinalizada = esCerradaCard && dentroDelLimite24h(consulta) && (esMedico || esAdmin)
                const esClickable           = consulta?.estado === 'en_consulta' || puedeEditarFinalizada
                return (
                  <div
                    key={turno.id}
                    className={`cs-turno-card ${esCerradaCard && !puedeEditarFinalizada ? 'cs-turno-finalizado' : ''} ${esActiva ? 'cs-turno-selected' : ''}`}
                    onClick={() => esClickable && handleClickTurno(consulta)}
                    style={{ cursor: esClickable ? 'pointer' : 'default' }}
                  >
                    <div className="cs-turno-header">
                      <span className="cs-turno-hora">
                        {formatHora(turno.hora_desde)} – {formatHora(turno.hora_hasta)}
                      </span>
                      <span className={`cs-badge ${cls}`}>{label}</span>
                      {consulta?.estado === 'en_consulta' && (
                        <Ticker horaDesde={consulta.hora_desde} />
                      )}
                    </div>
                    <div className="cs-turno-pac">
                      <div className="cs-avatar-sm">{iniciales(pac?.nombre)}</div>
                      <div>
                        <div className="cs-turno-pac-nombre">{pac?.nombre || '—'}</div>
                        <div className="cs-turno-pac-doc">{pac?.nro_documento || ''}</div>
                      </div>
                    </div>
                    {!consulta && (
                      <button
                        className="btn btn-primary cs-btn-iniciar"
                        onClick={e => { e.stopPropagation(); handleCrearEIniciar(turno) }}
                        disabled={hayConsultaEnCurso}
                        title={hayConsultaEnCurso ? 'Finalizá la consulta en curso antes de iniciar otra' : undefined}
                      >
                        Iniciar consulta
                      </button>
                    )}
                    {consulta?.estado === 'en_espera' && (
                      <button
                        className="btn btn-primary cs-btn-iniciar"
                        onClick={e => { e.stopPropagation(); handleIniciar(consulta) }}
                        disabled={hayConsultaEnCurso}
                        title={hayConsultaEnCurso ? 'Finalizá la consulta en curso antes de iniciar otra' : undefined}
                      >
                        Iniciar
                      </button>
                    )}
                    {puedeEditarFinalizada && !esActiva && (
                      <button
                        className="cs-btn-editar-fin"
                        onClick={e => { e.stopPropagation(); handleClickTurno(consulta) }}
                      >
                        <Pencil size={12} />
                        Editar
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div className={`cs-col-detalle ${consultaActiva ? 'cs-detalle-activa' : ''}`}>
            {consultaActiva && (
              <div className="cs-detalle-mobile-back">
                <button type="button" onClick={() => setConsultaActiva(null)}>
                  ← Volver a turnos
                </button>
              </div>
            )}
            {consultaActiva ? (
              <PanelConsultaActiva
                key={consultaActiva.id}
                consulta={consultaActiva}
                onFinalizar={() => setConsultaActiva(null)}
                eventosClinicos={eventosClinicos}
                tiposDocDig={tiposDocDig}
                showToast={showToast}
              />
            ) : (
              <div className="cs-empty-state cs-empty-state-detalle">
                <Stethoscope size={36} style={{ opacity: 0.15 }} />
                <p>Seleccioná una consulta activa<br />para ver el detalle</p>
              </div>
            )}
          </div>
        </div>
      )}
      </>
      )}

      {consultaActiva && !sinAcceso && (
        <div className="cs-consulta-activa-banner">
          <AlertTriangle size={14} />
          <span>Consulta en curso — finalizá antes de cambiar de módulo para no perder cambios.</span>
        </div>
      )}
    </div>
  )
}

function VistaRecepcionista({ esAdmin }) {
  const hoy = fechaLocal()
  const [fechaSel, setFechaSel]         = useState(hoy)
  const [filtroMedico, setFiltroMedico] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const { data: agendaData, isLoading: loadingA }    = useAgendaDiaGlobal(fechaSel)
  const { data: consultasData, isLoading: loadingC } = useConsultasHoy(fechaSel)

  const isLoading = loadingA || loadingC

  const listaUnificada = useMemo(() => {
    const consultasByAgenda = {}
    const consultas = consultasData?.results ?? consultasData ?? []
    for (const c of consultas) consultasByAgenda[c.agenda] = c
    const turnos = (agendaData ?? []).filter(t => ['ocupado', 'realizado'].includes(t.estado))
    return turnos
      .map(turno => ({ turno, consulta: consultasByAgenda[turno.id] ?? null }))
      .sort((a, b) => (a.turno.hora_desde || '').localeCompare(b.turno.hora_desde || ''))
  }, [agendaData, consultasData])

  const filtradas = listaUnificada.filter(({ turno, consulta }) => {
    const nombreMed = turno.horario_prestador_detalle?.nombre || ''
    const matchMed  = !filtroMedico || nombreMed.toLowerCase().includes(filtroMedico.toLowerCase())
    const estadoItem = consulta?.estado ?? 'pendiente'
    const matchEst  = !filtroEstado || estadoItem === filtroEstado
    return matchMed && matchEst
  })

  const stats = useMemo(() => ({
    total:       listaUnificada.length,
    pendientes:  listaUnificada.filter(({ consulta }) => !consulta).length,
    en_consulta: listaUnificada.filter(({ consulta }) => consulta?.estado === 'en_consulta').length,
    finalizadas: listaUnificada.filter(({ consulta }) => consulta?.estado === 'finalizada').length,
  }), [listaUnificada])

  return (
    <div className="cs-vista-recepcionista">
      {esAdmin && <SelectorFecha valor={fechaSel} onChange={setFechaSel} />}

      <div className="cs-stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total del día</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pendientes</div>
          <div className="stat-value">{stats.pendientes}</div>
        </div>
        <div className="stat-card cs-stat-en-consulta">
          <div className="stat-label">
            <span className="cs-pulse-dot" />
            En consulta
          </div>
          <div className="stat-value cs-stat-value-verde">{stats.en_consulta}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Finalizadas</div>
          <div className="stat-value">{stats.finalizadas}</div>
        </div>
      </div>

      <div className="cs-filtros">
        <div className="cs-filtro-wrap">
          <Search size={14} style={{ color: '#9ca3af' }} />
          <input
            className="input cs-filtro-input"
            placeholder="Filtrar por médico…"
            value={filtroMedico}
            onChange={e => setFiltroMedico(e.target.value)}
          />
        </div>
        <select
          className="input cs-filtro-select"
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_espera">En espera</option>
          <option value="en_consulta">En consulta</option>
          <option value="finalizada">Finalizada</option>
        </select>
      </div>

      <div className="table-wrapper cs-table-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e8edf2' }}>
              <th className="cs-th">Paciente</th>
              <th className="cs-th">Médico</th>
              <th className="cs-th">Horario</th>
              <th className="cs-th">Especialidad</th>
              <th className="cs-th">Estado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="cs-td-empty">Cargando…</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={5} className="cs-td-empty">No hay turnos para mostrar.</td></tr>
            ) : (
              filtradas.map(({ turno, consulta }, idx) => {
                const pac = turno.paciente_detalle
                const med = turno.horario_prestador_detalle
                const { label, cls } = consulta
                  ? badgeEstado(consulta.estado)
                  : { label: 'Pendiente', cls: 'cs-badge-gray' }
                return (
                  <tr key={turno.id} className={idx % 2 === 0 ? 'cs-tr-par' : 'cs-tr-impar'}>
                    <td className="cs-td">
                      <div className="cs-td-pac">
                        <div className="cs-avatar-sm">{iniciales(pac?.nombre)}</div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{pac?.nombre || '—'}</div>
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>{pac?.nro_documento || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="cs-td">
                      <div className="cs-td-pac">
                        <div className="cs-avatar-sm cs-avatar-azul">{iniciales(med?.nombre)}</div>
                        <span>{med?.nombre || '—'}</span>
                      </div>
                    </td>
                    <td className="cs-td">{formatHora(turno.hora_desde)} – {formatHora(turno.hora_hasta)}</td>
                    <td className="cs-td">{med?.especialidades?.[0] || '—'}</td>
                    <td className="cs-td">
                      <span className={`cs-badge ${cls}`}>{label}</span>
                      {consulta?.estado === 'en_consulta' && (
                        <Ticker horaDesde={consulta.hora_desde} conUrgencia />
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ConsultasPage() {
  const { toast, showToast } = useToast()
  const { user } = useAuth()
  const esMedico        = user?.rol === 'medico'
  const esSecretaria    = user?.rol === 'secretaria_medico'
  const esRecepcionista = user?.rol === 'recepcionista'
  const esAdmin         = user?.rol === 'admin'
  const esRestringido   = esMedico || esSecretaria
  const [pestaña, setPestaña] = useState(esRecepcionista ? 'recepcionista' : 'medico')

  const { data: ecData }  = useEventosClinicos()
  const eventosClinicos   = ecData?.results || ecData || []

  const { data: tddData }  = useTipoDocDig()
  const tiposDocDig        = tddData?.results || tddData || []

  return (
    <>
      <style>{`
        .cs-page { display: flex; flex-direction: column; height: 100%; gap: 0; }

        .cs-tabs {
          display: flex;
          gap: 2px;
          padding: 16px 24px 0;
          border-bottom: 1px solid #e8edf2;
        }
        .cs-tab {
          padding: 8px 20px;
          border: none;
          background: none;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          font-weight: 400;
          color: #6b7280;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: all 0.15s;
        }
        .cs-tab:hover { color: #1a3a5c; }
        .cs-tab.active {
          color: #1a3a5c;
          font-weight: 600;
          border-bottom-color: #1a3a5c;
        }

        .cs-tab-content { flex: 1; overflow: hidden; padding: 0; }

        .cs-vista-medico { height: 100%; display: flex; flex-direction: column; padding: 16px 24px; gap: 12px; }

        .cs-medico-selector { position: relative; max-width: 360px; }
        .cs-medico-search-wrap {
          display: flex; align-items: center; gap: 8px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 0 10px;
        }
        .cs-medico-input {
          flex: 1;
          border: none;
          outline: none;
          padding: 8px 0;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          background: transparent;
        }
        .cs-clear-btn {
          border: none; background: none; cursor: pointer;
          color: #9ca3af; padding: 2px; display: flex;
        }
        .cs-medico-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          z-index: 100; max-height: 240px; overflow-y: auto;
        }
        .cs-medico-option {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; cursor: pointer; font-size: 13.5px;
          transition: background 0.1s;
        }
        .cs-medico-option:hover { background: #f0f4f8; }
        .cs-medico-avatar-sm {
          width: 28px; height: 28px; border-radius: 50%;
          background: #dbeafe; color: #1a3a5c;
          font-size: 11px; font-weight: 600;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        .cs-date-row {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        }
        .cs-date-input {
          border: 1px solid #e5e7eb; border-radius: 8px;
          padding: 6px 10px; font-size: 13px;
          font-family: 'DM Sans', sans-serif; color: #374151; background: #fff;
          cursor: pointer;
        }
        .cs-fecha-badge {
          display: inline-flex; align-items: center;
          background: #dbeafe; color: #1e40af;
          padding: 4px 10px; border-radius: 20px;
          font-size: 12px; font-weight: 500;
        }
        .cs-volver-hoy {
          border: 1px solid #e5e7eb; background: #fff;
          border-radius: 6px; padding: 4px 10px;
          font-size: 12px; color: #6b7280; cursor: pointer;
          font-family: 'DM Sans', sans-serif; transition: all 0.15s;
        }
        .cs-volver-hoy:hover { border-color: #1a3a5c; color: #1a3a5c; }

        .cs-medico-content { flex: 1; display: flex; gap: 16px; overflow: hidden; }

        .cs-col-turnos {
          width: 300px; flex-shrink: 0;
          display: flex; flex-direction: column; gap: 8px;
          overflow-y: auto;
        }
        .cs-col-turnos-header {
          display: flex; align-items: center; justify-content: space-between;
          font-size: 13px; font-weight: 600; color: #374151;
          padding-bottom: 4px; border-bottom: 1px solid #e8edf2;
        }
        .cs-refresh-btn {
          border: none; background: none; cursor: pointer; color: #9ca3af;
          padding: 2px; display: flex; transition: color 0.15s;
        }
        .cs-refresh-btn:hover { color: #1a3a5c; }

        .cs-turno-card {
          background: #fff; border: 1px solid #e8edf2; border-radius: 10px;
          padding: 12px; transition: all 0.15s;
        }
        .cs-turno-card:hover { border-color: #bfdbfe; }
        .cs-turno-selected { border-color: #1a3a5c !important; box-shadow: 0 0 0 2px rgba(26,58,92,0.1); }
        .cs-turno-finalizado { opacity: 0.6; }
        .cs-turno-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .cs-turno-hora { font-size: 13px; font-weight: 600; color: #1a3a5c; flex: 1; }
        .cs-turno-pac { display: flex; align-items: center; gap: 8px; }
        .cs-turno-pac-nombre { font-size: 13px; font-weight: 500; color: #111827; }
        .cs-turno-pac-doc { font-size: 11px; color: #9ca3af; }
        .cs-btn-iniciar { margin-top: 10px; width: 100%; font-size: 13px; padding: 7px; }
        .cs-btn-iniciar:disabled { opacity: 0.45; cursor: not-allowed; }

        .cs-col-detalle {
          flex: 1; overflow-y: auto;
          background: #fff; border-radius: 12px;
          border: 1px solid #e8edf2;
        }

        .cs-panel-activa { padding: 16px; }
        .cs-panel-activa-cols { display: flex; gap: 16px; margin-bottom: 16px; }

        .cs-acordeon-trigger { display: none; }

        .cs-col-paciente {
          width: 220px; flex-shrink: 0;
          display: flex; flex-direction: column; align-items: stretch;
          gap: 4px;
        }
        .cs-paciente-card {
          background: #ffffff;
          box-shadow: 0 1px 8px rgba(0,0,0,0.07);
          border-radius: 8px;
          padding: 16px;
          display: flex; flex-direction: column; align-items: center;
          gap: 4px;
          width: 100%;
        }
        .cs-avatar-grande {
          width: 56px; height: 56px; border-radius: 50%;
          background: #dbeafe; color: #1a3a5c;
          font-size: 20px; font-weight: 600;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 4px;
        }
        .cs-paciente-nombre { font-size: 15px; font-weight: 600; color: #111827; text-align: center; }
        .cs-paciente-edad   { font-size: 13px; color: #6b7280; }
        .cs-paciente-doc    { font-size: 12px; color: #9ca3af; margin-bottom: 8px; }
        .cs-info-row { display: flex; gap: 6px; font-size: 12px; width: 100%; }
        .cs-info-label { color: #9ca3af; flex-shrink: 0; }

        .cs-clinicos {
          margin-top: 12px; width: 100%;
          background: #f8fafc; border-radius: 8px;
          padding: 10px 12px; display: flex; flex-direction: column; gap: 7px;
        }
        .cs-clinicos-titulo {
          font-size: 11px; font-weight: 600; color: #9ca3af;
          text-transform: uppercase; letter-spacing: .05em; margin-bottom: 2px;
        }
        .cs-clinico-row {
          display: flex; align-items: flex-start; gap: 8px;
          font-size: 12px; line-height: 1.4;
        }
        .cs-clinico-row-alerta { color: #b45309; }
        .cs-clinico-row-resp { border-top: 1px solid #e8edf2; padding-top: 7px; margin-top: 2px; }
        .cs-clinico-label {
          font-size: 11px; font-weight: 600; color: #9ca3af;
          min-width: 82px; flex-shrink: 0; padding-top: 1px;
        }
        .cs-clinico-row-alerta .cs-clinico-label { color: #d97706; }
        .cs-clinico-valor { color: #374151; }
        .cs-clinico-none  { color: #d1d5db; font-style: italic; }
        .cs-badge-sangre {
          background: #fee2e2; color: #dc2626;
          font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 20px;
        }
        .cs-clinico-resp { display: flex; flex-direction: column; gap: 2px; }
        .cs-clinico-tel  { font-size: 11.5px; color: #1a3a5c; text-decoration: none; }
        .cs-clinico-tel:hover { text-decoration: underline; }

        .cs-alergias-banner {
          background: #fefce8;
          border-left: 3px solid #f59e0b;
          color: #92400e;
          padding: 9px 12px;
          border-radius: 0 6px 6px 0;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 8px;
        }

        .cs-historial { margin-top: 12px; width: 100%; }
        .cs-historial-titulo { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
        .cs-historial-item { padding: 6px 0; border-bottom: 1px solid #f3f4f6; }
        .cs-historial-fecha  { font-size: 11px; color: #6b7280; display: block; }
        .cs-historial-motivo { font-size: 12px; color: #374151; }
        .cs-histclin-diag { font-size: 11px; color: #6b7280; font-style: italic; margin-top: 2px; }

        .cs-col-edicion { flex: 1; display: flex; flex-direction: column; gap: 10px; }
        .cs-textarea { resize: vertical; min-height: 72px; font-family: 'DM Sans', sans-serif; }
        .cs-textarea-wrap { position: relative; }
        .cs-char-counter {
          display: block; text-align: right;
          font-size: 11px; color: #9ca3af; margin-top: 2px;
        }
        .cs-input-invalido { border-color: #dc2626 !important; background: #fff5f5; }
        .cs-label-req::after { content: ' *'; color: #dc2626; font-weight: 700; }
        .cs-btn-finalizar { margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .cs-btn-completar {
          background: #16a34a; color: #fff; border: none;
          transition: background 0.15s;
        }
        .cs-btn-completar:hover:not(:disabled) { background: #15803d; }
        .cs-btn-completar:disabled { opacity: 0.5; cursor: not-allowed; }

        .cs-acciones-consulta {
          display: flex; gap: 8px; margin-top: 4px;
        }
        .cs-acciones-consulta .cs-btn-completar { flex: 1; }
        .cs-btn-anular {
          display: flex; align-items: center; gap: 6px;
          background: #fff; color: #dc2626;
          border: 1px solid #fecaca; border-radius: 8px;
          padding: 8px 14px; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer;
          transition: all 0.15s; flex-shrink: 0;
        }
        .cs-btn-anular:hover:not(:disabled) { background: #fef2f2; border-color: #fca5a5; }
        .cs-btn-anular:disabled { opacity: 0.45; cursor: not-allowed; }

        .cs-banner-finalizada {
          display: flex; align-items: center; gap: 8px;
          background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;
          padding: 9px 12px; font-size: 13px; color: #15803d;
          margin-top: 4px;
        }
        .cs-banner-anulada {
          display: flex; align-items: center; gap: 8px;
          background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
          padding: 9px 12px; font-size: 13px; color: #dc2626;
          margin-top: 4px;
        }
        .cs-banner-vencido {
          display: flex; align-items: center; gap: 8px;
          background: #f8fafc; border: 1px solid #e8edf2; border-radius: 8px;
          padding: 9px 12px; font-size: 13px; color: #6b7280;
          margin-top: 4px;
        }
        .cs-btn-guardar-fin {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          margin-top: 4px; background: #1a3a5c; color: #fff; border: none;
          transition: background 0.15s;
        }
        .cs-btn-guardar-fin:hover:not(:disabled) { background: #15304d; }
        .cs-btn-guardar-fin:disabled { opacity: 0.5; cursor: not-allowed; }

        .cs-btn-editar-fin {
          display: flex; align-items: center; gap: 5px;
          margin-top: 8px; width: 100%;
          background: #eff6ff; color: #1d4ed8;
          border: 1px solid #bfdbfe; border-radius: 7px;
          padding: 6px 12px; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer;
          transition: background 0.15s;
        }
        .cs-btn-editar-fin:hover { background: #dbeafe; border-color: #93c5fd; }

        .cs-img-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.85);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
        }
        .cs-img-close {
          position: absolute; top: 16px; right: 20px;
          background: rgba(255,255,255,0.15); border: none; border-radius: 50%;
          width: 36px; height: 36px; color: #fff; font-size: 18px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .cs-img-close:hover { background: rgba(255,255,255,0.3); }
        .cs-img-preview {
          max-width: 90vw; max-height: 90vh;
          border-radius: 8px; object-fit: contain;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          cursor: default;
        }

        .cs-docs-panel {
          border-top: 1px solid #e8edf2; padding-top: 16px; margin-top: 4px;
        }
        .cs-docs-header {
          display: flex; align-items: center; gap: 8px;
          font-size: 13px; font-weight: 600; color: #374151;
          margin-bottom: 10px;
        }
        .cs-docs-count {
          background: #e8edf2; border-radius: 10px;
          padding: 1px 7px; font-size: 11px; color: #6b7280;
        }
        .cs-docs-tipo { margin-bottom: 8px; }
        .cs-dropzone {
          border: 2px dashed #e5e7eb; border-radius: 10px;
          padding: 20px; text-align: center;
          cursor: pointer; transition: all 0.15s;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          font-size: 13px; color: #6b7280;
          margin-bottom: 10px;
        }
        .cs-dropzone:hover, .cs-dropzone-active {
          border-color: #1a3a5c; background: #f0f4f8;
        }
        .cs-docs-empty { font-size: 13px; color: #9ca3af; text-align: center; padding: 12px 0; }
        .cs-docs-list { display: flex; flex-direction: column; gap: 6px; }
        .cs-doc-item {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 10px; border: 1px solid #e8edf2; border-radius: 8px;
          background: #f8fafc;
        }
        .cs-doc-info { flex: 1; min-width: 0; }
        .cs-doc-nombre { font-size: 13px; font-weight: 500; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cs-doc-tipo   { font-size: 11px; color: #9ca3af; }
        .cs-doc-actions { display: flex; gap: 4px; flex-shrink: 0; }
        .cs-doc-btn {
          border: 1px solid #e5e7eb; background: #fff; border-radius: 6px;
          padding: 4px 6px; cursor: pointer; color: #6b7280;
          display: flex; align-items: center; transition: all 0.15s;
        }
        .cs-doc-btn:hover { border-color: #bfdbfe; color: #1a3a5c; background: #eff6ff; }
        .cs-doc-btn-danger:hover { border-color: #fecaca; color: #dc2626; background: #fef2f2; }

        .cs-badge {
          display: inline-flex; align-items: center;
          padding: 2px 8px; border-radius: 12px;
          font-size: 11px; font-weight: 500;
        }
        .cs-badge-espera    { background: #fef3c7; color: #92400e; }
        .cs-badge-consulta  { background: #d1fae5; color: #065f46; }
        .cs-badge-finalizada { background: #dbeafe; color: #1e40af; }
        .cs-badge-anulada   { background: #fee2e2; color: #991b1b; }
        .cs-badge-danger    { background: #fee2e2; color: #991b1b; }
        .cs-badge-gray      { background: #f3f4f6; color: #4b5563; }

        .cs-ticker { font-size: 11px; color: #065f46; background: #d1fae5; border-radius: 8px; padding: 1px 7px; margin-left: 4px; }

        .cs-empty-state {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 10px;
          color: #9ca3af; text-align: center;
          padding: 48px 24px; height: 100%;
        }
        .cs-empty-state p { font-size: 14px; margin: 0; }
        .cs-empty-state-detalle { background: transparent; }
        .cs-loading, .cs-empty-turnos {
          font-size: 13px; color: #9ca3af; text-align: center; padding: 24px;
        }

        .cs-avatar-sm {
          width: 28px; height: 28px; border-radius: 50%;
          background: #dbeafe; color: #1a3a5c;
          font-size: 11px; font-weight: 600;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .cs-avatar-azul { background: #e0e7ff; color: #3730a3; }

        .cs-vista-recepcionista { padding: 16px 24px; display: flex; flex-direction: column; gap: 16px; }
        .cs-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .cs-stat-en-consulta { border-left: 3px solid #22c55e !important; }
        .cs-stat-value-verde { color: #16a34a !important; }
        .cs-pulse-dot {
          display: inline-block; width: 7px; height: 7px;
          background: #22c55e; border-radius: 50%;
          margin-right: 6px;
          animation: cs-pulse 1.4s ease-in-out infinite;
        }
        @keyframes cs-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.7); }
        }

        .cs-filtros { display: flex; gap: 10px; flex-wrap: wrap; }
        .cs-filtro-wrap {
          display: flex; align-items: center; gap: 8px;
          background: #fff; border: 1px solid #e5e7eb;
          border-radius: 8px; padding: 0 10px; flex: 1; min-width: 200px;
        }
        .cs-filtro-input {
          flex: 1; border: none; outline: none; padding: 8px 0;
          font-size: 14px; font-family: 'DM Sans', sans-serif; background: transparent;
        }
        .cs-filtro-select { max-width: 200px; }

        .cs-table-scroll { overflow-x: auto; }
        .cs-th {
          text-align: left; padding: 10px 14px;
          font-size: 12px; font-weight: 600;
          color: #6b7280; text-transform: uppercase; letter-spacing: .05em;
          white-space: nowrap;
        }
        .cs-td { padding: 12px 14px; font-size: 13.5px; color: #374151; vertical-align: middle; white-space: nowrap; }
        .cs-td-pac { display: flex; align-items: center; gap: 10px; }
        .cs-td-empty { text-align: center; color: #9ca3af; padding: 24px; font-size: 13px; }
        .cs-tr-par  { background: #ffffff; border-bottom: 1px solid #f3f4f6; }
        .cs-tr-impar { background: #f8fafc; border-bottom: 1px solid #f3f4f6; }

        .cs-detalle-mobile-back { display: none; }

        .cs-consulta-activa-banner {
          display: flex; align-items: center; gap: 8px;
          background: #fef3c7; border-bottom: 1px solid #fde68a;
          padding: 8px 24px; font-size: 13px; color: #92400e;
        }

        /* Historia clínica — botón y modal */
        .cs-btn-historia {
          display: flex; align-items: center; gap: 6px;
          width: 100%; padding: 8px 12px;
          border: 1px solid #bfdbfe; background: #eff6ff;
          border-radius: 8px; cursor: pointer;
          font-size: 13px; font-weight: 500; color: #1d4ed8;
          font-family: 'DM Sans', sans-serif;
          margin-top: 10px; transition: all 0.15s;
        }
        .cs-btn-historia:hover { background: #dbeafe; border-color: #93c5fd; }

        .cs-historia-content { padding: 4px 0; }
        .cs-esp-filtro { margin-bottom: 14px; }
        .cs-historia-empty {
          text-align: center; padding: 32px 0;
          font-size: 14px; color: #9ca3af;
        }

        /* Timeline */
        .cs-tl-list { display: flex; flex-direction: column; }
        .cs-tl-item { display: flex; gap: 12px; }
        .cs-tl-left {
          display: flex; flex-direction: column; align-items: center;
          flex-shrink: 0; width: 18px;
        }
        .cs-tl-dot {
          width: 10px; height: 10px; border-radius: 50%;
          background: #1a3a5c; border: 2px solid #fff;
          box-shadow: 0 0 0 2px #1a3a5c;
          flex-shrink: 0; margin-top: 14px;
          transition: background 0.2s, box-shadow 0.2s;
        }
        .cs-tl-dot-open { background: #3b82f6; box-shadow: 0 0 0 2px #3b82f6; }
        .cs-tl-line { flex: 1; width: 2px; background: #e8edf2; margin-top: 4px; min-height: 8px; }
        .cs-tl-item:last-child .cs-tl-line { display: none; }
        .cs-tl-body { flex: 1; padding-bottom: 10px; min-width: 0; }
        .cs-tl-card {
          border: 1px solid #e8edf2; border-radius: 10px;
          background: #fff; overflow: hidden; transition: border-color 0.15s;
          margin-bottom: 2px;
        }
        .cs-tl-card-open { border-color: #bfdbfe; }
        .cs-tl-card-click .cs-tl-card-top:hover { background: #f8fafc; }
        .cs-tl-card-top {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 8px; padding: 10px 14px; transition: background 0.12s;
        }
        .cs-tl-card-click .cs-tl-card-top { cursor: pointer; }
        .cs-tl-card-head { flex: 1; min-width: 0; }
        .cs-tl-head-row {
          display: flex; align-items: center; gap: 8px;
          flex-wrap: wrap; margin-bottom: 4px;
        }
        .cs-tl-fecha    { font-size: 12px; color: #6b7280; font-weight: 500; flex-shrink: 0; }
        .cs-tl-evtclin  { font-size: 12px; color: #9ca3af; }
        .cs-tl-sub      { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .cs-tl-medico   { font-size: 13px; color: #374151; font-weight: 500; }
        .cs-tl-esp-badge {
          font-size: 11px; background: #eff6ff; color: #1d4ed8;
          padding: 2px 8px; border-radius: 20px; border: 1px solid #bfdbfe;
        }
        .cs-tl-chevron  { color: #9ca3af; flex-shrink: 0; margin-top: 2px; }
        .cs-tl-card-body {
          border-top: 1px solid #f0f4f8; padding: 10px 14px 12px; background: #fafbfc;
        }
        .cs-tl-campo { margin-bottom: 8px; }
        .cs-tl-campo:last-child { margin-bottom: 0; }
        .cs-tl-label {
          display: block; font-size: 10.5px; font-weight: 600;
          text-transform: uppercase; letter-spacing: .04em;
          color: #9ca3af; margin-bottom: 2px;
        }
        .cs-tl-valor { margin: 0; font-size: 13px; color: #111827; white-space: pre-wrap; line-height: 1.5; }
        .cs-tl-docs { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e8edf2; }
        .cs-tl-docs-titulo {
          font-size: 10px; font-weight: 600; text-transform: uppercase;
          letter-spacing: .06em; color: #9ca3af; margin-bottom: 6px;
        }
        .cs-tl-doc-row {
          display: flex; align-items: center; gap: 8px;
          padding: 5px 0; border-bottom: 1px solid #f3f4f6;
        }
        .cs-tl-doc-row:last-child { border-bottom: none; }
        .cs-tl-doc-icono {
          width: 26px; height: 26px; border-radius: 5px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 9px; font-weight: 700;
        }
        .cs-tl-doc-nombre {
          flex: 1; font-size: 12px; color: #374151; font-weight: 500;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
        }
        .cs-tl-doc-tipo  { font-size: 10.5px; color: #9ca3af; flex-shrink: 0; white-space: nowrap; }
        .cs-tl-doc-btn {
          width: 24px; height: 24px; border-radius: 6px; border: 1px solid #e8edf2;
          background: none; cursor: pointer; color: #6b7280; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .cs-tl-doc-btn:hover:not(:disabled) { background: #eff6ff; color: #1a3a5c; border-color: #bfdbfe; }
        .cs-tl-doc-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        @media (max-width: 767px) {
          .cs-vista-medico { padding: 12px 16px; }
          .cs-vista-recepcionista { padding: 12px 16px; }

          .cs-stats-grid { grid-template-columns: repeat(2, 1fr); }

          .cs-date-row { flex-wrap: wrap; }
          .cs-date-input { flex: 1; min-width: 140px; }

          .cs-medico-selector { max-width: 100%; }

          .cs-medico-content { flex-direction: column; overflow: visible; }
          .cs-col-turnos { width: 100%; overflow-y: visible; }
          .cs-col-detalle { overflow-y: visible; min-height: 400px; }

          .cs-panel-activa-cols { flex-direction: column; gap: 0; }

          .cs-acordeon-trigger {
            display: flex; align-items: center; justify-content: space-between;
            width: 100%; padding: 10px 14px;
            background: #f0f4f8; border: 1px solid #e8edf2; border-radius: 8px;
            cursor: pointer; font-size: 14px; font-weight: 600; color: #374151;
            margin-bottom: 8px; font-family: 'DM Sans', sans-serif;
          }

          .cs-col-paciente {
            width: 100% !important;
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.35s ease;
          }
          .cs-col-paciente.cs-col-paciente-open {
            max-height: 1800px;
            margin-bottom: 12px;
          }

          .cs-col-detalle.cs-detalle-activa {
            position: fixed; inset: 0; z-index: 40;
            background: #fff; overflow-y: auto;
            border-radius: 0; border: none;
          }
          .cs-detalle-mobile-back {
            display: flex; align-items: center;
            padding: 10px 16px; background: #f0f4f8;
            border-bottom: 1px solid #e8edf2;
            position: sticky; top: 0; z-index: 41;
          }
          .cs-detalle-mobile-back button {
            border: none; background: none; cursor: pointer;
            font-size: 14px; font-weight: 600; color: #1a3a5c;
            font-family: 'DM Sans', sans-serif; padding: 0;
          }
        }
      `}</style>

      <div className="cs-page">
        {esAdmin && (
          <div className="cs-tabs">
            <button
              className={`cs-tab ${pestaña === 'medico' ? 'active' : ''}`}
              onClick={() => setPestaña('medico')}
            >
              Vista médico
            </button>
            <button
              className={`cs-tab ${pestaña === 'recepcionista' ? 'active' : ''}`}
              onClick={() => setPestaña('recepcionista')}
            >
              Vista recepcionista
            </button>
          </div>
        )}

        {esRecepcionista ? (
          <div className="cs-tab-content" style={{ overflowY: 'auto' }}>
            <VistaRecepcionista esAdmin={false} />
          </div>
        ) : !esAdmin ? (
          <div className="cs-tab-content" style={{ overflow: 'hidden' }}>
            <VistaMedico
              user={user}
              esMedico={esMedico}
              esSecretaria={esSecretaria}
              esRestringido={esRestringido}
              esAdmin={false}
              eventosClinicos={eventosClinicos}
              tiposDocDig={tiposDocDig}
              showToast={showToast}
            />
          </div>
        ) : (
          <div className="cs-tab-content" style={{ overflowY: pestaña === 'recepcionista' ? 'auto' : 'hidden' }}>
            {pestaña === 'medico' ? (
              <VistaMedico
                user={user}
                esMedico={esMedico}
                esSecretaria={esSecretaria}
                esRestringido={esRestringido}
                esAdmin={esAdmin}
                eventosClinicos={eventosClinicos}
                tiposDocDig={tiposDocDig}
                showToast={showToast}
              />
            ) : (
              <VistaRecepcionista esAdmin={esAdmin} />
            )}
          </div>
        )}
      </div>

      <Toast toast={toast} />
    </>
  )
}
