const SEALS = {
  color: '/brand/ibalon-seal.png', // official red
  white: '/brand/ibalon-seal-white.png',
  black: '/brand/ibalon-seal-black.png',
}

type Variant = 'color' | 'white' | 'black' | 'auto'

/**
 * The official UP Ibalon seal (PNG).
 * `auto` shows the red seal in light mode and the white seal in dark mode.
 * The source PNGs carry ~18% transparent padding, so we scale up slightly.
 */
export function Seal({
  size = 40,
  variant = 'auto',
  className = '',
}: {
  size?: number
  variant?: Variant
  className?: string
}) {
  const box = Math.round(size * 1.32) // compensate for padding in the artwork
  if (variant === 'auto') {
    return (
      <span
        className={`relative inline-block shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={SEALS.color}
          alt="UP Ibalon seal"
          width={box}
          height={box}
          className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 dark:hidden"
        />
        <img
          src={SEALS.white}
          alt=""
          aria-hidden
          width={box}
          height={box}
          className="absolute left-1/2 top-1/2 hidden max-w-none -translate-x-1/2 -translate-y-1/2 dark:block"
        />
      </span>
    )
  }
  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={SEALS[variant]}
        alt="UP Ibalon seal"
        width={box}
        height={box}
        className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
      />
    </span>
  )
}

/** Full lockup: seal + Mahigos wordmark. */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <Seal size={compact ? 30 : 36} />
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
