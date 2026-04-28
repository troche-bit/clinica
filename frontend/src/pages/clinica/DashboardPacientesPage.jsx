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

function BarraH({ label, sub, total, maximo, color = '#1a3a5c' }) {
  const pct = maximo > 0 ? Math.max((total / maximo) * 100, total > 0 ? 2 : 0) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ width: 100, fontSize: 12, color: '#374151', flexShrink: 0, lineHeight: 1.2 }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: '#9ca3af' }}>{sub}</div>}
      </div>
      <div style={{ flex: 1, height: 10, background: '#f0f4f8', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 5, transition: 'width .5s ease' }} />
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
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
                    background: futuro ? '#e8edf2' : '#1a3a5c',
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
        <div style={{ width: 110, height: 110, borderRadius: '50%', background: `conic-gradient(${gradiente})` }} />
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 60, height: 60, borderRadius: '50%', background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: '#1a3a5c',
        }}>
          {fmt(total)}
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
  const W = 100, H = 60, PX = 6, PY = 8
  const maximo = Math.max(...datos.map(d => d.total), 1)
  const pts = datos.map((d, i) => ({
    x: PX + (i / (datos.length - 1)) * (W - PX * 2),
    y: PY + (1 - d.total / maximo) * (H - PY * 2),
    ...d,
  }))
  const curva = pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    const prev = pts[i - 1]
    const cpx  = ((prev.x + p.x) / 2).toFixed(1)
    return acc + ` C ${cpx} ${prev.y.toFixed(1)} ${cpx} ${p.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }, '')
  const area = `${curva} L ${pts[pts.length-1].x.toFixed(1)} ${H - PY} L ${pts[0].x.toFixed(1)} ${H - PY} Z`

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80, display: 'block', overflow: 'visible' }}>
        {[0, 0.5, 1].map(t => (
          <line key={t}
            x1={PX} x2={W - PX}
            y1={(PY + (1 - t) * (H - PY * 2)).toFixed(1)}
            y2={(PY + (1 - t) * (H - PY * 2)).toFixed(1)}
            stroke="#e8edf2" strokeWidth=".8"
          />
        ))}
        <path d={area}  fill="#1a3a5c" fillOpacity=".07" />
        <path d={curva} fill="none" stroke="#1a3a5c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="2.2" fill="#1a3a5c" />
            {p.total > 0 && (
              <text x={p.x.toFixed(1)} y={(p.y - 4).toFixed(1)} textAnchor="middle" fontSize="4.5" fill="#374151">{p.total}</text>
            )}
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px 0' }}>
        {datos.map(d => (
          <div key={d.periodo} style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center', flex: 1 }}>{d.label}</div>
        ))}
      </div>
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
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; color: #6b7280; background: none; border: none;
          cursor: pointer; padding: 0; margin-bottom: 20px;
          transition: color .15s;
        }
        .dash-pac-back:hover { color: #1a3a5c; }

        .dash-pac-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
        .dash-pac-header-icon { width: 42px; height: 42px; background: #eef2f7; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .dash-pac-header h1 { font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 3px; }
        .dash-pac-header p  { font-size: 13px; color: #6b7280; margin: 0; }

        .dash-pac-cargando { display: flex; align-items: center; justify-content: center; height: 200px; color: #6b7280; font-size: 14px; }

        .dash-pac-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
        @media (max-width: 640px) { .dash-pac-grid2 { grid-template-columns: 1fr; } }

        .dash-pac-seccion { background: #f8fafc; border: 1px solid #e8edf2; border-radius: 8px; padding: 16px 18px; }
        .dash-pac-seccion.full { grid-column: 1 / -1; }
        .dash-pac-seccion-titulo { font-size: 10.5px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; }

        .dash-pac-titular-total { font-size: 52px; font-weight: 700; color: #1a3a5c; line-height: 1; margin-bottom: 6px; }
        .dash-pac-titular-sub   { font-size: 13px; color: #6b7280; }

        .dash-pac-toggle { display: flex; background: #e8edf2; border-radius: 6px; padding: 2px; gap: 2px; }
        .dash-pac-toggle-btn { padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 500; border: none; background: transparent; color: #6b7280; cursor: pointer; transition: all .15s; }
        .dash-pac-toggle-btn.active { background: #fff; color: #1a3a5c; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.1); }

        .dash-pac-vchart { display: flex; align-items: flex-end; gap: 3px; overflow-x: auto; padding-bottom: 2px; }
        .dash-pac-vcol { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 18px; flex: 1; }
        .dash-pac-vcol-valor { font-size: 9px; color: #374151; font-weight: 600; min-height: 12px; }
        .dash-pac-vcol-track { flex: 1; width: 100%; display: flex; align-items: flex-end; }
        .dash-pac-vcol-fill  { width: 100%; border-radius: 2px 2px 0 0; transition: height .5s ease; }
        .dash-pac-vcol-label { font-size: 9px; text-align: center; white-space: nowrap; overflow: hidden; max-width: 100%; }
      `}</style>

      <div className="dash-pac-wrap">
        <button className="dash-pac-back" onClick={() => navigate('/informes')}>
          <ArrowLeft size={15} /> Volver a Informes
        </button>

        <div className="dash-pac-header">
          <div className="dash-pac-header-icon">
            <BarChart2 size={20} color="#1a3a5c" />
          </div>
          <div>
            <h1>Dashboard · Pacientes</h1>
            <p>Estadísticas del mes en curso — registros, sexo, edad y origen</p>
          </div>
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
                  <BarraH key={r.label} label={r.label} total={r.total} maximo={maxEtario} color="#4b7ab0" />
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
