import { Menu, Bell } from 'lucide-react'
import { useLocation } from 'react-router-dom'

const BREADCRUMBS = {
  '/pacientes':                   ['Pacientes', 'Datos del paciente'],
  '/pacienteresponsable':      ['Pacientes', 'Responsables'],
  '/pacientes/documentos':        ['Pacientes', 'Documentos digitalizados'],
  '/agenda/citas':                ['Agenda', 'Citas / Turnos'],
  '/agenda/horarios':             ['Agenda', 'Horario prestador'],
  '/agenda/recordatorios':        ['Agenda', 'Recordatorios'],
  '/consultas':                   ['Consultas', 'Consulta médica'],
  '/consultas/eventos':           ['Consultas', 'Evento clínico'],
  '/facturacion/ventas':          ['Facturación', 'Ventas / Facturas'],
  '/facturacion/timbrado':        ['Facturación', 'Config. timbrado'],
  '/rrhh/personas':               ['RRHH', 'Persona RRHH'],
  '/rrhh/especialidades':         ['RRHH', 'Especialidades'],
  '/informes/modulos':            ['Informes', 'Por módulo'],
  '/informes/cruzados':           ['Informes', 'Reportes cruzados'],
  '/mantenimiento/ubicaciones':   ['Mantenimiento', 'Ubicaciones'],
  '/mantenimiento/consultorios':  ['Mantenimiento', 'Consultorios'],
  '/mantenimiento/tipo-doc':      ['Mantenimiento', 'Tipo doc. digitalizado'],
}

export default function Navbar({ collapsed, onMenuToggle }) {
  const { pathname } = useLocation()
  const crumbs = BREADCRUMBS[pathname] || ['Inicio']

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');

        .nb-root {
          position: fixed;
          top: 0;
          right: 0;
          height: 64px;
          background: #ffffff;
          border-bottom: 1px solid #e8edf2;
          display: flex;
          align-items: center;
          padding: 0 20px;
          gap: 14px;
          z-index: 40;
          transition: left 0.3s ease;
          font-family: 'DM Sans', sans-serif;
          left: 240px;
        }
        .nb-root.collapsed { left: 64px; }

        @media (max-width: 767px) {
          .nb-root { left: 0 !important; }
        }

        .nb-menu-btn {
          display: none;
          padding: 7px;
          border-radius: 8px;
          border: none;
          background: none;
          cursor: pointer;
          color: #6b7280;
          transition: background 0.15s;
        }
        .nb-menu-btn:hover { background: #f3f4f6; }
        @media (max-width: 767px) { .nb-menu-btn { display: flex; align-items: center; } }

        .nb-breadcrumb {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13.5px;
          color: #9ca3af;
        }
        .nb-breadcrumb-sep { font-size: 12px; color: #d1d5db; }
        .nb-breadcrumb-current { color: #1a3a5c; font-weight: 500; }

        .nb-spacer { flex: 1; }

        .nb-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #9ca3af;
          padding: 5px 10px;
          background: #f8fafc;
          border: 1px solid #e8edf2;
          border-radius: 20px;
        }
        .nb-status-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #22c55e;
          flex-shrink: 0;
        }

        @media (max-width: 480px) { .nb-status { display: none; } }

        .nb-bell {
          position: relative;
          width: 36px; height: 36px;
          border-radius: 9px;
          border: 1px solid #e8edf2;
          background: none;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #6b7280;
          transition: background 0.15s, border-color 0.15s;
        }
        .nb-bell:hover { background: #f8fafc; border-color: #d1d5db; color: #1a3a5c; }
        .nb-bell-badge {
          position: absolute;
          top: 7px; right: 7px;
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #ef4444;
          border: 1.5px solid #fff;
        }
      `}</style>

      <header className={`nb-root ${collapsed ? 'collapsed' : ''}`}>
        <button className="nb-menu-btn" onClick={onMenuToggle}>
          <Menu size={19} />
        </button>

        <div className="nb-breadcrumb">
          {crumbs.length > 1 ? (
            <>
              <span>{crumbs[0]}</span>
              <span className="nb-breadcrumb-sep">/</span>
              <span className="nb-breadcrumb-current">{crumbs[1]}</span>
            </>
          ) : (
            <span className="nb-breadcrumb-current">{crumbs[0]}</span>
          )}
        </div>

        <div className="nb-spacer" />

        <div className="nb-status">
          <div className="nb-status-dot" />
          Conectado
        </div>

        <button className="nb-bell">
          <Bell size={16} />
          <div className="nb-bell-badge" />
        </button>
      </header>
    </>
  )
}