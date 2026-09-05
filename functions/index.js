/**
 * Mahigos Cloud Functions
 * ───────────────────────
 *  • Zoom meetings via the OSEC Server-to-Server OAuth app (createZoomMeeting,
 *    updateZoomMeeting, deleteZoomMeeting) — secrets stay in Secret Manager.
 *  • Email notifications via the OSEC Gmail (nodemailer + app password):
 *      – onUrgentTask: instant email when a task is marked Urgent.
 *      – dailyDigest: scheduled morning summary of to-dos, deadlines, and
 *        recent messages to every member.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { onDocumentWritten } = require('firebase-functions/v2/firestore')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { setGlobalOptions } = require('firebase-functions/v2')
const { defineSecret } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore')
const nodemailer = require('nodemailer')

initializeApp()
const db = getFirestore()

setGlobalOptions({ region: 'asia-southeast1', maxInstances: 10 })

const ZOOM_ACCOUNT_ID = defineSecret('ZOOM_ACCOUNT_ID')
const ZOOM_CLIENT_ID = defineSecret('ZOOM_CLIENT_ID')
const ZOOM_CLIENT_SECRET = defineSecret('ZOOM_CLIENT_SECRET')
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD')

const SENDER = 'upiaaosec@gmail.com'
const ALLOWED = [
  'jjcamposano23@gmail.com',
  'upiaaosec@gmail.com',
  'gbbrutas@up.edu.ph',
  'ivmancenido@up.edu.ph',
]
const TZ = 'Asia/Manila'

// ─── Auth guard for callable functions ───────────────────────────────────────
function assertAllowed(req) {
  const email = req.auth && req.auth.token && req.auth.token.email
  const lower = email ? email.toLowerCase() : null
  if (!req.auth || !lower || !ALLOWED.includes(lower)) {
    throw new HttpsError('permission-denied', 'This account is not authorized.')
  }
  return lower
}

// ─── Zoom REST helpers ───────────────────────────────────────────────────────
async function zoomToken() {
  const basic = Buffer.from(
    `${ZOOM_CLIENT_ID.value()}:${ZOOM_CLIENT_SECRET.value()}`,
  ).toString('base64')
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID.value()}`,
    { method: 'POST', headers: { Authorization: `Basic ${basic}` } },
  )
  if (!res.ok) {
    const t = await res.text()
    throw new HttpsError('internal', `Zoom auth failed (${res.status}): ${t}`)
  }
  const data = await res.json()
  return data.access_token
}

const ZOOM_SECRETS = [ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET]

function parseEmails(input) {
  if (!input) return []
  const arr = Array.isArray(input) ? input : String(input).split(/[\s,;]+/)
  return Array.from(
    new Set(arr.map((e) => e.trim().toLowerCase()).filter((e) => /.+@.+\..+/.test(e))),
  )
}

exports.createZoomMeeting = onCall(
  { secrets: [...ZOOM_SECRETS, GMAIL_APP_PASSWORD] },
  async (req) => {
  const email = assertAllowed(req)
  const { topic, startTime, duration, agenda, timezone } = req.data || {}
  const invitees = parseEmails((req.data || {}).invitees)
  if (!topic || !startTime) {
    throw new HttpsError('invalid-argument', 'A topic and start time are required.')
  }
  const token = await zoomToken()
  // S2S OAuth has no user context, so target the OSEC host by email (not "me").
  const res = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(SENDER)}/meetings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic,
      type: 2, // scheduled meeting
      start_time: startTime, // ISO 8601
      duration: duration || 60,
      timezone: timezone || TZ,
      agenda: agenda || '',
      settings: {
        join_before_host: true,
        waiting_room: false,
        mute_upon_entry: true,
        approval_type: 2,
        meeting_invitees: invitees.map((e) => ({ email: e })),
      },
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new HttpsError('internal', `Zoom create failed (${res.status}): ${t}`)
  }
  const m = await res.json()

  // Mirror onto the shared calendar so meetings show up there too.
  const dateOnly = String(startTime).slice(0, 10)
  const timeOnly = String(startTime).slice(11, 16)
  const eventRef = await db.collection('events').add({
    title: topic,
    date: dateOnly,
    time: timeOnly || null,
    type: 'meeting',
    notes: `Zoom meeting · ${m.join_url}`,
    createdBy: req.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
  })

  const docRef = await db.collection('meetings').add({
    zoomId: String(m.id),
    topic,
    agenda: agenda || '',
    startTime,
    duration: duration || 60,
    timezone: timezone || TZ,
    joinUrl: m.join_url,
    startUrl: m.start_url,
    password: m.password || '',
    eventId: eventRef.id,
    invitees,
    createdBy: req.auth.uid,
    createdByEmail: email,
    createdAt: FieldValue.serverTimestamp(),
  })

  // Email the invitees the join details from the OSEC Gmail.
  if (invitees.length) {
    const when = new Date(startTime).toLocaleString('en-US', { timeZone: timezone || TZ })
    const body = `
      <p style="margin:0 0 10px">You're invited to a Zoom meeting:</p>
      <div style="border-left:3px solid #ef3422;background:#fdece9;padding:10px 12px;border-radius:6px">
        <div style="font-weight:bold;font-size:15px">${topic}</div>
        <div style="color:#555;font-size:13px;margin-top:4px">${when} (${timezone || TZ}) · ${duration || 60} min</div>
        ${agenda ? `<div style="color:#666;font-size:13px;margin-top:6px">${agenda}</div>` : ''}
        <div style="margin-top:10px"><a href="${m.join_url}" style="color:#ef3422;font-weight:bold">Join the meeting</a>${m.password ? ` · Passcode: ${m.password}` : ''}</div>
      </div>`
    await sendMail(invitees, `Zoom invite: ${topic}`, shell('You are invited to a meeting', body)).catch(
      () => {},
    )
  }

  return { id: docRef.id, joinUrl: m.join_url, startUrl: m.start_url }
})

exports.updateZoomMeeting = onCall(
  { secrets: [...ZOOM_SECRETS, GMAIL_APP_PASSWORD] },
  async (req) => {
  assertAllowed(req)
  const { id, topic, startTime, duration, agenda, timezone } = req.data || {}
  if (!id) throw new HttpsError('invalid-argument', 'A meeting id is required.')
  const doc = await db.collection('meetings').doc(id).get()
  if (!doc.exists) throw new HttpsError('not-found', 'Meeting not found.')
  const zoomId = doc.data().zoomId
  const prevInvitees = doc.data().invitees || []
  const hasInvitees = (req.data || {}).invitees !== undefined
  const invitees = hasInvitees ? parseEmails((req.data || {}).invitees) : prevInvitees
  const token = await zoomToken()
  const body = {
    topic,
    start_time: startTime,
    duration,
    timezone: timezone || TZ,
    agenda,
  }
  if (hasInvitees) body.settings = { meeting_invitees: invitees.map((e) => ({ email: e })) }
  const res = await fetch(`https://api.zoom.us/v2/meetings/${zoomId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok && res.status !== 204) {
    const t = await res.text()
    throw new HttpsError('internal', `Zoom update failed (${res.status}): ${t}`)
  }
  const patch = { topic, startTime, duration, agenda, timezone: timezone || TZ }
  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k])
  if (hasInvitees) patch.invitees = invitees
  await doc.ref.update(patch)
  if (doc.data().eventId && (topic || startTime)) {
    await db
      .collection('events')
      .doc(doc.data().eventId)
      .update({
        ...(topic ? { title: topic } : {}),
        ...(startTime ? { date: String(startTime).slice(0, 10), time: String(startTime).slice(11, 16) } : {}),
      })
      .catch(() => {})
  }
  // Email any newly added invitees the join link.
  const added = invitees.filter((e) => !prevInvitees.includes(e))
  if (added.length) {
    const m = doc.data()
    const when = new Date(startTime || m.startTime).toLocaleString('en-US', { timeZone: timezone || TZ })
    const html = `
      <p style="margin:0 0 10px">You have been invited to a Zoom meeting:</p>
      <div style="border-left:3px solid #ef3422;background:#fdece9;padding:10px 12px;border-radius:6px">
        <div style="font-weight:bold;font-size:15px">${topic || m.topic}</div>
        <div style="color:#555;font-size:13px;margin-top:4px">${when} (${timezone || TZ})</div>
        <div style="margin-top:10px"><a href="${m.joinUrl}" style="color:#ef3422;font-weight:bold">Join the meeting</a>${m.password ? ` · Passcode: ${m.password}` : ''}</div>
      </div>`
    await sendMail(added, `Zoom invite: ${topic || m.topic}`, shell('You are invited to a meeting', html)).catch(() => {})
  }
  return { ok: true }
})

exports.getMeetingDetails = onCall({ secrets: ZOOM_SECRETS }, async (req) => {
  assertAllowed(req)
  const { id } = req.data || {}
  if (!id) throw new HttpsError('invalid-argument', 'A meeting id is required.')
  const doc = await db.collection('meetings').doc(id).get()
  if (!doc.exists) throw new HttpsError('not-found', 'Meeting not found.')
  const zoomId = doc.data().zoomId
  const token = await zoomToken()
  const auth = { Authorization: `Bearer ${token}` }
  const out = { invitees: doc.data().invitees || [], participants: [], summary: null, notes: [] }

  // Attendees of the most recent past instance.
  try {
    const r = await fetch(`https://api.zoom.us/v2/past_meetings/${zoomId}/participants?page_size=300`, { headers: auth })
    if (r.ok) {
      const d = await r.json()
      out.participants = (d.participants || []).map((p) => ({
        name: p.name || p.user_name || 'Guest',
        email: p.user_email || '',
      }))
    } else {
      out.notes.push(`Attendee report unavailable (${r.status}). It needs the report_meetings:read:admin scope and a finished meeting.`)
    }
  } catch {
    out.notes.push('Could not load the attendee report.')
  }

  // Zoom AI Companion meeting summary.
  try {
    const r = await fetch(`https://api.zoom.us/v2/meetings/${zoomId}/meeting_summary`, { headers: auth })
    if (r.ok) {
      out.summary = await r.json()
    } else {
      out.notes.push(`AI summary unavailable (${r.status}). It needs AI Companion enabled and the meeting_summary:read:admin scope.`)
    }
  } catch {
    out.notes.push('Could not load the AI summary.')
  }

  return out
})

exports.deleteZoomMeeting = onCall({ secrets: ZOOM_SECRETS }, async (req) => {
  assertAllowed(req)
  const { id } = req.data || {}
  if (!id) throw new HttpsError('invalid-argument', 'A meeting id is required.')
  const doc = await db.collection('meetings').doc(id).get()
  if (!doc.exists) return { ok: true }
  const { zoomId, eventId } = doc.data()
  try {
    const token = await zoomToken()
    await fetch(`https://api.zoom.us/v2/meetings/${zoomId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (e) {
    // If the meeting is already gone on Zoom, still clean up our records.
  }
  if (eventId) await db.collection('events').doc(eventId).delete().catch(() => {})
  await doc.ref.delete()
  return { ok: true }
})

// ─── Email helpers ───────────────────────────────────────────────────────────
function mailer() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: SENDER, pass: GMAIL_APP_PASSWORD.value() },
  })
}

async function sendMail(to, subject, html) {
  if (!to || (Array.isArray(to) && to.length === 0)) return
  await mailer().sendMail({
    from: `Mahigos · UP Ibalon <${SENDER}>`,
    to: Array.isArray(to) ? to.join(',') : to,
    subject,
    html,
  })
}

async function memberEmails() {
  const snap = await db.collection('users').get()
  const emails = snap.docs
    .map((d) => d.data().email)
    .filter((e) => e && ALLOWED.includes(String(e).toLowerCase()))
  return Array.from(new Set(emails))
}

const APP_URL = 'https://mahigos-collab.web.app'

function shell(title, bodyHtml) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1a19">
    <div style="background:#ef3422;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0">
      <div style="font-size:18px;font-weight:bold">Mahigos</div>
      <div style="font-size:12px;opacity:.85">UP Ibalon Alumni Association</div>
    </div>
    <div style="border:1px solid #eee;border-top:0;border-radius:0 0 12px 12px;padding:20px">
      <h2 style="margin:0 0 12px;font-size:17px">${title}</h2>
      ${bodyHtml}
      <div style="margin-top:20px">
        <a href="${APP_URL}" style="background:#ef3422;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-weight:bold;font-size:14px">Open Mahigos</a>
      </div>
    </div>
    <div style="text-align:center;color:#999;font-size:11px;margin-top:12px">
      You’re receiving this because you’re a member of the UP Ibalon workspace.
    </div>
  </div>`
}

// ─── Instant notice when a task is marked Urgent ─────────────────────────────
exports.onUrgentTask = onDocumentWritten(
  { document: 'tasks/{taskId}', secrets: [GMAIL_APP_PASSWORD] },
  async (event) => {
    const before = event.data.before.exists ? event.data.before.data() : null
    const after = event.data.after.exists ? event.data.after.data() : null
    if (!after || after.archived) return
    const became = after.priority === 'urgent' && (!before || before.priority !== 'urgent')
    if (!became) return

    const recipients = await memberEmails()
    if (!recipients.length) return

    const due = after.dueDate ? `Due ${after.dueDate}` : 'No due date set'
    const assignee = after.assigneeName || 'Unassigned'
    const body = `
      <p style="margin:0 0 10px">A task was just flagged <b style="color:#ef3422">Urgent</b>:</p>
      <div style="border-left:3px solid #ef3422;background:#fdece9;padding:10px 12px;border-radius:6px">
        <div style="font-weight:bold;font-size:15px">${after.title}</div>
        ${after.description ? `<div style="color:#555;font-size:13px;margin-top:4px">${after.description}</div>` : ''}
        <div style="color:#777;font-size:12px;margin-top:8px">Assignee: ${assignee} · ${due}</div>
      </div>`
    await sendMail(recipients, `🚨 Urgent task: ${after.title}`, shell('Urgent task added', body))
  },
)

// ─── Daily digest: to-dos, deadlines, recent messages ────────────────────────
exports.dailyDigest = onSchedule(
  { schedule: '30 7 * * *', timeZone: TZ, secrets: [GMAIL_APP_PASSWORD] },
  async () => {
    const recipients = await memberEmails()
    if (!recipients.length) return

    // Today in Manila (yyyy-mm-dd)
    const now = new Date()
    const manila = new Date(now.toLocaleString('en-US', { timeZone: TZ }))
    const iso = (d) => d.toISOString().slice(0, 10)
    const today = iso(manila)
    const in7 = new Date(manila.getTime() + 7 * 86400000)

    const tasksSnap = await db.collection('tasks').get()
    const tasks = tasksSnap.docs
      .map((d) => d.data())
      .filter((t) => !t.archived && t.status !== 'done')

    const overdueOrToday = tasks
      .filter((t) => t.dueDate && t.dueDate <= today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    const upcoming = tasks
      .filter((t) => t.dueDate && t.dueDate > today && t.dueDate <= iso(in7))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    const openCount = tasks.length

    // Messages in the last 24h across all channels.
    const cutoff = Timestamp.fromMillis(Date.now() - 24 * 3600 * 1000)
    const channels = await db.collection('channels').get()
    let msgCount = 0
    const activeChannels = []
    for (const ch of channels.docs) {
      const recent = await ch
        .ref.collection('messages')
        .where('createdAt', '>=', cutoff)
        .get()
      if (!recent.empty) {
        msgCount += recent.size
        const name = ch.data().name || (ch.data().kind === 'dm' ? 'Direct message' : 'channel')
        activeChannels.push(`${ch.data().kind === 'dm' ? '' : '#'}${name} (${recent.size})`)
      }
    }

    const row = (t) => `
      <div style="padding:6px 0;border-bottom:1px solid #f0f0f0">
        <span style="font-weight:bold">${t.title}</span>
        <span style="color:#999;font-size:12px"> · ${t.assigneeName || 'Unassigned'}${
          t.dueDate ? ` · due ${t.dueDate}` : ''
        }</span>
      </div>`

    const section = (heading, items, emptyMsg) => `
      <h3 style="font-size:14px;margin:16px 0 6px">${heading}</h3>
      ${items.length ? items.map(row).join('') : `<div style="color:#999;font-size:13px">${emptyMsg}</div>`}`

    const sharedBody = `
      <p style="margin:0 0 6px;color:#555">Good morning! Here's your UP Ibalon workspace snapshot for ${today}.</p>
      <div style="display:flex;gap:8px;margin:12px 0">
        <div style="flex:1;background:#f7f7f7;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:22px;font-weight:bold">${openCount}</div>
          <div style="font-size:11px;color:#777">open tasks</div>
        </div>
        <div style="flex:1;background:#fdece9;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:22px;font-weight:bold;color:#ef3422">${overdueOrToday.length}</div>
          <div style="font-size:11px;color:#777">due / overdue</div>
        </div>
        <div style="flex:1;background:#f7f7f7;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:22px;font-weight:bold">${msgCount}</div>
          <div style="font-size:11px;color:#777">new messages</div>
        </div>
      </div>
      ${section('🔴 Due today &amp; overdue', overdueOrToday, 'Nothing overdue — nice.')}
      ${section('📅 Coming up this week', upcoming, 'No deadlines in the next 7 days.')}
      <h3 style="font-size:14px;margin:16px 0 6px">💬 Messages (last 24h)</h3>
      <div style="color:${msgCount ? '#555' : '#999'};font-size:13px">${
        msgCount ? activeChannels.join(' · ') : 'No new messages.'
      }</div>`

    // Personalize: append each member's own recent mentions/notifications.
    const notifCutoff = Date.now() - 24 * 3600 * 1000
    const usersSnap = await db.collection('users').get()
    const users = usersSnap.docs
      .map((d) => ({ uid: d.id, ...d.data() }))
      .filter((u) => u.email && ALLOWED.includes(String(u.email).toLowerCase()))

    for (const u of users) {
      const notifSnap = await db.collection('notifications').where('toUid', '==', u.uid).get()
      const recent = notifSnap.docs
        .map((d) => d.data())
        .filter((n) => (n.createdAt?.toMillis?.() ?? 0) >= notifCutoff)
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
        .slice(0, 12)

      const notifHtml = recent.length
        ? recent
            .map(
              (n) => `
        <div style="padding:6px 0;border-bottom:1px solid #f0f0f0">
          <span style="font-weight:bold">${n.title || 'Notification'}</span>
          ${n.body ? `<div style="color:#666;font-size:12px;margin-top:2px">${n.body}</div>` : ''}
        </div>`,
            )
            .join('')
        : `<div style="color:#999;font-size:13px">No new mentions or alerts.</div>`

      const personal = `
        ${sharedBody}
        <h3 style="font-size:14px;margin:16px 0 6px">🔔 Your mentions &amp; alerts (last 24h)</h3>
        ${notifHtml}`

      await sendMail(u.email, `Mahigos daily digest — ${today}`, shell('Your daily digest', personal))
    }
  },
)
