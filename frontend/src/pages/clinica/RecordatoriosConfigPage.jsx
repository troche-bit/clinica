import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Settings, Wifi, WifiOff, Save, ChevronDown, ChevronRight, Eye, EyeOff, Pencil, X } from 'lucide-react'
import {
  useConfiguracion,
  useUpdateConfiguracion,
  useProbarConexion,
  usePlantillas,
  useCreatePlantilla,
  useUpdatePlantilla,
  useSubirImagenPlantilla,
} from '../../hooks/mantenimiento/useRecordatorios'
import Toast from '../../components/ui/Toast'
import WysiwygEditor from '../../components/ui/WysiwygEditor'
import { useToast } from '../../hooks/useToast'
import { extraerMensajeError } from '../../utils/errores'

const TIPOS_PLANTILLA = [
  { tipo: 'recordatorio',  label: 'Recordatorio de cita' },
  { tipo: 'confirmacion',  label: 'Confirmación de reserva' },
  { tipo: 'cancelacion',   label: 'Cancelación' },
  { tipo: 'post_consulta', label: 'Post consulta' },
]

const VARIABLES = ['nombre', 'fecha', 'hora', 'medico', 'especialidad', 'indicaciones', 'observacion']

const PREVIEW_DATA = {
  nombre:       'Juan García',
  fecha:        '25/05/2026',
  hora:         '09:30',
  medico:       'Dr. López',
  especialidad: 'Pediatría',
  indicaciones: 'Tomar medicación cada 8 horas.',
  observacion:  'Primera consulta del año.',
}

