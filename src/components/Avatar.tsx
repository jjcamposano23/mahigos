import type { ComponentType } from 'react'
import { Butanding, Mayon, Penafrancia, Pili, Sili } from './BicolMotifs'

type MotifProps = { size?: number; className?: string }

export interface AvatarPreset {
  id: string
  label: string
  icon: ComponentType<MotifProps>
  bg: string // tint background
  fg: string // motif colour
}

/** Bicol-element avatar presets users can choose from. */
export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'mayon', label: 'Mayon', icon: Mayon, bg: '#fdece9', fg: '#ef3422' },
  { id: 'butanding', label: 'Butanding', icon: Butanding, bg: '#e2f3f1', fg: '#1f7a70' },
  { id: 'penafrancia', label: 'Peñafrancia', icon: Penafrancia, bg: '#eee9fb', fg: '#7c53d8' },
  { id: 'sili', label: 'Sili', icon: Sili, bg: '#fdeae7', fg: '#d8371f' },
  { id: 'pili', label: 'Pili', icon: Pili, bg: '#e7f2ea', fg: '#2f8f6b' },
]

const PRESET_MAP = Object.fromEntries(AVATAR_PRESETS.map((p) => [p.id, p]))

function initials(name?: string) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

interface AvatarSource {
  displayName?: string
  photoURL?: string
  avatar?: string
}

export function Avatar({
  profile,
  size = 32,
  rounded = 'rounded-lg',
  className = '',
}: {
  profile?: AvatarSource | null
  size?: number
  rounded?: string
  className?: string
}) {
  const style = { width: size, height: size }

  // 1) uploaded photo
  if (profile?.photoURL) {
    return (
      <img
        src={profile.photoURL}
        alt={profile.displayName ?? 'Avatar'}
        style={style}
        className={`${rounded} object-cover ${className}`}
      />
    )
  }

  // 2) Bicol preset
  const preset = profile?.avatar ? PRESET_MAP[profile.avatar] : undefined
  if (preset) {
    const Icon = preset.icon
    return (
      <span
        style={{ ...style, background: preset.bg, color: preset.fg }}
        className={`grid place-items-center ${rounded} ${className}`}
      >
        <Icon size={Math.round(size * 0.62)} />
      </span>
    )
  }

  // 3) initials on brand gradient
  return (
    <span
      style={{ ...style, fontSize: size * 0.4 }}
      className={`grid place-items-center bg-gradient-to-br from-brand to-brand-ink font-bold text-white ${rounded} ${className}`}
    >
      {initials(profile?.displayName)}
    </span>
  )
}
