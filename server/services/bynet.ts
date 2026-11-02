// Integração com o gateway Bynet (https://docs.techbynet.com)
import { fail } from '../http'
import { onlyDigits } from '../util'
import { getIntegrations, publicUrl } from './integrations'

export interface BynetTransaction {
  id: string
  status: string
  amount: number
  paidAt: string | null
  qrCode: string | null
  pix?: { qrcode?: string | null; expirationDate?: string | null } | null
  fee?: { estimatedFee?: number; netAmount?: number } | null
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}) {
  const i = await getIntegrations()
  if (!i.bynet_api_key) fail(400, 'Gateway Bynet sem API Key. Configure em Admin → Configurações → Pagamento.')
  const res = await fetch(`${i.bynet_base_url.replace(/\/$/, '')}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'x-api-key': i.bynet_api_key!,
      'User-Agent': i.bynet_user_agent || 'AtivoB2B/1.0',
      'Content-Type': 'application/json',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  const json = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, json: json as { message?: string; data?: T } | null }
}

export async function createBynetPix(input: {
  orderId: string
  orderCode: number
  amount: number
  title: string
  quantity: number
  customer: { id: string; name: string; email: string | null; phone: string; cpf: string | null }
}) {
  const i = await getIntegrations()
  if (!input.customer.cpf) fail(400, 'CPF do cliente não informado. Faça login novamente informando o CPF.')
  const address = i.bynet_address
  const email = input.customer.email || i.bynet_default_email || `cliente${input.orderCode}@email.com`
  const cents = Math.round(input.amount * 100)
  const url = await publicUrl()

  const r = await request<BynetTransaction>('/api/user/transactions', {
    method: 'POST',
    body: {
      amount: cents,
      paymentMethod: 'PIX',
      customer: {
        name: input.customer.name,
        email,
        phone: onlyDigits(input.customer.phone),
        document: { number: onlyDigits(input.customer.cpf), type: 'CPF' },
        externalRef: input.customer.id,
        address,
      },
      shipping: { fee: 0, address },
      items: [{ title: `${input.title} - ${input.quantity} título(s)`, unitPrice: cents, quantity: 1, tangible: false, externalRef: input.orderId }],
      pix: { expiresInDays: 1 },
      ...(url ? { postbackUrl: `${url}/api/webhooks/bynet` } : {}),
      metadata: JSON.stringify({ order_id: input.orderId, order_code: input.orderCode }),
    },
  })
  const t = r.json?.data
  if (!r.ok || !t) fail(502, `Bynet: ${r.json?.message ?? `erro ${r.status} ao gerar o PIX`}`)
  const qr = t!.qrCode || t!.pix?.qrcode
  if (!qr) fail(502, 'Bynet não retornou o código PIX')
  return { id: t!.id, qrCode: qr!, fee: t!.fee?.estimatedFee ?? null }
}

export async function getBynetTransaction(id: string) {
  const r = await request<BynetTransaction>(`/api/user/transactions/${encodeURIComponent(id)}`)
  return r.ok ? r.json?.data ?? null : null
}

/** Testa a credencial consultando uma transação inexistente: 404 = chave válida, 401/403 = inválida. */
export async function testBynet() {
  const r = await request(`/api/user/transactions/00000000-0000-0000-0000-000000000000`)
  if (r.status === 401 || r.status === 403) return { ok: false, message: 'API Key recusada pela Bynet (não autorizado)' }
  if (r.status >= 500) return { ok: false, message: `Bynet indisponível (erro ${r.status})` }
  return { ok: true, message: 'Conexão com a Bynet OK' }
}

export const bynetStatus = (s: string | null | undefined) => String(s ?? '').toLowerCase()
