import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { BonusConfig } from '../lib/types'
import './raspadinha.css'

// ---------------------------------------------------------------------
// Estado salvo por pedido (recarregar a página não muda o resultado nem reinicia o prazo)
// ---------------------------------------------------------------------
type Face = { kind: 'bonus' } | { kind: 'filler'; text: string }
interface Saved {
  faces: (Face | null)[] // null = ainda não raspada
  order: number[] // ordem em que as casas foram reveladas
  plan: number[] // em quais revelações (0..8) sai bônus ao raspar com o dedo
  fillers: string[] // fila das janelas que não são bônus
  unlocked: boolean
  offerStart: number | null
}
const KEY = (id: string) => `raspadinha2:${id}`
const shuffle = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1])
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1))

function freshState(janelas: string[]): Saved {
  // suspense: 1º bônus nas 3 primeiras, 2º no meio, o 3º só na última casa raspada
  return { faces: Array(9).fill(null), order: [], plan: [rnd(0, 2), rnd(3, 6), 8], fillers: shuffle(janelas.slice(0, 6)), unlocked: false, offerStart: null }
}
function loadState(id: string, janelas: string[]): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY(id)) ?? 'null') as Saved | null
    if (s?.faces?.length === 9) return s
  } catch {
    /* gera de novo */
  }
  return freshState(janelas)
}

/** estilo da janela: "PERDEU"/"NADA" apagado, "SORTE..." branco, demais verde-claro */
const tone = (t: string) => (/PERD|NADA/i.test(t) ? 't-lose' : /SORTE/i.test(t) ? 't-red' : 't-wine')
const LINES = [[0, 4, 8], [2, 4, 6], [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8]]

