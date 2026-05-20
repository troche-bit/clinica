import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, Plus, Pencil, Trash2, ChevronRight, Clock, CalendarDays, AlertTriangle, ChevronLeft, FileText, FileDown } from 'lucide-react'
import apiClient from '../../../api/client'
import { usePersonasRRHH, usePersonaRRHHById } from '../../../hooks/administracion/usePersonaRRHH'
import {
  useHorariosPrestador, useCreateHorario,
  useUpdateHorario, useDeleteHorario, useGenerarTurnos,
} from '../../../hooks/clinica/useHorarioPrestador'
import { useConsultorios } from '../../../hooks/clinica/useConsultorios'
import Toast         from '../../../components/ui/Toast'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { useToast }  from '../../../hooks/useToast'
import { extraerMensajeError } from '../../../utils/errores'
import { useAtajosTeclado } from '../../../hooks/useAtajosTeclado'
import { useAuth } from '../../../context/AuthContext'
import { useNavigationGuard } from '../../../hooks/useNavigationGuard'

const DIAS = [
  { id: 1, abr: 'LUN', desc: 'Lunes' },
  { id: 2, abr: 'MAR', desc: 'Martes' },
  { id: 3, abr: 'MIE', desc: 'Miércoles' },
  { id: 4, abr: 'JUE', desc: 'Jueves' },
  { id: 5, abr: 'VIE', desc: 'Viernes' },
  { id: 6, abr: 'SAB', desc: 'Sábado' },
  { id: 7, abr: 'DOM', desc: 'Domingo' },
]
const INTERVALOS = [
  { value: 15, label: '15 min' },
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
]
const hoy30 = () => {
  const d = new Date(); d.setDate(d.getDate() + 30)
  return d.toLocaleDateString('en-CA')
}
const HORARIO_VACIO = () => ({
  _key:            Math.random(),
  id:              null,
  consultorio:     null,
  dia_semana:      '',
  hora_desde:      '',
  hora_hasta:      '',
  intervalo:       30,
  especialidades:  [],
  estado:          'activo',
  excepcion:       false,
  fecha_excepcion: '',
})

function previsualizarTurnos(horarios, fechaDesde, fechaHasta) {
  if (!fechaDesde || !fechaHasta) return []
  const desde = new Date(fechaDesde + 'T00:00:00')
  const hasta = new Date(fechaHasta + 'T00:00:00')
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
      let minDesde    = hd * 60 + md
      const minHasta  = hh * 60 + mh
      const intervalo = Number(h.intervalo)

      if (esHoy) {
        while (minDesde <= minAhora && minDesde < minHasta) minDesde += intervalo
      }

      const slots = Math.floor((minHasta - minDesde) / intervalo)
      if (slots > 0) {
        resultado.push({
          fecha: fechaStr,
          dia:   DIAS.find(x => x.id === diaSemanaId)?.desc ?? '',
          slots,
        })
      }
    }
  }
  return resultado
}

function TimeInput({ value, onChange, hasError }) {
  const display = value ? String(value).slice(0, 5) : ''
  const handleChange = (e) => {
    const isDelete = e.nativeEvent.inputType?.startsWith('delete')
    let v = e.target.value.replace(/[^0-9:]/g, '')
    if (v.length === 2 && !v.includes(':') && !isDelete) v = v + ':'
    if (v.length > 5) v = v.slice(0, 5)
    onChange(v)
  }
  return (
    <input
      type="text"
      className={`hp-input${hasError ? ' hp-input-err' : ''}`}
      value={display}
      onChange={handleChange}
      placeholder="HH:MM"
      maxLength={5}
      autoComplete="off"
    />
  )
}

