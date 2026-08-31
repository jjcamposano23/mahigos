import type { LucideIcon } from 'lucide-react'
import { Sili } from '../components/BicolMotifs'

export function ComingSoon({
  title,
  icon: Icon,
  blurb,
  phase,
}: {
  title: string
  icon: LucideIcon
  blurb: string
  phase: string
}) {
  return (
    <div className="grid min-h-full place-items-center px-6 py-12">
      <div className="max-w-md text-center animate-fade-in">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Icon size={30} />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-muted">{blurb}</p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
          <Sili size={16} className="text-brand" />
          Planned for {phase}
        </div>
      </div>
    </div>
  )
}
