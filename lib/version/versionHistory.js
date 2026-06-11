/**
 * Curated release notes for /version. Newest first — append when you ship.
 */
export const VERSION_HISTORY = [
  {
    version: "0.1.51",
    date: "2026-06-11",
    commit: "pending",
    title: "Weapon tuning, lasers, and gameplay performance",
    changes: [
      "Unified primary weapon tuning wizard with live laser emitter preview for pistol/rifle alignment.",
      "Restored pooled laser tracers and tuned pistol/rifle headshot damage falloff.",
      "Disabled oil-barrel fire shadows and kept shadow update cleanup to reduce render hitches.",
      "Added local-dev start-with-pistol-and-rifle support plus updated weapon pose and emitter defaults.",
    ],
  },

  {
    version: "0.1.50",
    date: "2026-06-11",
    commit: "b8fd75e",
    title: "Rifle wall shop, hack crosshairs, and toxic spill",
    changes: [
      "North wall VX-27 shop — pistol-only start; click or E in purchase disc to buy rifle with shop sounds.",
      "Hack and purchase screen crosshairs fade in/out; console hack via click or H on screen or body.",
      "Toxic oil spill PBR floor decal on container barrel pile with dev tune panel.",
      "Pistol flashlight, weapon damage helper, and HUD or compass tuning updates.",
    ],
  },

  {
    version: "0.1.49",
    date: "2026-06-11",
    commit: "ac8dbe5",
    title: "Grenade pickup flash and trajectory perf",
    changes: [
      "Fix dropped grenade rewards flashing white — opacity-only despawn blink with emissive locked off at spawn.",
      "Reuse trajectory arc buffers for grenade aim preview to cut per-frame allocations.",
    ],
  },

  {
    version: "0.1.48",
    date: "2026-06-11",
    commit: "f88e5ac",
    title: "Catwalk kill rewards and load perf",
    changes: [
      "Kill drops resolve catwalk deck Y so HP, ammo, and grenades stay visible on the deck.",
      "Revert load-screen GPU warm picker; game loads on mount again with full preload path.",
      "Lazy-load pistol view weapon after rifle; cache compass HUD metrics and add optional frame profiler.",
    ],
  },

  {
    version: "0.1.47",
    date: "2026-06-10",
    commit: "4ffed67",
    title: "Game loop refactor, cargo tuning, and container lighting",
    changes: [
      "Extract the animation loop into lib/gameLoop modules; FpsGame stays the runtime orchestrator.",
      "Unified center-screen interact prompts (door, hack, grenade cooldown) — plain mono style; hack stays while aimed.",
      "Oil barrel placement wizard: move pile hubs or single barrels; cargo door and console/barrel tune panels.",
      "Restore VX-27 ceiling point light on room pass only — interior lit without world-pass FPS cost.",
      "Container console material tuning and level1 cargo prop placements (console + fire barrel).",
    ],
  },

  {
    version: "0.1.46",
    date: "2026-06-10",
    commit: "2f22f4e",
    title: "Grenade cooldown HUD and throw perf",
    changes: [
      "5s throw cooldown with blue/orange/red drain bar; slots 3–4 restored; empty types stay selectable.",
      "Grenade explosion particle fix and nearby collider culling — no multi-throw browser lock.",
      "Show No [type] left on G press; cooldown toast for 1s when throwing too soon.",
    ],
  },

  {
    version: "0.1.45",
    date: "2026-06-10",
    commit: "cb2295c",
    title: "Ragdoll kill stability and respawn timing",
    changes: [
      "Run limb floor/wall probes every frame — removes alternating-frame leg z-fight.",
      "Spawn ragdoll on the kill frame when GPU pre-warm is ready; defer only on cold kills.",
      "Sub-step ragdoll physics on large dt to avoid post-hitch pose jumps.",
      "Enemy respawn waits 4s after the death animation finishes; drop duplicate beacon-light tick.",
    ],
  },

  {
    version: "0.1.44",
    date: "2026-06-10",
    commit: "e177a65",
    title: "Grenade container shell collision",
    changes: [
      "Full 3D sphere-vs-box bounce on walls, roof, and ceiling colliders.",
      "Grenade motion sub-steps to stop tunneling through thin VX-27 shell.",
      "Restore pinVx27DoorEgressLightLayers export for production build.",
    ],
  },

  {
    version: "0.1.43",
    date: "2026-06-10",
    commit: "96fe395",
    title: "Ragdoll settle fix and container day-view culling",
    changes: [
      "Ragdoll corpses freeze in their landing pose — no leg vibration or post-settle snap.",
      "Stronger shin floor offset and per-kill foot Y cut ragdoll leg z-fighting.",
      "Closed VX-27 containers hide interior and skip the room pass until entry or a door opens, fixing the day-mode look glitch.",
    ],
  },

  {
    version: "0.1.42",
    date: "2026-06-10",
    commit: "d80492c",
    title: "Harsh container ceiling flicker and gameplay polish",
    changes: [
      "VX-27 ceiling light uses shared CandleFlicker — fast ballast buzz and random blackouts without door egress or frustum hitches.",
      "Torch castShadow arms after 250ms still with beam raised; shadows stay on while moving to cut dark-mode hitches.",
      "NODE BREACH security nodes stay in the grid but render empty until the player trips them.",
      "Fire-mode HUD moved to a right-side carousel with night-aware bullet icons.",
    ],
  },

  {
    version: "0.1.41",
    date: "2026-06-09",
    commit: "d173649",
    title: "Enemy vocal distance falloff and HMR preload fix",
    changes: [
      "Enemy hit vocals use positional world audio — quieter with distance, same falloff as death screams.",
      "Abort GPU preload on hot reload so compileAsync no longer crashes on disposed renderer isReady.",
    ],
  },

  {
    version: "0.1.40",
    date: "2026-06-09",
    commit: "7e261c0",
    title: "Static blue container ceiling light",
    changes: [
      "Replace dual rotating beacons and door egress spill with one static blue ceiling point light per VX-27 crate.",
      "Fix container culling so the ceiling light restores when you enter or the crate re-enters the frustum.",
      "Remove per-frame beacon animation and shorten container GPU preload.",
    ],
  },

  {
    version: "0.1.39",
    date: "2026-06-09",
    commit: "b7e39d5",
    title: "VX-27 beacons, door egress lighting, and kill pre-bake",
    changes: [
      "Seal VX-27 door gaps and end-cap leaks; dual emergency beacons (blue front, orange back) with sweep and interior flood strobes.",
      "Door egress spotlights spill beacon light through open doors only — not through container sides.",
      "Container frustum culling and deferred door collider sync; GPU preload warms beacons and head-ragdoll for all targets.",
      "Game-logic kill pre-cache: co-container and line-of-sight threats pre-warm ragdoll shaders before the shot.",
    ],
  },

  {
    version: "0.1.38",
    date: "2026-06-09",
    commit: "602af4a",
    title: "Console hack gameplay and score collectibles",
    changes: [
      "NODE BREACH hack puzzle: security nodes, timer, SPACE routing, 60s security retry with same seed and one relocated node.",
      "H ends hack early with console red flash for remaining time; baked footer hints and layout v7.",
      "Console screen C success/failure colour flash with dev brightness tuning.",
      "Score token 3D disk collectible, shared pickup bob, and 4-second reward flashes for hack and floor pickups.",
      "Hack connect/death sounds; pointer unlock while hack layout wizard is active.",
    ],
  },

  {
    version: "0.1.37",
    date: "2026-06-08",
    commit: "8bec826",
    title: "Console hack minigame, rain, and snow",
    changes: [
      "Work in progress: minigame where you hack the VX-27 control console — NODE BREACH UI, animated live/dead nodes, lightning screen flash, secure-channel pulse bars, layout tuning wizard.",
      "Rain (lib/Rain.js): outdoor streak rain with catwalk/stair occluders, indoor doorway vista, Settings intensity 5%–500%; off in containers.",
      "Snow (lib/Snow.js): round falling flakes with world-space settling on catwalks, stairs, and arena floor; cell stacking buildup, 5%–500% intensity and stick sliders; mutually exclusive with rain.",
    ],
  },

  {
    version: "0.1.36",
    date: "2026-06-07",
    commit: "58ace08",
    title: "Viewmodel receives world shadows",
    changes: [
      "First-person weapon mesh receives sun, moon, and room shadows without casting.",
    ],
  },

  {
    version: "0.1.35",
    date: "2026-06-07",
    commit: "cd97cd8",
    title: "Container viewmodel lighting zones",
    changes: [
      "Global viewmodel lighting rules for outdoor, attached room, and VX-27 container interiors.",
      "Inside a container the gun drops outdoor sun and uses warm fill ambient instead.",
    ],
  },

  {
    version: "0.1.34",
    date: "2026-06-07",
    commit: "c1d0797",
    title: "Gun screen HP bar",
    changes: [
      "Top gun-screen stat is now a layered HP bar matching HUD health colors.",
    ],
  },

  {
    version: "0.1.33",
    date: "2026-06-07",
    commit: "ec6e550",
    title: "Gun screen HP/stamina and primary slot keys",
    changes: [
      "Gun screen shows HP, ammo rounds, and stamina bar with HUD-matched colors.",
      "V and B equip rifle and pistol directly; 0 toggles primary swap.",
      "Empty-mag weapon swaps no longer stall on stale holster pose.",
    ],
  },

  {
    version: "0.1.32",
    date: "2026-06-07",
    commit: "63caa9e",
    title: "Primary weapons, pistol swap, and HUD weapon stack",
    changes: [
      "Rifle and pulse pistol as swappable primaries with holster/draw animation (X).",
      "Screen crosshair, gun reticule, and per-weapon tuning panels.",
      "HUD bottom bar with ammo round display and weapon raise pose.",
    ],
  },

  {
    version: "0.1.31",
    date: "2026-06-06",
    commit: "b4f2e97",
    title: "Console hack prompt and sheltered outdoor panels",
    changes: [
      "Press H near a console for a hack screen placeholder; HUD toggle moves to U.",
      "Sheltered outdoor consoles trim diffuse and hull emissive so catwalk sun shadows read.",
      "Target spawn foot Y respects stair ramps and ground surfaces.",
    ],
  },

  {
    version: "0.1.30",
    date: "2026-06-06",
    commit: "702d7de",
    title: "Arena consoles and hitscan-only combat",
    changes: [
      "Two control panels on the arena south wall plus one in the VX-27 cargo module.",
      "Remove laser tracer lines again — muzzle flash and impacts only for better FPS.",
      "Stable control panel textures unchanged from v0.1.29.",
    ],
  },

  {
    version: "0.1.29",
    date: "2026-06-06",
    commit: "54bdcde",
    title: "Control panel texture stability",
    changes: [
      "Revert corner-rounding geometry experiments that broke console overlays.",
      "Restore sharp-profile quads and stable hull, screen, and shelf texturing.",
      "Service room consoles and level 2 corridor unchanged from v0.1.28.",
    ],
  },

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
