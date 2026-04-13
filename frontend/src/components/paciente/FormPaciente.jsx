import { useEffect, useState } from 'react'
import apiClient from '../../api/client'

export default function FormPaciente({ paciente, readOnly = false, onChange }) {
  const [form, setForm] = useState({
    fecha_nacimiento:    '',
    sexo:                '',
    grupo_sanguineo:     '',
    alergias_conocidas:  '',
    enfermedades_cronicas: '',
    observacion:         '',
    responsable:         '',
    parentesco:          '',
  })
  const [responsableBuscado, setResponsableBuscado] = useState(null)
  const [docResponsable, setDocResponsable]         = useState('')
  const [buscandoResp, setBuscandoResp]             = useState(false)
  const [errorResp, setErrorResp]                   = useState('')

  const buscarResponsable = async (e) => {
    e.preventDefault()
    if (!docResponsable.trim()) return
    setErrorResp('')
    setBuscandoResp(true)
    try {
      const res = await apiClient.get(
        `/pacienteresponsable/buscar/?nro_documento=${docResponsable.trim()}`
      )

      if (res.data.es_responsable) {
        setResponsableBuscado(res.data.pacienteresponsable)
        setForm(prev => ({ ...prev, responsable: res.data.pacienteresponsable.id }))
      } else {
        setErrorResp('No se encontró un responsable con ese documento. Registralo primero en el módulo de Responsables.')
      }
    } catch (err) {
      console.log('error completo:', err)
      console.log('error response:', err.response?.data)
      setErrorResp('Error al buscar. Intentá de nuevo.')
    } finally {
      setBuscandoResp(false)
    }
  }

  const limpiarResponsable = () => {
    setResponsableBuscado(null)
    setDocResponsable('')
    setForm(prev => ({ ...prev, responsable: '' }))
  }

  // Precarga datos si paciente existe
  useEffect(() => {
    if (paciente) {
      setForm({
        fecha_nacimiento:     paciente.fecha_nacimiento     ?? '',
        sexo:                 paciente.sexo                 ?? '',
        grupo_sanguineo:      paciente.grupo_sanguineo      ?? '',
        alergias_conocidas:   paciente.alergias_conocidas   ?? '',
        enfermedades_cronicas: paciente.enfermedades_cronicas ?? '',
        observacion:          paciente.observacion          ?? '',
        responsable:          paciente.responsable          ?? '',
        parentesco:            paciente.parentesco            ?? '',
      })
    }
    if (paciente?.responsable_detalle) {
      setResponsableBuscado(paciente.responsable_detalle)
    }
  }, [paciente])

  // Notifica cambios al padre
  useEffect(() => {
    if (onChange) onChange(form)
  }, [form])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  return (
    <>
      <style>{`
        .fpa-root { width: 100%; font-family: 'DM Sans', sans-serif; }

        .fpa-section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
        }
        .fpa-section-bar {
          width: 3px;
          height: 18px;
          background: #1a3a5c;
          border-radius: 4px;
          flex-shrink: 0;
        }
        .fpa-section-label {
          font-size: 13px;
          font-weight: 600;
          color: #1a3a5c;
          letter-spacing: 0.02em;
        }

        .fpa-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 600px) {
          .fpa-grid { grid-template-columns: 1fr; }
        }
        .fpa-col-2 { grid-column: span 2; }
        @media (max-width: 600px) {
          .fpa-col-2 { grid-column: span 1; }
        }

        .fpa-field { display: flex; flex-direction: column; gap: 5px; }

        .fpa-label {
          font-size: 12.5px;
          font-weight: 500;
          color: #374151;
        }

        .fpa-input,
        .fpa-select,
        .fpa-textarea {
          width: 100%;
          padding: 9px 12px;
          border: 1.5px solid #e5e7eb;
          border-radius: 9px;
          font-size: 13.5px;
          font-family: 'DM Sans', sans-serif;
          color: #111827;
          background: #ffffff;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          appearance: none;
          -webkit-appearance: none;
        }
        .fpa-input:focus,
        .fpa-select:focus,
        .fpa-textarea:focus {
          border-color: #1a3a5c;
          box-shadow: 0 0 0 3px rgba(26,58,92,0.08);
        }
        .fpa-input::placeholder,
        .fpa-textarea::placeholder { color: #d1d5db; }
        .fpa-input:disabled,
        .fpa-select:disabled,
        .fpa-textarea:disabled {
          background: #f8fafc;
          color: #9ca3af;
          cursor: not-allowed;
          border-color: #f0f4f8;
        }
        .fpa-textarea { resize: vertical; min-height: 80px; line-height: 1.5; }

        .fpa-select-wrap { position: relative; }
        .fpa-select-wrap::after {
          content: '';
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 0; height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-top: 5px solid #9ca3af;
          pointer-events: none;
        }
        .fpa-select-wrap .fpa-select { padding-right: 32px; }

        .fpa-hint {
          font-size: 11.5px;
          color: #9ca3af;
        }

        .fpa-divider {
          grid-column: span 2;
          height: 1px;
          background: #f0f4f8;
          margin: 4px 0;
        }
        .fpa-subsection {
          grid-column: span 2;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: #9ca3af;
          margin-top: 4px;
        }
        @media (max-width: 600px) {
          .fpa-divider, .fpa-subsection { grid-column: span 1; }
        }

        .fpa-alert-field {
          background: #fff8f0;
          border: 1.5px solid #fed7aa;
          border-radius: 9px;
          padding: 9px 12px;
        }
        .fpa-alert-field:focus {
          border-color: #f97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.08);
          background: #ffffff;
        }
        .fpa-alert-field:disabled {
          background: #f8fafc;
          border-color: #f0f4f8;
          color: #9ca3af;
          cursor: not-allowed;
        }
      `}</style>

      <div className="fpa-root">
        <div className="fpa-section-title">
          <div className="fpa-section-bar" />
          <span className="fpa-section-label">Datos del Paciente</span>
        </div>

        <div className="fpa-grid">

          {/* ── Datos generales ── */}
          <div className="fpa-field">
            <label className="fpa-label">Fecha de nacimiento</label>
            <input
              type="date"
              name="fecha_nacimiento"
              value={form.fecha_nacimiento}
              onChange={handleChange}
              disabled={readOnly}
              className="fpa-input"
            />
          </div>

          <div className="fpa-field">
            <label className="fpa-label">Sexo</label>
            <div className="fpa-select-wrap">
              <select
                name="sexo"
                value={form.sexo}
                onChange={handleChange}
                disabled={readOnly}
                className="fpa-select"
              >
                <option value="">Seleccioná...</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="O">Otro</option>
              </select>
            </div>
          </div>

          <div className="fpa-field">
            <label className="fpa-label">Grupo sanguíneo</label>
            <div className="fpa-select-wrap">
              <select
                name="grupo_sanguineo"
                value={form.grupo_sanguineo}
                onChange={handleChange}
                disabled={readOnly}
                className="fpa-select"
              >
                <option value="">Seleccioná...</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="desconocido">Desconocido</option>
              </select>
            </div>
          </div>

          {/* Responsable */}
          <div className="fpa-field fpa-col-2">
            <label className="fpa-label">Responsable</label>

            {!responsableBuscado ? (
              <form onSubmit={buscarResponsable} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={docResponsable}
                  onChange={(e) => setDocResponsable(e.target.value)}
                  placeholder="Nro. de documento del responsable..."
                  className="fpa-input"
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  disabled={buscandoResp || !docResponsable.trim()}
                  style={{
                    padding: '9px 14px', background: '#1a3a5c', color: '#fff',
                    border: 'none', borderRadius: '9px', fontSize: '13px',
                    cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif',
                    opacity: buscandoResp ? 0.6 : 1,
                  }}
                >
                  {buscandoResp ? 'Buscando...' : 'Buscar'}
                </button>
              </form>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: '#f0fdf4',
                border: '1.5px solid #bbf7d0', borderRadius: '9px',
              }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#111827' }}>
                    {responsableBuscado.persona_detalle?.razon_social}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {responsableBuscado.persona_detalle?.nro_documento}
                  </div>
                </div>
                <button onClick={limpiarResponsable} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6b7280', fontSize: '18px', lineHeight: 1,
                }}>×</button>
              </div>
            )}

            {errorResp && (
              <span style={{ fontSize: '12px', color: '#dc2626' }}>{errorResp}</span>
            )}
            <span className="fpa-hint">Opcional — registralo primero en el módulo de Responsables</span>
          </div>

          {/* Parentesco — solo visible si hay responsable */}
          {responsableBuscado && (
            <div className="fpa-field fpa-col-2">
              <label className="fpa-label">Parentesco</label>
              <input
                type="text"
                name="parentesco"
                value={form.parentesco}
                onChange={handleChange}
                disabled={readOnly}
                placeholder="Ej: Madre, Padre, Tutor..."
                className="fpa-input"
              />
            </div>
          )}

          {/* ── Antecedentes clínicos ── */}
          <div className="fpa-divider" />
          <div className="fpa-subsection">Antecedentes clínicos</div>

          <div className="fpa-field fpa-col-2">
            <label className="fpa-label">Alergias conocidas</label>
            <input
              type="text"
              name="alergias_conocidas"
              value={form.alergias_conocidas}
              onChange={handleChange}
              disabled={readOnly}
              placeholder="Ej: Penicilina, Ibuprofeno, látex..."
              className={`fpa-input ${!readOnly ? 'fpa-alert-field' : ''}`}
            />
            <span className="fpa-hint">Separar con comas si hay más de una</span>
          </div>

          <div className="fpa-field fpa-col-2">
            <label className="fpa-label">Enfermedades crónicas</label>
            <input
              type="text"
              name="enfermedades_cronicas"
              value={form.enfermedades_cronicas}
              onChange={handleChange}
              disabled={readOnly}
              placeholder="Ej: Hipertensión, Diabetes tipo 2..."
              className="fpa-input"
            />
            <span className="fpa-hint">Separar con comas si hay más de una</span>
          </div>

          {/* ── Observaciones ── */}
          <div className="fpa-divider" />
          <div className="fpa-subsection">Notas</div>

          <div className="fpa-field fpa-col-2">
            <label className="fpa-label">Observaciones</label>
            <textarea
              name="observacion"
              value={form.observacion}
              onChange={handleChange}
              disabled={readOnly}
              rows={3}
              placeholder="Observaciones adicionales sobre el paciente..."
              className="fpa-textarea"
            />
          </div>

        </div>
      </div>
    </>
  )
}