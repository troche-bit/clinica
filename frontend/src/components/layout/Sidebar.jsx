import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Users, Calendar, FileText, DollarSign, BarChart2,
  Settings, ChevronLeft, ChevronRight, LogOut,
  ChevronDown, ChevronUp, UserCheck, Stethoscope,
  Building2, MapPin, UserCog
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const PERMISOS = {
  admin:          ['pacientes', 'agenda', 'consultas', 'facturacion', 'rrhh', 'informes', 'mantenimiento'],
  recepcionista:  ['pacientes', 'agenda', 'facturacion', 'informes'],
  medico:         ['pacientes', 'agenda', 'consultas', 'informes'],
}

const MENU = [
  {
    section: 'Principal',
    items: [
      {
        id: 'pacientes',
        label: 'Pacientes',
        icon: Users,
        sub: [
          { to: '/paciente',              label: 'Datos del paciente' },
          { to: '/pacienteresponsable', label: 'Responsables' },
          { to: '/pacientes/documentos',   label: 'Documentos digitalizados' },
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
    ],
  },
  {
    section: 'Administración',
    items: [
      {
        id: 'facturacion',
        label: 'Facturación y Finanzas',
        icon: DollarSign,
        sub: [
          { to: '/facturacion/ventas',      label: 'Ventas / Facturas' },
          { to: '/facturacion/timbrado',    label: 'Config. timbrado' },
          { to: '/facturacion/caja',        label: 'Caja y bancos' },
          { to: '/facturacion/cobranzas',   label: 'Cobranzas y pagos' },
        ],
      },
      {
        id: 'rrhh',
        label: 'RRHH / Prestadores',
        icon: UserCog,
        sub: [
          { to: '/rrhh/personas',      label: 'Persona RRHH' },
          { to: '/rrhh/especialidades', label: 'Especialidades' },
        ],
      },
      {
        id: 'informes',
        label: 'Informes',
        icon: BarChart2,
        sub: [
          { to: '/informes/modulos',  label: 'Por módulo' },
          { to: '/informes/cruzados', label: 'Reportes cruzados' },
        ],
      },
    ],
  },
  {
    section: 'Sistema',
    items: [
      {
        id: 'mantenimiento',
        label: 'Mantenimiento',
        icon: Settings,
        sub: [
          { to: '/mantenimiento/ubicaciones',  label: 'Ubicaciones' },
          { to: '/mantenimiento/consultorios', label: 'Consultorios' },
          { to: '/mantenimiento/tipo-doc',     label: 'Tipo doc. digitalizado' },
        ],
      },
    ],
  },
]

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { logout, user } = useAuth()
  const [openMenus, setOpenMenus] = useState({})

  const rol = user?.rol || 'admin'
  const permisosRol = PERMISOS[rol] || PERMISOS.admin

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
        .collapsed .sb-logo-icon { 
          display: none; 
        }
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
        .collapsed .sb-toggle-btn {
          margin-left: 0;
        }
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

        .sb-tooltip {
          position: relative;
        }
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
      `}</style>

      <aside className={`sb-root ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Header */}
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
              onMobileClose()   // en móvil cierra el drawer
            } else {
              onToggle()        // en PC colapsa el sidebar
            }
          }}>
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="sb-nav">
          {MENU.map(({ section, items }) => {
            const itemsVisibles = items.filter(i => permisosRol.includes(i.id))
            if (itemsVisibles.length === 0) return null
            return (
              <div key={section}>
                <div className="sb-section-label">{section}</div>
                {itemsVisibles.map(({ id, label, icon: Icon, sub }) => {
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
                        {sub.map(({ to, label: subLabel }) => (
                          <NavLink
                            key={to}
                            to={to}
                            onClick={onMobileClose}
                            className={({ isActive }) =>
                              `sb-sublink ${isActive ? 'active' : ''}`
                            }
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

        {/* Footer */}
        <div className="sb-footer">
          <div className="sb-user">
            <div className="sb-avatar">{iniciales(user?.username || user?.nombre)}</div>
            <div className="sb-user-info">
              <div className="sb-user-name">{user?.username || 'Usuario'}</div>
              <div className="sb-user-rol">{rol}</div>
            </div>
          </div>
          <button className="sb-logout" onClick={logout}>
            <LogOut size={16} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  )
}