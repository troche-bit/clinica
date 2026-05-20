import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, UserCheck } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import Toast from '../../components/ui/Toast'
import apiClient from '../../api/client'

function BarraH({ label, total, maximo, sub }) {
  const pct = maximo > 0 ? Math.max((total / maximo) * 100, total > 0 ? 2 : 0) : 0
  return (
    <div className="dash-prest-barra" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ width: 110, fontSize: 12, color: '#374151', flexShrink: 0, lineHeight: 1.2 }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        {sub != null && <div style={{ fontSize: 10, color: '#9ca3af' }}>{sub}% ocup.</div>}
      </div>
      <div style={{ flex: 1, height: 10, background: 'rgba(26,58,92,0.12)', borderRadius: 5, overflow: 'hidden' }}>
        <div className="dash-prest-barra-fill" style={{ width: `${pct}%`, height: '100%', background: '#1a3a5c', borderRadius: 5, transition: 'width .5s ease' }} />
      </div>
      <div style={{ width: 28, fontSize: 11, fontWeight: 600, color: '#1a3a5c', textAlign: 'right', flexShrink: 0 }}>{total}</div>
    </div>
  )
}

function BarrasVerticales({ datos, colorFn }) {
  if (!datos || datos.length === 0) return <div style={{ color: '#9ca3af', fontSize: 13 }}>Sin datos</div>
  const maximo = Math.max(...datos.map(d => d.total), 1)
  return (
    <div className="dash-prest-vchart">
      {datos.map((d, i) => {
        const pct = Math.max((d.total / maximo) * 100, d.total > 0 ? 4 : 0)
        const color = colorFn ? colorFn(i) : '#1a3a5c'
        return (
          <div key={i} className="dash-prest-vcol-group">
            <div className="dash-prest-vcol-vals">
              <div className="dash-prest-vcol">
                <div className="dash-prest-vcol-valor">{d.total > 0 ? d.total : ''}</div>
                <div className="dash-prest-vcol-track">
                  <div className="dash-prest-vcol-bar" style={{ height: `${pct}%`, background: color }} />
                </div>
              </div>
            </div>
            <div className="dash-prest-vcol-lbl">{d.label ?? d.dia}</div>
          </div>
        )
      })}
    </div>
  )
}

