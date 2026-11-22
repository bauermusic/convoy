// Single place that initialises Firebase. Everything else imports `db` / `signIn` from here,
// so no other module touches config or auth directly.
//
// The web config is not a secret: it only identifies the project. Access is controlled
// by the Realtime Database security rules in database.rules.json.
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

const env = import.meta.env

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)
export const db = getDatabase(app)

/** Anonymous sign-in: every tab gets a uid without a login screen. Resolves to that uid. */
export async function signIn(): Promise<string> {
  const cred = await signInAnonymously(auth)
  return cred.user.uid
}
