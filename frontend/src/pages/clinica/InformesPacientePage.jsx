import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet, FileText, Users, BarChart2 } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../hooks/useToast'
import Toast from '../../components/ui/Toast'
import { usePaises, useDepartamentos, useCiudades } from '../../hooks/useUbicacion'
import apiClient from '../../api/client'

const SEXO_OPCIONES = [
  { value: '',  label: 'Todos' },
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'O', label: 'Otro' },
]

const SANGRE_OPCIONES = [
  { value: '',    label: 'Todos' },
  { value: 'A+',  label: 'A+' },  { value: 'A-',  label: 'A-' },
  { value: 'B+',  label: 'B+' },  { value: 'B-',  label: 'B-' },
  { value: 'AB+', label: 'AB+' }, { value: 'AB-', label: 'AB-' },
  { value: 'O+',  label: 'O+' },  { value: 'O-',  label: 'O-' },
]

const FILTROS_INICIALES = {
  sexo: '', grupo_sanguineo: '',
  pais: '', departamento: '', ciudad: '',
  fecha_desde: '', fecha_hasta: '',
}

function buildQS(filtros) {
  const p = new URLSearchParams()
  Object.entries(filtros).forEach(([k, v]) => { if (v) p.append(k, v) })
  const s = p.toString()
  return s ? '?' + s : ''
}

export default function InformesPacientePage() {
  const navigate = useNavigate()
  const { toast, showToast } = useToast()

  const [listadoAbierto, setListadoAbierto] = useState(false)
  const [filtros, setFiltros]               = useState(FILTROS_INICIALES)
  const [loadingPdf, setLoadingPdf]         = useState(false)
  const [loadingXls, setLoadingXls]         = useState(false)

  const { data: paises = [] }        = usePaises()
  const { data: departamentos = [] } = useDepartamentos(filtros.pais)
  const { data: ciudades = [] }      = useCiudades(filtros.departamento)

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

  async function handleVerPdf() {
    setLoadingPdf(true)
    try {
      const res = await apiClient.get(`/paciente/reporte-lista/${buildQS(filtros)}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch {
      showToast('No se pudo generar el PDF.', 'error')
    } finally {
      setLoadingPdf(false)
    }
  }

  async function handleDescargarExcel() {
    setLoadingXls(true)
    try {
      const tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const res  = await apiClient.get(`/paciente/reporte-lista-excel/${buildQS(filtros)}`, { responseType: 'blob' })
      const url  = URL.createObjectURL(new Blob([res.data], { type: tipo }))
      const link = document.createElement('a')
      link.href = url
      link.download = `listado_pacientes_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      showToast('No se pudo generar el Excel.', 'error')
    } finally {
      setLoadingXls(false)
    }
  }

  return (
    <>
      <style>{`
        .inf-pac-wrap { padding: 24px; }
        .inf-pac-page-header { margin-bottom: 28px; }
        .inf-pac-page-header h1 { font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 4px; }
        .inf-pac-page-header p  { font-size: 14px; color: #6b7280; margin: 0; }

        .inf-pac-section { margin-bottom: 28px; }
        .inf-pac-section-label {
          font-size: 11px; font-weight: 700; letter-spacing: .08em;
          text-transform: uppercase; color: #9ca3af;
          margin-bottom: 12px; padding-bottom: 6px;
          border-bottom: 1px solid #e8edf2;
        }

        .inf-pac-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px; }
        .inf-pac-card {
          background: #fff; border: 1px solid #e8edf2; border-radius: 10px;
          padding: 18px 20px; cursor: pointer;
          transition: box-shadow .15s, border-color .15s, transform .12s;
          display: flex; flex-direction: column; gap: 10px;
        }
        .inf-pac-card:hover { box-shadow: 0 4px 16px rgba(26,58,92,.1); border-color: #1a3a5c; transform: translateY(-1px); }
        .inf-pac-card-icon { width: 42px; height: 42px; background: #eef2f7; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
        .inf-pac-card-title { font-size: 14px; font-weight: 600; color: #111827; }
        .inf-pac-card-desc  { font-size: 12px; color: #6b7280; line-height: 1.45; }

        .inf-pac-filtros-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .inf-pac-filtros-grid .full { grid-column: 1 / -1; }
        .inf-pac-sep-label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; margin: 0 0 10px; }
        .inf-pac-footer { margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid #e8edf2; padding-top: 16px; }
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
      `}</style>

      <div className="inf-pac-wrap">
        <div className="inf-pac-page-header">
          <h1>Informes</h1>
          <p>Reportes y estadísticas del módulo de pacientes</p>
        </div>

        <div className="inf-pac-section">
          <div className="inf-pac-section-label">Listados</div>
          <div className="inf-pac-grid">
            <div className="inf-pac-card" onClick={handleAbrirListado}>
              <div className="inf-pac-card-icon"><Users size={20} color="#1a3a5c" /></div>
              <div>
                <div className="inf-pac-card-title">Listado de pacientes</div>
                <div className="inf-pac-card-desc">Exportar en PDF o Excel con filtros por sexo, tipo de sangre y ubicación</div>
              </div>
            </div>
          </div>
        </div>

        <div className="inf-pac-section">
          <div className="inf-pac-section-label">Dashboards</div>
          <div className="inf-pac-grid">
            <div className="inf-pac-card" onClick={() => navigate('/informes/dashboard/pacientes')}>
              <div className="inf-pac-card-icon"><BarChart2 size={20} color="#1a3a5c" /></div>
              <div>
                <div className="inf-pac-card-title">Mes actual</div>
                <div className="inf-pac-card-desc">Registros del mes en curso — por día, sexo, edad y origen</div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
            <div className="form-group full">
              <p className="inf-pac-sep-label">Ubicación</p>
            </div>
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
            <div className="form-group full">
              <p className="inf-pac-sep-label" style={{ marginTop: 4 }}>Fecha de registro</p>
            </div>
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

      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  )
}
