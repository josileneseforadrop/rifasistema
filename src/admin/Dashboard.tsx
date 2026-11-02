import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, errorMessage } from '../lib/api'
import { money, statusLabel } from '../lib/format'

interface Dash {
  revenue_total: number
  revenue_today: number
  revenue_7d: number
  orders_paid: number
  orders_pending: number
  customers: number
  tickets_sold: number
  daily: { label: string; total: number; orders: number }[]
  campaigns: { id: string; title: string; status: string; total_numbers: number; sold_count: number; reserved_count: number; revenue: number }[]
}

export default function Dashboard() {
  const [d, setD] = useState<Dash | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    adminApi<Dash>('/admin/dashboard').then(setD).catch((e) => setError(errorMessage(e)))
  }, [])

  if (error) return <div className="alert error">{error}</div>
  if (!d) return <div className="spinner" />

  const max = Math.max(1, ...d.daily.map((x) => Number(x.total)))

  return (
    <>
      <h1>Dashboard</h1>
      <div className="stats">
        <div className="stat"><div className="l">Faturamento total</div><div className="v">{money(d.revenue_total)}</div></div>
        <div className="stat"><div className="l">Hoje</div><div className="v">{money(d.revenue_today)}</div></div>
        <div className="stat"><div className="l">Últimos 7 dias</div><div className="v">{money(d.revenue_7d)}</div></div>
        <div className="stat"><div className="l">Pedidos pagos</div><div className="v">{d.orders_paid}</div></div>
        <div className="stat"><div className="l">Pedidos pendentes</div><div className="v">{d.orders_pending}</div></div>
        <div className="stat"><div className="l">Títulos vendidos</div><div className="v">{Number(d.tickets_sold).toLocaleString('pt-BR')}</div></div>
        <div className="stat"><div className="l">Clientes</div><div className="v">{d.customers}</div></div>
      </div>

      <div className="card">
        <b>Faturamento — últimos 14 dias</b>
        {d.daily.length === 0 ? (
          <p className="muted">Sem vendas no período.</p>
        ) : (
          <div className="bars">
            {d.daily.map((x) => (
              <div className="b" key={x.label} title={`${x.label}: ${money(x.total)} (${x.orders} pedidos)`}>
                <span>{money(x.total).replace('R$', '').trim()}</span>
                <div style={{ height: `${(Number(x.total) / max) * 100}%` }} />
                <span>{x.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Campanha</th><th>Status</th><th>Vendidos</th><th>Reservados</th><th>Progresso</th><th>Faturamento</th></tr>
          </thead>
          <tbody>
            {d.campaigns.map((c) => {
              const pct = (Number(c.sold_count) / Number(c.total_numbers)) * 100
              return (
                <tr key={c.id}>
                  <td><Link to={`/admin/campanhas/${c.id}`}><b>{c.title}</b></Link></td>
                  <td><span className={`badge ${c.status}`}>{statusLabel[c.status]}</span></td>
                  <td>{Number(c.sold_count).toLocaleString('pt-BR')} / {Number(c.total_numbers).toLocaleString('pt-BR')}</td>
                  <td>{Number(c.reserved_count).toLocaleString('pt-BR')}</td>
                  <td><div className="mini-progress"><div style={{ width: `${pct}%` }} /></div> <small>{pct.toFixed(2)}%</small></td>
                  <td>{money(c.revenue)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
