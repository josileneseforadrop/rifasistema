import { Router } from 'express'
import { db, must } from '../db'
import { fail, h, rateLimit } from '../http'
import { ageFrom, isValidCpf, maskPhone, maskPhoneFull, onlyDigits, optStr, randomCode, str } from '../util'
import { createOrder, expireOrders, getOrder, getSettings, publicOrder } from '../services/orders'
import { enabledScripts, normalizeCode } from '../services/scripts'
import { ensurePix, maybeCheckPayment, syncBynetTransaction } from '../services/payments'

export const publicRouter = Router()
const writeLimit = rateLimit(30, 60_000)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uuid = (v: unknown) => (typeof v === 'string' && UUID.test(v) ? v : fail(400, 'ID inválido'))

publicRouter.get(
  '/settings',
  h(async () => getSettings()),
)

// scripts personalizados (usado em desenvolvimento; em produção já vêm no HTML)
publicRouter.get(
  '/scripts',
  h(async () => (await enabledScripts()).map(({ id, code, position }) => ({ id, code: normalizeCode(code), position }))),
)

publicRouter.get(
  '/campaigns',
  h(async () => {
    const list = must(
      await db
        .from('campaigns')
        .select('*')
        .neq('status', 'draft')
        .order('featured', { ascending: false })
        .order('sort_order')
        .order('created_at', { ascending: false }),
    ) as { status: string }[]
    const rank = (s: string) => (s === 'active' ? 0 : s === 'paused' ? 1 : 2)
    return list.sort((a, b) => rank(a.status) - rank(b.status))
  }),
)

publicRouter.get(
  '/campaigns/:slug',
  h(async (req) => {
    let c = must(await db.from('campaigns').select('*').eq('slug', req.params.slug).neq('status', 'draft').maybeSingle())
    if (!c) fail(404, 'Campanha não encontrada')
    // sem tarefa a cada minuto (serverless): libera pedidos vencidos quando alguém abre a campanha
    if (c.status === 'active' && (lastExpire.get(c.id) ?? 0) < Date.now() - 60_000) {
      lastExpire.set(c.id, Date.now())
      await expireOrders(c.id).catch(() => undefined)
      c = must(await db.from('campaigns').select('*').eq('id', c.id).single())
    }
    const titles = must(
      await db.from('prize_titles').select('id,number,prize,winner_name,sort_order')
        .eq('campaign_id', c.id)
        // últimos adicionados primeiro
        .order('sort_order', { ascending: false })
        .order('created_at', { ascending: false })
        .order('number'),
    )
    return { campaign: c, prize_titles: titles }
  }),
)

