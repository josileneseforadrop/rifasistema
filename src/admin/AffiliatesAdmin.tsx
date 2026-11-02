import { useEffect, useState, type FormEvent } from 'react'
import { adminApi, errorMessage } from '../lib/api'
import { formatPhone, money, onlyDigits, waLink } from '../lib/format'
import { Field, Modal, Toggle } from './ui'

interface Aff {
  id?: string
  name: string
  phone: string
  email: string | null
  pix_key: string | null
  code: string
  commission_percent: number
  paid_out: number
  active: boolean
  orders?: number
  sales?: number
  commission?: number
}

export default function AffiliatesAdmin() {
  const [list, setList] = useState<Aff[] | null>(null)
  const [edit, setEdit] = useState<Aff | null>(null)
  const [error, setError] = useState('')

  const load = () =>
    adminApi<Aff[]>('/admin/affiliates').then(setList).catch((e) => setError(errorMessage(e)))
  useEffect(() => {
    load()
  }, [])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!edit) return
    const payload = {
      name: edit.name, phone: onlyDigits(edit.phone), email: edit.email || null, pix_key: edit.pix_key || null,
      code: edit.code.toUpperCase().replace(/[^A-Z0-9]/g, ''), commission_percent: Number(edit.commission_percent),
      paid_out: Number(edit.paid_out), active: edit.active,
    }
    try {
      if (edit.id) await adminApi(`/admin/affiliates/${edit.id}`, { method: 'PUT', body: payload })
      else await adminApi('/admin/affiliates', { body: payload })
    } catch (e) {
      return setError(errorMessage(e))
    }
    setEdit(null)
    load()
  }

  return (
    <>
      <div className="admin-top">
        <h1>Afiliados</h1>
        <span className="spacer" />
        <button className="btn" onClick={() => setEdit({ name: '', phone: '', email: '', pix_key: '', code: Math.random().toString(36).slice(2, 8).toUpperCase(), commission_percent: 10, paid_out: 0, active: true })}>+ Novo afiliado</button>
      </div>
      {error && <div className="alert error">{error}</div>}
      {!list ? <div className="spinner" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nome</th><th>Código</th><th>Comissão</th><th>Vendas</th><th>Total vendido</th><th>Comissão</th><th>Pago</th><th>Saldo</th><th></th></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={9} className="center muted">Nenhum afiliado.</td></tr>}
              {list.map((a) => (
                <tr key={a.id} style={{ opacity: a.active ? 1 : 0.5 }}>
                  <td>{a.name}<div className="muted" style={{ fontSize: 12 }}><a href={waLink(a.phone)} target="_blank" rel="noreferrer">{formatPhone(a.phone)}</a></div></td>
                  <td><b>{a.code}</b></td>
                  <td>{a.commission_percent}%</td>
                  <td>{a.orders}</td>
                  <td>{money(a.sales)}</td>
                  <td>{money(a.commission)}</td>
                  <td>{money(a.paid_out)}</td>
                  <td><b>{money(Number(a.commission) - Number(a.paid_out))}</b></td>
                  <td><button className="btn ghost sm" onClick={() => setEdit({ ...a, phone: formatPhone(a.phone) })}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? 'Editar afiliado' : 'Novo afiliado'} onClose={() => setEdit(null)}>
          {error && <div className="alert error">{error}</div>}
          <form onSubmit={save}>
            <Field label="Nome"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></Field>
            <Field label="Telefone"><input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: formatPhone(e.target.value) })} required /></Field>
            <Field label="E-mail"><input value={edit.email ?? ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Chave PIX"><input value={edit.pix_key ?? ''} onChange={(e) => setEdit({ ...edit, pix_key: e.target.value })} /></Field>
            <Field label="Código" hint={`Link: ${location.origin}/?ref=${edit.code}`}><input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} required /></Field>
            <div className="grid2">
              <Field label="Comissão (%)"><input type="number" step="0.01" value={edit.commission_percent} onChange={(e) => setEdit({ ...edit, commission_percent: Number(e.target.value) })} /></Field>
              <Field label="Total já pago (R$)" hint="Atualize ao pagar o afiliado"><input type="number" step="0.01" value={edit.paid_out} onChange={(e) => setEdit({ ...edit, paid_out: Number(e.target.value) })} /></Field>
            </div>
            <Toggle label="Ativo" checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} />
            <button className="btn">Salvar</button>
          </form>
        </Modal>
      )}
    </>
  )
}
