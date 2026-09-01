import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot } from 'firebase/firestore'
import { KanbanSquare, CheckCircle2, Clock, ArrowRight, CalendarDays } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import type { CalendarEvent, Task } from '../lib/types'
import { EVENT_META } from '../lib/types'
import { bikolGreeting, WELCOME } from '../lib/bikol'
import { toISO } from '../lib/dates'

export function Dashboard() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])

  useEffect(() => {
    const unsubT = onSnapshot(collection(db, 'tasks'), (snap) =>
      setTasks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) }))),
    )
    const unsubE = onSnapshot(collection(db, 'events'), (snap) =>
      setEvents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CalendarEvent, 'id'>) }))),
    )
    return () => {
      unsubT()
      unsubE()
    }
  }, [])

  const greet = bikolGreeting()
  const done = tasks.filter((t) => t.status === 'done').length
  const active = tasks.filter((t) => t.status === 'doing').length
  const open = tasks.length - done

  const mine = tasks
    .filter((t) => t.assigneeUid === profile?.uid && t.status !== 'done')
    .slice(0, 5)

  const todayIso = toISO(new Date())
  const upcoming = events
    .filter((e) => e.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
    .slice(0, 4)

  const stats = [
    { label: 'Open tasks', value: open, icon: KanbanSquare },
    { label: 'In progress', value: active, icon: Clock },
    { label: 'Completed', value: done, icon: CheckCircle2 },
  ]

  const firstName = (profile?.displayName ?? 'Ibalonon').split(' ')[0]

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Hero — real Mayon photo with brand-red colour filter */}
      <div className="relative overflow-hidden rounded-2xl">
        <img
          src="/photos/mayon.jpg"
          alt="Mayon Volcano"
          className="absolute inset-0 h-full w-full scale-105 object-cover"
        />
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
            <span className="font-semibold">{WELCOME}!</span> Welcome to Mahigos — the collaboration
            workspace of the UP Ibalon Alumni Association.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="stagger mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="hover-lift rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{label}</span>
              <Icon size={18} className="text-brand" />
            </div>
            <div className="mt-2 font-display text-3xl font-bold text-ink">{value}</div>
          </div>
        ))}
      </div>

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
