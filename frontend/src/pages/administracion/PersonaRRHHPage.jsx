import { useState, useRef, useCallback } from 'react'
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Users, FileText, Eye, Download } from 'lucide-react'
import Modal           from '../../components/ui/Modal'
import ConfirmDialog   from '../../components/ui/ConfirmDialog'
import PersonaRRHHForm from '../../components/rrhh/PersonaRRHHForm'
import { usePersonasRRHH, usePersonaRRHHMutations } from '../../hooks/administracion/usePersonaRRHH'
import { useToast }    from '../../hooks/useToast'
import Toast           from '../../components/ui/Toast'
import apiClient       from '../../api/client'
import { useAuth }     from '../../context/AuthContext'
import { useAtajosTeclado } from '../../hooks/useAtajosTeclado'
import { useNavigationGuard } from '../../hooks/useNavigationGuard'
import { useDocumentosPorPrestador } from '../../hooks/mantenimiento/useDocumentos'

const EXTENSIONES_IMAGEN = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']

async function fetchDocumentoPrestadorBlob(docId) {
  const token = localStorage.getItem('access_token')
  const res = await fetch(`/api/documentos-prestador/${docId}/descargar/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('No se pudo obtener el documento.')
  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  const buffer = await res.arrayBuffer()
  return new Blob([buffer], { type: contentType })
}

const ESTADO_BADGE = {
  activo:   { bg: '#dcfce7', color: '#166534' },
  inactivo: { bg: '#f3f4f6', color: '#6b7280' },
  licencia: { bg: '#fef9c3', color: '#854d0e' },
}

const CARGO_LABEL = {
  medico:         'Médico',
  enfermero:      'Enfermero/a',
  administrativo: 'Administrativo',
  tecnico:        'Técnico',
  otro:           'Otro',
}

function fileIconInfo(nombre) {
  const ext = nombre?.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return { bg: '#fee2e2', color: '#dc2626', label: 'PDF' }
  if (['jpg', 'jpeg', 'png'].includes(ext)) return { bg: '#eff6ff', color: '#1d4ed8', label: ext?.toUpperCase() }
  return { bg: '#f9fafb', color: '#6b7280', label: ext?.toUpperCase() || '?' }
}

function Seccion({ titulo, children }) {
  return (
    <div className="rrhh-seccion">
      <div className="rrhh-seccion-titulo">{titulo}</div>
      {children}
    </div>
  )
}

function Campo({ label, valor }) {
  return (
    <div className="rrhh-campo">
      <div className="rrhh-campo-label">{label}</div>
      <div className="rrhh-campo-valor">{valor || '—'}</div>
    </div>
  )
}

function SeccionDocumentos({ personaRrhhId }) {
  const [abriendoDoc,   setAbriendoDoc]   = useState(null)
  const [imagenPreview, setImagenPreview] = useState(null)
  const { data: docs = [], isLoading: cargandoDocs } = useDocumentosPorPrestador(personaRrhhId)

  const handleVerDoc = useCallback(async (doc) => {
    setAbriendoDoc(doc.id)
    try {
      const blob = await fetchDocumentoPrestadorBlob(doc.id)
      const url  = URL.createObjectURL(blob)
      const ext  = (doc.filename || '').split('.').pop().toLowerCase()
      if (EXTENSIONES_IMAGEN.includes(ext)) {
        setImagenPreview({ url, filename: doc.filename })
      } else {
        window.open(url, '_blank')
      }
    } catch { /* silencioso */ }
    finally { setAbriendoDoc(null) }
  }, [])

  if (cargandoDocs) return <div className="rrhh-doc-cargando">Cargando documentos…</div>
  if (docs.length === 0) return <div className="rrhh-doc-vacio">No hay documentos cargados aún. Editá el prestador para agregar archivos.</div>

  return (
    <div>
      {imagenPreview && (
        <div className="rrhh-img-overlay" onClick={() => setImagenPreview(null)}>
          <img
            src={imagenPreview.url}
            alt={imagenPreview.filename}
            className="rrhh-img-preview"
            onClick={e => e.stopPropagation()}
          />
          <button className="rrhh-img-close" onClick={() => setImagenPreview(null)}>✕</button>
        </div>
      )}
      <div className="rrhh-doc-lista">
        {docs.map(doc => {
          const info = fileIconInfo(doc.filename || '')
          return (
            <div key={doc.id} className="rrhh-doc-item">
              <div className="rrhh-doc-icono-box" style={{ background: info.bg, color: info.color }}>{info.label}</div>
              <div className="rrhh-doc-info">
                <div className="rrhh-doc-nombre">{doc.filename || `Documento #${doc.id}`}</div>
                {doc.tipo_doc_dig_descripcion && <div className="rrhh-doc-tipo-badge">{doc.tipo_doc_dig_descripcion}</div>}
              </div>
              <button
                className="rrhh-doc-dl-btn"
                onClick={() => handleVerDoc(doc)}
                disabled={abriendoDoc === doc.id}
                title="Ver documento"
              >
                {abriendoDoc === doc.id ? '…' : <Eye size={13} />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PrestadorDetalle({ prestador, onEditar }) {
  const [pestana, setPestana] = useState('ficha')
  const p      = prestador.persona_detalle || {}
  const estado = prestador.estado ?? 'activo'
  const badge  = ESTADO_BADGE[estado] ?? ESTADO_BADGE.activo
  const nombre = prestador.nombre || p.razon_social || '—'
  const initials = nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="rrhh-det-root">
      <div className="rrhh-det-cabecera">
        <div className="rrhh-det-avatar">{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="rrhh-det-nombre">{nombre}</div>
          <div className="rrhh-det-doc">{prestador.documento || p.nro_documento || '—'}</div>
          <span className="rrhh-badge" style={{ background: badge.bg, color: badge.color, marginTop: 4, display: 'inline-flex' }}>
            {estado.charAt(0).toUpperCase() + estado.slice(1)}
          </span>
        </div>
        <button className="rrhh-det-btn-editar" onClick={onEditar}>
          <Pencil size={13} /> Editar
        </button>
      </div>

      <div className="rrhh-tabs">
        <button
          className={`rrhh-tab${pestana === 'ficha' ? ' rrhh-tab-active' : ''}`}
          onClick={() => setPestana('ficha')}
        >
          Ficha
        </button>
        <button
          className={`rrhh-tab${pestana === 'documentos' ? ' rrhh-tab-active' : ''}`}
          onClick={() => setPestana('documentos')}
        >
          Documentos
        </button>
      </div>

      {pestana === 'ficha' && (
        <>
          <Seccion titulo="Datos personales">
            <div className="rrhh-det-grid">
              <Campo label="Documento"    valor={prestador.documento || p.nro_documento} />
              <Campo label="Teléfono"     valor={p.telefono} />
              <Campo label="Correo"       valor={p.correo_electronico} />
              <Campo label="Dirección"    valor={p.direccion} />
              <Campo label="País"         valor={p.pais_detalle?.descripcion} />
              <Campo label="Departamento" valor={p.departamento_detalle?.descripcion} />
              <Campo label="Ciudad"       valor={p.ciudad_detalle?.descripcion} />
            </div>
          </Seccion>

          <Seccion titulo="Datos del prestador">
            <div className="rrhh-det-grid">
              <Campo label="Cargo"            valor={CARGO_LABEL[prestador.cargo] ?? prestador.cargo} />
              <Campo label="Tipo de contrato" valor={prestador.tipo_contrato} />
              <Campo label="Nro. matrícula"   valor={prestador.nro_matricula} />
              <Campo label="Honorario ref."   valor={prestador.honorario ? `Gs. ${Number(prestador.honorario).toLocaleString()}` : null} />
              <Campo label="Fecha nacimiento" valor={prestador.fecha_nacimiento} />
              <Campo label="Fecha ingreso"    valor={prestador.fecha_ingreso} />
            </div>
          </Seccion>

          {prestador.especialidades_detalle?.length > 0 && (
            <Seccion titulo="Especialidades">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {prestador.especialidades_detalle.map(e => (
                  <span key={e.id} className="rrhh-esp-chip">{e.descripcion}</span>
                ))}
              </div>
            </Seccion>
          )}

          {prestador.observacion && (
            <Seccion titulo="Observaciones">
              <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.5 }}>{prestador.observacion}</div>
            </Seccion>
          )}
        </>
      )}

      {pestana === 'documentos' && (
        <SeccionDocumentos personaRrhhId={prestador.id} />
      )}
    </div>
  )
}

export default function PersonaRRHHPage() {
  const [modo,         setModo]         = useState(null)
  const [prestadorSel, setPrestadorSel] = useState(null)
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [confirmId,    setConfirmId]    = useState(null)
  const [loadingPDF,   setLoadingPDF]   = useState(false)
  const [loadingExcel, setLoadingExcel] = useState(false)
  const debounceRef = useRef(null)

  const { user }                     = useAuth()
  const puedeEliminar                = user?.rol === 'admin'
  const { toast, showToast }         = useToast()
  const { data, isLoading, isError } = usePersonasRRHH({ page, search })
  const { eliminar }                 = usePersonaRRHHMutations(showToast)
  const { guardAction }              = useNavigationGuard()

  const totalPages = data ? Math.ceil(data.count / 20) : 0

  useAtajosTeclado({
    'Insert': { fn: () => { if (modo === null) guardAction(() => { setPrestadorSel(null); setModo('crear') }) } },
  })

  const handleSearchChange = (e) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setSearch(e.target.value); setPage(1) }, 300)
  }

  const cerrarModal = () => { setPrestadorSel(null); setModo(null) }

  const handleClose      = ()           => guardAction(() => cerrarModal())
  const handleCancelar   = ()           => guardAction(() => cerrarModal())
  const handleSuccess    = ()           => { cerrarModal(); showToast('Prestador guardado correctamente.', 'success') }
  const handleVerDetalle = (prestador)  => guardAction(() => { setPrestadorSel(prestador); setModo('ver') })
  const handleEditar     = (e, prest)   => { e.stopPropagation(); guardAction(() => { setPrestadorSel(prest); setModo('editar') }) }
  const handleNuevo      = ()           => guardAction(() => { setPrestadorSel(null); setModo('crear') })

  const confirmarEliminar = () => {
    eliminar.mutate(confirmId, {
      onSuccess: () => { setConfirmId(null); cerrarModal() },
      onError:   () => setConfirmId(null),
    })
  }

  const handleVerPDF = async () => {
    setLoadingPDF(true)
    try {
      const res = await apiClient.get('/personarrhh/reporte-lista/', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch {
      showToast('No se pudo generar el listado PDF.', 'error')
    } finally {
      setLoadingPDF(false)
    }
  }

  const handleDescargarExcel = async () => {
    setLoadingExcel(true)
    try {
      const res = await apiClient.get('/personarrhh/reporte-lista-excel/', { responseType: 'blob' })
      const obj  = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const link = document.createElement('a')
      link.href     = obj
      link.download = `listado_prestadores_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`
      link.click()
      URL.revokeObjectURL(obj)
    } catch {
      showToast('No se pudo generar el listado Excel.', 'error')
    } finally {
      setLoadingExcel(false)
    }
  }

  const tituloModal = modo === 'crear'
    ? 'Nuevo prestador'
    : modo === 'editar'
      ? 'Editar prestador'
      : 'Detalle del prestador'

  const subtituloModal = modo === 'crear'
    ? 'Buscá por documento para comenzar'
    : (prestadorSel?.nombre || prestadorSel?.persona_detalle?.razon_social || '')

  return (
    <>
      <Toast toast={toast} />

      <ConfirmDialog
        isOpen={confirmId !== null}
        title="Eliminar prestador"
        description="¿Confirmás la eliminación? Si tiene turnos activos (disponible, ocupado o realizado) no se podrá eliminar."
        onConfirm={confirmarEliminar}
        onCancel={() => setConfirmId(null)}
        loading={eliminar.isPending}
      />

      <style>{`
        .rrhh-toolbar {
          display: flex; align-items: flex-start; gap: 12px;
          flex-wrap: wrap; margin-bottom: 20px;
        }
        .rrhh-titles { flex: 1; min-width: 0; order: 1; }
        .rrhh-title    { font-size: 22px; font-weight: 600; color: #1a3a5c; margin-bottom: 2px; }
        .rrhh-subtitle { font-size: 13px; color: #6b7280; }
        .rrhh-search-wrap {
          position: relative; flex: 1 1 200px; max-width: 360px;
          order: 2;
        }
        .rrhh-search-icon {
          position: absolute; left: 11px; top: 50%;
          transform: translateY(-50%); color: #9ca3af; pointer-events: none;
        }
        .rrhh-search-input {
          width: 100%; padding: 9px 12px 9px 34px;
          border: 1.5px solid #e5e7eb; border-radius: 9px;
          font-size: 13.5px; font-family: 'DM Sans', sans-serif;
          color: #111827; background: #fff; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .rrhh-search-input:focus { border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26,58,92,0.08); }
        .rrhh-search-input::placeholder { color: #d1d5db; }
        .rrhh-btns-group {
          display: flex; align-items: flex-start; gap: 8px; order: 3; flex-shrink: 0;
        }
        .rrhh-btn-pdf {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 16px; background: #dc2626; color: #fff;
          border: none; border-radius: 9px; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer;
          transition: background 0.15s; white-space: nowrap;
        }
        .rrhh-btn-pdf:hover:not(:disabled) { background: #b91c1c; }
        .rrhh-btn-pdf:disabled { opacity: 0.55; cursor: not-allowed; }
        .rrhh-btn-excel {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 16px; background: #16a34a; color: #fff;
          border: none; border-radius: 9px; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer;
          transition: background 0.15s; white-space: nowrap;
        }
        .rrhh-btn-excel:hover:not(:disabled) { background: #15803d; }
        .rrhh-btn-excel:disabled { opacity: 0.55; cursor: not-allowed; }
        .rrhh-btn-nuevo-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .rrhh-btn-nuevo {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; background: #1a3a5c; color: #fff;
          border: none; border-radius: 9px; font-size: 13.5px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer; white-space: nowrap;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .rrhh-btn-nuevo:hover { background: #15304d; box-shadow: 0 4px 12px rgba(26,58,92,0.2); }
        .rrhh-btn-nuevo-hint { font-size: 10.5px; color: #9ca3af; }
        .rrhh-table-wrap { overflow-x: auto; }
        .rrhh-table-card {
          background: #fff; border: 1px solid #e8edf2;
          border-radius: 12px; overflow: hidden;
        }
        .rrhh-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .rrhh-table thead { background: #f8fafc; border-bottom: 1px solid #e8edf2; }
        .rrhh-table th {
          text-align: left; padding: 11px 16px;
          font-size: 11px; font-weight: 600;
          letter-spacing: .05em; text-transform: uppercase;
          color: #9ca3af; white-space: nowrap;
        }
        .rrhh-table td {
          padding: 12px 16px; border-bottom: 1px solid #f3f4f6;
          color: #374151; vertical-align: middle;
        }
        .rrhh-table tbody tr:last-child td { border-bottom: none; }
        .rrhh-table tbody tr:nth-child(odd)  { background: #ffffff; }
        .rrhh-table tbody tr:nth-child(even) { background: #f9fafb; }
        .rrhh-table tbody tr { cursor: pointer; transition: background 0.12s; }
        .rrhh-table tbody tr:hover { background: #f0f5fb; }
        .rrhh-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: #dbeafe; display: flex; align-items: center;
          justify-content: center; font-size: 11px; font-weight: 600;
          color: #1a3a5c; flex-shrink: 0;
        }
        .rrhh-nombre-cell { display: flex; align-items: center; gap: 10px; }
        .rrhh-nombre { font-weight: 500; color: #111827; }
        .rrhh-doc    { font-size: 12px; color: #9ca3af; margin-top: 1px; }
        .rrhh-hint   { font-size: 11px; color: #c4cad4; margin-top: 2px; }
        .rrhh-badge {
          display: inline-flex; align-items: center;
          font-size: 11px; font-weight: 500;
          padding: 3px 9px; border-radius: 20px;
        }
        .rrhh-esp-list { display: flex; flex-wrap: wrap; gap: 4px; }
        .rrhh-esp-chip {
          display: inline-block; font-size: 11px; font-weight: 500;
          padding: 2px 8px; border-radius: 20px;
          background: #dbeafe; color: #1a3a5c;
        }
        .rrhh-actions { display: flex; align-items: center; gap: 6px; }
        .rrhh-action-btn {
          width: 30px; height: 30px; border-radius: 7px;
          border: 1px solid #e8edf2; background: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #6b7280; transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .rrhh-action-btn.edit:hover  { background: #eff6ff; color: #1a3a5c; border-color: #bfdbfe; }
        .rrhh-action-btn.trash:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
        .rrhh-empty {
          text-align: center; padding: 48px 16px;
          color: #9ca3af; font-size: 13.5px;
        }
        .rrhh-empty-icon {
          width: 40px; height: 40px; margin: 0 auto 12px;
          background: #f3f4f6; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; color: #d1d5db;
        }
        .rrhh-empty-title { font-weight: 500; color: #6b7280; margin-bottom: 4px; }
        .rrhh-pagination {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; border-top: 1px solid #e8edf2;
          font-size: 13px; color: #6b7280; flex-wrap: wrap; gap: 8px;
        }
        .rrhh-pag-btns { display: flex; align-items: center; gap: 6px; }
        .rrhh-pag-btn {
          width: 30px; height: 30px; border-radius: 7px;
          border: 1px solid #e8edf2; background: #fff; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #374151; transition: background 0.15s;
        }
        .rrhh-pag-btn:hover:not(:disabled) { background: #f0f4f8; }
        .rrhh-pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Detalle */
        .rrhh-det-root { padding: 4px 0; }
        .rrhh-det-cabecera {
          position: sticky; top: -24px; z-index: 5; background: #fff;
          display: flex; align-items: flex-start; gap: 14px;
          padding-bottom: 16px; margin-bottom: 4px;
          border-bottom: 1px solid #f3f4f6;
        }
        .rrhh-det-avatar {
          width: 48px; height: 48px; border-radius: 50%;
          background: #dbeafe; display: flex; align-items: center;
          justify-content: center; font-size: 16px; font-weight: 700;
          color: #1a3a5c; flex-shrink: 0;
        }
        .rrhh-det-nombre { font-size: 16px; font-weight: 600; color: #111827; }
        .rrhh-det-doc    { font-size: 12.5px; color: #6b7280; margin-top: 2px; }
        .rrhh-det-btn-editar {
          margin-left: auto; flex-shrink: 0;
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; background: #1a3a5c; color: #fff;
          border: none; border-radius: 8px; font-size: 13px;
          font-family: 'DM Sans', sans-serif; cursor: pointer;
          transition: background 0.15s; white-space: nowrap;
        }
        .rrhh-det-btn-editar:hover { background: #15304d; }
        .rrhh-tabs {
          display: flex; gap: 0;
          border-bottom: 1px solid #e8edf2; margin-bottom: 20px; margin-top: 12px;
        }
        .rrhh-tab {
          padding: 8px 18px; font-size: 13.5px; font-weight: 500;
          cursor: pointer; background: none; font-family: 'DM Sans', sans-serif;
          border: none; border-bottom: 2px solid transparent;
          color: #6b7280; transition: color 0.15s, border-color 0.15s;
        }
        .rrhh-tab:hover { color: #374151; }
        .rrhh-tab-active { color: #1a3a5c !important; border-bottom-color: #1a3a5c !important; }
        .rrhh-seccion {
          background: #fafbfc; border: 1px solid #e8edf2;
          border-radius: 10px; padding: 16px 18px; margin-bottom: 12px;
        }
        .rrhh-seccion-titulo {
          font-size: 10.5px; font-weight: 600; letter-spacing: .06em;
          text-transform: uppercase; color: #9ca3af; margin-bottom: 12px;
        }
        .rrhh-det-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 20px;
        }
        .rrhh-campo-label {
          font-size: 10.5px; font-weight: 600; letter-spacing: .04em;
          text-transform: uppercase; color: #9ca3af; margin-bottom: 3px;
        }
        .rrhh-campo-valor { font-size: 13.5px; color: #111827; }

        /* Documentos */
        .rrhh-doc-cargando { font-size: 13px; color: #9ca3af; padding: 12px 0; }
        .rrhh-doc-vacio    { font-size: 13px; color: #9ca3af; padding: 8px 0 16px; }
        .rrhh-doc-existentes { margin-bottom: 20px; }
        .rrhh-doc-existentes-label {
          font-size: 11px; font-weight: 600; letter-spacing: .05em;
          text-transform: uppercase; color: #9ca3af; margin-bottom: 8px;
        }
        .rrhh-doc-nueva-label {
          font-size: 11px; font-weight: 600; letter-spacing: .05em;
          text-transform: uppercase; color: #9ca3af; margin-bottom: 8px;
        }
        .rrhh-doc-lista { display: flex; flex-direction: column; gap: 8px; }
        .rrhh-doc-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border: 1px solid #e8edf2;
          border-radius: 9px; background: #fff;
        }
        .rrhh-doc-icono-box {
          width: 40px; height: 40px; border-radius: 6px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700;
        }
        .rrhh-doc-info { flex: 1; min-width: 0; }
        .rrhh-doc-nombre {
          font-size: 12.5px; font-weight: 500; color: #111827;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          margin-bottom: 4px;
        }
        .rrhh-doc-tipo-badge {
          display: inline-block; font-size: 10.5px; background: #eff6ff;
          color: #1d4ed8; padding: 1px 7px; border-radius: 20px; font-weight: 500;
        }
        .rrhh-doc-dl-btn {
          width: 28px; height: 28px; border-radius: 6px; border: 1px solid #e8edf2;
          background: none; cursor: pointer; display: flex; align-items: center;
          justify-content: center; color: #6b7280; flex-shrink: 0;
          transition: background 0.15s, color 0.15s;
        }
        .rrhh-doc-dl-btn:hover { background: #eff6ff; color: #1a3a5c; }
        .rrhh-doc-remove {
          width: 24px; height: 24px; border-radius: 6px; border: none;
          background: none; cursor: pointer; color: #9ca3af; font-size: 13px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          transition: background 0.15s, color 0.15s;
        }
        .rrhh-doc-remove:hover { background: #fef2f2; color: #dc2626; }
        .rrhh-doc-confirm {
          display: flex; align-items: center; gap: 6px; flex-shrink: 0;
        }
        .rrhh-doc-confirm-txt { font-size: 12px; color: #374151; }
        .rrhh-doc-confirm-si {
          padding: 3px 10px; font-size: 12px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          background: #dc2626; color: #fff; border: none; border-radius: 6px;
          cursor: pointer;
        }
        .rrhh-doc-confirm-si:disabled { opacity: 0.6; cursor: not-allowed; }
        .rrhh-doc-confirm-no {
          padding: 3px 10px; font-size: 12px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          background: #f3f4f6; color: #374151; border: none; border-radius: 6px;
          cursor: pointer;
        }
        .rrhh-doc-select {
          margin-top: 4px; width: 100%; padding: 4px 8px;
          border: 1.5px solid #e5e7eb; border-radius: 7px;
          font-size: 12.5px; font-family: 'DM Sans', sans-serif;
          color: #374151; background: #fff; outline: none;
        }
        .rrhh-doc-error {
          font-size: 12.5px; color: #dc2626;
          padding: 8px 12px; background: #fef2f2;
          border: 1px solid #fecaca; border-radius: 7px; margin-top: 4px;
        }
        .rrhh-doc-subir-btn {
          padding: 8px 20px; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          background: #1a3a5c; color: #fff; border: none; border-radius: 9px;
          cursor: pointer; transition: background 0.15s;
        }
        .rrhh-doc-subir-btn:hover:not(:disabled) { background: #15304d; }
        .rrhh-doc-subir-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .rrhh-dropzone {
          border: 2px dashed #e5e7eb; border-radius: 10px;
          padding: 20px 16px; cursor: pointer; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          transition: border-color 0.2s, background 0.2s;
        }
        .rrhh-dropzone:hover  { border-color: #93c5fd; background: #f0f9ff; }
        .rrhh-dropzone-over   { border-color: #1a3a5c; background: #eff6ff; }
        .rrhh-dropzone-text   { font-size: 13px; color: #374151; }
        .rrhh-dropzone-hint   { font-size: 11.5px; color: #9ca3af; }
        .rrhh-img-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.82); z-index: 9999;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .rrhh-img-preview {
          max-width: 90vw; max-height: 90vh; border-radius: 8px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.5); cursor: default;
        }
        .rrhh-img-close {
          position: absolute; top: 16px; right: 16px;
          background: rgba(255,255,255,0.15); border: none; color: #fff;
          font-size: 18px; cursor: pointer; width: 36px; height: 36px;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .rrhh-img-close:hover { background: rgba(255,255,255,0.3); }

        @media (max-width: 640px) {
          .rrhh-det-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .rrhh-titles     { display: none; }
          .rrhh-search-wrap { order: 4; flex-basis: 100%; max-width: 100%; }
        }
        @media (max-width: 767px) {
          .modal-box { border-radius: 16px 16px 0 0 !important; max-height: 95dvh !important; }
        }
        @media (max-width: 479px) {
          .modal-box { border-radius: 0 !important; height: 100dvh !important; max-height: 100dvh !important; }
        }
      `}</style>

      <div className="rrhh-toolbar">
        <div className="rrhh-titles" style={{ order: 1 }}>
          <div className="rrhh-title">RRHH — Prestadores</div>
          <div className="rrhh-subtitle">
            {data?.count !== undefined ? `${data.count} prestadores registrados` : 'Gestión de personal de salud'}
          </div>
        </div>

        <div className="rrhh-search-wrap">
          <Search size={15} className="rrhh-search-icon" />
          <input
            type="text"
            placeholder="Buscar por nombre, documento o matrícula..."
            onChange={handleSearchChange}
            className="rrhh-search-input"
          />
        </div>

        <div className="rrhh-btns-group">
          <button
            className="rrhh-btn-pdf"
            onClick={handleVerPDF}
            disabled={loadingPDF}
          >
            <FileText size={14} />
            {loadingPDF ? 'Generando...' : 'PDF'}
          </button>
          <button
            className="rrhh-btn-excel"
            onClick={handleDescargarExcel}
            disabled={loadingExcel}
          >
            <Download size={14} />
            {loadingExcel ? 'Generando...' : 'Excel'}
          </button>
          <div className="rrhh-btn-nuevo-wrap">
            <button className="rrhh-btn-nuevo" onClick={handleNuevo}>
              <Plus size={15} /> Nuevo prestador
            </button>
            <span className="rrhh-btn-nuevo-hint">Presioná Ins para nuevo prestador</span>
          </div>
        </div>
      </div>

      <div className="rrhh-table-card">
        <div className="rrhh-table-wrap">
          <table className="rrhh-table">
            <thead>
              <tr>
                <th>Prestador</th>
                <th>Cargo</th>
                <th>Especialidades</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5}>
                  <div className="rrhh-empty">
                    <div className="rrhh-empty-icon"><Users size={18} /></div>
                    Cargando prestadores...
                  </div>
                </td></tr>
              )}
              {isError && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#dc2626', fontSize: '13.5px' }}>
                  Error al cargar los prestadores. Intentá de nuevo.
                </td></tr>
              )}
              {!isLoading && !isError && data?.results?.length === 0 && (
                <tr><td colSpan={5}>
                  <div className="rrhh-empty">
                    <div className="rrhh-empty-icon"><Users size={18} /></div>
                    <div className="rrhh-empty-title">No se encontraron prestadores</div>
                    {search && <div>Probá con otro término de búsqueda</div>}
                  </div>
                </td></tr>
              )}
              {data?.results?.map((prestador) => {
                const nombre   = prestador.nombre || prestador.persona_detalle?.razon_social || '—'
                const initials = nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                const estado   = prestador.estado ?? 'activo'
                const badge    = ESTADO_BADGE[estado] ?? ESTADO_BADGE.activo
                return (
                  <tr key={prestador.id} onClick={() => handleVerDetalle(prestador)}>
                    <td>
                      <div className="rrhh-nombre-cell">
                        <div className="rrhh-avatar">{initials}</div>
                        <div>
                          <div className="rrhh-nombre">{nombre}</div>
                          <div className="rrhh-doc">{prestador.documento || prestador.persona_detalle?.nro_documento || '—'}</div>
                          <div className="rrhh-hint">Clic para ver detalle</div>
                        </div>
                      </div>
                    </td>
                    <td>{CARGO_LABEL[prestador.cargo] ?? prestador.cargo ?? '—'}</td>
                    <td>
                      {prestador.especialidades_detalle?.length > 0
                        ? (
                          <div className="rrhh-esp-list">
                            {prestador.especialidades_detalle.map(e => (
                              <span key={e.id} className="rrhh-esp-chip">{e.descripcion}</span>
                            ))}
                          </div>
                        )
                        : <span style={{ color: '#d1d5db' }}>—</span>
                      }
                    </td>
                    <td>
                      <span className="rrhh-badge" style={{ background: badge.bg, color: badge.color }}>
                        {estado.charAt(0).toUpperCase() + estado.slice(1)}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="rrhh-actions">
                        <button
                          className="rrhh-action-btn edit"
                          onClick={(e) => handleEditar(e, prestador)}
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        {puedeEliminar && (
                          <button
                            className="rrhh-action-btn trash"
                            onClick={() => setConfirmId(prestador.id)}
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="rrhh-pagination">
            <span>Página {page} de {totalPages} — {data?.count} prestadores</span>
            <div className="rrhh-pag-btns">
              <button className="rrhh-pag-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={15} />
              </button>
              <button className="rrhh-pag-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={modo !== null}
        onClose={handleClose}
        title={tituloModal}
        subtitle={subtituloModal}
        size="lg"
      >
        {modo === 'ver' && prestadorSel && (
          <PrestadorDetalle
            key={prestadorSel.id}
            prestador={prestadorSel}
            onEditar={() => setModo('editar')}
          />
        )}
        {(modo === 'crear' || modo === 'editar') && (
          <PersonaRRHHForm
            prestadorInicial={modo === 'editar' ? prestadorSel : null}
            onSuccess={handleSuccess}
            onCancel={handleCancelar}
          />
        )}
      </Modal>
    </>
  )
}
