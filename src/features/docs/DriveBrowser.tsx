import { useCallback, useEffect, useState } from 'react'
import {
  Folder,
  FileText,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Loader2,
  Cloud,
  AlertCircle,
} from 'lucide-react'
import {
  connectDrive,
  isDriveConnected,
  listFolder,
  SHARED_FOLDER_ID,
  type DriveFile,
} from '../../lib/googleDrive'

function fmtSize(n?: number) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const DRIVE_FOLDER_LINK =
  'https://drive.google.com/drive/folders/1t7Tq6M0yrkMRsEW8tC-XAD8Y2eLv209h'

export function DriveBrowser() {
  const [connected, setConnected] = useState(isDriveConnected())
  const [path, setPath] = useState<{ id: string; name: string }[]>([
    { id: SHARED_FOLDER_ID, name: 'Shared Drive' },
  ])
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = path[path.length - 1]

  const load = useCallback(async (folderId: string) => {
    setLoading(true)
    setError(null)
    try {
      setFiles(await listFolder(folderId))
    } catch (e) {
      setError((e as Error).message || 'Could not load the Drive folder.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (connected) void load(current.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, current.id])

  const connect = async () => {
    setError(null)
    try {
      await connectDrive(true)
      setConnected(true)
    } catch {
      setError('Google Drive access was not granted.')
    }
  }

  if (!connected) {
    return (
      <div className="mt-10 grid place-items-center text-center">
        <div className="max-w-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Cloud size={28} />
          </div>
          <h3 className="mt-4 font-display text-lg font-bold text-ink">Connect Google Drive</h3>
          <p className="mt-1 text-sm text-muted">
            Sign in with Google to browse the UP Ibalon shared Drive folder right here. You only
            grant access once.
          </p>
          <button
            onClick={connect}
            className="mt-4 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-ink"
          >
            Connect Google Drive
          </button>
          {error && <p className="mt-3 text-xs text-brand">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4">
      {/* Breadcrumbs */}
      <div className="flex flex-wrap items-center gap-1 text-sm">
        {path.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="text-muted" />}
            <button
              onClick={() => setPath(path.slice(0, i + 1))}
              className={`rounded px-1.5 py-0.5 transition hover:bg-surface-2 ${
                i === path.length - 1 ? 'font-semibold text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {p.name}
            </button>
          </span>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => load(current.id)}
          title="Refresh"
          className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted transition hover:border-brand/40 hover:text-brand"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
        <a
          href={DRIVE_FOLDER_LINK}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink transition hover:border-brand/40"
        >
          <ExternalLink size={14} /> Open in Drive
        </a>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-brand/30 bg-brand-soft px-3 py-2 text-sm text-brand-ink">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="mt-10 grid place-items-center text-muted">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : files.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">This folder is empty.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((f) =>
            f.isFolder ? (
              <button
                key={f.id}
                onClick={() => setPath([...path, { id: f.id, name: f.name }])}
                className="hover-lift flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Folder size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{f.name}</span>
                  <span className="text-[0.7rem] text-muted">Folder</span>
                </span>
                <ChevronRight size={16} className="text-muted" />
              </button>
            ) : (
              <a
                key={f.id}
                href={f.webViewLink}
                target="_blank"
                rel="noreferrer"
                className="hover-lift flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2">
                  {f.iconLink ? (
                    <img src={f.iconLink} alt="" className="h-5 w-5" />
                  ) : (
                    <FileText size={18} className="text-muted" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink" title={f.name}>
                    {f.name}
                  </span>
                  <span className="text-[0.7rem] text-muted">
                    {f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : ''}
                    {f.size ? ` · ${fmtSize(f.size)}` : ''}
                  </span>
                </span>
                <ExternalLink size={14} className="shrink-0 text-muted" />
              </a>
            ),
          )}
        </div>
      )}
    </div>
  )
}
