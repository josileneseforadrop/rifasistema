import { Suspense, useEffect } from 'react'
import { Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { captureUrlParams, withSavedParams } from './lib/urlParams'
import { lazyRetry } from './lib/lazyRetry'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import Home from './pages/Home'
import Campaigns from './pages/Campaigns'
import CampaignPage from './pages/CampaignPage'
import OrderPage from './pages/OrderPage'
import MyTickets from './pages/MyTickets'
import Register from './pages/Register'
import Winners from './pages/Winners'
import Announcements from './pages/Announcements'
import Affiliates from './pages/Affiliates'
import Terms from './pages/Terms'
import Support from './pages/Support'
import NotFound from './pages/NotFound'

// painel admin carregado sob demanda (não pesa no site público)
import { AdminsAdmin, AffiliatesAdmin, AnnouncementsAdmin, CampaignForm, CampaignsList, Customers, Dashboard, Draw, Orders, SettingsAdmin, WinnersAdmin } from './admin/lazy'
const AdminLayout = lazyRetry(() => import('./admin/AdminLayout'))

/** repassa os parâmetros de rastreamento (UTMs etc.) para todas as páginas públicas */
function KeepUrlParams() {
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (pathname.startsWith('/admin')) return
    captureUrlParams(search)
    const merged = withSavedParams(search)
    if (merged) navigate(`${pathname}${merged}${hash}`, { replace: true })
  }, [pathname, search, hash, navigate])
  return null
}

function PublicLayout() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return (
    <Layout>
      <KeepUrlParams />
      <ErrorBoundary resetKey={pathname}>
        <Outlet />
      </ErrorBoundary>
    </Layout>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
    <Suspense fallback={<div className="spinner" />}>
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/campanhas" element={<Campaigns />} />
        <Route path="/campanha/:slug" element={<CampaignPage />} />
        <Route path="/pedido/:id" element={<OrderPage />} />
        <Route path="/meus-titulos" element={<MyTickets />} />
        <Route path="/cadastro" element={<Register />} />
        <Route path="/ganhadores" element={<Winners />} />
        <Route path="/comunicados" element={<Announcements />} />
        <Route path="/afiliados" element={<Affiliates />} />
        <Route path="/termos" element={<Terms />} />
        <Route path="/suporte" element={<Support />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="campanhas" element={<CampaignsList />} />
        <Route path="campanhas/:id" element={<CampaignForm />} />
        <Route path="pedidos" element={<Orders />} />
        <Route path="clientes" element={<Customers />} />
        <Route path="sorteio" element={<Draw />} />
        <Route path="ganhadores" element={<WinnersAdmin />} />
        <Route path="comunicados" element={<AnnouncementsAdmin />} />
        <Route path="afiliados" element={<AffiliatesAdmin />} />
        <Route path="configuracoes" element={<SettingsAdmin />} />
        <Route path="administradores" element={<AdminsAdmin />} />
      </Route>
    </Routes>
    </Suspense>
    </ErrorBoundary>
  )
}
