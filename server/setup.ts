// Preparação do ambiente: bucket de imagens e primeiro administrador (idempotente)
import bcrypt from 'bcryptjs'
import { db } from './db'
import { env } from './env'

export async function ensureSetup() {
  const { data: bucket } = await db.storage.getBucket(env.STORAGE_BUCKET)
  if (!bucket) {
    const { error } = await db.storage.createBucket(env.STORAGE_BUCKET, { public: true })
    if (error) console.warn('[storage] não foi possível criar o bucket:', error.message)
    else console.log(`[storage] bucket "${env.STORAGE_BUCKET}" criado`)
  }

  const { count, error } = await db.from('admins').select('id', { count: 'exact', head: true })
  if (error) throw new Error(`Erro ao acessar o banco. Você aplicou as migrations (npm run migrate)? ${error.message}`)
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
}
