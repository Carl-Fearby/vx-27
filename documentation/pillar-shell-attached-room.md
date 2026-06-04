# Pillar-shell attached room (level1 `service_room`)

Reference for rebuilding a **dark, attached room** north of the arena with **door cutouts**, **no catwalk bleed-through**, and **no sun on interior walls**. First shipped on level1 as `service_room` (Jun 2026).

## When to use this pattern

| Goal | Use `pillarShell: true` on `arena.rooms[]` |
|------|---------------------------------------------|
| Room reads as interior (point lights only, no directional sun on walls) | Yes |
| Solid “pillar-like” shell visible from outdoor catwalk without interior wall z-fight | Yes |
| Doors align with arena north wall openings (flat + arch) | Yes |
| Simple `floorExtensions` slab only (no full room volume) | No — use `floorExtensions` path instead |

**Do not** use the old `floorExtensions` experiment for level1 service room: it caused missing textures, sun bleed, broken door geometry, and catwalk z-fighting. Keep the room on **`rooms[]`** with `pillarShell: true`.

## Level JSON (`public/levels/level1.json`)

```json
{
  "id": "service_room",
  "centerX": 0,
  "width": 11,
  "depth": 9,
  "height": 3.8,
  "wallThickness": 0.35,
  "pillarShell": true,
  "textures": {
    "floor": "ground_smooth_concrete_worn",
    "wall": "wall_blue_cinderblock_worn",
    "ceiling": "ground_smooth_concrete_worn"
  },
  "lights": [
    {
      "type": "point",
      "position": [0, 3.2, 0],
      "color": "#ffaa55",
      "intensity": 10,
      "distance": 7,
      "decay": 2
    }
  ]
}
```

Arena north doorways (shared cutout logic with mouth wall):

- Flat door: `centerX: 0`, `top: "flat"`
- Arched door: `centerX: 3.6`, `top: "arch"`

Arch doorway sill is **baked** in code (no dev slider):

- `lib/rooms/DoorwayWall.js` → `SERVICE_ROOM_ARCH_DOOR_SILL_Y` (= `-WALL_VISUAL_FLOOR_EMBED`)
- Flat doors still use `WALL_VISUAL_FLOOR_EMBED` for hole floor line

## Render / lighting architecture

Three-layer lighting (see `lib/lighting/SceneEnvironment.js`):

| Layer | Contents | Lit by |
|-------|----------|--------|
| `WORLD_LAYER` (0) | Arena, catwalk, sun/moon, **invisible sun occluders** | Directional sun + moon |
| `ROOM_INTERIOR_LAYER` (2) | Room floor, ceiling, **pillar-shell wall meshes**, room point lights | Room point lights + low room ambient (~0.06) |
| `VIEWMODEL_LAYER` (3) | First-person weapon | Outdoor lights **or** room lights depending on zone |

**Pillar-shell rule:** wall **meshes** parent under `roomShell` (`userData.roomInterior`). They are **not** on `WORLD_LAYER`, so the sun never shades cinderblock in the world pass.

**Sun blocking from catwalk hole:** invisible `ShadowOccluder` boxes stay on the **world** group (same `userData.roomSunOccluders` group as ceiling slab). `RoomCulling` enables `castShadow` on them when the player is inside at floor level, or when a `pillarShell` room is visible and the player is **not** on the catwalk (avoids phantom shadows on the deck).

## Build pipeline (code map)

```
loadArena.js (rooms[])
    → createLevelFromArena (lib/level/Level.js)
        → buildAttachedRoom (lib/rooms/LevelRoom.js)
            if (room.pillarShell):
                buildRoomPillarShell (lib/rooms/RoomPillarShell.js)
                + floor, ceiling, point lights, sun occluders, colliders
            else:
                classic interior box walls + exterior overlays
```

### `buildRoomPillarShell` (`lib/rooms/RoomPillarShell.js`)

1. **`visualGroup`** → added to **`interiorShell`** (`roomShell` from `LevelRoom.js`).
   - **Back wall:** full-width box at north/south back of room.
   - **Side walls:** depth from room floor south edge to **mouth meet plane** (`MOUTH_MEET_INSET` before midplane to avoid z-fight with mouth extrude).
   - **Mouth wall:** `ExtrudeGeometry` on arena-facing span with `appendDoorwayHoles()` — only doorways whose `centerX` falls inside room X span.
