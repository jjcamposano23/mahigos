import { useEffect, useRef } from 'react'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { Bold, Italic, Underline, Heading1, Heading2, List, ListOrdered, Quote } from 'lucide-react'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import type { Doc } from '../../lib/types'

type SaveState = 'idle' | 'saving' | 'saved'

export function DocEditor({
  document: d,
  onSaveState,
}: {
  document: Doc
  onSaveState?: (s: SaveState) => void
}) {
  const { user, profile } = useAuth()
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<number | null>(null)
  const lastWritten = useRef<string>('') // last HTML we saved or applied
  const focused = useRef(false)

  // Load / apply remote content when we're not the editor of record
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Don't stomp the caret while the user is actively editing
    if (focused.current && d.updatedBy === user?.uid) return
    if (d.content !== lastWritten.current && d.content !== el.innerHTML) {
      el.innerHTML = d.content || ''
      lastWritten.current = d.content || ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.content, d.id])

  const save = () => {
    const el = ref.current
    if (!el) return
    const html = el.innerHTML
    if (html === lastWritten.current) return
    lastWritten.current = html
    onSaveState?.('saving')
    void updateDoc(doc(db, 'documents', d.id), {
      content: html,
      updatedBy: user?.uid ?? '',
      updatedByName: profile?.displayName ?? '',
      updatedAt: serverTimestamp(),
    }).then(() => onSaveState?.('saved'))
  }

  const onInput = () => {
    if (timer.current) window.clearTimeout(timer.current)
    onSaveState?.('saving')
    timer.current = window.setTimeout(save, 700)
  }

  const cmd = (command: string, value?: string) => {
    ref.current?.focus()
    document.execCommand(command, false, value)
    onInput()
  }

  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  const Btn = ({
    icon: Icon,
    command,
    value,
    label,
  }: {
    icon: typeof Bold
    command: string
    value?: string
    label: string
  }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => cmd(command, value)}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-ink"
    >
      <Icon size={16} />
    </button>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface px-4 py-1.5">
        <Btn icon={Bold} command="bold" label="Bold" />
        <Btn icon={Italic} command="italic" label="Italic" />
        <Btn icon={Underline} command="underline" label="Underline" />
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn icon={Heading1} command="formatBlock" value="H1" label="Heading 1" />
        <Btn icon={Heading2} command="formatBlock" value="H2" label="Heading 2" />
        <Btn icon={Quote} command="formatBlock" value="BLOCKQUOTE" label="Quote" />
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn icon={List} command="insertUnorderedList" label="Bullet list" />
        <Btn icon={ListOrdered} command="insertOrderedList" label="Numbered list" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-bg">
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          onPaste={onPaste}
          onFocus={() => (focused.current = true)}
          onBlur={() => {
            focused.current = false
            save()
          }}
          data-placeholder="Start writing…"
          className="doc-editor mx-auto min-h-full max-w-3xl px-8 py-8 text-[0.95rem] leading-relaxed text-ink outline-none"
        />
      </div>
    </div>
  )
}
