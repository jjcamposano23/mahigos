import { useEffect, useRef, useState } from 'react'
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { playChime } from '../../lib/notifications'
import type { AppNotification } from '../../lib/types'

export function useNotifications() {
  const { user } = useAuth()
  const [items, setItems] = useState<AppNotification[]>([])
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!user) return
    loadedRef.current = false
    const q = query(collection(db, 'notifications'), where('toUid', '==', user.uid))
    return onSnapshot(q, (snap) => {
      // Chime on genuinely new, unread notifications (not the first load).
      if (loadedRef.current) {
        for (const ch of snap.docChanges()) {
          if (ch.type === 'added') {
            const d = ch.doc.data() as AppNotification
            if (!d.read) playChime(d.type === 'call' ? 'call' : 'message')
          }
        }
      }
      loadedRef.current = true
      setItems(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) }))
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)),
      )
    })
  }, [user])

  const unread = items.filter((i) => !i.read).length

  const markRead = (id: string) => updateDoc(doc(db, 'notifications', id), { read: true })
  const markAll = () =>
    Promise.all(items.filter((i) => !i.read).map((i) => updateDoc(doc(db, 'notifications', i.id), { read: true })))

  return { items, unread, markRead, markAll }
}
