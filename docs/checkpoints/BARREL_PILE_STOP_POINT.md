# STOP POINT: Oil barrel pile (no fire)

Loose cluster west of arena center (~`-7.1`, `-2.4`): two seed barrels plus eight scattered props (`oil_barrel_pile_01` … `oil_barrel_pile_08`). Mix of capped/open, upright lean (`rotationX`), and `layOnSide`. All use `interiorFire: false`.

## Undo this pile only

After the stop-point commit lands, either:

```bash
git revert <STOP_POINT_COMMIT> --no-edit
```

or delete every prop from `oil_barrel_pile_stop_begin` through `oil_barrel_pile_08` in `public/levels/level1.json` (restore `oil_barrel_capped_qa` id if you want the original two-barrel names).

## Stop-point commit

Recorded below after commit (hash filled in by agent).

| Field | Value |
|-------|-------|
| Commit | `11f44af` (`git revert 11f44af --no-edit`) |
| Files | `public/levels/level1.json`, this doc |
