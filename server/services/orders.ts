import { db, fetchAll, must } from '../db'
import { fail } from '../http'
import { withLock } from '../lock'
import { firstName, maskCpf, maskPhoneFull } from '../util'
import { cleanTracking, notifyUtmify } from './utmify'

export interface CampaignRow {
  id: string
  slug: string
  title: string
  status: string
  price: number
  images: string[]
  total_numbers: number
  number_start: number
  number_digits: number
  min_per_order: number
  max_per_order: number
  max_per_customer: number | null
  promotions: { qty: number; price: number }[]
  order_bumps: { qty: number; price: number; label?: string }[]
  sold_count: number
  reserved_count: number
  draw_date: string | null
}

export interface OrderRow {
  id: string
  code: number
  campaign_id: string
  customer_id: string
  affiliate_id: string | null
  quantity: number
  unit_price: number
  total: number
  status: 'pending' | 'paid' | 'cancelled' | 'expired'
  payment_method: string
  payment_id: string | null
  pix_qr_code: string | null
  pix_qr_base64: string | null
  expires_at: string
  paid_at: string | null
  created_at: string
  bonus_claimed_at?: string | null
}

export async function getSettings() {
  return must(await db.from('settings').select('*').eq('id', 1).single())
}

async function getCampaign(id: string): Promise<CampaignRow | null> {
  return must(await db.from('campaigns').select('*').eq('id', id).maybeSingle())
}

export async function getOrder(id: string): Promise<OrderRow | null> {
  return must(await db.from('orders').select('*').eq('id', id).maybeSingle())
}

