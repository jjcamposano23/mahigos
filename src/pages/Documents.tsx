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
  FileText,
  Link2,
  Upload,
  Plus,
  Trash2,
  ExternalLink,
  Eye,
  X,
  Search,
  Loader2,
  Pencil,
  FolderOpen,
  Cloud,
} from 'lucide-react'
import { DriveBrowser } from '../features/docs/DriveBrowser'
import { db, storage } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import type { DocProvider, DocResource, Project } from '../lib/types'
import {
  detectFileProvider,
  detectLinkProvider,
  PROVIDER_META,
  previewUrl,
} from '../features/docs/provider'

function fmtSize(n?: number) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
function ago(ms?: number) {
  if (!ms) return ''
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(ms).toLocaleDateString()
}

export function Documents() {
  const { user, profile } = useAuth()
  const [resources, setResources] = useState<DocResource[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState<string | 'all'>('all')
  const [showLink, setShowLink] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<DocResource | null>(null)
  const [editing, setEditing] = useState<DocResource | null>(null)
  const [tab, setTab] = useState<'drive' | 'library'>('drive')
  const fileRef = useRef<HTMLInputElement>(null)

  const tabCls = (a: boolean) =>
    `flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
      a ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'
    }`

  useEffect(() => {
    const unsubR = onSnapshot(collection(db, 'documents'), (snap) =>
      setResources(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<DocResource, 'id'>) }))
          .filter((r) => r.kind) // only new-style resources
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)),
      ),
    )
    const unsubP = onSnapshot(collection(db, 'projects'), (snap) =>
      setProjects(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Project, 'id'>) }))),
    )
    return () => {
      unsubR()
      unsubP()
    }
  }, [])

  const projectMap = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects],
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return resources.filter((r) => {
      if (projectFilter !== 'all' && (r.projectId ?? '') !== projectFilter) return false
      if (q && !`${r.title} ${r.fileName ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [resources, search, projectFilter])

  const addLink = async (url: string, title: string, projectId: string | null) => {
    const provider = detectLinkProvider(url)
    await addDoc(collection(db, 'documents'), {
      title: title.trim() || url,
      kind: 'link',
      url: url.trim(),
      provider,
      projectId,
      addedBy: user?.uid ?? '',
      addedByName: profile?.displayName ?? 'Member',
      createdAt: serverTimestamp(),
    })
  }

  const uploadFile = async (file: File, projectId: string | null) => {
    if (!file || !user) return
    if (file.size > 25 * 1024 * 1024) {
      alert('Please choose a file under 25 MB.')
      return
    }
    setUploading(true)
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const r = storageRef(storage, `library/${user.uid}/${Date.now()}-${safe}`)
      await uploadBytes(r, file)
      const url = await getDownloadURL(r)
      await addDoc(collection(db, 'documents'), {
        title: file.name,
        kind: 'file',
        url,
        provider: detectFileProvider(file.name, file.type) as DocProvider,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        projectId,
        addedBy: user.uid,
        addedByName: profile?.displayName ?? 'Member',
        createdAt: serverTimestamp(),
      })
    } catch {
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void uploadFile(file, projectFilter === 'all' ? null : projectFilter)
  }

  const moveResource = (id: string, projectId: string | null) =>
    void updateDoc(doc(db, 'documents', id), { projectId })

  // Folders use the same values as projectFilter: 'all', '' (Unfiled), or a project id.
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const folderProjectId = (folder: string) => (folder === 'all' || folder === '' ? null : folder)
  const handleFolderDrop = (folder: string, e: React.DragEvent) => {
    e.preventDefault()
    setDropTarget(null)
    const pid = folderProjectId(folder)
    if (e.dataTransfer.files.length) {
      for (const f of Array.from(e.dataTransfer.files)) void uploadFile(f, pid)
      return
    }
    const id = e.dataTransfer.getData('text/mahigos-doc')
    if (id && folder !== 'all') moveResource(id, pid)
  }

  const folderCount = (folder: string) =>
    folder === 'all'
      ? resources.length
      : folder === ''
        ? resources.filter((r) => !r.projectId).length
        : resources.filter((r) => r.projectId === folder).length

  const remove = async (r: DocResource) => {
    if (!confirm(`Remove “${r.title}” from the library?`)) return
    await deleteDoc(doc(db, 'documents', r.id))
  }

  const saveEdit = async (id: string, patch: { title: string; projectId: string | null }) => {
    await updateDoc(doc(db, 'documents', id), patch)
    setEditing(null)
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Files</h1>
        <p className="text-sm text-muted">Central repository of files and links for UP Ibalon.</p>
      </div>

      <div className="mt-4 flex gap-1 border-b border-border">
        <button onClick={() => setTab('drive')} className={tabCls(tab === 'drive')}>
          <Cloud size={15} /> Shared Drive
        </button>
        <button onClick={() => setTab('library')} className={tabCls(tab === 'library')}>
          <FolderOpen size={15} /> Uploads &amp; Links
        </button>
      </div>

      {tab === 'drive' && <DriveBrowser />}

      {tab === 'library' && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search files…"
                className="w-full max-w-xs rounded-lg border border-border bg-surface py-2 pl-8 pr-2 text-sm text-ink outline-none focus:border-brand"
              />
            </div>
            <button
              onClick={() => setShowLink(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink transition hover:border-brand/40"
            >
              <Link2 size={15} /> Add link
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-ink disabled:opacity-60"
            >
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              Upload file
            </button>
            <input ref={fileRef} type="file" onChange={onUpload} className="hidden" />
          </div>

          {/* Folders (by project). Click to open; drag files or cards onto one. */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { key: 'all', name: 'All files', color: '#6b7280' },
              { key: '', name: 'Unfiled', color: '#9ca3af' },
              ...projects.map((p) => ({ key: p.id, name: p.name, color: p.color })),
            ].map((f) => {
              const active = projectFilter === f.key
              const isDrop = dropTarget === f.key
              return (
                <button
                  key={f.key || 'unfiled'}
                  onClick={() => setProjectFilter(f.key)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDropTarget(f.key)
                  }}
                  onDragLeave={() => setDropTarget((t) => (t === f.key ? null : t))}
                  onDrop={(e) => handleFolderDrop(f.key, e)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    isDrop
                      ? 'border-brand bg-brand-soft ring-2 ring-brand/40'
                      : active
                        ? 'border-brand bg-brand-soft text-brand'
                        : 'border-border bg-surface text-muted hover:text-ink'
                  }`}
                >
                  <FolderOpen size={15} style={{ color: f.color }} />
                  {f.name}
                  <span className="rounded-full bg-surface-2 px-1.5 text-xs">{folderCount(f.key)}</span>
                </button>
              )
            })}
          </div>

      {visible.length === 0 ? (
        <div className="mt-16 text-center">
          <FileText size={30} className="mx-auto mb-2 text-brand/40" />
          <p className="text-sm text-muted">
            No documents yet. Paste a Google Docs link or upload a file to get started.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((r) => {
            const meta = PROVIDER_META[r.provider]
            const pv = r.kind === 'file' ? previewUrl(r.url, r.provider) : null
            const project = r.projectId ? projectMap[r.projectId] : undefined
            return (
              <div
                key={r.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/mahigos-doc', r.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                className="hover-lift group flex flex-col rounded-xl border border-border bg-surface p-4"
                title="Drag onto a folder to move it"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white"
                    style={{ background: meta.color }}
                  >
                    {r.kind === 'link' ? <Link2 size={18} /> : <FileText size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink" title={r.title}>
                      {r.title}
                    </div>
                    <div className="mt-0.5 text-[0.7rem] text-muted">
                      {meta.label}
                      {r.fileSize ? ` · ${fmtSize(r.fileSize)}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button onClick={() => setEditing(r)} title="Edit details" className="text-muted hover:text-ink">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => remove(r)} title="Remove" className="text-muted hover:text-brand">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {project && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: project.color }} />
                    <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted">
                      {project.name}
                    </span>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted">
                  <span className="flex-1 truncate">
                    {r.addedByName} · {ago(r.createdAt?.toMillis?.())}
                  </span>
                  {pv && (
                    <button
                      onClick={() => setPreview(r)}
                      title="Preview"
                      className="text-muted transition hover:text-brand"
                    >
                      <Eye size={15} />
                    </button>
                  )}
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    title="Open"
                    className="text-muted transition hover:text-brand"
                  >
                    <ExternalLink size={15} />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}
        </>
      )}

      {showLink && (
        <LinkModal projects={projects} onClose={() => setShowLink(false)} onAdd={addLink} />
      )}
      {editing && (
        <EditModal
          resource={editing}
          projects={projects}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}
      {preview && <PreviewModal resource={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

function EditModal({
  resource,
  projects,
  onClose,
  onSave,
}: {
  resource: DocResource
  projects: Project[]
  onClose: () => void
  onSave: (id: string, patch: { title: string; projectId: string | null }) => Promise<void>
}) {
  const [title, setTitle] = useState(resource.title)
  const [projectId, setProjectId] = useState(resource.projectId ?? '')
  const [busy, setBusy] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-rise rounded-2xl border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink">Edit details</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Name</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Project</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-ink outline-none focus:border-brand"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {resource.kind === 'file' && resource.fileName && (
            <p className="text-xs text-muted">File: {resource.fileName}</p>
          )}
          <button
            onClick={async () => {
              if (!title.trim()) return
              setBusy(true)
              await onSave(resource.id, { title: title.trim(), projectId: projectId || null })
            }}
            disabled={busy || !title.trim()}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-ink disabled:opacity-50"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}

function LinkModal({
  projects,
  onClose,
  onAdd,
}: {
  projects: Project[]
  onClose: () => void
  onAdd: (url: string, title: string, projectId: string | null) => Promise<void>
}) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!url.trim()) return
    setBusy(true)
    await onAdd(url.trim(), title, projectId || null)
    setBusy(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-rise rounded-2xl border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink">Add a link</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">
          Paste a Google Docs / Sheets / Drive link, or any web URL.
        </p>
        <div className="mt-4 space-y-3">
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/…"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-ink outline-none focus:border-brand"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={submit}
            disabled={busy || !url.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-ink disabled:opacity-50"
          >
            <Plus size={16} /> Add to library
          </button>
        </div>
      </div>
    </div>
  )
}

function PreviewModal({ resource, onClose }: { resource: DocResource; onClose: () => void }) {
  const pv = previewUrl(resource.url, resource.provider)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="truncate text-sm font-semibold text-ink">{resource.title}</span>
          <div className="flex items-center gap-2">
            <a
              href={resource.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
            >
              <ExternalLink size={13} /> Open
            </a>
            <button onClick={onClose} className="text-muted hover:text-ink">
              <X size={20} />
            </button>
          </div>
        </div>
        {resource.provider === 'image' ? (
          <div className="grid flex-1 place-items-center overflow-auto bg-bg p-4">
            <img src={resource.url} alt={resource.title} className="max-h-full max-w-full" />
          </div>
        ) : (
          <iframe title={resource.title} src={pv ?? resource.url} className="flex-1 bg-white" />
        )}
      </div>
    </div>
  )
}
