import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { Video, Plus, Hash, MessageSquare, PhoneCall, Users } from 'lucide-react'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { notify } from '../../lib/notifications'
import type { CallDoc, UserProfile } from '../../lib/types'
import { CallRoom } from '../calls/CallRoom'

const FRESH_MS = 45_000

interface ActiveCall {
  id: string
  title: string
  kind: 'room' | 'channel' | 'dm'
  channelId?: string | null
}

export function CallsDock() {
  const { user, profile } = useAuth()
  const [calls, setCalls] = useState<CallDoc[]>([])
  const [members, setMembers] = useState<UserProfile[]>([])
  const [active, setActive] = useState<ActiveCall | null>(null)

  useEffect(() => {
    const unsubC = onSnapshot(collection(db, 'calls'), (snap) =>
      setCalls(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CallDoc, 'id'>) }))),
    )
    const unsubU = onSnapshot(collection(db, 'users'), (snap) =>
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }))),
    )
    return () => {
      unsubC()
      unsubU()
    }
  }, [])

  const live = useMemo(() => {
    const now = Date.now()
    return calls.filter(
      (c) => c.status === 'active' && now - (c.lastActive?.toMillis?.() ?? 0) < FRESH_MS,
    )
  }, [calls])

  const startRoom = async () => {
    const id = `room-${Math.random().toString(36).slice(2, 9)}`
    const title = `${profile?.displayName?.split(' ')[0] ?? 'Mahigos'}'s Room`
    setActive({ id, title, kind: 'room' })
    // Ring the rest of the team.
    await Promise.all(
      members
        .filter((m) => m.uid !== user?.uid)
        .map((m) =>
          notify({
            toUid: m.uid,
            type: 'call',
            title: `${profile?.displayName ?? 'Someone'} started a call`,
            body: title,
            link: '/meetings',
            fromUid: user?.uid,
            fromName: profile?.displayName,
          }),
        ),
    )
  }

  if (active && profile) {
    return (
      <div className="fixed inset-0 z-[70]">
        <CallRoom
          callId={active.id}
          title={active.title}
          kind={active.kind}
          channelId={active.channelId}
          profile={profile}
          onLeave={() => setActive(null)}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2.5 text-sm font-bold text-ink">Calls</div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <button
          onClick={() => void startRoom()}
          className="flex w-full items-center gap-3 rounded-xl bg-brand px-4 py-3 text-left text-white transition hover:bg-brand-ink"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">
            <Plus size={18} />
          </span>
          <span>
            <span className="block text-sm font-semibold">Start a call</span>
            <span className="text-xs text-white/80">Ring the team to join.</span>
          </span>
        </button>

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
          Happening now
        </h3>
        {live.length === 0 ? (
          <div className="mt-2 grid place-items-center rounded-xl border border-dashed border-border py-8 text-center text-xs text-muted">
            <PhoneCall size={18} className="mb-1.5" />
            No active calls.
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {live.map((c) => (
              <button
                key={c.id}
                onClick={() =>
                  setActive({ id: c.id, title: c.title, kind: c.kind, channelId: c.channelId })
                }
                className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface p-2.5 text-left"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                  {c.kind === 'channel' ? (
                    <Hash size={15} />
                  ) : c.kind === 'dm' ? (
                    <MessageSquare size={15} />
                  ) : (
                    <Video size={15} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{c.title}</span>
                  <span className="flex items-center gap-1 text-[0.65rem] text-emerald-600">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    Live now
                  </span>
                </span>
                <span className="flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white">
                  <Users size={12} /> Join
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
