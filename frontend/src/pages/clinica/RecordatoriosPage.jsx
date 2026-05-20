import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, Calendar, AlertTriangle, CheckCircle, XCircle,
  Phone, Mail, X, Send, ExternalLink, Settings,
  ChevronRight, ChevronDown, RefreshCw,
} from 'lucide-react'
import {
  useProximasCitas,
  useStatsRecordatorios,
  useNotificar,
  useHistorialNotificaciones,
  useMedicosLista,
  useReenviarNotificacion,
} from '../../hooks/mantenimiento/useRecordatorios'
import { useConsultasPaciente } from '../../hooks/clinica/useConsultas'
import { useAuth } from '../../context/AuthContext'
import Toast from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { extraerMensajeError } from '../../utils/errores'

function iniciales(nombre) {
  if (!nombre) return '??'
  return nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-PY', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function formatFechaHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-PY', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function urgenciaConfig(urgencia, dias) {
  if (urgencia === 'vencida')  return { color: '#dc2626', bg: '#fef2f2', label: `Vencida hace ${Math.abs(dias)} día(s)` }
  if (urgencia === 'urgente')  return { color: '#d97706', bg: '#fffbeb', label: `${dias} día(s)` }
  return { color: '#16a34a', bg: '#f0fdf4', label: `${dias} día(s)` }
}

function buildMensajePlantilla(tipo, item) {
  const nombre = item.paciente?.nombre || '—'
  const fecha  = formatFecha(item.proxima_cita)
  const medico = item.medico_sugerido?.nombre || '—'
  const esp    = item.medico_sugerido?.especialidad || '—'
  const ind    = item.indicaciones || '—'

  switch (tipo) {
    case 'recordatorio_cita':
      return `Hola ${nombre}, le recordamos que tiene una cita programada para el ${fecha} con ${medico} en Clínica Lichi.`
    case 'confirmacion_reserva':
      return `Hola ${nombre}, su cita ha sido confirmada para el ${fecha} con ${medico} — ${esp}. Clínica Lichi.`
    case 'indicaciones':
      return `Hola ${nombre}, le enviamos las indicaciones de su consulta: ${ind}. Ante cualquier duda contáctenos.`
    default:
      return ''
  }
}

function ModalNotificacion({ item, tipo, onClose, onEnviado }) {
  const notificar = useNotificar()
  const { toast, showToast } = useToast()

  const tipoLabels = {
    recordatorio_cita:    'Recordatorio de cita',
    confirmacion_reserva: 'Confirmación de reserva',
    indicaciones:         'Indicaciones',
  }

  const [canal, setCanal]   = useState('whatsapp')
  const [dest, setDest]     = useState(
    canal === 'email' ? (item.paciente?.email || '') : (item.paciente?.telefono || '')
  )
  const [mensaje, setMensaje] = useState(() => buildMensajePlantilla(tipo, item))

  const handleCanalChange = (c) => {
    setCanal(c)
    setDest(c === 'email' ? (item.paciente?.email || '') : (item.paciente?.telefono || ''))
  }

  const handleEnviar = async () => {
    try {
      const res = await notificar.mutateAsync({
        consulta_id: item.consulta_id,
        tipo,
        canal,
        mensaje_personalizado: mensaje,
      })
      if (canal === 'email') {
        if (res?.estado === 'enviado') {
          showToast('Email enviado correctamente.', 'success')
        } else {
          showToast('No se pudo enviar el email. La notificación queda pendiente.', 'error')
        }
      } else {
        showToast('Notificación registrada correctamente.', 'success')
      }
      setTimeout(() => { onEnviado(); onClose() }, 800)
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    }
  }

  return (
    <>
      <div className="rec-overlay" onClick={onClose} />
      <div className="rec-modal">
        <div className="rec-modal-header">
          <div className="rec-modal-title">
            <Send size={16} color="#1a3a5c" />
            {tipoLabels[tipo] || 'Notificación'}
          </div>
          <button className="rec-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="rec-modal-body">
          <div className="rec-form-group">
            <label className="rec-label">Canal</label>
            <div className="rec-radio-group">
              {[['whatsapp', 'WhatsApp'], ['email', 'Email']].map(([v, l]) => (
                <label key={v} className="rec-radio-label">
                  <input
                    type="radio" name="canal" value={v}
                    checked={canal === v}
                    onChange={() => handleCanalChange(v)}
                  />
                  {l}
                </label>
              ))}
            </div>
          </div>

          <div className="rec-form-group">
            <label className="rec-label">Destinatario</label>
            <input
              className="rec-input"
              value={dest}
              onChange={e => setDest(e.target.value)}
              placeholder={canal === 'email' ? 'correo@ejemplo.com' : '+595 …'}
            />
          </div>

          <div className="rec-form-group">
            <label className="rec-label">Mensaje</label>
            <textarea
              className="rec-textarea"
              rows={4}
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
            />
          </div>

          <div className="rec-canal-aviso">
            <AlertTriangle size={13} color="#d97706" />
            Canal no configurado — la notificación queda registrada como pendiente de envío.
          </div>
        </div>

        <div className="rec-modal-footer">
          <button className="rec-btn-secundario" onClick={onClose}>Cancelar</button>
          <button
            className="rec-btn-primario"
            onClick={handleEnviar}
            disabled={notificar.isPending}
          >
            {notificar.isPending ? 'Registrando…' : 'Registrar envío'}
          </button>
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}

function HistorialExpandido({ pacienteId }) {
  const { data: historial = [], isLoading } = useHistorialNotificaciones(pacienteId)
  const reenviar = useReenviarNotificacion()
  const { toast, showToast } = useToast()

  const handleReenviar = async (id) => {
    try {
      const res = await reenviar.mutateAsync(id)
      showToast(res?.estado === 'enviado' ? 'Email reenviado.' : 'No se pudo reenviar.', res?.estado === 'enviado' ? 'success' : 'error')
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    }
  }

  if (isLoading) return <div style={{ padding: '8px 0', color: '#9ca3af', fontSize: 12 }}>Cargando…</div>
  if (historial.length === 0) return <div style={{ padding: '8px 0', color: '#9ca3af', fontSize: 12 }}>Sin notificaciones enviadas.</div>

  return (
    <div>
      {historial.slice(0, 5).map(n => (
        <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{n.tipo_display}</span>
            <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{n.canal_display}</span>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: n.estado === 'enviado' ? '#16a34a' : n.estado === 'fallido' ? '#dc2626' : '#d97706',
          }}>
            {n.estado_display}
          </span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatFechaHora(n.fecha_creacion)}</span>
          {n.canal === 'email' && n.estado === 'fallido' && (
            <button
              className="rec-btn-reenviar"
              onClick={() => handleReenviar(n.id)}
              disabled={reenviar.isPending}
              title="Reenviar email"
            >
              <RefreshCw size={11} />
            </button>
          )}
        </div>
      ))}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}

