// Pull-over alerts currently on screen. Each shows for 8 s; a "resume" from the same car
// removes it early.
import { useEffect, useState } from 'react'
import { subscribeAlerts, type Alert } from '../firebase/alerts'

const SHOW_FOR = 8000 // ms

export function useAlerts(sid: string, signedIn: boolean): Alert[] {
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    if (!signedIn) return
    const timers: number[] = []
    const unsubscribe = subscribeAlerts(sid, (alert) => {
      setAlerts((list) => {
        const others = list.filter((a) => a.role !== alert.role)
        return alert.type === 'pullover' ? [...others, alert] : others
      })
      if (alert.type === 'pullover') {
        timers.push(window.setTimeout(() => setAlerts((list) => list.filter((a) => a.id !== alert.id)), SHOW_FOR))
      }
    })
    return () => {
      unsubscribe()
      timers.forEach(clearTimeout)
    }
  }, [sid, signedIn])

  return alerts
}
