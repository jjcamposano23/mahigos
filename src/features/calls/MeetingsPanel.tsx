import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import {
  Video,
  Plus,
  ExternalLink,
  Trash2,
  Pencil,
  X,
  Loader2,
  CalendarClock,
  Lock,
  Info,
  Users,
  Sparkles,
  Mail,
  Archive,
  ArchiveRestore,
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

function ScheduleModal({ existing, onClose }: { existing?: Meeting | null; onClose: () => void }) {
  const now = new Date()
  const start = existing ? new Date(existing.startTime) : now
  const [topic, setTopic] = useState(existing?.topic ?? '')
  const [date, setDate] = useState(
    (existing ? start : now).toISOString().slice(0, 10),
  )
  const [time, setTime] = useState(
    existing ? existing.startTime.slice(11, 16) : '10:00',
  )
  const [duration, setDuration] = useState(existing?.duration ?? 60)
  const [agenda, setAgenda] = useState(existing?.agenda ?? '')
  const [guests, setGuests] = useState<string[]>(existing?.invitees ?? [])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const draftValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.trim())
  const addGuest = () => {
    const e = draft.trim().toLowerCase()
    if (draftValid && !guests.includes(e)) setGuests((g) => [...g, e])
    setDraft('')
  }
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!existing

  const submit = async () => {
    if (!topic.trim()) return
    setBusy(true)
    setError(null)
    try {
      const startTime = `${date}T${time}:00`
      // Fold any half-typed valid email into the list on submit.
      const finalGuests =
        draftValid && !guests.includes(draft.trim().toLowerCase())
          ? [...guests, draft.trim().toLowerCase()]
          : guests
      if (isEdit) {
        const update = httpsCallable(functions, 'updateZoomMeeting')
        await update({
          id: existing!.id,
          topic: topic.trim(),
          startTime,
          duration,
          agenda: agenda.trim(),
          timezone: 'Asia/Singapore',
          invitees: finalGuests,
        })
      } else {
        const create = httpsCallable(functions, 'createZoomMeeting')
        await create({
          topic: topic.trim(),
          startTime,
          duration,
          agenda: agenda.trim(),
          timezone: 'Asia/Singapore',
          invitees: finalGuests,
        })
      }
      onClose()
    } catch (e) {
      setError(
        (e as { message?: string }).message ||
          'Could not save the Zoom meeting. Check the Zoom setup and try again.',
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
          <h3 className="font-display text-lg font-bold text-ink">
            {isEdit ? 'Edit Zoom meeting' : 'Schedule a Zoom meeting'}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">
          {isEdit
            ? 'Updates the meeting on Zoom and the shared calendar.'
            : 'Creates a real Zoom meeting on the UPIAA OSEC account and shares it with the team.'}
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

        <label className="mt-3 block text-xs font-semibold text-muted">Invited guests</label>
        <div className="mt-1 rounded-lg border border-border bg-bg p-2">
          {guests.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {guests.map((g) => (
                <span
                  key={g}
                  className="flex items-center gap-1 rounded-full bg-brand-soft py-0.5 pl-2.5 pr-1 text-xs font-medium text-brand"
                >
                  {g}
                  <button
                    onClick={() => setGuests((arr) => arr.filter((x) => x !== g))}
                    className="grid h-4 w-4 place-items-center rounded-full hover:bg-brand/20"
                    title="Remove"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ',') && draftValid) {
                e.preventDefault()
                addGuest()
              }
            }}
            className="w-full bg-transparent px-1 text-sm text-ink outline-none"
            placeholder="Type an email, then click the tile below…"
          />
          {draftValid && !guests.includes(draft.trim().toLowerCase()) && (
            <button
              onClick={addGuest}
              className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-brand/40 bg-surface px-2.5 py-1 text-xs font-medium text-brand transition hover:bg-brand-soft"
            >
              <Plus size={12} /> Add {draft.trim().toLowerCase()}
            </button>
          )}
        </div>
        <span className="mt-1 block text-[0.7rem] text-muted">
          Newly added guests are emailed the join link from the OSEC account.
        </span>

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
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create meeting'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface MeetingDetails {
  invitees: string[]
  participants: { name: string; email: string }[]
  summary: {
    summary_overview?: string
    summary_details?: { label?: string; summary?: string }[]
    next_steps?: string[]
  } | null
  notes: string[]
}

function DetailsModal({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const [data, setData] = useState<MeetingDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const fn = httpsCallable(functions, 'getMeetingDetails')
        const res = await fn({ id: meeting.id })
        setData(res.data as MeetingDetails)
      } catch (e) {
        setError((e as { message?: string }).message || 'Could not load meeting details.')
      } finally {
        setLoading(false)
      }
    })()
  }, [meeting.id])

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-ink">{meeting.topic}</h3>
            <p className="text-xs text-muted">{fmtWhen(meeting.startTime)} · {meeting.duration} min</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-10 text-muted">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : error ? (
          <p className="mt-4 text-sm text-brand">{error}</p>
        ) : (
          <div className="mt-4 space-y-4 text-sm">
            {/* Invited guests */}
            <section>
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                <Mail size={13} /> Invited guests
              </div>
              {data?.invitees.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {data.invitees.map((e) => (
                    <span key={e} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink">{e}</span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted">No invited guests recorded.</p>
              )}
            </section>

            {/* Attendees */}
            <section>
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                <Users size={13} /> Attendees
              </div>
              {data?.participants.length ? (
                <ul className="mt-1.5 space-y-1">
                  {data.participants.map((p, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-lg border border-border bg-bg px-2.5 py-1.5">
                      <span className="text-sm text-ink">{p.name}</span>
                      {p.email && <span className="text-xs text-muted">{p.email}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-muted">No attendee report yet.</p>
              )}
            </section>

            {/* AI summary */}
            <section>
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                <Sparkles size={13} /> Zoom AI summary
              </div>
              {data?.summary ? (
                <div className="mt-1.5 space-y-2 rounded-lg border border-border bg-bg p-3">
                  {data.summary.summary_overview && (
                    <p className="whitespace-pre-wrap text-sm text-ink">{data.summary.summary_overview}</p>
                  )}
                  {data.summary.summary_details?.map((d, i) => (
                    <div key={i}>
                      {d.label && <div className="text-xs font-semibold text-ink">{d.label}</div>}
                      {d.summary && <p className="whitespace-pre-wrap text-sm text-muted">{d.summary}</p>}
                    </div>
                  ))}
                  {data.summary.next_steps && data.summary.next_steps.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-ink">Next steps</div>
                      <ul className="ml-4 list-disc text-sm text-muted">
                        {data.summary.next_steps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted">No AI summary available for this meeting.</p>
              )}
            </section>

            {data?.notes && data.notes.length > 0 && (
              <div className="rounded-lg border border-border bg-surface-2/50 p-2.5 text-[0.7rem] text-muted">
                {data.notes.map((n, i) => (
                  <p key={i}>• {n}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function MeetingsPanel() {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [scheduling, setScheduling] = useState(false)
  const [editing, setEditing] = useState<Meeting | null>(null)
  const [details, setDetails] = useState<Meeting | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    return onSnapshot(query(collection(db, 'meetings'), orderBy('startTime', 'asc')), (snap) =>
      setMeetings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Meeting, 'id'>) }))),
    )
  }, [])

  const [showArchived, setShowArchived] = useState(false)
  const nowMs = Date.now()
  const { upcoming, past, archived } = useMemo(() => {
    const up: Meeting[] = []
    const pa: Meeting[] = []
    const ar: Meeting[] = []
    for (const m of meetings) {
      if (m.archived) {
        ar.push(m)
        continue
      }
      const end = new Date(m.startTime).getTime() + (m.duration || 60) * 60000
      if (end >= nowMs) up.push(m)
      else pa.push(m)
    }
    return { upcoming: up, past: pa.reverse(), archived: ar.reverse() }
  }, [meetings, nowMs])

  const archive = async (m: Meeting, val: boolean) => {
    try {
      const fn = httpsCallable(functions, 'archiveMeeting')
      await fn({ id: m.id, archived: val })
    } catch {
      /* ignore */
    }
  }

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

  const card = (m: Meeting, isPast = false, isArchived = false) => {
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
          <button
            onClick={() => setDetails(m)}
            title="Details, attendees & AI summary"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-brand"
          >
            <Info size={15} />
          </button>
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
              <>
                <button
                  onClick={() => setEditing(m)}
                  title="Edit meeting"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-brand"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => remove(m)}
                  disabled={deleting === m.id}
                  title="Cancel meeting"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-brand-soft hover:text-brand disabled:opacity-50"
                >
                  {deleting === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </>
            )}
          </div>
        )}
        {isPast && canManage && (
          <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-2.5">
            <button
              onClick={() => archive(m, !isArchived)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-brand/40 hover:text-brand"
            >
              {isArchived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
              {isArchived ? 'Unarchive' : 'Archive'}
            </button>
            <button
              onClick={() => remove(m)}
              disabled={deleting === m.id}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-brand-soft hover:text-brand disabled:opacity-50"
            >
              {deleting === m.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Delete
            </button>
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
          <div className="mt-3 space-y-2">{past.slice(0, 8).map((m) => card(m, true))}</div>
        </>
      )}

      {archived.length > 0 && (
        <>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="mt-8 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted transition hover:text-ink"
          >
            <Archive size={13} /> Archived ({archived.length}) {showArchived ? '▾' : '▸'}
          </button>
          {showArchived && (
            <div className="mt-3 space-y-2">{archived.map((m) => card(m, true, true))}</div>
          )}
        </>
      )}

      {scheduling && <ScheduleModal onClose={() => setScheduling(false)} />}
      {editing && <ScheduleModal existing={editing} onClose={() => setEditing(null)} />}
      {details && <DetailsModal meeting={details} onClose={() => setDetails(null)} />}
    </div>
  )
}
