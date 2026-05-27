import { useState, useRef } from 'react'
import { Users, Plus, Search, Eye, EyeOff, Key, Edit2, X, Shield, UserX, UserCheck } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Toast from '../../components/ui/Toast'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import {
  useUsuarios,
  useCreateUsuario,
  useUpdateUsuario,
  useCambiarEstadoUsuario,
  useResetearPassword,
} from '../../hooks/administracion/useUsuarios'
import { useBuscarPersonasRRHH } from '../../hooks/administracion/usePersonaRRHH'
import { useToast } from '../../hooks/useToast'
import { extraerMensajeError } from '../../utils/errores'

const ROL_LABELS = {
  admin:            'Administrador',
  medico:           'Médico',
  recepcionista:    'Recepcionista',
  secretaria_medico:'Secretaria de médico',
}

const ROL_COLOR = {
  admin:            'badge-danger',
  medico:           'badge-info',
  recepcionista:    'badge-success',
  secretaria_medico:'badge-warning',
}

const FORM_INIT = {
  username: '', password: '', confirmarPass: '',
  first_name: '', last_name: '', email: '',
  rol: 'recepcionista',
  prestadorObj: null,
  medicosObjs:  [],
}

function calcularFuerza(pwd) {
  if (!pwd) return null
  if (pwd.length < 8) return { label: 'Débil', color: '#dc2626', pct: 25 }
  const tipos = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(r => r.test(pwd)).length
  if (tipos >= 3 && pwd.length >= 10) return { label: 'Fuerte', color: '#16a34a', pct: 100 }
  if (tipos >= 2) return { label: 'Media', color: '#d97706', pct: 60 }
  return { label: 'Débil', color: '#dc2626', pct: 30 }
}

