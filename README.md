# TACTICAL_VANGUARD — AI Missile Interceptor Simulator (MVP)

Browser-based **educational / simulation** UI for experimenting with missile–interceptor geometry. This is **not** real-world defense, C2, or classified tooling.

## Stack

- Next.js App Router, React 19, TypeScript
- Three.js via React Three Fiber + Drei
- Tailwind CSS v4 (theme ported from the reference `code.html`)
- Zustand (state + optional `localStorage` rehydration for scenario/camera)
- GSAP (light panel / viewport chrome motion)

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- **SCENARIO_BUILDER**: sliders for speed, launch angle, target distance; defense mode; **INITIATE_DEPLOYMENT** runs the offline intercept model and starts the 3D playback.
- **3D viewport**: missile + interceptor + intercept burst; **Orbital_View** / **CAD_Grid_View** / **Telemetry_Lock** camera modes.
- **AI_TACTICAL_ASSISTANT**: after a run ends, the app calls `POST /api/tactical`. With `GROQ_API_KEY`, Groq returns structured JSON; with `GEMINI_API_KEY`, Gemini may append a short markdown addendum to the briefing. If Groq is unset, the route uses a **deterministic mock** (fully usable offline).
- **Export / import** scenario JSON; **Reset simulation** clears the last run and AI panel.

## Environment

Copy `.env.example` to `.env.local` and set variables as needed. Prefer **server-side** `GROQ_API_KEY` for the included Route Handler so keys are not shipped to the client. See comments in `.env.example`.

## Static export note

If you use `output: 'export'`, API routes are unavailable — use mock-only analysis or add a separate backend.

## Reference UI

Visual shell matches the Tactical Vanguard HTML reference (`code.html` in this folder).
