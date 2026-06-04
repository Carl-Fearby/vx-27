# Control panel hull (all faces except C & D)

Object-scale PBR from `body_panel_*.png` on **A,B,E–J** and **K,L** (UV in metres, clamped — ~2 m × 1 m per atlas).

**C** and **D** stay on `screen_c/` and `shelf_d/` — do not replace those folders with this atlas.

```bash
npm run textures:control-panel-hull
```

Maps: `hull_albedo`, `hull_normal`, `hull_roughness`, `hull_metallic`, `hull_emissive`, `hull_ao`.

Loaded by `lib/control-panel/ControlPanelBody.js`.
