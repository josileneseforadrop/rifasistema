import { useEffect, useState, type FormEvent } from 'react'
import { adminApi, errorMessage } from '../lib/api'
import { formatDate, formatPhone } from '../lib/format'
import { Field, ImageInput, Modal, Toggle } from './ui'
import { useCampaignOptions } from './Orders'

interface W {
  id?: string
  campaign_id: string | null
  name: string
  campaign_title: string | null
  prize: string | null
  ticket_number: string | null
  draw_date: string | null
  phone: string | null
  photo_url: string | null
  published: boolean
  sort_order: number
}
const blank: W = { campaign_id: null, name: '', campaign_title: '', prize: '', ticket_number: '', draw_date: null, phone: '', photo_url: null, published: true, sort_order: 0 }

export default function WinnersAdmin() {
  const campaigns = useCampaignOptions()
  const [list, setList] = useState<W[] | null>(null)
  const [edit, setEdit] = useState<W | null>(null)
  const [error, setError] = useState('')

  const load = () =>
    adminApi<W[]>('/admin/winners').then(setList).catch((e) => setError(errorMessage(e)))
  useEffect(() => {
    load()
  }, [])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!edit) return
    const { id, ...payload } = edit
    try {
      if (id) await adminApi(`/admin/winners/${id}`, { method: 'PUT', body: payload })
      else await adminApi('/admin/winners', { body: payload })
    } catch (e) {
      return setError(errorMessage(e))
    }
    setEdit(null)
    load()
  }

  const remove = async (w: W) => {
    if (!confirm(`Remover ${w.name}?`)) return
    await adminApi(`/admin/winners/${w.id}`, { method: 'DELETE' }).catch((e) => setError(errorMessage(e)))
    load()
  }

  const set = (p: Partial<W>) => setEdit((e) => (e ? { ...e, ...p } : e))

  return (
    <>
      <div className="admin-top">
        <h1>Ganhadores</h1>
        <span className="spacer" />
        <button className="btn" onClick={() => setEdit({ ...blank })}>+ Novo ganhador</button>
      </div>
      {!list ? <div className="spinner" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th></th><th>Nome</th><th>Campanha</th><th>Número</th><th>Data</th><th>Publicado</th><th></th></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={7} className="center muted">Nenhum ganhador.</td></tr>}
              {list.map((w) => (
                <tr key={w.id}>
                  <td>{w.photo_url ? <img className="thumb" src={w.photo_url} alt="" /> : <div className="thumb" />}</td>
                  <td>{w.name}</td><td>{w.campaign_title}</td><td>{w.ticket_number}</td><td>{formatDate(w.draw_date)}</td>
                  <td>{w.published ? 'Sim' : 'Não'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" onClick={() => setEdit({ ...w, phone: w.phone ? formatPhone(w.phone) : '' })}>Editar</button>{' '}
                    <button className="btn danger sm" onClick={() => remove(w)}>Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? 'Editar ganhador' : 'Novo ganhador'} onClose={() => setEdit(null)} large>
          {error && <div className="alert error">{error}</div>}
          <form onSubmit={save}>
            <div className="grid2">
              <Field label="Nome"><input value={edit.name} onChange={(e) => set({ name: e.target.value })} required /></Field>
              <Field label="Campanha (vínculo)">
                <select value={edit.campaign_id ?? ''} onChange={(e) => {
                  const c = campaigns.find((x) => x.id === e.target.value)
                  set({ campaign_id: e.target.value || null, campaign_title: c?.title ?? edit.campaign_title })
                }}>
                  <option value="">Nenhuma</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </Field>
              <Field label="Título exibido da campanha"><input value={edit.campaign_title ?? ''} onChange={(e) => set({ campaign_title: e.target.value })} /></Field>
              <Field label="Prêmio"><input value={edit.prize ?? ''} onChange={(e) => set({ prize: e.target.value })} /></Field>
              <Field label="Número da sorte"><input value={edit.ticket_number ?? ''} onChange={(e) => set({ ticket_number: e.target.value })} /></Field>
              <Field label="Data da premiação"><input type="date" value={edit.draw_date ?? ''} onChange={(e) => set({ draw_date: e.target.value || null })} /></Field>
              <Field label="Telefone" hint="No site aparece apenas o DDD: (27) ****-****"><input value={edit.phone ?? ''} onChange={(e) => set({ phone: formatPhone(e.target.value) })} /></Field>
              <Field label="Ordem"><input type="number" value={edit.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Foto"><ImageInput value={edit.photo_url} onChange={(v) => set({ photo_url: v })} folder="winners" /></Field>
            <Toggle label="Publicado no site" checked={edit.published} onChange={(v) => set({ published: v })} />
            <button className="btn">Salvar</button>
          </form>
        </Modal>
      )}
    </>
  )
}
