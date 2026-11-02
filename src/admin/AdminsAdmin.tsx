import { useEffect, useState, type FormEvent } from 'react'
import { adminApi, errorMessage } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { Field } from './ui'

interface A {
  id: string
  name: string
  email: string
  created_at: string
}

export default function AdminsAdmin() {
  const [list, setList] = useState<A[] | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const load = () => adminApi<A[]>('/admin/admins').then(setList).catch((e) => setMsg({ type: 'error', text: errorMessage(e) }))
  useEffect(() => {
    load()
  }, [])

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null)
    try {
      await fn()
      setMsg({ type: 'success', text: ok })
      load()
      return true
    } catch (e) {
      setMsg({ type: 'error', text: errorMessage(e) })
      return false
    }
  }

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (await run(() => adminApi('/admin/admins', { body: { name, email, password } }), 'Administrador criado!')) {
      setName('')
      setEmail('')
      setPassword('')
    }
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (await run(() => adminApi('/admin/password', { body: { current, password: next } }), 'Senha alterada!')) {
      setCurrent('')
      setNext('')
    }
  }

  return (
    <>
      <h1>Administradores</h1>
      {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}
      <div className="table-wrap" style={{ marginBottom: 18 }}>
        <table className="table">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Criado em</th><th></th></tr></thead>
          <tbody>
            {list?.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.email}</td>
                <td>{formatDateTime(a.created_at)}</td>
                <td>
                  <button
                    className="btn danger sm"
                    onClick={() => confirm(`Remover ${a.email}?`) && run(() => adminApi(`/admin/admins/${a.id}`, { method: 'DELETE' }), 'Removido')}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid2" style={{ gap: 14 }}>
        <form className="card" onSubmit={create}>
          <h3 style={{ marginTop: 0 }}>Novo administrador</h3>
          <Field label="Nome"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="E-mail"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Field label="Senha" hint="Mínimo de 8 caracteres"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></Field>
          <button className="btn">Criar</button>
        </form>
        <form className="card" onSubmit={changePassword}>
          <h3 style={{ marginTop: 0 }}>Alterar minha senha</h3>
          <Field label="Senha atual"><input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></Field>
          <Field label="Nova senha" hint="Mínimo de 8 caracteres"><input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} /></Field>
          <button className="btn">Alterar senha</button>
        </form>
      </div>
    </>
  )
}
