import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Stethoscope, CheckCircle2,
  Upload, X, FileText, Download, Trash2,
  RefreshCw, Search, AlertTriangle,
} from 'lucide-react'
import { extraerMensajeError } from '../../utils/errores'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Toast from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { usePersonasRRHH } from '../../hooks/administracion/usePersonaRRHH'
import { useAgendaDia, useAgendaDiaGlobal } from '../../hooks/clinica/useAgenda'
import {
  useConsultasDelDia, useConsultasHoy,
  useConsultasPaciente, useIniciarConsulta, useFinalizarConsulta,
  useUpdateConsulta, useCrearConsulta,
} from '../../hooks/clinica/useConsultas'
import { useDocumentosPorConsulta, useSubirDocumento, useDeleteDocumento } from '../../hooks/mantenimiento/useDocumentos'
import { useEventosClinicos } from '../../hooks/mantenimiento/useEventosClinicos'
import { useTipoDocDig } from '../../hooks/mantenimiento/useTipoDocDig'

function fechaLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

function badgeEstado(estado) {
  const map = {
    en_espera:   { label: 'En espera',   cls: 'cs-badge-espera' },
    en_consulta: { label: 'En consulta', cls: 'cs-badge-consulta' },
    finalizada:  { label: 'Finalizada',  cls: 'cs-badge-finalizada' },
  }
  return map[estado] || { label: estado, cls: '' }
}

function Ticker({ horaDesde }) {
  const [mins, setMins] = useState(() => tiempoTranscurrido(horaDesde))
  useEffect(() => {
    const iv = setInterval(() => setMins(tiempoTranscurrido(horaDesde)), 60_000)
    return () => clearInterval(iv)
  }, [horaDesde])
  if (mins === null) return null
  return <span className="cs-ticker">{mins} min</span>
}

function PanelDocumentos({ consultaId, pacienteId, tiposDocDig, showToast }) {
  const { data: docsData, isLoading } = useDocumentosPorConsulta(consultaId)
  const subirDoc  = useSubirDocumento()
  const deleteDoc = useDeleteDocumento()
  const [dragging, setDragging] = useState(false)
  const [tipoSeleccionado, setTipoSeleccionado] = useState('')
  const [confirmDocId, setConfirmDocId] = useState(null)
  const inputRef = useRef()

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

  const handleDescargar = (doc) => {
    window.open(`/api/documentos/${doc.id}/descargar/`, '_blank')
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
    </div>
  )
}

