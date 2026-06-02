/**
 * Curated release notes for /version. Newest first — append when you ship.
 */
export const VERSION_HISTORY = [
  {
    version: "0.1.11",
    date: "2026-06-02",
    commit: "6246009",
    title: "Play loop perf, wall occlusion, and SKY_LAYER rendering",
    changes: [
      "Optimize play loop: HUD gating, light zone cache, live-target scratch, oil barrel index, hitch profiler.",
      "SKY_LAYER render passes, skip empty health bar draw, sun/moon shadows 1536.",
      "Line-of-sight for barrel fire and grenades; FPS counter stays visible when HUD is off.",
    ],
  },

  {
    version: "0.1.10",
    date: "2026-06-02",
    commit: "dbe86d7",
    title: "Sky crossfade, ragdoll z-fight, pickup preview warmup",
    changes: [
      "Fix stacked day/night sky domes with aligned night UV offset and elevation-driven blend.",
      "Stop ragdoll limb z-fighting with floor; skip physics and shadow work on settled corpses.",
      "Warm pickup preview shaders from templates; defer pickup flash React updates to next frame.",
    ],
  },

  {
    version: "0.1.9",
    date: "2026-06-02",
    commit: "a4e3d37",
    title: "GPU warmup, kill perf, and Three.js 0.184",
    changes: [
      "Upgrade three.js to 0.184.0",
      "Expand GPU warmup: bullet holes on targets, health bar hit flash, muzzle palettes, pickup blink, day/night crossfade",
      "Defer ragdoll and kill blood/mark work across frames; cache ragdoll geometry; cut blood particle count",
      "Mission timer and hostile HUD via DOM refs; optional frame hitch profiler (localStorage fps-frame-hitch-profiler=true)",
      "Dawn/dusk single directional shadow map to avoid crossfade hitches",
    ],
  },

  {
    version: "0.1.8",
    date: "2026-06-02",
    commit: "e380a1b",
    title: "Sun lens flare occlusion and two-pass sky render",
    changes: [
      "Restore sky-then-world render passes so sun disc no longer bleeds through catwalks and room ceilings",
      "Hide lens flare ghosts and sun spikes unless the camera has line of sight to the sun",
    ],
  },

  {
    version: "0.1.7",
    date: "2026-06-02",
    commit: "54b168b",
    title: "Three.js 0.182 upgrade and shadow pipeline fix",
    changes: [
      "Upgrade three.js from 0.176.0 to 0.182.0 with pinned semver",
      "Fix level disappearing after GPU warmup — single-pass sky render, no mid-frame VSM shadow toggle",
      "Reset shadow pipeline after warmup; flashlight shadows only when beam is on",
      "Doorway headroom uses full opening height with shoulder padding at jambs",
    ],
  },

  {
    version: "0.1.6",
    date: "2026-06-02",
    commit: "6ab74d5",
    title: "Credits cargo preview, release tooling, tuning defaults",
    changes: [
      "3D VX-27 cargo module preview in credits roll",
      "Container door fixes and final polish",
      "npm run release:* script for version bumps and commit messages",
      "Dev tuning panels closed by default — opt in via Settings → Development",
      "AGENTS.md guide for AI-assisted development",
    ],
  },
  {
    version: "0.1.5",
    date: "2026-06-02",
    commit: "3c7bdef",
    title: "Container perf and texture shrink",
    changes: [
      "VX-27 container PBR maps converted to WebP (~96% smaller, 40 MB saved on disk)",
      "Roof/floor cap UV and material-group fixes; door depth tuning slider",
      "FPS pass: room light culling, shadow-map churn, fire video gating, door mesh cache",
      "Dev tuning panels auto-restore on localhost; HUD position tuner opt-in only",
    ],
  },
  {
    version: "0.1.4",
    date: "2026-06-02",
    commit: "13ad718",
    title: "Container polish, barrel pile, v0.1.4 release",
    changes: [
      "VX-27 door bullet holes, open-door decals, and end-cap frame fixes",
      "Barrel pile and fire barrel beside cargo module on level 1",
      "Random interior target spawn inside the container (50% chance)",
      "Live tuning panels restored — pile hub, container placement, door angles",
      "Marketing site and credits updated for cargo module and latest systems",
    ],
  },
  {
    version: "0.1.3",
    date: "2026-06-01",
    commit: "f286a50",
    title: "VX-27 cargo container",
    changes: [
      "Placeable VX-27 cargo module with corrugated materials, rounded roof/floor, and interior shell",
      "Press E on crosshair target to open/close container doors on both leaves",
      "Live tuning panel for scale, edge radius, door animation, and material UV",
      "HUD ammo counts smaller with solid blue styling and vertical alignment tweak",
    ],
  },
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
