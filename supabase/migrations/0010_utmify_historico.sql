-- 0010 - Histórico de envios do pedido para a Utmify (visível nos detalhes do pedido no admin)
-- Idempotente e sem perda de dados.
alter table orders add column if not exists utmify_log jsonb not null default '[]'::jsonb;
