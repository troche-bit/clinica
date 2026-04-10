import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search, Building2, X, Check } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'

// ── Hooks ────────────────────────────────────────────────
function useConsultorios(search = '') {
  return useQuery({
    queryKey: ['consultorios', search],
    queryFn:  async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      const res = await apiClient.get(`/consultorio/?${params}`)
      return res.data
    },
  })
}

function useConsultorioMutations() {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['consultorios'] })

  const crear      = useMutation({ mutationFn: (d) => apiClient.post('/consultorio/', d),                       onSuccess: inv })
  const actualizar = useMutation({ mutationFn: ({ id, ...d }) => apiClient.patch(`/consultorio/${id}/`, d),     onSuccess: inv })
  const eliminar   = useMutation({ mutationFn: (id) => apiClient.delete(`/consultorio/${id}/`),                 onSuccess: inv })

  return { crear, actualizar, eliminar }
}

// ── Panel lateral ────────────────────────────────────────
function Panel({ item, modo, onCancelar, onGuardar, onEditar, onEliminar }) {
  const [form, setForm] = useState({
    nro_consultorio: item?.nro_consultorio || '',
    descripcion:     item?.descripcion     || '',
  })

  useEffect(() => {
    setForm({
      nro_consultorio: item?.nro_consultorio || '',
      descripcion:     item?.descripcion     || '',
    })
  }, [item])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const esEdicion  = modo === 'editar'
  const esCreacion = modo === 'crear'
  const esVista    = modo === 'ver'

  return (
    <>
      <style>{`
        .panel-root {
          width: 340px;
          flex-shrink: 0;
          background: #ffffff;
          border: 1px solid #e8edf2;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          animation: slideIn 0.2s ease;
          font-family: 'DM Sans', sans-serif;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid #f0f4f8;
        }
        .panel-header-left { display: flex; align-items: center; gap: 10px; }
        .panel-header-bar { width: 3px; height: 18px; background: #1a3a5c; border-radius: 4px; }
        .panel-header-title { font-size: 14px; font-weight: 600; color: #1a3a5c; }
        .panel-close {
          width: 28px; height: 28px; border-radius: 7px; border: 1px solid #e8edf2;
          background: none; cursor: pointer; display: flex; align-items: center;
          justify-content: center; color: #9ca3af; transition: all 0.15s;
        }
        .panel-close:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
        .panel-body { padding: 20px; flex: 1; }
        .panel-field { margin-bottom: 16px; }
        .panel-label { font-size: 12px; font-weight: 500; color: #9ca3af; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 5px; }
        .panel-value { font-size: 14px; color: #111827; font-weight: 400; }
        .panel-input {
          width: 100%; padding: 9px 12px; border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #111827;
          background: #fff; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .panel-input:focus { border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08); }
        .panel-input::placeholder { color: #d1d5db; }
        .panel-footer {
          padding: 14px 20px; border-top: 1px solid #f0f4f8;
          display: flex; gap: 8px; justify-content: flex-end;
        }
        .panel-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 8px; font-size: 13px;
          font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer;
          transition: all 0.15s; border: none;
        }
        .panel-btn-primary { background: #1a3a5c; color: #fff; }
        .panel-btn-primary:hover { background: #15304d; }
        .panel-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .panel-btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; }
        .panel-btn-secondary:hover { background: #e9ecef; }
        .panel-btn-danger { background: #fff; color: #dc2626; border: 1px solid #fecaca; }
        .panel-btn-danger:hover { background: #fef2f2; }
        .panel-avatar {
          width: 48px; height: 48px; border-radius: 12px; background: #dbeafe;
          display: flex; align-items: center; justify-content: center; margin-bottom: 16px;
        }
      `}</style>

      <div className="panel-root">
        <div className="panel-header">
          <div className="panel-header-left">
            <div className="panel-header-bar" />
            <span className="panel-header-title">
              {esCreacion ? 'Nuevo consultorio' : esEdicion ? 'Editar consultorio' : 'Detalle'}
            </span>
          </div>
          <button className="panel-close" onClick={onCancelar}><X size={14} /></button>
        </div>

        <div className="panel-body">
          {esVista && (
            <div className="panel-avatar">
              <Building2 size={22} color="#1a3a5c" />
            </div>
          )}

          <div className="panel-field">
            <div className="panel-label">Nro. consultorio</div>
            {esVista
              ? <div className="panel-value">{item.nro_consultorio}</div>
              : <input name="nro_consultorio" value={form.nro_consultorio} onChange={handleChange} placeholder="Ej: 01, A2..." className="panel-input" autoFocus={esCreacion} />
            }
          </div>

          <div className="panel-field">
            <div className="panel-label">Descripción</div>
            {esVista
              ? <div className="panel-value">{item.descripcion}</div>
              : <input name="descripcion" value={form.descripcion} onChange={handleChange} placeholder="Descripción opcional..." className="panel-input" autoFocus={esEdicion} />
            }
          </div>
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
              <button className="panel-btn panel-btn-secondary" onClick={onCancelar}>Cancelar</button>
              <button
                className="panel-btn panel-btn-primary"
                disabled={!form.nro_consultorio.trim()}
                onClick={() => onGuardar(form)}
              >
                <Check size={13} /> Guardar
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── Página principal ─────────────────────────────────────
export default function ConsultorioPage() {
  const [search,      setSearch]      = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [modo,        setModo]        = useState(null) // 'ver' | 'editar' | 'crear'

  const { data, isLoading } = useConsultorios(search)
  const { crear, actualizar, eliminar } = useConsultorioMutations()

  const consultorios = data?.results || data || []

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  const handleDobleClick = (item) => {
    setSeleccionado(item)
    setModo('ver')
  }

  const handleNuevo = () => {
    setSeleccionado(null)
    setModo('crear')
  }

  const handleCancelar = () => {
    setSeleccionado(null)
    setModo(null)
  }

  const handleGuardar = async (form) => {
    if (modo === 'crear') {
      await crear.mutateAsync(form)
    } else if (modo === 'editar') {
      await actualizar.mutateAsync({ id: seleccionado.id, ...form })
    }
    setSeleccionado(null)
    setModo(null)
  }

  const handleEliminar = (id) => {
    if (window.confirm('¿Eliminar este consultorio?')) {
      eliminar.mutate(id)
      setSeleccionado(null)
      setModo(null)
    }
  }

  return (
    <>
      <style>{`
        .con-root { font-family: 'DM Sans', sans-serif; }
        .con-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 24px; gap: 12px; flex-wrap: wrap;
        }
        .con-title { font-size: 22px; font-weight: 600; color: #1a3a5c; margin-bottom: 2px; }
        .con-subtitle { font-size: 13px; color: #6b7280; }
        .con-btn-nuevo {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; background: #1a3a5c; color: #fff;
          border: none; border-radius: 9px; font-size: 13.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; white-space: nowrap;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .con-btn-nuevo:hover { background: #15304d; box-shadow: 0 4px 12px rgba(26,58,92,0.2); }
        .con-search-row { display: flex; gap: 8px; margin-bottom: 16px; }
        .con-search-wrap { position: relative; flex: 1; max-width: 380px; }
        .con-search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none; }
        .con-search-input {
          width: 100%; padding: 9px 12px 9px 34px; border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #111827;
          background: #fff; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .con-search-input:focus { border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08); }
        .con-search-input::placeholder { color: #d1d5db; }
        .con-btn-search {
          padding: 9px 16px; background: #f8fafc; border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #374151; cursor: pointer;
        }
        .con-btn-search:hover { background: #f0f4f8; }

        .con-layout { display: flex; gap: 16px; align-items: flex-start; }
        .con-table-card {
          flex: 1; background: #fff; border: 1px solid #e8edf2;
          border-radius: 12px; overflow: hidden; min-width: 0;
        }
        .con-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .con-table thead { background: #f8fafc; border-bottom: 1px solid #e8edf2; }
        .con-table th {
          text-align: left; padding: 11px 16px; font-size: 11px; font-weight: 600;
          letter-spacing: .05em; text-transform: uppercase; color: #9ca3af; white-space: nowrap;
        }
        .con-table td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: middle; }
        .con-table tbody tr:last-child td { border-bottom: none; }
        .con-table tbody tr {
          cursor: pointer; transition: background 0.15s;
        }
        .con-table tbody tr:hover { background: #f8fafc; }
        .con-table tbody tr.activo { background: #eff6ff; }
        .con-table tbody tr.activo td { color: #1a3a5c; }
        .con-nro {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 32px; height: 32px; background: #dbeafe; border-radius: 8px;
        font-size: 12px; font-weight: 600; color: #1a3a5c;
        padding: 0 10px;  /* ← reemplaza el width fijo */
        }
        .con-hint {
          font-size: 12px; color: #9ca3af; margin-top: 4px;
          font-style: italic;
        }
        .con-empty {
          text-align: center; padding: 48px 16px; color: #9ca3af; font-size: 13.5px;
        }
        .con-empty-icon {
          width: 40px; height: 40px; margin: 0 auto 12px; background: #f3f4f6;
          border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #d1d5db;
        }
      `}</style>

      <div className="con-root">
        <div className="con-header">
          <div>
            <div className="con-title">Consultorios</div>
            <div className="con-subtitle">
              {consultorios.length > 0
                ? `${consultorios.length} consultorios registrados`
                : 'Gestión de consultorios'
              }
            </div>
          </div>
          <button className="con-btn-nuevo" onClick={handleNuevo}>
            <Plus size={15} /> Nuevo consultorio
          </button>
        </div>

        <form onSubmit={handleSearch} className="con-search-row">
          <div className="con-search-wrap">
            <Search size={15} className="con-search-icon" />
            <input
              type="text"
              placeholder="Buscar por número de consultorio..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="con-search-input"
            />
          </div>
          <button type="submit" className="con-btn-search">Buscar</button>
        </form>

        <div className="con-layout">
          {/* Tabla */}
          <div className="con-table-card">
            <table className="con-table">
              <thead>
                <tr>
                  <th>Nro.</th>
                  <th>Descripción</th>
                  <th style={{ width: '80px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={3} className="con-empty">Cargando...</td></tr>
                )}
                {!isLoading && consultorios.length === 0 && (
                  <tr><td colSpan={3}>
                    <div className="con-empty">
                      <div className="con-empty-icon"><Building2 size={18} /></div>
                      Sin consultorios registrados
                    </div>
                  </td></tr>
                )}
                {consultorios.map((c) => (
                  <tr
                    key={c.id}
                    className={seleccionado?.id === c.id ? 'activo' : ''}
                    onDoubleClick={() => handleDobleClick(c)}
                    onClick={() => handleDobleClick(c)}
                  >
                    <td><span className="con-nro">{c.nro_consultorio}</span></td>
                    <td>
                      {c.descripcion}
                      {seleccionado?.id !== c.id && (
                        <div className="con-hint">Hacé clic para ver el detalle</div>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                        onClick={(e) => { e.stopPropagation(); setSeleccionado(c); setModo('editar') }}
                        style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid #e8edf2', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#1a3a5c'; e.currentTarget.style.borderColor = '#bfdbfe' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#e8edf2' }}
                        >
                        <Pencil size={13} />
                        </button>
                        <button
                        onClick={(e) => { e.stopPropagation(); handleEliminar(c.id) }}
                        style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid #e8edf2', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fecaca' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#e8edf2' }}
                        >
                        <Trash2 size={13} />
                        </button>
                    </div>
                </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Panel lateral */}
          {modo && (
            <Panel
              item={seleccionado}
              modo={modo}
              onCancelar={handleCancelar}
              onGuardar={handleGuardar}
              onEditar={() => setModo('editar')}
              onEliminar={handleEliminar}
            />
          )}
        </div>
      </div>
    </>
  )
}