import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import Toast from '../../components/ui/Toast'
import apiClient from '../../api/client'

function fmtGs(n) {
  if (!n && n !== 0) return '—'
  return '₲ ' + Math.round(n).toLocaleString('es-PY')
}

function StatCard({ label, valor, sub, colorValor }) {
  return (
    <div className="dash-cob-stat">
      <div className="dash-cob-stat-label">{label}</div>
      <div className="dash-cob-stat-valor" style={colorValor ? { color: colorValor } : undefined}>{valor}</div>
      {sub && <div className="dash-cob-stat-sub">{sub}</div>}
    </div>
  )
}

function BarraH({ label, total, maximo }) {
  const pct = maximo > 0 ? Math.max((total / maximo) * 100, total > 0 ? 2 : 0) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ width: 130, fontSize: 12, color: '#374151', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={label}>{label}</div>
      <div style={{ flex: 1, height: 10, background: 'rgba(26,58,92,0.1)', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#dc2626', borderRadius: 5, transition: 'width .5s ease' }} />
      </div>
      <div style={{ width: 100, fontSize: 11, fontWeight: 600, color: '#dc2626', textAlign: 'right', flexShrink: 0 }}>
        {fmtGs(total)}
      </div>
    </div>
  )
}

function CobradoBars({ dias }) {
  if (!dias || dias.length === 0) return <p style={{ color: '#9ca3af', fontSize: 12 }}>Sin cobranzas este mes.</p>
  const maxVal = Math.max(...dias.map(d => d.total), 1)
  return (
    <div className="dash-cob-bars-wrap">
      {dias.map((d, i) => {
        const pct = Math.max((d.total / maxVal) * 100, d.total > 0 ? 4 : 0)
        return (
          <div key={i} className="dash-cob-bar-col" title={`Día ${d.dia} · ${fmtGs(d.total)} · ${d.cantidad} recibo${d.cantidad !== 1 ? 's' : ''}`}>
            {d.total > 0 && <div className="dash-cob-bar-valor">{d.cantidad}</div>}
            <div className="dash-cob-bar-track">
              <div className="dash-cob-bar-fill" style={{ height: `${pct}%` }} />
            </div>
            <div className="dash-cob-bar-label">{d.dia}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function DashboardCobranzasPage() {
  const navigate = useNavigate()
  const { toast, showToast } = useToast()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      try {
        const res = await apiClient.get('/cobranzas/dashboard-mensual/')
        setData(res.data)
      } catch {
        showToast('No se pudieron cargar las estadísticas.', 'error')
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const pctCobro = data && data.total_facturado > 0
    ? Math.min(100, (data.total_cobrado_mes / data.total_facturado) * 100).toFixed(1)
    : null

  const maxDeuda = data ? Math.max(...(data.top_deudores || []).map(t => t.deuda), 1) : 1

  return (
    <>
      <style>{`
        .dash-cob-wrap  { padding: 24px; }
        @media (max-width: 768px) { .dash-cob-wrap { padding: 14px; } }

        .dash-cob-hdr  { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; flex-wrap: wrap; }
        .dash-cob-back { display: flex; align-items: center; gap: 6px; padding: 7px 14px;
                         border: 1px solid #e8edf2; border-radius: 7px; font-size: 13px;
                         color: #374151; cursor: pointer; background: #fff; }
        .dash-cob-back:hover { background: #f0f5fb; }
        .dash-cob-title { font-size: 20px; font-weight: 700; color: #111827; margin: 0; }
        .dash-cob-sub   { font-size: 13px; color: #6b7280; margin-left: auto; }

        .dash-cob-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 22px; }
        @media (max-width: 900px) { .dash-cob-stats { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .dash-cob-stats { grid-template-columns: 1fr; } }

        .dash-cob-stat { background: #fff; border: 1px solid #e8edf2; border-radius: 10px; padding: 16px 18px; }
        .dash-cob-stat-label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
        .dash-cob-stat-valor { font-size: 20px; font-weight: 700; color: #111827; }
        .dash-cob-stat-sub   { font-size: 11px; color: #9ca3af; margin-top: 4px; }

        .dash-cob-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 900px) { .dash-cob-grid { grid-template-columns: 1fr; } }

        .dash-cob-card { background: #fff; border: 1px solid #e8edf2; border-radius: 10px; padding: 16px 18px; }
        .dash-cob-card-title { font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 14px; }

        .dash-cob-bars-wrap { display: flex; gap: 3px; align-items: flex-end; height: 120px; overflow-x: auto; padding-bottom: 4px; }
        .dash-cob-bar-col   { display: flex; flex-direction: column; align-items: center; flex: 1; min-width: 12px; max-width: 28px; }
        .dash-cob-bar-valor { font-size: 8px; color: #1a3a5c; font-weight: 600; margin-bottom: 1px; }
        .dash-cob-bar-track { display: flex; align-items: flex-end; height: 100px; width: 100%; }
        .dash-cob-bar-fill  { width: 100%; background: #1a3a5c; border-radius: 2px 2px 0 0; transition: height .4s ease; min-height: 0; }
        .dash-cob-bar-label { font-size: 9px; color: #9ca3af; margin-top: 3px; }

        .dash-cob-pct-track { height: 10px; background: #e8edf2; border-radius: 5px; overflow: hidden; margin: 8px 0; }
        .dash-cob-pct-fill  { height: 100%; background: #1a3a5c; border-radius: 5px; transition: width .6s ease; }
        .dash-cob-pct-label { font-size: 11px; color: #6b7280; display: flex; justify-content: space-between; }
      `}</style>

      <div className="dash-cob-wrap">
        <div className="dash-cob-hdr">
          <button className="dash-cob-back" onClick={() => navigate('/informes/stock')}>
            <ArrowLeft size={14} /> Volver
          </button>
          <div>
            <h1 className="dash-cob-title">Dashboard — Cobranzas</h1>
          </div>
          {data && <div className="dash-cob-sub">{data.mes.charAt(0).toUpperCase() + data.mes.slice(1)}</div>}
        </div>

        {loading && <p style={{ color: '#6b7280', textAlign: 'center', marginTop: 40 }}>Cargando estadísticas…</p>}

        {data && (
          <>
            <div className="dash-cob-stats">
              <StatCard
                label="Cobrado este mes"
                valor={fmtGs(data.total_cobrado_mes)}
                colorValor="#16a34a"
                sub={`${data.cantidad_recibos_mes} recibo${data.cantidad_recibos_mes !== 1 ? 's' : ''}`}
              />
              <StatCard
                label="Saldo pendiente total"
                valor={fmtGs(data.total_pendiente)}
                colorValor="#dc2626"
              />
              <StatCard
                label="Total facturado (crédito)"
                valor={fmtGs(data.total_facturado)}
              />
              <StatCard
                label="% Cobrado / Facturado"
                valor={pctCobro !== null ? `${pctCobro}%` : '—'}
                colorValor={pctCobro >= 80 ? '#16a34a' : pctCobro >= 50 ? '#d97706' : '#dc2626'}
              />
            </div>

            <div className="dash-cob-grid">
              <div className="dash-cob-card">
                <div className="dash-cob-card-title">Cobrado por día del mes</div>
                <CobradoBars dias={data.por_dia} />
              </div>

              <div className="dash-cob-card">
                <div className="dash-cob-card-title">Top deudores</div>
                {data.top_deudores.length === 0
                  ? <p style={{ color: '#9ca3af', fontSize: 12 }}>Sin deuda pendiente.</p>
                  : data.top_deudores.map((t, i) => (
                    <BarraH key={i} label={t.nombre} total={t.deuda} maximo={maxDeuda} />
                  ))
                }
                {data.total_facturado > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div className="dash-cob-pct-label">
                      <span>Cobrado vs Facturado</span>
                      <span>{pctCobro}%</span>
                    </div>
                    <div className="dash-cob-pct-track">
                      <div className="dash-cob-pct-fill" style={{ width: `${pctCobro}%` }} />
                    </div>
                    <div className="dash-cob-pct-label">
                      <span style={{ color: '#16a34a' }}>{fmtGs(data.total_cobrado_mes)} cobrado</span>
                      <span style={{ color: '#dc2626' }}>{fmtGs(data.total_pendiente)} pendiente</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  )
}
