import { useState, useRef } from 'react'
import {
  Shield, Activity, FileText, DollarSign, Mail, Settings,
  Download, Eye, Plus, Pencil, Trash2, ChevronDown,
  ChevronFirst, ChevronLast, ChevronLeft, ChevronRight,
} from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Toast from '../../components/ui/Toast'
import { useAuditoria, exportarAuditoriaExcel } from '../../hooks/administracion/useAuditoria'
import { useUsuarios } from '../../hooks/administracion/useUsuarios'
import { useToast } from '../../hooks/useToast'
import { extraerMensajeError } from '../../utils/errores'

const MODULOS_OPTS = ['Administración', 'Clínica', 'Facturación', 'Finanzas', 'Notificaciones', 'Mantenimiento']

const CAMPO_LABELS = {
  // BaseModel — campos comunes a todos los modelos
  id:                   'ID',
  id_usu_creator:       'Creado por',
  id_usu_modificator:   'Modificado por',
  fecha_creacion:       'Fecha de creación',
  fecha_modificacion:   'Fecha de modificación',
  fecha_eliminacion:    'Fecha de eliminación',
  is_deleted:           'Eliminado',
  // Persona
  nro_documento:        'N° documento',
  razon_social:         'Nombre / Razón social',
  fecha_nacimiento:     'Fecha de nacimiento',
  tipo_documento:       'Tipo de documento',
  sexo:                 'Sexo',
  telefono:             'Teléfono',
  email:                'E-mail',
  ciudad:               'Ciudad',
  pais:                 'País',
  departamento:         'Departamento',
  // Campos frecuentes
  fecha:                'Fecha',
  fecha_pago:           'Fecha de pago',
  fecha_vencimiento:    'Fecha de vencimiento',
  fecha_desde:          'Fecha desde',
  fecha_hasta:          'Fecha hasta',
  estado:               'Estado',
  activo:               'Activo',
  descripcion:          'Descripción',
  nombre:               'Nombre',
  observacion:          'Observación',
  observaciones:        'Observaciones',
  persona:              'Persona',
  persona_rrhh:         'Prestador',
  paciente:             'Paciente',
  medico:               'Médico',
  // Finanzas
  monto:                'Monto',
  monto_total:          'Monto total',
  monto_hora:           'Monto por hora',
  total_hora:           'Total horas',
  monto_ingreso:        'Ingreso',
  monto_egreso:         'Egreso',
  saldo:                'Saldo',
  vuelto:               'Vuelto',
  comprobante_nro:      'N° comprobante',
  nro_comprobante:      'N° comprobante',
  forma_pago:           'Forma de pago',
  cta:                  'Cuenta',
  cta_cobrar:           'Cuota',
  voucher:              'Voucher',
  condicion_vta:        'Contado',
  // Facturación
  timbrado:             'Timbrado',
  establecimiento:      'Establecimiento',
  expedicion:           'Expedición',
  is_anulado:           'Anulado',
  // Agenda / Clínica
  hora_desde:           'Hora desde',
  hora_hasta:           'Hora hasta',
  dia_semana:           'Día',
  consultorio:          'Consultorio',
  especialidad:         'Especialidad',
  cargo:                'Cargo',
  matricula:            'Matrícula',
  // Stock
  precio:               'Precio',
  grupo:                'Grupo',
  codigo:               'Código',
  unidad:               'Unidad',
  impuesto:             'Impuesto',
}

function labelCampo(key) {
  if (CAMPO_LABELS[key]) return CAMPO_LABELS[key]
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
const ACCIONES_OPTS = ['CREAR', 'EDITAR', 'ELIMINAR', 'VER', 'ENVIO_EMAIL']
const ACCION_LABELS = { CREAR: 'Crear', EDITAR: 'Editar', ELIMINAR: 'Eliminar', VER: 'Ver', ENVIO_EMAIL: 'Email' }

const MODULO_ICON = {
  'Administración': Shield,
  'Clínica':        Activity,
  'Facturación':    FileText,
  'Finanzas':       DollarSign,
  'Notificaciones': Mail,
  'Mantenimiento':  Settings,
}

const ACCION_CFG = {
  CREAR:       { cls: 'badge-success',     Icon: Plus   },
  EDITAR:      { cls: 'badge-info',        Icon: Pencil },
  ELIMINAR:    { cls: 'badge-danger',      Icon: Trash2 },
  VER:         { cls: 'badge-gray',        Icon: Eye    },
  ENVIO_EMAIL: { cls: 'aud-badge-email',   Icon: Mail   },
}

const FILTROS_INIT = { modulo: '', accion: '', usuario: '', fecha_desde: '', fecha_hasta: '' }

function fmt(iso) {
  if (!iso) return ['', '']
  const d = new Date(iso)
  return [
    d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }),
  ]
}

