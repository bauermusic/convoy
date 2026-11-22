// Keep the screen on while the HUD is open (a phone on the dashboard shouldn't go dark).
// The browser drops the lock whenever the page is hidden, so ask again when it is visible.
// Not every browser supports it; then this does nothing.
import { useEffect } from 'react'

export function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    const request = () => {
      if (document.visibilityState === 'visible') navigator.wakeLock.request('screen').catch(() => {})
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => document.removeEventListener('visibilitychange', request)
  }, [])
}