publicRouter.get(
  '/winners',
  h(async (req) => {
    const limit = Math.min(500, Number(req.query.limit) || 50)
    let q = db.from('winners').select('*').eq('published', true)
    if (typeof req.query.campaign === 'string' && /^[0-9a-f-]{36}$/i.test(req.query.campaign)) q = q.eq('campaign_id', req.query.campaign)
    const rows = must(
      await q
        .order('sort_order')
        .order('draw_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(limit),
    ) as { phone: string | null }[]
    return rows.map(({ phone, ...w }) => ({ ...w, phone_masked: maskPhone(phone) }))
  }),
)

publicRouter.get(
  '/announcements',
  h(async () =>
    must(await db.from('announcements').select('*').eq('published', true).order('pinned', { ascending: false }).order('created_at', { ascending: false })),
  ),
)

// ---------- clientes (identificação por CPF) ----------
const lastExpire = new Map<string, number>()

const customerJson = (c: { id: string; name: string; phone: string }) => ({ id: c.id, name: c.name, phone: maskPhoneFull(c.phone) })

publicRouter.post(
  '/customers/identify',
  writeLimit,
  h(async (req) => {
    const cpf = onlyDigits(req.body.cpf)
    if (!isValidCpf(cpf)) fail(400, 'CPF inválido')
    const c = must(await db.from('customers').select('id,name,phone').eq('cpf', cpf).limit(1).maybeSingle())
    return c ? { found: true, customer: customerJson(c) } : { found: false }
  }),
)

publicRouter.post(
  '/customers/register',
  writeLimit,
  h(async (req) => {
    const cpf = onlyDigits(req.body.cpf)
    const phone = onlyDigits(req.body.phone)
    const name = str(req.body.name, 120)
    const birth = str(req.body.birth_date, 10)
    if (!isValidCpf(cpf)) fail(400, 'CPF inválido')
    if (name.split(/\s+/).length < 2) fail(400, 'Informe seu nome completo')
    if (phone.length < 10 || phone.length > 11) fail(400, 'Telefone inválido')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || isNaN(Date.parse(birth))) fail(400, 'Data de nascimento inválida')
    const age = ageFrom(birth)
    if (age < 18) fail(400, 'Proibido para menores de 18 anos')
    if (age > 120) fail(400, 'Data de nascimento inválida')

    const byCpf = must(await db.from('customers').select('id,name,phone').eq('cpf', cpf).limit(1).maybeSingle())
    if (byCpf) return customerJson(byCpf)

    let affiliate_id: string | null = null
    if (req.body.affiliate_code) {
      const a = must(await db.from('affiliates').select('id').eq('code', String(req.body.affiliate_code).toUpperCase()).eq('active', true).maybeSingle())
      affiliate_id = a?.id ?? null
    }

    const byPhone = must(await db.from('customers').select('id,cpf').eq('phone', phone).maybeSingle())
    if (byPhone) {
      if (byPhone.cpf) fail(409, 'Este telefone já está cadastrado com outro CPF')
      // cadastro antigo (sem CPF): completa os dados
      const c = must(await db.from('customers').update({ cpf, name, birth_date: birth }).eq('id', byPhone.id).select('id,name,phone').single())
      return customerJson(c)
    }
    const c = must(
      await db.from('customers').insert({ name, phone, cpf, birth_date: birth, affiliate_id }).select('id,name,phone').single(),
      'Telefone já cadastrado',
    )
    return customerJson(c)
  }),
)

// ---------- pedidos ----------
publicRouter.post(
  '/orders',
  writeLimit,
  h(async (req) => {
    const id = await createOrder({
      campaignId: uuid(req.body.campaign_id),
      customerId: uuid(req.body.customer_id),
      quantity: req.body.quantity,
      bumps: Array.isArray(req.body.bumps) ? req.body.bumps.map(Number) : [],
      affiliateCode: req.body.affiliate_code,
      tracking: req.body.tracking,
      ip: req.ip ?? null,
      bonusFrom: typeof req.body.bonus_from === 'string' ? req.body.bonus_from : null,
    })
    return { id }
  }),
)

publicRouter.get(
  '/orders/:id',
  h(async (req) => {
    let o = await getOrder(uuid(req.params.id))
    if (!o) return fail(404, 'Pedido não encontrado')
    if (o.status === 'pending' && new Date(o.expires_at).getTime() < Date.now()) {
      await expireOrders(o.campaign_id)
      o = (await getOrder(o.id))!
    } else if (await maybeCheckPayment(o)) {
      o = (await getOrder(o.id))!
    }
    return publicOrder(o)
  }),
)

publicRouter.post(
  '/orders/:id/pix',
  writeLimit,
  h(async (req) => ensurePix(uuid(req.params.id))),
)

// cliente tocou em "GARANTIR AGORA" na oferta da raspadinha: registra o resgate no pedido pago
publicRouter.post(
  '/orders/:id/bonus-claim',
  writeLimit,
  h(async (req) => {
    const s = await getSettings()
    if (!s.bonus?.enabled) fail(400, 'Bônus indisponível')
    const o = await getOrder(uuid(req.params.id))
    if (!o || o.status !== 'paid') return fail(400, 'Pedido não está pago')
    if (!o.bonus_claimed_at) must(await db.from('orders').update({ bonus_claimed_at: new Date().toISOString() }).eq('id', o.id).is('bonus_claimed_at', null))
    return { ok: true }
  }),
)

