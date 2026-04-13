import { useState, useEffect, useRef } from 'react'
import { useEspecialidades } from '../../hooks/useEspecialidades'
import { X, Search } from 'lucide-react'

const CARGOS = [
  { value: 'medico',         label: 'Médico' },
  { value: 'enfermero',      label: 'Enfermero/a' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'tecnico',        label: 'Técnico' },
  { value: 'otro',           label: 'Otro' },
]

const CONTRATOS = [
  { value: 'dependencia', label: 'Dependencia' },
  { value: 'honorarios',  label: 'Honorarios' },
  { value: 'eventual',    label: 'Eventual' },
]

const ESTADOS = [
  { value: 'activo',   label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
  { value: 'licencia', label: 'Licencia' },
]

// Selector de especialidades con búsqueda, selección múltiple y navegación por teclado
function SelectorEspecialidades({ seleccionadas, onChange }) {
  const { data: espData } = useEspecialidades()
  const todas             = espData?.results ?? espData ?? []

  const [busqueda,   setBusqueda]   = useState('')
  const [abierto,    setAbierto]    = useState(false)
  const [focusIdx,   setFocusIdx]   = useState(-1)

  const inputRef   = useRef(null)
  const wrapRef    = useRef(null)
  const listRef    = useRef(null)

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setAbierto(false)
        setFocusIdx(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Resetea el índice cuando cambian las opciones visibles
  const opciones = todas.filter(e =>
    !seleccionadas.includes(e.id) &&
    e.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
  )
  useEffect(() => { setFocusIdx(-1) }, [busqueda])

  // Desplaza el ítem enfocado a la vista
  useEffect(() => {
    if (focusIdx >= 0 && listRef.current) {
      const item = listRef.current.children[focusIdx]
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [focusIdx])

  const agregar = (esp) => {
    onChange([...seleccionadas, esp.id])
    setBusqueda('')
    setFocusIdx(-1)
    inputRef.current?.focus()
  }

  const quitar = (id) => onChange(seleccionadas.filter(s => s !== id))

  const handleKeyDown = (e) => {
    if (!abierto && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setAbierto(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIdx(i => Math.min(i + 1, opciones.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (focusIdx >= 0 && opciones[focusIdx]) agregar(opciones[focusIdx])
    } else if (e.key === 'Escape') {
      setAbierto(false)
      setFocusIdx(-1)
    } else if (e.key === 'Backspace' && busqueda === '' && seleccionadas.length > 0) {
      // Backspace con campo vacío quita la última especialidad
      quitar(seleccionadas[seleccionadas.length - 1])
    }
  }

  const seleccionadasDetalle = todas.filter(e => seleccionadas.includes(e.id))

  return (
    <div className="se-wrap" ref={wrapRef}>
      <div
        className="se-input-box"
        onClick={() => { setAbierto(true); inputRef.current?.focus() }}
      >
        {seleccionadasDetalle.map(esp => (
          <span key={esp.id} className="se-tag">
            {esp.descripcion}
            <button
              type="button"
              className="se-tag-x"
              onClick={(e) => { e.stopPropagation(); quitar(esp.id) }}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <div className="se-search-wrap">
          <Search size={12} className="se-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="se-search-input"
            placeholder={seleccionadasDetalle.length === 0 ? 'Buscar especialidad...' : ''}
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setAbierto(true) }}
            onFocus={() => setAbierto(true)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      {abierto && (
        <div className="se-dropdown" ref={listRef}>
          {opciones.length === 0
            ? <div className="se-dropdown-empty">
                {busqueda ? 'Sin resultados' : 'Todas las especialidades ya fueron seleccionadas'}
              </div>
            : opciones.map((esp, idx) => (
                <div
                  key={esp.id}
                  className={`se-dropdown-item${idx === focusIdx ? ' se-dropdown-item-focus' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); agregar(esp) }}
                  onMouseEnter={() => setFocusIdx(idx)}
                >
                  {esp.descripcion}
                </div>
              ))
          }
        </div>
      )}
    </div>
  )
}

export default function FormRRHH({ prestador = null, onChange }) {
  const [form, setForm] = useState({
    fecha_nacimiento: '',
    fecha_ingreso:    '',
    nro_matricula:    '',
    cargo:            '',
    tipo_contrato:    '',
    estado:           'activo',
    observacion:      '',
    especialidades:   [],
  })

  useEffect(() => {
    if (prestador) {
      setForm({
        fecha_nacimiento: prestador.fecha_nacimiento  ?? '',
        fecha_ingreso:    prestador.fecha_ingreso     ?? '',
        nro_matricula:    prestador.nro_matricula     ?? '',
        cargo:            prestador.cargo             ?? '',
        tipo_contrato:    prestador.tipo_contrato     ?? '',
        estado:           prestador.estado            ?? 'activo',
        observacion:      prestador.observacion       ?? '',
        especialidades:   (prestador.especialidades   ?? []).map(e => typeof e === 'object' ? e.id : e),
      })
    }
  }, [prestador])

  useEffect(() => { onChange(form) }, [form])

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  return (
    <>
      <style>{`
        .fr-title {
          font-size: 12px; font-weight: 600; letter-spacing: .06em;
          text-transform: uppercase; color: #9ca3af; margin-bottom: 16px;
        }
        .fr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .fr-group { display: flex; flex-direction: column; gap: 5px; }
        .fr-group-full { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 5px; }
        .fr-label { font-size: 12px; font-weight: 500; color: #6b7280; }
        .fr-input, .fr-select {
          padding: 9px 12px; border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif;
          color: #111827; background: #fff; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .fr-input:focus, .fr-select:focus {
          border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08);
        }
        .fr-input::placeholder { color: #d1d5db; }
        .fr-textarea {
          padding: 9px 12px; border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif;
          color: #111827; background: #fff; outline: none; resize: vertical; min-height: 72px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .fr-textarea:focus { border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08); }

        /* Selector especialidades */
        .se-wrap { position: relative; }
        .se-input-box {
          display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
          padding: 7px 10px; border: 1.5px solid #e5e7eb; border-radius: 9px;
          background: #fff; cursor: text; min-height: 42px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .se-input-box:focus-within {
          border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08);
        }
        .se-tag {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 8px; background: #dbeafe; color: #1a3a5c;
          border-radius: 20px; font-size: 12px; font-weight: 500;
        }
        .se-tag-x {
          display: flex; align-items: center; justify-content: center;
          width: 14px; height: 14px; border-radius: 50%; border: none;
          background: rgba(26,58,92,0.15); color: #1a3a5c; cursor: pointer; padding: 0;
        }
        .se-tag-x:hover { background: rgba(26,58,92,0.3); }
        .se-search-wrap { position: relative; display: flex; align-items: center; flex: 1; min-width: 100px; }
        .se-search-icon { position: absolute; left: 4px; color: #9ca3af; pointer-events: none; }
        .se-search-input {
          border: none; outline: none; background: transparent;
          font-size: 13px; font-family: 'DM Sans', sans-serif;
          color: #111827; padding: 2px 4px 2px 22px; width: 100%;
        }
        .se-search-input::placeholder { color: #d1d5db; }
        .se-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 50;
          background: #fff; border: 1px solid #e8edf2; border-radius: 9px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.10); max-height: 200px; overflow-y: auto;
        }
        .se-dropdown-item {
          padding: 9px 14px; font-size: 13.5px; color: #374151; cursor: pointer;
          transition: background 0.1s;
        }
        .se-dropdown-item:hover, .se-dropdown-item-focus {
          background: #f0f4f8; color: #1a3a5c;
        }
        .se-dropdown-empty {
          padding: 12px 14px; font-size: 13px; color: #9ca3af; text-align: center;
        }
        .se-hint {
          font-size: 11px; color: #9ca3af; margin-top: 4px;
        }
      `}</style>

      <div className="fr-title">Datos del Prestador</div>
      <div className="fr-grid">

        <div className="fr-group">
          <label className="fr-label">Fecha de nacimiento</label>
          <input type="date" className="fr-input" value={form.fecha_nacimiento}
            onChange={e => set('fecha_nacimiento', e.target.value)} />
        </div>

        <div className="fr-group">
          <label className="fr-label">Fecha de ingreso</label>
          <input type="date" className="fr-input" value={form.fecha_ingreso}
            onChange={e => set('fecha_ingreso', e.target.value)} />
        </div>

        <div className="fr-group">
          <label className="fr-label">Cargo *</label>
          <select className="fr-select" value={form.cargo}
            onChange={e => set('cargo', e.target.value)}>
            <option value="">Seleccioná un cargo...</option>
            {CARGOS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div className="fr-group">
          <label className="fr-label">Tipo de contrato *</label>
          <select className="fr-select" value={form.tipo_contrato}
            onChange={e => set('tipo_contrato', e.target.value)}>
            <option value="">Seleccioná tipo de contrato...</option>
            {CONTRATOS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div className="fr-group">
          <label className="fr-label">Estado *</label>
          <select className="fr-select" value={form.estado}
            onChange={e => set('estado', e.target.value)}>
            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>

        <div className="fr-group">
          <label className="fr-label">Nro. matrícula</label>
          <input type="text" className="fr-input" placeholder="Ej: 12345"
            value={form.nro_matricula}
            onChange={e => set('nro_matricula', e.target.value)} />
        </div>

        {/* Especialidades — columna izquierda, fila nueva */}
        <div className="fr-group">
          <label className="fr-label">Especialidades</label>
          <SelectorEspecialidades
            seleccionadas={form.especialidades}
            onChange={(ids) => set('especialidades', ids)}
          />
          <span className="se-hint">↓ / ↑ navegar · Enter seleccionar · Backspace quitar último</span>
        </div>

        <div className="fr-group-full">
          <label className="fr-label">Observaciones</label>
          <textarea className="fr-textarea" placeholder="Notas adicionales..."
            value={form.observacion}
            onChange={e => set('observacion', e.target.value)} />
        </div>

      </div>
    </>
  )
}
