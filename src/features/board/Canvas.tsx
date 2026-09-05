import { useEffect, useRef, useState } from 'react'
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
import {
  MousePointer2,
  StickyNote,
  Square,
  Circle,
  Diamond,
  Type,
  MoveUpRight,
  Trash2,
} from 'lucide-react'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { isOnline } from '../../lib/presence'
import {
  NOTE_COLORS,
  STROKE_COLORS,
  type BoardCursor,
  type BoardItem,
  type BoardItemType,
} from '../../lib/types'

type Tool = 'select' | BoardItemType

const CURSOR_COLORS = ['#ef3422', '#2f6df0', '#2f8f6b', '#e8a33d', '#8b5cf6', '#0ea5a4', '#db2777']
function colorFor(uid: string) {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0
  return CURSOR_COLORS[h % CURSOR_COLORS.length]
}

const DEFAULTS: Record<BoardItemType, Partial<BoardItem>> = {
  note: { w: 170, h: 130, color: '#ffe08a' },
  rect: { w: 150, h: 90, color: '#c7ddff' },
  ellipse: { w: 130, h: 110, color: '#c9ecd0' },
  diamond: { w: 130, h: 110, color: '#e6d2ff' },
  text: { w: 180, h: 40, color: '#1c1a19' },
  arrow: { w: 0, h: 0, color: '#1c1a19' },
}

type Interaction =
  | { mode: 'move'; id: string; sx: number; sy: number; orig: BoardItem }
  | { mode: 'resize'; id: string; sx: number; sy: number; orig: BoardItem }
  | { mode: 'endpoint'; id: string; which: 'start' | 'end' }
  | { mode: 'draw-arrow'; id: string }
  | null

const TOOLS: { tool: Tool; icon: typeof Square; label: string }[] = [
  { tool: 'select', icon: MousePointer2, label: 'Select' },
  { tool: 'note', icon: StickyNote, label: 'Sticky note' },
  { tool: 'rect', icon: Square, label: 'Rectangle' },
  { tool: 'ellipse', icon: Circle, label: 'Ellipse' },
  { tool: 'diamond', icon: Diamond, label: 'Diamond' },
  { tool: 'text', icon: Type, label: 'Text' },
  { tool: 'arrow', icon: MoveUpRight, label: 'Arrow' },
]