function BloqueHorario({ horario, onChange, onEliminar, prestadorEspecialidades, consultorios, errors = {} }) {
  const esExcepcion = horario.excepcion
  const toggleEspecialidad = (id) => {
    const ids  = horario.especialidades.map(Number)
    const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    onChange({ ...horario, especialidades: next })
  }
  return (
    <div className={`hp-bloque${esExcepcion ? ' hp-bloque-exc' : ''}`}>
      <div className="hp-bloque-header">
        <div className="hp-bloque-left">
          <button
            type="button"
            className={`hp-toggle${horario.estado === 'activo' ? ' hp-toggle-on' : ''}`}
            onClick={() => onChange({ ...horario, estado: horario.estado === 'activo' ? 'inactivo' : 'activo' })}
          >
            {horario.estado === 'activo' ? 'Activo' : 'Inactivo'}
          </button>
          <label className="hp-exc-label">
            <input
              type="checkbox"
              checked={horario.excepcion}
              onChange={e => onChange({ ...horario, excepcion: e.target.checked, fecha_excepcion: '', dia_semana: '' })}
            />
            Excepción
          </label>
        </div>
        <button type="button" className="hp-bloque-del" onClick={onEliminar} title="Quitar">
          <Trash2 size={13} />
        </button>
      </div>

      <div className="hp-bloque-fields">
        {!esExcepcion ? (
          <div className="hp-field">
            <label className={`hp-label${errors.dia_semana ? ' hp-label-err' : ''}`}>
              Día *{errors.dia_semana && <span className="hp-field-err-msg"> — {errors.dia_semana}</span>}
            </label>
            <select
              className={`hp-select${errors.dia_semana ? ' hp-input-err' : ''}`}
              value={horario.dia_semana}
              onChange={e => onChange({ ...horario, dia_semana: e.target.value })}
            >
              <option value="">Seleccioná...</option>
              {DIAS.map(d => <option key={d.id} value={d.id}>{d.desc}</option>)}
            </select>
          </div>
        ) : (
          <div className="hp-field">
            <label className={`hp-label${errors.fecha_excepcion ? ' hp-label-err' : ''}`}>
              Fecha puntual *{errors.fecha_excepcion && <span className="hp-field-err-msg"> — {errors.fecha_excepcion}</span>}
            </label>
            <input
              type="date"
              className={`hp-input${errors.fecha_excepcion ? ' hp-input-err' : ''}`}
              value={horario.fecha_excepcion}
              onChange={e => onChange({ ...horario, fecha_excepcion: e.target.value })}
            />
          </div>
        )}

        <div className="hp-field">
          <label className={`hp-label${errors.hora_desde ? ' hp-label-err' : ''}`}>
            Desde *{errors.hora_desde && <span className="hp-field-err-msg"> — {errors.hora_desde}</span>}
          </label>
          <TimeInput
            value={horario.hora_desde}
            onChange={v => onChange({ ...horario, hora_desde: v })}
            hasError={!!errors.hora_desde}
          />
        </div>

        <div className="hp-field">
          <label className={`hp-label${errors.hora_hasta ? ' hp-label-err' : ''}`}>
            Hasta *{errors.hora_hasta && <span className="hp-field-err-msg"> — {errors.hora_hasta}</span>}
          </label>
          <TimeInput
            value={horario.hora_hasta}
            onChange={v => onChange({ ...horario, hora_hasta: v })}
            hasError={!!errors.hora_hasta}
          />
        </div>

        <div className="hp-field hp-field-wide">
          <label className="hp-label">Consultorio</label>
          <select
            className="hp-select"
            value={horario.consultorio ?? ''}
            onChange={e => onChange({ ...horario, consultorio: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Sin consultorio</option>
            {consultorios.map(c => (
              <option key={c.id} value={c.id}>
                {c.nro_consultorio}{c.descripcion ? ` — ${c.descripcion}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="hp-field hp-field-wide">
          <label className="hp-label">Intervalo</label>
          <div className="hp-intervalo-btns">
            {INTERVALOS.map(iv => (
              <button
                key={iv.value}
                type="button"
                className={`hp-intervalo-btn${horario.intervalo === iv.value ? ' hp-intervalo-btn-on' : ''}`}
                onClick={() => onChange({ ...horario, intervalo: iv.value })}
              >
                {iv.label}
              </button>
            ))}
          </div>
        </div>

        <div className="hp-field hp-field-wide">
          <label className="hp-label">Especialidades</label>
          {prestadorEspecialidades.length === 0
            ? <span className="hp-esp-empty">El prestador no tiene especialidades asignadas</span>
            : (
              <div className="hp-esp-checks">
                {prestadorEspecialidades.map(e => {
                  const checked = horario.especialidades.map(Number).includes(Number(e.id))
                  return (
                    <label key={e.id} className={`hp-esp-item${checked ? ' hp-esp-item-on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEspecialidad(Number(e.id))}
                      />
                      {e.descripcion}
                    </label>
                  )
                })}
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}

export default function HorarioPrestadorPage() {
  const [search,       setSearch]       = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const debounceRef = useRef(null)
  const [modo,         setModo]         = useState(null)
  const [bloques,      setBloques]      = useState([])
  const [bloqueIdx,    setBloqueIdx]    = useState(0)
  const [bloqueErrors, setBloqueErrors] = useState({})
  const [guardando,    setGuardando]    = useState(false)
  const [errorPanel,   setErrorPanel]   = useState('')
  const [genDesde,     setGenDesde]     = useState(() => new Date().toLocaleDateString('en-CA'))
  const [genHasta,     setGenHasta]     = useState(hoy30)
  const [genResult,    setGenResult]    = useState(null)
  const [confirmGuardar, setConfirmGuardar] = useState(false)
  const [pendienteGuardar, setPendienteGuardar] = useState(null)
  const [loadingPdf,   setLoadingPdf]   = useState(false)
  const [loadingExcel, setLoadingExcel] = useState(false)

  const { toast, showToast }              = useToast()
  const { user }                          = useAuth()
  const { guardAction, markDirty, markClean } = useNavigationGuard()
  const esMedico              = user?.rol === 'medico'
  const esSecretaria          = user?.rol === 'secretaria_medico'
  const esRestringido         = esMedico || esSecretaria
  const multiMedicoSecretaria = esSecretaria && (user?.medicos_asignados?.length ?? 0) > 1

  const { data: prestadoresData } = usePersonasRRHH({ page: 1, search })
  const prestadores = prestadoresData?.results ?? []

  const { data: consultoriosData } = useConsultorios()
  const consultorios = consultoriosData?.results ?? consultoriosData ?? []

  const { data: horariosData } = useHorariosPrestador()
  const todosHorarios = horariosData?.results ?? horariosData ?? []

  const autoId = esMedico ? user?.persona_rrhh_id : (esSecretaria && !multiMedicoSecretaria) ? user?.medico_asignado_id : null
  const { data: autoData } = usePersonaRRHHById(autoId)

  useEffect(() => {
    if (!autoData || seleccionado) return
    setSeleccionado(autoData)
    setModo('ver')
  }, [autoData])

  useEffect(() => {
    if (modo === 'editar' || modo === 'crear') markDirty()
    else markClean()
  }, [modo])

  useEffect(() => () => markClean(), [])

  const { mutateAsync: crearHorario }  = useCreateHorario()
  const { mutateAsync: updateHorario } = useUpdateHorario()
  const { mutate:      borrarHorario } = useDeleteHorario()
  const { mutateAsync: generarTurnos } = useGenerarTurnos()

  const horariosActuales = useMemo(() =>
    seleccionado
      ? todosHorarios.filter(h => h.persona_rrhh === seleccionado.id)
      : [],
    [todosHorarios, seleccionado]
  )

  const prestadorEspecialidades = seleccionado?.especialidades_detalle ?? []

  const preview = useMemo(() => {
    if (modo !== 'ver' || !genDesde || !genHasta) return []
    return previsualizarTurnos(horariosActuales, genDesde, genHasta)
  }, [horariosActuales, genDesde, genHasta, modo])

  const bloqueActual = bloques[bloqueIdx] ?? null

  const bloqueActualDiaLabel = useMemo(() => {
    if (!bloqueActual) return ''
    if (bloqueActual.excepcion)
      return bloqueActual.fecha_excepcion ? `Excepción ${bloqueActual.fecha_excepcion}` : 'Excepción'
    return DIAS.find(d => String(d.id) === String(bloqueActual.dia_semana))?.desc ?? ''
  }, [bloqueActual])

  const solapamientos = useMemo(() => {
    if (!bloqueActual || bloqueActual.excepcion || !bloqueActual.dia_semana) return []
    const timeRe = /^\d{2}:\d{2}$/
    if (!timeRe.test(bloqueActual.hora_desde) || !timeRe.test(bloqueActual.hora_hasta)) return []
    return bloques.reduce((acc, b, i) => {
      if (i === bloqueIdx || b.excepcion || !b.dia_semana) return acc
      if (String(b.dia_semana) !== String(bloqueActual.dia_semana)) return acc
      if (!timeRe.test(b.hora_desde) || !timeRe.test(b.hora_hasta)) return acc
      if (bloqueActual.hora_desde < b.hora_hasta && bloqueActual.hora_hasta > b.hora_desde)
        acc.push({ desde: b.hora_desde, hasta: b.hora_hasta, idx: i })
      return acc
    }, [])
  }, [bloques, bloqueIdx, bloqueActual])

  const handleSearchChange = (e) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearch(e.target.value), 300)
  }

  const abrirPanel = (prestador, modoInicial) => {
    setSeleccionado(prestador)
    setModo(modoInicial)
    setErrorPanel('')
    setBloqueErrors({})
    setGenResult(null)
    setGenDesde(new Date().toLocaleDateString('en-CA'))
    setGenHasta(hoy30())
    if (modoInicial === 'editar') {
      const hp = todosHorarios.filter(h => h.persona_rrhh === prestador.id)
      setBloques(hp.map(h => ({
        _key:            h.id,
        id:              h.id,
        consultorio:     h.consultorio ?? null,
        dia_semana:      h.dia_semana,
        hora_desde:      String(h.hora_desde ?? '').slice(0, 5),
        hora_hasta:      String(h.hora_hasta ?? '').slice(0, 5),
        intervalo:       h.intervalo,
        especialidades:  h.especialidades ?? [],
        estado:          h.estado,
        excepcion:       h.excepcion,
        fecha_excepcion: h.fecha_excepcion ?? '',
      })))
      setBloqueIdx(0)
    } else if (modoInicial === 'crear') {
      setBloques([HORARIO_VACIO()])
      setBloqueIdx(0)
    }
  }

  const cerrarPanel = () => {
    setSeleccionado(null); setModo(null); setBloques([])
    setBloqueIdx(0); setBloqueErrors({}); setErrorPanel(''); setGenResult(null)
  }

  const agregarBloque = () => {
    setBloques(prev => {
      const next = [...prev, HORARIO_VACIO()]
      setBloqueIdx(next.length - 1)
      return next
    })
    setBloqueErrors({})
  }

  const eliminarBloqueActual = () => {
    setBloques(prev => {
      const next = prev.filter((_, i) => i !== bloqueIdx)
      setBloqueIdx(Math.max(0, Math.min(bloqueIdx, next.length - 1)))
      return next
    })
  }

  const validarBloques = () => {
    const errores = {}
    const timeRe  = /^\d{2}:\d{2}$/
    for (let i = 0; i < bloques.length; i++) {
      const b  = bloques[i]
      const fe = {}
      if (!b.excepcion && !b.dia_semana)      fe.dia_semana      = 'Requerido'
      if (b.excepcion  && !b.fecha_excepcion) fe.fecha_excepcion = 'Requerido'
      if (!b.hora_desde || !timeRe.test(b.hora_desde)) fe.hora_desde = 'Formato HH:MM'
      if (!b.hora_hasta || !timeRe.test(b.hora_hasta)) fe.hora_hasta = 'Formato HH:MM'
      if (!fe.hora_desde && !fe.hora_hasta && b.hora_hasta <= b.hora_desde)
        fe.hora_hasta = 'Debe ser posterior a Desde'
      if (Object.keys(fe).length > 0) errores[i] = fe
    }
    return errores
  }

  const ejecutarGuardar = async (bloquesAGuardar) => {
    setGuardando(true)
    try {
      const originales  = todosHorarios.filter(h => h.persona_rrhh === seleccionado.id)
      const idsOrig     = new Set(originales.map(h => h.id))
      const idsEditados = new Set(bloquesAGuardar.filter(b => b.id).map(b => b.id))

      for (const id of idsOrig) {
        if (!idsEditados.has(id)) {
          await new Promise((res, rej) => borrarHorario(id, { onSuccess: res, onError: rej }))
        }
      }
      for (const b of bloquesAGuardar) {
        const payload = {
          persona_rrhh:    seleccionado.id,
          consultorio:     b.consultorio || null,
          dia_semana:      b.excepcion ? null : Number(b.dia_semana),
          hora_desde:      b.hora_desde,
          hora_hasta:      b.hora_hasta,
          intervalo:       b.intervalo,
          especialidades:  b.especialidades.map(Number),
          estado:          b.estado,
          excepcion:       b.excepcion,
          fecha_excepcion: b.fecha_excepcion || null,
        }
        if (b.id) { await updateHorario({ id: b.id, ...payload }) }
        else      { await crearHorario(payload) }
      }
      showToast('Horarios guardados correctamente.', 'success')
      setModo('ver')
    } catch (err) {
      setErrorPanel(extraerMensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  const handleGuardar = () => {
    setErrorPanel('')
    const errores = validarBloques()
    if (Object.keys(errores).length > 0) {
      setBloqueErrors(errores)
      setBloqueIdx(Number(Object.keys(errores)[0]))
      setErrorPanel('Completá los campos requeridos marcados en rojo.')
      return
    }
    setBloqueErrors({})

    const originales  = todosHorarios.filter(h => h.persona_rrhh === seleccionado.id)
    const idsOrig     = new Set(originales.map(h => h.id))
    const idsEditados = new Set(bloques.filter(b => b.id).map(b => b.id))
    const cantEliminar = [...idsOrig].filter(id => !idsEditados.has(id)).length

    if (cantEliminar > 0) {
      setPendienteGuardar(bloques)
      setConfirmGuardar(true)
    } else {
      ejecutarGuardar(bloques)
    }
  }

  const handleGenerar = async () => {
    if (!genDesde || !genHasta) return
    try {
      let totalCreados = 0, detalleTotal = []
      for (const h of horariosActuales.filter(h => h.estado === 'activo')) {
        const res = await generarTurnos({ id: h.id, fecha_desde: genDesde, fecha_hasta: genHasta })
        totalCreados += res.data.creados
        detalleTotal  = [...detalleTotal, ...res.data.detalle]
      }
      setGenResult({ creados: totalCreados, detalle: detalleTotal })
      showToast(`Generación completada: ${totalCreados} turnos.`, 'success')
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    }
  }

  const handlePdf = async () => {
    setLoadingPdf(true)
    try {
      const params = seleccionado ? `?persona_rrhh=${seleccionado.id}` : ''
      const res = await apiClient.get(`/horario-prestador/reporte-horarios/${params}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch {
      showToast('No se pudo generar el PDF.', 'error')
    } finally {
      setLoadingPdf(false)
    }
  }

  const handleExcel = async () => {
    setLoadingExcel(true)
    try {
      const hoy    = new Date().toLocaleDateString('en-CA').replace(/-/g, '')
      const params = seleccionado ? `?persona_rrhh=${seleccionado.id}` : ''
      const res = await apiClient.get(`/horario-prestador/reporte-horarios-excel/${params}`, { responseType: 'blob' })
      const obj = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const link = document.createElement('a')
      link.href = obj; link.download = `horarios_prestadores_${hoy}.xlsx`; link.click()
      URL.revokeObjectURL(obj)
    } catch {
      showToast('No se pudo generar el Excel.', 'error')
    } finally {
      setLoadingExcel(false)
    }
  }

  const nombre   = (p) => p.nombre ?? p.persona_detalle?.razon_social ?? '—'
  const initials = (p) => nombre(p).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  useAtajosTeclado({
    'F10': { fn: () => { if ((modo === 'editar' || modo === 'crear') && !guardando) handleGuardar() }, soloFueraDeInputs: false },
  })

  const previewTotal = preview.reduce((a, p) => a + p.slots, 0)

  return (
    <>
      <Toast toast={toast} />
      <ConfirmDialog
        isOpen={confirmGuardar}
        title="Eliminar horarios existentes"
        description="Se van a eliminar horarios que ya están guardados. Si tienen turnos activos (disponible u ocupado) la operación fallará en el servidor."
        onConfirm={() => {
          setConfirmGuardar(false)
          ejecutarGuardar(pendienteGuardar)
          setPendienteGuardar(null)
        }}
        onCancel={() => {
          setConfirmGuardar(false)
          setPendienteGuardar(null)
        }}
        loading={guardando}
      />
      <style>{`
        .hp-layout { display: flex; gap: 20px; align-items: flex-start; }
        .hp-layout-medico { display: block; max-width: 520px; }
        .hp-list-col { flex: 1; min-width: 0; }
        .hp-panel-col { width: 440px; flex-shrink: 0; }
        .hp-sin-acceso { text-align: center; padding: 64px 24px; color: #9ca3af; }
        .hp-sin-acceso-title { font-size: 15px; font-weight: 600; color: #6b7280; margin-bottom: 6px; }
        .hp-sin-acceso-sub { font-size: 13px; color: #9ca3af; max-width: 320px; margin: 0 auto; }

        .hp-toolbar {
          display: flex; align-items: flex-start; gap: 12px;
          flex-wrap: wrap; margin-bottom: 20px;
        }
        .hp-title-group { flex: 1; min-width: 0; order: 1; }
        .hp-title    { font-size: 22px; font-weight: 600; color: #1a3a5c; margin-bottom: 2px; }
        .hp-subtitle { font-size: 13px; color: #6b7280; }
        .hp-search-wrap {
          position: relative; flex: 1 1 200px; max-width: 320px; order: 2;
        }
        .hp-search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none; }
        .hp-search-input {
          width: 100%; padding: 9px 12px 9px 34px; box-sizing: border-box;
          border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif;
          color: #111827; background: #fff; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .hp-search-input:focus { border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08); }
        .hp-search-input::placeholder { color: #d1d5db; }
        .hp-report-btns { display: flex; gap: 8px; order: 3; flex-shrink: 0; }
        .hp-btn-pdf {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 8px 14px; background: #dc2626; color: #fff;
          border: none; border-radius: 8px; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background 0.15s;
        }
        .hp-btn-pdf:hover:not(:disabled) { background: #b91c1c; }
        .hp-btn-pdf:disabled { opacity: 0.55; cursor: not-allowed; }
        .hp-btn-excel {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 8px 14px; background: #16a34a; color: #fff;
          border: none; border-radius: 8px; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background 0.15s;
        }
        .hp-btn-excel:hover:not(:disabled) { background: #15803d; }
        .hp-btn-excel:disabled { opacity: 0.55; cursor: not-allowed; }
        @media (max-width: 600px) {
          .hp-title-group { display: none; }
          .hp-search-wrap { order: 4; flex-basis: 100%; max-width: 100%; }
        }

        .hp-table-card { background: #fff; border: 1px solid #e8edf2; border-radius: 12px; overflow: hidden; }
        .hp-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .hp-table thead { background: #f8fafc; border-bottom: 1px solid #e8edf2; }
        .hp-table th { text-align: left; padding: 11px 16px; font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: #9ca3af; white-space: nowrap; }
        .hp-table td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: middle; }
        .hp-table tbody tr:last-child td { border-bottom: none; }
        .hp-table tbody tr:hover { background: #f8fafc; }
        .hp-table tbody tr.hp-row-active { background: #eff6ff; }

        .hp-avatar { width: 32px; height: 32px; border-radius: 50%; background: #dbeafe; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: #1a3a5c; flex-shrink: 0; }
        .hp-nombre-cell { display: flex; align-items: center; gap: 10px; }
        .hp-nombre { font-weight: 500; color: #111827; }
        .hp-cargo  { font-size: 12px; color: #9ca3af; margin-top: 1px; }

        .hp-dias-wrap { display: flex; flex-wrap: wrap; gap: 4px; }
        .hp-dia-pill {
          display: inline-flex; align-items: center; gap: 3px;
          padding: 2px 7px; border-radius: 20px; font-size: 11px; font-weight: 600;
          background: #f0f4f8; color: #374151; border: 1px solid #e8edf2; white-space: nowrap;
        }
        .hp-dia-pill-exc      { background: #fffbeb; color: #92400e; border-color: #fde68a; }
        .hp-dia-pill-inactivo { opacity: 0.45; }

        .hp-actions { display: flex; align-items: center; gap: 6px; }
        .hp-btn-edit, .hp-btn-ver {
          width: 30px; height: 30px; border-radius: 7px; border: 1px solid #e8edf2;
          background: none; cursor: pointer; display: flex; align-items: center;
          justify-content: center; color: #6b7280;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .hp-btn-edit:hover { background: #eff6ff; color: #1a3a5c; border-color: #bfdbfe; }
        .hp-btn-ver:hover  { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }

        .hp-empty { text-align: center; padding: 48px 16px; color: #9ca3af; font-size: 13.5px; }
        .hp-empty-icon { width: 40px; height: 40px; margin: 0 auto 12px; background: #f3f4f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #d1d5db; }
        .hp-empty-title { font-weight: 500; color: #6b7280; margin-bottom: 4px; }

        .hp-panel { background: #fff; border: 1px solid #e8edf2; border-radius: 12px; overflow: hidden; position: sticky; top: 20px; }
        .hp-panel-head { padding: 18px 20px; border-bottom: 1px solid #e8edf2; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .hp-panel-title { font-size: 15px; font-weight: 600; color: #1a3a5c; }
        .hp-panel-sub   { font-size: 12px; color: #6b7280; margin-top: 2px; }
        .hp-panel-close { background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 18px; line-height: 1; padding: 0; }
        .hp-panel-close:hover { color: #374151; }
        .hp-panel-body  { padding: 18px 20px; }

        .hp-ver-dia {
          background: #f8fafc; border: 1px solid #e8edf2;
          border-radius: 6px; padding: 12px; margin-bottom: 8px;
        }
        .hp-ver-dia:last-child { margin-bottom: 0; }
        .hp-ver-dia-titulo { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #9ca3af; margin-bottom: 8px; }
        .hp-ver-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px; padding: 6px 0; font-size: 13px;
          border-bottom: 1px solid #e8edf2;
        }
        .hp-ver-row:last-child { border-bottom: none; padding-bottom: 0; }
        .hp-ver-row-exc { background: #fffbeb; border-radius: 4px; padding: 6px 8px; margin: 2px -4px; border-bottom: none; }
        .hp-ver-tiempo { font-weight: 500; color: #111827; white-space: nowrap; display: flex; align-items: center; gap: 6px; }
        .hp-dur-badge {
          display: inline-flex; align-items: center;
          padding: 1px 7px; border-radius: 12px;
          background: #e0f2fe; color: #0369a1;
          font-size: 11px; font-weight: 600;
        }
        .hp-ver-meta   { font-size: 11.5px; color: #9ca3af; text-align: right; }
        .hp-ver-badge-inactivo { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 10px; background: #f3f4f6; color: #9ca3af; }

        .hp-gen-section { border-top: 1px solid #e8edf2; padding-top: 16px; margin-top: 16px; }
        .hp-gen-title   { font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #9ca3af; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
        .hp-gen-row     { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
        .hp-gen-field   { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .hp-gen-label   { font-size: 11.5px; font-weight: 500; color: #6b7280; }
        .hp-gen-input   {
          width: 100%; box-sizing: border-box;
          padding: 8px 10px; border: 1.5px solid #e5e7eb; border-radius: 8px;
          font-size: 13px; font-family: 'DM Sans', sans-serif; color: #111827; outline: none;
          transition: border-color 0.2s;
        }
        .hp-gen-input:focus { border-color: #1a3a5c; }
        .hp-preview-simple {
          margin-top: 8px; font-size: 12.5px; color: #374151;
          text-align: center; padding: 8px 12px;
          background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 7px;
        }
        .hp-gen-result { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 12px; font-size: 12.5px; color: #166534; margin-bottom: 10px; }

        .hp-bloque { border: 1.5px solid #e8edf2; border-radius: 10px; padding: 14px; background: #f8fafc; }
        .hp-bloque-exc { border-color: #fde68a; background: #fffbeb; }
        .hp-bloque-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 8px; }
        .hp-bloque-left   { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .hp-bloque-del { background: none; border: none; cursor: pointer; color: #dc2626; padding: 4px; border-radius: 6px; display: flex; align-items: center; }
        .hp-bloque-del:hover { background: #fef2f2; }
        .hp-toggle {
          padding: 3px 10px; border-radius: 20px; border: 1.5px solid #e5e7eb;
          font-size: 11px; font-weight: 600; cursor: pointer;
          background: #f3f4f6; color: #6b7280; transition: all 0.15s;
        }
        .hp-toggle-on { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
        .hp-exc-label { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #92400e; cursor: pointer; user-select: none; }
        .hp-exc-label input { cursor: pointer; accent-color: #d97706; }

        .hp-bloque-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .hp-field-wide    { grid-column: 1 / -1; }
        .hp-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .hp-label { font-size: 11.5px; font-weight: 500; color: #6b7280; }
        .hp-label-err { color: #dc2626; }
        .hp-field-err-msg { font-weight: 400; font-size: 10.5px; }

        .hp-input, .hp-select {
          width: 100%; box-sizing: border-box;
          padding: 8px 10px; border: 1.5px solid #e5e7eb; border-radius: 8px;
          font-size: 13px; font-family: 'DM Sans', sans-serif; color: #111827; outline: none;
          background: #fff; transition: border-color 0.2s;
        }
        .hp-input:focus, .hp-select:focus { border-color: #1a3a5c; }
        .hp-input-err { border-color: #fca5a5 !important; background: #fff5f5 !important; }
        .hp-input-err:focus { border-color: #dc2626 !important; }

        .hp-intervalo-btns { display: flex; flex-wrap: wrap; gap: 6px; }
        .hp-intervalo-btn {
          padding: 6px 12px; border: 1.5px solid #e5e7eb; border-radius: 7px;
          background: #fff; font-size: 12.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; color: #374151;
          cursor: pointer; transition: all 0.15s;
        }
        .hp-intervalo-btn:hover { border-color: #93c5fd; background: #eff6ff; color: #1a3a5c; }
        .hp-intervalo-btn-on { background: #dbeafe; border-color: #3b82f6; color: #1a3a5c; font-weight: 600; }

        .hp-solapamiento-warn {
          display: flex; align-items: flex-start; gap: 8px;
          padding: 10px 14px; background: #fffbeb; border: 1px solid #fde68a;
          border-radius: 8px; font-size: 12.5px; color: #92400e; margin-top: 10px;
        }

        .hp-esp-empty { font-size: 12px; color: #9ca3af; font-style: italic; }
        .hp-esp-checks {
          display: flex; flex-wrap: wrap; gap: 6px;
          padding: 8px; background: #fff; border: 1.5px solid #e5e7eb;
          border-radius: 8px; min-height: 38px;
        }
        .hp-esp-item {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 20px; border: 1.5px solid #e5e7eb;
          background: #f8fafc; font-size: 12px; color: #374151;
          cursor: pointer; user-select: none; transition: all 0.15s;
        }
        .hp-esp-item input { cursor: pointer; accent-color: #1a3a5c; margin: 0; }
        .hp-esp-item:hover { border-color: #bfdbfe; background: #eff6ff; }
        .hp-esp-item-on { background: #dbeafe; border-color: #93c5fd; color: #1a3a5c; font-weight: 500; }

        .hp-nav {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 12px; background: #f8fafc; border: 1px solid #e8edf2;
          border-radius: 9px; padding: 8px 12px;
        }
        .hp-nav-btn {
          display: flex; align-items: center; gap: 3px;
          padding: 5px 12px; border: 1.5px solid #e5e7eb; border-radius: 7px;
          background: #fff; font-size: 12.5px; font-family: 'DM Sans', sans-serif;
          color: #374151; cursor: pointer; transition: all 0.15s;
        }
        .hp-nav-btn:hover:not(:disabled) { background: #eff6ff; border-color: #bfdbfe; color: #1a3a5c; }
        .hp-nav-btn:disabled { opacity: 0.35; cursor: default; }
        .hp-nav-counter { font-size: 12.5px; font-weight: 600; color: #374151; display: flex; align-items: center; gap: 5px; }
        .hp-nav-dot { width: 6px; height: 6px; border-radius: 50%; background: #d1d5db; flex-shrink: 0; cursor: pointer; }
        .hp-nav-dot-err { background: #dc2626; }

        .hp-panel-footer { padding: 14px 20px; border-top: 1px solid #e8edf2; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .hp-btn-agregar {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 7px 14px; border: 1.5px dashed #d1d5db; border-radius: 8px;
          background: transparent; color: #6b7280; font-size: 13px;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.15s;
        }
        .hp-btn-agregar:hover { border-color: #1a3a5c; color: #1a3a5c; background: #f0f4f8; }
        .hp-panel-btns { display: flex; gap: 8px; }
        .hp-btn-cancel {
          padding: 8px 16px; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif;
          border: 1.5px solid #e5e7eb; border-radius: 8px; background: #fff;
          color: #6b7280; cursor: pointer; transition: background 0.15s;
        }
        .hp-btn-cancel:hover { background: #f9fafb; }
        .hp-btn-save {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 18px; background: #1a3a5c; color: #fff;
          border: none; border-radius: 8px; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background 0.15s;
        }
        .hp-btn-save:hover:not(:disabled) { background: #15304d; }
        .hp-btn-save:disabled { opacity: 0.55; cursor: not-allowed; }
        .hp-btn-editar {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; background: #f8fafc; color: #374151;
          border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background 0.15s;
        }
        .hp-btn-editar:hover { background: #eff6ff; border-color: #bfdbfe; color: #1a3a5c; }
        .hp-btn-generar {
          width: 100%; padding: 9px; background: #1a3a5c; color: #fff;
          border: none; border-radius: 8px; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .hp-btn-generar:hover:not(:disabled) { background: #15304d; }
        .hp-btn-generar:disabled { opacity: 0.55; cursor: not-allowed; }

        .hp-error { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; font-size: 13px; color: #dc2626; margin-bottom: 12px; }

        @keyframes hp-spin { to { transform: rotate(360deg); } }
        .hp-spin { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: hp-spin 0.7s linear infinite; flex-shrink: 0; }

        .hp-mobile-back { display: none; }
        @keyframes hp-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @media (max-width: 767px) {
          .hp-layout { display: block; }
          .hp-panel-col {
            position: fixed; inset: 0; z-index: 100; width: 100%;
            animation: hp-slide-in 0.25s ease;
          }
          .hp-panel { height: 100%; display: flex; flex-direction: column; border-radius: 0; border: none; overflow: hidden; }
          .hp-panel-body { flex: 1; overflow-y: auto; }
          .hp-panel-footer { position: sticky; bottom: 0; background: #fff; box-shadow: 0 -2px 8px rgba(0,0,0,0.06); }
          .hp-panel-close { display: none; }
          .hp-mobile-back {
            display: flex; align-items: center;
            padding: 10px 16px; border-bottom: 1px solid #e8edf2; flex-shrink: 0;
          }
          .hp-mobile-back-btn {
            display: flex; align-items: center; gap: 4px;
            background: none; border: none; cursor: pointer;
            font-size: 13px; font-weight: 500; color: #1a3a5c;
            font-family: 'DM Sans', sans-serif; padding: 4px 0;
          }
          .hp-nav-btn { padding: 8px 14px; font-size: 13px; }
          .hp-intervalo-btns { display: grid; grid-template-columns: repeat(2, 1fr); }
          .hp-intervalo-btn { text-align: center; justify-content: center; }
        }
      `}</style>

      <div className="hp-toolbar">
        <div className="hp-title-group">
          <div className="hp-title">Horarios de Prestadores</div>
          <div className="hp-subtitle">Configuración de horarios de atención</div>
        </div>
        {(!esRestringido || multiMedicoSecretaria) && (
          <div className="hp-search-wrap">
            <Search size={15} className="hp-search-icon" />
            <input
              type="text"
              placeholder="Buscar prestador..."
              onChange={handleSearchChange}
              className="hp-search-input"
            />
          </div>
        )}
        {!esRestringido && (
          <div className="hp-report-btns">
            <button className="hp-btn-pdf" onClick={handlePdf} disabled={loadingPdf}>
              <FileText size={14} /> {loadingPdf ? 'Generando...' : 'PDF'}
            </button>
            <button className="hp-btn-excel" onClick={handleExcel} disabled={loadingExcel}>
              <FileDown size={14} /> {loadingExcel ? 'Generando...' : 'Excel'}
            </button>
          </div>
        )}
      </div>

      {esMedico && !user?.persona_rrhh_id && (
        <div className="hp-sin-acceso">
          <CalendarDays size={36} style={{ color: '#d1d5db', marginBottom: 12 }} />
          <div className="hp-sin-acceso-title">Sin prestador asignado</div>
          <div className="hp-sin-acceso-sub">Tu usuario no tiene un prestador vinculado. Consultá con el administrador del sistema.</div>
        </div>
      )}

      {esSecretaria && !user?.medico_asignado_id && (
        <div className="hp-sin-acceso">
          <CalendarDays size={36} style={{ color: '#d1d5db', marginBottom: 12 }} />
          <div className="hp-sin-acceso-title">Sin médico asignado</div>
          <div className="hp-sin-acceso-sub">Tu usuario no tiene un médico asignado. Consultá con el administrador del sistema.</div>
        </div>
      )}

      <div className={`hp-layout${(esRestringido && !multiMedicoSecretaria) ? ' hp-layout-medico' : ''}`}>
        {(!esRestringido || multiMedicoSecretaria) && (
        <div className="hp-list-col">
          <div className="hp-table-card">
            <table className="hp-table">
              <thead>
                <tr>
                  <th>Prestador</th>
                  <th>Horarios configurados</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {prestadores.length === 0 && (
                  <tr><td colSpan={3}>
                    <div className="hp-empty">
                      <div className="hp-empty-icon"><CalendarDays size={18} /></div>
                      <div className="hp-empty-title">No se encontraron prestadores</div>
                    </div>
                  </td></tr>
                )}
                {prestadores.map(p => {
                  const hps    = todosHorarios.filter(h => h.persona_rrhh === p.id)
                  const activo = seleccionado?.id === p.id
                  return (
                    <tr key={p.id} className={activo ? 'hp-row-active' : ''}
                      style={{ cursor: 'pointer' }} onClick={() => guardAction(() => abrirPanel(p, 'ver'))}>
                      <td>
                        <div className="hp-nombre-cell">
                          <div className="hp-avatar">{initials(p)}</div>
                          <div>
                            <div className="hp-nombre">{nombre(p)}</div>
                            <div className="hp-cargo">
                              {p.especialidades_detalle?.map(e => e.descripcion).join(', ') || p.cargo || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="hp-dias-wrap">
                          {hps.length === 0
                            ? <span style={{ fontSize: '12px', color: '#d1d5db' }}>Sin horarios</span>
                            : hps.map(h => {
                                const abr   = h.dia_semana_detalle?.abreviatura ?? '?'
                                const desde = String(h.hora_desde ?? '').slice(0, 5)
                                const hasta = String(h.hora_hasta ?? '').slice(0, 5)
                                return (
                                  <span key={h.id}
                                    className={`hp-dia-pill${h.excepcion ? ' hp-dia-pill-exc' : ''}${h.estado === 'inactivo' ? ' hp-dia-pill-inactivo' : ''}`}>
                                    {h.excepcion && <AlertTriangle size={9} />}
                                    {abr} {desde}–{hasta}
                                  </span>
                                )
                              })
                          }
                        </div>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="hp-actions">
                          <button className="hp-btn-ver"
                            onClick={() => guardAction(() => abrirPanel(p, 'ver'))} title="Ver horarios">
                            <ChevronRight size={14} />
                          </button>
                          <button className="hp-btn-edit"
                            onClick={() => guardAction(() => abrirPanel(p, 'editar'))} title="Editar horarios">
                            <Pencil size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {seleccionado && modo && (
          <div className="hp-panel-col">
            <div className="hp-panel">
              {(!esRestringido || multiMedicoSecretaria) && (
                <div className="hp-mobile-back">
                  <button className="hp-mobile-back-btn" onClick={() => guardAction(cerrarPanel)}>
                    <ChevronLeft size={16} /> Volver
                  </button>
                </div>
              )}
              <div className="hp-panel-head">
                <div>
                  <div className="hp-panel-title">
                    {modo === 'ver'    ? nombre(seleccionado) : ''}
                    {modo === 'editar' ? 'Editar horarios'    : ''}
                    {modo === 'crear'  ? 'Nuevo horario'      : ''}
                  </div>
                  <div className="hp-panel-sub">
                    {modo === 'ver'
                      ? `${horariosActuales.length} horario(s) configurado(s)`
                      : nombre(seleccionado)
                    }
                  </div>
                </div>
                {(!esRestringido || multiMedicoSecretaria) && (
                  <button className="hp-panel-close" onClick={() => guardAction(cerrarPanel)}>×</button>
                )}
              </div>

              <div className="hp-panel-body">
                {modo === 'ver' && (
                  <>
                    {horariosActuales.length === 0
                      ? <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '24px 0' }}>
                          Sin horarios configurados
                        </div>
                      : DIAS.map(dia => {
                          const hs = horariosActuales.filter(h => h.dia_semana === dia.id)
                          if (hs.length === 0) return null
                          return (
                            <div key={dia.id} className="hp-ver-dia">
                              <div className="hp-ver-dia-titulo">{dia.desc}</div>
                              {hs.map(h => (
                                <div key={h.id} className={`hp-ver-row${h.excepcion ? ' hp-ver-row-exc' : ''}`}>
                                  <span className="hp-ver-tiempo">
                                    {String(h.hora_desde ?? '').slice(0, 5)} — {String(h.hora_hasta ?? '').slice(0, 5)}
                                    {h.estado === 'inactivo' && <span className="hp-ver-badge-inactivo">INACTIVO</span>}
                                    <span className="hp-dur-badge">{h.intervalo} min</span>
                                  </span>
                                  <span className="hp-ver-meta">
                                    {h.excepcion && h.fecha_excepcion && `${h.fecha_excepcion} · `}
                                    {h.consultorio_detalle?.nro_consultorio && (
                                      <span>Cons. {h.consultorio_detalle.nro_consultorio} · </span>
                                    )}
                                    {h.especialidades_detalle?.length > 0
                                      ? h.especialidades_detalle.map(e => e.descripcion).join(', ')
                                      : '—'
                                    }
                                  </span>
                                </div>
                              ))}
                            </div>
                          )
                        })
                    }

                    <div className="hp-gen-section">
                      <div className="hp-gen-title"><Clock size={13} /> Generar turnos</div>
                      <div className="hp-gen-row">
                        <div className="hp-gen-field">
                          <label className="hp-gen-label">Desde</label>
                          <input type="date" className="hp-gen-input"
                            value={genDesde} onChange={e => { setGenDesde(e.target.value); setGenResult(null) }} />
                        </div>
                        <div className="hp-gen-field">
                          <label className="hp-gen-label">Hasta</label>
                          <input type="date" className="hp-gen-input"
                            value={genHasta} onChange={e => { setGenHasta(e.target.value); setGenResult(null) }} />
                        </div>
                      </div>

                      {genResult && (
                        <div className="hp-gen-result">
                          <strong>Resultado:</strong> {genResult.creados} turno(s) creados
                          {genResult.detalle?.map((d, i) => (
                            <div key={i} style={{ marginTop: 4 }}>{d.fecha} · {d.dia}: {d.turnos_creados} turno(s)</div>
                          ))}
                        </div>
                      )}

                      <button className="hp-btn-generar"
                        disabled={!genDesde || !genHasta || horariosActuales.length === 0}
                        onClick={handleGenerar}>
                        <CalendarDays size={14} /> Confirmar generación
                      </button>

                      {!genResult && previewTotal > 0 && (
                        <div className="hp-preview-simple">
                          Se generarán <strong>{previewTotal}</strong> turno(s) entre {genDesde} y {genHasta}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {(modo === 'editar' || modo === 'crear') && (
                  <>
                    {errorPanel && (
                      <div className="hp-error">
                        <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                        {errorPanel}
                      </div>
                    )}

                    {bloques.length > 0 && (
                      <div className="hp-nav">
                        <button className="hp-nav-btn"
                          onClick={() => setBloqueIdx(i => Math.max(0, i - 1))}
                          disabled={bloqueIdx === 0}>
                          <ChevronLeft size={13} /> Anterior
                        </button>
                        <span className="hp-nav-counter">
                          {bloques.map((_, i) => (
                            <span key={i}
                              className={`hp-nav-dot${bloqueErrors[i] ? ' hp-nav-dot-err' : ''}`}
                              style={i === bloqueIdx ? { background: '#1a3a5c', width: 8, height: 8 } : {}}
                              onClick={() => setBloqueIdx(i)}
                              title={`Horario ${i + 1}${bloqueErrors[i] ? ' — tiene errores' : ''}`}
                            />
                          ))}
                          <span style={{ marginLeft: 4 }}>
                            {bloqueIdx + 1} / {bloques.length}
                            {bloqueActualDiaLabel && (
                              <span style={{ color: '#6b7280', fontWeight: 400 }}> — {bloqueActualDiaLabel}</span>
                            )}
                          </span>
                        </span>
                        <button className="hp-nav-btn"
                          onClick={() => setBloqueIdx(i => Math.min(bloques.length - 1, i + 1))}
                          disabled={bloqueIdx >= bloques.length - 1}>
                          Siguiente <ChevronRight size={13} />
                        </button>
                      </div>
                    )}

                    {bloques.length === 0
                      ? <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '24px 0' }}>
                          No hay horarios. Usá el botón de abajo para agregar uno.
                        </div>
                      : bloqueActual && (
                          <>
                            <BloqueHorario
                              key={bloqueActual._key}
                              horario={bloqueActual}
                              errors={bloqueErrors[bloqueIdx] ?? {}}
                              prestadorEspecialidades={prestadorEspecialidades}
                              consultorios={consultorios}
                              onChange={updated =>
                                setBloques(prev => prev.map((x, i) => i === bloqueIdx ? updated : x))
                              }
                              onEliminar={eliminarBloqueActual}
                            />
                            {solapamientos.length > 0 && (
                              <div className="hp-solapamiento-warn">
                                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                                <span>
                                  Este horario se superpone con{' '}
                                  {solapamientos.map((s, i) => (
                                    <span key={i}>{i > 0 ? ', ' : ''}<strong>{s.desde}–{s.hasta}</strong></span>
                                  ))}
                                </span>
                              </div>
                            )}
                          </>
                        )
                    }
                  </>
                )}
              </div>

              {modo === 'ver' && (
                <div className="hp-panel-footer">
                  <span />
                  <button className="hp-btn-editar" onClick={() => guardAction(() => abrirPanel(seleccionado, 'editar'))}>
                    <Pencil size={13} /> Editar horarios
                  </button>
                </div>
              )}
              {(modo === 'editar' || modo === 'crear') && (
                <div className="hp-panel-footer">
                  <button className="hp-btn-agregar" onClick={agregarBloque}>
                    <Plus size={13} /> Agregar horario
                  </button>
                  <div className="hp-panel-btns">
                    <button className="hp-btn-cancel" onClick={() => guardAction(() => setModo('ver'))}>Cancelar</button>
                    <button className="hp-btn-save" onClick={handleGuardar} disabled={guardando}>
                      {guardando ? <><div className="hp-spin" /> Guardando...</> : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
