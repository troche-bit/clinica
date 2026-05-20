import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import apiClient from '../../api/client'
import ResponsableForm from '../responsable/ResponsableForm'

export default function FormPaciente({ paciente, readOnly = false, onChange, errores = {} }) {
  const [form, setForm] = useState({
    sexo:                  '',
    grupo_sanguineo:       '',
    alergias_conocidas:    '',
    enfermedades_cronicas: '',
    observacion:           '',
    responsable:           '',
    parentesco:            '',
  })
  const [responsableBuscado, setResponsableBuscado] = useState(null)
  const [queryResponsable,   setQueryResponsable]   = useState('')
  const [sugerencias,        setSugerencias]        = useState([])
  const [buscandoResp,       setBuscandoResp]       = useState(false)
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [selectedIndex,      setSelectedIndex]      = useState(-1)
  const [mostrarNuevoResp,   setMostrarNuevoResp]   = useState(false)

  const debounceRef = useRef(null)
  const wrapRef     = useRef(null)
  const listRef     = useRef(null)

  const handleQueryChange = (e) => {
    const q = e.target.value
    setQueryResponsable(q)
    clearTimeout(debounceRef.current)
    if (!q.trim()) {
      setSugerencias([])
      setMostrarSugerencias(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setBuscandoResp(true)
      try {
        const res = await apiClient.get(`/pacienteresponsable/?search=${encodeURIComponent(q.trim())}&page_size=8`)
        setSugerencias(res.data.results || [])
        setMostrarSugerencias(true)
      } catch {
        setSugerencias([])
      } finally {
        setBuscandoResp(false)
      }
    }, 300)
  }

  const seleccionarResponsable = (resp) => {
    setResponsableBuscado(resp)
    setForm(prev => ({ ...prev, responsable: resp.id }))
    setQueryResponsable('')
    setSugerencias([])
    setMostrarSugerencias(false)
    setSelectedIndex(-1)
  }

  const limpiarResponsable = () => {
    setResponsableBuscado(null)
    setQueryResponsable('')
    setSugerencias([])
    setMostrarSugerencias(false)
    setSelectedIndex(-1)
    setForm(prev => ({ ...prev, responsable: '', parentesco: '' }))
  }

  const handleKeyDown = (e) => {
    if (!mostrarSugerencias || sugerencias.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => {
        const next = Math.min(prev + 1, sugerencias.length - 1)
        listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => {
        const next = Math.max(prev - 1, -1)
        if (next >= 0) listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      seleccionarResponsable(sugerencias[selectedIndex])
    } else if (e.key === 'Escape') {
      setMostrarSugerencias(false)
      setSelectedIndex(-1)
    }
  }

  useEffect(() => setSelectedIndex(-1), [sugerencias])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setMostrarSugerencias(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Bloquea Escape del modal exterior cuando el modal anidado está abierto
  useEffect(() => {
    if (!mostrarNuevoResp) return
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        setMostrarNuevoResp(false)
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [mostrarNuevoResp])

  useEffect(() => {
    if (paciente) {
      setForm({
        sexo:                  paciente.sexo                  ?? '',
        grupo_sanguineo:       paciente.grupo_sanguineo       ?? '',
        alergias_conocidas:    paciente.alergias_conocidas    ?? '',
        enfermedades_cronicas: paciente.enfermedades_cronicas ?? '',
        observacion:           paciente.observacion           ?? '',
        responsable:           paciente.responsable           ?? '',
        parentesco:            paciente.parentesco            ?? '',
      })
    }
    if (paciente?.responsable_detalle) {
      setResponsableBuscado(paciente.responsable_detalle)
    }
  }, [paciente])

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

        .fpa-label-required::after {
          content: ' *';
          color: #dc2626;
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

        .fpa-input-error { border-color: #dc2626 !important; }
        .fpa-field-error { font-size: 11.5px; color: #dc2626; margin-top: 1px; }

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

        .fpa-autocomplete-wrap { position: relative; }
        .fpa-resp-row { display: flex; gap: 6px; align-items: flex-start; }
        .fpa-resp-row .fpa-autocomplete-wrap { flex: 1; }
        .fpa-btn-nuevo-resp {
          flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          gap: 4px;
          height: 39px;
          padding: 0 12px;
          border: 1.5px solid #e5e7eb; border-radius: 9px;
          background: #fff; color: #1a3a5c;
          font-size: 12.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s, border-color 0.15s;
        }
        .fpa-btn-nuevo-resp:hover { background: #f0f5fb; border-color: #1a3a5c; }

        .fpa-suggestions {
          position: absolute;
          top: calc(100% + 4px);
          left: 0; right: 0;
          background: #fff;
          border: 1.5px solid #e5e7eb;
          border-radius: 9px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.10);
          z-index: 100;
          overflow: hidden;
          max-height: 260px;
          overflow-y: auto;
        }
        .fpa-suggestion-item {
          padding: 9px 14px;
          cursor: pointer;
          transition: background 0.12s;
          border-bottom: 1px solid #f3f4f6;
        }
        .fpa-suggestion-item:last-child { border-bottom: none; }
        .fpa-suggestion-item:hover,
        .fpa-suggestion-item.fpa-selected { background: #f0f4f8; }
        .fpa-suggestion-nombre {
          font-size: 13.5px;
          font-weight: 500;
          color: #111827;
        }
        .fpa-suggestion-doc {
          font-size: 12px;
          color: #6b7280;
          margin-top: 1px;
        }
        .fpa-suggestion-empty {
          padding: 12px 14px;
          font-size: 13px;
          color: #9ca3af;
          text-align: center;
        }

        /* Modal anidado responsable */
        .fpa-nested-backdrop {
          position: fixed;
          inset: 0;
          z-index: 60;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(10, 25, 45, 0.5);
        }
        .fpa-nested-box {
          background: #fff;
          border-radius: 14px;
          width: 100%;
          max-width: 620px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(10,25,45,0.22);
          border: 1px solid #e8edf2;
          overflow: hidden;
        }
        .fpa-nested-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 22px;
          border-bottom: 1px solid #f0f4f8;
          flex-shrink: 0;
        }
        .fpa-nested-titulo {
          font-size: 15px;
          font-weight: 600;
          color: #1a3a5c;
          font-family: 'DM Sans', sans-serif;
        }
        .fpa-nested-close {
          width: 30px; height: 30px;
          border: 1px solid #e8edf2; border-radius: 8px;
          background: none; cursor: pointer;
          color: #9ca3af; font-size: 14px;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .fpa-nested-close:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
        .fpa-nested-body {
          overflow-y: auto;
          flex: 1;
          padding: 20px 22px;
        }
      `}</style>

      <div className="fpa-root">
        <div className="fpa-section-title">
          <div className="fpa-section-bar" />
          <span className="fpa-section-label">Datos del Paciente</span>
        </div>

        <div className="fpa-grid">

          <div className="fpa-field" id="fpa-campo-sexo">
            <label className="fpa-label fpa-label-required">Sexo</label>
            <div className="fpa-select-wrap">
              <select
                name="sexo"
                value={form.sexo}
                onChange={handleChange}
                disabled={readOnly}
                className={`fpa-select${errores.sexo ? ' fpa-input-error' : ''}`}
              >
                <option value="">Seleccioná...</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="O">Otro</option>
              </select>
            </div>
            {errores.sexo && <span className="fpa-field-error">Campo requerido</span>}
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

          <div className="fpa-field fpa-col-2">
            <label className="fpa-label">Responsable</label>

            {!responsableBuscado ? (
              <div className="fpa-resp-row">
                <div ref={wrapRef} className="fpa-autocomplete-wrap">
                  <input
                    type="text"
                    value={queryResponsable}
                    onChange={handleQueryChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { if (sugerencias.length > 0) setMostrarSugerencias(true) }}
                    placeholder={buscandoResp ? 'Buscando...' : 'Nombre o documento del responsable...'}
                    className="fpa-input"
                    disabled={readOnly}
                    autoComplete="off"
                  />
                  {mostrarSugerencias && (
                    <div className="fpa-suggestions" ref={listRef}>
                      {sugerencias.length === 0 ? (
                        <div className="fpa-suggestion-empty">Sin resultados</div>
                      ) : (
                        sugerencias.map((resp, idx) => (
                          <div
                            key={resp.id}
                            className={`fpa-suggestion-item${idx === selectedIndex ? ' fpa-selected' : ''}`}
                            onMouseDown={() => seleccionarResponsable(resp)}
                          >
                            <div className="fpa-suggestion-nombre">{resp.nombre}</div>
                            <div className="fpa-suggestion-doc">{resp.documento}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    className="fpa-btn-nuevo-resp"
                    onClick={() => setMostrarNuevoResp(true)}
                    title="Agregar nuevo responsable"
                  >
                    <Plus size={13} /> Nuevo
                  </button>
                )}
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: '#f0fdf4',
                border: '1.5px solid #bbf7d0', borderRadius: '9px',
              }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#111827' }}>
                    {responsableBuscado.nombre || responsableBuscado.persona_detalle?.razon_social}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {responsableBuscado.documento || responsableBuscado.persona_detalle?.nro_documento}
                  </div>
                </div>
                {!readOnly && (
                  <button onClick={limpiarResponsable} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#6b7280', fontSize: '18px', lineHeight: 1,
                  }}>×</button>
                )}
              </div>
            )}

            <span className="fpa-hint">Opcional — buscá por nombre o documento, o creá uno nuevo</span>
          </div>

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

      {mostrarNuevoResp && (
        <div
          className="fpa-nested-backdrop"
          onClick={e => { if (e.target === e.currentTarget) setMostrarNuevoResp(false) }}
        >
          <div className="fpa-nested-box">
            <div className="fpa-nested-header">
              <span className="fpa-nested-titulo">Nuevo responsable</span>
              <button className="fpa-nested-close" onClick={() => setMostrarNuevoResp(false)}>✕</button>
            </div>
            <div className="fpa-nested-body">
              <ResponsableForm
                useGuard={false}
                onSuccess={async (nuevoResp) => {
                  setMostrarNuevoResp(false)
                  if (nuevoResp?.id) {
                    try {
                      const res = await apiClient.get(`/pacienteresponsable/${nuevoResp.id}/`)
                      seleccionarResponsable(res.data)
                    } catch {
                      seleccionarResponsable(nuevoResp)
                    }
                  }
                }}
                onCancel={() => setMostrarNuevoResp(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
