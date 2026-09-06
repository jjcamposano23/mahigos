import { presenceStatus, PRESENCE_META } from '../lib/presence'
import type { UserProfile } from '../lib/types'

/**
 * Presence indicator dot. Adds a subtle outline so the white "offline" dot
 * stays visible on any background, and draws the Teams-style white bar for
 * "presenting".
 */
export function PresenceDot({
  member,
  size = 10,
  ring = 'var(--surface)',
  className = '',
  absolute = false,
}: {
  member?: Pick<UserProfile, 'lastActive' | 'availability' | 'callState'> | null
  size?: number
  ring?: string
  className?: string
  absolute?: boolean
}) {
  const st = presenceStatus(member?.lastActive, member?.availability, member?.callState)
  const color = PRESENCE_META[st].color
  return (
    <span
      title={PRESENCE_META[st].label}
      className={`${absolute ? 'absolute -bottom-0.5 -right-0.5' : 'inline-block'} rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: `0 0 0 2px ${ring}, 0 0 0 3px rgba(0,0,0,0.14)`,
      }}
    >
      {st === 'presenting' && (
        <span
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white"
          style={{ width: Math.max(4, size * 0.6), height: Math.max(1.5, size * 0.18) }}
        />
      )}
    </span>
  )
}
