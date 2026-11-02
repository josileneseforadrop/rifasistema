import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { IconMenu } from './Icons'
import Menu from './Menu'

export default function Header() {
  const { settings } = useSettings()
  const [open, setOpen] = useState(false)
  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="header-logo">
            {settings?.logo_url ? <img src={settings.logo_url} alt={settings.site_name} /> : <span>{settings?.site_name ?? ''}</span>}
          </Link>
          <button className="icon-btn" aria-label="Abrir menu" onClick={() => setOpen(true)}>
            <IconMenu width={32} height={32} />
          </button>
        </div>
      </header>
      <div className="header-spacer" />
      {open && <Menu onClose={() => setOpen(false)} />}
    </>
  )
}
