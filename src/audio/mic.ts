// Microphone level for the talker's waveform: getUserMedia → AnalyserNode.
// The mic is opened when the PTT button goes down and closed when it comes up, so the browser's
// "recording" indicator is only on while you talk. The audio is analysed, never played back or sent.
import { audioContext } from './context'

export interface Mic {
  analyser: AnalyserNode
  close: () => void
}

/** Open the microphone, or null if unsupported, refused, or not on HTTPS/localhost. */
export async function openMic(): Promise<Mic | null> {
  const ctx = audioContext()
  if (!ctx || !navigator.mediaDevices?.getUserMedia) return null
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    await ctx.resume()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    const source = ctx.createMediaStreamSource(stream)
    source.connect(analyser) // not connected to the speakers: no echo
    return {
      analyser,
      close: () => {
        source.disconnect()
        stream.getTracks().forEach((track) => track.stop())
      },
    }
  } catch (err) {
    console.warn('[convoy] microphone unavailable', err)
    return null
  }
}