/** Ajusta os contadores da campanha (deve ser chamado dentro do lock da campanha). */
async function addCounts(campaignId: string, dReserved: number, dSold: number) {
  const c = must(await db.from('campaigns').select('reserved_count,sold_count').eq('id', campaignId).single())
  must(
    await db
      .from('campaigns')
      .update({
        reserved_count: Math.max(0, Number(c.reserved_count) + dReserved),
        sold_count: Math.max(0, Number(c.sold_count) + dSold),
      })
      .eq('id', campaignId),
  )
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Sorteia números livres para um pedido. A chave primária (campaign_id, number)
 * impede duplicidade: números já ocupados são ignorados e sorteamos de novo.
 */
async function allocateTickets(c: CampaignRow, orderId: string, customerId: string, qty: number) {
  const start = Number(c.number_start)
  const total = Number(c.total_numbers)
  let needed = qty
  let attempts = 0

  while (needed > 0) {
    attempts++
    let candidates: number[]
    if (attempts <= 30) {
      const set = new Set<number>()
      while (set.size < needed) set.add(start + Math.floor(Math.random() * total))
      candidates = [...set]
    } else {
      // campanha quase cheia: calcula os números livres
      const taken = new Set(
        (await fetchAll<{ number: number }>((f, t) => db.from('tickets').select('number').eq('campaign_id', c.id).range(f, t))).map((r) =>
          Number(r.number),
        ),
      )
      const free: number[] = []
      for (let n = start; n < start + total; n++) if (!taken.has(n)) free.push(n)
      if (free.length < needed) fail(409, 'Não há títulos suficientes disponíveis')
      candidates = shuffle(free).slice(0, needed)
    }

    let inserted = 0
    for (let i = 0; i < candidates.length; i += 5000) {
      const rows = candidates.slice(i, i + 5000).map((number) => ({ campaign_id: c.id, number, order_id: orderId, customer_id: customerId }))
      const res = must(
        await db.from('tickets').upsert(rows, { onConflict: 'campaign_id,number', ignoreDuplicates: true }).select('number'),
      )
      inserted += res?.length ?? 0
    }
    needed -= inserted
    if (attempts > 31 && inserted === 0) fail(409, 'Não há títulos suficientes disponíveis')
  }
}

/** Marca como ganhadores os títulos premiados que já foram pagos. */
export async function awardPrizes(campaignId: string, orderId?: string) {
  const titles = must(
    await db.from('prize_titles').select('id,number').eq('campaign_id', campaignId).is('customer_id', null),
  ) as { id: string; number: number }[]
  if (!titles.length) return
  const byNumber = new Map(titles.map((t) => [Number(t.number), t.id]))
  const nums = [...byNumber.keys()]
  for (let i = 0; i < nums.length; i += 200) {
    let q = db
      .from('tickets')
      .select('number, order_id, customer_id, orders!inner(status), customers(name)')
      .eq('campaign_id', campaignId)
      .in('number', nums.slice(i, i + 200))
      .eq('orders.status', 'paid')
    if (orderId) q = q.eq('order_id', orderId)
    const tickets = must(await q) as unknown as { number: number; order_id: string; customer_id: string; customers: { name: string } }[]
    for (const t of tickets) {
      must(
        await db
          .from('prize_titles')
          .update({ winner_name: firstName(t.customers?.name ?? ''), customer_id: t.customer_id, order_id: t.order_id, won_at: new Date().toISOString() })
          .eq('id', byNumber.get(Number(t.number))!)
          .is('customer_id', null),
      )
    }
  }
}

/** Expira pedidos pendentes vencidos e libera os números. */
export async function expireOrders(campaignId?: string, alreadyLocked = false) {
  let q = db.from('orders').select('id,campaign_id,quantity').eq('status', 'pending').lt('expires_at', new Date().toISOString())
  if (campaignId) q = q.eq('campaign_id', campaignId)
  const rows = (must(await q.limit(1000)) ?? []) as { id: string; campaign_id: string; quantity: number }[]
  const groups = new Map<string, typeof rows>()
  for (const r of rows) groups.set(r.campaign_id, [...(groups.get(r.campaign_id) ?? []), r])

  for (const [cid, list] of groups) {
    const run = async () => {
      let released = 0
      for (const o of list) {
        const upd = must(await db.from('orders').update({ status: 'expired' }).eq('id', o.id).eq('status', 'pending').select('id'))
        if (upd?.length) {
          must(await db.from('tickets').delete().eq('order_id', o.id))
          released += o.quantity
        }
      }
      if (released) await addCounts(cid, -released, 0)
    }
    if (alreadyLocked && cid === campaignId) await run()
    else await withLock(cid, run)
  }
}

export async function createOrder(input: {
  campaignId: string
  customerId: string
  quantity: number
  bumps?: number[]
  affiliateCode?: string | null
  tracking?: unknown
  ip?: string | null
  bonusFrom?: string | null
}) {
  const baseQty = Math.floor(Number(input.quantity))
  if (!Number.isFinite(baseQty) || baseQty < 1) fail(400, 'Quantidade inválida')

  return withLock(input.campaignId, async () => {
    let c = await getCampaign(input.campaignId)
    if (!c) return fail(404, 'Campanha não encontrada')
    if (c.status !== 'active') fail(400, 'Esta campanha não está aceitando participações')
    if (baseQty < c.min_per_order || baseQty > c.max_per_order) fail(400, `A quantidade deve ser entre ${c.min_per_order} e ${c.max_per_order}`)

    // order bumps aceitos (índices da lista configurada na campanha)
    const bumpList = c.order_bumps ?? []
    const chosen = [...new Set(input.bumps ?? [])].map((i) => {
      const b = bumpList[i]
      if (!b) fail(400, 'Oferta inválida. Atualize a página.')
      return { qty: Math.floor(Number(b.qty)), price: Number(b.price), label: b.label ?? null }
    })
    const qty = baseQty + chosen.reduce((sum, b) => sum + b.qty, 0)

    const customer = must(await db.from('customers').select('id,affiliate_id').eq('id', input.customerId).maybeSingle())
    if (!customer) fail(400, 'Cliente inválido. Faça login novamente.')

    await expireOrders(c.id, true)
    c = (await getCampaign(c.id))!

    const available = Number(c.total_numbers) - Number(c.sold_count) - Number(c.reserved_count)
    if (available < qty) fail(409, `Restam apenas ${Math.max(available, 0)} títulos disponíveis`)

    if (c.max_per_customer) {
      const prev = must(
        await db.from('orders').select('quantity').eq('campaign_id', c.id).eq('customer_id', input.customerId).in('status', ['pending', 'paid']),
      ) as { quantity: number }[]
      const bought = prev.reduce((s, o) => s + o.quantity, 0)
      if (bought + qty > c.max_per_customer) fail(400, `Limite de ${c.max_per_customer} títulos por cliente nesta campanha`)
    }

    const promo = (c.promotions ?? []).find((p) => Number(p.qty) === baseQty)
    const baseTotal = promo ? Number(promo.price) : Number(c.price) * baseQty
    const total = Math.round((baseTotal + chosen.reduce((sum, b) => sum + b.price, 0)) * 100) / 100

    let affiliateId: string | null = null
    if (input.affiliateCode) {
      const a = must(await db.from('affiliates').select('id').eq('code', String(input.affiliateCode).toUpperCase()).eq('active', true).maybeSingle())
      affiliateId = a?.id ?? null
    }
    affiliateId ??= customer.affiliate_id

    const s = await getSettings()
    const order = must(
      await db
        .from('orders')
        .insert({
          campaign_id: c.id,
          customer_id: input.customerId,
          affiliate_id: affiliateId,
          quantity: qty,
          base_quantity: baseQty,
          bumps: chosen,
          unit_price: c.price,
          total,
          payment_method: s.payment_mode,
          tracking: cleanTracking(input.tracking),
          ...(await bonusFields(input.bonusFrom, input.customerId, total, s)),
          customer_ip: input.ip ?? null,
          expires_at: new Date(Date.now() + Number(s.order_expiration_minutes) * 60000).toISOString(),
        })
        .select('*')
        .single(),
    ) as OrderRow

    try {
      await allocateTickets(c, order.id, input.customerId, qty)
    } catch (e) {
      await db.from('orders').delete().eq('id', order.id)
      throw e
    }
    await addCounts(c.id, qty, 0)

    if (total === 0) await markPaidLocked(order.id, 'gratis')
    else notifyUtmify(order.id, 'waiting_payment')
    return order.id
  })
}

/**
 * Compra feita pelo botão da oferta da raspadinha: fica marcada como elegível ao bônus quando
 * o cliente é o mesmo, a oferta foi resgatada há no máximo 30 minutos e o valor passa do mínimo.
 */
async function bonusFields(bonusFrom: string | null | undefined, customerId: string, total: number, s: { bonus?: { enabled?: boolean; min_amount?: number } }) {
  if (!bonusFrom || !/^[0-9a-f-]{36}$/i.test(bonusFrom) || !s.bonus?.enabled) return {}
  const src = must(await db.from('orders').select('id,customer_id,status,bonus_claimed_at').eq('id', bonusFrom).maybeSingle())
  if (!src || src.customer_id !== customerId || src.status !== 'paid' || !src.bonus_claimed_at) return {}
  const inTime = Date.now() - new Date(src.bonus_claimed_at).getTime() <= 30 * 60_000
  return { bonus_source_order: src.id, bonus_eligible: inTime && total > Number(s.bonus.min_amount ?? 0) }
}

async function markPaidLocked(orderId: string, paymentId?: string | null) {
  const o = await getOrder(orderId)
  if (!o || o.status === 'paid') return
  const paidFields = { status: 'paid', paid_at: new Date().toISOString(), payment_id: paymentId ?? o.payment_id }

  if (o.status === 'pending') {
    const upd = must(await db.from('orders').update(paidFields).eq('id', o.id).eq('status', 'pending').select('id'))
    if (!upd?.length) return
    await addCounts(o.campaign_id, -o.quantity, o.quantity)
  } else {
    // pedido expirado/cancelado pago depois: sorteia novos números
    const c = (await getCampaign(o.campaign_id))!
    const available = Number(c.total_numbers) - Number(c.sold_count) - Number(c.reserved_count)
    if (available < o.quantity) fail(409, 'Não há títulos suficientes para realocar este pedido')
    await allocateTickets(c, o.id, o.customer_id, o.quantity)
    must(await db.from('orders').update(paidFields).eq('id', o.id))
    await addCounts(o.campaign_id, 0, o.quantity)
  }
  await awardPrizes(o.campaign_id, o.id)
  notifyUtmify(o.id, 'paid')
}

export async function markPaid(orderId: string, paymentId?: string | null) {
  const o = await getOrder(orderId)
  if (!o) fail(404, 'Pedido não encontrado')
  return withLock(o!.campaign_id, () => markPaidLocked(orderId, paymentId))
}

export async function cancelOrder(orderId: string, reason: 'refunded' | 'chargedback' = 'refunded') {
  const o0 = await getOrder(orderId)
  if (!o0) return fail(404, 'Pedido não encontrado')
  return withLock(o0.campaign_id, async () => {
    const o = (await getOrder(orderId))!
    if (o.status === 'cancelled' || o.status === 'expired') return
    const upd = must(await db.from('orders').update({ status: 'cancelled' }).eq('id', o.id).eq('status', o.status).select('id'))
    if (!upd?.length) return
    must(await db.from('tickets').delete().eq('order_id', o.id))
    must(await db.from('prize_titles').update({ winner_name: null, customer_id: null, order_id: null, won_at: null }).eq('order_id', o.id))
    if (o.status === 'pending') await addCounts(o.campaign_id, -o.quantity, 0)
    else {
      await addCounts(o.campaign_id, 0, -o.quantity)
      notifyUtmify(o.id, reason)
    }
  })
}

export async function orderNumbers(orderId: string) {
  const rows = await fetchAll<{ number: number }>((f, t) => db.from('tickets').select('number').eq('order_id', orderId).order('number').range(f, t))
  return rows.map((r) => Number(r.number))
}

/** Dados do pedido que o cliente pode ver. */
export async function publicOrder(o: OrderRow) {
  const [customer, campaign, prizes] = await Promise.all([
    db.from('customers').select('name,phone,cpf').eq('id', o.customer_id).single(),
    db.from('campaigns').select('id,title,subtitle,badge_text,status,slug,images,number_digits,draw_date').eq('id', o.campaign_id).single(),
    db.from('prize_titles').select('number,prize').eq('order_id', o.id),
  ])
  const c = must(campaign)
  const cu = must(customer)
  const aff = o.affiliate_id ? must(await db.from('affiliates').select('code').eq('id', o.affiliate_id).maybeSingle()) : null
  return {
    id: o.id,
    code: o.code,
    status: o.status,
    quantity: o.quantity,
    unit_price: o.unit_price,
    total: o.total,
    created_at: o.created_at,
    expires_at: o.expires_at,
    paid_at: o.paid_at,
    payment_method: o.payment_method,
    affiliate_code: aff?.code ?? null,
    customer: { name: cu.name, cpf: maskCpf(cu.cpf), phone: maskPhoneFull(cu.phone) },
    campaign: {
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      badge_text: c.badge_text,
      status: c.status,
      slug: c.slug,
      image: c.images?.[0] ?? null,
      number_digits: c.number_digits,
      draw_date: c.draw_date,
    },
    numbers: o.status === 'paid' ? await orderNumbers(o.id) : [],
    prizes: must(prizes) ?? [],
  }
}

/** Sorteia um título pago aleatório (cada título tem a mesma chance). */
export async function randomPaidTicket(campaignId: string) {
  const orders = await fetchAll<{ id: string; quantity: number }>((f, t) =>
    db.from('orders').select('id,quantity').eq('campaign_id', campaignId).eq('status', 'paid').range(f, t),
  )
  const total = orders.reduce((s, o) => s + o.quantity, 0)
  if (!total) return null
  let r = Math.floor(Math.random() * total)
  const o = orders.find((x) => (r -= x.quantity) < 0)!
  const offset = Math.floor(Math.random() * o.quantity)
  const t = must(await db.from('tickets').select('number').eq('order_id', o.id).order('number').range(offset, offset).maybeSingle())
  return t ? Number(t.number) : null
}
