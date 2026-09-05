import { useRef, useState } from 'react'
import type { MentionTarget } from '../../lib/notifications'

/**
 * A textarea with lightweight @mention autocomplete. Suggestions are drawn
 * from `targets`; selecting one inserts `@handle `.
 */
export function MentionTextarea({
  value,
  onChange,
  targets,
  placeholder,
  rows = 2,
  className = '',
  onSubmitMeta,
}: {
  value: string
  onChange: (v: string) => void
  targets: MentionTarget[]
  placeholder?: string
  rows?: number
  className?: string
  onSubmitMeta?: () => void // called on Cmd/Ctrl+Enter
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [query, setQuery] = useState<string | null>(null)
  const [caret, setCaret] = useState(0)

  const suggestions =
    query !== null
      ? targets.filter((t) => t.handle.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5)
      : []

  const recompute = (text: string, pos: number) => {
    const before = text.slice(0, pos)
    const m = before.match(/@([a-z0-9]*)$/i)
    setQuery(m ? m[1] : null)
    setCaret(pos)
  }

  const insert = (t: MentionTarget) => {
    const el = ref.current
    const pos = el ? el.selectionStart : caret
    const before = value.slice(0, pos).replace(/@([a-z0-9]*)$/i, `@${t.handle} `)
    const after = value.slice(pos)
    const next = before + after
    onChange(next)
    setQuery(null)
    requestAnimationFrame(() => {
      if (el) {
        el.focus()
        el.selectionStart = el.selectionEnd = before.length
      }
    })
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          recompute(e.target.value, e.target.selectionStart)
        }}
        onKeyUp={(e) => recompute((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onSubmitMeta?.()
        }}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        className={className}
      />
      {suggestions.length > 0 && (
        <div className="absolute left-2 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          {suggestions.map((t) => (
            <button
              key={t.uid}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                insert(t)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink transition hover:bg-surface-2"
            >
              <span className="font-semibold text-brand">@{t.handle}</span>
              <span className="truncate text-xs text-muted">{t.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
