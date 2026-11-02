import express, { type NextFunction, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { env } from './env'
import { db } from './db'
import { HttpError } from './http'
import { publicRouter } from './routes/public'
import { adminRouter } from './routes/admin'
import { expireOrders } from './services/orders'
import { runMigrations } from './migrate'
import { renderIndex } from './services/scripts'

const app = express()
app.set('trust proxy', 1)
app.use(express.json({ limit: '2mb' }))

app.use('/api/admin', adminRouter)
app.use('/api', publicRouter)
app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada' }))

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
  if ((err as { code?: string })?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Arquivo muito grande (máx. 100 MB)' })
  console.error(err)
  res.status(500).json({ error: 'Erro interno do servidor' })
})

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

async function bootstrap() {
  // aplica migrations pendentes antes de subir
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('COLE_AQUI')) {
    try {
      await runMigrations()
    } catch (e) {
      console.error(`[migrations] ${(e as Error).message}`)
      process.exit(1)
    }
  } else console.warn('[migrations] DATABASE_URL não definido: migrations não foram aplicadas (rode npm run migrate)')

  // bucket de imagens
  const { data: bucket } = await db.storage.getBucket(env.STORAGE_BUCKET)
  if (!bucket) {
    const { error } = await db.storage.createBucket(env.STORAGE_BUCKET, { public: true })
    if (error) console.warn('[storage] não foi possível criar o bucket:', error.message)
    else console.log(`[storage] bucket "${env.STORAGE_BUCKET}" criado`)
  }

  // primeiro administrador
  const { count, error } = await db.from('admins').select('id', { count: 'exact', head: true })
  if (error) {
    console.error('[db] Erro ao acessar o banco. Você aplicou as migrations (npm run migrate)?', error.message)
    process.exit(1)
  }
  if (!count) {
    if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
      await db.from('admins').insert({
        name: 'Administrador',
        email: env.ADMIN_EMAIL.toLowerCase(),
        password_hash: await bcrypt.hash(env.ADMIN_PASSWORD, 10),
      })
      console.log(`[admin] administrador ${env.ADMIN_EMAIL} criado`)
    } else console.warn('[admin] Nenhum administrador. Defina ADMIN_EMAIL e ADMIN_PASSWORD no .env')
  }

  // libera pedidos vencidos a cada minuto
  setInterval(() => expireOrders().catch((e) => console.error('[expire]', e.message)), 60_000)
  expireOrders().catch(() => undefined)

  app.listen(env.PORT, () => console.log(`Servidor rodando em http://localhost:${env.PORT}`))
}

bootstrap()
