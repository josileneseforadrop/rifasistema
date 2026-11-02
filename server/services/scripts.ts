import { readFile, stat } from 'fs/promises'
import { db, must } from '../db'

export interface CustomScript {
  id: string
  name: string
  code: string
  position: 'head' | 'body'
  enabled: boolean
  sort_order: number
}

let cache: { at: number; list: CustomScript[] } | null = null

export async function enabledScripts(): Promise<CustomScript[]> {
  if (cache && cache.at > Date.now() - 30_000) return cache.list
  const list = must<CustomScript[]>(
    await db.from('custom_scripts').select('*').eq('enabled', true).order('sort_order').order('created_at'),
  )
  cache = { at: Date.now(), list }
  return list
}

export const clearScriptsCache = () => {
  cache = null
}

/** Código colado sem tags (só JavaScript) é envolvido em <script>. */
export const normalizeCode = (code: string) => (code.trim().startsWith('<') ? code.trim() : `<script>\n${code.trim()}\n</script>`)

const block = (list: CustomScript[], pos: 'head' | 'body') =>
  list
    .filter((s) => s.position === pos)
    .map((s) => `<!-- script: ${s.name.replace(/--/g, '')} -->\n${normalizeCode(s.code)}`)
    .join('\n')

let template: { mtime: number; html: string } | null = null

/** index.html do site com os scripts já inseridos (produção). */
export async function renderIndex(indexPath: string) {
  const st = await stat(indexPath)
  if (!template || template.mtime !== st.mtimeMs) template = { mtime: st.mtimeMs, html: await readFile(indexPath, 'utf8') }
  let list: CustomScript[] = []
  try {
    list = await enabledScripts()
  } catch (e) {
    console.error('[scripts]', (e as Error).message)
  }
  const marker = '<meta name="custom-scripts" content="server" />'
  return template.html
    .replace('</head>', `${marker}\n${block(list, 'head')}\n</head>`)
    .replace('</body>', `${block(list, 'body')}\n</body>`)
}