function BadgeAccion({ accion }) {
  const cfg  = ACCION_CFG[accion] || ACCION_CFG.VER
  const Icon = cfg.Icon
  return (
    <span className={`badge ${cfg.cls} aud-badge-accion`}>
      <Icon size={11} />{ACCION_LABELS[accion] || accion}
    </span>
  )
}

function ModuloCell({ modulo }) {
  const Icon = MODULO_ICON[modulo] || Settings
  return (
    <span className="aud-modulo-cell">
      <Icon size={14} color="#6b7280" />{modulo}
    </span>
  )
}

function tieneDetalle(reg) {
  return Boolean(reg.datos_antes || reg.datos_despues || reg.accion === 'ENVIO_EMAIL')
}

function getCambios(reg) {
  switch (reg.accion) {
    case 'CREAR':       return { tipo: 'crear',   datos: reg.datos_despues }
    case 'EDITAR':      return { tipo: 'editar',  antes: reg.datos_antes, despues: reg.datos_despues }
    case 'ELIMINAR':    return { tipo: 'eliminar', datos: reg.datos_antes }
    case 'ENVIO_EMAIL': return { tipo: 'email',   datos: reg.datos_despues }
    case 'VER':         return { tipo: 'ver' }
    default:            return null
  }
}

const CAMPOS_OCULTOS = new Set(['is_deleted', 'fecha_eliminacion'])

function CampoRow({ fieldKey, label: labelOverride, value }) {
  const label = labelOverride ?? labelCampo(fieldKey ?? '')
  const display = value === null || value === undefined
    ? <em className="aud-null">—</em>
    : typeof value === 'boolean'
      ? <span className={`aud-bool ${value ? 'aud-bool-true' : 'aud-bool-false'}`}>{value ? 'Sí' : 'No'}</span>
      : String(value)
  return (
    <div className="aud-det-row">
      <span className="aud-det-label">{label}</span>
      <span className="aud-det-value">{display}</span>
    </div>
  )
}

function DatosBox({ datos, bgColor, borderColor }) {
  if (!datos) return <p className="aud-det-empty">Sin detalle disponible</p>
  const entries = Object.entries(datos).filter(([k]) => !CAMPOS_OCULTOS.has(k))
  return (
    <div className="aud-datos-box" style={{ background: bgColor, borderColor }}>
      {entries.map(([k, v]) => <CampoRow key={k} fieldKey={k} value={v} />)}
    </div>
  )
}

