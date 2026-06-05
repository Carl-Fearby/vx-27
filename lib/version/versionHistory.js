/**
 * Curated release notes for /version. Newest first — append when you ship.
 */
export const VERSION_HISTORY = [
  {
    version: "0.1.28",
    date: "2026-06-05",
    commit: "8f94568",
    title: "Service room consoles and level 2 corridor",
    changes: [
      "Three control panels on the service room back wall with room-interior lighting and full screen emissive.",
      "Room consoles trim diffuse under point lights; outdoor bake unchanged for UI glow.",
      "Level 2 VX-27 Passage corridor and loading-screen level select.",
    ],
  },

  {
    version: "0.1.27",
    date: "2026-06-05",
    commit: "b652373",
    title: "Compass enemy and reward blips",
    changes: [
      "Enemy and reward dots on the top compass strip by bearing (orange enemies, blue pickups)",
      "Same 30m range as radar; bottom-left radar unchanged",
    ],
  },

  {
    version: "0.1.26",
    date: "2026-06-05",
    commit: "b57e21f",
    title: "Radioactive HP and stamina overflow rules",
    changes: [
      "Damage lowers HP only; stamina can exceed HP as a run buffer after hurt",
      "HP pickups raise stamina to health cap; regen stops at 100%; overflow decays 1% per 5s",
    ],
  },

  {
    version: "0.1.25",
    date: "2026-06-05",
    commit: "8928cac",
    title: "Combat scoring and kill callouts",
    changes: [
      "Zone-based combat score separate from damage, with per-target hit cap",
      "HUD score aligned with level name; kill callouts like HEADSHOT +310",
    ],
  },

  {
    version: "0.1.24",
    date: "2026-06-05",
    commit: "a8d797f",
    title: "iPad touch controls and credits section",
    changes: [
      "On-screen move stick, look zone, and action buttons on coarse-pointer devices; HUD scaled for tablet safe areas.",
      "Touch input pipeline in Input.js; skip pointer lock on iPad.",
      "Credits: Control Panel & Combat Polish section.",
    ],
  },

  {
    version: "0.1.23",
    date: "2026-06-05",
    commit: "457f51c",
    title: "Contextual gameplay hints",
    changes: [
      "Brief F-for-flashlight toast when switching to night (6s pulse, no idle N prompt in day).",
      "Imperative HUD hint wired from game loop; dismiss on F.",
    ],
  },

  {
    version: "0.1.22",
    date: "2026-06-05",
    commit: "a8c83f4",
    title: "Control panel foot fix and laser tracers",
    changes: [
      "Remove profile fillets; fix plinth z-fight with floor clearance and hull overlays.",
      "Add simple muzzle-aligned laser tracers (Line2, weapon blue palette).",
    ],
  },

  {
    version: "0.1.21",
    date: "2026-06-05",
    commit: "7b07a8a",
    title: "Control panel polish, SE barrel pile, lighting and hurt audio",
    changes: [
      "Profile corner fillets with textured bleed; remove surface D tuner HUD.",
      "Mirror oil barrel pile and fire bin to SE arena corner (13.15, -13.15).",
      "Fix mouth-plane and prop headroom false crouch; sheltered hemi darker corners.",
      "Play player hurt vocals on fire and grenade damage.",
    ],
  },

  {
    version: "0.1.20",
    date: "2026-06-05",
    commit: "e02ee37",
    title: "Control panel texturing and service room collision",
    changes: [
      "Add procedural control panel with hull, screen C, and shelf D PBR overlays.",
      "Fix mouth-plane doorway headroom so service room no longer auto-crouches.",
      "Remove in-game tuning panels; drop unused dev debug helpers.",
      "Document control panel UV layout and pillar-shell mouth planes.",
    ],
  },

  {
    version: "0.1.19",
    date: "2026-06-04",
    commit: "c14b90e",
    title: "Pillar-shell service room and catwalk gun lighting",
    changes: [
      "North service_room uses pillarShell: room walls on interior layer, sun occluders on world layer",
      "Baked arch doorway sill; removed arch-door dev tuning panel",
      "Catwalk always outdoor for viewmodel and indoor lighting zone (fixes black gun over room)",
    ],
  },

  {
    version: "0.1.18",
    date: "2026-06-04",
    commit: "01bd050",
    title: "Doorway wall halves, HUD night, ADS tuning",
    changes: [
      "Back-to-back half-thickness arena and room doorway walls with aligned jamb cutouts",
      "HUD chrome desaturates and dims with the night blend",
      "30% ADS sensitivity for look and movement while aiming",
      "Demo day/night auto-cycle every five minutes of active play",
      "Credits VX27 container preview spin pivot fix",
    ],
  },

  {
    version: "0.1.17",
    date: "2026-06-04",
    commit: "55abbc2",
    title: "Enemy hit audio and demo day/night cycle",
    changes: [
      "Four random enemy bullet-hit vocals; one at a time with queue on rapid fire",
      "Positional hole-fall cry when enemy bodies drop through floor pits",
      "Auto day/night flip every minute of active play (demo showcase)",
      "Enemy hit playback fix so follow-up shots play after the first clip ends",
    ],
  },

  {
    version: "0.1.16",
    date: "2026-06-04",
    commit: "09f4114",
    title: "Hole falls, death vocals, service room barrels",
    changes: [
      "Floor holes commit on overlap — locked fall, camera swirl, death at depth",
      "Player combat death: three random pain vocals; separate hole-fall cry",
      "Enemies play positional death vocals on rifle and grenade kills",
      "Service room: four corner oil barrels with interior fire",
    ],
  },

  {
    version: "0.1.15",
    date: "2026-06-04",
    commit: "9517bec",
    title: "Cleanup, marketing sparkle, deploy-ready",
    changes: [
      "Remove legacy GpuWarmup and hitscan bolt pool; unify GPU preload naming",
      "Marketing site: sparkle field, what's new strip, live build badge from package.json",
      "Credits and SEO copy aligned with load-screen GPU preload",
    ],
  },

  {
    version: "0.1.14",
    date: "2026-06-04",
    commit: "feb297d",
    title: "GPU preload on load screen",
    changes: [
      "Replace disabled warmup with GpuPreload (compileAsync + gameplay render path)",
      "Upload level textures early via initTexture; bake door, stair, and spawn poses",
      "Split room-pass vs viewmodel lighting; hitscan-only weapon fire",
    ],
  },

  {
    version: "0.1.13",
    date: "2026-06-03",
    commit: "044a012",
    title: "Optimisations",
    changes: [
      "Fixed some optimisations",
    ],
  },

  {
    version: "0.1.12",
    date: "2026-06-02",
    commit: "c0f0fe6",
    title: "Bullet fixes to increase FPS",
    changes: [
      "Change bullets to be more lazer like",
      "Reduced size of bullets",
      "Optimised the GPU warm up",
    ],
  },

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
