import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot } from 'firebase/firestore'
import {
  Layers,
  KanbanSquare,
  CheckCircle2,
  Clock,
  Eye,
  Archive,
  ArrowRight,
  CalendarDays,
  Trophy,
  Sparkles,
} from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import type { CalendarEvent, Task, UserProfile } from '../lib/types'
import { EVENT_META } from '../lib/types'
import { bikolGreeting } from '../lib/bikol'
import { toISO } from '../lib/dates'
import { PhotoCarousel } from '../components/PhotoCarousel'
import { BICOL_PHOTO_SRCS } from '../lib/photos'
import { Avatar } from '../components/Avatar'

const SA_EMAILS = ['gbbrutas@up.edu.ph', 'ivmancenido@up.edu.ph']

export function Dashboard() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [members, setMembers] = useState<UserProfile[]>([])

  useEffect(() => {
    const unsubT = onSnapshot(collection(db, 'tasks'), (snap) =>
      setTasks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) }))),
    )
    const unsubE = onSnapshot(collection(db, 'events'), (snap) =>
      setEvents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CalendarEvent, 'id'>) }))),
    )
    const unsubU = onSnapshot(collection(db, 'users'), (snap) =>
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }))),
    )
    return () => {
      unsubT()
      unsubE()
      unsubU()
    }
  }, [])

  const greet = bikolGreeting()
  const live = tasks.filter((t) => !t.archived)

  const categories = [
    { label: 'All tasks', value: live.length, icon: Layers, to: '/tasks' },
    {
      label: 'Open tasks',
      value: live.filter((t) => t.status === 'backlog' || t.status === 'todo').length,
      icon: KanbanSquare,
      to: '/tasks',
    },
    { label: 'In progress', value: live.filter((t) => t.status === 'doing').length, icon: Clock, to: '/tasks' },
    { label: 'In review', value: live.filter((t) => t.status === 'review').length, icon: Eye, to: '/tasks' },
    { label: 'Completed', value: live.filter((t) => t.status === 'done').length, icon: CheckCircle2, to: '/tasks' },
    { label: 'Archived', value: tasks.filter((t) => t.archived).length, icon: Archive, to: '/tasks' },
  ]

  const mine = tasks
    .filter((t) => !t.archived && t.assigneeUid === profile?.uid && t.status !== 'done')
    .slice(0, 5)

  const todayIso = toISO(new Date())
  const upcoming = events
    .filter((e) => e.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
    .slice(0, 4)

  // Fun SA performance: completed vs still-open, with a playful score.
  const saStats = useMemo(() => {
    return members
      .filter((m) => SA_EMAILS.includes((m.email ?? '').toLowerCase()))
      .map((m) => {
        const assigned = tasks.filter((t) => t.assigneeUid === m.uid && !t.archived)
        const done = assigned.filter((t) => t.status === 'done').length
        const openN = assigned.length - done
        const score = done * 10 + openN * 2
        return { member: m, done, open: openN, total: assigned.length, score }
      })
      .sort((a, b) => b.score - a.score)
  }, [members, tasks])

  const topScore = Math.max(1, ...saStats.map((s) => s.score))

  const firstName = (profile?.displayName ?? 'Ibaloney').split(' ')[0]

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Hero — real Mayon photo with brand-red colour filter */}
      <div className="relative overflow-hidden rounded-2xl">
        <PhotoCarousel images={BICOL_PHOTO_SRCS} interval={7000} />
        <div className="absolute inset-0 bg-gradient-to-r from-brand/90 via-brand/75 to-black/70 mix-blend-multiply" />
        <div className="absolute inset-0 bg-black/20" />
        <div className="banig absolute inset-0 opacity-10" />
        <div className="relative p-8 text-white">
          <p className="text-sm font-medium text-white/85 animate-rise">
            {greet.hello}, <span className="text-white/70">({greet.en})</span>
          </p>
          <h1 className="font-display text-3xl font-extrabold [animation-delay:60ms] animate-rise">
            {firstName} 🌋
          </h1>
          <p className="mt-2 max-w-lg text-white/90 [animation-delay:120ms] animate-rise">
            Welcome to <span className="font-bold">Mahigos</span>, the collaboration workspace for UP
            Ibalon.
          </p>
        </div>
      </div>

      {/* Task categories */}
      <div className="stagger mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map(({ label, value, icon: Icon, to }) => (
          <Link
            key={label}
            to={to}
            className="hover-lift rounded-xl border border-border bg-surface p-4"
          >
            <div className="flex items-center justify-between">
              <Icon size={16} className="text-brand" />
              <span className="font-display text-2xl font-bold text-ink">{value}</span>
            </div>
            <div className="mt-1 text-xs font-medium text-muted">{label}</div>
          </Link>
        ))}
      </div>

      {/* Fun: SA performance */}
      {saStats.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <Trophy size={17} className="text-brand" />
            <h2 className="font-display text-base font-bold text-ink">
              Student Assistant Leaderboard
            </h2>
            <span className="ml-auto flex items-center gap-1 text-[0.7rem] text-muted">
              <Sparkles size={12} /> +10 per done · +2 per open
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
            {saStats.map((s, i) => (
              <div key={s.member.uid} className="rounded-xl border border-border bg-bg p-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar profile={s.member} size={40} rounded="rounded-full" />
                    {i === 0 && s.score > 2 && (
                      <span className="absolute -right-1 -top-2 text-lg" title="Top performer">
                        👑
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-ink">
                      {s.member.displayName.split(' ')[0]}
                    </div>
                    <div className="text-[0.7rem] text-muted">
                      {s.done} done · {s.open} in flight
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-xl font-bold text-brand">{s.score}</div>
                    <div className="text-[0.6rem] uppercase tracking-wide text-muted">points</div>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-brand-ink transition-all"
                    style={{ width: `${(s.score / topScore) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* My tasks */}
        <div className="rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-lg font-bold text-ink">Assigned to me</h2>
            <Link
              to="/tasks"
              className="flex items-center gap-1 text-sm font-medium text-brand hover:underline"
            >
              Open board <ArrowRight size={15} />
            </Link>
          </div>
          {mine.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted">
              Nothing assigned to you yet. Head to the{' '}
              <Link to="/tasks" className="font-medium text-brand hover:underline">
                Tasks board
              </Link>
              .
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {mine.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="h-2 w-2 rounded-full bg-brand" />
                  <span className="flex-1 text-sm text-ink">{t.title}</span>
                  {t.dueDate && (
                    <span className="text-xs text-muted">
                      {new Date(t.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upcoming */}
        <div className="rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-lg font-bold text-ink">Upcoming</h2>
            <Link
              to="/calendar"
              className="flex items-center gap-1 text-sm font-medium text-brand hover:underline"
            >
              Calendar <CalendarDays size={15} />
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted">
              No upcoming events. Add one on the{' '}
              <Link to="/calendar" className="font-medium text-brand hover:underline">
                calendar
              </Link>
              .
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: EVENT_META[e.type].color }}
                  />
                  <span className="flex-1 text-sm text-ink">{e.title}</span>
                  <span className="text-xs text-muted">
                    {new Date(e.date + 'T00:00:00').toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                    {e.time ? ` · ${e.time}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
