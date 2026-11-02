import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminApi, errorMessage } from '../lib/api'
import type { Campaign, Highlight, OrderBump, PrizeTitle, Promotion, QuickButton } from '../lib/types'
import { formatDateTime, formatPhone, fromLocalInput, money, padNumber, slugify, toLocalInput } from '../lib/format'
import { Field, ImagesInput, Toggle } from './ui'

type Form = Omit<Campaign, 'id' | 'created_at' | 'sold_count' | 'reserved_count'>

const empty: Form = {
  slug: '',
  title: '',
  subtitle: '',
  badge_text: '',
  description: '',
  images: [],
  status: 'draft',
  featured: false,
  sort_order: 0,
  price: 0.5,
  total_numbers: 1000000,
  number_start: 0,
  number_digits: 6,
  min_per_order: 1,
  max_per_order: 20000,
  max_per_customer: null,
  default_quantity: 10,
  quick_buttons: [{ qty: 5 }, { qty: 10, popular: true }, { qty: 50 }, { qty: 100 }],
  promotions: [],
  order_bumps: [],
  order_bumps_title: '🚨 AUMENTE AS CHANCES DE ACHAR UMA PREMIADA AGORA!',
  order_bumps_subtitle: 'Quanto mais números, maiores são as suas chances! Acredite 🙏',
  highlight: { enabled: false },
  show_progress: true,
  progress_override: null,
  draw_date: null,
  show_draw_date: true,
  draw_result: null,
  whatsapp_group_url: null,
}

const TABS = ['Geral', 'Imagens', 'Valores e números', 'Promoções e botões', 'Destaque', 'Regulamento', 'Títulos premiados'] as const

