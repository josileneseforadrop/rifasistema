import type { Winner } from '../lib/types'
import { formatDate } from '../lib/format'

export default function WinnerCard({ w }: { w: Winner }) {
  return (
    <div className="winner">
      {w.photo_url ? <img className="photo" src={w.photo_url} alt={w.name} /> : <div className="photo" />}
      <div>
        <h4>{w.name}</h4>
        {w.campaign_title && <div className="camp">{w.campaign_title}</div>}
        {w.prize && <div className="line">Prêmio: {w.prize}</div>}
        {w.ticket_number && <div className="line">Número da sorte: <b>{w.ticket_number}</b></div>}
        {w.draw_date && <div className="line">Data da premiação: <b>{formatDate(w.draw_date)}</b></div>}
        {w.phone_masked && <div className="line">Telefone {w.phone_masked}</div>}
      </div>
    </div>
  )
}
