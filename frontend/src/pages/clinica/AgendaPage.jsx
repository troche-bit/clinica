import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search, Calendar, X, Check, CalendarDays, Settings2, Lock } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'
import {
  useAgendaMes, useAgendaDia, useAgendaDiaGlobal,
  useAgendaGlobalMes, useAsignarTurno, useCambiarEstado,
  usePacienteSearch, useReagendar, useCancelarRango, useAgendaRango,
} from '../../hooks/clinica/useAgenda'
import { usePersonasRRHH } from '../../hooks/administracion/usePersonaRRHH'
import { useEspecialidades } from '../../hooks/clinica/useEspecialidades'
import { useHorariosPrestador, useGenerarTurnos } from '../../hooks/clinica/useHorarioPrestador'
import { useAuth } from '../../context/AuthContext'
import { useAtajosTeclado } from '../../hooks/useAtajosTeclado'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Toast from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { extraerMensajeError } from '../../utils/errores'

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

const COLORES_DOT = ['#6366f1','#0ea5e9','#f59e0b','#10b981','#f43f5e','#8b5cf6']
const colorDot = (id) => COLORES_DOT[(id - 1) % COLORES_DOT.length]

const DIAS_ID = { 1:'Lunes',2:'Martes',3:'Miércoles',4:'Jueves',5:'Viernes',6:'Sábado',7:'Domingo' }

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

function colorEstado(estado) {
  switch (estado) {
    case 'disponible': return { bg: '#dcfce7', text: '#16a34a', borde: '#86efac' }
    case 'ocupado':    return { bg: '#dbeafe', text: '#2563eb', borde: '#93c5fd' }
    case 'inactivo':   return { bg: '#f3f4f6', text: '#6b7280', borde: '#d1d5db' }
    case 'cancelado':  return { bg: '#fee2e2', text: '#dc2626', borde: '#fca5a5' }
    case 'realizado':  return { bg: '#ede9fe', text: '#7c3aed', borde: '#c4b5fd' }
    default:           return { bg: '#f3f4f6', text: '#6b7280', borde: '#d1d5db' }
  }
}

function previsualizarTurnos(horarios, fechaDesde, fechaHasta) {
  if (!fechaDesde || !fechaHasta) return []
  const desde = new Date(fechaDesde + 'T00:00:00')
  const hasta  = new Date(fechaHasta + 'T00:00:00')
  if (hasta < desde) return []

  const ahora    = new Date()
  const hoyStr   = ahora.toLocaleDateString('en-CA')
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes()

  const resultado = []
  for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
    const fechaStr    = d.toLocaleDateString('en-CA')
    if (fechaStr < hoyStr) continue
    const esHoy       = fechaStr === hoyStr
    const diaSemanaId = d.getDay() === 0 ? 7 : d.getDay()

    for (const h of horarios) {
      if (h.estado !== 'activo') continue
      const aplica = h.excepcion
        ? h.fecha_excepcion === fechaStr
        : Number(h.dia_semana) === diaSemanaId
      if (!aplica) continue
      if (!h.hora_desde || !h.hora_hasta || !h.intervalo) continue
      const [hd, md] = h.hora_desde.split(':').map(Number)
      const [hh, mh] = h.hora_hasta.split(':').map(Number)
      let minDesde   = hd * 60 + md
      const minHasta = hh * 60 + mh

      if (esHoy) {
        while (minDesde <= minAhora && minDesde < minHasta) minDesde += Number(h.intervalo)
      }

      const slots = Math.floor((minHasta - minDesde) / Number(h.intervalo))
      if (slots > 0) {
        resultado.push({
          fecha:     fechaStr,
          dia:       DIAS_ID[diaSemanaId] ?? '',
          slots,
          horarioId: h.id,
        })
      }
    }
  }
  return resultado
}

