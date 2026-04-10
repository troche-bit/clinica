import { useEffect, useState } from 'react'

export default function FormResponsable({ responsable, readOnly = false, onChange }) {
  const [form, setForm] = useState({
    grupo_sanguineo:        '',
    ocupacion:              '',
    es_contacto_emergencia: true,
    observacion:            '',
  })

  useEffect(() => {
    if (responsable) {
      setForm({
        grupo_sanguineo:        responsable.grupo_sanguineo        ?? '',
        ocupacion:              responsable.ocupacion              ?? '',
        es_contacto_emergencia: responsable.es_contacto_emergencia ?? true,
        observacion:            responsable.observacion            ?? '',
      })
    }
  }, [responsable])

  useEffect(() => {
    if (onChange) onChange(form)
  }, [form])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  return (
    <>
      <style>{`
        .fr-root { width: 100%; font-family: 'DM Sans', sans-serif; }
        .fr-section-title { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .fr-section-bar { width: 3px; height: 18px; background: #1a3a5c; border-radius: 4px; flex-shrink: 0; }
        .fr-section-label { font-size: 13px; font-weight: 600; color: #1a3a5c; letter-spacing: 0.02em; }
        .fr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 600px) { .fr-grid { grid-template-columns: 1fr; } }
        .fr-col-2 { grid-column: span 2; }
        @media (max-width: 600px) { .fr-col-2 { grid-column: span 1; } }
        .fr-field { display: flex; flex-direction: column; gap: 5px; }
        .fr-label { font-size: 12.5px; font-weight: 500; color: #374151; }
        .fr-input, .fr-select, .fr-textarea {
          width: 100%; padding: 9px 12px; border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #111827;
          background: #ffffff; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
          appearance: none; -webkit-appearance: none;
        }
        .fr-input:focus, .fr-select:focus, .fr-textarea:focus {
          border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08);
        }
        .fr-input::placeholder, .fr-textarea::placeholder { color: #d1d5db; }
        .fr-input:disabled, .fr-select:disabled, .fr-textarea:disabled {
          background: #f8fafc; color: #9ca3af; cursor: not-allowed; border-color: #f0f4f8;
        }
        .fr-textarea { resize: vertical; min-height: 80px; line-height: 1.5; }
        .fr-select-wrap { position: relative; }
        .fr-select-wrap::after {
          content: ''; position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          width: 0; height: 0; border-left: 4px solid transparent;
          border-right: 4px solid transparent; border-top: 5px solid #9ca3af; pointer-events: none;
        }
        .fr-select-wrap .fr-select { padding-right: 32px; }
        .fr-hint { font-size: 11.5px; color: #9ca3af; }
        .fr-divider { grid-column: span 2; height: 1px; background: #f0f4f8; margin: 4px 0; }
        @media (max-width: 600px) { .fr-divider { grid-column: span 1; } }
        .fr-checkbox-row {
          display: flex; align-items: center; gap: 10px; padding: 10px 14px;
          background: #f8fafc; border: 1.5px solid #e5e7eb; border-radius: 9px;
          cursor: pointer; transition: border-color 0.2s, background 0.2s;
        }
        .fr-checkbox { width: 16px; height: 16px; accent-color: #1a3a5c; cursor: pointer; flex-shrink: 0; }
        .fr-checkbox-label { font-size: 13px; color: #374151; cursor: pointer; user-select: none; }
      `}</style>

      <div className="fr-root">
        <div className="fr-section-title">
          <div className="fr-section-bar" />
          <span className="fr-section-label">Datos del Responsable</span>
        </div>

        <div className="fr-grid">

          <div className="fr-field">
            <label className="fr-label">Grupo sanguíneo</label>
            <div className="fr-select-wrap">
              <select name="grupo_sanguineo" value={form.grupo_sanguineo} onChange={handleChange} disabled={readOnly} className="fr-select">
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

          <div className="fr-field">
            <label className="fr-label">Ocupación</label>
            <input
              type="text" name="ocupacion" value={form.ocupacion}
              onChange={handleChange} disabled={readOnly}
              placeholder="Ej: Docente, Comerciante..." className="fr-input"
            />
          </div>

          <div className="fr-divider" />

          <div className="fr-field fr-col-2">
            <label className="fr-label">Contacto de emergencia</label>
            <label className="fr-checkbox-row" style={form.es_contacto_emergencia ? { borderColor: '#1a3a5c', background: '#eff6ff' } : {}}>
              <input
                type="checkbox" name="es_contacto_emergencia"
                checked={form.es_contacto_emergencia}
                onChange={handleChange} disabled={readOnly} className="fr-checkbox"
              />
              <span className="fr-checkbox-label">Es contacto de emergencia del paciente</span>
            </label>
          </div>

          <div className="fr-field fr-col-2">
            <label className="fr-label">Observaciones</label>
            <textarea
              name="observacion" value={form.observacion}
              onChange={handleChange} disabled={readOnly} rows={3}
              placeholder="Observaciones adicionales sobre el responsable..."
              className="fr-textarea"
            />
          </div>

        </div>
      </div>
    </>
  )
}