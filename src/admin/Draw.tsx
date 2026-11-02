import { useState } from 'react'
import { adminApi, errorMessage } from '../lib/api'
import { formatDateTime, formatPhone, padNumber, statusLabel } from '../lib/format'
import { useCampaignOptions } from './Orders'

interface Result {
  number: number
  orders: { id: string; code: number; status: string; paid_at: string | null }
  customers: { name: string; phone: string; email: string | null; cpf: string | null }
  campaigns: { title: string; number_digits: number }
}

export default function Draw() {
  const campaigns = useCampaignOptions()
  const [campaign, setCampaign] = useState('')
  const [number, setNumber] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const lookup = async (n: number) => {
    setMsg('')
    setResult(null)
    try {
      const data = await adminApi<Result | null>('/admin/draw/lookup', { query: { campaign, number: n } })
      if (!data) return setMsg(`O número ${n} não foi vendido.`)
      setResult(data)
    } catch (e) {
      setMsg(errorMessage(e))
    }
  }

  const random = async () => {
    setBusy(true)
    try {
      const { number: n } = await adminApi<{ number: number | null }>('/admin/draw/random', { body: { campaign } })
      if (n == null) return setMsg('Nenhum título pago nesta campanha.')
      setNumber(String(n))
      lookup(n)
    } catch (e) {
      setMsg(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const registerWinner = async () => {
    if (!result) return
    const error = await adminApi('/admin/winners', { body: {
      campaign_id: campaign,
      name: result.customers.name,
      campaign_title: result.campaigns.title,
      prize: result.campaigns.title,
      ticket_number: padNumber(result.number, result.campaigns.number_digits),
      draw_date: new Date().toISOString().slice(0, 10),
      phone: result.customers.phone,
    } }).then(() => null, (e) => e)
    setMsg(error ? errorMessage(error) : 'Ganhador registrado! Edite os detalhes em "Ganhadores".')
  }

  return (
    <>
      <h1>Sorteio / Consulta de número</h1>
      <div className="card">
        <div className="field">
          <label>Campanha</label>
          <select value={campaign} onChange={(e) => { setCampaign(e.target.value); setResult(null); setMsg('') }}>
            <option value="">Selecione...</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Número sorteado (ex.: resultado da Loteria Federal)</label>
            <input type="number" value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div className="field"><button className="btn" disabled={!campaign || !number} onClick={() => lookup(Number(number))}>Consultar</button></div>
          <div className="field"><button className="btn ghost" disabled={!campaign || busy} onClick={random}>🎲 Sortear aleatório</button></div>
        </div>
        <small className="muted">O sorteio aleatório escolhe entre os títulos pagos da campanha.</small>
      </div>
      {msg && <div className="alert info">{msg}</div>}
      {result && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>🏆 {padNumber(result.number, result.campaigns.number_digits)}</h2>
          <p><b>Cliente:</b> {result.customers.name}</p>
          <p><b>Telefone:</b> {formatPhone(result.customers.phone)}</p>
          <p><b>E-mail:</b> {result.customers.email ?? '-'} · <b>CPF:</b> {result.customers.cpf ?? '-'}</p>
          <p><b>Pedido:</b> #{result.orders.code} · <span className={`badge ${result.orders.status}`}>{statusLabel[result.orders.status]}</span> {result.orders.paid_at && `· pago em ${formatDateTime(result.orders.paid_at)}`}</p>
          {result.orders.status === 'paid' ? (
            <button className="btn success" onClick={registerWinner}>Registrar como ganhador</button>
          ) : (
            <div className="alert error">Atenção: este número está reservado mas o pedido ainda não foi pago.</div>
          )}
        </div>
      )}
    </>
  )
}
