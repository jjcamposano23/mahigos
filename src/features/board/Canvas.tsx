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
  Loader2,
  X,
} from 'lucide-react'
import { db, storage } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { isOnline } from '../../lib/presence'
import { mentionTargets, notifyMentions } from '../../lib/notifications'
import {
  NOTE_COLORS,
  STROKE_COLORS,
  type BoardCursor,
  type BoardItem,
  type BoardItemType,
  type UserProfile,
} from '../../lib/types'

type Tool = 'select' | BoardItemType

const CURSOR_COLORS = ['#ef3422', '#2f6df0', '#2f8f6b', '#e8a33d', '#8b5cf6', '#0ea5a4', '#db2777']
function colorFor(uid: string) {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0
  return CURSOR_COLORS[h % CURSOR_COLORS.length]
}

const CONNECTORS: BoardItemType[] = ['arrow', 'line']
const DEFAULTS: Record<BoardItemType, { w: number; h: number; color: string }> = {
  note: { w: 170, h: 130, color: '#ffe08a' },
  rect: { w: 150, h: 90, color: '#c7ddff' },
  round: { w: 150, h: 90, color: '#c9ecd0' },
  ellipse: { w: 130, h: 110, color: '#ffd0c7' },
  diamond: { w: 130, h: 110, color: '#e6d2ff' },
  triangle: { w: 130, h: 110, color: '#c7ddff' },
  text: { w: 180, h: 40, color: '#1c1a19' },
  arrow: { w: 0, h: 0, color: '#1c1a19' },
  line: { w: 0, h: 0, color: '#1c1a19' },
  image: { w: 220, h: 160, color: '#ffffff' },
}

