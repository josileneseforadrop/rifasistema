import { useEffect, useState } from 'react'
import { adminApi, errorMessage } from '../lib/api'
import type { BonusConfig, Settings } from '../lib/types'

interface Integrations {
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
  has_bynet_api_key: boolean
  has_utmify_api_token: boolean
  bynet_webhook_url: string | null
}
import { applyTheme, useSettings } from '../context/SettingsContext'
import { Field, ImageInput, ImagesInput, Toggle, VideoInput } from './ui'
import ScriptsAdmin from './ScriptsAdmin'

const TABS = ['Identidade', 'Cores', 'Textos', 'Termos e páginas', 'Rodapé', 'Contato e redes', 'Pagamento', 'Cadastro e afiliados', 'Rastreamento', 'Raspadinha e bônus', 'Scripts'] as const

const PRESETS: Record<string, Partial<Settings>> = {
  'Amarelo (padrão)': { primary_color: '#fde74c', primary_text_color: '#111111', header_bg: '#000000', bg_color: '#1b2230', card_color: '#232b38', text_color: '#ffffff', muted_color: '#9aa3b2' },
  'Verde': { primary_color: '#22c55e', primary_text_color: '#ffffff', header_bg: '#03140a', bg_color: '#0b1a12', card_color: '#13261b', text_color: '#ffffff', muted_color: '#94a3b8' },
  'Azul': { primary_color: '#3b82f6', primary_text_color: '#ffffff', header_bg: '#020617', bg_color: '#0f172a', card_color: '#1e293b', text_color: '#ffffff', muted_color: '#94a3b8' },
  'Roxo': { primary_color: '#a855f7', primary_text_color: '#ffffff', header_bg: '#0c0414', bg_color: '#160b24', card_color: '#211433', text_color: '#ffffff', muted_color: '#a1a1aa' },
  'Vermelho': { primary_color: '#ef4444', primary_text_color: '#ffffff', header_bg: '#0a0000', bg_color: '#1a0f0f', card_color: '#271616', text_color: '#ffffff', muted_color: '#a1a1aa' },
}

