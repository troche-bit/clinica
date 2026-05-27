import { useState, useRef } from 'react'
import { Receipt, Plus, Search, Pencil, Trash2, X, ChevronLeft } from 'lucide-react'
import { useTimbrados, useCreateTimbrado, useUpdateTimbrado, useDeleteTimbrado } from '../../hooks/facturacion/useTimbrado'
import { extraerMensajeError } from '../../utils/errores'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Toast from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../context/AuthContext'

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-PY', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function progresoBarra(item) {
  if (!item) return { pct: 0, color: '#9ca3af' }
  if (item.dias_restantes < 0) return { pct: 100, color: '#dc2626' }
  const inicio = new Date(item.inicio_vigencia + 'T00:00:00').getTime()
  const fin    = new Date(item.fin_vigencia    + 'T00:00:00').getTime()
  const hoy    = Date.now()
  const total  = fin - inicio
  if (total <= 0) return { pct: 100, color: '#dc2626' }
  const pct   = Math.min(100, Math.max(0, ((hoy - inicio) / total) * 100))
  const color = item.dias_restantes > 180 ? '#22c55e'
              : item.dias_restantes >= 60  ? '#f59e0b'
              : '#dc2626'
  return { pct, color }
}

function badgeEstilo(color, vigente) {
  if (!vigente) return { background: '#fee2e2', color: '#991b1b' }
  return color === '#22c55e' ? { background: '#dcfce7', color: '#166534' }
       : color === '#f59e0b' ? { background: '#fef9c3', color: '#854d0e' }
       : { background: '#fee2e2', color: '#991b1b' }
}

function esDuplicado(form, timbrados, excludeId = null) {
  const nroForm    = parseInt(form.nro_timbrado,   10)
  const inicioForm = (form.inicio_vigencia || '').slice(0, 10)
  const finForm    = (form.fin_vigencia    || '').slice(0, 10)
  const sucForm    = parseInt(form.punto_sucursal,   10)
  const expForm    = parseInt(form.punto_expedicion, 10)
  const desdeForm  = parseInt(form.nro_desde, 10)
  const hastaForm  = parseInt(form.nro_hasta, 10)

  return timbrados.some(t => {
    if (t.is_deleted)       return false
    if (t.id === excludeId) return false
    if (parseInt(t.nro_timbrado, 10) !== nroForm) return false

    const inicioT = (t.inicio_vigencia || '').slice(0, 10)
    const finT    = (t.fin_vigencia    || '').slice(0, 10)
    if (inicioT !== inicioForm || finT !== finForm) return false

    return (
      parseInt(t.punto_sucursal,   10) === sucForm   &&
      parseInt(t.punto_expedicion, 10) === expForm   &&
      parseInt(t.nro_desde,        10) === desdeForm &&
      parseInt(t.nro_hasta,        10) === hastaForm
    )
  })
}

const FORM_VACIO = {
  nro_timbrado: '', autoimpresor: false,
  inicio_vigencia: '', fin_vigencia: '',
  punto_sucursal: '', punto_expedicion: '',
  nro_desde: '', nro_hasta: '',
  nro_habilitacion: '',
}

