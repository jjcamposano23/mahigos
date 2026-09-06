import { useState, type ReactNode } from 'react'
import { Mail, Briefcase, Shield } from 'lucide-react'
import { Avatar } from '../../components/Avatar'
import { presenceStatus, PRESENCE_META } from '../../lib/presence'
import type { UserProfile } from '../../lib/types'

function lastSeen(member?: UserProfile) {
  const st = presenceStatus(member?.lastActive, member?.availability)
  if (st === 'online') return 'Active now'
  if (st === 'out') return 'Out of office'
  const ms = member?.lastActive?.toMillis?.()
  if (!ms) return st === 'idle' ? 'Idle' : 'Offline'
  const mins = Math.round((Date.now() - ms) / 60000)
  if (mins < 60) return `Last seen ${mins}m ago`
  const h = Math.round(mins / 60)
  if (h < 24) return `Last seen ${h}h ago`
  return `Last seen ${new Date(ms).toLocaleDateString()}`
}

/** Teams-style hover card. Wrap a name; the card shows on hover. */
export function UserHoverCard({ member, children }: { member?: UserProfile; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const st = presenceStatus(member?.lastActive, member?.availability)

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && member && (
        <span className="absolute bottom-full left-0 z-50 mb-1 block w-64 rounded-xl border border-border bg-surface p-3 text-left shadow-xl">
          <span className="flex items-center gap-3">
            <span className="relative">
              <Avatar profile={member} size={44} rounded="rounded-xl" />
              <span
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface"
                style={{ background: PRESENCE_META[st].color }}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink">{member.displayName}</span>
              <span className="block text-[0.7rem]" style={{ color: PRESENCE_META[st].color }}>
                {PRESENCE_META[st].label} · {lastSeen(member)}
              </span>
            </span>
          </span>
          <span className="mt-2.5 block space-y-1 text-xs text-muted">
            {member.email && (
              <span className="flex items-center gap-1.5">
                <Mail size={12} /> {member.email}
              </span>
            )}
            {member.title && (
              <span className="flex items-center gap-1.5">
                <Briefcase size={12} /> {member.title}
              </span>
            )}
            <span className="flex items-center gap-1.5 capitalize">
              <Shield size={12} /> {member.role}
            </span>
          </span>
        </span>
      )}
    </span>
  )
}

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  )
}
