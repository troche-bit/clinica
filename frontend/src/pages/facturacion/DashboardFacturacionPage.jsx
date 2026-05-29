import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart2 } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import Toast from '../../components/ui/Toast'
import apiClient from '../../api/client'

function fmtGs(n) {
  if (!n && n !== 0) return '—'
  return '₲ ' + Math.round(n).toLocaleString('es-PY')
}

function fmt(n) {
  return (n ?? 0).toLocaleString('es-PY')
}

function StatCard({ label, valor, sub, color }) {
  return (
    <div className="dash-fac-stat">
      <div className="dash-fac-stat-label">{label}</div>
      <div className="dash-fac-stat-valor" style={color ? { color } : undefined}>{valor}</div>
      {sub && <div className="dash-fac-stat-sub">{sub}</div>}
    </div>
  )
}

function BarraH({ label, sub, total, maximo }) {
  const pct = maximo > 0 ? Math.max((total / maximo) * 100, total > 0 ? 2 : 0) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ width: 120, fontSize: 12, color: '#374151', flexShrink: 0, lineHeight: 1.2 }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: '#9ca3af' }}>{sub}</div>}
      </div>
      <div style={{ flex: 1, height: 10, background: 'rgba(26,58,92,0.12)', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#1a3a5c', borderRadius: 5, transition: 'width .5s ease' }} />
      </div>
      <div style={{ width: 32, fontSize: 11, fontWeight: 600, color: '#1a3a5c', textAlign: 'right', flexShrink: 0 }}>{total}</div>
    </div>
  )
}

