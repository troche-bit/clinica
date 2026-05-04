import { useState } from 'react'
import BuscadorPersona from '../persona/BuscadorPersona'
import FormPersona     from '../persona/FormPersona'
import FormPaciente    from '../paciente/FormPaciente'
import { useCreatePersona, useUpdatePersona } from '../../hooks/administracion/usePersona'
import { useCreatePatient, useUpdatePatient } from '../../hooks/clinica/usePatients'

const MODO_INFO = {
  crear_todo:       { texto: 'Documento no encontrado — completá los datos para registrar', bg: '#eff6ff', color: '#1a3a5c', border: '#bfdbfe' },
  agregar_paciente: { texto: 'Persona encontrada — completá los datos del paciente',        bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  editar:           { texto: 'Paciente existente — modo edición',                           bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
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
  const [formPersona,  setFormPersona]  = useState({})
  const [formPaciente, setFormPaciente] = useState({})
  const [guardando,    setGuardando]    = useState(false)
  const [error,        setError]        = useState('')

  const { mutateAsync: createPersona } = useCreatePersona()
  const { mutateAsync: updatePersona } = useUpdatePersona()
  const { mutateAsync: createPaciente } = useCreatePatient()
  const { mutateAsync: updatePaciente } = useUpdatePatient()

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
        await createPaciente({ ...formPaciente, persona: personaId })

      } else if (resultado.modo === 'agregar_paciente') {
        await updatePersona({ id: personaId, ...prepararPersona(formPersona) })
        await createPaciente({ ...formPaciente, persona: personaId })

      } else if (resultado.modo === 'editar') {
        await updatePersona({ id: personaId, ...prepararPersona(formPersona) })
        await updatePaciente({ id: resultado.paciente.id, ...formPaciente })
      }

      onSuccess()

    } catch (err) {
      console.error('Error al guardar:', err.response?.data)
      setError('Error al guardar. Revisá los datos e intentá de nuevo.')
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
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 9px;
          border: 1px solid;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 20px;
        }
        .pf-badge-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
          background: currentColor;
        }

        .pf-section {
          background: #ffffff;
          border: 1px solid #e8edf2;
          border-radius: 12px;
          padding: 22px 24px;
          margin-bottom: 14px;
        }

        .pf-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 9px;
          font-size: 13px;
          color: #dc2626;
          margin-bottom: 16px;
          font-family: 'DM Sans', sans-serif;
        }

        .pf-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding-top: 4px;
        }

        .pf-btn-cancel {
          padding: 9px 18px;
          font-size: 13.5px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #e5e7eb;
          border-radius: 9px;
          background: #ffffff;
          color: #6b7280;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .pf-btn-cancel:hover { background: #f9fafb; border-color: #d1d5db; }

        .pf-btn-save {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 22px;
          font-size: 13.5px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          background: #1a3a5c;
          color: #ffffff;
          border: none;
          border-radius: 9px;
          cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .pf-btn-save:hover:not(:disabled) {
          background: #15304d;
          box-shadow: 0 4px 12px rgba(26,58,92,0.2);
        }
        .pf-btn-save:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        .pf-spin {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
      `}</style>

      <div className="pf-root">

        {/* Buscador */}
        {!pacienteInicial && <BuscadorPersona onResultado={setResultado} />}

        {resultado && (
          <>
            {/* Badge de modo */}
            {info && (
              <div
                className="pf-badge"
                style={{ background: info.bg, color: info.color, borderColor: info.border }}
              >
                <div className="pf-badge-dot" />
                {info.texto}
              </div>
            )}

            {/* FormPersona */}
            <div className="pf-section">
              <FormPersona
                key={resultado.documento}
                persona={resultado.persona}
                documento={resultado.documento}
                readOnly={resultado.modo === 'agregar_paciente'}
                onChange={setFormPersona}
              />
            </div>

            {/* FormPaciente */}
            <div className="pf-section">
              <FormPaciente
                key={resultado.documento}
                paciente={resultado.modo === 'editar' ? resultado.paciente : null}
                onChange={setFormPaciente}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="pf-error">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{flexShrink:0}}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
                </svg>
                {error}
              </div>
            )}

            {/* Acciones */}
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