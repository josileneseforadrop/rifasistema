-- 0007 - Raspadinha (modelo novo) e registro real do resgate do bônus
-- Idempotente e sem perda de dados: valores já configurados são mantidos.

update settings set bonus = '{
  "premio": "NIVUS",
  "carro_b": "POLO",
  "extra": "R$10.000",
  "site": "só o Nivus",
  "simbolo": "BÔNUS",
  "titulo": "Raspe e ache",
  "titulo_destaque": "3 bônus iguais",
  "resultado": "UM BÔNUS",
  "resultado_detalhe": "SÓ POR ESTA PÁGINA",
  "condicao": "toca pra ver o que é",
  "botao_resultado": "VER MEU BÔNUS",
  "chamada": "SEU BÔNUS",
  "escolha": "VOCÊ ESCOLHE",
  "cta": "GARANTIR AGORA",
  "fechar": "mostrar meus números",
  "janelas": ["PERDEU", "SORTE NORMAL", "TENTE DE NOVO", "QUASE", "PERDEU", "SORTE NORMAL"],
  "cor_primaria": "#1fd36b",
  "cor_destaque": "#ffc531",
  "cor_fundo": "#02080a",
  "cor_texto": "#f2fff7",
  "countdown_minutes": 3,
  "min_amount": 20
}'::jsonb || bonus
where id = 1;

-- resgate do bônus: o pedido pago que viu a oferta e a nova compra feita por ela
alter table orders add column if not exists bonus_claimed_at timestamptz;
alter table orders add column if not exists bonus_source_order uuid;
alter table orders add column if not exists bonus_eligible boolean not null default false;
alter table orders drop constraint if exists orders_bonus_source_order_fkey;
alter table orders add constraint orders_bonus_source_order_fkey foreign key (bonus_source_order) references orders on delete set null;
create index if not exists orders_bonus_eligible_idx on orders(bonus_eligible) where bonus_eligible;
