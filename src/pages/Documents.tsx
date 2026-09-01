import { useEffect, useMemo, useRef, useState } from 'react'
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
import { FileText, Plus, Trash2, MessageSquare, History, Save, Check, Loader2 } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { isOnline } from '../lib/presence'
import type { Doc, UserProfile } from '../lib/types'
import { DocEditor } from '../features/docs/DocEditor'
import { DocComments } from '../features/docs/DocComments'
import { DocVersions } from '../features/docs/DocVersions'
import { Avatar } from '../components/Avatar'

type Panel = 'none' | 'comments' | 'versions'
type SaveState = 'idle' | 'saving' | 'saved'

export function Documents() {
  const { user, profile } = useAuth()
  const [docs, setDocs] = useState<Doc[]>([])
  const [members, setMembers] = useState<UserProfile[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>('none')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [viewers, setViewers] = useState<{ uid: string; name: string; avatar?: string; lastActive?: { toMillis: () => number } }[]>([])
  const titleTimer = useRef<number | null>(null)

  useEffect(() => {
    const unsubD = onSnapshot(collection(db, 'documents'), (snap) =>
      setDocs(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Doc, 'id'>) }))
          .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)),
      ),
    )
    const unsubU = onSnapshot(collection(db, 'users'), (snap) =>
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }))),
    )
    return () => {
      unsubD()
      unsubU()
    }
  }, [])

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.uid, m])),
    [members],
  )

  useEffect(() => {
    if (!selectedId && docs.length > 0) setSelectedId(docs[0].id)
  }, [docs, selectedId])

  const selected = docs.find((d) => d.id === selectedId) || null

  // presence within the open document
  useEffect(() => {
    if (!selectedId || !user) return
    const meRef = doc(db, 'documents', selectedId, 'presence', user.uid)
    const beat = () =>
      void setDoc(meRef, {
        name: profile?.displayName ?? 'Member',
        avatar: profile?.avatar ?? null,
        lastActive: serverTimestamp(),
      })
    beat()
    const id = window.setInterval(beat, 20_000)
    const unsub = onSnapshot(collection(db, 'documents', selectedId, 'presence'), (snap) =>
      setViewers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as { name: string; avatar?: string; lastActive?: { toMillis: () => number } }) }))),
    )
    return () => {
      window.clearInterval(id)
      unsub()
      void deleteDoc(meRef)
    }
  }, [selectedId, user, profile])

  const createDoc = async () => {
    const refDoc = await addDoc(collection(db, 'documents'), {
      title: 'Untitled document',
      content: '',
      createdBy: user?.uid ?? '',
      updatedBy: user?.uid ?? '',
      updatedByName: profile?.displayName ?? '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setSelectedId(refDoc.id)
    setPanel('none')
  }

  const removeDoc = async (id: string) => {
    if (!confirm('Delete this document?')) return
    await deleteDoc(doc(db, 'documents', id))
    if (selectedId === id) setSelectedId(null)
  }

  const setTitle = (title: string) => {
    if (!selectedId) return
    if (titleTimer.current) window.clearTimeout(titleTimer.current)
    titleTimer.current = window.setTimeout(() => {
      void updateDoc(doc(db, 'documents', selectedId), { title, updatedAt: serverTimestamp() })
    }, 500)
  }

  const saveVersion = async () => {
    if (!selectedId || !selected) return
    await addDoc(collection(db, 'documents', selectedId, 'versions'), {
      content: selected.content,
      savedBy: user?.uid ?? '',
      savedByName: profile?.displayName ?? '',
      savedAt: serverTimestamp(),
    })
    setSaveState('saved')
  }

  const restore = async (content: string) => {
    if (!selectedId) return
    await updateDoc(doc(db, 'documents', selectedId), {
      content,
      updatedBy: user?.uid ?? '',
      updatedByName: profile?.displayName ?? '',
      updatedAt: serverTimestamp(),
    })
  }

  const activeViewers = viewers.filter((v) => v.uid !== user?.uid && isOnline(v.lastActive as never))

  return (
    <div className="flex h-full">
      {/* Doc list */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-lg font-bold text-ink">Documents</h2>
          <button
            onClick={createDoc}
            className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-white transition hover:bg-brand-ink"
            title="New document"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {docs.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setSelectedId(d.id)
                setPanel('none')
              }}
              className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                selectedId === d.id
                  ? 'bg-brand-soft text-brand'
                  : 'text-muted hover:bg-surface-2 hover:text-ink'
              }`}
            >
              <FileText size={15} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{d.title || 'Untitled'}</span>
              <Trash2
                size={13}
                onClick={(e) => {
                  e.stopPropagation()
                  removeDoc(d.id)
                }}
                className="shrink-0 opacity-0 transition hover:text-brand group-hover:opacity-100"
              />
            </button>
          ))}
          {docs.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted">
              No documents yet. Create one to start.
            </p>
          )}
        </div>
      </aside>

      {/* Editor */}
      <div className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <>
            <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
              <input
                key={selected.id}
                defaultValue={selected.title}
                onChange={(e) => setTitle(e.target.value)}
                className="min-w-0 flex-1 bg-transparent font-display text-lg font-bold text-ink outline-none"
                placeholder="Untitled document"
              />

              <span className="flex items-center gap-1 text-xs text-muted">
                {saveState === 'saving' ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Saving…
                  </>
                ) : saveState === 'saved' ? (
                  <>
                    <Check size={12} className="text-ok" /> Saved
                  </>
                ) : null}
              </span>

              {/* live viewers */}
              <div className="flex -space-x-1.5">
                {activeViewers.slice(0, 4).map((v) => (
                  <span key={v.uid} title={`${v.name} · viewing`} className="ring-2 ring-surface rounded-full">
                    <Avatar
                      profile={memberMap[v.uid] ?? { displayName: v.name, avatar: v.avatar }}
                      size={24}
                      rounded="rounded-full"
                    />
                  </span>
                ))}
              </div>

              <button
                onClick={saveVersion}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium text-ink transition hover:border-brand/40"
                title="Save a version snapshot"
              >
                <Save size={14} /> <span className="hidden sm:inline">Save version</span>
              </button>
              <button
                onClick={() => setPanel(panel === 'versions' ? 'none' : 'versions')}
                className={`grid h-8 w-8 place-items-center rounded-lg border border-border transition hover:border-brand/40 ${
                  panel === 'versions' ? 'text-brand' : 'text-muted'
                }`}
                title="Version history"
              >
                <History size={16} />
              </button>
              <button
                onClick={() => setPanel(panel === 'comments' ? 'none' : 'comments')}
                className={`grid h-8 w-8 place-items-center rounded-lg border border-border transition hover:border-brand/40 ${
                  panel === 'comments' ? 'text-brand' : 'text-muted'
                }`}
                title="Comments"
              >
                <MessageSquare size={16} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1">
              <DocEditor document={selected} onSaveState={setSaveState} />
              {panel === 'comments' && (
                <DocComments docId={selected.id} memberMap={memberMap} onClose={() => setPanel('none')} />
              )}
              {panel === 'versions' && (
                <DocVersions docId={selected.id} onClose={() => setPanel('none')} onRestore={restore} />
              )}
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div>
              <FileText size={30} className="mx-auto mb-2 text-brand/40" />
              <p className="text-sm text-muted">
                Select a document, or{' '}
                <button onClick={createDoc} className="font-medium text-brand hover:underline">
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
