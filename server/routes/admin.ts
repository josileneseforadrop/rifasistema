import { Router, type NextFunction, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import { db, fetchAll, must } from '../db'
import { env } from '../env'
import { fail, h, HttpError, rateLimit } from '../http'
import { firstName, onlyDigits, optStr, str } from '../util'
import { clearIntegrationsCache, getIntegrations, maskSecret, publicUrl } from '../services/integrations'
import { testBynet } from '../services/bynet'
import { clearScriptsCache } from '../services/scripts'
import { testUtmify } from '../services/utmify'
import { awardPrizes, cancelOrder, expireOrders, markPaid, orderNumbers, randomPaidTicket } from '../services/orders'

export const adminRouter = Router()

// ---------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------
interface AdminReq extends Request {
  admin?: { id: string; email: string; name: string }
}

adminRouter.post(
  '/login',
  rateLimit(10, 60_000),
  h(async (req) => {
    const email = str(req.body.email).toLowerCase()
    const a = must(await db.from('admins').select('*').eq('email', email).maybeSingle())
    if (!a || !(await bcrypt.compare(String(req.body.password ?? ''), a.password_hash))) fail(401, 'E-mail ou senha inválidos')
    const token = jwt.sign({ sub: a.id }, env.JWT_SECRET, { expiresIn: '7d' })
    return { token, admin: { id: a.id, name: a.name, email: a.email } }
  }),
)

adminRouter.use(async (req: AdminReq, res: Response, next: NextFunction) => {
  try {
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '')
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string }
    const a = must(await db.from('admins').select('id,email,name').eq('id', payload.sub).maybeSingle())
    if (!a) throw new Error()
    req.admin = a
    next()
  } catch {
    next(new HttpError(401, 'Sessão expirada. Faça login novamente.'))
  }
})

adminRouter.get('/me', h(async (req: AdminReq) => req.admin))

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
const pick = (body: Record<string, unknown>, fields: readonly string[]) =>
  Object.fromEntries(fields.filter((f) => f in body).map((f) => [f, body[f] === '' ? null : body[f]]))

const page = (req: Request) => {
  const p = Math.max(1, Number(req.query.page) || 1)
  const size = Math.min(10000, Number(req.query.size) || 30)
  return { from: (p - 1) * size, to: p * size - 1 }
}

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------
adminRouter.get(
  '/dashboard',
  h(async () => {
    await expireOrders()
    const paid = await fetchAll<{ total: number; quantity: number; paid_at: string; campaign_id: string }>((f, t) =>
      db.from('orders').select('total,quantity,paid_at,campaign_id').eq('status', 'paid').range(f, t),
    )
    const [{ count: pending }, { count: customers }, campaigns] = await Promise.all([
      db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from('customers').select('id', { count: 'exact', head: true }),
      db.from('campaigns').select('id,title,status,total_numbers,sold_count,reserved_count,created_at').order('created_at', { ascending: false }),
    ])

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const d7 = Date.now() - 7 * 86400000
    const d14 = new Date(today.getTime() - 13 * 86400000)
    const daily = new Map<string, { label: string; total: number; orders: number }>()
    for (let d = new Date(d14); d <= today; d.setDate(d.getDate() + 1)) {
      const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
      daily.set(d.toDateString(), { label, total: 0, orders: 0 })
    }
    const revenueByCampaign = new Map<string, number>()
    let total = 0, todayTotal = 0, week = 0, tickets = 0
    for (const o of paid) {
      const v = Number(o.total)
      const t = new Date(o.paid_at)
      total += v
      tickets += o.quantity
      if (t >= today) todayTotal += v
      if (t.getTime() >= d7) week += v
      const day = daily.get(new Date(t.getFullYear(), t.getMonth(), t.getDate()).toDateString())
      if (day) {
        day.total += v
        day.orders++
      }
      revenueByCampaign.set(o.campaign_id, (revenueByCampaign.get(o.campaign_id) ?? 0) + v)
    }
    return {
      revenue_total: total,
      revenue_today: todayTotal,
      revenue_7d: week,
      orders_paid: paid.length,
      orders_pending: pending ?? 0,
      customers: customers ?? 0,
      tickets_sold: tickets,
      daily: [...daily.values()],
      campaigns: (must(campaigns) ?? []).map((c: { id: string }) => ({ ...c, revenue: revenueByCampaign.get(c.id) ?? 0 })),
    }
  }),
)

