import { Search, KanbanSquare, List, X, Plus } from 'lucide-react'
import type { UserProfile } from '../../lib/types'
import { LABELS } from '../../lib/types'
import { filtersActive, type TaskFilters } from './taskUtils'

export type ViewMode = 'board' | 'list'

export function FilterBar({
  filters,
  members,
  view,
  onChange,
  onView,
  onClear,
  onNew,
}: {
  filters: TaskFilters
  members: UserProfile[]
  view: ViewMode
  onChange: (patch: Partial<TaskFilters>) => void
  onView: (v: ViewMode) => void
  onClear: () => void
  onNew: () => void
}) {
  const select =
    'rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand'

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-6 py-2.5">
      {/* view toggle */}
      <div className="flex rounded-lg border border-border p-0.5">
        <button
          onClick={() => onView('board')}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium transition ${
            view === 'board' ? 'bg-brand-soft text-brand' : 'text-muted hover:text-ink'
          }`}
        >
          <KanbanSquare size={15} /> Board
        </button>
        <button
          onClick={() => onView('list')}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium transition ${
            view === 'list' ? 'bg-brand-soft text-brand' : 'text-muted hover:text-ink'
          }`}
        >
          <List size={15} /> List
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Search tasks…"
          className="w-44 rounded-lg border border-border bg-surface py-1.5 pl-8 pr-2 text-sm text-ink outline-none focus:border-brand"
        />
      </div>

      <select
        value={filters.assignee}
        onChange={(e) => onChange({ assignee: e.target.value })}
        className={select}
      >
        <option value="all">Anyone</option>
        <option value="__none__">Unassigned</option>
        {members.map((m) => (
          <option key={m.uid} value={m.uid}>
            {m.displayName}
          </option>
        ))}
      </select>

      <select
        value={filters.label}
        onChange={(e) => onChange({ label: e.target.value })}
        className={select}
      >
        <option value="all">All labels</option>
        {LABELS.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>

      <select
        value={filters.due}
        onChange={(e) => onChange({ due: e.target.value as TaskFilters['due'] })}
        className={select}
      >
        <option value="all">Any due date</option>
        <option value="active">Has due date</option>
        <option value="overdue">Overdue</option>
      </select>

      {filtersActive(filters) && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted transition hover:text-brand"
        >
          <X size={14} /> Clear
        </button>
      )}

      <div className="flex-1" />

      <button
        onClick={onNew}
        className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-ink active:scale-[0.99]"
      >
        <Plus size={16} /> New task
      </button>
    </div>
  )
}
