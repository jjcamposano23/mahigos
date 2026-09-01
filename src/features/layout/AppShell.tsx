import { useMemo, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X, Mail, Shield, Briefcase, ChevronDown } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from '../../components/ThemeToggle'
import { Avatar } from '../../components/Avatar'
import { useAuth } from '../../context/AuthContext'
import { pickBicolPhoto } from '../../lib/photos'

export function AppShell() {
  const { profile, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const name = profile?.displayName ?? 'Member'

  return (
    <div className="flex h-full">
      <div className="hidden md:block">
        <Sidebar />
      </div>

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

          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface py-1 pl-1 pr-2 transition hover:border-brand/40"
          >
            <Avatar profile={profile} size={28} />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-xs font-semibold text-ink">{name}</span>
              <span className="block text-[0.65rem] capitalize text-muted">
                {profile?.title ?? profile?.role}
              </span>
            </span>
            <ChevronDown size={14} className="text-muted" />
          </button>

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

      {profileOpen && <ProfileDialog onClose={() => setProfileOpen(false)} />}
    </div>
  )
}

function ProfileDialog({ onClose }: { onClose: () => void }) {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const name = profile?.displayName ?? 'Member'
  const photo = useMemo(() => pickBicolPhoto(), [])

  const rows = [
    { icon: Mail, label: 'Email', value: profile?.email },
    { icon: Briefcase, label: 'Title', value: profile?.title ?? '—' },
    { icon: Shield, label: 'Role', value: profile?.role, cap: true },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 mt-14 w-full max-w-xs animate-rise overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
        {/* photo header (a Bicol landmark) so the avatar doesn't merge into flat red */}
        <div className="relative h-20">
          <img src={photo.src} alt={photo.label} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-brand/70 to-black/60 mix-blend-multiply" />
        </div>
        <div className="px-5 pb-5">
          <div className="-mt-9 mb-3">
            <Avatar
              profile={profile}
              size={64}
              rounded="rounded-2xl"
              className="border-4 border-surface shadow-md"
            />
          </div>
          <h2 className="font-display text-lg font-bold text-ink">{name}</h2>
          <p className="text-xs text-muted">UP Ibalon Alumni Association</p>

          <dl className="mt-4 space-y-2.5">
            {rows.map(({ icon: Icon, label, value, cap }) => (
              <div key={label} className="flex items-center gap-3 text-sm">
                <Icon size={15} className="text-brand" />
                <dt className="w-14 text-muted">{label}</dt>
                <dd className={`flex-1 truncate font-medium text-ink ${cap ? 'capitalize' : ''}`}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => {
                onClose()
                navigate('/settings')
              }}
              className="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-ink transition hover:border-brand/40"
            >
              Edit in Settings
            </button>
            <button
              onClick={logout}
              className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
