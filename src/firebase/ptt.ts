// The push-to-talk floor in the database: `ptt` holds { role, uid, startedAt } while someone
// talks, and is empty when the channel is free.
//
// Taking the floor is a transaction running claimFloor(), so two tabs pressing at the same
// moment can't both win. onDisconnect().remove() frees the channel if the talker's tab dies.
import { onDisconnect, onValue, remove, runTransaction } from 'firebase/database'
import { claimFloor, type Floor } from '../domain/pttFloor'
import type { Role } from '../domain/types'
import { serverNow } from './client'
import { sessionRef } from './session'

const floorRef = (sid: string) => sessionRef(sid, 'ptt')

/** Try to take the floor. Resolves to true if this tab now holds it. */
export async function takeFloor(sid: string, uid: string, role: Role): Promise<boolean> {
  try {
    const result = await runTransaction(floorRef(sid), (current: Floor | null) => {
      return claimFloor(current, { role, uid }, serverNow()) ?? undefined // undefined = abort
    })
    if (result.committed) await onDisconnect(floorRef(sid)).remove()
    return result.committed
  } catch (err) {
    // As with role claims: a first attempt on a stale cache can be refused by the rules.
    console.warn('[convoy] floor claim refused', err)
    return false
  }
}

/** Give the floor back. The rules only allow this for the holder (or an expired floor). */
export async function releaseFloor(sid: string) {
  try {
    await onDisconnect(floorRef(sid)).cancel()
    await remove(floorRef(sid))
  } catch (err) {
    console.warn('[convoy] floor release refused', err)
  }
}

export function watchFloor(sid: string, cb: (floor: Floor | null) => void) {
  return onValue(floorRef(sid), (snap) => cb(snap.val()))
}
