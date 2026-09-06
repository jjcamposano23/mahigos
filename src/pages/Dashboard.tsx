import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, onSnapshot } from 'firebase/firestore'
import { Layers, Clock, Eye, CheckCircle2, ArrowRight, CalendarDays, BarChart3 } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import type { CalendarEvent, Project, Task } from '../lib/types'
import { EVENT_META } from '../lib/types'
import { bikolGreeting } from '../lib/bikol'
import { toISO } from '../lib/dates'
import { PhotoCarousel } from '../components/PhotoCarousel'
import { BICOL_PHOTO_SRCS } from '../lib/photos'
import { isAssignedTo } from '../features/tasks/taskUtils'
import { Announcements } from '../features/announcements/Announcements'

export function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    const unsubT = onSnapshot(collection(db, 'tasks'), (snap) =>
      setTasks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) }))),
    )
    const unsubE = onSnapshot(collection(db, 'events'), (snap) =>
      setEvents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CalendarEvent, 'id'>) }))),
    )
    const unsubP = onSnapshot(collection(db, 'projects'), (snap) =>
      setProjects(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Project, 'id'>) }))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      ),
    )
    return () => {
      unsubT()
      unsubE()
      unsubP()
    }
  }, [])

  const greet = bikolGreeting()
  const live = tasks.filter((t) => !t.archived)

  // Simplified task bins.
  const categories = [
    {
      label: 'All tasks',
      value: tasks.length,
      icon: Layers,
      desc: 'Every task in the workspace, across all projects.',
      highlight: 'all',
    },
    {
      label: 'Ongoing',
      value: live.filter((t) => ['backlog', 'todo', 'doing'].includes(t.status)).length,
      icon: Clock,
      desc: 'All tasks that are To Do and In Progress.',
      highlight: 'todo,doing',
    },
    {
      label: 'In review',
      value: live.filter((t) => t.status === 'review').length,
      icon: Eye,
      desc: 'Tasks submitted and awaiting review.',
      highlight: 'review',
    },
    {
      label: 'Completed',
      value: tasks.filter((t) => t.status === 'done' || t.archived).length,
      icon: CheckCircle2,
      desc: 'All tasks that are Done, including archived ones.',
      highlight: 'done',
    },
  ]

  const mine = tasks
    .filter((t) => !t.archived && isAssignedTo(t, profile?.uid) && t.status !== 'done')
    .slice(0, 5)

  const todayIso = toISO(new Date())
  const upcoming = events
    .filter((e) => e.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
    .slice(0, 4)

  // Per-project progress (share of tasks completed).
  const projectProgress = useMemo(() => {
    return projects
      .map((p) => {
        const ts = live.filter((t) => t.projectId === p.id)
        const done = ts.filter((t) => t.status === 'done').length
        return { project: p, total: ts.length, done, pct: ts.length ? Math.round((done / ts.length) * 100) : 0 }
      })
      .filter((r) => r.total > 0)
  }, [projects, live])

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

      {/* Announcements */}
      <div className="mt-6">
        <Announcements />
      </div>

      {/* Task bins */}
      <div className="stagger mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {categories.map(({ label, value, icon: Icon, desc, highlight }) => (
          <button
            key={label}
            onClick={() => navigate(`/tasks?highlight=${highlight}`)}
            className="group relative rounded-xl border border-border bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <Icon size={16} className="text-brand transition-transform group-hover:scale-110" />
              <span className="font-display text-2xl font-bold text-ink">{value}</span>
            </div>
            <div className="mt-1 text-xs font-medium text-muted">{label}</div>
            {/* hover tooltip */}
            <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 w-48 -translate-x-1/2 rounded-lg border border-border bg-ink px-2.5 py-1.5 text-[0.7rem] font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100">
              {desc}
            </span>
          </button>
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

      {/* Progress by project */}
      {projectProgress.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <BarChart3 size={18} className="text-brand" />
            <h2 className="font-display text-lg font-bold text-ink">Progress by project</h2>
            <Link
              to="/tasks"
              className="ml-auto flex items-center gap-1 text-sm font-medium text-brand hover:underline"
            >
              Open board <ArrowRight size={15} />
            </Link>
          </div>
          <div className="space-y-3 p-5">
            {projectProgress.map(({ project, total, done, pct }) => (
              <div key={project.id}>
                <div className="mb-1 flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: project.color }} />
                  <span className="font-medium text-ink">{project.name}</span>
                  <span className="ml-auto text-xs text-muted">
                    {done}/{total} · {pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: project.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
