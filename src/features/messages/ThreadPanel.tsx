import { X } from 'lucide-react'
import { Avatar } from '../../components/Avatar'
import type { Message, UserProfile } from '../../lib/types'
import { MessageList } from './MessageList'
import { Composer } from './Composer'

function hhmm(m: Message) {
  const ms = m.createdAt?.toMillis?.() ?? 0
  return ms ? new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''
}

export function ThreadPanel({
  root,
  replies,
  memberMap,
  currentUid,
  onClose,
  onSendText,
  onSendClip,
  onEdit,
  onDelete,
}: {
  root: Message
  replies: Message[]
  memberMap: Record<string, UserProfile>
  currentUid?: string
  onClose: () => void
  onSendText: (text: string) => Promise<void>
  onSendClip: (blob: Blob) => Promise<void>
  onEdit?: (id: string, text: string) => void
  onDelete?: (m: Message) => void
}) {
  const author = memberMap[root.authorUid]
  return (
    <aside className="flex w-full max-w-sm shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-display text-base font-bold text-ink">Thread</h3>
        <button onClick={onClose} className="text-muted hover:text-ink">
          <X size={18} />
        </button>
      </div>

      {/* root message */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex gap-3">
          <Avatar
            profile={author ?? { displayName: root.authorName, avatar: root.authorAvatar ?? undefined }}
            size={36}
            rounded="rounded-lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-ink">{root.authorName}</span>
              <span className="text-[0.68rem] text-muted">{hhmm(root)}</span>
            </div>
            {root.text && <p className="whitespace-pre-wrap break-words text-sm text-ink">{root.text}</p>}
            {root.clipUrl && root.clipType === 'audio' && (
              <audio controls src={root.clipUrl} className="mt-1 h-9 w-full max-w-xs" />
            )}
          </div>
        </div>
      </div>

      <MessageList
        messages={replies}
        memberMap={memberMap}
        currentUid={currentUid}
        onEdit={onEdit}
        onDelete={onDelete}
        showThreads={false}
      />

      <Composer placeholder="Reply…" onSendText={onSendText} onSendClip={onSendClip} />
    </aside>
  )
}