function PanelForm({ modo, item, onGuardar, onCancelar, guardando }) {
  const [form, setForm] = useState(
    modo === 'crear'
      ? FORM_VACIO
      : {
          nro_timbrado:     item.nro_timbrado     || '',
          autoimpresor:     item.autoimpresor      ?? false,
          inicio_vigencia:  item.inicio_vigencia   || '',
          fin_vigencia:     item.fin_vigencia      || '',
          punto_sucursal:   String(item.punto_sucursal   || '').padStart(3, '0'),
          punto_expedicion: String(item.punto_expedicion || '').padStart(3, '0'),
          nro_desde:        item.nro_desde != null ? String(item.nro_desde).padStart(7, '0') : '',
          nro_hasta:        item.nro_hasta != null ? String(item.nro_hasta).padStart(7, '0') : '',
          nro_habilitacion: item.nro_habilitacion  || '',
        }
  )
  const [errores, setErrores] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validar = () => {
    const e = {}
    if (!form.nro_timbrado)               e.nro_timbrado     = 'Requerido'
    if (!/^\d+$/.test(form.nro_timbrado)) e.nro_timbrado     = 'Solo dígitos numéricos'
    if (!form.inicio_vigencia)            e.inicio_vigencia  = 'Requerido'
    if (!form.fin_vigencia)               e.fin_vigencia     = 'Requerido'
    if (form.inicio_vigencia && form.fin_vigencia && form.fin_vigencia <= form.inicio_vigencia)
      e.fin_vigencia = 'Debe ser posterior a la fecha de inicio'
    if (!form.punto_sucursal)             e.punto_sucursal   = 'Requerido'
    if (!form.punto_expedicion)           e.punto_expedicion = 'Requerido'
    if (!form.nro_desde && form.nro_desde !== 0) e.nro_desde = 'Requerido'
    if (!form.nro_hasta && form.nro_hasta !== 0) e.nro_hasta = 'Requerido'
    if (form.nro_desde && form.nro_hasta && Number(form.nro_hasta) <= Number(form.nro_desde))
      e.nro_hasta = 'Debe ser mayor al número desde'
    if (form.autoimpresor && !form.nro_habilitacion)
      e.nro_habilitacion = 'Requerido para autoimpresor'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validar()) return
    onGuardar({
      ...form,
      nro_desde: Number(form.nro_desde),
      nro_hasta: Number(form.nro_hasta),
    })
  }

  return (
    <div className="tim-panel-body">
      <div className="tim-toggle-wrap">
        <button
          type="button"
          className={`tim-toggle-btn ${!form.autoimpresor ? 'active' : ''}`}
          onClick={() => setForm(f => ({ ...f, autoimpresor: false, nro_habilitacion: '' }))}
        >
          Talonario
        </button>
        <button
          type="button"
          className={`tim-toggle-btn ${form.autoimpresor ? 'active' : ''}`}
          onClick={() => set('autoimpresor', true)}
        >
          Autoimpresor
        </button>
      </div>

      <div className="tim-form-group">
        <label className="tim-label">Nro. de timbrado *</label>
        <input
          className={`tim-input tim-mono ${errores.nro_timbrado ? 'tim-input-error' : ''}`}
          maxLength={8}
          placeholder="12345678"
          value={form.nro_timbrado}
          onChange={e => set('nro_timbrado', e.target.value.replace(/\D/g, ''))}
        />
        {errores.nro_timbrado && <span className="tim-error-msg">{errores.nro_timbrado}</span>}
      </div>

      <div className="tim-grid-2">
        <div className="tim-form-group">
          <label className="tim-label">Inicio de vigencia *</label>
          <input
            type="date" className={`tim-input ${errores.inicio_vigencia ? 'tim-input-error' : ''}`}
            value={form.inicio_vigencia}
            onChange={e => set('inicio_vigencia', e.target.value)}
          />
          {errores.inicio_vigencia && <span className="tim-error-msg">{errores.inicio_vigencia}</span>}
        </div>
        <div className="tim-form-group">
          <label className="tim-label">Fin de vigencia *</label>
          <input
            type="date" className={`tim-input ${errores.fin_vigencia ? 'tim-input-error' : ''}`}
            value={form.fin_vigencia}
            onChange={e => set('fin_vigencia', e.target.value)}
          />
          {errores.fin_vigencia && <span className="tim-error-msg">{errores.fin_vigencia}</span>}
        </div>
      </div>

      <div className="tim-grid-2">
        <div className="tim-form-group">
          <label className="tim-label">Punto sucursal *</label>
          <input
            className={`tim-input tim-mono ${errores.punto_sucursal ? 'tim-input-error' : ''}`}
            maxLength={3} placeholder="001"
            value={form.punto_sucursal}
            onChange={e => set('punto_sucursal', e.target.value.replace(/\D/g, ''))}
            onBlur={e => { const v = e.target.value.replace(/\D/g, ''); if (v) set('punto_sucursal', v.padStart(3, '0')) }}
          />
          {errores.punto_sucursal && <span className="tim-error-msg">{errores.punto_sucursal}</span>}
        </div>
        <div className="tim-form-group">
          <label className="tim-label">Punto expedición *</label>
          <input
            className={`tim-input tim-mono ${errores.punto_expedicion ? 'tim-input-error' : ''}`}
            maxLength={3} placeholder="001"
            value={form.punto_expedicion}
            onChange={e => set('punto_expedicion', e.target.value.replace(/\D/g, ''))}
            onBlur={e => { const v = e.target.value.replace(/\D/g, ''); if (v) set('punto_expedicion', v.padStart(3, '0')) }}
          />
          {errores.punto_expedicion && <span className="tim-error-msg">{errores.punto_expedicion}</span>}
        </div>
      </div>

      <div className="tim-grid-2">
        <div className="tim-form-group">
          <label className="tim-label">Nro. desde *</label>
          <input
            className={`tim-input tim-mono ${errores.nro_desde ? 'tim-input-error' : ''}`}
            maxLength={7} placeholder="0000001"
            value={form.nro_desde}
            onChange={e => set('nro_desde', e.target.value.replace(/\D/g, ''))}
            onBlur={e => { const v = e.target.value.replace(/\D/g, ''); if (v) set('nro_desde', v.padStart(7, '0')) }}
          />
          {errores.nro_desde && <span className="tim-error-msg">{errores.nro_desde}</span>}
        </div>
        <div className="tim-form-group">
          <label className="tim-label">Nro. hasta *</label>
          <input
            className={`tim-input tim-mono ${errores.nro_hasta ? 'tim-input-error' : ''}`}
            maxLength={7} placeholder="0000999"
            value={form.nro_hasta}
            onChange={e => set('nro_hasta', e.target.value.replace(/\D/g, ''))}
            onBlur={e => { const v = e.target.value.replace(/\D/g, ''); if (v) set('nro_hasta', v.padStart(7, '0')) }}
          />
          {errores.nro_hasta && <span className="tim-error-msg">{errores.nro_hasta}</span>}
        </div>
      </div>

      <div className="tim-form-group">
        <label className="tim-label">
          Nro. habilitación SET
          {form.autoimpresor
            ? <span className="tim-label-req"> *</span>
            : <span className="tim-label-note"> — solo aplica para autoimpresor</span>}
        </label>
        <input
          className={`tim-input ${errores.nro_habilitacion ? 'tim-input-error' : ''}`}
          placeholder="Número de resolución SET"
          value={form.nro_habilitacion}
          disabled={!form.autoimpresor}
          onChange={e => set('nro_habilitacion', e.target.value)}
        />
        {errores.nro_habilitacion && <span className="tim-error-msg">{errores.nro_habilitacion}</span>}
      </div>

      <div className="tim-panel-acciones">
        <button className="tim-btn-secundario" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button className="tim-btn-primario" onClick={handleSubmit} disabled={guardando}>
          {guardando ? 'Guardando…' : modo === 'crear' ? 'Crear timbrado' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

function PanelVer({ item, onEditar, onEliminar, eliminando }) {
  const { pct, color } = progresoBarra(item)
  const proximo  = item.proximo_numero ?? item.nro_desde
  const pctUsado = item.nro_hasta > item.nro_desde
    ? Math.round(((proximo - item.nro_desde) / (item.nro_hasta - item.nro_desde)) * 100)
    : 0
  const badgeStyle = badgeEstilo(color, item.vigente)

  return (
    <div className="tim-panel-body">
      <div className="tim-detalle-header">
        <div>
          <div className="tim-detalle-nro">{item.nro_timbrado}</div>
          <span className={`tim-badge-tipo ${item.autoimpresor ? 'amber' : 'blue'}`}>{item.tipo}</span>
        </div>
        <span className="tim-badge-estado" style={badgeStyle}>
          {item.vigente ? 'Vigente' : 'Vencido'}
        </span>
      </div>

      <div className="tim-section">
        <div className="tim-section-title">Vigencia</div>
        <div className="tim-vigencia-fechas">
          <span>{formatFecha(item.inicio_vigencia)}</span>
          <span className="tim-dias-rest" style={{ color }}>
            {item.dias_restantes < 0
              ? `Venció hace ${Math.abs(item.dias_restantes)} días`
              : `${item.dias_restantes} días restantes`}
          </span>
          <span>{formatFecha(item.fin_vigencia)}</span>
        </div>
        <div className="tim-progress-track">
          <div className="tim-progress-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <div className="tim-pct-label">{Math.round(pct)}% utilizado</div>
      </div>

      <div className="tim-section">
        <div className="tim-section-title">Punto de emisión</div>
        <div className="tim-grid-2">
          <div className="tim-campo">
            <span className="tim-campo-lbl">Sucursal</span>
            <span className="tim-campo-val tim-mono">{item.punto_sucursal}</span>
          </div>
          <div className="tim-campo">
            <span className="tim-campo-lbl">Expedición</span>
            <span className="tim-campo-val tim-mono">{item.punto_expedicion}</span>
          </div>
        </div>
        <div className="tim-campo">
          <span className="tim-campo-lbl">Formato comprobante</span>
          <span className="tim-campo-val tim-mono">
            {item.punto_sucursal}-{item.punto_expedicion}-XXXXXXX
          </span>
        </div>
      </div>

      <div className="tim-section">
        <div className="tim-section-title">Comprobantes</div>
        <div className="tim-grid-2">
          <div className="tim-campo">
            <span className="tim-campo-lbl">Desde</span>
            <span className="tim-campo-val tim-mono">{item.nro_desde.toLocaleString()}</span>
          </div>
          <div className="tim-campo">
            <span className="tim-campo-lbl">Hasta</span>
            <span className="tim-campo-val tim-mono">{item.nro_hasta.toLocaleString()}</span>
          </div>
        </div>
        <div className="tim-comprobantes-bloque">
          <div className="tim-comp-row">
            <span>Total habilitados</span>
            <span className="tim-mono">{item.total_comprobantes.toLocaleString()}</span>
          </div>
          <div className="tim-comp-row">
            <span>Próximo número</span>
            <span className="tim-proximo-badge">{proximo.toLocaleString()}</span>
          </div>
          <div className="tim-comp-row">
            <span>Disponibles</span>
            <span className="tim-mono">{(item.nro_hasta - proximo + 1).toLocaleString()}</span>
          </div>
          <div style={{ marginTop: 6 }}>
            <div className="tim-progress-track" style={{ height: 4 }}>
              <div className="tim-progress-fill" style={{ width: `${pctUsado}%`, background: '#1a3a5c' }} />
            </div>
            <div className="tim-pct-label" style={{ marginTop: 3 }}>{pctUsado}% utilizado</div>
          </div>
        </div>
      </div>

      {item.nro_habilitacion && (
        <div className="tim-section">
          <div className="tim-section-title">Habilitación SET</div>
          <div className="tim-campo">
            <span className="tim-campo-lbl">Nro. resolución</span>
            <span className="tim-campo-val">{item.nro_habilitacion}</span>
          </div>
        </div>
      )}

      <div className="tim-panel-acciones">
        <button className="tim-btn-danger" onClick={onEliminar} disabled={eliminando}>
          <Trash2 size={14} /> {eliminando ? 'Eliminando…' : 'Eliminar'}
        </button>
        <button className="tim-btn-primario" onClick={onEditar}>
          <Pencil size={14} /> Editar
        </button>
      </div>
    </div>
  )
}

export default function TimbradoPage() {
  const [search,        setSearch]        = useState('')
  const [filtroVigente, setFiltroVigente] = useState('')
  const [seleccionado,  setSeleccionado]  = useState(null)
  const [modo,          setModo]          = useState(null)
  const [guardando,     setGuardando]     = useState(false)
  const [confirmId,     setConfirmId]     = useState(null)
  const debounceRef = useRef(null)

  const { toast, showToast } = useToast()
  const { user } = useAuth()
  const esAdmin = user?.rol === 'admin'

  const { data, isLoading } = useTimbrados({ search, vigente: filtroVigente })
  const crear      = useCreateTimbrado()
  const actualizar = useUpdateTimbrado()
  const eliminar   = useDeleteTimbrado()

  const timbrados = data?.results ?? data ?? []

  const handleSearchChange = e => {
    const val = e.target.value
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearch(val), 300)
  }

  const cerrarPanel = () => { setSeleccionado(null); setModo(null) }
  const abrirCrear  = () => { setSeleccionado(null); setModo('crear') }
  const abrirVer    = (t) => { setSeleccionado(t); setModo('ver') }

  const handleGuardar = async (form) => {
    const excludeId = modo === 'editar' ? seleccionado?.id : null
    if (esDuplicado(form, timbrados, excludeId)) {
      showToast('Ya existe un timbrado con el mismo número, fechas de vigencia y punto de emisión.', 'error')
      return
    }
    setGuardando(true)
    try {
      if (modo === 'crear') {
        await crear.mutateAsync(form)
        showToast('Timbrado creado correctamente.', 'success')
      } else {
        await actualizar.mutateAsync({ id: seleccionado.id, ...form })
        showToast('Timbrado actualizado correctamente.', 'success')
      }
      cerrarPanel()
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminarConfirmado = async () => {
    try {
      await eliminar.mutateAsync(confirmId)
      showToast('Timbrado eliminado.', 'success')
      setConfirmId(null)
      cerrarPanel()
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    }
  }

  return (
    <>
      <style>{`
        .tim-page { display: flex; flex-direction: column; height: 100%; }

        /* ── Header + Toolbar ── */
        .tim-header-area { padding: 20px 24px 14px; }
        .tim-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .tim-title-block { display: flex; align-items: center; gap: 12px; flex: 1 1 auto; min-width: 0; }
        .tim-header-icon { width: 36px; height: 36px; background: #dbeafe; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .tim-page-title { font-size: 20px; font-weight: 600; color: #111827; line-height: 1.2; }
        .tim-page-sub   { font-size: 13px; color: #9ca3af; margin-top: 1px; }
        .tim-search-wrap { position: relative; flex: 1 1 180px; min-width: 140px; }
        .tim-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none; }
        .tim-search-input { width: 100%; padding: 8px 12px 8px 32px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; background: #fff; box-sizing: border-box; }
        .tim-search-input:focus { border-color: #1a3a5c; }
        .tim-search-input::placeholder { color: #d1d5db; }

        .tim-filtro-select { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; background: #fff; flex-shrink: 0; cursor: pointer; }
        .tim-filtro-select:focus { border-color: #1a3a5c; }

        .tim-btn-nuevo { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; border: none; background: #1a3a5c; color: #fff; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
        .tim-btn-nuevo:hover { background: #15304d; }

        /* ── Body ── */
        .tim-body { flex: 1; display: flex; gap: 16px; overflow: hidden; padding: 14px 24px 24px; }

        /* ── Tabla ── */
        .tim-tabla-wrap { flex: 1; overflow-y: auto; overflow-x: auto; border: 1px solid #e8edf2; border-radius: 10px; background: #fff; }
        .tim-tabla { width: 100%; border-collapse: collapse; min-width: 500px; }
        .tim-th { text-align: left; padding: 10px 14px; font-size: 11.5px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .04em; background: #f8fafc; border-bottom: 1px solid #e8edf2; position: sticky; top: 0; white-space: nowrap; }
        .tim-td { padding: 12px 14px; font-size: 13px; color: #374151; vertical-align: middle; border-bottom: 1px solid #f3f4f6; }
        .tim-tr:last-child .tim-td { border-bottom: none; }
        .tim-tr:nth-child(odd)  .tim-td { background: #ffffff; }
        .tim-tr:nth-child(even) .tim-td { background: #f8fafc; }
        .tim-tr:hover .tim-td   { background: #f0f5fb !important; cursor: pointer; }
        .tim-tr.active .tim-td  { background: #eff6ff !important; }

        .tim-mono { font-family: 'Courier New', monospace; }

        .tim-badge-tipo { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 11.5px; font-weight: 500; }
        .tim-badge-tipo.blue  { background: #dbeafe; color: #1e40af; }
        .tim-badge-tipo.amber { background: #fef3c7; color: #92400e; }

        .tim-badge-estado { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 11.5px; font-weight: 600; }

        .tim-prog-wrap { display: flex; flex-direction: column; gap: 3px; min-width: 120px; }
        .tim-prog-track { height: 5px; background: #f3f4f6; border-radius: 10px; overflow: hidden; }
        .tim-prog-fill  { height: 100%; border-radius: 10px; transition: width 0.3s; }
        .tim-prog-label { font-size: 11px; color: #9ca3af; }

        .tim-rango    { font-size: 12px; font-family: 'Courier New', monospace; color: #374151; }
        .tim-pct-usado { font-size: 11px; color: #9ca3af; margin-top: 2px; }
        .tim-punto    { font-size: 12px; font-family: 'Courier New', monospace; }

        .tim-empty   { text-align: center; color: #9ca3af; padding: 48px; font-size: 13.5px; }
        .tim-loading { text-align: center; color: #9ca3af; padding: 48px; font-size: 13px; }

        /* ── Panel lateral ── */
        .tim-panel { width: 340px; flex-shrink: 0; border: 1px solid #e8edf2; border-radius: 10px; background: #fff; display: flex; flex-direction: column; overflow: hidden; }
        .tim-panel-back { display: none; }
        .tim-panel-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #e8edf2; flex-shrink: 0; }
        .tim-panel-titulo { font-size: 14px; font-weight: 600; color: #111827; }
        .tim-panel-cerrar { border: none; background: none; cursor: pointer; color: #9ca3af; padding: 4px; border-radius: 6px; display: flex; }
        .tim-panel-cerrar:hover { color: #374151; }
        .tim-panel-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }

        .tim-detalle-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .tim-detalle-nro { font-family: 'Courier New', monospace; font-size: 22px; font-weight: 700; color: #111827; }

        .tim-section { display: flex; flex-direction: column; gap: 12px; }
        .tim-section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; padding-bottom: 4px; border-bottom: 1px solid #f3f4f6; }

        .tim-vigencia-fechas { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #6b7280; }
        .tim-dias-rest { font-weight: 600; font-size: 12.5px; }
        .tim-progress-track { height: 8px; background: #f3f4f6; border-radius: 10px; overflow: hidden; }
        .tim-progress-fill { height: 100%; border-radius: 10px; transition: width 0.3s; }
        .tim-pct-label { font-size: 12px; color: #6b7280; }

        .tim-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .tim-campo { display: flex; flex-direction: column; gap: 2px; }
        .tim-campo-lbl { font-size: 11px; color: #9ca3af; font-weight: 500; }
        .tim-campo-val { font-size: 13.5px; color: #374151; font-weight: 500; }

        .tim-comprobantes-bloque { background: #f8fafc; border: 1px solid #e8edf2; border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
        .tim-comp-row { display: flex; justify-content: space-between; font-size: 12.5px; color: #374151; }
        .tim-proximo-badge { display: inline-flex; align-items: center; background: #dbeafe; color: #1d4ed8; font-size: 12px; font-weight: 600; font-family: 'Courier New', monospace; padding: 2px 8px; border-radius: 6px; }

        .tim-toggle-wrap { display: flex; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .tim-toggle-btn { flex: 1; padding: 8px; border: none; cursor: pointer; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500; background: #fff; color: #6b7280; transition: background 0.12s; }
        .tim-toggle-btn.active { background: #1a3a5c; color: #fff; }
        .tim-toggle-btn:not(:last-child) { border-right: 1px solid #e5e7eb; }

        .tim-form-group { display: flex; flex-direction: column; gap: 5px; }
        .tim-label { font-size: 12.5px; font-weight: 500; color: #374151; }
        .tim-label-note { font-weight: 400; color: #9ca3af; font-size: 11.5px; }
        .tim-label-req  { color: #dc2626; font-weight: 600; }
        .tim-input { width: 100%; box-sizing: border-box; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; background: #fff; }
        .tim-input:focus { border-color: #1a3a5c; }
        .tim-input:disabled { background: #f9fafb; color: #9ca3af; cursor: default; }
        .tim-input-error { border-color: #fca5a5; }
        .tim-error-msg { font-size: 11.5px; color: #dc2626; }

        .tim-panel-acciones { display: flex; gap: 10px; justify-content: flex-end; padding-top: 4px; margin-top: auto; }
        .tim-btn-primario { display: inline-flex; align-items: center; gap: 5px; padding: 8px 18px; border-radius: 8px; border: none; background: #1a3a5c; color: #fff; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer; transition: background 0.15s; }
        .tim-btn-primario:hover:not(:disabled) { background: #15304d; }
        .tim-btn-primario:disabled { background: #9ca3af; cursor: default; }
        .tim-btn-secundario { padding: 8px 16px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; color: #374151; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer; }
        .tim-btn-secundario:hover { background: #f9fafb; }
        .tim-btn-danger { display: inline-flex; align-items: center; gap: 5px; padding: 8px 14px; border-radius: 8px; border: 1px solid #fecaca; background: #fff; color: #dc2626; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer; transition: background 0.12s; }
        .tim-btn-danger:hover:not(:disabled) { background: #fef2f2; }
        .tim-btn-danger:disabled { opacity: 0.6; cursor: default; }

        /* ── Mobile < 768px ── */
        @keyframes timSlideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @media (max-width: 767px) {
          .tim-header-area { padding: 16px 16px 12px; }
          .tim-body { padding: 12px 16px 16px; flex-direction: column; overflow: visible; }
          .tim-tabla-wrap { flex: none; overflow-x: auto; overflow-y: visible; }
          .tim-col-punto { display: none; }
          .tim-search-wrap { flex: 1 1 100%; }
          .tim-filtro-select { flex: 1 1 100%; }
          .tim-btn-nuevo { flex: 1 1 100%; justify-content: center; }

          .tim-panel {
            position: fixed; inset: 0; z-index: 100;
            width: 100%; border-radius: 0; border: none;
            animation: timSlideIn 0.25s ease;
          }
          .tim-panel-back {
            display: flex; align-items: center;
            padding: 10px 16px; border-bottom: 1px solid #f0f4f8;
            flex-shrink: 0;
          }
          .tim-panel-back-btn {
            display: flex; align-items: center; gap: 4px;
            background: none; border: none; cursor: pointer;
            font-size: 13px; font-weight: 500; color: #1a3a5c;
            font-family: 'DM Sans', sans-serif; padding: 4px 0;
          }
          .tim-panel-cerrar { display: none; }
          .tim-panel-acciones {
            position: sticky; bottom: 0; background: #fff;
            box-shadow: 0 -2px 8px rgba(0,0,0,0.06);
            padding: 12px 16px; margin-top: 0;
          }
        }
      `}</style>

      <div className="tim-page">

        <div className="tim-header-area">
          <div className="tim-toolbar">
            <div className="tim-title-block">
              <div className="tim-header-icon">
                <Receipt size={18} color="#1a3a5c" />
              </div>
              <div>
                <div className="tim-page-title">Timbrado</div>
                <div className="tim-page-sub">Configuración de timbrados SET</div>
              </div>
            </div>
            <div className="tim-search-wrap">
              <Search size={14} className="tim-search-icon" />
              <input
                className="tim-search-input"
                placeholder="Buscar por nro. timbrado…"
                onChange={handleSearchChange}
              />
            </div>
            <select
              className="tim-filtro-select"
              value={filtroVigente}
              onChange={e => setFiltroVigente(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="true">Solo vigentes</option>
              <option value="false">Solo vencidos</option>
            </select>
            {esAdmin && (
              <button className="tim-btn-nuevo" onClick={abrirCrear}>
                <Plus size={15} /> Nuevo timbrado
              </button>
            )}
          </div>
        </div>

        <div className="tim-body">

          <div className="tim-tabla-wrap">
            {isLoading ? (
              <div className="tim-loading">Cargando…</div>
            ) : timbrados.length === 0 ? (
              <div className="tim-empty">No hay timbrados registrados.</div>
            ) : (
              <table className="tim-tabla">
                <thead>
                  <tr>
                    <th className="tim-th">Nro. Timbrado</th>
                    <th className="tim-th">Tipo</th>
                    <th className="tim-th">Vigencia</th>
                    <th className="tim-th">Comprobantes</th>
                    <th className="tim-th tim-col-punto">Punto emisión</th>
                    <th className="tim-th">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {timbrados.map(t => {
                    const { pct, color } = progresoBarra(t)
                    const isSelected = seleccionado?.id === t.id
                    const proximo    = t.proximo_numero ?? t.nro_desde
                    const pctUsado   = t.nro_hasta > t.nro_desde
                      ? Math.round(((proximo - t.nro_desde) / (t.nro_hasta - t.nro_desde)) * 100)
                      : 0
                    const bStyle = badgeEstilo(color, t.vigente)
                    return (
                      <tr
                        key={t.id}
                        className={`tim-tr ${isSelected ? 'active' : ''}`}
                        onClick={() => abrirVer(t)}
                      >
                        <td className="tim-td">
                          <span className="tim-mono" style={{ fontSize: 14, fontWeight: 600 }}>
                            {t.nro_timbrado}
                          </span>
                        </td>
                        <td className="tim-td">
                          <span className={`tim-badge-tipo ${t.autoimpresor ? 'amber' : 'blue'}`}>
                            {t.tipo}
                          </span>
                        </td>
                        <td className="tim-td">
                          <div className="tim-prog-wrap">
                            <div className="tim-prog-track">
                              <div className="tim-prog-fill" style={{ width: `${pct}%`, background: color }} />
                            </div>
                            <div className="tim-prog-label">
                              {formatFecha(t.inicio_vigencia)} → {formatFecha(t.fin_vigencia)}
                            </div>
                          </div>
                        </td>
                        <td className="tim-td">
                          <div className="tim-rango">
                            {t.nro_desde.toLocaleString()} → {t.nro_hasta.toLocaleString()}
                          </div>
                          <div className="tim-pct-usado">({pctUsado}% usado)</div>
                        </td>
                        <td className="tim-td tim-col-punto">
                          <span className="tim-punto">{t.punto_sucursal}-{t.punto_expedicion}</span>
                        </td>
                        <td className="tim-td">
                          <span className="tim-badge-estado" style={bStyle}>
                            {t.vigente ? 'Vigente' : 'Vencido'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {modo && (
            <div className="tim-panel">
              <div className="tim-panel-back">
                <button className="tim-panel-back-btn" onClick={cerrarPanel}>
                  <ChevronLeft size={16} /> Volver
                </button>
              </div>
              <div className="tim-panel-header">
                <div className="tim-panel-titulo">
                  {modo === 'crear' ? 'Nuevo timbrado'
                    : modo === 'editar' ? 'Editar timbrado'
                    : `Timbrado ${seleccionado?.nro_timbrado}`}
                </div>
                <button className="tim-panel-cerrar" onClick={cerrarPanel}>
                  <X size={16} />
                </button>
              </div>

              {(modo === 'crear' || modo === 'editar') ? (
                <PanelForm
                  modo={modo}
                  item={seleccionado}
                  onGuardar={handleGuardar}
                  onCancelar={cerrarPanel}
                  guardando={guardando}
                />
              ) : (
                <PanelVer
                  item={seleccionado}
                  onEditar={esAdmin ? () => setModo('editar') : undefined}
                  onEliminar={esAdmin ? () => setConfirmId(seleccionado.id) : undefined}
                  eliminando={eliminar.isPending}
                />
              )}
            </div>
          )}

        </div>
      </div>

      <ConfirmDialog
        isOpen={!!confirmId}
        title="Eliminar timbrado"
        description="¿Eliminar este timbrado? No se puede eliminar si tiene facturas emitidas."
        onConfirm={handleEliminarConfirmado}
        onCancel={() => setConfirmId(null)}
        loading={eliminar.isPending}
      />

      <Toast toast={toast} />
    </>
  )
}
