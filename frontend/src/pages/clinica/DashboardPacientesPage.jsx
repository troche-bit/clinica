import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart2 } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import Toast from '../../components/ui/Toast'
import apiClient from '../../api/client'

const COLOR_SEXO = { M: '#1a3a5c', F: '#e77c8e', O: '#7c8ee7' }

function fmt(n) {
  return n.toLocaleString('es-PY')
}

function BarraH({ label, sub, total, maximo }) {
  const pct = maximo > 0 ? Math.max((total / maximo) * 100, total > 0 ? 2 : 0) : 0
  return (
    <div className="dash-pac-barra" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div
        title={label}
        style={{ width: 100, fontSize: 12, color: '#374151', flexShrink: 0, lineHeight: 1.2 }}
      >
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: '#9ca3af' }}>{sub}</div>}
      </div>
      <div style={{ flex: 1, height: 10, background: 'rgba(26,58,92,0.12)', borderRadius: 5, overflow: 'hidden' }}>
        <div className="dash-pac-barra-fill" style={{ width: `${pct}%`, height: '100%', background: '#1a3a5c', borderRadius: 5, transition: 'width .5s ease' }} />
      </div>
      <div style={{ width: 28, fontSize: 11, fontWeight: 600, color: '#1a3a5c', textAlign: 'right', flexShrink: 0 }}>{total}</div>
    </div>
  )
}

