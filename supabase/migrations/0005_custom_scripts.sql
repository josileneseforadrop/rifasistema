-- 0005 - Scripts personalizados (inseridos no <head> ou no fim do <body> do site público)
-- Idempotente e sem perda de dados.

create table if not exists custom_scripts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  position text not null default 'head' check (position in ('head', 'body')),
  enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists custom_scripts_order_idx on custom_scripts(enabled, position, sort_order);
alter table custom_scripts enable row level security;
