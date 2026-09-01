import { useState } from 'react'
import { Hash, Plus, Check, X } from 'lucide-react'
import { Avatar } from '../../components/Avatar'
import { isOnline } from '../../lib/presence'
import type { Channel, UserProfile } from '../../lib/types'

export function ChannelList({
  channels,
  dms,
  members,
  currentUid,
  selectedId,
  memberMap,
  onSelect,
  onCreateChannel,
  onStartDm,
}: {
  channels: Channel[]
  dms: Channel[]
  members: UserProfile[]
  currentUid: string
  selectedId: string | null
  memberMap: Record<string, UserProfile>
  onSelect: (id: string) => void
  onCreateChannel: (name: string) => void
  onStartDm: (member: UserProfile) => void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [pickingDm, setPickingDm] = useState(false)

  const create = () => {
    const n = name.trim().replace(/^#/, '')
    if (n) onCreateChannel(n)
    setName('')
    setAdding(false)
  }

  const otherOf = (dm: Channel) => {
    const uid = (dm.members ?? []).find((u) => u !== currentUid)
    return uid ? memberMap[uid] : undefined
  }

  const dmExistsWith = (uid: string) =>
    dms.some((d) => (d.members ?? []).includes(uid))

  const row = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition ${
      active ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:bg-surface-2 hover:text-ink'
    }`

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-display text-lg font-bold text-ink">Messages</h2>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {/* Channels */}
        <div>
          <div className="mb-1 flex items-center justify-between px-1.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
              Channels
            </span>
            <button
              onClick={() => setAdding((v) => !v)}
              className="text-muted transition hover:text-brand"
              title="New channel"
            >
              <Plus size={15} />
            </button>
          </div>

          {adding && (
            <div className="mb-1 flex items-center gap-1 rounded-lg border border-brand/40 px-2 py-1">
              <Hash size={13} className="text-muted" />
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') create()
                  if (e.key === 'Escape') setAdding(false)
                }}
                placeholder="channel-name"
                className="w-full bg-transparent text-sm text-ink outline-none"
              />
              <button onClick={create} className="text-brand">
                <Check size={14} />
              </button>
            </div>
          )}

          <div className="space-y-0.5">
            {channels.map((c) => (
              <button key={c.id} onClick={() => onSelect(c.id)} className={row(selectedId === c.id)}>
                <Hash size={15} className="shrink-0" />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
            {channels.length === 0 && !adding && (
              <p className="px-2 text-xs text-muted">No channels yet.</p>
            )}
          </div>
        </div>

        {/* Direct messages */}
        <div>
          <div className="mb-1 flex items-center justify-between px-1.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
              Direct messages
            </span>
            <button
              onClick={() => setPickingDm((v) => !v)}
              className="text-muted transition hover:text-brand"
              title="New message"
            >
              <Plus size={15} />
            </button>
          </div>

          {pickingDm && (
            <div className="mb-1 space-y-0.5 rounded-lg border border-border p-1">
              {members
                .filter((m) => m.uid !== currentUid && !dmExistsWith(m.uid))
                .map((m) => (
                  <button
                    key={m.uid}
                    onClick={() => {
                      onStartDm(m)
                      setPickingDm(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink transition hover:bg-surface-2"
                  >
                    <Avatar profile={m} size={22} rounded="rounded-full" />
                    <span className="truncate">{m.displayName}</span>
                  </button>
                ))}
              {members.filter((m) => m.uid !== currentUid && !dmExistsWith(m.uid)).length === 0 && (
                <p className="px-2 py-1 text-xs text-muted">Everyone has a chat already.</p>
              )}
              <button
                onClick={() => setPickingDm(false)}
                className="flex w-full items-center justify-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:text-brand"
              >
                <X size={12} /> Close
              </button>
            </div>
          )}

          <div className="space-y-0.5">
            {dms.map((d) => {
              const other = otherOf(d)
              return (
                <button key={d.id} onClick={() => onSelect(d.id)} className={row(selectedId === d.id)}>
                  <span className="relative shrink-0">
                    <Avatar
                      profile={other ?? { displayName: '?' }}
                      size={22}
                      rounded="rounded-full"
                    />
                    {isOnline(other?.lastActive) && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-ok" />
                    )}
                  </span>
                  <span className="truncate">{other?.displayName ?? 'Unknown'}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </aside>
  )
}
