# Oil barrel pile — AI authoring

Procedural placement builds **towers**, not believable dumps. Author every pile in
**`LEVEL1_OIL_BARREL_PILE_DEFS`** (`lib/OilBarrelPileLayout.js`) with AI or by hand.

## Copy-paste prompt for Cursor / LLM

```
Redesign LEVEL1_OIL_BARREL_PILE_DEFS in lib/OilBarrelPileLayout.js as a NATURAL
dumped oil-barrel pile — not a grid, not a tower.

Visual goal:
- Mostly barrels on the ground in a loose cluster (~1.1m across)
- 2–3 barrels on their side (layOnSide), 0–1 leaning (pileRole: "lean", rotationX)
- At most ONE barrel stacked (pileRole: "stack", spawn LAST in the array)
- Irregular XZ positions and rotationY — avoid even spacing or compass rows

Hard rules:
- Barrel radius 0.3m, height ~0.825m. Hub: x −7.35, z −2.48. Stay within PILE_MAX_RADIUS (1.22m).
- Do NOT set y — heights come from floor snap at spawn.
- Array order = spawn order: ground / supports first, stacked barrel last.
- pileRole: "stack" only on the one upper barrel; others stay on the floor (no auto-tower).
- layOnSide: true + rotationZ: Math.PI/2 for on-side barrels.
- Keep ids: oil_barrel_pile_stop_begin, oil_barrel_pile_01…08, oil_barrel_on_side_qa.
- Upright center-to-center spacing ≥ ~0.62m; on-side ≥ ~0.56m.

After editing:
  npm run pile:barrels:check
  npm run pile:barrels
In-game: Oil Barrel tune panel → Apply pile layout → Check pile.
```

## Workflow

1. Paste the prompt above (or describe the look you want).
2. AI edits `LEVEL1_OIL_BARREL_PILE_DEFS` — **order matters** for the one stack.
3. `npm run pile:barrels:check` — penetration / overlap test.
4. `npm run pile:barrels` — writes `public/levels/level1.json`.
5. In game: tune panel → **Apply pile layout** (hub X/Z) → **Check pile**.

## Why not procedural?

- `tumble` snap used to stack every barrel whose footprint overlapped → vertical towers.
- Snap is now **floor-only** unless `pileRole: "stack"`.
- `applyOilBarrelPileToArena` defaults to hand defs; `{ procedural: true }` is legacy only.
