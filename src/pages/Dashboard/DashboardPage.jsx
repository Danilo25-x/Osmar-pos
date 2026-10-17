// src/pages/Dashboard/DashboardPage.jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet, CalendarDays, TriangleAlert, PackageX, ChartLine, CircleCheck, Lock, Vault } from 'lucide-react'
import PageContainer from '../../components/UI/PageContainer'
import StatsCard from '../../components/UI/StatsCard'
import AreaChart from '../../components/UI/AreaChart'
import EmptyState from '../../components/UI/EmptyState'
import PrimaryButton from '../../components/UI/PrimaryButton'
import { useAuthStore } from '../../store/authStore'
import { fmt, cap } from '../../utils/format'

const fmtShort = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }).replace('.', '') : ''
const fmtLong = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) : ''
const METODO_LABELS = { efectivo: 'Efectivo', transferencia: 'Transferencia', credito: 'Crédito interno', sistecredito: 'Sistecrédito' }

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const { user, hasPermission } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    window.electronAPI.reports.getDashboard().then(r => {
      if (r.ok) setData(r.data)
      setLoading(false)
    })
  }, [])

  if (loading) return <PageContainer title="Inicio"><div className="loading" role="status"><div className="spinner" />Cargando...</div></PageContainer>
  if (!data) return <PageContainer title="Inicio"><div className="notice notice--bad">No se pudieron cargar los datos. Cierra y vuelve a abrir la aplicación.</div></PageContainer>

  const firstName = (user?.name || '').split(' ')[0]
  const today = cap(new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
  const caja = data.cajaAbierta
  const chart = (data.ventas7dias || []).map(d => ({ label: fmtShort(d.dia), value: d.total || 0 }))
  const hayVentas = chart.some(d => d.value > 0)
  // Si hoy aún no hay ventas, la tarjeta principal muestra el último día cerrado con ventas.
  const todayKey = new Date().toLocaleDateString('en-CA')
  const lastClosed = [...(data.ventas7dias || [])].filter(d => d.dia < todayKey && (d.total || 0) > 0).pop()

  return (
    <PageContainer title={`Hola, ${firstName}`} action={<span className="hello__date">{today}</span>}>
      <div className="status-row">
        <div className={`notice ${caja ? 'notice--ok' : 'notice--warn'}`}>
          {caja ? <CircleCheck size={18} /> : <Lock size={18} />}
          <span><strong>{caja ? 'Caja abierta' : 'Caja cerrada'}</strong></span>
          {!caja && hasPermission('cash_register') && (
            <PrimaryButton size="sm" variant="ghost" onClick={() => navigate('/cash')}><Vault size={16} /> Abrir caja</PrimaryButton>
          )}
        </div>
        {data.sinStock > 0 && <div className="notice notice--bad"><PackageX size={18} /><span><strong>{data.sinStock}</strong> variante(s) sin stock</span></div>}
        {data.stockBajo > 0 && <div className="notice notice--warn"><TriangleAlert size={18} /><span><strong>{data.stockBajo}</strong> variante(s) con stock bajo</span></div>}
      </div>

      <div className="kpis">
        {data.ventasHoy.count > 0 || !lastClosed ? (
          <StatsCard accent title="Ventas de hoy" value={fmt(data.ventasHoy.total)} sub={`${data.ventasHoy.count} venta(s)`} icon={<Wallet size={22} />} />
        ) : (
          <StatsCard accent title="Último día con ventas" value={fmt(lastClosed.total)} sub={`${fmtLong(lastClosed.dia)} · cierre`} icon={<Wallet size={22} />} />
        )}
        <StatsCard title="Ventas del mes" value={fmt(data.ventasMes.total)} sub="Acumulado del mes" icon={<CalendarDays size={22} />} />
      </div>


      <section className="card" style={{ marginBottom: 20 }}>
        <div className="section-title"><h2>Métodos de pago</h2><span className="page__sub" style={{ margin: 0 }}>Este mes</span></div>
        {!data.ventasPorMetodo?.length ? (
          <p className="dashed">Sin datos este mes</p>
        ) : (
          <div className="meter meter--row">
            {data.ventasPorMetodo.map(m => {
              const pct = Math.round((m.total / (data.ventasMes.total || 1)) * 100)
              return (
                <div key={m.method}>
                  <div className="meter__row"><span>{METODO_LABELS[m.method] || m.method}</span><b className="num">{fmt(m.total)}</b></div>
                  <div className="meter__track" role="img" aria-label={`${pct}%`}><div className="meter__fill" style={{ width: `${pct}%` }} /></div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-title"><h2>Ventas de la semana</h2><span className="page__sub" style={{ margin: 0 }}>Últimos 7 días</span></div>
        {hayVentas
          ? <AreaChart data={chart} label="Ventas de los últimos 7 días" />
          : <EmptyState small icon={<ChartLine size={26} />} title="Aún no hay ventas esta semana" text="Cuando registres ventas, verás aquí cómo evolucionan." />}
      </section>
    </PageContainer>
  )
}
