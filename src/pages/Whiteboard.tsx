import { useEffect, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { PenTool, Plus, Trash2 } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import type { Whiteboard as Board } from '../lib/types'
import { Canvas } from '../features/board/Canvas'

export function Whiteboard() {
  const { user } = useAuth()
  const [boards, setBoards] = useState<Board[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const titleTimer = useRef<number | null>(null)

  useEffect(() => {
    return onSnapshot(collection(db, 'whiteboards'), (snap) =>
      setBoards(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Board, 'id'>) }))
          .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)),
      ),
    )
  }, [])

  useEffect(() => {
    if (!selectedId && boards.length > 0) setSelectedId(boards[0].id)
  }, [boards, selectedId])

  const selected = boards.find((b) => b.id === selectedId) || null

  const create = async () => {
    const refDoc = await addDoc(collection(db, 'whiteboards'), {
      title: 'Untitled board',
      createdBy: user?.uid ?? '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setSelectedId(refDoc.id)
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this whiteboard?')) return
    await deleteDoc(doc(db, 'whiteboards', id))
    if (selectedId === id) setSelectedId(null)
  }

  const setTitle = (title: string) => {
    if (!selectedId) return
    if (titleTimer.current) window.clearTimeout(titleTimer.current)
    titleTimer.current = window.setTimeout(
      () => void updateDoc(doc(db, 'whiteboards', selectedId), { title, updatedAt: serverTimestamp() }),
      500,
    )
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-lg font-bold text-ink">Whiteboards</h2>
          <button
            onClick={create}
            className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-white transition hover:bg-brand-ink"
            title="New whiteboard"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {boards.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedId(b.id)}
              className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                selectedId === b.id ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-ink'
              }`}
            >
              <PenTool size={15} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{b.title || 'Untitled'}</span>
              <Trash2
                size={13}
                onClick={(e) => {
                  e.stopPropagation()
                  remove(b.id)
                }}
                className="shrink-0 opacity-0 transition hover:text-brand group-hover:opacity-100"
              />
            </button>
          ))}
          {boards.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted">No whiteboards yet.</p>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <>
            <div className="border-b border-border bg-surface px-4 py-2.5">
              <input
                key={selected.id}
                defaultValue={selected.title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled board"
                className="w-full bg-transparent font-display text-lg font-bold text-ink outline-none"
              />
            </div>
            <Canvas boardId={selected.id} />
          </>
        ) : (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div>
              <PenTool size={30} className="mx-auto mb-2 text-brand/40" />
              <p className="text-sm text-muted">
                Select a whiteboard, or{' '}
                <button onClick={create} className="font-medium text-brand hover:underline">
                  create a new one
                </button>
                .
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