function CalendarioBars({ porDia, porSemana, totalMes, mesLabel }) {
  const [vista, setVista] = useState('dia')
  const datos = vista === 'dia' ? porDia
    : vista === 'semana' ? porSemana
    : [{ label: mesLabel, total: totalMes, es_futuro: false }]
  const maximo = Math.max(...datos.map(d => d.total), 1)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Registros
        </div>
        <div className="dash-pac-toggle">
          {['dia', 'semana', 'mes'].map(v => (
            <button key={v} className={`dash-pac-toggle-btn${vista === v ? ' active' : ''}`} onClick={() => setVista(v)}>
              {v === 'dia' ? 'Día' : v === 'semana' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>
      <div className="dash-pac-vchart" style={{ height: vista === 'dia' ? 110 : 90 }}>
        {datos.map((d, i) => {
          const pct = maximo > 0 ? Math.max((d.total / maximo) * 100, d.total > 0 ? 4 : 0) : 0
          const lbl = vista === 'dia' ? String(d.dia) : vista === 'semana' ? d.label : mesLabel
          const futuro = d.es_futuro
          return (
            <div key={i} className="dash-pac-vcol" title={`${d.total} registro${d.total !== 1 ? 's' : ''}`}>
              {!futuro && <div className="dash-pac-vcol-valor">{d.total > 0 ? d.total : ''}</div>}
              <div className="dash-pac-vcol-track">
                <div
                  className="dash-pac-vcol-fill"
                  style={{
                    height: `${pct}%`,
                    background: futuro ? 'rgba(26,58,92,0.08)' : '#1a3a5c',
                    minHeight: futuro ? 0 : (d.total > 0 ? 3 : 0),
                  }}
                />
              </div>
              <div className="dash-pac-vcol-label" style={{ color: futuro ? '#d1d5db' : '#9ca3af' }}>
                {vista === 'dia' ? lbl : (vista === 'semana' ? `S${d.semana}` : lbl)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DonutSexo({ data, total }) {
  if (!data || data.length === 0) return <div style={{ color: '#9ca3af', fontSize: 13, padding: '16px 0' }}>Sin datos</div>

  let acum = 0
  const segmentos = data.map(r => {
    const pct = total > 0 ? (r.total / total) * 100 : 0
    const from = acum
    acum += pct
    return { ...r, from, to: acum, pct }
  })
  const gradiente = total > 0
    ? segmentos.map(s => `${COLOR_SEXO[s.sexo] ?? '#ccc'} ${s.from.toFixed(1)}% ${s.to.toFixed(1)}%`).join(', ')
    : '#e8edf2 0% 100%'

  return (
    <div className="dash-pac-donut-wrap">
      <div className="dash-pac-donut-ring" style={{ background: `conic-gradient(${gradiente})` }}>
        <div className="dash-pac-donut-hole">
          <div className="dash-pac-donut-num">{fmt(total)}</div>
          <div className="dash-pac-donut-lbl">total</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {segmentos.map(s => (
          <div key={s.sexo} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: COLOR_SEXO[s.sexo] ?? '#ccc', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#374151' }}>{s.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginLeft: 6 }}>{s.total}</span>
            <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 30, textAlign: 'right' }}>{s.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
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
        className="dash-pac-tend-svg" style={{ display: 'block', width: '100%' }}>
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

function Seccion({ titulo, children, full }) {
  return (
    <div className={`dash-pac-seccion${full ? ' full' : ''}`}>
      <div className="dash-pac-seccion-titulo">{titulo}</div>
      {children}
    </div>
  )
}

export default function DashboardPacientesPage() {
  const navigate = useNavigate()
  const { toast, showToast } = useToast()

  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      try {
        const res = await apiClient.get('/paciente/dashboard-mensual/')
        setData(res.data)
      } catch {
        showToast('No se pudieron cargar las estadísticas.', 'error')
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const maxDepto  = data ? Math.max(...data.por_departamento.map(r => r.total), 1) : 1
  const maxEtario = data ? Math.max(...data.por_grupo_etario.map(r => r.total), 1) : 1

  return (
    <>
      <style>{`
        .dash-pac-wrap { padding: 24px; }

        .dash-pac-back {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 12px; font-weight: 500; color: #fff;
          background: #1a3a5c; border: none; border-radius: 8px;
          cursor: pointer; padding: 8px 16px; flex-shrink: 0;
          transition: background .15s; align-self: flex-start;
        }
        .dash-pac-back:hover { background: #15304d; }

        .dash-pac-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
        .dash-pac-header-icon { width: 42px; height: 42px; background: #eef2f7; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .dash-pac-header-text { flex: 1; }
        .dash-pac-header h1 { font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 3px; }
        .dash-pac-header p  { font-size: 13px; color: #6b7280; margin: 0; }

        .dash-pac-cargando { display: flex; align-items: center; justify-content: center; height: 200px; color: #6b7280; font-size: 14px; }

        .dash-pac-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; align-items: stretch; }
        @media (max-width: 768px) { .dash-pac-grid2 { grid-template-columns: 1fr; } }

        .dash-pac-seccion { background: #f8fafc; border: 1px solid #e8edf2; border-radius: 8px; padding: 14px 16px; }
        .dash-pac-seccion.full { grid-column: 1 / -1; }
        .dash-pac-seccion-titulo { font-size: 10.5px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; }

        .dash-pac-titular-total { font-size: 48px; font-weight: 700; color: #1a3a5c; line-height: 1; margin-bottom: 4px; }
        .dash-pac-titular-sub   { font-size: 13px; color: #6b7280; }

        .dash-pac-barra:hover .dash-pac-barra-fill { background: #15304d !important; }

        .dash-pac-donut-wrap { display: flex; align-items: center; gap: 20px; }
        .dash-pac-donut-ring { width: 120px; height: 120px; border-radius: 50%; flex-shrink: 0; position: relative; }
        .dash-pac-donut-hole {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          width: 72px; height: 72px; border-radius: 50%; background: #f8fafc;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .dash-pac-donut-num { font-size: 16px; font-weight: 700; color: #1a3a5c; line-height: 1; }
        .dash-pac-donut-lbl { font-size: 9px; color: #9ca3af; margin-top: 1px; }

        .dash-pac-toggle { display: flex; background: #e8edf2; border-radius: 6px; padding: 2px; gap: 2px; }
        .dash-pac-toggle-btn { padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 500; border: none; background: transparent; color: #6b7280; cursor: pointer; transition: all .15s; }
        .dash-pac-toggle-btn.active { background: #fff; color: #1a3a5c; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.1); }

        .dash-pac-vchart { display: flex; align-items: flex-end; gap: 3px; overflow-x: auto; padding-bottom: 2px; }
        .dash-pac-vcol { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 18px; flex: 1; }
        .dash-pac-vcol-valor { font-size: 11px; color: #1a3a5c; font-weight: 600; min-height: 14px; }
        .dash-pac-vcol-track { flex: 1; width: 100%; display: flex; align-items: flex-end; background: rgba(26,58,92,0.12); border-radius: 2px; overflow: hidden; }
        .dash-pac-vcol-fill  { width: 100%; border-radius: 2px 2px 0 0; transition: height .5s ease; }
        .dash-pac-vcol-label { font-size: 9px; text-align: center; white-space: nowrap; overflow: hidden; max-width: 100%; }

        .dash-pac-tend-svg { width: 100%; height: auto; }

        @media (max-width: 768px) {
          .dash-pac-wrap { padding: 14px; }
          .dash-pac-header h1 { font-size: 18px; }
          .dash-pac-donut-ring { width: 160px; height: 160px; }
          .dash-pac-donut-hole { width: 96px; height: 96px; }
          .dash-pac-donut-num { font-size: 22px; }
          .dash-pac-donut-lbl { font-size: 11px; }
          .dash-pac-tend-svg { height: 160px; }
          .dash-pac-toggle { width: 100%; justify-content: stretch; }
          .dash-pac-toggle-btn { flex: 1; text-align: center; }
        }
      `}</style>

      <div className="dash-pac-wrap">
        <div className="dash-pac-header">
          <div className="dash-pac-header-icon">
            <BarChart2 size={20} color="#1a3a5c" />
          </div>
          <div className="dash-pac-header-text">
            <h1>Dashboard · Pacientes</h1>
            <p>Estadísticas del mes en curso — registros, sexo, edad y origen</p>
          </div>
          <button className="dash-pac-back" onClick={() => navigate('/informes')}>
            <ArrowLeft size={14} /> Volver a Informes
          </button>
        </div>

        {loading && (
          <div className="dash-pac-cargando">Cargando estadísticas…</div>
        )}

        {!loading && data && (
          <>
            <div className="dash-pac-grid2">
              <Seccion titulo={data.mes_label}>
                <div className="dash-pac-titular-total">{fmt(data.total_mes)}</div>
                <div className="dash-pac-titular-sub">
                  {data.total_mes === 1 ? 'paciente registrado' : 'pacientes registrados'}
                </div>
              </Seccion>

              <Seccion titulo="Por sexo">
                <DonutSexo data={data.por_sexo} total={data.total_mes} />
              </Seccion>
            </div>

            <div className="dash-pac-grid2">
              <Seccion titulo="Registros">
                <CalendarioBars
                  porDia={data.por_dia}
                  porSemana={data.por_semana}
                  totalMes={data.total_mes}
                  mesLabel={data.mes_label}
                />
              </Seccion>

              <Seccion titulo="Grupo etario">
                {data.por_grupo_etario.map(r => (
                  <BarraH key={r.label} label={r.label} total={r.total} maximo={maxEtario} />
                ))}
              </Seccion>
            </div>

            <div className="dash-pac-grid2">
              <Seccion titulo="Origen · departamento">
                {data.por_departamento.length === 0
                  ? <div style={{ fontSize: 13, color: '#9ca3af' }}>Sin datos</div>
                  : data.por_departamento.map(r => (
                    <BarraH
                      key={r.id ?? 'otros'}
                      label={r.label}
                      sub={r.pais || undefined}
                      total={r.total}
                      maximo={maxDepto}
                    />
                  ))
                }
              </Seccion>

              <Seccion titulo="Tendencia · últimos 6 meses">
                <TendenciaCurva datos={data.tendencia_6meses} />
              </Seccion>
            </div>
          </>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  )
}