export function Canvas({ boardId }: { boardId: string }) {
  const { user, profile } = useAuth()
  const canvasRef = useRef<HTMLDivElement>(null)
  const col = collection(db, 'whiteboards', boardId, 'items')

  const [items, setItems] = useState<BoardItem[]>([])
  const [cursors, setCursors] = useState<(BoardCursor & { uid: string })[]>([])
  const [tool, setTool] = useState<Tool>('select')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const interaction = useRef<Interaction>(null)
  const lastCursorWrite = useRef(0)
  const myColor = colorFor(user?.uid ?? 'x')

  useEffect(() => {
    const unsubN = onSnapshot(col, (snap) =>
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BoardItem, 'id'>) }))),
    )
    const unsubC = onSnapshot(collection(db, 'whiteboards', boardId, 'cursors'), (snap) =>
      setCursors(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as BoardCursor) }))),
    )
    return () => {
      unsubN()
      unsubC()
      if (user) void deleteDoc(doc(db, 'whiteboards', boardId, 'cursors', user.uid))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, user])

  const toCanvas = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top }
  }

  const patch = (id: string, p: Partial<BoardItem>) => void updateDoc(doc(col, id), p)
  const del = (id: string) => {
    void deleteDoc(doc(col, id))
    setSelectedId(null)
  }

  const createAt = async (type: BoardItemType, x: number, y: number) => {
    const d = DEFAULTS[type]
    const w = d.w ?? 140
    const h = d.h ?? 90
    const refDoc = await addDoc(col, {
      type,
      x: Math.round(x - w / 2),
      y: Math.round(y - h / 2),
      w,
      h,
      text: '',
      color: d.color ?? '#c7ddff',
      authorUid: user?.uid ?? '',
    })
    setSelectedId(refDoc.id)
    setTool('select')
    if (type === 'text' || type === 'note') setEditingId(refDoc.id)
  }

  // ---- pointer handling on the canvas ----
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.target !== canvasRef.current) return // only when hitting empty canvas
    const { x, y } = toCanvas(e.clientX, e.clientY)
    setEditingId(null)
    if (tool === 'select') {
      setSelectedId(null)
      return
    }
    if (tool === 'arrow') {
      addDoc(col, {
        type: 'arrow',
        x,
        y,
        w: 0,
        h: 0,
        x2: x,
        y2: y,
        text: '',
        color: '#1c1a19',
        authorUid: user?.uid ?? '',
      }).then((refDoc) => {
        interaction.current = { mode: 'draw-arrow', id: refDoc.id }
        setSelectedId(refDoc.id)
      })
      return
    }
    void createAt(tool, x, y)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const { x, y } = toCanvas(e.clientX, e.clientY)
    const it = interaction.current

    if (it) {
      if (it.mode === 'move') {
        const nx = it.orig.x + (x - it.sx)
        const ny = it.orig.y + (y - it.sy)
        setItems((arr) =>
          arr.map((i) => {
            if (i.id !== it.id) return i
            if (i.type === 'arrow')
              return {
                ...i,
                x: nx,
                y: ny,
                x2: (it.orig.x2 ?? 0) + (x - it.sx),
                y2: (it.orig.y2 ?? 0) + (y - it.sy),
              }
            return { ...i, x: nx, y: ny }
          }),
        )
      } else if (it.mode === 'resize') {
        setItems((arr) =>
          arr.map((i) =>
            i.id === it.id
              ? { ...i, w: Math.max(40, it.orig.w + (x - it.sx)), h: Math.max(28, it.orig.h + (y - it.sy)) }
              : i,
          ),
        )
      } else if (it.mode === 'endpoint') {
        setItems((arr) =>
          arr.map((i) =>
            i.id === it.id ? { ...i, ...(it.which === 'start' ? { x, y } : { x2: x, y2: y }) } : i,
          ),
        )
      } else if (it.mode === 'draw-arrow') {
        setItems((arr) => arr.map((i) => (i.id === it.id ? { ...i, x2: x, y2: y } : i)))
      }
    }

    const now = Date.now()
    if (user && now - lastCursorWrite.current > 90) {
      lastCursorWrite.current = now
      void setDoc(doc(db, 'whiteboards', boardId, 'cursors', user.uid), {
        x,
        y,
        name: profile?.displayName ?? 'Member',
        color: myColor,
        updatedAt: serverTimestamp(),
      })
    }
  }

  const commit = () => {
    const it = interaction.current
    interaction.current = null
    if (!it) return
    const cur = items.find((i) => i.id === it.id)
    if (!cur) return
    if (it.mode === 'move') patch(it.id, cur.type === 'arrow' ? { x: cur.x, y: cur.y, x2: cur.x2, y2: cur.y2 } : { x: cur.x, y: cur.y })
    else if (it.mode === 'resize') patch(it.id, { w: cur.w, h: cur.h })
    else if (it.mode === 'endpoint' || it.mode === 'draw-arrow') patch(it.id, { x: cur.x, y: cur.y, x2: cur.x2, y2: cur.y2 })
  }

  const startMove = (e: React.PointerEvent, item: BoardItem) => {
    if (tool !== 'select' || editingId === item.id) return
    e.stopPropagation()
    setSelectedId(item.id)
    const { x, y } = toCanvas(e.clientX, e.clientY)
    interaction.current = { mode: 'move', id: item.id, sx: x, sy: y, orig: item }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const startResize = (e: React.PointerEvent, item: BoardItem) => {
    e.stopPropagation()
    const { x, y } = toCanvas(e.clientX, e.clientY)
    interaction.current = { mode: 'resize', id: item.id, sx: x, sy: y, orig: item }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  // keyboard delete
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingId) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        del(selectedId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, editingId])

  const selected = items.find((i) => i.id === selectedId) || null
  const paletteForSelected = selected
    ? selected.type === 'text' || selected.type === 'arrow'
      ? STROKE_COLORS
      : NOTE_COLORS
    : []

  return (
    <div className="relative min-h-0 flex-1 overflow-auto">
      {/* Toolbar */}
      <div className="pointer-events-auto absolute left-3 top-3 z-20 flex items-center gap-1 rounded-xl border border-border bg-surface/95 p-1 shadow-md backdrop-blur">
        {TOOLS.map(({ tool: t, icon: Icon, label }) => (
          <button
            key={t}
            onClick={() => setTool(t)}
            title={label}
            className={`grid h-9 w-9 place-items-center rounded-lg transition ${
              tool === t ? 'bg-brand text-white' : 'text-muted hover:bg-surface-2 hover:text-ink'
            }`}
          >
            <Icon size={17} />
          </button>
        ))}
        {selected && (
          <>
            <span className="mx-1 h-6 w-px bg-border" />
            {paletteForSelected.map((c) => (
              <button
                key={c}
                onClick={() => patch(selected.id, { color: c })}
                className="h-5 w-5 rounded-full border border-black/10 transition hover:scale-110"
                style={{ background: c }}
                title="Colour"
              />
            ))}
            <button
              onClick={() => del(selected.id)}
              title="Delete"
              className="ml-1 grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-brand-soft hover:text-brand"
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>

      <div
        ref={canvasRef}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={commit}
        onPointerLeave={commit}
        className="wb-grid relative h-[2000px] w-[3000px]"
        style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
      >
        {/* arrows layer */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            {STROKE_COLORS.map((c) => (
              <marker
                key={c}
                id={`arrow-${c.replace('#', '')}`}
                markerWidth="10"
                markerHeight="10"
                refX="7"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L7,3 L0,6 Z" fill={c} />
              </marker>
            ))}
          </defs>
          {items
            .filter((i) => i.type === 'arrow')
            .map((a) => (
              <g key={a.id}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={a.x2}
                  y2={a.y2}
                  stroke="transparent"
                  strokeWidth={14}
                  className="pointer-events-auto cursor-move"
                  onPointerDown={(e) => startMove(e as unknown as React.PointerEvent, a)}
                />
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={a.x2}
                  y2={a.y2}
                  stroke={a.color}
                  strokeWidth={2.5}
                  markerEnd={`url(#arrow-${a.color.replace('#', '')})`}
                />
                {selectedId === a.id && (
                  <>
                    <circle
                      cx={a.x}
                      cy={a.y}
                      r={6}
                      fill="#fff"
                      stroke="var(--brand)"
                      strokeWidth={2}
                      className="pointer-events-auto cursor-crosshair"
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        interaction.current = { mode: 'endpoint', id: a.id, which: 'start' }
                      }}
                    />
                    <circle
                      cx={a.x2}
                      cy={a.y2}
                      r={6}
                      fill="#fff"
                      stroke="var(--brand)"
                      strokeWidth={2}
                      className="pointer-events-auto cursor-crosshair"
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        interaction.current = { mode: 'endpoint', id: a.id, which: 'end' }
                      }}
                    />
                  </>
                )}
              </g>
            ))}
        </svg>

        {/* items */}
        {items
          .filter((i) => i.type !== 'arrow')
          .map((it) => (
            <ItemView
              key={it.id}
              item={it}
              selected={selectedId === it.id}
              editing={editingId === it.id}
              onPointerDown={(e) => startMove(e, it)}
              onDoubleClick={() => {
                setSelectedId(it.id)
                setEditingId(it.id)
              }}
              onEdit={(text) => patch(it.id, { text })}
              onEditDone={() => setEditingId(null)}
              onResize={(e) => startResize(e, it)}
            />
          ))}

        {/* live cursors */}
        {cursors
          .filter((c) => c.uid !== user?.uid && isOnline(c.updatedAt as never))
          .map((c) => (
            <div
              key={c.uid}
              className="pointer-events-none absolute z-50 transition-transform duration-75"
              style={{ left: c.x, top: c.y }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={c.color}>
                <path d="M4 2 L20 12 L13 13 L9 21 Z" />
              </svg>
              <span
                className="ml-3 rounded px-1.5 py-0.5 text-[0.65rem] font-semibold text-white"
                style={{ background: c.color }}
              >
                {c.name}
              </span>
            </div>
          ))}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-surface/90 px-3 py-1.5 text-xs text-muted shadow-sm">
        Pick a tool, then click the canvas · double-click to edit text · Del to remove
      </div>
    </div>
  )
}

