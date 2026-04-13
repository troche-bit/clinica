import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Search, Calendar, X, Check, CalendarDays } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import {
  useAgendaMes, useAgendaDia, useAgendaDiaGlobal,
  useAgendaGlobalMes, useAsignarTurno, useCambiarEstado,
} from '../hooks/useAgenda'
import { usePersonasRRHH } from '../hooks/usePersonaRRHH'
import { useEspecialidades } from '../hooks/useEspecialidades'
import { useHorariosPrestador, useGenerarTurnos } from '../hooks/useHorarioPrestador'
import Modal from '../components/ui/Modal'
import Toast from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'

// ── Utilidades ───────────────────────────────────────────────────────────────
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_SEMANA = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

const COLORES_MEDICO = [
  { bg: '#dbeafe', text: '#1e40af', borde: '#93c5fd' },
  { bg: '#dcfce7', text: '#166534', borde: '#86efac' },
  { bg: '#fce7f3', text: '#9d174d', borde: '#f9a8d4' },
  { bg: '#fef3c7', text: '#92400e', borde: '#fcd34d' },
  { bg: '#e0e7ff', text: '#3730a3', borde: '#a5b4fc' },
  { bg: '#fff1f2', text: '#9f1239', borde: '#fda4af' },
  { bg: '#fdf4ff', text: '#7e22ce', borde: '#d8b4fe' },
  { bg: '#ecfeff', text: '#155e75', borde: '#67e8f9' },
  { bg: '#fff7ed', text: '#9a3412', borde: '#fdba74' },
  { bg: '#f0fdf4', text: '#14532d', borde: '#4ade80' },
]
const colorMedico = (id) => COLORES_MEDICO[(id - 1) % COLORES_MEDICO.length]

function diasDelMes(mes, anio) {
  const primer = new Date(anio, mes - 1, 1)
  const total  = new Date(anio, mes, 0).getDate()
  let offset   = primer.getDay() - 1
  if (offset < 0) offset = 6
  const celdas = Array(offset).fill(null)
  for (let d = 1; d <= total; d++) celdas.push(d)
  while (celdas.length % 7 !== 0) celdas.push(null)
  return celdas
}

