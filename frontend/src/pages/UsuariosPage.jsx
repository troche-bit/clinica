import { useState } from 'react'
import { Users, Plus, Search, Shield, Eye, EyeOff, Key, Edit2, X, Check } from 'lucide-react'
import { useUsuarios, useCreateUsuario, useUpdateUsuario, useCambiarEstadoUsuario, useResetearPassword } from '../hooks/useUsuarios'
import { usePersonasRRHH } from '../hooks/usePersonaRRHH'
import { useToast } from '../hooks/useToast'
import Toast from '../components/ui/Toast'

const ROL_LABELS = {
  admin: 'Administrador',
  medico: 'Médico',
  recepcionista: 'Recepcionista',
  secretaria_medico: 'Secretaria de médico',
}

const ROL_COLOR = {
  admin: 'badge-danger',
  medico: 'badge-info',
  recepcionista: 'badge-success',
  secretaria_medico: 'badge-warning',
}

const FORM_INIT = {
  username: '', password: '', first_name: '', last_name: '',
  email: '', rol: 'recepcionista', persona_rrhh: '', medico_asignado: '',
}

function ModalUsuario({ usuario, onClose, onSaved }) {
  const isEdit = !!usuario
  const [form, setForm] = useState(isEdit ? {
    first_name: usuario.first_name || '',
    last_name: usuario.last_name || '',
    email: usuario.email || '',
    rol: usuario.rol,
    persona_rrhh: usuario.persona_rrhh || '',
    medico_asignado: usuario.medico_asignado || '',
  } : { ...FORM_INIT })
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')

  const { data: prestadoresData } = usePersonasRRHH({ page: 1, search: '' })
  const prestadores = prestadoresData?.results || []

  const createMutation = useCreateUsuario()
  const updateMutation = useUpdateUsuario()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGuardar = async () => {
    setError('')
    if (!isEdit && !form.username.trim()) { setError('El nombre de usuario es requerido.'); return }
    if (!isEdit && form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (!form.rol) { setError('El rol es requerido.'); return }
    try {
      const payload = { ...form }
      if (payload.persona_rrhh === '') payload.persona_rrhh = null
      if (payload.medico_asignado === '') payload.medico_asignado = null
      if (isEdit) {
        delete payload.username
        delete payload.password
        await updateMutation.mutateAsync({ id: usuario.id, ...payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      onSaved()
    } catch (e) {
      const msg = e?.response?.data
      if (typeof msg === 'object') setError(Object.values(msg).flat().join(' '))
      else setError('Error al guardar.')
    }
  }

  const guardando = createMutation.isPending || updateMutation.isPending

  return (
    <div className="usu-overlay">
      <div className="usu-modal">
        <div className="usu-modal-header">
          <div className="usu-modal-title">
            <Shield size={20} color="#1a3a5c" />
            <span>{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</span>
          </div>
          <button className="usu-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="usu-modal-body">
          {error && <div className="usu-error">{error}</div>}

          <div className="usu-grid">
            {!isEdit && (
              <div className="form-group usu-full">
                <label className="form-label">Usuario *</label>
                <input className="input" value={form.username} onChange={e => set('username', e.target.value)} placeholder="nombre.apellido" />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Nombre" />
            </div>
            <div className="form-group">
              <label className="form-label">Apellido</label>
              <input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Apellido" />
            </div>
            <div className="form-group usu-full">
              <label className="form-label">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@clinica.com" />
            </div>
            {!isEdit && (
              <div className="form-group usu-full">
                <label className="form-label">Contraseña *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Rol *</label>
              <select className="input" value={form.rol} onChange={e => set('rol', e.target.value)}>
                {Object.entries(ROL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Prestador vinculado</label>
              <select className="input" value={form.persona_rrhh} onChange={e => set('persona_rrhh', e.target.value)}>
                <option value="">— Sin vincular —</option>
                {prestadores.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            {form.rol === 'secretaria_medico' && (
              <div className="form-group usu-full">
                <label className="form-label">Médico asignado</label>
                <select className="input" value={form.medico_asignado} onChange={e => set('medico_asignado', e.target.value)}>
                  <option value="">— Sin asignar —</option>
                  {prestadores.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, display: 'block' }}>
                  La secretaria podrá ver la agenda y datos de este médico.
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="usu-modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleGuardar} disabled={guardando}>
            {guardando ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalResetPassword({ usuario, onClose, onSaved }) {
  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const mutation = useResetearPassword()

  const handleGuardar = async () => {
    setError('')
    if (pass.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    try {
      await mutation.mutateAsync({ id: usuario.id, nueva_password: pass })
      onSaved()
    } catch {
      setError('Error al resetear la contraseña.')
    }
  }

  return (
    <div className="usu-overlay">
      <div className="usu-modal" style={{ maxWidth: 400 }}>
        <div className="usu-modal-header">
          <div className="usu-modal-title">
            <Key size={18} color="#1a3a5c" />
            <span>Resetear contraseña</span>
          </div>
          <button className="usu-close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="usu-modal-body">
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
            Nueva contraseña para <strong>{usuario.nombre_completo}</strong>
          </p>
          {error && <div className="usu-error">{error}</div>}
          <div className="form-group">
            <label className="form-label">Nueva contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPass ? 'text' : 'password'}
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                style={{ paddingRight: 40 }}
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>
        <div className="usu-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleGuardar} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UsuariosPage() {
  const [search, setSearch] = useState('')
  const [rolFiltro, setRolFiltro] = useState('')
  const [activoFiltro, setActivoFiltro] = useState('')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [editando, setEditando] = useState(null)
  const [reseteando, setReseteando] = useState(null)
  const { toast, showToast } = useToast()

  const { data: usuarios = [], isLoading } = useUsuarios({
    search, rol: rolFiltro, activo: activoFiltro,
  })

  const cambiarEstado = useCambiarEstadoUsuario()

  const handleCambiarEstado = async (u) => {
    try {
      await cambiarEstado.mutateAsync(u.id)
      showToast(u.activo ? 'Usuario desactivado' : 'Usuario activado', 'success')
    } catch {
      showToast('Error al cambiar el estado', 'error')
    }
  }

  return (
    <>
      <style>{`
        .usu-page { padding: 24px; max-width: 1100px; margin: 0 auto; }
        .usu-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .usu-header-icon { width: 38px; height: 38px; background: #dbeafe; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .usu-title { font-size: 20px; font-weight: 600; color: #111827; font-family: 'DM Sans', sans-serif; }
        .usu-subtitle { font-size: 13px; color: #6b7280; font-family: 'DM Sans', sans-serif; }
        .usu-toolbar { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
        .usu-search-wrap { position: relative; flex: 1; min-width: 200px; }
        .usu-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none; }
        .usu-search-input { width: 100%; padding: 8px 12px 8px 34px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; color: #374151; background: #fff; box-sizing: border-box; }
        .usu-search-input:focus { outline: none; border-color: #1a3a5c; }
        .usu-filter-select { padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; color: #374151; background: #fff; cursor: pointer; }
        .usu-filter-select:focus { outline: none; border-color: #1a3a5c; }

        .usu-table-wrap { background: #fff; border-radius: 12px; border: 1px solid #e8edf2; overflow: hidden; }
        .usu-table { width: 100%; border-collapse: collapse; }
        .usu-table thead { background: #f8fafc; }
        .usu-table th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: .06em; font-family: 'DM Sans', sans-serif; border-bottom: 1px solid #f3f4f6; }
        .usu-table td { padding: 12px 14px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #374151; font-family: 'DM Sans', sans-serif; vertical-align: middle; }
        .usu-table tr:last-child td { border-bottom: none; }
        .usu-table tr:hover td { background: #f9fafb; }
        .usu-name { font-weight: 500; color: #111827; }
        .usu-username { font-size: 12px; color: #9ca3af; }

        .usu-avatar { width: 34px; height: 34px; border-radius: 50%; background: #dbeafe; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: #1a3a5c; border: 1px solid #bfdbfe; flex-shrink: 0; }
        .usu-name-cell { display: flex; align-items: center; gap: 10px; }

        .usu-actions { display: flex; gap: 6px; }
        .usu-btn { width: 30px; height: 30px; border-radius: 7px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; transition: all .15s; }
        .usu-btn:hover { background: #f0f4f8; border-color: #bfdbfe; color: #1a3a5c; }
        .usu-btn.danger:hover { background: #fef2f2; border-color: #fecaca; color: #dc2626; }
        .usu-btn.active-toggle { color: #16a34a; }
        .usu-btn.active-toggle:hover { background: #f0fdf4; border-color: #bbf7d0; }

        .usu-empty { padding: 48px; text-align: center; color: #9ca3af; font-size: 14px; font-family: 'DM Sans', sans-serif; }

        .usu-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 16px; }
        .usu-modal { background: #fff; border-radius: 14px; width: 100%; max-width: 560px; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
        .usu-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid #f3f4f6; }
        .usu-modal-title { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 600; color: #111827; font-family: 'DM Sans', sans-serif; }
        .usu-close-btn { width: 30px; height: 30px; border-radius: 7px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; }
        .usu-close-btn:hover { background: #f3f4f6; }
        .usu-modal-body { padding: 20px; overflow-y: auto; }
        .usu-modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 20px; border-top: 1px solid #f3f4f6; }
        .usu-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .usu-full { grid-column: 1 / -1; }
        .usu-error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #dc2626; margin-bottom: 14px; font-family: 'DM Sans', sans-serif; }

        .usu-inactivo td { opacity: .55; }
      `}</style>

      <Toast toast={toast} />

      <div className="usu-page">
        <div className="usu-header">
          <div className="usu-header-icon">
            <Users size={20} color="#1a3a5c" />
          </div>
          <div>
            <div className="usu-title">Usuarios del sistema</div>
            <div className="usu-subtitle">Gestión de accesos y roles</div>
          </div>
        </div>

        <div className="usu-toolbar">
          <div className="usu-search-wrap">
            <Search size={14} className="usu-search-icon" />
            <input
              className="usu-search-input"
              placeholder="Buscar por nombre o usuario..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="usu-filter-select" value={rolFiltro} onChange={e => setRolFiltro(e.target.value)}>
            <option value="">Todos los roles</option>
            {Object.entries(ROL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="usu-filter-select" value={activoFiltro} onChange={e => setActivoFiltro(e.target.value)}>
            <option value="">Activos e inactivos</option>
            <option value="true">Solo activos</option>
            <option value="false">Solo inactivos</option>
          </select>
          <button className="btn btn-primary" onClick={() => setModalNuevo(true)}>
            <Plus size={15} /> Nuevo usuario
          </button>
        </div>

        <div className="usu-table-wrap">
          {isLoading ? (
            <div className="usu-empty">Cargando...</div>
          ) : usuarios.length === 0 ? (
            <div className="usu-empty">No hay usuarios registrados.</div>
          ) : (
            <table className="usu-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Prestador vinculado</th>
                  <th>Médico asignado</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id} className={!u.activo ? 'usu-inactivo' : ''}>
                    <td>
                      <div className="usu-name-cell">
                        <div className="usu-avatar">{u.iniciales}</div>
                        <div>
                          <div className="usu-name">{u.nombre_completo}</div>
                          <div className="usu-username">@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${ROL_COLOR[u.rol] || 'badge-gray'}`}>
                        {ROL_LABELS[u.rol] || u.rol}
                      </span>
                    </td>
                    <td style={{ color: u.persona_rrhh_nombre ? '#374151' : '#d1d5db' }}>
                      {u.persona_rrhh_nombre || '—'}
                    </td>
                    <td style={{ color: u.medico_asignado_nombre ? '#374151' : '#d1d5db' }}>
                      {u.medico_asignado_nombre || (u.rol === 'secretaria_medico' ? <span style={{ color: '#f59e0b' }}>Sin asignar</span> : '—')}
                    </td>
                    <td>
                      <span className={`badge ${u.activo ? 'badge-success' : 'badge-gray'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="usu-actions">
                        <button
                          className="usu-btn"
                          title="Editar"
                          onClick={() => setEditando(u)}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className="usu-btn"
                          title="Resetear contraseña"
                          onClick={() => setReseteando(u)}
                        >
                          <Key size={13} />
                        </button>
                        <button
                          className={`usu-btn ${u.activo ? 'danger' : 'active-toggle'}`}
                          title={u.activo ? 'Desactivar' : 'Activar'}
                          onClick={() => handleCambiarEstado(u)}
                        >
                          {u.activo ? <EyeOff size={13} /> : <Check size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalNuevo && (
        <ModalUsuario
          onClose={() => setModalNuevo(false)}
          onSaved={() => { setModalNuevo(false); showToast('Usuario creado correctamente', 'success') }}
        />
      )}
      {editando && (
        <ModalUsuario
          usuario={editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); showToast('Usuario actualizado', 'success') }}
        />
      )}
      {reseteando && (
        <ModalResetPassword
          usuario={reseteando}
          onClose={() => setReseteando(null)}
          onSaved={() => { setReseteando(null); showToast('Contraseña actualizada', 'success') }}
        />
      )}
    </>
  )
}
