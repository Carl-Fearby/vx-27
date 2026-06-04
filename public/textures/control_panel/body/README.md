# Control panel hull body (trim sheet)

Tiled PBR for the extruded sweep (**walls E–J**) and end caps (**K/L**). UVs are world-metre based in `ControlPanel.js` (`CONTROL_PANEL_UV_TILE` = 0.5 m).

| File | Map |
|------|-----|
| `body_albedo.webp` | Base color |
| `body_normal.webp` | Normal |
| `body_roughness.webp` | Roughness |
| `body_metallic.webp` | Metalness |
| `body_ao.webp` | Ambient occlusion |

Regenerate from Cursor `assets/body_*.png`:

```bash
npm run textures:control-panel-body
```

Surfaces **C** and **D** use separate folders (`screen_c/`, `shelf_d/`).
