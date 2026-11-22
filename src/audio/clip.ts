// Push-to-talk tier 2: short recorded voice messages. While the button is held, MediaRecorder
// records the mic; on release the clip is sent through the database and the other devices play
// it. It is walkie-talkie style but delayed (you hear it after the talker lets go), not live.
//
// Formats differ: Chrome records WebM/Opus, Safari records MP4/AAC. Each receiver decodes
// whatever arrives with decodeAudioData; a format it can't decode is skipped with a warning.
import { audioContext } from './context'

export const MAX_CLIP_MS = 8_000 // one message is at most 8 s; the talker is released then
const MIN_CLIP_MS = 300 // shorter presses are taps, not messages
const TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']

export interface Recorder {
  /** Stop and resolve to the clip, or null if it was too short or recording failed. */
  stop: () => Promise<{ blob: Blob; mime: string } | null>
}

/** Start recording a stream, or null if this browser can't record audio. */
export function startRecording(stream: MediaStream): Recorder | null {
  if (typeof MediaRecorder === 'undefined') return null
  const mime = TYPES.find((t) => MediaRecorder.isTypeSupported(t))
  let recorder: MediaRecorder
  try {
    // 32 kbit/s is plenty for speech and keeps an 8 s clip around 32 KB.
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32_000 } : undefined)
  } catch {
    return null
  }
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  const started = performance.now()
  recorder.start()

  return {
    stop: () =>
      new Promise((resolve) => {
        if (recorder.state === 'inactive') return resolve(null)
        recorder.onstop = () => {
          const type = recorder.mimeType || mime || 'audio/webm'
          const tooShort = performance.now() - started < MIN_CLIP_MS
          resolve(tooShort || !chunks.length ? null : { blob: new Blob(chunks, { type }), mime: type })
        }
        recorder.stop()
      }),
  }
}

/**
 * Play a received clip through the shared AudioContext (already unlocked by the user's first
 * tap). `onAnalyser` gets an AnalyserNode while it plays, so receivers see a real waveform.
 */
export async function playClip(b64: string, onAnalyser: (analyser: AnalyserNode | null) => void): Promise<void> {
  const ctx = audioContext()
  if (!ctx || ctx.state !== 'running') return // no tap on this page yet: the browser won't play sound
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const buffer = await ctx.decodeAudioData(bytes.buffer)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 256
  source.connect(analyser).connect(ctx.destination)
  onAnalyser(analyser)
  await new Promise((done) => {
    source.onended = done
    source.start()
  })
  onAnalyser(null)
}

/** Blob → base64 text, so the clip can be stored as a plain database value. */
export function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
