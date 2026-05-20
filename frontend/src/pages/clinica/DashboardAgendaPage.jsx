import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CalendarCheck } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import Toast from '../../components/ui/Toast'
import apiClient from '../../api/client'

const AG_ESTADO = [
  { key: 'realizado',  label: 'Realizados',  color: '#8b5cf6' },
  { key: 'ocupado',    label: 'Ocupados',    color: '#3b82f6' },
  { key: 'disponible', label: 'Disponibles', color: '#22c55e' },
  { key: 'cancelado',  label: 'Cancelados',  color: '#ef4444' },
  { key: 'inactivo',   label: 'Inactivos',   color: '#9ca3af' },
]

function BarraH({ label, total, maximo }) {
  const pct = maximo > 0 ? Math.max((total / maximo) * 100, total > 0 ? 2 : 0) : 0
  return (
    <div className="dash-ag-barra" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ width: 100, fontSize: 12, color: '#374151', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 10, background: 'rgba(26,58,92,0.12)', borderRadius: 5, overflow: 'hidden' }}>
        <div className="dash-ag-barra-fill" style={{ width: `${pct}%`, height: '100%', background: '#1a3a5c', borderRadius: 5, transition: 'width .5s ease' }} />
      </div>
      <div style={{ width: 28, fontSize: 11, fontWeight: 600, color: '#1a3a5c', textAlign: 'right', flexShrink: 0 }}>{total}</div>
    </div>
  )
}

