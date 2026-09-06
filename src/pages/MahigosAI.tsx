import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import {
  Sparkles,
  MessageSquareText,
  FileText,
  ClipboardList,
  PencilLine,
  Bot,
  Loader2,
  Copy,
  Check,
} from 'lucide-react'
import { db, functions } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import type { Channel, Meeting, Message, Project, Task } from '../lib/types'
import { STATUS_COLUMNS } from '../lib/types'

type Mode = 'chat' | 'summarize' | 'minutes' | 'agenda' | 'draft'

const MODES: { key: Mode; label: string; icon: typeof Bot; blurb: string }[] = [
  { key: 'chat', label: 'Ask about projects', icon: Bot, blurb: 'Ask anything about your projects, tasks, and deadlines.' },
  { key: 'summarize', label: 'Summarize a chat', icon: MessageSquareText, blurb: 'Catch up on a channel you missed.' },
  { key: 'minutes', label: 'Draft minutes', icon: FileText, blurb: 'Draft minutes from a Zoom meeting in UPIAA format.' },
  { key: 'agenda', label: 'Draft agenda', icon: ClipboardList, blurb: 'Turn your points into a UPIAA agenda.' },
  { key: 'draft', label: 'Draft a document', icon: PencilLine, blurb: 'Letters, memos, emails, announcements.' },
]

const STATUS_LABEL = Object.fromEntries(STATUS_COLUMNS.map((c) => [c.key, c.label]))

