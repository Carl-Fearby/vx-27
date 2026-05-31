# Oil barrel (textured cylinder) — PBR pack

Used by `lib/OilBarrel.js` for the `oilBarrel` prop.

**Runtime assets are WebP** (smaller download / VRAM). Regenerate from source PNGs:

```bash
node scripts/optimize-oil-barrel-textures.mjs all   # re-encode in-repo .webp
```

Current shipped sizes (~**50 KB** exterior + **~150 KB** interior when open) are tuned for a **0.6 m** prop — body/caps **256px**, interior wall **768×384** (2× U tile), floor **512×512**.

Mesh: one merged exterior draw call (wall + rims), **20** radial segments, shared materials/textures (no per-mesh map clones).

Keep lossy normals (`q: 90` in the script); lossless WebP normals are larger than PNG.

Level JSON: set `"topCap": false` for an open top (rim only). Interior maps live in `inside/` and load **only when needed** (open-top barrel or tuning).

## Exterior (cylinder + caps) — `*.webp` in this folder

| File | Resolution | Role |
|------|------------|------|
| `barrel_body_albedo.webp` | 256×128 | Body color |
| `barrel_body_normal.webp` | 256×128 | Body normal |
| `barrel_body_emissive.webp` | 256×128 | Indicator lights |
| `barrel_top_endcap_albedo.webp` | 256×256 | Top cap |
| `barrel_top_endcap_normal.webp` | 256×256 | Top cap normal |
| `barrel_bottom_endcap_*.webp` | 256×256 | Bottom cap |

Source PNGs (same basename `.png`) are optional inputs for the optimize script only.

Caps use tuning sliders for roughness/brightness — metallic/roughness PNGs are not loaded.

## Interior — `inside/*.webp`

See `inside/README.md` and `inside/manifest.json`.

Hard-refresh the game after replacing art.
