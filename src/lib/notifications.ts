import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import type { AppNotification, UserProfile } from './types'

/** A short, unique @handle for a member — first name, lowercased, deduped. */
export function mentionHandle(m: Pick<UserProfile, 'displayName' | 'email'>): string {
  const first = (m.displayName || m.email || 'member').trim().split(/\s+/)[0]
  return first.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export interface MentionTarget {
  uid: string
  handle: string
  name: string
}

/** Build the mentionable list, keeping handles unique. */
export function mentionTargets(members: UserProfile[]): MentionTarget[] {
  const seen: Record<string, number> = {}
  return members.map((m) => {
    let h = mentionHandle(m)
    if (seen[h] !== undefined) {
      seen[h] += 1
      h = `${h}${seen[h]}`
    } else {
      seen[h] = 0
    }
    return { uid: m.uid, handle: h, name: m.displayName }
  })
}

/** Find which members are @mentioned in a block of text. */
export function findMentions(text: string, targets: MentionTarget[]): MentionTarget[] {
  if (!text) return []
  const tokens = new Set(
    (text.toLowerCase().match(/@([a-z0-9]+)/g) || []).map((t) => t.slice(1)),
  )
  return targets.filter((t) => tokens.has(t.handle.toLowerCase()))
}

/** Create a notification document for a recipient. */
export async function notify(n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) {
  await addDoc(collection(db, 'notifications'), {
    ...n,
    read: false,
    createdAt: serverTimestamp(),
  })
}

/** Fan out mention notifications; never notifies the author. */
export async function notifyMentions(
  text: string,
  targets: MentionTarget[],
  meta: {
    fromUid: string
    fromName: string
    context: string // e.g. "in #general" or "on a task"
    link?: string
  },
) {
  const hits = findMentions(text, targets).filter((t) => t.uid !== meta.fromUid)
  await Promise.all(
    hits.map((t) =>
      notify({
        toUid: t.uid,
        type: 'mention',
        title: `${meta.fromName} mentioned you`,
        body: `${meta.context}: “${text.slice(0, 90)}”`,
        link: meta.link,
        fromUid: meta.fromUid,
        fromName: meta.fromName,
      }),
    ),
  )
  return hits.length
}

// ─── Subtle notification sound (WebAudio, no asset needed) ───────────────────
let audioCtx: AudioContext | null = null
export function playChime(kind: 'message' | 'call' = 'message') {
  try {
    audioCtx =
      audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = audioCtx
    const now = ctx.currentTime
    const notes = kind === 'call' ? [880, 1174] : [660, 990]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = now + i * 0.12
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.3)
    })
  } catch {
    /* audio not available */
  }
}
