-- =====================================================================
-- 0001 - Tabelas base do sistema de rifas (apenas armazenamento)
-- Idempotente: pode rodar num banco que já tem estas tabelas sem perder dados.
-- =====================================================================

create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);
-- garante as colunas caso a tabela já existisse numa versão anterior
alter table admins add column if not exists name text;
alter table admins add column if not exists email text unique;
alter table admins add column if not exists password_hash text;
alter table admins add column if not exists created_at timestamptz not null default now();

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  site_name text not null default 'Minha Rifa',
  logo_url text,
  favicon_url text,
  seo_description text default 'Participe das nossas campanhas e concorra a prêmios incríveis!',
  primary_color text not null default '#fde74c',
  primary_text_color text not null default '#111111',
  header_bg text not null default '#000000',
  bg_color text not null default '#1b2230',
  card_color text not null default '#232b38',
  text_color text not null default '#ffffff',
  muted_color text not null default '#9aa3b2',
  campaigns_title text default 'Campanhas',
  campaigns_subtitle text default 'Escolha sua sorte',
  winners_title text default 'Ganhadores',
  winners_subtitle text default 'sortudos',
  show_winners_home boolean not null default true,
  terms_text text default 'Edite os termos de uso no painel administrativo.',
  privacy_text text,
  support_text text default 'Fale com a nossa equipe pelos canais abaixo.',
  support_whatsapp text,
  support_email text,
  footer_text text,
  footer_logos jsonb not null default '[]'::jsonb,
  whatsapp_group_url text,
  whatsapp_group_label text default 'Grupo',
  instagram_url text,
  facebook_url text,
  telegram_url text,
  youtube_url text,
  tiktok_url text,
  show_install_banner boolean not null default true,
  install_title text default 'Instalar o APP Grátis',
  install_subtitle text default 'Receba promoções exclusivas!',
  payment_mode text not null default 'manual',
  pix_key text,
  pix_receiver_name text,
  pix_city text,
  payment_instructions text default 'Após o pagamento, envie o comprovante pelo WhatsApp do suporte.',
  order_expiration_minutes int not null default 15,
  require_email boolean not null default false,
  require_cpf boolean not null default false,
  affiliates_enabled boolean not null default true,
  affiliates_text text default 'Indique nossas campanhas e ganhe comissão sobre cada venda paga.',
  default_commission numeric(5,2) not null default 10,
  meta_pixel_id text,
  google_analytics_id text,
  updated_at timestamptz not null default now()
);
-- garante as colunas caso a tabela já existisse numa versão anterior
alter table settings add column if not exists site_name text not null default 'Minha Rifa';
alter table settings add column if not exists logo_url text;
alter table settings add column if not exists favicon_url text;
alter table settings add column if not exists seo_description text default 'Participe das nossas campanhas e concorra a prêmios incríveis!';
alter table settings add column if not exists primary_color text not null default '#fde74c';
alter table settings add column if not exists primary_text_color text not null default '#111111';
alter table settings add column if not exists header_bg text not null default '#000000';
alter table settings add column if not exists bg_color text not null default '#1b2230';
alter table settings add column if not exists card_color text not null default '#232b38';
alter table settings add column if not exists text_color text not null default '#ffffff';
alter table settings add column if not exists muted_color text not null default '#9aa3b2';
alter table settings add column if not exists campaigns_title text default 'Campanhas';
alter table settings add column if not exists campaigns_subtitle text default 'Escolha sua sorte';
alter table settings add column if not exists winners_title text default 'Ganhadores';
alter table settings add column if not exists winners_subtitle text default 'sortudos';
alter table settings add column if not exists show_winners_home boolean not null default true;
alter table settings add column if not exists terms_text text default 'Edite os termos de uso no painel administrativo.';
alter table settings add column if not exists privacy_text text;
alter table settings add column if not exists support_text text default 'Fale com a nossa equipe pelos canais abaixo.';
alter table settings add column if not exists support_whatsapp text;
alter table settings add column if not exists support_email text;
alter table settings add column if not exists footer_text text;
alter table settings add column if not exists footer_logos jsonb not null default '[]'::jsonb;
alter table settings add column if not exists whatsapp_group_url text;
alter table settings add column if not exists whatsapp_group_label text default 'Grupo';
alter table settings add column if not exists instagram_url text;
alter table settings add column if not exists facebook_url text;
alter table settings add column if not exists telegram_url text;
alter table settings add column if not exists youtube_url text;
alter table settings add column if not exists tiktok_url text;
alter table settings add column if not exists show_install_banner boolean not null default true;
alter table settings add column if not exists install_title text default 'Instalar o APP Grátis';
alter table settings add column if not exists install_subtitle text default 'Receba promoções exclusivas!';
alter table settings add column if not exists payment_mode text not null default 'manual';
alter table settings add column if not exists pix_key text;
alter table settings add column if not exists pix_receiver_name text;
alter table settings add column if not exists pix_city text;
alter table settings add column if not exists payment_instructions text default 'Após o pagamento, envie o comprovante pelo WhatsApp do suporte.';
alter table settings add column if not exists order_expiration_minutes int not null default 15;
alter table settings add column if not exists require_email boolean not null default false;
alter table settings add column if not exists require_cpf boolean not null default false;
alter table settings add column if not exists affiliates_enabled boolean not null default true;
alter table settings add column if not exists affiliates_text text default 'Indique nossas campanhas e ganhe comissão sobre cada venda paga.';
alter table settings add column if not exists default_commission numeric(5,2) not null default 10;
alter table settings add column if not exists meta_pixel_id text;
alter table settings add column if not exists google_analytics_id text;
alter table settings add column if not exists updated_at timestamptz not null default now();
insert into settings (id) values (1) on conflict do nothing;

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  badge_text text,
  description text,
  images text[] not null default '{}',
  status text not null default 'draft',
  featured boolean not null default false,
  sort_order int not null default 0,
  price numeric(12,2) not null default 1,
  total_numbers bigint not null default 1000000,
  number_start bigint not null default 0,
  number_digits int not null default 7,
  min_per_order int not null default 1,
  max_per_order int not null default 20000,
  max_per_customer int,
  default_quantity int not null default 10,
  quick_buttons jsonb not null default '[{"qty":5},{"qty":10,"popular":true},{"qty":50},{"qty":100}]'::jsonb,
  promotions jsonb not null default '[]'::jsonb,
  highlight jsonb not null default '{"enabled":false}'::jsonb,
  show_progress boolean not null default true,
  progress_override numeric(5,2),
  draw_date timestamptz,
  show_draw_date boolean not null default true,
  draw_result text,
  whatsapp_group_url text,
  sold_count bigint not null default 0,
  reserved_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- garante as colunas caso a tabela já existisse numa versão anterior
