import { useCallback, useEffect, useState } from 'react'
import { adminApi, errorMessage } from '../lib/api'
import { formatDateTime, formatPhone, money, onlyDigits, padNumber, statusLabel, waLink } from '../lib/format'
import { Modal, Pagination } from './ui'

interface Row {
  id: string
  code: number
  status: string
  quantity: number
  total: number
  payment_method: string
  payment_id: string | null
  created_at: string
  paid_at: string | null
  expires_at: string
  customers: { name: string; phone: string; email: string | null; cpf: string | null }
  campaigns: { title: string; number_digits: number }
  affiliates: { name: string; code: string } | null
  base_quantity: number | null
  bumps: { qty: number; price: number; label: string | null }[]
  bonus_eligible?: boolean
  bonus_claimed_at?: string | null
}

const PAGE = 30

export function useCampaignOptions() {
  const [list, setList] = useState<{ id: string; title: string }[]>([])
  useEffect(() => {
    adminApi<{ id: string; title: string }[]>('/admin/campaign-options').then(setList).catch(() => undefined)
  }, [])
  return list
}

export default function Orders() {
  const campaigns = useCampaignOptions()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [campaign, setCampaign] = useState('')
  const [q, setQ] = useState('')
  const [bonus, setBonus] = useState('')
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<Row | null>(null)
  const [approving, setApproving] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const approve = async (r: Row) => {
    const late = r.status === 'expired' || r.status === 'cancelled'
    const msg = late
      ? `Aprovar o pedido #${r.code} (${money(r.total)})?\n\nEle está ${statusLabel[r.status].toLowerCase()}: os números foram liberados e serão sorteados novamente.`
      : `Aprovar o pedido #${r.code} de ${r.customers.name} (${money(r.total)})?\n\nConfirme que o pagamento caiu na sua conta.`
    if (!confirm(msg)) return
    setApproving(r.id)
    setError('')
    setNotice('')
    try {
      await adminApi(`/admin/orders/${r.id}/status`, { body: { status: 'paid' } })
      setNotice(`Pedido #${r.code} aprovado. Os números foram liberados para o cliente.`)
      load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setApproving(null)
    }
  }

  const filters = { status, campaign, q, bonus }

  const load = useCallback(async () => {
    try {
      const r = await adminApi<{ rows: Row[]; count: number }>('/admin/orders', { query: { status, campaign, q, bonus, page, size: PAGE } })
      setRows(r.rows)
      setCount(r.count ?? 0)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [status, campaign, q, bonus, page])

  useEffect(() => {
    load()
  }, [load])

  const exportCsv = async () => {
    let data: Row[]
    try {
      data = (await adminApi<{ rows: Row[] }>('/admin/orders', { query: { ...filters, page: 1, size: 10000 } })).rows
    } catch (e) {
      return setError(errorMessage(e))
    }
    const lines = [['Pedido', 'Data', 'Campanha', 'Cliente', 'Telefone', 'E-mail', 'CPF', 'Qtd', 'Total', 'Status', 'Pago em', 'Afiliado', 'Bônus']]
    for (const r of data)
      lines.push([
        String(r.code), formatDateTime(r.created_at), r.campaigns?.title, r.customers.name, r.customers.phone, r.customers.email ?? '',
        r.customers.cpf ?? '', String(r.quantity), String(r.total).replace('.', ','), statusLabel[r.status], formatDateTime(r.paid_at), r.affiliates?.code ?? '', r.bonus_eligible ? 'elegível' : '',
      ])
    const csv = lines.map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <>
      <div className="admin-top">
        <h1>Pedidos</h1>
        <span className="spacer" />
        <button className="btn ghost" onClick={exportCsv}>Exportar CSV</button>
      </div>
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}
      <div className="row" style={{ marginBottom: 14 }}>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Buscar nome, telefone ou nº pedido" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <select className="input" style={{ maxWidth: 220 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">Todos os status</option>
          <option value="pending">Aguardando pagamento</option>
          <option value="paid">Pago</option>
          <option value="expired">Expirado</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <select className="input" style={{ maxWidth: 200 }} value={bonus} onChange={(e) => { setBonus(e.target.value); setPage(1) }}>
          <option value="">Todos os pedidos</option>
          <option value="eligible">🎁 Elegíveis ao bônus</option>
        </select>
        <select className="input" style={{ maxWidth: 280 }} value={campaign} onChange={(e) => { setCampaign(e.target.value); setPage(1) }}>
          <option value="">Todas as campanhas</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <button className="btn ghost sm" onClick={load}>Atualizar</button>
      </div>
      {!rows ? (
        <div className="spinner" />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>#</th><th>Data</th><th>Cliente</th><th>Campanha</th><th>Qtd</th><th>Total</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={8} className="center muted">Nenhum pedido encontrado.</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.code}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.created_at)}</td>
                    <td>{r.customers.name}<div className="muted" style={{ fontSize: 12 }}>{formatPhone(r.customers.phone)}</div></td>
                    <td>{r.campaigns?.title}</td>
                    <td>{r.quantity}</td>
                    <td>{money(r.total)}</td>
                    <td>
                      <span className={`badge ${r.status}`}>{statusLabel[r.status]}</span>
                      {r.bonus_eligible && <span className="badge active" style={{ marginLeft: 4 }} title="Compra feita pela oferta da raspadinha, acima do valor mínimo">🎁 bônus</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.status !== 'paid' && (
                        <button className="btn success sm" disabled={approving === r.id} onClick={() => approve(r)}>
                          {approving === r.id ? 'Aprovando...' : '✓ Aprovar'}
                        </button>
                      )}{' '}
                      <button className="btn ghost sm" onClick={() => setDetail(r)}>Detalhes</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE} total={count} onChange={setPage} />
        </>
      )}
      {detail && <OrderDetail order={detail} onClose={() => setDetail(null)} onChanged={() => { setDetail(null); load() }} />}
    </>
  )
}

