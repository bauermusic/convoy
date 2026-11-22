// Microphone level for the talker's waveform: getUserMedia → AnalyserNode.
// The mic is opened when the PTT button goes down and closed when it comes up, so the browser's
// "recording" indicator is only on while you talk. The level drives the waveform; clip.ts
// records the same stream into a short voice message.
//
// Call openMic() directly inside the tap (before any await): iOS browsers refuse a mic request
// that arrives after the user gesture has ended, often without showing a prompt.
import { audioContext } from './context'

export interface Mic {
  stream: MediaStream
  analyser: AnalyserNode
  close: () => void
}

/** The open mic, or a short reason why there is none (shown on the PTT button). */
export type MicResult = { mic: Mic; problem: null } | { mic: null; problem: string }

const REASONS: Record<string, string> = {
  NotAllowedError: 'permission denied',
  NotFoundError: 'no microphone found',
  NotReadableError: 'microphone busy',
  SecurityError: 'needs HTTPS',
}

export async function openMic(): Promise<MicResult> {
  const ctx = audioContext()
  if (!ctx || !navigator.mediaDevices?.getUserMedia) return { mic: null, problem: 'not supported here' }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    await ctx.resume()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    const source = ctx.createMediaStreamSource(stream)
    source.connect(analyser) // not connected to the speakers: no echo
    const close = () => {
      source.disconnect()
      stream.getTracks().forEach((track) => track.stop())
    }
    return { mic: { stream, analyser, close }, problem: null }
  } catch (err) {
    console.warn('[convoy] microphone unavailable', err)
    const name = err instanceof Error ? err.name : String(err)
    return { mic: null, problem: REASONS[name] ?? name }
  }
}
