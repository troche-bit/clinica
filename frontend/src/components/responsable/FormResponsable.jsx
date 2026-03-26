import { useEffect, useState } from 'react'

export default function FormResponsable({ responsable, readOnly = false, onChange }) {
  const [form, setForm] = useState({
    parentesco: '',
  })

  useEffect(() => {
    if (responsable) {
      setForm({
        parentesco: responsable.parentesco ?? '',
      })
    }
  }, [responsable])

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
        .fr-root { width: 100%; font-family: 'DM Sans', sans-serif; }
        .fr-section-title {
          display: flex; align-items: center; gap: 10px; margin-bottom: 20px;
        }
        .fr-section-bar {
          width: 3px; height: 18px; background: #1a3a5c;
          border-radius: 4px; flex-shrink: 0;
        }
        .fr-section-label {
          font-size: 13px; font-weight: 600; color: #1a3a5c; letter-spacing: 0.02em;
        }
        .fr-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
        }
        @media (max-width: 600px) { .fr-grid { grid-template-columns: 1fr; } }
        .fr-col-2 { grid-column: span 2; }
        @media (max-width: 600px) { .fr-col-2 { grid-column: span 1; } }
        .fr-field { display: flex; flex-direction: column; gap: 5px; }
        .fr-label { font-size: 12.5px; font-weight: 500; color: #374151; }
        .fr-input, .fr-select {
          width: 100%; padding: 9px 12px;
          border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif;
          color: #111827; background: #ffffff; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          appearance: none; -webkit-appearance: none;
        }
        .fr-input:focus, .fr-select:focus {
          border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08);
        }
        .fr-input::placeholder { color: #d1d5db; }
        .fr-input:disabled, .fr-select:disabled {
          background: #f8fafc; color: #9ca3af;
          cursor: not-allowed; border-color: #f0f4f8;
        }
        .fr-select-wrap { position: relative; }
        .fr-select-wrap::after {
          content: ''; position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%); width: 0; height: 0;
          border-left: 4px solid transparent; border-right: 4px solid transparent;
          border-top: 5px solid #9ca3af; pointer-events: none;
        }
        .fr-select-wrap .fr-select { padding-right: 32px; }
        .fr-hint { font-size: 11.5px; color: #9ca3af; }
      `}</style>

      <div className="fr-root">
        <div className="fr-section-title">
          <div className="fr-section-bar" />
          <span className="fr-section-label">Datos del Responsable</span>
        </div>

        <div className="fr-grid">
          <div className="fr-field fr-col-2">
            <label className="fr-label">Parentesco</label>
            <div className="fr-select-wrap">
              <select
                name="parentesco"
                value={form.parentesco}
                onChange={handleChange}
                disabled={readOnly}
                className="fr-select"
              >
                <option value="">Seleccioná...</option>
                <option value="Padre">Padre</option>
                <option value="Madre">Madre</option>
                <option value="Tutor">Tutor</option>
                <option value="Abuelo">Abuelo</option>
                <option value="Abuela">Abuela</option>
                <option value="Hermano">Hermano</option>
                <option value="Hermana">Hermana</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <span className="fr-hint">Relación del responsable con el paciente</span>
          </div>
        </div>
      </div>
    </>
  )
}