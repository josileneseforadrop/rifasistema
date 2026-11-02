-- 0009 - Ganhador de título premiado lançado manualmente (só o nome), com registro de quem lançou
-- Idempotente e sem perda de dados.
alter table prize_titles add column if not exists winner_manual boolean not null default false;
alter table prize_titles add column if not exists winner_set_by text;
