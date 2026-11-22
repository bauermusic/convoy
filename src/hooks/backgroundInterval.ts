// setInterval that keeps running in background tabs.
//
// Chrome throttles timers in hidden tabs: to once a second at first, and to once a MINUTE
// after about 5 minutes ("intensive throttling"). A tab in the background still drives its
// car (and the host drives the NPCs), so the rest of the convoy would see it as lost.
// Timers inside a Web Worker are not throttled that hard, so a tiny worker ticks and the
// page does the work when the message arrives.
export function backgroundInterval(fn: () => void, ms: number): () => void {
  const source = `setInterval(() => postMessage(0), ${ms})`
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
  const worker = new Worker(url)
  worker.onmessage = fn
  return () => {
    worker.terminate()
    URL.revokeObjectURL(url)
  }
}
