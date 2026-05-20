import { useState, useEffect, useRef } from 'react'
import { X, Pencil, Trash2, Check, ChevronLeft } from 'lucide-react'
import { useAtajosTeclado } from '../../hooks/useAtajosTeclado'
import { useNavigationGuard } from '../../hooks/useNavigationGuard'

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
  ocultarEliminar = false,
}) {
  const construirEstado = () =>
    campos.reduce((acc, c) => ({ ...acc, [c.name]: item?.[c.name] || '' }), {})

  const [form, setForm]     = useState(construirEstado)
  const initialFormRef      = useRef(construirEstado())
  const { markDirty, markClean, guardAction } = useNavigationGuard()

  useEffect(() => {
    const estado = construirEstado()
    setForm(estado)
    initialFormRef.current = estado
  }, [item, modo])

  useEffect(() => { return () => markClean() }, [markClean])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const esEdicion  = modo === 'editar'
  const esCreacion = modo === 'crear'
  const esVista    = modo === 'ver'

  const formValido = campos
    .filter(c => c.requerido && !c.soloLectura)
    .every(c => form[c.name]?.trim())

  const titulo = esCreacion ? titulos.nuevo : esEdicion ? titulos.editar : titulos.ver

  const isDirty = (esEdicion || esCreacion) &&
    campos.some(c => (form[c.name] || '') !== (initialFormRef.current[c.name] || ''))

  useEffect(() => { isDirty ? markDirty() : markClean() }, [isDirty])

  const handleCancelar = () => guardAction(onCancelar)

  useAtajosTeclado({
    'F10': { fn: () => { if ((esEdicion || esCreacion) && formValido && !guardando) onGuardar(form) }, soloFueraDeInputs: false },
  })

  return (
    <>
      <style>{`
        .panel-root {
          width: 340px; flex-shrink: 0; background: #ffffff;
          border: 1px solid #e8edf2; border-radius: 12px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          display: flex; flex-direction: column;
          animation: panelSlideIn 0.2s ease;
          font-family: 'DM Sans', sans-serif;
        }
        @keyframes panelSlideIn {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes panelSlideInMobile {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @media (max-width: 767px) {
          .panel-root {
            position: fixed; inset: 0; z-index: 100;
            width: 100%; border-radius: 0; border: none;
            animation: panelSlideInMobile 0.25s ease;
          }
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
        .panel-body  { padding: 20px; flex: 1; overflow-y: auto; }
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
          display: flex; gap: 8px; justify-content: flex-end; align-items: center;
        }
        .panel-kbd-hint {
          font-size: 10.5px; color: #9ca3af; margin-right: auto;
          display: flex; align-items: center; gap: 4px;
        }
        .panel-kbd {
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 10px; font-family: 'Courier New', monospace;
          background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px;
          padding: 1px 5px; color: #6b7280; box-shadow: 0 1px 0 #b0b7c3; line-height: 1.4;
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
          width: 48px; height: 48px; border-radius: 12px; background: #e8f0fe;
          display: flex; align-items: center; justify-content: center; margin-bottom: 16px;
          padding: 12px; box-sizing: border-box; color: #1a3a5c;
        }
        .panel-mobile-back { display: none; }
        @media (max-width: 767px) {
          .panel-mobile-back {
            display: flex; align-items: center;
            padding: 10px 16px; border-bottom: 1px solid #f0f4f8;
            flex-shrink: 0;
          }
          .panel-back-btn {
            display: flex; align-items: center; gap: 4px;
            background: none; border: none; cursor: pointer;
            font-size: 13px; font-weight: 500; color: #1a3a5c;
            font-family: 'DM Sans', sans-serif; padding: 4px 0;
          }
          .panel-close { display: none; }
          .panel-footer {
            position: sticky; bottom: 0;
            background: #fff;
            box-shadow: 0 -2px 8px rgba(0,0,0,0.06);
          }
        }
      `}</style>

      <div className="panel-root">
        <div className="panel-mobile-back">
          <button className="panel-back-btn" onClick={handleCancelar}>
            <ChevronLeft size={16} /> Volver
          </button>
        </div>

        <div className="panel-header">
          <div className="panel-header-left">
            <div className="panel-header-bar" />
            <span className="panel-header-title">{titulo}</span>
          </div>
          <button className="panel-close" onClick={handleCancelar}><X size={14} /></button>
        </div>

        <div className="panel-body">
          {esVista && icono && (
            <div className="panel-avatar">{icono}</div>
          )}

          {campos.map((campo, idx) => {
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
              {!ocultarEliminar && (
                <button className="panel-btn panel-btn-danger" onClick={() => onEliminar(item.id)}>
                  <Trash2 size={13} /> Eliminar
                </button>
              )}
              <button className="panel-btn panel-btn-primary" onClick={onEditar}>
                <Pencil size={13} /> Editar
              </button>
            </>
          )}
          {(esEdicion || esCreacion) && (
            <>
              <span className="panel-kbd-hint">
                <span className="panel-kbd">F10</span> Guardar
              </span>
              <button className="panel-btn panel-btn-secondary" onClick={handleCancelar}>
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