function OcupacionGauge({ pct }) {
  const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
        <div style={{
          width: 100, height: 100, borderRadius: '50%',
          background: `conic-gradient(${color} 0% ${pct}%, rgba(26,58,92,0.12) ${pct}% 100%)`,
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 64, height: 64, borderRadius: '50%', background: '#f8fafc',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{pct}%</div>
            <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>ocup.</div>
          </div>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>Ocupación promedio del mes</div>
        <div style={{ fontSize: 11, color: '#6b7280' }}>
          {pct >= 70 ? 'Excelente — alta demanda' : pct >= 40 ? 'Normal — demanda moderada' : 'Baja ocupación este mes'}
        </div>
      </div>
    </div>
  )
}

function Seccion({ titulo, children, full }) {
  return (
    <div className={`dash-prest-seccion${full ? ' full' : ''}`}>
      <div className="dash-prest-seccion-titulo">{titulo}</div>
      {children}
    </div>
  )
}

const DIAS_COLORS = ['#1a3a5c','#2563eb','#7c3aed','#0891b2','#16a34a','#d97706','#dc2626']

export default function DashboardPrestadoresPage() {
  const navigate = useNavigate()
  const { toast, showToast } = useToast()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      try {
        const res = await apiClient.get('/agenda/dashboard-prestadores/')
        setData(res.data)
      } catch {
        showToast('No se pudieron cargar las estadísticas.', 'error')
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const maxMedico = data ? Math.max(...data.turnos_por_medico.map(m => m.realizados), 1) : 1
  const maxEsp    = data ? Math.max(...data.comparativa_especialidades.map(e => e.total), 1) : 1

  return (
    <>
      <style>{`
        .dash-prest-wrap { padding: 24px; }

        .dash-prest-back {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 12px; font-weight: 500; color: #fff;
          background: #1a3a5c; border: none; border-radius: 8px;
          cursor: pointer; padding: 8px 16px; flex-shrink: 0;
          transition: background .15s; align-self: flex-start;
        }
        .dash-prest-back:hover { background: #15304d; }

        .dash-prest-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
        .dash-prest-header-icon { width: 42px; height: 42px; background: #eef2f7; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .dash-prest-header-text { flex: 1; }
        .dash-prest-header h1 { font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 3px; }
        .dash-prest-header p  { font-size: 13px; color: #6b7280; margin: 0; }

        .dash-prest-cargando { display: flex; align-items: center; justify-content: center; height: 200px; color: #6b7280; font-size: 14px; }

        .dash-prest-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; align-items: stretch; }
        @media (max-width: 768px) { .dash-prest-grid2 { grid-template-columns: 1fr; } }

        .dash-prest-seccion { background: #f8fafc; border: 1px solid #e8edf2; border-radius: 8px; padding: 14px 16px; }
        .dash-prest-seccion.full { grid-column: 1 / -1; }
        .dash-prest-seccion-titulo { font-size: 10.5px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; }

        .dash-prest-total { font-size: 48px; font-weight: 700; color: #1a3a5c; line-height: 1; margin-bottom: 4px; }
        .dash-prest-total-sub { font-size: 13px; color: #6b7280; }

        .dash-prest-barra:hover .dash-prest-barra-fill { background: #15304d !important; }

        .dash-prest-vchart { display: flex; align-items: flex-end; gap: 4px; height: 100px; }
        .dash-prest-vcol-group { display: flex; flex-direction: column; align-items: center; flex: 1; gap: 3px; }
        .dash-prest-vcol-vals { display: flex; align-items: flex-end; gap: 2px; width: 100%; height: 80px; }
        .dash-prest-vcol { display: flex; flex-direction: column; align-items: center; flex: 1; gap: 2px; height: 100%; }
        .dash-prest-vcol-valor { font-size: 11px; font-weight: 600; color: #1a3a5c; min-height: 14px; text-align: center; }
        .dash-prest-vcol-track { flex: 1; width: 100%; display: flex; align-items: flex-end; background: rgba(26,58,92,0.12); border-radius: 3px; overflow: hidden; }
        .dash-prest-vcol-bar { width: 100%; border-radius: 3px; transition: height .5s ease; min-height: 2px; }
        .dash-prest-vcol-lbl { font-size: 9px; color: #9ca3af; text-align: center; }

        .dash-prest-medico-row {
          display: flex; align-items: center; gap: 8px;
          padding: 7px 0; border-bottom: 1px solid #f0f4f8;
        }
        .dash-prest-medico-row:last-child { border-bottom: none; }
        .dash-prest-medico-nombre { font-size: 12px; color: #374151; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dash-prest-medico-pct {
          font-size: 11px; font-weight: 700; color: #fff;
          background: #1a3a5c; border-radius: 4px; padding: 1px 6px; flex-shrink: 0;
        }
        .dash-prest-medico-num { font-size: 11px; color: #6b7280; flex-shrink: 0; width: 28px; text-align: right; }

        @media (max-width: 768px) {
          .dash-prest-wrap { padding: 14px; }
          .dash-prest-header h1 { font-size: 18px; }
          .dash-prest-vchart { height: 140px; }
          .dash-prest-vcol-vals { height: 110px; }
        }
      `}</style>

      <div className="dash-prest-wrap">
        <div className="dash-prest-header">
          <div className="dash-prest-header-icon"><UserCheck size={20} color="#1a3a5c" /></div>
          <div className="dash-prest-header-text">
            <h1>Dashboard · Prestadores</h1>
            <p>Actividad del mes en curso — turnos, ocupación y demanda por especialidad</p>
          </div>
          <button className="dash-prest-back" onClick={() => navigate('/informes')}>
            <ArrowLeft size={14} /> Volver a Informes
          </button>
        </div>

        {loading && <div className="dash-prest-cargando">Cargando estadísticas…</div>}

        {!loading && data && (
          <>
            <div className="dash-prest-grid2">
              <Seccion titulo="Total de turnos del mes">
                <div className="dash-prest-total">{data.total_mes}</div>
                <div className="dash-prest-total-sub">
                  {data.total_mes === 1 ? 'turno registrado' : 'turnos registrados'}
                </div>
              </Seccion>

              <Seccion titulo="Ocupación promedio">
                <OcupacionGauge pct={data.ocupacion_promedio} />
              </Seccion>
            </div>

            <div className="dash-prest-grid2">
              <Seccion titulo="Turnos realizados por médico">
                {data.turnos_por_medico.length === 0
                  ? <div style={{ color: '#9ca3af', fontSize: 13 }}>Sin datos</div>
                  : data.turnos_por_medico.map((m, i) => (
                    <div className="dash-prest-medico-row" key={i}>
                      <div className="dash-prest-medico-nombre">{m.nombre}</div>
                      <div style={{ flex: 1, height: 6, background: 'rgba(26,58,92,0.12)', borderRadius: 3, overflow: 'hidden', maxWidth: 80 }}>
                        <div style={{ width: `${Math.max((m.realizados / maxMedico) * 100, m.realizados > 0 ? 4 : 0)}%`, height: '100%', background: '#1a3a5c', borderRadius: 3, transition: 'width .5s ease' }} />
                      </div>
                      <div className="dash-prest-medico-num">{m.realizados}</div>
                      <div className="dash-prest-medico-pct">{m.pct_ocupacion}%</div>
                    </div>
                  ))
                }
              </Seccion>

              <Seccion titulo="Comparativa por especialidad">
                {data.comparativa_especialidades.length === 0
                  ? <div style={{ color: '#9ca3af', fontSize: 13 }}>Sin datos</div>
                  : data.comparativa_especialidades.map((e, i) => (
                    <BarraH key={i} label={e.especialidad} total={e.total} maximo={maxEsp} />
                  ))
                }
              </Seccion>
            </div>

            <div className="dash-prest-grid2">
              <Seccion titulo="Días más demandados">
                <BarrasVerticales datos={data.dias_mas_demandados} colorFn={i => DIAS_COLORS[i % DIAS_COLORS.length]} />
              </Seccion>

              <Seccion titulo="Horarios más demandados">
                {data.horarios_mas_demandados.length === 0
                  ? <div style={{ color: '#9ca3af', fontSize: 13 }}>Sin datos</div>
                  : data.horarios_mas_demandados.map((h, i) => (
                    <BarraH key={i} label={h.hora} total={h.total} maximo={Math.max(...data.horarios_mas_demandados.map(x => x.total), 1)} />
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
