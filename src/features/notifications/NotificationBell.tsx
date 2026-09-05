import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, AtSign, MessageSquare, Phone, CheckCheck, CalendarClock, KanbanSquare } from 'lucide-react'
import { useNotifications } from './useNotifications'
import type { AppNotification } from '../../lib/types'

function timeAgo(ms?: number) {
  if (!ms) return ''
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.round(h / 24)}d`
}

const ICONS: Record<AppNotification['type'], typeof Bell> = {
  mention: AtSign,
  message: MessageSquare,
  call: Phone,
  task: KanbanSquare,
  meeting: CalendarClock,
  system: Bell,
}

export function NotificationBell() {
  const { items, unread, markRead, markAll } = useNotifications()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const openItem = (n: AppNotification) => {
    if (!n.read) void markRead(n.id)
    if (n.link) navigate(n.link)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-border text-muted transition hover:border-brand/40 hover:text-brand"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[0.6rem] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 animate-rise overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-bold text-ink">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => void markAll()}
                className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted">
                <Bell size={22} className="mx-auto mb-2 opacity-50" />
                You're all caught up.
              </div>
            ) : (
              items.slice(0, 30).map((n) => {
                const Icon = ICONS[n.type] ?? Bell
                return (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-2 ${
                      n.read ? '' : 'bg-brand-soft/40'
                    }`}
                  >
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                      <Icon size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{n.title}</span>
                      {n.body && <span className="mt-0.5 block truncate text-xs text-muted">{n.body}</span>}
                      <span className="mt-0.5 block text-[0.65rem] text-muted">
                        {timeAgo(n.createdAt?.toMillis?.())}
                      </span>
                    </span>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
