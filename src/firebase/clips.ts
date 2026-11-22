// Voice messages in the database: clips/{id} = { role, uid, mime, b64, t }.
// Clips are small (about 32 KB of audio, ~43 KB as base64), played once, and deleted after 30 s
// by whichever tab sees them first, so the database doesn't fill up.
import { limitToLast, onChildAdded, push, query, remove, serverTimestamp } from 'firebase/database'
import { toBase64 } from '../audio/clip'
import type { Role } from '../domain/types'
import { serverNow } from './client'
import { sessionRef } from './session'

export interface Clip {
  role: Role
  uid: string
  mime: string
  b64: string
  /** Server time when sent, ms. */
  t: number
}

const PLAY_IF_NEWER_THAN = 10_000 // ms; a tab opened later doesn't replay old messages
const DELETE_AFTER = 30_000 // ms; the rules allow anyone to delete clips this old

export async function sendClip(sid: string, uid: string, role: Role, blob: Blob, mime: string) {
  const b64 = await toBase64(blob)
  await push(sessionRef(sid, 'clips'), { role, uid, mime, b64, t: serverTimestamp() })
}

/** Calls back once per fresh clip from someone else. Old clips are deleted instead. */
export function subscribeClips(sid: string, uid: string, cb: (clip: Clip) => void) {
  return onChildAdded(query(sessionRef(sid, 'clips'), limitToLast(5)), (snap) => {
    const clip = snap.val() as Clip
    const age = serverNow() - clip.t
    if (age > DELETE_AFTER) remove(snap.ref).catch(() => {})
    else if (age < PLAY_IF_NEWER_THAN && clip.uid !== uid) cb(clip)
  })
}
