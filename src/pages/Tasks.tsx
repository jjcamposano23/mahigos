import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import type { Project, Task, TaskStatus, UserProfile } from '../lib/types'
import { Board } from '../features/tasks/Board'
import { ListView } from '../features/tasks/ListView'
import { ProjectBar } from '../features/tasks/ProjectBar'
import { FilterBar, type ViewMode } from '../features/tasks/FilterBar'
import { TaskModal } from '../features/tasks/TaskModal'
import { applyFilters, EMPTY_FILTERS, type TaskFilters } from '../features/tasks/taskUtils'

export function Tasks() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<UserProfile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS)
  const [view, setView] = useState<ViewMode>('board')
  const [selected, setSelected] = useState<Task | null>(null)

  useEffect(() => {
    const unsubT = onSnapshot(collection(db, 'tasks'), (snap) =>
      setTasks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) }))),
    )
    const unsubU = onSnapshot(collection(db, 'users'), (snap) =>
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }))),
    )
    const unsubP = onSnapshot(collection(db, 'projects'), (snap) =>
      setProjects(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Project, 'id'>) }))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      ),
    )
    return () => {
      unsubT()
      unsubU()
      unsubP()
    }
  }, [])

  // keep the selected task fresh as tasks stream in
  useEffect(() => {
    if (!selected) return
    const fresh = tasks.find((t) => t.id === selected.id)
    if (fresh && fresh !== selected) setSelected(fresh)
  }, [tasks, selected])

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.uid, m])),
    [members],
  )
  const projectMap = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects],
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tasks.length }
    for (const p of projects) c[p.id] = 0
    for (const t of tasks) if (t.projectId && c[t.projectId] !== undefined) c[t.projectId]++
    return c
  }, [tasks, projects])

  const visible = useMemo(() => applyFilters(tasks, filters), [tasks, filters])

  const archivedTasks = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return tasks
      .filter((t) => t.archived)
      .filter((t) => !q || `${t.title} ${t.description ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0))
  }, [tasks, filters.search])

  const patch = (patch: Partial<TaskFilters>) => setFilters((f) => ({ ...f, ...patch }))

  // ---- task ops ----
  const nextOrder = () => Math.max(0, ...tasks.map((t) => t.order ?? 0)) + 1

  const quickAdd = async (status: TaskStatus, title: string) => {
    await addDoc(collection(db, 'tasks'), {
      title,
      description: '',
      status,
      priority: 'medium',
      assigneeUid: null,
      assigneeName: null,
      dueDate: null,
      projectId: filters.projectId === 'all' ? null : filters.projectId,
      labels: [],
      subtasks: [],
      order: nextOrder(),
      createdBy: profile?.uid ?? '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  const newTask = async () => {
    const refDoc = await addDoc(collection(db, 'tasks'), {
      title: 'Untitled task',
      description: '',
      status: 'todo',
      priority: 'medium',
      assigneeUid: null,
      assigneeName: null,
      dueDate: null,
      projectId: filters.projectId === 'all' ? null : filters.projectId,
      labels: [],
      subtasks: [],
      order: nextOrder(),
      createdBy: profile?.uid ?? '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setSelected({
      id: refDoc.id,
      title: 'Untitled task',
      status: 'todo',
      priority: 'medium',
      order: 0,
      createdBy: profile?.uid ?? '',
      projectId: filters.projectId === 'all' ? null : filters.projectId,
    } as Task)
  }

  const move = async (id: string, status: TaskStatus) => {
    const t = tasks.find((x) => x.id === id)
    if (!t || t.status === status) return
    await updateDoc(doc(db, 'tasks', id), {
      status,
      completedAt: status === 'done' ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    })
  }

  const patchTask = async (id: string, p: Partial<Task>) => {
    const extra: Record<string, unknown> = { ...p, updatedAt: serverTimestamp() }
    if (p.status) extra.completedAt = p.status === 'done' ? serverTimestamp() : null
    await updateDoc(doc(db, 'tasks', id), extra)
    setSelected((s) => (s && s.id === id ? { ...s, ...p } : s))
  }

  const removeTask = async (id: string) => {
    await deleteDoc(doc(db, 'tasks', id))
    setSelected(null)
  }

  const setArchived = async (id: string, archived: boolean) => {
    await updateDoc(doc(db, 'tasks', id), { archived, updatedAt: serverTimestamp() })
    setSelected((s) => (s && s.id === id ? { ...s, archived } : s))
  }

  // ---- project ops ----
  const createProject = async (name: string, color: string) => {
    const refDoc = await addDoc(collection(db, 'projects'), {
      name,
      color,
      order: projects.length,
      createdBy: profile?.uid ?? '',
      createdAt: serverTimestamp(),
    })
    patch({ projectId: refDoc.id })
  }

  const deleteProject = async (id: string) => {
    const q = query(collection(db, 'tasks'), where('projectId', '==', id))
    const snap = await getDocs(q)
    await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { projectId: null })))
    await deleteDoc(doc(db, 'projects', id))
    setFilters((f) => (f.projectId === id ? { ...f, projectId: 'all' } : f))
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-surface px-6 pt-4">
        <h1 className="font-display text-xl font-bold text-ink">Tasks</h1>
        <p className="pb-3 text-xs text-muted">
          Organize work into projects, boards, and lists.
        </p>
      </div>

      <ProjectBar
        projects={projects}
        selected={filters.projectId}
        counts={counts}
        onSelect={(id) => patch({ projectId: id })}
        onCreate={createProject}
        onDelete={deleteProject}
      />

      <FilterBar
        filters={filters}
        members={members}
        view={view}
        archivedCount={tasks.filter((t) => t.archived).length}
        onChange={patch}
        onView={setView}
        onClear={() => setFilters(EMPTY_FILTERS)}
        onNew={newTask}
      />

      {view === 'board' ? (
        <Board
          tasks={visible}
          memberMap={memberMap}
          projectMap={projectMap}
          onMove={move}
          onOpen={setSelected}
          onQuickAdd={quickAdd}
        />
      ) : view === 'archived' ? (
        archivedTasks.length === 0 ? (
          <div className="grid flex-1 place-items-center px-6 py-16 text-center text-sm text-muted">
            <div>
              <p className="font-medium text-ink">No archived tasks</p>
              <p className="mt-1">
                Open any task and choose <span className="font-medium">Archive</span> to move it
                here. Archived tasks stay out of your boards but are never deleted.
              </p>
            </div>
          </div>
        ) : (
          <ListView
            tasks={archivedTasks}
            memberMap={memberMap}
            projectMap={projectMap}
            onOpen={setSelected}
          />
        )
      ) : (
        <ListView
          tasks={visible}
          memberMap={memberMap}
          projectMap={projectMap}
          onOpen={setSelected}
        />
      )}

      {selected && (
        <TaskModal
          task={selected}
          members={members}
          projects={projects}
          onClose={() => setSelected(null)}
          onPatch={patchTask}
          onDelete={removeTask}
          onArchive={setArchived}
        />
      )}
    </div>
  )
}
