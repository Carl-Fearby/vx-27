# Oil barrel — dual-flame checkpoint

**Stop point:** open barrels with **two** flame meshes (main + small above-rim plume).

## What this looked like

- `oil_interior_video` — main column (looked correct inside the barrel)
- `oil_interior_plume` — small plume above the rim (`depthTest: false`, high `renderOrder`, visible through walls)

## Return to this experiment

If tagged in git:

```bash
git checkout oil-barrel-dual-flame-checkpoint
```

Or revert the commit that removed the plume:

```bash
git log --oneline -- lib/OilBarrelInteriorVideo.js
git revert <commit-that-removed-plume>
```

## After this checkpoint (current mainline)

- Single `oil_interior_video` mesh only
- Plume removed; `ensureOilBarrelFlameMeshes()` deletes legacy plume / `oil_interior_flames` group on load
- Room layer + `refreshOilBarrelRenderLayers` fixes kept
