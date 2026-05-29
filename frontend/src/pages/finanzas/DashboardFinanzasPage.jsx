import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import Toast from '../../components/ui/Toast'
import apiClient from '../../api/client'

function fmtGs(n) {
  if (!n && n !== 0) return '—'
  const abs = Math.abs(Math.round(n))
  return (n < 0 ? '- ₲ ' : '₲ ') + abs.toLocaleString('es-PY')
}

function StatCard({ label, valor, sub, colorValor }) {
  return (
    <div className="dash-fin-stat">
      <div className="dash-fin-stat-label">{label}</div>
      <div className="dash-fin-stat-valor" style={colorValor ? { color: colorValor } : undefined}>{valor}</div>
      {sub && <div className="dash-fin-stat-sub">{sub}</div>}
    </div>
  )
}

function DualBars({ dias }) {
  if (!dias || dias.length === 0) return <p style={{ color: '#9ca3af', fontSize: 12 }}>Sin movimientos este mes.</p>
  const maxVal = Math.max(...dias.flatMap(d => [d.ingresos, d.egresos]), 1)
  return (
    <div className="dash-fin-bars-wrap">
      {dias.map((d, i) => {
        const pctIng = Math.max((d.ingresos / maxVal) * 100, d.ingresos > 0 ? 3 : 0)
        const pctEgr = Math.max((d.egresos  / maxVal) * 100, d.egresos  > 0 ? 3 : 0)
        return (
          <div key={i} className="dash-fin-bar-col" title={`Día ${d.dia} · Ing: ${fmtGs(d.ingresos)} · Egr: ${fmtGs(d.egresos)}`}>
            <div className="dash-fin-bar-track">
              <div className="dash-fin-bar-ing" style={{ height: `${pctIng}%` }} />
              <div className="dash-fin-bar-egr" style={{ height: `${pctEgr}%` }} />
            </div>
            <div className="dash-fin-bar-label">{d.dia}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function DashboardFinanzasPage() {
  const navigate = useNavigate()
  const { toast, showToast } = useToast()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      try {
        const res = await apiClient.get('/cuentas-mcb/dashboard-mensual/')
        setData(res.data)
      } catch {
        showToast('No se pudieron cargar las estadísticas.', 'error')
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const maxSaldo = data ? Math.max(...data.cuentas.map(c => Math.abs(c.saldo)), 1) : 1

  return (
    <>
      <style>{`
        .dash-fin-wrap  { padding: 24px; }
        @media (max-width: 768px) { .dash-fin-wrap { padding: 14px; } }

        .dash-fin-hdr  { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; flex-wrap: wrap; }
        .dash-fin-back { display: flex; align-items: center; gap: 6px; padding: 7px 14px;
                         border: 1px solid #e8edf2; border-radius: 7px; font-size: 13px;
                         color: #374151; cursor: pointer; background: #fff; }
        .dash-fin-back:hover { background: #f0f5fb; }
        .dash-fin-title { font-size: 20px; font-weight: 700; color: #111827; margin: 0; }
        .dash-fin-sub   { font-size: 13px; color: #6b7280; margin-left: auto; }

        .dash-fin-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 22px; }
        @media (max-width: 640px) { .dash-fin-stats { grid-template-columns: 1fr; } }

        .dash-fin-stat { background: #fff; border: 1px solid #e8edf2; border-radius: 10px; padding: 16px 18px; }
        .dash-fin-stat-label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
        .dash-fin-stat-valor { font-size: 22px; font-weight: 700; color: #111827; }
        .dash-fin-stat-sub   { font-size: 11px; color: #9ca3af; margin-top: 4px; }

        .dash-fin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 900px) { .dash-fin-grid { grid-template-columns: 1fr; } }

        .dash-fin-card { background: #fff; border: 1px solid #e8edf2; border-radius: 10px; padding: 16px 18px; }
        .dash-fin-card-title { font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 14px; }

        .dash-fin-cta-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .dash-fin-cta-name { width: 120px; font-size: 12px; color: #374151; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dash-fin-cta-bar-track { flex: 1; height: 10px; background: rgba(26,58,92,0.1); border-radius: 5px; overflow: hidden; }
        .dash-fin-cta-bar-fill  { height: 100%; border-radius: 5px; transition: width .5s ease; }
        .dash-fin-cta-saldo { width: 90px; font-size: 11px; font-weight: 600; text-align: right; flex-shrink: 0; }

        .dash-fin-leyenda { display: flex; gap: 16px; margin-bottom: 10px; flex-wrap: wrap; }
        .dash-fin-leyenda-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #6b7280; }
        .dash-fin-leyenda-dot  { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }

        .dash-fin-bars-wrap { display: flex; gap: 4px; align-items: flex-end; height: 120px; overflow-x: auto; padding-bottom: 4px; }
        .dash-fin-bar-col   { display: flex; flex-direction: column; align-items: center; flex: 1; min-width: 14px; max-width: 32px; }
        .dash-fin-bar-track { display: flex; gap: 2px; align-items: flex-end; height: 100px; width: 100%; }
        .dash-fin-bar-ing   { background: #16a34a; border-radius: 2px 2px 0 0; flex: 1; transition: height .4s ease; min-height: 0; }
        .dash-fin-bar-egr   { background: #dc2626; border-radius: 2px 2px 0 0; flex: 1; transition: height .4s ease; min-height: 0; }
        .dash-fin-bar-label { font-size: 9px; color: #9ca3af; margin-top: 3px; }
      `}</style>

      <div className="dash-fin-wrap">
        <div className="dash-fin-hdr">
          <button className="dash-fin-back" onClick={() => navigate('/informes/stock')}>
            <ArrowLeft size={14} /> Volver
          </button>
          <div>
            <h1 className="dash-fin-title">Dashboard — Finanzas</h1>
          </div>
          {data && <div className="dash-fin-sub">{data.mes.charAt(0).toUpperCase() + data.mes.slice(1)}</div>}
        </div>

        {loading && <p style={{ color: '#6b7280', textAlign: 'center', marginTop: 40 }}>Cargando estadísticas…</p>}

        {data && (
          <>
            <div className="dash-fin-stats">
              <StatCard
                label="Ingresos del mes"
                valor={fmtGs(data.total_ingresos_mes)}
                colorValor="#16a34a"
              />
              <StatCard
                label="Egresos del mes"
                valor={fmtGs(data.total_egresos_mes)}
                colorValor="#dc2626"
              />
              <StatCard
                label="Saldo neto del mes"
                valor={fmtGs(data.saldo_neto_mes)}
                colorValor={data.saldo_neto_mes >= 0 ? '#16a34a' : '#dc2626'}
                sub={data.saldo_neto_mes >= 0 ? 'Positivo' : 'Negativo'}
              />
            </div>

            <div className="dash-fin-grid">
              <div className="dash-fin-card">
                <div className="dash-fin-card-title">Saldo por cuenta</div>
                {data.cuentas.length === 0
                  ? <p style={{ color: '#9ca3af', fontSize: 12 }}>Sin cuentas activas.</p>
                  : data.cuentas.map(c => {
                    const pct = Math.max((Math.abs(c.saldo) / maxSaldo) * 100, c.saldo !== 0 ? 2 : 0)
                    const color = c.saldo >= 0 ? '#16a34a' : '#dc2626'
                    return (
                      <div key={c.id} className="dash-fin-cta-row">
                        <div className="dash-fin-cta-name" title={c.descripcion}>{c.descripcion}</div>
                        <div className="dash-fin-cta-bar-track">
                          <div className="dash-fin-cta-bar-fill" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <div className="dash-fin-cta-saldo" style={{ color }}>{fmtGs(c.saldo)}</div>
                      </div>
                    )
                  })
                }
              </div>

              <div className="dash-fin-card">
                <div className="dash-fin-card-title">Ingresos vs Egresos por día</div>
                <div className="dash-fin-leyenda">
                  <div className="dash-fin-leyenda-item">
                    <div className="dash-fin-leyenda-dot" style={{ background: '#16a34a' }} />
                    Ingresos
                  </div>
                  <div className="dash-fin-leyenda-item">
                    <div className="dash-fin-leyenda-dot" style={{ background: '#dc2626' }} />
                    Egresos
                  </div>
                </div>
                <DualBars dias={data.por_dia} />
              </div>
            </div>
          </>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  )
}
