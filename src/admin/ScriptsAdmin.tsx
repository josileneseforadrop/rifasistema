import { useEffect, useState } from 'react'
import { adminApi, errorMessage } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { Field, Toggle } from './ui'

interface Script {
  id?: string
  name: string
  code: string
  position: 'head' | 'body'
  enabled: boolean
  sort_order: number
  updated_at?: string
}

const EXAMPLE = `<!-- Cole aqui o código completo, ex.: -->
<script>
  console.log('meu script')
</script>`

function ScriptBlock({ script, onSaved, onRemoved, onMove }: { script: Script; onSaved: (s: Script) => void; onRemoved: () => void; onMove?: (d: -1 | 1) => void }) {
  const [s, setS] = useState(script)
  const [dirty, setDirty] = useState(!script.id)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [open, setOpen] = useState(!script.id)

  const set = <K extends keyof Script>(k: K, v: Script[K]) => {
    setS({ ...s, [k]: v })
    setDirty(true)
  }

  const save = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const body = { name: s.name, code: s.code, position: s.position, enabled: s.enabled }
      const saved = s.id
        ? await adminApi<Script>(`/admin/scripts/${s.id}`, { method: 'PUT', body })
        : await adminApi<Script>('/admin/scripts', { body })
      setS(saved)
      setDirty(false)
      setMsg({ type: 'success', text: 'Script salvo! Já está ativo no site.' })
      onSaved(saved)
    } catch (e) {
      setMsg({ type: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (v: boolean) => {
    if (!s.id) return set('enabled', v)
    setS({ ...s, enabled: v })
    try {
      onSaved(await adminApi<Script>(`/admin/scripts/${s.id}`, { method: 'PUT', body: { enabled: v } }))
    } catch (e) {
      setMsg({ type: 'error', text: errorMessage(e) })
    }
  }

  const remove = async () => {
    if (s.id && !confirm(`Excluir o script "${s.name}"?`)) return
    if (s.id) await adminApi(`/admin/scripts/${s.id}`, { method: 'DELETE' }).catch((e) => setMsg({ type: 'error', text: errorMessage(e) }))
    onRemoved()
  }

  return (
    <div className="card" style={{ opacity: s.enabled ? 1 : 0.6 }}>
      <div className="row">
        <button className="btn ghost sm" onClick={() => setOpen(!open)}>{open ? '▾' : '▸'}</button>
        <b style={{ flex: 1, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
          {s.name || 'Novo script'}{' '}
          <span className="badge draft" style={{ marginLeft: 6 }}>{s.position === 'head' ? '<head>' : 'fim do <body>'}</span>
        </b>
        {onMove && (
          <>
            <button className="btn ghost sm" title="Subir" onClick={() => onMove(-1)}>↑</button>
            <button className="btn ghost sm" title="Descer" onClick={() => onMove(1)}>↓</button>
          </>
        )}
        <Toggle label={s.enabled ? 'Ativo' : 'Desativado'} checked={s.enabled} onChange={toggle} />
      </div>
      {msg && <div className={`alert ${msg.type}`} style={{ marginTop: 10 }}>{msg.text}</div>}
      {open && (
        <div style={{ marginTop: 12 }}>
          <div className="grid2">
            <Field label="Nome (só para você identificar)">
              <input value={s.name} placeholder="Ex.: Pixel TikTok, Verificação Google, Hotjar" onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Onde inserir">
              <select value={s.position} onChange={(e) => set('position', e.target.value as Script['position'])}>
                <option value="head">No &lt;head&gt; (pixels, verificação de domínio, tags)</option>
                <option value="body">No fim do &lt;body&gt; (chat, widgets)</option>
              </select>
            </Field>
          </div>
          <Field label="Código" hint="Cole o código completo com as tags (<script>, <meta>, <noscript>...). Se colar só JavaScript, ele é envolvido em <script> automaticamente.">
            <textarea
              spellCheck={false}
              style={{ minHeight: 220, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }}
              placeholder={EXAMPLE}
              value={s.code}
              onChange={(e) => set('code', e.target.value)}
            />
          </Field>
          <div className="row">
            <button className="btn" disabled={busy || !dirty} onClick={save}>{busy ? 'Salvando...' : s.id ? 'Salvar alterações' : 'Salvar script'}</button>
            <button className="btn danger" disabled={busy} onClick={remove}>{s.id ? 'Excluir' : 'Cancelar'}</button>
            <span className="spacer" />
            {s.updated_at && <small className="muted">Atualizado em {formatDateTime(s.updated_at)}</small>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ScriptsAdmin() {
  const [list, setList] = useState<Script[] | null>(null)
  const [error, setError] = useState('')
  const [keys, setKeys] = useState<string[]>([])

  useEffect(() => {
    adminApi<Script[]>('/admin/scripts')
      .then((l) => {
        setList(l)
        setKeys(l.map((s) => s.id!))
      })
      .catch((e) => setError(errorMessage(e)))
  }, [])

  const add = () => {
    const key = `new-${Date.now()}`
    setList([...(list ?? []), { name: '', code: '', position: 'head', enabled: true, sort_order: list?.length ?? 0 }])
    setKeys([...keys, key])
  }

  const move = async (i: number, d: -1 | 1) => {
    if (!list) return
    const j = i + d
    if (j < 0 || j >= list.length || !list[i].id || !list[j].id) return
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    const nextKeys = [...keys]
    ;[nextKeys[i], nextKeys[j]] = [nextKeys[j], nextKeys[i]]
    setList(next)
    setKeys(nextKeys)
    await Promise.all(next.map((s, k) => s.id && adminApi(`/admin/scripts/${s.id}`, { method: 'PUT', body: { sort_order: k } }))).catch((e) =>
      setError(errorMessage(e)),
    )
  }

  if (error) return <div className="alert error">{error}</div>
  if (!list) return <div className="spinner" />

  return (
    <>
      <div className="alert info">
        Cada bloco é um script. Eles são inseridos em todas as páginas do site público, na ordem abaixo, direto no HTML (funciona para verificação de domínio
        do Meta/Google). Não são carregados no painel admin.
      </div>
      {list.length === 0 && <div className="card center muted">Nenhum script adicionado.</div>}
      {list.map((s, i) => (
        <ScriptBlock
          key={keys[i]}
          script={s}
          onMove={s.id && list.length > 1 ? (d) => move(i, d) : undefined}
          onSaved={(saved) => {
            setList((l) => l!.map((x, k) => (k === i ? saved : x)))
          }}
          onRemoved={() => {
            setList((l) => l!.filter((_, k) => k !== i))
            setKeys((ks) => ks.filter((_, k) => k !== i))
          }}
        />
      ))}
      <button className="btn" onClick={add}>+ Adicionar script</button>
    </>
  )
}
