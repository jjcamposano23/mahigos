import { useEffect, useRef } from 'react'
import { MessageSquare } from 'lucide-react'
import { Avatar } from '../../components/Avatar'
import type { Message, UserProfile } from '../../lib/types'

function timeOf(m: Message): number {
  return m.createdAt?.toMillis?.() ?? 0
}
function hhmm(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
function dayLabel(ms: number) {
  const d = new Date(ms)
  const today = new Date()
  const yest = new Date()
  yest.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

export function MessageList({
  messages,
  memberMap,
  onOpenThread,
  showThreads = true,
}: {
  messages: Message[]
  memberMap: Record<string, UserProfile>
  onOpenThread?: (m: Message) => void
  showThreads?: boolean
}) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  return (
    <div className="flex-1 space-y-0.5 overflow-y-auto px-4 py-4">
      {messages.length === 0 && (
        <div className="grid h-full place-items-center text-center text-sm text-muted">
          <div>
            <MessageSquare size={28} className="mx-auto mb-2 text-brand/40" />
            No messages yet. Say hello 👋
          </div>
        </div>
      )}

      {messages.map((m, i) => {
        const prev = messages[i - 1]
        const t = timeOf(m)
        const newDay = !prev || dayLabel(timeOf(prev)) !== dayLabel(t)
        const grouped =
          !newDay && prev && prev.authorUid === m.authorUid && t - timeOf(prev) < 5 * 60_000
        const author = memberMap[m.authorUid]

        return (
          <div key={m.id}>
            {newDay && (
              <div className="my-3 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
                  {dayLabel(t)}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}

            <div className={`group flex gap-3 rounded-lg px-2 hover:bg-surface-2/60 ${grouped ? 'py-0.5' : 'pt-2 pb-0.5'}`}>
              <div className="w-9 shrink-0">
                {!grouped && (
                  <Avatar
                    profile={author ?? { displayName: m.authorName, avatar: m.authorAvatar ?? undefined, photoURL: m.authorPhotoURL ?? undefined }}
                    size={36}
                    rounded="rounded-lg"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                {!grouped && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-ink">{m.authorName}</span>
                    <span className="text-[0.68rem] text-muted">{hhmm(t)}</span>
                  </div>
                )}

                {m.text && <p className="whitespace-pre-wrap break-words text-sm text-ink">{m.text}</p>}

                {m.clipUrl && m.clipType === 'audio' && (
                  <audio controls src={m.clipUrl} className="mt-1 h-9 w-full max-w-xs" />
                )}
                {m.clipUrl && m.clipType === 'video' && (
                  <video controls src={m.clipUrl} className="mt-1 max-h-60 max-w-xs rounded-lg" />
                )}

                {showThreads && (
                  <div className="mt-0.5 flex items-center gap-2">
                    {(m.replyCount ?? 0) > 0 ? (
                      <button
                        onClick={() => onOpenThread?.(m)}
                        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-brand transition hover:bg-brand-soft"
                      >
                        <MessageSquare size={12} />
                        {m.replyCount} {m.replyCount === 1 ? 'reply' : 'replies'}
                      </button>
                    ) : (
                      <button
                        onClick={() => onOpenThread?.(m)}
                        className="flex items-center gap-1 text-xs text-muted opacity-0 transition hover:text-brand group-hover:opacity-100"
                      >
                        <MessageSquare size={12} /> Reply in thread
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