// ---------------------------------------------------------------------
// camada prateada
// ---------------------------------------------------------------------
function paintFoil(canvas: HTMLCanvasElement) {
  const r = canvas.getBoundingClientRect()
  if (!r.width) return
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(r.width * dpr)
  canvas.height = Math.round(r.height * dpr)
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const w = r.width
  const h = r.height
  const g = ctx.createLinearGradient(0, 0, w, h)
  ;[['#a3a8b1', 0], ['#e9ebef', 0.22], ['#9da2ab', 0.42], ['#f4f5f7', 0.6], ['#a8adb6', 0.8], ['#dfe2e7', 1]].forEach(([c, o]) => g.addColorStop(o as number, c as string))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(255,255,255,.18)'
  ctx.lineWidth = 0.6
  for (let d = -h; d < w; d += 3) {
    ctx.beginPath()
    ctx.moveTo(d, h)
    ctx.lineTo(d + h, 0)
    ctx.stroke()
  }
  for (let i = 0; i < (w * h) / 120; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(60,64,72,.18)'
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1)
  }
  ctx.fillStyle = 'rgba(52,56,64,.78)'
  ctx.font = `900 ${Math.round(w * 0.15)}px Archivo, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('RASPE', w / 2, h / 2 + 1)
}

// partículas criadas direto no DOM (não re-renderizam o React)
function spawn(parent: HTMLElement | null, className: string, style: Record<string, string>, ttl: number) {
  if (!parent) return
  const el = document.createElement('span')
  el.className = className
  Object.entries(style).forEach(([k, v]) => el.style.setProperty(k, v))
  parent.appendChild(el)
  setTimeout(() => el.remove(), ttl)
}

const Hand = () => (
  <svg fill="currentColor" viewBox="0 0 24 24">
    <path d="M9 11V5.2a1.7 1.7 0 013.4 0V11V4a1.7 1.7 0 013.4 0v7V6.4a1.7 1.7 0 013.4 0V14c0 4.4-2.8 7.4-7 7.4-3.4 0-5.2-1.6-6.7-4.2L4 13.6a1.7 1.7 0 012.9-1.7l1 1.6V5.2" />
  </svg>
)
const Arrow = () => (
  <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const cap = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())
const moneyShort = (v: number) => (Number.isInteger(v) ? `R$${v}` : `R$${v.toFixed(2).replace('.', ',')}`)

// ---------------------------------------------------------------------
export default function Raspadinha({
  orderId,
  name,
  campaignSlug,
  config: c,
}: {
  orderId: string
  name?: string
  campaignSlug: string
  config: BonusConfig
}) {
  const navigate = useNavigate()
  const janelas = (c.janelas?.length ? c.janelas : ['PERDEU', 'SORTE NORMAL', 'TENTE DE NOVO', 'QUASE', 'PERDEU', 'SORTE NORMAL']).slice(0, 6)
  const [st, setSt] = useState<Saved>(() => loadState(orderId, janelas))
  const stRef = useRef(st)
  stRef.current = st
  const [phase, setPhase] = useState<'scratch' | 'offer' | 'going'>('scratch')
  const [leaving, setLeaving] = useState(false)
  const [touched, setTouched] = useState(st.order.length > 0)
  const [flipping, setFlipping] = useState(false)
  const [stamp, setStamp] = useState(false)
  const [flash, setFlash] = useState(false)
  const [flipped, setFlipped] = useState<number[]>([])
  const [sheet, setSheet] = useState(st.unlocked)
  const [done, setDone] = useState(st.unlocked)
  const [going, setGoing] = useState({ text: '', bar: 0 })
  const [now, setNow] = useState(Date.now())

  const canvases = useRef<(HTMLCanvasElement | null)[]>([])
  const tiles = useRef<(HTMLDivElement | null)[]>([])
  const board = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const confetti = useRef<HTMLSpanElement>(null)
  const burst = useRef<HTMLSpanElement>(null)
  const cover = useRef<Set<number>[]>(Array.from({ length: 9 }, () => new Set()))
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)

  const first = name?.trim().split(/\s+/)[0] ?? ''
  const found = st.faces.filter((f) => f?.kind === 'bonus').length
  const revealed = st.order.length

  useEffect(() => {
    localStorage.setItem(KEY(orderId), JSON.stringify(st))
  }, [orderId, st])

  // camada prateada
  useEffect(() => {
    const paint = () => canvases.current.forEach((cv, i) => cv && !stRef.current.faces[i] && paintFoil(cv))
    paint()
    const ro = new ResizeObserver(paint)
    canvases.current.forEach((cv) => cv && ro.observe(cv))
    document.fonts?.ready.then(paint)
    return () => ro.disconnect()
  }, [])

  // ------------------------------- revelar -------------------------------
  const decide = (s: Saved, i: number, mode: 'hand' | 'all'): Face => {
    const k = s.order.length
    const bonus = s.faces.filter((f) => f?.kind === 'bonus').length
    const need = 3 - bonus
    const left = 9 - k
    let isBonus: boolean
    if (need <= 0) isBonus = false
    else if (need >= left) isBonus = true
    else if (mode === 'hand') isBonus = s.plan.includes(k) || s.plan.filter((p) => p < k).length > bonus // compensa plano não cumprido
    else isBonus = (s as Saved & { target?: number[] }).target?.includes(i) ?? false
    if (isBonus) return { kind: 'bonus' }
    const used = s.faces.filter((f) => f?.kind === 'filler').length
    return { kind: 'filler', text: s.fillers[used % s.fillers.length] ?? 'PERDEU' }
  }

  const unlock = useCallback(() => {
    setTimeout(() => {
      setFlash(true)
      setDone(true)
      for (let n = 0; n < 46; n++)
        spawn(
          confetti.current,
          'rs-conf',
          {
            left: `${Math.random() * 100}%`,
            background: ['var(--rs-primary)', 'var(--rs-accent)', 'var(--rs-white)', 'var(--rs-primary-light)'][n % 4],
            '--rs-rot': `${rnd(200, 900)}deg`,
            'animation-duration': `${(1.3 + Math.random() * 1.3).toFixed(2)}s`,
            'animation-delay': `${(Math.random() * 0.35).toFixed(2)}s`,
          },
          3000,
        )
      setTimeout(() => {
        setSheet(true)
        setSt((s) => ({ ...s, unlocked: true }))
      }, 650)
    }, 450)
  }, [])

  const sparks = (i: number) => {
    const t = tiles.current[i]
    const b = board.current
    if (!t || !b) return
    const tr = t.getBoundingClientRect()
    const br = b.getBoundingClientRect()
    const cx = tr.left - br.left + tr.width / 2
    const cy = tr.top - br.top + tr.height / 2
    for (let n = 0; n < 16; n++) {
      const a = (n / 16) * Math.PI * 2
      const d = rnd(36, 70)
      spawn(b, 'rs-spark', {
        left: `${cx}px`,
        top: `${cy}px`,
        background: n % 2 ? 'var(--rs-accent)' : 'var(--rs-accent-light)',
        '--rs-px': `${Math.cos(a) * d}px`,
        '--rs-py': `${Math.sin(a) * d}px`,
      }, 800)
    }
  }

  const reveal = useCallback(
    (i: number, mode: 'hand' | 'all') => {
      const s = stRef.current
      if (s.faces[i]) return
      const face = decide(s, i, mode)
      if (mode === 'all') setFlipped((f) => [...f, i])
      const faces = s.faces.map((f, k) => (k === i ? face : f))
      const next = { ...s, faces, order: [...s.order, i] }
      stRef.current = next
      setSt(next)
      const total = faces.filter((f) => f?.kind === 'bonus').length
      if (face.kind === 'bonus') {
        sparks(i)
        // reinicia o brilho da grade sem recriar as casas
        const g = grid.current
        if (g) {
          g.classList.remove('flash')
          void g.offsetWidth
          g.classList.add('flash')
        }
        if (total === 3 && mode === 'hand') setStamp(true)
      }
      if (next.order.length === 9) unlock()
    },
    [unlock],
  )

  // ------------------------------- raspar -------------------------------
  const scratchAt = (x: number, y: number) => {
    const radius = 17
    canvases.current.forEach((cv, i) => {
      if (!cv || stRef.current.faces[i]) return
      const r = cv.getBoundingClientRect()
      if (x < r.left - radius || x > r.right + radius || y < r.top - radius || y > r.bottom + radius) return
      const ctx = cv.getContext('2d')!
      const from = last.current ?? { x, y }
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineCap = 'round'
      ctx.lineWidth = radius * 2
      ctx.beginPath()
      ctx.moveTo(from.x - r.left, from.y - r.top)
      ctx.lineTo(x - r.left, y - r.top)
      ctx.stroke()
      ctx.restore()
      const cells = cover.current[i]
      const steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / (radius / 2)))
      for (let s = 0; s <= steps; s++) {
        const px = from.x + ((x - from.x) * s) / steps - r.left
        const py = from.y + ((y - from.y) * s) / steps - r.top
        for (let cx = 0; cx < 12; cx++)
          for (let cy = 0; cy < 12; cy++)
            if (Math.hypot(((cx + 0.5) * r.width) / 12 - px, ((cy + 0.5) * r.height) / 12 - py) <= radius) cells.add(cy * 12 + cx)
      }
      // raspas caindo
      const br = board.current!.getBoundingClientRect()
      for (let n = 0; n < 2; n++) spawn(board.current, 'rs-chip', { left: `${x - br.left}px`, top: `${y - br.top}px`, '--rs-dx': `${rnd(-22, 22)}px` }, 700)
      if (cells.size / 144 >= 0.5) reveal(i, 'hand')
    })
    last.current = { x, y }
  }

  const down = (e: React.PointerEvent) => {
    if (done || flipping) return
    drawing.current = true
    last.current = null
    setTouched(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    scratchAt(e.clientX, e.clientY)
  }
  const move = (e: React.PointerEvent) => drawing.current && scratchAt(e.clientX, e.clientY)
  const up = () => {
    drawing.current = false
    last.current = null
  }

  const scratchAll = () => {
    setTouched(true)
    setFlipping(true)
    const s = stRef.current
    const bonuses = s.faces.flatMap((f, i) => (f?.kind === 'bonus' ? [i] : []))
    const open = s.faces.flatMap((f, i) => (f ? [] : [i]))
    const need = 3 - bonuses.length
    // os bônus que faltam completam uma linha (diagonal de preferência), se possível
    const fit = LINES.filter((l) => bonuses.every((b) => l.includes(b)) && l.filter((x) => !bonuses.includes(x)).every((x) => open.includes(x)))
    const target = fit.length ? fit[0].filter((x) => !bonuses.includes(x)) : shuffle(open).slice(0, Math.max(0, need))
    stRef.current = { ...s, target } as Saved
    open.forEach((i, n) => setTimeout(() => reveal(i, 'all'), 90 * (n + 1)))
  }

  // ------------------------------- oferta -------------------------------
  const openOffer = () => {
    setLeaving(true)
    setTimeout(() => {
      setPhase('offer')
      setLeaving(false)
      setSt((s) => (s.offerStart ? s : { ...s, offerStart: Date.now() }))
      setTimeout(() => {
        for (let n = 0; n < 14; n++) {
          const a = (n / 14) * Math.PI * 2
          spawn(burst.current, 'rs-burstp', {
            background: n % 2 ? 'var(--rs-primary-light)' : 'var(--rs-accent)',
            '--rs-px': `${Math.cos(a) * rnd(70, 130)}px`,
            '--rs-py': `${Math.sin(a) * rnd(30, 70)}px`,
          }, 900)
        }
      }, 500)
    }, 340)
  }

  useEffect(() => {
    if (phase !== 'offer') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [phase])

  const totalMs = Math.max(1, Number(c.countdown_minutes) || 3) * 60_000
  const leftMs = st.offerStart ? Math.max(0, st.offerStart + totalMs - now) : totalMs
  const leftS = Math.ceil(leftMs / 1000)
  const expired = st.offerStart != null && leftMs <= 0

  const garantir = async () => {
    if (expired) return
    setPhase('going')
    const claim = api(`/orders/${orderId}/bonus-claim`, { body: {} }).catch(() => undefined)
    const steps: [number, string, number][] = [[0, 'Confirmando seu acesso...', 28], [700, 'Registrando a sorte máxima...', 64], [1400, 'Tudo certo! Abrindo...', 100]]
    steps.forEach(([ms, text, bar]) => setTimeout(() => setGoing({ text, bar }), ms))
    await Promise.all([claim, new Promise((r) => setTimeout(r, 2100))])
    const slug = c.cta_campaign_slug || campaignSlug
    const min = Number(c.min_amount || 0)
    navigate(`/campanha/${slug}?bonus=${orderId}${min > 0 ? `&acima=${min}` : ''}`)
  }

  const showNumbers = () => document.getElementById('numeros')?.scrollIntoView({ behavior: 'smooth' })

  // ------------------------------- textos -------------------------------
  const min = Number(c.min_amount || 0)
  const minLabel = min > 0 ? `acima de ${moneyShort(min)}` : 'de qualquer valor'
  const countText = found === 0 ? 'ache 3 bônus' : found === 3 ? 'achou as 3!' : `${found} de 3`
  const helpText = done ? '3 bônus · desbloqueado' : found === 0 ? 'arraste o dedo pra raspar' : found === 1 ? 'achou 1! faltam 2' : found === 2 ? 'achou 2! só mais 1' : 'achou as 3!'
  const tickerItems = useMemo(() => {
    const offer = `${c.premio ?? ''}${c.carro_b ? ` OU ${c.carro_b}` : ''}${c.extra ? ` + ${c.extra}` : ''}`.trim()
    const base = ['SÓ PRA VOCÊ', c.chamada || 'SEU BÔNUS', offer, 'SE A COTA PREMIADA SAIR POR AQUI'].filter(Boolean).flatMap((t) => [t, t])
    return [...base, ...base]
  }, [c.premio, c.carro_b, c.extra, c.chamada])

  const vars = {
    '--rs-c-primary': c.cor_primaria || '#1fd36b',
    '--rs-c-accent': c.cor_destaque || '#ffc531',
    '--rs-c-bg': c.cor_fundo || '#02080a',
    '--rs-c-text': c.cor_texto || '#f2fff7',
  } as CSSProperties

  return (
    <div className="rs" style={vars}>
      <div className={`rs-card ${c.carro_b ? '' : 'no-b'} ${c.extra ? '' : 'no-extra'}`}>
        <span className={`rs-flash ${flash ? 'on' : ''}`} />
        <span className="rs-confetti" ref={confetti} />

        {/* ======================= RASPADINHA ======================= */}
        <section className={`rs-sec rs-scratch ${phase === 'scratch' ? 'on' : ''} ${leaving ? 'leaving' : ''}`}>
          <div className="rs-pillrow">
            <span className="rs-pill"><i /> COMPRA CONFIRMADA</span>
          </div>
          <h2 className="rs-title">
            <span className="rs-name">{first}</span>
            <span>{c.titulo}</span>
            <br />
            <em>{c.titulo_destaque}</em>
          </h2>
          <div className="rs-board" ref={board}>
            <div ref={grid} className="rs-grid" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
              {st.faces.map((f, i) => (
                <div key={i} ref={(el) => (tiles.current[i] = el)} className={`rs-tile ${f ? 'open' : ''} ${f?.kind === 'bonus' ? 'win' : ''} ${flipped.includes(i) ? 'flip' : ''}`}>
                  {f &&
                    (f.kind === 'bonus' ? (
                      <div className="rs-face t-top"><b>{c.simbolo || 'BÔNUS'}</b></div>
                    ) : (
                      <div className={`rs-face ${tone(f.text)}`}>
                        <b>{f.text.split(' ')[0]}</b>
                        {f.text.includes(' ') && <small>{f.text.split(' ').slice(1).join(' ')}</small>}
                      </div>
                    ))}
                  <canvas ref={(el) => (canvases.current[i] = el)} className={`rs-foil ${f && !flipped.includes(i) ? 'gone' : ''}`} />
                </div>
              ))}
            </div>
            <span aria-hidden="true" className={`rs-stamp ${stamp ? 'on' : ''}`}>ACHOU OS 3!</span>
            <span aria-hidden="true" className={`rs-hand ${touched ? 'hide' : ''}`}><Hand /></span>
          </div>
          <div className="rs-status">
            <span className="rs-dots">{[0, 1, 2].map((k) => <i key={k} className={k < found ? 'on' : ''} />)}</span>
            <span className="rs-count">{countText}</span>
          </div>
          <span className={`rs-help ${found > 0 ? 'on' : ''}`}>{helpText}</span>
          <button className={`rs-all ${flipping || done ? 'hide' : ''}`} onClick={scratchAll}>
            <Hand />
            RASPAR TUDO
          </button>

          <div aria-hidden={!sheet} className={`rs-sheet ${sheet ? 'on' : ''}`}>
            <span className="rs-tag">VOCÊ DESBLOQUEOU</span>
            <span className="rs-result rs-result-sm"><b>{c.resultado}</b></span>
            <span className="rs-detail">{c.resultado_detalhe}</span>
            <p className="rs-cond"><span>{c.condicao}</span></p>
            <button className="rs-btn" onClick={openOffer}>
              <span className="rs-shine" />
              <span>{c.botao_resultado || 'VER MEU BÔNUS'}</span>
              <Arrow />
            </button>
          </div>
        </section>

        {/* ======================= OFERTA ======================= */}
        <section className={`rs-sec rs-offer ${phase === 'offer' ? 'on' : ''}`}>
          {c.video_url && <VideoPlayer src={c.video_url} poster={c.video_poster} name={first} active={phase === 'offer'} />}
          <div aria-hidden="true" className="rs-ticker">
            <div className="rs-ticker-in">{tickerItems.map((t, i) => <span key={i}>{t}</span>)}</div>
          </div>
          <div className="rs-body">
            <div className="rs-hero">
              <span className="rs-call">
                <span>{c.chamada}</span>
                <span className="rs-name">{first}</span>
              </span>
              <span className="rs-big rs-big-car">
                <b className={phase === 'offer' ? 'open' : ''}>
                  <small>{c.escolha}</small>
                  <span>{c.premio}</span>
                  <span className="rs-orb"> OU <span>{c.carro_b}</span></span>
                </b>
              </span>
              {c.extra && <span className="rs-extra rs-extra-part">+ <b className="rs-extra-v">{c.extra}</b></span>}
              <span className="rs-valid">
                válido <b>se a próxima cota premiada sair pra você</b> · fezinha <b>{minLabel}</b> por aqui
              </span>
              <span className="rs-burst" ref={burst} />
            </div>
            <ol className="rs-steps">
              <li>
                <b>1</b>
                <span>Fezinha por esta página <strong>{minLabel}</strong></span>
              </li>
              <li className="flash">
                <b>2</b>
                <span>
                  Saiu a <strong>próxima cota premiada</strong> pra você? Bônus: escolhe{' '}
                  <strong>
                    <span>{cap(c.premio ?? '')}</span>
                    <span className="rs-orb"> ou <span>{cap(c.carro_b ?? '')}</span></span>
                    <span className="rs-extra-part"> + <span>{c.extra}</span></span>
                  </strong>
                  {c.site && <small>no site: <span>{c.site}</span>, sem bônus</small>}
                </span>
              </li>
            </ol>
            <div className="rs-foot">
              <div className={`rs-timer ${leftS <= 30 ? 'urgent' : ''}`}>
                <span className="rs-timer-l">{expired ? 'encerrado' : 'acaba em'}</span>
                <span className="rs-timer-v">{String(Math.floor(leftS / 60)).padStart(2, '0')}:{String(leftS % 60).padStart(2, '0')}</span>
                <span className="rs-timer-bar"><span style={{ width: `${(leftMs / totalMs) * 100}%` }} /></span>
              </div>
              <button className={`rs-btn ${leftS <= 30 && !expired ? 'urgent' : ''}`} onClick={garantir} disabled={expired} style={expired ? { opacity: 0.5, animation: 'none' } : undefined}>
                <span className="rs-shine" />
                <span>{expired ? 'OFERTA ENCERRADA' : c.cta || 'GARANTIR AGORA'}</span>
                {!expired && <Arrow />}
              </button>
              <button className="rs-link" type="button" onClick={showNumbers}>{c.fechar || 'mostrar meus números'}</button>
              {c.rules && <details className="rs-rules"><summary>regras do bônus</summary><p>{c.rules}</p></details>}
            </div>
          </div>
        </section>

        {/* ======================= REGISTRANDO ======================= */}
        <section className={`rs-sec rs-going ${phase === 'going' ? 'on' : ''}`}>
          <span aria-hidden="true" className="rs-spin" />
          <p className="rs-going-t">Registrando seu bônus<span className="rs-name">{first}</span></p>
          <p className="rs-going-s">{going.text}</p>
          <span className="rs-going-bar"><span style={{ width: `${going.bar}%` }} /></span>
        </section>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Player com os controles do modelo (play / som / reiniciar, barra e tempo restante)
// ---------------------------------------------------------------------
function VideoPlayer({ src, poster, name, active }: { src: string; poster: string | null; name: string; active: boolean }) {
  const v = useRef<HTMLVideoElement>(null)
  const [mode, setMode] = useState<'play' | 'sound' | 'replay' | null>(null)
  const [paused, setPaused] = useState(true)
  const [muted, setMuted] = useState(false)
  const [t, setT] = useState({ cur: 0, dur: 0 })

  // ao abrir a oferta: tenta tocar com som; se o navegador bloquear, toca mudo e pede um toque para ouvir
  useEffect(() => {
    const el = v.current
    if (!active || !el) return
    el.muted = false
    el.play()
      .then(() => setMode(null))
      .catch(() => {
        el.muted = true
        setMuted(true)
        el.play()
          .then(() => setMode('sound'))
          .catch(() => setMode('play'))
      })
  }, [active])

  const center = () => {
    const el = v.current!
    if (mode === 'sound') {
      el.muted = false
      setMuted(false)
    } else if (mode === 'replay') el.currentTime = 0
    el.play().catch(() => undefined)
    setMode(null)
  }
  const toggle = () => {
    const el = v.current!
    if (el.paused) el.play().catch(() => undefined)
    else el.pause()
  }
  const toggleSound = () => {
    const el = v.current!
    el.muted = !el.muted
    setMuted(el.muted)
    if (!el.muted && mode === 'sound') setMode(null)
  }
  const seek = (e: React.MouseEvent<HTMLSpanElement>) => {
    const el = v.current!
    const r = e.currentTarget.getBoundingClientRect()
    if (el.duration) el.currentTime = ((e.clientX - r.left) / r.width) * el.duration
  }

  return (
    <div className={`rs-video ${!paused ? 'playing' : ''}`}>
      <video
        ref={v}
        className="rs-vid"
        src={src}
        poster={poster ?? undefined}
        playsInline
        preload="auto"
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onEnded={() => setMode('replay')}
        onTimeUpdate={(e) => setT({ cur: e.currentTarget.currentTime, dur: e.currentTarget.duration || 0 })}
        onLoadedMetadata={(e) => setT({ cur: 0, dur: e.currentTarget.duration || 0 })}
        onClick={toggle}
      />
      <span className="rs-badge">PRA VOCÊ<span className="rs-name">{name}</span></span>
      <button aria-label="Tocar" className={`rs-play ${mode ? '' : 'hide'}`} data-mode={mode ?? undefined} onClick={center}>
        <span className="rs-ring" />
        <svg aria-hidden="true" className="i-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
        <svg aria-hidden="true" className="i-replay" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
        <svg aria-hidden="true" className="i-sound" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>
        <span className="rs-playlabel">{mode === 'sound' ? 'TOQUE PRA OUVIR' : mode === 'replay' ? 'VER DE NOVO' : ''}</span>
      </button>
      <div className="rs-controls">
        <button aria-label={paused ? 'Tocar' : 'Pausar'} className={`rs-ctl ${paused ? 'paused' : ''}`} onClick={toggle}>
          <svg aria-hidden="true" className="i-pause" fill="currentColor" viewBox="0 0 24 24"><rect height="14" rx="1.4" width="4" x="6.5" y="5" /><rect height="14" rx="1.4" width="4" x="13.5" y="5" /></svg>
          <svg aria-hidden="true" className="i-resume" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        </button>
        <span className="rs-time">{fmt(t.cur)}</span>
        <span className="rs-track" onClick={seek}><span className="rs-fill" style={{ width: `${t.dur ? (t.cur / t.dur) * 100 : 0}%` }} /></span>
        <span className="rs-time rs-left">-{fmt(Math.max(0, t.dur - t.cur))}</span>
        <button aria-label="Som" className={`rs-ctl rs-sound ${muted ? 'muted' : ''}`} onClick={toggleSound}>
          <svg aria-hidden="true" className="i-on" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></svg>
          <svg aria-hidden="true" className="i-off" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" /><path d="m16 9 5 5M21 9l-5 5" /></svg>
        </button>
      </div>
    </div>
  )
}