function renderizarPreview(html) {
  return VARIABLES.reduce((acc, v) => acc.replaceAll(`{${v}}`, PREVIEW_DATA[v] ?? ''), html)
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="rec-cfg-toggle-wrap">
      <div
        className={`rec-cfg-toggle ${checked ? 'on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <div className="rec-cfg-toggle-knob" />
      </div>
      {label && <span className="rec-cfg-toggle-label">{label}</span>}
    </label>
  )
}

function PlantillaEditor({ plantilla, tipo, tipoLabel, onCreate, onUpdate, onToggleActiva }) {
  const [expandida, setExpandida]   = useState(false)
  const [asunto, setAsunto]         = useState(plantilla?.asunto || '')
  const [cuerpo, setCuerpo]         = useState(plantilla?.cuerpo || '')
  const [guardando, setGuardando]   = useState(false)
  const [verPreview, setVerPreview] = useState(false)
  const editorRef = useRef(null)
  const subirImg  = useSubirImagenPlantilla()
  const { toast, showToast } = useToast()

  useEffect(() => {
    if (plantilla) {
      setAsunto(plantilla.asunto || '')
      setCuerpo(plantilla.cuerpo || '')
    }
  }, [plantilla?.id])

  const insertarVar = (v) => {
    editorRef.current?.chain().focus().insertContent(`{${v}}`).run()
  }

  const handleGuardar = async () => {
    if (!asunto.trim() || !cuerpo.trim()) {
      showToast('El asunto y el cuerpo son obligatorios.', 'error')
      return
    }
    setGuardando(true)
    try {
      if (plantilla?.id) {
        await onUpdate({ id: plantilla.id, asunto: asunto.trim(), cuerpo: cuerpo.trim() })
      } else {
        await onCreate({ tipo, asunto: asunto.trim(), cuerpo: cuerpo.trim(), activa: true })
      }
      showToast('Plantilla guardada.', 'success')
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className={`rec-cfg-plantilla ${expandida ? 'expandida' : ''}`}>
      <div className="rec-cfg-plantilla-header" onClick={() => setExpandida(e => !e)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {expandida ? <ChevronDown size={14} color="#6b7280" /> : <ChevronRight size={14} color="#6b7280" />}
          <span className="rec-cfg-plantilla-tipo">{tipoLabel}</span>
          {!plantilla && <span className="rec-cfg-tag-nueva">Sin plantilla</span>}
        </div>
        <div onClick={e => e.stopPropagation()}>
          {plantilla && (
            <Toggle checked={plantilla.activa} onChange={() => onToggleActiva(plantilla)} />
          )}
        </div>
      </div>

      {expandida && (
        <div className="rec-cfg-plantilla-body">
          <div className="rec-cfg-form-group">
            <label className="rec-cfg-label">Asunto del email</label>
            <input
              className="rec-cfg-input"
              value={asunto}
              onChange={e => setAsunto(e.target.value)}
              placeholder="Ej: Recordatorio de cita — Clínica Lichi"
            />
          </div>

          <div className="rec-cfg-form-group">
            <label className="rec-cfg-label">Variables disponibles</label>
            <div className="rec-cfg-chips">
              {VARIABLES.map(v => (
                <button key={v} className="rec-cfg-chip" onClick={() => insertarVar(v)}>
                  {`{${v}}`}
                </button>
              ))}
            </div>
            <div className="rec-cfg-hint">Hacé clic en una variable para insertarla en la posición del cursor.</div>
          </div>

          <div className="rec-cfg-form-group">
            <div className="rec-cfg-editor-header">
              <label className="rec-cfg-label">Cuerpo del mensaje</label>
              <button
                className={`rec-cfg-preview-btn ${verPreview ? 'activo' : ''}`}
                onClick={() => setVerPreview(v => !v)}
              >
                {verPreview ? <EyeOff size={12} /> : <Eye size={12} />}
                {verPreview ? 'Editar' : 'Vista previa'}
              </button>
            </div>

            {!verPreview ? (
              <WysiwygEditor
                key={plantilla?.id ?? tipo}
                value={cuerpo}
                onChange={setCuerpo}
                onImageUpload={(file) => subirImg.mutateAsync(file)}
                onImageError={(err) => showToast(extraerMensajeError(err), 'error')}
                editorRef={editorRef}
                uploadPending={subirImg.isPending}
              />
            ) : (
              <div
                className="rec-cfg-preview"
                dangerouslySetInnerHTML={{
                  __html: renderizarPreview(cuerpo) || '<span style="color:#9ca3af;font-style:italic;">Sin contenido aún.</span>',
                }}
              />
            )}

            <div className="rec-cfg-hint">
              {verPreview
                ? 'Vista previa con datos de ejemplo — no refleja valores reales.'
                : 'Las imágenes se suben al servidor y quedan embebidas en la plantilla.'}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="rec-cfg-btn-save-plant" onClick={handleGuardar} disabled={guardando}>
              <Save size={13} />
              {guardando ? 'Guardando…' : plantilla?.id ? 'Guardar plantilla' : 'Crear plantilla'}
            </button>
          </div>
        </div>
      )}

      {toast && <Toast toast={toast} />}
    </div>
  )
}

export default function RecordatoriosConfigPage() {
  const navigate = useNavigate()
  const { toast, showToast } = useToast()

  const { data: conf, isLoading } = useConfiguracion()
  const updateConfig  = useUpdateConfiguracion()
  const probarConex   = useProbarConexion()
  const { data: plantillasRaw = [] } = usePlantillas()
  const createPlant   = useCreatePlantilla()
  const updatePlant   = useUpdatePlantilla()

  const [form, setForm]                   = useState(null)
  const [guardandoCfg, setGuardandoCfg]   = useState(false)
  const [conexionState, setConexionState] = useState(null)
  const [modoEdicion, setModoEdicion]     = useState(false)
  const inicializado = useRef(false)

  useEffect(() => {
    if (conf && !inicializado.current) {
      inicializado.current = true
      setForm({
        email_remitente:      conf.email_remitente      || '',
        nombre_remitente:     conf.nombre_remitente     || '',
        habilitado:           conf.habilitado            ?? false,
        auto_recordatorio:    conf.auto_recordatorio     ?? false,
        horas_anticipacion:   conf.horas_anticipacion    ?? 24,
        horas_anticipacion_2: conf.horas_anticipacion_2  ?? '',
        auto_confirmacion:    conf.auto_confirmacion     ?? true,
        auto_cancelacion:     conf.auto_cancelacion      ?? false,
      })
    }
  }, [conf])

  const setF = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const plantillasPorTipo = useMemo(() => {
    const map = {}
    for (const p of plantillasRaw) map[p.tipo] = p
    return map
  }, [plantillasRaw])

  const handleGuardarConfig = async () => {
    if (!form) return
    setGuardandoCfg(true)
    try {
      await updateConfig.mutateAsync({
        email_remitente:      form.email_remitente,
        nombre_remitente:     form.nombre_remitente,
        habilitado:           form.habilitado,
        auto_recordatorio:    form.auto_recordatorio,
        horas_anticipacion:   Number(form.horas_anticipacion) || 24,
        horas_anticipacion_2: form.horas_anticipacion_2 !== '' ? Number(form.horas_anticipacion_2) : null,
        auto_confirmacion:    form.auto_confirmacion,
        auto_cancelacion:     form.auto_cancelacion,
      })
      setModoEdicion(false)
      showToast('Configuración guardada correctamente.', 'success')
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setGuardandoCfg(false)
    }
  }

  const handleCancelarEdicion = () => {
    if (!conf) return
    setForm({
      email_remitente:      conf.email_remitente      || '',
      nombre_remitente:     conf.nombre_remitente     || '',
      habilitado:           conf.habilitado            ?? false,
      auto_recordatorio:    conf.auto_recordatorio     ?? false,
      horas_anticipacion:   conf.horas_anticipacion    ?? 24,
      horas_anticipacion_2: conf.horas_anticipacion_2  ?? '',
      auto_confirmacion:    conf.auto_confirmacion     ?? true,
      auto_cancelacion:     conf.auto_cancelacion      ?? false,
    })
    setModoEdicion(false)
  }

  const handleToggleCfg = async (key) => {
    const formActualizado = { ...form, [key]: !form[key] }
    setForm(formActualizado)
    try {
      await updateConfig.mutateAsync({
        email_remitente:      formActualizado.email_remitente,
        nombre_remitente:     formActualizado.nombre_remitente,
        habilitado:           formActualizado.habilitado,
        auto_recordatorio:    formActualizado.auto_recordatorio,
        horas_anticipacion:   Number(formActualizado.horas_anticipacion) || 24,
        horas_anticipacion_2: formActualizado.horas_anticipacion_2 !== '' ? Number(formActualizado.horas_anticipacion_2) : null,
        auto_confirmacion:    formActualizado.auto_confirmacion,
        auto_cancelacion:     formActualizado.auto_cancelacion,
      })
    } catch (err) {
      setForm(f => ({ ...f, [key]: !f[key] }))
      showToast(extraerMensajeError(err), 'error')
    }
  }

  const handleProbarConexion = async () => {
    setConexionState(null)
    try {
      const res = await probarConex.mutateAsync()
      setConexionState({ ok: true, mensaje: res.mensaje })
    } catch (err) {
      const msg = err?.response?.data?.mensaje || extraerMensajeError(err)
      setConexionState({ ok: false, mensaje: msg })
    }
  }

  const handleToggleActiva = async (plantilla) => {
    try {
      await updatePlant.mutateAsync({ id: plantilla.id, activa: !plantilla.activa })
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    }
  }

  return (
    <>
      <style>{`
        .rec-cfg-wrap { padding: 24px; width: 100%; box-sizing: border-box; }

        .rec-cfg-header {
          display: flex; align-items: center; gap: 12px; margin-bottom: 28px; flex-wrap: wrap;
        }
        .rec-cfg-header-icon {
          width: 42px; height: 42px; background: #eef2f7; border-radius: 10px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .rec-cfg-header-text { flex: 1; min-width: 0; }
        .rec-cfg-header h1 {
          font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 3px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .rec-cfg-header p  { font-size: 13px; color: #6b7280; margin: 0; }
        .rec-cfg-back {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 12px; font-weight: 500; color: #fff;
          background: #1a3a5c; border: none; border-radius: 8px;
          cursor: pointer; padding: 8px 16px; flex-shrink: 0;
          transition: background .15s;
        }
        .rec-cfg-back:hover { background: #15304d; }

        .rec-cfg-grid2 {
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;
        }

        .rec-cfg-card {
          background: #f8fafc; border: 1px solid #e8edf2;
          border-radius: 10px; padding: 16px 18px; min-width: 0;
        }
        .rec-cfg-card-titulo {
          font-size: 10.5px; font-weight: 700; color: #6b7280;
          text-transform: uppercase; letter-spacing: .06em;
          margin-bottom: 14px; padding-bottom: 8px;
          border-bottom: 1px solid #e8edf2;
        }

        .rec-cfg-form-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
        .rec-cfg-form-group:last-child { margin-bottom: 0; }
        .rec-cfg-label { font-size: 12px; font-weight: 500; color: #374151; }
        .rec-cfg-input {
          border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px;
          font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none;
          background: #fff; width: 100%; box-sizing: border-box;
        }
        .rec-cfg-input:focus { border-color: #1a3a5c; }
        .rec-cfg-input-num {
          border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px;
          font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none;
          background: #fff; width: 80px; flex-shrink: 0;
        }
        .rec-cfg-input-num:focus { border-color: #1a3a5c; }

        .rec-cfg-editor-header {
          display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;
        }
        .rec-cfg-editor-header .rec-cfg-label { margin-bottom: 0; }
        .rec-cfg-preview-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 6px; border: 1px solid #e5e7eb;
          background: #fff; color: #6b7280; font-size: 11.5px;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background .12s;
        }
        .rec-cfg-preview-btn:hover { background: #f3f4f6; }
        .rec-cfg-preview-btn.activo { background: #dbeafe; color: #1a3a5c; border-color: #bfdbfe; }

        .rec-cfg-preview {
          padding: 16px; min-height: 120px; background: #fff;
          font-size: 14px; line-height: 1.6; color: #111827;
        }
        .rec-cfg-preview img { max-width: 100%; border-radius: 4px; }

        .rec-cfg-toggle-wrap {
          display: flex; align-items: center; gap: 10px; cursor: pointer;
        }
        .rec-cfg-toggle {
          width: 38px; height: 22px; border-radius: 11px; background: #d1d5db;
          position: relative; transition: background .2s; flex-shrink: 0; cursor: pointer;
        }
        .rec-cfg-toggle.on { background: #1a3a5c; }
        .rec-cfg-toggle-knob {
          position: absolute; top: 3px; left: 3px;
          width: 16px; height: 16px; border-radius: 50%; background: #fff;
          transition: transform .2s; box-shadow: 0 1px 3px rgba(0,0,0,.2);
        }
        .rec-cfg-toggle.on .rec-cfg-toggle-knob { transform: translateX(16px); }
        .rec-cfg-toggle-label { font-size: 13px; color: #374151; }

        .rec-cfg-row-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .rec-cfg-row-toggle:last-child { margin-bottom: 0; }
        .rec-cfg-row-toggle-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .rec-cfg-row-toggle-title { font-size: 13px; font-weight: 500; color: #374151; }
        .rec-cfg-row-toggle-sub   { font-size: 11px; color: #9ca3af; }

        .rec-cfg-btn-probar {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 8px 14px; border-radius: 8px; border: 1px solid #e5e7eb;
          background: #fff; color: #374151; font-size: 12.5px;
          font-family: 'DM Sans', sans-serif; font-weight: 500;
          cursor: pointer; transition: background .12s; margin-top: 4px;
        }
        .rec-cfg-btn-probar:hover:not(:disabled) { background: #f3f4f6; }
        .rec-cfg-btn-probar:disabled { opacity: 0.6; cursor: default; }

        .rec-cfg-conexion-ok   { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #16a34a; margin-top: 8px; }
        .rec-cfg-conexion-err  { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #dc2626; margin-top: 8px; }

        .rec-cfg-btn-guardar {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 20px; border-radius: 8px; border: none;
          background: #1a3a5c; color: #fff; font-size: 13px;
          font-family: 'DM Sans', sans-serif; font-weight: 500;
          cursor: pointer; transition: background .15s;
        }
        .rec-cfg-btn-guardar:hover:not(:disabled) { background: #15304d; }
        .rec-cfg-btn-guardar:disabled { background: #9ca3af; cursor: default; }

        .rec-cfg-btn-save-plant {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 8px; border: none;
          background: #1a3a5c; color: #fff; font-size: 12px;
          font-family: 'DM Sans', sans-serif; font-weight: 500;
          cursor: pointer; transition: background .15s;
        }
        .rec-cfg-btn-save-plant:hover:not(:disabled) { background: #15304d; }
        .rec-cfg-btn-save-plant:disabled { background: #9ca3af; cursor: default; }

        .rec-cfg-plantilla {
          border: 1px solid #e8edf2; border-radius: 8px;
          overflow: hidden; margin-bottom: 8px; background: #fff;
        }
        .rec-cfg-plantilla:last-child { margin-bottom: 0; }
        .rec-cfg-plantilla.expandida { border-color: #1a3a5c; }
        .rec-cfg-plantilla-header {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          padding: 12px 14px; cursor: pointer; background: #f8fafc;
          transition: background .12s;
        }
        .rec-cfg-plantilla-header:hover { background: #f0f4f8; }
        .rec-cfg-plantilla-tipo { font-size: 13px; font-weight: 500; color: #374151; }
        .rec-cfg-tag-nueva {
          font-size: 10px; font-weight: 600; color: #d97706;
          background: #fffbeb; padding: 1px 7px; border-radius: 10px;
        }
        .rec-cfg-plantilla-body { padding: 14px; border-top: 1px solid #e8edf2; }

        .rec-cfg-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .rec-cfg-chip {
          padding: 3px 9px; border-radius: 6px; border: 1px solid #bfdbfe;
          background: #eff6ff; color: #1a3a5c; font-size: 11.5px;
          font-family: 'Courier New', monospace; cursor: pointer;
          transition: background .12s;
        }
        .rec-cfg-chip:hover { background: #dbeafe; }

        .rec-cfg-hint { font-size: 11px; color: #9ca3af; margin-top: 4px; }

        .rec-cfg-horas-row {
          display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap;
        }
        .rec-cfg-horas-row label { font-size: 12px; color: #374151; }

        .rec-cfg-cargando { color: #9ca3af; font-size: 13px; padding: 32px; text-align: center; }

        .rec-cfg-acciones-bar {
          display: flex; align-items: center; justify-content: flex-end; gap: 8px;
          margin-bottom: 24px;
        }
        .rec-cfg-btn-editar {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 8px; border: 1px solid #e5e7eb;
          background: #fff; color: #374151; font-size: 12.5px;
          font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer;
          transition: background .12s;
        }
        .rec-cfg-btn-editar:hover { background: #f3f4f6; }
        .rec-cfg-btn-cancelar {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 8px; border: 1px solid #e5e7eb;
          background: #fff; color: #6b7280; font-size: 12.5px;
          font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer;
          transition: background .12s;
        }
        .rec-cfg-btn-cancelar:hover { background: #f3f4f6; }

        .rec-cfg-field-view { margin-bottom: 12px; }
        .rec-cfg-field-view:last-of-type { margin-bottom: 0; }
        .rec-cfg-field-view-label { font-size: 11.5px; font-weight: 600; color: #6b7280; margin-bottom: 3px; text-transform: uppercase; letter-spacing: .04em; }
        .rec-cfg-field-view-val { font-size: 13px; color: #111827; }
        .rec-cfg-field-view-val.muted { color: #9ca3af; font-style: italic; }

        .rec-cfg-badge-on {
          display: inline-flex; align-items: center;
          background: #dcfce7; color: #16a34a; font-size: 11.5px;
          font-weight: 600; padding: 2px 9px; border-radius: 20px;
        }
        .rec-cfg-badge-off {
          display: inline-flex; align-items: center;
          background: #f3f4f6; color: #9ca3af; font-size: 11.5px;
          font-weight: 600; padding: 2px 9px; border-radius: 20px;
        }

        @media (max-width: 900px) {
          .rec-cfg-grid2 { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .rec-cfg-wrap { padding: 14px; }
          .rec-cfg-header h1 { font-size: 17px; }
          .rec-cfg-tool-btn span { display: none; }
          .rec-cfg-tool-btn { padding: 4px 6px; }
        }
      `}</style>

      <div className="rec-cfg-wrap">
        <div className="rec-cfg-header">
          <div className="rec-cfg-header-icon"><Settings size={20} color="#1a3a5c" /></div>
          <div className="rec-cfg-header-text">
            <h1>Configuración de notificaciones</h1>
            <p>Correo remitente, envío automático y plantillas de mensajes</p>
          </div>
          <button className="rec-cfg-back" onClick={() => navigate('/agenda/recordatorios')}>
            <ArrowLeft size={14} /> Volver
          </button>
        </div>

        {isLoading || !form ? (
          <div className="rec-cfg-cargando">Cargando configuración…</div>
        ) : (
          <>
            <div className="rec-cfg-grid2">

              {/* Correo remitente */}
              <div className="rec-cfg-card">
                <div className="rec-cfg-card-titulo">Correo remitente</div>

                {modoEdicion ? (
                  <>
                    <div className="rec-cfg-form-group">
                      <label className="rec-cfg-label">Nombre del remitente</label>
                      <input
                        className="rec-cfg-input"
                        value={form.nombre_remitente}
                        onChange={e => setF('nombre_remitente', e.target.value)}
                        placeholder="Clínica Lichi"
                      />
                    </div>
                    <div className="rec-cfg-form-group">
                      <label className="rec-cfg-label">Email remitente</label>
                      <input
                        className="rec-cfg-input"
                        type="email"
                        value={form.email_remitente}
                        onChange={e => setF('email_remitente', e.target.value)}
                        placeholder="noreply@clinicalichi.com"
                      />
                      <div className="rec-cfg-hint">
                        Debe estar verificado en Resend. Para pruebas: <code>onboarding@resend.dev</code>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rec-cfg-field-view">
                      <div className="rec-cfg-field-view-label">Nombre del remitente</div>
                      <div className={`rec-cfg-field-view-val ${!form.nombre_remitente ? 'muted' : ''}`}>
                        {form.nombre_remitente || 'Sin definir'}
                      </div>
                    </div>
                    <div className="rec-cfg-field-view">
                      <div className="rec-cfg-field-view-label">Email remitente</div>
                      <div className={`rec-cfg-field-view-val ${!form.email_remitente ? 'muted' : ''}`}>
                        {form.email_remitente || 'Sin definir'}
                      </div>
                    </div>
                  </>
                )}

                <button
                  className="rec-cfg-btn-probar"
                  onClick={handleProbarConexion}
                  disabled={probarConex.isPending}
                >
                  {probarConex.isPending
                    ? <><Wifi size={13} /> Verificando…</>
                    : <><Wifi size={13} /> Probar conexión</>
                  }
                </button>

                {conexionState && (
                  conexionState.ok
                    ? <div className="rec-cfg-conexion-ok"><Wifi size={13} /> {conexionState.mensaje}</div>
                    : <div className="rec-cfg-conexion-err"><WifiOff size={13} /> {conexionState.mensaje}</div>
                )}
              </div>

              {/* Envío automático */}
              <div className="rec-cfg-card">
                <div className="rec-cfg-card-titulo">Envío automático</div>

                <div className="rec-cfg-row-toggle">
                  <div className="rec-cfg-row-toggle-info">
                    <div className="rec-cfg-row-toggle-title">Habilitar envíos</div>
                    <div className="rec-cfg-row-toggle-sub">Activa o desactiva todos los envíos de email</div>
                  </div>
                  <Toggle checked={form.habilitado} onChange={() => handleToggleCfg('habilitado')} />
                </div>

                <div className="rec-cfg-row-toggle">
                  <div className="rec-cfg-row-toggle-info">
                    <div className="rec-cfg-row-toggle-title">Recordatorios automáticos</div>
                    <div className="rec-cfg-row-toggle-sub">Envío programado antes de la próxima cita</div>
                  </div>
                  <Toggle checked={form.auto_recordatorio} onChange={() => handleToggleCfg('auto_recordatorio')} />
                </div>

                {form.auto_recordatorio && (
                  modoEdicion ? (
                    <>
                      <div className="rec-cfg-horas-row">
                        <label>Primer recordatorio —</label>
                        <input
                          className="rec-cfg-input-num"
                          type="number" min="1" max="720"
                          value={form.horas_anticipacion}
                          onChange={e => setF('horas_anticipacion', e.target.value)}
                        />
                        <label>horas antes</label>
                      </div>
                      <div className="rec-cfg-horas-row">
                        <label>Segundo recordatorio —</label>
                        <input
                          className="rec-cfg-input-num"
                          type="number" min="1" max="720"
                          value={form.horas_anticipacion_2}
                          onChange={e => setF('horas_anticipacion_2', e.target.value)}
                          placeholder="—"
                        />
                        <label>horas antes (opcional)</label>
                      </div>
                    </>
                  ) : (
                    <div className="rec-cfg-hint" style={{ marginTop: 4, paddingLeft: 2 }}>
                      1er aviso: {form.horas_anticipacion}h antes
                      {form.horas_anticipacion_2 ? ` · 2do aviso: ${form.horas_anticipacion_2}h antes` : ''}
                    </div>
                  )
                )}

                <div className="rec-cfg-row-toggle" style={{ marginTop: 12 }}>
                  <div className="rec-cfg-row-toggle-info">
                    <div className="rec-cfg-row-toggle-title">Confirmación al asignar turno</div>
                    <div className="rec-cfg-row-toggle-sub">Envía email al confirmar una reserva</div>
                  </div>
                  <Toggle checked={form.auto_confirmacion} onChange={() => handleToggleCfg('auto_confirmacion')} />
                </div>

                <div className="rec-cfg-row-toggle">
                  <div className="rec-cfg-row-toggle-info">
                    <div className="rec-cfg-row-toggle-title">Notificación de cancelación</div>
                    <div className="rec-cfg-row-toggle-sub">Envía email al cancelar un turno</div>
                  </div>
                  <Toggle checked={form.auto_cancelacion} onChange={() => handleToggleCfg('auto_cancelacion')} />
                </div>
              </div>
            </div>

            <div className="rec-cfg-acciones-bar">
              {modoEdicion ? (
                <>
                  <button className="rec-cfg-btn-cancelar" onClick={handleCancelarEdicion} disabled={guardandoCfg}>
                    <X size={13} /> Cancelar
                  </button>
                  <button className="rec-cfg-btn-guardar" onClick={handleGuardarConfig} disabled={guardandoCfg}>
                    <Save size={14} />
                    {guardandoCfg ? 'Guardando…' : 'Guardar configuración'}
                  </button>
                </>
              ) : (
                <button className="rec-cfg-btn-editar" onClick={() => setModoEdicion(true)}>
                  <Pencil size={13} /> Editar configuración
                </button>
              )}
            </div>

            {/* Plantillas */}
            <div className="rec-cfg-card rec-cfg-card-full">
              <div className="rec-cfg-card-titulo">Plantillas de email</div>
              <div className="rec-cfg-hint" style={{ marginBottom: 14 }}>
                Hacé clic en una plantilla para expandir el editor. Los chips insertan variables en la posición del cursor.
              </div>

              {TIPOS_PLANTILLA.map(({ tipo, label }) => (
                <PlantillaEditor
                  key={tipo}
                  tipo={tipo}
                  tipoLabel={label}
                  plantilla={plantillasPorTipo[tipo] ?? null}
                  onCreate={createPlant.mutateAsync}
                  onUpdate={updatePlant.mutateAsync}
                  onToggleActiva={handleToggleActiva}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {toast && <Toast toast={toast} />}
    </>
  )
}
