# Control panel — surface C (screen slope)

Optimized WebP maps for the sloped monitor bank (profile edge **C**, corners 3→4).

| File | Role |
|------|------|
| `screen_c_albedo.webp` | Base color |
| `screen_c_normal.webp` | Normal |
| `screen_c_roughness.webp` | Roughness |
| `screen_c_metallic.webp` | Metalness |
| `screen_c_emissive.webp` | Emissive (UI glow) |
| `screen_c_ao.webp` | Ambient occlusion |
**Surface C** (profile edge 3→4, monitor slope) — `u` along `panelWidth`, `v` down the slope. Maps: albedo, normal, roughness, AO, emissive (`metalness` off — no env map). Glow ~1.75× `0x3db8ff`.

Engine applies maps **as authored** (no texture `repeat` / `rotation` hacks). Default **left–right mirror** is baked on the **mesh UVs** (`u → 1−u`); further rotation/brightness defaults live in `ControlPanelScreenCTuning.js`.

Regenerate:

```bash
npm run textures:control-panel-screen-c
```

Sources: `screen_panel_*.png` in Cursor assets or this folder.
