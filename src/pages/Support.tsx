import { useSettings } from '../context/SettingsContext'
import { Panel, SectionTitle } from '../components/Layout'
import { waLink } from '../lib/format'
import { IconMail, IconWhats } from '../components/Icons'

export default function Support() {
  const { settings: s } = useSettings()
  return (
    <Panel>
      <SectionTitle emoji="💬" title="Suporte" />
      {s?.support_text && <div className="card pre">{s.support_text}</div>}
      <div style={{ display: 'grid', gap: 10 }}>
        {s?.support_whatsapp && (
          <a className="btn success block" href={waLink(s.support_whatsapp)} target="_blank" rel="noreferrer">
            <IconWhats /> Falar no WhatsApp
          </a>
        )}
        {s?.support_email && (
          <a className="btn ghost block" href={`mailto:${s.support_email}`}>
            <IconMail /> {s.support_email}
          </a>
        )}
        {s?.whatsapp_group_url && (
          <a className="btn block" href={s.whatsapp_group_url} target="_blank" rel="noreferrer">
            <IconWhats /> Entrar no grupo
          </a>
        )}
      </div>
    </Panel>
  )
}
