import { useEffect, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { Trash2, GripVertical, StickyNote } from 'lucide-react'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { isOnline } from '../../lib/presence'
import { NOTE_COLORS, type BoardCursor, type BoardNote } from '../../lib/types'

const CURSOR_COLORS = ['#ef3422', '#2f6df0', '#2f8f6b', '#e8a33d', '#8b5cf6', '#0ea5a4', '#db2777']
function colorFor(uid: string) {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0
  return CURSOR_COLORS[h % CURSOR_COLORS.length]
}

export function Canvas({ boardId }: { boardId: string }) {
  const { user, profile } = useAuth()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [notes, setNotes] = useState<BoardNote[]>([])
  const [cursors, setCursors] = useState<(BoardCursor & { uid: string })[]>([])
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const lastCursorWrite = useRef(0)
  const myColor = colorFor(user?.uid ?? 'x')

  useEffect(() => {
    const unsubN = onSnapshot(collection(db, 'whiteboards', boardId, 'notes'), (snap) =>
      setNotes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BoardNote, 'id'>) }))),
    )
    const unsubC = onSnapshot(collection(db, 'whiteboards', boardId, 'cursors'), (snap) =>
      setCursors(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as BoardCursor) }))),
    )
    return () => {
      unsubN()
      unsubC()
      if (user) void deleteDoc(doc(db, 'whiteboards', boardId, 'cursors', user.uid))
    }
  }, [boardId, user])

  const toCanvas = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top }
  }

  const addNote = (clientX: number, clientY: number) => {
    const { x, y } = toCanvas(clientX, clientY)
    void addDoc(collection(db, 'whiteboards', boardId, 'notes'), {
      x: x - 80,
      y: y - 20,
      w: 160,
      h: 120,
      text: '',
      color: NOTE_COLORS[Math.floor(Math.random() * 5)],
      authorUid: user?.uid ?? '',
    })
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const { x, y } = toCanvas(e.clientX, e.clientY)

    // drag a note
    if (drag.current) {
      const { id, dx, dy } = drag.current
      setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, x: x - dx, y: y - dy } : n)))
    }

    // broadcast cursor (throttled)
    const now = Date.now()
    if (user && now - lastCursorWrite.current > 90) {
      lastCursorWrite.current = now
      void setDoc(doc(db, 'whiteboards', boardId, 'cursors', user.uid), {
        x,
        y,
        name: profile?.displayName ?? 'Member',
        color: myColor,
        updatedAt: serverTimestamp(),
      })
    }
  }

  const startDrag = (e: React.PointerEvent, n: BoardNote) => {
    e.stopPropagation()
    const { x, y } = toCanvas(e.clientX, e.clientY)
    drag.current = { id: n.id, dx: x - n.x, dy: y - n.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const endDrag = () => {
    if (!drag.current) return
    const n = notes.find((x) => x.id === drag.current!.id)
    if (n) void updateDoc(doc(db, 'whiteboards', boardId, 'notes', n.id), { x: n.x, y: n.y })
    drag.current = null
  }

  const saveText = (id: string, text: string) =>
    void updateDoc(doc(db, 'whiteboards', boardId, 'notes', id), { text })
  const setColor = (id: string, color: string) =>
    void updateDoc(doc(db, 'whiteboards', boardId, 'notes', id), { color })
  const del = (id: string) => void deleteDoc(doc(db, 'whiteboards', boardId, 'notes', id))

  return (
    <div className="relative min-h-0 flex-1 overflow-auto bg-surface-2/40">
      <div
        ref={canvasRef}
        onDoubleClick={(e) => addNote(e.clientX, e.clientY)}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        className="banig relative h-[2000px] w-[3000px]"
        style={{ backgroundColor: 'var(--bg)' }}
      >
        {notes.map((n) => (
          <div
            key={n.id}
            className="group absolute flex flex-col rounded-lg shadow-md"
            style={{ left: n.x, top: n.y, width: n.w, minHeight: n.h, background: n.color }}
          >
            <div
              onPointerDown={(e) => startDrag(e, n)}
              className="flex cursor-grab items-center justify-between rounded-t-lg px-1.5 py-1 active:cursor-grabbing"
            >
              <GripVertical size={13} className="text-black/30" />
              <button onClick={() => del(n.id)} className="text-black/30 hover:text-brand">
                <Trash2 size={12} />
              </button>
            </div>
            <textarea
              defaultValue={n.text}
              onBlur={(e) => saveText(n.id, e.target.value)}
              placeholder="Type…"
              className="flex-1 resize-none bg-transparent px-2 pb-2 text-sm text-black/80 outline-none placeholder:text-black/30"
            />
            <div className="flex gap-1 px-2 pb-1.5 opacity-0 transition group-hover:opacity-100">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(n.id, c)}
                  className="h-3.5 w-3.5 rounded-full border border-black/10"
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        ))}

        {/* live cursors */}
        {cursors
          .filter((c) => c.uid !== user?.uid && isOnline(c.updatedAt as never))
          .map((c) => (
            <div
              key={c.uid}
              className="pointer-events-none absolute z-50 transition-transform duration-75"
              style={{ left: c.x, top: c.y, transform: 'translate(-2px, -2px)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={c.color}>
                <path d="M4 2 L20 12 L13 13 L9 21 Z" />
              </svg>
              <span
                className="ml-3 rounded px-1.5 py-0.5 text-[0.65rem] font-semibold text-white"
                style={{ background: c.color }}
              >
                {c.name}
              </span>
            </div>
          ))}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-surface/90 px-3 py-1.5 text-xs text-muted shadow-sm">
        <span className="inline-flex items-center gap-1.5">
          <StickyNote size={13} className="text-brand" /> Double-click anywhere to add a sticky note
        </span>
      </div>
    </div>
  )
}
