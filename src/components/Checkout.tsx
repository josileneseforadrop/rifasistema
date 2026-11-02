import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../lib/api'
import type { Campaign, Customer, PublicOrder } from '../lib/types'

export interface PixData {
  qr_code: string
  qr_image: string
}
import { birthToIso, formatBirth, formatCpf, formatPhone, isValidCpf, money, onlyDigits } from '../lib/format'
import { getTracking, useCustomer } from '../context/CustomerContext'
import { track, useSettings } from '../context/SettingsContext'

// no celular não abre o teclado sozinho (cobriria metade do checkout)
const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

// ---------------------------------------------------------------------
// peças visuais
// ---------------------------------------------------------------------
const InfoIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#7cb3f0" /><rect x="11" y="10" width="2" height="7" rx="1" fill="#0d2a7a" /><circle cx="12" cy="7" r="1.3" fill="#0d2a7a" /></svg>
)
const CheckIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#9ee29a" /><path d="m7 12.5 3.2 3L17 9" stroke="#1d5c1a" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const WarnIcon = () => (
  <svg width="34" height="30" viewBox="0 0 24 22"><path d="M12 1 23 21H1z" fill="#f0d27a" stroke="#f0d27a" strokeWidth="1.5" strokeLinejoin="round" /><rect x="11" y="8" width="2" height="7" rx="1" fill="#6b4a12" /><circle cx="12" cy="17.6" r="1.2" fill="#6b4a12" /></svg>
)
const ArrowCircle = () => (
  <svg width="30" height="30" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#1f2530" /><path d="M7 12h9M12.5 8l4 4-4 4" stroke="var(--primary)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

export const Banner = ({ tone, children }: { tone: 'info' | 'success' | 'warn'; children: ReactNode }) => (
  <div className={`ck-banner ${tone}`}>
    {tone === 'info' ? <InfoIcon /> : tone === 'success' ? <CheckIcon /> : <WarnIcon />}
    <div>{children}</div>
  </div>
)

function OField({ label, children, active }: { label: string; children: ReactNode; active?: boolean }) {
  return (
    <label className={`ofield ${active ? 'active' : ''}`}>
      <span className="ofield-label">{label}</span>
      {children}
    </label>
  )
}

function PhoneInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <OField label={label} active>
      <div className="phone-row">
        <span className="flag" title="Brasil (+55)">🇧🇷</span>
        <span className="chev">⌄</span>
        <span className="sep" />
        <input inputMode="tel" type="tel" autoComplete="tel-national" placeholder="Telefone" value={value} onChange={(e) => onChange(formatPhone(e.target.value))} />
      </div>
    </OField>
  )
}

function Terms() {
  const { settings } = useSettings()
  return (
    <p className="ck-terms">
      {settings?.checkout_terms_text ?? 'Ao continuar, declaro que li e concordo com os'}{' '}
      <Link to="/termos" target="_blank">termos de uso</Link>.
    </p>
  )
}

const SubmitButton = ({ children, loading, disabled, loadingText = 'Aguarde...' }: { children: ReactNode; loading?: boolean; disabled?: boolean; loadingText?: string }) => (
  <button className="ck-submit" disabled={loading || disabled}>
    {loading && <span className="btn-spin" />}
    <span>{loading ? loadingText : children}</span>
    {!loading && <ArrowCircle />}
  </button>
)

// ---------------------------------------------------------------------
// Identificação: CPF -> (cadastro) -> cliente
// ---------------------------------------------------------------------
export function IdentityForm({
  onIdentified,
  banner,
  submitLabel = 'Concluir Reserva',
}: {
  onIdentified: (c: Customer) => void
  banner?: ReactNode
  submitLabel?: string
}) {
  const { affiliateCode } = useCustomer()
  const [step, setStep] = useState<'cpf' | 'register'>('cpf')
  const [cpf, setCpf] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [phone2, setPhone2] = useState('')
  const [birth, setBirth] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submitCpf = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!isValidCpf(cpf)) return setError('CPF inválido')
    setLoading(true)
    try {
      const r = await api<{ found: boolean; customer?: Customer }>('/customers/identify', { body: { cpf: onlyDigits(cpf) } })
      if (r.found && r.customer) onIdentified(r.customer)
      else setStep('register')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const submitRegister = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!isValidCpf(cpf)) return setError('CPF inválido')
    if (name.trim().split(/\s+/).length < 2) return setError('Informe seu nome completo')
    if (onlyDigits(phone).length < 10) return setError('Informe um telefone válido com DDD')
    if (onlyDigits(phone) !== onlyDigits(phone2)) return setError('Os telefones não conferem')
    const iso = birthToIso(birth)
    if (!iso) return setError('Data de nascimento inválida')
    setLoading(true)
    try {
      const c = await api<Customer>('/customers/register', {
        body: { cpf: onlyDigits(cpf), name: name.trim(), phone: onlyDigits(phone), birth_date: iso, affiliate_code: affiliateCode },
      })
      track('CompleteRegistration')
      onIdentified(c)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const filled = step === 'cpf' ? isValidCpf(cpf) : name && phone && phone2 && birth
  return (
    <form onSubmit={step === 'cpf' ? submitCpf : submitRegister} noValidate>
      {banner}
      <OField label="Informe seu CPF*" active>
        <input
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          value={cpf}
          autoFocus={!isTouch}
          onChange={(e) => {
            setCpf(formatCpf(e.target.value))
            if (step === 'register') setStep('cpf')
          }}
        />
      </OField>
      {step === 'register' && (
        <>
          <OField label="Nome Completo*" active={!!name}>
            <input placeholder="Nome Completo*" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!isTouch} />
          </OField>
          <PhoneInput label="Telefone*" value={phone} onChange={setPhone} />
          <PhoneInput label="Confirme o Telefone*" value={phone2} onChange={setPhone2} />
          <OField label="Data de Nascimento*" active={!!birth}>
            <input inputMode="numeric" autoComplete="bday" placeholder="Data de Nascimento*" value={birth} onChange={(e) => setBirth(formatBirth(e.target.value))} />
          </OField>
        </>
      )}
      {error ? <Banner tone="warn">{error}</Banner> : !filled && <Banner tone="warn">Informe seus dados para continuar</Banner>}
      <Terms />
      <SubmitButton loading={loading}>{step === 'cpf' ? submitLabel : 'Concluir Cadastro'}</SubmitButton>
    </form>
  )
}

