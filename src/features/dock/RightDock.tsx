import { useState } from 'react'
import { MessageSquare, Video, X } from 'lucide-react'
import { MessagesDock } from './MessagesDock'
import { CallsDock } from './CallsDock'

type Panel = 'messages' | 'calls' | null

export function RightDock() {
  const [open, setOpen] = useState<Panel>(null)

  const railBtn = (panel: Exclude<Panel, null>, Icon: typeof MessageSquare, label: string) => (
    <button
      onClick={() => setOpen((o) => (o === panel ? null : panel))}
      title={label}
      className={`grid h-10 w-10 place-items-center rounded-xl transition ${
        open === panel
          ? 'bg-brand text-white'
          : 'text-muted hover:bg-surface-2 hover:text-brand'
      }`}
    >
      <Icon size={19} />
    </button>
  )

  return (
    <div className="pointer-events-none fixed bottom-8 right-0 top-14 z-40 flex items-stretch">
      {open && (
        <div className="pointer-events-auto mr-1 flex w-[22rem] max-w-[90vw] flex-col overflow-hidden rounded-l-2xl border border-border bg-surface shadow-2xl animate-rise">
          <div className="flex items-center justify-end border-b border-border bg-surface px-2 py-1">
            <button
              onClick={() => setOpen(null)}
              className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink"
              title="Collapse"
            >
              <X size={16} />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            {open === 'messages' ? <MessagesDock /> : <CallsDock />}
          </div>
        </div>
      )}

      <div className="pointer-events-auto flex w-12 flex-col items-center gap-2 border-l border-border bg-surface py-3">
        {railBtn('messages', MessageSquare, 'Messages')}
        {railBtn('calls', Video, 'Calls')}
      </div>
    </div>
  )
}