function DetalleContenido({ reg }) {
  const cambios = getCambios(reg)
  if (!cambios) return <p className="aud-det-empty">Sin información de detalle disponible</p>

  if (cambios.tipo === 'crear') return (
    <>
      <p className="aud-det-section-title">Datos registrados</p>
      <DatosBox datos={cambios.datos} bgColor="#f0fdf4" borderColor="#dcfce7" />
    </>
  )

  if (cambios.tipo === 'eliminar') return (
    <>
      <p className="aud-det-section-title">Datos eliminados</p>
      <DatosBox datos={cambios.datos} bgColor="#fff5f5" borderColor="#fecaca" />
    </>
  )

  if (cambios.tipo === 'editar') {
    if (!cambios.antes || !cambios.despues) {
      const datos = cambios.antes || cambios.despues
      const bg    = cambios.antes ? '#fff5f5' : '#f0fdf4'
      const bd    = cambios.antes ? '#fecaca' : '#dcfce7'
      return <DatosBox datos={datos} bgColor={bg} borderColor={bd} />
    }
    const allKeys = [...new Set([...Object.keys(cambios.antes), ...Object.keys(cambios.despues)])]
    const diffs   = allKeys.filter(k => JSON.stringify(cambios.antes[k]) !== JSON.stringify(cambios.despues[k]))
    if (diffs.length === 0) return <p className="aud-det-empty">Sin cambios detectados</p>
    return (
      <div className="aud-editar-cols">
        <div>
          <p className="aud-col-title aud-col-antes">Antes</p>
          <div className="aud-datos-box" style={{ background: '#fff5f5', borderColor: '#fecaca' }}>
            {diffs.map(k => <CampoRow key={k} fieldKey={k} value={cambios.antes[k] ?? null} />)}
          </div>
        </div>
        <div>
          <p className="aud-col-title aud-col-despues">Después</p>
          <div className="aud-datos-box" style={{ background: '#f0fdf4', borderColor: '#dcfce7' }}>
            {diffs.map(k => <CampoRow key={k} fieldKey={k} value={cambios.despues[k] ?? null} />)}
          </div>
        </div>
      </div>
    )
  }

  if (cambios.tipo === 'email') {
    const d   = cambios.datos || {}
    const est = d.estado === 'enviado' ? 'badge-success' : d.estado === 'fallido' ? 'badge-danger' : 'badge-gray'
    return (
      <div>
        <div className="aud-email-header">
          <Mail size={16} color="#0369a1" />
          <span className="aud-email-title">Envío de notificación</span>
        </div>
        <div className="aud-email-campos">
          {d.destinatario !== undefined && <CampoRow label="Destinatario" value={d.destinatario} />}
          {d.asunto       !== undefined && <CampoRow label="Asunto"       value={d.asunto} />}
          {d.tipo         !== undefined && <CampoRow label="Tipo"         value={d.tipo} />}
          {d.automatico   !== undefined && <CampoRow label="Automático"   value={d.automatico ? 'Sí' : 'No'} />}
          {d.estado       !== undefined && (
            <div className="aud-det-row">
              <span className="aud-det-label">Estado</span>
              <span className={`badge ${est}`}>{d.estado}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (cambios.tipo === 'ver') return (
    <div className="aud-ver-empty">
      <Eye size={36} color="#9ca3af" />
      <p className="aud-ver-title">Consulta de solo lectura</p>
      <p className="aud-ver-sub">No se registraron cambios</p>
    </div>
  )

  return null
}

export default function AuditoriaPage() {
  const [filtros, setFiltros]         = useState(FILTROS_INIT)
  const [search, setSearch]           = useState('')
  const [page, setPage]               = useState(1)
  const [detalleReg, setDetalleReg]   = useState(null)
  const [exportando, setExportando]   = useState(false)
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const debounceRef = useRef(null)
  const { toast, showToast } = useToast()

  const filtrosQuery = { ...filtros, search }
  const { data, isLoading } = useAuditoria({ ...filtrosQuery, page })
  const { data: usuariosData = [] } = useUsuarios({ activo: true })
  const usuarios = Array.isArray(usuariosData) ? usuariosData : (usuariosData.results || [])

  const registros  = data?.results   || []
  const totalCount = data?.count     || 0
  const totalPages = Math.max(1, Math.ceil(totalCount / 20))
  const desde      = totalCount === 0 ? 0 : (page - 1) * 20 + 1
  const hasta      = Math.min(page * 20, totalCount)

  const statsCrear    = registros.filter(r => r.accion === 'CREAR').length
  const statsEditar   = registros.filter(r => r.accion === 'EDITAR').length
  const statsEliminar = registros.filter(r => r.accion === 'ELIMINAR').length
  const hayFiltros    = Object.values(filtros).some(v => v !== '') || search !== ''

  function setFiltro(key, val) {
    setFiltros(prev => ({ ...prev, [key]: val }))
    setPage(1)
  }

  function handleSearchChange(e) {
    const val = e.target.value
    setSearch(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setPage(1), 300)
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_INIT)
    setSearch('')
    setPage(1)
  }

  async function handleExportar() {
    setExportando(true)
    try {
      await exportarAuditoriaExcel(filtrosQuery)
    } catch (err) {
      showToast(extraerMensajeError(err), 'error')
    } finally {
      setExportando(false)
    }
  }

  const [fecha0, hora0] = detalleReg ? fmt(detalleReg.fecha) : ['', '']
  const detalleSubtitle = detalleReg
    ? `${fecha0} ${hora0}  ·  Usuario: ${detalleReg.usuario_username || 'Sistema'}  ·  IP: ${detalleReg.ip || 'Sistema'}`
    : ''

  return (
    <>
      <style>{`
        .aud-page { font-family: 'DM Sans', sans-serif; }

        /* ── Toolbar ── */
        .aud-toolbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }
        .aud-btn-export {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          background: #16a34a;
          color: #fff;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background .15s;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .aud-btn-export:hover:not(:disabled) { background: #15803d; }
        .aud-btn-export:disabled { opacity: .6; cursor: default; }

        /* ── Filtros acordeón ── */
        .aud-filtros-bar {
          background: #fff;
          border: 1px solid #e8edf2;
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 18px;
        }
        .aud-filtros-toggle {
          display: none;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          width: 100%;
          padding: 0;
        }
        .aud-filtros-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: flex-end;
        }
        .aud-filtros-row .input, .aud-filtros-row select {
          height: 36px;
          font-size: 13px;
          padding: 0 10px;
          border-radius: 7px;
          border: 1px solid #e5e7eb;
          background: #fff;
          color: #374151;
          outline: none;
        }
        .aud-filtros-row select:focus,
        .aud-filtros-row .input:focus { border-color: #1a3a5c; }
        .aud-select-modulo  { min-width: 160px; }
        .aud-select-accion  { min-width: 160px; }
        .aud-select-usuario { min-width: 160px; }
        .aud-input-fecha    { width: 140px; }
        .aud-input-search   { min-width: 200px; flex: 1 1 200px; max-width: 300px; }
        .aud-btn-limpiar {
          height: 36px;
          padding: 0 12px;
          border-radius: 7px;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          color: #6b7280;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
          transition: border-color .15s, color .15s;
        }
        .aud-btn-limpiar:hover { border-color: #dc2626; color: #dc2626; }

        /* ── Stats ── */
        .aud-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }
        .aud-stat {
          background: #fff;
          border: 1px solid #e8edf2;
          border-radius: 10px;
          padding: 12px 16px;
        }
        .aud-stat-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
        .aud-stat-value { font-size: 22px; font-weight: 600; line-height: 1; }
        .aud-stat-total   .aud-stat-value { color: #374151; }
        .aud-stat-crear   .aud-stat-value { color: #16a34a; }
        .aud-stat-editar  .aud-stat-value { color: #2563eb; }
        .aud-stat-eliminar .aud-stat-value { color: #dc2626; }

        /* ── Tabla ── */
        .aud-table-wrap {
          background: #fff;
          border: 1px solid #e8edf2;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .aud-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .aud-table thead th {
          background: #f8fafc;
          border-bottom: 1px solid #e8edf2;
          padding: 10px 14px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: .04em;
          white-space: nowrap;
        }
        .aud-table tbody tr { border-bottom: 1px solid #f0f4f8; }
        .aud-table tbody tr:nth-child(odd)  { background: #ffffff; }
        .aud-table tbody tr:nth-child(even) { background: #f8fafc; }
        .aud-table tbody tr:hover           { background: #eff6ff; cursor: pointer; }
        .aud-table tbody tr.aud-no-click    { cursor: default; }
        .aud-table td { padding: 10px 14px; vertical-align: middle; color: #374151; }

        .aud-fecha-date  { font-weight: 500; color: #111827; }
        .aud-fecha-hora  { font-size: 12px; color: #6b7280; }
        .aud-username    { font-weight: 600; color: #111827; }
        .aud-sistema     { color: #6b7280; }
        .aud-registro    { font-family: 'Courier New', monospace; font-size: 12px; color: #374151; }
        .aud-ip          { font-size: 12px; color: #9ca3af; }
        .aud-hint        { font-size: 11px; color: #9ca3af; margin-top: 2px; }

        .aud-modulo-cell { display: inline-flex; align-items: center; gap: 6px; }
        .aud-badge-accion { display: inline-flex; align-items: center; gap: 4px; }
        .aud-badge-email  { background: #e0f2fe; color: #0369a1; }

        .aud-btn-eye {
          background: none;
          border: none;
          cursor: pointer;
          color: #6b7280;
          padding: 4px;
          border-radius: 6px;
          transition: background .12s, color .12s;
          display: inline-flex;
          align-items: center;
        }
        .aud-btn-eye:hover { background: #eff6ff; color: #1a3a5c; }

        /* ── Empty / Loading ── */
        .aud-empty {
          text-align: center;
          padding: 48px 0;
          color: #9ca3af;
          font-size: 14px;
        }

        /* ── Paginación ── */
        .aud-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .aud-page-info { font-size: 13px; color: #6b7280; }
        .aud-page-btns { display: flex; gap: 4px; }
        .aud-page-btn {
          width: 32px;
          height: 32px;
          border-radius: 7px;
          border: 1px solid #e5e7eb;
          background: #fff;
          color: #374151;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background .12s, border-color .12s, color .12s;
          font-size: 13px;
        }
        .aud-page-btn:hover:not(:disabled) { background: #eff6ff; border-color: #1a3a5c; color: #1a3a5c; }
        .aud-page-btn:disabled { opacity: .4; cursor: default; }

        /* ── Modal detalle ── */
        .aud-det-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          background: #f8fafc;
          border: 1px solid #e8edf2;
          border-radius: 8px;
          margin-bottom: 18px;
          flex-wrap: wrap;
          font-size: 12px;
          color: #6b7280;
        }
        .aud-det-meta-sep { color: #d1d5db; }
        .aud-det-section-title {
          font-weight: 600;
          font-size: 13px;
          color: #111827;
          margin-bottom: 8px;
        }
        .aud-det-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 5px 0;
          border-bottom: 1px solid rgba(0,0,0,.04);
        }
        .aud-det-label {
          color: #6b7280;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .05em;
          min-width: 120px;
          padding-top: 2px;
          flex-shrink: 0;
        }
        .aud-det-value { color: #111827; font-size: 13px; word-break: break-all; }
        .aud-det-empty { color: #6b7280; font-size: 13px; }
        .aud-null { color: #9ca3af; font-style: italic; }
        .aud-bool { font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 10px; }
        .aud-bool-true  { background: #dcfce7; color: #15803d; }
        .aud-bool-false { background: #fee2e2; color: #dc2626; }
        .aud-datos-box {
          border: 1px solid;
          border-radius: 8px;
          padding: 10px 14px;
        }
        .aud-editar-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .aud-col-title {
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .05em;
          margin-bottom: 6px;
        }
        .aud-col-antes   { color: #dc2626; }
        .aud-col-despues { color: #16a34a; }
        .aud-email-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
        }
        .aud-email-title { font-weight: 600; color: #0369a1; font-size: 14px; }
        .aud-email-campos { display: flex; flex-direction: column; gap: 2px; }
        .aud-ver-empty {
          text-align: center;
          padding: 36px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .aud-ver-title { color: #374151; font-weight: 500; margin: 0; }
        .aud-ver-sub   { color: #9ca3af; font-size: 13px; margin: 0; }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .aud-filtros-toggle { display: flex; }
          .aud-filtros-row    { display: none; }
          .aud-filtros-row.aud-filtros-open { display: flex; margin-top: 12px; }
          .aud-stats    { grid-template-columns: 1fr 1fr; }
          .aud-col-ip   { display: none; }
          .aud-btn-export span { display: none; }
          .aud-btn-export { padding: 8px 10px; }
          .aud-editar-cols { grid-template-columns: 1fr; }
          .aud-table-wrap { overflow-x: auto; }
        }
        @media (max-width: 480px) {
          .aud-col-modulo { display: none; }
        }
      `}</style>

      <div className="aud-page">
        <Toast toast={toast} />

        {/* Toolbar */}
        <div className="aud-toolbar">
          <div>
            <h1 className="page-title">Auditoría del sistema</h1>
            <p className="page-subtitle">Registro de todas las acciones</p>
          </div>
          <button
            className="aud-btn-export"
            onClick={handleExportar}
            disabled={exportando}
          >
            <Download size={15} />
            <span>{exportando ? 'Exportando…' : 'Exportar Excel'}</span>
          </button>
        </div>

        {/* Filtros */}
        <div className="aud-filtros-bar">
          <button
            className="aud-filtros-toggle"
            onClick={() => setFiltrosOpen(o => !o)}
          >
            <Settings size={14} />
            Filtros
            <ChevronDown size={14} style={{ marginLeft: 'auto', transform: filtrosOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </button>

          <div className={`aud-filtros-row${filtrosOpen ? ' aud-filtros-open' : ''}`}>
            <select
              className="aud-select-modulo"
              value={filtros.modulo}
              onChange={e => setFiltro('modulo', e.target.value)}
            >
              <option value="">Todos los módulos</option>
              {MODULOS_OPTS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            <select
              className="aud-select-accion"
              value={filtros.accion}
              onChange={e => setFiltro('accion', e.target.value)}
            >
              <option value="">Todas las acciones</option>
              {ACCIONES_OPTS.map(a => <option key={a} value={a}>{ACCION_LABELS[a]}</option>)}
            </select>

            <select
              className="aud-select-usuario"
              value={filtros.usuario}
              onChange={e => setFiltro('usuario', e.target.value)}
            >
              <option value="">Todos los usuarios</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.user?.username || u.username}>
                  {u.user?.username || u.username}
                </option>
              ))}
            </select>

            <input
              type="date"
              className="input aud-input-fecha"
              value={filtros.fecha_desde}
              onChange={e => setFiltro('fecha_desde', e.target.value)}
              max="2099-12-31"
            />
            <input
              type="date"
              className="input aud-input-fecha"
              value={filtros.fecha_hasta}
              onChange={e => setFiltro('fecha_hasta', e.target.value)}
              max="2099-12-31"
            />

            <input
              type="text"
              className="input aud-input-search"
              value={search}
              onChange={handleSearchChange}
              placeholder="Buscar tabla, registro…"
            />

            {hayFiltros && (
              <button className="aud-btn-limpiar" onClick={limpiarFiltros}>
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="aud-stats">
          <div className="aud-stat aud-stat-total">
            <div className="aud-stat-label">Total</div>
            <div className="aud-stat-value">{totalCount.toLocaleString('es-PY')}</div>
          </div>
          <div className="aud-stat aud-stat-crear">
            <div className="aud-stat-label">Creaciones</div>
            <div className="aud-stat-value">{statsCrear}</div>
          </div>
          <div className="aud-stat aud-stat-editar">
            <div className="aud-stat-label">Ediciones</div>
            <div className="aud-stat-value">{statsEditar}</div>
          </div>
          <div className="aud-stat aud-stat-eliminar">
            <div className="aud-stat-label">Eliminaciones</div>
            <div className="aud-stat-value">{statsEliminar}</div>
          </div>
        </div>

        {/* Tabla */}
        <div className="aud-table-wrap">
          {isLoading ? (
            <div className="aud-empty">Cargando…</div>
          ) : registros.length === 0 ? (
            <div className="aud-empty">Sin registros</div>
          ) : (
            <table className="aud-table">
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Usuario</th>
                  <th className="aud-col-modulo">Módulo</th>
                  <th>Acción</th>
                  <th>Registro</th>
                  <th className="aud-col-ip">IP</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {registros.map((reg, idx) => {
                  const [fecha, hora] = fmt(reg.fecha)
                  const conDetalle    = tieneDetalle(reg)
                  return (
                    <tr
                      key={reg.id}
                      onClick={() => conDetalle && setDetalleReg(reg)}
                      className={conDetalle ? '' : 'aud-no-click'}
                    >
                      <td>
                        <div className="aud-fecha-date">{fecha}</div>
                        <div className="aud-fecha-hora">{hora}</div>
                      </td>
                      <td>
                        {reg.usuario_username
                          ? <span className="aud-username">{reg.usuario_username}</span>
                          : <span className="aud-sistema">Sistema</span>
                        }
                      </td>
                      <td className="aud-col-modulo">
                        <ModuloCell modulo={reg.modulo_display} />
                      </td>
                      <td><BadgeAccion accion={reg.accion} /></td>
                      <td>
                        <span className="aud-registro">{reg.tabla} #{reg.registro_id}</span>
                      </td>
                      <td className="aud-col-ip">
                        <span className="aud-ip">{reg.ip || 'Sistema'}</span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {conDetalle && (
                          <button
                            className="aud-btn-eye"
                            title="Ver detalle"
                            onClick={() => setDetalleReg(reg)}
                          >
                            <Eye size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginación */}
        {totalCount > 0 && (
          <div className="aud-pagination">
            <span className="aud-page-info">
              Mostrando {desde}–{hasta} de {totalCount.toLocaleString('es-PY')} registros
            </span>
            <div className="aud-page-btns">
              <button className="aud-page-btn" onClick={() => setPage(1)} disabled={page === 1}>
                <ChevronFirst size={14} />
              </button>
              <button className="aud-page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                <ChevronLeft size={14} />
              </button>
              <button className="aud-page-btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
                <ChevronRight size={14} />
              </button>
              <button className="aud-page-btn" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>
                <ChevronLast size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Modal detalle */}
        <Modal
          isOpen={detalleReg !== null}
          onClose={() => setDetalleReg(null)}
          size="lg"
          title={detalleReg ? `${detalleReg.tabla} · ${ACCION_LABELS[detalleReg.accion] || detalleReg.accion}` : ''}
          subtitle={detalleSubtitle}
        >
          {detalleReg && (
            <div>
              <div className="aud-det-meta">
                <BadgeAccion accion={detalleReg.accion} />
                <span className="aud-det-meta-sep">·</span>
                <span>{detalleReg.modulo_display}</span>
                <span className="aud-det-meta-sep">·</span>
                <span className="aud-registro">{detalleReg.tabla} #{detalleReg.registro_id}</span>
              </div>
              <DetalleContenido reg={detalleReg} />
            </div>
          )}
        </Modal>
      </div>
    </>
  )
}
