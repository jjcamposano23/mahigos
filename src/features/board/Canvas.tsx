import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import {
  MousePointer2,
  StickyNote,
  Square,
  Circle,
  Diamond,
  Type,
  MoveUpRight,
  Minus,
  Trash2,
  Shapes,
  ZoomIn,
  ZoomOut,
  Maximize,
  Triangle,
  SquareRoundCorner,
  Image as ImageIcon,
  Palette,
  Loader2,
  ChevronUp,
  ChevronDown,
  Copy,
  BringToFront,
  SendToBack,
  Hand,
  Pencil,
  Square as SquareIcon,
  X,
} from 'lucide-react'
import { db, storage } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { isOnline } from '../../lib/presence'
import { mentionTargets, notifyMentions, type MentionTarget } from '../../lib/notifications'
import {
  BOARD_FONTS,
  BOARD_FONT_SIZES,
  type BoardCursor,
  type BoardItem,
  type BoardItemType,
  type UserProfile,
} from '../../lib/types'
import { ColorPopover } from './ColorPopover'

const safeId = (c: string) => 'c' + c.replace(/[^a-z0-9]/gi, '')

type Tool = 'select' | 'hand' | BoardItemType

const CURSOR_COLORS = ['#ef3422', '#2f6df0', '#2f8f6b', '#e8a33d', '#8b5cf6', '#0ea5a4', '#db2777']
function colorFor(uid: string) {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0
  return CURSOR_COLORS[h % CURSOR_COLORS.length]
}

const CONNECTORS: BoardItemType[] = ['arrow', 'line']
const DEFAULTS: Record<BoardItemType, { w: number; h: number; color: string }> = {
  note: { w: 170, h: 130, color: '#ffe08a' },
  rect: { w: 120, h: 120, color: '#c7ddff' }, // default rectangle is a square
  round: { w: 120, h: 120, color: '#c9ecd0' },
  ellipse: { w: 120, h: 120, color: '#ffd0c7' }, // circle by default
  diamond: { w: 120, h: 120, color: '#e6d2ff' },
  triangle: { w: 120, h: 120, color: '#c7ddff' },
  text: { w: 180, h: 40, color: '#1c1a19' },
  arrow: { w: 0, h: 0, color: '#1c1a19' },
  line: { w: 0, h: 0, color: '#1c1a19' },
  image: { w: 220, h: 160, color: '#ffffff' },
  draw: { w: 0, h: 0, color: '#1c1a19' },
}
// Shapes that get drag-to-size on creation (not text/note/connectors/image).
const DRAG_SHAPES: BoardItemType[] = ['rect', 'round', 'ellipse', 'diamond', 'triangle']
const BORDER_SHAPES: BoardItemType[] = ['rect', 'round', 'ellipse', 'diamond', 'triangle', 'note']
const DASH_MAP: Record<string, string | undefined> = {
  solid: undefined,
  dashed: '10 6',
  dotted: '2 6',
}
const PEN_TYPES: Record<string, { widthMul: number; opacity: number; cap: string }> = {
  pen: { widthMul: 1, opacity: 1, cap: 'round' },
  marker: { widthMul: 2.2, opacity: 1, cap: 'round' },
  highlighter: { widthMul: 4, opacity: 0.4, cap: 'butt' },
}

const TOOLBAR: { tool: Tool; icon: typeof Square; label: string }[] = [
  { tool: 'select', icon: MousePointer2, label: 'Select (left-drag to marquee)' },
  { tool: 'hand', icon: Hand, label: 'Move around the board (drag)' },
  { tool: 'draw', icon: Pencil, label: 'Draw (freehand pen)' },
  { tool: 'note', icon: StickyNote, label: 'Sticky note' },
  { tool: 'rect', icon: Square, label: 'Rectangle' },
  { tool: 'ellipse', icon: Circle, label: 'Ellipse' },
  { tool: 'diamond', icon: Diamond, label: 'Diamond' },
  { tool: 'text', icon: Type, label: 'Text' },
  { tool: 'arrow', icon: MoveUpRight, label: 'Arrow' },
]

const LIBRARY: { type: BoardItemType; icon: typeof Square; label: string }[] = [
  { type: 'note', icon: StickyNote, label: 'Sticky note' },
  { type: 'rect', icon: Square, label: 'Rectangle' },
  { type: 'round', icon: SquareRoundCorner, label: 'Rounded' },
  { type: 'ellipse', icon: Circle, label: 'Ellipse' },
  { type: 'diamond', icon: Diamond, label: 'Diamond' },
  { type: 'triangle', icon: Triangle, label: 'Triangle' },
  { type: 'text', icon: Type, label: 'Text' },
  { type: 'arrow', icon: MoveUpRight, label: 'Arrow' },
  { type: 'line', icon: Minus, label: 'Line' },
]

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const
type Handle = (typeof HANDLES)[number]
const SNAP = 6 // world px

type Interaction =
  | null
  | { mode: 'pan'; sx: number; sy: number; opx: number; opy: number }
  | { mode: 'marquee'; sx: number; sy: number }
  | { mode: 'move'; sx: number; sy: number; orig: Record<string, BoardItem> }
  | { mode: 'resize'; id: string; handle: Handle; sx: number; sy: number; orig: BoardItem }
  | { mode: 'endpoint'; id: string; which: 'start' | 'end' }
  | { mode: 'draw'; id: string }
  | { mode: 'createShape'; id: string; ox: number; oy: number; type: BoardItemType }
  | { mode: 'freehand'; id: string; ox: number; oy: number; pts: { x: number; y: number }[] }

const bbox = (i: BoardItem) =>
  i.type === 'arrow' || i.type === 'line'
    ? {
        x: Math.min(i.x, i.x2 ?? i.x),
        y: Math.min(i.y, i.y2 ?? i.y),
        w: Math.abs((i.x2 ?? i.x) - i.x),
        h: Math.abs((i.y2 ?? i.y) - i.y),
      }
    : { x: i.x, y: i.y, w: i.w, h: i.h }

/** Snap points for a shape: corners, edge midpoints, and center. */
function anchorsOf(i: BoardItem) {
  const b = bbox(i)
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x, y: b.y + b.h },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x + b.w / 2, y: b.y },
    { x: b.x + b.w / 2, y: b.y + b.h },
    { x: b.x, y: b.y + b.h / 2 },
    { x: b.x + b.w, y: b.y + b.h / 2 },
    { x: b.x + b.w / 2, y: b.y + b.h / 2 },
  ]
}