// ---------------------------------------------------------------------
// Campanhas
// ---------------------------------------------------------------------
const CAMPAIGN_FIELDS = [
  'slug', 'title', 'subtitle', 'badge_text', 'description', 'images', 'status', 'featured', 'sort_order', 'price',
  'total_numbers', 'number_start', 'number_digits', 'min_per_order', 'max_per_order', 'max_per_customer',
  'default_quantity', 'quick_buttons', 'promotions', 'highlight', 'show_progress', 'progress_override', 'draw_date',
  'show_draw_date', 'draw_result', 'whatsapp_group_url', 'order_bumps', 'order_bumps_title', 'order_bumps_subtitle',
] as const

function validateCampaign(data: Record<string, unknown>) {
  if ('title' in data && !str(data.title)) fail(400, 'Informe o título')
  if ('slug' in data) {
    data.slug = slugify(str(data.slug))
    if (!data.slug) fail(400, 'Informe o endereço (slug)')
  }
  if ('status' in data && !['draft', 'active', 'paused', 'finished'].includes(String(data.status))) fail(400, 'Status inválido')
  for (const k of ['price', 'total_numbers', 'number_start', 'number_digits', 'min_per_order', 'max_per_order', 'default_quantity', 'sort_order'])
    if (k in data) {
      data[k] = Number(data[k])
      if (!Number.isFinite(data[k] as number) || (data[k] as number) < 0) fail(400, `Valor inválido em ${k}`)
    }
  if ((data.total_numbers as number) < 1) fail(400, 'A campanha precisa ter ao menos 1 número')
  if ((data.min_per_order as number) > (data.max_per_order as number)) fail(400, 'Mínimo por compra maior que o máximo')
  if (Array.isArray(data.promotions))
    data.promotions = data.promotions
      .map((p: { qty: unknown; price: unknown }) => ({ qty: Math.floor(Number(p.qty)), price: Number(p.price) }))
      .filter((p) => p.qty > 0 && p.price >= 0)
  if (Array.isArray(data.order_bumps))
    data.order_bumps = data.order_bumps
      .map((b: { qty: unknown; price: unknown; label?: unknown }) => ({ qty: Math.floor(Number(b.qty)), price: Number(b.price), label: str(b.label, 120) }))
      .filter((b) => b.qty > 0 && b.price >= 0)
  if (Array.isArray(data.quick_buttons))
    data.quick_buttons = data.quick_buttons
      .map((b: { qty: unknown; popular?: unknown }) => ({ qty: Math.floor(Number(b.qty)), popular: !!b.popular }))
      .filter((b) => b.qty > 0)
  return data
}

adminRouter.get(
  '/campaigns',
  h(async () =>
    must(await db.from('campaigns').select('*').order('featured', { ascending: false }).order('sort_order').order('created_at', { ascending: false })),
  ),
)

adminRouter.get(
  '/campaign-options',
  h(async () => must(await db.from('campaigns').select('id,title').order('created_at', { ascending: false }))),
)

adminRouter.get(
  '/campaigns/:id',
  h(async (req) => {
    const c = must(await db.from('campaigns').select('*').eq('id', req.params.id).maybeSingle())
    return c ?? fail(404, 'Campanha não encontrada')
  }),
)

adminRouter.post(
  '/campaigns',
  h(async (req) => {
    const data = validateCampaign(pick(req.body, CAMPAIGN_FIELDS))
    return must(await db.from('campaigns').insert(data).select('*').single(), 'Já existe uma campanha com este endereço (slug)')
  }),
)

adminRouter.put(
  '/campaigns/:id',
  h(async (req) => {
    const data = validateCampaign(pick(req.body, CAMPAIGN_FIELDS))
    const cur = must(await db.from('campaigns').select('sold_count,reserved_count').eq('id', req.params.id).maybeSingle())
    if (!cur) fail(404, 'Campanha não encontrada')
    const used = Number(cur.sold_count) + Number(cur.reserved_count)
    if ('total_numbers' in data && (data.total_numbers as number) < used)
      fail(400, `A quantidade de números não pode ser menor que os já vendidos/reservados (${used})`)
    return must(
      await db.from('campaigns').update({ ...data, updated_at: new Date().toISOString() }).eq('id', req.params.id).select('*').single(),
      'Já existe uma campanha com este endereço (slug)',
    )
  }),
)

