import { db, must } from '../db'
import { env } from '../env'

export interface Integrations {
  public_url: string | null
  bynet_api_key: string | null
  bynet_base_url: string
  bynet_user_agent: string
  bynet_default_email: string | null
  bynet_address: Record<string, string>
  utmify_enabled: boolean
  utmify_api_token: string | null
  utmify_platform: string | null
  utmify_test_mode: boolean
}

let cache: { at: number; data: Integrations } | null = null

/** Credenciais dos gateways/rastreamento (somente no servidor). */
export async function getIntegrations(): Promise<Integrations> {
  if (cache && cache.at > Date.now() - 30_000) return cache.data
  const data = must<Integrations>(await db.from('integrations').select('*').eq('id', 1).single())
  cache = { at: Date.now(), data }
  return data
}

export const clearIntegrationsCache = () => {
  cache = null
}

export async function publicUrl() {
  const i = await getIntegrations()
  return (i.public_url || env.PUBLIC_URL || '').replace(/\/$/, '')
}

/** Mostra só o final da chave: ••••••a1b2 */
export const maskSecret = (v: string | null) => (v ? '••••••' + v.slice(-4) : '')