function PanelConsultaActiva({ consulta, onFinalizar, tiposDocDig, eventosClinicos, showToast }) {
  const updateConsulta    = useUpdateConsulta()
  const finalizarConsulta = useFinalizarConsulta()
  const { data: historialData } = useConsultasPaciente(consulta?.agenda_detalle?.paciente_detalle?.id)

  const [form, setForm] = useState({
    evento_clinico:  consulta?.evento_clinico  || '',
    proxima_cita:    consulta?.proxima_cita    || '',
    motivo_consulta: consulta?.motivo_consulta || '',
    diagnostico:     consulta?.diagnostico     || '',
    tratamiento:     consulta?.tratamiento     || '',
    indicaciones:    consulta?.indicaciones    || '',
  })
  const [finalizando, setFinalizando]         = useState(false)
  const [confirmFinalizar, setConfirmFinalizar] = useState(false)
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
  }, [consulta?.id])

  useEffect(() => {
    if (!consulta?.id) return
    autoSaveRef.current = setInterval(async () => {
      try {
        await updateConsulta.mutateAsync({ id: consulta.id, ...form })
      } catch {
        showToast('Error en autoguardado.', 'error')
      }
    }, 30_000)
    return () => clearInterval(autoSaveRef.current)
  }, [consulta?.id, form])

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleFinalizar = async () => {
    setFinalizando(true)
    try {
      await updateConsulta.mutateAsync({ id: consulta.id, ...form })
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

  if (!consulta) return null

  const paciente    = consulta.agenda_detalle?.paciente_detalle
  const agenda      = consulta.agenda_detalle
  const historial   = historialData?.results || historialData || []
  const histUltimas = historial.filter(c => c.id !== consulta.id && c.estado === 'finalizada').slice(0, 5)
  const edad        = calcularEdad(paciente?.fecha_nacimiento)

  return (
    <div className="cs-panel-activa">
      <div className="cs-panel-activa-cols">

        <div className="cs-col-paciente">
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

          {histUltimas.length > 0 && (
            <div className="cs-historial">
              <div className="cs-historial-titulo">Últimas consultas</div>
              {histUltimas.map(hc => (
                <div key={hc.id} className="cs-historial-item">
                  <span className="cs-historial-fecha">{hc.agenda_detalle?.fecha || '—'}</span>
                  <span className="cs-historial-motivo">{hc.motivo_consulta || 'Sin motivo registrado'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cs-col-edicion">
          <div className="form-group">
            <label className="form-label">Evento clínico</label>
            <select
              className="input"
              value={form.evento_clinico}
              onChange={e => handleChange('evento_clinico', e.target.value)}
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
              onChange={e => handleChange('proxima_cita', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Motivo de consulta</label>
            <textarea
              className="input cs-textarea"
              rows={3}
              value={form.motivo_consulta}
              onChange={e => handleChange('motivo_consulta', e.target.value)}
              placeholder="Motivo referido por el paciente…"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Diagnóstico</label>
            <textarea
              className="input cs-textarea"
              rows={3}
              value={form.diagnostico}
              onChange={e => handleChange('diagnostico', e.target.value)}
              placeholder="Diagnóstico del médico…"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tratamiento</label>
            <textarea
              className="input cs-textarea"
              rows={3}
              value={form.tratamiento}
              onChange={e => handleChange('tratamiento', e.target.value)}
              placeholder="Tratamiento indicado…"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Indicaciones</label>
            <textarea
              className="input cs-textarea"
              rows={3}
              value={form.indicaciones}
              onChange={e => handleChange('indicaciones', e.target.value)}
              placeholder="Indicaciones y recomendaciones…"
            />
          </div>

          <button
            className="btn btn-danger cs-btn-finalizar"
            onClick={() => setConfirmFinalizar(true)}
            disabled={finalizando}
          >
            <CheckCircle2 size={16} />
            {finalizando ? 'Finalizando…' : 'Finalizar consulta'}
          </button>
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
        title="Finalizar consulta"
        description="¿Confirmar la finalización? El turno pasará al estado 'Realizado' y no se podrán registrar más cambios."
        onConfirm={handleFinalizar}
        onCancel={() => setConfirmFinalizar(false)}
        loading={finalizando}
      />
    </div>
  )
}

function VistaMedico({ eventosClinicos, tiposDocDig, showToast }) {
  const hoy = fechaLocal()

  const [medicoSearch, setMedicoSearch]           = useState('')
  const [medicoSeleccionado, setMedicoSeleccionado] = useState(null)
  const [showMedicoList, setShowMedicoList]         = useState(false)
  const [consultaActiva, setConsultaActiva]         = useState(null)

  // Advertir al cerrar/recargar el browser si hay consulta activa sin finalizar
  useEffect(() => {
    if (!consultaActiva) return
    const fn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', fn)
    return () => window.removeEventListener('beforeunload', fn)
  }, [consultaActiva])

  const { data: medicosData } = usePersonasRRHH({ search: medicoSearch })
  const medicos = medicosData?.results || []

  const { data: consultasData, isLoading: loadingConsultas, refetch } = useConsultasDelDia(
    medicoSeleccionado?.id,
    hoy
  )
  const { data: turnosData } = useAgendaDia(
    medicoSeleccionado?.id,
    hoy
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

  const hayConsultaEnCurso = listaUnificada.some(({ consulta }) => consulta?.estado === 'en_consulta')

  const handleSeleccionarMedico = (med) => {
    setMedicoSeleccionado(med)
    setShowMedicoList(false)
    setMedicoSearch(med._nombre ?? med.persona_detalle?.razon_social ?? '')
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
    if (consulta?.estado === 'en_consulta') setConsultaActiva(consulta)
  }

  return (
    <div className="cs-vista-medico">
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

      {!medicoSeleccionado ? (
        <div className="cs-empty-state">
          <Stethoscope size={40} style={{ opacity: 0.2 }} />
          <p>Seleccioná un médico para ver sus turnos del día</p>
        </div>
      ) : (
        <div className="cs-medico-content">
          <div className="cs-col-turnos">
            <div className="cs-col-turnos-header">
              <span>Turnos del día</span>
              <button className="cs-refresh-btn" onClick={refetch}>
                <RefreshCw size={13} />
              </button>
            </div>
            {loadingConsultas ? (
              <div className="cs-loading">Cargando…</div>
            ) : listaUnificada.length === 0 ? (
              <div className="cs-empty-turnos">No hay turnos para hoy.</div>
            ) : (
              listaUnificada.map(({ turno, consulta }) => {
                const pac = consulta?.agenda_detalle?.paciente_detalle ?? turno.paciente_detalle
                const { label, cls } = consulta
                  ? badgeEstado(consulta.estado)
                  : { label: 'Sin consulta', cls: 'cs-badge-gray' }
                const esActiva = consulta && consultaActiva?.id === consulta.id
                return (
                  <div
                    key={turno.id}
                    className={`cs-turno-card ${consulta?.estado === 'finalizada' ? 'cs-turno-finalizado' : ''} ${esActiva ? 'cs-turno-selected' : ''}`}
                    onClick={() => consulta?.estado === 'en_consulta' && handleClickTurno(consulta)}
                    style={{ cursor: consulta?.estado === 'en_consulta' ? 'pointer' : 'default' }}
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
                      hayConsultaEnCurso ? (
                        <span className="cs-btn-bloqueado" title="Finalizá la consulta en curso antes de iniciar otra">
                          Consulta en curso
                        </span>
                      ) : (
                        <button
                          className="btn btn-primary cs-btn-iniciar"
                          onClick={e => { e.stopPropagation(); handleCrearEIniciar(turno) }}
                        >
                          Iniciar consulta
                        </button>
                      )
                    )}
                    {consulta?.estado === 'en_espera' && (
                      hayConsultaEnCurso ? (
                        <span className="cs-btn-bloqueado" title="Finalizá la consulta en curso antes de iniciar otra">
                          Consulta en curso
                        </span>
                      ) : (
                        <button
                          className="btn btn-primary cs-btn-iniciar"
                          onClick={e => { e.stopPropagation(); handleIniciar(consulta) }}
                        >
                          Iniciar
                        </button>
                      )
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div className="cs-col-detalle">
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

      {consultaActiva && (
        <div className="cs-consulta-activa-banner">
          <AlertTriangle size={14} />
          <span>Consulta en curso — finalizá antes de cambiar de módulo para no perder cambios.</span>
        </div>
      )}
    </div>
  )
}

function VistaRecepcionista() {
  const hoy = fechaLocal()
  const [filtroMedico, setFiltroMedico] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const { data: agendaData, isLoading: loadingA } = useAgendaDiaGlobal(hoy)
  const { data: consultasData, isLoading: loadingC } = useConsultasHoy()

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
    en_espera:   listaUnificada.filter(({ consulta }) => consulta?.estado === 'en_espera').length,
    en_consulta: listaUnificada.filter(({ consulta }) => consulta?.estado === 'en_consulta').length,
    finalizadas: listaUnificada.filter(({ consulta }) => consulta?.estado === 'finalizada').length,
  }), [listaUnificada])

  return (
    <div className="cs-vista-recepcionista">
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

      <div className="table-wrapper">
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
              filtradas.map(({ turno, consulta }) => {
                const pac = turno.paciente_detalle
                const med = turno.horario_prestador_detalle
                const { label, cls } = consulta
                  ? badgeEstado(consulta.estado)
                  : { label: 'Pendiente', cls: 'cs-badge-gray' }
                return (
                  <tr key={turno.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
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
                      {consulta?.estado === 'en_consulta' && <Ticker horaDesde={consulta.hora_desde} />}
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
  const [pestaña, setPestaña] = useState('medico')
  const { toast, showToast } = useToast()
  const { data: ecData }  = useEventosClinicos()
  const eventosClinicos   = ecData?.results || ecData || []

  const { data: tddData }  = useTipoDocDig()
  const tiposDocDig        = tddData?.results || tddData || []

  return (
    <>
      <style>{`
        .cs-page { display: flex; flex-direction: column; height: 100%; gap: 0; }

        .cs-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px 24px 0;
        }
        .cs-header-icon {
          width: 36px; height: 36px;
          background: #dbeafe;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .cs-header-title { font-size: 20px; font-weight: 600; color: #111827; }
        .cs-header-sub   { font-size: 13px; color: #9ca3af; }

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

        .cs-col-detalle {
          flex: 1; overflow-y: auto;
          background: #fff; border-radius: 12px;
          border: 1px solid #e8edf2;
        }

        .cs-panel-activa { padding: 16px; }
        .cs-panel-activa-cols { display: flex; gap: 16px; margin-bottom: 16px; }

        .cs-col-paciente {
          width: 220px; flex-shrink: 0;
          display: flex; flex-direction: column; align-items: center;
          gap: 4px;
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
          background: #fee2e2; color: #b91c1c;
          font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 20px;
        }
        .cs-clinico-resp { display: flex; flex-direction: column; gap: 2px; }
        .cs-clinico-tel  { font-size: 11.5px; color: #1a3a5c; text-decoration: none; }
        .cs-clinico-tel:hover { text-decoration: underline; }

        .cs-historial { margin-top: 12px; width: 100%; }
        .cs-historial-titulo { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
        .cs-historial-item { padding: 6px 0; border-bottom: 1px solid #f3f4f6; }
        .cs-historial-fecha  { font-size: 11px; color: #6b7280; display: block; }
        .cs-historial-motivo { font-size: 12px; color: #374151; }

        .cs-col-edicion { flex: 1; display: flex; flex-direction: column; gap: 10px; }
        .cs-textarea { resize: vertical; min-height: 72px; font-family: 'DM Sans', sans-serif; }
        .cs-btn-finalizar { margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 8px; }

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
        .cs-badge-danger    { background: #fee2e2; color: #991b1b; }
        .cs-badge-gray      { background: #f3f4f6; color: #4b5563; }

        .cs-ticker { font-size: 11px; color: #065f46; background: #d1fae5; border-radius: 8px; padding: 1px 7px; }

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
        .cs-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
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

        .cs-th {
          text-align: left; padding: 10px 14px;
          font-size: 12px; font-weight: 600;
          color: #6b7280; text-transform: uppercase; letter-spacing: .05em;
        }
        .cs-td { padding: 12px 14px; font-size: 13.5px; color: #374151; vertical-align: middle; }
        .cs-td-pac { display: flex; align-items: center; gap: 10px; }
        .cs-td-empty { text-align: center; color: #9ca3af; padding: 24px; font-size: 13px; }

        .cs-btn-bloqueado {
          display: inline-block; padding: 5px 10px;
          font-size: 11.5px; font-weight: 500;
          color: #92400e; background: #fef3c7;
          border: 1px solid #fde68a; border-radius: 6px;
          cursor: default;
        }

        .cs-consulta-activa-banner {
          display: flex; align-items: center; gap: 8px;
          background: #fef3c7; border-bottom: 1px solid #fde68a;
          padding: 8px 24px; font-size: 13px; color: #92400e;
        }
      `}</style>

      <div className="cs-page">
        <div className="cs-header">
          <div className="cs-header-icon">
            <Stethoscope size={18} color="#1a3a5c" />
          </div>
          <div>
            <div className="cs-header-title">Consultas Médicas</div>
            <div className="cs-header-sub">{new Date().toLocaleDateString('es-PY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>

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

        <div className="cs-tab-content" style={{ overflowY: pestaña === 'recepcionista' ? 'auto' : 'hidden' }}>
          {pestaña === 'medico' ? (
            <VistaMedico
              eventosClinicos={eventosClinicos}
              tiposDocDig={tiposDocDig}
              showToast={showToast}
            />
          ) : (
            <VistaRecepcionista showToast={showToast} />
          )}
        </div>
      </div>

      <Toast toast={toast} />
    </>
  )
}
