import { useState } from 'react'
import { SmilePlus } from 'lucide-react'

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '🙏', '✅', '🔥', '👀']

/** Toggle the current user's reaction for one emoji, returning the new map. */
export function toggledReactions(
  reactions: Record<string, string[]> | undefined,
  emoji: string,
  uid: string,
): Record<string, string[]> {
  const map = { ...(reactions ?? {}) }
  const cur = map[emoji] ?? []
  map[emoji] = cur.includes(uid) ? cur.filter((u) => u !== uid) : [...cur, uid]
  if (map[emoji].length === 0) delete map[emoji]
  return map
}

export function ReactionBar({
  reactions,
  currentUid,
  onToggle,
}: {
  reactions?: Record<string, string[]>
  currentUid?: string
  onToggle: (emoji: string) => void
}) {
  const [open, setOpen] = useState(false)
  const entries = Object.entries(reactions ?? {}).filter(([, uids]) => uids.length > 0)

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {entries.map(([emoji, uids]) => {
        const mine = currentUid ? uids.includes(currentUid) : false
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition ${
              mine ? 'border-brand bg-brand-soft' : 'border-border hover:border-brand/40'
            }`}
          >
            <span>{emoji}</span>
            <span className="text-[0.7rem] text-muted">{uids.length}</span>
          </button>
        )
      })}
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          title="Add reaction"
          className={`grid h-5 w-5 place-items-center rounded-full text-muted transition hover:text-brand ${
            entries.length ? '' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <SmilePlus size={14} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <div className="absolute bottom-full left-0 z-30 mb-1 flex gap-0.5 rounded-full border border-border bg-surface px-1.5 py-1 shadow-lg">
              {REACTION_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    onToggle(e)
                    setOpen(false)
                  }}
                  className="grid h-7 w-7 place-items-center rounded-full text-base transition hover:bg-surface-2"
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
