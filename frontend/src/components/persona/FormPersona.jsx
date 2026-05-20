import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { parsePhoneNumber } from 'libphonenumber-js'
import { useTipoDocumento } from '../../hooks/administracion/usePersona'
import { usePaises, useDepartamentos, useCiudades } from '../../hooks/mantenimiento/useUbicacion'
import { calcularDV } from '../../utils/calcularDV'
import { extraerMensajeError } from '../../utils/errores'
import apiClient from '../../api/client'

export default function FormPersona({ persona, documento, readOnly = false, onChange, errores = {} }) {
  const { data: tipoDocumento } = useTipoDocumento()
  const [errorTelefono, setErrorTelefono] = useState('')
  const qc = useQueryClient()

  const [form, setForm] = useState({
    tipo_documento:     '',
    nro_documento:      documento || '',
    ruc_dv:             '',
    razon_social:       '',
    fecha_nacimiento:   '',
    telefono:           '',
    correo_electronico: '',
    pais:               '',
    departamento:       '',
    ciudad:             '',
    direccion:          '',
  })

  // Inline add ubicación
  const [inlineAdd,       setInlineAdd]       = useState(null)  // null | 'pais' | 'departamento' | 'ciudad'
  const [inlineNombre,    setInlineNombre]    = useState('')
  const [inlineGuardando, setInlineGuardando] = useState(false)
  const [inlineError,     setInlineError]     = useState('')

  const crearPaisM  = useMutation({ mutationFn: (d) => apiClient.post('/pais/', d) })
  const crearDeptoM = useMutation({ mutationFn: (d) => apiClient.post('/departamento/', d) })
  const crearCiudM  = useMutation({ mutationFn: (d) => apiClient.post('/ciudad/', d) })

  const handleInlineGuardar = async () => {
    if (!inlineNombre.trim()) { setInlineError('El nombre es requerido'); return }
    setInlineGuardando(true)
    setInlineError('')
    try {
      if (inlineAdd === 'pais') {
        const r = await crearPaisM.mutateAsync({ descripcion: inlineNombre.trim() })
        qc.invalidateQueries({ queryKey: ['paises'] })
        setForm(prev => ({ ...prev, pais: r.data.id, departamento: '', ciudad: '' }))
      } else if (inlineAdd === 'departamento') {
        const r = await crearDeptoM.mutateAsync({ descripcion: inlineNombre.trim(), pais: form.pais })
        qc.invalidateQueries({ queryKey: ['departamentos'] })
        setForm(prev => ({ ...prev, departamento: r.data.id, ciudad: '' }))
      } else if (inlineAdd === 'ciudad') {
        const r = await crearCiudM.mutateAsync({ descripcion: inlineNombre.trim(), departamento: form.departamento })
        qc.invalidateQueries({ queryKey: ['ciudades'] })
        setForm(prev => ({ ...prev, ciudad: r.data.id }))
      }
      setInlineAdd(null)
      setInlineNombre('')
    } catch (err) {
      setInlineError(extraerMensajeError(err))
    } finally {
      setInlineGuardando(false)
    }
  }

  const cerrarInline = () => { setInlineAdd(null); setInlineNombre(''); setInlineError('') }

  const esRuc = tipoDocumento?.find(
    t => t.id === parseInt(form.tipo_documento)
  )?.descripcion?.toUpperCase().includes('RUC')

  const { data: paises }        = usePaises()
  const { data: departamentos } = useDepartamentos(form.pais)
  const { data: ciudades }      = useCiudades(form.departamento)

  useEffect(() => {
    if (persona) {
      setForm({
        tipo_documento:     persona.tipo_documento     ?? '',
        nro_documento:      persona.nro_documento      ?? '',
        ruc_dv:             persona.ruc_dv             ?? '',
        razon_social:       persona.razon_social       ?? '',
        fecha_nacimiento:   persona.fecha_nacimiento   ?? '',
        telefono:           persona.telefono           ?? '',
        correo_electronico: persona.correo_electronico ?? '',
        pais:               persona.pais               ?? '',
        departamento:       persona.departamento       ?? '',
        ciudad:             persona.ciudad             ?? '',
        direccion:          persona.direccion          ?? '',
      })
    }
  }, [persona])

  useEffect(() => {
    if (onChange) onChange(form)
  }, [form])

  const handleTelefonoBlur = () => {
    const valor = form.telefono?.trim()
    if (!valor) { setErrorTelefono(''); return }
    try {
      const numero = parsePhoneNumber(valor, 'PY')
      if (numero.isValid()) {
        setForm(prev => ({ ...prev, telefono: numero.formatNational() }))
        setErrorTelefono('')
      } else {
        setErrorTelefono('Número de teléfono inválido.')
      }
    } catch {
      setErrorTelefono('Número de teléfono inválido.')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => {
      const updated = (() => {
        if (name === 'pais')         return { ...prev, pais: value, departamento: '', ciudad: '' }
        if (name === 'departamento') return { ...prev, departamento: value, ciudad: '' }
        return { ...prev, [name]: value }
      })()

      if (name === 'nro_documento' && esRuc) {
        return { ...updated, ruc_dv: calcularDV(value) }
      }
      if (name === 'tipo_documento') {
        const nuevoTipo  = tipoDocumento?.find(t => t.id === parseInt(value))
        const esNuevoRuc = nuevoTipo?.descripcion?.toUpperCase().includes('RUC')
        if (!esNuevoRuc) return { ...updated, ruc_dv: '' }
        if (esNuevoRuc && updated.nro_documento) {
          return { ...updated, ruc_dv: calcularDV(updated.nro_documento) }
        }
      }
      return updated
    })
  }

  return (
    <>
      <style>{`
        .fp-root { width: 100%; }

        .fp-section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
        }
        .fp-section-bar {
          width: 3px;
          height: 18px;
          background: #1a3a5c;
          border-radius: 4px;
          flex-shrink: 0;
        }
        .fp-section-label {
          font-size: 13px;
          font-weight: 600;
          color: #1a3a5c;
          letter-spacing: 0.02em;
        }

        .fp-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 600px) {
          .fp-grid { grid-template-columns: 1fr; }
        }
        .fp-col-2 { grid-column: span 2; }
        @media (max-width: 600px) {
          .fp-col-2 { grid-column: span 1; }
        }

        .fp-field { display: flex; flex-direction: column; gap: 5px; }

        .fp-label {
          font-size: 12.5px;
          font-weight: 500;
          color: #374151;
          font-family: 'DM Sans', sans-serif;
        }
        .fp-label-required::after {
          content: ' *';
          color: #dc2626;
        }

        .fp-input,
        .fp-select {
          width: 100%;
          padding: 9px 12px;
          border: 1.5px solid #e5e7eb;
          border-radius: 9px;
          font-size: 13.5px;
          font-family: 'DM Sans', sans-serif;
          color: #111827;
          background: #ffffff;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          appearance: none;
          -webkit-appearance: none;
        }
        .fp-input:focus,
        .fp-select:focus {
          border-color: #1a3a5c;
          box-shadow: 0 0 0 3px rgba(26,58,92,0.08);
        }
        .fp-input::placeholder { color: #d1d5db; }
        .fp-input:disabled,
        .fp-select:disabled {
          background: #f8fafc;
          color: #9ca3af;
          cursor: not-allowed;
          border-color: #f0f4f8;
        }

        .fp-select-wrap {
          position: relative;
        }
        .fp-select-wrap::after {
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
        .fp-select-wrap .fp-select { padding-right: 32px; }

        .fp-hint {
          font-size: 11.5px;
          color: #9ca3af;
          font-family: 'DM Sans', sans-serif;
          margin-top: 1px;
        }
        .fp-input-error { border-color: #dc2626 !important; }
        .fp-field-error {
          font-size: 11.5px;
          color: #dc2626;
          font-family: 'DM Sans', sans-serif;
        }

        .fp-divider {
          grid-column: span 2;
          height: 1px;
          background: #f0f4f8;
          margin: 4px 0;
        }
        @media (max-width: 600px) {
          .fp-divider { grid-column: span 1; }
        }

        .fp-subsection {
          grid-column: span 2;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: #9ca3af;
          margin-top: 4px;
        }
        @media (max-width: 600px) {
          .fp-subsection { grid-column: span 1; }
        }

        /* Inline add ubicación */
        .fp-ub-row { display: flex; gap: 6px; align-items: flex-start; }
        .fp-ub-row .fp-select-wrap { flex: 1; }
        .fp-btn-add-ub {
          flex-shrink: 0;
          width: 38px; height: 39px;
          border: 1.5px solid #e5e7eb; border-radius: 9px;
          background: #fff; color: #1a3a5c;
          font-size: 20px; line-height: 1;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, border-color 0.15s;
        }
        .fp-btn-add-ub:hover:not(:disabled) { background: #f0f5fb; border-color: #1a3a5c; }
        .fp-btn-add-ub:disabled { opacity: 0.35; cursor: not-allowed; }
        .fp-inline-form {
          margin-top: 4px;
          padding: 10px 12px;
          background: #f8fafc;
          border: 1.5px solid #e5e7eb;
          border-radius: 9px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .fp-inline-input {
          width: 100%;
          padding: 8px 10px;
          border: 1.5px solid #e5e7eb;
          border-radius: 7px;
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          color: #111827;
          outline: none;
          background: #fff;
          box-sizing: border-box;
        }
        .fp-inline-input:focus { border-color: #1a3a5c; }
        .fp-inline-btns { display: flex; gap: 6px; }
        .fp-inline-save {
          padding: 6px 14px; font-size: 12.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          background: #1a3a5c; color: #fff;
          border: none; border-radius: 7px; cursor: pointer;
          transition: background 0.15s;
        }
        .fp-inline-save:hover:not(:disabled) { background: #15304d; }
        .fp-inline-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .fp-inline-cancel {
          padding: 6px 14px; font-size: 12.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          background: none; color: #6b7280;
          border: 1px solid #e5e7eb; border-radius: 7px; cursor: pointer;
          transition: background 0.15s;
        }
        .fp-inline-cancel:hover { background: #f9fafb; }
        .fp-inline-error { font-size: 11.5px; color: #dc2626; }
      `}</style>

      <div className="fp-root">
        <div className="fp-section-title">
          <div className="fp-section-bar" />
          <span className="fp-section-label">Datos de la Persona</span>
        </div>

        <div className="fp-grid">

          <div className="fp-field" id="fp-campo-tipo_documento">
            <label className="fp-label fp-label-required">Tipo de documento</label>
            <div className="fp-select-wrap">
              <select
                name="tipo_documento"
                value={form.tipo_documento}
                onChange={handleChange}
                disabled={readOnly}
                className={`fp-select${errores.tipo_documento ? ' fp-input-error' : ''}`}
              >
                <option value="">Seleccioná...</option>
                {tipoDocumento?.map(t => (
                  <option key={t.id} value={t.id}>{t.descripcion}</option>
                ))}
              </select>
            </div>
            {errores.tipo_documento && <span className="fp-field-error">Campo requerido</span>}
          </div>

          <div className="fp-field" id="fp-campo-nro_documento">
            <label className="fp-label fp-label-required">Nro. de documento</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <input
                type="text"
                name="nro_documento"
                value={form.nro_documento}
                onChange={handleChange}
                disabled={readOnly}
                placeholder="Ej: 4123456"
                className={`fp-input${errores.nro_documento ? ' fp-input-error' : ''}`}
                style={{ flex: 1 }}
              />
              {esRuc && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '80px' }}>
                  <input
                    type="text"
                    name="ruc_dv"
                    value={form.ruc_dv}
                    onChange={handleChange}
                    disabled={readOnly}
                    placeholder="DV"
                    className="fp-input"
                    style={{ textAlign: 'center' }}
                  />
                  <span className="fp-hint" style={{ textAlign: 'center', fontSize: '10.5px' }}>Díg. ver.</span>
                </div>
              )}
            </div>
            {errores.nro_documento && <span className="fp-field-error">Campo requerido</span>}
          </div>

          <div className="fp-field fp-col-2" id="fp-campo-razon_social">
            <label className="fp-label fp-label-required">Razón social / Nombre completo</label>
            <input
              type="text"
              name="razon_social"
              value={form.razon_social}
              onChange={handleChange}
              disabled={readOnly}
              placeholder="Nombre completo o razón social"
              className={`fp-input${errores.razon_social ? ' fp-input-error' : ''}`}
            />
            {errores.razon_social && <span className="fp-field-error">Campo requerido</span>}
          </div>

          <div className="fp-field">
            <label className="fp-label">Fecha de nacimiento</label>
            <input
              type="date"
              name="fecha_nacimiento"
              value={form.fecha_nacimiento}
              onChange={handleChange}
              disabled={readOnly}
              className="fp-input"
            />
          </div>

          <div className="fp-divider" />
          <div className="fp-subsection">Contacto</div>

          <div className="fp-field">
            <label className="fp-label">Teléfono</label>
            <input
              type="text"
              name="telefono"
              value={form.telefono}
              onChange={handleChange}
              onBlur={handleTelefonoBlur}
              disabled={readOnly}
              placeholder="Ej: 0981 123 456"
              className={`fp-input${errorTelefono ? ' fp-input-error' : ''}`}
            />
            {errorTelefono && <span className="fp-field-error">{errorTelefono}</span>}
          </div>

          <div className="fp-field">
            <label className="fp-label">Correo electrónico</label>
            <input
              type="email"
              name="correo_electronico"
              value={form.correo_electronico}
              onChange={handleChange}
              disabled={readOnly}
              placeholder="correo@ejemplo.com"
              className="fp-input"
            />
          </div>

          <div className="fp-divider" />
          <div className="fp-subsection">Ubicación</div>

          {/* País */}
          <div className="fp-field">
            <label className="fp-label">País</label>
            <div className="fp-ub-row">
              <div className="fp-select-wrap">
                <select
                  name="pais"
                  value={form.pais}
                  onChange={handleChange}
                  disabled={readOnly}
                  className="fp-select"
                >
                  <option value="">Seleccioná...</option>
                  {paises?.map(p => (
                    <option key={p.id} value={p.id}>{p.descripcion}</option>
                  ))}
                </select>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  className="fp-btn-add-ub"
                  onClick={() => { setInlineAdd('pais'); setInlineNombre(''); setInlineError('') }}
                  title="Agregar país"
                >+</button>
              )}
            </div>
            {inlineAdd === 'pais' && (
              <div className="fp-inline-form">
                <input
                  className="fp-inline-input"
                  value={inlineNombre}
                  onChange={e => setInlineNombre(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleInlineGuardar(); if (e.key === 'Escape') cerrarInline() }}
                  placeholder="Nombre del país..."
                  autoFocus
                />
                {inlineError && <span className="fp-inline-error">{inlineError}</span>}
                <div className="fp-inline-btns">
                  <button className="fp-inline-save" onClick={handleInlineGuardar} disabled={inlineGuardando}>
                    {inlineGuardando ? '…' : 'Guardar'}
                  </button>
                  <button className="fp-inline-cancel" onClick={cerrarInline}>Cancelar</button>
                </div>
              </div>
            )}
          </div>

          {/* Departamento */}
          <div className="fp-field">
            <label className="fp-label">Departamento</label>
            <div className="fp-ub-row">
              <div className="fp-select-wrap">
                <select
                  name="departamento"
                  value={form.departamento}
                  onChange={handleChange}
                  disabled={readOnly || !form.pais}
                  className="fp-select"
                >
                  <option value="">
                    {!form.pais ? 'Primero seleccioná un país' : 'Seleccioná...'}
                  </option>
                  {departamentos?.map(d => (
                    <option key={d.id} value={d.id}>{d.descripcion}</option>
                  ))}
                </select>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  className="fp-btn-add-ub"
                  onClick={() => { setInlineAdd('departamento'); setInlineNombre(''); setInlineError('') }}
                  disabled={!form.pais}
                  title={!form.pais ? 'Seleccioná un país primero' : 'Agregar departamento'}
                >+</button>
              )}
            </div>
            {inlineAdd === 'departamento' && (
              <div className="fp-inline-form">
                <input
                  className="fp-inline-input"
                  value={inlineNombre}
                  onChange={e => setInlineNombre(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleInlineGuardar(); if (e.key === 'Escape') cerrarInline() }}
                  placeholder="Nombre del departamento..."
                  autoFocus
                />
                {inlineError && <span className="fp-inline-error">{inlineError}</span>}
                <div className="fp-inline-btns">
                  <button className="fp-inline-save" onClick={handleInlineGuardar} disabled={inlineGuardando}>
                    {inlineGuardando ? '…' : 'Guardar'}
                  </button>
                  <button className="fp-inline-cancel" onClick={cerrarInline}>Cancelar</button>
                </div>
              </div>
            )}
          </div>

          {/* Ciudad */}
          <div className="fp-field">
            <label className="fp-label">Ciudad</label>
            <div className="fp-ub-row">
              <div className="fp-select-wrap">
                <select
                  name="ciudad"
                  value={form.ciudad}
                  onChange={handleChange}
                  disabled={readOnly || !form.departamento}
                  className="fp-select"
                >
                  <option value="">
                    {!form.departamento ? 'Primero seleccioná un departamento' : 'Seleccioná...'}
                  </option>
                  {ciudades?.map(c => (
                    <option key={c.id} value={c.id}>{c.descripcion}</option>
                  ))}
                </select>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  className="fp-btn-add-ub"
                  onClick={() => { setInlineAdd('ciudad'); setInlineNombre(''); setInlineError('') }}
                  disabled={!form.departamento}
                  title={!form.departamento ? 'Seleccioná un departamento primero' : 'Agregar ciudad'}
                >+</button>
              )}
            </div>
            {inlineAdd === 'ciudad' && (
              <div className="fp-inline-form">
                <input
                  className="fp-inline-input"
                  value={inlineNombre}
                  onChange={e => setInlineNombre(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleInlineGuardar(); if (e.key === 'Escape') cerrarInline() }}
                  placeholder="Nombre de la ciudad..."
                  autoFocus
                />
                {inlineError && <span className="fp-inline-error">{inlineError}</span>}
                <div className="fp-inline-btns">
                  <button className="fp-inline-save" onClick={handleInlineGuardar} disabled={inlineGuardando}>
                    {inlineGuardando ? '…' : 'Guardar'}
                  </button>
                  <button className="fp-inline-cancel" onClick={cerrarInline}>Cancelar</button>
                </div>
              </div>
            )}
          </div>

          <div className="fp-field">
            <label className="fp-label">Dirección</label>
            <input
              type="text"
              name="direccion"
              value={form.direccion}
              onChange={handleChange}
              disabled={readOnly}
              placeholder="Calle, número, barrio"
              className="fp-input"
            />
          </div>

        </div>
      </div>
    </>
  )
}
