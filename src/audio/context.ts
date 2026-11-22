// One shared Web Audio context for the tones and the microphone analyser.
//
// Browsers start audio "suspended" until the user interacts with the page (autoplay policy).
// We resume it on the first tap or key press anywhere, so a receiver who has touched the page
// once will hear the channel tones.

let ctx: AudioContext | null = null

/** The shared AudioContext, or null if the browser has no Web Audio. */
export function audioContext(): AudioContext | null {
  if (!ctx && typeof AudioContext !== 'undefined') ctx = new AudioContext()
  return ctx
}

export function unlockAudioOnFirstGesture() {
  const unlock = () => void audioContext()?.resume()
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
}
