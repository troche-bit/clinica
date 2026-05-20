import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileSpreadsheet, FileText, Users, BarChart2,
  CalendarDays, Stethoscope, CalendarCheck, ClipboardList, ChevronRight,
  UserCheck, Activity, BookOpen,
} from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../hooks/useToast'
import Toast from '../../components/ui/Toast'
import { useAuth } from '../../context/AuthContext'
import { usePaises, useDepartamentos, useCiudades } from '../../hooks/mantenimiento/useUbicacion'
import { useStatsConsultasHoy } from '../../hooks/clinica/useConsultas'
import { useStatsHoy } from '../../hooks/clinica/useAgenda'
import apiClient from '../../api/client'

const SEXO_OPCIONES = [
  { value: '',  label: 'Todos' },
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'O', label: 'Otro' },
]

const SANGRE_OPCIONES = [
  { value: '',    label: 'Todos' },
  { value: 'A+',  label: 'A+' }, { value: 'A-',  label: 'A-' },
  { value: 'B+',  label: 'B+' }, { value: 'B-',  label: 'B-' },
  { value: 'AB+', label: 'AB+' }, { value: 'AB-', label: 'AB-' },
  { value: 'O+',  label: 'O+' }, { value: 'O-',  label: 'O-' },
]

const DIAS = [
  { id: 1, label: 'Lunes' },   { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' }, { id: 4, label: 'Jueves' },
  { id: 5, label: 'Viernes' }, { id: 6, label: 'Sábado' },
  { id: 7, label: 'Domingo' },
]

const FILTROS_INICIALES          = { sexo: '', grupo_sanguineo: '', pais: '', departamento: '', ciudad: '', fecha_desde: '', fecha_hasta: '' }
const FILTROS_HORARIO_INICIALES  = { persona_rrhh: '', dia_semana: '' }
const FILTROS_CONSULTA_INICIALES = { persona_rrhh: '', especialidad: '', evento_clinico: '', paciente: '', fecha_desde: '', fecha_hasta: '' }
const FILTROS_AGENDA_INICIALES   = { persona_rrhh: '', especialidad: '', estado: '', fecha_desde: '', fecha_hasta: '' }

const ESTADO_AGENDA_OPCIONES = [
  { value: '',           label: 'Todos' },
  { value: 'disponible', label: 'Disponible' },
  { value: 'ocupado',    label: 'Ocupado' },
  { value: 'realizado',  label: 'Realizado' },
  { value: 'cancelado',  label: 'Cancelado' },
  { value: 'inactivo',   label: 'Inactivo' },
]

function buildQS(obj) {
  const p = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => { if (v) p.append(k, v) })
  const s = p.toString()
  return s ? '?' + s : ''
}

function getPrestadorLabel(p) {
  return p.nombre ?? p.persona?.razon_social ?? ''
}

function BuscadorFiltrable({ items, getLabel, selectedId, selectedNombre, onSelect, onClear, placeholder = 'Buscar...' }) {
  const [busqueda, setBusqueda] = useState('')
  const filtrados = busqueda.trim()
    ? items.filter(it => getLabel(it).toLowerCase().includes(busqueda.toLowerCase()))
    : []

  if (selectedId) {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="input" readOnly value={selectedNombre} style={{ flex: 1 }} />
        <button className="inf-pac-pac-clear" onClick={onClear}>✕</button>
      </div>
    )
  }
  return (
    <div style={{ position: 'relative' }}>
      <input className="input" placeholder={placeholder} value={busqueda}
        onChange={e => setBusqueda(e.target.value)} />
      {busqueda.trim().length > 0 && (
        <div className="inf-pac-pac-dropdown">
          {filtrados.length > 0
            ? filtrados.slice(0, 8).map(it => (
                <div key={it.id} className="inf-pac-pac-item"
                  onClick={() => { onSelect(it); setBusqueda('') }}>
                  {getLabel(it)}
                </div>
              ))
            : <div className="inf-pac-pac-item" style={{ color: '#9ca3af' }}>Sin resultados</div>
          }
        </div>
      )}
    </div>
  )
}