function fmtFecha(anio, mes, dia) {
  return `${anio}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
}
function fmtHora(t) { return t ? String(t).slice(0, 5) : '' }

function extraerError(err) {
  const d = err?.response?.data
  if (!d) return 'Ocurrió un error.'
  if (typeof d === 'string') return d
  const v = Object.values(d)
  if (!v.length) return 'Error al guardar.'
  const p = v[0]
  return Array.isArray(p) ? p[0] : String(p)
}

// ── Colores por estado ────────────────────────────────────────────────────────
function colorEstado(estado) {
  switch (estado) {
    case 'disponible': return { bg: '#dcfce7', text: '#166534', borde: '#86efac' }
    case 'ocupado':    return { bg: '#fef3c7', text: '#92400e', borde: '#fcd34d' }
    case 'inactivo':   return { bg: '#f3f4f6', text: '#6b7280', borde: '#d1d5db' }
    case 'cancelado':  return { bg: '#fee2e2', text: '#991b1b', borde: '#fca5a5' }
    case 'realizado':  return { bg: '#ede9fe', text: '#5b21b6', borde: '#c4b5fd' }
    default:           return { bg: '#f3f4f6', text: '#6b7280', borde: '#d1d5db' }
  }
}

// ── Previsualización de turnos a generar ─────────────────────────────────────
const DIAS_ID = { 1:'Lunes',2:'Martes',3:'Miércoles',4:'Jueves',5:'Viernes',6:'Sábado',7:'Domingo' }

function previsualizarTurnos(horarios, fechaDesde, fechaHasta) {
  if (!fechaDesde || !fechaHasta) return []
  const desde = new Date(fechaDesde + 'T00:00:00')
  const hasta  = new Date(fechaHasta + 'T00:00:00')
  if (hasta < desde) return []
  const resultado = []
  for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
    const diaSemanaId = d.getDay() === 0 ? 7 : d.getDay()
    for (const h of horarios) {
      if (h.estado !== 'activo') continue
      const aplica = h.excepcion
        ? h.fecha_excepcion === d.toISOString().slice(0, 10)
        : Number(h.dia_semana) === diaSemanaId
      if (!aplica) continue
      if (!h.hora_desde || !h.hora_hasta || !h.intervalo) continue
      const [hd, md] = h.hora_desde.split(':').map(Number)
      const [hh, mh] = h.hora_hasta.split(':').map(Number)
      const minDesde = hd * 60 + md
      const minHasta = hh * 60 + mh
      const slots    = Math.floor((minHasta - minDesde) / Number(h.intervalo))
      if (slots > 0) {
        resultado.push({
          fecha:  d.toISOString().slice(0, 10),
          dia:    DIAS_ID[diaSemanaId] ?? '',
          slots,
          horarioId: h.id,
        })
      }
    }
  }
  return resultado
}

// ── Hook búsqueda de pacientes con debounce ──────────────────────────────────
function usePacienteSearch(q) {
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300)
    return () => clearTimeout(t)
  }, [q])
  return useQuery({
    queryKey: ['pacientes-search-agenda', debounced],
    queryFn:  async () => {
      const res = await apiClient.get('/paciente/', { params: { search: debounced, page_size: 10 } })
      return res.data.results ?? []
    },
    enabled: debounced.length >= 2,
  })
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function AgendaPage() {
  const hoy = new Date()
  const [mesVista, setMesVista] = useState({ mes: hoy.getMonth() + 1, anio: hoy.getFullYear() })
  const [medicoSel, setMedicoSel]       = useState(null)
  const [fechaSel,  setFechaSel]        = useState(null)         // 'YYYY-MM-DD'
  const [modo,      setModo]            = useState('todos')      // todos|fecha|especialidad
  const [filtroFecha,    setFiltroFecha]    = useState('')
  const [filtroEsp,      setFiltroEsp]      = useState('')
  const [filtroEspTexto, setFiltroEspTexto] = useState('')
  const [mostrarEspDrop, setMostrarEspDrop] = useState(false)
  const [busquedaMedico, setBusquedaMedico] = useState('')
  const [turnoExpandido, setTurnoExpandido] = useState(null)     // id del turno seleccionado
  const [busqPaciente,   setBusqPaciente]   = useState('')
  const [pacienteSel,    setPacienteSel]    = useState(null)
  const [observacion,    setObservacion]    = useState('')
  const [confirmando,    setConfirmando]    = useState(false)
  const [mostrarGenerar, setMostrarGenerar] = useState(false)
  const [genDesde,       setGenDesde]       = useState('')
  const [genHasta,       setGenHasta]       = useState('')
  const [genResult,      setGenResult]      = useState(null)
  const [generando,      setGenerando]      = useState(false)
  const [medicosSelGen,  setMedicosSelGen]  = useState(new Set())
  const [busqGen,        setBusqGen]        = useState('')
  const [listaGenAbierta, setListaGenAbierta] = useState(false)

  const { toast, showToast } = useToast()
  const qc = useQueryClient()

  // ── Datos ──────────────────────────────────────────────────────────────────
  const { data: prestadoresData } = usePersonasRRHH({ page: 1, search: busquedaMedico })
  const todosLosMedicos = prestadoresData?.results ?? []

  const { data: espData } = useEspecialidades()
  const especialidades = espData?.results ?? espData ?? []

  const espFiltradas = useMemo(() => {
    if (!filtroEspTexto) return especialidades
    const txt = filtroEspTexto.toLowerCase()
    return especialidades.filter(e => e.descripcion?.toLowerCase().includes(txt))
  }, [especialidades, filtroEspTexto])

  const medicosFiltrados = useMemo(() => {
    if (modo === 'especialidad' && filtroEsp) {
      return todosLosMedicos.filter(m =>
        m.especialidades_detalle?.some(e => String(e.id) === String(filtroEsp))
      )
    }
    return todosLosMedicos
  }, [todosLosMedicos, modo, filtroEsp])

  // Auto-seleccionar primero cuando se filtra por especialidad
  useEffect(() => {
    if (modo === 'especialidad' && medicosFiltrados.length > 0 && !medicoSel) {
      setMedicoSel(medicosFiltrados[0])
    }
  }, [medicosFiltrados, modo])

  // Saltar a mes cuando se usa filtro fecha
  useEffect(() => {
    if (modo === 'fecha' && filtroFecha) {
      const [a, m] = filtroFecha.split('-').map(Number)
      setMesVista({ mes: m, anio: a })
      setFechaSel(filtroFecha)
    }
  }, [filtroFecha, modo])

  const { data: agendaMes }    = useAgendaMes(medicoSel?.id, mesVista.mes, mesVista.anio)
  const turnosMes              = agendaMes ?? []

  const { data: turnosDia }    = useAgendaDia(medicoSel?.id, fechaSel)
  const { data: turnosDiaGlob} = useAgendaDiaGlobal(modo === 'fecha' && !medicoSel ? fechaSel : null)
  const turnosPanelDia = medicoSel ? (turnosDia ?? []) : (turnosDiaGlob ?? [])

  const { data: turnosMesGlobal } = useAgendaGlobalMes(mesVista.mes, mesVista.anio)
  const statsGlobal = useMemo(() => {
    const t = turnosMesGlobal ?? []
    return {
      total:       t.length,
      confirmadas: t.filter(x => x.estado === 'ocupado').length,
      disponibles: t.filter(x => x.estado === 'disponible').length,
      realizadas:  t.filter(x => x.estado === 'realizado').length,
      cancelados:  t.filter(x => x.estado === 'cancelado').length,
    }
  }, [turnosMesGlobal])

  const { mutateAsync: asignarTurno }  = useAsignarTurno()
  const { mutateAsync: cambiarEstado } = useCambiarEstado()

  // ── Horarios globales para generar turnos ────────────────────────────────
  const { data: horariosGlobalData } = useHorariosPrestador({ estado: 'activo' })

  // Para el modo global — todos los activos de todos los médicos
  const todosHorariosActivos = useMemo(() => {
    const lista = horariosGlobalData?.results ?? horariosGlobalData ?? []
    return lista.filter(h => h.estado === 'activo')
  }, [horariosGlobalData])

  // Médicos únicos que tienen al menos un horario activo
  const medicosConHorarios = useMemo(() => {
    const map = {}
    for (const h of todosHorariosActivos) {
      if (!map[h.persona_rrhh]) {
        const det = h.persona_rrhh_detalle
        map[h.persona_rrhh] = {
          id:       h.persona_rrhh,
          nombre:   det?.persona_detalle?.razon_social ?? det?.nombre ?? `Médico #${h.persona_rrhh}`,
          horarios: [],
        }
      }
      map[h.persona_rrhh].horarios.push(h)
    }
    return Object.values(map)
  }, [todosHorariosActivos])

  const medicosConHorariosFiltrados = useMemo(() => {
    if (!busqGen.trim()) return medicosConHorarios
    const txt = busqGen.toLowerCase()
    return medicosConHorarios.filter(m => m.nombre.toLowerCase().includes(txt))
  }, [medicosConHorarios, busqGen])

  const { mutateAsync: generarTurnos } = useGenerarTurnos()

  // Horarios de los médicos seleccionados en el panel de generación
  const horariosSeleccionados = useMemo(
    () => todosHorariosActivos.filter(h => medicosSelGen.has(h.persona_rrhh)),
    [todosHorariosActivos, medicosSelGen]
  )
  const preview      = useMemo(
    () => previsualizarTurnos(horariosSeleccionados, genDesde, genHasta),
    [horariosSeleccionados, genDesde, genHasta]
  )
  const totalPreview = preview.reduce((s, x) => s + x.slots, 0)

  // Helpers de selección en el panel generar
  const toggleMedicoGen = (id) => {
    setMedicosSelGen(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
    setGenResult(null)
  }
  const toggleTodosGen = () => {
    const todosIds = medicosConHorarios.map(m => m.id)
    setMedicosSelGen(
      medicosSelGen.size === todosIds.length ? new Set() : new Set(todosIds)
    )
    setGenResult(null)
  }
  const abrirGenerar = () => {
    const ids = medicoSel
      ? new Set([medicoSel.id])
      : new Set(medicosConHorarios.map(m => m.id))
    setMedicosSelGen(ids)
    setGenResult(null)
    setGenDesde('')
    setGenHasta('')
    setBusqGen('')
    setListaGenAbierta(false)
    setMostrarGenerar(v => !v)
  }

  // ── Búsqueda de paciente ───────────────────────────────────────────────────
  const { data: resultadosPaciente } = usePacienteSearch(busqPaciente)

  // ── Acciones de calendario ─────────────────────────────────────────────────
  const irMesAnterior = () => setMesVista(prev => {
    const m = prev.mes === 1 ? 12 : prev.mes - 1
    const a = prev.mes === 1 ? prev.anio - 1 : prev.anio
    return { mes: m, anio: a }
  })
  const irMesSiguiente = () => setMesVista(prev => {
    const m = prev.mes === 12 ? 1 : prev.mes + 1
    const a = prev.mes === 12 ? prev.anio + 1 : prev.anio
    return { mes: m, anio: a }
  })

  const seleccionarDia = (dia) => {
    if (!dia) return
    const f = fmtFecha(mesVista.anio, mesVista.mes, dia)
    setFechaSel(f)
    setTurnoExpandido(null)
    setBusqPaciente('')
    setPacienteSel(null)
    setObservacion('')
  }

  // ── Confirmar cita ─────────────────────────────────────────────────────────
  const handleConfirmar = async () => {
    if (!pacienteSel || !turnoExpandido) return
    setConfirmando(true)
    try {
      await asignarTurno({ id: turnoExpandido, paciente_id: pacienteSel.id, observacion })
      showToast('Cita confirmada correctamente.', 'success')
      setTurnoExpandido(null)
      setBusqPaciente('')
      setPacienteSel(null)
      setObservacion('')
    } catch (err) {
      showToast(extraerError(err), 'error')
    } finally {
      setConfirmando(false)
    }
  }

  // ── Cancelar turno ─────────────────────────────────────────────────────────
  // ── Generar turnos ─────────────────────────────────────────────────────────
  const handleGenerar = async () => {
    if (!genDesde || !genHasta || horariosSeleccionados.length === 0) return
    setGenerando(true)
    setGenResult(null)
    try {
      let creados = 0, omitidos = 0, detalle = []
      for (const h of horariosSeleccionados) {
        const res = await generarTurnos({ id: h.id, fecha_desde: genDesde, fecha_hasta: genHasta })
        creados  += res.data.creados
        omitidos += res.data.omitidos
        detalle   = [...detalle, ...res.data.detalle]
      }
      setGenResult({ creados, omitidos, detalle })
      showToast(`${creados} turno(s) generado(s) correctamente.`, 'success')
      qc.invalidateQueries({ queryKey: ['agenda-mes'] })
      qc.invalidateQueries({ queryKey: ['agenda-dia'] })
      qc.invalidateQueries({ queryKey: ['agenda-global-mes'] })
    } catch (err) {
      showToast(extraerError(err), 'error')
    } finally {
      setGenerando(false)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const nombreMedico = (m) => m?.persona_detalle?.razon_social ?? m?.nombre ?? '—'
  const inicialesMedico = (m) => {
    const n = nombreMedico(m)
    return n.split(' ').map(x => x[0]).join('').toUpperCase().slice(0, 2)
  }

  const celdas = diasDelMes(mesVista.mes, mesVista.anio)

  // Turnos agrupados por fecha para el calendario
  const turnosPorFecha = useMemo(() => {
    const map = {}
    for (const t of turnosMes) {
      if (!map[t.fecha]) map[t.fecha] = []
      map[t.fecha].push(t)
    }
    return map
  }, [turnosMes])

  return (
    <>
      <Toast toast={toast} />
      <style>{`
        /* ── Layout ── */
        .ag-layout { display: flex; gap: 16px; align-items: flex-start; min-height: calc(100vh - 140px); }
        .ag-col-izq   { width: 240px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; }
        .ag-col-cal   { flex: 1; min-width: 0; }
        .ag-col-panel { width: 280px; flex-shrink: 0; }

        /* ── Stats ── */
        .ag-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .ag-stat { background: #fff; border: 1px solid #e8edf2; border-radius: 10px; padding: 10px 12px; }
        .ag-stat-val  { font-size: 22px; font-weight: 700; color: #1a3a5c; line-height: 1; }
        .ag-stat-label{ font-size: 11px; color: #9ca3af; margin-top: 3px; }
        .ag-stat-conf  .ag-stat-val { color: #d97706; }
        .ag-stat-pend  .ag-stat-val { color: #16a34a; }
        .ag-stat-real  .ag-stat-val { color: #7c3aed; }
        .ag-stat-canc  .ag-stat-val { color: #dc2626; }
        .ag-stat-total { grid-column: 1 / -1; }

        /* ── Filtros modo ── */
        .ag-card { background: #fff; border: 1px solid #e8edf2; border-radius: 12px; overflow: hidden; }
        .ag-card-head { padding: 12px 14px; border-bottom: 1px solid #e8edf2; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #9ca3af; }
        .ag-card-body { padding: 12px 14px; }

        .ag-search-wrap { position: relative; margin-bottom: 10px; }
        .ag-search-icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none; }
        .ag-search-input {
          width: 100%; box-sizing: border-box; padding: 7px 10px 7px 30px;
          border: 1.5px solid #e5e7eb; border-radius: 8px;
          font-size: 12.5px; font-family: 'DM Sans', sans-serif; color: #111827;
          outline: none; transition: border-color 0.2s;
        }
        .ag-search-input:focus { border-color: #1a3a5c; }
        .ag-search-input::placeholder { color: #d1d5db; }

        .ag-chips { display: flex; gap: 5px; margin-bottom: 10px; flex-wrap: wrap; }
        .ag-chip {
          padding: 4px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 500;
          border: 1.5px solid #e5e7eb; background: #f8fafc; color: #6b7280;
          cursor: pointer; transition: all 0.15s;
        }
        .ag-chip:hover  { border-color: #1a3a5c; color: #1a3a5c; }
        .ag-chip-on { background: #1a3a5c; color: #fff; border-color: #1a3a5c; }

        .ag-filter-input {
          width: 100%; box-sizing: border-box; padding: 7px 10px;
          border: 1.5px solid #e5e7eb; border-radius: 8px;
          font-size: 12.5px; font-family: 'DM Sans', sans-serif; color: #111827;
          outline: none; transition: border-color 0.2s; margin-top: 4px;
        }
        .ag-filter-input:focus { border-color: #1a3a5c; }

        /* ── Lista médicos ── */
        .ag-medico-list { display: flex; flex-direction: column; gap: 2px; }
        .ag-medico-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 14px; cursor: pointer; border-left: 3px solid transparent;
          transition: background 0.12s, border-color 0.12s;
        }
        .ag-medico-item:hover { background: #f8fafc; }
        .ag-medico-item-on { background: #eff6ff !important; border-left-color: #1a3a5c; }
        .ag-avatar {
          width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700;
        }
        .ag-medico-nombre { font-size: 12.5px; font-weight: 500; color: #111827; line-height: 1.2; }
        .ag-medico-esp    { font-size: 11px; color: #9ca3af; margin-top: 1px; }
        .ag-medico-badge  {
          margin-left: auto; flex-shrink: 0; min-width: 20px; padding: 1px 6px;
          border-radius: 20px; font-size: 10.5px; font-weight: 600;
          background: #dcfce7; color: #166534; text-align: center;
        }

        /* ── Calendario ── */
        .ag-cal-card { background: #fff; border: 1px solid #e8edf2; border-radius: 12px; overflow: hidden; }
        .ag-cal-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid #e8edf2;
        }
        .ag-cal-titulo { font-size: 15px; font-weight: 600; color: #1a3a5c; }
        .ag-cal-sub    { font-size: 12px; color: #9ca3af; margin-top: 2px; }
        .ag-cal-nav    { display: flex; align-items: center; gap: 6px; }
        .ag-cal-nav-btn {
          width: 28px; height: 28px; border-radius: 7px; border: 1px solid #e8edf2;
          background: none; cursor: pointer; display: flex; align-items: center;
          justify-content: center; color: #6b7280; transition: all 0.15s;
        }
        .ag-cal-nav-btn:hover { background: #f0f4f8; color: #1a3a5c; border-color: #bfdbfe; }
        .ag-cal-mes-label { font-size: 13px; font-weight: 600; color: #374151; min-width: 140px; text-align: center; }

        .ag-cal-grid { padding: 0 12px 12px; }
        .ag-cal-dias-header {
          display: grid; grid-template-columns: repeat(7, 1fr);
          gap: 2px; margin-bottom: 4px;
        }
        .ag-cal-dia-hdr {
          text-align: center; font-size: 10.5px; font-weight: 700;
          letter-spacing: .05em; text-transform: uppercase; color: #9ca3af;
          padding: 8px 0;
        }
        .ag-cal-celdas { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
        .ag-cal-celda {
          min-height: 80px; border-radius: 8px; padding: 5px 6px;
          border: 1.5px solid transparent; cursor: default;
          transition: background 0.12s, border-color 0.12s;
          display: flex; flex-direction: column; gap: 3px;
        }
        .ag-cal-celda-activa { cursor: pointer; }
        .ag-cal-celda-activa:hover { background: #f8fafc; border-color: #e5e7eb; }
        .ag-cal-celda-sel { background: #eff6ff !important; border-color: #93c5fd !important; }
        .ag-cal-celda-hoy .ag-cal-num { background: #1a3a5c; color: #fff; }
        .ag-cal-num {
          width: 22px; height: 22px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 500; color: #374151; flex-shrink: 0;
        }
        .ag-cal-num-vacio { color: #d1d5db; }
        .ag-cal-pills { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .ag-cal-pill {
          padding: 2px 5px; border-radius: 4px; font-size: 10.5px; font-weight: 500;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ag-cal-mas { font-size: 10px; color: #9ca3af; padding-left: 4px; }
        .ag-cal-empty { text-align: center; padding: 40px 16px; color: #9ca3af; font-size: 13px; }

        /* ── Panel día ── */
        .ag-panel { background: #fff; border: 1px solid #e8edf2; border-radius: 12px; overflow: hidden; position: sticky; top: 20px; }
        .ag-panel-head { padding: 14px 16px; border-bottom: 1px solid #e8edf2; }
        .ag-panel-titulo { font-size: 14px; font-weight: 600; color: #1a3a5c; }
        .ag-panel-sub    { font-size: 12px; color: #6b7280; margin-top: 2px; }
        .ag-panel-body   { padding: 12px 14px; max-height: calc(100vh - 240px); overflow-y: auto; }

        .ag-turno {
          border: 1.5px solid #e8edf2; border-radius: 8px; margin-bottom: 6px;
          overflow: hidden; transition: border-color 0.15s;
        }
        .ag-turno-head {
          display: flex; align-items: center; gap: 8px; padding: 9px 12px;
          cursor: pointer; transition: background 0.12s;
        }
        .ag-turno-head:hover { background: #f8fafc; }
        .ag-turno-sel { border-color: #93c5fd !important; }
        .ag-turno-head-sel { background: #eff6ff !important; }
        .ag-turno-hora { font-size: 13px; font-weight: 600; color: #111827; white-space: nowrap; }
        .ag-turno-paciente { font-size: 12px; color: #6b7280; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ag-turno-badge {
          flex-shrink: 0; font-size: 10.5px; font-weight: 600; padding: 2px 7px;
          border-radius: 20px;
        }

        /* ── Bloque asignación ── */
        .ag-asignar { padding: 12px; border-top: 1px solid #e8edf2; background: #f8fafc; }
        .ag-asignar-titulo { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #9ca3af; margin-bottom: 10px; }
        .ag-asignar-resumen { background: #fff; border: 1px solid #e8edf2; border-radius: 7px; padding: 8px 10px; margin-bottom: 10px; font-size: 12px; color: #374151; }
        .ag-asignar-resumen strong { color: #1a3a5c; }

        .ag-pac-search { position: relative; margin-bottom: 6px; }
        .ag-pac-input {
          width: 100%; box-sizing: border-box; padding: 7px 10px 7px 28px;
          border: 1.5px solid #e5e7eb; border-radius: 8px;
          font-size: 12.5px; font-family: 'DM Sans', sans-serif; color: #111827;
          outline: none; transition: border-color 0.2s;
        }
        .ag-pac-input:focus { border-color: #1a3a5c; }
        .ag-pac-icon { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none; }
        .ag-pac-results {
          background: #fff; border: 1.5px solid #e5e7eb; border-radius: 8px;
          max-height: 140px; overflow-y: auto; margin-bottom: 8px;
        }
        .ag-pac-item {
          padding: 7px 10px; font-size: 12.5px; cursor: pointer;
          border-bottom: 1px solid #f3f4f6; transition: background 0.1s;
        }
        .ag-pac-item:last-child { border-bottom: none; }
        .ag-pac-item:hover { background: #f0f4f8; }
        .ag-pac-sel {
          display: flex; align-items: center; justify-content: space-between;
          padding: 6px 10px; background: #eff6ff; border: 1.5px solid #93c5fd;
          border-radius: 8px; font-size: 12.5px; color: #1a3a5c; font-weight: 500;
          margin-bottom: 8px;
        }
        .ag-pac-clear { background: none; border: none; cursor: pointer; color: #6b7280; padding: 0; line-height: 1; }

        .ag-obs-input {
          width: 100%; box-sizing: border-box; padding: 7px 10px;
          border: 1.5px solid #e5e7eb; border-radius: 8px; resize: none;
          font-size: 12.5px; font-family: 'DM Sans', sans-serif; color: #111827;
          outline: none; transition: border-color 0.2s; margin-bottom: 8px;
        }
        .ag-obs-input:focus { border-color: #1a3a5c; }

        .ag-btn-confirmar {
          width: 100%; padding: 8px; background: #1a3a5c; color: #fff;
          border: none; border-radius: 8px; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .ag-btn-confirmar:hover:not(:disabled) { background: #15304d; }
        .ag-btn-confirmar:disabled { opacity: 0.55; cursor: not-allowed; }

        .ag-ocupado-info { padding: 12px; border-top: 1px solid #e8edf2; background: #fffbeb; }
        .ag-ocupado-nombre { font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 2px; }
        .ag-ocupado-doc    { font-size: 11.5px; color: #9ca3af; margin-bottom: 8px; }
        .ag-ocupado-obs    { font-size: 12px; color: #6b7280; font-style: italic; margin-bottom: 8px; }
        .ag-btn-cancelar {
          width: 100%; padding: 7px; background: #fef2f2; color: #dc2626;
          border: 1.5px solid #fecaca; border-radius: 8px; font-size: 12.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background 0.15s;
        }
        .ag-btn-cancelar:hover { background: #fee2e2; }

        .ag-panel-empty { text-align: center; padding: 32px 16px; color: #9ca3af; font-size: 13px; }

        @keyframes ag-spin { to { transform: rotate(360deg); } }
        .ag-spin { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: ag-spin 0.7s linear infinite; }

        /* ── Especialidad dropdown ── */
        .ag-esp-wrap { position: relative; }
        .ag-esp-input {
          width: 100%; box-sizing: border-box; padding: 7px 10px;
          border: 1.5px solid #e5e7eb; border-radius: 8px;
          font-size: 12.5px; font-family: 'DM Sans', sans-serif; color: #111827;
          outline: none; transition: border-color 0.2s; margin-top: 4px;
          background: #fff;
        }
        .ag-esp-input:focus { border-color: #1a3a5c; }
        .ag-esp-drop {
          position: absolute; top: calc(100% + 2px); left: 0; right: 0; z-index: 50;
          background: #fff; border: 1.5px solid #e5e7eb; border-radius: 8px;
          max-height: 160px; overflow-y: auto;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .ag-esp-opt {
          padding: 7px 10px; font-size: 12.5px; cursor: pointer;
          border-bottom: 1px solid #f3f4f6; transition: background 0.1s;
        }
        .ag-esp-opt:last-child { border-bottom: none; }
        .ag-esp-opt:hover { background: #f0f4f8; }
        .ag-esp-opt-on { background: #eff6ff; font-weight: 600; color: #1a3a5c; }

        /* ── Cambiar estado ── */
        .ag-estado-actions { padding: 8px 12px; border-top: 1px solid #e8edf2; display: flex; flex-wrap: wrap; gap: 5px; }
        .ag-estado-chip {
          padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
          border: 1.5px solid; cursor: pointer; transition: opacity 0.12s;
          font-family: 'DM Sans', sans-serif;
        }
        .ag-estado-chip:hover { opacity: 0.8; }

        /* ── Panel generar ── */
        .ag-gen { background: #fff; border: 1px solid #e8edf2; border-radius: 12px; overflow: hidden; margin-top: 12px; }
        .ag-gen-head {
          padding: 12px 16px; border-bottom: 1px solid #e8edf2;
          display: flex; align-items: center; justify-content: space-between;
        }
        .ag-gen-titulo { font-size: 13px; font-weight: 600; color: #1a3a5c; display: flex; align-items: center; gap: 7px; }
        .ag-gen-body { padding: 14px 16px; }

        .ag-gen-horarios-label { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #9ca3af; margin-bottom: 6px; }
        .ag-gen-horario-row {
          display: flex; align-items: center; gap: 8px; padding: 6px 10px;
          border: 1px solid #e8edf2; border-radius: 8px; margin-bottom: 4px; font-size: 12px; color: #374151;
        }
        .ag-gen-horario-dia { font-weight: 600; color: #1a3a5c; min-width: 78px; }
        .ag-gen-horario-slot { color: #6b7280; }

        .ag-gen-range { display: flex; gap: 10px; margin: 12px 0; }
        .ag-gen-field { flex: 1; }
        .ag-gen-label { font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #9ca3af; margin-bottom: 4px; }
        .ag-gen-input {
          width: 100%; box-sizing: border-box; padding: 7px 10px;
          border: 1.5px solid #e5e7eb; border-radius: 8px;
          font-size: 13px; font-family: 'DM Sans', sans-serif; color: #111827; outline: none;
          transition: border-color 0.2s;
        }
        .ag-gen-input:focus { border-color: #1a3a5c; }

        .ag-gen-preview { background: #f8fafc; border: 1px solid #e8edf2; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
        .ag-gen-preview-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .ag-gen-preview-title { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #374151; }
        .ag-gen-preview-total { font-size: 12px; font-weight: 700; color: #1a3a5c; }
        .ag-gen-preview-rows { display: flex; flex-direction: column; gap: 3px; max-height: 130px; overflow-y: auto; }
        .ag-gen-preview-row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #374151; }
        .ag-gen-preview-fecha { color: #6b7280; }

        .ag-gen-result { background: #dcfce7; border: 1px solid #86efac; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
        .ag-gen-result-ok   { font-size: 13px; font-weight: 600; color: #166534; }
        .ag-gen-result-skip { font-size: 12px; color: #16a34a; margin-top: 3px; }

        .ag-gen-actions { display: flex; gap: 8px; }
        .ag-btn-gen {
          flex: 1; padding: 8px 14px; background: #1a3a5c; color: #fff;
          border: none; border-radius: 8px; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .ag-btn-gen:hover:not(:disabled) { background: #15304d; }
        .ag-btn-gen:disabled { opacity: 0.55; cursor: not-allowed; }
        .ag-btn-gen-sec {
          padding: 8px 14px; background: #f8fafc; color: #374151;
          border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background 0.15s;
        }
        .ag-btn-gen-sec:hover { background: #f0f4f8; }

        /* ── Selección de médicos en generar ── */
        .ag-gen-medicos { max-height: 180px; overflow-y: auto; margin-bottom: 12px; display: flex; flex-direction: column; gap: 3px; }
        .ag-gen-medico-row {
          display: flex; align-items: center; gap: 8px; padding: 7px 10px;
          border: 1.5px solid #e8edf2; border-radius: 8px; cursor: pointer;
          transition: border-color 0.12s, background 0.12s;
        }
        .ag-gen-medico-row:hover { background: #f8fafc; }
        .ag-gen-medico-row-on { border-color: #93c5fd; background: #eff6ff; }
        .ag-gen-medico-row input[type=checkbox] { accent-color: #1a3a5c; width: 14px; height: 14px; flex-shrink: 0; cursor: pointer; }
        .ag-gen-medico-nombre { font-size: 12.5px; font-weight: 500; color: #111827; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ag-gen-medico-slots  { font-size: 11px; color: #9ca3af; flex-shrink: 0; }
        .ag-gen-todos {
          display: flex; align-items: center; gap: 8px; padding: 6px 10px;
          margin-bottom: 4px; border-radius: 8px; cursor: pointer;
          font-size: 12px; font-weight: 600; color: #374151;
          background: #f8fafc; border: 1.5px solid #e8edf2;
        }
        .ag-gen-todos:hover { background: #f0f4f8; }
        .ag-gen-todos input[type=checkbox] { accent-color: #1a3a5c; width: 14px; height: 14px; cursor: pointer; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#1a3a5c', marginBottom: 2 }}>Agenda</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>Gestión de turnos y citas médicas</div>
      </div>

      <div className="ag-layout">

        {/* ── Columna izquierda ── */}
        <div className="ag-col-izq">

          {/* Stats del mes */}
          <div className="ag-stats-grid">
            {[
              { label: 'Confirmadas', val: statsGlobal.confirmadas, cls: 'ag-stat-conf' },
              { label: 'Disponibles', val: statsGlobal.disponibles, cls: 'ag-stat-pend' },
              { label: 'Realizadas',  val: statsGlobal.realizadas,  cls: 'ag-stat-real' },
              { label: 'Cancelados',  val: statsGlobal.cancelados,  cls: 'ag-stat-canc' },
            ].map(s => (
              <div key={s.label} className={`ag-stat ${s.cls}`}>
                <div className="ag-stat-val">{s.val}</div>
                <div className="ag-stat-label">{s.label}</div>
              </div>
            ))}
            <div className="ag-stat ag-stat-total">
              <div className="ag-stat-val">{statsGlobal.total}</div>
              <div className="ag-stat-label">Total {MESES[mesVista.mes - 1]}</div>
            </div>
          </div>

          {/* Filtros y lista de médicos */}
          <div className="ag-card" style={{ flex: 1 }}>
            <div className="ag-card-head">Médicos</div>
            <div className="ag-card-body" style={{ paddingBottom: 0 }}>

              {/* Buscador */}
              <div className="ag-search-wrap">
                <Search size={13} className="ag-search-icon" />
                <input
                  className="ag-search-input"
                  placeholder="Buscar médico..."
                  value={busquedaMedico}
                  onChange={e => setBusquedaMedico(e.target.value)}
                />
              </div>

              {/* Chips de modo */}
              <div className="ag-chips">
                {[['todos','Todos'],['fecha','Fecha'],['especialidad','Especialidad']].map(([m, lbl]) => (
                  <button key={m} className={`ag-chip${modo === m ? ' ag-chip-on' : ''}`}
                    onClick={() => { setModo(m); if (m !== 'fecha') setFiltroFecha(''); if (m !== 'especialidad') setFiltroEsp('') }}>
                    {lbl}
                  </button>
                ))}
              </div>

              {/* Input de fecha */}
              {modo === 'fecha' && (
                <input type="date" className="ag-filter-input" value={filtroFecha}
                  onChange={e => setFiltroFecha(e.target.value)} />
              )}

              {/* Filtro especialidad — texto + dropdown */}
              {modo === 'especialidad' && (
                <div className="ag-esp-wrap">
                  <input
                    className="ag-esp-input"
                    placeholder="Buscar especialidad..."
                    value={filtroEspTexto}
                    onChange={e => { setFiltroEspTexto(e.target.value); setMostrarEspDrop(true) }}
                    onFocus={() => setMostrarEspDrop(true)}
                    onBlur={() => setTimeout(() => setMostrarEspDrop(false), 150)}
                  />
                  {mostrarEspDrop && (
                    <div className="ag-esp-drop">
                      <div
                        className={`ag-esp-opt${!filtroEsp ? ' ag-esp-opt-on' : ''}`}
                        onMouseDown={() => { setFiltroEsp(''); setFiltroEspTexto(''); setMostrarEspDrop(false); setMedicoSel(null) }}>
                        Todas las especialidades
                      </div>
                      {espFiltradas.map(e => (
                        <div key={e.id}
                          className={`ag-esp-opt${String(filtroEsp) === String(e.id) ? ' ag-esp-opt-on' : ''}`}
                          onMouseDown={() => { setFiltroEsp(String(e.id)); setFiltroEspTexto(e.descripcion); setMostrarEspDrop(false); setMedicoSel(null) }}>
                          {e.descripcion}
                        </div>
                      ))}
                      {espFiltradas.length === 0 && (
                        <div className="ag-esp-opt" style={{ color: '#9ca3af', cursor: 'default' }}>Sin resultados</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Lista de médicos */}
            <div className="ag-medico-list" style={{ paddingBottom: 8 }}>
              {medicosFiltrados.length === 0 && (
                <div style={{ padding: '20px 14px', color: '#9ca3af', fontSize: '12.5px', textAlign: 'center' }}>
                  No se encontraron médicos
                </div>
              )}
              {medicosFiltrados.map(m => {
                const col    = colorMedico(m.id)
                const activo = medicoSel?.id === m.id
                const hoy_str = fmtFecha(
                  new Date().getFullYear(),
                  new Date().getMonth() + 1,
                  new Date().getDate()
                )
                // Cantidad de turnos disponibles hoy de este médico
                const dispHoy = turnosMes.filter(t =>
                  t.horario_prestador_detalle?.persona_rrhh_id === m.id &&
                  t.fecha === hoy_str &&
                  t.estado === 'disponible'
                ).length

                return (
                  <div key={m.id}
                    className={`ag-medico-item${activo ? ' ag-medico-item-on' : ''}`}
                    onClick={() => { setMedicoSel(activo ? null : m); setFechaSel(null); setTurnoExpandido(null) }}>
                    <div className="ag-avatar" style={{ background: col.bg, color: col.text }}>
                      {inicialesMedico(m)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="ag-medico-nombre" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {nombreMedico(m)}
                      </div>
                      <div className="ag-medico-esp">
                        {m.especialidades_detalle?.map(e => e.descripcion).join(', ') || m.cargo || '—'}
                      </div>
                    </div>
                    {dispHoy > 0 && (
                      <span className="ag-medico-badge">{dispHoy}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Columna calendario ── */}
        <div className="ag-col-cal">
          <div className="ag-cal-card">
            {/* Header del calendario */}
            <div className="ag-cal-head">
              <div>
                <div className="ag-cal-titulo">
                  {medicoSel ? nombreMedico(medicoSel) : 'Seleccioná un médico'}
                </div>
                <div className="ag-cal-sub">
                  {medicoSel
                    ? medicoSel.especialidades_detalle?.map(e => e.descripcion).join(', ') || medicoSel.cargo || '—'
                    : 'Hacé clic en un médico de la lista para ver su agenda'
                  }
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={abrirGenerar}
                >
                  <CalendarDays size={13} />
                  {medicoSel ? 'Generar turnos' : 'Generar para todos'}
                </button>
                <div className="ag-cal-nav">
                  <button className="ag-cal-nav-btn" onClick={irMesAnterior}><ChevronLeft size={14} /></button>
                  <span className="ag-cal-mes-label">{MESES[mesVista.mes - 1]} {mesVista.anio}</span>
                  <button className="ag-cal-nav-btn" onClick={irMesSiguiente}><ChevronRight size={14} /></button>
                </div>
              </div>
            </div>

            <div className="ag-cal-grid">
              {/* Header días */}
              <div className="ag-cal-dias-header">
                {DIAS_SEMANA.map(d => <div key={d} className="ag-cal-dia-hdr">{d}</div>)}
              </div>

              {/* Celdas */}
              <div className="ag-cal-celdas">
                {celdas.map((dia, idx) => {
                  if (!dia) return <div key={idx} className="ag-cal-celda" />

                  const fechaStr  = fmtFecha(mesVista.anio, mesVista.mes, dia)
                  const esHoy     = fechaStr === fmtFecha(hoy.getFullYear(), hoy.getMonth()+1, hoy.getDate())
                  const esSel     = fechaStr === fechaSel
                  const turnos    = medicoSel ? (turnosPorFecha[fechaStr] ?? []) : []
                  const tieneData = turnos.length > 0

                  return (
                    <div
                      key={idx}
                      className={[
                        'ag-cal-celda',
                        tieneData || true ? 'ag-cal-celda-activa' : '',
                        esSel ? 'ag-cal-celda-sel' : '',
                        esHoy ? 'ag-cal-celda-hoy' : '',
                      ].join(' ')}
                      onClick={() => seleccionarDia(dia)}
                    >
                      <div className="ag-cal-num">{dia}</div>
                      <div className="ag-cal-pills">
                        {turnos.slice(0, 2).map(t => {
                          const c = colorEstado(t.estado)
                          const label = t.estado === 'ocupado' && t.paciente_detalle
                            ? t.paciente_detalle.nombre.split(' ')[0]
                            : t.estado === 'disponible' ? `${fmtHora(t.hora_desde)} libre`
                            : fmtHora(t.hora_desde)
                          return (
                            <div key={t.id} className="ag-cal-pill"
                              style={{ background: c.bg, color: c.text }}>
                              {label}
                            </div>
                          )
                        })}
                        {turnos.length > 2 && (
                          <div className="ag-cal-mas">+{turnos.length - 2} más</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {!medicoSel && (
              <div className="ag-cal-empty">
                <Calendar size={28} style={{ margin: '0 auto 8px', color: '#d1d5db', display: 'block' }} />
                Seleccioná un médico para ver sus turnos
              </div>
            )}
          </div>

        </div>

        {/* ── Modal generar turnos ── */}
        <Modal
          isOpen={mostrarGenerar}
          onClose={() => { setMostrarGenerar(false); setGenResult(null) }}
          title="Generar turnos"
          subtitle={medicoSel ? `Para ${nombreMedico(medicoSel)}` : 'Todos los médicos con horarios activos'}
          size="sm"
        >
          <div className="ag-gen-body" style={{ padding: '16px 0 0' }}>

            {/* Selección de médicos */}
            <div className="ag-gen-horarios-label">Médicos a incluir</div>
            {medicosConHorarios.length === 0 ? (
              <div style={{ fontSize: 12.5, color: '#9ca3af', marginBottom: 12 }}>
                Ningún médico tiene horarios activos configurados.
              </div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                {/* Buscador + botón Ver todos */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <div className="ag-search-wrap" style={{ flex: 1, marginBottom: 0 }}>
                    <Search size={13} className="ag-search-icon" />
                    <input
                      className="ag-search-input"
                      placeholder="Buscar prestador..."
                      value={busqGen}
                      onChange={e => { setBusqGen(e.target.value); setListaGenAbierta(true) }}
                    />
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 11.5, padding: '5px 10px', whiteSpace: 'nowrap' }}
                    onClick={() => { setBusqGen(''); setListaGenAbierta(v => !v) }}
                  >
                    {listaGenAbierta && !busqGen ? 'Ocultar' : 'Ver todos'}
                  </button>
                </div>

                {/* Lista: solo visible si hay búsqueda o se presionó Ver todos */}
                {(listaGenAbierta || busqGen) && (
                  <>
                    {!busqGen && (
                      <label className="ag-gen-todos">
                        <input
                          type="checkbox"
                          checked={medicosSelGen.size === medicosConHorarios.length && medicosConHorarios.length > 0}
                          onChange={toggleTodosGen}
                        />
                        Seleccionar todos ({medicosConHorarios.length})
                      </label>
                    )}
                    <div className="ag-gen-medicos">
                      {medicosConHorariosFiltrados.length === 0 && (
                        <div style={{ fontSize: 12.5, color: '#9ca3af', padding: '6px 0' }}>Sin resultados</div>
                      )}
                      {medicosConHorariosFiltrados.map(m => {
                        const sel = medicosSelGen.has(m.id)
                        const diasResumen = m.horarios
                          .map(h => h.excepcion
                            ? `Exc. ${h.fecha_excepcion}`
                            : (h.dia_semana_detalle?.descripcion?.slice(0,3) ?? DIAS_ID[h.dia_semana]?.slice(0,3) ?? '?'))
                          .join(', ')
                        return (
                          <label key={m.id} className={`ag-gen-medico-row${sel ? ' ag-gen-medico-row-on' : ''}`}>
                            <input type="checkbox" checked={sel} onChange={() => toggleMedicoGen(m.id)} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="ag-gen-medico-nombre">{m.nombre}</div>
                              <div style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 1 }}>{diasResumen}</div>
                            </div>
                            <span className="ag-gen-medico-slots">
                              {m.horarios.length} horario{m.horarios.length !== 1 ? 's' : ''}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </>
                )}

                {/* Resumen de seleccionados cuando la lista está oculta */}
                {!listaGenAbierta && !busqGen && medicosSelGen.size > 0 && (
                  <div style={{ fontSize: 12, color: '#1a3a5c', fontWeight: 500, marginTop: 4 }}>
                    {medicosSelGen.size} prestador{medicosSelGen.size !== 1 ? 'es' : ''} seleccionado{medicosSelGen.size !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}

            {/* Rango de fechas */}
            <div className="ag-gen-range">
              <div className="ag-gen-field">
                <div className="ag-gen-label">Desde</div>
                <input type="date" className="ag-gen-input" value={genDesde}
                  onChange={e => { setGenDesde(e.target.value); setGenResult(null) }} />
              </div>
              <div className="ag-gen-field">
                <div className="ag-gen-label">Hasta</div>
                <input type="date" className="ag-gen-input" value={genHasta}
                  onChange={e => { setGenHasta(e.target.value); setGenResult(null) }} />
              </div>
            </div>

            {/* Preview */}
            {preview.length > 0 && !genResult && (
              <div className="ag-gen-preview">
                <div className="ag-gen-preview-hdr">
                  <span className="ag-gen-preview-title">Previsualización</span>
                  <span className="ag-gen-preview-total">
                    {totalPreview} turno{totalPreview !== 1 ? 's' : ''} · {preview.length} día{preview.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="ag-gen-preview-rows">
                  {preview.map((p, i) => (
                    <div key={i} className="ag-gen-preview-row">
                      <span className="ag-gen-preview-fecha">{p.fecha}</span>
                      <span>{p.dia}</span>
                      <span style={{ fontWeight: 600 }}>{p.slots} turno{p.slots !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {genDesde && genHasta && preview.length === 0 && !genResult && medicosSelGen.size > 0 && (
              <div style={{ fontSize: 12.5, color: '#9ca3af', marginBottom: 12 }}>
                Ningún horario activo coincide con los días del rango seleccionado.
              </div>
            )}

            {/* Resultado */}
            {genResult && (
              <div className="ag-gen-result">
                <div className="ag-gen-result-ok">
                  <Check size={13} style={{ display: 'inline', marginRight: 5 }} />
                  {genResult.creados} turno{genResult.creados !== 1 ? 's' : ''} creado{genResult.creados !== 1 ? 's' : ''}
                </div>
                {genResult.omitidos > 0 && (
                  <div className="ag-gen-result-skip">
                    {genResult.omitidos} omitido{genResult.omitidos !== 1 ? 's' : ''} (ya existían)
                  </div>
                )}
              </div>
            )}

            {/* Acciones */}
            <div className="ag-gen-actions">
              <button
                className="ag-btn-gen"
                disabled={!genDesde || !genHasta || medicosSelGen.size === 0 || generando}
                onClick={handleGenerar}
              >
                {generando
                  ? <><div className="ag-spin" /> Generando...</>
                  : <><CalendarDays size={13} /> {totalPreview > 0 ? `Generar ${totalPreview} turno${totalPreview !== 1 ? 's' : ''}` : 'Generar'}</>
                }
              </button>
              <button className="ag-btn-gen-sec"
                onClick={() => { setGenDesde(''); setGenHasta(''); setGenResult(null) }}>
                Limpiar
              </button>
            </div>

          </div>
        </Modal>

        {/* ── Panel derecho — día ── */}
        <div className="ag-col-panel">
          <div className="ag-panel">
            <div className="ag-panel-head">
              <div className="ag-panel-titulo">
                {fechaSel
                  ? new Date(fechaSel + 'T00:00:00').toLocaleDateString('es-PY', { weekday:'long', day:'numeric', month:'long' })
                  : 'Detalle del día'
                }
              </div>
              <div className="ag-panel-sub">
                {fechaSel && medicoSel
                  ? `${turnosPanelDia.length} turno(s) · ${nombreMedico(medicoSel)}`
                  : fechaSel
                  ? `${turnosPanelDia.length} turno(s) totales`
                  : 'Hacé clic en un día del calendario'
                }
              </div>
            </div>

            <div className="ag-panel-body">
              {!fechaSel ? (
                <div className="ag-panel-empty">
                  <Calendar size={24} style={{ margin: '0 auto 8px', color: '#d1d5db', display: 'block' }} />
                  Seleccioná un día
                </div>
              ) : turnosPanelDia.length === 0 ? (
                <div className="ag-panel-empty">Sin turnos para este día</div>
              ) : (
                turnosPanelDia.map(turno => {
                  const col   = colorEstado(turno.estado)
                  const esSel = turnoExpandido === turno.id

                  // Etiqueta descriptiva en la cabecera
                  const labelPaciente = (() => {
                    if (turno.paciente_detalle?.nombre) return turno.paciente_detalle.nombre
                    if (turno.estado === 'disponible') return 'Disponible'
                    if (turno.estado === 'inactivo')   return 'Bloqueado'
                    if (turno.estado === 'cancelado')  return 'Cancelado'
                    if (turno.estado === 'realizado')  return 'Realizado'
                    return '—'
                  })()

                  // Transiciones de estado disponibles según estado actual
                  const transiciones = {
                    disponible: [
                      { estado: 'inactivo',  label: 'Bloquear',  bg: '#f3f4f6', text: '#6b7280', borde: '#d1d5db' },
                      { estado: 'cancelado', label: 'Cancelar',  bg: '#fee2e2', text: '#991b1b', borde: '#fca5a5' },
                    ],
                    ocupado: [
                      { estado: 'realizado', label: 'Realizado', bg: '#ede9fe', text: '#5b21b6', borde: '#c4b5fd' },
                      { estado: 'cancelado', label: 'Cancelar y liberar', bg: '#fee2e2', text: '#991b1b', borde: '#fca5a5' },
                    ],
                    inactivo: [
                      { estado: 'disponible', label: 'Activar',  bg: '#dcfce7', text: '#166534', borde: '#86efac' },
                      { estado: 'cancelado',  label: 'Cancelar', bg: '#fee2e2', text: '#991b1b', borde: '#fca5a5' },
                    ],
                    cancelado: [
                      { estado: 'disponible', label: 'Reactivar', bg: '#dcfce7', text: '#166534', borde: '#86efac' },
                    ],
                    realizado: [
                      { estado: 'ocupado', label: 'Revertir a ocupado', bg: '#fef3c7', text: '#92400e', borde: '#fcd34d' },
                    ],
                  }[turno.estado] ?? []

                  return (
                    <div key={turno.id}
                      className={`ag-turno${esSel ? ' ag-turno-sel' : ''}`}>

                      {/* Cabecera */}
                      <div
                        className={`ag-turno-head${esSel ? ' ag-turno-head-sel' : ''}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setTurnoExpandido(esSel ? null : turno.id)
                          setBusqPaciente('')
                          setPacienteSel(null)
                          setObservacion('')
                        }}
                      >
                        <span className="ag-turno-hora">{fmtHora(turno.hora_desde)}</span>
                        <span className="ag-turno-paciente">{labelPaciente}</span>
                        <span className="ag-turno-badge" style={{ background: col.bg, color: col.text }}>
                          {turno.estado}
                        </span>
                      </div>

                      {esSel && (
                        <>
                          {/* Info de paciente — turno ocupado o realizado */}
                          {turno.paciente_detalle && (turno.estado === 'ocupado' || turno.estado === 'realizado') && (
                            <div className="ag-ocupado-info">
                              <div className="ag-ocupado-nombre">{turno.paciente_detalle.nombre}</div>
                              <div className="ag-ocupado-doc">Doc: {turno.paciente_detalle.nro_documento ?? '—'}</div>
                              {turno.observacion && (
                                <div className="ag-ocupado-obs">"{turno.observacion}"</div>
                              )}
                            </div>
                          )}

                          {/* Asignar paciente — turno disponible */}
                          {turno.estado === 'disponible' && (
                            <div className="ag-asignar">
                              <div className="ag-asignar-titulo">Asignar paciente</div>
                              <div className="ag-asignar-resumen">
                                <strong>{fmtHora(turno.hora_desde)} – {fmtHora(turno.hora_hasta)}</strong>
                                {' · '}{turno.horario_prestador_detalle?.nombre ?? '—'}
                              </div>

                              {!pacienteSel ? (
                                <>
                                  <div className="ag-pac-search">
                                    <Search size={12} className="ag-pac-icon" />
                                    <input
                                      className="ag-pac-input"
                                      placeholder="Nombre o nro. de documento..."
                                      value={busqPaciente}
                                      onChange={e => setBusqPaciente(e.target.value)}
                                      autoComplete="off"
                                    />
                                  </div>
                                  {resultadosPaciente?.length > 0 && (
                                    <div className="ag-pac-results">
                                      {resultadosPaciente.map(p => (
                                        <div key={p.id} className="ag-pac-item"
                                          onClick={() => { setPacienteSel(p); setBusqPaciente('') }}>
                                          <strong>{p.nombre ?? p.persona_detalle?.razon_social ?? '—'}</strong>
                                          {' · '}
                                          <span style={{ fontSize: 11, color: '#9ca3af' }}>
                                            {p.documento ?? p.persona_detalle?.nro_documento ?? ''}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {busqPaciente.length >= 2 && !resultadosPaciente?.length && (
                                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Sin resultados</div>
                                  )}
                                </>
                              ) : (
                                <div className="ag-pac-sel">
                                  <span>{pacienteSel.nombre ?? pacienteSel.persona_detalle?.razon_social ?? '—'}</span>
                                  <button className="ag-pac-clear" onClick={() => setPacienteSel(null)}>
                                    <X size={13} />
                                  </button>
                                </div>
                              )}

                              <textarea
                                className="ag-obs-input"
                                rows={2}
                                placeholder="Observación (opcional)"
                                value={observacion}
                                onChange={e => setObservacion(e.target.value)}
                              />
                              <button className="ag-btn-confirmar"
                                disabled={!pacienteSel || confirmando}
                                onClick={handleConfirmar}>
                                {confirmando
                                  ? <><div className="ag-spin" /> Confirmando...</>
                                  : <><Check size={14} /> Confirmar cita</>
                                }
                              </button>
                            </div>
                          )}

                          {/* Acciones de estado */}
                          {transiciones.length > 0 && (
                            <div className="ag-estado-actions">
                              {transiciones.map(tr => (
                                <button
                                  key={tr.estado}
                                  className="ag-estado-chip"
                                  style={{ background: tr.bg, color: tr.text, borderColor: tr.borde }}
                                  onClick={async () => {
                                    try {
                                      await cambiarEstado({ id: turno.id, estado: tr.estado })
                                      showToast(`Estado cambiado a ${tr.estado}.`, 'success')
                                      setTurnoExpandido(null)
                                    } catch (err) {
                                      showToast(extraerError(err), 'error')
                                    }
                                  }}
                                >
                                  {tr.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
