// Session-wide demo settings, shared by all tabs:
//   tailLag: the lag slider (0.2–1). Whichever tab drives the tail car applies it.
//   resetAt: server time of the last "reset session". Every tab restarts its cars when it changes.
import { onValue, serverTimestamp, update } from 'firebase/database'
import { sessionRef } from './session'

export interface Meta {
  tailLag: number
  resetAt: number | null
}

export function subscribeMeta(sid: string, cb: (meta: Meta) => void) {
  return onValue(sessionRef(sid, 'meta'), (snap) => {
    const val = snap.val() ?? {}
    cb({ tailLag: val.tailLag ?? 1, resetAt: val.resetAt ?? null })
  })
}

export function setTailLag(sid: string, tailLag: number) {
  return update(sessionRef(sid, 'meta'), { tailLag })
}

/** Restart the convoy: cars back to their starting spacing, lag back to 1, alerts and clips cleared. */
export function resetSession(sid: string) {
  return update(sessionRef(sid, ''), {
    'meta/tailLag': 1,
    'meta/resetAt': serverTimestamp(),
    alerts: null,
    clips: null,
  })
}
