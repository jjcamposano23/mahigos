import { useRef, useState } from 'react'
import { Send, Mic, Square, Loader2 } from 'lucide-react'
import type { MentionTarget } from '../../lib/notifications'

export function Composer({
  placeholder = 'Write a message…',
  onSendText,
  onSendClip,
  targets = [],
}: {
  placeholder?: string
  onSendText: (text: string) => Promise<void> | void
  onSendClip: (blob: Blob) => Promise<void>
  targets?: MentionTarget[]
}) {
  const [text, setText] = useState('')
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mq, setMq] = useState<string | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const suggestions =
    mq !== null
      ? targets.filter((t) => t.handle.toLowerCase().startsWith(mq.toLowerCase())).slice(0, 5)
      : []
  const recompute = (val: string, pos: number) => {
    const m = val.slice(0, pos).match(/@([a-z0-9]*)$/i)
    setMq(m ? m[1] : null)
  }
  const insertMention = (handle: string) => {
    const el = taRef.current
    const pos = el ? el.selectionStart : text.length
    const before = text.slice(0, pos).replace(/@([a-z0-9]*)$/i, `@${handle} `)
    const nv = before + text.slice(pos)
    setText(nv)
    setMq(null)
    requestAnimationFrame(() => {
      if (el) {
        el.focus()
        el.selectionStart = el.selectionEnd = before.length
      }
    })
  }

  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const send = async () => {
    const t = text.trim()
    if (!t) return
    setText('')
    await onSendText(t)
  }

  const startRec = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data)
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        setBusy(true)
        try {
          await onSendClip(blob)
        } catch {
          setError('Could not send the voice clip.')
        } finally {
          setBusy(false)
        }
      }
      rec.start()
      recRef.current = rec
      setRecording(true)
      setSeconds(0)
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      setError('Microphone access was blocked.')
    }
  }

  const stopRec = () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    setRecording(false)
    recRef.current?.stop()
  }

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <div className="border-t border-border bg-surface p-3">
      {error && <div className="mb-2 px-1 text-xs text-brand">{error}</div>}
      <div className="flex items-end gap-2">
        {recording ? (
          <div className="flex flex-1 items-center gap-3 rounded-lg border border-brand/40 bg-brand-soft px-3 py-2.5">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand" />
            <span className="text-sm font-medium text-brand-ink">Recording… {mmss}</span>
            <div className="flex-1" />
            <button
              onClick={stopRec}
              className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white"
            >
              <Square size={14} /> Stop &amp; send
            </button>
          </div>
        ) : (
          <>
            <div className="relative flex-1">
              {suggestions.length > 0 && (
                <div className="absolute bottom-full left-0 z-30 mb-1 w-52 overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
                  {suggestions.map((t) => (
                    <button
                      key={t.uid}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); insertMention(t.handle) }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink transition hover:bg-surface-2"
                    >
                      <span className="font-semibold text-brand">@{t.handle}</span>
                      <span className="truncate text-xs text-muted">{t.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <textarea
                ref={taRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  recompute(e.target.value, e.target.selectionStart)
                }}
                onKeyUp={(e) => recompute(e.currentTarget.value, e.currentTarget.selectionStart)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && suggestions.length === 0) {
                    e.preventDefault()
                    send()
                  }
                }}
                onBlur={() => setTimeout(() => setMq(null), 150)}
                placeholder={placeholder}
                rows={1}
                disabled={busy}
                className="max-h-32 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
              />
            </div>
            <button
              onClick={startRec}
              disabled={busy}
              title="Record a voice clip"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border text-muted transition hover:border-brand/40 hover:text-brand disabled:opacity-60"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
            </button>
            <button
              onClick={send}
              disabled={busy || !text.trim()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand text-white transition hover:bg-brand-ink disabled:opacity-40"
            >
              <Send size={17} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
