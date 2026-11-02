// Envio de vendas para a Utmify (https://docs.utmify.com.br/envio-de-vendas)
import { db, must } from '../db'
import { getIntegrations } from './integrations'

export type UtmifyStatus = 'waiting_payment' | 'paid' | 'refused' | 'refunded' | 'chargedback'

const TRACKING_KEYS = ['src', 'sck', 'utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term'] as const

/** "YYYY-MM-DD HH:MM:SS" em UTC */
const utc = (d: string | null | undefined) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) : null)

export function cleanTracking(input: unknown) {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const k of TRACKING_KEYS) if (src[k]) out[k] = String(src[k]).slice(0, 300)
  return out
}

async function post(token: string, body: unknown) {
  const res = await fetch('https://api.utmify.com.br/api-credentials/orders', {
    method: 'POST',
    headers: { 'x-api-token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, text }
}

async function buildPayload(orderId: string, status: UtmifyStatus) {
  const o = must(
    await db.from('orders').select('*, customers(name,email,phone,cpf), campaigns(id,title)').eq('id', orderId).single(),
  )
  const i = await getIntegrations()
  const s = must(await db.from('settings').select('site_name').eq('id', 1).single())
  const total = Math.round(Number(o.total) * 100)
  const fee = o.gateway_fee != null ? Math.round(Number(o.gateway_fee) * 100) : 0
  const tracking = Object.fromEntries(TRACKING_KEYS.map((k) => [k, o.tracking?.[k] ?? null]))
  return {
    orderId: String(o.code),
    platform: i.utmify_platform || (s.site_name ?? 'Rifa').replace(/\s+/g, ''),
    paymentMethod: total === 0 ? 'free_price' : 'pix',
    status,
    createdAt: utc(o.created_at),
    approvedDate: status === 'paid' || status === 'refunded' || status === 'chargedback' ? utc(o.paid_at ?? new Date().toISOString()) : null,
    refundedAt: status === 'refunded' || status === 'chargedback' ? utc(new Date().toISOString()) : null,
    customer: {
      name: o.customers?.name ?? 'Cliente',
      email: o.customers?.email || i.bynet_default_email || `cliente${o.code}@email.com`,
      phone: o.customers?.phone ?? null,
      document: o.customers?.cpf ?? null,
      country: 'BR',
      ...(o.customer_ip ? { ip: o.customer_ip } : {}),
    },
    products: [
      {
        id: o.campaigns?.id ?? o.campaign_id,
        name: `${o.campaigns?.title ?? 'Campanha'} (${o.quantity} títulos)`,
        planId: null,
        planName: null,
        quantity: 1,
        priceInCents: total,
      },
    ],
    trackingParameters: tracking,
    commission: { totalPriceInCents: total, gatewayFeeInCents: fee, userCommissionInCents: Math.max(total - fee, total > 0 ? 1 : 0), currency: 'BRL' },
    isTest: i.utmify_test_mode,
  }
}

export interface UtmifyLogEntry {
  at: string
  status: UtmifyStatus
  ok: boolean
  http?: number
  error?: string
  skipped?: string
  test?: boolean
  tracking?: Record<string, string | null>
}

/** registra a tentativa no histórico do pedido (mantém as 20 últimas) */
async function log(orderId: string, entry: UtmifyLogEntry) {
  const cur = await db.from('orders').select('utmify_log').eq('id', orderId).maybeSingle()
  const list = Array.isArray(cur.data?.utmify_log) ? (cur.data!.utmify_log as UtmifyLogEntry[]) : []
  const label = entry.ok ? entry.status : entry.skipped ? `não enviado: ${entry.status}` : `erro ${entry.http ?? ''}: ${entry.status}`.trim()
  await db.from('orders').update({ utmify_log: [...list, entry].slice(-20), utmify_status: label }).eq('id', orderId)
}

/** Envia o status do pedido para a Utmify e registra o resultado no pedido. */
export async function sendUtmify(orderId: string, status: UtmifyStatus): Promise<UtmifyLogEntry> {
  const at = new Date().toISOString()
  const i = await getIntegrations()
  let entry: UtmifyLogEntry
  if (!i.utmify_enabled || !i.utmify_api_token) {
    entry = { at, status, ok: false, skipped: !i.utmify_enabled ? 'Utmify desativada nas configurações' : 'Token da Utmify não configurado' }
  } else {
    try {
      const payload = await buildPayload(orderId, status)
      const r = await post(i.utmify_api_token, payload)
      entry = { at, status, ok: r.ok, http: r.status, test: payload.isTest, tracking: payload.trackingParameters }
      if (!r.ok) {
        entry.error = r.text.slice(0, 300)
        console.error(`[utmify] pedido ${orderId} (${status}) falhou: ${r.status} ${entry.error}`)
      }
    } catch (e) {
      entry = { at, status, ok: false, error: (e as Error).message.slice(0, 300) }
    }
  }
  await log(orderId, entry).catch((e) => console.error('[utmify log]', e.message))
  return entry
}

/** Dispara o envio sem bloquear a venda. */
export function notifyUtmify(orderId: string, status: UtmifyStatus) {
  sendUtmify(orderId, status).catch((e) => console.error('[utmify]', e.message))
}

/** Envia um pedido de teste (isTest = true, não é salvo na Utmify). */
export async function testUtmify(token?: string | null) {
  const i = await getIntegrations()
  const t = token || i.utmify_api_token
  if (!t) return { ok: false, message: 'Informe o token da API da Utmify' }
  const now = utc(new Date().toISOString())
  const r = await post(t, {
    orderId: `teste-${Date.now()}`,
    platform: i.utmify_platform || 'Rifa',
    paymentMethod: 'pix',
    status: 'paid',
    createdAt: now,
    approvedDate: now,
    refundedAt: null,
    customer: { name: 'Cliente Teste', email: 'teste@email.com', phone: null, document: null },
    products: [{ id: 'teste', name: 'Produto teste', planId: null, planName: null, quantity: 1, priceInCents: 100 }],
    trackingParameters: Object.fromEntries(TRACKING_KEYS.map((k) => [k, null])),
    commission: { totalPriceInCents: 100, gatewayFeeInCents: 0, userCommissionInCents: 100 },
    isTest: true,
  })
  return r.ok ? { ok: true, message: 'Token válido — a Utmify aceitou o pedido de teste' } : { ok: false, message: `Utmify recusou (${r.status}): ${r.text.slice(0, 200)}` }
}
