-- 0006 - Raspadinha pós-pagamento e página de bônus (com vídeo)
-- Idempotente e sem perda de dados.

alter table settings add column if not exists bonus jsonb not null default '{
  "enabled": false,
  "scratch_title": "RASPE E ACHE|3 BÔNUS",
  "scratch_highlight": "IGUAIS",
  "unlock_kicker": "VOCÊ DESBLOQUEOU",
  "unlock_title": "UM BÔNUS",
  "unlock_subtitle": "SÓ POR ESTA PÁGINA",
  "unlock_hint": "toca pra ver o que é",
  "unlock_button": "VER MEU BÔNUS",
  "video_url": null,
  "video_poster": null,
  "badge": "PRA VOCÊ",
  "ticker": "BÔNUS ✦ NIVUS OU POLO + R$10.000",
  "eyebrow": "SEU BÔNUS",
  "kicker": "VOCÊ ESCOLHE",
  "headline": "NIVUS OU POLO",
  "subheadline": "+ R$10.000",
  "description": "válido se a próxima cota premiada sair pra você - fezinha acima de R$20 por aqui",
  "step1": "Fezinha por esta página **acima de R$20**",
  "step2": "Saiu a ==próxima cota premiada== pra você? Bônus: escolhe **Nivus ou Polo + R$10.000**",
  "step2_note": "no site: só o Nivus, sem bônus",
  "rules": "",
  "countdown_minutes": 3,
  "cta_text": "GARANTIR AGORA",
  "cta_campaign_slug": null,
  "min_amount": 20
}'::jsonb;