function FuerzaIndicador({ pwd }) {
  const f = calcularFuerza(pwd)
  if (!f) return null
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 3, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${f.pct}%`, background: f.color, transition: 'width .3s,background .3s' }} />
      </div>
      <span style={{ fontSize: 11, color: f.color, marginTop: 2, display: 'block' }}>{f.label}</span>
    </div>
  )
}

function TypeaheadPrestador({ value, onChange }) {
  const [q, setQ]       = useState('')
  const [open, setOpen] = useState(false)
  const { data: results = [] } = useBuscarPersonasRRHH(q)

  if (value) {
    return (
      <div className="usu-tag-selected">
        <span className="usu-tag-label">{value.nombre}</span>
        <button type="button" className="usu-tag-remove" onClick={() => onChange(null)}>
          <X size={12} />
        </button>
      </div>
    )
  }

  return (
    <div className="usu-typeahead-wrap">
      <input
        className="input"
        placeholder="Escribí nombre o documento..."
        value={q}
        onChange={e => { setQ(e.target.value); if (e.target.value.length >= 2) setOpen(true) }}
        onFocus={() => q.length >= 2 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
      />
      {open && (results.length > 0 ? (
        <div className="usu-typeahead-dropdown">
          {results.map(p => (
            <div key={p.id} className="usu-typeahead-item"
              onMouseDown={e => { e.preventDefault(); onChange({ id: p.id, nombre: p.nombre }); setQ(''); setOpen(false) }}>
              {p.nombre}
            </div>
          ))}
        </div>
      ) : q.length >= 2 ? (
        <div className="usu-typeahead-dropdown">
          <div className="usu-typeahead-empty">Sin resultados</div>
        </div>
      ) : null)}
    </div>
  )
}

function TypeaheadMedicos({ value, onChange }) {
  const [q, setQ]       = useState('')
  const [open, setOpen] = useState(false)
  const { data: all = [] } = useBuscarPersonasRRHH(q)
  const results = all.filter(p => !value.some(m => m.id === p.id))

  const add    = p  => { onChange([...value, { id: p.id, nombre: p.nombre }]); setQ(''); setOpen(false) }
  const remove = id => onChange(value.filter(m => m.id !== id))

  return (
    <div>
      {value.length > 0 && (
        <div className="usu-tags-wrap">
          {value.map(m => (
            <div key={m.id} className="usu-tag-selected">
              <span className="usu-tag-label">{m.nombre}</span>
              <button type="button" className="usu-tag-remove" onClick={() => remove(m.id)}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="usu-typeahead-wrap">
        <input
          className="input"
          placeholder="Agregar médico..."
          value={q}
          onChange={e => { setQ(e.target.value); if (e.target.value.length >= 2) setOpen(true) }}
          onFocus={() => q.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
        />
        {open && (results.length > 0 ? (
          <div className="usu-typeahead-dropdown">
            {results.map(p => (
              <div key={p.id} className="usu-typeahead-item"
                onMouseDown={e => { e.preventDefault(); add(p) }}>
                {p.nombre}
              </div>
            ))}
          </div>
        ) : q.length >= 2 ? (
          <div className="usu-typeahead-dropdown">
            <div className="usu-typeahead-empty">
              {all.length > 0 ? 'Todos ya están seleccionados' : 'Sin resultados'}
            </div>
          </div>
        ) : null)}
      </div>
    </div>
  )
}

function Seccion({ titulo, children }) {
  return (
    <div className="usu-seccion">
      <div className="usu-seccion-header">{titulo}</div>
      <div className="usu-seccion-body">{children}</div>
    </div>
  )
}

function Campo({ label, value, full }) {
  const empty = value === undefined || value === null || value === ''
  return (
    <div style={full ? { gridColumn: '1 / -1' } : {}}>
      <div className="usu-campo-label">{label}</div>
      <div className="usu-campo-valor">
        {empty ? <span style={{ color: '#d1d5db' }}>—</span> : value}
      </div>
    </div>
  )
}

function VistaDetalle({ usuario, onEditar, onResetear, onCambiarEstado }) {
  const medicosNombres = usuario.medicos_asignados_nombres?.length
    ? usuario.medicos_asignados_nombres.join(', ')
    : null
  const tienePrestador = usuario.persona_rrhh !== null && usuario.persona_rrhh !== undefined
  const tieneVinculos  = tienePrestador || usuario.rol === 'secretaria_medico'

  return (
    <div>
      <div className="usu-detalle-top">
        <div className="usu-avatar-lg">{usuario.iniciales}</div>
        <div>
          <div className="usu-detalle-nombre">
            {usuario.nombre_completo}
            {usuario.es_master && (
              <span className="usu-master-badge">
                <Shield size={10} />MASTER
              </span>
            )}
          </div>
          <div className="usu-detalle-username">@{usuario.username}</div>
          <span className={`badge ${ROL_COLOR[usuario.rol] || 'badge-gray'}`}>
            {ROL_LABELS[usuario.rol] || usuario.rol}
          </span>
        </div>
      </div>

      <Seccion titulo="Información">
        <Campo label="Email" value={usuario.email} full />
        <Campo label="Estado" value={
          <span className={`badge ${usuario.activo ? 'badge-success' : 'badge-gray'}`}>
            {usuario.activo ? 'Activo' : 'Inactivo'}
          </span>
        } />
        <Campo label="Rol" value={
          <span className={`badge ${ROL_COLOR[usuario.rol] || 'badge-gray'}`}>
            {ROL_LABELS[usuario.rol] || usuario.rol}
          </span>
        } />
      </Seccion>

      {tieneVinculos && (
        <Seccion titulo="Vínculos">
          {tienePrestador && (
            <Campo label="Prestador vinculado" value={usuario.persona_rrhh_nombre} full />
          )}
          {usuario.rol === 'secretaria_medico' && (
            <Campo
              label="Médicos asignados"
              value={medicosNombres || <span style={{ color: '#f59e0b' }}>Sin asignar</span>}
              full
            />
          )}
        </Seccion>
      )}

      <div className="usu-detalle-acciones">
        <button className="btn btn-secondary" onClick={onEditar}>
          <Edit2 size={14} /> Editar
        </button>
        <button className="btn btn-secondary" onClick={onResetear}>
          <Key size={14} /> Resetear contraseña
        </button>
        {!usuario.es_master && (
          <button
            className={`btn ${usuario.activo ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => onCambiarEstado(usuario)}
          >
            {usuario.activo ? <UserX size={14} /> : <UserCheck size={14} />}
            {usuario.activo ? 'Desactivar' : 'Activar'}
          </button>
        )}
      </div>
    </div>
  )
}