export default function AgendaPage() {
  const hoyStr = useMemo(() => new Date().toLocaleDateString('en-CA'), [])
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const esMedico     = user?.rol === 'medico'
  const esSecretaria = user?.rol === 'secretaria_medico'
  const esRestringido = esMedico || esSecretaria
  const puedeModificar = true

  const fechaParam = searchParams.get('fecha')

  const [mesVista, setMesVista] = useState(() => {
    if (fechaParam) {
      const d = new Date(fechaParam + 'T00:00:00')
      return { mes: d.getMonth() + 1, anio: d.getFullYear() }
    }
    const hoy = new Date()
    return { mes: hoy.getMonth() + 1, anio: hoy.getFullYear() }
  })
  const [medicoSel, setMedicoSel]       = useState(null)
  const [fechaSel,  setFechaSel]        = useState(fechaParam || null)
  const [modo,      setModo]            = useState('todos')
  const [filtroFecha,    setFiltroFecha]    = useState('')
  const [filtroEsp,      setFiltroEsp]      = useState('')
  const [filtroEspTexto, setFiltroEspTexto] = useState('')
  const [mostrarEspDrop, setMostrarEspDrop] = useState(false)
  const [busquedaMedico, setBusquedaMedico] = useState('')
  const [turnoExpandido, setTurnoExpandido] = useState(null)
  const [busqPaciente,   setBusqPaciente]   = useState('')
  const [pacienteSel,    setPacienteSel]    = useState(null)
  const [pacFocusIdx,    setPacFocusIdx]    = useState(-1)
  const [observacion,    setObservacion]    = useState('')
  const pacResultsRef = useRef(null)
  const [confirmando,    setConfirmando]    = useState(false)
  const [mostrarGenerar, setMostrarGenerar] = useState(false)
  const [genDesde,       setGenDesde]       = useState(() => new Date().toLocaleDateString('en-CA'))
  const [genHasta,       setGenHasta]       = useState('')
  const [genResult,      setGenResult]      = useState(null)
  const [generando,      setGenerando]      = useState(false)
  const [medicosSelGen,  setMedicosSelGen]  = useState(new Set())
  const [busqGen,        setBusqGen]        = useState('')
  const [listaGenAbierta, setListaGenAbierta] = useState(false)
  const [confirmEstado, setConfirmEstado]  = useState(null)

  const [reagendarTurnoId, setReagendarTurnoId] = useState(null)
  const [reagendarFecha,   setReagendarFecha]   = useState('')
  const [reagendarSlot,    setReagendarSlot]    = useState(null)
  const [reagendando,      setReagendando]      = useState(false)
  const [mostrarGestionar, setMostrarGestionar] = useState(false)
  const [gestMedico,       setGestMedico]       = useState(null)
  const [gestDesde,        setGestDesde]        = useState('')
  const [gestHasta,        setGestHasta]        = useState('')
  const [gestHoraDesde,    setGestHoraDesde]    = useState('')
  const [gestHoraHasta,    setGestHoraHasta]    = useState('')
  const [cancelandoRango,  setCancelandoRango]  = useState(false)
  const [gestResult,       setGestResult]       = useState(null)
  const [busqGest,         setBusqGest]         = useState('')
  const [busqGestAbierta,  setBusqGestAbierta]  = useState(false)
  const [confirmGestionar,    setConfirmGestionar]    = useState(false)
  const [confirmDescartarGen, setConfirmDescartarGen] = useState(false)
  const [confirmDescartarGest,setConfirmDescartarGest]= useState(false)
  const [tabMovil,            setTabMovil]            = useState(1)

  const { toast, showToast } = useToast()
  const qc = useQueryClient()

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

  useEffect(() => {
    if (modo === 'especialidad' && medicosFiltrados.length > 0 && !medicoSel) {
      setMedicoSel(medicosFiltrados[0])
    }
  }, [medicosFiltrados, modo])

  useEffect(() => {
    if (modo === 'fecha' && filtroFecha) {
      const [a, m] = filtroFecha.split('-').map(Number)
      setMesVista({ mes: m, anio: a })
      setFechaSel(filtroFecha)
    }
  }, [filtroFecha, modo])

  useEffect(() => {
    if (!esRestringido) return
    const multiSecretaria = esSecretaria && (user?.medicos_asignados?.length ?? 0) > 1
    if (multiSecretaria) return
    const rrhhId = esMedico ? user?.persona_rrhh_id : user?.medico_asignado_id
    if (!rrhhId || !todosLosMedicos.length) return
    const m = todosLosMedicos.find(m => m.id === rrhhId)
    if (m && (!medicoSel || medicoSel.id !== m.id)) {
      setMedicoSel(m)
      setGestMedico(m)
    }
  }, [esRestringido, esMedico, esSecretaria, user?.persona_rrhh_id, user?.medico_asignado_id, user?.medicos_asignados, todosLosMedicos])

  const { data: agendaMes }    = useAgendaMes(medicoSel?.id, mesVista.mes, mesVista.anio)
  const turnosMes              = agendaMes ?? []

  const { data: turnosDia }    = useAgendaDia(medicoSel?.id, fechaSel)
  const { data: turnosDiaGlob} = useAgendaDiaGlobal(!medicoSel ? fechaSel : null)
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
  const { mutateAsync: cambiarEstado, isPending: cambiandoEstado } = useCambiarEstado()
  const { mutateAsync: reagendarTurno } = useReagendar()
  const { mutateAsync: cancelarRango }  = useCancelarRango()

  const { data: horariosGlobalData } = useHorariosPrestador({ estado: 'activo' })

  const todosHorariosActivos = useMemo(() => {
    const lista = horariosGlobalData?.results ?? horariosGlobalData ?? []
    return lista.filter(h => h.estado === 'activo')
  }, [horariosGlobalData])

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

  const medicosParaGenerar = useMemo(() => {
    if (esMedico && user?.persona_rrhh_id) {
      return medicosConHorarios.filter(m => m.id === user.persona_rrhh_id)
    }
    if (esSecretaria && (user?.medicos_asignados ?? []).length > 0) {
      return medicosConHorarios.filter(m => (user.medicos_asignados ?? []).includes(m.id))
    }
    return medicosConHorarios
  }, [medicosConHorarios, esMedico, esSecretaria, user?.persona_rrhh_id, user?.medicos_asignados])

  const medicosConHorariosFiltrados = useMemo(() => {
    if (!busqGen.trim()) return medicosParaGenerar
    const txt = busqGen.toLowerCase()
    return medicosParaGenerar.filter(m => m.nombre.toLowerCase().includes(txt))
  }, [medicosParaGenerar, busqGen])

  const medicosGestFiltrados = useMemo(() => {
    if (!busqGest.trim()) return todosLosMedicos
    const txt = busqGest.toLowerCase()
    return todosLosMedicos.filter(m =>
      (m?.persona_detalle?.razon_social ?? m?.nombre ?? '').toLowerCase().includes(txt)
    )
  }, [todosLosMedicos, busqGest])

  const { mutateAsync: generarTurnos } = useGenerarTurnos()

  const horariosSeleccionados = useMemo(
    () => todosHorariosActivos.filter(h => medicosSelGen.has(h.persona_rrhh)),
    [todosHorariosActivos, medicosSelGen]
  )
  const preview      = useMemo(
    () => previsualizarTurnos(horariosSeleccionados, genDesde, genHasta),
    [horariosSeleccionados, genDesde, genHasta]
  )
  const totalPreview = preview.reduce((s, x) => s + x.slots, 0)

  const toggleMedicoGen = (id) => {
    setMedicosSelGen(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
    setGenResult(null)
  }
  const toggleTodosGen = () => {
    const todosIds = medicosParaGenerar.map(m => m.id)
    setMedicosSelGen(
      medicosSelGen.size === todosIds.length ? new Set() : new Set(todosIds)
    )
    setGenResult(null)
  }
  const abrirGenerar = () => {
    const ids = medicoSel
      ? new Set([medicoSel.id])
      : new Set(medicosParaGenerar.map(m => m.id))
    setMedicosSelGen(ids)
    setGenResult(null)
    setGenDesde(new Date().toLocaleDateString('en-CA'))
    setGenHasta('')
    setBusqGen('')
    setListaGenAbierta(false)
    setMostrarGenerar(v => !v)
  }

  const { data: resultadosPaciente } = usePacienteSearch(busqPaciente.length >= 3 ? busqPaciente : '')

  const turnosPorFecha = useMemo(() => {
    const map = {}
    for (const t of turnosMes) {
      if (!map[t.fecha]) map[t.fecha] = []
      map[t.fecha].push(t)
    }
    return map
  }, [turnosMes])

  const medicosPorDia = useMemo(() => {
    const map = {}
    for (const t of turnosMesGlobal ?? []) {
      if (t.estado === 'cancelado' || t.estado === 'inactivo') continue
      if (!map[t.fecha]) map[t.fecha] = new Set()
      const id = t.horario_prestador_detalle?.persona_rrhh_id
      if (id) map[t.fecha].add(id)
    }
    return map
  }, [turnosMesGlobal])

  const statsPorDia = useMemo(() => {
    const map = {}
    for (const t of turnosMesGlobal ?? []) {
      if (t.estado === 'cancelado' || t.estado === 'inactivo') continue
      if (!map[t.fecha]) map[t.fecha] = { ocup: 0, libre: 0 }
      if (t.estado === 'ocupado') map[t.fecha].ocup++
      else if (t.estado === 'disponible') map[t.fecha].libre++
    }
    return map
  }, [turnosMesGlobal])

  const reagendarMedicoId = useMemo(() => {
    if (!reagendarTurnoId) return null
    const t = turnosPanelDia.find(t => t.id === reagendarTurnoId)
    return t?.horario_prestador_detalle?.persona_rrhh_id ?? null
  }, [reagendarTurnoId, turnosPanelDia])

  const { data: slotsReagendar } = useAgendaDia(reagendarMedicoId, reagendarFecha || null)
  const slotsDisponibles = useMemo(
    () => (slotsReagendar ?? []).filter(t => t.estado === 'disponible'),
    [slotsReagendar]
  )

  const { data: turnosGestion, isLoading: cargandoGestion } = useAgendaRango(
    gestMedico?.id ?? null,
    gestDesde || null,
    gestHasta || null,
  )
  const turnosGestionFiltrados = useMemo(() => {
    let lista = turnosGestion ?? []
    if (gestHoraDesde) lista = lista.filter(t => (t.hora_desde ?? '').slice(0, 5) >= gestHoraDesde)
    if (gestHoraHasta) lista = lista.filter(t => (t.hora_hasta ?? '').slice(0, 5) <= gestHoraHasta)
    return lista
  }, [turnosGestion, gestHoraDesde, gestHoraHasta])

  const gestStats = useMemo(() => {
    const lista = turnosGestionFiltrados
    return {
      disponibles: lista.filter(t => t.estado === 'disponible').length,
      ocupados:    lista.filter(t => t.estado === 'ocupado').length,
      cancelados:  lista.filter(t => t.estado === 'cancelado').length,
      total:       lista.length,
    }
  }, [turnosGestionFiltrados])

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
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setConfirmando(false)
    }
  }

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
      qc.invalidateQueries({ queryKey: ['agenda-resumen-mes'] })
      qc.invalidateQueries({ queryKey: ['agenda-dia-global'] })
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setGenerando(false)
    }
  }

  const ejecutarCambioEstado = async () => {
    if (!confirmEstado) return
    try {
      await cambiarEstado({ id: confirmEstado.turnoId, estado: confirmEstado.estado })
      showToast(`Estado cambiado a ${confirmEstado.estado}.`, 'success')
      setTurnoExpandido(null)
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setConfirmEstado(null)
    }
  }

  const handleReagendar = async () => {
    if (!reagendarTurnoId || !reagendarSlot) return
    setReagendando(true)
    try {
      await reagendarTurno({ id: reagendarTurnoId, nuevo_turno_id: reagendarSlot })
      showToast('Turno reagendado correctamente.', 'success')
      setReagendarTurnoId(null)
      setReagendarFecha('')
      setReagendarSlot(null)
      setTurnoExpandido(null)
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setReagendando(false)
    }
  }

  const handleCancelarRango = async () => {
    if (!gestMedico || !gestDesde || !gestHasta) return
    setCancelandoRango(true)
    try {
      const res = await cancelarRango({
        persona_rrhh: gestMedico.id,
        fecha_desde:  gestDesde,
        fecha_hasta:  gestHasta,
        hora_desde:   gestHoraDesde || undefined,
        hora_hasta:   gestHoraHasta || undefined,
      })
      setGestResult(res.data)
      showToast(`${res.data.cancelados} turno(s) cancelado(s).`, 'success')
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setCancelandoRango(false)
    }
  }

  useAtajosTeclado({
    'F2': { fn: () => { if (!mostrarGenerar && !mostrarGestionar && puedeModificar) abrirGenerar() } },
  })

  const nombreMedico = (m) => m?.persona_detalle?.razon_social ?? m?.nombre ?? '—'
  const inicialesMedico = (m) => {
    const n = nombreMedico(m)
    return n.split(' ').map(x => x[0]).join('').toUpperCase().slice(0, 2)
  }

  const celdas = diasDelMes(mesVista.mes, mesVista.anio)

  return (
    <>
      <Toast toast={toast} />

      <ConfirmDialog
        isOpen={confirmEstado !== null}
        title="Confirmar cambio de estado"
        description={
          confirmEstado?.tieneP
            ? `El turno tiene un paciente asignado. Al ${confirmEstado?.label?.toLowerCase()} se liberará la asignación. ¿Confirmar?`
            : `¿Confirmar acción: ${confirmEstado?.label}?`
        }
        confirmText={confirmEstado?.label}
        onConfirm={ejecutarCambioEstado}
        onCancel={() => setConfirmEstado(null)}
        loading={cambiandoEstado}
      />

      <ConfirmDialog
        isOpen={confirmDescartarGen}
        title="Descartar configuración"
        description="¿Cerrar el generador? Los datos ingresados no se guardarán."
        confirmText="Descartar"
        onConfirm={() => { setConfirmDescartarGen(false); setMostrarGenerar(false); setGenResult(null) }}
        onCancel={() => setConfirmDescartarGen(false)}
      />

      <ConfirmDialog
        isOpen={confirmDescartarGest}
        title="Descartar cambios"
        description="¿Cerrar sin procesar? El rango de fechas ingresado no se aplicará."
        confirmText="Descartar"
        onConfirm={() => { setConfirmDescartarGest(false); setMostrarGestionar(false); setGestResult(null); setGestHoraDesde(''); setGestHoraHasta('') }}
        onCancel={() => setConfirmDescartarGest(false)}
      />

      <style>{`
        .ag-layout { display: flex; gap: 16px; align-items: flex-start; min-height: calc(100vh - 140px); }
        .ag-col-izq   { width: 240px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; }
        .ag-col-cal   { flex: 1; min-width: 0; }
        .ag-col-panel { width: 280px; flex-shrink: 0; }

        .ag-page-header { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
        .ag-page-sub    { font-size: 13px; color: #6b7280; }
        .ag-page-subrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

        .ag-stats-inline { display: flex; background: #fff; border: 1px solid #e8edf2; border-radius: 10px; overflow: hidden; width: 100%; }
        .ag-stat-pill { flex: 1; padding: 10px 14px; text-align: center; border-right: 1px solid #e8edf2; }
        .ag-stat-pill:last-child { border-right: none; }
        .ag-stat-pill-val   { font-size: 18px; font-weight: 700; color: #1a3a5c; line-height: 1; }
        .ag-stat-pill-label { font-size: 10px; color: #9ca3af; margin-top: 2px; white-space: nowrap; }
        .ag-stat-conf .ag-stat-pill-val { color: #d97706; }
        .ag-stat-pend .ag-stat-pill-val { color: #16a34a; }
        .ag-stat-real .ag-stat-pill-val { color: #7c3aed; }
        .ag-stat-canc .ag-stat-pill-val { color: #dc2626; }

        .ag-cal-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .ag-cal-action-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 500;
          cursor: pointer; border: 1.5px solid; font-family: 'DM Sans', sans-serif; transition: all 0.15s;
        }
        .ag-cal-action-gen  { background: #1a3a5c; color: #fff; border-color: #1a3a5c; }
        .ag-cal-action-gen:hover  { background: #15304d; border-color: #15304d; }
        .ag-cal-action-gest { background: #fff; color: #374151; border-color: #e5e7eb; }
        .ag-cal-action-gest:hover { background: #f0f4f8; }

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

        .ag-medico-list { display: flex; flex-direction: column; gap: 2px; }
        .ag-medico-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 14px; cursor: pointer; border-left: 3px solid transparent;
          transition: background 0.12s, border-color 0.12s;
        }
        .ag-medico-item:hover { background: #f0f4f8; }
        .ag-medico-item-on { background: #f0f5fb !important; }
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
          min-height: 70px; border-radius: 7px; padding: 4px 5px;
          border: 1.5px solid transparent; cursor: default;
          transition: background 0.12s, border-color 0.12s;
          display: flex; flex-direction: column; gap: 2px;
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

        .ag-cal-dots { display: flex; flex-wrap: wrap; gap: 2px; margin-top: 3px; align-items: center; }
        .ag-cal-dot  { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .ag-cal-dot-mas { font-size: 9px; color: #9ca3af; line-height: 1; }
        .ag-cal-conteo { display: flex; gap: 4px; margin-top: 2px; line-height: 1; }
        .ag-cal-conteo-ocup  { font-size: 9.5px; font-weight: 700; color: #d97706; }
        .ag-cal-conteo-libre { font-size: 9.5px; font-weight: 700; color: #16a34a; }

        .ag-turno-glob { display: flex; align-items: stretch; border: 1px solid #f0f4f8; border-radius: 7px; margin-bottom: 5px; overflow: hidden; background: #fff; }
        .ag-turno-glob-bar  { width: 3px; flex-shrink: 0; }
        .ag-turno-glob-hora { font-size: 11.5px; font-weight: 700; color: #374151; white-space: nowrap; padding: 7px 8px; align-self: flex-start; }
        .ag-turno-glob-info { flex: 1; min-width: 0; padding: 7px 8px 7px 0; }
        .ag-turno-glob-pac  { font-size: 12px; font-weight: 500; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ag-turno-glob-med  { font-size: 10.5px; color: #9ca3af; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

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
          display: flex; align-items: center; gap: 8px;
          padding: 7px 10px; cursor: pointer;
          border-bottom: 1px solid #f3f4f6; transition: background 0.1s;
        }
        .ag-pac-item:last-child { border-bottom: none; }
        .ag-pac-item:hover { background: #f0f4f8; }
        .ag-pac-item-focus { background: #eff6ff !important; outline: none; }
        .ag-pac-item-focus .ag-pac-nombre { color: #1a3a5c; }
        .ag-pac-avatar { width: 28px; height: 28px; border-radius: 50%; background: #e0e7ff; color: #3730a3; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ag-pac-nombre { font-size: 12.5px; font-weight: 500; color: #111827; }
        .ag-pac-doc    { font-size: 11px; color: #9ca3af; margin-top: 1px; }
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

        .ag-panel-empty { text-align: center; padding: 32px 16px; color: #9ca3af; font-size: 13px; }

        @keyframes ag-spin { to { transform: rotate(360deg); } }
        .ag-spin { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: ag-spin 0.7s linear infinite; }

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

        .ag-estado-actions { padding: 8px 12px; border-top: 1px solid #e8edf2; display: flex; flex-wrap: wrap; gap: 5px; }
        .ag-bloqueo-consulta {
          margin: 8px 12px; padding: 8px 12px;
          background: #f8fafc; border: 1px solid #e8edf2; border-radius: 7px;
          font-size: 12px; color: #6b7280; line-height: 1.5;
        }
        .ag-estado-chip {
          padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
          border: 1.5px solid; cursor: pointer; transition: opacity 0.12s;
          font-family: 'DM Sans', sans-serif;
        }
        .ag-estado-chip:hover { opacity: 0.8; }

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

        .ag-gen-medicos { max-height: 200px; overflow-y: auto; margin-bottom: 12px; display: flex; flex-direction: column; gap: 3px; }
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

        .ag-reagendar { padding: 12px; border-top: 1px solid #e8edf2; background: #f0f9ff; }
        .ag-reagendar-titulo { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #0369a1; margin-bottom: 8px; }
        .ag-reagendar-slots  { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
        .ag-reagendar-slot   {
          padding: 5px 10px; border-radius: 6px; font-size: 12px; font-weight: 500;
          border: 1.5px solid #bae6fd; background: #fff; color: #0369a1;
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.12s;
        }
        .ag-reagendar-slot:hover { background: #e0f2fe; }
        .ag-reagendar-slot-on   { background: #0369a1 !important; color: #fff !important; border-color: #0369a1 !important; }

        .ag-mobile-tabs { display: none; }
        .ag-gest-warn { background: #fff5f5; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 12px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
        .ag-gest-warn-title { font-size: 13px; font-weight: 600; color: #dc2626; }
        .ag-gest-warn-sub   { font-size: 11.5px; color: #9ca3af; margin-top: 2px; }

        @media (max-width: 767px) {
          .ag-stats-inline { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .ag-stat-pill { flex: 0 0 auto; min-width: 72px; }
          .ag-page-subrow { flex-direction: column; align-items: flex-start; gap: 8px; }
          .ag-cal-actions { width: 100%; }
          .ag-cal-action-btn { flex: 1; justify-content: center; }

          .modal-backdrop { padding: 0 !important; align-items: flex-start !important; }
          .modal-overlay { display: none !important; }
          .modal-box { border-radius: 0 !important; height: 100dvh !important; max-height: 100dvh !important; max-width: 100% !important; width: 100% !important; animation: none !important; }
          .modal-body { padding: 16px !important; }

          .ag-mobile-tabs {
            display: flex; margin-bottom: 12px; border: 1.5px solid #e5e7eb;
            border-radius: 10px; overflow: hidden;
          }
          .ag-mobile-tab {
            flex: 1; padding: 9px 4px; font-size: 12.5px; font-weight: 500;
            background: #f8fafc; color: #6b7280; border: none; cursor: pointer;
            font-family: 'DM Sans', sans-serif; transition: all 0.15s;
            border-right: 1px solid #e5e7eb;
          }
          .ag-mobile-tab:last-child { border-right: none; }
          .ag-mobile-tab-on { background: #1a3a5c; color: #fff; }

          .ag-layout { flex-direction: column; gap: 0; }
          .ag-col-izq   { width: 100%; }
          .ag-col-cal   { width: 100%; }
          .ag-col-panel { width: 100%; }
          .ag-mob-hidden { display: none !important; }

          .ag-panel { position: static; }
          .ag-panel-body { max-height: none; }
          .ag-cal-celda { min-height: 56px; }
        }
      `}</style>

      <div className="ag-page-header">
        <div className="ag-stats-inline">
          {[
            { label: 'Confirmadas', val: statsGlobal.confirmadas, cls: 'ag-stat-conf' },
            { label: 'Disponibles', val: statsGlobal.disponibles, cls: 'ag-stat-pend' },
            { label: 'Realizadas',  val: statsGlobal.realizadas,  cls: 'ag-stat-real' },
            { label: 'Cancelados',  val: statsGlobal.cancelados,  cls: 'ag-stat-canc' },
            { label: 'Total',       val: statsGlobal.total,       cls: '' },
          ].map(s => (
            <div key={s.label} className={`ag-stat-pill ${s.cls}`}>
              <div className="ag-stat-pill-val">{s.val}</div>
              <div className="ag-stat-pill-label">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="ag-page-subrow">
          <div className="ag-page-sub">
            Gestión de turnos y citas médicas · {MESES[mesVista.mes - 1]} {mesVista.anio}
          </div>
          {puedeModificar && (
            <div className="ag-cal-actions">
              <button className="ag-cal-action-btn ag-cal-action-gen" onClick={abrirGenerar}>
                <CalendarDays size={13} />
                {medicoSel ? 'Generar turnos' : 'Generar para todos'}
              </button>
              <button className="ag-cal-action-btn ag-cal-action-gest" onClick={() => {
                setGestMedico(medicoSel ?? null)
                setGestDesde('')
                setGestHasta('')
                setGestHoraDesde('')
                setGestHoraHasta('')
                setGestResult(null)
                setBusqGest('')
                setBusqGestAbierta(false)
                setMostrarGestionar(true)
              }}>
                <Settings2 size={13} />
                Gestionar
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="ag-mobile-tabs">
        {[['Médicos', 1], ['Calendario', 2], ['Turnos del día', 3]].map(([lbl, tab]) => (
          <button key={tab} className={`ag-mobile-tab${tabMovil === tab ? ' ag-mobile-tab-on' : ''}`}
            onClick={() => setTabMovil(tab)}>
            {lbl}
          </button>
        ))}
      </div>

      <div className="ag-layout">

        <div className={`ag-col-izq${tabMovil !== 1 ? ' ag-mob-hidden' : ''}`}>

          {(esMedico || (esSecretaria && (user?.medicos_asignados?.length ?? 0) <= 1)) ? (
            medicoSel ? (
              <div className="ag-card">
                <div className="ag-card-head">{esMedico ? 'Mi perfil' : 'Médico asignado'}</div>
                <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="ag-avatar" style={{ background: colorMedico(medicoSel.id).bg, color: colorMedico(medicoSel.id).text }}>
                    {inicialesMedico(medicoSel)}
                  </div>
                  <div>
                    <div className="ag-medico-nombre">{nombreMedico(medicoSel)}</div>
                    <div className="ag-medico-esp">{medicoSel.especialidades_detalle?.map(e => e.descripcion).join(', ') || '—'}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="ag-card">
                <div style={{ padding: '20px 14px', color: '#9ca3af', fontSize: '12.5px', textAlign: 'center' }}>
                  {esMedico ? 'Sin prestador asignado' : 'Sin médico asignado'}
                </div>
              </div>
            )
          ) : (
            <div className="ag-card" style={{ flex: 1 }}>
              <div className="ag-card-head">Médicos</div>
              <div className="ag-card-body" style={{ paddingBottom: 0 }}>

                <div className="ag-search-wrap">
                  <Search size={13} className="ag-search-icon" />
                  <input
                    className="ag-search-input"
                    placeholder="Buscar médico..."
                    value={busquedaMedico}
                    onChange={e => setBusquedaMedico(e.target.value)}
                  />
                </div>

                <div className="ag-chips">
                  {[['todos','Todos'],['fecha','Fecha'],['especialidad','Especialidad']].map(([m, lbl]) => (
                    <button key={m} className={`ag-chip${modo === m ? ' ag-chip-on' : ''}`}
                      onClick={() => { setModo(m); if (m !== 'fecha') setFiltroFecha(''); if (m !== 'especialidad') setFiltroEsp('') }}>
                      {lbl}
                    </button>
                  ))}
                </div>

                {modo === 'fecha' && (
                  <input type="date" className="ag-filter-input" value={filtroFecha}
                    onChange={e => setFiltroFecha(e.target.value)} />
                )}

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

              <div className="ag-medico-list" style={{ paddingBottom: 8 }}>
                {medicosFiltrados.length === 0 && (
                  <div style={{ padding: '20px 14px', color: '#9ca3af', fontSize: '12.5px', textAlign: 'center' }}>
                    No se encontraron médicos
                  </div>
                )}
                {medicosFiltrados.map(m => {
                  const col    = colorMedico(m.id)
                  const dot    = colorDot(m.id)
                  const activo = medicoSel?.id === m.id
                  const hoy_str = hoyStr
                  const dispHoy = turnosMes.filter(t =>
                    t.horario_prestador_detalle?.persona_rrhh_id === m.id &&
                    t.fecha === hoy_str &&
                    t.estado === 'disponible'
                  ).length

                  return (
                    <div key={m.id}
                      className={`ag-medico-item${activo ? ' ag-medico-item-on' : ''}`}
                      style={activo ? { borderLeftColor: dot } : {}}
                      onClick={() => { setMedicoSel(activo ? null : m); setFechaSel(null); setTurnoExpandido(null) }}>
                      <div className="ag-avatar" style={{ background: col.bg, color: col.text, border: `2px solid ${dot}` }}>
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
          )}
        </div>

        <div className={`ag-col-cal${tabMovil !== 2 ? ' ag-mob-hidden' : ''}`}>
          <div className="ag-cal-card">
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
              <div className="ag-cal-nav">
                <button className="ag-cal-nav-btn" onClick={irMesAnterior}><ChevronLeft size={14} /></button>
                <span className="ag-cal-mes-label">{MESES[mesVista.mes - 1]} {mesVista.anio}</span>
                <button className="ag-cal-nav-btn" onClick={irMesSiguiente}><ChevronRight size={14} /></button>
              </div>
            </div>

            <div className="ag-cal-grid">
              <div className="ag-cal-dias-header">
                {DIAS_SEMANA.map(d => <div key={d} className="ag-cal-dia-hdr">{d}</div>)}
              </div>

              <div className="ag-cal-celdas">
                {celdas.map((dia, idx) => {
                  if (!dia) return <div key={idx} className="ag-cal-celda" />

                  const fechaStr  = fmtFecha(mesVista.anio, mesVista.mes, dia)
                  const esHoy     = fechaStr === hoyStr
                  const esSel     = fechaStr === fechaSel
                  const turnos    = medicoSel ? (turnosPorFecha[fechaStr] ?? []) : []

                  return (
                    <div
                      key={idx}
                      className={[
                        'ag-cal-celda',
                        'ag-cal-celda-activa',
                        esSel ? 'ag-cal-celda-sel' : '',
                        esHoy ? 'ag-cal-celda-hoy' : '',
                      ].join(' ')}
                      onClick={() => seleccionarDia(dia)}
                    >
                      <div className="ag-cal-num">{dia}</div>
                      {!medicoSel ? (
                        (() => {
                          const rrhhIds = [...(medicosPorDia[fechaStr] ?? new Set())]
                          const stats   = statsPorDia[fechaStr]
                          if (rrhhIds.length === 0 && !stats) return null
                          return (
                            <>
                              {rrhhIds.length > 0 && (
                                <div className="ag-cal-dots">
                                  {rrhhIds.slice(0, 5).map(id => (
                                    <div key={id} className="ag-cal-dot" style={{ background: colorDot(id) }} />
                                  ))}
                                  {rrhhIds.length > 5 && (
                                    <span className="ag-cal-dot-mas">+{rrhhIds.length - 5}</span>
                                  )}
                                </div>
                              )}
                              {stats && (
                                <div className="ag-cal-conteo">
                                  <span className="ag-cal-conteo-ocup">{stats.ocup}</span>
                                  <span className="ag-cal-conteo-libre">{stats.libre}</span>
                                </div>
                              )}
                            </>
                          )
                        })()
                      ) : (
                        <div className="ag-cal-pills">
                          {turnos.slice(0, 2).map(t => {
                            const c = colorEstado(t.estado)
                            const label = t.estado === 'ocupado' && t.paciente_detalle
                              ? t.paciente_detalle.nombre.split(' ')[0]
                              : t.estado === 'disponible' ? `${fmtHora(t.hora_desde)} libre`
                              : t.estado === 'realizado'  ? (t.paciente_detalle?.nombre ? t.paciente_detalle.nombre.split(' ')[0] : 'Realizado')
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
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

          </div>

        </div>

        <Modal
          isOpen={mostrarGenerar}
          onClose={() => {
            if (genHasta) { setConfirmDescartarGen(true) }
            else { setMostrarGenerar(false); setGenResult(null) }
          }}
          title="Generar turnos"
          subtitle={medicoSel ? `Para ${nombreMedico(medicoSel)}` : 'Todos los médicos con horarios activos'}
          size="sm"
        >
          <div className="ag-gen-body" style={{ padding: '16px 0 0' }}>

            <div className="ag-gen-horarios-label">Médicos a incluir</div>
            {medicosParaGenerar.length === 0 ? (
              <div style={{ fontSize: 12.5, color: '#9ca3af', marginBottom: 12 }}>
                Ningún médico tiene horarios activos configurados.
              </div>
            ) : (
              <div style={{ marginBottom: 12 }}>
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

                {(listaGenAbierta || busqGen) && (
                  <>
                    {!busqGen && (
                      <label className="ag-gen-todos">
                        <input
                          type="checkbox"
                          checked={medicosSelGen.size === medicosParaGenerar.length && medicosParaGenerar.length > 0}
                          onChange={toggleTodosGen}
                        />
                        Seleccionar todos ({medicosParaGenerar.length})
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

                {!listaGenAbierta && !busqGen && medicosSelGen.size > 0 && (
                  <div style={{ fontSize: 12, color: '#1a3a5c', fontWeight: 500, marginTop: 4 }}>
                    {medicosSelGen.size} prestador{medicosSelGen.size !== 1 ? 'es' : ''} seleccionado{medicosSelGen.size !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}

            <div className="ag-gen-range">
              <div className="ag-gen-field">
                <div className="ag-gen-label">Desde</div>
                <input type="date" className="ag-gen-input" value={genDesde} max="2099-12-31"
                  onChange={e => { setGenDesde(e.target.value); setGenResult(null) }} />
              </div>
              <div className="ag-gen-field">
                <div className="ag-gen-label">Hasta</div>
                <input type="date" className="ag-gen-input" value={genHasta} max="2099-12-31"
                  onChange={e => { setGenHasta(e.target.value); setGenResult(null) }} />
              </div>
            </div>

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

        <Modal
          isOpen={mostrarGestionar}
          onClose={() => {
            if (gestDesde || gestHasta || gestHoraDesde || gestHoraHasta) { setConfirmDescartarGest(true) }
            else { setMostrarGestionar(false); setGestResult(null); setGestHoraDesde(''); setGestHoraHasta('') }
          }}
          title="Gestionar turnos"
          subtitle="Cancelar turnos disponibles en un rango de fechas y hora"
          size="sm"
        >
          <div style={{ padding: '16px 0 0' }}>

          <ConfirmDialog
            isOpen={confirmGestionar}
            title="Confirmar cancelación masiva"
            description={`Se cancelarán ${gestStats.disponibles} turno${gestStats.disponibles !== 1 ? 's' : ''} disponibles para ${nombreMedico(gestMedico)}${gestHoraDesde || gestHoraHasta ? ` entre ${gestHoraDesde || '00:00'} y ${gestHoraHasta || '23:59'}` : ''} en el rango seleccionado. Esta acción no se puede deshacer.`}
            confirmText="Cancelar turnos"
            onConfirm={async () => { setConfirmGestionar(false); await handleCancelarRango() }}
            onCancel={() => setConfirmGestionar(false)}
            loading={cancelandoRango}
          />

          <div className="ag-gest-warn">
            <span style={{ fontSize: 20, lineHeight: 1 }}>⚠️</span>
            <div>
              <div className="ag-gest-warn-title">Cancelación de turnos disponibles</div>
              <div className="ag-gest-warn-sub">Esta acción no se puede deshacer</div>
            </div>
          </div>
            <div className="ag-gen-horarios-label">Médico</div>
            {(esMedico || (esSecretaria && (user?.medicos_asignados?.length ?? 0) <= 1)) ? (
              <div style={{ fontSize: 13, color: '#111827', fontWeight: 500, marginBottom: 12 }}>
                {nombreMedico(medicoSel)}
              </div>
            ) : gestMedico ? (
              <div className="ag-pac-sel" style={{ marginBottom: 12 }}>
                <span>{nombreMedico(gestMedico)}</span>
                <button className="ag-pac-clear" onClick={() => { setGestMedico(null); setGestResult(null); setBusqGest('') }}>
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div style={{ marginBottom: 12, position: 'relative' }}>
                <div className="ag-pac-search">
                  <Search size={12} className="ag-pac-icon" />
                  <input
                    className="ag-pac-input"
                    placeholder="Buscar médico..."
                    value={busqGest}
                    onChange={e => { setBusqGest(e.target.value); setBusqGestAbierta(true) }}
                    onFocus={() => setBusqGestAbierta(true)}
                    onBlur={() => setTimeout(() => setBusqGestAbierta(false), 150)}
                    autoComplete="off"
                  />
                </div>
                {busqGestAbierta && (
                  <div className="ag-pac-results" style={{ maxHeight: 180 }}>
                    {medicosGestFiltrados.length === 0 ? (
                      <div style={{ padding: '8px 10px', fontSize: 12, color: '#9ca3af' }}>Sin resultados</div>
                    ) : (
                      medicosGestFiltrados.map(m => {
                        const col = colorMedico(m.id)
                        return (
                          <div key={m.id} className="ag-pac-item"
                            onMouseDown={() => { setGestMedico(m); setGestResult(null); setBusqGest(''); setBusqGestAbierta(false) }}>
                            <div className="ag-avatar" style={{ background: col.bg, color: col.text, width: 26, height: 26, fontSize: 10, border: `2px solid ${colorDot(m.id)}` }}>
                              {inicialesMedico(m)}
                            </div>
                            <div>
                              <div className="ag-pac-nombre">{nombreMedico(m)}</div>
                              <div className="ag-pac-doc">{m.especialidades_detalle?.map(e => e.descripcion).join(', ') || m.cargo || '—'}</div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="ag-gen-range">
              <div className="ag-gen-field">
                <div className="ag-gen-label">Fecha desde</div>
                <input type="date" className="ag-gen-input" value={gestDesde} max="2099-12-31"
                  onChange={e => { setGestDesde(e.target.value); setGestResult(null) }} />
              </div>
              <div className="ag-gen-field">
                <div className="ag-gen-label">Fecha hasta</div>
                <input type="date" className="ag-gen-input" value={gestHasta} max="2099-12-31"
                  onChange={e => { setGestHasta(e.target.value); setGestResult(null) }} />
              </div>
            </div>

            <div className="ag-gen-range" style={{ marginTop: 8 }}>
              <div className="ag-gen-field">
                <div className="ag-gen-label">Hora desde <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcional)</span></div>
                <input type="time" className="ag-gen-input" value={gestHoraDesde}
                  onChange={e => { setGestHoraDesde(e.target.value); setGestResult(null) }} />
              </div>
              <div className="ag-gen-field">
                <div className="ag-gen-label">Hora hasta <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcional)</span></div>
                <input type="time" className="ag-gen-input" value={gestHoraHasta}
                  onChange={e => { setGestHoraHasta(e.target.value); setGestResult(null) }} />
              </div>
            </div>

            {gestMedico && gestDesde && gestHasta && (
              cargandoGestion ? (
                <div style={{ fontSize: 12, color: '#9ca3af', margin: '12px 0' }}>Cargando...</div>
              ) : (
                <div className="ag-gen-preview" style={{ margin: '12px 0' }}>
                  <div className="ag-gen-preview-hdr">
                    <span className="ag-gen-preview-title">Resumen del rango</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                    {[
                      { label: 'Disponibles', val: gestStats.disponibles, color: '#16a34a' },
                      { label: 'Ocupados',    val: gestStats.ocupados,    color: '#d97706' },
                      { label: 'Cancelados',  val: gestStats.cancelados,  color: '#dc2626' },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: 10.5, color: '#9ca3af' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}

            {gestResult !== null && (
              <div className="ag-gen-result" style={{ marginBottom: 12 }}>
                <div className="ag-gen-result-ok">
                  <Check size={13} style={{ display: 'inline', marginRight: 5 }} />
                  {gestResult.cancelados} turno{gestResult.cancelados !== 1 ? 's' : ''} cancelado{gestResult.cancelados !== 1 ? 's' : ''}
                </div>
                {gestResult.no_cancelados?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 6 }}>
                      No cancelados ({gestResult.no_cancelados.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                      {gestResult.no_cancelados.map((t, i) => {
                        const esOcupado  = t.estado === 'ocupado'
                        const esReal     = t.estado === 'realizado'
                        const col        = esOcupado ? { bg: '#dbeafe', text: '#2563eb' } : { bg: '#ede9fe', text: '#7c3aed' }
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: '#f8fafc', borderRadius: 6, padding: '5px 8px' }}>
                            <span style={{ fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{t.hora_desde}</span>
                            <span style={{ color: '#6b7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.fecha} {t.paciente ? `· ${t.paciente}` : ''}
                            </span>
                            <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: col.bg, color: col.text, flexShrink: 0 }}>
                              {esOcupado ? 'Con paciente' : 'Realizado'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              className="ag-btn-gen"
              style={{ background: '#dc2626' }}
              disabled={!gestMedico || !gestDesde || !gestHasta || cancelandoRango || gestStats.disponibles === 0}
              onClick={() => setConfirmGestionar(true)}
            >
              {cancelandoRango
                ? <><div className="ag-spin" /> Cancelando...</>
                : `Cancelar ${gestStats.disponibles > 0 ? gestStats.disponibles + ' turno' + (gestStats.disponibles !== 1 ? 's' : '') + ' disponibles' : 'disponibles'}`
              }
            </button>
          </div>
        </Modal>

        <div className={`ag-col-panel${tabMovil !== 3 ? ' ag-mob-hidden' : ''}`}>
          <div className="ag-panel">
            <div className="ag-panel-head">
              <div className="ag-panel-titulo">
                {fechaSel
                  ? (() => {
                      const d = new Date(fechaSel + 'T00:00:00')
                      if (!medicoSel) {
                        const weekday = d.toLocaleDateString('es-PY', { weekday: 'long' }).toUpperCase()
                        const rest    = d.toLocaleDateString('es-PY', { day: 'numeric', month: 'long' })
                        return `${weekday} · ${rest}`
                      }
                      return d.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long' })
                    })()
                  : 'Detalle del día'
                }
              </div>
              <div className="ag-panel-sub">
                {fechaSel && medicoSel
                  ? `${turnosPanelDia.length} turno(s) · ${nombreMedico(medicoSel)}`
                  : fechaSel && !medicoSel
                  ? (() => {
                      const lista = turnosDiaGlob ?? []
                      const conf  = lista.filter(t => t.estado === 'ocupado').length
                      const libre = lista.filter(t => t.estado === 'disponible').length
                      return `${lista.length} turno(s) · ${conf} confirmado(s) · ${libre} libre(s)`
                    })()
                  : 'Hacé clic en un día del calendario'
                }
              </div>
            </div>

            <div className="ag-panel-body">
              {!fechaSel ? (
                <div className="ag-panel-empty">
                  <Calendar size={32} style={{ margin: '0 auto 10px', color: '#d1d5db', display: 'block' }} />
                  <div style={{ fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>Ningún día seleccionado</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    Hacé clic en un día del calendario para ver los turnos disponibles
                  </div>
                </div>
              ) : !medicoSel ? (
                (() => {
                  const lista = [...(turnosDiaGlob ?? [])].sort((a, b) =>
                    (a.hora_desde ?? '').localeCompare(b.hora_desde ?? '')
                  )
                  if (lista.length === 0) return (
                    <div className="ag-panel-empty">Sin turnos para este día</div>
                  )
                  return lista.map(turno => {
                    const medicoId = turno.horario_prestador_detalle?.persona_rrhh_id
                    const medico   = todosLosMedicos.find(m => m.id === medicoId)
                    const dot      = medicoId ? colorDot(medicoId) : '#9ca3af'
                    const colE     = colorEstado(turno.estado)
                    const pacNom   = turno.paciente_detalle?.nombre
                      ?? (turno.estado === 'disponible' ? 'Slot disponible' : turno.estado)
                    const medNom   = medico ? nombreMedico(medico) : (turno.horario_prestador_detalle?.nombre ?? '—')
                    const espNom   = medico?.especialidades_detalle?.[0]?.descripcion ?? ''
                    return (
                      <div key={turno.id} className="ag-turno-glob">
                        <div className="ag-turno-glob-bar" style={{ background: dot }} />
                        <div className="ag-turno-glob-hora">{fmtHora(turno.hora_desde)}</div>
                        <div className="ag-turno-glob-info">
                          <div className="ag-turno-glob-pac">{pacNom}</div>
                          <div className="ag-turno-glob-med">{medNom}{espNom ? ` · ${espNom}` : ''}</div>
                        </div>
                        <span className="ag-turno-badge" style={{ background: colE.bg, color: colE.text, alignSelf: 'center', marginRight: 8 }}>
                          {turno.estado}
                        </span>
                      </div>
                    )
                  })
                })()
              ) : turnosPanelDia.length === 0 ? (
                <div className="ag-panel-empty">Sin turnos para este día</div>
              ) : (
                turnosPanelDia.map(turno => {
                  const col   = colorEstado(turno.estado)
                  const esSel = turnoExpandido === turno.id

                  const labelPaciente = (() => {
                    if (turno.paciente_detalle?.nombre) return turno.paciente_detalle.nombre
                    if (turno.estado === 'disponible') return 'Disponible'
                    if (turno.estado === 'inactivo')   return 'Bloqueado'
                    if (turno.estado === 'cancelado')  return 'Cancelado'
                    if (turno.estado === 'realizado')  return 'Realizado'
                    return '—'
                  })()

                  const BLOQUEOS_CONSULTA = {
                    en_consulta: 'Consulta en curso — finalizá o anulá la consulta desde el módulo de consultas antes de modificar el turno.',
                    finalizada:  'El turno ya fue completado. La consulta está finalizada y no se puede modificar desde la agenda.',
                    anulada:     'El turno tiene una consulta anulada y no se puede modificar desde la agenda.',
                  }
                  const bloqueoConsulta = turno.consulta_estado
                    ? BLOQUEOS_CONSULTA[turno.consulta_estado] ?? null
                    : null

                  const transiciones = bloqueoConsulta ? [] : ({
                    disponible: [
                      { estado: 'inactivo',  label: 'Bloquear',          bg: '#f3f4f6', text: '#6b7280', borde: '#d1d5db', confirmar: true,  icono: 'lock' },
                      { estado: 'cancelado', label: 'Cancelar',           bg: '#fee2e2', text: '#dc2626', borde: '#fca5a5', confirmar: true },
                    ],
                    ocupado: [
                      { estado: 'realizado', label: 'Realizado',          bg: '#f0fdf4', text: '#15803d', borde: '#bbf7d0', confirmar: false },
                      { estado: 'cancelado', label: 'Cancelar y liberar', bg: '#fee2e2', text: '#dc2626', borde: '#fca5a5', confirmar: true },
                    ],
                    inactivo: [
                      { estado: 'disponible', label: 'Activar',           bg: '#dcfce7', text: '#16a34a', borde: '#86efac', confirmar: false },
                      { estado: 'cancelado',  label: 'Cancelar',          bg: '#fee2e2', text: '#dc2626', borde: '#fca5a5', confirmar: true },
                    ],
                    cancelado: [
                      { estado: 'disponible', label: 'Reactivar',         bg: '#dcfce7', text: '#16a34a', borde: '#86efac', confirmar: false },
                    ],
                    realizado: [
                      { estado: 'ocupado', label: 'Revertir a ocupado',   bg: '#dbeafe', text: '#2563eb', borde: '#93c5fd', confirmar: true },
                    ],
                  }[turno.estado] ?? [])

                  return (
                    <div key={turno.id}
                      className={`ag-turno${esSel ? ' ag-turno-sel' : ''}`}>

                      <div
                        className={`ag-turno-head${esSel ? ' ag-turno-head-sel' : ''}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setTurnoExpandido(esSel ? null : turno.id)
                          setBusqPaciente('')
                          setPacienteSel(null)
                          setObservacion('')
                          if (reagendarTurnoId === turno.id) {
                            setReagendarTurnoId(null)
                            setReagendarFecha('')
                            setReagendarSlot(null)
                          }
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
                          {turno.paciente_detalle && (turno.estado === 'ocupado' || turno.estado === 'realizado') && (
                            <div className="ag-ocupado-info">
                              <div className="ag-ocupado-nombre">{turno.paciente_detalle.nombre}</div>
                              <div className="ag-ocupado-doc">Doc: {turno.paciente_detalle.nro_documento ?? '—'}</div>
                              {turno.observacion && (
                                <div className="ag-ocupado-obs">"{turno.observacion}"</div>
                              )}
                            </div>
                          )}

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
                                      onChange={e => { setBusqPaciente(e.target.value); setPacFocusIdx(-1) }}
                                      autoComplete="off"
                                      onKeyDown={e => {
                                        const resultados = resultadosPaciente ?? []
                                        if (!resultados.length || busqPaciente.length < 3) return
                                        if (e.key === 'ArrowDown') {
                                          e.preventDefault()
                                          setPacFocusIdx(prev => {
                                            const next = Math.min(prev + 1, resultados.length - 1)
                                            const el = pacResultsRef.current?.children[next]
                                            el?.scrollIntoView({ block: 'nearest' })
                                            return next
                                          })
                                        } else if (e.key === 'ArrowUp') {
                                          e.preventDefault()
                                          setPacFocusIdx(prev => {
                                            const next = Math.max(prev - 1, 0)
                                            const el = pacResultsRef.current?.children[next]
                                            el?.scrollIntoView({ block: 'nearest' })
                                            return next
                                          })
                                        } else if (e.key === 'Enter' && pacFocusIdx >= 0) {
                                          e.preventDefault()
                                          const p = resultados[pacFocusIdx]
                                          if (p) { setPacienteSel(p); setBusqPaciente(''); setPacFocusIdx(-1) }
                                        } else if (e.key === 'Escape') {
                                          setBusqPaciente(''); setPacFocusIdx(-1)
                                        }
                                      }}
                                    />
                                  </div>
                                  {resultadosPaciente?.length > 0 && busqPaciente.length >= 3 && (
                                    <div className="ag-pac-results" ref={pacResultsRef}>
                                      {resultadosPaciente.map((p, idx) => {
                                        const nombreP = p.nombre ?? p.persona_detalle?.razon_social ?? '—'
                                        const docP    = p.documento ?? p.persona_detalle?.nro_documento ?? ''
                                        const inicial = nombreP.charAt(0).toUpperCase()
                                        return (
                                          <div key={p.id}
                                            className={`ag-pac-item${pacFocusIdx === idx ? ' ag-pac-item-focus' : ''}`}
                                            onClick={() => { setPacienteSel(p); setBusqPaciente(''); setPacFocusIdx(-1) }}>
                                            <div className="ag-pac-avatar">{inicial}</div>
                                            <div>
                                              <div className="ag-pac-nombre">{nombreP}</div>
                                              {docP && <div className="ag-pac-doc">{docP}</div>}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                  {busqPaciente.length >= 3 && !resultadosPaciente?.length && (
                                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Sin resultados</div>
                                  )}
                                  {busqPaciente.length > 0 && busqPaciente.length < 3 && (
                                    <div style={{ fontSize: 11.5, color: '#9ca3af', marginBottom: 6 }}>Ingresá al menos 3 caracteres</div>
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

                          {bloqueoConsulta ? (
                            <div className="ag-bloqueo-consulta">
                              {bloqueoConsulta}
                            </div>
                          ) : transiciones.length > 0 && (
                            <div className="ag-estado-actions">
                              {transiciones.map(tr => (
                                <button
                                  key={tr.estado}
                                  className="ag-estado-chip"
                                  style={{ background: tr.bg, color: tr.text, borderColor: tr.borde, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  onClick={() => {
                                    if (tr.confirmar) {
                                      setConfirmEstado({
                                        turnoId:  turno.id,
                                        estado:   tr.estado,
                                        label:    tr.label,
                                        tieneP:   !!turno.paciente,
                                      })
                                    } else {
                                      cambiarEstado({ id: turno.id, estado: tr.estado })
                                        .then(() => {
                                          showToast(`Estado cambiado a ${tr.estado}.`, 'success')
                                          setTurnoExpandido(null)
                                        })
                                        .catch(err => showToast(extraerMensajeError(err), 'error'))
                                    }
                                  }}
                                >
                                  {tr.icono === 'lock' && <Lock size={10} />}
                                  {tr.label}
                                </button>
                              ))}
                            </div>
                          )}

                          {!bloqueoConsulta && turno.estado === 'ocupado' && (
                            <div className="ag-estado-actions" style={{ borderTop: 'none', paddingTop: 0 }}>
                              <button
                                className="ag-estado-chip"
                                style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#7dd3fc' }}
                                onClick={() => {
                                  setReagendarTurnoId(reagendarTurnoId === turno.id ? null : turno.id)
                                  setReagendarFecha('')
                                  setReagendarSlot(null)
                                }}
                              >
                                {reagendarTurnoId === turno.id ? 'Cancelar reagendado' : 'Reagendar'}
                              </button>
                            </div>
                          )}

                          {reagendarTurnoId === turno.id && (
                            <div className="ag-reagendar">
                              <div className="ag-reagendar-titulo">Seleccioná nueva fecha y turno</div>
                              <input
                                type="date"
                                className="ag-gen-input"
                                style={{ marginBottom: 8 }}
                                value={reagendarFecha}
                                min={hoyStr}
                                onChange={e => { setReagendarFecha(e.target.value); setReagendarSlot(null) }}
                              />
                              {reagendarFecha && (
                                slotsDisponibles.length === 0 ? (
                                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Sin turnos disponibles para esa fecha</div>
                                ) : (
                                  <div className="ag-reagendar-slots">
                                    {slotsDisponibles.map(s => (
                                      <button
                                        key={s.id}
                                        className={`ag-reagendar-slot${reagendarSlot === s.id ? ' ag-reagendar-slot-on' : ''}`}
                                        onClick={() => setReagendarSlot(reagendarSlot === s.id ? null : s.id)}
                                      >
                                        {fmtHora(s.hora_desde)}
                                      </button>
                                    ))}
                                  </div>
                                )
                              )}
                              {reagendarSlot && (
                                <button
                                  className="ag-btn-confirmar"
                                  style={{ marginTop: 8 }}
                                  disabled={reagendando}
                                  onClick={handleReagendar}
                                >
                                  {reagendando
                                    ? <><div className="ag-spin" /> Reagendando...</>
                                    : <><Check size={14} /> Confirmar reagendado</>
                                  }
                                </button>
                              )}
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