alter table campaigns add column if not exists slug text unique;
alter table campaigns add column if not exists title text;
alter table campaigns add column if not exists subtitle text;
alter table campaigns add column if not exists badge_text text;
alter table campaigns add column if not exists description text;
alter table campaigns add column if not exists images text[] not null default '{}';
alter table campaigns add column if not exists status text not null default 'draft';
alter table campaigns add column if not exists featured boolean not null default false;
alter table campaigns add column if not exists sort_order int not null default 0;
alter table campaigns add column if not exists price numeric(12,2) not null default 1;
alter table campaigns add column if not exists total_numbers bigint not null default 1000000;
alter table campaigns add column if not exists number_start bigint not null default 0;
alter table campaigns add column if not exists number_digits int not null default 7;
alter table campaigns add column if not exists min_per_order int not null default 1;
alter table campaigns add column if not exists max_per_order int not null default 20000;
alter table campaigns add column if not exists max_per_customer int;
alter table campaigns add column if not exists default_quantity int not null default 10;
alter table campaigns add column if not exists quick_buttons jsonb not null default '[{"qty":5},{"qty":10,"popular":true},{"qty":50},{"qty":100}]'::jsonb;
alter table campaigns add column if not exists promotions jsonb not null default '[]'::jsonb;
alter table campaigns add column if not exists highlight jsonb not null default '{"enabled":false}'::jsonb;
alter table campaigns add column if not exists show_progress boolean not null default true;
alter table campaigns add column if not exists progress_override numeric(5,2);
alter table campaigns add column if not exists draw_date timestamptz;
alter table campaigns add column if not exists show_draw_date boolean not null default true;
alter table campaigns add column if not exists draw_result text;
alter table campaigns add column if not exists whatsapp_group_url text;
alter table campaigns add column if not exists sold_count bigint not null default 0;
alter table campaigns add column if not exists reserved_count bigint not null default 0;
alter table campaigns add column if not exists created_at timestamptz not null default now();
alter table campaigns add column if not exists updated_at timestamptz not null default now();
create index if not exists campaigns_status_idx on campaigns(status, featured desc, sort_order);

create table if not exists affiliates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  email text,
  pix_key text,
  code text not null unique,
  commission_percent numeric(5,2) not null default 10,
  paid_out numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
