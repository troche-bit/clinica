import { useState, useEffect } from 'react'
import { X, Pencil, Trash2, Check } from 'lucide-react'

/**
 * Panel lateral genérico para el patrón Master-Detail.
 *
 * Props:
 *   titulos   { nuevo, editar, ver } — títulos del panel según el modo
 *   icono     ReactNode — ícono que aparece en modo 'ver'
 *   campos    Array<{ name, label, placeholder, requerido, soloLectura? }> — definición de campos
 *             soloLectura: true → muestra como texto en modo 'editar' (no se puede cambiar)
 *   item      Object|null — datos del item seleccionado (null en modo 'crear')
 *   modo      'ver' | 'editar' | 'crear'
 *   onCancelar  () => void
 *   onGuardar   (form: Object) => void
 *   onEditar    () => void
 *   onEliminar  (id: number) => void
 *   guardando   bool — deshabilita el botón Guardar mientras se procesa
 */
export default function PanelSimple({
  titulos,
  icono,
  campos = [],
  item,
  modo,
  onCancelar,
  onGuardar,
  onEditar,
  onEliminar,
  guardando = false,
}) {
  // Construye el estado del formulario a partir de los campos definidos y el item actual
  const construirEstado = () =>
    campos.reduce((acc, c) => ({ ...acc, [c.name]: item?.[c.name] || '' }), {})

  const [form, setForm] = useState(construirEstado)

  // Sincroniza el formulario cuando cambia el item o el modo
  useEffect(() => {
    setForm(construirEstado())
  }, [item, modo])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const esEdicion  = modo === 'editar'
  const esCreacion = modo === 'crear'
  const esVista    = modo === 'ver'

  // El botón Guardar se habilita solo cuando todos los campos requeridos tienen valor
  const formValido = campos
    .filter(c => c.requerido && !c.soloLectura)
    .every(c => form[c.name]?.trim())

  const titulo = esCreacion ? titulos.nuevo : esEdicion ? titulos.editar : titulos.ver

  return (
    <>
      <style>{`
        /* ── PanelSimple — panel lateral para el patrón Master-Detail ── */
        .panel-root {
          width: 340px; flex-shrink: 0; background: #ffffff;
          border: 1px solid #e8edf2; border-radius: 12px;
          display: flex; flex-direction: column;
          animation: panelSlideIn 0.2s ease;
          font-family: 'DM Sans', sans-serif;
        }
        @keyframes panelSlideIn {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid #f0f4f8;
        }
        .panel-header-left  { display: flex; align-items: center; gap: 10px; }
        .panel-header-bar   { width: 3px; height: 18px; background: #1a3a5c; border-radius: 4px; }
        .panel-header-title { font-size: 14px; font-weight: 600; color: #1a3a5c; }
        .panel-close {
          width: 28px; height: 28px; border-radius: 7px; border: 1px solid #e8edf2;
          background: none; cursor: pointer; display: flex; align-items: center;
          justify-content: center; color: #9ca3af; transition: all 0.15s;
        }
        .panel-close:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
        .panel-body  { padding: 20px; flex: 1; }
        .panel-field { margin-bottom: 16px; }
        .panel-label {
          font-size: 12px; font-weight: 500; color: #9ca3af;
          text-transform: uppercase; letter-spacing: .06em; margin-bottom: 5px;
        }
        .panel-value { font-size: 14px; color: #111827; font-weight: 400; }
        .panel-input {
          width: 100%; padding: 9px 12px; border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #111827;
          background: #fff; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .panel-input:focus { border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08); }
        .panel-input::placeholder { color: #d1d5db; }
        /* Campo bloqueado en modo edición — visualmente diferenciado del input normal */
        .panel-value-readonly {
          font-size: 13.5px; color: #6b7280; font-family: 'Courier New', monospace;
          background: #f8fafc; border: 1.5px solid #e8edf2; border-radius: 9px;
          padding: 9px 12px; display: flex; align-items: center; justify-content: space-between;
        }
        .panel-readonly-badge {
          font-size: 10px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
          color: #9ca3af; background: #f0f4f8; border-radius: 4px; padding: 2px 6px;
          flex-shrink: 0; margin-left: 8px;
        }
        .panel-footer {
          padding: 14px 20px; border-top: 1px solid #f0f4f8;
          display: flex; gap: 8px; justify-content: flex-end;
        }
        .panel-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 8px; font-size: 13px;
          font-weight: 500; font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all 0.15s; border: none;
        }
        .panel-btn-primary           { background: #1a3a5c; color: #fff; }
        .panel-btn-primary:hover     { background: #15304d; }
        .panel-btn-primary:disabled  { opacity: 0.5; cursor: not-allowed; }
        .panel-btn-secondary         { background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; }
        .panel-btn-secondary:hover   { background: #e9ecef; }
        .panel-btn-danger            { background: #fff; color: #dc2626; border: 1px solid #fecaca; }
        .panel-btn-danger:hover      { background: #fef2f2; }
        .panel-avatar {
          width: 48px; height: 48px; border-radius: 12px; background: #dbeafe;
          display: flex; align-items: center; justify-content: center; margin-bottom: 16px;
        }
      `}</style>

      <div className="panel-root">
        <div className="panel-header">
          <div className="panel-header-left">
            <div className="panel-header-bar" />
            <span className="panel-header-title">{titulo}</span>
          </div>
          <button className="panel-close" onClick={onCancelar}><X size={14} /></button>
        </div>

        <div className="panel-body">
          {esVista && icono && (
            <div className="panel-avatar">{icono}</div>
          )}

          {campos.map((campo, idx) => {
            // En modo editar, los campos soloLectura se muestran como texto bloqueado
            const bloqueado = esEdicion && campo.soloLectura

            return (
              <div className="panel-field" key={campo.name}>
                <div className="panel-label">{campo.label}</div>
                {esVista || bloqueado
                  ? bloqueado
                    ? (
                      <div className="panel-value-readonly">
                        <span>{form[campo.name] || '—'}</span>
                        <span className="panel-readonly-badge">No editable</span>
                      </div>
                    )
                    : <div className="panel-value">{item?.[campo.name] || '—'}</div>
                  : (
                    <input
                      name={campo.name}
                      value={form[campo.name]}
                      onChange={handleChange}
                      placeholder={campo.placeholder || ''}
                      className="panel-input"
                      autoFocus={idx === 0 && esCreacion}
                    />
                  )
                }
              </div>
            )
          })}
        </div>

        <div className="panel-footer">
          {esVista && (
            <>
              <button className="panel-btn panel-btn-danger" onClick={() => onEliminar(item.id)}>
                <Trash2 size={13} /> Eliminar
              </button>
              <button className="panel-btn panel-btn-primary" onClick={onEditar}>
                <Pencil size={13} /> Editar
              </button>
            </>
          )}
          {(esEdicion || esCreacion) && (
            <>
              <button className="panel-btn panel-btn-secondary" onClick={onCancelar}>
                Cancelar
              </button>
              <button
                className="panel-btn panel-btn-primary"
                disabled={!formValido || guardando}
                onClick={() => onGuardar(form)}
              >
                <Check size={13} /> {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
