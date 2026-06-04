# Control panel — surface D (shelf top)

Optimized WebP maps for the horizontal work surface (profile edge **D**, corners 4→5).

| File | Role |
|------|------|
| `shelf_d_albedo.webp` | Base color |
| `shelf_d_normal.webp` | Normal |
| `shelf_d_roughness.webp` | Roughness |
| `shelf_d_emissive.webp` | Emissive (UI glow) |
| `shelf_d_ao.webp` | Ambient occlusion |

**UV / alignment:** Same as surface C — mesh UV mirror (`u → 1−u`), rotation from `ControlPanelScreenCTuning.js`. **Brightness:** baked in `ControlPanelShelfDTuning.js` (`CONTROL_PANEL_SHELF_D_BRIGHTNESS`).

Regenerate:

```bash
npm run textures:control-panel-shelf-d
```

Sources: `control_panel_*.png` in Cursor assets or this folder.
