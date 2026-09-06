import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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

/** Teams-style hover card, rendered in a portal so it's never clipped. */
export function UserHoverCard({ member, children }: { member?: UserProfile; children: ReactNode }) {
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  const st = presenceStatus(member?.lastActive, member?.availability)
  const CARD_W = 256
  const CARD_H = 150

  const show = () => {
    const el = ref.current
    if (!el || !member) return
    const r = el.getBoundingClientRect()
    const above = r.top > CARD_H + 16
    const left = Math.min(Math.max(8, r.left), window.innerWidth - CARD_W - 8)
    const top = above ? r.top - 8 : r.bottom + 8
    setPos({ left, top, above })
  }

  return (
    <span
      ref={ref}
      className="inline-block"
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos &&
        member &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[100] w-64 rounded-xl border border-border bg-surface p-3 text-left shadow-2xl"
            style={{ left: pos.left, top: pos.top, transform: pos.above ? 'translateY(-100%)' : 'none' }}
          >
            <div className="flex items-center gap-3">
              <span className="relative">
                <Avatar profile={member} size={44} rounded="rounded-xl" />
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface"
                  style={{ background: PRESENCE_META[st].color }}
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-ink">{member.displayName}</div>
                <div className="text-[0.7rem]" style={{ color: PRESENCE_META[st].color }}>
                  {PRESENCE_META[st].label} · {lastSeen(member)}
                </div>
              </div>
            </div>
            <div className="mt-2.5 space-y-1 text-xs text-muted">
              {member.email && (
                <div className="flex items-center gap-1.5">
                  <Mail size={12} /> {member.email}
                </div>
              )}
              {member.title && (
                <div className="flex items-center gap-1.5">
                  <Briefcase size={12} /> {member.title}
                </div>
              )}
              <div className="flex items-center gap-1.5 capitalize">
                <Shield size={12} /> {member.role}
              </div>
            </div>
          </div>,
          document.body,
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
