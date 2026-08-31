/** UP Ibalon seal, redrawn as inline SVG so it themes crisply at any size. */
export function Seal({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={(size * 128) / 120}
      viewBox="0 0 120 128"
      fill="none"
      className={className}
      role="img"
      aria-label="UP Ibalon seal"
    >
      <path
        d="M60 4 L112 34 V94 L60 124 L8 94 V34 Z"
        stroke="currentColor"
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <g fill="currentColor">
        <path d="M20 40 h30 l10 -8 l10 8 h30 v7 h-27 l-13 -10 l-13 10 h-27 z" />
        <path d="M20 52 h33 l7 -6 l7 6 h33 v7 h-30 l-10 -8 l-10 8 h-30 z" />
        <path d="M20 64 h36 l4 -4 l4 4 h36 v7 h-33 l-7 -6 l-7 6 h-33 z" />
        <rect x="20" y="76" width="80" height="8" />
      </g>
      <text
        x="60"
        y="102"
        textAnchor="middle"
        fontFamily="'Source Serif 4', Georgia, serif"
        fontSize="12"
        fill="currentColor"
        letterSpacing="1"
      >
        1974
      </text>
    </svg>
  )
}

/** Full lockup: seal + Mahigos wordmark. */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <span className="text-brand">
        <Seal size={compact ? 28 : 34} />
      </span>
      {!compact && (
        <div className="leading-none">
          <div className="font-display text-[1.35rem] font-extrabold tracking-tight text-ink">
            Mahigos
          </div>
          <div className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted">
            UP Ibalon &middot; OSEC
          </div>
        </div>
      )}
    </div>
  )
}
