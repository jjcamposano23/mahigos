import { useMemo, useState } from 'react'
import { Plus, CalendarDays, CheckSquare, Paperclip } from 'lucide-react'
import { Avatar } from '../../components/Avatar'
import {
  LABEL_MAP,
  PRIORITY_META,
  STATUS_COLUMNS,
  type Project,
  type Task,
  type TaskStatus,
  type UserProfile,
} from '../../lib/types'
import { DUE_STYLE, dueLabel, dueState, taskAssignees } from './taskUtils'

export function Board({
  tasks,
  memberMap,
  projectMap,
  onMove,
  onOpen,
  onQuickAdd,
}: {
  tasks: Task[]
  memberMap: Record<string, UserProfile>
  projectMap: Record<string, Project>
  onMove: (id: string, status: TaskStatus) => void
  onOpen: (t: Task) => void
  onQuickAdd: (status: TaskStatus, title: string) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null)
  const [adding, setAdding] = useState<TaskStatus | null>(null)
  const [title, setTitle] = useState('')

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      backlog: [],
      todo: [],
      doing: [],
      review: [],
      done: [],
    }
    for (const t of tasks) (map[t.status] ?? map.backlog).push(t)
    // Within each column, sort by due date (nearest first); undated last.
    const cmp = (a: Task, b: Task) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return (a.order ?? 0) - (b.order ?? 0)
    }
    for (const k of Object.keys(map) as TaskStatus[]) map[k].sort(cmp)
    return map
  }, [tasks])

  const submitAdd = (status: TaskStatus) => {
    if (title.trim()) onQuickAdd(status, title.trim())
    setTitle('')
    setAdding(null)
  }

  return (
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
            onDrop={() => {
              if (dragId) onMove(dragId, col.key)
              setDragId(null)
              setDragOver(null)
            }}
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
                <TaskCard
                  key={t.id}
                  task={t}
                  memberMap={memberMap}
                  project={t.projectId ? projectMap[t.projectId] : undefined}
                  dragging={dragId === t.id}
                  onDragStart={() => setDragId(t.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => onOpen(t)}
                />
              ))}

              {adding === col.key ? (
                <div className="rounded-lg border border-brand/40 bg-surface p-2">
                  <textarea
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        submitAdd(col.key)
                      }
                      if (e.key === 'Escape') setAdding(null)
                    }}
                    placeholder="Task title…"
                    rows={2}
                    className="w-full resize-none bg-transparent text-sm text-ink outline-none"
                  />
                  <div className="mt-1 flex gap-2">
                    <button
                      onClick={() => submitAdd(col.key)}
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
                    setTitle('')
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
  )
}

function TaskCard({
  task,
  memberMap,
  project,
  dragging,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  task: Task
  memberMap: Record<string, UserProfile>
  project?: Project
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onClick: () => void
}) {
  const assignees = taskAssignees(task)
  const labels = (task.labels ?? []).map((id) => LABEL_MAP[id]).filter(Boolean)
  const subDone = (task.subtasks ?? []).filter((s) => s.done).length
  const subTotal = (task.subtasks ?? []).length
  const due = dueState(task)

  return (
    <button
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`hover-lift w-full cursor-grab rounded-lg border border-border bg-surface p-3 text-left shadow-sm transition hover:border-brand/40 active:cursor-grabbing ${
        dragging ? 'opacity-50' : ''
      }`}
    >
      {project && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: project.color }} />
          <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted">
            {project.name}
          </span>
        </div>
      )}

      {labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {labels.map((l) => (
            <span
              key={l.id}
              className="rounded px-1.5 py-0.5 text-[0.6rem] font-semibold"
              style={{ background: l.color + '22', color: l.color }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2">
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{ background: PRIORITY_META[task.priority].dot }}
          title={PRIORITY_META[task.priority].label}
        />
        <span className="text-sm text-ink">{task.title}</span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 pl-4">
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <span className={`flex items-center gap-1 text-[0.7rem] ${DUE_STYLE[due]}`}>
              <CalendarDays size={12} />
              {dueLabel(task.dueDate)}
              {due === 'overdue' && ' · overdue'}
            </span>
          )}
          {subTotal > 0 && (
            <span className="flex items-center gap-1 text-[0.7rem] text-muted">
              <CheckSquare size={12} />
              {subDone}/{subTotal}
            </span>
          )}
          {(task.attachments?.length ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-[0.7rem] text-muted">
              <Paperclip size={11} />
              {task.attachments!.length}
            </span>
          )}
        </div>
        {assignees.length > 0 && (
          <div className="flex -space-x-1.5">
            {assignees.slice(0, 3).map((a) => (
              <Avatar
                key={a.uid}
                profile={memberMap[a.uid] ?? { displayName: a.name }}
                size={20}
                rounded="rounded-full"
                className="ring-2 ring-surface"
              />
            ))}
            {assignees.length > 3 && (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-surface-2 text-[0.6rem] font-semibold text-muted ring-2 ring-surface">
                +{assignees.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  )
}
