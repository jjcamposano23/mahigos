/**
 * Subtle 2D Bicol-inspired vector motifs (single colour, currentColor).
 * Used as light decorative accents around the app.
 */
type MotifProps = { size?: number; className?: string }

export function Mayon({ size = 48, className = '' }: MotifProps) {
  return (
    <svg viewBox="0 0 64 48" width={size} height={(size * 48) / 64} className={className} fill="none">
      {/* symmetric Mayon cone */}
      <path d="M2 44 L28 8 q4 -5 8 0 L62 44 Z" fill="currentColor" opacity="0.9" />
      {/* crater plume */}
      <path d="M30 9 q2 -6 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 44 h56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

export function Butanding({ size = 56, className = '' }: MotifProps) {
  // whale shark silhouette with spots
  return (
    <svg viewBox="0 0 72 40" width={size} height={(size * 40) / 72} className={className} fill="none">
      <path
        d="M4 22 q10 -14 30 -14 q22 0 30 12 l4 -8 v20 l-4 -8 q-8 12 -30 12 q-20 0 -30 -14 z"
        fill="currentColor"
        opacity="0.9"
      />
      <circle cx="20" cy="18" r="1.6" fill="var(--bg)" />
      <circle cx="30" cy="14" r="1.6" fill="var(--bg)" />
      <circle cx="30" cy="24" r="1.6" fill="var(--bg)" />
      <circle cx="42" cy="16" r="1.6" fill="var(--bg)" />
      <circle cx="42" cy="26" r="1.6" fill="var(--bg)" />
      <circle cx="54" cy="20" r="1.6" fill="var(--bg)" />
    </svg>
  )
}

export function Sili({ size = 40, className = '' }: MotifProps) {
  return (
    <svg viewBox="0 0 40 48" width={(size * 40) / 48} height={size} className={className} fill="none">
      <path d="M20 8 q3 22 -6 32 q-10 -2 -6 -14 q4 -12 12 -18 z" fill="currentColor" />
      <path d="M20 8 q0 -5 6 -5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function Pili({ size = 40, className = '' }: MotifProps) {
  // pili nut — pointed almond shape
  return (
    <svg viewBox="0 0 32 44" width={(size * 32) / 44} height={size} className={className} fill="none">
      <path d="M16 2 q13 12 13 26 q0 14 -13 14 q-13 0 -13 -14 q0 -14 13 -26 z" fill="currentColor" />
      <path d="M16 12 v24" stroke="var(--bg)" strokeWidth="1.5" opacity="0.5" />
    </svg>
  )
}

export function Penafrancia({ size = 44, className = '' }: MotifProps) {
  // Basilica: gabled nave + bell tower with a cross (Our Lady of Peñafrancia)
  return (
    <svg viewBox="0 0 60 60" width={size} height={size} className={className} fill="none">
      <g fill="currentColor">
        {/* nave */}
        <path d="M6 56 V34 L22 20 L38 34 V56 Z" />
        {/* bell tower */}
        <rect x="40" y="24" width="14" height="32" />
        <path d="M40 24 L47 16 L54 24 Z" />
      </g>
      {/* crosses + door (cut-outs) */}
      <g stroke="var(--bg)" strokeWidth="2">
        <path d="M47 12 v4 M45 14 h4" />
        <path d="M22 10 v5 M19.5 12.5 h5" stroke="currentColor" />
      </g>
      <rect x="18" y="44" width="8" height="12" rx="4" fill="var(--bg)" />
      <rect x="44" y="30" width="6" height="7" fill="var(--bg)" />
    </svg>
  )
}

export function Coconut({ size = 48, className = '' }: MotifProps) {
  // Coconut palm
  return (
    <svg viewBox="0 0 60 60" width={size} height={size} className={className} fill="none">
      <path d="M29 58 q-3 -20 2 -34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <g fill="currentColor">
        <path d="M31 22 q-14 -8 -26 -4 q12 -6 26 0 z" />
        <path d="M31 22 q14 -8 26 -4 q-12 -6 -26 0 z" />
        <path d="M31 22 q-10 -14 -22 -16 q12 4 22 16 z" />
        <path d="M31 22 q10 -14 22 -16 q-12 4 -22 16 z" />
        <path d="M31 22 q0 -16 0 -20 q4 8 0 20 z" />
        <circle cx="27" cy="26" r="2.5" />
        <circle cx="34" cy="27" r="2.5" />
      </g>
    </svg>
  )
}

/** Repeating Mayon range used as a footer/hero silhouette. */
export function MayonRange({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 60" preserveAspectRatio="none" className={className} fill="currentColor">
      <path d="M0 60 L60 20 q6 -8 12 0 L150 60 Z" opacity="0.5" />
      <path d="M120 60 L200 12 q6 -8 12 0 L300 60 Z" opacity="0.75" />
      <path d="M250 60 L330 24 q5 -7 10 0 L400 60 Z" opacity="0.55" />
    </svg>
  )
}

/** Mixed Bicol horizon: Mayon + palm + basilica, for footer bands. */
export function BicolSkyline({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 64" preserveAspectRatio="none" className={className} fill="currentColor">
      {/* Mayon */}
      <path d="M0 64 L70 18 q6 -8 12 0 L160 64 Z" opacity="0.55" />
      {/* basilica */}
      <g opacity="0.8">
        <path d="M188 64 V40 L206 26 L224 40 V64 Z" />
        <rect x="226" y="32" width="12" height="32" />
        <path d="M226 32 L232 25 L238 32 Z" />
      </g>
      {/* palm */}
      <g opacity="0.7">
        <path d="M300 64 q-2 -18 2 -30" stroke="currentColor" strokeWidth="3" fill="none" />
        <path d="M302 34 q-12 -7 -22 -4 q10 -5 22 0 z" />
        <path d="M302 34 q12 -7 22 -4 q-10 -5 -22 0 z" />
        <path d="M302 34 q-8 -12 -18 -14 q10 3 18 14 z" />
        <path d="M302 34 q8 -12 18 -14 q-10 3 -18 14 z" />
      </g>
      {/* far hill */}
      <path d="M330 64 L380 34 q4 -6 8 0 L400 64 Z" opacity="0.45" />
    </svg>
  )
}