adminRouter.post(
  '/campaigns/:id/duplicate',
  h(async (req) => {
    const c = must(await db.from('campaigns').select('*').eq('id', req.params.id).single())
    const copy = pick(c, CAMPAIGN_FIELDS)
    return must(
      await db
        .from('campaigns')
        .insert({ ...copy, title: `${c.title} (cópia)`, slug: `${c.slug}-copia-${Date.now().toString(36)}`, status: 'draft', draw_result: null })
        .select('id')
        .single(),
    )
  }),
)

adminRouter.delete(
  '/campaigns/:id',
  h(async (req) => {
    must(await db.from('campaigns').delete().eq('id', req.params.id))
  }),
)

// títulos premiados
adminRouter.get(
  '/campaigns/:id/prize-titles',
  h(async (req) =>
    must(
      await db
        .from('prize_titles')
        .select('*, customers(name,phone), orders(code)')
        .eq('campaign_id', req.params.id)
        .order('sort_order', { ascending: false })
        .order('created_at', { ascending: false })
        .order('number'),
    ),
  ),
)

adminRouter.post(
  '/campaigns/:id/prize-titles',
  h(async (req) => {
    const c = must(await db.from('campaigns').select('number_start,total_numbers').eq('id', req.params.id).single())
    const min = Number(c.number_start)
    const max = min + Number(c.total_numbers) - 1
    const rows = (Array.isArray(req.body.items) ? req.body.items : []).map((r: { number: unknown; prize: unknown; sort_order?: unknown }) => {
      const number = Number(r.number)
      if (!Number.isInteger(number) || number < min || number > max) fail(400, `Número ${r.number} fora do intervalo ${min}–${max}`)
      if (!str(r.prize)) fail(400, 'Informe o prêmio')
      return { campaign_id: req.params.id, number, prize: str(r.prize, 200), sort_order: Number(r.sort_order) || 0 }
    })
    if (!rows.length) fail(400, 'Nenhum título informado')
    must(await db.from('prize_titles').insert(rows), 'Um dos números já é um título premiado')
    await awardPrizes(String(req.params.id)) // número já vendido? premia na hora
  }),
)

adminRouter.put(
  '/prize-titles/:id',
  h(async (req) => {
    const data = pick(req.body, ['prize', 'sort_order'])
    if ('prize' in data && !str(data.prize)) fail(400, 'Informe o prêmio')
    if ('sort_order' in data) data.sort_order = Number(data.sort_order) || 0
    must(await db.from('prize_titles').update(data).eq('id', req.params.id))
  }),
)

/**
 * Atribui o ganhador de um título premiado. O ganhador é sempre o dono real do número:
 * o número precisa ter sido vendido em um pedido PAGO. O admin pode apenas ajustar o nome exibido.
 */
adminRouter.post(
  '/prize-titles/:id/winner',
  h(async (req) => {
    const t = must(await db.from('prize_titles').select('*').eq('id', req.params.id).maybeSingle())
    if (!t) return fail(404, 'Título não encontrado')
    const ticket = must(
      await db
        .from('tickets')
        .select('order_id, customer_id, orders!inner(status,code), customers(name)')
        .eq('campaign_id', t.campaign_id)
        .eq('number', t.number)
        .eq('orders.status', 'paid')
        .maybeSingle(),
    )
    if (!ticket) fail(400, 'Este número ainda não foi vendido em um pedido pago. O ganhador só pode ser quem comprou o número.')
    const display = str(req.body.display_name, 60) || firstName(ticket.customers?.name ?? '')
    must(
      await db
        .from('prize_titles')
        .update({ winner_name: display, customer_id: ticket.customer_id, order_id: ticket.order_id, won_at: t.won_at ?? new Date().toISOString() })
        .eq('id', t.id),
    )
    return { winner_name: display, customer: ticket.customers?.name, order_code: ticket.orders?.code }
  }),
)

adminRouter.post(
  '/prize-titles/:id/clear-winner',
  h(async (req) => {
    must(await db.from('prize_titles').update({ winner_name: null, customer_id: null, order_id: null, won_at: null }).eq('id', req.params.id))
  }),
)

/**
 * Gera títulos premiados em lote: ex. [{ qty: 30, prize: 'R$ 500,00 💰' }, { qty: 2, prize: 'iPhone 17' }].
 * Os números são sorteados no servidor, sem repetir os já premiados e (por padrão) sem pegar números já vendidos/reservados.
 */
