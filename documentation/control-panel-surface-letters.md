# Control panel surface letters (texture mapping)

Yellow letter decals on the console in-game (toggle: **Settings → Development → Surface letter labels**). Use these IDs when assigning textures.

Profile corners are **1–10** (clockwise from bottom-back). **Side letters A–J** are the **extruded wall** along each edge between corners. **K / L** are the **left and right end caps** (full side silhouette).

| Letter | Connects corners | Surface (what you are painting) |
|--------|------------------|----------------------------------|
| **A** | 1 → 2 | Rear panel bottom → top (back edge) |
| **B** | 2 → 3 | Top deck along the back |
| **C** | 3 → 4 | Screen / monitor slope — **textured** (`screen_c_*.webp`; letter hidden when loaded) |
| **D** | 4 → 5 | Shelf top — **textured** (`shelf_d_*.webp`; letter hidden when loaded) |
| **E** | 5 → 6 | Shelf front lip (thin vertical face) |
| **F** | 6 → 7 | Shelf underside + knee recess |
| **G** | 7 → 8 | Base plinth slope (rear → step) |
| **H** | 8 → 9 | Forward step / low front tread |
| **I** | 9 → 10 | Front toe (nose down to floor) |
| **J** | 10 → 1 | Floor line (front toe → bottom-back) |
| **K** | — | **Left end cap** (−Z, one full side profile) |
| **L** | — | **Right end cap** (+Z, one full side profile) |

## Corner numbers (profile editor / JSON)

```json
1 [1,0]  2 [1,1]  3 [0.73,1]  4 [0.43,0.68]  5 [0,0.65]
6 [0.06,0.56]  7 [0.385,0.49]  8 [0.77,0.12]  9 [0.03,0.04]  10 [0,0]
```

## Engine materials (when wiring textures)

| Letter(s) | Three.js material group | Suggested map |
|-----------|-------------------------|---------------|
| C, D | Overlays | Letters hidden when `screen_c` / `shelf_d` loaded |
| A,B,E–J,K,L | Hull materials | Letters hidden when `hull/` loaded |
| E–I | — | Also suppressed in code (overlap with hull set) |

Tell the agent: e.g. “**C** = screen glass, **D** = worn laminate shelf” and we map to materials or UV regions.
