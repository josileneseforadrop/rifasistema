import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Winner } from '../lib/types'
import { useSettings } from '../context/SettingsContext'
import { Panel, SectionTitle, Spinner } from '../components/Layout'
import WinnerCard from '../components/WinnerCard'

export default function Winners() {
  const { settings } = useSettings()
  const [winners, setWinners] = useState<Winner[] | null>(null)
  useEffect(() => {
    api<Winner[]>('/winners', { query: { limit: 500 } }).then(setWinners).catch(() => setWinners([]))
  }, [])
  return (
    <Panel>
      <SectionTitle emoji="🎉" title={settings?.winners_title || 'Ganhadores'} subtitle={settings?.winners_subtitle} />
      {!winners ? <Spinner /> : winners.length === 0 ? <p className="muted center">Nenhum ganhador ainda.</p> : winners.map((w) => <WinnerCard key={w.id} w={w} />)}
    </Panel>
  )
}
