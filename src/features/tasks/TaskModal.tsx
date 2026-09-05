import { useRef, useState } from 'react'
import { X, Trash2, Plus, Paperclip, Link2, Upload, FileText, Loader2, Archive, ArchiveRestore } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { ensureSubfolder, SHARED_FOLDER_ID, uploadToDrive } from '../../lib/googleDrive'
import {
  LABELS,
  PRIORITY_META,
  STATUS_COLUMNS,
  type Project,
  type Subtask,
  type Task,
  type TaskAttachment,
  type TaskPriority,
  type TaskStatus,
  type UserProfile,
} from '../../lib/types'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export function TaskModal({
  task,
  members,
  projects,
  onClose,
  onPatch,
  onDelete,
  onArchive,
}: {
  task: Task
  members: UserProfile[]
  projects: Project[]
  onClose: () => void
  onPatch: (id: string, patch: Partial<Task>) => void
  onDelete: (id: string) => void
  onArchive: (id: string, archived: boolean) => void
}) {
  const { user, profile } = useAuth()
  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description ?? '')
  const [newSub, setNewSub] = useState('')
  const [uploading, setUploading] = useState(false)
  const [addingLink, setAddingLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkName, setLinkName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const labels = task.labels ?? []
  const subtasks = task.subtasks ?? []
  const attachments = task.attachments ?? []

  const addAttachment = (a: TaskAttachment) =>
    onPatch(task.id, { attachments: [...attachments, a] })
  const removeAttachment = (id: string) =>
    onPatch(task.id, { attachments: attachments.filter((a) => a.id !== id) })

  const onUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 25 * 1024 * 1024) return alert('Please choose a file under 25 MB.')
    setUploading(true)
    try {
      // Task submissions are backed up in the shared Google Drive folder.
      const subId = await ensureSubfolder(SHARED_FOLDER_ID, 'Mahigos — Task Submissions')
      const uploaded = await uploadToDrive(subId, file)
      addAttachment({
        id: uid(),
        name: uploaded.name,
        url: uploaded.webViewLink ?? '',
        kind: 'file',
        fileType: file.type,
        size: file.size,
        addedByName: profile?.displayName ?? '',
      })
    } catch (err) {
      alert(`Drive upload failed: ${(err as Error).message}. Try “Connect Google Drive” in Files first.`)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const submitLink = () => {
    if (!linkUrl.trim()) return
    addAttachment({
      id: uid(),
      name: linkName.trim() || linkUrl.trim(),
      url: linkUrl.trim(),
      kind: 'link',
      addedByName: profile?.displayName ?? '',
    })
    setLinkUrl('')
    setLinkName('')
    setAddingLink(false)
  }

  const toggleLabel = (id: string) => {
    const next = labels.includes(id) ? labels.filter((l) => l !== id) : [...labels, id]
    onPatch(task.id, { labels: next })
  }

  const addSub = () => {
    const text = newSub.trim()
    if (!text) return
    const next: Subtask[] = [...subtasks, { id: uid(), text, done: false }]
    onPatch(task.id, { subtasks: next })
    setNewSub('')
  }
  const toggleSub = (id: string) =>
    onPatch(task.id, {
      subtasks: subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s)),
    })
  const removeSub = (id: string) =>
    onPatch(task.id, { subtasks: subtasks.filter((s) => s.id !== id) })

  const subDone = subtasks.filter((s) => s.done).length

  const field =
    'w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-ink outline-none focus:border-brand'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 max-h-[88vh] w-full max-w-lg animate-rise overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() =>
              title.trim() && title !== task.title && onPatch(task.id, { title: title.trim() })
            }
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
          rows={3}
          className="mt-3 w-full resize-none rounded-lg border border-border bg-bg p-3 text-sm text-ink outline-none focus:border-brand"
        />

        <div className="mt-4 grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Status</span>
            <select
              value={task.status}
              onChange={(e) => onPatch(task.id, { status: e.target.value as TaskStatus })}
              className={field}
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
              className={field}
            >
              {Object.entries(PRIORITY_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Project</span>
            <select
              value={task.projectId ?? ''}
              onChange={(e) => onPatch(task.id, { projectId: e.target.value || null })}
              className={field}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
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
              className={field}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="col-span-2 block">
            <span className="mb-1 block text-xs font-medium text-muted">Due date</span>
            <input
              type="date"
              value={task.dueDate ?? ''}
              onChange={(e) => onPatch(task.id, { dueDate: e.target.value || null })}
              className={field}
            />
          </label>
        </div>

        {/* Labels */}
        <div className="mt-4">
          <span className="mb-1.5 block text-xs font-medium text-muted">Labels</span>
          <div className="flex flex-wrap gap-1.5">
            {LABELS.map((l) => {
              const on = labels.includes(l.id)
              return (
                <button
                  key={l.id}
                  onClick={() => toggleLabel(l.id)}
                  className="rounded-full border px-2.5 py-1 text-xs font-semibold transition"
                  style={{
                    borderColor: on ? l.color : 'var(--border)',
                    background: on ? l.color + '22' : 'transparent',
                    color: on ? l.color : 'var(--text-muted)',
                  }}
                >
                  {l.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Subtasks */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-muted">
              Checklist{' '}
              {subtasks.length > 0 && (
                <span className="ml-1">
                  ({subDone}/{subtasks.length})
                </span>
              )}
            </span>
          </div>
          {subtasks.length > 0 && (
            <>
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-ok transition-all"
                  style={{ width: `${(subDone / subtasks.length) * 100}%` }}
                />
              </div>
              <ul className="mb-2 space-y-1">
                {subtasks.map((s) => (
                  <li key={s.id} className="group flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={s.done}
                      onChange={() => toggleSub(s.id)}
                      className="h-3.5 w-3.5 accent-brand"
                    />
                    <span
                      className={`flex-1 text-sm ${s.done ? 'text-muted line-through' : 'text-ink'}`}
                    >
                      {s.text}
                    </span>
                    <button
                      onClick={() => removeSub(s.id)}
                      className="text-muted opacity-0 transition hover:text-brand group-hover:opacity-100"
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="flex items-center gap-2">
            <input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSub()}
              placeholder="Add a checklist item…"
              className="flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand"
            />
            <button
              onClick={addSub}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted transition hover:border-brand/40 hover:text-brand"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        {/* Attachments / submission bin */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <Paperclip size={13} /> Attachments &amp; submissions
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted transition hover:border-brand/40 hover:text-brand disabled:opacity-60"
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                Upload
              </button>
              <button
                onClick={() => setAddingLink((v) => !v)}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted transition hover:border-brand/40 hover:text-brand"
              >
                <Link2 size={12} /> Link
              </button>
              <input ref={fileRef} type="file" onChange={onUploadFile} className="hidden" />
            </div>
          </div>

          {addingLink && (
            <div className="mb-2 space-y-1.5 rounded-lg border border-border p-2">
              <input
                autoFocus
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…  (Google Doc, Drive, etc.)"
                className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-brand"
              />
              <div className="flex gap-1.5">
                <input
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder="Label (optional)"
                  className="flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-brand"
                />
                <button onClick={submitLink} className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white">
                  Add
                </button>
              </div>
            </div>
          )}

          {attachments.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-3 text-center text-xs text-muted">
              Drop files or links here for this task.
            </p>
          ) : (
            <ul className="space-y-1">
              {attachments.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded-lg border border-border bg-bg px-2.5 py-1.5">
                  {a.kind === 'link' ? (
                    <Link2 size={14} className="shrink-0 text-brand" />
                  ) : (
                    <FileText size={14} className="shrink-0 text-brand" />
                  )}
                  <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm text-ink hover:text-brand hover:underline">
                    {a.name}
                  </a>
                  <button onClick={() => removeAttachment(a.id)} className="text-muted transition hover:text-brand">
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onDelete(task.id)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-brand transition hover:bg-brand-soft"
            >
              <Trash2 size={15} /> Delete
            </button>
            <button
              onClick={() => {
                onArchive(task.id, !task.archived)
                onClose()
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-ink"
            >
              {task.archived ? (
                <>
                  <ArchiveRestore size={15} /> Unarchive
                </>
              ) : (
                <>
                  <Archive size={15} /> Archive
                </>
              )}
            </button>
          </div>
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
