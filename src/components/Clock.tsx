import { useEffect, useState } from 'react'
import { Clock as ClockIcon } from 'lucide-react'

/** Live clock fixed to GMT+8 (Manila / Bicol). */
export function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const time = now.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const day = now.toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      title="Local time · Manila / Bicol (GMT+8)"
      className="hidden items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted sm:flex"
    >
      <ClockIcon size={13} className="text-brand" />
      <span className="font-medium tabular-nums text-ink">{time}</span>
      <span className="text-muted">· {day}</span>
    </div>
  )
}
