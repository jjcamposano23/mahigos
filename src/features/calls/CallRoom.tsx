import { useEffect, useMemo, useRef } from 'react'
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  MonitorUp,
  PhoneOff,
  Loader2,
  Users,
  AlertCircle,
} from 'lucide-react'
import { useCall } from './useCall'
import { Avatar } from '../../components/Avatar'
import type { CallParticipant, UserProfile } from '../../lib/types'

function VideoTile({
  stream,
  muted,
  name,
  self,
  camOff,
  sharing,
  profile,
}: {
  stream: MediaStream | null
  muted: boolean
  name: string
  self?: boolean
  camOff?: boolean
  sharing?: boolean
  profile?: { displayName?: string; photoURL?: string; avatar?: string } | null
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream
  }, [stream])

  const showAvatar = camOff && !sharing

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#111] shadow-sm ring-1 ring-black/40">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full ${sharing ? 'object-contain' : 'object-cover'} ${
          self && !sharing ? '-scale-x-100' : ''
        } ${showAvatar ? 'opacity-0' : ''}`}
      />
      {showAvatar && (
        <div className="absolute inset-0 grid place-items-center">
          <Avatar profile={profile ?? { displayName: name }} size={72} rounded="rounded-full" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
        <span className="truncate text-xs font-semibold text-white">
          {name}
          {self && ' (You)'}
        </span>
        {sharing && (
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[0.6rem] font-semibold text-white">
            Sharing
          </span>
        )}
      </div>
    </div>
  )
}

function ControlButton({
  on,
  onClick,
  onIcon,
  offIcon,
  label,
  disabled,
  danger,
}: {
  on: boolean
  onClick: () => void
  onIcon: React.ReactNode
  offIcon: React.ReactNode
  label: string
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={[
        'grid h-12 w-12 place-items-center rounded-full transition disabled:opacity-40',
        danger
          ? 'bg-brand text-white hover:bg-brand-ink'
          : on
            ? 'bg-white/15 text-white hover:bg-white/25'
            : 'bg-brand text-white hover:bg-brand-ink',
      ].join(' ')}
    >
      {on ? onIcon : offIcon}
    </button>
  )
}

export function CallRoom({
  callId,
  title,
  kind,
  channelId,
  profile,
  onLeave,
}: {
  callId: string
  title: string
  kind: 'room' | 'channel' | 'dm'
  channelId?: string | null
  profile: UserProfile | null
  onLeave: () => void
}) {
  const call = useCall(callId, { title, kind, channelId }, profile, onLeave)

  const others = useMemo(
    () => call.participants.filter((p) => p.uid !== profile?.uid),
    [call.participants, profile],
  )

  const meta = (p: CallParticipant) => ({
    displayName: p.name,
    photoURL: p.photoURL ?? undefined,
    avatar: p.avatar ?? undefined,
  })

  // Grid density grows with participant count.
  const tileCount = others.length + 1
  const cols =
    tileCount <= 1 ? 'grid-cols-1' : tileCount <= 4 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'

  if (call.error) {
    return (
      <div className="grid h-full place-items-center bg-[#0d0d0d] p-6 text-center">
        <div className="max-w-sm">
          <AlertCircle className="mx-auto text-brand" size={32} />
          <p className="mt-3 text-sm text-white/80">{call.error}</p>
          <button
            onClick={onLeave}
            className="mt-4 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25"
          >
            Back to Calls
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[#0d0d0d]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 text-white">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{title}</div>
          <div className="flex items-center gap-1.5 text-[0.7rem] text-white/60">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live · Mahigos call
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80">
          <Users size={14} />
          {tileCount}
        </div>
      </div>

      {/* Video grid */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        {call.connecting ? (
          <div className="grid h-full place-items-center text-white/60">
            <div className="text-center">
              <Loader2 className="mx-auto animate-spin" size={26} />
              <p className="mt-2 text-sm">Joining the call…</p>
            </div>
          </div>
        ) : (
          <div className={`grid gap-3 ${cols}`}>
            <VideoTile
              stream={call.localStream}
              muted
              self
              name={profile?.displayName ?? 'You'}
              camOff={!call.camOn && !call.sharing}
              sharing={call.sharing}
              profile={profile}
            />
            {others.map((p) => (
              <VideoTile
                key={p.uid}
                stream={call.remoteStreams[p.uid] ?? null}
                muted={false}
                name={p.name}
                camOff={!p.camOn && !p.sharing}
                sharing={p.sharing}
                profile={meta(p)}
              />
            ))}
            {others.length === 0 && (
              <div className="grid aspect-video place-items-center rounded-2xl border border-dashed border-white/15 text-center text-white/50">
                <div>
                  <Users className="mx-auto" size={22} />
                  <p className="mt-1.5 text-xs">Waiting for others to join…</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 border-t border-white/10 py-4">
        <ControlButton
          on={call.micOn}
          onClick={call.toggleMic}
          onIcon={<Mic size={20} />}
          offIcon={<MicOff size={20} />}
          label={call.micOn ? 'Mute' : 'Unmute'}
        />
        <ControlButton
          on={call.camOn}
          onClick={call.toggleCam}
          onIcon={<VideoIcon size={20} />}
          offIcon={<VideoOff size={20} />}
          label={call.camOn ? 'Turn camera off' : 'Turn camera on'}
          disabled={!call.hasCamera}
        />
        <ControlButton
          on={!call.sharing}
          onClick={() => void call.toggleShare()}
          onIcon={<MonitorUp size={20} />}
          offIcon={<MonitorUp size={20} className="text-emerald-300" />}
          label={call.sharing ? 'Stop sharing' : 'Share screen'}
        />
        <button
          onClick={onLeave}
          title="Leave call"
          className="grid h-12 w-14 place-items-center rounded-full bg-brand text-white transition hover:bg-brand-ink"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  )
}
