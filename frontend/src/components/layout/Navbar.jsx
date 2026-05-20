import { useState, useRef, useEffect } from 'react'
import { Menu, Bell, Calendar } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStatsRecordatorios, useProximasCitas } from '../../hooks/mantenimiento/useRecordatorios'

const BREADCRUMBS = {
  '/paciente':                    ['Pacientes', 'Gestión de pacientes'],
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
  '/clinica/configuracion/especialidades': ['Clínica', 'Especialidades'],
  '/informes/modulos':            ['Informes', 'Por módulo'],
  '/informes/cruzados':           ['Informes', 'Reportes cruzados'],
  '/mantenimiento/ubicaciones':   ['Mantenimiento', 'Ubicaciones'],
  '/mantenimiento/consultorios':  ['Mantenimiento', 'Consultorios'],
  '/mantenimiento/tipo-doc':      ['Mantenimiento', 'Tipo doc. digitalizado'],
  '/administracion/auditoria':    ['Administración', 'Auditoría del sistema'],
}

function formatearFechaHoy() {
  return new Date().toLocaleDateString('es-PY', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatFechaCorta(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-PY', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export default function Navbar({ collapsed, onMenuToggle }) {
  const { pathname } = useLocation()
  const navigate     = useNavigate()
  const crumbs = BREADCRUMBS[pathname] || (() => {
    const segs = pathname.split('/').filter(Boolean)
    if (segs.length === 0) return ['Inicio']
    const capitalizar = s => s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    return segs.map(capitalizar)
  })()

  const [dropOpen, setDropOpen] = useState(false)
  const dropRef = useRef(null)

  const { data: stats }   = useStatsRecordatorios()
  const { data: proximas } = useProximasCitas()

  const lista = Array.isArray(proximas?.results)
    ? proximas.results
    : Array.isArray(proximas)
      ? proximas
      : []

  const total = (stats?.vencidas || 0) + (stats?.proximos_7_dias || 0)
  const badge = total > 0 ? (total > 99 ? '99+' : String(total)) : null

  useEffect(() => {
    if (!dropOpen) return
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropOpen])

  const handleIrRecordatorios = () => {
    setDropOpen(false)
    navigate('/agenda/recordatorios')
  }

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
        .nb-breadcrumb-current { color: #111827; font-weight: 600; }

        .nb-spacer { flex: 1; }

        .nb-date {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #6b7280;
          padding: 5px 10px;
          background: #f8fafc;
          border: 1px solid #e8edf2;
          border-radius: 20px;
          white-space: nowrap;
        }
        @media (max-width: 480px) { .nb-date { display: none; } }

        .nb-drop-wrap {
          position: relative;
        }

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
        .nb-bell:hover,
        .nb-bell.active { background: #f0f4f8; border-color: #d1d5db; color: #1a3a5c; }

        .nb-bell-badge {
          position: absolute;
          top: -5px; right: -5px;
          min-width: 16px; height: 16px;
          border-radius: 8px;
          background: #ef4444;
          border: 2px solid #fff;
          font-size: 9px;
          font-weight: 700;
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          padding: 0 3px;
          font-family: 'DM Sans', sans-serif;
          line-height: 1;
        }

        .nb-drop {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 300px;
          background: #fff;
          border: 1px solid #e8edf2;
          border-radius: 12px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
          z-index: 200;
          overflow: hidden;
        }

        .nb-drop-header {
          padding: 12px 16px;
          border-bottom: 1px solid #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: 'DM Sans', sans-serif;
        }
        .nb-drop-header-title {
          font-size: 13px;
          font-weight: 600;
          color: #111827;
        }
        .nb-drop-header-sub {
          font-size: 11px;
          color: #ef4444;
          font-weight: 500;
        }

        .nb-drop-body {
          max-height: 260px;
          overflow-y: auto;
        }

        .nb-drop-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 16px;
          cursor: pointer;
          border-bottom: 1px solid #f9fafb;
          transition: background 0.12s;
          font-family: 'DM Sans', sans-serif;
        }
        .nb-drop-item:hover { background: #f8fafc; }
        .nb-drop-item:last-child { border-bottom: none; }

        .nb-drop-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          margin-top: 4px;
          flex-shrink: 0;
        }

        .nb-drop-name {
          font-size: 13px;
          font-weight: 500;
          color: #111827;
        }

        .nb-drop-meta {
          font-size: 11px;
          color: #9ca3af;
          margin-top: 2px;
        }

        .nb-drop-empty {
          padding: 24px 16px;
          text-align: center;
          font-size: 12px;
          color: #9ca3af;
          font-family: 'DM Sans', sans-serif;
        }

        .nb-drop-footer {
          padding: 10px 16px;
          border-top: 1px solid #f3f4f6;
          text-align: center;
        }
        .nb-drop-footer-btn {
          font-size: 12px;
          color: #1a3a5c;
          background: none;
          border: none;
          cursor: pointer;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
        }
        .nb-drop-footer-btn:hover { text-decoration: underline; }
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

        <div className="nb-date">
          <Calendar size={11} />
          {formatearFechaHoy()}
        </div>

        <div className="nb-drop-wrap" ref={dropRef}>
          <button
            className={`nb-bell ${dropOpen ? 'active' : ''}`}
            onClick={() => setDropOpen(v => !v)}
            title="Recordatorios"
          >
            <Bell size={16} />
            {badge && <div className="nb-bell-badge">{badge}</div>}
          </button>

          {dropOpen && (
            <div className="nb-drop">
              <div className="nb-drop-header">
                <span className="nb-drop-header-title">Recordatorios</span>
                {total > 0 && (
                  <span className="nb-drop-header-sub">
                    {total} urgente{total !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="nb-drop-body">
                {lista.length === 0 ? (
                  <div className="nb-drop-empty">Sin recordatorios pendientes</div>
                ) : (
                  lista.slice(0, 5).map((item, i) => {
                    const urg   = item.urgencia
                    const color = urg === 'vencida' ? '#dc2626' : urg === 'urgente' ? '#d97706' : '#16a34a'
                    return (
                      <div key={i} className="nb-drop-item" onClick={handleIrRecordatorios}>
                        <div className="nb-drop-dot" style={{ background: color }} />
                        <div>
                          <div className="nb-drop-name">{item.paciente?.nombre || '—'}</div>
                          <div className="nb-drop-meta">
                            Próxima cita: {formatFechaCorta(item.proxima_cita)}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="nb-drop-footer">
                <button className="nb-drop-footer-btn" onClick={handleIrRecordatorios}>
                  Ver todos los recordatorios →
                </button>
              </div>
            </div>
          )}
        </div>
      </header>
    </>
  )
}
