# VX-27 control panel — 3D geometry spec for texturing / skinning

Use this document to author textures (albedo, normal, roughness, etc.) for the standing console prop in GameEngine2. The mesh is **procedural** (Three.js `ExtrudeGeometry`), not a GLTF export.

---

## What you are skinning

A **standing industrial control console** (~player height) seen from the side as a 2D silhouette, then:

1. **Extruded** along the horizontal width (left–right, operator side to side).
2. Placed in the level as prop `control_panel_01`.

Think: **one complex side profile × straight extrusion depth** — like a cookie cutter stretched sideways.

---

## World dimensions (`control_panel_01` in `level1.json`)

| Parameter | Value | Notes |
|-----------|-------|--------|
| **Height** | **1.65 m** | Floor to top of silhouette |
| **Depth** (front–back) | **1.023 m** | `height × 0.62` |
| **Width** (extrusion L–R) | **1.708 m** | `panelWidth` (~2.25× default; narrowed 25% from 2.277 m) |
| Floor Y | 0 m | Base sits on arena floor |
| Facing | `rotationY ≈ π` | Console back toward +arena X when placed |

Default formulas (if props omit overrides):

- `height` = 1.65  
- `depth` = height × **0.62**  
- `width` = height × **0.46** unless `panelWidth` set  

---

## Coordinate systems

### A) Profile plane (2D silhouette — most important for hero art)

Used to draw the **side shape** before extrusion.

| Axis | Meaning |
|------|---------|
| **profile x** | **0 = front** (shelf nose, toward player), **1 = back** (flat rear panel) |
| **profile y** | **0 = floor**, **1 = top** |

Corners are **normalised 0–1**, then scaled:

- `X_shape = profile_x × depth` (metres)  
- `Y_shape = profile_y × height` (metres)  

### B) Mesh local space (after `ExtrudeGeometry` + centreing)

Three.js builds the shape in the **XY plane** and extrudes along **+Z** by `width`, then translates:

```text
translate(-depth/2, 0, -width/2)
```

| Local axis | Range (metres) | Role |
|------------|----------------|------|
| **X** | −0.512 … +0.512 | Profile depth (front −, back +) |
| **Y** | 0 … 1.65 | Height |
| **Z** | −0.854 … +0.854 | Extrusion width (left −, right +) |

Group origin: **centre of footprint** on the floor (not front edge).

### C) Level placement

- Group position: arena `(x, y, z) = (-8.9, 0, -3.65)`  
- `rotationY` spins the console on the floor; mesh local axes rotate with the group.

---

## Baked side profile — 10 corners (clockwise from bottom-back)

Normalised `[profile_x, profile_y]`:

```json
[
  [1, 0],
  [1, 1],
  [0.73, 1],
  [0.43, 0.68],
  [0, 0.65],
  [0.06, 0.56],
  [0.385, 0.49],
  [0.77, 0.12],
  [0.03, 0.04],
  [0, 0]
]
```

### Corner list (1-based labels for painting)

| # | profile (x, y) | Local X, Y (m) | Typical surface |
|---|----------------|----------------|-----------------|
| 1 | 1.00, 0.00 | +0.51, 0.00 | Bottom-back / floor junction |
| 2 | 1.00, 1.00 | +0.51, 1.65 | Top-back corner |
| 3 | 0.73, 1.00 | +0.24, 1.65 | Top deck (rear section) |
| 4 | 0.43, 0.68 | −0.09, 1.12 | Screen slope → shelf rear |
| 5 | 0.00, 0.65 | −0.51, 1.07 | Shelf top at front nose |
| 6 | 0.06, 0.56 | −0.45, 0.92 | Shelf front lip (vertical face) |
| 7 | 0.385, 0.49 | −0.12, 0.81 | Shelf underside / knee recess |
| 8 | 0.77, 0.12 | +0.28, 0.20 | Base slope (rear plinth) |
| 9 | 0.03, 0.04 | −0.48, 0.07 | **Front step** (low forward tread, ~7 cm up) |
| 10 | 0.00, 0.00 | −0.51, 0.00 | Front toe / floor front |

