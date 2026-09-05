import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  increment,
  deleteDoc,
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { ChevronLeft, Hash, Plus, MessageSquare, Pencil, Trash2, Check, X } from 'lucide-react'
import { db, storage } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { presenceStatus, PRESENCE_META } from '../../lib/presence'
import { mentionTargets, notify, notifyMentions } from '../../lib/notifications'
import type { Channel, Message, UserProfile } from '../../lib/types'
import { MessageList } from '../messages/MessageList'
import { Composer } from '../messages/Composer'
import { Avatar } from '../../components/Avatar'

function Dot({ member }: { member?: UserProfile }) {
  const st = presenceStatus(member?.lastActive, member?.availability)
  return (
    <span
      title={PRESENCE_META[st].label}
      className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface"
      style={{ background: PRESENCE_META[st].color }}
    />
  )
}

export function MessagesDock() {
  const { user, profile } = useAuth()
  const [allChannels, setAllChannels] = useState<Channel[]>([])
  const [members, setMembers] = useState<UserProfile[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [showNew, setShowNew] = useState(false)
  const [editCh, setEditCh] = useState<string | null>(null)
  const [editChName, setEditChName] = useState('')

  useEffect(() => {
    const unsubC = onSnapshot(collection(db, 'channels'), (snap) =>
      setAllChannels(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Channel, 'id'>) }))),
    )
    const unsubU = onSnapshot(collection(db, 'users'), (snap) =>
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }))),
    )
    return () => {
      unsubC()
      unsubU()
    }
  }, [])

  const memberMap = useMemo(() => Object.fromEntries(members.map((m) => [m.uid, m])), [members])
  const targets = useMemo(() => mentionTargets(members), [members])
  const channels = useMemo(
    () => allChannels.filter((c) => c.kind !== 'dm').sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [allChannels],
  )
  const dms = useMemo(
    () => allChannels.filter((c) => c.kind === 'dm' && (c.members ?? []).includes(user?.uid ?? '')),
    [allChannels, user],
  )

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    return onSnapshot(collection(db, 'channels', selectedId, 'messages'), (snap) =>
      setMessages(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Message, 'id'>) }))
          .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)),
      ),
    )
  }, [selectedId])

  const selected = allChannels.find((c) => c.id === selectedId) || null
  const dmOther =
    selected?.kind === 'dm'
      ? memberMap[(selected.members ?? []).find((u) => u !== user?.uid) ?? '']
      : undefined

  const postMessage = async (payload: { text: string; clipUrl?: string; clipType?: 'audio' }) => {
    if (!selectedId || !selected) return
    await addDoc(collection(db, 'channels', selectedId, 'messages'), {
      text: payload.text,
      clipUrl: payload.clipUrl ?? null,
      clipType: payload.clipType ?? null,
      parentId: null,
      authorUid: user?.uid ?? '',
      authorName: profile?.displayName ?? 'Member',
      authorAvatar: profile?.avatar ?? null,
      authorPhotoURL: profile?.photoURL ?? null,
      createdAt: serverTimestamp(),
    })
    const label = selected.kind === 'dm' ? 'in a direct message' : `in #${selected.name}`
    if (payload.text)
      await notifyMentions(payload.text, targets, {
        fromUid: user?.uid ?? '',
        fromName: profile?.displayName ?? 'Member',
        context: label,
        link: '/messages',
      })
    // Notify the DM recipient of a new message.
    if (selected.kind === 'dm') {
      const otherUid = (selected.members ?? []).find((u) => u !== user?.uid)
      if (otherUid)
        await notify({
          toUid: otherUid,
          type: 'message',
          title: `${profile?.displayName ?? 'Member'} messaged you`,
          body: payload.text ? payload.text.slice(0, 90) : 'Sent a voice clip',
          link: '/messages',
          fromUid: user?.uid,
          fromName: profile?.displayName,
        })
    }
  }

  const editMessage = async (id: string, text: string) => {
    if (!selectedId || !text) return
    await updateDoc(doc(db, 'channels', selectedId, 'messages', id), { text, edited: true })
  }
  const deleteMessage = async (m: Message) => {
    if (!selectedId) return
    if (selected?.kind === 'dm') {
      await updateDoc(doc(db, 'channels', selectedId, 'messages', m.id), {
        unsent: true,
        text: '',
        clipUrl: null,
        clipType: null,
      })
      return
    }
    await deleteDoc(doc(db, 'channels', selectedId, 'messages', m.id))
    if (m.parentId)
      await updateDoc(doc(db, 'channels', selectedId, 'messages', m.parentId), {
        replyCount: increment(-1),
      })
  }

  const uploadClip = async (blob: Blob) => {
    const r = storageRef(storage, `clips/${user!.uid}/${Date.now()}.webm`)
    await uploadBytes(r, blob)
    return getDownloadURL(r)
  }

  const renameChannel = async (id: string, name: string) => {
    const clean = name.trim().replace(/^#/, '')
    if (clean) await updateDoc(doc(db, 'channels', id), { name: clean })
    setEditCh(null)
  }
  const deleteChannel = async (id: string) => {
    if (!confirm('Delete this channel? Its messages will be removed.')) return
    await deleteDoc(doc(db, 'channels', id))
    if (selectedId === id) setSelectedId(null)
  }

  const startDm = async (m: UserProfile) => {
    setShowNew(false)
    const existing = dms.find((d) => (d.members ?? []).includes(m.uid))
    if (existing) return setSelectedId(existing.id)
    const refDoc = await addDoc(collection(db, 'channels'), {
      name: `${profile?.displayName} & ${m.displayName}`,
      kind: 'dm',
      members: [user!.uid, m.uid],
      memberNames: [profile?.displayName ?? '', m.displayName],
      createdBy: user!.uid,
      createdAt: serverTimestamp(),
    })
    setSelectedId(refDoc.id)
  }

  // ── Conversation view ──
  if (selected) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <button onClick={() => setSelectedId(null)} className="text-muted hover:text-ink">
            <ChevronLeft size={18} />
          </button>
          {selected.kind === 'dm' ? (
            <span className="relative">
              <Avatar profile={dmOther ?? { displayName: '?' }} size={26} rounded="rounded-full" />
              <Dot member={dmOther} />
            </span>
          ) : (
            <Hash size={16} className="text-muted" />
          )}
          <span className="truncate text-sm font-bold text-ink">
            {selected.kind === 'dm' ? dmOther?.displayName ?? 'Direct message' : selected.name}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <MessageList
            messages={messages.filter((m) => !m.parentId)}
            memberMap={memberMap}
            currentUid={user?.uid}
            onOpenThread={() => {}}
            onEdit={editMessage}
            onDelete={deleteMessage}
          />
        </div>
        <Composer
          targets={targets}
          placeholder={
            selected.kind === 'dm'
              ? `Message ${dmOther?.displayName ?? ''} · @ to tag`
              : `Message #${selected.name} · @ to tag`
          }
          onSendText={(text) => postMessage({ text })}
          onSendClip={async (blob) => {
            const url = await uploadClip(blob)
            await postMessage({ text: '', clipUrl: url, clipType: 'audio' })
          }}
        />
      </div>
    )
  }

  // ── Conversation list ──
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <span className="text-sm font-bold text-ink">Messages</span>
        <button
          onClick={() => setShowNew((v) => !v)}
          title="New direct message"
          className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted transition hover:border-brand/40 hover:text-brand"
        >
          <Plus size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {showNew && (
          <div className="mb-2 rounded-lg border border-border p-1.5">
            <div className="px-1 pb-1 text-[0.65rem] font-semibold uppercase text-muted">
              Start a chat with
            </div>
            {members
              .filter((m) => m.uid !== user?.uid)
              .map((m) => (
                <button
                  key={m.uid}
                  onClick={() => startDm(m)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink transition hover:bg-surface-2"
                >
                  <span className="relative">
                    <Avatar profile={m} size={24} rounded="rounded-full" />
                    <Dot member={m} />
                  </span>
                  {m.displayName}
                </button>
              ))}
          </div>
        )}

        <div className="px-1 pb-1 text-[0.65rem] font-semibold uppercase text-muted">Channels</div>
        {channels.map((c) =>
          editCh === c.id ? (
            <div key={c.id} className="flex items-center gap-1 rounded-lg border border-brand/40 px-2 py-1">
              <Hash size={14} className="text-muted" />
              <input
                autoFocus
                value={editChName}
                onChange={(e) => setEditChName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') renameChannel(c.id, editChName)
                  if (e.key === 'Escape') setEditCh(null)
                }}
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
              />
              <button onClick={() => renameChannel(c.id, editChName)} className="text-brand" title="Save">
                <Check size={14} />
              </button>
              <button onClick={() => setEditCh(null)} className="text-muted" title="Cancel">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              key={c.id}
              className="group flex items-center gap-1 rounded-lg pr-1 transition hover:bg-surface-2"
            >
              <button
                onClick={() => setSelectedId(c.id)}
                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-sm text-muted transition group-hover:text-ink"
              >
                <Hash size={15} className="shrink-0" /> <span className="truncate">{c.name}</span>
              </button>
              <button
                onClick={() => {
                  setEditCh(c.id)
                  setEditChName(c.name)
                }}
                title="Rename channel"
                className="hidden text-muted transition hover:text-brand group-hover:block"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => deleteChannel(c.id)}
                title="Delete channel"
                className="hidden text-muted transition hover:text-brand group-hover:block"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ),
        )}

        <div className="mt-2 px-1 pb-1 text-[0.65rem] font-semibold uppercase text-muted">
          Direct messages
        </div>
        {dms.length === 0 && <p className="px-2 py-2 text-xs text-muted">No direct messages yet.</p>}
        {dms.map((c) => {
          const other = memberMap[(c.members ?? []).find((u) => u !== user?.uid) ?? '']
          return (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-muted transition hover:bg-surface-2 hover:text-ink"
            >
              <span className="relative">
                <Avatar profile={other ?? { displayName: '?' }} size={24} rounded="rounded-full" />
                <Dot member={other} />
              </span>
              {other?.displayName ?? 'Direct message'}
            </button>
          )
        })}

        {channels.length === 0 && dms.length === 0 && (
          <div className="grid place-items-center py-10 text-center text-xs text-muted">
            <MessageSquare size={20} className="mb-1.5 opacity-50" />
            No conversations yet.
          </div>
        )}
      </div>
    </div>
  )
}
