# Sistema de Rifas — React + Node + Supabase

Site público de campanhas (rifas) com painel administrativo completo.

**Arquitetura:** o Supabase é usado **apenas para armazenar dados** (tabelas e imagens). Não há nenhuma função, gatilho ou regra no banco.
Toda a lógica (reserva de números, pagamentos, expiração, prêmios, login do admin) está no servidor Node em `server/`.
O navegador nunca acessa o banco diretamente: fala só com a API do servidor.

## Funcionalidades

**Site público**
- Home com campanha em destaque + lista de campanhas + ganhadores
- Menu em tela cheia: Início, Campanhas, Comunicados, Meus títulos, Cadastro, Ganhadores, Afiliados, Termos de uso, Suporte, Entrar
- Página da campanha: galeria, "Meus títulos", barra de progresso, preço, pacotes promocionais, caixa de destaque com contagem regressiva, botões +5/+10 ("Mais popular"), seletor de quantidade, "Quero participar", regulamento, títulos premiados (Mostrar Mais), botões de compartilhar, botão flutuante do grupo de WhatsApp
- Cadastro/login do cliente pelo telefone
- Pagamento PIX: **manual** (QR Code gerado com sua chave + confirmação no admin) ou **Bynet** (confirmação automática por postback)
- Rastreamento de vendas na **Utmify** (UTMs da URL de entrada) e Pixel da Meta / Google Analytics
- Números aleatórios únicos reservados na compra; o pedido expira se não for pago e os números voltam a ficar disponíveis
- Títulos premiados instantâneos: quem compra o número ganha na hora
- Programa de afiliados com link `?ref=CODIGO`
- Banner "Instalar o APP" (PWA), Pixel da Meta e Google Analytics

**Painel admin (`/admin`)**
- Dashboard com faturamento, gráfico de 14 dias e progresso de cada campanha
- Campanhas: criar, editar, duplicar e excluir. Tudo configurável: título, subtítulo, selo, status, imagens, preço, quantidade de números, número inicial, dígitos, mínimo/máximo por compra, limite por cliente, botões rápidos, pacotes promocionais, destaque, regulamento, data e resultado do sorteio, títulos premiados (manual ou gerados aleatoriamente)
- Pedidos: filtros, busca, detalhes, confirmar pagamento, cancelar, exportar CSV
- Clientes: busca, edição, histórico de pedidos
- Sorteio: consulta o dono de um número (## Instalação

### 1. Supabase (só armazenamento)
1. Crie um projeto em https://supabase.com
2. Em **Project Settings → API** copie a **Project URL** e a chave **service_role** (secreta)
3. Em **Connect → Session pooler** copie a connection string (URI) e troque `[YOUR-PASSWORD]` pela senha do banco

### 2. Arquivo `.env`
Abra o arquivo `.env` na raiz do projeto e preencha:

| Variável | O que colocar |
|---|---|
| `SUPABASE_URL` | Project URL do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | chave **service_role** (não a anon) |
| `DATABASE_URL` | connection string do Postgres (usada só para aplicar as migrations) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | login do primeiro administrador (criado ao iniciar o servidor) |
| `JWT_SECRET` | já vem gerado — não compartilhe |
| `PUBLIC_URL` | opcional, endereço público do site (também pode ser definido no painel) |

O bucket de imagens `media` é criado automaticamente na primeira execução.

### Migrations (estrutura do banco)
As tabelas são criadas e atualizadas por arquivos numerados em `supabase/migrations/`.
O servidor aplica as pendentes automaticamente ao iniciar; também dá para rodar manualmente:
```bash
npm run migrate                  # aplica as migrations pendentes
npm run migrate status           # mostra aplicadas e pendentes
npm run migrate new nome_da_mudanca   # cria o próximo arquivo (ex.: 0003_nome_da_mudanca.sql)
```
- Cada migration roda **uma única vez** (o controle fica na tabela `schema_migrations`) e dentro de uma transação: se der erro, nada dela é aplicado
- As migrations nunca apagam dados. As existentes usam `if not exists` e completam colunas que faltarem em tabelas antigas
- **Nunca edite uma migration já aplicada** — para mudar algo, crie uma nova com `npm run migrate new`

### 3. Rodar
```bash
npm install
npm run dev      # site em http://localhost:5173 · admin em /admin · API em :3001
```

### 4. Produção
```bash
npm run build
npm start        # serve o site e a API na porta PORT (padrão 3001)
```
Hospede em qualquer serviço que rode Node (VPS, Render, Railway, Fly.io...). Rode **uma única instância** do servidor:
as compras de uma mesma campanha são processadas em fila dentro do processo para manter os contadores corretos.
(Mesmo assim, a chave primária da tabela `tickets` impede que um número seja vendido duas vezes.)

### Gateway Bynet (PIX automático)
1. Em **Admin → Configurações → Pagamento** escolha "Bynet"
2. Cole a **API Key**, informe o **endereço do site** (para o postback) e o endereço/e-mail padrão do comprador (exigidos pela API)
3. Clique em **Testar conexão** e depois em **Salvar**

O postback é `https://SEU-SITE/api/webhooks/bynet`. O servidor nunca confia no conteúdo do postback: consulta a transação
na API da Bynet antes de liberar os títulos. Estornos/chargebacks informados pela Bynet cancelam o pedido e liberam os números.

### Utmify (rastreamento)
Em **Admin → Configurações → Rastreamento** ative a Utmify, cole o token da API e clique em **Enviar pedido de teste**.
As UTMs (`utm_source`, `utm_campaign`, `utm_medium`, `utm_content`, `utm_term`, `src`, `sck`) da URL em que o cliente
chegou são guardadas e enviadas com o pedido: ao gerar o PIX, ao pagar e ao estornar.

As credenciais ficam na tabela `integrations`, que nunca é enviada ao site público; no painel elas aparecem mascaradas.

## Estrutura
```
server/
  index.ts            servidor Express (API + site compilado)
  routes/public.ts    API pública (campanhas, cadastro, pedidos, PIX, afiliados, webhook)
  routes/admin.ts     API do painel (login JWT, CRUDs, dashboard, upload, sorteio)
  services/orders.ts  reserva de números, pagamento, expiração, cancelamento, prêmios
  services/payments.ts PIX manual e Bynet
  services/bynet.ts    cliente da API Bynet
  services/utmify.ts   envio de vendas para a Utmify
src/                  frontend React (pages, components, admin)
supabase/migrations/  estrutura do banco (apenas tabelas), aplicada em ordem
server/migrate.ts     executor das migrations
.env                  configurações e chaves (não versionar)
```

## Segurança
- O RLS fica ligado **sem nenhuma policy**: a chave pública do Supabase não lê nem grava nada. Só o servidor (service_role) acessa
- A chave service_role fica só no `.env` do servidor, nunca vai para o navegador
- Senhas dos administradores com bcrypt; sessão via JWT (7 dias)
- Limite de requisições por IP nas rotas públicas e no login
- O postback da Bynet não é confiado: o status é sempre conferido na API da Bynet

o usa funções controladas (`create_order`, `get_order`, `get_customer_orders`...)
- A reserva de números trava a campanha durante a compra; não existem números duplicados

## Aviso legal
Sorteios e rifas no Brasil precisam de autorização (ex.: SPA/MF ou título de capitalização/filantropia com alvará). Antes de operar, verifique a regulamentação aplicável à sua campanha.
