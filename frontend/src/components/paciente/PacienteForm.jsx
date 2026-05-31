import { useState, useEffect, useRef } from 'react'
import BuscadorPersona from '../persona/BuscadorPersona'
import FormPersona     from '../persona/FormPersona'
import FormPaciente    from '../paciente/FormPaciente'
import { useCreatePersona, useUpdatePersona } from '../../hooks/administracion/usePersona'
import { useCreatePatient, useUpdatePatient } from '../../hooks/clinica/usePatients'
import { extraerMensajeError } from '../../utils/errores'
import { useAtajosTeclado } from '../../hooks/useAtajosTeclado'
import { useNavigationGuard } from '../../hooks/useNavigationGuard'
import { useTipoDocDig } from '../../hooks/mantenimiento/useTipoDocDig'
import { useSubirDocumento, useDeleteDocumento, useDocumentosPorPaciente } from '../../hooks/mantenimiento/useDocumentos'

const MODO_INFO = {
  crear_todo:       { texto: 'Documento no encontrado — completá los datos para registrar', bg: '#eff6ff', color: '#1a3a5c', border: '#bfdbfe' },
  agregar_paciente: { texto: 'Persona encontrada — completá los datos del paciente',        bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  editar:           { texto: 'Paciente existente — modo edición',                           bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
}

const TIPOS_ACEPTADOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf']

function fileIconInfo(nombre) {
  const ext = nombre?.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return { bg: '#fee2e2', color: '#dc2626', label: 'PDF' }
  return { bg: '#eff6ff', color: '#1d4ed8', label: ext?.toUpperCase() || '?' }
}

/* ── Zona de carga de documentos (solo modo editar, controlada por PacienteForm) ── */

function SeccionDocumentos({
  pacienteId,
  docsExistentes,
  cargandoDocs,
  archivosNuevos,
  setArchivosNuevos,
  idsAEliminar,
  setIdsAEliminar,
  tipos,
  errorSub,
  setErrorSub,
}) {
  const [dragOver,      setDragOver]      = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const inputRef = useRef(null)

  const agregarArchivos = (files) => {
    const defaultTipo = tipos[0]?.id?.toString() || ''
    const validos = Array.from(files).filter(f => TIPOS_ACEPTADOS.includes(f.type))
    const invalidos = Array.from(files).length - validos.length
    if (invalidos > 0) {
      setErrorSub(`${invalidos} archivo${invalidos > 1 ? 's' : ''} ignorado${invalidos > 1 ? 's' : ''} — solo se aceptan PDF e imágenes.`)
    } else {
      setErrorSub('')
    }
    if (validos.length === 0) return
    const nuevos = validos.map(file => ({
      uid:        Math.random().toString(36).slice(2),
      file,
      tipoDocDig: defaultTipo,
      preview:    file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }))
    setArchivosNuevos(prev => [...prev, ...nuevos])
  }

  const quitarArchivo = (uid) => {
    setArchivosNuevos(prev => {
      const item = prev.find(a => a.uid === uid)
      if (item?.preview) URL.revokeObjectURL(item.preview)
      return prev.filter(a => a.uid !== uid)
    })
  }

  const toggleEliminar = (docId) => {
    setIdsAEliminar(prev => {
      const next = new Set(prev)
      if (next.has(docId)) next.delete(docId)
      else next.add(docId)
      return next
    })
    setConfirmDelete(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    agregarArchivos(e.dataTransfer.files)
  }

  const docsFiltrados = docsExistentes.filter(d => !d.consulta)

  return (
    <div>
      <div className="pf-doc-titulo">Documentos digitalizados</div>

      {cargandoDocs && (
        <div className="pf-doc-cargando">Cargando documentos…</div>
      )}

      {!cargandoDocs && docsFiltrados.length > 0 && (
        <div className="pf-doc-existentes">
          <div className="pf-doc-existentes-label">Archivos guardados</div>
          <div className="pf-doc-lista">
            {docsFiltrados.map(doc => {
              const info       = fileIconInfo(doc.filename || '')
              const marcado    = idsAEliminar.has(doc.id)
              const pedirConf  = confirmDelete === doc.id
              return (
                <div key={doc.id} className={`pf-doc-item${marcado ? ' pf-doc-item-marcado' : ''}`}>
                  <div className="pf-doc-icono-box" style={{ background: info.bg, color: info.color }}>
                    {info.label}
                  </div>
                  <div className="pf-doc-info">
                    <div className="pf-doc-nombre" style={marcado ? { textDecoration: 'line-through', color: '#9ca3af' } : {}}>
                      {doc.filename || `Documento #${doc.id}`}
                    </div>
                    {marcado
                      ? <div className="pf-doc-marcado-badge">Se eliminará al guardar</div>
                      : doc.tipo_doc_dig_descripcion && (
                        <div className="pf-doc-tipo-badge">{doc.tipo_doc_dig_descripcion}</div>
                      )
                    }
                  </div>
                  {marcado ? (
                    <button
                      className="pf-doc-desmarcar"
                      onClick={() => toggleEliminar(doc.id)}
                      title="Deshacer"
                    >↩</button>
                  ) : pedirConf ? (
                    <div className="pf-doc-confirm">
                      <span className="pf-doc-confirm-txt">¿Eliminar?</span>
                      <button className="pf-doc-confirm-si" onClick={() => toggleEliminar(doc.id)}>Sí</button>
                      <button className="pf-doc-confirm-no" onClick={() => setConfirmDelete(null)}>No</button>
                    </div>
                  ) : (
                    <button
                      className="pf-doc-remove"
                      onClick={() => setConfirmDelete(doc.id)}
                      title="Eliminar"
                    >✕</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="pf-doc-nueva-label">Subir nuevos archivos</div>
      <div
        className={`pf-dropzone${dragOver ? ' pf-dropzone-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          style={{ display: 'none' }}
          onChange={e => { agregarArchivos(e.target.files); e.target.value = '' }}
        />
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: '#9ca3af', flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <div className="pf-dropzone-text">Arrastrá archivos o hacé clic para seleccionar</div>
        <div className="pf-dropzone-hint">PDF e imágenes — múltiples archivos</div>
      </div>

      {archivosNuevos.length > 0 && (
        <div className="pf-doc-lista">
          {archivosNuevos.map(item => {
            const info = fileIconInfo(item.file.name)
            return (
              <div key={item.uid} className="pf-doc-item">
                {item.preview ? (
                  <img src={item.preview} alt={item.file.name} className="pf-doc-preview-img" />
                ) : (
                  <div className="pf-doc-icono-box" style={{ background: info.bg, color: info.color }}>
                    {info.label}
                  </div>
                )}
                <div className="pf-doc-info">
                  <div className="pf-doc-nombre">{item.file.name}</div>
                  <select
                    value={item.tipoDocDig}
                    onChange={e => setArchivosNuevos(prev => prev.map(a =>
                      a.uid === item.uid ? { ...a, tipoDocDig: e.target.value } : a
                    ))}
                    className="pf-doc-select"
                  >
                    <option value="">— Tipo de documento —</option>
                    {tipos.map(t => (
                      <option key={t.id} value={t.id}>{t.descripcion}</option>
                    ))}
                  </select>
                  <div className="pf-doc-pendiente-badge">Se subirá al guardar</div>
                </div>
                <button
                  className="pf-doc-remove"
                  onClick={() => quitarArchivo(item.uid)}
                  title="Quitar"
                >✕</button>
              </div>
            )
          })}

          {errorSub && (
            <div className="pf-doc-error">{errorSub}</div>
          )}
        </div>
      )}

      {errorSub && archivosNuevos.length === 0 && (
        <div className="pf-doc-error" style={{ marginTop: 8 }}>{errorSub}</div>
      )}
    </div>
  )
}

export default function PacienteForm({ onSuccess, pacienteInicial = null }) {
  const [resultado, setResultado] = useState(
    pacienteInicial
      ? {
          documento:   pacienteInicial.persona_detalle?.nro_documento || '',
          persona:     pacienteInicial.persona_detalle,
          paciente:    pacienteInicial,
          es_paciente: true,
          modo:        'editar',
        }
      : null
  )
  const [formPersona,     setFormPersona]     = useState({})
  const [formPaciente,    setFormPaciente]    = useState({})
  const [guardando,       setGuardando]       = useState(false)
  const [error,           setError]           = useState('')
  const [intentoGuardado, setIntentoGuardado] = useState(false)

  // Estado de documentos (staged)
  const [archivosNuevos, setArchivosNuevos] = useState([])
  const [idsAEliminar,   setIdsAEliminar]   = useState(new Set())
  const [errorSub,       setErrorSub]       = useState('')

  const { markDirty, markClean } = useNavigationGuard()

  const { mutateAsync: createPersona }  = useCreatePersona()
  const { mutateAsync: updatePersona }  = useUpdatePersona()
  const { mutateAsync: createPaciente } = useCreatePatient()
  const { mutateAsync: updatePaciente } = useUpdatePatient()
  const { mutateAsync: subirDoc }       = useSubirDocumento()
  const { mutateAsync: eliminarDoc }    = useDeleteDocumento()

  const { data: tiposRaw } = useTipoDocDig()
  const pacienteId = resultado?.modo === 'editar' ? resultado.paciente?.id : null
  const { data: docsExistentes = [], isLoading: cargandoDocs } = useDocumentosPorPaciente(pacienteId)
  const tipos = tiposRaw?.results || tiposRaw || []

  useEffect(() => {
    if (resultado) markDirty()
  }, [resultado])

  useEffect(() => () => {
    archivosNuevos.forEach(a => { if (a.preview) URL.revokeObjectURL(a.preview) })
    markClean()
  }, [markClean])

  const calcularErrores = () => {
    if (!intentoGuardado) return {}
    const e = {}
    if (!formPersona.tipo_documento)       e.tipo_documento = true
    if (!formPersona.nro_documento?.trim()) e.nro_documento  = true
    if (!formPersona.razon_social?.trim())  e.razon_social   = true
    if (!formPaciente.sexo)                e.sexo           = true
    return e
  }

  const errores = calcularErrores()

  useAtajosTeclado({
    'F10': { fn: () => { if (resultado && !guardando) handleGuardar() }, soloFueraDeInputs: false },
  })

  const handleGuardar = async () => {
    setIntentoGuardado(true)

    const e = {}
    if (!formPersona.tipo_documento)       e.tipo_documento = true
    if (!formPersona.nro_documento?.trim()) e.nro_documento  = true
    if (!formPersona.razon_social?.trim())  e.razon_social   = true
    if (!formPaciente.sexo)                e.sexo           = true

    if (Object.keys(e).length > 0) {
      const primero = Object.keys(e)[0]
      const idCampo = primero === 'sexo' ? 'fpa-campo-sexo' : `fp-campo-${primero}`
      document.getElementById(idCampo)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    const sinTipo = archivosNuevos.find(a => !a.tipoDocDig)
    if (sinTipo) {
      setError('Seleccioná el tipo de documento para cada archivo nuevo.')
      return
    }

    setError('')
    setGuardando(true)

    try {
      let personaId = resultado.persona?.id

      const prepararPersona = (data) => ({
        ...data,
        ruc_dv:           data.ruc_dv           ? parseInt(data.ruc_dv) : null,
        pais:             data.pais              || null,
        departamento:     data.departamento      || null,
        ciudad:           data.ciudad            || null,
        fecha_nacimiento: data.fecha_nacimiento  || null,
      })

      if (resultado.modo === 'crear_todo') {
        const nuevaPersona = await createPersona(prepararPersona(formPersona))
        personaId = nuevaPersona.data.id
        await createPaciente({ ...formPaciente, persona: personaId })

      } else if (resultado.modo === 'agregar_paciente') {
        await updatePersona({ id: personaId, ...prepararPersona(formPersona) })
        await createPaciente({ ...formPaciente, persona: personaId })

      } else if (resultado.modo === 'editar') {
        await updatePersona({ id: personaId, ...prepararPersona(formPersona) })
        await updatePaciente({ id: resultado.paciente.id, ...formPaciente })

        for (const id of idsAEliminar) {
          await eliminarDoc(id)
        }
        for (const item of archivosNuevos) {
          const fd = new FormData()
          fd.append('archivo',      item.file)
          fd.append('paciente',     pacienteId)
          fd.append('tipo_doc_dig', item.tipoDocDig)
          await subirDoc(fd)
        }
      }

      markClean()
      onSuccess()

    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  const modo = resultado?.modo
  const info = modo ? MODO_INFO[modo] : null

  return (
    <>
      <style>{`
        .pf-root { width: 100%; font-family: 'DM Sans', sans-serif; }

        .pf-badge {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px; border-radius: 9px; border: 1px solid;
          font-size: 13px; font-weight: 500; margin-bottom: 20px;
        }
        .pf-badge-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: currentColor; }

        .pf-section {
          background: #ffffff; border: 1px solid #e8edf2;
          border-radius: 12px; padding: 22px 24px; margin-bottom: 14px;
        }

        @media (max-width: 480px) {
          .pf-section { padding: 16px; }
        }

        .pf-error {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px; background: #fef2f2; border: 1px solid #fecaca;
          border-radius: 9px; font-size: 13px; color: #dc2626;
          margin-bottom: 16px; font-family: 'DM Sans', sans-serif;
        }

        .pf-actions {
          display: flex; justify-content: flex-end; align-items: center; gap: 10px; padding-top: 4px;
        }
        .pf-kbd-hint {
          font-size: 10.5px; color: #9ca3af;
          display: inline-flex; align-items: center; gap: 4px;
        }
        .pf-kbd-hint-top {
          display: flex; justify-content: flex-end;
          margin-bottom: 12px;
        }
        .pf-kbd {
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 10px; font-family: 'Courier New', monospace;
          background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px;
          padding: 1px 5px; color: #6b7280; box-shadow: 0 1px 0 #b0b7c3; line-height: 1.4;
        }

        .pf-btn-cancel {
          padding: 9px 18px; font-size: 13.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; border: 1.5px solid #e5e7eb;
          border-radius: 9px; background: #ffffff; color: #6b7280;
          cursor: pointer; transition: background 0.15s, border-color 0.15s;
        }
        .pf-btn-cancel:hover { background: #f9fafb; border-color: #d1d5db; }

        .pf-btn-save {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 22px; font-size: 13.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; background: #1a3a5c; color: #ffffff;
          border: none; border-radius: 9px; cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .pf-btn-save:hover:not(:disabled) { background: #15304d; box-shadow: 0 4px 12px rgba(26,58,92,0.2); }
        .pf-btn-save:disabled { opacity: 0.55; cursor: not-allowed; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .pf-spin {
          width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%;
          animation: spin 0.7s linear infinite; flex-shrink: 0;
        }

        /* ── Documentos ── */
        .pf-doc-titulo {
          font-size: 10.5px; font-weight: 600; letter-spacing: .07em;
          text-transform: uppercase; color: #9ca3af; margin-bottom: 12px;
        }
        .pf-dropzone {
          border: 2px dashed #e5e7eb; border-radius: 10px;
          padding: 24px 16px; display: flex; flex-direction: column;
          align-items: center; gap: 8px; cursor: pointer;
          transition: border-color 0.2s, background 0.2s; background: #fafbfc;
        }
        .pf-dropzone:hover, .pf-dropzone-over {
          border-color: #1a3a5c; background: #f0f5fb;
        }
        .pf-dropzone-text { font-size: 13.5px; font-weight: 500; color: #374151; text-align: center; }
        .pf-dropzone-hint { font-size: 11.5px; color: #9ca3af; text-align: center; }

        .pf-doc-lista { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
        .pf-doc-item {
          display: flex; align-items: center; gap: 10px;
          border: 1px solid #e8edf2; border-radius: 9px;
          padding: 10px 12px; background: #fff;
          transition: opacity 0.2s;
        }
        .pf-doc-item-marcado { opacity: 0.55; background: #fafafa; }
        .pf-doc-preview-img {
          width: 40px; height: 40px; object-fit: cover;
          border-radius: 6px; flex-shrink: 0;
        }
        .pf-doc-icono-box {
          width: 40px; height: 40px; border-radius: 6px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700;
        }
        .pf-doc-info { flex: 1; min-width: 0; }
        .pf-doc-nombre {
          font-size: 12.5px; font-weight: 500; color: #111827;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          margin-bottom: 4px;
        }
        .pf-doc-select {
          width: 100%; padding: 5px 8px; border: 1px solid #e5e7eb;
          border-radius: 6px; font-size: 12px; font-family: 'DM Sans', sans-serif;
          color: #374151; background: #fff; outline: none;
        }
        .pf-doc-select:focus { border-color: #1a3a5c; }
        .pf-doc-remove {
          width: 24px; height: 24px; border-radius: 50%;
          border: 1px solid #e8edf2; background: none;
          cursor: pointer; color: #9ca3af; font-size: 11px;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s; flex-shrink: 0;
        }
        .pf-doc-remove:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
        .pf-doc-desmarcar {
          width: 24px; height: 24px; border-radius: 50%;
          border: 1px solid #e8edf2; background: none;
          cursor: pointer; color: #6b7280; font-size: 13px;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s; flex-shrink: 0;
        }
        .pf-doc-desmarcar:hover { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
        .pf-doc-error {
          padding: 8px 12px; background: #fef2f2; border: 1px solid #fecaca;
          border-radius: 7px; font-size: 12.5px; color: #dc2626;
        }
        .pf-doc-cargando {
          font-size: 12.5px; color: #9ca3af; text-align: center; padding: 12px 0;
        }
        .pf-doc-existentes { margin-bottom: 16px; }
        .pf-doc-existentes-label {
          font-size: 11px; font-weight: 600; color: #6b7280; letter-spacing: .05em;
          text-transform: uppercase; margin-bottom: 8px;
        }
        .pf-doc-nueva-label {
          font-size: 11px; font-weight: 600; color: #6b7280; letter-spacing: .05em;
          text-transform: uppercase; margin-bottom: 8px;
        }
        .pf-doc-tipo-badge {
          display: inline-block; font-size: 11px; color: #4b5563;
          background: #f3f4f6; border-radius: 4px; padding: 1px 6px;
        }
        .pf-doc-marcado-badge {
          display: inline-block; font-size: 11px; color: #dc2626;
          background: #fef2f2; border-radius: 4px; padding: 1px 6px;
        }
        .pf-doc-pendiente-badge {
          display: inline-block; font-size: 11px; color: #166534;
          background: #f0fdf4; border-radius: 4px; padding: 1px 6px;
          margin-top: 4px;
        }
        .pf-doc-confirm {
          display: flex; align-items: center; gap: 6px; flex-shrink: 0;
        }
        .pf-doc-confirm-txt {
          font-size: 12px; color: #6b7280; white-space: nowrap;
        }
        .pf-doc-confirm-si {
          padding: 3px 10px; font-size: 12px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; background: #dc2626; color: #fff;
          border: none; border-radius: 6px; cursor: pointer;
          transition: background 0.15s;
        }
        .pf-doc-confirm-si:hover { background: #b91c1c; }
        .pf-doc-confirm-no {
          padding: 3px 10px; font-size: 12px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; background: none; color: #6b7280;
          border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer;
          transition: background 0.15s;
        }
        .pf-doc-confirm-no:hover { background: #f9fafb; }
      `}</style>

      <div className="pf-root">

        {!pacienteInicial && <BuscadorPersona onResultado={setResultado} />}

        {resultado && (
          <>
            <div className="pf-kbd-hint-top">
              <span className="pf-kbd-hint">
                <span className="pf-kbd">F10</span> Guardar
              </span>
            </div>
            {info && (
              <div
                className="pf-badge"
                style={{ background: info.bg, color: info.color, borderColor: info.border }}
              >
                <div className="pf-badge-dot" />
                {info.texto}
              </div>
            )}

            <div className="pf-section">
              <FormPersona
                key={resultado.documento}
                persona={resultado.persona}
                documento={resultado.documento}
                readOnly={resultado.modo === 'agregar_paciente'}
                onChange={setFormPersona}
                errores={errores}
              />
            </div>

            <div className="pf-section">
              <FormPaciente
                key={resultado.documento}
                paciente={resultado.modo === 'editar' ? resultado.paciente : null}
                onChange={setFormPaciente}
                errores={errores}
              />
            </div>

            {resultado.modo === 'editar' && pacienteId && (
              <div className="pf-section">
                <SeccionDocumentos
                  pacienteId={pacienteId}
                  docsExistentes={docsExistentes}
                  cargandoDocs={cargandoDocs}
                  archivosNuevos={archivosNuevos}
                  setArchivosNuevos={setArchivosNuevos}
                  idsAEliminar={idsAEliminar}
                  setIdsAEliminar={setIdsAEliminar}
                  tipos={tipos}
                  errorSub={errorSub}
                  setErrorSub={setErrorSub}
                />
              </div>
            )}

            {error && (
              <div className="pf-error">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
                </svg>
                {error}
              </div>
            )}

            <div className="pf-actions">
              <button className="pf-btn-cancel" onClick={onSuccess}>
                Cancelar
              </button>
              <button
                className="pf-btn-save"
                onClick={handleGuardar}
                disabled={guardando}
              >
                {guardando
                  ? <><div className="pf-spin" /> Guardando...</>
                  : 'Guardar'
                }
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
