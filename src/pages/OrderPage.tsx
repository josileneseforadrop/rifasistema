import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api, errorMessage } from '../lib/api'
import type { PublicOrder } from '../lib/types'
import { formatDateTime, mmss, money, padNumber, statusLabel, waLink } from '../lib/format'
import { track, useSettings } from '../context/SettingsContext'
import { Spinner } from '../components/Layout'
import type { PixData } from '../components/Checkout'
import Raspadinha from '../components/Raspadinha'

export function OrderNumbers({ order }: { order: PublicOrder }) {
  return (
    <>
      <div className="numbers">
        {order.numbers.map((n) => (
          <span key={n}>{padNumber(n, order.campaign.number_digits)}</span>
        ))}
      </div>
      {order.prizes.length > 0 && (
        <div className="alert success" style={{ marginTop: 12 }}>
          🏆 Parabéns! Você ganhou:{' '}
          {order.prizes.map((p) => `${p.prize} (nº ${padNumber(p.number, order.campaign.number_digits)})`).join(', ')}
        </div>
      )}
    </>
  )
}

const Hourglass = () => (
  <svg width="46" height="74" viewBox="0 0 46 74"><path d="M3 3h40v8L29 37l14 26v8H3v-8l14-26L3 11z" fill="#c5891f" stroke="#f1c232" strokeWidth="5" strokeLinejoin="round" /><path d="M12 64 23 46l11 18z" fill="#f1c232" /></svg>
)
const BigCheck = () => (
  <svg width="58" height="58" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.4" fill="none" stroke="#fde047" strokeWidth="2.2" /><path d="m7.3 12.4 3.1 3L16.8 9" stroke="#fde047" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const BigX = () => (
  <svg width="70" height="70" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#7a2a2a" /><path d="m8 8 8 8M16 8l-8 8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>
)
const Warn = () => (
  <svg width="34" height="30" viewBox="0 0 24 22"><path d="M12 1 23 21H1z" fill="#f0d27a" stroke="#f0d27a" strokeWidth="1.5" strokeLinejoin="round" /><rect x="11" y="8" width="2" height="7" rx="1" fill="#6b4a12" /><circle cx="12" cy="17.6" r="1.2" fill="#6b4a12" /></svg>
)
const InfoDot = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="10" /><path d="M12 11v6M12 7.5v.5" strokeLinecap="round" /></svg>
)

