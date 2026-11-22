// Session membership: which tab drives which car, and which tab is the host.
//
// Claims are transactions, so two tabs can never take the same slot: the transaction only
// writes if the slot is empty (or already ours), and Firebase retries it if another tab got
// there first. Each claim registers onDisconnect().remove(): the server deletes the slot
// itself when this tab closes or loses its connection, so a crashed tab can't hold a car.
//
// Silent holders: a phone that locks, or a tab the browser freezes, stops running but can keep
// its connection open for minutes, so onDisconnect doesn't fire. Such a "ghost" would hold its
// seat forever. So a seat whose car has sent nothing for 15 s, or a host that hasn't refreshed
// its timestamp for 10 s, may be taken over. database.rules.json enforces the same limits.
import {
  get,
  onDisconnect,
  onValue,
  ref,
  runTransaction,
  serverTimestamp,
  update,
  type DatabaseReference,
} from 'firebase/database'
import { ROLES, type Role } from '../domain/types'
import { db, serverNow } from './client'

export const sessionRef = (sid: string, path: string) => ref(db, path ? `sessions/${sid}/${path}` : `sessions/${sid}`)

export const SEAT_SILENT_MS = 15_000 // a seat holder normally sends its car every 0.5 s or faster
export const HOST_SILENT_MS = 10_000 // the host refreshes its timestamp every 3 s
export const HOST_BEAT_MS = 3_000

interface Seat {
  uid: string
  claimedAt: number
}

export interface Host {
  uid: string
  /** Server time of the host's last heartbeat, ms. */
  t?: number
}

/**
 * Take a slot holding { uid, ... } if it is free, already ours, or `canTakeOver` says its
 * holder went silent. Resolves to success.
 */
async function claim<T extends { uid: string }>(
  slot: DatabaseReference,
  uid: string,
  extra: object,
  canTakeOver: (current: T) => boolean = () => false,
): Promise<boolean> {
  try {
    const result = await runTransaction(slot, (current: T | null) => {
      if (current === null || current.uid === uid || canTakeOver(current)) return { uid, ...extra }
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

/** A seat is silent when neither its claim nor its car has been updated for SEAT_SILENT_MS. */
async function seatSilence(sid: string, role: Role): Promise<(seat: Seat) => boolean> {
  const carT = (await get(sessionRef(sid, `cars/${role}/t`))).val() as number | null
  return (seat) => serverNow() - Math.max(seat.claimedAt ?? 0, carT ?? 0) > SEAT_SILENT_MS
}

/**
 * Claim the wanted role, or the first free (or silent) one. null = convoy full: this tab
 * watches and tries again a few seconds later (see useSession).
 */
export async function claimRole(sid: string, uid: string, wanted: Role): Promise<Role | null> {
  for (const role of [wanted, ...ROLES.filter((r) => r !== wanted)]) {
    const silent = await seatSilence(sid, role)
    if (await claim<Seat>(sessionRef(sid, `roles/${role}`), uid, { claimedAt: serverTimestamp() }, silent)) return role
  }
  return null
}

/** Free other tabs' silent seats, so the host can drive those cars as NPCs again. */
export async function releaseSilentSeats(sid: string, uid: string) {
  for (const role of ROLES) {
    const silent = await seatSilence(sid, role)
    await runTransaction(sessionRef(sid, `roles/${role}`), (seat: Seat | null) =>
      seat && seat.uid !== uid && silent(seat) ? null : undefined,
    ).catch(() => {}) // refused = not silent after all (the rules have the final say)
  }
}

export const claimHost = (sid: string, uid: string) =>
  claim<Host>(sessionRef(sid, 'host'), uid, { t: serverTimestamp() }, (host) => isHostSilent(host))

export const isHostSilent = (host: Host) => !host.t || serverNow() - host.t > HOST_SILENT_MS

/** The host's heartbeat: proves to the other tabs that it is still running. */
export const beatHost = (sid: string) => update(sessionRef(sid, 'host'), { t: serverTimestamp() })

/** Which roles are held by a human tab: role → uid. */
export function watchRoles(sid: string, cb: (humans: Partial<Record<Role, string>>) => void) {
  return onValue(sessionRef(sid, 'roles'), (snap) => {
    const val = (snap.val() ?? {}) as Partial<Record<Role, Seat>>
    const humans: Partial<Record<Role, string>> = {}
    for (const role of ROLES) if (val[role]) humans[role] = val[role]!.uid
    cb(humans)
  })
}

export function watchHost(sid: string, cb: (host: Host | null) => void) {
  return onValue(sessionRef(sid, 'host'), (snap) => cb(snap.val()))
}

/** `.info/connected` is a local flag Firebase keeps: true while the socket to the server is up. */
export function watchConnected(cb: (connected: boolean) => void) {
  return onValue(ref(db, '.info/connected'), (snap) => cb(snap.val() === true))
}
