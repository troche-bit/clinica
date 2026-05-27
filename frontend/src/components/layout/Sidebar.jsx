import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useNavigationGuard } from '../../hooks/useNavigationGuard'
import {
  Users, Calendar, FileText, DollarSign, BarChart2,
  Settings, ChevronLeft, ChevronRight, LogOut,
  ChevronDown, ChevronUp, UserCheck, Stethoscope,
  Building2, MapPin, UserCog, Wallet, Lock, Eye, EyeOff, X, Shield,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Toast from '../ui/Toast'
import { useCambiarPassword } from '../../hooks/administracion/useUsuarios'
import { useToast } from '../../hooks/useToast'
import { extraerMensajeError } from '../../utils/errores'

const PERMISOS = {
  admin:             ['pacientes', 'agenda', 'consultas', 'facturacion', 'finanzas', 'rrhh', 'informes', 'usuarios', 'mantenimiento', 'auditoria'],
  recepcionista:     ['pacientes', 'agenda', 'consultas', 'facturacion', 'finanzas', 'mantenimiento', 'informes'],
  medico:            ['pacientes', 'agenda', 'consultas'],
  secretaria_medico: ['pacientes', 'agenda', 'consultas'],
}

const MENU = [
  {
    section: 'Clínica',
    items: [
      {
        id: 'pacientes',
        label: 'Pacientes',
        icon: Users,
        sub: [
          { to: '/paciente',             label: 'Datos del paciente' },
          { to: '/pacienteresponsable',  label: 'Responsables' },
        ],
      },
      {
        id: 'agenda',
        label: 'Agenda',
        icon: Calendar,
        sub: [
          { to: '/agenda/citas',         label: 'Citas / Turnos' },
          { to: '/agenda/horarios',      label: 'Horario prestador' },
          { to: '/agenda/recordatorios', label: 'Recordatorios' },
        ],
      },
      {
        id: 'consultas',
        label: 'Consultas',
        icon: Stethoscope,
        sub: [
          { to: '/consultas',         label: 'Consulta médica' },
          { to: '/consultas/eventos', label: 'Evento clínico' },
        ],
      },
      {
        id: 'informes',
        label: 'Informes',
        icon: BarChart2,
        to: '/informes',
      },
    ],
  },
  {
    section: 'Gestión',
    items: [
      {
        id: 'facturacion',
        label: 'Facturación',
        icon: DollarSign,
        sub: [
          { to: '/facturacion/ventas',      label: 'Ventas / Facturas' },
          { to: '/facturacion/grupos',      label: 'Grupos y Productos' },
          { to: '/facturacion/timbrado',    label: 'Config. timbrado' },
        ],
      },
      {
        id: 'finanzas',
        label: 'Finanzas',
        icon: Wallet,
        sub: [
          { to: '/finanzas/cuentas',        label: 'Cuentas Caja/Banco' },
          { to: '/finanzas/cobranzas',      label: 'Cobranzas' },
          { to: '/finanzas/pago-prestador', label: 'Pago a prestadores' },
        ],
      },
      {
        id: 'rrhh',
        label: 'RRHH / Prestadores',
        icon: UserCog,
        sub: [
          { to: '/rrhh/personal', label: 'Persona RRHH' },
        ],
      },
    ],
  },
  {
    section: 'Configuración',
    items: [
      {
        id: 'usuarios',
        label: 'Usuarios',
        icon: UserCog,
        sub: [
          { to: '/sistema/usuarios', label: 'Gestión de usuarios' },
        ],
      },
      {
        id: 'auditoria',
        label: 'Auditoría',
        icon: Shield,
        to: '/administracion/auditoria',
      },
      {
        id: 'mantenimiento',
        label: 'Mantenimiento',
        icon: Settings,
        sub: [
          { to: '/mantenimiento/ubicaciones',  label: 'Ubicaciones' },
          { to: '/mantenimiento/consultorios',             label: 'Consultorios' },
          { to: '/clinica/configuracion/especialidades',   label: 'Especialidades' },
          { to: '/mantenimiento/tipo-doc',                 label: 'Tipo doc. digitalizado' },
        ],
      },
    ],
  },
]

function calcularFuerza(pwd) {
  if (!pwd) return null
  if (pwd.length < 8) return { label: 'Débil', color: '#dc2626', pct: 25 }
  const tipos = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(r => r.test(pwd)).length
  if (tipos >= 3 && pwd.length >= 10) return { label: 'Fuerte', color: '#16a34a', pct: 100 }
  if (tipos >= 2) return { label: 'Media', color: '#d97706', pct: 60 }
  return { label: 'Débil', color: '#dc2626', pct: 30 }
}

function ModalCambiarPassword({ onClose, showToast }) {
  const [current, setCurrent] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNueva, setShowNueva] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [error, setError] = useState('')
  const mutation = useCambiarPassword()

  const handleGuardar = async () => {
    setError('')
    if (!current) { setError('La contraseña actual es requerida.'); return }
    if (nueva.length < 8) { setError('La nueva contraseña debe tener al menos 8 caracteres.'); return }
    if (nueva !== confirmar) { setError('Las contraseñas no coinciden.'); return }
    try {
      await mutation.mutateAsync({ current_password: current, nueva_password: nueva })
      showToast('Contraseña actualizada correctamente.', 'success')
      onClose()
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }

  return (
    <div className="sb-pwd-overlay">
      <div className="sb-pwd-modal">
        <div className="sb-pwd-header">
          <div className="sb-pwd-title">
            <Lock size={18} color="#1a3a5c" />
            <span>Cambiar mi contraseña</span>
          </div>
          <button className="sb-pwd-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="sb-pwd-body">
          {error && <div className="sb-pwd-error">{error}</div>}
          <div className="form-group">
            <label className="form-label">Contraseña actual</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={showCurrent ? 'text' : 'password'} value={current}
                onChange={e => setCurrent(e.target.value)} placeholder="Tu contraseña actual"
                style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowCurrent(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Nueva contraseña</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={showNueva ? 'text' : 'password'} value={nueva}
                onChange={e => setNueva(e.target.value)} placeholder="Mínimo 8 caracteres"
                style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowNueva(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                {showNueva ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {(() => {
              const f = calcularFuerza(nueva)
              if (!f) return null
              return (
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 3, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${f.pct}%`, background: f.color, transition: 'width .3s, background .3s' }} />
                  </div>
                  <span style={{ fontSize: 11, color: f.color, marginTop: 2, display: 'block' }}>{f.label}</span>
                </div>
              )
            })()}
          </div>
          <div className="form-group">
            <label className="form-label">Confirmar nueva contraseña</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={showConfirmar ? 'text' : 'password'} value={confirmar}
                onChange={e => setConfirmar(e.target.value)} placeholder="Repetí la nueva contraseña"
                style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowConfirmar(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                {showConfirmar ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {confirmar && nueva !== confirmar && (
              <span style={{ fontSize: 11, color: '#dc2626', marginTop: 2, display: 'block' }}>Las contraseñas no coinciden</span>
            )}
          </div>
        </div>
        <div className="sb-pwd-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleGuardar} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { logout, user } = useAuth()
  const [openMenus, setOpenMenus] = useState({})
  const [profileOpen, setProfileOpen] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const { toast, showToast } = useToast()
  const profileRef = useRef(null)
  const navigate = useNavigate()
  const { isDirty, guardAction } = useNavigationGuard()

  const rol = user?.rol || 'admin'
  const permisosRol = PERMISOS[rol] || PERMISOS.admin

  useEffect(() => {
    if (!profileOpen) return
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [profileOpen])

  const toggleMenu = (id) => {
    if (collapsed) return
    setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const iniciales = (nombre) => {
    if (!nombre) return 'U'
    return nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <>
      <style>{`
        .sb-root {
          position: fixed;
          top: 0; left: 0;
          height: 100%;
          background: #1a3a5c;
          display: flex;
          flex-direction: column;
          z-index: 50;
          transition: width 0.3s ease, transform 0.3s ease;
          overflow: hidden;
          width: 240px;
        }
        .sb-root.collapsed { width: 64px; }

        @media (max-width: 767px) {
          .sb-root { transform: translateX(-100%); width: 240px !important; }
          .sb-root.mobile-open { transform: translateX(0); }
        }

        .sb-header {
          display: flex;
          align-items: center;
          padding: 0 14px;
          height: 64px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }
        .collapsed .sb-header {
          justify-content: center;
          padding: 0 14px;
        }
        .sb-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow: hidden;
          flex: 1;
          min-with: 0;
        }
        .sb-logo-icon {
          width: 30px;
          height: 30px;
          background: rgba(255,255,255,0.12);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .collapsed .sb-logo-icon { display: none; }
        .sb-logo-text {
          font-family: 'DM Serif Display', serif;
          font-size: 16px;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          opacity: 1;
          transition: opacity 0.2s;
        }
        .sb-logo-text span { color: rgba(255,255,255,0.45); font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 300; }
        .collapsed .sb-logo-text { opacity: 0; width: 0; }
        .sb-toggle-btn {
          width: 28px; height: 28px;
          border-radius: 8px;
          background: rgba(255,255,255,0.07);
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.5);
          display: flex; align-items: center; justify-content: center;
          margin-left: auto;
          flex-shrink: 0;
          transition: background 0.15s;
        }
        .collapsed .sb-toggle-btn { margin-left: 0; }
        .sb-toggle-btn:hover { background: rgba(255,255,255,0.13); color: #fff; }

        .sb-nav {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 10px 8px;
          scrollbar-width: none;
        }
        .sb-nav::-webkit-scrollbar { display: none; }

        .sb-section-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: .1em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.22);
          padding: 10px 8px 4px;
          white-space: nowrap;
          transition: opacity 0.2s;
        }
        .collapsed .sb-section-label { opacity: 0; }

        .sb-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 10px;
          border-radius: 8px;
          cursor: pointer;
          margin-bottom: 1px;
          color: rgba(255,255,255,0.5);
          font-size: 13.5px;
          font-weight: 400;
          white-space: nowrap;
          overflow: hidden;
          transition: background 0.15s, color 0.15s;
          border: none;
          background: none;
          text-align: left;
          font-family: 'DM Sans', sans-serif;
        }
        .sb-item:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.85); }
        .sb-item.open { background: rgba(255,255,255,0.07); color: #fff; }
        .sb-item-icon { flex-shrink: 0; color: inherit; }
        .sb-item-label { flex: 1; overflow: hidden; text-overflow: ellipsis; }
        .sb-item-chevron { flex-shrink: 0; opacity: 0.5; transition: opacity 0.15s; }
        .sb-item:hover .sb-item-chevron { opacity: 1; }
        .collapsed .sb-item-label,
        .collapsed .sb-item-chevron { display: none; }

        .sb-sub {
          overflow: hidden;
          max-height: 0;
          transition: max-height 0.25s ease;
        }
        .sb-sub.open { max-height: 300px; }
        .collapsed .sb-sub { display: none; }

        .sb-sublink {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px 7px 36px;
          border-radius: 7px;
          font-size: 13px;
          color: rgba(255,255,255,0.42);
          text-decoration: none;
          margin-bottom: 1px;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
          font-family: 'DM Sans', sans-serif;
        }
        .sb-sublink:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); }
        .sb-sublink.active {
          background: rgba(255,255,255,0.11);
          color: #fff;
          font-weight: 500;
        }
        .sb-sublink-dot {
          width: 4px; height: 4px;
          border-radius: 50%;
          background: currentColor;
          flex-shrink: 0;
          opacity: 0.6;
        }
        .sb-sublink.active .sb-sublink-dot { opacity: 1; background: #7dd3fc; }

        .sb-footer {
          border-top: 1px solid rgba(255,255,255,0.07);
          padding: 10px 8px;
          flex-shrink: 0;
        }

        .sb-user-wrap { position: relative; }

        .sb-profile-dropdown {
          position: absolute;
          bottom: calc(100% + 6px);
          left: 0; right: 0;
          background: #0f2540;
          border-radius: 8px;
          padding: 4px;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          z-index: 60;
        }
        .sb-profile-item {
          display: flex;
          align-items: center;
          gap: 9px;
          width: 100%;
          padding: 8px 10px;
          border-radius: 6px;
          background: none;
          border: none;
          color: rgba(255,255,255,0.7);
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s, color 0.15s;
        }
        .sb-profile-item:hover { background: rgba(255,255,255,0.08); color: #fff; }

        .sb-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .sb-user:hover { background: rgba(255,255,255,0.07); }
        .sb-avatar {
          width: 30px; height: 30px;
          border-radius: 50%;
          background: rgba(255,255,255,0.14);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 600; color: #fff;
          flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.15);
        }
        .sb-user-info { overflow: hidden; flex: 1; }
        .sb-user-name { font-size: 13px; font-weight: 500; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb-user-rol { font-size: 11px; color: rgba(255,255,255,0.38); text-transform: capitalize; }
        .collapsed .sb-user-info { display: none; }

        .sb-logout {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 8px;
          cursor: pointer;
          color: rgba(255,100,100,0.6);
          font-size: 13px;
          font-weight: 400;
          background: none;
          border: none;
          width: 100%;
          margin-top: 2px;
          font-family: 'DM Sans', sans-serif;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
          overflow: hidden;
        }
        .sb-logout:hover { background: rgba(255,80,80,0.1); color: #fca5a5; }
        .collapsed .sb-logout span { display: none; }

        .sb-tooltip { position: relative; }
        .collapsed .sb-tooltip:hover::after {
          content: attr(data-tip);
          position: absolute;
          left: calc(100% + 10px);
          top: 50%;
          transform: translateY(-50%);
          background: #0f2540;
          color: #fff;
          font-size: 12px;
          padding: 5px 10px;
          border-radius: 6px;
          white-space: nowrap;
          pointer-events: none;
          z-index: 999;
          font-family: 'DM Sans', sans-serif;
        }

        .sb-link-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 10px;
          border-radius: 8px;
          margin-bottom: 1px;
          color: rgba(255,255,255,0.5);
          font-size: 13.5px;
          font-weight: 400;
          white-space: nowrap;
          overflow: hidden;
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
          font-family: 'DM Sans', sans-serif;
        }
        .sb-link-item:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.85); }
        .sb-link-item.active { background: rgba(255,255,255,0.12); color: #fff; font-weight: 500; }
        .collapsed .sb-link-item .sb-item-label { display: none; }

        /* Modal cambiar contraseña */
        .sb-pwd-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.45);
          display: flex; align-items: center; justify-content: center;
          z-index: 200; padding: 16px;
        }
        .sb-pwd-modal {
          background: #fff; border-radius: 14px;
          width: 100%; max-width: 400px;
          display: flex; flex-direction: column;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        .sb-pwd-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 20px; border-bottom: 1px solid #f3f4f6;
        }
        .sb-pwd-title {
          display: flex; align-items: center; gap: 10px;
          font-size: 15px; font-weight: 600; color: #111827;
          font-family: 'DM Sans', sans-serif;
        }
        .sb-pwd-close {
          width: 28px; height: 28px; border-radius: 7px;
          border: 1px solid #e5e7eb; background: #fff;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          color: #6b7280;
        }
        .sb-pwd-close:hover { background: #f3f4f6; }
        .sb-pwd-body { padding: 20px; }
        .sb-pwd-footer {
          display: flex; justify-content: flex-end; gap: 10px;
          padding: 14px 20px; border-top: 1px solid #f3f4f6;
        }
        .sb-pwd-error {
          background: #fef2f2; border: 1px solid #fecaca;
          border-radius: 8px; padding: 10px 14px;
          font-size: 13px; color: #dc2626; margin-bottom: 14px;
          font-family: 'DM Sans', sans-serif;
        }
      `}</style>

      <Toast toast={toast} />

      <aside className={`sb-root ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sb-header">
          <div className="sb-logo">
            <div className="sb-logo-icon">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div className="sb-logo-text">Clínica <span>Lichi</span></div>
          </div>
          <button className="sb-toggle-btn" onClick={() => {
            if (window.innerWidth < 768) {
              onMobileClose()
            } else {
              onToggle()
            }
          }}>
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        <nav className="sb-nav">
          {MENU.map(({ section, items }) => {
            const itemsVisibles = items.filter(i => permisosRol.includes(i.id))
            if (itemsVisibles.length === 0) return null
            return (
              <div key={section}>
                <div className="sb-section-label">{section}</div>
                {itemsVisibles.map(({ id, label, icon: Icon, sub, to }) => {
                  if (to) {
                    return (
                      <NavLink
                        key={id}
                        to={to}
                        data-tip={label}
                        className={({ isActive }) =>
                          `sb-link-item sb-tooltip ${isActive ? 'active' : ''}`
                        }
                        onClick={(e) => {
                          if (isDirty) {
                            e.preventDefault()
                            guardAction(() => { navigate(to); onMobileClose() })
                          } else {
                            onMobileClose()
                          }
                        }}
                      >
                        <Icon size={17} className="sb-item-icon" />
                        <span className="sb-item-label">{label}</span>
                      </NavLink>
                    )
                  }
                  const isOpen = openMenus[id]
                  return (
                    <div key={id}>
                      <button
                        className={`sb-item sb-tooltip ${isOpen ? 'open' : ''}`}
                        data-tip={label}
                        onClick={() => toggleMenu(id)}
                      >
                        <Icon size={17} className="sb-item-icon" />
                        <span className="sb-item-label">{label}</span>
                        {isOpen
                          ? <ChevronUp size={13} className="sb-item-chevron" />
                          : <ChevronDown size={13} className="sb-item-chevron" />
                        }
                      </button>
                      <div className={`sb-sub ${isOpen ? 'open' : ''}`}>
                        {sub.map(({ to: subTo, label: subLabel }) => (
                          <NavLink
                            key={subTo}
                            to={subTo}
                            end
                            className={({ isActive }) =>
                              `sb-sublink ${isActive ? 'active' : ''}`
                            }
                            onClick={(e) => {
                              if (isDirty) {
                                e.preventDefault()
                                guardAction(() => { navigate(subTo); onMobileClose() })
                              } else {
                                onMobileClose()
                              }
                            }}
                          >
                            <div className="sb-sublink-dot" />
                            {subLabel}
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <div className="sb-footer">
          <div className="sb-user-wrap" ref={profileRef}>
            {profileOpen && !collapsed && (
              <div className="sb-profile-dropdown">
                <button
                  className="sb-profile-item"
                  onClick={() => { setShowPwd(true); setProfileOpen(false) }}
                >
                  <Lock size={14} />
                  <span>Mi contraseña</span>
                </button>
              </div>
            )}
            <div
              className="sb-user"
              onClick={() => { if (!collapsed) setProfileOpen(v => !v) }}
              title={collapsed ? user?.nombre || user?.username || 'Usuario' : undefined}
            >
              <div className="sb-avatar">{user?.iniciales || iniciales(user?.nombre || user?.username)}</div>
              <div className="sb-user-info">
                <div className="sb-user-name">{user?.nombre || user?.username || 'Usuario'}</div>
                <div className="sb-user-rol">{rol}</div>
              </div>
            </div>
          </div>
          <button className="sb-logout" onClick={logout}>
            <LogOut size={16} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {showPwd && (
        <ModalCambiarPassword
          onClose={() => setShowPwd(false)}
          showToast={showToast}
        />
      )}
    </>
  )
}
