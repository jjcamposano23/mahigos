import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import {
  Megaphone,
  Send,
  Trash2,
  Pencil,
  ImagePlus,
  X,
  MessageSquare,
  Loader2,
  Check,
} from 'lucide-react'
import { db, storage } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { notify } from '../../lib/notifications'
import { Avatar } from '../../components/Avatar'
import type { Announcement, AnnouncementComment, UserProfile } from '../../lib/types'

function ago(ms?: number) {
  if (!ms) return 'just now'
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(ms).toLocaleDateString()
}

function CommentThread({ announcementId }: { announcementId: string }) {
  const { user, profile } = useAuth()
  const [comments, setComments] = useState<AnnouncementComment[]>([])
  const [text, setText] = useState('')

  useEffect(() => {
    return onSnapshot(collection(db, 'announcements', announcementId, 'comments'), (snap) =>
      setComments(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<AnnouncementComment, 'id'>) }))
          .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)),
      ),
    )
  }, [announcementId])

  const post = async () => {
    const clean = text.trim()
    if (!clean || !user) return
    setText('')
    await addDoc(collection(db, 'announcements', announcementId, 'comments'), {
      text: clean,
      authorUid: user.uid,
      authorName: profile?.displayName ?? 'Member',
      authorAvatar: profile?.avatar ?? null,
      authorPhotoURL: profile?.photoURL ?? null,
      createdAt: serverTimestamp(),
    })
  }

  return (
    <div className="mt-2 border-t border-border pt-2">
      {comments.map((c) => (
        <div key={c.id} className="group flex items-start gap-2 py-1">
          <Avatar profile={{ displayName: c.authorName, avatar: c.authorAvatar ?? undefined, photoURL: c.authorPhotoURL ?? undefined }} size={22} rounded="rounded-full" />
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-ink">{c.authorName}</span>
            <span className="ml-1.5 text-[0.6rem] text-muted">{ago(c.createdAt?.toMillis?.())}</span>
            <p className="whitespace-pre-wrap break-words text-sm text-ink">{c.text}</p>
          </div>
          {c.authorUid === user?.uid && (
            <button
              onClick={() => void deleteDoc(doc(db, 'announcements', announcementId, 'comments', c.id))}
              className="text-muted opacity-0 transition hover:text-brand group-hover:opacity-100"
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}
      <div className="mt-1 flex items-center gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && post()}
          placeholder="Write a comment…"
          className="flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
        />
        <button onClick={() => void post()} className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white transition hover:bg-brand-ink">
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}

export function Announcements() {
  const { user, profile } = useAuth()
  const [items, setItems] = useState<Announcement[]>([])
  const [members, setMembers] = useState<UserProfile[]>([])
  const [draft, setDraft] = useState('')
  const [imgFile, setImgFile] = useState<File | null>(null)
  const [posting, setPosting] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [openComments, setOpenComments] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'announcements'), (snap) =>
      setItems(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) }))
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)),
      ),
    )
    const u2 = onSnapshot(collection(db, 'users'), (snap) =>
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }))),
    )
    return () => { u1(); u2() }
  }, [])

  const imgPreview = useMemo(() => (imgFile ? URL.createObjectURL(imgFile) : null), [imgFile])

  const post = async () => {
    if ((!draft.trim() && !imgFile) || !profile) return
    setPosting(true)
    try {
      let imageUrl: string | undefined
      if (imgFile) {
        const r = storageRef(storage, `announcements/${profile.uid}/${Date.now()}-${imgFile.name}`)
        await uploadBytes(r, imgFile)
        imageUrl = await getDownloadURL(r)
      }
      await addDoc(collection(db, 'announcements'), {
        text: draft.trim(),
        ...(imageUrl ? { imageUrl } : {}),
        authorUid: profile.uid,
        authorName: profile.displayName,
        createdAt: serverTimestamp(),
      })
      await Promise.all(
        members
          .filter((m) => m.uid !== profile.uid)
          .map((m) =>
            notify({
              toUid: m.uid,
              type: 'system',
              title: '📣 New announcement',
              body: (draft.trim() || 'Shared an image').slice(0, 100),
              link: '/',
              fromUid: profile.uid,
              fromName: profile.displayName,
            }),
          ),
      )
      setDraft('')
      setImgFile(null)
    } finally {
      setPosting(false)
    }
  }

  const saveEdit = async (id: string) => {
    if (!editText.trim()) return
    await updateDoc(doc(db, 'announcements', id), { text: editText.trim(), edited: true })
    setEditId(null)
  }

  const canManage = (a: Announcement) => a.authorUid === user?.uid || profile?.role === 'admin'

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Megaphone size={17} className="text-brand" />
        <h2 className="font-display text-base font-bold text-ink">Announcements</h2>
      </div>
      <div className="p-5">
        {/* Composer — everyone can post */}
        <div className="mb-4 rounded-xl border border-border p-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Share an announcement or update with the team…"
            className="w-full resize-none bg-transparent text-sm text-ink outline-none"
          />
          {imgPreview && (
            <div className="relative mt-2 w-max">
              <img src={imgPreview} alt="" className="max-h-40 rounded-lg" />
              <button
                onClick={() => setImgFile(null)}
                className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-brand text-white"
              >
                <X size={13} />
              </button>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-brand/40 hover:text-brand"
            >
              <ImagePlus size={14} /> Image
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setImgFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex-1" />
            <button
              onClick={() => void post()}
              disabled={posting || (!draft.trim() && !imgFile)}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-ink disabled:opacity-50"
            >
              {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Post
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-center text-sm text-muted">No announcements yet — post the first one above.</p>
        ) : (
          <ul className="space-y-3">
            {items.slice(0, 8).map((a) => (
              <li key={a.id} className="rounded-xl border-l-2 border-brand bg-brand-soft/30 px-3 py-2.5">
                {editId === a.id ? (
                  <div className="flex items-start gap-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={2}
                      className="flex-1 resize-none rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
                    />
                    <button onClick={() => void saveEdit(a.id)} className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white"><Check size={14} /></button>
                    <button onClick={() => setEditId(null)} className="grid h-8 w-8 place-items-center rounded-lg text-muted"><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap break-words text-sm text-ink">{a.text}</p>
                        {a.imageUrl && (
                          <a href={a.imageUrl} target="_blank" rel="noreferrer">
                            <img src={a.imageUrl} alt="" className="mt-2 max-h-72 rounded-lg" />
                          </a>
                        )}
                        <p className="mt-1 text-[0.65rem] text-muted">
                          {a.authorName} · {ago(a.createdAt?.toMillis?.())}
                          {a.edited ? ' · edited' : ''}
                        </p>
                      </div>
                      {canManage(a) && (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => { setEditId(a.id); setEditText(a.text) }}
                            className="text-muted transition hover:text-brand"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => void deleteDoc(doc(db, 'announcements', a.id))}
                            className="text-muted transition hover:text-brand"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setOpenComments((v) => (v === a.id ? null : a.id))}
                      className="mt-1 flex items-center gap-1 text-[0.7rem] font-medium text-muted transition hover:text-brand"
                    >
                      <MessageSquare size={12} /> {openComments === a.id ? 'Hide comments' : 'Comments'}
                    </button>
                    {openComments === a.id && <CommentThread announcementId={a.id} />}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
