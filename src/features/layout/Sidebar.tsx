import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  KanbanSquare,
  CalendarDays,
  Users,
  MessagesSquare,
  FileText,
  PenTool,
  Video,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { Wordmark } from '../../components/Logo'
import { MiniCalendar } from '../../components/MiniCalendar'
import { BicolSkyline } from '../../components/BicolMotifs'

interface Item {
  to: string
  label: string
  icon: LucideIcon
  soon?: boolean
}

const items: Item[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tasks', label: 'Tasks', icon: KanbanSquare },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/messages', label: 'Messages', icon: MessagesSquare },
  { to: '/docs', label: 'Documents', icon: FileText, soon: true },
  { to: '/whiteboard', label: 'Whiteboard', icon: PenTool, soon: true },
  { to: '/calls', label: 'Calls', icon: Video, soon: true },
]

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div className="px-5 py-5">
        <Wordmark />
      </div>

      <nav className="space-y-1 px-3">
        {items.map(({ to, label, icon: Icon, soon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                isActive
                  ? 'bg-brand-soft text-brand'
                  : 'text-muted hover:bg-surface-2 hover:text-ink',
              ].join(' ')
            }
          >
            <Icon size={18} className="shrink-0 transition-transform group-hover:scale-110" />
            <span className="flex-1">{label}</span>
            {soon && (
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wide text-muted">
                Soon
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 flex-1 overflow-y-auto px-3">
        <MiniCalendar />
      </div>

      <div className="px-3 pb-2 pt-2">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            [
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
              isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-ink',
            ].join(' ')
          }
        >
          <Settings size={18} />
          Settings
        </NavLink>
      </div>

      <div className="relative h-14 overflow-hidden text-brand/25">
        <BicolSkyline className="absolute bottom-0 h-14 w-full" />
      </div>
    </aside>
  )
}