function FormularioUsuario({ usuario, onClose, onSaved }) {
  const isEdit = !!usuario

  const [form, setForm] = useState(() => isEdit ? {
    first_name:   usuario.first_name || '',
    last_name:    usuario.last_name  || '',
    email:        usuario.email      || '',
    rol:          usuario.rol,
    prestadorObj: usuario.persona_rrhh
      ? { id: usuario.persona_rrhh, nombre: usuario.persona_rrhh_nombre || '' }
      : null,
    medicosObjs: (usuario.medicos_asignados_ids || []).map((id, i) => ({
      id,
      nombre: (usuario.medicos_asignados_nombres || [])[i] || '',
    })),
  } : { ...FORM_INIT })

  const [showPass,      setShowPass]      = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [error,         setError]         = useState('')

  const createMutation = useCreateUsuario()
  const updateMutation = useUpdateUsuario()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGuardar = async () => {
    setError('')
    if (!isEdit && !form.username.trim()) { setError('El nombre de usuario es requerido.'); return }
    if (!isEdit && form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (!isEdit && form.password !== form.confirmarPass) { setError('Las contraseñas no coinciden.'); return }
    if (!form.rol) { setError('El rol es requerido.'); return }
    try {
      const payload = {
        first_name:        form.first_name,
        last_name:         form.last_name,
        email:             form.email,
        rol:               form.rol,
        persona_rrhh:      form.prestadorObj?.id ?? null,
        medicos_asignados: form.rol === 'secretaria_medico' ? form.medicosObjs.map(m => m.id) : [],
      }
      if (isEdit) {
        await updateMutation.mutateAsync({ id: usuario.id, ...payload })
      } else {
        await createMutation.mutateAsync({ ...payload, username: form.username, password: form.password })
      }
      onSaved()
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }

  const guardando = createMutation.isPending || updateMutation.isPending
  const esMaster  = isEdit && usuario.es_master

  return (
    <div>
      {esMaster && (
        <div className="usu-info-box">Usuario master — no se puede cambiar el rol.</div>
      )}
      {error && <div className="usu-error">{error}</div>}

      <div className="usu-grid">
        {!isEdit && (
          <div className="form-group usu-full">
            <label className="form-label">Usuario *</label>
            <input className="input" value={form.username} onChange={e => set('username', e.target.value)}
              placeholder="nombre.apellido" autoComplete="off" />
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
          <>
            <div className="form-group usu-full">
              <label className="form-label">Contraseña *</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => set('password', e.target.value)} placeholder="Mínimo 8 caracteres"
                  style={{ paddingRight: 40 }} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <FuerzaIndicador pwd={form.password} />
            </div>
            <div className="form-group usu-full">
              <label className="form-label">Confirmar contraseña *</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showConfirmar ? 'text' : 'password'} value={form.confirmarPass}
                  onChange={e => set('confirmarPass', e.target.value)} placeholder="Repetí la contraseña"
                  style={{ paddingRight: 40 }} autoComplete="new-password" />
                <button type="button" onClick={() => setShowConfirmar(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                  {showConfirmar ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.confirmarPass && form.password !== form.confirmarPass && (
                <span style={{ fontSize: 11, color: '#dc2626', marginTop: 2, display: 'block' }}>Las contraseñas no coinciden</span>
              )}
            </div>
          </>
        )}
        <div className="form-group usu-full">
          <label className="form-label">Rol *</label>
          <select className="input" value={form.rol} onChange={e => set('rol', e.target.value)} disabled={esMaster}>
            {Object.entries(ROL_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="form-group usu-full">
          <label className="form-label">Prestador vinculado</label>
          <TypeaheadPrestador value={form.prestadorObj} onChange={v => set('prestadorObj', v)} />
          <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 3, display: 'block' }}>
            Escribí nombre o documento para buscar. Dejá vacío si no aplica.
          </span>
        </div>
        {form.rol === 'secretaria_medico' && (
          <div className="form-group usu-full">
            <label className="form-label">Médicos asignados</label>
            <TypeaheadMedicos value={form.medicosObjs} onChange={v => set('medicosObjs', v)} />
            {form.medicosObjs.length === 0 && (
              <span style={{ fontSize: 11, color: '#f59e0b', marginTop: 3, display: 'block' }}>
                Sin médicos asignados aún.
              </span>
            )}
          </div>
        )}
      </div>

      <div className="usu-form-footer">
        <button className="btn btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleGuardar} disabled={guardando}>
          {guardando ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
        </button>
      </div>
    </div>
  )
}

function FormularioPassword({ usuario, onClose, onSaved }) {
  const [pass,          setPass]          = useState('')
  const [confirmar,     setConfirmar]     = useState('')
  const [showPass,      setShowPass]      = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [error,         setError]         = useState('')
  const mutation = useResetearPassword()

  const handleGuardar = async () => {
    setError('')
    if (pass.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (pass !== confirmar) { setError('Las contraseñas no coinciden.'); return }
    try {
      await mutation.mutateAsync({ id: usuario.id, nueva_password: pass })
      onSaved()
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        Nueva contraseña para <strong style={{ color: '#111827' }}>{usuario.nombre_completo}</strong>
      </p>
      {error && <div className="usu-error">{error}</div>}
      <div className="form-group">
        <label className="form-label">Nueva contraseña</label>
        <div style={{ position: 'relative' }}>
          <input className="input" type={showPass ? 'text' : 'password'} value={pass}
            onChange={e => setPass(e.target.value)} placeholder="Mínimo 8 caracteres"
            style={{ paddingRight: 40 }} />
          <button type="button" onClick={() => setShowPass(v => !v)}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <FuerzaIndicador pwd={pass} />
      </div>
      <div className="form-group" style={{ marginTop: 12 }}>
        <label className="form-label">Confirmar contraseña</label>
        <div style={{ position: 'relative' }}>
          <input className="input" type={showConfirmar ? 'text' : 'password'} value={confirmar}
            onChange={e => setConfirmar(e.target.value)} placeholder="Repetí la contraseña"
            style={{ paddingRight: 40 }} />
          <button type="button" onClick={() => setShowConfirmar(v => !v)}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            {showConfirmar ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {confirmar && pass !== confirmar && (
          <span style={{ fontSize: 11, color: '#dc2626', marginTop: 2, display: 'block' }}>Las contraseñas no coinciden</span>
        )}
      </div>
      <div className="usu-form-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleGuardar} disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando...' : 'Cambiar contraseña'}
        </button>
      </div>
    </div>
  )
}

export default function UsuariosPage() {
  const [search,        setSearch]        = useState('')
  const [rolFiltro,     setRolFiltro]     = useState('')
  const [activoFiltro,  setActivoFiltro]  = useState('')
  const [modo,          setModo]          = useState(null)
  const [usuSel,        setUsuSel]        = useState(null)
  const [confirmEstado, setConfirmEstado] = useState(null)
  const debounceRef = useRef(null)
  const { toast, showToast } = useToast()

  const { data: usuarios = [], isLoading } = useUsuarios({ search, rol: rolFiltro, activo: activoFiltro })
  const cambiarEstado = useCambiarEstadoUsuario()

  const filtrosActivos = [rolFiltro, activoFiltro].filter(Boolean).length
  const limpiarFiltros = () => { setRolFiltro(''); setActivoFiltro('') }

  const cerrar = () => { setModo(null); setUsuSel(null) }

  const handleVerDetalle = u      => { setUsuSel(u); setModo('ver') }
  const handleNuevo      = ()     => { setUsuSel(null); setModo('crear') }
  const handleEditar     = (u, e) => { e?.stopPropagation(); setUsuSel(u); setModo('editar') }
  const handleResetear   = (u, e) => { e?.stopPropagation(); setUsuSel(u); setModo('resetear') }

  const handleSearchChange = e => {
    const val = e.target.value
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearch(val), 300)
  }

  const confirmarCambiarEstado = async () => {
    if (!confirmEstado) return
    try {
      await cambiarEstado.mutateAsync(confirmEstado.id)
      showToast(confirmEstado.activo ? 'Usuario desactivado.' : 'Usuario activado.', 'success')
      if (usuSel?.id === confirmEstado.id) cerrar()
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    }
    setConfirmEstado(null)
  }

  const MODAL_TITLE = {
    ver:      'Detalle de usuario',
    crear:    'Nuevo usuario',
    editar:   'Editar usuario',
    resetear: 'Resetear contraseña',
  }
  const MODAL_SUBTITLE = {
    ver:      usuSel?.nombre_completo,
    editar:   usuSel ? `@${usuSel.username}` : undefined,
    resetear: usuSel?.nombre_completo,
  }

  return (
    <>
      <style>{`
        .usu-page { font-family: 'DM Sans', sans-serif; }

        /* ── Modal mobile ── */
        @media (max-width: 767px) {
          .modal-backdrop { padding: 0 !important; align-items: flex-end !important; }
          .modal-box { border-radius: 16px 16px 0 0 !important; max-height: 95dvh !important; max-width: 100% !important; }
        }
        @media (max-width: 479px) {
          .modal-backdrop { align-items: stretch !important; }
          .modal-box { border-radius: 0 !important; max-height: 100dvh !important; height: 100dvh !important; }
        }

        /* ── Toolbar ── */
        .usu-toolbar { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
        .usu-titles { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 10px; }
        .usu-header-icon { width: 40px; height: 40px; background: #dbeafe; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .usu-title { font-size: 20px; font-weight: 600; color: #111827; line-height: 1.2; }
        .usu-subtitle { font-size: 13px; color: #6b7280; margin-top: 1px; }

        .usu-search-wrap { position: relative; flex: 1 1 180px; min-width: 140px; }
        .usu-search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none; }
        .usu-search-input { width: 100%; padding: 9px 12px 9px 34px; border: 1.5px solid #e5e7eb; border-radius: 9px; font-size: 13.5px; font-family: 'DM Sans', sans-serif; color: #111827; background: #fff; box-sizing: border-box; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
        .usu-search-input:focus { border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08); }
        .usu-search-input::placeholder { color: #d1d5db; }

        .usu-filters { display: flex; gap: 8px; flex-shrink: 0; }
        .usu-filter-select { padding: 9px 12px; border: 1.5px solid #e5e7eb; border-radius: 9px; font-size: 13px; font-family: 'DM Sans', sans-serif; color: #374151; background: #fff; cursor: pointer; outline: none; transition: border-color 0.2s; }
        .usu-filter-select:focus { border-color: #1a3a5c; }

        .usu-filtros-clear { display: inline-flex; align-items: center; gap: 5px; padding: 7px 11px; background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 9px; font-size: 12px; font-family: 'DM Sans', sans-serif; font-weight: 500; color: #1a3a5c; cursor: pointer; white-space: nowrap; flex-shrink: 0; transition: background 0.15s; }
        .usu-filtros-clear:hover { background: #dbeafe; }

        .usu-btn-nuevo { flex-shrink: 0; }

        /* ── Tabla ── */
        .usu-table { width: 100%; border-collapse: collapse; min-width: 420px; }
        .usu-table thead { background: #f8fafc; border-bottom: 1px solid #e8edf2; }
        .usu-table th { padding: 11px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: .05em; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
        .usu-table td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; font-size: 13.5px; color: #374151; font-family: 'DM Sans', sans-serif; vertical-align: middle; }
        .usu-table tr:last-child td { border-bottom: none; }
        .usu-table tbody tr { cursor: pointer; }
        .usu-table tbody tr:nth-child(odd)  { background: #ffffff; }
        .usu-table tbody tr:nth-child(even) { background: #f8fafc; }
        .usu-table tbody tr:hover td { background: #f0f5fb !important; }
        .usu-inactivo td { opacity: .55; }

        .usu-name-cell { display: flex; align-items: center; gap: 10px; }
        .usu-avatar { width: 34px; height: 34px; border-radius: 50%; background: #dbeafe; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: #1a3a5c; border: 1px solid #bfdbfe; flex-shrink: 0; }
        .usu-name { font-weight: 500; color: #111827; }
        .usu-username { font-size: 12px; color: #9ca3af; margin-top: 1px; }
        .usu-hint { font-size: 11px; color: #9ca3af; margin-top: 3px; font-style: italic; }
        .usu-master-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 600; color: #92400e; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 4px; padding: 2px 6px; margin-left: 6px; }

        .usu-actions { display: flex; gap: 6px; }
        .usu-btn { width: 30px; height: 30px; border-radius: 7px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; transition: background 0.15s, color 0.15s, border-color 0.15s; }
        .usu-btn:hover { background: #f0f4f8; border-color: #bfdbfe; color: #1a3a5c; }
        .usu-btn.danger:hover { background: #fef2f2; border-color: #fecaca; color: #dc2626; }
        .usu-btn.active-toggle { color: #16a34a; }
        .usu-btn.active-toggle:hover { background: #f0fdf4; border-color: #bbf7d0; }
        .usu-btn:disabled { opacity: .45; cursor: not-allowed; }
        .usu-empty { padding: 48px; text-align: center; color: #9ca3af; font-size: 14px; font-family: 'DM Sans', sans-serif; }

        /* Ocultar columna prestador en mobile */
        @media (max-width: 767px) {
          .usu-col-prestador { display: none; }
          .usu-hint { display: none; }
        }

        /* ── Formulario ── */
        .usu-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .usu-full { grid-column: 1 / -1; }
        .usu-error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #dc2626; margin-bottom: 14px; font-family: 'DM Sans', sans-serif; }
        .usu-info-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #1a3a5c; margin-bottom: 14px; font-family: 'DM Sans', sans-serif; }
        .usu-form-footer { display: flex; justify-content: flex-end; gap: 10px; padding-top: 16px; border-top: 1px solid #f3f4f6; margin-top: 20px; }

        /* ── Typeahead ── */
        .usu-typeahead-wrap { position: relative; }
        .usu-typeahead-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); z-index: 200; max-height: 200px; overflow-y: auto; }
        .usu-typeahead-item { padding: 9px 12px; font-size: 13px; color: #374151; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .usu-typeahead-item:hover { background: #f0f5fb; color: #1a3a5c; }
        .usu-typeahead-empty { padding: 9px 12px; font-size: 13px; color: #9ca3af; font-family: 'DM Sans', sans-serif; }
        .usu-tags-wrap { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
        .usu-tag-selected { display: inline-flex; align-items: center; gap: 6px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 20px; padding: 4px 10px; font-size: 12px; color: #1a3a5c; font-family: 'DM Sans', sans-serif; }
        .usu-tag-label { font-weight: 500; }
        .usu-tag-remove { background: none; border: none; cursor: pointer; color: #6b7280; display: flex; align-items: center; padding: 0; }
        .usu-tag-remove:hover { color: #dc2626; }

        /* ── Vista detalle ── */
        .usu-detalle-top { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #f0f4f8; }
        .usu-avatar-lg { width: 52px; height: 52px; border-radius: 50%; background: #dbeafe; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 600; color: #1a3a5c; border: 2px solid #bfdbfe; flex-shrink: 0; }
        .usu-detalle-nombre { font-size: 16px; font-weight: 600; color: #111827; font-family: 'DM Sans', sans-serif; margin-bottom: 2px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
        .usu-detalle-username { font-size: 13px; color: #6b7280; font-family: 'DM Sans', sans-serif; margin-bottom: 6px; }
        .usu-detalle-acciones { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 20px; padding-top: 16px; border-top: 1px solid #f0f4f8; }
        .usu-seccion { border: 1px solid #e8edf2; border-radius: 10px; background: #fafbfc; margin-bottom: 12px; }
        .usu-seccion-header { padding: 7px 14px; border-bottom: 1px solid #e8edf2; font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: .08em; font-family: 'DM Sans', sans-serif; }
        .usu-seccion-body { padding: 12px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
        .usu-campo-label { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 2px; font-family: 'DM Sans', sans-serif; }
        .usu-campo-valor { font-size: 13px; color: #111827; font-family: 'DM Sans', sans-serif; }

        /* ── Mobile < 600px (toolbar reflow) ── */
        @media (max-width: 600px) {
          .usu-titles { display: none; }
          .usu-btn-nuevo { order: 1; }
          .usu-search-wrap { order: 2; flex: 1 1 100%; }
          .usu-filters { order: 3; flex: 1 0 100%; }
          .usu-filter-select { flex: 1; min-width: 0; }
          .usu-filtros-clear { order: 4; width: 100%; }
          .usu-grid { grid-template-columns: 1fr; }
          .usu-full { grid-column: 1; }
          .usu-seccion-body { grid-template-columns: 1fr; }
        }
      `}</style>

      <Toast toast={toast} />

      <ConfirmDialog
        isOpen={confirmEstado !== null}
        title={confirmEstado?.activo ? 'Desactivar usuario' : 'Activar usuario'}
        description={
          confirmEstado?.activo
            ? `¿Desactivar a ${confirmEstado?.nombre_completo}? No podrá ingresar al sistema.`
            : `¿Activar a ${confirmEstado?.nombre_completo}?`
        }
        confirmText={confirmEstado?.activo ? 'Desactivar' : 'Activar'}
        onConfirm={confirmarCambiarEstado}
        onCancel={() => setConfirmEstado(null)}
        loading={cambiarEstado.isPending}
      />

      <div className="usu-page">

        {/* ── Toolbar ── */}
        <div className="usu-toolbar">
          <div className="usu-titles">
            <div className="usu-header-icon">
              <Users size={20} color="#1a3a5c" />
            </div>
            <div>
              <div className="usu-title">Usuarios del sistema</div>
              <div className="usu-subtitle">Gestión de accesos y roles</div>
            </div>
          </div>

          <div className="usu-search-wrap">
            <Search size={14} className="usu-search-icon" />
            <input
              className="usu-search-input"
              placeholder="Buscar por nombre o usuario..."
              defaultValue=""
              onChange={handleSearchChange}
            />
          </div>
          <div className="usu-filters">
            <select className="usu-filter-select" value={rolFiltro} onChange={e => setRolFiltro(e.target.value)}>
              <option value="">Todos los roles</option>
              {Object.entries(ROL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="usu-filter-select" value={activoFiltro} onChange={e => setActivoFiltro(e.target.value)}>
              <option value="">Activos e inactivos</option>
              <option value="true">Solo activos</option>
              <option value="false">Solo inactivos</option>
            </select>
          </div>
          {filtrosActivos > 0 && (
            <button className="usu-filtros-clear" onClick={limpiarFiltros} title="Limpiar filtros">
              <X size={12} />
              {filtrosActivos} {filtrosActivos === 1 ? 'filtro activo' : 'filtros activos'}
            </button>
          )}
          <div className="usu-btn-nuevo">
            <button className="btn btn-primary" onClick={handleNuevo}>
              <Plus size={15} /> Nuevo usuario
            </button>
          </div>
        </div>

        {/* ── Tabla ── */}
        <div className="table-wrapper">
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
                  <th className="usu-col-prestador">Prestador vinculado</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id} className={!u.activo ? 'usu-inactivo' : ''} onClick={() => handleVerDetalle(u)}>
                    <td>
                      <div className="usu-name-cell">
                        <div className="usu-avatar">{u.iniciales}</div>
                        <div>
                          <div className="usu-name">
                            {u.nombre_completo}
                            {u.es_master && (
                              <span className="usu-master-badge">
                                <Shield size={10} />MASTER
                              </span>
                            )}
                          </div>
                          <div className="usu-username">@{u.username}</div>
                          <div className="usu-hint">Ver detalle ›</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${ROL_COLOR[u.rol] || 'badge-gray'}`}>
                        {ROL_LABELS[u.rol] || u.rol}
                      </span>
                    </td>
                    <td className="usu-col-prestador" style={{ color: u.persona_rrhh_nombre ? '#374151' : '#d1d5db' }}>
                      {u.persona_rrhh_nombre || '—'}
                    </td>
                    <td>
                      <span className={`badge ${u.activo ? 'badge-success' : 'badge-gray'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="usu-actions">
                        <button className="usu-btn" title="Editar usuario" onClick={e => handleEditar(u, e)}>
                          <Edit2 size={13} />
                        </button>
                        <button className="usu-btn" title="Resetear contraseña" onClick={e => handleResetear(u, e)}>
                          <Key size={13} />
                        </button>
                        <button
                          className={`usu-btn ${u.activo ? 'danger' : 'active-toggle'}`}
                          title={u.activo ? 'Desactivar usuario' : 'Activar usuario'}
                          onClick={() => setConfirmEstado(u)}
                          disabled={u.es_master}
                        >
                          {u.activo ? <UserX size={13} /> : <UserCheck size={13} />}
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

      <Modal
        isOpen={modo !== null}
        onClose={cerrar}
        title={modo ? MODAL_TITLE[modo] : ''}
        subtitle={modo ? MODAL_SUBTITLE[modo] : undefined}
        size="md"
      >
        {modo === 'ver' && usuSel && (
          <VistaDetalle
            usuario={usuSel}
            onEditar={() => setModo('editar')}
            onResetear={() => setModo('resetear')}
            onCambiarEstado={u => setConfirmEstado(u)}
          />
        )}
        {(modo === 'crear' || modo === 'editar') && (
          <FormularioUsuario
            usuario={modo === 'editar' ? usuSel : null}
            onClose={cerrar}
            onSaved={() => {
              cerrar()
              showToast(modo === 'crear' ? 'Usuario creado correctamente.' : 'Usuario actualizado.', 'success')
            }}
          />
        )}
        {modo === 'resetear' && usuSel && (
          <FormularioPassword
            usuario={usuSel}
            onClose={cerrar}
            onSaved={() => { cerrar(); showToast('Contraseña actualizada.', 'success') }}
          />
        )}
      </Modal>
    </>
  )
}
