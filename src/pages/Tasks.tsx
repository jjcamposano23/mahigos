import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { Plus, X, Trash2, CalendarDays } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import {
  PRIORITY_META,
  STATUS_COLUMNS,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type UserProfile,
} from '../lib/types'

function initials(name?: string | null) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Tasks() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<UserProfile[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null)
  const [adding, setAdding] = useState<TaskStatus | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [selected, setSelected] = useState<Task | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('order', 'asc'))
    const unsub = onSnapshot(
      q,
      (snap) => setTasks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) }))),
      () => {
        // if 'order' index missing, fall back to unordered
        onSnapshot(collection(db, 'tasks'), (snap) =>
          setTasks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) }))),
        )
      },
    )
    const unsubU = onSnapshot(collection(db, 'users'), (snap) =>
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }))),
    )
    return () => {
      unsub()
      unsubU()
    }
  }, [])

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      backlog: [],
      todo: [],
      doing: [],
      review: [],
      done: [],
    }
    for (const t of tasks) (map[t.status] ?? map.backlog).push(t)
    return map
  }, [tasks])

  const addTask = async (status: TaskStatus) => {
    const title = newTitle.trim()
    if (!title) return setAdding(null)
    const maxOrder = Math.max(0, ...tasks.map((t) => t.order ?? 0))
    await addDoc(collection(db, 'tasks'), {
      title,
      description: '',
      status,
      priority: 'medium' as TaskPriority,
      assigneeUid: null,
      assigneeName: null,
      dueDate: null,
      order: maxOrder + 1,
      createdBy: profile?.uid ?? '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setNewTitle('')
    setAdding(null)
  }

  const moveTask = async (id: string, status: TaskStatus) => {
    setDragOver(null)
    setDragId(null)
    const t = tasks.find((x) => x.id === id)
    if (!t || t.status === status) return
    await updateDoc(doc(db, 'tasks', id), { status, updatedAt: serverTimestamp() })
  }

  const patchTask = async (id: string, patch: Partial<Task>) => {
    await updateDoc(doc(db, 'tasks', id), { ...patch, updatedAt: serverTimestamp() })
    setSelected((s) => (s && s.id === id ? { ...s, ...patch } : s))
  }

  const removeTask = async (id: string) => {
    await deleteDoc(doc(db, 'tasks', id))
    setSelected(null)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Tasks</h1>
          <p className="text-xs text-muted">Drag cards across stages to update progress.</p>
        </div>
        <button
          onClick={() => {
            setAdding('todo')
            setNewTitle('')
          }}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-ink"
        >
          <Plus size={16} /> New task
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto">
        <div className="flex h-full min-w-max gap-4 p-6">
          {STATUS_COLUMNS.map((col) => (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(col.key)
              }}
              onDragLeave={() => setDragOver((s) => (s === col.key ? null : s))}
              onDrop={() => dragId && moveTask(dragId, col.key)}
              className={`flex w-72 flex-col rounded-xl border bg-surface-2/50 transition ${
                dragOver === col.key ? 'border-brand ring-2 ring-brand/25' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{col.label}</span>
                  <span className="rounded-full bg-surface px-1.5 text-xs text-muted">
                    {byStatus[col.key].length}
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {byStatus[col.key].map((t) => (
                  <button
                    key={t.id}
                    draggable
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => setSelected(t)}
                    className={`hover-lift w-full cursor-grab rounded-lg border border-border bg-surface p-3 text-left shadow-sm transition hover:border-brand/40 active:cursor-grabbing ${
                      dragId === t.id ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: PRIORITY_META[t.priority].dot }}
                        title={PRIORITY_META[t.priority].label}
                      />
                      <span className="text-sm text-ink">{t.title}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between pl-4">
                      {t.dueDate ? (
                        <span className="flex items-center gap-1 text-[0.7rem] text-muted">
                          <CalendarDays size={12} />
                          {new Date(t.dueDate).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      ) : (
                        <span />
                      )}
                      {t.assigneeName && (
                        <span
                          title={t.assigneeName}
                          className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[0.6rem] font-bold text-white"
                        >
                          {initials(t.assigneeName)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}

                {adding === col.key ? (
                  <div className="rounded-lg border border-brand/40 bg-surface p-2">
                    <textarea
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          addTask(col.key)
                        }
                        if (e.key === 'Escape') setAdding(null)
                      }}
                      placeholder="Task title…"
                      rows={2}
                      className="w-full resize-none bg-transparent text-sm text-ink outline-none"
                    />
                    <div className="mt-1 flex gap-2">
                      <button
                        onClick={() => addTask(col.key)}
                        className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setAdding(null)}
                        className="rounded-md px-2 py-1 text-xs text-muted hover:text-ink"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setAdding(col.key)
                      setNewTitle('')
                    }}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted transition hover:bg-surface hover:text-brand"
                  >
                    <Plus size={14} /> Add task
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <TaskModal
          task={selected}
          members={members}
          onClose={() => setSelected(null)}
          onPatch={patchTask}
          onDelete={removeTask}
        />
      )}
    </div>
  )
}

function TaskModal({
  task,
  members,
  onClose,
  onPatch,
  onDelete,
}: {
  task: Task
  members: UserProfile[]
  onClose: () => void
  onPatch: (id: string, patch: Partial<Task>) => void
  onDelete: (id: string) => void
}) {
  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg animate-fade-in rounded-2xl border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== task.title && onPatch(task.id, { title: title.trim() })}
            className="w-full bg-transparent font-display text-lg font-bold text-ink outline-none"
          />
          <button onClick={onClose} className="ml-2 text-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => desc !== (task.description ?? '') && onPatch(task.id, { description: desc })}
          placeholder="Add a description…"
          rows={4}
          className="mt-3 w-full resize-none rounded-lg border border-border bg-bg p-3 text-sm text-ink outline-none focus:border-brand"
        />

        <div className="mt-4 grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Status</span>
            <select
              value={task.status}
              onChange={(e) => onPatch(task.id, { status: e.target.value as TaskStatus })}
              className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-ink outline-none focus:border-brand"
            >
              {STATUS_COLUMNS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Priority</span>
            <select
              value={task.priority}
              onChange={(e) => onPatch(task.id, { priority: e.target.value as TaskPriority })}
              className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-ink outline-none focus:border-brand"
            >
              {Object.entries(PRIORITY_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Assignee</span>
            <select
              value={task.assigneeUid ?? ''}
              onChange={(e) => {
                const m = members.find((x) => x.uid === e.target.value)
                onPatch(task.id, {
                  assigneeUid: m?.uid ?? null,
                  assigneeName: m?.displayName ?? null,
                })
              }}
              className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-ink outline-none focus:border-brand"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Due date</span>
            <input
              type="date"
              value={task.dueDate ?? ''}
              onChange={(e) => onPatch(task.id, { dueDate: e.target.value || null })}
              className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-ink outline-none focus:border-brand"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-between border-t border-border pt-4">
          <button
            onClick={() => onDelete(task.id)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-brand transition hover:bg-brand-soft"
          >
            <Trash2 size={15} /> Delete
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-ink"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
