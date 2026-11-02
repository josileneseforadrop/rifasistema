import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminApi, errorMessage } from '../lib/api'
import type { Campaign } from '../lib/types'
import { money, statusLabel } from '../lib/format'

export default function CampaignsList() {
  const [list, setList] = useState<Campaign[] | null>(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const load = () =>
    adminApi<Campaign[]>('/admin/campaigns').then(setList).catch((e) => setError(errorMessage(e)))

  useEffect(() => {
    load()
  }, [])

  const duplicate = async (c: Campaign) => {
    try {
      const { id } = await adminApi<{ id: string }>(`/admin/campaigns/${c.id}/duplicate`, { body: {} })
      navigate(`/admin/campanhas/${id}`)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const remove = async (c: Campaign) => {
    if (!confirm(`Excluir a campanha "${c.title}"? Todos os pedidos e números dela serão apagados. Esta ação não pode ser desfeita.`)) return
    try {
      await adminApi(`/admin/campaigns/${c.id}`, { method: 'DELETE' })
      load()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <>
      <div className="admin-top">
        <h1>Campanhas</h1>
        <span className="spacer" />
        <Link to="/admin/campanhas/nova" className="btn">+ Nova campanha</Link>
      </div>
      {error && <div className="alert error">{error}</div>}
      {!list ? (
        <div className="spinner" />
      ) : list.length === 0 ? (
        <div className="card center">Nenhuma campanha cadastrada ainda.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th></th><th>Título</th><th>Status</th><th>Preço</th><th>Vendidos</th><th>Destaque</th><th style={{ textAlign: 'right' }}>Ações</th></tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>{c.images[0] ? <img className="thumb" src={c.images[0]} alt="" /> : <div className="thumb" />}</td>
                  <td>
                    <Link to={`/admin/campanhas/${c.id}`}><b>{c.title}</b></Link>
                    <div className="muted" style={{ fontSize: 12 }}>/campanha/{c.slug}</div>
                  </td>
                  <td><span className={`badge ${c.status}`}>{statusLabel[c.status]}</span></td>
                  <td>{money(c.price)}</td>
                  <td>
                    {Number(c.sold_count).toLocaleString('pt-BR')} / {Number(c.total_numbers).toLocaleString('pt-BR')}
                    <div className="mini-progress"><div style={{ width: `${(c.sold_count / c.total_numbers) * 100}%` }} /></div>
                  </td>
                  <td>{c.featured ? '⭐' : ''}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Link className="btn sm" to={`/admin/campanhas/${c.id}`}>Editar</Link>{' '}
                    <a className="btn ghost sm" href={`/campanha/${c.slug}`} target="_blank" rel="noreferrer">Ver</a>{' '}
                    <button className="btn ghost sm" onClick={() => duplicate(c)}>Duplicar</button>{' '}
                    <button className="btn danger sm" onClick={() => remove(c)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