adminRouter.post(
  '/campaigns/:id/prize-titles/generate',
  h(async (req) => {
    const campaignId = String(req.params.id)
    const c = must(await db.from('campaigns').select('number_start,total_numbers').eq('id', campaignId).maybeSingle())
    if (!c) return fail(404, 'Campanha não encontrada')
    const groups = (Array.isArray(req.body.groups) ? req.body.groups : []).map((g: { qty: unknown; prize: unknown }) => {
      const qty = Math.floor(Number(g.qty))
      const prize = str(g.prize, 200)
      if (!Number.isFinite(qty) || qty < 1) fail(400, 'Quantidade inválida')
      if (!prize) fail(400, 'Informe o prêmio de cada grupo')
      return { qty, prize }
    }) as { qty: number; prize: string }[]
    const needed = groups.reduce((s, g) => s + g.qty, 0)
    if (!needed) fail(400, 'Adicione ao menos um grupo de prêmios')
    if (needed > 5000) fail(400, 'Máximo de 5.000 títulos por geração')
    const onlyAvailable = req.body.only_available !== false

    const start = Number(c.number_start)
    const total = Number(c.total_numbers)
    const existing = await fetchAll<{ number: number; sort_order: number }>((f, t) =>
      db.from('prize_titles').select('number,sort_order').eq('campaign_id', campaignId).range(f, t),
    )
    const blocked = new Set(existing.map((e) => Number(e.number)))
    if (total - blocked.size < needed) fail(400, `A campanha só tem ${total - blocked.size} números que ainda não são premiados`)

    const chosen: number[] = []
    for (let attempt = 0; chosen.length < needed; attempt++) {
      if (attempt > 60) fail(400, 'Não há números livres suficientes. Diminua a quantidade ou desmarque "apenas números não vendidos".')
      const want = needed - chosen.length
      const batch = new Set<number>()
      for (let tries = 0; batch.size < want * 2 + 20 && tries < (want * 2 + 20) * 20; tries++) {
        const n = start + Math.floor(Math.random() * total)
        if (!blocked.has(n)) batch.add(n)
      }
      let candidates = [...batch]
      if (onlyAvailable) {
        const sold = new Set<number>()
        for (let i = 0; i < candidates.length; i += 300) {
          const rows = must(
            await db.from('tickets').select('number').eq('campaign_id', campaignId).in('number', candidates.slice(i, i + 300)),
          ) as { number: number }[]
          rows.forEach((r) => sold.add(Number(r.number)))
        }
        sold.forEach((n) => blocked.add(n))
        candidates = candidates.filter((n) => !sold.has(n))
      }
      for (const n of candidates) {
        if (chosen.length >= needed) break
        chosen.push(n)
        blocked.add(n)
      }
    }

    let order = existing.reduce((m, e) => Math.max(m, Number(e.sort_order)), -1) + 1
    let k = 0
    const rows = groups.flatMap((g) =>
      Array.from({ length: g.qty }, () => ({ campaign_id: campaignId, number: chosen[k++], prize: g.prize, sort_order: order++ })),
    )
    for (let i = 0; i < rows.length; i += 1000) {
      must(await db.from('prize_titles').insert(rows.slice(i, i + 1000)), 'Conflito ao gerar os números. Tente novamente.')
    }
    if (!onlyAvailable) await awardPrizes(campaignId) // números já pagos viram ganhadores na hora
    return { created: rows.length }
  }),
)

// Confere todos os títulos da campanha e marca os que já foram comprados e pagos
adminRouter.post(
  '/campaigns/:id/prize-titles/sync',
  h(async (req) => {
    await awardPrizes(String(req.params.id))
  }),
)

adminRouter.delete(
  '/prize-titles/:id',
  h(async (req) => {
    must(await db.from('prize_titles').delete().eq('id', req.params.id))
  }),
)

