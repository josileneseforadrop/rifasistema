import { useEffect, useState, type FormEvent } from 'react'
import { adminApi, errorMessage } from '../lib/api'
import type { Announcement } from '../lib/types'
import { formatDateTime } from '../lib/format'
import { Field, ImageInput, Modal, Toggle } from './ui'

type A = Omit<Announcement, 'id' | 'created_at'> & { id?: string }
const blank: A = { title: '', content: '', image_url: null, published: true, pinned: false }

export default function AnnouncementsAdmin() {
  const [list, setList] = useState<Announcement[] | null>(null)
  const [edit, setEdit] = useState<A | null>(null)
  const [error, setError] = useState('')

  const load = () =>
    adminApi<Announcement[]>('/admin/announcements').then(setList).catch((e) => setError(errorMessage(e)))
  useEffect(() => {
    load()
  }, [])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!edit) return
    const { id, title, content, image_url, published, pinned } = edit
    const payload = { title, content, image_url, published, pinned }
    try {
      if (id) await adminApi(`/admin/announcements/${id}`, { method: 'PUT', body: payload })
      else await adminApi('/admin/announcements', { body: payload })
    } catch (e) {
      return setError(errorMessage(e))
    }
    setEdit(null)
    load()
  }

  const remove = async (a: Announcement) => {
    if (!confirm(`Excluir "${a.title}"?`)) return
    await adminApi(`/admin/announcements/${a.id}`, { method: 'DELETE' }).catch((e) => setError(errorMessage(e)))
    load()
  }

  return (
    <>
      <div className="admin-top">
        <h1>Comunicados</h1>
        <span className="spacer" />
        <button className="btn" onClick={() => setEdit({ ...blank })}>+ Novo comunicado</button>
      </div>
      {!list ? <div className="spinner" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Título</th><th>Data</th><th>Publicado</th><th>Fixado</th><th></th></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={5} className="center muted">Nenhum comunicado.</td></tr>}
              {list.map((a) => (
                <tr key={a.id}>
                  <td>{a.title}</td><td>{formatDateTime(a.created_at)}</td><td>{a.published ? 'Sim' : 'Não'}</td><td>{a.pinned ? '📌' : ''}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" onClick={() => setEdit(a)}>Editar</button>{' '}
                    <button className="btn danger sm" onClick={() => remove(a)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? 'Editar comunicado' : 'Novo comunicado'} onClose={() => setEdit(null)} large>
          {error && <div className="alert error">{error}</div>}
          <form onSubmit={save}>
            <Field label="Título"><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required /></Field>
            <Field label="Conteúdo"><textarea style={{ minHeight: 200 }} value={edit.content ?? ''} onChange={(e) => setEdit({ ...edit, content: e.target.value })} /></Field>
            <Field label="Imagem"><ImageInput value={edit.image_url} onChange={(v) => setEdit({ ...edit, image_url: v })} folder="announcements" /></Field>
            <Toggle label="Publicado" checked={edit.published} onChange={(v) => setEdit({ ...edit, published: v })} />
            <Toggle label="Fixar no topo" checked={edit.pinned} onChange={(v) => setEdit({ ...edit, pinned: v })} />
            <button className="btn">Salvar</button>
          </form>
        </Modal>
      )}
    </>
  )
}
