import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '../lib/api'
import { formatPhone, money, onlyDigits } from '../lib/format'
import { useSettings } from '../context/SettingsContext'
import { Panel, SectionTitle } from '../components/Layout'

interface Stats {
  name: string
  code: string
  commission_percent: number
  active: boolean
  orders: number
  sales: number
  commission: number
  paid_out: number
}

export default function Affiliates() {
  const { settings } = useSettings()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pix, setPix] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const lookup = async (p = phone) => {
    setError('')
    try {
      const data = await api<Stats | null>('/affiliates/stats', { body: { phone: onlyDigits(p) } })
      if (!data) return setError('Afiliado não encontrado. Faça seu cadastro.')
      setStats(data)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const register = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      setStats(await api<Stats>('/affiliates/register', { body: { name, phone: onlyDigits(phone), email, pix_key: pix } }))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  if (!settings?.affiliates_enabled) return <Panel><p className="center muted">Programa de afiliados indisponível.</p></Panel>

  const link = stats ? `${location.origin}/?ref=${stats.code}` : ''

  return (
    <Panel>
      <SectionTitle emoji="🤝" title="Afiliados" subtitle="indique e ganhe" />
      {settings.affiliates_text && <div className="card pre">{settings.affiliates_text}</div>}
      {error && <div className="alert error">{error}</div>}
      {stats ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Olá, {stats.name.split(' ')[0]}!</h3>
          {!stats.active && <div className="alert error">Sua conta de afiliado está desativada.</div>}
          <div className="field">
            <label>Seu link de indicação</label>
            <div className="copy-area">
              <input className="input" readOnly value={link} />
              <button
                className="btn"
                onClick={() => {
                  navigator.clipboard.writeText(link)
                  setCopied(true)
                }}
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
          <div className="grid2">
            <p>Código: <b>{stats.code}</b></p>
            <p>Comissão: <b>{stats.commission_percent}%</b></p>
            <p>Vendas pagas: <b>{stats.orders}</b></p>
            <p>Total vendido: <b>{money(stats.sales)}</b></p>
            <p>Comissão acumulada: <b>{money(stats.commission)}</b></p>
            <p>Já recebido: <b>{money(stats.paid_out)}</b></p>
          </div>
          <div className="alert info">Saldo a receber: <b>{money(stats.commission - stats.paid_out)}</b></div>
          <button className="btn ghost" onClick={() => setStats(null)}>Sair</button>
        </div>
      ) : (
        <div className="card">
          <div className="row" style={{ marginBottom: 14 }}>
            <button className={`btn sm ${tab === 'login' ? '' : 'ghost'}`} onClick={() => setTab('login')}>Já sou afiliado</button>
            <button className={`btn sm ${tab === 'register' ? '' : 'ghost'}`} onClick={() => setTab('register')}>Quero ser afiliado</button>
          </div>
          {tab === 'login' ? (
            <form onSubmit={(e) => { e.preventDefault(); lookup() }}>
              <div className="field">
                <label>Telefone</label>
                <input inputMode="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} />
              </div>
              <button className="btn block">Acessar painel</button>
            </form>
          ) : (
            <form onSubmit={register}>
              <div className="field"><label>Nome completo</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div className="field"><label>Telefone (WhatsApp)</label><input inputMode="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} required /></div>
              <div className="field"><label>E-mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="field"><label>Chave PIX (para receber comissões)</label><input value={pix} onChange={(e) => setPix(e.target.value)} /></div>
              <button className="btn block">Cadastrar</button>
            </form>
          )}
        </div>
      )}
    </Panel>
  )
}
