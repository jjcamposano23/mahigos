import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { Hash } from 'lucide-react'
import { db, storage } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { isOnline } from '../lib/presence'
import type { Channel, Message, UserProfile } from '../lib/types'
import { ChannelList } from '../features/messages/ChannelList'
import { MessageList } from '../features/messages/MessageList'
import { Composer } from '../features/messages/Composer'
import { ThreadPanel } from '../features/messages/ThreadPanel'
import { Avatar } from '../components/Avatar'

export function Messages() {
  const { user, profile } = useAuth()
  const [allChannels, setAllChannels] = useState<Channel[]>([])
  const [members, setMembers] = useState<UserProfile[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [threadId, setThreadId] = useState<string | null>(null)
  const [channelsLoaded, setChannelsLoaded] = useState(false)
  const seededRef = useRef(false)

  useEffect(() => {
    const unsubC = onSnapshot(collection(db, 'channels'), (snap) => {
      setAllChannels(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Channel, 'id'>) })))
      setChannelsLoaded(true)
    })
    const unsubU = onSnapshot(collection(db, 'users'), (snap) =>
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }))),
    )
    return () => {
      unsubC()
      unsubU()
    }
  }, [])

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.uid, m])),
    [members],
  )

  const channels = useMemo(
    () =>
      allChannels
        .filter((c) => c.kind !== 'dm')
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)),
    [allChannels],
  )
  const dms = useMemo(
    () => allChannels.filter((c) => c.kind === 'dm' && (c.members ?? []).includes(user?.uid ?? '')),
    [allChannels, user],
  )

  // Seed a #general channel only once the channels snapshot has truly loaded
  // and the workspace has no channels yet (prevents duplicate #general on revisit).
  useEffect(() => {
    if (!channelsLoaded || !user || seededRef.current) return
    seededRef.current = true
    if (channels.length > 0) return
    void addDoc(collection(db, 'channels'), {
      name: 'general',
      description: 'Workspace-wide announcements and chat',
      kind: 'channel',
      order: 0,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    })
  }, [channelsLoaded, channels, user])

  // Admin-only cleanup: collapse any accidental duplicate #general channels,
  // keeping the earliest-created one.
  useEffect(() => {
    if (!channelsLoaded || profile?.role !== 'admin') return
    const generals = channels
      .filter((c) => c.name === 'general')
      .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0))
    generals.slice(1).forEach((c) => void deleteDoc(doc(db, 'channels', c.id)))
  }, [channelsLoaded, channels, profile])

  // default selection
  useEffect(() => {
    if (!selectedId && channels.length > 0) setSelectedId(channels[0].id)
  }, [channels, selectedId])

  // messages for the selected channel
  useEffect(() => {
    setThreadId(null)
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
  const topLevel = messages.filter((m) => !m.parentId)
  const threadRoot = threadId ? messages.find((m) => m.id === threadId) ?? null : null
  const threadReplies = threadId ? messages.filter((m) => m.parentId === threadId) : []

  const authorFields = () => ({
    authorUid: user?.uid ?? '',
    authorName: profile?.displayName ?? 'Member',
    authorAvatar: profile?.avatar ?? null,
    authorPhotoURL: profile?.photoURL ?? null,
  })

  const postMessage = async (
    payload: { text: string; clipUrl?: string; clipType?: 'audio' | 'video' },
    parentId: string | null = null,
  ) => {
    if (!selectedId) return
    await addDoc(collection(db, 'channels', selectedId, 'messages'), {
      text: payload.text,
      clipUrl: payload.clipUrl ?? null,
      clipType: payload.clipType ?? null,
      parentId,
      ...authorFields(),
      createdAt: serverTimestamp(),
    })
    if (parentId) {
      await updateDoc(doc(db, 'channels', selectedId, 'messages', parentId), {
        replyCount: increment(1),
      })
    }
  }

  const uploadClip = async (blob: Blob): Promise<string> => {
    const r = storageRef(storage, `clips/${user!.uid}/${Date.now()}.webm`)
    await uploadBytes(r, blob)
    return getDownloadURL(r)
  }

  const startDm = async (m: UserProfile) => {
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

  const createChannel = async (name: string) => {
    const refDoc = await addDoc(collection(db, 'channels'), {
      name,
      kind: 'channel',
      order: channels.length,
      createdBy: user!.uid,
      createdAt: serverTimestamp(),
    })
    setSelectedId(refDoc.id)
  }

  // header title / subtitle
  const dmOther =
    selected?.kind === 'dm'
      ? memberMap[(selected.members ?? []).find((u) => u !== user?.uid) ?? '']
      : undefined

  return (
    <div className="flex h-full">
      <ChannelList
        channels={channels}
        dms={dms}
        members={members}
        currentUid={user?.uid ?? ''}
        selectedId={selectedId}
        memberMap={memberMap}
        onSelect={setSelectedId}
        onCreateChannel={createChannel}
        onStartDm={startDm}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <>
            <div className="flex items-center gap-2.5 border-b border-border bg-surface px-4 py-3">
              {selected.kind === 'dm' ? (
                <>
                  <span className="relative">
                    <Avatar profile={dmOther ?? { displayName: '?' }} size={28} rounded="rounded-full" />
                    {isOnline(dmOther?.lastActive) && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-ok" />
                    )}
                  </span>
                  <div>
                    <div className="text-sm font-bold text-ink">{dmOther?.displayName ?? 'Direct message'}</div>
                    <div className="text-[0.68rem] text-muted">
                      {isOnline(dmOther?.lastActive) ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Hash size={18} className="text-muted" />
                  <div>
                    <div className="text-sm font-bold text-ink">{selected.name}</div>
                    {selected.description && (
                      <div className="text-[0.68rem] text-muted">{selected.description}</div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex min-h-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col">
                <MessageList
                  messages={topLevel}
                  memberMap={memberMap}
                  onOpenThread={(m) => setThreadId(m.id)}
                />
                <Composer
                  placeholder={
                    selected.kind === 'dm'
                      ? `Message ${dmOther?.displayName ?? ''}`
                      : `Message #${selected.name}`
                  }
                  onSendText={(text) => postMessage({ text })}
                  onSendClip={async (blob) => {
                    const url = await uploadClip(blob)
                    await postMessage({ text: '', clipUrl: url, clipType: 'audio' })
                  }}
                />
              </div>

              {threadRoot && (
                <ThreadPanel
                  root={threadRoot}
                  replies={threadReplies}
                  memberMap={memberMap}
                  onClose={() => setThreadId(null)}
                  onSendText={(text) => postMessage({ text }, threadRoot.id)}
                  onSendClip={async (blob) => {
                    const url = await uploadClip(blob)
                    await postMessage({ text: '', clipUrl: url, clipType: 'audio' }, threadRoot.id)
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-muted">
            Select a channel to start chatting.
          </div>
        )}
      </div>
    </div>
  )
}
