-- 0003 - Checkout por CPF e order bumps
-- Idempotente e sem perda de dados.

-- cliente identificado por CPF + data de nascimento
alter table customers add column if not exists birth_date date;
create index if not exists customers_cpf_idx on customers(cpf);

-- order bumps por campanha: [{ "qty": 10, "price": 4.99, "label": "🚨 10X MAIS CHANCES!!" }]
alter table campaigns add column if not exists order_bumps jsonb not null default '[]'::jsonb;
alter table campaigns add column if not exists order_bumps_title text default '🚨 AUMENTE AS CHANCES DE ACHAR UMA PREMIADA AGORA!';
alter table campaigns add column if not exists order_bumps_subtitle text default 'Quanto mais números, maiores são as suas chances! Acredite 🙏';

-- o que foi comprado em cada pedido (quantidade escolhida + bumps aceitos)
alter table orders add column if not exists base_quantity int;
alter table orders add column if not exists bumps jsonb not null default '[]'::jsonb;

-- texto de aceite exibido no checkout
alter table settings add column if not exists checkout_terms_text text
  default 'Ao efetuar este pagamento e confirmar a compra deste título de capitalização, declaro que li e concordo com os';
