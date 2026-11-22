# Original Brief (English translation)

Translated from the Hebrew original (`POC_Live_Convoy_HUD.rtf`). Keep this file as the reference for what was actually asked.

## Task: build a POC for "Live Convoy HUD"

Build a responsive Web/Mobile app that simulates a main driving screen (Dashboard / CarPlay View) for a driver who is currently inside an active convoy.

### Core requirements

**1. Live convoy map and movement simulation (Real-Time Tracking)**
- Show a live map (Mapbox / Google Maps / Leaflet) with 3 vehicles in the convoy (for example: Lead Car, My Car, Tail Car) moving along a defined route (for example: the coastal road, or a mountain route such as Col de Turini).
- Build a simulation mechanism that moves the vehicles in real time and updates position, speed (km/h) and the relative distance between them, through a live communication channel (Firebase Realtime DB / Firestore / WebSockets).
- Bonus: it should be possible to open two browser tabs and see the synchronization happen live between the users.

**2. Walkie-talkie system, Push-to-Talk (PTT)**
- A central PTT button, large and accessible (suited to blind pressing while driving).
- Press and hold (Hold to Talk) switches the system state to "transmitting now" for all other convoy members, shows a clear visual indication (waveform / who is speaking right now), and simulates audio transfer (using the Web Audio API, or a short record/playback).

**3. Smart alerts and safety (Convoy Logic)**
- Logic that detects in real time if the distance between the lead vehicle and the tail vehicle exceeds a defined threshold (for example: over 1.5 km) and raises a clear on-screen alert: "The convoy has split, slow down and wait" (Hebrew: "השיירה התפצלה – האט להמתנה").
- A Quick Action button for the driver: "Pull over / Breakdown" that immediately broadcasts an alert to all vehicles.

**4. UX/UI for driving mode**
- Premium Dark Mode design, sharp and clean, high contrast, with large elements suited to an in-car screen (Landscape) or a phone on the dashboard.

### Tech stack and delivery

- **Technologies:** free choice (preference for React / Next.js / Flutter with Node.js / Firebase). Feel free to use AI tools for fast development; the evaluators care about the result, the architecture and the code quality.

### What to submit

1. A live demo link deployed on Vercel / Firebase Hosting / Netlify that can be opened and checked immediately.
2. A link to a GitHub repository with a short README.md explaining:
   - How to run the project.
   - Which architecture decisions were made (and why).
   - What you would improve or add if you had two weeks instead of 4 hours (scaling, handling network drops in the field, real audio, etc.).
