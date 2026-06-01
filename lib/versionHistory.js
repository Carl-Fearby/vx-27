/**
 * Curated release notes for /version. Newest first — append when you ship.
 */
export const VERSION_HISTORY = [
  {
    version: "0.1.2",
    date: "2026-06-01",
    commit: "96959c7",
    title: "HUD hide polish",
    changes: [
      "H toggles HUD but keeps crosshair visible for clean captures",
      "Full compass hides with HUD; fix collectible red pointer leaking through",
    ],
  },
  {
    version: "0.1.1",
    date: "2026-06-01",
    commit: "4256f37",
    title: "Catwalk shadows, HUD toggle, HTTPS dev",
    changes: [
      "Fix catwalk ammo sun shadows bleeding into attached rooms; deck casts onto arena floor",
      "Press H to toggle HUD; Chrome-only banner on marketing site for other browsers",
      "HTTPS dev server by default (npm run dev:http for plain HTTP)",
      "Barrel fire light defaults tuned down; pickup shadow warmup refresh",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-06-01",
    commit: "fb108e2",
    title: "Barrel lighting, asset shrink, site polish",
    changes: [
      "Per-barrel fire flicker and VSM spot shadows for room barrels",
      "Sky domes and UI textures converted to WebP (4K sky, lossless UI)",
      "Marketing contact section, default look sensitivity, Fasthosts deploy",
      "HUD hide toggle for clean captures; version page",
    ],
  },
  {
    version: "0.0.9",
    date: "2026-06-01",
    commit: "54f92a3",
    title: "Flashlight, barrel fire lights, marketing split",
    changes: [
      "Weapon-mounted flashlight",
      "Dual barrel fire lights with independent L/R flicker",
      "Room bullet decal fix; attached-room floor and catwalk wall fixes",
      "Marketing landing split from /game route",
    ],
  },
  {
    version: "0.0.8",
    date: "2026-05-31",
    commit: "963f3e9",
    title: "Credits, barrel pile AI, fire loop",
    changes: [
      "Credits polish and gapless fire audio loop",
      "AI-authored oil barrel pile layout",
      "Catwalk forced-crouch and barrel flame UV stretch fixes",
    ],
  },
  {
    version: "0.0.7",
    date: "2026-05-30",
    commit: "6367060",
    title: "Oil barrel interior and textures",
    changes: [
      "Oil barrel interior video flame and WebP texture pack",
      "Textured barrel prop with live material tuning panel",
      "Fire and no-fire barrel pile variants",
    ],
  },
  {
    version: "0.0.6",
    date: "2026-05-30",
    commit: "a7a28fb",
    title: "Catwalk, compass, collectibles",
    changes: [
      "Catwalk and stair walk support with deck collision fixes",
      "Compass HUD and level collectibles",
      "Collider debug overlay for tuning",
    ],
  },
  {
    version: "0.0.5",
    date: "2026-05-29",
    commit: "127d180",
    title: "Credits scene and stairs",
    changes: [
      "Cinematic credits page with soundtrack player",
      "Stair climbing, portal snap, and walk-through blocking fixes",
      "Flashbangs and loading-screen music guard",
    ],
  },
  {
    version: "0.0.4",
    date: "2026-05-28",
    commit: "da24d71",
    title: "Combat VFX and stair tuning",
    changes: [
      "Combat VFX, level metadata, doorway and lighting cleanup",
      "Stair walk tuning wizard",
    ],
  },
  {
    version: "0.0.3",
    date: "2026-05-28",
    commit: "05f6fb0",
    title: "Audio, loading, stamina",
    changes: [
      "Spatial audio and loading flow",
      "Stamina HUD",
      "Dev server stability fixes",
    ],
  },
  {
    version: "0.0.2",
    date: "2026-05-27",
    commit: "4ffc327",
    title: "Grenades",
    changes: [
      "Grenade system with lathe-tuned model",
      "Enemy drops, self-damage, and reward balancing",
    ],
  },
  {
    version: "0.0.1",
    date: "2026-05-26",
    commit: "e32f998",
    title: "Ammo crate and pickups",
    changes: [
      "Ammo crate with end-cap textures",
      "Death drops and 3D pickup overlay",
      "Loading cooldown guard",
    ],
  },
  {
    version: "0.0.0",
    date: "2026-05-23",
    commit: "6e44a38",
    title: "Prototype origins",
    changes: [
      "Next.js FPS arena prototype — initial commit",
      "Core movement, candle flicker, day/night toggle, walkable wall tops",
      "HUD overhaul: health bar, compass, fire mode, weapon raise, arch doorway",
      "Compass enemy dots; overhead clearance checks for stand-up and jump",
    ],
  },
];