export function MahigosAI() {
  const { profile } = useAuth()
  const [mode, setMode] = useState<Mode>('chat')
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])

  const [input, setInput] = useState('')
  const [channelId, setChannelId] = useState('')
  const [meetingId, setMeetingId] = useState('')
  const [ag, setAg] = useState({ number: '', date: '', time: '6:30 PM', venue: 'Zoom Teleconference', points: '' })

  const [busy, setBusy] = useState(false)
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'tasks'), (s) => setTasks(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) }))))
    const u2 = onSnapshot(collection(db, 'projects'), (s) => setProjects(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Project, 'id'>) }))))
    const u3 = onSnapshot(collection(db, 'channels'), (s) => setChannels(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Channel, 'id'>) })).filter((c) => c.kind !== 'dm')))
    const u4 = onSnapshot(query(collection(db, 'meetings'), orderBy('startTime', 'desc')), (s) => setMeetings(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Meeting, 'id'>) }))))
    return () => { u1(); u2(); u3(); u4() }
  }, [])

  const projectMap = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p.name])), [projects])

  const workspaceContext = () => {
    const lines = tasks
      .filter((t) => !t.archived)
      .map((t) => `- ${t.title} [${STATUS_LABEL[t.status] ?? t.status}]${t.assigneeName ? ` · ${t.assigneeName}` : ''}${t.dueDate ? ` · due ${t.dueDate}` : ''}${t.projectId ? ` · ${projectMap[t.projectId] ?? ''}` : ''}`)
    return `Projects: ${projects.map((p) => p.name).join(', ')}\n\nTasks:\n${lines.join('\n')}`
  }

  const loadChannelMessages = async (cid: string) => {
    const snap = await getDocs(collection(db, 'channels', cid, 'messages'))
    return snap.docs
      .map((d) => d.data() as Message)
      .filter((m) => !m.parentId && (m.text || '').trim())
      .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0))
      .slice(-200)
      .map((m) => `${m.authorName}: ${m.text}`)
      .join('\n')
  }

  const run = async () => {
    setBusy(true)
    setError(null)
    setOutput('')
    try {
      const ai = httpsCallable(functions, 'mahigosAI')
      let prompt = ''
      let context = ''
      if (mode === 'chat') {
        if (!input.trim()) throw new Error('Type a question first.')
        prompt = input.trim()
        context = workspaceContext()
      } else if (mode === 'draft') {
        if (!input.trim()) throw new Error('Describe what to draft.')
        prompt = input.trim()
      } else if (mode === 'summarize') {
        if (!channelId) throw new Error('Pick a channel to summarize.')
        const ch = channels.find((c) => c.id === channelId)
        prompt = `Summarize the #${ch?.name ?? 'channel'} conversation.`
        context = await loadChannelMessages(channelId)
        if (!context) throw new Error('That channel has no messages yet.')
      } else if (mode === 'minutes') {
        if (!meetingId) throw new Error('Pick a meeting.')
        const mtg = meetings.find((m) => m.id === meetingId)
        const details = await httpsCallable(functions, 'getMeetingDetails')({ id: meetingId })
        const d = details.data as { participants?: { name: string }[]; summary?: { summary_overview?: string; summary_details?: { label?: string; summary?: string }[]; next_steps?: string[] } }
        const attendees = (d.participants || []).map((p) => p.name).join(', ')
        const summaryText = d.summary
          ? [d.summary.summary_overview, ...(d.summary.summary_details || []).map((x) => `${x.label}: ${x.summary}`), (d.summary.next_steps || []).length ? `Next steps: ${(d.summary.next_steps || []).join('; ')}` : '']
              .filter(Boolean).join('\n')
          : '(No Zoom AI summary available for this meeting.)'
        prompt = `Draft the minutes for the meeting "${mtg?.topic}".`
        context = `Meeting: ${mtg?.topic}\nWhen: ${mtg ? new Date(mtg.startTime).toLocaleString() : ''}\nExecutive Secretary: ${profile?.displayName ?? ''}\nAttendees: ${attendees || '[to be confirmed]'}\n\nZoom AI summary:\n${summaryText}\n\nAdditional notes:\n${input.trim() || '(none)'}`
      } else if (mode === 'agenda') {
        if (!ag.points.trim()) throw new Error('Add at least one agenda point.')
        prompt = 'Draft the Board meeting agenda.'
        context = `Meeting number: ${ag.number || '[Nth]'}\nDate: ${ag.date || '[date]'}\nTime: ${ag.time}\nVenue: ${ag.venue}\nExecutive Secretary: ${profile?.displayName ?? ''}\n\nAgenda points and details:\n${ag.points}`
      }
      const res = await ai({ feature: mode, prompt, context })
      setOutput((res.data as { text: string }).text)
    } catch (e) {
      setError((e as { message?: string }).message || 'Something went wrong. The AI key may not be set up yet.')
    } finally {
      setBusy(false)
    }
  }

  const copy = () => {
    void navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const field = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-brand'
  const active = MODES.find((m) => m.key === mode)!

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">
          <Sparkles size={22} />
        </span>
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Mahigos AI</h1>
          <p className="text-sm text-muted">Your UP Ibalon assistant — powered by Llama (Groq).</p>
        </div>
      </div>

      {/* Mode picker */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => { setMode(m.key); setOutput(''); setError(null) }}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition ${
              mode === m.key ? 'border-brand bg-brand-soft text-brand' : 'border-border text-muted hover:text-ink'
            }`}
          >
            <m.icon size={20} />
            <span className="text-xs font-medium">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="mt-4 rounded-xl border border-border bg-surface p-4">
        <p className="mb-3 text-sm text-muted">{active.blurb}</p>

        {mode === 'summarize' && (
          <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className={field}>
            <option value="">Choose a channel…</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>#{c.name}</option>
            ))}
          </select>
        )}

        {mode === 'minutes' && (
          <>
            <select value={meetingId} onChange={(e) => setMeetingId(e.target.value)} className={field}>
              <option value="">Choose a meeting…</option>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>{m.topic} · {new Date(m.startTime).toLocaleDateString()}</option>
              ))}
            </select>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} placeholder="Optional extra notes (attendance corrections, decisions, action items)…" className={`${field} mt-2`} />
          </>
        )}

        {mode === 'agenda' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <input value={ag.number} onChange={(e) => setAg({ ...ag, number: e.target.value })} placeholder="Meeting # (e.g. 5th)" className={field} />
              <input type="date" value={ag.date} onChange={(e) => setAg({ ...ag, date: e.target.value })} className={field} />
              <input value={ag.time} onChange={(e) => setAg({ ...ag, time: e.target.value })} placeholder="Time" className={field} />
              <input value={ag.venue} onChange={(e) => setAg({ ...ag, venue: e.target.value })} placeholder="Venue" className={field} />
            </div>
            <textarea value={ag.points} onChange={(e) => setAg({ ...ag, points: e.target.value })} rows={6} placeholder={'Agenda points and details, one per line, e.g.:\n- AAP: update on Oas LGU meeting; MOA status\n- KaBIKOLan Ta!: allocation proposal\n- Official logo: adoption'} className={field} />
          </div>
        )}

        {(mode === 'chat' || mode === 'draft') && (
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={mode === 'draft' ? 4 : 2}
            placeholder={mode === 'chat' ? 'e.g. What is overdue this week? Who has the most tasks?' : 'e.g. A thank-you letter to the LGU of Oas for hosting the AAP meeting.'}
            className={field}
          />
        )}

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={run}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-ink disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {busy ? 'Thinking…' : 'Generate'}
          </button>
          {error && <span className="text-xs text-brand">{error}</span>}
        </div>
      </div>

      {/* Output */}
      {output && (
        <div className="mt-4 rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold text-ink">Result</span>
            <button onClick={copy} className="flex items-center gap-1.5 text-xs font-medium text-brand hover:underline">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="whitespace-pre-wrap break-words px-4 py-3 font-sans text-sm text-ink">{output}</pre>
        </div>
      )}

      <p className="mt-3 text-center text-[0.7rem] text-muted">
        Mahigos AI can make mistakes — please review drafts before sending or filing.
      </p>
    </div>
  )
}
