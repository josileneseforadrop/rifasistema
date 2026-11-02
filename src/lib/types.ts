export type CampaignStatus = 'draft' | 'active' | 'paused' | 'finished'

export interface QuickButton { qty: number; popular?: boolean }
export interface Promotion { qty: number; price: number }
export interface OrderBump { qty: number; price: number; label?: string }
export interface Highlight {
  enabled?: boolean
  title?: string
  text?: string
  ends_at?: string | null
  valid_from?: string | null
  valid_to?: string | null
}

export interface Campaign {
  id: string
  slug: string
  title: string
  subtitle: string | null
  badge_text: string | null
  description: string | null
  images: string[]
  status: CampaignStatus
  featured: boolean
  sort_order: number
  price: number
  total_numbers: number
  number_start: number
  number_digits: number
  min_per_order: number
  max_per_order: number
  max_per_customer: number | null
  default_quantity: number
  quick_buttons: QuickButton[]
  promotions: Promotion[]
  order_bumps: OrderBump[]
  order_bumps_title: string | null
  order_bumps_subtitle: string | null
  highlight: Highlight
  show_progress: boolean
  progress_override: number | null
  draw_date: string | null
  show_draw_date: boolean
  draw_result: string | null
  whatsapp_group_url: string | null
  sold_count: number
  reserved_count: number
  created_at: string
}

export interface PrizeTitle {
  id: string
  campaign_id: string
  number: number
  prize: string
  winner_name: string | null
  customer_id: string | null
  order_id: string | null
  won_at: string | null
  sort_order: number
}

export interface Settings {
  site_name: string
  logo_url: string | null
  favicon_url: string | null
  seo_description: string | null
  primary_color: string
  primary_text_color: string
  header_bg: string
  bg_color: string
  card_color: string
  text_color: string
  muted_color: string
  campaigns_title: string | null
  campaigns_subtitle: string | null
  winners_title: string | null
  winners_subtitle: string | null
  show_winners_home: boolean
  terms_text: string | null
  privacy_text: string | null
  support_text: string | null
  support_whatsapp: string | null
  support_email: string | null
  footer_text: string | null
  footer_logos: string[]
  whatsapp_group_url: string | null
  whatsapp_group_label: string | null
  instagram_url: string | null
  facebook_url: string | null
  telegram_url: string | null
  youtube_url: string | null
  tiktok_url: string | null
  show_install_banner: boolean
  install_title: string | null
  install_subtitle: string | null
  payment_mode: 'manual' | 'bynet'
  pix_key: string | null
  pix_receiver_name: string | null
  pix_city: string | null
  payment_instructions: string | null
  order_expiration_minutes: number
  checkout_terms_text: string | null
  bonus: BonusConfig
  affiliates_enabled: boolean
  affiliates_text: string | null
  default_commission: number
  meta_pixel_id: string | null
  google_analytics_id: string | null
}

/** cliente identificado (telefone vem mascarado do servidor) */
export interface Customer { id: string; name: string; phone: string | null }

export interface PublicOrder {
  id: string
  code: number
  status: 'pending' | 'paid' | 'cancelled' | 'expired'
  quantity: number
  unit_price: number
  total: number
  created_at: string
  expires_at: string
  paid_at: string | null
  payment_method: 'manual' | 'bynet'
  affiliate_code: string | null
  customer: { name: string; cpf: string | null; phone: string | null }
  campaign: {
    id: string
    title: string
    subtitle: string | null
    badge_text: string | null
    status: string
    slug: string
    image: string | null
    number_digits: number
    draw_date: string | null
  }
  numbers: number[]
  prizes: { number: number; prize: string }[]
}

export interface Winner {
  id: string
  name: string
  campaign_title: string | null
  prize: string | null
  ticket_number: string | null
  draw_date: string | null
  photo_url: string | null
  phone_masked: string | null
}

export interface Announcement {
  id: string
  title: string
  content: string | null
  image_url: string | null
  published: boolean
  pinned: boolean
  created_at: string
}

export interface BonusConfig {
  enabled: boolean
  video_url: string | null
  video_poster: string | null
  premio: string | null
  carro_b: string | null
  extra: string | null
  site: string | null
  simbolo: string | null
  titulo: string | null
  titulo_destaque: string | null
  resultado: string | null
  resultado_detalhe: string | null
  condicao: string | null
  botao_resultado: string | null
  chamada: string | null
  escolha: string | null
  cta: string | null
  fechar: string | null
  janelas: string[]
  cor_primaria: string | null
  cor_destaque: string | null
  cor_fundo: string | null
  cor_texto: string | null
  rules: string | null
  countdown_minutes: number
  min_amount: number
  cta_campaign_slug: string | null
}
