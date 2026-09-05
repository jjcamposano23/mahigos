import { doc, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore'
import { db } from './firebase'

const HEARTBEAT_MS = 45_000
const ONLINE_WINDOW_MS = 120_000

/** Write a heartbeat now and every 45s while the app is open. Returns cleanup. */
export function startPresence(uid: string): () => void {
  const beat = () => {
    void setDoc(doc(db, 'users', uid), { lastActive: serverTimestamp() }, { merge: true })
  }
  beat()
  const id = window.setInterval(() => {
    if (document.visibilityState === 'visible') beat()
  }, HEARTBEAT_MS)
  const onVis = () => document.visibilityState === 'visible' && beat()
  document.addEventListener('visibilitychange', onVis)
  return () => {
    window.clearInterval(id)
    document.removeEventListener('visibilitychange', onVis)
  }
}

export function isOnline(lastActive?: Timestamp | null): boolean {
  if (!lastActive) return false
  return Date.now() - lastActive.toMillis() < ONLINE_WINDOW_MS
}

const IDLE_WINDOW_MS = 600_000 // 10 min → idle

export type PresenceStatus = 'online' | 'idle' | 'offline' | 'out'

/** Combine the heartbeat with a member's manual availability into one status. */
export function presenceStatus(
  lastActive?: Timestamp | null,
  availability?: 'available' | 'busy' | 'out',
): PresenceStatus {
  if (availability === 'out') return 'out'
  if (!lastActive) return 'offline'
  const age = Date.now() - lastActive.toMillis()
  if (age < ONLINE_WINDOW_MS) return 'online'
  if (age < IDLE_WINDOW_MS) return 'idle'
  return 'offline'
}

export const PRESENCE_META: Record<
  PresenceStatus,
  { label: string; color: string }
> = {
  online: { label: 'Online', color: '#22c55e' },
  idle: { label: 'Idle', color: '#f59e0b' },
  offline: { label: 'Offline', color: '#9ca3af' },
  out: { label: 'Out', color: '#ef4444' },
}