export default function SettingsAdmin() {
  const { settings, reload } = useSettings()
  const [s, setS] = useState<Settings | null>(settings)
  const [tab, setTab] = useState<(typeof TABS)[number]>('Identidade')
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [integ, setInteg] = useState<Integrations | null>(null)
  const [integDirty, setIntegDirty] = useState(false)
  const [testMsg, setTestMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  useEffect(() => {
    adminApi<Integrations>('/admin/integrations').then(setInteg).catch((e) => setMsg({ type: 'error', text: errorMessage(e) }))
  }, [])

  const setI = <K extends keyof Integrations>(k: K, v: Integrations[K]) => {
    setInteg((i) => (i ? { ...i, [k]: v } : i))
    setIntegDirty(true)
  }
  const setAddr = (k: string, v: string) => integ && setI('bynet_address', { ...integ.bynet_address, [k]: v })

  const runTest = async (path: string, body: unknown = {}) => {
    setTestMsg(null)
    try {
      if (integDirty) await saveIntegrations()
      const r = await adminApi<{ ok: boolean; message: string }>(path, { body })
      setTestMsg({ type: r.ok ? 'success' : 'error', text: r.message })
    } catch (e) {
      setTestMsg({ type: 'error', text: errorMessage(e) })
    }
  }

  const saveIntegrations = async () => {
    if (!integ) return
    const saved = await adminApi<Integrations>('/admin/integrations', { method: 'PUT', body: integ })
    setInteg(saved)
    setIntegDirty(false)
  }

  useEffect(() => {
    if (settings && !s) setS(settings)
  }, [settings, s])

  if (!s) return <div className="spinner" />

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    const next = { ...s, [k]: v }
    setS(next)
    if (String(k).includes('color') || k === 'header_bg') applyTheme(next)
  }
  const text = (k: keyof Settings, label: string, hint?: string, area = false) => (
    <Field label={label} hint={hint}>
      {area ? (
        <textarea style={{ minHeight: 300 }} value={(s[k] as string) ?? ''} onChange={(e) => set(k, e.target.value as never)} />
      ) : (
        <input value={(s[k] as string) ?? ''} onChange={(e) => set(k, e.target.value as never)} />
      )}
    </Field>
  )
  const color = (k: keyof Settings, label: string) => (
    <Field label={label}>
      <div className="row">
        <input type="color" style={{ width: 60 }} value={(s[k] as string) ?? '#000000'} onChange={(e) => set(k, e.target.value as never)} />
        <input className="input" style={{ flex: 1 }} value={(s[k] as string) ?? ''} onChange={(e) => set(k, e.target.value as never)} />
      </div>
    </Field>
  )

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      if (integDirty) await saveIntegrations()
      await adminApi('/admin/settings', {
        method: 'PUT',
        body: { ...s, order_expiration_minutes: Number(s.order_expiration_minutes), default_commission: Number(s.default_commission) },
      })
      setMsg({ type: 'success', text: 'Configurações salvas!' })
      reload()
    } catch (e) {
      setMsg({ type: 'error', text: errorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="admin-top">
        <h1>Configurações do site</h1>
        <span className="spacer" />
        {tab !== 'Scripts' && <button className="btn" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>}
      </div>
      {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}
      <div className="tabs">
        {TABS.map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Identidade' && (
        <div className="card">
          {text('site_name', 'Nome do site')}
          <Field label="Logo" hint="PNG com fundo transparente, altura ~ 100px"><ImageInput value={s.logo_url} onChange={(v) => set('logo_url', v)} folder="branding" /></Field>
          <Field label="Favicon / ícone do app" hint="Quadrado, 512×512"><ImageInput value={s.favicon_url} onChange={(v) => set('favicon_url', v)} folder="branding" /></Field>
          {text('seo_description', 'Descrição para Google / compartilhamento')}
          <Toggle label='Mostrar banner "Instalar o APP"' checked={s.show_install_banner} onChange={(v) => set('show_install_banner', v)} />
          <div className="grid2">
            {text('install_title', 'Título do banner')}
            {text('install_subtitle', 'Subtítulo do banner')}
          </div>
        </div>
      )}

      {tab === 'Cores' && (
        <div className="card">
          <div className="row" style={{ marginBottom: 16 }}>
            {Object.entries(PRESETS).map(([name, p]) => (
              <button key={name} className="btn ghost sm" onClick={() => { const next = { ...s, ...p }; setS(next); applyTheme(next) }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, background: p.primary_color }} /> {name}
              </button>
            ))}
          </div>
          <div className="grid2">
            {color('primary_color', 'Cor principal (botões, destaques)')}
            {color('primary_text_color', 'Texto sobre a cor principal')}
            {color('header_bg', 'Fundo do cabeçalho e menu')}
            {color('bg_color', 'Fundo da página')}
            {color('card_color', 'Fundo do conteúdo')}
            {color('text_color', 'Cor do texto')}
            {color('muted_color', 'Texto secundário')}
          </div>
          <small className="muted">A prévia é aplicada imediatamente. Clique em salvar para publicar.</small>
        </div>
      )}

      {tab === 'Textos' && (
        <div className="card">
          <div className="grid2">
            {text('campaigns_title', 'Título da seção de campanhas')}
            {text('campaigns_subtitle', 'Subtítulo da seção de campanhas')}
            {text('winners_title', 'Título da seção de ganhadores')}
            {text('winners_subtitle', 'Subtítulo da seção de ganhadores')}
          </div>
          <Toggle label="Mostrar ganhadores na página inicial" checked={s.show_winners_home} onChange={(v) => set('show_winners_home', v)} />
        </div>
      )}

      {tab === 'Termos e páginas' && (
        <div className="card">
          {text('terms_text', 'Termos de uso', 'Quebras de linha são mantidas', true)}
          {text('privacy_text', 'Política de privacidade (opcional)', undefined, true)}
          <Field label="Texto da página de suporte">
            <textarea value={s.support_text ?? ''} onChange={(e) => set('support_text', e.target.value)} />
          </Field>
        </div>
      )}

      {tab === 'Rodapé' && (
        <div className="card">
          <Field label="Logos do rodapé" hint="Ex.: selos de jogo responsável, instituição, +18"><ImagesInput value={s.footer_logos ?? []} onChange={(v) => set('footer_logos', v)} folder="branding" /></Field>
          <Field label="Texto do rodapé" hint="Ex.: informações legais, CNPJ, autorização">
            <textarea style={{ minHeight: 180 }} value={s.footer_text ?? ''} onChange={(e) => set('footer_text', e.target.value)} />
          </Field>
        </div>
      )}

      {tab === 'Contato e redes' && (
        <div className="card">
          <div className="grid2">
            {text('support_whatsapp', 'WhatsApp do suporte', 'Com DDD. Ex.: 27999999999')}
            {text('support_email', 'E-mail do suporte')}
            {text('whatsapp_group_url', 'Link do grupo de WhatsApp', 'Exibe o botão flutuante "Grupo"')}
            {text('whatsapp_group_label', 'Texto do botão do grupo')}
            {text('instagram_url', 'Instagram (URL)')}
            {text('facebook_url', 'Facebook (URL)')}
            {text('telegram_url', 'Telegram (URL)')}
            {text('youtube_url', 'YouTube (URL)')}
            {text('tiktok_url', 'TikTok (URL)')}
          </div>
        </div>
      )}

      {tab === 'Pagamento' && (
        <>
          <div className="card">
            <Field label="Gateway de pagamento">
              <select value={s.payment_mode} onChange={(e) => set('payment_mode', e.target.value as Settings['payment_mode'])}>
                <option value="manual">PIX manual (chave própria, confirmação pelo admin)</option>
                <option value="bynet">Bynet (PIX com confirmação automática)</option>
              </select>
            </Field>
            <Field label="Tempo para pagamento (minutos)" hint="Após esse prazo o pedido expira e os números voltam a ficar disponíveis">
              <input type="number" min={1} value={s.order_expiration_minutes} onChange={(e) => set('order_expiration_minutes', Number(e.target.value))} />
            </Field>
          </div>

          {s.payment_mode === 'manual' && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>PIX manual</h3>
              <div className="alert info">O cliente recebe um QR Code PIX com o valor exato. Você confirma o pagamento em Pedidos → Detalhes → Confirmar pagamento.</div>
              <div className="grid3">
                {text('pix_key', 'Chave PIX', 'Celular no formato +5527999999999')}
                {text('pix_receiver_name', 'Nome do recebedor')}
                {text('pix_city', 'Cidade do recebedor')}
              </div>
              <Field label="Instruções exibidas ao cliente">
                <textarea value={s.payment_instructions ?? ''} onChange={(e) => set('payment_instructions', e.target.value)} />
              </Field>
            </div>
          )}

          {s.payment_mode === 'bynet' && integ && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Credenciais Bynet</h3>
              {testMsg && <div className={`alert ${testMsg.type}`}>{testMsg.text}</div>}
              <div className="grid2">
                <Field label="API Key (x-api-key)" hint={integ.has_bynet_api_key ? 'Salva. Digite uma nova para substituir.' : 'Gerada no painel da Bynet'}>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder={integ.has_bynet_api_key ? integ.bynet_api_key ?? '' : 'Cole sua API Key'}
                    value={integ.bynet_api_key?.startsWith('••') ? '' : integ.bynet_api_key ?? ''}
                    onChange={(e) => setI('bynet_api_key', e.target.value)}
                  />
                </Field>
                <Field label="URL da API" hint="Padrão: https://api-gateway.techbynet.com">
                  <input value={integ.bynet_base_url} onChange={(e) => setI('bynet_base_url', e.target.value)} />
                </Field>
                <Field label="User-Agent" hint="Exigido pela Bynet. Padrão: AtivoB2B/1.0">
                  <input value={integ.bynet_user_agent} onChange={(e) => setI('bynet_user_agent', e.target.value)} />
                </Field>
                <Field label="E-mail padrão do comprador" hint="A Bynet exige e-mail; usado quando o cliente não informou">
                  <input type="email" value={integ.bynet_default_email ?? ''} onChange={(e) => setI('bynet_default_email', e.target.value)} />
                </Field>
              </div>
              <Field label="Endereço do site" hint="Usado para a Bynet avisar os pagamentos (postback). Ex.: https://www.seusite.com">
                <input value={integ.public_url ?? ''} placeholder="https://www.seusite.com" onChange={(e) => setI('public_url', e.target.value)} />
              </Field>
              {integ.bynet_webhook_url ? (
                <div className="alert info">
                  URL de postback enviada em cada cobrança: <b>{integ.bynet_webhook_url}</b>
                </div>
              ) : (
                <div className="alert info">Sem o endereço do site, o pagamento é confirmado consultando a Bynet enquanto o cliente está na página do pedido.</div>
              )}
              <h4>Endereço padrão do comprador</h4>
              <p className="muted" style={{ marginTop: -6 }}>A API da Bynet exige endereço; o checkout não pede, então este é enviado em todas as cobranças.</p>
              <div className="grid3">
                {(
                  [
                    ['street', 'Rua'], ['streetNumber', 'Número'], ['complement', 'Complemento'], ['neighborhood', 'Bairro'],
                    ['zipCode', 'CEP'], ['city', 'Cidade'], ['state', 'UF'], ['country', 'País'],
                  ] as const
                ).map(([k, label]) => (
                  <Field key={k} label={label}>
                    <input value={integ.bynet_address?.[k] ?? ''} onChange={(e) => setAddr(k, e.target.value)} />
                  </Field>
                ))}
              </div>
              <button className="btn ghost" onClick={() => runTest('/admin/integrations/test-bynet')}>Testar conexão</button>
            </div>
          )}
        </>
      )}

      {tab === 'Cadastro e afiliados' && (
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            O checkout identifica o cliente pelo CPF. Novos clientes informam nome, telefone (com confirmação) e data de nascimento; menores de 18 anos são
            bloqueados.
          </p>
          <Field label="Texto de aceite no checkout" hint='Seguido do link "termos de uso"'>
            <textarea style={{ minHeight: 70 }} value={s.checkout_terms_text ?? ''} onChange={(e) => set('checkout_terms_text', e.target.value)} />
          </Field>
          <hr style={{ borderColor: '#232a37' }} />
          <Toggle label="Programa de afiliados ativo" checked={s.affiliates_enabled} onChange={(v) => set('affiliates_enabled', v)} />
          <Field label="Comissão padrão de novos afiliados (%)">
            <input type="number" step="0.01" value={s.default_commission} onChange={(e) => set('default_commission', Number(e.target.value))} />
          </Field>
          <Field label="Texto da página de afiliados">
            <textarea value={s.affiliates_text ?? ''} onChange={(e) => set('affiliates_text', e.target.value)} />
          </Field>
        </div>
      )}

      {tab === 'Raspadinha e bônus' && s.bonus && <BonusSettings value={s.bonus} onChange={(v) => set('bonus', v)} />}

      {tab === 'Scripts' && <ScriptsAdmin />}

      {tab === 'Rastreamento' && (
        <>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Pixels</h3>
            {text('meta_pixel_id', 'ID do Pixel da Meta (Facebook)')}
            {text('google_analytics_id', 'ID do Google Analytics (G-XXXXXXX)')}
            <small className="muted">Eventos enviados: PageView, ViewContent, InitiateCheckout e Purchase.</small>
          </div>
          {integ && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Utmify</h3>
              <p className="muted">
                Cada pedido é enviado para a Utmify com as UTMs da URL de entrada (utm_source, utm_campaign, utm_medium, utm_content, utm_term, src e sck): ao gerar o
                PIX (aguardando pagamento), ao ser pago e ao ser estornado/cancelado.
              </p>
              {testMsg && <div className={`alert ${testMsg.type}`}>{testMsg.text}</div>}
              <Toggle label="Enviar vendas para a Utmify" checked={integ.utmify_enabled} onChange={(v) => setI('utmify_enabled', v)} />
              <div className="grid2">
                <Field label="Token da API (x-api-token)" hint={integ.has_utmify_api_token ? 'Salvo. Digite um novo para substituir.' : 'Utmify → Integrações → Webhooks → Credenciais de API'}>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder={integ.has_utmify_api_token ? integ.utmify_api_token ?? '' : 'Cole seu token'}
                    value={integ.utmify_api_token?.startsWith('••') ? '' : integ.utmify_api_token ?? ''}
                    onChange={(e) => setI('utmify_api_token', e.target.value)}
                  />
                </Field>
                <Field label="Nome da plataforma" hint="Aparece na Utmify. Padrão: nome do site">
                  <input value={integ.utmify_platform ?? ''} placeholder={s.site_name.replace(/\s+/g, '')} onChange={(e) => setI('utmify_platform', e.target.value)} />
                </Field>
              </div>
              <Toggle label="Modo teste (a Utmify valida, mas não salva os pedidos)" checked={integ.utmify_test_mode} onChange={(v) => setI('utmify_test_mode', v)} />
              <button className="btn ghost" onClick={() => runTest('/admin/integrations/test-utmify', { token: integ.utmify_api_token })}>Enviar pedido de teste</button>
            </div>
          )}
        </>
      )}
    </>
  )
}