// ---------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------
adminRouter.get(
  '/orders',
  h(async (req) => {
    const { from, to } = page(req)
    let q = db
      .from('orders')
      .select('*, customers!inner(name,phone,email,cpf), campaigns(title,number_digits), affiliates(name,code)', { count: 'exact' })
      .order('created_at', { ascending: false })
    if (req.query.status) q = q.eq('status', String(req.query.status))
    if (req.query.campaign) q = q.eq('campaign_id', String(req.query.campaign))
    if (req.query.bonus === 'eligible') q = q.eq('bonus_eligible', true)
    const term = str(req.query.q, 100)
    if (term) {
      const digits = onlyDigits(term)
      if (term.startsWith('#') || (digits === term && digits.length < 8)) q = q.eq('code', Number(digits) || 0)
      else if (digits.length >= 8 && digits === term.replace(/[\s()-]/g, '')) q = q.ilike('customers.phone', `%${digits}%`)
      else q = q.ilike('customers.name', `%${term}%`)
    }
    const { data, error, count } = await q.range(from, to)
    if (error) fail(500, error.message)
    return { rows: data, count }
  }),
)

adminRouter.get('/orders/:id/tickets', h(async (req) => orderNumbers(String(req.params.id))))

adminRouter.post(
  '/orders/:id/status',
  h(async (req) => {
    if (req.body.status === 'paid') await markPaid(String(req.params.id), 'manual')
    else if (req.body.status === 'cancelled') await cancelOrder(String(req.params.id))
    else fail(400, 'Status inválido')
  }),
)

// ---------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------
adminRouter.get(
  '/customers',
  h(async (req) => {
    const { from, to } = page(req)
    let q = db.from('customers').select('*, orders(count)', { count: 'exact' }).order('created_at', { ascending: false })
    const term = str(req.query.q, 100).replace(/[,()]/g, '')
    if (term) {
      const d = onlyDigits(term)
      q = d.length >= 4 && d.length === term.replace(/[\s.-]/g, '').length ? q.or(`phone.ilike.%${d}%,cpf.ilike.%${d}%`) : q.or(`name.ilike.%${term}%,email.ilike.%${term}%`)
    }
    const { data, error, count } = await q.range(from, to)
    if (error) fail(500, error.message)
    return { rows: data, count }
  }),
)

adminRouter.get(
  '/customers/:id/orders',
  h(async (req) =>
    must(await db.from('orders').select('id,code,status,quantity,total,created_at,campaigns(title)').eq('customer_id', req.params.id).order('created_at', { ascending: false })),
  ),
)

adminRouter.put(
  '/customers/:id',
  h(async (req) => {
    const phone = onlyDigits(req.body.phone)
    if (phone.length < 10 || phone.length > 11) fail(400, 'Telefone inválido')
    must(
      await db
        .from('customers')
        .update({ name: str(req.body.name, 120), phone, email: optStr(req.body.email, 200), cpf: onlyDigits(req.body.cpf) || null })
        .eq('id', req.params.id),
      'Telefone já cadastrado em outro cliente',
    )
  }),
)

// ---------------------------------------------------------------------
// Sorteio
// ---------------------------------------------------------------------
adminRouter.get(
  '/draw/lookup',
  h(async (req) => {
    const t = must(
      await db
        .from('tickets')
        .select('number, orders(id,code,status,paid_at), customers(name,phone,email,cpf), campaigns(title,number_digits)')
        .eq('campaign_id', String(req.query.campaign))
        .eq('number', Number(req.query.number))
        .maybeSingle(),
    )
    return t
  }),
)

adminRouter.post('/draw/random', h(async (req) => ({ number: await randomPaidTicket(String(req.body.campaign)) })))

// ---------------------------------------------------------------------
// CRUD simples: ganhadores, comunicados, afiliados
// ---------------------------------------------------------------------
function crud(path: string, table: string, fields: readonly string[], order: [string, boolean][], prepare = (d: Record<string, unknown>) => d) {
  adminRouter.get(
    `/${path}`,
    h(async () => {
      let q = db.from(table).select('*')
      for (const [col, asc] of order) q = q.order(col, { ascending: asc, nullsFirst: false })
      return must(await q)
    }),
  )
  adminRouter.post(`/${path}`, h(async (req) => must(await db.from(table).insert(prepare(pick(req.body, fields))).select('*').single(), 'Registro duplicado')))
  adminRouter.put(
    `/${path}/:id`,
    h(async (req) => must(await db.from(table).update(prepare(pick(req.body, fields))).eq('id', req.params.id).select('*').single(), 'Registro duplicado')),
  )
  adminRouter.delete(
    `/${path}/:id`,
    h(async (req) => {
      must(await db.from(table).delete().eq('id', req.params.id))
    }),
  )
}

