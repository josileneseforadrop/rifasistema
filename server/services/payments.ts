import QRCode from 'qrcode'
import { db, must } from '../db'
import { fail } from '../http'
import { buildPixPayload } from '../util'
import { cancelOrder, getOrder, getSettings, markPaid, type OrderRow } from './orders'
import { bynetStatus, createBynetPix, getBynetTransaction } from './bynet'
import { notifyUtmify } from './utmify'

const qrImage = (code: string) => QRCode.toDataURL(code, { width: 480, margin: 1 })

/** Gera (ou devolve) o PIX de um pedido pendente. */
export async function ensurePix(orderId: string) {
  const o = await getOrder(orderId)
  if (!o) return fail(404, 'Pedido não encontrado')
  if (o.status !== 'pending') fail(400, 'Este pedido não está aguardando pagamento')

  if (o.payment_method === 'bynet') {
    if (o.pix_qr_code) return { qr_code: o.pix_qr_code, qr_image: await qrImage(o.pix_qr_code) }
    const [customer, campaign] = await Promise.all([
      db.from('customers').select('id,name,email,phone,cpf').eq('id', o.customer_id).single(),
      db.from('campaigns').select('title').eq('id', o.campaign_id).single(),
    ])
    const tx = await createBynetPix({
      orderId: o.id,
      orderCode: o.code,
      amount: Number(o.total),
      title: must(campaign).title,
      quantity: o.quantity,
      customer: must(customer),
    })
    must(
      await db
        .from('orders')
        .update({ payment_id: tx.id, pix_qr_code: tx.qrCode, ...(tx.fee != null ? { gateway_fee: tx.fee / 100 } : {}) })
        .eq('id', o.id),
    )
    return { qr_code: tx.qrCode, qr_image: await qrImage(tx.qrCode) }
  }

  // PIX manual (chave própria)
  const s = await getSettings()
  if (!s.pix_key) fail(400, 'Chave PIX não configurada. Entre em contato com o suporte.')
  const payload = buildPixPayload({
    key: s.pix_key,
    name: s.pix_receiver_name ?? s.site_name,
    city: s.pix_city ?? 'SAO PAULO',
    amount: Number(o.total),
    txid: `PED${o.code}`,
  })
  return { qr_code: payload, qr_image: await qrImage(payload) }
}

/** Consulta a transação na Bynet e aplica o status no pedido (nunca confia só no webhook). */
export async function syncBynetTransaction(transactionId: string) {
  const tx = await getBynetTransaction(transactionId)
  if (!tx) return
  const o = must<OrderRow | null>(await db.from('orders').select('*').eq('payment_id', tx.id).maybeSingle())
  if (!o) return
  const st = bynetStatus(tx.status)
  if (st === 'paid' || st === 'approved') {
    if (tx.fee?.estimatedFee != null) await db.from('orders').update({ gateway_fee: tx.fee.estimatedFee / 100 }).eq('id', o.id)
    await markPaid(o.id, tx.id)
  } else if ((st === 'refunded' || st === 'chargedback' || st === 'chargeback') && o.status === 'paid') {
    await cancelOrder(o.id, st === 'refunded' ? 'refunded' : 'chargedback')
  } else if (st === 'refused' && o.status === 'pending') {
    notifyUtmify(o.id, 'refused')
  }
}

// Consulta de status enquanto o cliente está na página do pedido (funciona mesmo sem webhook)
const lastCheck = new Map<string, number>()
export async function maybeCheckPayment(o: OrderRow) {
  if (o.status !== 'pending' || o.payment_method !== 'bynet' || !o.payment_id) return false
  const now = Date.now()
  if ((lastCheck.get(o.id) ?? 0) > now - 8000) return false
  lastCheck.set(o.id, now)
  if (lastCheck.size > 10000) lastCheck.clear()
  await syncBynetTransaction(o.payment_id)
  return true
}