export default function OrderPage() {
  const { id } = useParams()
  const { settings } = useSettings()
  // vindo do checkout: pedido e PIX já chegam prontos
  const preload = (useLocation().state ?? {}) as { order?: PublicOrder; pix?: PixData | null }
  const fromCheckout = preload.order?.id === id
  const [order, setOrder] = useState<PublicOrder | null | undefined>(fromCheckout ? preload.order : undefined)
  const [pixCode, setPixCode] = useState(fromCheckout ? preload.pix?.qr_code ?? '' : '')
  const [qrImg, setQrImg] = useState(fromCheckout ? preload.pix?.qr_image ?? '' : '')
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const pixStarted = useRef(fromCheckout && !!preload.pix)

  const load = useCallback(async () => {
    const data = await api<PublicOrder>(`/orders/${id}`).catch((e) => (e.status === 404 ? null : undefined))
    if (data !== undefined) setOrder(data)
    return data ?? null
  }, [id])

  // sempre atualiza em segundo plano (mesmo com os dados vindos do checkout)
  useEffect(() => {
    load()
  }, [load])

  // gera o PIX no servidor
  useEffect(() => {
    if (!order || order.status !== 'pending' || pixStarted.current) return
    pixStarted.current = true
    api<{ qr_code: string; qr_image: string }>(`/orders/${order.id}/pix`, { body: {} })
      .then((pix) => {
        setPixCode(pix.qr_code)
        setQrImg(pix.qr_image)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [order])

  // relógio + verificação do pagamento
  useEffect(() => {
    if (order?.status !== 'pending') return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const poll = setInterval(async () => {
      const o = await load()
      if (o?.status === 'paid') track('Purchase', { value: Number(o.total), currency: 'BRL' })
    }, 5000)
    return () => {
      clearInterval(tick)
      clearInterval(poll)
    }
  }, [order?.status, load])

  // "mostrar meus números" (vindo da página do bônus)
  const { hash } = useLocation()
  useEffect(() => {
    if (hash === '#numeros' && order) setTimeout(() => document.getElementById('numeros')?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [hash, order?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = order ? new Date(order.expires_at).getTime() - now : 0
  const timeUp = order?.status === 'pending' && remaining <= 0
  useEffect(() => {
    if (timeUp) load()
  }, [timeUp, load])

  const waitingPix = order?.status === 'pending' && !pixCode && !error
  if (order === undefined || waitingPix)
    return (
      <main className="pay-wrap">
        <div className="pay-card center" style={{ padding: '50px 20px' }}>
          <Spinner />
          {waitingPix && <p className="muted">Gerando seu PIX...</p>}
        </div>
      </main>
    )
  if (order === null)
    return (
      <main className="pay-wrap">
        <div className="pay-card center" style={{ padding: 40 }}>Pedido não encontrado.</div>
      </main>
    )

  const copy = async () => {
    await navigator.clipboard.writeText(pixCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const c = order.campaign

  return (
    <main className="pay-wrap">
      <div className="pay-card">
        {order.status === 'pending' && (
          <>
            <div className="pay-status">
              <Hourglass />
              <div>
                <h2>Aguardando pagamento!</h2>
                <p>Realize o pagamento</p>
              </div>
            </div>
            <div className="pay-timer">
              Você tem <b>{mmss(remaining)}</b> para pagar
            </div>

            {error && <div className="alert error">{error}</div>}

            <div className="pay-step"><span className="n">1</span>Copie o código PIX abaixo.</div>
            <div className="pay-copy">
              <input readOnly value={pixCode} onFocus={(e) => e.target.select()} />
              <button onClick={copy} disabled={!pixCode}>{copied ? 'COPIADO!' : 'COPIAR'}</button>
            </div>
            <div className="pay-step"><span className="n">2</span>Abra o app do seu banco e escolha a opção PIX, como se fosse fazer uma transferência.</div>
            <div className="pay-step"><span className="n">3</span>Selecione a opção PIX cópia e cola, cole a chave copiada e confirme o pagamento.</div>

            <div className="pay-divider">
              <button onClick={() => setShowQr(!showQr)} disabled={!qrImg}>{showQr ? 'Ocultar QR Code' : 'Mostrar QR Code'}</button>
            </div>
            {showQr && qrImg && (
              <div className="pay-qr">
                <img src={qrImg} alt="QR Code PIX" />
                <h3>QR Code</h3>
                <p>Acesse o app do seu banco, escolha a opção de pagar com QR Code, escaneie o código acima e confirme o pagamento.</p>
              </div>
            )}

            <div className="pay-warn">
              <Warn />
              Este pagamento só pode ser realizado dentro do tempo. Após este período, caso o pagamento não seja confirmado, os títulos voltam a ficar
              disponíveis.
            </div>

            {order.payment_method === 'manual' && settings?.support_whatsapp && (
              <div className="center" style={{ marginTop: 18 }}>
                {settings.payment_instructions && <p className="muted pre" style={{ fontSize: 14 }}>{settings.payment_instructions}</p>}
                <a
                  className="btn success"
                  target="_blank"
                  rel="noreferrer"
                  href={waLink(settings.support_whatsapp, `Olá! Segue o comprovante do pedido #${order.code} (${c.title}) no valor de ${money(order.total)}.`)}
                >
                  Enviar comprovante
                </a>
              </div>
            )}
          </>
        )}

        {order.status === 'paid' && (
          <div className="pay-status" style={{ borderBottom: 0 }}>
            <BigCheck />
            <div>
              <h2>Pagamento identificado!</h2>
              <p>Seu pagamento foi aprovado</p>
            </div>
          </div>
        )}

        {(order.status === 'expired' || order.status === 'cancelled') && (
          <>
            <div className="pay-status" style={{ borderBottom: 0 }}>
              <BigX />
              <div>
                <h2>{order.status === 'expired' ? 'Pagamento expirado' : 'Pedido cancelado'}</h2>
                <p>Os títulos voltaram a ficar disponíveis.</p>
              </div>
            </div>
            <div className="center">
              <Link className="btn" to={`/campanha/${c.slug}`}>Comprar novamente</Link>
            </div>
          </>
        )}
      </div>

      <Link to={`/campanha/${c.slug}`} className="campaign-row" style={{ background: 'var(--card)', borderRadius: 22 }}>
        <img src={c.image || '/favicon.svg'} alt={c.title} />
        <div>
          <h3>{c.title}</h3>
          {c.subtitle && <p>{c.subtitle}</p>}
          {c.status === 'active' && c.badge_text && <span className="badge active blink">{c.badge_text}</span>}
        </div>
      </Link>

      {order.status === 'paid' && settings?.bonus?.enabled && (
        <Raspadinha orderId={order.id} name={order.customer.name} campaignSlug={order.campaign.slug} config={settings.bonus} />
      )}

      <div className="pay-details" id="numeros">
        <div className="head"><InfoDot /> Detalhes da sua compra</div>
        <div className="id">{order.id.replace(/-/g, '').slice(0, 24)}</div>
        <div className="line"><b>Comprador:</b> {order.customer.name}</div>
        {order.customer.cpf && <div className="line"><b>CPF:</b> {order.customer.cpf}</div>}
        {order.customer.phone && <div className="line"><b>Telefone:</b> {order.customer.phone}</div>}
        <div className="line"><b>Situação:</b> {statusLabel[order.status]}</div>
        {order.affiliate_code && <div className="line"><b>Afiliado:</b> {order.affiliate_code}</div>}
        <div className="line"><b>Data/horário:</b> {formatDateTime(order.created_at)}</div>
        {order.status === 'pending' && <div className="line"><b>Expira em:</b> {formatDateTime(order.expires_at)}</div>}
        {order.paid_at && <div className="line"><b>Pago em:</b> {formatDateTime(order.paid_at)}</div>}
        <div className="line"><b>Quantidade:</b> {order.quantity}</div>
        <div className="line"><b>Total:</b> {money(order.total)}</div>
        <div className="line"><b>Títulos:</b></div>
        {order.status === 'paid' ? (
          <OrderNumbers order={order} />
        ) : (
          <div className="note"><InfoDot size={28} /> Os títulos serão disponibilizados quando o pagamento for identificado</div>
        )}
      </div>
    </main>
  )
}
