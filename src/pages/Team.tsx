import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { Mail, GraduationCap, CalendarClock } from 'lucide-react'
import { db } from '../lib/firebase'
import { Avatar } from '../components/Avatar'
import type { ScheduleBlock, UserProfile } from '../lib/types'

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

export function Team() {
  const [members, setMembers] = useState<UserProfile[]>([])

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
    </div>
  )
}
