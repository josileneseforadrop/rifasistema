import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { useCustomer } from '../context/CustomerContext'
import {
  IconAward, IconClose, IconHome, IconList, IconLogin, IconLogout, IconMail, IconNews, IconRegister, IconTerms, IconTrophy,
} from './Icons'

export const APP_VERSION = '1.0.0'

export default function Menu({ onClose }: { onClose: () => void }) {
  const { settings } = useSettings()
  const { customer, setCustomer, openLogin } = useCustomer()
  const { pathname } = useLocation()

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const items = [
    { to: '/', label: 'Início', icon: IconHome },
    { to: '/campanhas', label: 'Campanhas', icon: IconList },
    { to: '/comunicados', label: 'Comunicados', icon: IconNews },
    { to: '/meus-titulos', label: 'Meus títulos', icon: IconList },
    ...(customer ? [] : [{ to: '/cadastro', label: 'Cadastro', icon: IconRegister }]),
    { to: '/ganhadores', label: 'Ganhadores', icon: IconTrophy },
    ...(settings?.affiliates_enabled ? [{ to: '/afiliados', label: 'Afiliados', icon: IconAward }] : []),
    { to: '/termos', label: 'Termos de uso', icon: IconTerms },
    { to: '/suporte', label: 'Suporte', icon: IconMail },
  ]

  return (
    <div className="menu-overlay">
      <div className="menu-inner">
        <div className="menu-top">
          <Link to="/" onClick={onClose} className="header-logo">
            {settings?.logo_url ? <img src={settings.logo_url} alt={settings.site_name} /> : <span>{settings?.site_name}</span>}
          </Link>
          <button className="icon-btn" aria-label="Fechar menu" onClick={onClose}>
            <IconClose width={40} height={40} />
          </button>
        </div>
        {items.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} onClick={onClose} className={`menu-item ${pathname === to ? 'active' : ''}`}>
            <Icon />
            {label}
          </Link>
        ))}
        {customer ? (
          <>
            <div className="menu-item" style={{ fontWeight: 500, color: '#aaa' }}>
              Olá, {customer.name.split(' ')[0]}
            </div>
            <button
              className="btn block"
              style={{ padding: 20, fontSize: 18, borderRadius: 4 }}
              onClick={() => {
                setCustomer(null)
                onClose()
              }}
            >
              <IconLogout /> Sair
            </button>
          </>
        ) : (
          <button
            className="btn block"
            style={{ padding: 20, fontSize: 18, borderRadius: 4 }}
            onClick={() => {
              onClose()
              openLogin()
            }}
          >
            <IconLogin /> Entrar
          </button>
        )}
        <div className="menu-version">{APP_VERSION}</div>
      </div>
    </div>
  )
}
