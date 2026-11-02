import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Campaign, PrizeTitle } from '../lib/types'
import { formatDateTime, money, padNumber, progressPercent } from '../lib/format'
import { useCountdown } from '../lib/useCountdown'
import { track } from '../context/SettingsContext'
import { Spinner } from '../components/Layout'
import WhatsFloat from '../components/WhatsFloat'
import CheckoutSheet from '../components/Checkout'
import ShareButtons from '../components/ShareButtons'
import { IconCart, IconCheck, IconMinus, IconPlus } from '../components/Icons'

function Gallery({ images, title, subtitle, badge }: { images: string[]; title: string; subtitle: string | null; badge?: string | null }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (images.length < 2) return
    const t = setInterval(() => setI((x) => (x + 1) % images.length), 5000)
    return () => clearInterval(t)
  }, [images.length])
  return (
    <div className="cp-hero">
      {images.length > 0 ? <img src={images[i]} alt={title} /> : <div style={{ aspectRatio: '16/9' }} />}
      {images.length > 1 && (
        <>
          <div className="cp-dots">
            {images.map((_, k) => (
              <button key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`Imagem ${k + 1}`} />
            ))}
          </div>
          <button className="cp-nav" style={{ left: 8 }} onClick={() => setI((i - 1 + images.length) % images.length)}>‹</button>
          <button className="cp-nav" style={{ right: 8 }} onClick={() => setI((i + 1) % images.length)}>›</button>
        </>
      )}
      <div className="overlay">
        {badge && <span className="badge active blink">{badge}</span>}
        <h1>{title}</h1>
        {subtitle && <div className="sub">{subtitle}</div>}
      </div>
    </div>
  )
}

function HighlightBox({ c }: { c: Campaign }) {
  const h = c.highlight ?? {}
  const { ms, label } = useCountdown(h.ends_at)
  // a barra mostra quanto da promoção já passou (de "válido de" até o fim da contagem)
  const startAt = h.valid_from ? new Date(h.valid_from).getTime() : NaN
  const endAt = h.ends_at ? new Date(h.ends_at).getTime() : NaN
  const elapsed = endAt > startAt ? Math.min(100, Math.max(0, ((Date.now() - startAt) / (endAt - startAt)) * 100)) : 0
  const endsBar = elapsed
    ? { background: `linear-gradient(90deg, rgba(255,255,255,.12) ${Math.max(0, elapsed - 6)}%, rgba(255,255,255,.5) ${elapsed + 6}%, rgba(255,255,255,.62))` }
    : undefined
  const now = Date.now()
  if (!h.enabled) return null
  if (h.valid_from && new Date(h.valid_from).getTime() > now) return null
  if (h.valid_to && new Date(h.valid_to).getTime() < now) return null
  return (
    <div className="highlight">
      {h.title && <h3>{h.title}</h3>}
      {h.ends_at && ms > 0 && (
        <div className="ends" style={endsBar}>
          Encerra em <b>{label}</b>
        </div>
      )}
      {h.text && <div className="txt">{h.text}</div>}
      {(h.valid_from || h.valid_to) && (
        <div className="valid">
          Válido {h.valid_from && `de ${formatDateTime(h.valid_from)}`} {h.valid_to && `até ${formatDateTime(h.valid_to)}`}
        </div>
      )}
    </div>
  )
}