export function Canvas({ boardId }: { boardId: string }) {
  const { user, profile } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const col = collection(db, 'whiteboards', boardId, 'items')

  const [items, setItems] = useState<BoardItem[]>([])
  const [cursors, setCursors] = useState<(BoardCursor & { uid: string })[]>([])
  const [tool, setTool] = useState<Tool>('select')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 40, y: 40 })
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [dims, setDims] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] })
  const [library, setLibrary] = useState(false)
  const [members, setMembers] = useState<UserProfile[]>([])
  const [uploading, setUploading] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [style, setStyle] = useState<Partial<BoardItem>>({})
  const [freehand, setFreehand] = useState<{ ox: number; oy: number; pts: { x: number; y: number }[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const it = useRef<Interaction>(null)
  const lastCursor = useRef(0)
  const myColor = colorFor(user?.uid ?? 'x')
  const targets = useMemo(() => mentionTargets(members), [members])
  const itemsRef = useRef<BoardItem[]>(items)
  itemsRef.current = items
  const styleRef = useRef<Partial<BoardItem>>(style)
  styleRef.current = style

  useEffect(() => {
    const unsubN = onSnapshot(col, (snap) =>
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BoardItem, 'id'>) }))),
    )
    const unsubC = onSnapshot(collection(db, 'whiteboards', boardId, 'cursors'), (snap) =>
      setCursors(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as BoardCursor) }))),
    )
    const unsubU = onSnapshot(collection(db, 'users'), (snap) =>
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }))),
    )
    return () => {
      unsubN()
      unsubC()
      unsubU()
      if (user) void deleteDoc(doc(db, 'whiteboards', boardId, 'cursors', user.uid))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, user])

  // Live-save text on every change so it's never lost when clicking away.
  const editTextRef = useRef<Record<string, string>>({})
  const onChangeText = (id: string, text: string) => {
    editTextRef.current[id] = text
    patch(id, { text })
  }
  // When an edit session ends, fan out @mention notifications for that item.
  const prevEditing = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevEditing.current
    if (prev && prev !== editingId) {
      const t = editTextRef.current[prev]
      if (t && t.trim())
        void notifyMentions(t, targets, {
          fromUid: user?.uid ?? '',
          fromName: profile?.displayName ?? 'Member',
          context: 'on a whiteboard',
          link: '/whiteboard',
        })
    }
    prevEditing.current = editingId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId])

  const uploadImage = async (file: File) => {
    if (!file || !user) return
    if (file.size > 10 * 1024 * 1024) return alert('Please choose an image under 10 MB.')
    setUploading(true)
    try {
      const r = storageRef(storage, `whiteboards/${boardId}/${Date.now()}-${file.name}`)
      await uploadBytes(r, file)
      const url = await getDownloadURL(r)
      // Size to natural aspect ratio, capped.
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new window.Image()
        img.onload = () => {
          const scale = Math.min(1, 320 / Math.max(img.width, img.height))
          resolve({ w: Math.round(img.width * scale) || 220, h: Math.round(img.height * scale) || 160 })
        }
        img.onerror = () => resolve({ w: 220, h: 160 })
        img.src = url
      })
      const r0 = containerRef.current!.getBoundingClientRect()
      const center = toWorld(r0.left + r0.width / 2, r0.top + r0.height / 2)
      await addDoc(col, {
        type: 'image',
        x: Math.round(center.x - dims.w / 2),
        y: Math.round(center.y - dims.h / 2),
        w: dims.w,
        h: dims.h,
        src: url,
        text: '',
        color: '#ffffff',
        authorUid: user.uid,
      })
    } catch (err) {
      alert(`Image upload failed: ${(err as Error).message}`)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const toWorld = (cx: number, cy: number) => {
    const r = containerRef.current!.getBoundingClientRect()
    return { x: (cx - r.left - pan.x) / zoom, y: (cy - r.top - pan.y) / zoom }
  }

  const patch = (id: string, p: Partial<BoardItem>) => void updateDoc(doc(col, id), p)
  const del = (ids: string[]) => {
    ids.forEach((id) => void deleteDoc(doc(col, id)))
    setSel(new Set())
  }

  // Apply a style change to the current selection AND remember it as the
  // default for the next element created (carry-over).
  const applyStyle = (props: Partial<BoardItem>) => {
    setStyle((s) => ({ ...s, ...props }))
    itemsRef.current.filter((i) => sel.has(i.id)).forEach((s) => patch(s.id, props))
  }

  const nextZ = () => Math.max(0, ...itemsRef.current.map((i) => i.z ?? 0)) + 1

  // Snap a connector endpoint to the nearest shape anchor.
  const snapEndpoint = (x: number, y: number, excludeId: string) => {
    let best: { x: number; y: number } | null = null
    let bd = 12 / zoom
    for (const i of itemsRef.current) {
      if (i.id === excludeId || CONNECTORS.includes(i.type)) continue
      for (const a of anchorsOf(i)) {
        const d = Math.hypot(a.x - x, a.y - y)
        if (d < bd) {
          bd = d
          best = a
        }
      }
    }
    return best ?? { x, y }
  }

  // ── Undo / redo (snapshot-based, reconciled to Firestore) ──
  const histRef = useRef<BoardItem[][]>([])
  const histPos = useRef(-1)
  const applyingRef = useRef(false)
  useEffect(() => {
    if (applyingRef.current || it.current) return
    const snap = JSON.parse(JSON.stringify(items)) as BoardItem[]
    const h = histRef.current
    if (histPos.current >= 0 && JSON.stringify(h[histPos.current]) === JSON.stringify(snap)) return
    h.splice(histPos.current + 1)
    h.push(snap)
    while (h.length > 40) h.shift()
    histPos.current = h.length - 1
  }, [items])

  const applySnapshot = async (target: BoardItem[]) => {
    applyingRef.current = true
    const tgtIds = new Set(target.map((i) => i.id))
    for (const i of itemsRef.current) if (!tgtIds.has(i.id)) await deleteDoc(doc(col, i.id)).catch(() => {})
    for (const t of target) {
      const { id, ...data } = t
      await setDoc(doc(col, id), data).catch(() => {})
    }
    setTimeout(() => (applyingRef.current = false), 350)
  }
  const undo = () => {
    if (histPos.current > 0) {
      histPos.current -= 1
      void applySnapshot(histRef.current[histPos.current])
    }
  }
  const redo = () => {
    if (histPos.current < histRef.current.length - 1) {
      histPos.current += 1
      void applySnapshot(histRef.current[histPos.current])
    }
  }

  const create = async (type: BoardItemType, wx: number, wy: number) => {
    const d = DEFAULTS[type]
    const z = nextZ()
    const uid = user?.uid ?? ''
    const st = styleRef.current
    const opt = (k: keyof BoardItem) => (st[k] != null ? { [k]: st[k] } : {})
    if (CONNECTORS.includes(type)) {
      const refDoc = await addDoc(col, {
        type, x: wx, y: wy, w: 0, h: 0, x2: wx, y2: wy, text: '',
        color: st.color ?? '#1c1a19', thickness: st.thickness ?? 2.5, dash: st.dash ?? 'solid',
        ...opt('opacity'), z, authorUid: uid,
      })
      it.current = { mode: 'draw', id: refDoc.id }
      setSel(new Set([refDoc.id]))
      return
    }
    // Shapes: start a drag-to-size gesture (click = default size on commit).
    if (DRAG_SHAPES.includes(type)) {
      const refDoc = await addDoc(col, {
        type, x: Math.round(wx), y: Math.round(wy), w: 1, h: 1, text: '',
        color: st.color ?? d.color,
        ...opt('opacity'), ...opt('borderWidth'), ...opt('borderColor'), ...opt('borderDash'),
        ...opt('fontFamily'), ...opt('fontSize'), z, authorUid: uid,
      })
      it.current = { mode: 'createShape', id: refDoc.id, ox: wx, oy: wy, type }
      setSel(new Set([refDoc.id]))
      return
    }
    // Note / text — placed at default size, then revert to Select.
    const refDoc = await addDoc(col, {
      type, x: Math.round(wx - d.w / 2), y: Math.round(wy - d.h / 2), w: d.w, h: d.h, text: '',
      color: st.color ?? d.color,
      ...opt('opacity'), ...opt('fontFamily'), ...opt('fontSize'),
      ...(type === 'note' ? { ...opt('borderWidth'), ...opt('borderColor'), ...opt('borderDash') } : {}),
      z, authorUid: uid,
    })
    setSel(new Set([refDoc.id]))
    setTool('select')
    if (type === 'text' || type === 'note') setEditingId(refDoc.id)
  }

  const duplicate = async () => {
    for (const s of itemsRef.current.filter((i) => sel.has(i.id))) {
      const { id, ...data } = s
      void id
      await addDoc(col, { ...data, x: (data.x ?? 0) + 16, y: (data.y ?? 0) + 16, z: nextZ() })
    }
  }
  const startConnectorFrom = async (item: BoardItem, side: 'n' | 's' | 'e' | 'w') => {
    const b = bbox(item)
    const p =
      side === 'n' ? { x: b.x + b.w / 2, y: b.y } :
      side === 's' ? { x: b.x + b.w / 2, y: b.y + b.h } :
      side === 'w' ? { x: b.x, y: b.y + b.h / 2 } :
      { x: b.x + b.w, y: b.y + b.h / 2 }
    const refDoc = await addDoc(col, { type: 'arrow', x: p.x, y: p.y, w: 0, h: 0, x2: p.x, y2: p.y, text: '', color: '#1c1a19', thickness: 2.5, dash: 'solid', z: nextZ(), authorUid: user?.uid ?? '' })
    it.current = { mode: 'draw', id: refDoc.id }
    setSel(new Set([refDoc.id]))
  }

  const arrange = (kind: 'front' | 'back' | 'forward' | 'backward') => {
    const zs = itemsRef.current.map((i) => i.z ?? 0)
    const maxZ = Math.max(0, ...zs)
    const minZ = Math.min(0, ...zs)
    for (const s of itemsRef.current.filter((i) => sel.has(i.id))) {
      const cur = s.z ?? 0
      const z =
        kind === 'front' ? maxZ + 1 : kind === 'back' ? minZ - 1 : kind === 'forward' ? cur + 1.5 : cur - 1.5
      patch(s.id, { z })
    }
  }

  // ---------- container pointer handlers ----------
  const onContainerPointerDown = (e: React.PointerEvent) => {
    // right button (or the hand tool) pans across the board
    if (e.button === 2 || (e.button === 0 && tool === 'hand')) {
      it.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, opx: pan.x, opy: pan.y }
      return
    }
    if (e.button !== 0) return
    // The pencil can start anywhere, even over existing items.
    if (tool === 'draw') {
      const w = toWorld(e.clientX, e.clientY)
      setEditingId(null)
      setFreehand({ ox: w.x, oy: w.y, pts: [{ x: 0, y: 0 }] })
      it.current = { mode: 'freehand', id: '', ox: w.x, oy: w.y, pts: [] }
      return
    }
    if (e.target !== containerRef.current && !(e.target as HTMLElement).dataset.world) return
    setEditingId(null)
    const w = toWorld(e.clientX, e.clientY)
    if (tool === 'select') {
      setSel(new Set())
      it.current = { mode: 'marquee', sx: w.x, sy: w.y }
      setMarquee({ x: w.x, y: w.y, w: 0, h: 0 })
      return
    }
    void create(tool as BoardItemType, w.x, w.y)
  }

  const snapMove = (moving: BoardItem[], dx: number, dy: number) => {
    // candidate lines from other items
    const others = items.filter((i) => !moving.some((m) => m.id === i.id))
    const vs: number[] = []
    const hs: number[] = []
    for (const o of others) {
      const b = bbox(o)
      vs.push(b.x, b.x + b.w, b.x + b.w / 2)
      hs.push(b.y, b.y + b.h, b.y + b.h / 2)
    }
    const gv: number[] = []
    const gh: number[] = []
    let adjX = dx
    let adjY = dy
    for (const m of moving) {
      const b = bbox(m)
      const edgesX = [b.x + dx, b.x + b.w + dx, b.x + b.w / 2 + dx]
      const edgesY = [b.y + dy, b.y + b.h + dy, b.y + b.h / 2 + dy]
      for (const ex of edgesX)
        for (const v of vs)
          if (Math.abs(ex - v) < SNAP / zoom) {
            adjX += v - ex
            gv.push(v)
          }
      for (const ey of edgesY)
        for (const hh of hs)
          if (Math.abs(ey - hh) < SNAP / zoom) {
            adjY += hh - ey
            gh.push(hh)
          }
    }
    setGuides({ v: [...new Set(gv)], h: [...new Set(gh)] })
    return { dx: adjX, dy: adjY }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const w = toWorld(e.clientX, e.clientY)
    const cur = it.current

    if (cur?.mode === 'pan') {
      setPan({ x: cur.opx + (e.clientX - cur.sx), y: cur.opy + (e.clientY - cur.sy) })
    } else if (cur?.mode === 'marquee') {
      const r = { x: Math.min(cur.sx, w.x), y: Math.min(cur.sy, w.y), w: Math.abs(w.x - cur.sx), h: Math.abs(w.y - cur.sy) }
      setMarquee(r)
      const inside = items.filter((i) => {
        const b = bbox(i)
        return b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y
      })
      setSel(new Set(inside.map((i) => i.id)))
    } else if (cur?.mode === 'move') {
      const moving = Object.values(cur.orig)
      const { dx, dy } = snapMove(moving, w.x - cur.sx, w.y - cur.sy)
      setItems((arr) =>
        arr.map((i) => {
          const o = cur.orig[i.id]
          if (!o) return i
          return { ...i, x: o.x + dx, y: o.y + dy, ...(o.x2 != null ? { x2: o.x2 + dx, y2: (o.y2 ?? 0) + dy } : {}) }
        }),
      )
    } else if (cur?.mode === 'createShape') {
      let nx = Math.min(cur.ox, w.x)
      let ny = Math.min(cur.oy, w.y)
      let nw = Math.abs(w.x - cur.ox)
      let nh = Math.abs(w.y - cur.oy)
      if (cur.type === 'ellipse') {
        const s = Math.max(nw, nh)
        nx = w.x < cur.ox ? cur.ox - s : cur.ox
        ny = w.y < cur.oy ? cur.oy - s : cur.oy
        nw = s
        nh = s
      }
      nw = Math.max(1, nw)
      nh = Math.max(1, nh)
      setItems((arr) => arr.map((i) => (i.id === cur.id ? { ...i, x: nx, y: ny, w: nw, h: nh } : i)))
      setDims({ x: nx + nw / 2, y: ny, w: nw, h: nh })
    } else if (cur?.mode === 'resize') {
      const o = cur.orig
      let { x, y, w: ww, h: hh } = o
      const dx = w.x - cur.sx
      const dy = w.y - cur.sy
      if (cur.handle.includes('e')) ww = Math.max(24, o.w + dx)
      if (cur.handle.includes('s')) hh = Math.max(20, o.h + dy)
      if (cur.handle.includes('w')) { ww = Math.max(24, o.w - dx); x = o.x + (o.w - ww) }
      if (cur.handle.includes('n')) { hh = Math.max(20, o.h - dy); y = o.y + (o.h - hh) }
      if (o.type === 'ellipse') {
        const s = Math.max(ww, hh)
        ww = s
        hh = s
        if (cur.handle.includes('w')) x = o.x + (o.w - ww)
        if (cur.handle.includes('n')) y = o.y + (o.h - hh)
      }
      const extra =
        o.type === 'text'
          ? { fontSize: Math.max(6, Math.round((o.fontSize ?? 16) * (hh / (o.h || 1)))) }
          : {}
      setItems((arr) => arr.map((i) => (i.id === o.id ? { ...i, x, y, w: ww, h: hh, ...extra } : i)))
      setDims({ x: x + ww / 2, y, w: ww, h: hh })
    } else if (cur?.mode === 'endpoint') {
      const p = snapEndpoint(w.x, w.y, cur.id)
      setItems((arr) => arr.map((i) => (i.id === cur.id ? { ...i, ...(cur.which === 'start' ? { x: p.x, y: p.y } : { x2: p.x, y2: p.y }) } : i)))
    } else if (cur?.mode === 'draw') {
      const p = snapEndpoint(w.x, w.y, cur.id)
      setItems((arr) => arr.map((i) => (i.id === cur.id ? { ...i, x2: p.x, y2: p.y } : i)))
    } else if (cur?.mode === 'freehand') {
      setFreehand((f) => (f ? { ...f, pts: [...f.pts, { x: w.x - f.ox, y: w.y - f.oy }] } : f))
    }

    const now = Date.now()
    if (user && now - lastCursor.current > 90) {
      lastCursor.current = now
      void setDoc(doc(db, 'whiteboards', boardId, 'cursors', user.uid), {
        x: w.x, y: w.y, name: profile?.displayName ?? 'Member', color: myColor, updatedAt: serverTimestamp(),
      })
    }
  }

  const commit = () => {
    const cur = it.current
    it.current = null
    setMarquee(null)
    setDims(null)
    setGuides({ v: [], h: [] })
    if (!cur) return
    if (cur.mode === 'freehand') {
      const f = freehand
      setFreehand(null)
      setTool('select')
      if (f && f.pts.length > 1) {
        const xs = f.pts.map((p) => p.x)
        const ys = f.pts.map((p) => p.y)
        const minx = Math.min(...xs), miny = Math.min(...ys)
        const maxx = Math.max(...xs), maxy = Math.max(...ys)
        const pts = f.pts.map((p) => ({ x: p.x - minx, y: p.y - miny }))
        const st = styleRef.current
        void addDoc(col, {
          type: 'draw',
          x: f.ox + minx, y: f.oy + miny,
          w: Math.max(1, maxx - minx), h: Math.max(1, maxy - miny),
          points: pts,
          color: st.color ?? '#1c1a19',
          thickness: st.thickness ?? 3,
          penType: st.penType ?? 'pen',
          dash: st.dash ?? 'solid',
          opacity: st.opacity ?? 1,
          z: nextZ(),
          authorUid: user?.uid ?? '',
        })
      }
      return
    }
    if (cur.mode === 'move') {
      for (const id of Object.keys(cur.orig)) {
        const c = items.find((i) => i.id === id)
        if (c) patch(id, c.x2 != null ? { x: c.x, y: c.y, x2: c.x2, y2: c.y2 } : { x: c.x, y: c.y })
      }
    } else if (cur.mode === 'resize') {
      const c = items.find((i) => i.id === cur.id)
      if (c) patch(cur.id, { x: c.x, y: c.y, w: c.w, h: c.h, ...(c.type === 'text' ? { fontSize: c.fontSize ?? 16 } : {}) })
    } else if (cur.mode === 'createShape') {
      const c = items.find((i) => i.id === cur.id)
      if (c) {
        if (c.w < 8 && c.h < 8) {
          const d = DEFAULTS[cur.type]
          patch(cur.id, { x: Math.round(cur.ox - d.w / 2), y: Math.round(cur.oy - d.h / 2), w: d.w, h: d.h })
        } else patch(cur.id, { x: c.x, y: c.y, w: c.w, h: c.h })
      }
      setTool('select') // revert to select after creating
    } else if (cur.mode === 'endpoint' || cur.mode === 'draw') {
      const c = items.find((i) => i.id === cur.id)
      if (c) patch(cur.id, { x: c.x, y: c.y, x2: c.x2, y2: c.y2 })
      if (cur.mode === 'draw') setTool('select') // revert after drawing a connector
    }
  }

  const onWheel = (e: React.WheelEvent) => {
    const r = containerRef.current!.getBoundingClientRect()
    const px = e.clientX - r.left
    const py = e.clientY - r.top
    const nz = Math.min(3, Math.max(0.25, zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)))
    setPan({ x: px - ((px - pan.x) / zoom) * nz, y: py - ((py - pan.y) / zoom) * nz })
    setZoom(nz)
  }

  const zoomBy = (factor: number) => {
    const r = containerRef.current!.getBoundingClientRect()
    const px = r.width / 2
    const py = r.height / 2
    const nz = Math.min(3, Math.max(0.25, zoom * factor))
    setPan({ x: px - ((px - pan.x) / zoom) * nz, y: py - ((py - pan.y) / zoom) * nz })
    setZoom(nz)
  }
  const resetView = () => {
    setZoom(1)
    setPan({ x: 40, y: 40 })
  }

  // item interactions
  const startMove = (e: React.PointerEvent, item: BoardItem) => {
    if (e.button !== 0 || tool !== 'select' || editingId === item.id) return
    e.stopPropagation()
    const nextSel = sel.has(item.id) ? sel : new Set([item.id])
    setSel(nextSel)
    const w = toWorld(e.clientX, e.clientY)
    const orig: Record<string, BoardItem> = {}
    items.filter((i) => nextSel.has(i.id)).forEach((i) => (orig[i.id] = { ...i }))
    it.current = { mode: 'move', sx: w.x, sy: w.y, orig }
  }
  const startResize = (e: React.PointerEvent, item: BoardItem, handle: Handle) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const w = toWorld(e.clientX, e.clientY)
    it.current = { mode: 'resize', id: item.id, handle, sx: w.x, sy: w.y, orig: { ...item } }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTool('select')
        setEditingId(null)
        setSel(new Set())
        setMenu(null)
        return
      }
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (editingId) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.size) {
        e.preventDefault()
        del([...sel])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, editingId])

  const selArr = items.filter((i) => sel.has(i.id))
  const first = selArr[0]
  const connLike = selArr.length > 0 && selArr.every((i) => CONNECTORS.includes(i.type))
  const ordered = [...items].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
  const curSize = first?.fontSize ?? (first?.type === 'text' ? 16 : 14)
  const bumpSize = (delta: number) => {
    const n = Math.max(6, Math.min(400, curSize + delta))
    applyStyle({ fontSize: n })
  }

  // Dynamic grid: keep on-screen spacing near ~30px, doubling/halving as you
  // zoom so the grid merges/unmerges like Miro.
  const baseScreen = 26 * zoom
  const gf = Math.pow(2, Math.round(Math.log2(30 / baseScreen)))
  const gridPx = baseScreen * (Number.isFinite(gf) && gf > 0 ? gf : 1)
  const surfaceCursor =
    tool === 'hand' ? 'grab' : tool === 'select' ? 'default' : 'crosshair'

  // Current style values (from the selection, else the carry-over defaults).
  const g = <K extends keyof BoardItem>(k: K, fb: NonNullable<BoardItem[K]>): NonNullable<BoardItem[K]> =>
    ((first ? first[k] : style[k]) ?? fb) as NonNullable<BoardItem[K]>
  const creating = tool !== 'select' && tool !== 'hand'
  const activeType: BoardItemType | undefined = first?.type ?? (creating ? (tool as BoardItemType) : undefined)
  const showFont = !!activeType && !CONNECTORS.includes(activeType) && activeType !== 'image' && activeType !== 'draw'
  const showBorder = !!activeType && BORDER_SHAPES.includes(activeType)
  const showPen = activeType === 'draw'
  const showConn = !!activeType && CONNECTORS.includes(activeType)
  const showControls = selArr.length > 0 || creating

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      {/* Toolbar */}
      <div className="absolute left-3 top-3 z-20 flex items-center gap-1 rounded-xl border border-border bg-surface/95 p-1 shadow-md backdrop-blur">
        {TOOLBAR.map(({ tool: t, icon: Icon, label }) => (
          <button key={t} onClick={() => setTool(t)} title={label}
            className={`grid h-9 w-9 place-items-center rounded-lg transition ${tool === t ? 'bg-brand text-white' : 'text-muted hover:bg-surface-2 hover:text-ink'}`}>
            <Icon size={17} />
          </button>
        ))}
        <button onClick={() => setLibrary(true)} title="Shape library"
          className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink">
          <Shapes size={17} />
        </button>
        <button onClick={() => fileRef.current?.click()} title="Upload image" disabled={uploading}
          className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-50">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={17} />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f) }} />
        {showControls && (
          <>
            <span className="mx-1 h-6 w-px bg-border" />

            {/* Font + size */}
            {showFont && (
              <>
                <select
                  value={g('fontFamily', BOARD_FONTS[0].value)}
                  onChange={(e) => applyStyle({ fontFamily: e.target.value })}
                  title="Font"
                  className="h-8 rounded-lg border border-border bg-surface px-1.5 text-xs text-ink outline-none"
                  style={{ fontFamily: g('fontFamily', BOARD_FONTS[0].value) }}
                >
                  {BOARD_FONTS.map((f) => (
                    <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                  ))}
                </select>
                <div className="flex items-center rounded-lg border border-border">
                  <button onClick={() => bumpSize(-2)} title="Smaller" className="grid h-8 w-6 place-items-center text-muted hover:text-ink"><ChevronDown size={14} /></button>
                  <input type="number" list="wb-sizes" value={curSize}
                    onChange={(e) => { const n = Number(e.target.value); if (n) applyStyle({ fontSize: Math.max(6, Math.min(400, n)) }) }}
                    title="Font size" className="h-8 w-11 bg-transparent text-center text-xs text-ink outline-none" />
                  <button onClick={() => bumpSize(2)} title="Larger" className="grid h-8 w-6 place-items-center text-muted hover:text-ink"><ChevronUp size={14} /></button>
                </div>
                <datalist id="wb-sizes">{BOARD_FONT_SIZES.map((n) => <option key={n} value={n} />)}</datalist>
              </>
            )}

            {/* Pen (freehand) */}
            {showPen && (
              <>
                <select value={g('penType', 'pen')} onChange={(e) => applyStyle({ penType: e.target.value as 'pen' | 'marker' | 'highlighter' })} title="Pen type" className="h-8 rounded-lg border border-border bg-surface px-1.5 text-xs text-ink outline-none">
                  <option value="pen">Pen</option>
                  <option value="marker">Marker</option>
                  <option value="highlighter">Highlighter</option>
                </select>
                <select value={g('thickness', 3)} onChange={(e) => applyStyle({ thickness: Number(e.target.value) })} title="Size" className="h-8 rounded-lg border border-border bg-surface px-1.5 text-xs text-ink outline-none">
                  {[1, 2, 3, 5, 8, 12].map((n) => <option key={n} value={n}>{n}px</option>)}
                </select>
                <select value={g('dash', 'solid')} onChange={(e) => applyStyle({ dash: e.target.value as 'solid' | 'dashed' | 'dotted' })} title="Line style" className="h-8 rounded-lg border border-border bg-surface px-1.5 text-xs text-ink outline-none">
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </>
            )}

            {/* Connector styling */}
            {showConn && (
              <>
                {connLike && (
                  <button onClick={() => selArr.forEach((s) => patch(s.id, { type: s.type === 'arrow' ? 'line' : 'arrow' }))} title="Toggle arrow / line" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink">
                    {g('type', 'arrow') === 'arrow' ? <MoveUpRight size={16} /> : <Minus size={16} />}
                  </button>
                )}
                <select value={g('thickness', 2.5)} onChange={(e) => applyStyle({ thickness: Number(e.target.value) })} title="Thickness" className="h-8 rounded-lg border border-border bg-surface px-1.5 text-xs text-ink outline-none">
                  {[1, 2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n}px</option>)}
                </select>
                <select value={g('dash', 'solid')} onChange={(e) => applyStyle({ dash: e.target.value as 'solid' | 'dashed' | 'dotted' })} title="Line style" className="h-8 rounded-lg border border-border bg-surface px-1.5 text-xs text-ink outline-none">
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </>
            )}

            {/* Border (shapes) */}
            {showBorder && (
              <div className="flex items-center gap-1 rounded-lg border border-border px-1" title="Border">
                <SquareIcon size={13} className="text-muted" />
                <select value={g('borderWidth', 1)} onChange={(e) => applyStyle({ borderWidth: Number(e.target.value) })} className="h-8 bg-transparent text-xs text-ink outline-none">
                  {[0, 1, 2, 3, 4, 6].map((n) => <option key={n} value={n}>{n === 0 ? 'none' : `${n}px`}</option>)}
                </select>
                <select value={g('borderDash', 'solid')} onChange={(e) => applyStyle({ borderDash: e.target.value as 'solid' | 'dashed' | 'dotted' })} className="h-8 bg-transparent text-xs text-ink outline-none">
                  <option value="solid">solid</option>
                  <option value="dashed">dashed</option>
                  <option value="dotted">dotted</option>
                </select>
                <input type="color" value={g('borderColor', '#94a3b8')} onChange={(e) => applyStyle({ borderColor: e.target.value })} title="Border color" className="h-6 w-6 cursor-pointer rounded border border-border bg-transparent" />
              </div>
            )}

            {/* Color */}
            <div className="relative">
              <button onClick={() => setColorOpen((v) => !v)} title="Color" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink">
                <Palette size={16} />
              </button>
              {colorOpen && (
                <ColorPopover value={g('color', '#1c1a19')} onChange={(c) => applyStyle({ color: c })} onClose={() => setColorOpen(false)} />
              )}
            </div>

            {selArr.length > 0 && (
              <button onClick={() => del([...sel])} title="Delete" className="ml-1 grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-brand-soft hover:text-brand">
                <Trash2 size={16} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-xl border border-border bg-surface/95 p-1 shadow-md backdrop-blur">
        <button onClick={() => zoomBy(1 / 1.2)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" title="Zoom out"><ZoomOut size={16} /></button>
        <input type="range" min={25} max={300} value={Math.round(zoom * 100)}
          onChange={(e) => zoomBy(Number(e.target.value) / 100 / zoom)}
          className="h-1 w-24 accent-brand" />
        <span className="w-10 text-center text-xs tabular-nums text-muted">{Math.round(zoom * 100)}%</span>
        <button onClick={() => zoomBy(1.2)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" title="Zoom in"><ZoomIn size={16} /></button>
        <button onClick={resetView} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" title="Reset view"><Maximize size={15} /></button>
      </div>

      {/* Canvas surface */}
      <div
        ref={containerRef}
        onPointerDown={onContainerPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={commit}
        onPointerLeave={commit}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDownCapture={() => setMenu(null)}
        className="wb-grid absolute inset-0 select-none"
        style={{
          cursor: surfaceCursor,
          backgroundColor: '#ffffff', // board stays white even in dark mode
          ['--grid' as string]: '#eef0f3', // lighter grid
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          backgroundSize: `${gridPx}px ${gridPx}px`,
        } as React.CSSProperties}
      >
        <div data-world className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          {/* connectors */}
          <svg className="pointer-events-none absolute overflow-visible" width={1} height={1}>
            <defs>
              {[...new Set(items.filter((i) => CONNECTORS.includes(i.type)).map((i) => i.color))].map((c) => (
                <marker key={c} id={`ar-${safeId(c)}`} markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L7,3 L0,6 Z" fill={c} />
                </marker>
              ))}
            </defs>
            {ordered.filter((i) => CONNECTORS.includes(i.type)).map((a) => (
              <g key={a.id} style={{ opacity: a.opacity ?? 1 }}>
                <line x1={a.x} y1={a.y} x2={a.x2} y2={a.y2} stroke="transparent" strokeWidth={14} className="pointer-events-auto cursor-move" onPointerDown={(e) => startMove(e as unknown as React.PointerEvent, a)} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSel(new Set([a.id])); setMenu({ x: e.clientX, y: e.clientY }) }} />
                <line x1={a.x} y1={a.y} x2={a.x2} y2={a.y2} stroke={a.color} strokeWidth={a.thickness ?? 2.5} strokeDasharray={DASH_MAP[a.dash ?? 'solid']} strokeLinecap="round" markerEnd={a.type === 'arrow' ? `url(#ar-${safeId(a.color)})` : undefined} />
                {sel.has(a.id) && (
                  <>
                    <circle cx={a.x} cy={a.y} r={6} fill="#fff" stroke="var(--brand)" strokeWidth={2} className="pointer-events-auto cursor-crosshair" onPointerDown={(e) => { e.stopPropagation(); it.current = { mode: 'endpoint', id: a.id, which: 'start' } }} />
                    <circle cx={a.x2} cy={a.y2} r={6} fill="#fff" stroke="var(--brand)" strokeWidth={2} className="pointer-events-auto cursor-crosshair" onPointerDown={(e) => { e.stopPropagation(); it.current = { mode: 'endpoint', id: a.id, which: 'end' } }} />
                  </>
                )}
              </g>
            ))}
            {/* freehand drawings */}
            {ordered.filter((i) => i.type === 'draw' && i.points).map((dr) => {
              const pen = PEN_TYPES[dr.penType ?? 'pen']
              const pts = dr.points!.map((p) => `${dr.x + p.x},${dr.y + p.y}`).join(' ')
              const sw = (dr.thickness ?? 3) * pen.widthMul
              return (
                <g key={dr.id} style={{ opacity: (dr.opacity ?? 1) * pen.opacity }}>
                  <polyline points={pts} fill="none" stroke="transparent" strokeWidth={Math.max(sw, 14)} className="pointer-events-auto cursor-move" onPointerDown={(e) => startMove(e as unknown as React.PointerEvent, dr)} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSel(new Set([dr.id])); setMenu({ x: e.clientX, y: e.clientY }) }} />
                  <polyline points={pts} fill="none" stroke={dr.color} strokeWidth={sw} strokeLinecap={pen.cap as 'round' | 'butt'} strokeLinejoin="round" strokeDasharray={DASH_MAP[dr.dash ?? 'solid']} />
                  {sel.has(dr.id) && <rect x={dr.x - 4} y={dr.y - 4} width={dr.w + 8} height={dr.h + 8} fill="none" stroke="var(--brand)" strokeWidth={1 / zoom} strokeDasharray="4 4" />}
                </g>
              )
            })}
            {/* live freehand stroke */}
            {freehand && (
              <polyline
                points={freehand.pts.map((p) => `${freehand.ox + p.x},${freehand.oy + p.y}`).join(' ')}
                fill="none"
                stroke={style.color ?? '#1c1a19'}
                strokeWidth={(style.thickness ?? 3) * PEN_TYPES[style.penType ?? 'pen'].widthMul}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={PEN_TYPES[style.penType ?? 'pen'].opacity}
              />
            )}
            {/* snap guides */}
            {guides.v.map((v, i) => <line key={'v' + i} x1={v} y1={-4000} x2={v} y2={4000} stroke="var(--brand)" strokeWidth={1 / zoom} strokeDasharray="4 4" />)}
            {guides.h.map((h, i) => <line key={'h' + i} x1={-4000} y1={h} x2={4000} y2={h} stroke="var(--brand)" strokeWidth={1 / zoom} strokeDasharray="4 4" />)}
          </svg>

          {ordered.filter((i) => !CONNECTORS.includes(i.type) && i.type !== 'draw').map((item) => (
            <ItemView key={item.id} item={item} selected={sel.has(item.id)} editing={editingId === item.id} zoom={zoom}
              targets={targets}
              onPointerDown={(e) => startMove(e, item)}
              onDoubleClick={() => { if (item.type === 'image') return; setSel(new Set([item.id])); setEditingId(item.id) }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSel(new Set([item.id])); setMenu({ x: e.clientX, y: e.clientY }) }}
              onChangeText={(text) => onChangeText(item.id, text)}
              onEndEdit={() => setEditingId(null)}
              onStartConnector={(side) => void startConnectorFrom(item, side)}
              onResize={(e, h) => startResize(e, item, h)} />
          ))}

          {/* dimension badge */}
          {dims && (
            <div className="pointer-events-none absolute rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ left: dims.x, top: dims.y - 22 / zoom, transform: `translateX(-50%) scale(${1 / zoom})`, transformOrigin: 'center' }}>
              {Math.round(dims.w)} × {Math.round(dims.h)}
            </div>
          )}

          {/* marquee */}
          {marquee && (
            <div className="pointer-events-none absolute border border-brand bg-brand/10" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />
          )}

          {/* cursors */}
          {cursors.filter((c) => c.uid !== user?.uid && isOnline(c.updatedAt as never)).map((c) => (
            <div key={c.uid} className="pointer-events-none absolute z-50" style={{ left: c.x, top: c.y, transform: `scale(${1 / zoom})`, transformOrigin: 'top left' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={c.color}><path d="M4 2 L20 12 L13 13 L9 21 Z" /></svg>
              <span className="ml-3 rounded px-1.5 py-0.5 text-[0.65rem] font-semibold text-white" style={{ background: c.color }}>{c.name}</span>
            </div>
          ))}
        </div>
      </div>

      {menu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setMenu(null) }}
          />
          <div
            className="fixed z-50 w-52 rounded-xl border border-border bg-surface p-1 text-sm shadow-xl"
            style={{ left: Math.min(menu.x, window.innerWidth - 220), top: Math.min(menu.y, window.innerHeight - 340) }}
          >
            <button onClick={() => { void duplicate(); setMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-ink transition hover:bg-surface-2">
              <Copy size={14} /> Duplicate
            </button>
            <button onClick={() => { selArr.forEach((s) => patch(s.id, { text: '' })); setMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-ink transition hover:bg-surface-2">
              <X size={14} /> Clear content
            </button>
            <div className="my-1 border-t border-border" />
            <button onClick={() => { arrange('front'); setMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-ink transition hover:bg-surface-2">
              <BringToFront size={14} /> Bring to front
            </button>
            <button onClick={() => { arrange('forward'); setMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-ink transition hover:bg-surface-2">
              <ChevronUp size={14} /> Bring forward
            </button>
            <button onClick={() => { arrange('backward'); setMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-ink transition hover:bg-surface-2">
              <ChevronDown size={14} /> Send backward
            </button>
            <button onClick={() => { arrange('back'); setMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-ink transition hover:bg-surface-2">
              <SendToBack size={14} /> Send to back
            </button>
            <div className="my-1 border-t border-border" />
            <div className="px-3 py-1.5">
              <div className="mb-1 text-[0.62rem] font-semibold uppercase tracking-wide text-muted">Opacity</div>
              <input
                type="range"
                min={10}
                max={100}
                value={Math.round((first?.opacity ?? 1) * 100)}
                onChange={(e) => selArr.forEach((s) => patch(s.id, { opacity: Number(e.target.value) / 100 }))}
                className="h-1 w-full accent-brand"
              />
            </div>
            <div className="my-1 border-t border-border" />
            <button onClick={() => { del([...sel]); setMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-brand transition hover:bg-brand-soft">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </>
      )}

      {library && <ShapeLibrary onPick={(t) => { setTool(t); setLibrary(false) }} onClose={() => setLibrary(false)} />}
    </div>
  )
}

function ShapeLibrary({ onPick, onClose }: { onPick: (t: BoardItemType) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onMouseDown={onClose} />
      <div className="relative z-10 w-full max-w-md animate-rise rounded-2xl border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink">Shapes &amp; elements</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={20} /></button>
        </div>
        <p className="mt-1 text-xs text-muted">Pick an element, then click the canvas to place it.</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {LIBRARY.map(({ type, icon: Icon, label }) => (
            <button key={type} onClick={() => onPick(type)}
              className="flex flex-col items-center gap-2 rounded-xl border border-border p-3 text-muted transition hover:border-brand/40 hover:text-brand">
              <Icon size={26} />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ItemView({
  item, selected, editing, zoom, targets, onPointerDown, onDoubleClick, onContextMenu, onChangeText, onEndEdit, onStartConnector, onResize,
}: {
  item: BoardItem
  selected: boolean
  editing: boolean
  zoom: number
  targets: MentionTarget[]
  onPointerDown: (e: React.PointerEvent) => void
  onDoubleClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onChangeText: (text: string) => void
  onEndEdit: () => void
  onStartConnector: (side: 'n' | 's' | 'e' | 'w') => void
  onResize: (e: React.PointerEvent, h: Handle) => void
}) {
  const isText = item.type === 'text'
  const isImage = item.type === 'image'
  const [hover, setHover] = useState(false)
  const [val, setVal] = useState(item.text ?? '')
  const [mq, setMq] = useState<string | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (editing) setVal(item.text ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const font = item.fontFamily
  const size = item.fontSize ?? (isText ? 16 : 14)
  const textStyle: React.CSSProperties = {
    color: isText ? item.color : 'rgba(0,0,0,.8)',
    fontFamily: font,
    fontSize: size,
  }

  const suggestions =
    mq !== null
      ? targets.filter((t) => t.handle.toLowerCase().startsWith(mq.toLowerCase())).slice(0, 5)
      : []
  const recompute = (text: string, pos: number) => {
    const m = text.slice(0, pos).match(/@([a-z0-9]*)$/i)
    setMq(m ? m[1] : null)
  }
  const change = (text: string, pos: number) => {
    setVal(text)
    onChangeText(text)
    recompute(text, pos)
  }
  const insertMention = (handle: string) => {
    const el = taRef.current
    const pos = el ? el.selectionStart : val.length
    const before = val.slice(0, pos).replace(/@([a-z0-9]*)$/i, `@${handle} `)
    const nv = before + val.slice(pos)
    setVal(nv)
    onChangeText(nv)
    setMq(null)
    requestAnimationFrame(() => {
      if (el) {
        el.focus()
        el.selectionStart = el.selectionEnd = before.length
      }
    })
  }

  const style: React.CSSProperties = { left: item.x, top: item.y, width: item.w, height: item.h }
  const inner: React.CSSProperties = {}
  const bColor = item.borderColor ?? 'rgba(0,0,0,.15)'
  const bStyle = item.borderDash === 'dashed' ? 'dashed' : item.borderDash === 'dotted' ? 'dotted' : 'solid'
  const border = (defaultW: number) => {
    const w = item.borderWidth != null ? item.borderWidth : defaultW
    inner.border = w > 0 ? `${w}px ${bStyle} ${bColor}` : 'none'
  }
  let cls = 'overflow-hidden'
  if (item.type === 'note') { cls = 'rounded-lg shadow-md'; inner.background = item.color; border(0) }
  else if (item.type === 'rect') { cls = ''; inner.background = item.color; border(1) }
  else if (item.type === 'round') { cls = 'rounded-2xl'; inner.background = item.color; border(1) }
  else if (item.type === 'ellipse') { cls = 'rounded-full'; inner.background = item.color; border(1) }
  else if (isImage) { cls = 'rounded-lg overflow-hidden shadow-sm' }
  else if (isText) cls = 'rounded'

  const clip =
    item.type === 'diamond' ? 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' :
    item.type === 'triangle' ? 'polygon(50% 0, 100% 100%, 0 100%)' : undefined

  const handleCursor: Record<Handle, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }
  const hpos: Record<Handle, React.CSSProperties> = {
    nw: { left: -4, top: -4 }, n: { left: '50%', top: -4, marginLeft: -4 }, ne: { right: -4, top: -4 },
    e: { right: -4, top: '50%', marginTop: -4 }, se: { right: -4, bottom: -4 }, s: { left: '50%', bottom: -4, marginLeft: -4 },
    sw: { left: -4, bottom: -4 }, w: { left: -4, top: '50%', marginTop: -4 },
  }

  return (
    <div className={`absolute flex items-center justify-center ${cls} ${selected ? 'ring-2 ring-brand' : ''}`}
      style={{ ...style, ...inner, opacity: item.opacity ?? 1, cursor: editing ? 'text' : 'move' }}
      onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {clip && <span className="pointer-events-none absolute inset-0" style={{ background: item.color, clipPath: clip, border: '1px solid rgba(0,0,0,.15)' }} />}

      {isImage ? (
        <img
          src={item.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
      ) : editing ? (
        <>
          <textarea ref={taRef} autoFocus value={val}
            onChange={(e) => change(e.target.value, e.target.selectionStart)}
            onKeyUp={(e) => recompute(e.currentTarget.value, e.currentTarget.selectionStart)}
            onBlur={() => { setTimeout(() => setMq(null), 150); onEndEdit() }}
            onPointerDown={(e) => e.stopPropagation()}
            className="relative z-10 h-full w-full resize-none select-text bg-transparent px-2 py-1 text-center outline-none"
            style={textStyle} />
          {suggestions.length > 0 && (
            <div
              className="absolute left-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-surface text-left shadow-xl"
              style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'top left' }}
            >
              {suggestions.map((t) => (
                <button
                  key={t.uid}
                  onMouseDown={(e) => { e.preventDefault(); insertMention(t.handle) }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-ink transition hover:bg-surface-2"
                >
                  <span className="font-semibold text-brand">@{t.handle}</span>
                  <span className="truncate text-xs text-muted">{t.name}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <span className={`relative z-10 whitespace-pre-wrap px-2 ${isText ? 'font-medium' : ''} ${!item.text ? 'opacity-40' : ''}`}
          style={textStyle}>
          {item.text || (isText ? 'Text' : '')}
        </span>
      )}

      {selected && !editing && HANDLES.map((h) => (
        <span key={h} onPointerDown={(e) => onResize(e, h)}
          className="absolute z-20 rounded-sm border border-white bg-brand"
          style={{ ...hpos[h], width: 8 / zoom, height: 8 / zoom, cursor: handleCursor[h] }} />
      ))}

      {/* Connector nubs — hover a shape to drag an arrow out from a side */}
      {hover && !selected && !editing && item.type !== 'text' && (
        <>
          {(['n', 's', 'e', 'w'] as const).map((side) => {
            const pos: Record<string, React.CSSProperties> = {
              n: { left: '50%', top: -12 / zoom, marginLeft: -6 / zoom },
              s: { left: '50%', bottom: -12 / zoom, marginLeft: -6 / zoom },
              e: { right: -12 / zoom, top: '50%', marginTop: -6 / zoom },
              w: { left: -12 / zoom, top: '50%', marginTop: -6 / zoom },
            }
            return (
              <span
                key={side}
                title="Drag to connect"
                onPointerDown={(e) => { e.stopPropagation(); onStartConnector(side) }}
                className="absolute z-30 rounded-full border-2 border-white bg-brand shadow"
                style={{ ...pos[side], width: 12 / zoom, height: 12 / zoom, cursor: 'crosshair' }}
              />
            )
          })}
        </>
      )}
    </div>
  )
}
