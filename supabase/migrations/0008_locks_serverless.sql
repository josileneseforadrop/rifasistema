-- 0008 - Trava entre instâncias (Vercel/serverless): operações da mesma campanha rodam uma de cada vez.
-- Apenas uma tabela; a lógica fica no servidor (server/lock.ts). Idempotente.
create table if not exists locks (
  key text primary key,
  token uuid not null,
  expires_at timestamptz not null
);
alter table locks enable row level security;