### Functional zones (side silhouette — paint these as distinct regions)

```text
        back (x=1)
          │
    2 ────┼──── 3──── top deck
          │    ╲
          │     ╲ 4  screen bezel (gentle slope, NOT steep)
          │      ╲
          │   5 ─── shelf top (long horizontal — main control desk)
          │   │ 6  shelf front edge (thin vertical)
          │   ╲ 7  shelf underside + knee cut-out
          │    ╲ 8  base slope
          │      9 ─ front step tread
    1 ────┴───── 10 ─ front toe
       floor (y=0)
```

- **Rear panel (1→2):** Tall flat back — good for vents, labels, cable ports.  
- **Top (2→3):3):** Short flat top + front lip.  
- **Screen bank (3→4):** Sloped monitor face; keep angle **moderate** (matches baked 0.73,1 → 0.43,0.68).  
- **Shelf (4→5→6):** Deep horizontal work surface; widest forward reach of the console.  
- **Under-shelf (6→7):** Underside + leg/knee recess.  
- **Base (7→8→9→10→1):** Plinth slope (8), **shallow front step (9)** almost at the nose, vertical drop to toe (10), closes at back (1).

---

## Extrusion topology (material groups)

Single mesh `control_panel_mesh`, **two materials**:

| Three.js group | Material name | Faces |
|----------------|---------------|--------|
| **0** | `control_panel_endcap` | **Left & right end caps** — each cap is the **full 10-point silhouette** (1.708 m apart). Paint monitor side detail here if the ends are visible. |
| **1** | `control_panel_body` | **All swept side walls** — profile extruded along Z. This is the **long strip** wrapping around the console; UVs tile along the perimeter. |

No extrude bevel. **Every profile vertex** uses a quadratic fillet (`CONTROL_PANEL_PROFILE_CORNER_RADIUS_M`, default 6 cm). **Corner strips** (`ControlPanelProfileCornerStrips.js`) bleed hull end-cap UVs on all corners; screen C / shelf D corners use edge UVs where those faces meet. Extruded side walls use the same hull material + cap UVs as K/L. C/D remain separate clamped edge quads.

Grey hull fallback when `hull/` preload fails.

| Region | Maps | UV |
|--------|------|-----|
| **C**, **D** | `screen_c/`, `shelf_d/` | Profile edge quads, clamped |
| **A,B,E–J** | `hull/hull_*.webp` | Edge quads (same UV as C/D) — `ControlPanelHullFaces.js` |
| **K,L** | same | End-cap group on extrude — `applyControlPanelCapUVs` |
| Extrude sides (under quads) | — | Grey only when hull loaded (no maps on strip) |

Regenerate hull: `npm run textures:control-panel-hull`. Screen/shelf: existing optimize scripts.

---

## UV mapping (engine)

| Part | UV |
|------|-----|
| **C**, **D** | Edge quads: 0–1 along width × edge length; mirror U baked (`ControlPanelProfileEdgeQuad.js`) |
| **Hull** sides **A,B,E–J** | Per-edge quad, 0–1 UV (width × edge length) |
| **End caps K,L** | Profile UV: depth × height → 0–1 |

Hull maps use **clamp** (no repeat). `CONTROL_PANEL_UV_TILE` / `applyControlPanelWorldUVs` are legacy — not used on the console mesh anymore.

### Implications for texture artists

1. **C / D** — paint for a single quad face (wide × edge length).  
2. **Hull** — atlas treated as ~**2 m × 1 m** in world space; each face shows the matching slice (clamp at edges), not tiled and not squashed to 0–1.  
3. Tune `HULL_ATLAS_WORLD_WIDTH` / `HEIGHT` in `ControlPanelHullUV.js` if art scale feels off.

