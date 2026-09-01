import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { X, History, RotateCcw } from 'lucide-react'
import { db } from '../../lib/firebase'
import type { DocVersion } from '../../lib/types'

function when(ms?: number) {
  if (!ms) return ''
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function DocVersions({
  docId,
  onClose,
  onRestore,
}: {
  docId: string
  onClose: () => void
  onRestore: (content: string) => void
}) {
  const [versions, setVersions] = useState<DocVersion[]>([])
  const [preview, setPreview] = useState<DocVersion | null>(null)

  useEffect(() => {
    return onSnapshot(collection(db, 'documents', docId, 'versions'), (snap) =>
      setVersions(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<DocVersion, 'id'>) }))
          .sort((a, b) => (b.savedAt?.toMillis?.() ?? 0) - (a.savedAt?.toMillis?.() ?? 0)),
      ),
    )
  }, [docId])

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
          <History size={16} /> Version history
        </h3>
        <button onClick={onClose} className="text-muted hover:text-ink">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {versions.length === 0 && (
          <p className="pt-6 text-center text-sm text-muted">
            No saved versions yet. Use “Save version” to snapshot this document.
          </p>
        )}
        {versions.map((v) => (
          <div key={v.id} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">{when(v.savedAt?.toMillis?.())}</span>
              <button
                onClick={() => {
                  if (confirm('Restore this version? Current content will be replaced.'))
                    onRestore(v.content)
                }}
                title="Restore"
                className="flex items-center gap-1 text-xs text-brand transition hover:underline"
              >
                <RotateCcw size={12} /> Restore
              </button>
            </div>
            <div className="text-xs text-muted">by {v.savedByName}</div>
            <button
              onClick={() => setPreview(preview?.id === v.id ? null : v)}
              className="mt-1 text-xs text-muted transition hover:text-brand"
            >
              {preview?.id === v.id ? 'Hide preview' : 'Preview'}
            </button>
            {preview?.id === v.id && (
              <div
                className="doc-editor mt-2 max-h-40 overflow-y-auto rounded-md border border-border bg-bg p-2 text-xs"
                dangerouslySetInnerHTML={{ __html: v.content }}
              />
            )}
          </div>
        ))}
      </div>
    </aside>
  )
}