function OrderDetail({ order, onClose, onChanged }: { order: Row; onClose: () => void; onChanged: () => void }) {
  const [numbers, setNumbers] = useState<number[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    adminApi<number[]>(`/admin/orders/${order.id}/tickets`).then(setNumbers).catch(() => setNumbers([]))
  }, [order.id])

  const setStatus = async (s: 'paid' | 'cancelled') => {
    const msg = s === 'paid' ? 'Confirmar o pagamento deste pedido?' : 'Cancelar este pedido? Os números serão liberados.'
    if (!confirm(msg)) return
    setBusy(true)
    try {
      await adminApi(`/admin/orders/${order.id}/status`, { body: { status: s } })
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Pedido #${order.code}`} onClose={onClose} large>
      {error && <div className="alert error">{error}</div>}
      <div className="grid2">
        <p><b>Cliente:</b> {order.customers.name}</p>
        <p><b>Telefone:</b> <a href={waLink(order.customers.phone)} target="_blank" rel="noreferrer">{formatPhone(order.customers.phone)}</a></p>
        <p><b>E-mail:</b> {order.customers.email ?? '-'}</p>
        <p><b>CPF:</b> {order.customers.cpf ?? '-'}</p>
        <p><b>Campanha:</b> {order.campaigns?.title}</p>
        <p><b>Quantidade:</b> {order.quantity} · <b>Total:</b> {money(order.total)}</p>
        <p><b>Status:</b> <span className={`badge ${order.status}`}>{statusLabel[order.status]}</span></p>
        <p><b>Pagamento:</b> {order.payment_method} {order.payment_id && `(${order.payment_id})`}</p>
        <p><b>Criado:</b> {formatDateTime(order.created_at)}</p>
        <p><b>{order.status === 'paid' ? 'Pago em' : 'Expira em'}:</b> {formatDateTime(order.paid_at ?? order.expires_at)}</p>
        {order.affiliates && <p><b>Afiliado:</b> {order.affiliates.name} ({order.affiliates.code})</p>}
        {order.bonus_eligible && <p><b>🎁 Bônus:</b> elegível — compra feita pela oferta da raspadinha, acima do valor mínimo</p>}
        {order.bonus_claimed_at && <p><b>Resgatou a oferta da raspadinha em:</b> {formatDateTime(order.bonus_claimed_at)}</p>}
        {order.bumps?.length > 0 && (
          <p>
            <b>Order bumps:</b> {order.base_quantity} escolhidos +{' '}
            {order.bumps.map((b) => `${b.qty} por ${money(b.price)}`).join(' + ')}
          </p>
        )}
      </div>
      <h4>Números {order.status !== 'paid' && order.status !== 'pending' && '(liberados)'}</h4>
      {!numbers ? <div className="spinner" /> : numbers.length === 0 ? <p className="muted">Nenhum número reservado.</p> : (
        <div className="numbers" style={{ maxHeight: 220, overflowY: 'auto' }}>
          {numbers.map((n) => <span key={n}>{padNumber(n, order.campaigns?.number_digits ?? 6)}</span>)}
        </div>
      )}
      <div className="row" style={{ marginTop: 20 }}>
        {order.status !== 'paid' && <button className="btn success" disabled={busy} onClick={() => setStatus('paid')}>Confirmar pagamento</button>}
        {(order.status === 'pending' || order.status === 'paid') && <button className="btn danger" disabled={busy} onClick={() => setStatus('cancelled')}>Cancelar pedido</button>}
        <a className="btn ghost" href={`/pedido/${order.id}`} target="_blank" rel="noreferrer">Página do pedido</a>
      </div>
    </Modal>
  )
}