const TOOLBAR: { tool: Tool; icon: typeof Square; label: string }[] = [
  { tool: 'select', icon: MousePointer2, label: 'Select (left-drag to marquee)' },
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

const bbox = (i: BoardItem) =>
  i.type === 'arrow' || i.type === 'line'
    ? {
        x: Math.min(i.x, i.x2 ?? i.x),
        y: Math.min(i.y, i.y2 ?? i.y),
        w: Math.abs((i.x2 ?? i.x) - i.x),
        h: Math.abs((i.y2 ?? i.y) - i.y),
      }
    : { x: i.x, y: i.y, w: i.w, h: i.h }

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
  const fileRef = useRef<HTMLInputElement>(null)

  const it = useRef<Interaction>(null)
  const lastCursor = useRef(0)
  const myColor = colorFor(user?.uid ?? 'x')
  const targets = useMemo(() => mentionTargets(members), [members])

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

  // Save text and fan out @mention notifications.
  const commitText = (id: string, text: string) => {
    patch(id, { text })
    setEditingId(null)
    if (text.trim())
      void notifyMentions(text, targets, {
        fromUid: user?.uid ?? '',
        fromName: profile?.displayName ?? 'Member',
        context: 'on a whiteboard',
        link: '/whiteboard',
      })
  }

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

  const create = async (type: BoardItemType, wx: number, wy: number) => {
    const d = DEFAULTS[type]
    if (CONNECTORS.includes(type)) {
      const refDoc = await addDoc(col, { type, x: wx, y: wy, w: 0, h: 0, x2: wx, y2: wy, text: '', color: '#1c1a19', authorUid: user?.uid ?? '' })
      it.current = { mode: 'draw', id: refDoc.id }
      setSel(new Set([refDoc.id]))
      return
    }
    const refDoc = await addDoc(col, { type, x: Math.round(wx - d.w / 2), y: Math.round(wy - d.h / 2), w: d.w, h: d.h, text: '', color: d.color, authorUid: user?.uid ?? '' })
    setSel(new Set([refDoc.id]))
    setTool('select')
    if (type === 'text' || type === 'note') setEditingId(refDoc.id)
  }

  // ---------- container pointer handlers ----------
  const onContainerPointerDown = (e: React.PointerEvent) => {
    // right button always pans
    if (e.button === 2) {
      it.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, opx: pan.x, opy: pan.y }
      return
    }
    if (e.button !== 0) return
    if (e.target !== containerRef.current && !(e.target as HTMLElement).dataset.world) return
    setEditingId(null)
    const w = toWorld(e.clientX, e.clientY)
    if (tool === 'select') {
      setSel(new Set())
      it.current = { mode: 'marquee', sx: w.x, sy: w.y }
      setMarquee({ x: w.x, y: w.y, w: 0, h: 0 })
      return
    }
    void create(tool, w.x, w.y)
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
    } else if (cur?.mode === 'resize') {
      const o = cur.orig
      let { x, y, w: ww, h: hh } = o
      const dx = w.x - cur.sx
      const dy = w.y - cur.sy
      if (cur.handle.includes('e')) ww = Math.max(24, o.w + dx)
      if (cur.handle.includes('s')) hh = Math.max(20, o.h + dy)
      if (cur.handle.includes('w')) { ww = Math.max(24, o.w - dx); x = o.x + (o.w - ww) }
      if (cur.handle.includes('n')) { hh = Math.max(20, o.h - dy); y = o.y + (o.h - hh) }
      setItems((arr) => arr.map((i) => (i.id === o.id ? { ...i, x, y, w: ww, h: hh } : i)))
      setDims({ x: x + ww / 2, y, w: ww, h: hh })
    } else if (cur?.mode === 'endpoint') {
      setItems((arr) => arr.map((i) => (i.id === cur.id ? { ...i, ...(cur.which === 'start' ? { x: w.x, y: w.y } : { x2: w.x, y2: w.y }) } : i)))
    } else if (cur?.mode === 'draw') {
      setItems((arr) => arr.map((i) => (i.id === cur.id ? { ...i, x2: w.x, y2: w.y } : i)))
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
    if (cur.mode === 'move') {
      for (const id of Object.keys(cur.orig)) {
        const c = items.find((i) => i.id === id)
        if (c) patch(id, c.x2 != null ? { x: c.x, y: c.y, x2: c.x2, y2: c.y2 } : { x: c.x, y: c.y })
      }
    } else if (cur.mode === 'resize') {
      const c = items.find((i) => i.id === cur.id)
      if (c) patch(cur.id, { x: c.x, y: c.y, w: c.w, h: c.h })
    } else if (cur.mode === 'endpoint' || cur.mode === 'draw') {
      const c = items.find((i) => i.id === cur.id)
      if (c) patch(cur.id, { x: c.x, y: c.y, x2: c.x2, y2: c.y2 })
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
  const paletteFor =
    selArr.length && selArr.every((i) => i.type === 'text' || CONNECTORS.includes(i.type))
      ? STROKE_COLORS
      : NOTE_COLORS

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
        {selArr.length > 0 && (
          <>
            <span className="mx-1 h-6 w-px bg-border" />
            {paletteFor.map((c) => (
              <button key={c} onClick={() => selArr.forEach((s) => patch(s.id, { color: c }))}
                className="h-5 w-5 rounded-full border border-black/10 transition hover:scale-110" style={{ background: c }} />
            ))}
            <button onClick={() => del([...sel])} title="Delete"
              className="ml-1 grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-brand-soft hover:text-brand">
              <Trash2 size={16} />
            </button>
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
        className="wb-grid absolute inset-0 select-none"
        style={{ cursor: tool === 'select' ? 'default' : 'crosshair', backgroundPosition: `${pan.x}px ${pan.y}px`, backgroundSize: `${26 * zoom}px ${26 * zoom}px` }}
      >
        <div data-world className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          {/* connectors */}
          <svg className="pointer-events-none absolute overflow-visible" width={1} height={1}>
            <defs>
              {STROKE_COLORS.map((c) => (
                <marker key={c} id={`ar-${c.replace('#', '')}`} markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L7,3 L0,6 Z" fill={c} />
                </marker>
              ))}
            </defs>
            {items.filter((i) => CONNECTORS.includes(i.type)).map((a) => (
              <g key={a.id}>
                <line x1={a.x} y1={a.y} x2={a.x2} y2={a.y2} stroke="transparent" strokeWidth={14} className="pointer-events-auto cursor-move" onPointerDown={(e) => startMove(e as unknown as React.PointerEvent, a)} />
                <line x1={a.x} y1={a.y} x2={a.x2} y2={a.y2} stroke={a.color} strokeWidth={2.5} markerEnd={a.type === 'arrow' ? `url(#ar-${a.color.replace('#', '')})` : undefined} />
                {sel.has(a.id) && (
                  <>
                    <circle cx={a.x} cy={a.y} r={6} fill="#fff" stroke="var(--brand)" strokeWidth={2} className="pointer-events-auto cursor-crosshair" onPointerDown={(e) => { e.stopPropagation(); it.current = { mode: 'endpoint', id: a.id, which: 'start' } }} />
                    <circle cx={a.x2} cy={a.y2} r={6} fill="#fff" stroke="var(--brand)" strokeWidth={2} className="pointer-events-auto cursor-crosshair" onPointerDown={(e) => { e.stopPropagation(); it.current = { mode: 'endpoint', id: a.id, which: 'end' } }} />
                  </>
                )}
              </g>
            ))}
            {/* snap guides */}
            {guides.v.map((v, i) => <line key={'v' + i} x1={v} y1={-4000} x2={v} y2={4000} stroke="var(--brand)" strokeWidth={1 / zoom} strokeDasharray="4 4" />)}
            {guides.h.map((h, i) => <line key={'h' + i} x1={-4000} y1={h} x2={4000} y2={h} stroke="var(--brand)" strokeWidth={1 / zoom} strokeDasharray="4 4" />)}
          </svg>

          {items.filter((i) => !CONNECTORS.includes(i.type)).map((item) => (
            <ItemView key={item.id} item={item} selected={sel.has(item.id)} editing={editingId === item.id} zoom={zoom}
              onPointerDown={(e) => startMove(e, item)}
              onDoubleClick={() => { if (item.type === 'image') return; setSel(new Set([item.id])); setEditingId(item.id) }}
              onCommit={(text) => commitText(item.id, text)}
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

      {library && <ShapeLibrary onPick={(t) => { setTool(t); setLibrary(false) }} onClose={() => setLibrary(false)} />}
    </div>
  )
}

function ShapeLibrary({ onPick, onClose }: { onPick: (t: BoardItemType) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
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
  item, selected, editing, zoom, onPointerDown, onDoubleClick, onCommit, onResize,
}: {
  item: BoardItem
  selected: boolean
  editing: boolean
  zoom: number
  onPointerDown: (e: React.PointerEvent) => void
  onDoubleClick: () => void
  onCommit: (text: string) => void
  onResize: (e: React.PointerEvent, h: Handle) => void
}) {
  const isText = item.type === 'text'
  const isImage = item.type === 'image'
  const style: React.CSSProperties = { left: item.x, top: item.y, width: item.w, height: item.h }
  const inner: React.CSSProperties = {}
  let cls = 'overflow-hidden'
  if (item.type === 'note') { cls = 'rounded-lg shadow-md'; inner.background = item.color }
  else if (item.type === 'rect') { cls = 'border'; inner.background = item.color; inner.borderColor = 'rgba(0,0,0,.15)' }
  else if (item.type === 'round') { cls = 'rounded-2xl border'; inner.background = item.color; inner.borderColor = 'rgba(0,0,0,.15)' }
  else if (item.type === 'ellipse') { cls = 'rounded-full border'; inner.background = item.color; inner.borderColor = 'rgba(0,0,0,.15)' }
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
      style={{ ...style, ...inner, cursor: editing ? 'text' : 'move' }}
      onPointerDown={onPointerDown} onDoubleClick={onDoubleClick}>
      {clip && <span className="pointer-events-none absolute inset-0" style={{ background: item.color, clipPath: clip, border: '1px solid rgba(0,0,0,.15)' }} />}

      {isImage ? (
        <img
          src={item.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
      ) : editing ? (
        <textarea autoFocus defaultValue={item.text}
          onBlur={(e) => onCommit(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          className="relative z-10 h-full w-full resize-none select-text bg-transparent px-2 py-1 text-center text-sm outline-none"
          style={{ color: isText ? item.color : 'rgba(0,0,0,.8)' }} />
      ) : (
        <span className={`relative z-10 whitespace-pre-wrap px-2 text-sm ${isText ? 'font-medium' : ''} ${!item.text ? 'opacity-40' : ''}`}
          style={{ color: isText ? item.color : 'rgba(0,0,0,.8)' }}>
          {item.text || (isText ? 'Text' : '')}
        </span>
      )}

      {selected && !editing && HANDLES.map((h) => (
        <span key={h} onPointerDown={(e) => onResize(e, h)}
          className="absolute z-20 rounded-sm border border-white bg-brand"
          style={{ ...hpos[h], width: 8 / zoom, height: 8 / zoom, cursor: handleCursor[h] }} />
      ))}
    </div>
  )
}
