import { Seal } from './Logo'

/**
 * Full-screen loader: a segmented ring spins around the UP Ibalon seal.
 */
export function LoadingScreen({ label = 'Loading Mahigos' }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg">
      <div className="banig pointer-events-none absolute inset-0 opacity-[0.12]" />
      <div className="relative flex flex-col items-center gap-6">
        <div className="relative grid h-32 w-32 place-items-center">
          {/* spinning ring */}
          <svg
            className="animate-spin-ring absolute inset-0"
            viewBox="0 0 100 100"
            width={128}
            height={128}
          >
            <defs>
              <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity="0" />
                <stop offset="100%" stopColor="var(--brand)" />
              </linearGradient>
            </defs>
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="url(#ring)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="70 210"
            />
          </svg>
          {/* seal */}
          <Seal size={64} variant="auto" className="animate-pulse-soft" />
        </div>
        <div className="text-center">
          <div className="font-display text-lg font-bold text-ink">{label}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">UP Ibalon</div>
        </div>
      </div>
    </div>
  )
}