function DonutEstado({ porEstado, total }) {
  if (!porEstado || total === 0) {
    return <div style={{ color: '#9ca3af', fontSize: 13, padding: '16px 0' }}>Sin datos</div>
  }
  let acum = 0
  const segs = AG_ESTADO.map(s => {
    const val = porEstado[s.key] ?? 0
    const pct = total > 0 ? (val / total) * 100 : 0
    const from = acum
    acum += pct
    return { ...s, val, pct, from, to: acum }
  }).filter(s => s.pct > 0)

  const gradiente = segs.length > 0
    ? segs.map(s => `${s.color} ${s.from.toFixed(1)}% ${s.to.toFixed(1)}%`).join(', ')
    : '#e8edf2 0% 100%'

  return (
    <div className="dash-ag-donut-wrap">
      <div className="dash-ag-donut-ring" style={{ background: `conic-gradient(${gradiente})` }}>
        <div className="dash-ag-donut-hole">
          <div className="dash-ag-donut-num">{total}</div>
          <div className="dash-ag-donut-lbl">total</div>
        </div>
      </div>
      <div className="dash-ag-donut-leyenda">
        {AG_ESTADO.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#374151' }}>{s.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: s.color, marginLeft: 4 }}>{porEstado[s.key] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TendenciaDoble({ datos }) {
  if (!datos || datos.length < 2) return null

  const svgWidth = 800, svgHeight = 200
  const PADDING = { top: 30, bottom: 30, left: 40, right: 20 }
  const chartHeight = svgHeight - PADDING.top - PADDING.bottom
  const chartWidth  = svgWidth  - PADDING.left - PADDING.right

  const allVals  = datos.flatMap(d => [d.realizados, d.cancelados])
  const maxValor = Math.max(...allVals, 1)
  const minValor = 0
  const rangoY   = maxValor - minValor

  const toY = (valor) =>
    PADDING.top + chartHeight - ((valor - minValor) / rangoY) * chartHeight

  const toX = (index) =>
    PADDING.left + (index / (datos.length - 1)) * chartWidth

  const grid = [0, Math.round(maxValor / 2), maxValor]

  function makePts(serie) {
    return datos.map((d, i) => ({ x: toX(i), y: toY(d[serie]), val: d[serie] }))
  }

  function makeCurva(pts) {
    return pts.reduce((acc, p, i) => {
      if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
      const p0 = pts[Math.max(0, i - 2)], p1 = pts[i - 1]
      const p3 = pts[Math.min(pts.length - 1, i + 1)], t = 0.35
      return acc + ` C ${(p1.x+(p.x-p0.x)*t).toFixed(1)} ${(p1.y+(p.y-p0.y)*t).toFixed(1)} ${(p.x-(p3.x-p1.x)*t).toFixed(1)} ${(p.y-(p3.y-p1.y)*t).toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    }, '')
  }

  function makeArea(serie) {
    const vals = datos.map(d => d[serie])
    return [
      `M ${toX(0)} ${toY(vals[0])}`,
      ...vals.map((v, i) => `L ${toX(i)} ${toY(v)}`),
      `L ${toX(vals.length - 1)} ${PADDING.top + chartHeight}`,
      `L ${toX(0)} ${PADDING.top + chartHeight}`,
      'Z',
    ].join(' ')
  }

  const ptsR   = makePts('realizados')
  const ptsC   = makePts('cancelados')
  const curvaR = makeCurva(ptsR)
  const curvaC = makeCurva(ptsC)
  const areaR  = makeArea('realizados')
  const areaC  = makeArea('cancelados')

  const maxIdxR = ptsR.reduce((mi, p, i) => p.val > ptsR[mi].val ? i : mi, 0)
  const maxIdxC = ptsC.reduce((mi, p, i) => p.val > ptsC[mi].val ? i : mi, 0)

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
        {[{ color: '#8b5cf6', label: 'Realizados' }, { color: '#ef4444', label: 'Cancelados' }].map(({ color, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6b7280' }}>
            <span style={{ display: 'inline-block', width: 22, height: 2.5, borderRadius: 2, background: color }} />
            {label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="xMidYMid meet"
        className="dash-ag-tend-svg" style={{ display: 'block', width: '100%' }}>
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
        <path d={areaR} fill="rgba(139,92,246,0.07)" />
        <path d={areaC} fill="rgba(239,68,68,0.07)" />
        <path d={curvaR} fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={curvaC} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {ptsR.map((p, i) => {
          const isMax = i === maxIdxR && p.val > 0
          return (
            <g key={i}>
              <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)}
                r={isMax ? '8' : p.val > 0 ? '5' : '3'}
                fill={p.val > 0 ? '#8b5cf6' : '#9ca3af'}
              />
              {isMax && (
                <text x={p.x.toFixed(1)} y={(p.y - 14).toFixed(1)}
                  textAnchor="middle" fontSize="12" fontWeight="bold" fill="#8b5cf6"
                >{p.val}</text>
              )}
            </g>
          )
        })}
        {ptsC.map((p, i) => {
          const isMax = i === maxIdxC && p.val > 0
          return (
            <g key={i}>
              <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)}
                r={isMax ? '8' : p.val > 0 ? '5' : '3'}
                fill={p.val > 0 ? '#ef4444' : '#9ca3af'}
              />
              {isMax && (
                <text x={p.x.toFixed(1)} y={(p.y - 14).toFixed(1)}
                  textAnchor="middle" fontSize="12" fontWeight="bold" fill="#ef4444"
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

function Seccion({ titulo, children, full }) {
  return (
    <div className={`dash-ag-seccion${full ? ' full' : ''}`}>
      <div className="dash-ag-seccion-titulo">{titulo}</div>
      {children}
    </div>
  )
}

export default function DashboardAgendaPage() {
  const navigate = useNavigate()
  const { toast, showToast } = useToast()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      try {
        const res = await apiClient.get('/agenda/dashboard-agenda/')
        setData(res.data)
      } catch {
        showToast('No se pudieron cargar las estadísticas.', 'error')
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const maxPrestador = data ? Math.max(...data.top_prestadores.map(p => p.total), 1) : 1
  const totalEstado  = data ? Object.values(data.por_estado).reduce((a, b) => a + b, 0) : 0

  return (
    <>
      <style>{`
        .dash-ag-wrap { padding: 24px; }

        .dash-ag-back {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 12px; font-weight: 500; color: #fff;
          background: #1a3a5c; border: none; border-radius: 8px;
          cursor: pointer; padding: 8px 16px; flex-shrink: 0;
          transition: background .15s; align-self: flex-start;
        }
        .dash-ag-back:hover { background: #15304d; }

        .dash-ag-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
        .dash-ag-header-icon { width: 42px; height: 42px; background: #eef2f7; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .dash-ag-header-text { flex: 1; }
        .dash-ag-header h1 { font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 3px; }
        .dash-ag-header p  { font-size: 13px; color: #6b7280; margin: 0; }

        .dash-ag-cargando { display: flex; align-items: center; justify-content: center; height: 200px; color: #6b7280; font-size: 14px; }

        .dash-ag-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; align-items: stretch; }
        @media (max-width: 768px) { .dash-ag-grid2 { grid-template-columns: 1fr; } }

        .dash-ag-seccion { background: #f8fafc; border: 1px solid #e8edf2; border-radius: 8px; padding: 14px 16px; }
        .dash-ag-seccion.full { grid-column: 1 / -1; }
        .dash-ag-seccion-titulo { font-size: 10.5px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; }

        .dash-ag-total { font-size: 48px; font-weight: 700; color: #1a3a5c; line-height: 1; margin-bottom: 4px; }
        .dash-ag-total-sub { font-size: 13px; color: #6b7280; }

        .dash-ag-barra:hover .dash-ag-barra-fill { background: #15304d !important; }

        .dash-ag-donut-wrap { display: flex; align-items: center; gap: 16px; }
        .dash-ag-donut-ring { width: 120px; height: 120px; border-radius: 50%; flex-shrink: 0; position: relative; }
        .dash-ag-donut-hole {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          width: 72px; height: 72px; border-radius: 50%; background: #f8fafc;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .dash-ag-donut-num { font-size: 18px; font-weight: 700; color: #1a3a5c; line-height: 1; }
        .dash-ag-donut-lbl { font-size: 9px; color: #9ca3af; margin-top: 1px; }
        .dash-ag-donut-leyenda { display: flex; flex-direction: column; gap: 6px; }

        .dash-ag-tend-svg { width: 100%; height: auto; }

        @media (max-width: 768px) {
          .dash-ag-wrap { padding: 14px; }
          .dash-ag-header h1 { font-size: 18px; }
          .dash-ag-donut-ring { width: 160px; height: 160px; }
          .dash-ag-donut-hole { width: 96px; height: 96px; }
          .dash-ag-donut-num { font-size: 24px; }
          .dash-ag-donut-lbl { font-size: 11px; }
          .dash-ag-tend-svg { height: 160px; }
        }
      `}</style>

      <div className="dash-ag-wrap">
        <div className="dash-ag-header">
          <div className="dash-ag-header-icon"><CalendarCheck size={20} color="#1a3a5c" /></div>
          <div className="dash-ag-header-text">
            <h1>Dashboard · Agenda</h1>
            <p>Turnos del mes en curso y comparativa de los últimos 6 meses</p>
          </div>
          <button className="dash-ag-back" onClick={() => navigate('/informes')}>
            <ArrowLeft size={14} /> Volver a Informes
          </button>
        </div>

        {loading && <div className="dash-ag-cargando">Cargando estadísticas…</div>}

        {!loading && data && (
          <>
            <div className="dash-ag-grid2">
              <Seccion titulo="Total del mes">
                <div className="dash-ag-total">{data.total_mes}</div>
                <div className="dash-ag-total-sub">
                  {data.total_mes === 1 ? 'turno en el mes' : 'turnos en el mes'}
                </div>
              </Seccion>

              <Seccion titulo="Por estado">
                <DonutEstado porEstado={data.por_estado} total={totalEstado} />
              </Seccion>
            </div>

            <div className="dash-ag-grid2">
              <Seccion titulo="Top prestadores · ocupados y realizados" full>
                {data.top_prestadores.length === 0
                  ? <div style={{ color: '#9ca3af', fontSize: 13 }}>Sin datos</div>
                  : data.top_prestadores.map((p, i) => (
                    <BarraH key={i} label={p.nombre} total={p.total} maximo={maxPrestador} />
                  ))
                }
              </Seccion>
            </div>

            <div className="dash-ag-grid2">
              <Seccion titulo="Realizados vs Cancelados · últimos 6 meses" full>
                <TendenciaDoble datos={data.comparativa_6_meses} />
              </Seccion>
            </div>
          </>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  )
}