2. **`sunOccluders`** (passed in from `LevelRoom`): shadow boxes matching back, sides, mouth solids; ceiling horizontal slab added after ceiling mesh in `LevelRoom`.
3. **Colliders:** tagged `pillarShellRoomId` for rebuild/filter; door jambs via `pushDoorColliders`.

**Half-wall span:** mouth uses `getRoomSideHalfWallSpan()` — room-side half of arena wall thickness only. Arena play-side half remains the normal north wall in `Level.js` (avoids double thickness / z-fight at innerZ→midZ).

### `buildAttachedRoom` pillar branch (`lib/rooms/LevelRoom.js`)

Skips: classic interior side/back walls, exterior overlays, corner seals.

Adds: floor, ceiling, `addRoomLights`, ground surface for player support, `roomShell.traverse(setRoomInteriorLayer)`.

### Doorway holes (`lib/rooms/DoorwayWall.js`)

- `appendDoorwayHoles(shape, openings, spanLeft, spanRight, wallBottom)` — arch uses absolute `rectTop`; arch floor line = `SERVICE_ROOM_ARCH_DOOR_SILL_Y`.
- Shared with arena north wall extrude in `Level.js` (`userData.arenaDoorwayWall`).

### Runtime culling (`lib/rooms/RoomCulling.js`)

- `buildRoomCullables`: finds `userData.roomInterior` shell + `userData.roomSunOccluders` by `roomId`.
- `updateRoomCulling`: `shell.visible` from frustum + footprint/catwalk rules; pillar-shell sun occluder cast rule (above).

### Catwalk deck

- Arena **L-deck** expanded over extension/room footprint (`Level.js`).
- **`syncRoomCatwalkDeck`** adds opaque slab above room (`getRoomCatwalkDeckPiece` in `RoomPlacement.js`) — required so looking down from catwalk is not a black void when interior shell is culled.
- Join overlap: `CATWALK_DECK_JOIN` at arena mouth.

## Viewmodel / gun lighting (common pitfall)

**Symptom:** weapon goes **black** on catwalk above service room (often before entering the room).

**Cause:** `resolveViewmodelIndoorLightingZone` or `isIndoorLightingZone` treated catwalk feet as “indoor” when the room shell was visible or the player was in a doorway peek band → outdoor sun unpinned from `VIEWMODEL_LAYER`, room point lights do not light the gun.

**Fix (keep these in sync):**

- `isIndoorLightingZone`: **return false** whenever `isOnCatwalkDeck(footY, catwalkDeckY)`.
- `resolveViewmodelIndoorLightingZone`: **return false** on catwalk; pass `footY` + `catwalkDeckY` from `FpsGame.jsx` / `GpuPreload.js`.
- **Room render pass** (`inRoomPass`) may still use `visibleRoomCount > 0` — that is separate from viewmodel lighting.

## Files checklist (new room copy)

| File | Role |
|------|------|
| `public/levels/<level>.json` | `rooms[]` entry + `pillarShell: true` + doorways on attach wall |
| `lib/rooms/RoomPillarShell.js` | Shell geometry + colliders |
| `lib/rooms/LevelRoom.js` | `pillarShell` branch in `buildAttachedRoom` |
| `lib/rooms/DoorwayWall.js` | Hole math; arch sill constant if needed |
| `lib/rooms/RoomPlacement.js` | Placement, catwalk footprint, lighting zones |
| `lib/rooms/RoomCulling.js` | Visibility + sun occluder cast |
| `lib/level/Level.js` | Arena mouth wall, L-deck, catwalk sync |
| `lib/lighting/SceneEnvironment.js` | Layered render + room ambient |
| `components/FpsGame.jsx` | `inRoomPass` vs `inRoomViewmodel` split |

## Verification (browser)

1. **Catwalk** above north room: gun lit by sun; no black silhouette at mouth (`z ≈ -14`, `footY ≈ catwalk`).
2. **Inside** service room: walls dark, point-lit; no sun stripes on cinderblock.
3. **Doors:** flat @ `centerX 0`, arch @ `3.6` — walkable, no sill gap on arch.
4. **Catwalk:** no void/black pit; no z-fight line at deck join.
5. **Shadows:** no rectangular phantom on catwalk when walking outdoor edge (occluders off on catwalk).

## Related types

- `ArenaRoom.pillarShell` in `lib/level/loadArena.js`
- Do **not** re-add `RoomPillarShellTuning` / live rebuild unless tuning returns — arch sill is baked in `DoorwayWall.js`