function BonusSettings({ value: b, onChange }: { value: BonusConfig; onChange: (v: BonusConfig) => void }) {
  const set = <K extends keyof BonusConfig>(k: K, v: BonusConfig[K]) => onChange({ ...b, [k]: v })
  const txt = (k: keyof BonusConfig, label: string, hint?: string, max?: number) => (
    <Field label={label} hint={hint}>
      <input maxLength={max} value={(b[k] as string) ?? ''} onChange={(e) => set(k, e.target.value as never)} />
    </Field>
  )
  const color = (k: keyof BonusConfig, label: string, def: string) => (
    <Field label={label}>
      <div className="row">
        <input type="color" style={{ width: 56 }} value={(b[k] as string) || def} onChange={(e) => set(k, e.target.value as never)} />
        <input className="input" style={{ flex: 1 }} value={(b[k] as string) ?? ''} placeholder={def} onChange={(e) => set(k, e.target.value as never)} />
      </div>
    </Field>
  )
  const janelas = [...(b.janelas ?? []), '', '', '', '', '', ''].slice(0, 6)
  return (
    <>
      <div className="card">
        <Toggle label="Mostrar a raspadinha na página de pagamento confirmado" checked={!!b.enabled} onChange={(v) => set('enabled', v)} />
        <p className="muted" style={{ marginTop: 0 }}>
          O cliente raspa 9 casas e sempre acha 3 bônus (o 3º aparece na última casa raspada). Depois abre a oferta com o vídeo. Ao tocar no botão, o
          resgate fica registrado no pedido e a próxima compra feita por ele é marcada como <b>elegível ao bônus</b> em Pedidos, se passar do valor mínimo
          em até 30 minutos.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>A oferta</h3>
        <div className="grid3">
          {txt('premio', 'Carro A (o que a cota premiada paga no site)', 'Ex.: NIVUS', 14)}
          {txt('carro_b', 'Carro B — a outra escolha', 'Vazio = só o carro A', 14)}
          {txt('extra', 'O que vem a mais por aqui', 'Ex.: R$10.000 (vazio = sem extra)', 16)}
          {txt('site', 'O que a cota premiada paga no site', 'Ex.: só o Nivus', 24)}
          <Field label="Fezinha mínima (R$)" hint="0 = qualquer valor. O botão já abre a campanha acima deste valor">
            <input type="number" min={0} step="0.01" value={b.min_amount ?? 0} onChange={(e) => set('min_amount', Number(e.target.value))} />
          </Field>
          <Field label="Minutos até a condição acabar" hint="Conta a partir de quando o cliente abre a oferta; recarregar não reinicia">
            <input type="number" min={1} max={99} value={b.countdown_minutes ?? 3} onChange={(e) => set('countdown_minutes', Number(e.target.value))} />
          </Field>
        </div>
        {txt('cta_campaign_slug', 'Campanha do botão (endereço/slug)', 'Vazio = a mesma campanha do pedido')}
        <Field label="Regras do bônus (recomendado)" hint='Aparecem em "regras do bônus" abaixo do botão: condições, prazo de resgate, como o bônus é pago'>
          <textarea style={{ minHeight: 80 }} value={b.rules ?? ''} onChange={(e) => set('rules', e.target.value)} />
        </Field>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Vídeo da oferta</h3>
        <div className="grid2">
          <Field label="Vídeo" hint="MP4 (H.264) funciona em todos os celulares">
            <VideoInput value={b.video_url} onChange={(v) => set('video_url', v)} />
          </Field>
          <Field label="Capa do vídeo (opcional)">
            <ImageInput value={b.video_poster} onChange={(v) => set('video_poster', v)} folder="videos" />
          </Field>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Raspadinha</h3>
        <div className="grid3">
          {txt('simbolo', 'As 3 iguais da raspadinha', 'Ex.: BÔNUS', 20)}
          {txt('titulo', 'Título', 'O nome do cliente entra antes', 30)}
          {txt('titulo_destaque', 'Título — destaque (dourado)', undefined, 30)}
        </div>
        <Field label="Janelas que não são bônus (6)" hint='Duas palavras viram texto grande + pequeno, ex.: "SORTE NORMAL". "PERDEU" fica apagado, "SORTE…" branco e o resto verde'>
          <div className="grid3">
            {janelas.map((j, i) => (
              <input
                key={i}
                className="input"
                maxLength={14}
                value={j}
                onChange={(e) => set('janelas', janelas.map((x, k) => (k === i ? e.target.value : x)))}
                style={{ marginBottom: 8 }}
              />
            ))}
          </div>
        </Field>
        <h4>Folha que sobe ao terminar</h4>
        <div className="grid2">
          {txt('resultado', 'Resultado', 'Ex.: UM BÔNUS', 20)}
          {txt('resultado_detalhe', 'Embaixo do resultado', 'Ex.: SÓ POR ESTA PÁGINA', 30)}
          {txt('condicao', 'Convite pequeno', 'Ex.: toca pra ver o que é', 40)}
          {txt('botao_resultado', 'Texto do botão', 'Ex.: VER MEU BÔNUS', 24)}
        </div>
        <h4>Tela da oferta</h4>
        <div className="grid2">
          {txt('chamada', 'Chamada (antes do nome)', 'Ex.: SEU BÔNUS', 40)}
          {txt('escolha', 'Acima dos carros', 'Ex.: VOCÊ ESCOLHE', 24)}
          {txt('cta', 'Texto do botão', 'Ex.: GARANTIR AGORA', 24)}
          {txt('fechar', 'Texto do link de baixo', 'Ex.: mostrar meus números', 40)}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Cores</h3>
        <div className="grid2">
          {color('cor_primaria', 'Cor principal', '#1fd36b')}
          {color('cor_destaque', 'Cor de destaque', '#ffc531')}
          {color('cor_fundo', 'Fundo', '#02080a')}
          {color('cor_texto', 'Texto', '#f2fff7')}
        </div>
      </div>
    </>
  )
}
