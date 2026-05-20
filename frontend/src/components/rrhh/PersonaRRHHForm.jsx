import { useState, useRef, useEffect } from 'react'
import BuscadorPersona from '../persona/BuscadorPersona'
import FormPersona     from '../persona/FormPersona'
import FormRRHH        from '../rrhh/FormRRHH'
import { useCreatePersona, useUpdatePersona } from '../../hooks/administracion/usePersona'
import { useCreatePersonaRRHH, useUpdatePersonaRRHH } from '../../hooks/administracion/usePersonaRRHH'
import { extraerMensajeError } from '../../utils/errores'
import { useAtajosTeclado } from '../../hooks/useAtajosTeclado'
import { useNavigationGuard } from '../../hooks/useNavigationGuard'
import { useTipoDocDig } from '../../hooks/mantenimiento/useTipoDocDig'
import {
  useDocumentosPorPrestador,
  useSubirDocumentoPrestador,
  useDeleteDocumentoPrestador,
} from '../../hooks/mantenimiento/useDocumentos'
import { Eye } from 'lucide-react'

const EXTENSIONES_IMAGEN = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']

async function fetchDocumentoPrestadorBlob(docId) {
  const token = localStorage.getItem('access_token')
  const res = await fetch(`/api/documentos-prestador/${docId}/descargar/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('No se pudo obtener el documento.')
  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  const buffer = await res.arrayBuffer()
  return new Blob([buffer], { type: contentType })
}

const TIPOS_ACEPTADOS = ['image/jpeg','image/jpg','image/png','image/gif','image/webp','image/bmp','application/pdf']

function fileIconInfo(nombre) {
  const ext = nombre?.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return { bg: '#fee2e2', color: '#dc2626', label: 'PDF' }
  if (['jpg','jpeg','png'].includes(ext)) return { bg: '#eff6ff', color: '#1d4ed8', label: ext?.toUpperCase() }
  return { bg: '#f9fafb', color: '#6b7280', label: ext?.toUpperCase() || '?' }
}

function SeccionDocumentosEdit({ personaRrhhId, archivosNuevos, setArchivosNuevos, idsAEliminar, setIdsAEliminar, tipos, errorSub, setErrorSub }) {
  const [dragOver,      setDragOver]      = useState(false)
  const [abriendoDoc,   setAbriendoDoc]   = useState(null)
  const [imagenPreview, setImagenPreview] = useState(null)
  const inputRef = useRef(null)
  const { data: docs = [], isLoading: cargandoDocs } = useDocumentosPorPrestador(personaRrhhId)

  const handleVerDoc = async (doc) => {
    setAbriendoDoc(doc.id)
    try {
      const blob = await fetchDocumentoPrestadorBlob(doc.id)
      const url  = URL.createObjectURL(blob)
      const ext  = (doc.filename || '').split('.').pop().toLowerCase()
      if (EXTENSIONES_IMAGEN.includes(ext)) {
        setImagenPreview({ url, filename: doc.filename })
      } else {
        window.open(url, '_blank')
      }
    } catch { /* silencioso */ }
    finally { setAbriendoDoc(null) }
  }

  const agregarArchivos = (files) => {
    const defaultTipo = tipos[0]?.id?.toString() || ''
    const validos = Array.from(files).filter(f => TIPOS_ACEPTADOS.includes(f.type))
    const invalidos = Array.from(files).length - validos.length
    if (invalidos > 0) setErrorSub(`${invalidos} archivo${invalidos > 1 ? 's' : ''} ignorado${invalidos > 1 ? 's' : ''} — solo se aceptan PDF e imágenes.`)
    else setErrorSub('')
    if (validos.length === 0) return
    setArchivosNuevos(prev => [
      ...prev,
      ...validos.map(file => ({
        uid:        Math.random().toString(36).slice(2),
        file,
        tipoDocDig: defaultTipo,
        preview:    file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      })),
    ])
  }

  const quitarArchivo = (uid) => {
    setArchivosNuevos(prev => {
      const item = prev.find(a => a.uid === uid)
      if (item?.preview) URL.revokeObjectURL(item.preview)
      return prev.filter(a => a.uid !== uid)
    })
  }

  const toggleEliminar = (id) => {
    setIdsAEliminar(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  return (
    <div>
      {imagenPreview && (
        <div className="prf-img-overlay" onClick={() => setImagenPreview(null)}>
          <img
            src={imagenPreview.url}
            alt={imagenPreview.filename}
            className="prf-img-preview"
            onClick={e => e.stopPropagation()}
          />
          <button className="prf-img-close" onClick={() => setImagenPreview(null)}>✕</button>
        </div>
      )}

      {cargandoDocs && <div className="prf-doc-cargando">Cargando documentos…</div>}

      {!cargandoDocs && docs.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="prf-doc-label">Archivos guardados</div>
          <div className="prf-doc-lista">
            {docs.map(doc => {
              const info   = fileIconInfo(doc.filename || '')
              const marcado = idsAEliminar.has(doc.id)
              return (
                <div key={doc.id} className={`prf-doc-item${marcado ? ' prf-doc-item-marcado' : ''}`}>
                  <div className="prf-doc-icono-box" style={{ background: info.bg, color: info.color }}>{info.label}</div>
                  <div className="prf-doc-info">
                    <div className="prf-doc-nombre" style={marcado ? { textDecoration: 'line-through', color: '#9ca3af' } : {}}>
                      {doc.filename || `Documento #${doc.id}`}
                    </div>
                    {marcado
                      ? <div className="prf-doc-aviso-eliminar">Se eliminará al guardar</div>
                      : doc.tipo_doc_dig_descripcion && <div className="prf-doc-tipo-badge">{doc.tipo_doc_dig_descripcion}</div>
                    }
                  </div>
                  <button
                    className="prf-doc-dl-btn"
                    onClick={() => handleVerDoc(doc)}
                    disabled={abriendoDoc === doc.id}
                    title="Ver documento"
                  >
                    {abriendoDoc === doc.id ? '…' : <Eye size={13} />}
                  </button>
                  {marcado
                    ? <button className="prf-doc-undo-btn" onClick={() => toggleEliminar(doc.id)} title="Deshacer">↩</button>
                    : <button className="prf-doc-remove" onClick={() => toggleEliminar(doc.id)} title="Marcar para eliminar">✕</button>
                  }
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="prf-doc-label">Subir nuevos archivos</div>
      <div
        className={`prf-dropzone${dragOver ? ' prf-dropzone-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); agregarArchivos(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" multiple accept="image/*,application/pdf"
          style={{ display: 'none' }}
          onChange={e => { agregarArchivos(e.target.files); e.target.value = '' }}
        />
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: '#9ca3af', flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <div className="prf-dropzone-text">Arrastrá archivos o hacé clic para seleccionar</div>
        <div className="prf-dropzone-hint">PDF e imágenes · múltiples archivos</div>
      </div>

      {archivosNuevos.length > 0 && (
        <div className="prf-doc-lista" style={{ marginTop: 10 }}>
          {archivosNuevos.map(item => {
            const info = fileIconInfo(item.file.name)
            return (
              <div key={item.uid} className="prf-doc-item">
                {item.preview
                  ? <img src={item.preview} alt={item.file.name} className="prf-doc-preview-img" />
                  : <div className="prf-doc-icono-box" style={{ background: info.bg, color: info.color }}>{info.label}</div>
                }
                <div className="prf-doc-info">
                  <div className="prf-doc-nombre">{item.file.name}</div>
                  <select
                    value={item.tipoDocDig}
                    onChange={e => setArchivosNuevos(prev => prev.map(a => a.uid === item.uid ? { ...a, tipoDocDig: e.target.value } : a))}
                    className="prf-doc-select"
                  >
                    <option value="">— Tipo de documento —</option>
                    {tipos.map(t => <option key={t.id} value={t.id}>{t.descripcion}</option>)}
                  </select>
                  <div className="prf-doc-aviso-nuevo">Se subirá al guardar</div>
                </div>
                <button className="prf-doc-remove" onClick={() => quitarArchivo(item.uid)} title="Quitar">✕</button>
              </div>
            )
          })}
          {errorSub && <div className="prf-doc-error">{errorSub}</div>}
        </div>
      )}
    </div>
  )
}

const MODO_INFO = {
  crear_todo:       { texto: 'Documento no encontrado — completá los datos para registrar', bg: '#eff6ff', color: '#1a3a5c', border: '#bfdbfe' },
  agregar_paciente: { texto: 'Persona encontrada — completá los datos del prestador',       bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  editar:           { texto: 'Prestador existente — modo edición',                          bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
}

export default function PersonaRRHHForm({ prestadorInicial = null, onSuccess, onCancel }) {
  const [resultado,      setResultado]      = useState(
    prestadorInicial
      ? {
          documento:   prestadorInicial.persona_detalle?.nro_documento || '',
          persona:     prestadorInicial.persona_detalle,
          paciente:    prestadorInicial,
          es_paciente: true,
          modo:        'editar',
        }
      : null
  )
  const [formPersona,    setFormPersona]    = useState({})
  const [formRRHH,       setFormRRHH]       = useState({})
  const [guardando,      setGuardando]      = useState(false)
  const [error,          setError]          = useState('')
  const [archivosNuevos, setArchivosNuevos] = useState([])
  const [idsAEliminar,   setIdsAEliminar]   = useState(new Set())
  const [errorSub,       setErrorSub]       = useState('')

  const { markDirty, markClean } = useNavigationGuard()

  useEffect(() => { if (resultado) markDirty() }, [resultado])
  useEffect(() => () => {
    archivosNuevos.forEach(a => { if (a.preview) URL.revokeObjectURL(a.preview) })
    markClean()
  }, [markClean])

  const { mutateAsync: createPersona }   = useCreatePersona()
  const { mutateAsync: updatePersona }   = useUpdatePersona()
  const { mutateAsync: createPrestador } = useCreatePersonaRRHH()
  const { mutateAsync: updatePrestador } = useUpdatePersonaRRHH()
  const { mutateAsync: subirDoc }        = useSubirDocumentoPrestador()
  const { mutateAsync: eliminarDoc }     = useDeleteDocumentoPrestador()
  const { data: tiposRaw }               = useTipoDocDig()
  const tipos                            = tiposRaw?.results ?? tiposRaw ?? []

  useAtajosTeclado({
    'F10': { fn: () => { if (resultado && !guardando) handleGuardar() }, soloFueraDeInputs: false },
  })

  const handleGuardar = async () => {
    if (!formRRHH.fecha_ingreso || !formRRHH.cargo || !formRRHH.tipo_contrato) {
      setError('Fecha de ingreso, cargo y tipo de contrato son obligatorios.')
      return
    }
    const sinTipo = archivosNuevos.find(a => !a.tipoDocDig)
    if (sinTipo) {
      setErrorSub('Seleccioná el tipo de documento para cada archivo.')
      return
    }
    setError('')
    setErrorSub('')
    setGuardando(true)
    try {
      let personaId  = resultado.persona?.id
      let prestadorId = prestadorInicial?.id

      const prepararPersona = (data) => ({
        ...data,
        ruc_dv: data.ruc_dv ? parseInt(data.ruc_dv) : null,
      })

      if (resultado.modo === 'crear_todo') {
        const nueva  = await createPersona(prepararPersona(formPersona))
        personaId    = nueva.data.id
        const nuevo  = await createPrestador({ ...formRRHH, persona: personaId })
        prestadorId  = nuevo.data.id

      } else if (resultado.modo === 'agregar_paciente') {
        await updatePersona({ id: personaId, ...prepararPersona(formPersona) })
        const nuevo = await createPrestador({ ...formRRHH, persona: personaId })
        prestadorId = nuevo.data.id

      } else if (resultado.modo === 'editar') {
        await updatePersona({ id: personaId, ...prepararPersona(formPersona) })
        await updatePrestador({ id: prestadorId, ...formRRHH })
      }

      for (const id of idsAEliminar) { await eliminarDoc(id) }
      for (const item of archivosNuevos) {
        const fd = new FormData()
        fd.append('archivo',      item.file)
        fd.append('persona_rrhh', prestadorId)
        fd.append('tipo_doc_dig', item.tipoDocDig)
        await subirDoc(fd)
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
        .prf-root { width: 100%; font-family: 'DM Sans', sans-serif; }
        .prf-badge {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px; border-radius: 9px; border: 1px solid;
          font-size: 13px; font-weight: 500; margin-bottom: 20px;
        }
        .prf-badge-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: currentColor; }
        .prf-section {
          background: #ffffff; border: 1px solid #e8edf2;
          border-radius: 12px; padding: 22px 24px; margin-bottom: 14px;
        }
        .prf-error {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px; background: #fef2f2;
          border: 1px solid #fecaca; border-radius: 9px;
          font-size: 13px; color: #dc2626; margin-bottom: 16px;
        }
        .prf-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 4px; }
        .prf-btn-cancel {
          padding: 9px 18px; font-size: 13.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #e5e7eb; border-radius: 9px;
          background: #ffffff; color: #6b7280; cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .prf-btn-cancel:hover { background: #f9fafb; border-color: #d1d5db; }
        .prf-btn-save {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 22px; font-size: 13.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          background: #1a3a5c; color: #ffffff;
          border: none; border-radius: 9px; cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .prf-btn-save:hover:not(:disabled) { background: #15304d; box-shadow: 0 4px 12px rgba(26,58,92,0.2); }
        .prf-btn-save:disabled { opacity: 0.55; cursor: not-allowed; }
        @keyframes prf-spin { to { transform: rotate(360deg); } }
        .prf-spin {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%;
          animation: prf-spin 0.7s linear infinite; flex-shrink: 0;
        }
        .prf-btn-save-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .prf-btn-save-hint { font-size: 10.5px; color: #9ca3af; }
        .prf-doc-titulo {
          font-size: 12px; font-weight: 600; letter-spacing: .06em;
          text-transform: uppercase; color: #9ca3af; margin-bottom: 14px;
        }
        .prf-doc-cargando { font-size: 12.5px; color: #9ca3af; text-align: center; padding: 12px 0; }
        .prf-doc-label {
          font-size: 11px; font-weight: 600; color: #6b7280; letter-spacing: .05em;
          text-transform: uppercase; margin-bottom: 8px;
        }
        .prf-doc-lista { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
        .prf-doc-item {
          display: flex; align-items: center; gap: 10px;
          border: 1px solid #e8edf2; border-radius: 9px;
          padding: 10px 12px; background: #fff;
          transition: opacity 0.2s;
        }
        .prf-doc-item-marcado { opacity: 0.55; background: #fafafa; }
        .prf-doc-preview-img {
          width: 40px; height: 40px; object-fit: cover;
          border-radius: 6px; flex-shrink: 0;
        }
        .prf-doc-icono-box {
          width: 40px; height: 40px; border-radius: 6px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700;
        }
        .prf-doc-info { flex: 1; min-width: 0; }
        .prf-doc-nombre {
          font-size: 12.5px; font-weight: 500; color: #111827;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          margin-bottom: 4px;
        }
        .prf-doc-tipo-badge {
          display: inline-block; font-size: 10.5px; background: #eff6ff;
          color: #1d4ed8; padding: 1px 7px; border-radius: 20px; font-weight: 500;
        }
        .prf-doc-aviso-eliminar { font-size: 10.5px; color: #dc2626; margin-top: 2px; }
        .prf-doc-aviso-nuevo { font-size: 10.5px; color: #16a34a; margin-top: 2px; }
        .prf-doc-select {
          width: 100%; padding: 5px 8px; border: 1px solid #e5e7eb;
          border-radius: 6px; font-size: 12px; font-family: 'DM Sans', sans-serif;
          color: #374151; background: #fff; outline: none;
        }
        .prf-doc-select:focus { border-color: #1a3a5c; }
        .prf-doc-dl-btn {
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 7px; border: 1px solid #e5e7eb;
          background: #fff; color: #6b7280; cursor: pointer; flex-shrink: 0;
        }
        .prf-doc-dl-btn:hover { background: #f0f4f8; color: #1a3a5c; }
        .prf-doc-remove {
          width: 24px; height: 24px; border-radius: 50%;
          border: 1px solid #e8edf2; background: none;
          cursor: pointer; color: #9ca3af; font-size: 11px;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s; flex-shrink: 0;
        }
        .prf-doc-remove:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
        .prf-doc-undo-btn {
          width: 24px; height: 24px; border-radius: 50%;
          border: 1px solid #e8edf2; background: none;
          cursor: pointer; color: #6b7280; font-size: 13px;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s; flex-shrink: 0;
        }
        .prf-doc-undo-btn:hover { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
        .prf-doc-error {
          padding: 8px 12px; background: #fef2f2; border: 1px solid #fecaca;
          border-radius: 7px; font-size: 12.5px; color: #dc2626;
        }
        .prf-dropzone {
          border: 2px dashed #d1d5db; border-radius: 10px; padding: 20px 16px;
          text-align: center; cursor: pointer; transition: border-color 0.2s, background 0.2s;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          background: #fafafa; margin-bottom: 4px; margin-top: 12px;
        }
        .prf-dropzone:hover, .prf-dropzone-over { border-color: #1a3a5c; background: #f0f5fb; }
        .prf-dropzone-text { font-size: 13.5px; font-weight: 500; color: #374151; text-align: center; }
        .prf-dropzone-hint { font-size: 11.5px; color: #9ca3af; text-align: center; }
        .prf-img-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.82); z-index: 9999;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .prf-img-preview {
          max-width: 90vw; max-height: 90vh; border-radius: 8px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.5); cursor: default;
        }
        .prf-img-close {
          position: absolute; top: 16px; right: 16px;
          background: rgba(255,255,255,0.15); border: none; color: #fff;
          font-size: 18px; cursor: pointer; width: 36px; height: 36px;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .prf-img-close:hover { background: rgba(255,255,255,0.3); }
      `}</style>

      <div className="prf-root">
        {!prestadorInicial && <BuscadorPersona onResultado={setResultado} tipo="rrhh" />}

        {resultado && (
          <>
            {info && (
              <div className="prf-badge" style={{ background: info.bg, color: info.color, borderColor: info.border }}>
                <div className="prf-badge-dot" />
                {info.texto}
              </div>
            )}

            <div className="prf-section">
              <FormPersona
                key={resultado.documento}
                persona={resultado.persona}
                documento={resultado.documento}
                readOnly={resultado.modo === 'agregar_paciente'}
                onChange={setFormPersona}
              />
            </div>

            <div className="prf-section">
              <FormRRHH
                key={resultado.documento}
                prestador={resultado.modo === 'editar' ? resultado.paciente : null}
                onChange={setFormRRHH}
              />
            </div>

            {resultado.modo === 'editar' && prestadorInicial?.id && (
              <div className="prf-section">
                <div className="prf-doc-titulo">Documentos digitalizados</div>
                <SeccionDocumentosEdit
                  personaRrhhId={prestadorInicial.id}
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
              <div className="prf-error">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{flexShrink:0}}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
                </svg>
                {error}
              </div>
            )}

            <div className="prf-actions">
              <button className="prf-btn-cancel" onClick={onCancel ?? onSuccess}>Cancelar</button>
              <div className="prf-btn-save-wrap">
                <button className="prf-btn-save" onClick={handleGuardar} disabled={guardando}>
                  {guardando ? <><div className="prf-spin" /> Guardando...</> : 'Guardar'}
                </button>
                <span className="prf-btn-save-hint">F10 para guardar</span>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
