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

export type PresenceStatus =
  | 'online'
  | 'idle'
  | 'busy'
  | 'offline'
  | 'out'
  | 'meeting'
  | 'presenting'

type Availability = 'available' | 'idle' | 'busy' | 'offline' | 'out'

/** Combine heartbeat + manual availability + call state into one status. */
export function presenceStatus(
  lastActive?: Timestamp | null,
  availability?: Availability,
  callState?: 'none' | 'meeting' | 'presenting',
): PresenceStatus {
  const age = lastActive ? Date.now() - lastActive.toMillis() : Infinity
  const online = age < ONLINE_WINDOW_MS
  const fresh = age < IDLE_WINDOW_MS
  // Automatic (in a call) states take precedence while the tab is active.
  if (fresh && callState === 'presenting') return 'presenting'
  if (fresh && callState === 'meeting') return 'meeting'
  // Manual overrides
  if (availability === 'out') return 'out'
  if (availability === 'offline') return 'offline'
  if (availability === 'busy') return fresh ? 'busy' : 'offline'
  if (availability === 'idle') return fresh ? 'idle' : 'offline'
  // Auto (available)
  if (online) return 'online'
  if (fresh) return 'idle'
  return 'offline'
}

export const PRESENCE_META: Record<PresenceStatus, { label: string; color: string }> = {
  online: { label: 'Online', color: '#16c60c' }, // bright green
  idle: { label: 'Idle', color: '#f59e0b' }, // orange
  busy: { label: 'Busy', color: '#ef4444' }, // red
  offline: { label: 'Offline', color: '#ffffff' }, // white
  out: { label: 'Out', color: '#8b5cf6' }, // violet
  meeting: { label: 'In a meeting', color: '#ef4444' }, // red
  presenting: { label: 'In a meeting · presenting', color: '#ef4444' }, // red + line
}
