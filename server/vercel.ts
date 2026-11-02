// Entrada da função serverless do Vercel (gerada por scripts/build-vercel.mjs)
import type { IncomingMessage, ServerResponse } from 'http'
import { app, errorHandler } from './app'
import { ensureSetup } from './setup'

app.use(errorHandler)

// prepara bucket e primeiro admin uma vez por instância (sem travar as requisições se falhar)
let setup: Promise<void> | null = null

export default async function handler(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  setup ??= ensureSetup().catch((e) => {
    console.error('[setup]', e.message)
    setup = null
  })
  await setup
  // a rota do Vercel manda /api/<caminho> como /api?__p=<caminho>: restaura a URL original
  const u = new URL(req.url ?? '/', 'http://x')
  const p = u.searchParams.get('__p')
  if (p !== null) {
    u.searchParams.delete('__p')
    const qs = u.searchParams.toString()
    req.url = `/api/${p}${qs ? `?${qs}` : ''}`
  }
  return app(req as never, res as never)
}
