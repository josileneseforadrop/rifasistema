import { useEffect, useState } from 'react'
import { useSettings } from '../context/SettingsContext'
import { IconArrow, IconDownload } from './Icons'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

export default function InstallBanner() {
  const { settings } = useSettings()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('hide_install') === '1')
  const [help, setHelp] = useState(false)
  const standalone = window.matchMedia('(display-mode: standalone)').matches

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  if (!settings?.show_install_banner || hidden || standalone) return null

  const install = async () => {
    if (deferred) {
      await deferred.prompt()
      setDeferred(null)
    } else setHelp(true)
  }

  return (
    <>
      <div className="install-banner" role="button" onClick={install} style={{ cursor: 'pointer' }}>
        <IconDownload />
        <div className="center">
          <div className="t">{settings.install_title}</div>
          <div className="s">{settings.install_subtitle}</div>
        </div>
        <IconArrow />
        <button
          className="close"
          aria-label="Fechar"
          onClick={(e) => {
            e.stopPropagation()
            sessionStorage.setItem('hide_install', '1')
            setHidden(true)
          }}
        >
          ✕
        </button>
      </div>
      {help && (
        <div className="modal-bg" onClick={() => setHelp(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="x" onClick={() => setHelp(false)}>✕</button>
            <h3>Instalar o aplicativo</h3>
            <p><b>iPhone (Safari):</b> toque em Compartilhar e depois em "Adicionar à Tela de Início".</p>
            <p><b>Android (Chrome):</b> abra o menu ⋮ e toque em "Instalar app" ou "Adicionar à tela inicial".</p>
          </div>
        </div>
      )}
    </>
  )
}
