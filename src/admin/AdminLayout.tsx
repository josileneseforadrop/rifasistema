import { Suspense, useEffect, useState, type FormEvent } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { adminApi, adminToken, api, errorMessage } from '../lib/api'
import { useSettings } from '../context/SettingsContext'
import ErrorBoundary from '../components/ErrorBoundary'
import { preloadAdmin } from './lazy'

interface Admin {
  id: string
  name: string
  email: string
}

function AdminLogin({ onLogin }: { onLogin: (a: Admin) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { token, admin } = await api<{ token: string; admin: Admin }>('/admin/login', { body: { email, password } })
      adminToken.set(token)
      onLogin(admin)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap admin">
      <form className="card" style={{ width: 'min(400px, 100%)' }} onSubmit={submit}>
        <h2 style={{ marginTop: 0 }}>Painel administrativo</h2>
        {error && <div className="alert error">{error}</div>}
        <div className="field"><label>E-mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="field"><label>Senha</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <button className="btn block" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
      </form>
    </div>
  )
}

const links = [
  ['/admin', '📊 Dashboard'],
  ['/admin/campanhas', '🎟️ Campanhas'],
  ['/admin/pedidos', '🧾 Pedidos'],
  ['/admin/clientes', '👥 Clientes'],
  ['/admin/sorteio', '🎲 Sorteio / Consulta'],
  ['/admin/ganhadores', '🏆 Ganhadores'],
  ['/admin/comunicados', '📢 Comunicados'],
  ['/admin/afiliados', '🤝 Afiliados'],
  ['/admin/configuracoes', '⚙️ Configurações'],
  ['/admin/administradores', '🔐 Administradores'],
]

export default function AdminLayout() {
  const { settings } = useSettings()
  const [admin, setAdmin] = useState<Admin | null | undefined>(adminToken.get() ? undefined : null)
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    if (adminToken.get()) adminApi<Admin>('/admin/me').then(setAdmin).catch(() => setAdmin(null))
    const out = () => setAdmin(null)
    window.addEventListener('admin-logout', out)
    return () => window.removeEventListener('admin-logout', out)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const logout = () => {
    adminToken.set(null)
    setAdmin(null)
  }

  useEffect(() => {
    if (!admin) return
    const t = setTimeout(preloadAdmin, 1500)
    return () => clearTimeout(t)
  }, [admin])

  if (admin === undefined) return <div className="login-wrap"><div className="spinner" /></div>
  if (!admin) return <AdminLogin onLogin={setAdmin} />

  return (
    <div className="admin">
      <div className="admin-mobile-bar">
        <button className="btn ghost sm" onClick={() => setMenuOpen(true)}>☰</button>
        <b>{settings?.site_name} · Admin</b>
      </div>
      <aside className={`admin-side ${menuOpen ? 'open' : ''}`}>
        <div className="brand">{settings?.site_name ?? 'Admin'}</div>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/admin'}>{label}</NavLink>
        ))}
        <hr style={{ borderColor: '#1f2633', margin: '14px 0' }} />
        <a href="/" target="_blank">🌐 Ver site</a>
        <a href="#" onClick={(e) => { e.preventDefault(); logout() }}>🚪 Sair</a>
        <div className="muted" style={{ fontSize: 11, padding: 12 }}>{admin.email}</div>
      </aside>
      {menuOpen && <div className="modal-bg" style={{ zIndex: 250 }} onClick={() => setMenuOpen(false)} />}
      <main className="admin-main">
        {/* erro ou carregamento afetam só o conteúdo: o menu lateral continua funcionando */}
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<div className="spinner" />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}
