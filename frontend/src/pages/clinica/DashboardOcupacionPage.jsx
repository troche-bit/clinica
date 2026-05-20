import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Activity } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import Toast from '../../components/ui/Toast'
import apiClient from '../../api/client'

const DIAS_LABEL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function BarraH({ label, total, maximo }) {
  const pct = maximo > 0 ? Math.max((total / maximo) * 100, total > 0 ? 2 : 0) : 0
  return (
    <div className="dash-oc-barra" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ width: 110, fontSize: 12, color: '#374151', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 10, background: 'rgba(26,58,92,0.12)', borderRadius: 5, overflow: 'hidden' }}>
        <div className="dash-oc-barra-fill" style={{ width: `${pct}%`, height: '100%', background: '#1a3a5c', borderRadius: 5, transition: 'width .5s ease' }} />
      </div>
      <div style={{ width: 28, fontSize: 11, fontWeight: 600, color: '#1a3a5c', textAlign: 'right', flexShrink: 0 }}>{total}</div>
    </div>
  )
}

function TendenciaCurva({ datos }) {
  if (!datos || datos.length < 2) return null

  const svgWidth = 800, svgHeight = 200
  const PADDING = { top: 30, bottom: 30, left: 40, right: 20 }
  const chartHeight = svgHeight - PADDING.top - PADDING.bottom
  const chartWidth  = svgWidth  - PADDING.left - PADDING.right

  const valores  = datos.map(d => d.total)
  const maxValor = Math.max(...valores, 1)
  const minValor = 0
  const rangoY   = maxValor - minValor

  const toY = (valor) =>
    PADDING.top + chartHeight - ((valor - minValor) / rangoY) * chartHeight

  const toX = (index) =>
    PADDING.left + (index / (valores.length - 1)) * chartWidth

  const maxIdx = valores.reduce((mi, v, i) => v > valores[mi] ? i : mi, 0)
  const grid   = [0, Math.round(maxValor / 2), maxValor]

  const areaPath = [
    `M ${toX(0)} ${toY(valores[0])}`,
    ...valores.map((v, i) => `L ${toX(i)} ${toY(v)}`),
    `L ${toX(valores.length - 1)} ${PADDING.top + chartHeight}`,
    `L ${toX(0)} ${PADDING.top + chartHeight}`,
    'Z',
  ].join(' ')

  const pts = valores.map((v, i) => ({ x: toX(i), y: toY(v), val: v }))
  const curva = pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    const p0 = pts[Math.max(0, i - 2)], p1 = pts[i - 1]
    const p3 = pts[Math.min(pts.length - 1, i + 1)], t = 0.35
    return acc + ` C ${(p1.x+(p.x-p0.x)*t).toFixed(1)} ${(p1.y+(p.y-p0.y)*t).toFixed(1)} ${(p.x-(p3.x-p1.x)*t).toFixed(1)} ${(p.y-(p3.y-p1.y)*t).toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }, '')

  return (
    <div>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="xMidYMid meet"
        className="dash-oc-tend-svg" style={{ display: 'block', width: '100%' }}>
        {grid.map((gv, gi) => (
          <line key={gi}
            x1={PADDING.left} x2={svgWidth - PADDING.right}
            y1={toY(gv).toFixed(1)} y2={toY(gv).toFixed(1)}
            stroke="#e8edf2" strokeWidth="1.5" strokeDasharray={gi === 0 ? '0' : '8 8'}
          />
        ))}
        {grid.map((gv, gi) => (
          <text key={gi} x={PADDING.left - 6} y={(toY(gv) + 4).toFixed(1)}
            textAnchor="end" fontSize="11" fill="#9ca3af">{gv}</text>
        ))}
        <path d={areaPath} fill="rgba(26,58,92,0.08)" />
        <path d={curva} fill="none" stroke="#1a3a5c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => {
          const isMax = i === maxIdx && p.val > 0
          return (
            <g key={i}>
              <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)}
                r={isMax ? '8' : p.val > 0 ? '5' : '3'}
                fill={p.val > 0 ? '#1a3a5c' : '#9ca3af'}
              />
              {isMax && (
                <text x={p.x.toFixed(1)} y={(p.y - 14).toFixed(1)}
                  textAnchor="middle" fontSize="12" fontWeight="bold" fill="#1a3a5c"
                >{p.val}</text>
              )}
            </g>
          )
        })}
        {datos.map((d, i) => (
          <text key={i} x={toX(i).toFixed(1)} y={(svgHeight - 6).toFixed(1)}
            textAnchor="middle" fontSize="11" fill="#9ca3af">{d.label}</text>
        ))}
      </svg>
    </div>
  )
}

function MapaCalor({ datos }) {
  if (!datos || datos.length === 0) {
    return <div style={{ color: '#9ca3af', fontSize: 13, padding: '16px 0' }}>Sin datos del período</div>
  }

  // Construir mapa día (1-7) x hora (0-23) → total
  const mapa = {}
  let maxVal = 1
  for (const d of datos) {
    const key = `${d.dia}-${d.hora}`
    mapa[key] = d.total
    if (d.total > maxVal) maxVal = d.total
  }

  // Rango de horas con datos
  const horas = [...new Set(datos.map(d => d.hora))].sort((a, b) => a - b)

  function intensidad(val) {
    if (!val) return 'rgba(26,58,92,0.05)'
    const ratio = val / maxVal
    if (ratio > 0.75) return 'rgba(26,58,92,0.85)'
    if (ratio > 0.5)  return 'rgba(26,58,92,0.55)'
    if (ratio > 0.25) return 'rgba(26,58,92,0.30)'
    return 'rgba(26,58,92,0.12)'
  }
  function textColor(val) {
    if (!val) return '#d1d5db'
    const ratio = val / maxVal
    return ratio > 0.5 ? '#fff' : '#1a3a5c'
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="dash-oc-mapa-table">
        <thead>
          <tr>
            <th className="dash-oc-mapa-th-hora">Hora</th>
            {DIAS_LABEL.map(d => (
              <th key={d} className="dash-oc-mapa-th">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {horas.map(hora => (
            <tr key={hora}>
              <td className="dash-oc-mapa-hora">{String(hora).padStart(2, '0')}:00</td>
              {[1,2,3,4,5,6,7].map(dia => {
                const val = mapa[`${dia}-${hora}`] ?? 0
                return (
                  <td key={dia}
                    className="dash-oc-mapa-cell"
                    style={{ background: intensidad(val), color: textColor(val) }}
                    title={val > 0 ? `${DIAS_LABEL[dia-1]} ${String(hora).padStart(2,'0')}:00 — ${val} turno${val !== 1 ? 's' : ''}` : ''}
                  >
                    {val > 0 ? val : ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>Intensidad:</span>
        {[
          { label: 'Bajo', color: 'rgba(26,58,92,0.12)' },
          { label: 'Medio', color: 'rgba(26,58,92,0.30)' },
          { label: 'Alto', color: 'rgba(26,58,92,0.55)' },
          { label: 'Máximo', color: 'rgba(26,58,92,0.85)' },
        ].map(({ label, color }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6b7280' }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: color, display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

function Seccion({ titulo, children, full }) {
  return (
    <div className={`dash-oc-seccion${full ? ' full' : ''}`}>
      <div className="dash-oc-seccion-titulo">{titulo}</div>
      {children}
    </div>
  )
}

export default function DashboardOcupacionPage() {
  const navigate = useNavigate()
  const { toast, showToast } = useToast()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      try {
        const res = await apiClient.get('/agenda/dashboard-ocupacion/')
        setData(res.data)
      } catch {
        showToast('No se pudieron cargar las estadísticas.', 'error')
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const maxConsultorio = data ? Math.max(...data.consultorios.map(c => c.total), 1) : 1

  return (
    <>
      <style>{`
        .dash-oc-wrap { padding: 24px; }

        .dash-oc-back {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 12px; font-weight: 500; color: #fff;
          background: #1a3a5c; border: none; border-radius: 8px;
          cursor: pointer; padding: 8px 16px; flex-shrink: 0;
          transition: background .15s; align-self: flex-start;
        }
        .dash-oc-back:hover { background: #15304d; }

        .dash-oc-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
        .dash-oc-header-icon { width: 42px; height: 42px; background: #eef2f7; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .dash-oc-header-text { flex: 1; }
        .dash-oc-header h1 { font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 3px; }
        .dash-oc-header p  { font-size: 13px; color: #6b7280; margin: 0; }

        .dash-oc-cargando { display: flex; align-items: center; justify-content: center; height: 200px; color: #6b7280; font-size: 14px; }

        .dash-oc-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; align-items: stretch; }
        @media (max-width: 768px) { .dash-oc-grid2 { grid-template-columns: 1fr; } }

        .dash-oc-seccion { background: #f8fafc; border: 1px solid #e8edf2; border-radius: 8px; padding: 14px 16px; }
        .dash-oc-seccion.full { grid-column: 1 / -1; }
        .dash-oc-seccion-titulo { font-size: 10.5px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; }

        .dash-oc-barra:hover .dash-oc-barra-fill { background: #15304d !important; }

        .dash-oc-tend-svg { width: 100%; height: auto; }
        @media (max-width: 768px) { .dash-oc-tend-svg { height: 160px; } .dash-oc-wrap { padding: 14px; } .dash-oc-header h1 { font-size: 18px; } }

        /* Mapa de calor */
        .dash-oc-mapa-table { border-collapse: collapse; width: 100%; min-width: 320px; }
        .dash-oc-mapa-th-hora { font-size: 9px; color: #9ca3af; font-weight: 600; padding: 4px 8px 4px 0; text-align: left; white-space: nowrap; }
        .dash-oc-mapa-th { font-size: 10px; color: #6b7280; font-weight: 600; padding: 4px 2px; text-align: center; width: 40px; }
        .dash-oc-mapa-hora { font-size: 9px; color: #9ca3af; padding: 3px 8px 3px 0; white-space: nowrap; }
        .dash-oc-mapa-cell {
          width: 40px; height: 26px; text-align: center; font-size: 10px; font-weight: 600;
          border-radius: 3px; padding: 0 2px; cursor: default; transition: opacity .15s;
        }
        .dash-oc-mapa-cell:hover { opacity: .8; }
      `}</style>

      <div className="dash-oc-wrap">
        <div className="dash-oc-header">
          <div className="dash-oc-header-icon"><Activity size={20} color="#1a3a5c" /></div>
          <div className="dash-oc-header-text">
            <h1>Dashboard · Ocupación clínica</h1>
            <p>Demanda del mes en curso — horarios, consultorios y tendencia semestral</p>
          </div>
          <button className="dash-oc-back" onClick={() => navigate('/informes')}>
            <ArrowLeft size={14} /> Volver a Informes
          </button>
        </div>

        {loading && <div className="dash-oc-cargando">Cargando estadísticas…</div>}

        {!loading && data && (
          <>
            <div className="dash-oc-grid2">
              <Seccion titulo="Picos de demanda · últimos 6 meses" full>
                <TendenciaCurva datos={data.picos_por_mes} />
              </Seccion>
            </div>

            <div className="dash-oc-grid2">
              <Seccion titulo="Mapa de calor · día × hora" full>
                <MapaCalor datos={data.mapa_calor} />
              </Seccion>
            </div>

            <div className="dash-oc-grid2">
              <Seccion titulo="Consultorios más usados" full>
                {data.consultorios.length === 0
                  ? <div style={{ color: '#9ca3af', fontSize: 13 }}>Sin datos</div>
                  : data.consultorios.map((c, i) => (
                    <BarraH key={i} label={c.consultorio} total={c.total} maximo={maxConsultorio} />
                  ))
                }
              </Seccion>
            </div>
          </>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  )
}
