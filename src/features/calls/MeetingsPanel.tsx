import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import {
  Video,
  Plus,
  ExternalLink,
  Trash2,
  X,
  Loader2,
  CalendarClock,
  Lock,
} from 'lucide-react'
import { db, functions } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import type { Meeting } from '../../lib/types'

function fmtWhen(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function ScheduleModal({ onClose }: { onClose: () => void }) {
  const now = new Date()
  const [topic, setTopic] = useState('')
  const [date, setDate] = useState(now.toISOString().slice(0, 10))
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState(60)
  const [agenda, setAgenda] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!topic.trim()) return
    setBusy(true)
    setError(null)
    try {
      const startTime = `${date}T${time}:00`
      const create = httpsCallable(functions, 'createZoomMeeting')
      await create({
        topic: topic.trim(),
        startTime,
        duration,
        agenda: agenda.trim(),
        timezone: 'Asia/Manila',
      })
      onClose()
    } catch (e) {
      setError(
        (e as { message?: string }).message ||
          'Could not create the Zoom meeting. Check the Zoom setup and try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const field =
    'mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-brand/50'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">Schedule a Zoom meeting</h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">
          Creates a real Zoom meeting on the UPIAA OSEC account and shares it with the team.
        </p>

        <label className="mt-4 block text-xs font-semibold text-muted">Topic</label>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} className={field} placeholder="e.g. OSEC weekly sync" />

        <div className="mt-3 flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-muted">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </div>
          <div className="w-28">
            <label className="block text-xs font-semibold text-muted">Time</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
          </div>
          <div className="w-28">
            <label className="block text-xs font-semibold text-muted">Minutes</label>
            <input
              type="number"
              min={15}
              step={15}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 60)}
              className={field}
            />
          </div>
        </div>

        <label className="mt-3 block text-xs font-semibold text-muted">Agenda (optional)</label>
        <textarea
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
          rows={3}
          className={field}
          placeholder="What will you cover?"
        />

        {error && <p className="mt-3 text-xs text-brand">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-ink">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !topic.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-ink disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Video size={15} />}
            {busy ? 'Creating…' : 'Create meeting'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function MeetingsPanel() {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [scheduling, setScheduling] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    return onSnapshot(query(collection(db, 'meetings'), orderBy('startTime', 'asc')), (snap) =>
      setMeetings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Meeting, 'id'>) }))),
    )
  }, [])

  const nowMs = Date.now()
  const { upcoming, past } = useMemo(() => {
    const up: Meeting[] = []
    const pa: Meeting[] = []
    for (const m of meetings) {
      const end = new Date(m.startTime).getTime() + (m.duration || 60) * 60000
      if (end >= nowMs) up.push(m)
      else pa.push(m)
    }
    return { upcoming: up, past: pa.reverse() }
  }, [meetings, nowMs])

  const remove = async (m: Meeting) => {
    setDeleting(m.id)
    try {
      const del = httpsCallable(functions, 'deleteZoomMeeting')
      await del({ id: m.id })
    } catch {
      /* ignore; snapshot stays */
    } finally {
      setDeleting(null)
    }
  }

  const card = (m: Meeting, isPast = false) => {
    const canManage = isAdmin || m.createdBy === user?.uid
    return (
      <div
        key={m.id}
        className={`rounded-xl border border-border bg-surface p-4 ${isPast ? 'opacity-70' : ''}`}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
            <Video size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-ink">{m.topic}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
              <CalendarClock size={13} /> {fmtWhen(m.startTime)} · {m.duration} min
            </div>
            {m.agenda && <p className="mt-1.5 text-xs text-muted">{m.agenda}</p>}
            {m.password && (
              <div className="mt-1 flex items-center gap-1 text-[0.7rem] text-muted">
                <Lock size={11} /> Passcode: <span className="font-mono">{m.password}</span>
              </div>
            )}
          </div>
        </div>
        {!isPast && (
          <div className="mt-3 flex items-center gap-2">
            <a
              href={m.joinUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-ink"
            >
              <Video size={14} /> Join
            </a>
            {m.startUrl && m.createdBy === user?.uid && (
              <a
                href={m.startUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink transition hover:border-brand/40"
              >
                <ExternalLink size={14} /> Start as host
              </a>
            )}
            <div className="flex-1" />
            {canManage && (
              <button
                onClick={() => remove(m)}
                disabled={deleting === m.id}
                title="Cancel meeting"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-brand-soft hover:text-brand disabled:opacity-50"
              >
                {deleting === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => setScheduling(true)}
        className="flex w-full items-center gap-3 rounded-2xl bg-brand px-5 py-4 text-left text-white transition hover:bg-brand-ink"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
          <Plus size={20} />
        </span>
        <span>
          <span className="block font-semibold">Schedule a Zoom meeting</span>
          <span className="text-sm text-white/80">Hosted on the UPIAA OSEC Zoom account.</span>
        </span>
      </button>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-muted">Upcoming</h2>
      {upcoming.length === 0 ? (
        <div className="mt-3 grid place-items-center rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted">
          <Video className="mb-2 text-muted" size={22} />
          No meetings scheduled yet.
        </div>
      ) : (
        <div className="mt-3 space-y-2">{upcoming.map((m) => card(m))}</div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-muted">Past</h2>
          <div className="mt-3 space-y-2">{past.slice(0, 5).map((m) => card(m, true))}</div>
        </>
      )}

      {scheduling && <ScheduleModal onClose={() => setScheduling(false)} />}
    </div>
  )
}
