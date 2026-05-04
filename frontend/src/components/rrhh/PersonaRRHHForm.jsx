import { useState } from 'react'
import BuscadorPersona from '../persona/BuscadorPersona'
import FormPersona     from '../persona/FormPersona'
import FormRRHH        from '../rrhh/FormRRHH'
import { useCreatePersona, useUpdatePersona } from '../../hooks/administracion/usePersona'
import { useCreatePersonaRRHH, useUpdatePersonaRRHH } from '../../hooks/administracion/usePersonaRRHH'
import { extraerMensajeError } from '../../utils/errores'

const MODO_INFO = {
  crear_todo:       { texto: 'Documento no encontrado — completá los datos para registrar', bg: '#eff6ff', color: '#1a3a5c', border: '#bfdbfe' },
  agregar_paciente: { texto: 'Persona encontrada — completá los datos del prestador',       bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  editar:           { texto: 'Prestador existente — modo edición',                          bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
}

export default function PersonaRRHHForm({ prestadorInicial = null, onSuccess }) {
  const [resultado,    setResultado]    = useState(
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
  const [formPersona,  setFormPersona]  = useState({})
  const [formRRHH,     setFormRRHH]     = useState({})
  const [guardando,    setGuardando]    = useState(false)
  const [error,        setError]        = useState('')

  const { mutateAsync: createPersona }  = useCreatePersona()
  const { mutateAsync: updatePersona }  = useUpdatePersona()
  const { mutateAsync: createPrestador } = useCreatePersonaRRHH()
  const { mutateAsync: updatePrestador } = useUpdatePersonaRRHH()

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
        const nueva = await createPersona(prepararPersona(formPersona))
        personaId   = nueva.data.id
        await createPrestador({ ...formRRHH, persona: personaId })

      } else if (resultado.modo === 'agregar_paciente') {
        await updatePersona({ id: personaId, ...prepararPersona(formPersona) })
        await createPrestador({ ...formRRHH, persona: personaId })

      } else if (resultado.modo === 'editar') {
        await updatePersona({ id: personaId, ...prepararPersona(formPersona) })
        await updatePrestador({ id: prestadorInicial.id, ...formRRHH })
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

            {error && (
              <div className="prf-error">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{flexShrink:0}}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
                </svg>
                {error}
              </div>
            )}

            <div className="prf-actions">
              <button className="prf-btn-cancel" onClick={onSuccess}>Cancelar</button>
              <button className="prf-btn-save" onClick={handleGuardar} disabled={guardando}>
                {guardando ? <><div className="prf-spin" /> Guardando...</> : 'Guardar'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
