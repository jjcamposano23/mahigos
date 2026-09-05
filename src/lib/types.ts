import type { Timestamp } from 'firebase/firestore'

export type Role = 'admin' | 'member'

export interface ScheduleBlock {
  day: number // 0 = Sun … 6 = Sat
  start: string // 'HH:MM' 24h
  end: string // 'HH:MM'
  title: string // subject / class code
  room?: string
}

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: Role
  title?: string
  photoURL?: string // uploaded avatar image
  avatar?: string // preset Bicol avatar id (see AVATAR_PRESETS)
  mustChangePassword?: boolean
  // Student Assistant details (from UP Form 5)
  program?: string
  college?: string
  studentNo?: string
  schedule?: ScheduleBlock[]
  lastActive?: Timestamp
  createdAt?: Timestamp
}

export interface Channel {
  id: string
  name: string
  description?: string
  kind: 'channel' | 'dm'
  members?: string[] // uids (for DMs)
  memberNames?: string[]
  createdBy: string
  order?: number
  createdAt?: Timestamp
}

export interface Message {
  id: string
  text: string
  authorUid: string
  authorName: string
  authorAvatar?: string | null
  authorPhotoURL?: string | null
  parentId?: string | null // set for thread replies
  replyCount?: number
  clipUrl?: string | null
  clipType?: 'audio' | 'video' | null
  edited?: boolean
  createdAt?: Timestamp
}

export type DocProvider =
  | 'google-docs'
  | 'google-sheets'
  | 'google-slides'
  | 'drive'
  | 'word'
  | 'pdf'
  | 'image'
  | 'link'
  | 'file'

export interface DocResource {
  id: string
  title: string
  kind: 'link' | 'file'
  url: string
  provider: DocProvider
  fileName?: string
  fileType?: string
  fileSize?: number
  projectId?: string | null
  addedBy: string
  addedByName: string
  createdAt?: Timestamp
}

export interface Whiteboard {
  id: string
  title: string
  createdBy: string
  updatedAt?: Timestamp
  createdAt?: Timestamp
}

export type BoardItemType =
  | 'note'
  | 'rect'
  | 'round'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'text'
  | 'arrow'
  | 'line'

export interface BoardItem {
  id: string
  type: BoardItemType
  x: number
  y: number
  w: number
  h: number
  x2?: number // arrow end point
  y2?: number
  text?: string
  color: string
  authorUid: string
}

// Sticky-note / shape fill palette (light, Miro-like)
export const NOTE_COLORS = ['#ffe08a', '#ffd0c7', '#c9ecd0', '#c7ddff', '#e6d2ff', '#ffffff']
// Stronger palette for arrows and text
export const STROKE_COLORS = ['#1c1a19', '#ef3422', '#2f6df0', '#2f8f6b', '#8b5cf6']

export interface BoardCursor {
  x: number
  y: number
  name: string
  color: string
  updatedAt?: Timestamp
}

// ─── Native calls (WebRTC, Firestore-signaled) ───────────────────────────────
export interface CallDoc {
  id: string
  title: string
  kind: 'room' | 'channel' | 'dm'
  channelId?: string | null
  createdBy: string
  createdByName: string
  status: 'active' | 'ended'
  startedAt?: Timestamp
  lastActive?: Timestamp
}

export interface CallParticipant {
  uid: string
  name: string
  avatar?: string | null
  photoURL?: string | null
  micOn: boolean
  camOn: boolean
  sharing: boolean
  joinedAt?: Timestamp
  lastSeen?: Timestamp
}

export interface CallSignal {
  id: string
  from: string
  to: string
  kind: 'offer' | 'answer' | 'candidate'
  payload: string // JSON-encoded SDP or ICE candidate
  createdAt?: Timestamp
}

export type TaskStatus = 'backlog' | 'todo' | 'doing' | 'review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Subtask {
  id: string
  text: string
  done: boolean
}

export interface TaskAttachment {
  id: string
  name: string
  url: string
  kind: 'file' | 'link'
  fileType?: string
  size?: number
  addedByName?: string
}

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  assigneeUid?: string | null
  assigneeName?: string | null
  dueDate?: string | null // ISO date
  projectId?: string | null
  labels?: string[] // label ids (see LABELS)
  subtasks?: Subtask[]
  attachments?: TaskAttachment[]
  archived?: boolean
  order: number
  createdBy: string
  completedAt?: Timestamp | null
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface Project {
  id: string
  name: string
  color: string
  order: number
  createdBy: string
  createdAt?: Timestamp
}

export const PROJECT_COLORS = [
  '#ef3422',
  '#2f6df0',
  '#2f8f6b',
  '#e8a33d',
  '#8b5cf6',
  '#0ea5a4',
  '#d8371f',
  '#6b7280',
]

export interface LabelDef {
  id: string
  name: string
  color: string
}

// Curated org tags. Tasks may carry several.
export const LABELS: LabelDef[] = [
  { id: 'events', name: 'Events', color: '#ef3422' },
  { id: 'finance', name: 'Finance', color: '#2f8f6b' },
  { id: 'membership', name: 'Membership', color: '#2f6df0' },
  { id: 'comms', name: 'Comms', color: '#e8a33d' },
  { id: 'docs', name: 'Documentation', color: '#8b5cf6' },
  { id: 'research', name: 'Research', color: '#0ea5a4' },
  { id: 'outreach', name: 'Outreach', color: '#db2777' },
  { id: 'logistics', name: 'Logistics', color: '#6b7280' },
]

export const LABEL_MAP: Record<string, LabelDef> = Object.fromEntries(
  LABELS.map((l) => [l.id, l]),
)

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
