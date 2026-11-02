import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Announcement } from '../lib/types'
import { formatDateTime } from '../lib/format'
import { Panel, SectionTitle, Spinner } from '../components/Layout'

export default function Announcements() {
  const [items, setItems] = useState<Announcement[] | null>(null)
  useEffect(() => {
    api<Announcement[]>('/announcements').then(setItems).catch(() => setItems([]))
  }, [])
  return (
    <Panel>
      <SectionTitle emoji="📢" title="Comunicados" subtitle="novidades" />
      {!items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="muted center">Nenhum comunicado.</p>
      ) : (
        items.map((a) => (
          <article key={a.id} className="card">
            {a.image_url && <img src={a.image_url} alt="" style={{ borderRadius: 10, marginBottom: 12, width: '100%' }} />}
            <h3 style={{ margin: '0 0 4px' }}>{a.pinned && '📌 '}{a.title}</h3>
            <small className="muted">{formatDateTime(a.created_at)}</small>
            {a.content && <div className="pre" style={{ marginTop: 10 }}>{a.content}</div>}
          </article>
        ))
      )}
    </Panel>
  )
}
