import { useRef, useState, type ReactNode } from 'react'
import { errorMessage, uploadImage } from '../lib/api'

export function Modal({ title, onClose, children, large }: { title: string; onClose: () => void; children: ReactNode; large?: boolean }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className={`modal ${large ? 'lg' : ''}`} onClick={(e) => e.stopPropagation()} style={{ background: '#181d27', color: '#e5e7eb' }}>
        <button className="x" onClick={onClose}>✕</button>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  )
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function useUploader(folder: string) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const upload = async (files: FileList | null): Promise<string[]> => {
    if (!files?.length) return []
    setBusy(true)
    setErr('')
    try {
      const urls: string[] = []
      for (const f of Array.from(files)) urls.push(await uploadImage(f, folder))
      return urls
    } catch (e) {
      setErr(errorMessage(e))
      return []
    } finally {
      setBusy(false)
    }
  }
  return { busy, err, upload }
}

/** Upload de uma única imagem (ou URL manual). */
export function ImageInput({ value, onChange, folder = 'uploads' }: { value: string | null; onChange: (v: string | null) => void; folder?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const { busy, err, upload } = useUploader(folder)
  return (
    <div>
      <div className="img-list">
        {value && (
          <div className="img-item">
            <img src={value} alt="" />
            <div className="acts">
              <span />
              <button type="button" onClick={() => onChange(null)}>Remover</button>
            </div>
          </div>
        )}
        <div className="upload-box" onClick={() => ref.current?.click()}>
          {busy ? 'Enviando...' : value ? 'Trocar imagem' : '+ Enviar imagem'}
        </div>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const [url] = await upload(e.target.files)
          if (url) onChange(url)
          e.target.value = ''
        }}
      />
      <input className="input" style={{ marginTop: 8 }} placeholder="ou cole a URL da imagem" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
      {err && <div className="alert error" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  )
}

/** Upload de várias imagens com reordenação. */
export function ImagesInput({ value, onChange, folder = 'uploads' }: { value: string[]; onChange: (v: string[]) => void; folder?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const { busy, err, upload } = useUploader(folder)
  const move = (i: number, d: number) => {
    const arr = [...value]
    const j = i + d
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    onChange(arr)
  }
  return (
    <div>
      <div className="img-list">
        {value.map((url, i) => (
          <div key={url + i} className="img-item">
            <img src={url} alt="" />
            <div className="acts">
              <button type="button" onClick={() => move(i, -1)}>◀</button>
              <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))}>✕</button>
              <button type="button" onClick={() => move(i, 1)}>▶</button>
            </div>
          </div>
        ))}
        <div className="upload-box" onClick={() => ref.current?.click()}>{busy ? 'Enviando...' : '+ Adicionar imagens'}</div>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          const urls = await upload(e.target.files)
          if (urls.length) onChange([...value, ...urls])
          e.target.value = ''
        }}
      />
      {err && <div className="alert error" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  )
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="pagination">
      <span className="muted">{total} registro(s)</span>
      <button className="btn ghost sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</button>
      <span>{page} / {pages}</span>
      <button className="btn ghost sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Próxima</button>
    </div>
  )
}

/** Upload de vídeo (MP4/WebM/MOV) com prévia. */
export function VideoInput({ value, onChange, folder = 'videos' }: { value: string | null; onChange: (v: string | null) => void; folder?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const { busy, err, upload } = useUploader(folder)
  return (
    <div>
      {value ? (
        <div style={{ maxWidth: 320 }}>
          <video src={value} controls muted playsInline style={{ width: '100%', borderRadius: 10, background: '#000' }} />
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Enviando...' : 'Trocar vídeo'}</button>
            <button type="button" className="btn danger sm" onClick={() => onChange(null)}>Remover</button>
          </div>
        </div>
      ) : (
        <div className="upload-box" style={{ width: 220, height: 120 }} onClick={() => ref.current?.click()}>
          {busy ? 'Enviando vídeo... (pode levar alguns minutos)' : '+ Enviar vídeo (MP4, até 100 MB)'}
        </div>
      )}
      <input
        ref={ref}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        hidden
        onChange={async (e) => {
          const [url] = await upload(e.target.files)
          if (url) onChange(url)
          e.target.value = ''
        }}
      />
      <input className="input" style={{ marginTop: 8 }} placeholder="ou cole a URL do vídeo (.mp4)" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
      {err && <div className="alert error" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  )
}
