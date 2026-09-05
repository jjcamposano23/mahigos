import { useMemo } from 'react'
import { CalendarDays, CheckSquare } from 'lucide-react'
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

export function ListView({
  tasks,
  memberMap,
  projectMap,
  onOpen,
}: {
  tasks: Task[]
  memberMap: Record<string, UserProfile>
  projectMap: Record<string, Project>
  onOpen: (t: Task) => void
}) {
  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      backlog: [],
      todo: [],
      doing: [],
      review: [],
      done: [],
    }
    for (const t of tasks) (map[t.status] ?? map.backlog).push(t)
    const cmp = (a: Task, b: Task) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return (a.order ?? 0) - (b.order ?? 0)
    }
    for (const k of Object.keys(map) as TaskStatus[]) map[k].sort(cmp)
    return map
  }, [tasks])

  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {STATUS_COLUMNS.map((col) => {
          const items = byStatus[col.key]
          if (items.length === 0) return null
          return (
            <div key={col.key}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <h3 className="text-sm font-semibold text-ink">{col.label}</h3>
                <span className="rounded-full bg-surface-2 px-1.5 text-xs text-muted">
                  {items.length}
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-surface">
                {items.map((t) => {
                  const labels = (t.labels ?? []).map((id) => LABEL_MAP[id]).filter(Boolean)
                  const project = t.projectId ? projectMap[t.projectId] : undefined
                  const due = dueState(t)
                  const subTotal = (t.subtasks ?? []).length
                  const subDone = (t.subtasks ?? []).filter((s) => s.done).length
                  return (
                    <button
                      key={t.id}
                      onClick={() => onOpen(t)}
                      className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left transition last:border-0 hover:bg-surface-2"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: PRIORITY_META[t.priority].dot }}
                        title={PRIORITY_META[t.priority].label}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{t.title}</span>
                        {(labels.length > 0 || project) && (
                          <span className="mt-0.5 flex flex-wrap items-center gap-1">
                            {project && (
                              <span className="flex items-center gap-1 text-[0.6rem] font-medium uppercase tracking-wide text-muted">
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ background: project.color }}
                                />
                                {project.name}
                              </span>
                            )}
                            {labels.map((l) => (
                              <span
                                key={l.id}
                                className="rounded px-1.5 py-0.5 text-[0.58rem] font-semibold"
                                style={{ background: l.color + '22', color: l.color }}
                              >
                                {l.name}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>

                      {subTotal > 0 && (
                        <span className="hidden items-center gap-1 text-[0.7rem] text-muted sm:flex">
                          <CheckSquare size={12} />
                          {subDone}/{subTotal}
                        </span>
                      )}
                      {t.dueDate && (
                        <span className={`flex items-center gap-1 text-[0.7rem] ${DUE_STYLE[due]}`}>
                          <CalendarDays size={12} />
                          {dueLabel(t.dueDate)}
                        </span>
                      )}
                      {(() => {
                        const who = taskAssignees(t)
                        if (who.length === 0) return <span className="h-[22px] w-[22px]" />
                        return (
                          <span className="flex -space-x-1.5">
                            {who.slice(0, 3).map((a) => (
                              <Avatar
                                key={a.uid}
                                profile={memberMap[a.uid] ?? { displayName: a.name }}
                                size={22}
                                rounded="rounded-full"
                                className="ring-2 ring-surface"
                              />
                            ))}
                            {who.length > 3 && (
                              <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-surface-2 text-[0.6rem] font-semibold text-muted ring-2 ring-surface">
                                +{who.length - 3}
                              </span>
                            )}
                          </span>
                        )
                      })()}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
