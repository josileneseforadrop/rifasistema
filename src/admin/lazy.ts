// Telas do painel admin, carregadas sob demanda (com nova tentativa se o arquivo falhar)
import { lazyRetry } from '../lib/lazyRetry'

export const Dashboard = lazyRetry(() => import('./Dashboard'))
export const CampaignsList = lazyRetry(() => import('./CampaignsList'))
export const CampaignForm = lazyRetry(() => import('./CampaignForm'))
export const Orders = lazyRetry(() => import('./Orders'))
export const Customers = lazyRetry(() => import('./Customers'))
export const Draw = lazyRetry(() => import('./Draw'))
export const WinnersAdmin = lazyRetry(() => import('./WinnersAdmin'))
export const AnnouncementsAdmin = lazyRetry(() => import('./AnnouncementsAdmin'))
export const AffiliatesAdmin = lazyRetry(() => import('./AffiliatesAdmin'))
export const SettingsAdmin = lazyRetry(() => import('./SettingsAdmin'))
export const AdminsAdmin = lazyRetry(() => import('./AdminsAdmin'))

/** baixa o código de todas as telas em segundo plano (troca de aba instantânea) */
export const preloadAdmin = () =>
  [Dashboard, CampaignsList, CampaignForm, Orders, Customers, Draw, WinnersAdmin, AnnouncementsAdmin, AffiliatesAdmin, SettingsAdmin, AdminsAdmin].forEach(
    (c) => c.preload().catch(() => undefined),
  )