export default function CampaignForm() {
  const { id } = useParams()
  const isNew = !id || id === 'nova'
  const navigate = useNavigate()
  const [form, setForm] = useState<Form>(empty)
  const [stats, setStats] = useState({ sold: 0, reserved: 0 })
  const [tab, setTab] = useState<(typeof TABS)[number]>('Geral')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [slugTouched, setSlugTouched] = useState(!isNew)

  useEffect(() => {
    if (isNew) return
    adminApi<Campaign & { updated_at: string }>(`/admin/campaigns/${id}`)
      .then((data) => {
        const { id: _i, created_at: _c, sold_count, reserved_count, updated_at: _u, ...rest } = data
        setForm({ ...empty, ...rest })
        setStats({ sold: Number(sold_count), reserved: Number(reserved_count) })
      })
      .catch((e) => setMsg({ type: 'error', text: errorMessage(e) }))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const setH = (patch: Partial<Highlight>) => setForm((f) => ({ ...f, highlight: { ...f.highlight, ...patch } }))

  const save = async () => {
    setMsg(null)
    if (!form.title.trim()) return setMsg({ type: 'error', text: 'Informe o título' })
    if (!form.slug.trim()) return setMsg({ type: 'error', text: 'Informe o endereço (slug)' })
    if (form.total_numbers < stats.sold + stats.reserved)
      return setMsg({ type: 'error', text: `A quantidade de números não pode ser menor que os já vendidos/reservados (${stats.sold + stats.reserved}).` })
    if (form.min_per_order > form.max_per_order) return setMsg({ type: 'error', text: 'Mínimo por compra maior que o máximo' })
    const payload = {
      ...form,
      slug: slugify(form.slug),
      price: Number(form.price),
      total_numbers: Number(form.total_numbers),
      number_start: Number(form.number_start),
      number_digits: Number(form.number_digits),
      promotions: form.promotions.filter((p) => p.qty > 0).map((p) => ({ qty: Number(p.qty), price: Number(p.price) })),
      quick_buttons: form.quick_buttons.filter((b) => b.qty > 0).map((b) => ({ qty: Number(b.qty), popular: !!b.popular })),
      order_bumps: (form.order_bumps ?? []).filter((b) => b.qty > 0).map((b) => ({ qty: Number(b.qty), price: Number(b.price), label: b.label ?? '' })),
    }
    setSaving(true)
    try {
      const saved = isNew
        ? await adminApi<Campaign>('/admin/campaigns', { body: payload })
        : await adminApi<Campaign>(`/admin/campaigns/${id}`, { method: 'PUT', body: payload })
      setMsg({ type: 'success', text: 'Campanha salva!' })
      if (isNew) navigate(`/admin/campanhas/${saved.id}`, { replace: true })
    } catch (e) {
      setMsg({ type: 'error', text: errorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="spinner" />

  const maxNumber = Number(form.number_start) + Number(form.total_numbers) - 1
  const hasSales = stats.sold + stats.reserved > 0

  return (
    <>
      <div className="admin-top">
        <h1>{isNew ? 'Nova campanha' : form.title}</h1>
        <span className="spacer" />
        {!isNew && <a className="btn ghost" href={`/campanha/${form.slug}`} target="_blank" rel="noreferrer">Ver no site</a>}
        <button className="btn" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
      </div>
      {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}
      {!isNew && (
        <div className="stats">
          <div className="stat"><div className="l">Vendidos</div><div className="v">{stats.sold.toLocaleString('pt-BR')}</div></div>
          <div className="stat"><div className="l">Reservados</div><div className="v">{stats.reserved.toLocaleString('pt-BR')}</div></div>
          <div className="stat"><div className="l">Disponíveis</div><div className="v">{(form.total_numbers - stats.sold - stats.reserved).toLocaleString('pt-BR')}</div></div>
        </div>
      )}

      <div className="tabs">
        {TABS.filter((t) => !(isNew && t === 'Títulos premiados')).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Geral' && (
        <div className="card">
          <Field label="Título">
            <input
              value={form.title}
              onChange={(e) => {
                set('title', e.target.value)
                if (!slugTouched) set('slug', slugify(e.target.value))
              }}
            />
          </Field>
          <Field label="Endereço (slug)" hint={`${location.origin}/campanha/${form.slug || '...'}`}>
            <input value={form.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value) }} />
          </Field>
          <Field label="Subtítulo" hint="Ex.: RETA FINAL ATIVADA / AÇÃO 100% LEGALIZADA - TERMO ...">
            <input value={form.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)} />
          </Field>
          <div className="grid2">
            <Field label="Status">
              <select value={form.status} onChange={(e) => set('status', e.target.value as Form['status'])}>
                <option value="draft">Rascunho (oculta)</option>
                <option value="active">Ativa (vendendo)</option>
                <option value="paused">Pausada (visível, sem vendas)</option>
                <option value="finished">Concluída</option>
              </select>
            </Field>
            <Field label="Texto do selo (campanha ativa)" hint="Ex.: VAI ACABAR! · Adquira já!">
              <input value={form.badge_text ?? ''} onChange={(e) => set('badge_text', e.target.value)} />
            </Field>
            <Field label="Data do sorteio">
              <input type="datetime-local" value={toLocalInput(form.draw_date)} onChange={(e) => set('draw_date', fromLocalInput(e.target.value))} />
            </Field>
            <Field label="Ordem de exibição" hint="Menor aparece primeiro">
              <input type="number" value={form.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} />
            </Field>
            <Field label="Resultado do sorteio" hint="Ex.: número sorteado / Loteria Federal">
              <input value={form.draw_result ?? ''} onChange={(e) => set('draw_result', e.target.value || null)} />
            </Field>
            <Field label="Link do grupo de WhatsApp (opcional)" hint="Substitui o link geral do site nesta campanha">
              <input value={form.whatsapp_group_url ?? ''} onChange={(e) => set('whatsapp_group_url', e.target.value || null)} />
            </Field>
          </div>
          <Toggle label="Destacar na página inicial (card grande)" checked={form.featured} onChange={(v) => set('featured', v)} />
          <Toggle label="Mostrar data do sorteio" checked={form.show_draw_date} onChange={(v) => set('show_draw_date', v)} />
          <Toggle label="Mostrar barra de progresso" checked={form.show_progress} onChange={(v) => set('show_progress', v)} />
          <Field label="Forçar porcentagem exibida (opcional)" hint="Deixe vazio para calcular automaticamente pelos títulos vendidos">
            <input type="number" step="0.01" min={0} max={100} value={form.progress_override ?? ''} onChange={(e) => set('progress_override', e.target.value === '' ? null : Number(e.target.value))} />
          </Field>
        </div>
      )}

      {tab === 'Imagens' && (
        <div className="card">
          <p className="muted">A primeira imagem é a capa. Use as setas para reordenar. Tamanho recomendado: 1280×720.</p>
          <ImagesInput value={form.images} onChange={(v) => set('images', v)} folder="campaigns" />
        </div>
      )}

      {tab === 'Valores e números' && (
        <div className="card">
          {hasSales && <div className="alert info">Esta campanha já possui vendas. Alterar o intervalo de números não afeta os títulos já gerados.</div>}
          <div className="grid2">
            <Field label="Valor por título (R$)">
              <input type="number" step="0.01" min={0} value={form.price} onChange={(e) => set('price', e.target.value as unknown as number)} />
            </Field>
            <Field label="Quantidade total de números">
              <input type="number" min={1} value={form.total_numbers} onChange={(e) => set('total_numbers', Number(e.target.value))} />
            </Field>
            <Field label="Número inicial" hint={`Números de ${padNumber(form.number_start, form.number_digits)} até ${padNumber(maxNumber, form.number_digits)}`}>
              <input type="number" min={0} value={form.number_start} onChange={(e) => set('number_start', Number(e.target.value))} />
            </Field>
            <Field label="Quantidade de dígitos exibidos" hint={`Sugerido: ${String(maxNumber).length}`}>
              <input type="number" min={1} max={12} value={form.number_digits} onChange={(e) => set('number_digits', Number(e.target.value))} />
            </Field>
            <Field label="Mínimo por compra">
              <input type="number" min={1} value={form.min_per_order} onChange={(e) => set('min_per_order', Number(e.target.value))} />
            </Field>
            <Field label="Máximo por compra">
              <input type="number" min={1} value={form.max_per_order} onChange={(e) => set('max_per_order', Number(e.target.value))} />
            </Field>
            <Field label="Máximo por cliente (opcional)" hint="Soma de todas as compras do cliente nesta campanha">
              <input type="number" min={1} value={form.max_per_customer ?? ''} onChange={(e) => set('max_per_customer', e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="Quantidade inicial selecionada">
              <input type="number" min={1} value={form.default_quantity} onChange={(e) => set('default_quantity', Number(e.target.value))} />
            </Field>
          </div>
          <p className="muted">Arrecadação máxima: <b>{money(Number(form.price) * Number(form.total_numbers))}</b></p>
        </div>
      )}

      {tab === 'Promoções e botões' && (
        <>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Botões de seleção rápida</h3>
            <p className="muted">Cada clique soma a quantidade ao total selecionado (ex.: +5, +10).</p>
            {form.quick_buttons.map((b, i) => (
              <div key={i} className="row" style={{ marginBottom: 8 }}>
                <input className="input" style={{ width: 140 }} type="number" min={1} value={b.qty}
                  onChange={(e) => set('quick_buttons', form.quick_buttons.map((x, k) => (k === i ? { ...x, qty: Number(e.target.value) } : x)))} />
                <Toggle label="Mais popular" checked={!!b.popular}
                  onChange={(v) => set('quick_buttons', form.quick_buttons.map((x, k) => ({ ...x, popular: k === i ? v : v ? false : x.popular })))} />
                <button className="btn danger sm" onClick={() => set('quick_buttons', form.quick_buttons.filter((_, k) => k !== i))}>Remover</button>
              </div>
            ))}
            <button className="btn ghost sm" onClick={() => set('quick_buttons', [...form.quick_buttons, { qty: 0 } as QuickButton])}>+ Adicionar botão</button>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Pacotes promocionais</h3>
            <p className="muted">Quando o cliente escolher exatamente esta quantidade, paga o valor promocional. Ex.: 30 por R$ 15,00.</p>
            {form.promotions.map((p, i) => (
              <div key={i} className="row" style={{ marginBottom: 8 }}>
                <span>Quantidade</span>
                <input className="input" style={{ width: 120 }} type="number" min={1} value={p.qty}
                  onChange={(e) => set('promotions', form.promotions.map((x, k) => (k === i ? { ...x, qty: Number(e.target.value) } : x)))} />
                <span>por R$</span>
                <input className="input" style={{ width: 140 }} type="number" step="0.01" min={0} value={p.price}
                  onChange={(e) => set('promotions', form.promotions.map((x, k) => (k === i ? { ...x, price: e.target.value as unknown as number } : x)))} />
                <small className="muted">{p.qty > 0 ? `(${money(Number(p.price) / p.qty)} cada)` : ''}</small>
                <button className="btn danger sm" onClick={() => set('promotions', form.promotions.filter((_, k) => k !== i))}>Remover</button>
              </div>
            ))}
            <button className="btn ghost sm" onClick={() => set('promotions', [...form.promotions, { qty: 0, price: 0 } as Promotion])}>+ Adicionar pacote</button>
          </div>
          <OrderBumpsEditor form={form} set={set} />
        </>
      )}

      {tab === 'Destaque' && (
        <div className="card">
          <p className="muted">Caixa amarela de destaque exibida na página da campanha (ex.: "POLO, NIVUS OU MOTO 0KM PARA A PRÓXIMA COTA").</p>
          <Toggle label="Exibir destaque" checked={!!form.highlight.enabled} onChange={(v) => setH({ enabled: v })} />
          <Field label="Título"><input value={form.highlight.title ?? ''} onChange={(e) => setH({ title: e.target.value })} /></Field>
          <Field label="Texto"><textarea value={form.highlight.text ?? ''} onChange={(e) => setH({ text: e.target.value })} /></Field>
          <div className="grid3">
            <Field label="Contagem regressiva até" hint="Mostra 'Encerra em HH:MM:SS'">
              <input type="datetime-local" value={toLocalInput(form.highlight.ends_at)} onChange={(e) => setH({ ends_at: fromLocalInput(e.target.value) })} />
            </Field>
            <Field label="Válido de">
              <input type="datetime-local" value={toLocalInput(form.highlight.valid_from)} onChange={(e) => setH({ valid_from: fromLocalInput(e.target.value) })} />
            </Field>
            <Field label="Válido até" hint="Após esta data o destaque some">
              <input type="datetime-local" value={toLocalInput(form.highlight.valid_to)} onChange={(e) => setH({ valid_to: fromLocalInput(e.target.value) })} />
            </Field>
          </div>
        </div>
      )}

      {tab === 'Regulamento' && (
        <div className="card">
          <Field label="Descrição / Regulamento" hint="Exibido no botão 'Descrição/Regulamento' da campanha. Quebras de linha são mantidas.">
            <textarea style={{ minHeight: 360 }} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
      )}

      {tab === 'Títulos premiados' && !isNew && <PrizeTitles campaignId={id!} form={form} />}
    </>
  )
}

function OrderBumpsEditor({ form, set }: { form: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void }) {
  const bumps = form.order_bumps ?? []
  const update = (i: number, patch: Partial<OrderBump>) => set('order_bumps', bumps.map((b, k) => (k === i ? { ...b, ...patch } : b)))
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Order bumps (ofertas no checkout)</h3>
      <p className="muted">
        Aparecem no checkout depois que o cliente se identifica, como "Que tal adicionar +10 títulos por apenas R$ 4,99". Ao ativar, a quantidade e o valor são
        somados ao pedido.
      </p>
      <div className="grid2">
        <Field label="Título das ofertas">
          <input value={form.order_bumps_title ?? ''} onChange={(e) => set('order_bumps_title', e.target.value)} />
        </Field>
        <Field label="Subtítulo">
          <input value={form.order_bumps_subtitle ?? ''} onChange={(e) => set('order_bumps_subtitle', e.target.value)} />
        </Field>
      </div>
      {bumps.map((b, i) => (
        <div key={i} className="row" style={{ marginBottom: 8 }}>
          <span>+</span>
          <input className="input" style={{ width: 100 }} type="number" min={1} value={b.qty} onChange={(e) => update(i, { qty: Number(e.target.value) })} />
          <span>títulos por R$</span>
          <input className="input" style={{ width: 120 }} type="number" step="0.01" min={0} value={b.price} onChange={(e) => update(i, { price: e.target.value as unknown as number })} />
          <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Destaque, ex.: 🚨 10X MAIS CHANCES!!" value={b.label ?? ''} onChange={(e) => update(i, { label: e.target.value })} />
          <button className="btn danger sm" onClick={() => set('order_bumps', bumps.filter((_, k) => k !== i))}>Remover</button>
        </div>
      ))}
      <button
        className="btn ghost sm"
        onClick={() => set('order_bumps', [...bumps, { qty: 10, price: 4.99, label: '🚨 10X MAIS CHANCES!!' }])}
      >
        + Adicionar order bump
      </button>
    </div>
  )
}

type PrizeGroup = { qty: number; kind: 'money' | 'item'; value: string; item: string }

const groupPrize = (g: PrizeGroup) => (g.kind === 'money' ? (Number(g.value) > 0 ? `${money(Number(g.value))} 💰` : '') : g.item.trim())

/** Gerador em lote: "30 títulos premiados de R$ 500,00", "2 de iPhone"... */
function PrizeGenerator({ campaignId, available, onDone, onError }: { campaignId: string; available: number; onDone: (n: number) => void; onError: (t: string) => void }) {
  const [groups, setGroups] = useState<PrizeGroup[]>([{ qty: 30, kind: 'money', value: '500', item: '' }])
  const [onlyAvailable, setOnlyAvailable] = useState(true)
  const [busy, setBusy] = useState(false)

  const upd = (i: number, patch: Partial<PrizeGroup>) => setGroups(groups.map((g, k) => (k === i ? { ...g, ...patch } : g)))
  const totalQty = groups.reduce((s, g) => s + (g.qty > 0 ? g.qty : 0), 0)
  const totalMoney = groups.reduce((s, g) => s + (g.kind === 'money' && g.qty > 0 ? g.qty * Number(g.value || 0) : 0), 0)

  const generate = async () => {
    if (groups.some((g) => !(g.qty > 0) || !groupPrize(g))) return onError('Preencha a quantidade e o prêmio de todos os grupos')
    if (totalQty > available) return onError(`A campanha só tem ${available} números que ainda não são premiados`)
    const resumo = groups.map((g) => `${g.qty} × ${groupPrize(g)}`).join('\n')
    if (!confirm(`Gerar ${totalQty} títulos premiados?\n\n${resumo}`)) return
    setBusy(true)
    try {
      const r = await adminApi<{ created: number }>(`/admin/campaigns/${campaignId}/prize-titles/generate`, {
        body: { groups: groups.map((g) => ({ qty: g.qty, prize: groupPrize(g) })), only_available: onlyAvailable },
      })
      onDone(r.created)
    } catch (e) {
      onError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Gerar títulos premiados</h3>
      <p className="muted" style={{ marginTop: -4 }}>
        Informe quantos títulos e o prêmio de cada um. Os números são sorteados automaticamente entre os números da campanha.
      </p>
      {groups.map((g, i) => (
        <div key={i} className="row" style={{ alignItems: 'flex-end', marginBottom: 4 }}>
          <Field label="Quantidade">
            <input type="number" min={1} style={{ width: 110 }} value={g.qty || ''} onChange={(e) => upd(i, { qty: Math.floor(Number(e.target.value)) })} />
          </Field>
          <Field label="Tipo de prêmio">
            <select value={g.kind} onChange={(e) => upd(i, { kind: e.target.value as PrizeGroup['kind'] })}>
              <option value="money">Dinheiro (PIX)</option>
              <option value="item">Produto / outro</option>
            </select>
          </Field>
          <div style={{ flex: 1, minWidth: 180 }}>
            {g.kind === 'money' ? (
              <Field label="Valor de cada prêmio (R$)">
                <input type="number" min={0} step="0.01" placeholder="500" value={g.value} onChange={(e) => upd(i, { value: e.target.value })} />
              </Field>
            ) : (
              <Field label="Prêmio">
                <input placeholder="Ex.: iPhone 17 Pro Max 📱" value={g.item} onChange={(e) => upd(i, { item: e.target.value })} />
              </Field>
            )}
          </div>
          <div className="field" style={{ minWidth: 150 }}>
            <small className="muted">Aparece como</small>
            <b>{groupPrize(g) || '—'}</b>
          </div>
          {groups.length > 1 && (
            <div className="field"><button className="btn danger sm" onClick={() => setGroups(groups.filter((_, k) => k !== i))}>Remover</button></div>
          )}
        </div>
      ))}
      <button className="btn ghost sm" onClick={() => setGroups([...groups, { qty: 1, kind: 'item', value: '', item: '' }])}>+ Adicionar outro prêmio</button>

      <div className="stats" style={{ marginTop: 16 }}>
        <div className="stat"><div className="l">Títulos a gerar</div><div className="v">{totalQty}</div></div>
        {totalMoney > 0 && <div className="stat"><div className="l">Total em dinheiro</div><div className="v">{money(totalMoney)}</div></div>}
        <div className="stat"><div className="l">Números livres p/ premiar</div><div className="v">{available.toLocaleString('pt-BR')}</div></div>
      </div>
      <Toggle label="Sortear apenas números que ainda não foram vendidos ou reservados" checked={onlyAvailable} onChange={setOnlyAvailable} />
      {!onlyAvailable && (
        <div className="alert info">Se um número sorteado já estiver pago, o comprador vira ganhador na hora.</div>
      )}
      <button className="btn" disabled={busy || !totalQty} onClick={generate}>
        {busy ? 'Gerando...' : `🎲 Gerar ${totalQty} títulos premiados`}
      </button>
    </div>
  )
}

type AdminPrizeTitle = PrizeTitle & {
  customers: { name: string; phone: string } | null
  orders: { code: number } | null
  winner_manual?: boolean
  winner_set_by?: string | null
}

function PrizeTitles({ campaignId, form }: { campaignId: string; form: Form }) {
  const [list, setList] = useState<AdminPrizeTitle[]>([])
  const [number, setNumber] = useState('')
  const [prize, setPrize] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [filter, setFilter] = useState<'all' | 'won' | 'available'>('all')
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () =>
    adminApi<AdminPrizeTitle[]>(`/admin/campaigns/${campaignId}/prize-titles`).then(setList).catch((e) => setMsg({ type: 'error', text: errorMessage(e) }))

  useEffect(() => {
    load()
  }, [campaignId])

  const min = Number(form.number_start)
  const max = min + Number(form.total_numbers) - 1
  const won = list.filter((t) => t.winner_name).length
  const maxOrder = list.reduce((m, t) => Math.max(m, Number(t.sort_order)), -1)

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setMsg(null)
    setBusy(true)
    try {
      await fn()
      if (ok) setMsg({ type: 'success', text: ok })
      return true
    } catch (e) {
      setMsg({ type: 'error', text: errorMessage(e) })
      return false
    } finally {
      setBusy(false)
      load()
    }
  }

  const insert = (rows: { number: number; prize: string }[], ok: string) =>
    run(() => adminApi(`/admin/campaigns/${campaignId}/prize-titles`, { body: { items: rows.map((r, i) => ({ ...r, sort_order: maxOrder + 1 + i })) } }), ok)

  const addOne = async () => {
    const n = Number(number)
    if (!prize.trim() || !Number.isInteger(n) || n < min || n > max) return setMsg({ type: 'error', text: `Informe o prêmio e um número entre ${min} e ${max}` })
    if (await insert([{ number: n, prize: prize.trim() }], 'Título adicionado')) setNumber('')
  }

  // uma linha por título: "1322825;POLO PANCADÃO 🤍" (aceita ; tab ou espaço após o número)
  const importText = async () => {
    const rows: { number: number; prize: string }[] = []
    for (const [i, line] of bulkText.split('\n').entries()) {
      if (!line.trim()) continue
      const m = line.trim().match(/^(\d+)\s*[;\t,]?\s*(.+)$/)
      if (!m) return setMsg({ type: 'error', text: `Linha ${i + 1} inválida: "${line}"` })
      rows.push({ number: Number(m[1]), prize: m[2].trim() })
    }
    if (!rows.length) return setMsg({ type: 'error', text: 'Cole ao menos uma linha' })
    if (await insert(rows, `${rows.length} títulos importados`)) setBulkText('')
  }

  // retorno de cada linha aparece na própria linha (não só no topo da aba)
  const [rowMsg, setRowMsg] = useState<Record<string, { type: 'error' | 'success'; text: string }>>({})
  const [names, setNames] = useState<Record<string, string>>({})
  const rowRun = async (t: AdminPrizeTitle, fn: () => Promise<unknown>, ok: string) => {
    setRowMsg((m) => ({ ...m, [t.id]: { type: 'success', text: 'Salvando...' } }))
    try {
      await fn()
      setRowMsg((m) => ({ ...m, [t.id]: { type: 'success', text: ok } }))
      setNames((n) => ({ ...n, [t.id]: '' }))
      load()
    } catch (e) {
      setRowMsg((m) => ({ ...m, [t.id]: { type: 'error', text: errorMessage(e) } }))
    }
  }
  const setManual = (t: AdminPrizeTitle, name: string) =>
    rowRun(t, () => adminApi(`/admin/prize-titles/${t.id}/winner`, { body: { manual_name: name } }), `Ganhador "${name}" salvo`)
  const findBuyer = (t: AdminPrizeTitle) =>
    rowRun(t, () => adminApi(`/admin/prize-titles/${t.id}/winner`, { body: {} }), 'Comprador do número definido como ganhador')

  const assignWinner = (t: AdminPrizeTitle, display_name?: string) =>
    run(() => adminApi(`/admin/prize-titles/${t.id}/winner`, { body: { display_name } }), 'Ganhador atribuído')

  const visible = list.filter((t) => (filter === 'all' ? true : filter === 'won' ? !!t.winner_name : !t.winner_name))

  return (
    <>
      <div className="stats">
        <div className="stat"><div className="l">Títulos premiados</div><div className="v">{list.length}</div></div>
        <div className="stat"><div className="l">Já ganhos</div><div className="v">{won}</div></div>
        <div className="stat"><div className="l">Disponíveis</div><div className="v">{list.length - won}</div></div>
      </div>
      {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}

      <PrizeGenerator campaignId={campaignId} available={Number(form.total_numbers) - list.length} onDone={(n) => {
        setMsg({ type: 'success', text: `${n} títulos premiados gerados!` })
        load()
      }} onError={(text) => setMsg({ type: 'error', text })} />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Cadastrar números específicos</h3>
        <p className="muted">
          Quando um cliente paga um pedido que contém um destes números, ele vira o ganhador automaticamente e o nome aparece na página da campanha.
        </p>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Field label={`Número (${min}–${max})`}><input type="number" value={number} onChange={(e) => setNumber(e.target.value)} /></Field>
          <div style={{ flex: 1 }}><Field label="Prêmio"><input value={prize} placeholder="Ex.: R$ 500,00 💰" onChange={(e) => setPrize(e.target.value)} /></Field></div>
          <div className="field"><button className="btn" disabled={busy} onClick={addOne}>Adicionar</button></div>
        </div>
        <Field label="Importar vários (um por linha: número;prêmio)">
          <textarea
            style={{ minHeight: 110, fontFamily: 'monospace' }}
            placeholder={'1322825;POLO PANCADÃO 🤍\n6486094;START 160 0KM\n7239256;R$ 500,00 💰'}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
        </Field>
        <button className="btn ghost" disabled={busy} onClick={importText}>Importar</button>
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        {(['all', 'won', 'available'] as const).map((f) => (
          <button key={f} className={`btn sm ${filter === f ? '' : 'ghost'}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Todos' : f === 'won' ? 'Ganhos' : 'Disponíveis'}
          </button>
        ))}
        <span className="spacer" />
        <button className="btn ghost sm" disabled={busy} onClick={() => run(() => adminApi(`/admin/campaigns/${campaignId}/prize-titles/sync`, { body: {} }), 'Ganhadores conferidos')}>
          🔄 Conferir ganhadores
        </button>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Número</th><th>Prêmio</th><th>Ganhador</th><th>Comprador</th><th title="Maior aparece primeiro">Ordem ↓</th><th></th></tr></thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={6} className="muted center">Nenhum título.</td></tr>}
            {visible.map((t) => (
              <tr key={t.id}>
                <td><b>{padNumber(t.number, form.number_digits)}</b></td>
                <td><input className="input" defaultValue={t.prize} onBlur={(e) => e.target.value !== t.prize && run(() => adminApi(`/admin/prize-titles/${t.id}`, { method: 'PUT', body: { prize: e.target.value } }))} /></td>
                <td style={{ minWidth: 230 }}>
                  {t.winner_name ? (
                    <>
                      <input
                        className="input"
                        style={{ width: 160 }}
                        title="Nome exibido no site"
                        defaultValue={t.winner_name}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          if (!v || v === t.winner_name) return
                          if (t.winner_manual || !t.customers) setManual(t, v)
                          else assignWinner(t, v)
                        }}
                      />
                      {t.winner_manual && (
                        <div className="muted" style={{ fontSize: 11, marginTop: 3 }} title={t.won_at ? `em ${formatDateTime(t.won_at)}` : ''}>
                          ✍️ manual{t.winner_set_by ? ` · por ${t.winner_set_by}` : ''}
                        </div>
                      )}
                    </>
                  ) : (
                    <form
                      className="row"
                      style={{ gap: 6, flexWrap: 'nowrap' }}
                      onSubmit={(e) => {
                        e.preventDefault()
                        const v = (names[t.id] ?? '').trim()
                        if (v) setManual(t, v)
                      }}
                    >
                      <input
                        className="input"
                        style={{ width: 150 }}
                        placeholder="Nome do ganhador"
                        value={names[t.id] ?? ''}
                        onChange={(e) => setNames((n) => ({ ...n, [t.id]: e.target.value }))}
                      />
                      <button className="btn sm" disabled={!(names[t.id] ?? '').trim()}>Salvar</button>
                    </form>
                  )}
                  {rowMsg[t.id] && (
                    <div style={{ fontSize: 11.5, marginTop: 4, color: rowMsg[t.id].type === 'error' ? '#fca5a5' : '#86efac' }}>{rowMsg[t.id].text}</div>
                  )}
                </td>
                <td style={{ fontSize: 12 }}>
                  {t.customers ? (
                    <>
                      {t.customers.name}
                      <div className="muted">{formatPhone(t.customers.phone)} · pedido #{t.orders?.code}</div>
                    </>
                  ) : '-'}
                </td>
                <td><input className="input" style={{ width: 70 }} type="number" defaultValue={t.sort_order} onBlur={(e) => run(() => adminApi(`/admin/prize-titles/${t.id}`, { method: 'PUT', body: { sort_order: Number(e.target.value) } }))} /></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {t.winner_name ? (
                    <button className="btn ghost sm" disabled={busy} onClick={() => confirm('Remover o ganhador deste título?') && run(() => adminApi(`/admin/prize-titles/${t.id}/clear-winner`, { body: {} }), 'Ganhador removido')}>Limpar ganhador</button>
                  ) : (
                    <button className="btn ghost sm" disabled={busy} onClick={() => findBuyer(t)} title="Usa o cliente que comprou e pagou este número no sistema">Buscar comprador</button>
                  )}{' '}
                  <button className="btn danger sm" disabled={busy} onClick={() => confirm(`Remover o título premiado ${t.number}?`) && run(() => adminApi(`/admin/prize-titles/${t.id}`, { method: 'DELETE' }))}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
