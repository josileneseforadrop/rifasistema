import { useSettings } from '../context/SettingsContext'
import { Panel, SectionTitle, Spinner } from '../components/Layout'

export default function Terms() {
  const { settings } = useSettings()
  return (
    <Panel>
      <SectionTitle emoji="📜" title="Termos de uso" />
      {!settings ? <Spinner /> : <div className="card pre">{settings.terms_text}</div>}
      {settings?.privacy_text && (
        <>
          <SectionTitle emoji="🔒" title="Política de privacidade" />
          <div className="card pre">{settings.privacy_text}</div>
        </>
      )}
    </Panel>
  )
}