crud(
  'winners',
  'winners',
  ['campaign_id', 'name', 'campaign_title', 'prize', 'ticket_number', 'draw_date', 'phone', 'photo_url', 'published', 'sort_order'],
  [['sort_order', true], ['draw_date', false]],
  (d) => ({ ...d, ...('phone' in d ? { phone: onlyDigits(d.phone) || null } : {}) }),
)
crud('announcements', 'announcements', ['title', 'content', 'image_url', 'published', 'pinned'], [['pinned', false], ['created_at', false]])

const AFF_FIELDS = ['name', 'phone', 'email', 'pix_key', 'code', 'commission_percent', 'paid_out', 'active']
const prepAff = (d: Record<string, unknown>) => ({
  ...d,
  ...('phone' in d ? { phone: onlyDigits(d.phone) } : {}),
  ...('code' in d ? { code: String(d.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') } : {}),
})
adminRouter.get(
  '/affiliates',
  h(async () => {
    const [affs, paid] = await Promise.all([
      db.from('affiliates').select('*').order('created_at', { ascending: false }),
      fetchAll<{ affiliate_id: string; total: number }>((f, t) =>
        db.from('orders').select('affiliate_id,total').eq('status', 'paid').not('affiliate_id', 'is', null).range(f, t),
      ),
    ])
    const stats = new Map<string, { orders: number; sales: number }>()
    for (const o of paid) {
      const s = stats.get(o.affiliate_id) ?? { orders: 0, sales: 0 }
      s.orders++
      s.sales += Number(o.total)
      stats.set(o.affiliate_id, s)
    }
    return (must(affs) as { id: string; commission_percent: number }[])
      .map((a) => {
        const s = stats.get(a.id) ?? { orders: 0, sales: 0 }
        return { ...a, ...s, commission: Math.round(s.sales * Number(a.commission_percent)) / 100 }
      })
      .sort((a, b) => b.sales - a.sales)
  }),
)
adminRouter.post('/affiliates', h(async (req) => must(await db.from('affiliates').insert(prepAff(pick(req.body, AFF_FIELDS))).select('*').single(), 'Telefone ou código já utilizado')))
adminRouter.put(
  '/affiliates/:id',
  h(async (req) => must(await db.from('affiliates').update(prepAff(pick(req.body, AFF_FIELDS))).eq('id', req.params.id).select('*').single(), 'Telefone ou código já utilizado')),
)

// ---------------------------------------------------------------------
// Configurações
// ---------------------------------------------------------------------
const SETTINGS_FIELDS = [
  'site_name', 'logo_url', 'favicon_url', 'seo_description', 'primary_color', 'primary_text_color', 'header_bg', 'bg_color',
  'card_color', 'text_color', 'muted_color', 'campaigns_title', 'campaigns_subtitle', 'winners_title', 'winners_subtitle',
  'show_winners_home', 'terms_text', 'privacy_text', 'support_text', 'support_whatsapp', 'support_email', 'footer_text',
  'footer_logos', 'whatsapp_group_url', 'whatsapp_group_label', 'instagram_url', 'facebook_url', 'telegram_url', 'youtube_url',
  'tiktok_url', 'show_install_banner', 'install_title', 'install_subtitle', 'payment_mode', 'pix_key', 'pix_receiver_name',
  'pix_city', 'payment_instructions', 'order_expiration_minutes', 'checkout_terms_text', 'affiliates_enabled',
  'affiliates_text', 'default_commission', 'meta_pixel_id', 'google_analytics_id', 'bonus',
]

adminRouter.put(
  '/settings',
  h(async (req) => {
    const data = pick(req.body, SETTINGS_FIELDS)
    if ('payment_mode' in data && !['manual', 'bynet'].includes(String(data.payment_mode))) fail(400, 'Modo de pagamento inválido')
    if ('order_expiration_minutes' in data) {
      const m = Number(data.order_expiration_minutes)
      if (!(m >= 1 && m <= 10080)) fail(400, 'Tempo para pagamento deve ser entre 1 e 10080 minutos')
      data.order_expiration_minutes = m
    }
    if (data.site_name == null && 'site_name' in data) fail(400, 'Informe o nome do site')
    for (const k of Object.keys(data)) if (k.includes('color') && data[k] == null) delete data[k]
    if ('footer_logos' in data && !Array.isArray(data.footer_logos)) data.footer_logos = []
    if ('bonus' in data) {
      const b = (data.bonus && typeof data.bonus === 'object' ? data.bonus : {}) as Record<string, unknown>
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(b)) {
        if (typeof v === 'boolean') out[k] = v
        else if (typeof v === 'number') out[k] = v
        else if (Array.isArray(v)) out[k] = v.slice(0, 12).map((x) => String(x ?? '').slice(0, 30))
        else if (v == null || v === '') out[k] = null
        else out[k] = String(v).slice(0, 2000)
      }
      out.countdown_minutes = Math.min(1440, Math.max(1, Number(out.countdown_minutes) || 3))
      out.min_amount = Math.max(0, Number(out.min_amount) || 0)
      data.bonus = out
    }
    return must(await db.from('settings').update({ ...data, updated_at: new Date().toISOString() }).eq('id', 1).select('*').single())
  }),
)

// ---------------------------------------------------------------------
// Integrações (gateway de pagamento e Utmify) — credenciais nunca saem mascaradas daqui
// ---------------------------------------------------------------------
const SECRET_FIELDS = ['bynet_api_key', 'utmify_api_token'] as const

async function integrationsView() {
  const i = await getIntegrations()
  const url = await publicUrl()
  return {
    ...i,
    bynet_api_key: maskSecret(i.bynet_api_key),
    utmify_api_token: maskSecret(i.utmify_api_token),
    has_bynet_api_key: !!i.bynet_api_key,
    has_utmify_api_token: !!i.utmify_api_token,
    bynet_webhook_url: url ? `${url}/api/webhooks/bynet` : null,
  }
}

adminRouter.get('/integrations', h(integrationsView))

adminRouter.put(
  '/integrations',
  h(async (req) => {
    const data = pick(req.body, [
      'public_url', 'bynet_base_url', 'bynet_user_agent', 'bynet_default_email', 'bynet_address',
      'utmify_enabled', 'utmify_platform', 'utmify_test_mode', ...SECRET_FIELDS,
    ])
    // segredo vazio ou mascarado = manter o atual; "__remover__" apaga
    for (const k of SECRET_FIELDS) {
      const v = data[k]
      if (v === '__remover__') data[k] = null
      else if (v == null || String(v).startsWith('••')) delete data[k]
      else data[k] = String(v).trim()
    }
    if ('public_url' in data && data.public_url) {
      const u = String(data.public_url).trim().replace(/\/$/, '')
      if (!/^https?:\/\/[^\s]+$/.test(u)) fail(400, 'URL do site inválida (ex.: https://www.seusite.com)')
      data.public_url = u
    }
    if ('bynet_base_url' in data) data.bynet_base_url = String(data.bynet_base_url || 'https://api-gateway.techbynet.com').trim().replace(/\/$/, '')
    if ('bynet_user_agent' in data) data.bynet_user_agent = String(data.bynet_user_agent || 'AtivoB2B/1.0').trim()
    if ('bynet_address' in data) {
      const a = (data.bynet_address ?? {}) as Record<string, unknown>
      const keys = ['street', 'streetNumber', 'complement', 'zipCode', 'neighborhood', 'city', 'state', 'country']
      data.bynet_address = Object.fromEntries(keys.map((k) => [k, k === 'zipCode' ? onlyDigits(a[k]) : str(a[k], 120)]))
    }
    must(await db.from('integrations').update({ ...data, updated_at: new Date().toISOString() }).eq('id', 1))
    clearIntegrationsCache()
    return integrationsView()
  }),
)

adminRouter.post('/integrations/test-bynet', h(async () => testBynet()))
adminRouter.post('/integrations/test-utmify', h(async (req) => testUtmify(req.body?.token && !String(req.body.token).startsWith('••') ? req.body.token : null)))

// ---------------------------------------------------------------------
// Scripts personalizados (<head> / <body>) — um script por bloco
// ---------------------------------------------------------------------
function scriptData(body: Record<string, unknown>, partial = false) {
  const data = pick(body, ['name', 'code', 'position', 'enabled', 'sort_order'])
  if (!partial || 'name' in data) {
    data.name = str(data.name, 120)
    if (!data.name) fail(400, 'Dê um nome ao script (ex.: Pixel TikTok)')
  }
  if (!partial || 'code' in data) {
    const code = String(data.code ?? '').trim()
    if (!code) fail(400, 'Cole o código do script')
    if (code.length > 100_000) fail(400, 'Script muito grande (máx. 100 mil caracteres)')
    data.code = code
  }
  if ('position' in data && !['head', 'body'].includes(String(data.position))) fail(400, 'Posição inválida')
  if ('sort_order' in data) data.sort_order = Number(data.sort_order) || 0
  if ('enabled' in data) data.enabled = !!data.enabled
  return data
}

adminRouter.get('/scripts', h(async () => must(await db.from('custom_scripts').select('*').order('sort_order').order('created_at'))))

adminRouter.post(
  '/scripts',
  h(async (req) => {
    const last = must<{ sort_order: number }[]>(await db.from('custom_scripts').select('sort_order').order('sort_order', { ascending: false }).limit(1))
    const row = must(await db.from('custom_scripts').insert({ sort_order: (last[0]?.sort_order ?? -1) + 1, ...scriptData(req.body) }).select('*').single())
    clearScriptsCache()
    return row
  }),
)

adminRouter.put(
  '/scripts/:id',
  h(async (req) => {
    const row = must(
      await db.from('custom_scripts').update({ ...scriptData(req.body, true), updated_at: new Date().toISOString() }).eq('id', req.params.id).select('*').single(),
    )
    clearScriptsCache()
    return row
  }),
)

adminRouter.delete(
  '/scripts/:id',
  h(async (req) => {
    must(await db.from('custom_scripts').delete().eq('id', req.params.id))
    clearScriptsCache()
  }),
)

// ---------------------------------------------------------------------
// Upload de imagens (Supabase Storage)
// ---------------------------------------------------------------------
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

adminRouter.post(
  '/upload',
  upload.single('file'),
  h(async (req) => {
    const file = req.file
    if (!file) return fail(400, 'Nenhum arquivo enviado')
    const isVideo = VIDEO_TYPES.includes(file.mimetype)
    if (!file.mimetype.startsWith('image/') && !isVideo) fail(400, 'Envie uma imagem ou um vídeo MP4/WebM/MOV')
    if (!isVideo && file.size > 8 * 1024 * 1024) fail(400, 'Imagem muito grande (máx. 8 MB)')
    const folder = String(req.body.folder ?? 'uploads').replace(/[^a-z0-9-]/gi, '') || 'uploads'
    const ext = (file.originalname.split('.').pop() ?? (isVideo ? 'mp4' : 'png')).replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'png'
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await db.storage.from(env.STORAGE_BUCKET).upload(path, file.buffer, { contentType: file.mimetype, cacheControl: '31536000' })
    if (error && /exceeded|too large|maximum/i.test(error.message)) fail(400, 'O Supabase recusou o arquivo por tamanho. No plano gratuito o limite é 50 MB por arquivo — comprima o vídeo ou aumente o limite em Storage → Settings.')
    if (error) fail(500, error.message)
    return { url: db.storage.from(env.STORAGE_BUCKET).getPublicUrl(path).data.publicUrl }
  }),
)

// ---------------------------------------------------------------------
// Administradores
// ---------------------------------------------------------------------
adminRouter.get('/admins', h(async () => must(await db.from('admins').select('id,name,email,created_at').order('created_at'))))

adminRouter.post(
  '/admins',
  h(async (req) => {
    const email = str(req.body.email, 200).toLowerCase()
    const password = String(req.body.password ?? '')
    if (!/^\S+@\S+\.\S+$/.test(email)) fail(400, 'E-mail inválido')
    if (password.length < 8) fail(400, 'A senha deve ter ao menos 8 caracteres')
    must(
      await db.from('admins').insert({ name: str(req.body.name, 120) || email, email, password_hash: await bcrypt.hash(password, 10) }),
      'Já existe um administrador com este e-mail',
    )
  }),
)

adminRouter.delete(
  '/admins/:id',
  h(async (req: AdminReq) => {
    if (req.params.id === req.admin!.id) fail(400, 'Você não pode remover a si mesmo')
    must(await db.from('admins').delete().eq('id', req.params.id))
  }),
)

adminRouter.post(
  '/password',
  h(async (req: AdminReq) => {
    const a = must(await db.from('admins').select('password_hash').eq('id', req.admin!.id).single())
    if (!(await bcrypt.compare(String(req.body.current ?? ''), a.password_hash))) fail(400, 'Senha atual incorreta')
    const next = String(req.body.password ?? '')
    if (next.length < 8) fail(400, 'A nova senha deve ter ao menos 8 caracteres')
    must(await db.from('admins').update({ password_hash: await bcrypt.hash(next, 10) }).eq('id', req.admin!.id))
  }),
)