function PanelDetalle({ item, onCerrar }) {
  const navigate = useNavigate()
  const [modalTipo, setModalTipo]         = useState(null)
  const [confirmDirecto, setConfirmDirecto] = useState(null)
  const [enviandoDirecto, setEnviandoDirecto] = useState(false)
  const { toast, showToast } = useToast()
  const notificar  = useNotificar()
  const tieneEmail = !!item.paciente?.email

  const handleEnviarDirecto = async (tipo) => {
    setEnviandoDirecto(true)
    try {
      const res = await notificar.mutateAsync({
        consulta_id: item.consulta_id,
        tipo,
        canal: 'email',
        mensaje_personalizado: '',
      })
      if (res?.estado === 'enviado') {
        showToast('Email enviado correctamente.', 'success')
      } else {
        showToast('No se pudo enviar el email. Queda registrado como pendiente.', 'error')
      }
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setEnviandoDirecto(false)
      setConfirmDirecto(null)
    }
  }

  const handleClickNotif = (tipo, tieneIndicaciones) => {
    if (!tieneIndicaciones && tipo === 'indicaciones') return
    if (tieneEmail) {
      setConfirmDirecto(tipo)
    } else {
      setModalTipo(tipo)
    }
  }

  const { data: historialNotif = [] } = useHistorialNotificaciones(item.paciente?.id)
  const { data: consultasRaw }        = useConsultasPaciente(item.paciente?.id)

  const ultimasTres = useMemo(() => {
    const lista = Array.isArray(consultasRaw) ? consultasRaw : (consultasRaw?.results ?? [])
    return lista
      .filter(c => c.id !== item.consulta_id && c.estado === 'finalizada')
      .slice(0, 3)
  }, [consultasRaw, item.consulta_id])

  const irAAgenda = () => {
    const params = new URLSearchParams()
    if (item.medico_sugerido?.id) params.set('persona_rrhh', item.medico_sugerido.id)
    if (item.proxima_cita)        params.set('fecha', item.proxima_cita)
    navigate(`/agenda/citas?${params.toString()}`)
  }

  const estadoBadgeConf = item.tiene_agenda
    ? { color: '#16a34a', bg: '#f0fdf4', label: 'Agendado' }
    : { color: '#d97706', bg: '#fffbeb', label: 'Pendiente' }

  return (
    <div className="rec-panel">
      <div className="rec-panel-header">
        <div className="rec-panel-titulo">Detalle del recordatorio</div>
        <button className="rec-panel-cerrar" onClick={onCerrar}><X size={16} /></button>
      </div>

      <div className="rec-panel-body">

        <div className="rec-section">
          <div className="rec-section-title">Paciente</div>
          <div className="rec-pac-card">
            <div className="rec-avatar lg">{iniciales(item.paciente?.nombre)}</div>
            <div>
              <div className="rec-pac-nombre">{item.paciente?.nombre}</div>
              <div className="rec-pac-contacto">
                {item.paciente?.telefono && (
                  <a href={`tel:${item.paciente.telefono}`} className="rec-link">
                    <Phone size={11} /> {item.paciente.telefono}
                  </a>
                )}
                {item.paciente?.email && (
                  <a href={`mailto:${item.paciente.email}`} className="rec-link">
                    <Mail size={11} /> {item.paciente.email}
                  </a>
                )}
                {!item.paciente?.telefono && !item.paciente?.email && (
                  <span className="rec-muted">Sin contacto registrado</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rec-section">
          <div className="rec-section-title">Próxima cita</div>
          <div className="rec-cita-info">
            <div className="rec-cita-fecha">{formatFecha(item.proxima_cita)}</div>
            <div
              className="rec-urgencia-badge"
              style={{ color: urgenciaConfig(item.urgencia, item.dias_restantes).color,
                       background: urgenciaConfig(item.urgencia, item.dias_restantes).bg }}
            >
              {urgenciaConfig(item.urgencia, item.dias_restantes).label}
            </div>
            <div
              className="rec-estado-badge"
              style={{ color: estadoBadgeConf.color, background: estadoBadgeConf.bg }}
            >
              {estadoBadgeConf.label}
            </div>
          </div>
          <div className="rec-medico-row">
            <div className="rec-avatar sm">{iniciales(item.medico_sugerido?.nombre)}</div>
            <div>
              <div className="rec-medico-nombre">{item.medico_sugerido?.nombre}</div>
              <div className="rec-medico-esp">{item.medico_sugerido?.especialidad}</div>
            </div>
          </div>
        </div>

        {(item.diagnostico || item.indicaciones) && (
          <div className="rec-section">
            <div className="rec-section-title">Última consulta</div>
            {item.diagnostico && (
              <div className="rec-campo">
                <span className="rec-campo-label">Diagnóstico</span>
                <span className="rec-campo-valor">{item.diagnostico}</span>
              </div>
            )}
            {item.indicaciones && (
              <div className="rec-campo">
                <span className="rec-campo-label">Indicaciones</span>
                <span className="rec-campo-valor">{item.indicaciones}</span>
              </div>
            )}
          </div>
        )}

        {ultimasTres.length > 0 && (
          <div className="rec-section">
            <div className="rec-section-title">Últimas consultas</div>
            {ultimasTres.map(c => (
              <div key={c.id} className="rec-hist-item">
                <Calendar size={12} color="#9ca3af" style={{ flexShrink: 0 }} />
                <div>
                  <div className="rec-hist-fecha">{formatFecha(c.agenda_detalle?.fecha)}</div>
                  {c.diagnostico && (
                    <div className="rec-hist-diag">{c.diagnostico}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rec-section">
          <div className="rec-section-title">Notificar paciente</div>
          {!tieneEmail && (
            <div className="rec-sin-email-aviso">
              <Mail size={12} /> Sin email registrado — se usará el modal para ingresar el canal manualmente.
            </div>
          )}
          <div className="rec-notif-btns">
            {[
              { tipo: 'recordatorio_cita',    icon: <Bell size={13} />,         label: 'Recordatorio de cita' },
              { tipo: 'confirmacion_reserva', icon: <CheckCircle size={13} />,  label: 'Confirmación de reserva' },
              { tipo: 'indicaciones',         icon: <Send size={13} />,         label: 'Enviar indicaciones', sinInd: !item.indicaciones },
            ].map(({ tipo, icon, label, sinInd }) => (
              confirmDirecto === tipo ? (
                <div key={tipo} className="rec-btn-confirm-directo">
                  <span>¿Enviar a <strong>{item.paciente?.email}</strong>?</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="rec-btn-confirm-si"
                      onClick={() => handleEnviarDirecto(tipo)}
                      disabled={enviandoDirecto}
                    >
                      {enviandoDirecto ? '…' : 'Enviar'}
                    </button>
                    <button className="rec-btn-confirm-no" onClick={() => setConfirmDirecto(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button
                  key={tipo}
                  className="rec-btn-notif"
                  onClick={() => handleClickNotif(tipo, !sinInd)}
                  disabled={sinInd}
                  title={sinInd ? 'Esta consulta no tiene indicaciones registradas' : ''}
                >
                  {icon}
                  {label}
                  {sinInd
                    ? <span className="rec-canal-tag rec-canal-tag--sin">Sin indicaciones</span>
                    : tieneEmail
                      ? <span className="rec-canal-tag rec-canal-tag--email"><Mail size={10} /> Email</span>
                      : <span className="rec-canal-tag">Manual</span>
                  }
                </button>
              )
            ))}
          </div>
        </div>

        {historialNotif.length > 0 && (
          <div className="rec-section">
            <div className="rec-section-title">Historial de notificaciones</div>
            {historialNotif.slice(0, 5).map(n => (
              <div key={n.id} className="rec-notif-hist-item">
                <div className="rec-notif-hist-tipo">{n.tipo_display}</div>
                <div className="rec-notif-hist-meta">
                  <span>{n.canal_display}</span>
                  <span
                    className="rec-notif-hist-estado"
                    style={{
                      color: n.estado === 'enviado' ? '#16a34a'
                           : n.estado === 'fallido' ? '#dc2626'
                           : '#d97706',
                    }}
                  >
                    {n.estado_display}
                  </span>
                  <span className="rec-muted">{formatFechaHora(n.fecha_creacion)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <button className="rec-btn-agenda" onClick={irAAgenda}>
          <Calendar size={14} />
          Ir a agenda
          <ExternalLink size={12} />
        </button>

      </div>

      {modalTipo && (
        <ModalNotificacion
          item={item}
          tipo={modalTipo}
          onClose={() => setModalTipo(null)}
          onEnviado={() => showToast('Notificación registrada.', 'success')}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}

export default function RecordatoriosPage() {
  const navigate  = useNavigate()
  const { user }  = useAuth()
  const esAdmin   = user?.rol === 'admin'
  const { toast, showToast } = useToast()

  const [periodo,      setPeriodo]      = useState('30dias')
  const [medico,       setMedico]       = useState('')
  const [estadoF,      setEstadoF]      = useState('')
  const [busqueda,     setBusqueda]     = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [expandedRow,  setExpandedRow]  = useState(null)

  const filtros = useMemo(() => {
    if (periodo === 'vencidas') return { periodo: 'vencidas', medico, estado: estadoF }
    if (periodo === 'todos')    return { periodo: 'todos',    medico, estado: estadoF }
    return { dias: periodo === '7dias' ? 7 : 30, medico, estado: estadoF }
  }, [periodo, medico, estadoF])

  const { data: items = [],  isLoading } = useProximasCitas(filtros)
  const { data: stats }                 = useStatsRecordatorios()
  const { data: medicos = [] }          = useMedicosLista()

  const itemsFiltrados = useMemo(() => {
    if (!busqueda.trim()) return items
    const q = busqueda.toLowerCase()
    return items.filter(i =>
      i.paciente?.nombre?.toLowerCase().includes(q) ||
      i.medico_sugerido?.nombre?.toLowerCase().includes(q)
    )
  }, [items, busqueda])

  return (
    <>
      <style>{`
        .rec-page { display: flex; flex-direction: column; height: 100%; }

        .rec-header {
          display: flex; align-items: center; gap: 12px;
          padding: 20px 24px 0;
        }
        .rec-header-icon {
          width: 36px; height: 36px; background: #dbeafe;
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
        }
        .rec-header-title { font-size: 20px; font-weight: 600; color: #111827; }
        .rec-header-sub   { font-size: 13px; color: #9ca3af; }

        .rec-stats {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 12px; padding: 16px 24px 0;
        }
        .rec-stat {
          background: #fff; border: 1px solid #e8edf2;
          border-radius: 10px; padding: 14px 16px;
          display: flex; flex-direction: column; gap: 4px;
        }
        .rec-stat-val { font-size: 26px; font-weight: 700; }
        .rec-stat-lbl { font-size: 11.5px; color: #6b7280; font-weight: 500; }

        .rec-filtros {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          padding: 12px 24px 0;
        }
        .rec-filtro-select, .rec-filtro-input {
          border: 1px solid #e5e7eb; border-radius: 8px;
          padding: 7px 10px; font-size: 13px;
          font-family: 'DM Sans', sans-serif; outline: none;
          background: #fff; color: #374151;
        }
        .rec-filtro-select:focus, .rec-filtro-input:focus {
          border-color: #1a3a5c;
        }
        .rec-periodo-tabs {
          display: flex; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;
        }
        .rec-periodo-tab {
          padding: 7px 14px; font-size: 12.5px; font-weight: 500;
          border: none; cursor: pointer; background: #fff; color: #6b7280;
          font-family: 'DM Sans', sans-serif; transition: background 0.12s;
        }
        .rec-periodo-tab.active {
          background: #1a3a5c; color: #fff;
        }
        .rec-periodo-tab:not(:last-child) { border-right: 1px solid #e5e7eb; }

        .rec-body {
          flex: 1; display: flex; gap: 0; overflow: hidden;
          padding: 12px 24px 24px;
        }

        .rec-tabla-wrap {
          flex: 1; overflow-y: auto;
          border: 1px solid #e8edf2; border-radius: 10px; background: #fff;
        }
        .rec-tabla { width: 100%; border-collapse: collapse; }
        .rec-th {
          text-align: left; padding: 10px 14px;
          font-size: 11.5px; font-weight: 600; color: #6b7280;
          text-transform: uppercase; letter-spacing: .04em;
          background: #f8fafc; border-bottom: 1px solid #e8edf2;
          position: sticky; top: 0;
        }
        .rec-td {
          padding: 11px 14px; font-size: 13px; color: #374151;
          vertical-align: middle; border-bottom: 1px solid #f3f4f6;
        }
        .rec-tr:last-child .rec-td { border-bottom: none; }
        .rec-tr:hover { background: #f9fafb; cursor: pointer; }
        .rec-tr.active { background: #eff6ff; }
        .rec-tr.vencida { background: #fff8f8; }
        .rec-tr.vencida:hover { background: #fef2f2; }

        .rec-pac-cell { display: flex; align-items: center; gap: 8px; }
        .rec-avatar {
          border-radius: 50%; background: #dbeafe; color: #1a3a5c;
          font-weight: 600; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .rec-avatar.md { width: 32px; height: 32px; font-size: 11px; }
        .rec-avatar.sm { width: 26px; height: 26px; font-size: 10px; }
        .rec-avatar.lg { width: 38px; height: 38px; font-size: 13px; }

        .rec-pac-nombre { font-size: 13px; font-weight: 500; color: #111827; }
        .rec-pac-contacto { display: flex; flex-direction: column; gap: 2px; }

        .rec-fecha-mono { font-family: 'Courier New', monospace; font-size: 12.5px; }

        .rec-badge-dias {
          display: inline-block; padding: 2px 8px; border-radius: 20px;
          font-size: 11.5px; font-weight: 600; white-space: nowrap;
        }

        .rec-medico-cell { display: flex; align-items: center; gap: 7px; }
        .rec-medico-nombre { font-size: 12.5px; font-weight: 500; color: #374151; }
        .rec-medico-esp    { font-size: 11px; color: #9ca3af; }

        .rec-estado-pill {
          display: inline-block; padding: 2px 9px;
          border-radius: 20px; font-size: 11.5px; font-weight: 500;
        }

        .rec-btn-agendar {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 11px; border-radius: 6px; border: 1px solid #bfdbfe;
          background: #eff6ff; color: #1a3a5c;
          font-size: 12px; font-family: 'DM Sans', sans-serif;
          font-weight: 500; cursor: pointer; white-space: nowrap;
          transition: background 0.12s;
        }
        .rec-btn-agendar:hover { background: #dbeafe; }

        .rec-empty {
          text-align: center; color: #9ca3af; padding: 48px;
          font-size: 13.5px;
        }
        .rec-loading { text-align: center; color: #9ca3af; padding: 48px; font-size: 13px; }

        .rec-panel {
          width: 360px; flex-shrink: 0;
          border-left: 1px solid #e8edf2;
          display: flex; flex-direction: column; overflow: hidden;
          margin-left: 0; padding-left: 0;
          background: #fff; border-radius: 0 10px 10px 0;
          border: 1px solid #e8edf2; margin-left: 12px; border-radius: 10px;
        }
        .rec-panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px; border-bottom: 1px solid #e8edf2; flex-shrink: 0;
        }
        .rec-panel-titulo { font-size: 14px; font-weight: 600; color: #111827; }
        .rec-panel-cerrar {
          border: none; background: none; cursor: pointer;
          color: #9ca3af; padding: 4px; border-radius: 6px;
          display: flex; transition: color 0.12s;
        }
        .rec-panel-cerrar:hover { color: #374151; }
        .rec-panel-body {
          flex: 1; overflow-y: auto; padding: 14px 16px;
          display: flex; flex-direction: column; gap: 16px;
        }

        .rec-section { display: flex; flex-direction: column; gap: 8px; }
        .rec-section-title {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: .06em; color: #6b7280; padding-bottom: 4px;
          border-bottom: 1px solid #f3f4f6;
        }

        .rec-pac-card { display: flex; align-items: flex-start; gap: 10px; }
        .rec-pac-nombre { font-size: 14px; font-weight: 600; color: #111827; }
        .rec-link {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 12px; color: #1a3a5c; text-decoration: none;
        }
        .rec-link:hover { text-decoration: underline; }
        .rec-muted { font-size: 12px; color: #9ca3af; }

        .rec-cita-info {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        }
        .rec-cita-fecha { font-family: 'Courier New', monospace; font-size: 14px; font-weight: 600; color: #111827; }
        .rec-urgencia-badge, .rec-estado-badge {
          font-size: 11.5px; font-weight: 600; padding: 2px 8px;
          border-radius: 20px;
        }
        .rec-medico-row { display: flex; align-items: center; gap: 8px; }

        .rec-campo { display: flex; flex-direction: column; gap: 2px; }
        .rec-campo-label { font-size: 11px; color: #9ca3af; font-weight: 500; }
        .rec-campo-valor { font-size: 13px; color: #374151; }

        .rec-hist-item {
          display: flex; gap: 8px; align-items: flex-start;
          padding: 6px 0; border-bottom: 1px solid #f9fafb;
        }
        .rec-hist-item:last-child { border-bottom: none; }
        .rec-hist-fecha { font-size: 12px; font-weight: 500; color: #374151; }
        .rec-hist-diag  { font-size: 11.5px; color: #9ca3af; }

        .rec-notif-btns { display: flex; flex-direction: column; gap: 6px; }
        .rec-btn-notif {
          display: flex; align-items: center; gap: 8px;
          padding: 9px 12px; border-radius: 8px;
          border: 1px solid #e5e7eb; background: #f8fafc;
          font-size: 12.5px; font-family: 'DM Sans', sans-serif;
          font-weight: 500; color: #374151; cursor: pointer;
          transition: background 0.12s; text-align: left;
        }
        .rec-btn-notif:hover:not(:disabled) { background: #eff6ff; border-color: #bfdbfe; }
        .rec-btn-notif:disabled { opacity: 0.5; cursor: default; }
        .rec-canal-tag {
          margin-left: auto; font-size: 10.5px; font-weight: 500;
          color: #d97706; background: #fffbeb; padding: 1px 6px;
          border-radius: 10px; flex-shrink: 0;
        }
        .rec-canal-tag--sin { color: #9ca3af; background: #f3f4f6; }

        .rec-notif-hist-item {
          padding: 6px 0; border-bottom: 1px solid #f9fafb;
          display: flex; flex-direction: column; gap: 3px;
        }
        .rec-notif-hist-item:last-child { border-bottom: none; }
        .rec-notif-hist-tipo  { font-size: 12.5px; font-weight: 500; color: #374151; }
        .rec-notif-hist-meta  { display: flex; gap: 8px; align-items: center; font-size: 11px; color: #9ca3af; flex-wrap: wrap; }
        .rec-notif-hist-estado { font-weight: 600; }

        .rec-btn-agenda {
          display: flex; align-items: center; justify-content: center; gap: 7px;
          padding: 10px; border-radius: 8px; border: none;
          background: #1a3a5c; color: #fff;
          font-size: 13px; font-family: 'DM Sans', sans-serif;
          font-weight: 500; cursor: pointer; transition: background 0.15s;
          margin-top: auto;
        }
        .rec-btn-agenda:hover { background: #15304d; }

        .rec-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.35);
          z-index: 1000;
        }
        .rec-modal {
          position: fixed; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          background: #fff; border-radius: 12px;
          width: 460px; max-width: 95vw;
          box-shadow: 0 20px 60px rgba(0,0,0,.15);
          z-index: 1001; display: flex; flex-direction: column;
        }
        .rec-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid #e8edf2;
        }
        .rec-modal-title {
          display: flex; align-items: center; gap: 8px;
          font-size: 15px; font-weight: 600; color: #111827;
        }
        .rec-modal-close {
          border: none; background: none; cursor: pointer;
          color: #9ca3af; padding: 4px; border-radius: 6px;
          display: flex; transition: color 0.12s;
        }
        .rec-modal-close:hover { color: #374151; }
        .rec-modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        .rec-modal-footer {
          display: flex; justify-content: flex-end; gap: 10px;
          padding: 14px 20px; border-top: 1px solid #e8edf2;
        }

        .rec-form-group { display: flex; flex-direction: column; gap: 6px; }
        .rec-label { font-size: 12.5px; font-weight: 500; color: #374151; }
        .rec-input {
          border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px;
          font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none;
        }
        .rec-input:focus { border-color: #1a3a5c; }
        .rec-textarea {
          border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px;
          font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none;
          resize: vertical;
        }
        .rec-textarea:focus { border-color: #1a3a5c; }
        .rec-radio-group { display: flex; gap: 16px; }
        .rec-radio-label {
          display: flex; align-items: center; gap: 6px;
          font-size: 13px; cursor: pointer;
        }
        .rec-canal-aviso {
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; color: #d97706;
          background: #fffbeb; padding: 8px 10px; border-radius: 8px;
        }

        .rec-btn-primario {
          padding: 8px 18px; border-radius: 8px; border: none;
          background: #1a3a5c; color: #fff;
          font-size: 13px; font-family: 'DM Sans', sans-serif;
          font-weight: 500; cursor: pointer; transition: background 0.15s;
        }
        .rec-btn-primario:hover:not(:disabled) { background: #15304d; }
        .rec-btn-primario:disabled { background: #9ca3af; cursor: default; }
        .rec-btn-secundario {
          padding: 8px 18px; border-radius: 8px;
          border: 1px solid #e5e7eb; background: #fff;
          color: #374151; font-size: 13px;
          font-family: 'DM Sans', sans-serif; font-weight: 500;
          cursor: pointer; transition: background 0.12s;
        }
        .rec-btn-secundario:hover { background: #f9fafb; }

        .rec-btn-config {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 7px 14px; border-radius: 8px;
          border: 1px solid #e5e7eb; background: #fff;
          color: #374151; font-size: 12px;
          font-family: 'DM Sans', sans-serif; font-weight: 500;
          cursor: pointer; transition: background .12s; flex-shrink: 0;
        }
        .rec-btn-config:hover { background: #f3f4f6; }

        .rec-th-email { width: 36px; text-align: center; }
        .rec-td-email { text-align: center; }

        .rec-expand-btn {
          border: none; background: none; cursor: pointer; padding: 2px;
          color: #9ca3af; display: flex; align-items: center;
          border-radius: 4px; flex-shrink: 0; transition: color .12s;
        }
        .rec-expand-btn:hover { color: #374151; }

        .rec-tr-expandida { background: #f8fafc; }
        .rec-td-hist { padding: 10px 16px 14px; border-bottom: 1px solid #e8edf2; }
        .rec-hist-inline-titulo {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .06em; color: #6b7280; margin-bottom: 8px;
        }

        .rec-btn-reenviar {
          border: 1px solid #e5e7eb; background: #fff; color: #374151;
          border-radius: 5px; padding: 3px 6px; cursor: pointer;
          display: flex; align-items: center; transition: background .12s;
        }
        .rec-btn-reenviar:hover:not(:disabled) { background: #f3f4f6; }
        .rec-btn-reenviar:disabled { opacity: 0.5; cursor: default; }

        .rec-sin-email-aviso {
          display: flex; align-items: center; gap: 6px;
          font-size: 11.5px; color: #9ca3af;
          background: #f8fafc; padding: 6px 10px; border-radius: 7px;
          margin-bottom: 8px;
        }

        .rec-canal-tag--email {
          color: #16a34a; background: #f0fdf4;
          display: inline-flex; align-items: center; gap: 3px;
        }

        .rec-btn-confirm-directo {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 12px; border-radius: 8px;
          border: 1px solid #bfdbfe; background: #eff6ff;
          font-size: 12px; color: #374151;
        }
        .rec-btn-confirm-si {
          padding: 4px 12px; border-radius: 6px; border: none;
          background: #1a3a5c; color: #fff; font-size: 12px;
          font-family: 'DM Sans', sans-serif; font-weight: 500;
          cursor: pointer; transition: background .12s;
        }
        .rec-btn-confirm-si:hover:not(:disabled) { background: #15304d; }
        .rec-btn-confirm-si:disabled { background: #9ca3af; cursor: default; }
        .rec-btn-confirm-no {
          padding: 4px 12px; border-radius: 6px;
          border: 1px solid #e5e7eb; background: #fff;
          color: #374151; font-size: 12px;
          font-family: 'DM Sans', sans-serif; cursor: pointer;
        }
        .rec-btn-confirm-no:hover { background: #f9fafb; }

        @media (max-width: 768px) {
          .rec-tabla-wrap { overflow-x: auto; }
        }
      `}</style>

      <div className="rec-page">

        <div className="rec-header">
          <div className="rec-header-icon">
            <Bell size={18} color="#1a3a5c" />
          </div>
          <div style={{ flex: 1 }}>
            <div className="rec-header-title">Recordatorios</div>
            <div className="rec-header-sub">Próximas citas y notificaciones a pacientes</div>
          </div>
          {esAdmin && (
            <button
              className="rec-btn-config"
              onClick={() => navigate('/agenda/recordatorios/configuracion')}
            >
              <Settings size={13} /> Configuración
            </button>
          )}
        </div>

        <div className="rec-stats">
          {[
            { label: 'Vencidas',        val: stats?.vencidas        ?? '—', color: '#dc2626' },
            { label: 'Próximos 7 días', val: stats?.proximos_7_dias  ?? '—', color: '#d97706' },
            { label: 'Próximos 30 días',val: stats?.proximos_30_dias ?? '—', color: '#2563eb' },
            { label: 'Agendadas',       val: stats?.agendadas       ?? '—', color: '#16a34a' },
          ].map(s => (
            <div key={s.label} className="rec-stat">
              <div className="rec-stat-val" style={{ color: s.color }}>{s.val}</div>
              <div className="rec-stat-lbl">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="rec-filtros">
          <div className="rec-periodo-tabs">
            {[
              ['vencidas', 'Vencidas'],
              ['7dias',    '7 días'],
              ['30dias',   '30 días'],
              ['todos',    'Todos'],
            ].map(([v, l]) => (
              <button
                key={v}
                className={`rec-periodo-tab ${periodo === v ? 'active' : ''}`}
                onClick={() => setPeriodo(v)}
              >{l}</button>
            ))}
          </div>

          <select
            className="rec-filtro-select"
            value={medico}
            onChange={e => setMedico(e.target.value)}
          >
            <option value="">Todos los médicos</option>
            {medicos.map(m => (
              <option key={m.id} value={m.id}>{m.persona?.razon_social || m.nombre}</option>
            ))}
          </select>

          <select
            className="rec-filtro-select"
            value={estadoF}
            onChange={e => setEstadoF(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="agendado">Agendado</option>
          </select>

          <input
            className="rec-filtro-input"
            placeholder="Buscar paciente o médico…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>

        <div className="rec-body">

          <div className="rec-tabla-wrap">
            {isLoading ? (
              <div className="rec-loading">Cargando…</div>
            ) : itemsFiltrados.length === 0 ? (
              <div className="rec-empty">
                {busqueda ? 'Sin resultados para la búsqueda.' : 'No hay próximas citas en este período.'}
              </div>
            ) : (
              <table className="rec-tabla">
                <thead>
                  <tr>
                    <th className="rec-th">Paciente</th>
                    <th className="rec-th rec-th-email" title="Email registrado">
                      <Mail size={12} />
                    </th>
                    <th className="rec-th">Próxima cita</th>
                    <th className="rec-th">Días</th>
                    <th className="rec-th">Médico sugerido</th>
                    <th className="rec-th">Estado</th>
                    <th className="rec-th" style={{ width: 90 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {itemsFiltrados.map(item => {
                    const uc         = urgenciaConfig(item.urgencia, item.dias_restantes)
                    const isVencida  = item.urgencia === 'vencida'
                    const isSelected = seleccionado?.consulta_id === item.consulta_id
                    const isExpanded = expandedRow === item.consulta_id
                    const irA = () => {
                      const params = new URLSearchParams()
                      if (item.medico_sugerido?.id) params.set('persona_rrhh', item.medico_sugerido.id)
                      if (item.proxima_cita)        params.set('fecha', item.proxima_cita)
                      navigate(`/agenda/citas?${params.toString()}`)
                    }
                    return (
                      <>
                        <tr
                          key={item.consulta_id}
                          className={`rec-tr ${isVencida ? 'vencida' : ''} ${isSelected ? 'active' : ''}`}
                          onClick={() => setSeleccionado(isSelected ? null : item)}
                        >
                          <td className="rec-td">
                            <div className="rec-pac-cell">
                              <button
                                className="rec-expand-btn"
                                onClick={e => { e.stopPropagation(); setExpandedRow(isExpanded ? null : item.consulta_id) }}
                                title={isExpanded ? 'Ocultar historial' : 'Ver historial de notificaciones'}
                              >
                                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                              </button>
                              <div className="rec-avatar md">{iniciales(item.paciente?.nombre)}</div>
                              <div>
                                <div className="rec-pac-nombre">{item.paciente?.nombre}</div>
                                {item.paciente?.telefono && (
                                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{item.paciente.telefono}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="rec-td rec-td-email" onClick={e => e.stopPropagation()}>
                            {item.paciente?.email
                              ? <CheckCircle size={14} color="#16a34a" title={item.paciente.email} />
                              : <XCircle    size={14} color="#d1d5db" title="Sin email" />
                            }
                          </td>
                          <td className="rec-td">
                            <span className="rec-fecha-mono">{formatFecha(item.proxima_cita)}</span>
                          </td>
                          <td className="rec-td">
                            <span className="rec-badge-dias" style={{ color: uc.color, background: uc.bg }}>
                              {uc.label}
                            </span>
                          </td>
                          <td className="rec-td">
                            <div className="rec-medico-cell">
                              <div className="rec-avatar sm">{iniciales(item.medico_sugerido?.nombre)}</div>
                              <div>
                                <div className="rec-medico-nombre">{item.medico_sugerido?.nombre}</div>
                                <div className="rec-medico-esp">{item.medico_sugerido?.especialidad}</div>
                              </div>
                            </div>
                          </td>
                          <td className="rec-td">
                            <span
                              className="rec-estado-pill"
                              style={{
                                color:      item.estado === 'agendado' ? '#16a34a' : '#d97706',
                                background: item.estado === 'agendado' ? '#f0fdf4' : '#fffbeb',
                              }}
                            >
                              {item.estado === 'agendado' ? 'Agendado' : 'Pendiente'}
                            </span>
                          </td>
                          <td className="rec-td" onClick={e => e.stopPropagation()}>
                            <button className="rec-btn-agendar" onClick={irA}>
                              {item.estado === 'pendiente'
                                ? <><Calendar size={12} /> Agendar</>
                                : <><ExternalLink size={12} /> Ver</>
                              }
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${item.consulta_id}-hist`} className="rec-tr-expandida">
                            <td colSpan={7} className="rec-td-hist">
                              <div className="rec-hist-inline-titulo">Historial de notificaciones</div>
                              <HistorialExpandido pacienteId={item.paciente?.id} />
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {seleccionado && (
            <PanelDetalle
              item={seleccionado}
              onCerrar={() => setSeleccionado(null)}
            />
          )}

        </div>
      </div>

      <Toast toast={toast} />
    </>
  )
}
