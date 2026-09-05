import { toISO } from '../../lib/dates'
import type { Task } from '../../lib/types'

export type DueState = 'none' | 'overdue' | 'today' | 'soon' | 'later'

const DAY = 86_400_000

/** Classify a task's due date relative to today (soon = within 3 days). */
export function dueState(task: Pick<Task, 'dueDate' | 'status'>): DueState {
  if (!task.dueDate) return 'none'
  if (task.status === 'done') return 'none'
  const today = new Date(toISO(new Date()) + 'T00:00:00').getTime()
  const due = new Date(task.dueDate + 'T00:00:00').getTime()
  const diff = Math.round((due - today) / DAY)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 3) return 'soon'
  return 'later'
}

export const DUE_STYLE: Record<DueState, string> = {
  none: 'text-muted',
  overdue: 'text-brand',
  today: 'text-brand',
  soon: 'text-[#c07a12]',
  later: 'text-muted',
}

export function dueLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export interface TaskFilters {
  projectId: string | 'all'
  search: string
  assignee: string | 'all'
  label: string | 'all'
  due: 'all' | 'overdue' | 'active' // active = has a due date and not done
}

export const EMPTY_FILTERS: TaskFilters = {
  projectId: 'all',
  search: '',
  assignee: 'all',
  label: 'all',
  due: 'all',
}

export function applyFilters(tasks: Task[], f: TaskFilters): Task[] {
  const q = f.search.trim().toLowerCase()
  return tasks.filter((t) => {
    if (t.archived) return false // archived tasks live in their own view
    if (f.projectId !== 'all') {
      const pid = t.projectId ?? '__none__'
      if (pid !== f.projectId) return false
    }
    if (f.assignee !== 'all') {
      if (f.assignee === '__none__' ? t.assigneeUid : t.assigneeUid !== f.assignee) return false
    }
    if (f.label !== 'all' && !(t.labels ?? []).includes(f.label)) return false
    if (f.due === 'overdue' && dueState(t) !== 'overdue') return false
    if (f.due === 'active' && !t.dueDate) return false
    if (q) {
      const hay = `${t.title} ${t.description ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export function filtersActive(f: TaskFilters): boolean {
  return (
    f.projectId !== 'all' ||
    f.assignee !== 'all' ||
    f.label !== 'all' ||
    f.due !== 'all' ||
    f.search.trim() !== ''
  )
}
