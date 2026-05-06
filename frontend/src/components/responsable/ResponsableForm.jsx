import { useState } from 'react'
import BuscadorPersona  from '../persona/BuscadorPersona'
import FormPersona      from '../persona/FormPersona'
import FormResponsable  from '../responsable/FormResponsable'
import { useCreatePersona, useUpdatePersona } from '../../hooks/administracion/usePersona'
import { useCreateResponsable, useUpdateResponsable } from '../../hooks/clinica/useResponsable'
import { extraerMensajeError } from '../../utils/errores'
import { useAtajosTeclado } from '../../hooks/useAtajosTeclado'

const MODO_INFO = {
  crear_todo:       { texto: 'Documento no encontrado — completá los datos para registrar', bg: '#eff6ff', color: '#1a3a5c', border: '#bfdbfe' },
  agregar_paciente: { texto: 'Persona encontrada — completá los datos del responsable',     bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  editar:           { texto: 'Responsable existente — modo edición',                        bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
}

export default function ResponsableForm({ responsableInicial = null, onSuccess }) {
  const [resultado,       setResultado]       = useState(
    responsableInicial
      ? {
          documento:   responsableInicial.persona_detalle?.nro_documento || '',
          persona:     responsableInicial.persona_detalle,
          paciente:    responsableInicial,
          es_paciente: true,
          modo:        'editar',
        }
      : null
  )
  const [formPersona,     setFormPersona]     = useState({})
  const [formResponsable, setFormResponsable] = useState({})
  const [guardando,       setGuardando]       = useState(false)
  const [error,           setError]           = useState('')

  const { mutateAsync: createPersona }     = useCreatePersona()
  const { mutateAsync: updatePersona }     = useUpdatePersona()
  const { mutateAsync: createResponsable } = useCreateResponsable()
  const { mutateAsync: updateResponsable } = useUpdateResponsable()

  useAtajosTeclado({
    'F10': { fn: () => { if (resultado && !guardando) handleGuardar() }, soloFueraDeInputs: false },
  })

  const handleGuardar = async () => {
    setError('')
    setGuardando(true)
    try {
      let personaId = resultado.persona?.id

      const prepararPersona = (data) => ({
        ...data,
        ruc_dv: data.ruc_dv ? parseInt(data.ruc_dv) : null,
      })

      if (resultado.modo === 'crear_todo') {
        const nuevaPersona = await createPersona(prepararPersona(formPersona))
        personaId = nuevaPersona.data.id
        await createResponsable({ ...formResponsable, persona: personaId })

      } else if (resultado.modo === 'agregar_paciente') {
        await updatePersona({ id: personaId, ...prepararPersona(formPersona) })
        await createResponsable({ ...formResponsable, persona: personaId })

      } else if (resultado.modo === 'editar') {
        await updatePersona({ id: personaId, ...prepararPersona(formPersona) })
        await updateResponsable({
          id: responsableInicial.id,
          ...formResponsable,
        })
      }

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
        .rf-root { width: 100%; font-family: 'DM Sans', sans-serif; }
        .rf-badge {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px; border-radius: 9px; border: 1px solid;
          font-size: 13px; font-weight: 500; margin-bottom: 20px;
        }
        .rf-badge-dot {
          width: 7px; height: 7px; border-radius: 50%;
          flex-shrink: 0; background: currentColor;
        }
        .rf-section {
          background: #ffffff; border: 1px solid #e8edf2;
          border-radius: 12px; padding: 22px 24px; margin-bottom: 14px;
        }
        .rf-error {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px; background: #fef2f2;
          border: 1px solid #fecaca; border-radius: 9px;
          font-size: 13px; color: #dc2626; margin-bottom: 16px;
        }
        .rf-actions {
          display: flex; justify-content: flex-end; gap: 10px; padding-top: 4px;
        }
        .rf-btn-cancel {
          padding: 9px 18px; font-size: 13.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #e5e7eb; border-radius: 9px;
          background: #ffffff; color: #6b7280; cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .rf-btn-cancel:hover { background: #f9fafb; border-color: #d1d5db; }
        .rf-btn-save {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 22px; font-size: 13.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          background: #1a3a5c; color: #ffffff;
          border: none; border-radius: 9px; cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .rf-btn-save:hover:not(:disabled) {
          background: #15304d; box-shadow: 0 4px 12px rgba(26,58,92,0.2);
        }
        .rf-btn-save:disabled { opacity: 0.55; cursor: not-allowed; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .rf-spin {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%;
          animation: spin 0.7s linear infinite; flex-shrink: 0;
        }
      `}</style>

      <div className="rf-root">
        {!responsableInicial && <BuscadorPersona onResultado={setResultado} tipo="responsable" />}

        {resultado && (
          <>
            {info && (
              <div className="rf-badge" style={{ background: info.bg, color: info.color, borderColor: info.border }}>
                <div className="rf-badge-dot" />
                {info.texto}
              </div>
            )}

            <div className="rf-section">
              <FormPersona
                key={resultado.documento}
                persona={resultado.persona}
                documento={resultado.documento}
                readOnly={resultado.modo === 'agregar_paciente'}
                onChange={setFormPersona}
              />
            </div>

            <div className="rf-section">
              <FormResponsable
                key={resultado.documento}
                responsable={resultado.modo === 'editar' ? resultado.paciente : null}
                onChange={setFormResponsable}
              />
            </div>

            {error && (
              <div className="rf-error">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{flexShrink:0}}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
                </svg>
                {error}
              </div>
            )}

            <div className="rf-actions">
              <button className="rf-btn-cancel" onClick={onSuccess}>Cancelar</button>
              <button className="rf-btn-save" onClick={handleGuardar} disabled={guardando}>
                {guardando ? <><div className="rf-spin" /> Guardando...</> : 'Guardar'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
