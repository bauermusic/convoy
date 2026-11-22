// Push-to-talk for this tab.
//   press():   claim the floor, open the mic, start recording a voice message (max 8 s).
//   release(): stop recording, send the message, close the mic, give the floor back.
// Receivers hear a tone when someone else's channel opens and closes, then the message plays.
//
// Pressing is asynchronous (a transaction, then the mic permission), and the button may be
// released before either finishes. `wanted` tracks whether the button is still down, and every
// async step checks it before going on.
import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_CLIP_MS, playClip, startRecording, type Recorder } from '../audio/clip'
import { unlockAudioOnFirstGesture } from '../audio/context'
import { openMic, type Mic } from '../audio/mic'
import { playTone } from '../audio/tone'
import { MAX_TALK_MS, floorState, isExpired, type Floor, type FloorState } from '../domain/pttFloor'
import type { Role } from '../domain/types'
import { sendClip, subscribeClips, type Clip } from '../firebase/clips'
import { serverNow } from '../firebase/client'
import { releaseFloor, takeFloor, watchFloor } from '../firebase/ptt'
import type { Session } from './useSession'

export interface Ptt {
  state: FloorState
  /** Who is on the radio right now (talking, or their message is playing), for indicators. */
  talking: Role | null
  /** Our live mic while transmitting; null when idle or when no mic is available. */
  mic: Mic | null
  /** Why we are transmitting without a mic (e.g. "permission denied"): state-only PTT. */
  micProblem: string | null
  /** Our message is being recorded (the browser supports MediaRecorder). */
  recording: boolean
  /** Whose message is playing here, and its live level for the waveform. */
  playing: { role: Role; analyser: AnalyserNode | null } | null
  press: () => void
  release: () => void
}

export function usePtt(sid: string, session: Session): Ptt {
  const { uid, role } = session
  const [floor, setFloor] = useState<Floor | null>(null)
  const [mic, setMic] = useState<Mic | null>(null)
  const [micProblem, setMicProblem] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [playing, setPlaying] = useState<Ptt['playing']>(null)
  const wanted = useRef(false) // the button is down
  const held = useRef(false) // we hold the floor in the database
  const micRef = useRef<Mic | null>(null)
  const recorder = useRef<Recorder | null>(null)
  const limit = useRef<number>()

  // Channel tones for other people's transmissions: open when a new talker starts, close when it ends.
  useEffect(() => {
    if (!uid) return
    unlockAudioOnFirstGesture()
    let prev: Floor | null = null
    return watchFloor(sid, (next) => {
      const otherNow = next && next.uid !== uid ? next.uid : null
      const otherBefore = prev && prev.uid !== uid ? prev.uid : null
      if (otherNow && otherNow !== otherBefore) playTone('open')
      else if (otherBefore && !otherNow) playTone('close')
      prev = next
      setFloor(next)
    })
  }, [sid, uid])

  // Incoming voice messages play one after another, never on top of each other.
  useEffect(() => {
    if (!uid) return
    let queue = Promise.resolve()
    const play = (clip: Clip) =>
      playClip(clip.b64, (analyser) => setPlaying(analyser ? { role: clip.role, analyser } : null)).catch((err) =>
        console.warn(`[convoy] can't play ${clip.role}'s message (${clip.mime})`, err),
      )
    const unsubscribe = subscribeClips(sid, uid, (clip) => (queue = queue.then(() => play(clip))))
    return () => {
      unsubscribe()
      setPlaying(null)
    }
  }, [sid, uid])

  const release = useCallback(() => {
    wanted.current = false
    window.clearTimeout(limit.current)
    // Stop the recorder before closing the mic, so the last bit of audio is kept.
    const rec = recorder.current
    const openedMic = micRef.current
    recorder.current = null
    micRef.current = null
    setMic(null)
    setRecording(false)
    const wasHeld = held.current
    held.current = false
    ;(rec ? rec.stop() : Promise.resolve(null)).then((clip) => {
      openedMic?.close()
      if (clip && uid && role) sendClip(sid, uid, role, clip.blob, clip.mime).catch((err) => console.warn('[convoy] message not sent', err))
    })
    if (wasHeld) releaseFloor(sid)
  }, [sid, uid, role])

  const press = useCallback(async () => {
    if (!uid || !role || wanted.current) return
    wanted.current = true
    setMicProblem(null)
    // Ask for the mic now, while still inside the tap (see mic.ts), in parallel with the claim.
    const micRequest = openMic()
    const closeMic = () => micRequest.then(({ mic }) => mic?.close())
    if (!(await takeFloor(sid, uid, role))) {
      wanted.current = false // busy: someone else got there first
      return void closeMic()
    }
    held.current = true
    if (!wanted.current) {
      closeMic()
      return release() // let go while we were claiming
    }
    playTone('open') // "talk permit" for the talker
    limit.current = window.setTimeout(release, MAX_TALK_MS) // forced release after 30 s
    const { mic: opened, problem } = await micRequest
    if (!wanted.current) return opened?.close()
    micRef.current = opened
    setMic(opened)
    setMicProblem(problem)
    recorder.current = opened && startRecording(opened.stream)
    if (recorder.current) {
      // A message is at most 8 s: release then, as a radio would cut off a long transmission.
      window.clearTimeout(limit.current)
      limit.current = window.setTimeout(release, MAX_CLIP_MS)
      setRecording(true)
    }
  }, [sid, uid, role, release])

  // Release on unmount (the database side is covered by onDisconnect if the tab dies).
  useEffect(() => release, [release])

  const now = serverNow()
  const talking = floor && !isExpired(floor, now) ? floor.role : null
  return {
    state: floorState(floor, uid, now),
    talking: talking ?? playing?.role ?? null,
    mic,
    micProblem,
    recording,
    playing,
    press,
    release,
  }
}
