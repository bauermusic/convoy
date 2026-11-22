// Push-to-talk for this tab: press() claims the floor and opens the mic, release() gives both
// back. Receivers hear a tone when someone else's channel opens and closes.
//
// Pressing is asynchronous (a transaction, then the mic permission), and the button may be
// released before either finishes. `wanted` tracks whether the button is still down, and every
// async step checks it before going on.
import { useCallback, useEffect, useRef, useState } from 'react'
import { unlockAudioOnFirstGesture } from '../audio/context'
import { openMic, type Mic } from '../audio/mic'
import { playTone } from '../audio/tone'
import { MAX_TALK_MS, floorState, isExpired, type Floor, type FloorState } from '../domain/pttFloor'
import type { Role } from '../domain/types'
import { serverNow } from '../firebase/client'
import { releaseFloor, takeFloor, watchFloor } from '../firebase/ptt'
import type { Session } from './useSession'

export interface Ptt {
  state: FloorState
  /** Who is talking right now (anyone, including us), for indicators. */
  talking: Role | null
  /** Our live mic while transmitting; null when idle or when no mic is available. */
  mic: Mic | null
  /** We transmitted without a mic (unsupported or refused): state-only PTT. */
  noMic: boolean
  press: () => void
  release: () => void
}

export function usePtt(sid: string, session: Session): Ptt {
  const { uid, role } = session
  const [floor, setFloor] = useState<Floor | null>(null)
  const [mic, setMic] = useState<Mic | null>(null)
  const [noMic, setNoMic] = useState(false)
  const wanted = useRef(false) // the button is down
  const held = useRef(false) // we hold the floor in the database
  const micRef = useRef<Mic | null>(null)
  const limit = useRef<number>()

  useEffect(() => {
    if (!uid) return
    unlockAudioOnFirstGesture()
    let prev: Floor | null = null
    return watchFloor(sid, (next) => {
      // Tones for other people's transmissions: open when a new talker starts, close when it ends.
      const otherNow = next && next.uid !== uid ? next.uid : null
      const otherBefore = prev && prev.uid !== uid ? prev.uid : null
      if (otherNow && otherNow !== otherBefore) playTone('open')
      else if (otherBefore && !otherNow) playTone('close')
      prev = next
      setFloor(next)
    })
  }, [sid, uid])

  const release = useCallback(() => {
    wanted.current = false
    window.clearTimeout(limit.current)
    micRef.current?.close()
    micRef.current = null
    setMic(null)
    if (held.current) {
      held.current = false
      releaseFloor(sid)
    }
  }, [sid])

  const press = useCallback(async () => {
    if (!uid || !role || wanted.current) return
    wanted.current = true
    setNoMic(false)
    if (!(await takeFloor(sid, uid, role))) {
      wanted.current = false // busy: someone else got there first
      return
    }
    held.current = true
    if (!wanted.current) return release() // let go while we were claiming
    playTone('open') // "talk permit" for the talker
    limit.current = window.setTimeout(release, MAX_TALK_MS) // forced release after 30 s
    const opened = await openMic()
    if (!wanted.current) return opened?.close()
    micRef.current = opened
    setMic(opened)
    setNoMic(!opened)
  }, [sid, uid, role, release])

  // Release on unmount (the database side is covered by onDisconnect if the tab dies).
  useEffect(() => release, [release])

  const now = serverNow()
  return {
    state: floorState(floor, uid, now),
    talking: floor && !isExpired(floor, now) ? floor.role : null,
    mic,
    noMic,
    press,
    release,
  }
}
