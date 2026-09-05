/** Shared WebRTC configuration + small helpers for the native call system. */

// Public STUN servers cover most home/office networks. A TURN relay (needed
// for strict corporate/mobile NATs) is a paid add-on we can wire in later.
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
]

/**
 * A silent, single-frame video track used when a participant has no camera (or
 * denied it). Keeping a video sender present means screen-sharing can swap in
 * via replaceTrack without renegotiating the connection.
 */
export function makePlaceholderVideoTrack(): MediaStreamTrack {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 360
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#1c1a19'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  const stream = canvas.captureStream(1)
  return stream.getVideoTracks()[0]
}

/**
 * Deterministic offerer selection so a pair of peers never both send the
 * initial offer (glare): the lexicographically greater uid initiates.
 */
export function shouldInitiate(myUid: string, peerUid: string): boolean {
  return myUid > peerUid
}
