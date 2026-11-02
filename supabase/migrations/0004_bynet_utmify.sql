-- 0004 - Gateway Bynet e rastreamento Utmify
-- As credenciais ficam numa tabela separada que NUNCA é enviada ao site público
-- (a tabela settings é pública). Idempotente e sem perda de dados.

create table if not exists integrations (
  id int primary key default 1 check (id = 1),
  public_url text,                                   -- endereço do site, usado no postback do gateway
  bynet_api_key text,
  bynet_base_url text not null default 'https://api-gateway.techbynet.com',
  bynet_user_agent text not null default 'AtivoB2B/1.0',
  bynet_default_email text,                          -- usado quando o cliente não tem e-mail
  bynet_address jsonb not null default '{"street":"Rua não informada","streetNumber":"0","complement":"","zipCode":"01001000","neighborhood":"Centro","city":"São Paulo","state":"SP","country":"BR"}'::jsonb,
  utmify_enabled boolean not null default false,
  utmify_api_token text,
  utmify_platform text,
  utmify_test_mode boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into integrations (id) values (1) on conflict do nothing;
alter table integrations enable row level security;

-- rastreamento de cada pedido (UTMs da URL de entrada) e dados do gateway
alter table orders add column if not exists tracking jsonb not null default '{}'::jsonb;
alter table orders add column if not exists customer_ip text;
alter table orders add column if not exists gateway_fee numeric(12,2);
alter table orders add column if not exists utmify_status text;   -- último status enviado à Utmify

-- Mercado Pago foi removido: quem usava volta para PIX manual até configurar a Bynet
update settings set payment_mode = 'manual' where payment_mode = 'mercadopago';
