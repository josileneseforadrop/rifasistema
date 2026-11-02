import { api } from './api'

/**
 * Em produção o servidor já insere os scripts no HTML. Em desenvolvimento (Vite)
 * eles são carregados aqui. Nunca roda no painel admin.
 */
export async function loadCustomScripts() {
  if (document.querySelector('meta[name="custom-scripts"]')) return
  if (location.pathname.startsWith('/admin')) return
  const list = await api<{ id: string; code: string; position: 'head' | 'body' }[]>('/scripts').catch(() => [])
  for (const s of list) {
    try {
      // createContextualFragment executa as tags <script> (innerHTML não executaria)
      const frag = document.createRange().createContextualFragment(s.code)
      ;(s.position === 'head' ? document.head : document.body).appendChild(frag)
    } catch (e) {
      console.error('[script personalizado]', e)
    }
  }
}
