// Servidor local / VPS / Render: API + site compilado + tarefa de expiração
import express, { type Request, type Response } from 'express'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { env } from './env'
import { app, errorHandler } from './app'
import { ensureSetup } from './setup'
import { expireOrders } from './services/orders'
import { runMigrations } from './migrate'
import { renderIndex } from './services/scripts'

// site React compilado (npm run build)
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
if (existsSync(dist)) {
  const index = join(dist, 'index.html')
  // páginas públicas recebem os scripts personalizados direto no HTML; o painel admin não
  const sendIndex = async (req: Request, res: Response) => {
    if (req.path.startsWith('/admin')) return res.sendFile(index)
    res.type('html').send(await renderIndex(index))
  }
  app.get(['/', '/index.html'], (req, res, next) => sendIndex(req, res).catch(next))
  app.use(express.static(dist, { index: false }))
  app.get(/.*/, (req, res, next) => sendIndex(req, res).catch(next))
}
app.use(errorHandler)

async function bootstrap() {
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('COLE_AQUI')) {
    try {
      await runMigrations()
    } catch (e) {
      console.error(`[migrations] ${(e as Error).message}`)
      process.exit(1)
    }
  } else console.warn('[migrations] DATABASE_URL não definido: migrations não foram aplicadas (rode npm run migrate)')

  try {
    await ensureSetup()
  } catch (e) {
    console.error('[db]', (e as Error).message)
    process.exit(1)
  }

  // libera pedidos vencidos a cada minuto
  setInterval(() => expireOrders().catch((e) => console.error('[expire]', e.message)), 60_000)
  expireOrders().catch(() => undefined)

  app.listen(env.PORT, () => console.log(`Servidor rodando em http://localhost:${env.PORT}`))
}

bootstrap()
