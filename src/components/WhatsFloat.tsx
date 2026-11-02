import { useSettings } from '../context/SettingsContext'
import { IconWhats } from './Icons'

export default function WhatsFloat({ url }: { url?: string | null }) {
  const { settings } = useSettings()
  const href = url || settings?.whatsapp_group_url
  if (!href) return null
  return (
    <a className="whats-float" href={href} target="_blank" rel="noreferrer">
      <IconWhats /> {settings?.whatsapp_group_label || 'Grupo'}
    </a>
  )
}
