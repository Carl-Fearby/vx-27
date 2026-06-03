/**
 * AABB overlap check for the level1 oil barrel pile. Run: node scripts/oil-barrel-pile-probe.mjs
 */
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { preloadOilBarrelAssets } from "../lib/oil-barrel/OilBarrel.js";
import {
  OIL_BARREL_PILE_ID,
  pileHasOverlap,
  spawnArenaPileBarrelsFromDefs,
} from "../lib/oil-barrel/OilBarrelPileLayout.js";

const level = JSON.parse(
  readFileSync(new URL("../public/levels/level1.json", import.meta.url), "utf8")
);
const pile = level.props.filter((p) => OIL_BARREL_PILE_ID.test(p.id));

await preloadOilBarrelAssets(level).catch(() => {});

const root = new THREE.Group();
const floorY = level.floorY ?? 0;
const barrels = spawnArenaPileBarrelsFromDefs(root, pile, floorY);

if (pileHasOverlap(barrels, null, 0.88)) {
  console.log("Overlap detected");
  process.exit(1);
}
console.log(`OK — ${barrels.length} barrels, no AABB overlaps`);
