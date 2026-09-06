import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X, Mail, Shield, Briefcase, ChevronDown } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from '../../components/ThemeToggle'
import { Avatar } from '../../components/Avatar'
import { PresenceDot } from '../../components/PresenceDot'
import { Clock } from '../../components/Clock'
import { BicolSkyline } from '../../components/BicolMotifs'
import { useAuth } from '../../context/AuthContext'
import { startPresence, presenceStatus, PRESENCE_META } from '../../lib/presence'
import type { Availability } from '../../lib/types'
import { NotificationBell } from '../notifications/NotificationBell'
import { OnlineToaster } from '../notifications/OnlineToaster'
import { RightDock } from '../dock/RightDock'

export function AppShell() {
  const { user, profile, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const name = profile?.displayName ?? 'Member'

  useEffect(() => {
    if (!user) return
    return startPresence(user.uid)
  }, [user])

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

          <Clock />

          <div className="flex-1" />

          <NotificationBell />
          <ThemeToggle />

          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface py-1 pl-1 pr-2 transition hover:border-brand/40"
          >
            <span className="relative">
              <Avatar profile={profile} size={28} />
              <PresenceDot member={profile} size={10} absolute />
            </span>
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

        <main className="min-h-0 flex-1 overflow-auto bg-bg pr-12">
          <Outlet />
        </main>

        <footer className="flex shrink-0 items-center justify-center border-t border-border bg-surface px-4 py-1 text-[0.65rem] text-muted">
          <span>Copyright &copy; 2026 UP Ibalon Alumni Association Inc. | All Rights Reserved</span>
        </footer>
      </div>

      {profileOpen && <ProfileDialog onClose={() => setProfileOpen(false)} />}
      <RightDock />
      <OnlineToaster />
    </div>
  )
}

const STATUS_OPTIONS: { a: Availability; label: string; color: string }[] = [
  { a: 'available', label: 'Online', color: '#16c60c' },
  { a: 'idle', label: 'Idle', color: '#f59e0b' },
  { a: 'busy', label: 'Busy', color: '#ef4444' },
  { a: 'offline', label: 'Offline', color: '#ffffff' },
  { a: 'out', label: 'Out', color: '#8b5cf6' },
]

function ProfileDialog({ onClose }: { onClose: () => void }) {
  const { profile, logout, updateProfile } = useAuth()
  const navigate = useNavigate()
  const name = profile?.displayName ?? 'Member'
  const st = presenceStatus(profile?.lastActive, profile?.availability, profile?.callState)
  const auto = profile?.callState === 'meeting' || profile?.callState === 'presenting'

  const rows = [
    { icon: Mail, label: 'Email', value: profile?.email },
    { icon: Briefcase, label: 'Title', value: profile?.title ?? '—' },
    { icon: Shield, label: 'Role', value: profile?.role, cap: true },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4">
      <div className="absolute inset-0 bg-black/30" onMouseDown={onClose} />
      <div className="relative z-10 mt-14 w-full max-w-xs animate-rise overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
        {/* solid red header with subtle 2D Bicol vector art */}
        <div className="relative h-16 overflow-hidden bg-brand">
          <div className="banig absolute inset-0 opacity-20" />
          <BicolSkyline className="absolute bottom-0 h-9 w-full text-white/20" />
        </div>
        <div className="relative px-5 pb-5">
          <div className="relative z-10 -mt-8 mb-3 w-max">
            <Avatar
              profile={profile}
              size={64}
              rounded="rounded-2xl"
              className="border-4 border-surface shadow-md"
            />
            <PresenceDot member={profile} size={16} absolute className="!bottom-0 !right-0" />
          </div>
          <h2 className="font-display text-lg font-bold text-ink">{name}</h2>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs">
            <PresenceDot member={profile} size={9} />
            <span style={{ color: PRESENCE_META[st].color === '#ffffff' ? undefined : PRESENCE_META[st].color }} className="font-medium text-muted">
              {PRESENCE_META[st].label}
            </span>
          </div>

          {/* Status toggle */}
          <div className="mt-3">
            <div className="mb-1 text-[0.62rem] font-semibold uppercase tracking-wide text-muted">
              Set your status
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((o) => {
                const activeSel = (profile?.availability ?? 'available') === o.a
                return (
                  <button
                    key={o.a}
                    onClick={() => void updateProfile({ availability: o.a })}
                    disabled={auto}
                    title={auto ? 'You are in a call' : o.label}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-50 ${
                      activeSel ? 'border-brand bg-brand-soft text-brand' : 'border-border text-muted hover:text-ink'
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: o.color, boxShadow: '0 0 0 1px rgba(0,0,0,0.15)' }}
                    />
                    {o.label}
                  </button>
                )
              })}
            </div>
            {auto && (
              <p className="mt-1 text-[0.65rem] text-muted">Auto: you're in a call ({PRESENCE_META[st].label}).</p>
            )}
          </div>

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
