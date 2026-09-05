import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { Mail, GraduationCap, CalendarClock, Pencil, X } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { Avatar, AVATAR_PRESETS } from '../components/Avatar'
import type { Role, ScheduleBlock, UserProfile } from '../lib/types'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEK = [1, 2, 3, 4, 5, 6] // Mon–Sat

function fmt(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  const hh = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hh}${ap}` : `${hh}:${String(m).padStart(2, '0')}${ap}`
}

function WeeklySchedule({ schedule }: { schedule: ScheduleBlock[] }) {
  const byDay = useMemo(() => {
    const map: Record<number, ScheduleBlock[]> = {}
    for (const b of schedule) (map[b.day] ??= []).push(b)
    for (const d of Object.keys(map)) map[+d].sort((a, b) => a.start.localeCompare(b.start))
    return map
  }, [schedule])

  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {WEEK.map((d) => {
        const blocks = byDay[d] ?? []
        return (
          <div key={d} className="rounded-lg border border-border bg-bg p-2">
            <div className="mb-1.5 text-center text-xs font-semibold uppercase tracking-wide text-muted">
              {DAY_NAMES[d]}
            </div>
            {blocks.length === 0 ? (
              <div className="py-2 text-center text-[0.7rem] text-ok">Free</div>
            ) : (
              <div className="space-y-1">
                {blocks.map((b, i) => (
                  <div
                    key={i}
                    className="rounded-md border-l-2 border-brand bg-brand-soft px-1.5 py-1"
                  >
                    <div className="text-[0.7rem] font-semibold leading-tight text-ink">
                      {b.title}
                    </div>
                    <div className="text-[0.62rem] leading-tight text-muted">
                      {fmt(b.start)}–{fmt(b.end)}
                    </div>
                    {b.room && b.room !== 'TBA' && (
                      <div className="text-[0.6rem] leading-tight text-muted">{b.room}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MemberEditor({
  member,
  onClose,
}: {
  member: UserProfile
  onClose: () => void
}) {
  const [displayName, setDisplayName] = useState(member.displayName ?? '')
  const [title, setTitle] = useState(member.title ?? '')
  const [role, setRole] = useState<Role>(member.role ?? 'member')
  const [avatar, setAvatar] = useState<string | undefined>(member.avatar)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!displayName.trim()) return
    setSaving(true)
    try {
      await setDoc(
        doc(db, 'users', member.uid),
        { displayName: displayName.trim(), title: title.trim() || null, role, avatar: avatar ?? null },
        { merge: true },
      )
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">Edit member</h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <label className="mt-4 block text-xs font-semibold text-muted">Display name</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
        />

        <label className="mt-3 block text-xs font-semibold text-muted">Title / position</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Office of the Executive Secretary"
          className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
        />

        <label className="mt-3 block text-xs font-semibold text-muted">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>

        <label className="mt-3 block text-xs font-semibold text-muted">Avatar</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {AVATAR_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setAvatar(p.id)}
              title={p.label}
              className={`grid h-10 w-10 place-items-center rounded-lg ring-2 transition ${
                avatar === p.id ? 'ring-brand' : 'ring-transparent hover:ring-border'
              }`}
              style={{ background: p.bg, color: p.fg }}
            >
              <p.icon size={22} />
            </button>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !displayName.trim()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-ink disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Team() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [members, setMembers] = useState<UserProfile[]>([])
  const [editing, setEditing] = useState<UserProfile | null>(null)

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), (snap) =>
      setMembers(
        snap.docs
          .map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }))
          .sort((a, b) => (a.role === 'admin' ? -1 : 1) - (b.role === 'admin' ? -1 : 1)),
      ),
    )
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-ink">Team</h1>
      <p className="mt-1 text-sm text-muted">
        The people of the Office of the Secretary and their availability.
      </p>

      <div className="mt-6 space-y-4">
        {members.map((m) => (
          <div key={m.uid} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-start gap-4">
              <Avatar profile={m} size={52} rounded="rounded-2xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-bold text-ink">{m.displayName}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${
                      m.role === 'admin'
                        ? 'bg-brand-soft text-brand'
                        : 'bg-surface-2 text-muted'
                    }`}
                  >
                    {m.title ?? m.role}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                  <span className="flex items-center gap-1.5">
                    <Mail size={14} /> {m.email}
                  </span>
                  {m.program && (
                    <span className="flex items-center gap-1.5">
                      <GraduationCap size={14} /> {m.program}
                      {m.studentNo ? ` · ${m.studentNo}` : ''}
                    </span>
                  )}
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setEditing(m)}
                  title="Edit member"
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-brand/40 hover:text-brand"
                >
                  <Pencil size={13} /> Edit
                </button>
              )}
            </div>

            {m.schedule && m.schedule.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <CalendarClock size={15} className="text-brand" />
                  Class schedule
                  <span className="text-xs font-normal text-muted">· 1st Sem 2026–2027</span>
                </div>
                <WeeklySchedule schedule={m.schedule} />
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && <MemberEditor member={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
