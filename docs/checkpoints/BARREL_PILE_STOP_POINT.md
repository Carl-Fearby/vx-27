# STOP POINT: Oil barrel pile (no fire)

Loose cluster west of arena center (~`-7.1`, `-2.4`): two seed barrels plus eight scattered props (`oil_barrel_pile_01` … `oil_barrel_pile_08`). Mix of capped/open, upright lean (`rotationX`), and `layOnSide`. All use `interiorFire: false`.

## Author / restack (AI)

Procedural stacking is disabled for the default pile. Edit **`LEVEL1_OIL_BARREL_PILE_DEFS`** in `lib/OilBarrelPileLayout.js` — **array order is spawn order** (supports before stacked barrels). Prompt + workflow: **`docs/OIL_BARREL_PILE_AI.md`**.

```bash
npm run pile:barrels:check
npm run pile:barrels
```

## Regenerate from defs (not random)

## Undo this pile only

After the stop-point commit lands, either:

```bash
git revert 651d20f --no-edit
```

or delete every prop from `oil_barrel_pile_stop_begin` through `oil_barrel_pile_08` in `public/levels/level1.json`, or rerun `npm run pile:barrels` with another `--seed`.

## Stop-point commit

Recorded below after commit (hash filled in by agent).

| Field | Value |
|-------|-------|
| Commit | `651d20f` |
| Files | `public/levels/level1.json`, this doc |
