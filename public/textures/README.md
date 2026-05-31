# Game textures (WebP)

Runtime assets are **WebP** sized for in-game use. Regenerate with:

```bash
npm run textures:game          # level, bullet holes, vx27, grenade albedos
npm run textures:oil-barrel      # oil barrel exterior + interior
```

Add `--prune-png` to remove source PNGs after encode:

```bash
node scripts/optimize-game-textures.mjs all --prune-png
```

## Packs

| Folder | Used by | Typical size |
|--------|---------|----------------|
| `ground_*`, `wall_*`, `floor_*`, `decal_*` | `lib/LevelTextures.js` — 512² albedo/normal/roughness | ~8 MB total |
| `bullet_holes/` | `lib/BulletHoles.js` — 384² alpha decals | ~0.5 MB |
| `vx27/` | HP orb pickup — body 1024×341, caps 512² | ~1 MB |
| `grenade/` | Grenade mesh — 3 albedo WebPs only at runtime | ~0.1 MB |
| `oil_barrel/` | Oil barrel prop | see `oil_barrel/README.md` |

The `grenade/` folder keeps three runtime WebPs plus `grenade_reward_texture_pack_preview.png` (credits scene only).

Unused packs (`steel_fence`, level `height_placeholder` sources) have been removed from the repo.
