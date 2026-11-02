import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { Settings } from '../lib/types'

interface Ctx {
  settings: Settings | null
  reload: () => Promise<void>
}
const SettingsContext = createContext<Ctx>({ settings: null, reload: async () => {} })

export const useSettings = () => useContext(SettingsContext)

let trackingInjected = false
function injectTracking(s: Settings) {
  if (trackingInjected) return
  trackingInjected = true
  if (s.google_analytics_id) {
    const id = s.google_analytics_id.replace(/[^A-Za-z0-9-]/g, '')
    const tag = document.createElement('script')
    tag.async = true
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
    document.head.appendChild(tag)
    const inline = document.createElement('script')
    inline.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}');`
    document.head.appendChild(inline)
  }
  if (s.meta_pixel_id) {
    const id = s.meta_pixel_id.replace(/\D/g, '')
    const inline = document.createElement('script')
    inline.textContent = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`
    document.head.appendChild(inline)
  }
}

export function track(event: string, data?: Record<string, unknown>) {
  const w = window as unknown as { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void }
  w.fbq?.('track', event, data)
  w.gtag?.('event', event, data)
}

export function applyTheme(s: Settings) {
  const r = document.documentElement.style
  r.setProperty('--primary', s.primary_color)
  r.setProperty('--primary-text', s.primary_text_color)
  r.setProperty('--header-bg', s.header_bg)
  r.setProperty('--bg', s.bg_color)
  r.setProperty('--card', s.card_color)
  r.setProperty('--text', s.text_color)
  r.setProperty('--muted', s.muted_color)
  document.title = s.site_name
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', s.header_bg)
  let desc = document.querySelector('meta[name="description"]')
  if (!desc) {
    desc = document.createElement('meta')
    desc.setAttribute('name', 'description')
    document.head.appendChild(desc)
  }
  desc.setAttribute('content', s.seo_description ?? '')
  if (s.favicon_url || s.logo_url) {
    document.getElementById('favicon')?.setAttribute('href', (s.favicon_url || s.logo_url)!)
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)

  const reload = useCallback(async () => {
    const data = await api<Settings>('/settings').catch(() => null)
    if (data) {
      setSettings(data as Settings)
      applyTheme(data as Settings)
      if (!location.pathname.startsWith('/admin')) injectTracking(data as Settings)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return <SettingsContext.Provider value={{ settings, reload }}>{children}</SettingsContext.Provider>
}
