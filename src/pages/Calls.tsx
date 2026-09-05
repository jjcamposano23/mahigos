import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collection, onSnapshot } from 'firebase/firestore'
import { Video, Plus, Hash, MessageSquare, PhoneCall, Users } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import type { CallDoc } from '../lib/types'
import { CallRoom } from '../features/calls/CallRoom'

const FRESH_MS = 45_000

interface ActiveCall {
  id: string
  title: string
  kind: 'room' | 'channel' | 'dm'
  channelId?: string | null
}

export function Calls() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const [calls, setCalls] = useState<CallDoc[]>([])
  const [active, setActive] = useState<ActiveCall | null>(null)

  useEffect(() => {
    return onSnapshot(collection(db, 'calls'), (snap) =>
      setCalls(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CallDoc, 'id'>) }))),
    )
  }, [])

  // Auto-join when arriving from a channel/DM "Start call" link.
  useEffect(() => {
    const join = params.get('join')
    if (!join || active) return
    setActive({
      id: join,
      title: params.get('name') ?? 'Mahigos Call',
      kind: (params.get('kind') as ActiveCall['kind']) ?? 'room',
      channelId: params.get('channelId'),
    })
    params.delete('join')
    params.delete('name')
    params.delete('kind')
    params.delete('channelId')
    setParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const live = useMemo(() => {
    const now = Date.now()
    return calls.filter(
      (c) => c.status === 'active' && now - (c.lastActive?.toMillis?.() ?? 0) < FRESH_MS,
    )
  }, [calls])

  if (active && profile) {
    return (
      <CallRoom
        callId={active.id}
        title={active.title}
        kind={active.kind}
        channelId={active.channelId}
        profile={profile}
        onLeave={() => setActive(null)}
      />
    )
  }

  const startRoom = () => {
    const id = `room-${Math.random().toString(36).slice(2, 9)}`
    setActive({ id, title: `${profile?.displayName?.split(' ')[0] ?? 'Mahigos'}'s Room`, kind: 'room' })
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">
          <Video size={22} />
        </span>
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Calls</h1>
          <p className="text-sm text-muted">Face-to-face audio &amp; video, right inside Mahigos.</p>
        </div>
      </div>

      <button
        onClick={startRoom}
        className="mt-6 flex w-full items-center gap-3 rounded-2xl bg-brand px-5 py-4 text-left text-white transition hover:bg-brand-ink"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
          <Plus size={20} />
        </span>
        <span>
          <span className="block font-semibold">Start a new room</span>
          <span className="text-sm text-white/80">Create a call and invite the team to join.</span>
        </span>
      </button>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-muted">Happening now</h2>
      {live.length === 0 ? (
        <div className="mt-3 grid place-items-center rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted">
          <PhoneCall className="mb-2 text-muted" size={22} />
          No active calls. Start a room, or hit “Call” inside any channel or DM.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {live.map((c) => (
            <button
              key={c.id}
              onClick={() =>
                setActive({ id: c.id, title: c.title, kind: c.kind, channelId: c.channelId })
              }
              className="hover-lift flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                {c.kind === 'channel' ? (
                  <Hash size={18} />
                ) : c.kind === 'dm' ? (
                  <MessageSquare size={18} />
                ) : (
                  <Video size={18} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{c.title}</span>
                <span className="flex items-center gap-1 text-[0.7rem] text-emerald-600">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Live now
                </span>
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white">
                <Users size={13} /> Join
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
