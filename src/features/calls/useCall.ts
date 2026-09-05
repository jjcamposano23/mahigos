import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  getDocs,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { ICE_SERVERS, makePlaceholderVideoTrack, shouldInitiate } from '../../lib/webrtc'
import type { CallParticipant, UserProfile } from '../../lib/types'

const STALE_MS = 30_000
const HEARTBEAT_MS = 8_000

export interface CallState {
  joined: boolean
  connecting: boolean
  error: string | null
  micOn: boolean
  camOn: boolean
  hasCamera: boolean
  sharing: boolean
  localStream: MediaStream | null
  remoteStreams: Record<string, MediaStream>
  participants: CallParticipant[]
  toggleMic: () => void
  toggleCam: () => void
  toggleShare: () => Promise<void>
  leave: () => Promise<void>
}

/**
 * Manages one participant's presence in a call: local media, a mesh of
 * RTCPeerConnections to every other participant, and Firestore signaling.
 */
export function useCall(
  callId: string,
  meta: { title: string; kind: 'room' | 'channel' | 'dm'; channelId?: string | null },
  profile: UserProfile | null,
  onLeft: () => void,
): CallState {
  const [joined, setJoined] = useState(false)
  const [connecting, setConnecting] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [micOn, setMicOn] = useState(false)
  const [camOn, setCamOn] = useState(false)
  const [hasCamera, setHasCamera] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const [participants, setParticipants] = useState<CallParticipant[]>([])

  const uid = profile?.uid ?? ''

  // Mutable connection state kept in refs so snapshots don't trigger re-renders.
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const localRef = useRef<MediaStream | null>(null)
  const micTrackRef = useRef<MediaStreamTrack | null>(null)
  const camTrackRef = useRef<MediaStreamTrack | null>(null)
  const screenTrackRef = useRef<MediaStreamTrack | null>(null)
  const activeUidsRef = useRef<Set<string>>(new Set())
  const leftRef = useRef(false)

  const partRef = useCallback(
    () => doc(db, 'calls', callId, 'participants', uid),
    [callId, uid],
  )

  const sendSignal = useCallback(
    async (to: string, kind: 'offer' | 'answer' | 'candidate', payload: unknown) => {
      await addDoc(collection(db, 'calls', callId, 'signals'), {
        from: uid,
        to,
        kind,
        payload: JSON.stringify(payload),
        createdAt: serverTimestamp(),
      })
    },
    [callId, uid],
  )

  const setRemote = useCallback((peerUid: string, stream: MediaStream) => {
    setRemoteStreams((prev) => ({ ...prev, [peerUid]: stream }))
  }, [])

  const dropRemote = useCallback((peerUid: string) => {
    setRemoteStreams((prev) => {
      const next = { ...prev }
      delete next[peerUid]
      return next
    })
  }, [])

  const closePeer = useCallback(
    (peerUid: string) => {
      const pc = pcsRef.current.get(peerUid)
      if (pc) {
        pc.onicecandidate = null
        pc.ontrack = null
        pc.onconnectionstatechange = null
        pc.close()
      }
      pcsRef.current.delete(peerUid)
      pendingIceRef.current.delete(peerUid)
      dropRemote(peerUid)
    },
    [dropRemote],
  )

  const createPeer = useCallback(
    async (peerUid: string, initiator: boolean) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      pcsRef.current.set(peerUid, pc) // set synchronously to avoid double-create
      localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current!))

      pc.onicecandidate = (e) => {
        if (e.candidate) void sendSignal(peerUid, 'candidate', e.candidate.toJSON())
      }
      pc.ontrack = (e) => {
        if (e.streams[0]) setRemote(peerUid, e.streams[0])
      }
      pc.onconnectionstatechange = () => {
        if (['failed', 'closed'].includes(pc.connectionState)) dropRemote(peerUid)
      }

      if (initiator) {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await sendSignal(peerUid, 'offer', offer)
      }
      return pc
    },
    [sendSignal, setRemote, dropRemote],
  )

  const flushIce = useCallback(async (peerUid: string) => {
    const pc = pcsRef.current.get(peerUid)
    const pending = pendingIceRef.current.get(peerUid)
    if (!pc || !pending) return
    for (const c of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c))
      } catch {
        /* ignore */
      }
    }
    pendingIceRef.current.set(peerUid, [])
  }, [])

  const handleSignal = useCallback(
    async (sig: { from: string; kind: string; payload: string }) => {
      const data = JSON.parse(sig.payload)
      let pc = pcsRef.current.get(sig.from)
      if (sig.kind === 'offer') {
        if (!pc) pc = await createPeer(sig.from, false)
        await pc.setRemoteDescription(new RTCSessionDescription(data))
        await flushIce(sig.from)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await sendSignal(sig.from, 'answer', answer)
      } else if (sig.kind === 'answer') {
        if (pc && !pc.currentRemoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(data))
          await flushIce(sig.from)
        }
      } else if (sig.kind === 'candidate') {
        if (pc?.remoteDescription?.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data))
          } catch {
            /* ignore */
          }
        } else {
          const arr = pendingIceRef.current.get(sig.from) ?? []
          arr.push(data)
          pendingIceRef.current.set(sig.from, arr)
        }
      }
    },
    [createPeer, flushIce, sendSignal],
  )

  // ─── Join / setup (runs once per callId) ───────────────────────────────────
  useEffect(() => {
    if (!uid) return
    leftRef.current = false
    let heartbeat: ReturnType<typeof setInterval> | undefined
    const unsubs: Array<() => void> = []

    const start = async () => {
      // Acquire local media (camera optional).
      let mic: MediaStreamTrack | null = null
      let cam: MediaStreamTrack | null = null
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: 1280, height: 720 },
        })
        mic = s.getAudioTracks()[0] ?? null
        cam = s.getVideoTracks()[0] ?? null
      } catch {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true })
          mic = s.getAudioTracks()[0] ?? null
        } catch {
          setError('Mahigos needs microphone access to join a call. Check your browser permissions.')
          setConnecting(false)
          return
        }
      }
      if (leftRef.current) {
        mic?.stop()
        cam?.stop()
        return
      }

      const videoTrack = cam ?? makePlaceholderVideoTrack()
      const local = new MediaStream()
      if (mic) local.addTrack(mic)
      local.addTrack(videoTrack)
      localRef.current = local
      micTrackRef.current = mic
      camTrackRef.current = cam
      setLocalStream(local)
      setMicOn(!!mic)
      setCamOn(!!cam)
      setHasCamera(!!cam)
      setJoined(true)
      setConnecting(false)

      // Ensure the call doc exists / is marked active.
      await setDoc(
        doc(db, 'calls', callId),
        {
          title: meta.title,
          kind: meta.kind,
          channelId: meta.channelId ?? null,
          status: 'active',
          lastActive: serverTimestamp(),
          createdBy: uid,
          createdByName: profile?.displayName ?? 'Member',
          startedAt: serverTimestamp(),
        },
        { merge: true },
      )

      // Register our participant record.
      await setDoc(partRef(), {
        uid,
        name: profile?.displayName ?? 'Member',
        avatar: profile?.avatar ?? null,
        photoURL: profile?.photoURL ?? null,
        micOn: !!mic,
        camOn: !!cam,
        sharing: false,
        joinedAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
      })

      // React to the participant roster: connect to newcomers, drop leavers.
      unsubs.push(
        onSnapshot(collection(db, 'calls', callId, 'participants'), (snap) => {
          const now = Date.now()
          const all = snap.docs.map((d) => d.data() as CallParticipant)
          const fresh = all.filter((p) => {
            const t = p.lastSeen?.toMillis?.() ?? now
            return now - t < STALE_MS
          })
          setParticipants(fresh)
          const activeOthers = fresh.map((p) => p.uid).filter((u) => u !== uid)
          activeUidsRef.current = new Set(activeOthers)
          for (const peer of activeOthers) {
            if (!pcsRef.current.has(peer)) void createPeer(peer, shouldInitiate(uid, peer))
          }
          for (const peer of Array.from(pcsRef.current.keys())) {
            if (!activeUidsRef.current.has(peer)) closePeer(peer)
          }
        }),
      )

      // Inbound signaling addressed to us.
      unsubs.push(
        onSnapshot(query(collection(db, 'calls', callId, 'signals'), where('to', '==', uid)), (snap) => {
          snap.docChanges().forEach((ch) => {
            if (ch.type !== 'added') return
            const sig = ch.doc.data() as { from: string; kind: string; payload: string }
            void handleSignal(sig).finally(() => void deleteDoc(ch.doc.ref))
          })
        }),
      )

      // Heartbeat so others know we're still here.
      heartbeat = setInterval(() => {
        void updateDoc(partRef(), { lastSeen: serverTimestamp() }).catch(() => {})
        void updateDoc(doc(db, 'calls', callId), { lastActive: serverTimestamp() }).catch(() => {})
      }, HEARTBEAT_MS)
    }

    void start()

    return () => {
      leftRef.current = true
      if (heartbeat) clearInterval(heartbeat)
      unsubs.forEach((u) => u())
      pcsRef.current.forEach((pc) => pc.close())
      pcsRef.current.clear()
      pendingIceRef.current.clear()
      localRef.current?.getTracks().forEach((t) => t.stop())
      screenTrackRef.current?.stop()
      // Best-effort presence cleanup; last one out ends the call.
      void (async () => {
        try {
          await deleteDoc(partRef())
          const rest = await getDocs(collection(db, 'calls', callId, 'participants'))
          if (rest.empty) await updateDoc(doc(db, 'calls', callId), { status: 'ended' })
        } catch {
          /* ignore */
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, uid])

  // ─── Controls ──────────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    const t = micTrackRef.current
    if (!t) return
    t.enabled = !t.enabled
    setMicOn(t.enabled)
    void updateDoc(partRef(), { micOn: t.enabled }).catch(() => {})
  }, [partRef])

  const toggleCam = useCallback(() => {
    const t = camTrackRef.current
    if (!t) return
    t.enabled = !t.enabled
    setCamOn(t.enabled)
    void updateDoc(partRef(), { camOn: t.enabled }).catch(() => {})
  }, [partRef])

  const swapVideoTrack = useCallback((track: MediaStreamTrack) => {
    // Replace the outgoing video track on every peer (no renegotiation needed).
    pcsRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      void sender?.replaceTrack(track)
    })
    // Refresh the local self-view.
    const local = localRef.current
    if (local) {
      local.getVideoTracks().forEach((t) => local.removeTrack(t))
      local.addTrack(track)
      setLocalStream(new MediaStream(local.getTracks()))
    }
  }, [])

  const toggleShare = useCallback(async () => {
    if (sharing) {
      screenTrackRef.current?.stop()
      screenTrackRef.current = null
      const fallback = camTrackRef.current ?? makePlaceholderVideoTrack()
      swapVideoTrack(fallback)
      setSharing(false)
      void updateDoc(partRef(), { sharing: false }).catch(() => {})
      return
    }
    try {
      const ds = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const screen = ds.getVideoTracks()[0]
      screenTrackRef.current = screen
      screen.onended = () => {
        const fallback = camTrackRef.current ?? makePlaceholderVideoTrack()
        swapVideoTrack(fallback)
        setSharing(false)
        screenTrackRef.current = null
        void updateDoc(partRef(), { sharing: false }).catch(() => {})
      }
      swapVideoTrack(screen)
      setSharing(true)
      void updateDoc(partRef(), { sharing: true }).catch(() => {})
    } catch {
      /* user cancelled the picker */
    }
  }, [sharing, swapVideoTrack, partRef])

  const leave = useCallback(async () => {
    onLeft()
  }, [onLeft])

  return {
    joined,
    connecting,
    error,
    micOn,
    camOn,
    hasCamera,
    sharing,
    localStream,
    remoteStreams,
    participants,
    toggleMic,
    toggleCam,
    toggleShare,
    leave,
  }
}
