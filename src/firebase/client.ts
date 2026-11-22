// Single place that initialises Firebase. Everything else imports from here,
// so no other module touches config, auth or the server clock directly.
//
// The web config is not a secret: it only identifies the project. Access is controlled
// by the Realtime Database security rules in database.rules.json.
import { initializeApp } from 'firebase/app'
import { inMemoryPersistence, initializeAuth, signInAnonymously } from 'firebase/auth'
import { getDatabase, onValue, ref } from 'firebase/database'

const env = import.meta.env

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})

// In-memory auth: every tab (and every reload) is a new anonymous user. The default
// persistence would share one uid across all tabs of a browser, and then two tabs could
// both "own" the same car, since ownership is checked by uid.
const auth = initializeAuth(app, { persistence: inMemoryPersistence })
export const db = getDatabase(app)

let signedIn: Promise<string> | null = null

/**
 * Anonymous sign-in: every tab gets a uid without a login screen. Resolves to that uid.
 * Signs in only once per page: a second sign-in would create a second user and switch the
 * database connection to it, while the caller still holds the first uid (React StrictMode
 * runs effects twice in dev, which is how this showed up).
 */
export function signIn(): Promise<string> {
  signedIn ??= signInAnonymously(auth).then((cred) => cred.user.uid)
  return signedIn
}

// Firebase measures how far this device's clock is from the server's. Adding it gives every
// tab the same notion of "now", which dead reckoning needs to age samples correctly.
let serverTimeOffset = 0
onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
  serverTimeOffset = snap.val() ?? 0
})

/** Current server time in ms, as estimated by this tab. */
export const serverNow = () => Date.now() + serverTimeOffset

/** Debug view of the clock offset. */
export const getServerTimeOffset = () => serverTimeOffset