function FacturasBars({ porDia, porSemana, porMes }) {
  const [vista, setVista] = useState('dia')
  const datos = vista === 'dia' ? porDia : vista === 'semana' ? porSemana : porMes
  const maximo = Math.max(...datos.map(d => d.total), 1)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Facturas emitidas
        </div>
        <div className="dash-fac-toggle">
          {['dia', 'semana', 'mes'].map(v => (
            <button key={v} className={`dash-fac-toggle-btn${vista === v ? ' active' : ''}`} onClick={() => setVista(v)}>
              {v === 'dia' ? 'Día' : v === 'semana' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>
      <div className="dash-fac-vchart">
        {datos.map((d, i) => {
          const total   = d.total ?? 0
          const contado = d.contado ?? 0
          const credito = d.credito ?? 0
          const futuro  = d.es_futuro
          const pctTotal   = maximo > 0 ? Math.max((total / maximo) * 100, total > 0 ? 4 : 0) : 0
          const pctContado = total > 0 ? (contado / total) * 100 : 0
          const pctCredito = total > 0 ? (credito / total) * 100 : 0
          const lbl = vista === 'dia' ? String(d.dia ?? d.label_corto) : (vista === 'semana' ? d.label_corto : d.label_corto)
          return (
            <div key={i} className="dash-fac-vcol" title={`${total} factura${total !== 1 ? 's' : ''} — Contado: ${contado} / Crédito: ${credito}`}>
              {!futuro && <div className="dash-fac-vcol-valor">{total > 0 ? total : ''}</div>}
              <div className="dash-fac-vcol-track">
                {!futuro && total > 0 ? (
                  <div style={{ width: '100%', height: `${pctTotal}%`, display: 'flex', flexDirection: 'column', borderRadius: '2px 2px 0 0', overflow: 'hidden' }}>
                    <div style={{ flex: pctContado, background: '#1a3a5c', minHeight: contado > 0 ? 2 : 0 }} />
                    <div style={{ flex: pctCredito, background: '#d97706', minHeight: credito > 0 ? 2 : 0 }} />
                  </div>
                ) : (
                  <div style={{ width: '100%', height: futuro ? '4%' : '0%', background: 'rgba(26,58,92,0.08)', borderRadius: 2 }} />
                )}
              </div>
              <div className="dash-fac-vcol-label" style={{ color: futuro ? '#d1d5db' : '#9ca3af' }}>{lbl}</div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: '#6b7280' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#1a3a5c', display: 'inline-block' }} />
          Contado
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#d97706', display: 'inline-block' }} />
          Crédito
        </span>
      </div>
    </div>
  )
}

function DonutCondicion({ contado, credito }) {
  const total = contado + credito
  if (total === 0) return <div style={{ color: '#9ca3af', fontSize: 13, padding: '16px 0' }}>Sin datos</div>

  const pctContado = (contado / total) * 100
  const pctCredito = (credito / total) * 100

  const gradiente = `#1a3a5c 0% ${pctContado.toFixed(1)}%, #d97706 ${pctContado.toFixed(1)}% 100%`

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ width: 110, height: 110, borderRadius: '50%', background: `conic-gradient(${gradiente})`, position: 'relative', flexShrink: 0 }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 66, height: 66, borderRadius: '50%', background: '#f8fafc',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a3a5c', lineHeight: 1 }}>{fmt(total)}</div>
          <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>total</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#1a3a5c', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#374151' }}>Contado</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginLeft: 6 }}>{contado}</span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{pctContado.toFixed(0)}%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#d97706', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#374151' }}>Crédito</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginLeft: 6 }}>{credito}</span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{pctCredito.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  )
}

function Seccion({ titulo, children, full }) {
  return (
    <div className={`dash-fac-seccion${full ? ' full' : ''}`}>
      <div className="dash-fac-seccion-titulo">{titulo}</div>
      {children}
    </div>
  )
}

function FilaTotales({ label, valor, monto, bold }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f3f4f6', gap: 8 }}>
      <div style={{ flex: 1, fontSize: bold ? 13 : 12, fontWeight: bold ? 700 : 400, color: bold ? '#111827' : '#374151' }}>{label}</div>
      <div style={{ fontSize: bold ? 13 : 12, fontWeight: bold ? 700 : 600, color: '#1a3a5c', minWidth: 30, textAlign: 'right' }}>{valor}</div>
      {monto !== undefined && (
        <div style={{ fontSize: 11, color: '#6b7280', minWidth: 100, textAlign: 'right' }}>{fmtGs(monto)}</div>
      )}
    </div>
  )
}

export default function DashboardFacturacionPage() {
  const navigate = useNavigate()
  const { toast, showToast } = useToast()

  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      try {
        const res = await apiClient.get('/facturacion/dashboard-mensual/')
        setData(res.data)
      } catch {
        showToast('No se pudieron cargar las estadísticas.', 'error')
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const maxCliente = data ? Math.max(...data.top_clientes.map(c => c.total_facturas), 1) : 1

  return (
    <>
      <style>{`
        .dash-fac-wrap { padding: 24px; }

        .dash-fac-back {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 12px; font-weight: 500; color: #fff;
          background: #1a3a5c; border: none; border-radius: 8px;
          cursor: pointer; padding: 8px 16px; flex-shrink: 0;
          transition: background .15s; align-self: flex-start;
        }
        .dash-fac-back:hover { background: #15304d; }

        .dash-fac-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
        .dash-fac-header-icon { width: 42px; height: 42px; background: #eef2f7; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .dash-fac-header-text { flex: 1; }
        .dash-fac-header h1 { font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 3px; }
        .dash-fac-header p  { font-size: 13px; color: #6b7280; margin: 0; }

        .dash-fac-cargando { display: flex; align-items: center; justify-content: center; height: 200px; color: #6b7280; font-size: 14px; }

        .dash-fac-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px; }
        @media (max-width: 900px) { .dash-fac-stats { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 500px) { .dash-fac-stats { grid-template-columns: 1fr; } }

        .dash-fac-stat { background: #f8fafc; border: 1px solid #e8edf2; border-radius: 8px; padding: 14px 16px; }
        .dash-fac-stat-label { font-size: 10.5px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; }
        .dash-fac-stat-valor { font-size: 26px; font-weight: 700; color: #1a3a5c; line-height: 1; }
        .dash-fac-stat-sub   { font-size: 11px; color: #9ca3af; margin-top: 3px; }

        .dash-fac-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; align-items: stretch; }
        @media (max-width: 768px) { .dash-fac-grid2 { grid-template-columns: 1fr; } }

        .dash-fac-seccion { background: #f8fafc; border: 1px solid #e8edf2; border-radius: 8px; padding: 14px 16px; margin-bottom: 14px; }
        .dash-fac-seccion.full { grid-column: 1 / -1; }
        .dash-fac-seccion-titulo { font-size: 10.5px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; }

        .dash-fac-toggle { display: flex; background: #e8edf2; border-radius: 6px; padding: 2px; gap: 2px; }
        .dash-fac-toggle-btn { padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 500; border: none; background: transparent; color: #6b7280; cursor: pointer; transition: all .15s; }
        .dash-fac-toggle-btn.active { background: #fff; color: #1a3a5c; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.1); }

        .dash-fac-vchart { display: flex; align-items: flex-end; gap: 3px; overflow-x: auto; padding-bottom: 2px; height: 120px; }
        .dash-fac-vcol { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 18px; flex: 1; height: 100%; }
        .dash-fac-vcol-valor { font-size: 11px; color: #1a3a5c; font-weight: 600; min-height: 14px; flex-shrink: 0; }
        .dash-fac-vcol-track { flex: 1; width: 100%; display: flex; align-items: flex-end; background: rgba(26,58,92,0.07); border-radius: 2px; overflow: hidden; }
        .dash-fac-vcol-label { font-size: 9px; text-align: center; white-space: nowrap; overflow: hidden; max-width: 100%; flex-shrink: 0; }

        @media (max-width: 768px) {
          .dash-fac-wrap { padding: 14px; }
          .dash-fac-header h1 { font-size: 18px; }
          .dash-fac-toggle { width: 100%; justify-content: stretch; }
          .dash-fac-toggle-btn { flex: 1; text-align: center; }
        }
      `}</style>

      <div className="dash-fac-wrap">
        <div className="dash-fac-header">
          <div className="dash-fac-header-icon">
            <BarChart2 size={20} color="#1a3a5c" />
          </div>
          <div className="dash-fac-header-text">
            <h1>Dashboard · Facturación</h1>
            <p>Estadísticas de comprobantes emitidos — actividad diaria, condición y clientes</p>
          </div>
          <button className="dash-fac-back" onClick={() => navigate('/informes/stock')}>
            <ArrowLeft size={14} /> Volver a Informes
          </button>
        </div>

        {loading && (
          <div className="dash-fac-cargando">Cargando estadísticas…</div>
        )}

        {!loading && data && (
          <>
            <div className="dash-fac-stats">
              <StatCard
                label="Emitidas hoy"
                valor={fmt(data.stats_hoy.total)}
                sub={data.stats_hoy.total === 1 ? 'factura' : 'facturas'}
              />
              <StatCard
                label="Monto hoy"
                valor={fmtGs(data.stats_hoy.monto_total)}
                sub={`Contado: ${fmtGs(data.stats_hoy.monto_contado)} · Crédito: ${fmtGs(data.stats_hoy.monto_credito)}`}
              />
              <StatCard
                label="Anuladas hoy"
                valor={fmt(data.stats_hoy.anuladas)}
                sub="comprobantes anulados"
                color={data.stats_hoy.anuladas > 0 ? '#dc2626' : undefined}
              />
              <StatCard
                label="Ticket promedio"
                valor={fmtGs(data.totales_mes.ticket_promedio)}
                sub={`del mes de ${data.mes_label}`}
              />
            </div>

            <Seccion titulo={`Evolución — ${data.mes_label}`}>
              <FacturasBars
                porDia={data.por_dia}
                porSemana={data.por_semana}
                porMes={data.por_mes}
              />
            </Seccion>

            <div className="dash-fac-grid2">
              <Seccion titulo={`Resumen del mes — ${data.mes_label}`}>
                <FilaTotales label="Total emitidas" valor={data.totales_mes.total_facturas} monto={data.totales_mes.monto_total} bold />
                <FilaTotales label="Contado" valor={data.totales_mes.contado} monto={data.totales_mes.monto_contado} />
                <FilaTotales label="Crédito" valor={data.totales_mes.credito} monto={data.totales_mes.monto_credito} />
                <FilaTotales label="Anuladas" valor={data.totales_mes.anuladas} />
                <div style={{ marginTop: 8, fontSize: 11, color: '#9ca3af' }}>
                  Ticket promedio: {fmtGs(data.totales_mes.ticket_promedio)}
                </div>
              </Seccion>

              <Seccion titulo={`Condición — ${data.mes_label}`}>
                <DonutCondicion
                  contado={data.totales_mes.contado}
                  credito={data.totales_mes.credito}
                />
              </Seccion>
            </div>

            {data.top_clientes.length > 0 && (
              <Seccion titulo={`Top clientes — ${data.mes_label}`}>
                {data.top_clientes.map((c, i) => (
                  <BarraH
                    key={i}
                    label={c.cliente}
                    sub={fmtGs(c.monto_total)}
                    total={c.total_facturas}
                    maximo={maxCliente}
                  />
                ))}
              </Seccion>
            )}
          </>
        )}
      </div>

      <Toast {...toast} />
    </>
  )
}
