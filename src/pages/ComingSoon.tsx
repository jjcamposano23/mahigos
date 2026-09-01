import type { LucideIcon } from 'lucide-react'
import { Butanding, Coconut, Mayon, Penafrancia, Pili, Sili } from '../components/BicolMotifs'

const MOTIFS = [Mayon, Butanding, Penafrancia, Sili, Pili, Coconut]

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
  // vary the accent motif per page (stable by title)
  const Motif = MOTIFS[title.length % MOTIFS.length]

  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden px-6 py-12">
      <Motif
        size={220}
        className="pointer-events-none absolute -right-10 -bottom-10 text-brand/5"
      />
      <div className="relative max-w-md text-center animate-rise">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Icon size={30} />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-muted">{blurb}</p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
          <Motif size={16} className="text-brand" />
          Planned for {phase}
        </div>
      </div>
    </div>
  )
}
