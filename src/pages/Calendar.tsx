import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { ChevronLeft, ChevronRight, Plus, X, Trash2, User, Plane, Coffee } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { MONTHS, WEEKDAYS, isToday, monthMatrix, toISO } from '../lib/dates'
import { EVENT_META, type CalendarEvent, type EventType, type Task, type UserProfile } from '../lib/types'

type DayItem =
  | { kind: 'event'; id: string; title: string; color: string; time?: string | null }
  | { kind: 'task'; id: string; title: string; color: string }

export function Calendar() {
  const { profile } = useAuth()
  const today = new Date()
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<UserProfile[]>([])
  const [addFor, setAddFor] = useState<string | null>(null)

  useEffect(() => {
    const unsubE = onSnapshot(collection(db, 'events'), (snap) =>
      setEvents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CalendarEvent, 'id'>) }))),
    )
    const unsubT = onSnapshot(collection(db, 'tasks'), (snap) =>
      setTasks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) }))),
    )
    const unsubU = onSnapshot(collection(db, 'users'), (snap) =>
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }))),
    )
    return () => {
      unsubE()
      unsubT()
      unsubU()
    }
  }, [])

  const creatorName = (e: CalendarEvent) =>
    e.createdByName || members.find((m) => m.uid === e.createdBy)?.displayName || 'Someone'

  const itemsByDay = useMemo(() => {
    const map: Record<string, DayItem[]> = {}
    for (const e of events) {
      ;(map[e.date] ??= []).push({
        kind: 'event',
        id: e.id,
        title: e.title,
        color: EVENT_META[e.type].color,
        time: e.time,
      })
    }
    for (const t of tasks) {
      if (t.dueDate && t.status !== 'done') {
        ;(map[t.dueDate] ??= []).push({
          kind: 'task',
          id: t.id,
          title: t.title,
          color: '#8a8f98',
        })
      }
    }
    return map
  }, [events, tasks])

  const weeks = useMemo(() => monthMatrix(cursor.y, cursor.m), [cursor])
  const shift = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
  }

  const removeEvent = async (id: string) => {
    await deleteDoc(doc(db, 'events', id))
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-bold text-ink">
            {MONTHS[cursor.m]} {cursor.y}
          </h1>
          <div className="flex gap-1">
            <button
              onClick={() => shift(-1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted transition hover:border-brand/40 hover:text-brand"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => shift(1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted transition hover:border-brand/40 hover:text-brand"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })}
              className="rounded-lg border border-border px-3 text-sm font-medium text-ink transition hover:border-brand/40"
            >
              Today
            </button>
          </div>
        </div>
        <button
          onClick={() => setAddFor(toISO(today))}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-ink active:scale-[0.99]"
        >
          <Plus size={16} /> New event
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="bg-surface px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted"
            >
              {w}
            </div>
          ))}
          {weeks.flat().map((d) => {
            const iso = toISO(d)
            const inMonth = d.getMonth() === cursor.m
            const items = itemsByDay[iso] ?? []
            return (
              <button
                key={iso}
                onClick={() => setAddFor(iso)}
                className={`group flex min-h-24 flex-col gap-1 p-1.5 text-left transition hover:bg-surface-2 ${
                  inMonth ? 'bg-surface' : 'bg-surface/40'
                }`}
              >
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs ${
                    isToday(d)
                      ? 'bg-brand font-bold text-white'
                      : inMonth
                        ? 'text-ink'
                        : 'text-muted/50'
                  }`}
                >
                  {d.getDate()}
                </span>
                <div className="flex flex-col gap-0.5">
                  {items.slice(0, 3).map((it) => (
                    <span
                      key={it.kind + it.id}
                      className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[0.68rem] text-ink"
                      style={{ background: it.color + '22' }}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: it.color }}
                      />
                      <span className="truncate">{it.title}</span>
                    </span>
                  ))}
                  {items.length > 3 && (
                    <span className="pl-1 text-[0.62rem] text-muted">+{items.length - 3} more</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Day dialog: schedule for the selected date + add */}
        {addFor && (
          <DayDialog
            date={addFor}
            events={events.filter((e) => e.date === addFor)}
            tasksDue={tasks.filter((t) => t.dueDate === addFor && t.status !== 'done')}
            creatorName={creatorName}
            firstName={(profile?.displayName ?? 'Member').split(' ')[0]}
            onClose={() => setAddFor(null)}
            onDelete={removeEvent}
            onAdd={async (payload) => {
              await addDoc(collection(db, 'events'), {
                ...payload,
                createdBy: profile?.uid ?? '',
                createdByName: profile?.displayName ?? '',
                createdAt: serverTimestamp(),
              })
            }}
          />
        )}
      </div>
    </div>
  )
}

function DayDialog({
  date,
  events,
  tasksDue,
  creatorName,
  firstName,
  onClose,
  onAdd,
  onDelete,
}: {
  date: string
  events: CalendarEvent[]
  tasksDue: Task[]
  creatorName: (e: CalendarEvent) => string
  firstName: string
  onClose: () => void
  onAdd: (p: Omit<CalendarEvent, 'id' | 'createdBy' | 'createdByName' | 'createdAt'>) => Promise<void>
  onDelete: (id: string) => void
}) {
  const [mode, setMode] = useState<'view' | 'add'>('view')
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [type, setType] = useState<EventType>('meeting')
  const [busy, setBusy] = useState(false)

  const pretty = new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const isEmpty = events.length === 0 && tasksDue.length === 0

  const save = async () => {
    if (!title.trim()) return
    setBusy(true)
    await onAdd({ title: title.trim(), date, time: time || null, type, notes: '' })
    setTitle('')
    setTime('')
    setType('meeting')
    setBusy(false)
    setMode('view')
  }

  const markStatus = async (kind: 'out' | 'busy') => {
    setBusy(true)
    await onAdd({
      title: `${firstName} — ${kind === 'out' ? 'Out of office' : 'Busy'}`,
      date,
      time: null,
      type: kind,
      notes: '',
    })
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-rise rounded-2xl border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">
              {mode === 'add' ? 'Add schedule' : 'Schedule'}
            </h2>
            <p className="text-xs text-muted">{pretty}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        {mode === 'view' ? (
          <>
            <div className="mt-4 space-y-1.5">
              {isEmpty && (
                <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted">
                  Nothing scheduled for this day yet.
                </p>
              )}

              {events.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: EVENT_META[e.type].color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{e.title}</span>
                    <span className="flex items-center gap-1 text-[0.65rem] text-muted">
                      <User size={10} /> {creatorName(e)}
                    </span>
                  </span>
                  <span className="text-[0.7rem] uppercase tracking-wide text-muted">
                    {EVENT_META[e.type].label}
                  </span>
                  {e.time && <span className="text-xs text-muted">{e.time}</span>}
                  <button
                    onClick={() => onDelete(e.id)}
                    className="text-muted transition hover:text-brand"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {tasksDue.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-muted" />
                  <span className="flex-1 text-sm text-ink">{t.title}</span>
                  <span className="text-[0.7rem] uppercase tracking-wide text-muted">Task due</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setMode('add')}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-ink active:scale-[0.99]"
            >
              <Plus size={16} /> Add schedule
            </button>

            <div className="mt-2 flex gap-2">
              <button
                onClick={() => void markStatus('out')}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-medium text-ink transition hover:border-brand/40 disabled:opacity-50"
              >
                <Plane size={15} /> I'm out
              </button>
              <button
                onClick={() => void markStatus('busy')}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-medium text-ink transition hover:border-brand/40 disabled:opacity-50"
              >
                <Coffee size={15} /> I'm busy
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4 space-y-3">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="Meeting, deadline, holiday, reminder…"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as EventType)}
                className="rounded-lg border border-border bg-surface px-2 py-2 text-sm text-ink outline-none focus:border-brand"
              >
                {Object.entries(EVENT_META).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="rounded-lg border border-border bg-surface px-2 py-2 text-sm text-ink outline-none focus:border-brand"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('view')}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-ink transition hover:border-brand/40"
              >
                Back
              </button>
              <button
                onClick={save}
                disabled={busy || !title.trim()}
                className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-ink active:scale-[0.99] disabled:opacity-50"
              >
                {busy ? 'Adding…' : 'Add to calendar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