export default function CampaignPage() {
  const { slug } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const [c, setC] = useState<Campaign | null | undefined>(undefined)
  const [titles, setTitles] = useState<PrizeTitle[]>([])
  const [qty, setQty] = useState(1)
  const [showReg, setShowReg] = useState(false)
  const [showAllTitles, setShowAllTitles] = useState(false)
  const [checkout, setCheckout] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ campaign: Campaign; prize_titles: PrizeTitle[] }>(`/campaigns/${slug}`)
      .then(({ campaign, prize_titles }) => {
        setC(campaign)
        setTitles(prize_titles)
        if (search.get('bonus')) sessionStorage.setItem('bonus_from', search.get('bonus')!)
        const above = Number(search.get('acima'))
        const needed = above > 0 && Number(campaign.price) > 0 ? Math.floor(above / Number(campaign.price)) + 1 : 0
        setQty(Math.min(campaign.max_per_order, Math.max(campaign.min_per_order, campaign.default_quantity, needed)))
        document.title = campaign.title
        track('ViewContent', { content_name: campaign.title })
      })
      .catch(() => setC(null))
  }, [slug])

  const total = useMemo(() => {
    if (!c) return 0
    const promo = c.promotions?.find((p) => Number(p.qty) === qty)
    return promo ? Number(promo.price) : Math.round(c.price * qty * 100) / 100
  }, [c, qty])

  if (c === undefined) return <main className="page campaign"><Spinner /></main>
  if (c === null)
    return (
      <main className="page">
        <p className="center" style={{ padding: 40 }}>Campanha não encontrada.</p>
      </main>
    )

  const clamp = (n: number) => Math.max(c.min_per_order, Math.min(c.max_per_order, Math.floor(n) || c.min_per_order))
  const pct = progressPercent(c)
  const canBuy = c.status === 'active'
  const wonCount = titles.filter((t) => t.winner_name).length
  const visibleTitles = showAllTitles ? titles : titles.slice(0, 5)
  const url = location.href

  const buy = () => {
    setError('')
    if (qty < c.min_per_order || qty > c.max_per_order) return setError(`A quantidade deve ser entre ${c.min_per_order} e ${c.max_per_order}`)
    setCheckout(true)
  }

  return (
    <main className="page campaign" style={{ paddingTop: 0 }}>
      <Gallery images={c.images} title={c.title} subtitle={c.subtitle} badge={c.status === 'active' ? c.badge_text : null} />
      <button className="cp-my" onClick={() => navigate('/meus-titulos')}>
        <IconCart /> Meus títulos
      </button>
      {c.show_progress && (
        <div className="cp-progress">
          <div className="bar" style={{ width: `${pct}%` }} />
          <span>{pct.toFixed(2)}%</span>
        </div>
      )}
      <div className="cp-body">
        <div className="cp-price">
          Por apenas <b>{money(c.price)}</b>
        </div>

        {c.promotions?.length > 0 && (
          <>
            <div className="section-title promo-title">
              <span className="emoji">📣</span>
              <h2>Promoção</h2>
              <small>Compre mais barato!</small>
            </div>
            <div className="promo-row">
              {c.promotions.map((p, i) => (
                <button key={i} className="promo-chip" onClick={() => canBuy && setQty(clamp(Number(p.qty)))}>
                  {p.qty} POR {money(p.price)}
                </button>
              ))}
            </div>
          </>
        )}

        <HighlightBox c={c} />

        {canBuy ? (
          <>
            <div className="hint-box">Quanto mais títulos, mais chances de ganhar!</div>
            {c.quick_buttons?.length > 0 && (
              <div className="qty-grid">
                {c.quick_buttons.map((b, i) => (
                  <button key={i} className={`qty-btn ${b.popular ? 'popular' : ''}`} onClick={() => setQty(clamp(qty + Number(b.qty)))}>
                    {b.popular && <span className="tag">Mais popular</span>}
                    <div className="n">+{b.qty}</div>
                    <div className="p">{money(c.price * b.qty)}</div>
                    <div className="s">SELECIONAR</div>
                  </button>
                ))}
              </div>
            )}
            <div className="buy-row">
              <div className="stepper">
                <button onClick={() => setQty(clamp(qty - 1))} aria-label="Diminuir"><IconMinus /></button>
                <input inputMode="numeric" value={qty} onChange={(e) => setQty(Number(e.target.value.replace(/\D/g, '')) || 0)} onBlur={() => setQty(clamp(qty))} />
                <button onClick={() => setQty(clamp(qty + 1))} aria-label="Aumentar"><IconPlus /></button>
              </div>
              <button className="buy-btn" disabled={qty < c.min_per_order} onClick={buy}>
                <IconCheck />
                <span>
                  Quero participar
                  <b>{money(total)}</b>
                </span>
              </button>
            </div>
            {error && <div className="alert error" style={{ marginTop: 10 }}>{error}</div>}
            <p className="muted center" style={{ fontSize: 12 }}>
              Mínimo {c.min_per_order} · Máximo {c.max_per_order} títulos por compra
            </p>
          </>
        ) : (
          <div className="alert info center" style={{ marginTop: 12 }}>
            {c.status === 'finished' ? 'Esta campanha foi concluída.' : 'Esta campanha está temporariamente pausada.'}
          </div>
        )}

        {c.description && (
          <>
            <div className="reg-wrap">
              <button className="reg-btn" onClick={() => setShowReg(!showReg)} aria-expanded={showReg}>
                <svg width="16" height="16" viewBox="0 0 16 16" style={{ transform: showReg ? 'rotate(180deg)' : undefined }}>
                  <rect width="16" height="16" rx="2" fill="currentColor" />
                  <path d="M8 3.5v7M4.8 7.6 8 10.8l3.2-3.2" stroke="#1f2530" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Descrição/Regulamento
              </button>
            </div>
            {showReg && <div className="regulation pre">{c.description}</div>}
          </>
        )}

        {titles.length > 0 && (
          <>
            <div className="titles-head">
              <h3>🏆 Títulos Premiados</h3>
              <span className="titles-count">
                {wonCount}<small>/ {titles.length}</small>
              </span>
            </div>
            {visibleTitles.map((t) => (
              <div key={t.id} className={`title-row ${t.winner_name ? 'won' : ''}`}>
                <span className="num">{padNumber(t.number, c.number_digits)}</span>
                <span className="prz">{t.prize}</span>
                <span>{t.winner_name ? `${t.winner_name} 🏆` : 'Disponível'}</span>
              </div>
            ))}
            {titles.length > 5 && (
              <button className="show-more" onClick={() => setShowAllTitles(!showAllTitles)}>
                {showAllTitles ? '⌃ Mostrar Menos' : '⌄ Mostrar Mais'}
              </button>
            )}
          </>
        )}

        <ShareButtons url={url} title={c.title} />
      </div>
      <WhatsFloat url={c.whatsapp_group_url} />
      {checkout && <CheckoutSheet campaign={c} quantity={qty} onClose={() => setCheckout(false)} />}
    </main>
  )
}
