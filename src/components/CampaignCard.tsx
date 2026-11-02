import { Link } from 'react-router-dom'
import type { Campaign } from '../lib/types'
import { formatDateTime, statusLabel } from '../lib/format'
import { IconCalendar } from './Icons'

export function StatusBadge({ c }: { c: Campaign }) {
  if (c.status === 'active')
    return <span className="badge active blink">{c.badge_text || 'Adquira já!'}</span>
  return <span className={`badge ${c.status}`}>{statusLabel[c.status]}</span>
}

export function FeaturedCampaign({ c }: { c: Campaign }) {
  return (
    <Link to={`/campanha/${c.slug}`} className="campaign-featured">
      {c.images[0] && <img className="cover" src={c.images[0]} alt={c.title} />}
      <div className="info">
        <h3>{c.title}</h3>
        {c.subtitle && <p>{c.subtitle}</p>}
        <StatusBadge c={c} />
      </div>
    </Link>
  )
}

export function CampaignRow({ c }: { c: Campaign }) {
  return (
    <Link to={`/campanha/${c.slug}`} className="campaign-row">
      <img src={c.images[0] || '/favicon.svg'} alt={c.title} />
      <div>
        <h3>{c.title}</h3>
        {c.subtitle && <p>{c.subtitle}</p>}
        <StatusBadge c={c} />
      </div>
      {c.show_draw_date && c.draw_date && (
        <span className="date row" style={{ gap: 4 }}>
          <IconCalendar /> {formatDateTime(c.draw_date)}
        </span>
      )}
    </Link>
  )
}
