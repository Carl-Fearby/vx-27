# AGENTS: How to be productive in GameEngine2

This guide is a compact, actionable reference for AI coding agents working in this repo. It highlights the big-picture architecture, common edit targets, developer workflows, and project-specific conventions you must know to make safe, useful changes.

Checklist (follow before making edits)
- Read `components/FpsGame.jsx` to understand runtime orchestration (renderer, scene, load sequence).
- Prefer adding/adjusting logic in `lib/*.js` (modular systems like `Level.js`, `Input.js`, `PlayerController.js`, `Sound.js`) rather than editing the monolithic client component.
- Run the dev server locally via the project's script (see "Run & build").

Big picture
- Framework: Next.js (app/ directory). The interactive game is a client-only React component mounted in the Next page: `components/FpsGame.jsx` (note top-level "use client").
- Division of labor: UI & mounting in `components/*` → game orchestration in `components/FpsGame.jsx` → game subsystems in `lib/*.js` (pure JS modules that create/manage Three.js objects, physics, audio, tuning, persistence).
- Data flow: `lib/loadArena.js` loads an arena JSON → `lib/Level.js` + `lib/LevelTextures.js` build Three.js geometry/textures → `components/FpsGame.jsx` wires renderer, scene, input, player controller and calls many `lib` APIs each frame.

Key files to inspect for any change
- Entry/host: `app/page.jsx`, `components/GameShell.jsx` (routing / mounting). Main runtime: `components/FpsGame.jsx`.
- Game systems: `lib/Level.js`, `lib/Input.js`, `lib/PlayerController.js`, `lib/ViewWeapon.js`, `lib/Sound.js`, `lib/SceneEnvironment.js`, `lib/RoomCulling.js`.
- Tuning & persistence: modules ending with `*Tuning.js` (e.g. `SunLightTuning.js`) expose load/save functions that use localStorage. Follow those helpers rather than inlining keys.
- Build & tooling: `package.json` scripts and `scripts/dev.mjs`, `scripts/release.mjs`, and other scripts under `scripts/`.

Developer workflows (commands / semantics)
- Install & dev (HTTPS by default):
  - npm install
  - npm run wasm:build   # compile RUSH crates before first dev session
  - npm run dev          # webpack dev (default — Turbopack HMR breaks on wasm-bindgen .wasm)
  - npm run dev:turbo    # opt-in Turbopack; pass --no-wasm-watch if needed
  - npm run dev:http     # same but uses plain HTTP
  - npm run dev:reset    # clears .next/cache and kills ports 3000/3001 then restarts
- Build / start / clean:
  - npm run build      # next build
  - npm run start      # next start
  - npm run clean      # `scripts/clean-next.mjs`
- Asset & deployment helpers are in `scripts/` (texture optimization, pile generation, fasthosts deploy). Use the provided node scripts rather than reimplementing tasks.

Project-specific conventions & gotchas
- Import alias: `@/*` is mapped to project root (see `jsconfig.json`). Use `@/lib/...` and `@/components/...` consistently.
- Three.js metadata: many scene objects store data in `object.userData` (e.g. `vx27` prop metadata). When changing propagation, preserve `userData` semantics.
- Local tuning: Tuning modules provide storage keys and helpers (example: `SunLightTuning.js` exposes `SUN_AZIMUTH_STORAGE_KEY`, `loadSunAngles()`, `saveSunAngles()`). Always use these helpers so you don't break persisted settings.
- Dev settings: Settings → Development exposes **player position** (live coords + copy JSON) while the menu is open. Gameplay HUD toggles with **H** (`fps-show-hud`). Gameplay tuning values still load from `lib/*Tuning.js` localStorage (walk bob, stairs, weapon pose, hemi, oil barrels, etc.) without in-game panel UI.
- Large single-file component: `components/FpsGame.jsx` is intentionally large and orchestrates many systems. Prefer small, well-scoped changes in `lib/` or new helper modules. If you must change `FpsGame.jsx`, keep modifications minimal and run the app to validate frame lifecycle behavior.

Integration points
- Browser runtime: heavy client-side code with direct DOM and WebGL usage — changes must be tested in browser (https://localhost:3000 by default).
- Server-side: Next.js provides minimal server logic — most game logic is client-only. `scripts/dev.mjs` wraps next for dev behavior (HTTPS, reset, webpack default for WASM).
- External deps: `three` (rendering), `next`, `react`. No bundler customizations beyond Next config (`next.config.mjs`) and `dev.mjs` flags.

Quick examples
- To read and update the sun angles, use the tuning helpers:
  - load: `import { loadSunAngles } from '@/lib/SunLightTuning';`
  - save: `import { saveSunAngles } from '@/lib/SunLightTuning';`
- To find where the arena is built: inspect `lib/loadArena.js` → `lib/Level.js` → the call site in `components/FpsGame.jsx` where `createLevelFromArena()` is used (search for that symbol).

When in doubt
- Run the site locally, open DevTools, and use the network/console to observe asset load order. The renderer/scene lifecycle is sensitive to order of texture/geometry preloads.
- Prefer changes to `lib/*.js` with clear unitable behavior; use browser testing rather than node-only tests.
- Load-screen GPU work lives in `lib/dev/GpuPreload.js` (`preloadGameGpu`, `settleGpuSpawnAfterLoad`). Do not reintroduce `GpuWarmup.js` or post-load shadow/material resets.

References
- Main mount: `components/FpsGame.jsx`
- GPU preload: `lib/dev/GpuPreload.js`
- Subsystems examples: `lib/Level.js`, `lib/Input.js`, `lib/PlayerController.js`, `lib/Sound.js`, `lib/SceneEnvironment.js`
- Dev script: `scripts/dev.mjs`, alias config `jsconfig.json`, tuning pattern `lib/*Tuning.js`

If you want, I can now open and annotate specific files (e.g. `FpsGame.jsx` or `Level.js`) with inline guidance for future agents.

