import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot } from 'firebase/firestore'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '../lib/firebase'
import { MONTHS, WEEKDAYS, isToday, monthMatrix, toISO } from '../lib/dates'
import type { CalendarEvent, Task } from '../lib/types'

/** Compact month calendar for the sidebar. Dots mark days with events/deadlines. */
export function MiniCalendar() {
  const navigate = useNavigate()
  const today = new Date()
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [marks, setMarks] = useState<Set<string>>(new Set())

  useEffect(() => {
    const dates = new Set<string>()
    const push = (d?: string | null) => d && dates.add(d)
    const unsubE = onSnapshot(collection(db, 'events'), (snap) => {
      snap.docs.forEach((d) => push((d.data() as CalendarEvent).date))
      setMarks(new Set(dates))
    })
    const unsubT = onSnapshot(collection(db, 'tasks'), (snap) => {
      snap.docs.forEach((d) => push((d.data() as Task).dueDate))
      setMarks(new Set(dates))
    })
    return () => {
      unsubE()
      unsubT()
    }
  }, [])

  const weeks = useMemo(() => monthMatrix(cursor.y, cursor.m), [cursor])

  const shift = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => navigate('/calendar')}
          className="text-xs font-semibold text-ink transition hover:text-brand"
        >
          {MONTHS[cursor.m].slice(0, 3)} {cursor.y}
        </button>
        <div className="flex gap-0.5">
          <button
            onClick={() => shift(-1)}
            className="grid h-5 w-5 place-items-center rounded text-muted transition hover:bg-surface-2 hover:text-brand"
            aria-label="Previous month"
          >
            <ChevronLeft size={13} />
          </button>
          <button
            onClick={() => shift(1)}
            className="grid h-5 w-5 place-items-center rounded text-muted transition hover:bg-surface-2 hover:text-brand"
            aria-label="Next month"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[0.55rem] font-semibold text-muted">
            {w[0]}
          </div>
        ))}
        {weeks.flat().map((d) => {
          const iso = toISO(d)
          const inMonth = d.getMonth() === cursor.m
          const todayCell = isToday(d)
          const marked = marks.has(iso)
          return (
            <button
              key={iso}
              onClick={() => navigate('/calendar')}
              className={[
                'relative grid aspect-square place-items-center rounded text-[0.62rem] transition',
                todayCell
                  ? 'bg-brand font-bold text-white'
                  : inMonth
                    ? 'text-ink hover:bg-surface-2'
                    : 'text-muted/50 hover:bg-surface-2',
              ].join(' ')}
            >
              {d.getDate()}
              {marked && !todayCell && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-brand" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
