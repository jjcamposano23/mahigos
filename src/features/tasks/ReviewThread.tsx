import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { MessagesSquare, CornerDownRight, Send, X } from 'lucide-react'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { mentionTargets, notifyMentions } from '../../lib/notifications'
import { MentionTextarea } from '../notifications/MentionTextarea'
import { ReactionBar, toggledReactions } from '../messages/Reactions'
import { Avatar } from '../../components/Avatar'
import type { TaskComment, UserProfile } from '../../lib/types'

function renderWithMentions(text: string) {
  return text.split(/(@[a-z0-9]+)/gi).map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-semibold text-brand">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

function timeAgo(ms?: number) {
  if (!ms) return ''
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(ms).toLocaleDateString()
}

export function ReviewThread({
  taskId,
  taskTitle,
  members,
}: {
  taskId: string
  taskTitle: string
  members: UserProfile[]
}) {
  const { user, profile } = useAuth()
  const [comments, setComments] = useState<TaskComment[]>([])
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  const targets = useMemo(() => mentionTargets(members), [members])

  useEffect(() => {
    return onSnapshot(collection(db, 'tasks', taskId, 'comments'), (snap) =>
      setComments(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<TaskComment, 'id'>) }))
          .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)),
      ),
    )
  }, [taskId])

  const post = async (body: string, parentId: string | null) => {
    const clean = body.trim()
    if (!clean || !user) return
    await addDoc(collection(db, 'tasks', taskId, 'comments'), {
      text: clean,
      authorUid: user.uid,
      authorName: profile?.displayName ?? 'Member',
      authorAvatar: profile?.avatar ?? null,
      authorPhotoURL: profile?.photoURL ?? null,
      parentId,
      createdAt: serverTimestamp(),
    })
    await notifyMentions(clean, targets, {
      fromUid: user.uid,
      fromName: profile?.displayName ?? 'Member',
      context: `on task “${taskTitle}”`,
      link: '/tasks',
    })
  }

  const submitNew = async () => {
    await post(text, null)
    setText('')
  }
  const submitReply = async (parentId: string) => {
    await post(replyText, parentId)
    setReplyText('')
    setReplyTo(null)
  }

  const react = async (c: TaskComment, emoji: string) => {
    if (!user) return
    await updateDoc(doc(db, 'tasks', taskId, 'comments', c.id), {
      reactions: toggledReactions(c.reactions, emoji, user.uid),
    })
  }

  const top = comments.filter((c) => !c.parentId)
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id)

  const bubble = (c: TaskComment, isReply = false) => (
    <div key={c.id} className={`flex gap-2.5 ${isReply ? 'ml-8 mt-2' : ''}`}>
      <Avatar profile={{ displayName: c.authorName, avatar: c.authorAvatar ?? undefined, photoURL: c.authorPhotoURL ?? undefined }} size={28} rounded="rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="group rounded-xl rounded-tl-none border border-border bg-bg px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink">{c.authorName}</span>
            <span className="text-[0.65rem] text-muted">{timeAgo(c.createdAt?.toMillis?.())}</span>
            {c.authorUid === user?.uid && (
              <button
                onClick={() => void deleteDoc(doc(db, 'tasks', taskId, 'comments', c.id))}
                className="ml-auto text-muted transition hover:text-brand"
                title="Delete"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink">
            {renderWithMentions(c.text)}
          </p>
          <ReactionBar reactions={c.reactions} currentUid={user?.uid} onToggle={(e) => react(c, e)} />
        </div>
        {!isReply && (
          <button
            onClick={() => {
              setReplyTo(replyTo === c.id ? null : c.id)
              setReplyText('')
            }}
            className="mt-1 flex items-center gap-1 text-[0.7rem] font-medium text-muted transition hover:text-brand"
          >
            <CornerDownRight size={12} /> Reply
          </button>
        )}
        {replyTo === c.id && (
          <div className="mt-2 flex items-end gap-2">
            <MentionTextarea
              value={replyText}
              onChange={setReplyText}
              targets={targets}
              rows={1}
              placeholder="Write a reply…  use @ to tag"
              onSubmitMeta={() => void submitReply(c.id)}
              className="flex-1 resize-none rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
            />
            <button
              onClick={() => void submitReply(c.id)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-white transition hover:bg-brand-ink"
            >
              <Send size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="mt-4">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <MessagesSquare size={13} /> Review &amp; comments
      </span>

      <div className="mt-2 space-y-3">
        {top.length === 0 && (
          <p className="rounded-lg border border-dashed border-border py-3 text-center text-xs text-muted">
            Start the review — leave a comment and tag teammates with @.
          </p>
        )}
        {top.map((c) => (
          <div key={c.id}>
            {bubble(c)}
            {repliesOf(c.id).map((r) => bubble(r, true))}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <MentionTextarea
          value={text}
          onChange={setText}
          targets={targets}
          rows={2}
          placeholder="Add a comment…  type @ to tag someone"
          onSubmitMeta={() => void submitNew()}
          className="flex-1 resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        />
        <button
          onClick={() => void submitNew()}
          disabled={!text.trim()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand text-white transition hover:bg-brand-ink disabled:opacity-50"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}