export default function InformesPacientePage() {
  const navigate = useNavigate()
  const { toast, showToast } = useToast()
  const { user } = useAuth()
  const esResumen = user?.rol === 'admin' || user?.rol === 'recepcionista'

  // ── Pacientes ──
  const [listadoAbierto, setListadoAbierto] = useState(false)
  const [filtros, setFiltros]               = useState(FILTROS_INICIALES)
  const [loadingPdf, setLoadingPdf]         = useState(false)
  const [loadingXls, setLoadingXls]         = useState(false)

  // ── Horarios ──
  const [horarioAbierto, setHorarioAbierto]   = useState(false)
  const [filtrosHorario, setFiltrosHorario]   = useState(FILTROS_HORARIO_INICIALES)
  const [loadingHorPdf, setLoadingHorPdf]     = useState(false)
  const [loadingHorXls, setLoadingHorXls]     = useState(false)
  const [prestHorNombre, setPrestHorNombre]   = useState('')

  // ── Consultas ──
  const [consultaAbierta, setConsultaAbierta] = useState(false)
  const [filtrosConsulta, setFiltrosConsulta] = useState(FILTROS_CONSULTA_INICIALES)
  const [loadingConPdf, setLoadingConPdf]     = useState(false)
  const [loadingConXls, setLoadingConXls]     = useState(false)
  const [prestConNombre, setPrestConNombre]   = useState('')
  const [pacienteNombre, setPacienteNombre]   = useState('')
  const [pacientesSearch, setPacientesSearch] = useState('')
  const [pacientesRes, setPacientesRes]       = useState([])

  // ── Agenda ──
  const [agendaAbierta, setAgendaAbierta]         = useState(false)
  const [filtrosAgenda, setFiltrosAgenda]         = useState(FILTROS_AGENDA_INICIALES)
  const [loadingAgPdf, setLoadingAgPdf]           = useState(false)
  const [prestAgendaNombre, setPrestAgendaNombre] = useState('')
  const [espAgendaNombre, setEspAgendaNombre]     = useState('')

  // ── Historia clínica ──
  const [historiaAbierta, setHistoriaAbierta]   = useState(false)
  const [historiaSearch, setHistoriaSearch]     = useState('')
  const [historiaRes, setHistoriaRes]           = useState([])
  const [historiaSel, setHistoriaSel]           = useState(null)
  const [historiaFocusIdx, setHistoriaFocusIdx] = useState(-1)
  const [loadingHisPdf, setLoadingHisPdf]       = useState(false)

  // ── Datos compartidos ──
  const [prestadores, setPrestadores]       = useState([])
  const [especialidades, setEspecialidades] = useState([])
  const [eventosClinicos, setEventos]       = useState([])

  // ── Resumen rápido ──
  const [pacientesCount, setPacientesCount] = useState(null)
  const { data: statsConsultas }            = useStatsConsultasHoy()
  const { data: statsHoy }                  = useStatsHoy()

  const { data: paises = [] }        = usePaises()
  const { data: departamentos = [] } = useDepartamentos(filtros.pais)
  const { data: ciudades = [] }      = useCiudades(filtros.departamento)

  useEffect(() => {
    if (!esResumen) return
    apiClient.get('/paciente/count/')
      .then(r => setPacientesCount(r.data.count ?? r.data.total ?? null))
      .catch(() => {})
  }, [esResumen])

  useEffect(() => {
    if (!horarioAbierto && !consultaAbierta && !agendaAbierta) return
    if (prestadores.length > 0) return
    apiClient.get('/personarrhh/', { params: { page_size: 200 } })
      .then(r => setPrestadores(r.data.results ?? r.data))
      .catch(() => {})
  }, [horarioAbierto, consultaAbierta, agendaAbierta])

  useEffect(() => {
    if (!consultaAbierta && !agendaAbierta) return
    if (especialidades.length === 0) {
      apiClient.get('/especialidad/', { params: { page_size: 200 } })
        .then(r => setEspecialidades(r.data.results ?? r.data))
        .catch(() => {})
    }
    if (consultaAbierta && eventosClinicos.length === 0) {
      apiClient.get('/eventoclinico/', { params: { page_size: 200 } })
        .then(r => setEventos(r.data.results ?? r.data))
        .catch(() => {})
    }
  }, [consultaAbierta, agendaAbierta])

  useEffect(() => {
    const q = pacientesSearch.trim()
    if (q.length < 2) { setPacientesRes([]); return }
    const t = setTimeout(() => {
      apiClient.get('/paciente/', { params: { search: q, page_size: 8 } })
        .then(r => setPacientesRes(r.data.results ?? r.data))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [pacientesSearch])

  useEffect(() => {
    if (!historiaAbierta) return
    const q = historiaSearch.trim()
    setHistoriaFocusIdx(-1)
    if (q.length < 2) { setHistoriaRes([]); return }
    const t = setTimeout(() => {
      apiClient.get('/paciente/', { params: { search: q, page_size: 8 } })
        .then(r => setHistoriaRes(r.data.results ?? r.data))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [historiaSearch, historiaAbierta])

  function handleFiltroChange(campo, valor) {
    setFiltros(prev => {
      const n = { ...prev, [campo]: valor }
      if (campo === 'pais')         { n.departamento = ''; n.ciudad = '' }
      if (campo === 'departamento') { n.ciudad = '' }
      return n
    })
  }

  function handleAbrirListado() {
    setFiltros(FILTROS_INICIALES)
    setListadoAbierto(true)
  }

  function handleAbrirHorario() {
    setFiltrosHorario(FILTROS_HORARIO_INICIALES)
    setPrestHorNombre('')
    setHorarioAbierto(true)
  }

  function handleAbrirConsulta() {
    setFiltrosConsulta(FILTROS_CONSULTA_INICIALES)
    setPrestConNombre('')
    setPacienteNombre('')
    setPacientesSearch('')
    setPacientesRes([])
    setConsultaAbierta(true)
  }

  function handleAbrirAgenda() {
    setFiltrosAgenda(FILTROS_AGENDA_INICIALES)
    setPrestAgendaNombre('')
    setEspAgendaNombre('')
    setAgendaAbierta(true)
  }

  function handleAbrirHistoria() {
    setHistoriaSearch('')
    setHistoriaRes([])
    setHistoriaSel(null)
    setHistoriaFocusIdx(-1)
    setHistoriaAbierta(true)
  }

  function seleccionarHistoriaPaciente(p) {
    setHistoriaSel(p)
    setHistoriaSearch('')
    setHistoriaRes([])
    setHistoriaFocusIdx(-1)
  }

  function handleHistoriaKeyDown(e) {
    if (historiaRes.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHistoriaFocusIdx(i => Math.min(i + 1, historiaRes.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHistoriaFocusIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (historiaFocusIdx >= 0) seleccionarHistoriaPaciente(historiaRes[historiaFocusIdx])
    } else if (e.key === 'Escape') {
      setHistoriaRes([])
      setHistoriaFocusIdx(-1)
    }
  }

  async function handleVerPdf() {
    setLoadingPdf(true)
    try {
      const res = await apiClient.get(`/paciente/reporte-lista/${buildQS(filtros)}`, { responseType: 'blob' })
      window.open(URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })), '_blank')
    } catch { showToast('No se pudo generar el PDF.', 'error') }
    finally { setLoadingPdf(false) }
  }

  async function handleDescargarExcel() {
    setLoadingXls(true)
    try {
      const tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const res  = await apiClient.get(`/paciente/reporte-lista-excel/${buildQS(filtros)}`, { responseType: 'blob' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([res.data], { type: tipo }))
      link.download = `listado_pacientes_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.xlsx`
      link.click()
    } catch { showToast('No se pudo generar el Excel.', 'error') }
    finally { setLoadingXls(false) }
  }

  async function handleHorarioPdf() {
    setLoadingHorPdf(true)
    try {
      const res = await apiClient.get(`/horario-prestador/reporte-horarios/${buildQS(filtrosHorario)}`, { responseType: 'blob' })
      window.open(URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })), '_blank')
    } catch { showToast('No se pudo generar el PDF.', 'error') }
    finally { setLoadingHorPdf(false) }
  }

  async function handleHorarioExcel() {
    setLoadingHorXls(true)
    try {
      const tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const res  = await apiClient.get(`/horario-prestador/reporte-horarios-excel/${buildQS(filtrosHorario)}`, { responseType: 'blob' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([res.data], { type: tipo }))
      link.download = `horarios_prestadores_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.xlsx`
      link.click()
    } catch { showToast('No se pudo generar el Excel.', 'error') }
    finally { setLoadingHorXls(false) }
  }

  async function handleConsultaPdf() {
    setLoadingConPdf(true)
    try {
      const res = await apiClient.get(`/consultas/reporte-consultas/${buildQS(filtrosConsulta)}`, { responseType: 'blob' })
      window.open(URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })), '_blank')
    } catch { showToast('No se pudo generar el PDF.', 'error') }
    finally { setLoadingConPdf(false) }
  }

  async function handleAgendaPdf() {
    setLoadingAgPdf(true)
    try {
      const res = await apiClient.get(`/agenda/reporte-agenda/${buildQS(filtrosAgenda)}`, { responseType: 'blob' })
      window.open(URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })), '_blank')
    } catch { showToast('No se pudo generar el PDF.', 'error') }
    finally { setLoadingAgPdf(false) }
  }

  async function handleHistoriaPdf() {
    if (!historiaSel) return
    setLoadingHisPdf(true)
    try {
      const res = await apiClient.get(`/consultas/historia-clinica/?paciente=${historiaSel.id}`, { responseType: 'blob' })
      window.open(URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })), '_blank')
    } catch { showToast('No se pudo generar la historia clínica.', 'error') }
    finally { setLoadingHisPdf(false) }
  }

  async function handleConsultaExcel() {
    setLoadingConXls(true)
    try {
      const tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const res  = await apiClient.get(`/consultas/reporte-consultas-excel/${buildQS(filtrosConsulta)}`, { responseType: 'blob' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([res.data], { type: tipo }))
      link.download = `consultas_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.xlsx`
      link.click()
    } catch { showToast('No se pudo generar el Excel.', 'error') }
    finally { setLoadingConXls(false) }
  }

  function seleccionarPaciente(pac) {
    const nombre = pac.persona?.razon_social ?? pac.nombre ?? ''
    setPacienteNombre(nombre)
    setPacientesSearch('')
    setPacientesRes([])
    setFiltrosConsulta(prev => ({ ...prev, paciente: String(pac.id) }))
  }

  return (
    <>
      <style>{`
        .inf-pac-wrap { padding: 24px; }
        @media (max-width: 768px) { .inf-pac-wrap { padding: 14px; } }

        .inf-pac-page-header { margin-bottom: 24px; }
        .inf-pac-page-header h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
        .inf-pac-page-header p  { font-size: 14px; color: #6b7280; margin: 0; }

        /* ── Resumen rápido ── */
        .inf-pac-resumen {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
          margin-bottom: 24px;
        }
        .inf-pac-stat {
          background: #f8fafc; border: 1px solid #e8edf2; border-radius: 8px;
          padding: 14px 16px;
        }
        .inf-pac-stat-val { font-size: 30px; font-weight: 700; color: #1a3a5c; line-height: 1; margin-bottom: 5px; }
        .inf-pac-stat-lbl { font-size: 11px; color: #6b7280; }
        @media (max-width: 768px) {
          .inf-pac-resumen { gap: 8px; }
          .inf-pac-stat { padding: 10px 10px; }
          .inf-pac-stat-val { font-size: 22px; }
          .inf-pac-stat-lbl { font-size: 10px; }
        }

        /* ── Sección ── */
        .inf-pac-section { margin-bottom: 28px; }
        .inf-pac-section-label {
          display: flex; align-items: center; gap: 8px;
          font-size: 11px; font-weight: 700; letter-spacing: .08em;
          text-transform: uppercase; color: #6b7280;
          margin-bottom: 14px;
        }
        .inf-pac-section-line { flex: 1; height: 1px; background: #e8edf2; }

        /* ── Grid de cards ── */
        .inf-pac-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 768px) { .inf-pac-grid { grid-template-columns: 1fr; gap: 10px; } }

        /* ── Card base ── */
        .inf-pac-card {
          background: #fff; border: 1px solid #e8edf2; border-radius: 10px;
          padding: 16px 18px; cursor: pointer; position: relative;
          display: flex; flex-direction: column; gap: 8px;
          transition: all 0.2s ease;
        }
        .inf-pac-card:hover {
          box-shadow: 0 8px 24px rgba(0,0,0,0.10);
          border-color: #bfdbfe;
          transform: translateY(-2px);
        }

        /* ── Variantes de card ── */
        .inf-pac-card-listado {
          border-left: 3px solid #1a3a5c;
        }
        .inf-pac-card-listado:hover {
          border-left-color: #1a3a5c;
        }
        .inf-pac-card-estadistica {
          background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
        }

        /* ── Ícono de card ── */
        .inf-pac-card-icon {
          background: #e8f0fe; border-radius: 10px; padding: 10px;
          display: inline-flex; align-items: center; justify-content: center;
          width: 44px; height: 44px; flex-shrink: 0;
        }

        /* ── Badge ── */
        .inf-pac-badge {
          position: absolute; top: 12px; right: 12px;
          font-size: 11px; font-weight: 500; border-radius: 4px; padding: 2px 6px;
          white-space: nowrap;
        }
        .inf-pac-badge-export { background: #f0fdf4; color: #16a34a; }
        .inf-pac-badge-dash   { background: #eff6ff; color: #4f46e5; }
        @media (max-width: 768px) {
          .inf-pac-badge {
            position: static; align-self: flex-start;
          }
        }

        /* ── Títulos y descripción ── */
        .inf-pac-card-title { font-size: 13px; font-weight: 600; color: #111827; }
        .inf-pac-card-desc  { font-size: 11.5px; color: #6b7280; line-height: 1.45; }
        @media (max-width: 768px) { .inf-pac-card-desc { font-size: 11px; } }

        /* ── Chevron hover ── */
        .inf-pac-card-chevron {
          position: absolute; bottom: 10px; right: 10px;
          opacity: 0; transition: opacity 0.2s ease;
        }
        .inf-pac-card:hover .inf-pac-card-chevron { opacity: 1; }
        @media (max-width: 768px) { .inf-pac-card-chevron { display: none; } }

        /* ── Filtros y botones ── */
        .inf-pac-filtros-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .inf-pac-filtros-grid .full { grid-column: 1 / -1; }
        @media (max-width: 480px) { .inf-pac-filtros-grid { grid-template-columns: 1fr; } }
        .inf-pac-sep-label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; margin: 0 0 10px; }
        .inf-pac-footer { margin-top: 18px; display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; border-top: 1px solid #e8edf2; padding-top: 14px; }

        .inf-pac-btn-pdf {
          display: flex; align-items: center; gap: 7px; padding: 8px 16px;
          border-radius: 6px; font-size: 13px; font-weight: 500;
          background: #1a3a5c; color: #fff; border: none; cursor: pointer; transition: background .15s;
        }
        .inf-pac-btn-pdf:hover:not(:disabled) { background: #15304d; }
        .inf-pac-btn-pdf:disabled { opacity: .6; cursor: not-allowed; }
        .inf-pac-btn-xls {
          display: flex; align-items: center; gap: 7px; padding: 8px 16px;
          border-radius: 6px; font-size: 13px; font-weight: 500;
          background: #166534; color: #fff; border: none; cursor: pointer; transition: background .15s;
        }
        .inf-pac-btn-xls:hover:not(:disabled) { background: #14532d; }
        .inf-pac-btn-xls:disabled { opacity: .6; cursor: not-allowed; }

        .inf-pac-pac-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,.08); z-index: 50; max-height: 180px; overflow-y: auto; margin-top: 3px; }
        .inf-pac-pac-item { padding: 8px 12px; font-size: 13px; cursor: pointer; border-bottom: 1px solid #f3f4f6; }
        .inf-pac-pac-item:last-child { border-bottom: none; }
        .inf-pac-pac-item:hover { background: #f0f5fb; }
        .inf-pac-pac-clear { padding: 0 10px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; color: #374151; cursor: pointer; }
        .inf-pac-pac-clear:hover { background: #e5e7eb; }
        .inf-pac-pac-item-focus { background: #f0f5fb !important; }
      `}</style>

      <div className="inf-pac-wrap">
        <div className="inf-pac-page-header">
          <h1>Informes</h1>
          <p>Reportes, listados y estadísticas del sistema</p>
        </div>

        {esResumen && (
          <div className="inf-pac-resumen">
            <div className="inf-pac-stat">
              <div className="inf-pac-stat-val">{pacientesCount ?? '—'}</div>
              <div className="inf-pac-stat-lbl">Pacientes activos</div>
            </div>
            <div className="inf-pac-stat">
              <div className="inf-pac-stat-val">{statsConsultas?.total ?? '—'}</div>
              <div className="inf-pac-stat-lbl">Consultas hoy</div>
            </div>
            <div className="inf-pac-stat">
              <div className="inf-pac-stat-val">{statsHoy?.pendientes ?? '—'}</div>
              <div className="inf-pac-stat-lbl">Turnos disponibles</div>
            </div>
          </div>
        )}

        <div className="inf-pac-section">
          <div className="inf-pac-section-label">
            <FileText size={14} color="#6b7280" />
            <span>Listados exportables</span>
            <div className="inf-pac-section-line" />
          </div>
          <div className="inf-pac-grid">
            <div className="inf-pac-card inf-pac-card-listado" onClick={handleAbrirListado}>
              <div className="inf-pac-card-icon"><Users size={24} color="#1a3a5c" /></div>
              <div className="inf-pac-card-title">Pacientes</div>
              <span className="inf-pac-badge inf-pac-badge-export">PDF · Excel</span>
              <div className="inf-pac-card-desc">PDF o Excel con filtros por sexo, sangre y ubicación</div>
              <ChevronRight size={16} color="#1a3a5c" className="inf-pac-card-chevron" />
            </div>
            <div className="inf-pac-card inf-pac-card-listado" onClick={handleAbrirHorario}>
              <div className="inf-pac-card-icon"><CalendarDays size={24} color="#1a3a5c" /></div>
              <div className="inf-pac-card-title">Horarios de prestadores</div>
              <span className="inf-pac-badge inf-pac-badge-export">PDF · Excel</span>
              <div className="inf-pac-card-desc">Agrupado por prestador, filtrable por día o profesional</div>
              <ChevronRight size={16} color="#1a3a5c" className="inf-pac-card-chevron" />
            </div>
            <div className="inf-pac-card inf-pac-card-listado" onClick={handleAbrirConsulta}>
              <div className="inf-pac-card-icon"><ClipboardList size={24} color="#1a3a5c" /></div>
              <div className="inf-pac-card-title">Consultas</div>
              <span className="inf-pac-badge inf-pac-badge-export">PDF · Excel</span>
              <div className="inf-pac-card-desc">Agrupado por especialidad, filtrable por prestador, evento, paciente y fecha</div>
              <ChevronRight size={16} color="#1a3a5c" className="inf-pac-card-chevron" />
            </div>
            <div className="inf-pac-card inf-pac-card-listado" onClick={handleAbrirAgenda}>
              <div className="inf-pac-card-icon"><CalendarCheck size={24} color="#1a3a5c" /></div>
              <div className="inf-pac-card-title">Agenda del día / semana</div>
              <span className="inf-pac-badge inf-pac-badge-export">PDF</span>
              <div className="inf-pac-card-desc">Todos los turnos de un período, filtrables por médico, especialidad y estado</div>
              <ChevronRight size={16} color="#1a3a5c" className="inf-pac-card-chevron" />
            </div>
            <div className="inf-pac-card inf-pac-card-listado" onClick={handleAbrirHistoria}>
              <div className="inf-pac-card-icon"><BookOpen size={24} color="#1a3a5c" /></div>
              <div className="inf-pac-card-title">Historia clínica</div>
              <span className="inf-pac-badge inf-pac-badge-export">PDF</span>
              <div className="inf-pac-card-desc">Todas las consultas de un paciente: diagnósticos, tratamientos y documentos adjuntos</div>
              <ChevronRight size={16} color="#1a3a5c" className="inf-pac-card-chevron" />
            </div>
          </div>
        </div>

        <div className="inf-pac-section">
          <div className="inf-pac-section-label">
            <BarChart2 size={14} color="#6b7280" />
            <span>Estadísticas</span>
            <div className="inf-pac-section-line" />
          </div>
          <div className="inf-pac-grid">
            <div className="inf-pac-card inf-pac-card-estadistica" onClick={() => navigate('/informes/dashboard/pacientes')}>
              <div className="inf-pac-card-icon"><BarChart2 size={24} color="#1a3a5c" /></div>
              <div className="inf-pac-card-title">Pacientes del mes</div>
              <span className="inf-pac-badge inf-pac-badge-dash">Dashboard</span>
              <div className="inf-pac-card-desc">Registros por día, sexo, grupo etario y departamento</div>
              <ChevronRight size={16} color="#1a3a5c" className="inf-pac-card-chevron" />
            </div>
            <div className="inf-pac-card inf-pac-card-estadistica" onClick={() => navigate('/informes/dashboard/consultas')}>
              <div className="inf-pac-card-icon"><Stethoscope size={24} color="#1a3a5c" /></div>
              <div className="inf-pac-card-title">Consultas del mes</div>
              <span className="inf-pac-badge inf-pac-badge-dash">Dashboard</span>
              <div className="inf-pac-card-desc">Por estado, especialidad, top prestadores y tendencia 6 meses</div>
              <ChevronRight size={16} color="#1a3a5c" className="inf-pac-card-chevron" />
            </div>
            <div className="inf-pac-card inf-pac-card-estadistica" onClick={() => navigate('/informes/dashboard/agenda')}>
              <div className="inf-pac-card-icon"><CalendarCheck size={24} color="#1a3a5c" /></div>
              <div className="inf-pac-card-title">Agenda del mes</div>
              <span className="inf-pac-badge inf-pac-badge-dash">Dashboard</span>
              <div className="inf-pac-card-desc">Realizados, cancelados, ocupados y comparativa mensual</div>
              <ChevronRight size={16} color="#1a3a5c" className="inf-pac-card-chevron" />
            </div>
            <div className="inf-pac-card inf-pac-card-estadistica" onClick={() => navigate('/informes/dashboard/prestadores')}>
              <div className="inf-pac-card-icon"><UserCheck size={24} color="#1a3a5c" /></div>
              <div className="inf-pac-card-title">Prestadores</div>
              <span className="inf-pac-badge inf-pac-badge-dash">Dashboard</span>
              <div className="inf-pac-card-desc">Turnos por médico, comparativa por especialidad y ocupación promedio</div>
              <ChevronRight size={16} color="#1a3a5c" className="inf-pac-card-chevron" />
            </div>
            <div className="inf-pac-card inf-pac-card-estadistica" onClick={() => navigate('/informes/dashboard/ocupacion')}>
              <div className="inf-pac-card-icon"><Activity size={24} color="#1a3a5c" /></div>
              <div className="inf-pac-card-title">Ocupación clínica</div>
              <span className="inf-pac-badge inf-pac-badge-dash">Dashboard</span>
              <div className="inf-pac-card-desc">Mapa de calor día × hora, consultorios más usados y picos por mes</div>
              <ChevronRight size={16} color="#1a3a5c" className="inf-pac-card-chevron" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal Pacientes ── */}
      <Modal isOpen={listadoAbierto} onClose={() => setListadoAbierto(false)} title="Listado de pacientes" size="md">
        <div style={{ paddingBottom: 8 }}>
          <div className="inf-pac-filtros-grid">
            <div className="form-group">
              <label className="form-label">Sexo</label>
              <select className="input" value={filtros.sexo} onChange={e => handleFiltroChange('sexo', e.target.value)}>
                {SEXO_OPCIONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de sangre</label>
              <select className="input" value={filtros.grupo_sanguineo} onChange={e => handleFiltroChange('grupo_sanguineo', e.target.value)}>
                {SANGRE_OPCIONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="form-group full"><p className="inf-pac-sep-label">Ubicación</p></div>
            <div className="form-group">
              <label className="form-label">País</label>
              <select className="input" value={filtros.pais} onChange={e => handleFiltroChange('pais', e.target.value)}>
                <option value="">Todos</option>
                {paises.map(p => <option key={p.id} value={p.id}>{p.descripcion}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Departamento</label>
              <select className="input" value={filtros.departamento} onChange={e => handleFiltroChange('departamento', e.target.value)} disabled={!filtros.pais}>
                <option value="">Todos</option>
                {departamentos.map(d => <option key={d.id} value={d.id}>{d.descripcion}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Ciudad</label>
              <select className="input" value={filtros.ciudad} onChange={e => handleFiltroChange('ciudad', e.target.value)} disabled={!filtros.departamento}>
                <option value="">Todas</option>
                {ciudades.map(c => <option key={c.id} value={c.id}>{c.descripcion}</option>)}
              </select>
            </div>
            <div className="form-group full"><p className="inf-pac-sep-label" style={{ marginTop: 4 }}>Fecha de registro</p></div>
            <div className="form-group">
              <label className="form-label">Desde</label>
              <input type="date" className="input" value={filtros.fecha_desde} onChange={e => handleFiltroChange('fecha_desde', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Hasta</label>
              <input type="date" className="input" value={filtros.fecha_hasta} onChange={e => handleFiltroChange('fecha_hasta', e.target.value)} />
            </div>
          </div>
          <div className="inf-pac-footer">
            <button className="inf-pac-btn-pdf" onClick={handleVerPdf} disabled={loadingPdf || loadingXls}>
              <FileText size={16} />{loadingPdf ? 'Generando...' : 'Ver PDF'}
            </button>
            <button className="inf-pac-btn-xls" onClick={handleDescargarExcel} disabled={loadingPdf || loadingXls}>
              <FileSpreadsheet size={16} />{loadingXls ? 'Generando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Horarios ── */}
      <Modal isOpen={horarioAbierto} onClose={() => setHorarioAbierto(false)} title="Horario de prestadores" size="sm">
        <div style={{ paddingBottom: 8 }}>
          <div className="inf-pac-filtros-grid">
            <div className="form-group full">
              <label className="form-label">Prestador</label>
              <BuscadorFiltrable
                key={`hor-${horarioAbierto}`}
                items={prestadores}
                getLabel={getPrestadorLabel}
                selectedId={filtrosHorario.persona_rrhh}
                selectedNombre={prestHorNombre}
                placeholder="Buscar prestador..."
                onSelect={p => {
                  setPrestHorNombre(getPrestadorLabel(p))
                  setFiltrosHorario(prev => ({ ...prev, persona_rrhh: String(p.id) }))
                }}
                onClear={() => {
                  setPrestHorNombre('')
                  setFiltrosHorario(prev => ({ ...prev, persona_rrhh: '' }))
                }}
              />
            </div>
            <div className="form-group full">
              <label className="form-label">Día de la semana</label>
              <select className="input" value={filtrosHorario.dia_semana}
                onChange={e => setFiltrosHorario(prev => ({ ...prev, dia_semana: e.target.value }))}>
                <option value="">Todos</option>
                {DIAS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
          </div>
          <div className="inf-pac-footer">
            <button className="inf-pac-btn-pdf" onClick={handleHorarioPdf} disabled={loadingHorPdf || loadingHorXls}>
              <FileText size={16} />{loadingHorPdf ? 'Generando...' : 'Ver PDF'}
            </button>
            <button className="inf-pac-btn-xls" onClick={handleHorarioExcel} disabled={loadingHorPdf || loadingHorXls}>
              <FileSpreadsheet size={16} />{loadingHorXls ? 'Generando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Consultas ── */}
      <Modal isOpen={consultaAbierta} onClose={() => setConsultaAbierta(false)} title="Listado de consultas" size="md">
        <div style={{ paddingBottom: 8 }}>
          <div className="inf-pac-filtros-grid">

            <div className="form-group full">
              <label className="form-label">Prestador</label>
              <BuscadorFiltrable
                key={`con-${consultaAbierta}`}
                items={prestadores}
                getLabel={getPrestadorLabel}
                selectedId={filtrosConsulta.persona_rrhh}
                selectedNombre={prestConNombre}
                placeholder="Buscar prestador..."
                onSelect={p => {
                  setPrestConNombre(getPrestadorLabel(p))
                  setFiltrosConsulta(prev => ({ ...prev, persona_rrhh: String(p.id) }))
                }}
                onClear={() => {
                  setPrestConNombre('')
                  setFiltrosConsulta(prev => ({ ...prev, persona_rrhh: '' }))
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Especialidad</label>
              <BuscadorFiltrable
                key={`esp-${consultaAbierta}`}
                items={especialidades}
                getLabel={e => e.descripcion}
                selectedId={filtrosConsulta.especialidad}
                selectedNombre={especialidades.find(e => String(e.id) === filtrosConsulta.especialidad)?.descripcion ?? ''}
                placeholder="Buscar especialidad..."
                onSelect={e => setFiltrosConsulta(prev => ({ ...prev, especialidad: String(e.id) }))}
                onClear={() => setFiltrosConsulta(prev => ({ ...prev, especialidad: '' }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Evento clínico</label>
              <BuscadorFiltrable
                key={`ev-${consultaAbierta}`}
                items={eventosClinicos}
                getLabel={e => e.tipo_evento}
                selectedId={filtrosConsulta.evento_clinico}
                selectedNombre={eventosClinicos.find(e => String(e.id) === filtrosConsulta.evento_clinico)?.tipo_evento ?? ''}
                placeholder="Buscar evento clínico..."
                onSelect={e => setFiltrosConsulta(prev => ({ ...prev, evento_clinico: String(e.id) }))}
                onClear={() => setFiltrosConsulta(prev => ({ ...prev, evento_clinico: '' }))}
              />
            </div>

            <div className="form-group full">
              <label className="form-label">Paciente</label>
              {filtrosConsulta.paciente ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" readOnly value={pacienteNombre} style={{ flex: 1 }} />
                  <button className="inf-pac-pac-clear" onClick={() => {
                    setPacienteNombre(''); setPacientesSearch(''); setPacientesRes([])
                    setFiltrosConsulta(prev => ({ ...prev, paciente: '' }))
                  }}>✕</button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input className="input" placeholder="Buscar paciente..." value={pacientesSearch}
                    onChange={e => setPacientesSearch(e.target.value)} />
                  {pacientesRes.length > 0 && (
                    <div className="inf-pac-pac-dropdown">
                      {pacientesRes.map(p => (
                        <div key={p.id} className="inf-pac-pac-item" onClick={() => seleccionarPaciente(p)}>
                          {p.persona?.razon_social ?? p.nombre}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="form-group full"><p className="inf-pac-sep-label">Rango de fechas</p></div>
            <div className="form-group">
              <label className="form-label">Desde</label>
              <input type="date" className="input" value={filtrosConsulta.fecha_desde}
                onChange={e => setFiltrosConsulta(prev => ({ ...prev, fecha_desde: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Hasta</label>
              <input type="date" className="input" value={filtrosConsulta.fecha_hasta}
                onChange={e => setFiltrosConsulta(prev => ({ ...prev, fecha_hasta: e.target.value }))} />
            </div>
          </div>

          <div className="inf-pac-footer">
            <button className="inf-pac-btn-pdf" onClick={handleConsultaPdf} disabled={loadingConPdf || loadingConXls}>
              <FileText size={16} />{loadingConPdf ? 'Generando...' : 'Ver PDF'}
            </button>
            <button className="inf-pac-btn-xls" onClick={handleConsultaExcel} disabled={loadingConPdf || loadingConXls}>
              <FileSpreadsheet size={16} />{loadingConXls ? 'Generando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Agenda ── */}
      <Modal isOpen={agendaAbierta} onClose={() => setAgendaAbierta(false)} title="Agenda del día / semana" size="md">
        <div style={{ paddingBottom: 8 }}>
          <div className="inf-pac-filtros-grid">
            <div className="form-group full"><p className="inf-pac-sep-label">Rango de fechas</p></div>
            <div className="form-group">
              <label className="form-label">Desde</label>
              <input type="date" className="input" max="2099-12-31" value={filtrosAgenda.fecha_desde}
                onChange={e => setFiltrosAgenda(prev => ({ ...prev, fecha_desde: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Hasta</label>
              <input type="date" className="input" max="2099-12-31" value={filtrosAgenda.fecha_hasta}
                onChange={e => setFiltrosAgenda(prev => ({ ...prev, fecha_hasta: e.target.value }))} />
            </div>
            <div className="form-group full">
              <label className="form-label">Médico</label>
              <BuscadorFiltrable
                key={`ag-med-${agendaAbierta}`}
                items={prestadores}
                getLabel={getPrestadorLabel}
                selectedId={filtrosAgenda.persona_rrhh}
                selectedNombre={prestAgendaNombre}
                placeholder="Buscar médico..."
                onSelect={p => {
                  setPrestAgendaNombre(getPrestadorLabel(p))
                  setFiltrosAgenda(prev => ({ ...prev, persona_rrhh: String(p.id) }))
                }}
                onClear={() => {
                  setPrestAgendaNombre('')
                  setFiltrosAgenda(prev => ({ ...prev, persona_rrhh: '' }))
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Especialidad</label>
              <BuscadorFiltrable
                key={`ag-esp-${agendaAbierta}`}
                items={especialidades}
                getLabel={e => e.descripcion}
                selectedId={filtrosAgenda.especialidad}
                selectedNombre={especialidades.find(e => String(e.id) === filtrosAgenda.especialidad)?.descripcion ?? ''}
                placeholder="Buscar especialidad..."
                onSelect={e => setFiltrosAgenda(prev => ({ ...prev, especialidad: String(e.id) }))}
                onClear={() => setFiltrosAgenda(prev => ({ ...prev, especialidad: '' }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select className="input" value={filtrosAgenda.estado}
                onChange={e => setFiltrosAgenda(prev => ({ ...prev, estado: e.target.value }))}>
                {ESTADO_AGENDA_OPCIONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="inf-pac-footer">
            <button className="inf-pac-btn-pdf" onClick={handleAgendaPdf} disabled={loadingAgPdf}>
              <FileText size={16} />{loadingAgPdf ? 'Generando...' : 'Ver PDF'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Historia clínica ── */}
      <Modal isOpen={historiaAbierta} onClose={() => setHistoriaAbierta(false)} title="Historia clínica por paciente" size="sm">
        <div style={{ paddingBottom: 8 }}>
          <div className="form-group">
            <label className="form-label">Buscar paciente</label>
            {historiaSel ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="input" readOnly value={historiaSel.persona?.razon_social || historiaSel.nombre || ''} style={{ flex: 1 }} />
                <button className="inf-pac-pac-clear" onClick={() => setHistoriaSel(null)}>✕</button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  placeholder="Nombre o documento..."
                  value={historiaSearch}
                  onChange={e => setHistoriaSearch(e.target.value)}
                  onKeyDown={handleHistoriaKeyDown}
                  autoComplete="off"
                />
                {historiaRes.length > 0 && (
                  <div className="inf-pac-pac-dropdown">
                    {historiaRes.map((p, idx) => (
                      <div
                        key={p.id}
                        className={`inf-pac-pac-item${idx === historiaFocusIdx ? ' inf-pac-pac-item-focus' : ''}`}
                        onClick={() => seleccionarHistoriaPaciente(p)}
                        onMouseEnter={() => setHistoriaFocusIdx(idx)}
                      >
                        {p.persona?.razon_social ?? p.nombre}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="inf-pac-footer">
            <button className="inf-pac-btn-pdf" onClick={handleHistoriaPdf} disabled={!historiaSel || loadingHisPdf}>
              <FileText size={16} />{loadingHisPdf ? 'Generando...' : 'Ver PDF'}
            </button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  )
}
