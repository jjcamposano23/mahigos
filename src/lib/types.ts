import type { Timestamp } from 'firebase/firestore'

export type Role = 'admin' | 'member'

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: Role
  title?: string
  photoURL?: string // uploaded avatar image
  avatar?: string // preset Bicol avatar id (see AVATAR_PRESETS)
  mustChangePassword?: boolean
  createdAt?: Timestamp
}

export type TaskStatus = 'backlog' | 'todo' | 'doing' | 'review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  assigneeUid?: string | null
  assigneeName?: string | null
  dueDate?: string | null // ISO date
  order: number
  createdBy: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export const STATUS_COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'todo', label: 'To Do' },
  { key: 'doing', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
]

export const PRIORITY_META: Record<TaskPriority, { label: string; dot: string }> = {
  low: { label: 'Low', dot: '#8a8f98' },
  medium: { label: 'Medium', dot: '#2f8f6b' },
  high: { label: 'High', dot: '#e8a33d' },
  urgent: { label: 'Urgent', dot: '#ef3422' },
}

export type EventType = 'meeting' | 'deadline' | 'event' | 'reminder' | 'holiday'

export interface CalendarEvent {
  id: string
  title: string
  date: string // ISO yyyy-mm-dd
  time?: string | null // HH:mm
  type: EventType
  notes?: string
  createdBy: string
  createdAt?: Timestamp
}

export const EVENT_META: Record<EventType, { label: string; color: string }> = {
  meeting: { label: 'Meeting', color: '#2f6df0' },
  deadline: { label: 'Deadline', color: '#ef3422' },
  event: { label: 'Event', color: '#2f8f6b' },
  reminder: { label: 'Reminder', color: '#e8a33d' },
  holiday: { label: 'Holiday', color: '#8b5cf6' },
}
