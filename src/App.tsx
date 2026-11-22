// Phase 0 hello page: proves the build, the hosting deploy and anonymous auth all work.
// Replaced by the HUD in later phases.
import { useEffect, useState } from 'react'
import { signIn } from './firebase/client'

type AuthState = { kind: 'pending' } | { kind: 'ok'; uid: string } | { kind: 'error'; message: string }

export function App() {
  const [auth, setAuth] = useState<AuthState>({ kind: 'pending' })

  useEffect(() => {
    signIn()
      .then((uid) => {
        console.log('[convoy] anonymous sign-in ok, uid =', uid)
        setAuth({ kind: 'ok', uid })
      })
      .catch((err: unknown) => {
        console.error('[convoy] anonymous sign-in failed', err)
        setAuth({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      })
  }, [])

  return (
    <main className="hello">
      <h1>Live Convoy HUD</h1>
      <p className="muted">Phase 0 — deploy check</p>
      {auth.kind === 'pending' && <p>Signing in…</p>}
      {auth.kind === 'ok' && (
        <p>
          Signed in anonymously as <code>{auth.uid}</code>
        </p>
      )}
      {auth.kind === 'error' && <p className="danger">Sign-in failed: {auth.message}</p>}
    </main>
  )
}
