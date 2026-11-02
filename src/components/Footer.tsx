import { useSettings } from '../context/SettingsContext'

export default function Footer() {
  const { settings: s } = useSettings()
  if (!s) return null
  const socials = [
    ['Instagram', s.instagram_url],
    ['Facebook', s.facebook_url],
    ['Telegram', s.telegram_url],
    ['YouTube', s.youtube_url],
    ['TikTok', s.tiktok_url],
  ].filter(([, u]) => u) as [string, string][]
  return (
    <footer className="footer">
      {s.footer_logos?.length > 0 && (
        <div className="footer-logos">
          {s.footer_logos.map((l, i) => (
            <img key={i} src={l} alt="" />
          ))}
        </div>
      )}
      {socials.length > 0 && (
        <div className="socials">
          {socials.map(([name, url]) => (
            <a key={name} href={url} target="_blank" rel="noreferrer" title={name} style={{ width: 'auto', padding: '0 12px', fontSize: 13 }}>
              {name}
            </a>
          ))}
        </div>
      )}
      {s.footer_text && <div className="footer-text">{s.footer_text}</div>}
    </footer>
  )
}
