// Aplicação Express (rotas da API). Usada pelo servidor local (index.ts) e pela função do Vercel (vercel.ts).
import express, { type NextFunction, type Request, type Response } from 'express'
import { HttpError } from './http'
import { publicRouter } from './routes/public'
import { adminRouter } from './routes/admin'

export const app = express()
app.set('trust proxy', 1)
app.use(express.json({ limit: '2mb' }))

app.use('/api/admin', adminRouter)
app.use('/api', publicRouter)
app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada' }))

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) { // eslint-disable-line @typescript-eslint/no-unused-vars
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
  if ((err as { code?: string })?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Arquivo muito grande (máx. 100 MB)' })
  console.error(err)
  res.status(500).json({ error: (err as Error)?.message?.startsWith('[config]') ? (err as Error).message : 'Erro interno do servidor' })
}