// ---------------------------------------------------------------------
// Gaveta (bottom sheet)
// ---------------------------------------------------------------------
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', esc)
    }
  }, [onClose])
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-head">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM1 2v2h2l3.6 7.6-1.4 2.4A2 2 0 0 0 7 17h12v-2H7.4l1.1-2h7.5a2 2 0 0 0 1.7-1l3.6-6.5A1 1 0 0 0 20.4 4H5.2l-.9-2zm16 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" /></svg>
          <h2>{title}</h2>
          <button className="sheet-x" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export default function CheckoutSheet({ campaign, quantity, onClose }: { campaign: Campaign; quantity: number; onClose: () => void }) {
  const navigate = useNavigate()
  const { customer, setCustomer, affiliateCode } = useCustomer()
  const [bumps, setBumps] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const extra = bumps.reduce((s, i) => s + Number(campaign.order_bumps[i]?.qty ?? 0), 0)
  const summary = (
    <>
      Você está adquirindo <b>{quantity + extra}</b> unidade(s) do produto <b className="ck-product">{campaign.title}</b>
    </>
  )

  // pedido já criado (se o PIX falhar, tentar de novo não cria outro pedido)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [stage, setStage] = useState<'idle' | 'order' | 'pix'>('idle')

  const reserve = async (e: FormEvent) => {
    e.preventDefault()
    if (!customer) return
    setLoading(true)
    setError('')
    try {
      let id = orderId
      if (!id) {
        setStage('order')
        id = (
          await api<{ id: string }>('/orders', {
            body: { campaign_id: campaign.id, customer_id: customer.id, quantity, bumps, affiliate_code: affiliateCode, tracking: getTracking(), bonus_from: sessionStorage.getItem('bonus_from') },
          })
        ).id
        setOrderId(id)
        sessionStorage.removeItem('bonus_from')
        track('InitiateCheckout', { num_items: quantity + extra, currency: 'BRL' })
      }
      // só abre a página de pagamento com o PIX pronto
      setStage('pix')
      const order = await api<PublicOrder>(`/orders/${id}`)
      const pix = order.status === 'pending' ? await api<PixData>(`/orders/${id}/pix`, { body: {} }) : null
      navigate(`/pedido/${id}`, { state: { order, pix } })
    } catch (err) {
      setError(errorMessage(err))
      // cliente removido do sistema: pede identificação de novo
      if (/Cliente inválido/.test(errorMessage(err))) setCustomer(null)
    } finally {
      setLoading(false)
      setStage('idle')
    }
  }

  return (
    <Sheet title="Checkout" onClose={onClose}>
      {!customer ? (
        <IdentityForm onIdentified={setCustomer} banner={<Banner tone="info">{summary}</Banner>} />
      ) : (
        <form onSubmit={reserve}>
          <Banner tone="success">{summary}</Banner>

          {campaign.order_bumps?.length > 0 && (
            <div className="bumps">
              {campaign.order_bumps_title && <h3>{campaign.order_bumps_title}</h3>}
              {campaign.order_bumps_subtitle && <p>{campaign.order_bumps_subtitle}</p>}
              {campaign.order_bumps.map((b, i) => {
                const on = bumps.includes(i)
                return (
                  <button
                    type="button"
                    key={i}
                    className={`bump ${on ? 'on' : ''}`}
                    onClick={() => setBumps(on ? bumps.filter((x) => x !== i) : [...bumps, i])}
                    aria-pressed={on}
                  >
                    <span className="switch"><span /></span>
                    <span className="bump-text">
                      Que tal adicionar +<b>{b.qty}</b> títulos por apenas <b>{money(b.price)}</b>
                      {b.label && <strong>{b.label}</strong>}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="ck-customer">
            <div className="avatar">
              <svg viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="9" r="5" /><path d="M2 24c0-6 4.5-9 10-9s10 3 10 9z" /></svg>
            </div>
            <div>
              <div className="name">{customer.name}</div>
              {customer.phone && <div className="phone">+55 {customer.phone}</div>}
            </div>
          </div>

          {error && <Banner tone="warn">{error}</Banner>}
          <Terms />
          <SubmitButton loading={loading} loadingText={stage === 'pix' ? 'Gerando PIX...' : 'Reservando...'}>
            {orderId ? 'Tentar novamente' : 'Concluir Reserva'}
          </SubmitButton>
          {!orderId && <button type="button" className="ck-link" onClick={() => setCustomer(null)}>Alterar conta</button>}
        </form>
      )}
    </Sheet>
  )
}
