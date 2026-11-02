-- =====================================================================
-- 0002 - Títulos premiados (números da sorte instantâneos de cada campanha)
-- Cria a tabela se ainda não existir e liga o ganhador ao cliente/pedido reais.
-- Idempotente: preserva os títulos que já foram cadastrados.
-- =====================================================================

create table if not exists prize_titles (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns on delete cascade,
  number bigint not null,
  prize text not null,
  winner_name text,
  customer_id uuid,
  order_id uuid,
  won_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (campaign_id, number)
);
-- garante as colunas caso a tabela já existisse numa versão anterior
alter table prize_titles add column if not exists campaign_id uuid references campaigns on delete cascade;
alter table prize_titles add column if not exists number bigint;
alter table prize_titles add column if not exists prize text;
alter table prize_titles add column if not exists winner_name text;
alter table prize_titles add column if not exists customer_id uuid;
alter table prize_titles add column if not exists order_id uuid;
alter table prize_titles add column if not exists won_at timestamptz;
alter table prize_titles add column if not exists sort_order int not null default 0;
alter table prize_titles add column if not exists created_at timestamptz not null default now();

-- ganhador = comprador real do número (cliente e pedido)
alter table prize_titles drop constraint if exists prize_titles_customer_id_fkey;
alter table prize_titles add constraint prize_titles_customer_id_fkey
  foreign key (customer_id) references customers on delete set null;

alter table prize_titles drop constraint if exists prize_titles_order_id_fkey;
alter table prize_titles add constraint prize_titles_order_id_fkey
  foreign key (order_id) references orders on delete set null;

create index if not exists prize_titles_campaign_idx on prize_titles(campaign_id, sort_order, number);
create index if not exists prize_titles_order_idx on prize_titles(order_id);

alter table prize_titles enable row level security;
