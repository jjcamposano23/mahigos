import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot } from 'firebase/firestore'
import { KanbanSquare, CheckCircle2, Clock, ArrowRight } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import type { Task } from '../lib/types'
import { MayonRange } from '../components/BicolMotifs'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function Dashboard() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    return onSnapshot(
      collection(db, 'tasks'),
      (snap) => setTasks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) }))),
      () => {},
    )
  }, [])

  const done = tasks.filter((t) => t.status === 'done').length
  const active = tasks.filter((t) => t.status === 'doing').length
  const open = tasks.length - done

  const mine = tasks
    .filter((t) => t.assigneeUid === profile?.uid && t.status !== 'done')
    .slice(0, 5)

  const stats = [
    { label: 'Open tasks', value: open, icon: KanbanSquare },
    { label: 'In progress', value: active, icon: Clock },
    { label: 'Completed', value: done, icon: CheckCircle2 },
  ]

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-brand p-8 text-white">
        <div className="banig absolute inset-0 opacity-15" />
        <div className="relative">
          <p className="text-sm font-medium text-white/80">{greeting()},</p>
          <h1 className="font-display text-3xl font-extrabold">
            {profile?.displayName ?? 'Kabalen'} 👋
          </h1>
          <p className="mt-2 max-w-lg text-white/85">
            Welcome to Mahigos — your OSEC workspace. Here’s where your projects and tasks come
            together.
          </p>
        </div>
        <MayonRange className="pointer-events-none absolute -bottom-1 right-0 h-16 w-2/3 text-white/20" />
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{label}</span>
              <Icon size={18} className="text-brand" />
            </div>
            <div className="mt-2 font-display text-3xl font-bold text-ink">{value}</div>
          </div>
        ))}
      </div>

      {/* My tasks */}
      <div className="mt-6 rounded-xl border border-border bg-surface">
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
            </Link>{' '}
            to get started.
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
    </div>
  )
}
