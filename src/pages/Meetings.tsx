import { CalendarClock } from 'lucide-react'
import { MeetingsPanel } from '../features/calls/MeetingsPanel'

export function Meetings() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">
          <CalendarClock size={22} />
        </span>
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Meetings</h1>
          <p className="text-sm text-muted">
            Schedule and join Zoom meetings on the UPIAA OSEC account.
          </p>
        </div>
      </div>
      <div className="mt-6">
        <MeetingsPanel />
      </div>
    </div>
  )
}
