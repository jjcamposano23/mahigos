import { useState } from 'react'
import { Plus, Trash2, Check, X, LayoutGrid } from 'lucide-react'
import type { Project } from '../../lib/types'
import { PROJECT_COLORS } from '../../lib/types'

export function ProjectBar({
  projects,
  selected,
  counts,
  onSelect,
  onCreate,
  onDelete,
}: {
  projects: Project[]
  selected: string | 'all'
  counts: Record<string, number>
  onSelect: (id: string | 'all') => void
  onCreate: (name: string, color: string) => void
  onDelete: (id: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const create = () => {
    const n = name.trim()
    if (!n) return setAdding(false)
    const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length]
    onCreate(n, color)
    setName('')
    setAdding(false)
  }

  const pill = (active: boolean) =>
    `flex items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
      active
        ? 'border-brand bg-brand-soft text-brand'
        : 'border-border bg-surface text-muted hover:text-ink'
    }`

  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-surface px-6 py-2.5">
      <button onClick={() => onSelect('all')} className={pill(selected === 'all')}>
        <LayoutGrid size={15} />
        All tasks
        <span className="rounded-full bg-surface-2 px-1.5 text-xs">{counts.all ?? 0}</span>
      </button>

      {projects.map((p) => {
        const active = selected === p.id
        return (
          <div key={p.id} className={pill(active)}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
            <button onClick={() => onSelect(p.id)} className="whitespace-nowrap">
              {p.name}
            </button>
            <span className="rounded-full bg-surface-2 px-1.5 text-xs">{counts[p.id] ?? 0}</span>
            {active && (
              <button
                onClick={() => {
                  if (confirm(`Delete project “${p.name}”? Its tasks will move to “All tasks”.`))
                    onDelete(p.id)
                }}
                className="ml-0.5 text-muted transition hover:text-brand"
                title="Delete project"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )
      })}

      {adding ? (
        <div className="flex items-center gap-1 rounded-lg border border-brand/40 bg-surface px-2 py-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') create()
              if (e.key === 'Escape') setAdding(false)
            }}
            placeholder="Project name"
            className="w-32 bg-transparent text-sm text-ink outline-none"
          />
          <button onClick={create} className="text-brand" title="Create">
            <Check size={15} />
          </button>
          <button onClick={() => setAdding(false)} className="text-muted" title="Cancel">
            <X size={15} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-brand"
        >
          <Plus size={15} /> New project
        </button>
      )}
    </div>
  )
}
