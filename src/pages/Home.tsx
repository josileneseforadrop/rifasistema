import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Campaign, Winner } from '../lib/types'
import { useSettings } from '../context/SettingsContext'
import { Panel, SectionTitle, Spinner } from '../components/Layout'
import { CampaignRow, FeaturedCampaign } from '../components/CampaignCard'
import WinnerCard from '../components/WinnerCard'
import WhatsFloat from '../components/WhatsFloat'

export const fetchCampaigns = () => api<Campaign[]>('/campaigns').catch(() => [] as Campaign[])

export default function Home() {
  const { settings } = useSettings()
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null)
  const [winners, setWinners] = useState<Winner[]>([])

  useEffect(() => {
    fetchCampaigns().then(setCampaigns)
    api<Winner[]>('/winners', { query: { limit: 5 } }).then(setWinners).catch(() => setWinners([]))
  }, [])

  const [first, ...rest] = campaigns ?? []

  return (
    <Panel>
      <SectionTitle emoji="⚡" title={settings?.campaigns_title || 'Campanhas'} subtitle={settings?.campaigns_subtitle} />
      {!campaigns ? (
        <Spinner />
      ) : campaigns.length === 0 ? (
        <p className="muted center">Nenhuma campanha disponível no momento.</p>
      ) : (
        <>
          {first.status === 'active' ? <FeaturedCampaign c={first} /> : <CampaignRow c={first} />}
          {rest.map((c) => (
            <CampaignRow key={c.id} c={c} />
          ))}
        </>
      )}

      {settings?.show_winners_home && winners.length > 0 && (
        <>
          <div style={{ height: 20 }} />
          <SectionTitle emoji="🎉" title={settings?.winners_title || 'Ganhadores'} subtitle={settings?.winners_subtitle} />
          {winners.map((w) => (
            <WinnerCard key={w.id} w={w} />
          ))}
          <div className="center">
            <Link to="/ganhadores" className="show-more">Ver todos</Link>
          </div>
        </>
      )}
      <WhatsFloat />
    </Panel>
  )
}