function ItemView({
  item,
  selected,
  editing,
  onPointerDown,
  onDoubleClick,
  onEdit,
  onEditDone,
  onResize,
}: {
  item: BoardItem
  selected: boolean
  editing: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onDoubleClick: () => void
  onEdit: (text: string) => void
  onEditDone: () => void
  onResize: (e: React.PointerEvent) => void
}) {
  const isText = item.type === 'text'
  const base = 'absolute flex items-center justify-center overflow-hidden'
  const shapeStyle: React.CSSProperties = {
    left: item.x,
    top: item.y,
    width: item.w,
    height: item.h,
  }

  let boxClass = ''
  const inner: React.CSSProperties = {}
  if (item.type === 'note') {
    boxClass = 'rounded-lg shadow-md'
    inner.background = item.color
  } else if (item.type === 'rect') {
    boxClass = 'rounded-md border'
    inner.background = item.color
    inner.borderColor = 'rgba(0,0,0,0.15)'
  } else if (item.type === 'ellipse') {
    boxClass = 'rounded-full border'
    inner.background = item.color
    inner.borderColor = 'rgba(0,0,0,0.15)'
  } else if (item.type === 'diamond') {
    // background drawn by the clip-path span below
  } else if (isText) {
    boxClass = 'rounded'
  }

  return (
    <div
      className={`${base} ${boxClass} ${selected ? 'ring-2 ring-brand' : ''}`}
      style={{ ...shapeStyle, ...inner, cursor: editing ? 'text' : 'move' }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      {item.type === 'diamond' && (
        <span
          className="pointer-events-none absolute inset-0"
          style={{ background: item.color, clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)', border: '1px solid rgba(0,0,0,0.15)' }}
        />
      )}

      {editing ? (
        <textarea
          autoFocus
          defaultValue={item.text}
          onBlur={(e) => {
            onEdit(e.target.value)
            onEditDone()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="relative z-10 h-full w-full resize-none bg-transparent px-2 py-1 text-center text-sm outline-none"
          style={{ color: isText ? item.color : 'rgba(0,0,0,0.8)' }}
        />
      ) : (
        <span
          className={`relative z-10 whitespace-pre-wrap px-2 text-sm ${isText ? 'font-medium' : ''} ${
            !item.text ? 'opacity-40' : ''
          }`}
          style={{ color: isText ? item.color : 'rgba(0,0,0,0.8)' }}
        >
          {item.text || (isText ? 'Text' : '')}
        </span>
      )}

      {selected && !editing && (
        <span
          onPointerDown={onResize}
          className="absolute -bottom-1 -right-1 z-20 h-3 w-3 cursor-se-resize rounded-full border border-white bg-brand"
        />
      )}
    </div>
  )
}
