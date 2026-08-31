import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from '../../components/ThemeToggle'
import { useAuth } from '../../context/AuthContext'

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function AppShell() {
  const { profile, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const name = profile?.displayName ?? 'Member'

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full animate-fade-in">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
          <button
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div className="flex-1" />

          <ThemeToggle />

          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface py-1 pl-1 pr-2">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-brand text-xs font-bold text-white">
              {initials(name)}
            </div>
            <div className="hidden leading-tight sm:block">
              <div className="text-xs font-semibold text-ink">{name}</div>
              <div className="text-[0.65rem] text-muted">{profile?.title ?? profile?.role}</div>
            </div>
          </div>

          <button
            onClick={logout}
            title="Sign out"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted transition hover:border-brand/40 hover:text-brand"
          >
            <LogOut size={17} />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-auto bg-bg">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
