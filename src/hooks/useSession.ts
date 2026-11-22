// Joins a session: signs in, claims a role, keeps track of who holds which role and who is
// host. Every time the connection comes (back) up we claim again, because the server ran
// our onDisconnect handlers when the connection dropped and the role may be free now.
import { useEffect, useState } from 'react'
import type { Role } from '../domain/types'
import { signIn } from '../firebase/client'
import { claimHost, claimRole, watchConnected, watchHost, watchRoles } from '../firebase/session'

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

        unsubscribes.push(
          watchConnected((connected) => {
            update({ connected })
            if (!connected) return
            claimRole(sid, uid, held ?? wantedRole)
              .then((role) => {
                held = role
                update({ role })
              })
              .catch(fail)
          }),
          watchRoles(sid, (humans) => update({ humans })),
          watchHost(sid, (hostUid) => {
            update({ isHost: hostUid === uid })
            // Nobody is host (first tab, or the host left): try to take over.
            if (hostUid === null) claimHost(sid, uid).catch(fail)
          }),
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
