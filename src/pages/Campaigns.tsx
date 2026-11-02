import { useEffect, useState } from 'react'
import type { Campaign } from '../lib/types'
import { useSettings } from '../context/SettingsContext'
import { Panel, SectionTitle, Spinner } from '../components/Layout'
import { CampaignRow } from '../components/CampaignCard'
import { fetchCampaigns } from './Home'

export default function Campaigns() {
  const { settings } = useSettings()
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'finished'>('all')

  useEffect(() => {
    fetchCampaigns().then(setCampaigns)
  }, [])

  const list = (campaigns ?? []).filter((c) =>
    filter === 'all' ? true : filter === 'active' ? c.status !== 'finished' : c.status === 'finished',
  )

  return (
    <Panel>
      <SectionTitle emoji="⚡" title={settings?.campaigns_title || 'Campanhas'} subtitle={settings?.campaigns_subtitle} />
      <div className="row" style={{ marginBottom: 14 }}>
        {(['all', 'active', 'finished'] as const).map((f) => (
          <button key={f} className={`btn sm ${filter === f ? '' : 'ghost'}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Todas' : f === 'active' ? 'Em andamento' : 'Concluídas'}
          </button>
        ))}
      </div>
      {!campaigns ? <Spinner /> : list.length === 0 ? <p className="muted center">Nenhuma campanha.</p> : list.map((c) => <CampaignRow key={c.id} c={c} />)}
    </Panel>
  )
}
