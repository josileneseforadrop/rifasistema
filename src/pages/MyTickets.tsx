import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { PublicOrder } from '../lib/types'
import { formatDateTime, isValidCpf, money, onlyDigits, statusLabel } from '../lib/format'
import { useCustomer } from '../context/CustomerContext'
import { Panel, SectionTitle, Spinner } from '../components/Layout'
import { OrderNumbers } from './OrderPage'

export default function MyTickets() {
  const { customer } = useCustomer()
  const [term, setTerm] = useState('')
  const [orders, setOrders] = useState<PublicOrder[] | null>(null)
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (body: Record<string, string>) => {
    setLoading(true)
    setOrders(await api<PublicOrder[]>('/my-orders', { body }).catch(() => []))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (customer) search({ customer_id: customer.id })
  }, [customer, search])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const d = onlyDigits(term)
    if (d.length < 10) return
    search(isValidCpf(d) ? { cpf: d } : { phone: d })
  }

  return (
    <Panel>
      <SectionTitle emoji="🎟️" title="Meus títulos" />
      <form onSubmit={submit} className="card">
        <div className="field">
          <label>Informe seu CPF ou telefone</label>
          <input inputMode="numeric" placeholder="CPF ou (00) 00000-0000" value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
        <button className="btn block">Buscar</button>
      </form>
      {loading && <Spinner />}
      {!loading && orders?.length === 0 && <p className="muted center">Nenhum título encontrado.</p>}
      {!loading &&
        orders?.map((o) => (
          <div key={o.id} className="card">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              {o.campaign.image && <img src={o.campaign.image} alt="" style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 8 }} />}
              <div style={{ flex: 1 }}>
                <b style={{ textTransform: 'uppercase' }}>{o.campaign.title}</b>
                <div className="muted" style={{ fontSize: 13 }}>
                  Pedido #{o.code} · {formatDateTime(o.created_at)} · {o.quantity} título(s) · {money(o.total)}
                </div>
                <span className={`badge ${o.status}`} style={{ marginTop: 6 }}>{statusLabel[o.status]}</span>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              {o.status === 'paid' ? (
                <OrderNumbers order={o} />
              ) : (
                <Link className="btn sm" to={`/pedido/${o.id}`}>Pagar agora</Link>
              )}
            </div>
          </div>
        ))}
    </Panel>
  )
}
