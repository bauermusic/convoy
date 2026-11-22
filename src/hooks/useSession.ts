// Joins a session: signs in, claims a role, keeps track of who holds which role and who is
// host. Every time the connection comes (back) up we claim again, because the server ran
// our onDisconnect handlers when the connection dropped and the role may be free now.
//
// Every 3 s (on the background-safe timer):
//   - the host refreshes its heartbeat and frees seats whose holder went silent (see session.ts),
//     so their cars become NPCs again instead of "lost contact" forever;
//   - other tabs take over a silent host;
//   - a tab without a seat ("watching only") tries again.
// A frozen tab that wakes up and finds its seat taken steps down and looks for another one.
import { useEffect, useState } from 'react'
import type { Role } from '../domain/types'
import { signIn } from '../firebase/client'
import {
  HOST_BEAT_MS,
  beatHost,
  claimHost,
  claimRole,
  isHostSilent,
  releaseSilentSeats,
  watchConnected,
  watchHost,
  watchRoles,
  type Host,
} from '../firebase/session'
import { backgroundInterval } from './backgroundInterval'

export interface Session {
  uid: string | null
  /** The car this tab drives. null while joining, or when the convoy is full. */
  role: Role | null
  isHost: boolean
  /** Roles held by a human tab (role → uid). The host drives the others as NPCs. */
  humans: Partial<Record<Role, string>>
  connected: boolean
  error: string | null
}

const initial: Session = { uid: null, role: null, isHost: false, humans: {}, connected: false, error: null }

export function useSession(sid: string, wantedRole: Role): Session {
  const [session, setSession] = useState<Session>(initial)

  useEffect(() => {
    let active = true
    const unsubscribes: (() => void)[] = []
    const update = (patch: Partial<Session>) => active && setSession((s) => ({ ...s, ...patch }))
    const fail = (err: unknown) => update({ error: err instanceof Error ? err.message : String(err) })

    signIn()
      .then((uid) => {
        if (!active) return
        console.log('[convoy] signed in as', uid)
        update({ uid })
        let held: Role | null = null
        let claiming = false
        let connected = false
        let host: Host | null = null

        // One claim at a time, so a tab can never end up holding two seats.
        const tryClaim = () => {
          if (claiming || !connected) return
          claiming = true
          claimRole(sid, uid, held ?? wantedRole)
            .then((role) => {
              held = role
              update({ role })
            })
            .catch(fail)
            .finally(() => (claiming = false))
        }

        unsubscribes.push(
          watchConnected((now) => {
            connected = now
            update({ connected: now })
            if (now) tryClaim()
          }),
          watchRoles(sid, (humans) => {
            update({ humans })
            if (!held || claiming) return
            if (!humans[held]) {
              tryClaim() // our seat was freed (e.g. by onDisconnect): take it back
            } else if (humans[held] !== uid) {
              held = null // taken over while we were frozen: step down and look again
              update({ role: null })
              tryClaim()
            }
          }),
          watchHost(sid, (next) => {
            host = next
            update({ isHost: next?.uid === uid })
            if (!next) claimHost(sid, uid).catch(fail) // nobody is host: try to take over
          }),
          backgroundInterval(() => {
            if (!connected) return
            if (host?.uid === uid) {
              beatHost(sid).catch(() => {})
              releaseSilentSeats(sid, uid)
            } else if (!host || isHostSilent(host)) {
              claimHost(sid, uid).catch(fail)
            }
            if (!held) tryClaim()
          }, HOST_BEAT_MS),
        )
      })
      .catch(fail)

    return () => {
      active = false
      unsubscribes.forEach((unsubscribe) => unsubscribe())
    }
  }, [sid, wantedRole])

  return session
}
