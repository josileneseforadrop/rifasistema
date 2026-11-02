import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { adminApi, errorMessage } from '../lib/api'
import { formatCpf, formatDateTime, formatPhone, money, onlyDigits, statusLabel, waLink } from '../lib/format'
import { Field, Modal, Pagination } from './ui'

interface Row {
  id: string
  name: string
  phone: string
  email: string | null
  cpf: string | null
  created_at: string
  orders: { count: number }[]
}

const PAGE = 30

export default function Customers() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Row | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await adminApi<{ rows: Row[]; count: number }>('/admin/customers', { query: { q, page, size: PAGE } })
      setRows(r.rows)
      setCount(r.count ?? 0)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [q, page])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <h1>Clientes</h1>
      {error && <div className="alert error">{error}</div>}
      <input className="input" style={{ maxWidth: 320, marginBottom: 14 }} placeholder="Buscar nome, telefone, e-mail ou CPF" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
      {!rows ? <div className="spinner" /> : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Pedidos</th><th>Cadastro</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td><a href={waLink(r.phone)} target="_blank" rel="noreferrer">{formatPhone(r.phone)}</a></td>
                    <td>{r.email ?? '-'}</td>
                    <td>{r.orders?.[0]?.count ?? 0}</td>
                    <td>{formatDateTime(r.created_at)}</td>
                    <td><button className="btn ghost sm" onClick={() => setEdit(r)}>Abrir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE} total={count} onChange={setPage} />
        </>
      )}
      {edit && <CustomerModal c={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function CustomerModal({ c, onClose, onSaved }: { c: Row; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(c.name)
  const [phone, setPhone] = useState(formatPhone(c.phone))
  const [email, setEmail] = useState(c.email ?? '')
  const [cpf, setCpf] = useState(c.cpf ? formatCpf(c.cpf) : '')
  const [error, setError] = useState('')
  const [orders, setOrders] = useState<{ id: string; code: number; status: string; quantity: number; total: number; created_at: string; campaigns: { title: string } }[]>([])

  useEffect(() => {
    adminApi<typeof orders>(`/admin/customers/${c.id}/orders`).then(setOrders).catch(() => undefined)
  }, [c.id])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await adminApi(`/admin/customers/${c.id}`, { method: 'PUT', body: { name, phone: onlyDigits(phone), email: email || null, cpf: onlyDigits(cpf) || null } })
      onSaved()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Modal title="Cliente" onClose={onClose} large>
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={save}>
        <div className="grid2">
          <Field label="Nome"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Telefone"><input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} /></Field>
          <Field label="E-mail"><input value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="CPF"><input value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} /></Field>
        </div>
        <button className="btn">Salvar</button>
      </form>
      <h4>Pedidos</h4>
      <div className="table-wrap">
        <table className="table">
          <tbody>
            {orders.length === 0 && <tr><td className="muted">Nenhum pedido.</td></tr>}
            {orders.map((o) => (
              <tr key={o.id}>
                <td>#{o.code}</td><td>{o.campaigns?.title}</td><td>{o.quantity}</td><td>{money(o.total)}</td>
                <td><span className={`badge ${o.status}`}>{statusLabel[o.status]}</span></td><td>{formatDateTime(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
