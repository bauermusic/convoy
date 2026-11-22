// Session membership: which tab drives which car, and which tab is the host.
//
// Claims are transactions, so two tabs can never take the same slot: the transaction only
// writes if the slot is empty (or already ours), and Firebase retries it if another tab got
// there first. Each claim registers onDisconnect().remove(): the server deletes the slot
// itself when this tab closes or loses its connection, so a crashed tab can't hold a car.
import {
  onDisconnect,
  onValue,
  ref,
  runTransaction,
  serverTimestamp,
  type DatabaseReference,
} from 'firebase/database'
import { ROLES, type Role } from '../domain/types'
import { db } from './client'

export const sessionRef = (sid: string, path: string) => ref(db, `sessions/${sid}/${path}`)

/** Take a slot holding { uid, ... } if it is free or already ours. Resolves to success. */
async function claim(slot: DatabaseReference, uid: string, extra: object = {}): Promise<boolean> {
  try {
    const result = await runTransaction(slot, (current: { uid: string } | null) => {
      if (current === null || current.uid === uid) return { uid, ...extra }
      return undefined // held by another tab: abort
    })
    if (result.committed) await onDisconnect(slot).remove()
    return result.committed
  } catch (err) {
    // The first run of a transaction uses the local cache, which may not have loaded yet and
    // look empty. Writing over another tab's slot is then refused by the rules
    // (permission_denied) instead of being retried. Either way the slot is taken.
    console.warn('[convoy] claim refused', slot.toString(), err)
    return false
  }
}

/** Claim the wanted role, or the first free one. null = convoy full (this tab only watches). */
export async function claimRole(sid: string, uid: string, wanted: Role): Promise<Role | null> {
  for (const role of [wanted, ...ROLES.filter((r) => r !== wanted)]) {
    if (await claim(sessionRef(sid, `roles/${role}`), uid, { claimedAt: serverTimestamp() })) return role
  }
  return null
}

export const claimHost = (sid: string, uid: string) => claim(sessionRef(sid, 'host'), uid)

/** Which roles are held by a human tab: role → uid. */
export function watchRoles(sid: string, cb: (humans: Partial<Record<Role, string>>) => void) {
  return onValue(sessionRef(sid, 'roles'), (snap) => {
    const val = (snap.val() ?? {}) as Partial<Record<Role, { uid: string }>>
    const humans: Partial<Record<Role, string>> = {}
    for (const role of ROLES) if (val[role]) humans[role] = val[role]!.uid
    cb(humans)
  })
}

export function watchHost(sid: string, cb: (hostUid: string | null) => void) {
  return onValue(sessionRef(sid, 'host'), (snap) => cb(snap.val()?.uid ?? null))
}

/** `.info/connected` is a local flag Firebase keeps: true while the socket to the server is up. */
export function watchConnected(cb: (connected: boolean) => void) {
  return onValue(ref(db, '.info/connected'), (snap) => cb(snap.val() === true))
}