---

## Side-view layout template (for end-cap texture 2048×2048)

Canvas proportions: **width : height = depth : height ≈ 1.023 : 1.65 ≈ 0.62 : 1**.

Map normalised profile to pixels:

```text
pixel_x = (1 - profile_x) * image_width   // front = left of image
pixel_y = (1 - profile_y) * image_height  // top = top of image
```

Plot the 10 corners; fill regions per “Functional zones” above.

---

## ASCII side elevation (metres, local X/Y)

```text
Y 1.65 ┤     2────────3
       │     │        ╲ 4
       │     │         ╲
 1.12  ┤     │    5──────● (shelf)
       │     │    ┃6
 0.81  ┤     │     ╲7
       │     │      ╲8
 0.07  ┤     1────9─10
 0.00  ┤
       └─────┴────────────► X
      -0.51 (front)   +0.51 (back)
```

---

## ChatGPT / DALL·E copy-paste brief

```text
TASK: Texture a procedural 3D control console for a first-person game (Three.js extruded mesh).

MESH: One 2D side silhouette extruded 1.708 m left–right. NOT a GLB. Two materials: (0) left/right end caps = full side silhouette, (1) wrapped side walls = tiling UVs.

SIZE: 1.65 m tall × 1.023 m deep (front shelf to flat back) × 1.708 m wide.

PROFILE AXES (side view): x=0 front (player side), x=1 flat back; y=0 floor, y=1 top.

10 CORNERS clockwise from bottom-back [profile_x, profile_y]:
1 [1,0]   2 [1,1]   3 [0.73,1]   4 [0.43,0.68]   5 [0,0.65]
6 [0.06,0.56]   7 [0.385,0.49]   8 [0.77,0.12]   9 [0.03,0.04]   10 [0,0]

SURFACE ZONES:
- Rear 1→2: tall flat back panel (vents, labels)
- Top 2→3: short flat deck
- Screen 3→4: moderate sloped monitor bank (not steep)
- Shelf 4→5→6: deep horizontal desk, thin vertical front lip
- Under 6→7: shelf underside, knee recess
- Base 7→8: plinth slope from back
- Step 8→9: long run forward along floor, rises to shallow front tread (9 is almost at front, only ~7 cm high)
- Toe 9→10→1: small drop at nose to floor, return along back

END-CAP TEXTURE LAYOUT: Side elevation image, aspect width:height = 1.023:1.65. Map pixel_x = (1-profile_x)*W, pixel_y = (1-profile_y)*H.

SIDE WALLS: Use seamless metal/painted steel tiles; u=(x+z)/0.5, v=y/0.5 metres (0.5 m tile).

STYLE: Industrial sci-fi standing console, grey metal, dark screen glass on slope 3–4, rubber trim on shelf 5–6, heavy plinth 7–8, subtle front step 9, toe 10.

OUTPUT: panel_endcap_albedo + normal (2048² side layout), panel_body_albedo + normal (1024² tiling).
```

---

## Quick summary for image models

> **Object:** Extruded 10-point side profile of a standing sci-fi/industrial control desk.  
> **Size:** 1.65 m tall × 1.02 m deep × 1.71 m wide.  
> **Front** has a deep horizontal shelf and thin vertical lip; **back** is flat; **top** has a shallow deck then sloped screen panel; **base** has rear plinth slope, a **low forward step** at the front nose (corner 9), then toe to floor.  
> **Texturing:** Two materials — (A) left/right silhouette faces, (B) wrapped side band with 0.5 m world tiling UVs. Use tiling metal/paint on sides; paint screens and controls on a side-view cap texture using the 10-corner polygon above.

---

## Source code references

- Geometry: `lib/control-panel/ControlPanel.js`  
- Level prop: `public/levels/level1.json` → `control_panel_01`  
- Texture folder: `public/textures/control_panel/`
