import type { NextFunction, Request, RequestHandler, Response } from 'express'

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export const fail = (status: number, message: string): never => {
  throw new HttpError(status, message)
}

/** Encapsula handlers async repassando erros para o Express. */
export const h =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next: NextFunction) => {
    fn(req, res)
      .then((data) => {
        if (!res.headersSent) res.json(data ?? null)
      })
      .catch(next)
  }

/** Limite simples de requisições por IP (em memória). */
export function rateLimit(max: number, windowMs: number): RequestHandler {
  const hits = new Map<string, { n: number; reset: number }>()
  return (req, res, next) => {
    const key = req.ip ?? 'x'
    const now = Date.now()
    const e = hits.get(key)
    if (!e || e.reset < now) hits.set(key, { n: 1, reset: now + windowMs })
    else if (++e.n > max) return res.status(429).json({ error: 'Muitas requisições. Aguarde um instante.' })
    if (hits.size > 50000) hits.clear()
    next()
  }
}