-- garante as colunas caso a tabela já existisse numa versão anterior
alter table affiliates add column if not exists name text;
alter table affiliates add column if not exists phone text unique;
alter table affiliates add column if not exists email text;
alter table affiliates add column if not exists pix_key text;
alter table affiliates add column if not exists code text unique;
alter table affiliates add column if not exists commission_percent numeric(5,2) not null default 10;
alter table affiliates add column if not exists paid_out numeric(12,2) not null default 0;
alter table affiliates add column if not exists active boolean not null default true;
alter table affiliates add column if not exists created_at timestamptz not null default now();

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  email text,
  cpf text,
  affiliate_id uuid references affiliates on delete set null,
  created_at timestamptz not null default now()
);
-- garante as colunas caso a tabela já existisse numa versão anterior
alter table customers add column if not exists name text;
alter table customers add column if not exists phone text unique;
alter table customers add column if not exists email text;
alter table customers add column if not exists cpf text;
alter table customers add column if not exists affiliate_id uuid references affiliates on delete set null;
alter table customers add column if not exists created_at timestamptz not null default now();

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  code bigint generated by default as identity (start with 1000) unique,
  campaign_id uuid not null references campaigns on delete cascade,
  customer_id uuid not null references customers on delete cascade,
  affiliate_id uuid references affiliates on delete set null,
  quantity int not null,
  unit_price numeric(12,2) not null,
  total numeric(12,2) not null,
  status text not null default 'pending',
  payment_method text not null default 'manual',
  payment_id text,
  pix_qr_code text,
  pix_qr_base64 text,
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
-- garante as colunas caso a tabela já existisse numa versão anterior
alter table orders add column if not exists code bigint generated by default as identity (start with 1000) unique;
alter table orders add column if not exists campaign_id uuid references campaigns on delete cascade;
alter table orders add column if not exists customer_id uuid references customers on delete cascade;
alter table orders add column if not exists affiliate_id uuid references affiliates on delete set null;
alter table orders add column if not exists quantity int;
alter table orders add column if not exists unit_price numeric(12,2);
alter table orders add column if not exists total numeric(12,2);
alter table orders add column if not exists status text not null default 'pending';
alter table orders add column if not exists payment_method text not null default 'manual';
alter table orders add column if not exists payment_id text;
alter table orders add column if not exists pix_qr_code text;
alter table orders add column if not exists pix_qr_base64 text;
alter table orders add column if not exists expires_at timestamptz;
alter table orders add column if not exists paid_at timestamptz;
alter table orders add column if not exists created_at timestamptz not null default now();
create index if not exists orders_campaign_idx on orders(campaign_id, status);
create index if not exists orders_customer_idx on orders(customer_id);
create index if not exists orders_status_exp_idx on orders(status, expires_at);

-- a chave primária garante que um número nunca é vendido duas vezes
create table if not exists tickets (
  campaign_id uuid not null references campaigns on delete cascade,
  number bigint not null,
  order_id uuid not null references orders on delete cascade,
  customer_id uuid not null references customers on delete cascade,
  primary key (campaign_id, number)
);
-- garante as colunas caso a tabela já existisse numa versão anterior
alter table tickets add column if not exists campaign_id uuid references campaigns on delete cascade;
alter table tickets add column if not exists number bigint;
alter table tickets add column if not exists order_id uuid references orders on delete cascade;
alter table tickets add column if not exists customer_id uuid references customers on delete cascade;
create index if not exists tickets_order_idx on tickets(order_id);

create table if not exists winners (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns on delete set null,
  name text not null,
  campaign_title text,
  prize text,
  ticket_number text,
  draw_date date,
  phone text,
  photo_url text,
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
-- garante as colunas caso a tabela já existisse numa versão anterior
alter table winners add column if not exists campaign_id uuid references campaigns on delete set null;
alter table winners add column if not exists name text;
alter table winners add column if not exists campaign_title text;
alter table winners add column if not exists prize text;
alter table winners add column if not exists ticket_number text;
alter table winners add column if not exists draw_date date;
alter table winners add column if not exists phone text;
alter table winners add column if not exists photo_url text;
alter table winners add column if not exists published boolean not null default true;
alter table winners add column if not exists sort_order int not null default 0;
alter table winners add column if not exists created_at timestamptz not null default now();

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text,
  image_url text,
  published boolean not null default true,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
-- garante as colunas caso a tabela já existisse numa versão anterior
alter table announcements add column if not exists title text;
alter table announcements add column if not exists content text;
alter table announcements add column if not exists image_url text;
alter table announcements add column if not exists published boolean not null default true;
alter table announcements add column if not exists pinned boolean not null default false;
alter table announcements add column if not exists created_at timestamptz not null default now();

-- RLS ligado e SEM policies: a chave pública (anon) não acessa nada.
-- Somente o servidor, com a service_role key, lê e grava.
alter table admins enable row level security;
alter table settings enable row level security;
alter table campaigns enable row level security;
alter table affiliates enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table tickets enable row level security;
alter table winners enable row level security;
alter table announcements enable row level security;
