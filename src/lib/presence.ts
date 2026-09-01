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
