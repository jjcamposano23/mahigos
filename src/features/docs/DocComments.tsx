import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { X, Check, Trash2, Quote as QuoteIcon } from 'lucide-react'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { Avatar } from '../../components/Avatar'
import type { DocComment, UserProfile } from '../../lib/types'

function ago(ms?: number) {
  if (!ms) return ''
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(ms).toLocaleDateString()
}

export function DocComments({
  docId,
  memberMap,
  onClose,
}: {
  docId: string
  memberMap: Record<string, UserProfile>
  onClose: () => void
}) {
  const { user, profile } = useAuth()
  const [comments, setComments] = useState<DocComment[]>([])
  const [text, setText] = useState('')
  const [quote, setQuote] = useState('')

  useEffect(() => {
    return onSnapshot(collection(db, 'documents', docId, 'comments'), (snap) =>
      setComments(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<DocComment, 'id'>) }))
          .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)),
      ),
    )
  }, [docId])

  const grabSelection = () => {
    const s = window.getSelection()?.toString().trim() ?? ''
    setQuote(s.slice(0, 240))
  }

  const add = async () => {
    if (!text.trim()) return
    await addDoc(collection(db, 'documents', docId, 'comments'), {
      text: text.trim(),
      quote: quote || null,
      authorUid: user?.uid ?? '',
      authorName: profile?.displayName ?? 'Member',
      authorAvatar: profile?.avatar ?? null,
      resolved: false,
      createdAt: serverTimestamp(),
    })
    setText('')
    setQuote('')
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-display text-base font-bold text-ink">Comments</h3>
        <button onClick={onClose} className="text-muted hover:text-ink">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {comments.length === 0 && (
          <p className="pt-6 text-center text-sm text-muted">No comments yet.</p>
        )}
        {comments.map((c) => (
          <div
            key={c.id}
            className={`rounded-lg border border-border p-3 ${c.resolved ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center gap-2">
              <Avatar
                profile={memberMap[c.authorUid] ?? { displayName: c.authorName, avatar: c.authorAvatar ?? undefined }}
                size={22}
                rounded="rounded-full"
              />
              <span className="text-xs font-semibold text-ink">{c.authorName}</span>
              <span className="text-[0.65rem] text-muted">{ago(c.createdAt?.toMillis?.())}</span>
              <div className="flex-1" />
              <button
                onClick={() => updateDoc(doc(db, 'documents', docId, 'comments', c.id), { resolved: !c.resolved })}
                title={c.resolved ? 'Reopen' : 'Resolve'}
                className={`transition ${c.resolved ? 'text-ok' : 'text-muted hover:text-ok'}`}
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => deleteDoc(doc(db, 'documents', docId, 'comments', c.id))}
                className="text-muted transition hover:text-brand"
              >
                <Trash2 size={13} />
              </button>
            </div>
            {c.quote && (
              <div className="mt-1.5 border-l-2 border-brand/50 pl-2 text-xs italic text-muted">
                “{c.quote}”
              </div>
            )}
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink">{c.text}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-border p-3">
        {quote && (
          <div className="mb-2 flex items-start gap-1.5 rounded-md bg-surface-2 px-2 py-1 text-xs text-muted">
            <QuoteIcon size={12} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2 flex-1">{quote}</span>
            <button onClick={() => setQuote('')} className="hover:text-brand">
              <X size={12} />
            </button>
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
          className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={grabSelection}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted transition hover:border-brand/40 hover:text-brand"
          >
            <QuoteIcon size={12} /> Quote selection
          </button>
          <div className="flex-1" />
          <button
            onClick={add}
            disabled={!text.trim()}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-ink disabled:opacity-40"
          >
            Comment
          </button>
        </div>
      </div>
    </aside>
  )
}