publicRouter.post(
  '/my-orders',
  writeLimit,
  h(async (req) => {
    let q = db.from('customers').select('id')
    if (req.body.customer_id) q = q.eq('id', uuid(req.body.customer_id))
    else {
      const d = onlyDigits(req.body.cpf ?? req.body.phone)
      q = d.length === 11 && isValidCpf(d) ? q.or(`cpf.eq.${d},phone.eq.${d}`) : q.eq('phone', d)
    }
    const found = must(await q.limit(5)) as { id: string }[]
    if (!found.length) return []
    const c = { id: found.map((x) => x.id) }
    const orders = must(
      await db.from('orders').select('*').in('customer_id', c.id).in('status', ['pending', 'paid']).order('created_at', { ascending: false }).limit(100),
    ) as Parameters<typeof publicOrder>[0][]
    return Promise.all(orders.map(publicOrder))
  }),
)

// ---------- afiliados ----------
async function affiliateStats(phone: string) {
  const a = must(await db.from('affiliates').select('*').eq('phone', phone).maybeSingle())
  if (!a) return null
  const paid = must(await db.from('orders').select('total').eq('affiliate_id', a.id).eq('status', 'paid')) as { total: number }[]
  const sales = paid.reduce((s, o) => s + Number(o.total), 0)
  return {
    name: a.name,
    code: a.code,
    commission_percent: Number(a.commission_percent),
    active: a.active,
    orders: paid.length,
    sales,
    commission: Math.round(sales * Number(a.commission_percent)) / 100,
    paid_out: Number(a.paid_out),
  }
}

publicRouter.post(
  '/affiliates/stats',
  writeLimit,
  h(async (req) => affiliateStats(onlyDigits(req.body.phone))),
)

publicRouter.post(
  '/affiliates/register',
  writeLimit,
  h(async (req) => {
    const s = await getSettings()
    if (!s.affiliates_enabled) fail(400, 'Programa de afiliados desativado')
    const phone = onlyDigits(req.body.phone)
    const name = str(req.body.name, 120)
    if (phone.length < 10 || phone.length > 11) fail(400, 'Telefone inválido')
    if (name.length < 3) fail(400, 'Informe seu nome completo')
    const existing = must(await db.from('affiliates').select('id').eq('phone', phone).maybeSingle())
    if (!existing) {
      let code = randomCode()
      while (must(await db.from('affiliates').select('id').eq('code', code).maybeSingle())) code = randomCode()
      must(
        await db.from('affiliates').insert({
          name,
          phone,
          email: optStr(req.body.email, 200),
          pix_key: optStr(req.body.pix_key, 200),
          code,
          commission_percent: s.default_commission,
        }),
        'Telefone já cadastrado',
      )
    }
    return affiliateStats(phone)
  }),
)

// ---------- cron (Vercel Cron / agendador externo): libera pedidos vencidos ----------
publicRouter.get(
  '/cron/expire',
  h(async (req) => {
    const secret = process.env.CRON_SECRET
    const auth = req.headers.authorization ?? ''
    const fromVercel = /vercel-cron/i.test(String(req.headers['user-agent'] ?? ''))
    if (secret ? auth !== `Bearer ${secret}` : !fromVercel) fail(401, 'Não autorizado')
    await expireOrders()
    return { ok: true, at: new Date().toISOString() }
  }),
)

// ---------- webhook Bynet ----------
// O corpo só informa o ID: o status é sempre conferido na API da Bynet antes de liberar os títulos.
publicRouter.post(
  '/webhooks/bynet',
  h(async (req) => {
    const id = req.body?.objectId ?? req.body?.data?.id
    if (typeof id === 'string' && id.length <= 100) await syncBynetTransaction(id)
    return { ok: true }
  }),
)
