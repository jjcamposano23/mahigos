import { useEffect, useState } from 'react'
import { Plus, Check } from 'lucide-react'

// Expanded Miro-like default palette.
const DEFAULTS = [
  '#1c1a19', '#6b7280', '#9ca3af', '#ffffff',
  '#ef3422', '#f97316', '#e8a33d', '#facc15',
  '#22c55e', '#2f8f6b', '#0ea5a4', '#0891b2',
  '#2f6df0', '#4f46e5', '#8b5cf6', '#db2777',
  '#ffe08a', '#ffd0c7', '#c9ecd0', '#c7ddff',
]

function toHex6(c: string): string {
  if (c?.startsWith('#')) return c.slice(0, 7)
  const m = c?.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const [r, g, b] = m[1].split(',').map((n) => parseInt(n.trim(), 10))
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
  }
  return '#1c1a19'
}
function alphaOf(c: string): number {
  const m = c?.match(/rgba\(([^)]+)\)/)
  if (m) {
    const parts = m[1].split(',')
    return Math.round((parseFloat(parts[3]) ?? 1) * 100)
  }
  return 100
}
function compose(hex: string, alpha: number): string {
  if (alpha >= 100) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${(alpha / 100).toFixed(2)})`
}

const CUSTOM_KEY = 'mahigos-wb-colors'
function loadCustom(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]')
  } catch {
    return []
  }
}

export function ColorPopover({
  value,
  onChange,
  onClose,
}: {
  value: string
  onChange: (c: string) => void
  onClose: () => void
}) {
  const [hex, setHex] = useState(toHex6(value))
  const [alpha, setAlpha] = useState(alphaOf(value))
  const [custom, setCustom] = useState<string[]>(loadCustom())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const apply = (h: string, a: number) => {
    setHex(h)
    setAlpha(a)
    onChange(compose(h, a))
  }

  const addCustom = () => {
    const next = Array.from(new Set([hex, ...custom])).slice(0, 12)
    setCustom(next)
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const swatch = (c: string) => (
    <button
      key={c}
      onClick={() => apply(toHex6(c), c.startsWith('rgba') ? alphaOf(c) : 100)}
      className="grid h-6 w-6 place-items-center rounded-md border border-black/10 transition hover:scale-110"
      style={{ background: c }}
      title={c}
    >
      {toHex6(c).toLowerCase() === hex.toLowerCase() && (
        <Check size={12} className="text-white mix-blend-difference" />
      )}
    </button>
  )

  return (
    <div
      className="absolute z-40 mt-2 w-56 rounded-xl border border-border bg-surface p-3 shadow-xl"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap gap-1.5">{DEFAULTS.map(swatch)}</div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => apply(e.target.value, alpha)}
          className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent"
          title="Hue / brightness picker"
        />
        <input
          value={hex}
          onChange={(e) => {
            const v = e.target.value
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setHex(v)
            if (/^#[0-9a-fA-F]{6}$/.test(v)) apply(v, alpha)
          }}
          className="w-20 rounded-md border border-border bg-bg px-2 py-1 text-xs text-ink outline-none focus:border-brand"
        />
        <button
          onClick={addCustom}
          title="Save this color"
          className="ml-auto grid h-7 w-7 place-items-center rounded-md border border-border text-muted transition hover:border-brand/40 hover:text-brand"
        >
          <Plus size={14} />
        </button>
      </div>

      <label className="mt-3 block text-[0.7rem] font-medium text-muted">Opacity — {alpha}%</label>
      <input
        type="range"
        min={0}
        max={100}
        value={alpha}
        onChange={(e) => apply(hex, Number(e.target.value))}
        className="mt-1 h-1 w-full accent-brand"
      />

      {custom.length > 0 && (
        <>
          <div className="mt-3 text-[0.65rem] font-semibold uppercase text-muted">Your colors</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{custom.map(swatch)}</div>
        </>
      )}
    </div>
  )
}
