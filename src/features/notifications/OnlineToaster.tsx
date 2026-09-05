import { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { isOnline } from '../../lib/presence'
import { Avatar } from '../../components/Avatar'
import type { UserProfile } from '../../lib/types'

interface Toast {
  id: number
  name: string
  member: UserProfile
}

export function OnlineToaster() {
  const { user } = useAuth()
  const [toasts, setToasts] = useState<Toast[]>([])
  const onlineRef = useRef<Record<string, boolean>>({})
  const readyRef = useRef(false)
  const nextId = useRef(1)

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), (snap) => {
      const members = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }))
      for (const m of members) {
        const on = isOnline(m.lastActive)
        const was = onlineRef.current[m.uid]
        // First snapshot just seeds the baseline (no toasts on load).
        if (readyRef.current && on && !was && m.uid !== user?.uid) {
          const id = nextId.current++
          setToasts((t) => [...t, { id, name: m.displayName, member: m }])
          setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 10_000)
        }
        onlineRef.current[m.uid] = on
      }
      readyRef.current = true
    })
  }, [user])

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-10 right-16 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2.5 rounded-full border border-border bg-surface py-1.5 pl-1.5 pr-4 shadow-lg animate-rise"
        >
          <span className="relative">
            <Avatar profile={t.member} size={28} rounded="rounded-full" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-emerald-500" />
          </span>
          <span className="text-sm text-ink">
            <span className="font-semibold">{t.name.split(' ')[0]}</span> is now online
          </span>
        </div>
      ))}
    </div>
  )
}
