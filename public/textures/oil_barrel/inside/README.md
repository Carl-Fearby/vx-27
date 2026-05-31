# Oil barrel interior (open top)

Used when `topCap` is false — cylindrical inner wall + circular floor.

**Shipped assets:** WebP only (~**260 KB** total). Re-export from your texture pack (4K/2K PNG) and run:

```bash
node scripts/optimize-oil-barrel-textures.mjs interior
```

ORM: **R** = AO, **G** = roughness, **B** = metallic.

## Runtime files

| File | Resolution | Notes |
|------|------------|--------|
| `barrel_inside_wall_albedo.webp` | 1024×512 | 2× horizontal tile on cylinder |
| `barrel_inside_wall_normal.webp` | 1024×512 | |
| `barrel_inside_wall_orm.webp` | 1024×512 | |
| `barrel_inside_floor_albedo.webp` | 512×512 | Alpha (circular mask) |
| `barrel_inside_floor_normal.webp` | 512×512 | |
| `barrel_inside_floor_orm.webp` | 512×512 | |

Rotation: **Interior wall rotation (°)** in the oil barrel tuning panel.

## Interior video

| File | Notes |
|------|--------|
| `oil_can_interior_color.mp4` | RGB (960×540 H.264) |
| `oil_can_interior_alpha.mp4` | Alpha matte extracted from source transparency |

Current clip: **looped flames** (`vecteezy_fire-flames-looped…`, portrait 9:16, 20 s loop). The shipped MP4 is H.264 without a separate alpha track; `oil_can_interior_alpha.mp4` is the matte (`colorkey` on black). If you have ProRes/MOV with real alpha, re-encode with `alphaextract` instead of `colorkey`.

Shader uses **color + alphaMap** (not runtime luma key). Re-encode from a ProRes clip with alpha:

```bash
ffmpeg -y -i your_clip.mov -an -vf "scale=960:-2,format=yuv420p" -c:v libx264 -crf 24 -movflags +faststart oil_can_interior_color.mp4
ffmpeg -y -i your_clip.mov -an -vf "scale=960:-2,format=rgba,alphaextract,format=yuv420p" -c:v libx264 -crf 24 -movflags +faststart oil_can_interior_alpha.mp4
```

Bump `?v=` on the URLs in `lib/OilBarrelInteriorVideo.js` after swapping files.
