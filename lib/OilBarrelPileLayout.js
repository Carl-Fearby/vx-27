/**
 * Oil-barrel pile layout.
 *
 * **Stacking:** procedural `stack` roles are unreliable — author piles in
 * `LEVEL1_OIL_BARREL_PILE_DEFS` (AI/human). Spawn order = that array order;
 * later barrels snap onto earlier ones when XZ overlaps.
 *
 *   npm run pile:barrels          # write hand defs → level1.json
 *   npm run pile:barrels:check    # AABB overlap check
 */
import * as THREE from "three";
import { OIL_BARREL_HEIGHT, OIL_BARREL_RADIUS } from "./OilBarrelDimensions.js";
import { createOilBarrel } from "./OilBarrel.js";

export const OIL_BARREL_PILE_ID =
  /oil_barrel_pile_|oil_barrel_pile_stop_begin|oil_barrel_on_side_qa/;

const R = OIL_BARREL_RADIUS;
const H = OIL_BARREL_HEIGHT;
const HH = H * 0.5;
const GAP = 0.04;
const TOUCH_UPRIGHT = 2 * R + GAP;
const TOUCH_LAY = R + HH + GAP;
/** Lean: rim near support, modest tilt */
const TOUCH_LEAN = R + 0.05;
const CONTACT_PAD = 0.006;
const REST_EPS = 0.055;
const XZ_CONTACT_PAD = 0.1;
/** Ground cluster spread from hub (m, XZ) */
export const PILE_MAX_RADIUS = 1.22;

/** @typedef {"base" | "tumble" | "lay" | "lean" | "stack" | "stackLean" | "stackLay"} PileRole */

/**
 * @typedef {object} PileBarrelSpec
 * @property {string} id
 * @property {PileRole} role
 * @property {boolean} [topCap]
 * @property {string} [note]
 */

/**
 * Hand-authored dumped pile (hub −7.35, −2.48). Irregular scatter on the floor;
 * one explicit stack (`pileRole: "stack"`). Spawn uses XZ + rotation only — no `y`.
 */
export const LEVEL1_OIL_BARREL_PILE_DEFS = [
  {
    id: "oil_barrel_pile_stop_begin",
    type: "oilBarrel",
    x: -7.35,
    z: -2.48,
    rotationY: 0.38,
    topCap: true,
    interiorFire: false,
    note: "=== STOP POINT BEGIN: dumped pile anchor ===",
  },
  {
    id: "oil_barrel_pile_02",
    type: "oilBarrel",
    x: -7.09,
    z: -3.23,
    rotationY: 1.22,
    topCap: true,
    interiorFire: false,
  },
  {
    id: "oil_barrel_pile_01",
    type: "oilBarrel",
    x: -6.6,
    z: -2.21,
    rotationY: 2.45,
    topCap: false,
    interiorFire: false,
  },
  {
    id: "oil_barrel_on_side_qa",
    type: "oilBarrel",
    x: -7.77,
    z: -1.51,
    rotationY: 0.48,
    rotationZ: Math.PI / 2,
    layOnSide: true,
    topCap: false,
    interiorFire: false,
    note: "Dumped — wedged on side",
  },
  {
    id: "oil_barrel_pile_06",
    type: "oilBarrel",
    x: -6.97,
    z: -1.64,
    rotationY: 3.85,
    topCap: false,
    interiorFire: false,
  },
  {
    id: "oil_barrel_pile_03",
    type: "oilBarrel",
    x: -8.22,
    z: -3.11,
    rotationY: 5.1,
    rotationX: 0.16,
    pileRole: "lean",
    topCap: false,
    interiorFire: false,
  },
  {
    id: "oil_barrel_pile_04",
    type: "oilBarrel",
    x: -8.27,
    z: -2.33,
    rotationY: 1.05,
    rotationZ: Math.PI / 2,
    layOnSide: true,
    topCap: false,
    interiorFire: false,
  },
  {
    id: "oil_barrel_pile_05",
    type: "oilBarrel",
    x: -7.67,
    z: -3.48,
    rotationY: 0.73,
    topCap: true,
    interiorFire: false,
  },
  {
    id: "oil_barrel_pile_08",
    type: "oilBarrel",
    x: -6.4,
    z: -3.0,
    rotationY: 2.08,
    rotationZ: Math.PI / 2,
    layOnSide: true,
    topCap: false,
    interiorFire: false,
    note: "=== STOP POINT END: dumped pile ===",
  },
  {
    id: "oil_barrel_pile_07",
    type: "oilBarrel",
    x: -7.38,
    z: -2.46,
    rotationY: 1.75,
    pileRole: "stack",
    topCap: true,
    interiorFire: false,
    note: "Only stack — spawn last, footprint on anchor",
  },
];

/** Spawn order for pile barrels — must match LEVEL1_OIL_BARREL_PILE_DEFS (bottom → top). */
export const PILE_SPAWN_ORDER = LEVEL1_OIL_BARREL_PILE_DEFS.map((d) => d.id);

/**
 * @param {object[]} pileDefs
 * @returns {object[]}
 */
export function orderPileDefsForSpawn(pileDefs) {
  const byId = new Map(pileDefs.map((d) => [d.id, d]));
  const ordered = [];
  for (const id of PILE_SPAWN_ORDER) {
    const def = byId.get(id);
    if (def) ordered.push(def);
  }
  for (const def of pileDefs) {
    if (!ordered.includes(def)) ordered.push(def);
  }
  return ordered;
}

/** @param {object} def @returns {PileRole} */
function inferPileSnapRole(def) {
  if (def.pileRole) return def.pileRole;
  if (def.layOnSide) return "lay";
  if (typeof def.note === "string" && /stack/i.test(def.note)) return "stack";
  return "tumble";
}

/** 10-barrel dumped pile. Order: base → heap → stack on top. */
export const DEFAULT_PILE_SPECS = [
  {
    id: "oil_barrel_pile_stop_begin",
    role: "base",
    topCap: true,
    note: "=== STOP POINT BEGIN: dumped pile anchor ===",
  },
  { id: "oil_barrel_pile_01", role: "tumble", topCap: false },
  { id: "oil_barrel_pile_02", role: "tumble", topCap: true },
  {
    id: "oil_barrel_on_side_qa",
    role: "lay",
    topCap: false,
    note: "Dumped — wedged on side",
  },
  { id: "oil_barrel_pile_03", role: "tumble", topCap: false },
  { id: "oil_barrel_pile_04", role: "lay", topCap: false },
  { id: "oil_barrel_pile_06", role: "tumble", topCap: false },
  { id: "oil_barrel_pile_05", role: "tumble", topCap: true },
  { id: "oil_barrel_pile_07", role: "stack", topCap: true },
  {
    id: "oil_barrel_pile_08",
    role: "lay",
    topCap: false,
    note: "=== STOP POINT END: dumped pile ===",
  },
];

/** @param {number} seed */
export function createPileRng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {object} def
 */
export function resolvePileTopCap(def) {
  if (def.topCap === true || def.topCap === false) return def.topCap;
  return true;
}

/**
 * @param {THREE.Object3D} root
 * @param {object} def
 * @param {number} arenaFloorY
 */
export function spawnPileBarrel(root, def, arenaFloorY = 0) {
  const bottomY = arenaFloorY;
  const group = createOilBarrel(
    root,
    def.x,
    def.z,
    bottomY,
    def.rotationY ?? 0,
    {
      topCap: resolvePileTopCap(def),
      interiorFire: false,
      layOnSide: def.layOnSide === true,
      rotationX: def.rotationX,
      rotationZ: def.rotationZ,
    }
  );
  group.userData.pileId = def.id;
  return group;
}

/**
 * @param {THREE.Group[]} barrels
 * @param {THREE.Group | null} [candidate]
 */
const _pileBoxShrink = new THREE.Box3();
const _pileShrinkCenter = new THREE.Vector3();
const _pileShrinkSize = new THREE.Vector3();

/** @param {THREE.Box3} box @param {number} scale @param {THREE.Box3} out */
function shrinkBox3(box, scale, out) {
  box.getCenter(_pileShrinkCenter);
  box.getSize(_pileShrinkSize);
  _pileShrinkSize.multiplyScalar(scale);
  out.setFromCenterAndSize(_pileShrinkCenter, _pileShrinkSize);
  return out;
}

/**
 * Ground dumped piles: side-by-side contact is OK; reject deep horizontal penetration
 * and same-height mesh interpenetration. Stacked rim pairs (one on another) are OK.
 *
 * @param {THREE.Group[]} barrels
 * @param {THREE.Group | null} [candidate]
 * @param {number} [shrink=0.88]
 * @param {number} [floorY=0]
 */
export function pileHasOverlap(barrels, candidate = null, shrink = 0.88, floorY = 0) {
  const list = candidate ? [...barrels, candidate] : barrels;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (barrelsPenetrate(list[i], list[j], shrink, floorY)) return true;
    }
  }
  return false;
}

/** @param {THREE.Box3} box @param {number} floorY */
function barrelOnFloor(box, floorY) {
  return box.min.y <= floorY + 0.14;
}

/** @param {THREE.Box3} a @param {THREE.Box3} b */
function isRimStackPair(a, b) {
  const rimGap = CONTACT_PAD + 0.14;
  return (
    Math.abs(a.min.y - b.max.y) <= rimGap ||
    Math.abs(b.min.y - a.max.y) <= rimGap
  );
}

/** @param {THREE.Box3} box */
function barrelLooksOnSide(box) {
  const sx = box.max.x - box.min.x;
  const sy = box.max.y - box.min.y;
  const sz = box.max.z - box.min.z;
  return sy < H * 0.78 && Math.max(sx, sz) > sy * 1.05;
}

/**
 * @param {THREE.Group} a
 * @param {THREE.Group} b
 * @param {number} shrink
 * @param {number} floorY
 */
function barrelsPenetrate(a, b, shrink, floorY) {
  const rawA = barrelBox(a, new THREE.Box3());
  const rawB = barrelBox(b, new THREE.Box3());
  if (isRimStackPair(rawA, rawB)) return false;

  const boxA = shrinkBox3(rawA, shrink, _pileBoxB);
  const boxB = shrinkBox3(rawB, shrink, new THREE.Box3());
  if (!boxA.intersectsBox(boxB)) return false;

  if (barrelOnFloor(boxA, floorY) && barrelOnFloor(boxB, floorY)) {
    const dx = a.position.x - b.position.x;
    const dz = a.position.z - b.position.z;
    const dist = Math.hypot(dx, dz);
    const lay = barrelLooksOnSide(rawA) || barrelLooksOnSide(rawB);
    const minDist = lay ? R + HH * 0.88 : 2 * R * 0.94;
    return dist < minDist;
  }

  return true;
}

const _pileBoxA = new THREE.Box3();
const _pileBoxB = new THREE.Box3();

/** @param {THREE.Group} group @param {THREE.Box3} [out] */
function barrelBox(group, out = _pileBoxA) {
  group.updateMatrixWorld(true);
  return out.setFromObject(group);
}

/** @param {THREE.Group} group */
function barrelTopY(group) {
  return barrelBox(group).max.y;
}

/** @param {THREE.Box3} a @param {THREE.Box3} b @param {number} [pad] */
function boxXZOverlap(a, b, pad = XZ_CONTACT_PAD) {
  return (
    a.min.x - pad < b.max.x &&
    a.max.x + pad > b.min.x &&
    a.min.z - pad < b.max.z &&
    a.max.z + pad > b.min.z
  );
}

/**
 * Drop barrel so its lowest point sits on the floor or the highest barrel below its footprint.
 * @param {THREE.Group} group
 * @param {THREE.Group[]} placed
 * @param {number} arenaFloorY
 * @param {THREE.Group | null} [primarySupport]
 * @returns {number} support surface Y used
 */
/**
 * @param {THREE.Group} group
 * @param {THREE.Group[]} placed
 * @param {number} arenaFloorY
 * @param {THREE.Group | null} primarySupport
 * @param {PileRole} role
 */
function snapBarrelToSupportSurface(
  group,
  placed,
  arenaFloorY,
  primarySupport,
  role
) {
  const candidateBox = barrelBox(group, new THREE.Box3());
  const footY = candidateBox.min.y;
  let supportY = arenaFloorY;

  if (role === "lay" || role === "lean" || role === "tumble" || role === "base") {
    // Dumped pile: ground contact unless explicitly stacked (avoids auto-towers).
    supportY = arenaFloorY;
  } else if (isExplicitStackRole(role)) {
    const cx = (candidateBox.min.x + candidateBox.max.x) * 0.5;
    const cz = (candidateBox.min.z + candidateBox.max.z) * 0.5;
    let bestTop = arenaFloorY;
    let bestDist = Infinity;

    const consider = (g) => {
      const ob = barrelBox(g, new THREE.Box3());
      if (!boxXZOverlap(candidateBox, ob)) return;
      const gx = (ob.min.x + ob.max.x) * 0.5;
      const gz = (ob.min.z + ob.max.z) * 0.5;
      const dist = Math.hypot(cx - gx, cz - gz);
      const top = ob.max.y + CONTACT_PAD;
      if (dist < bestDist) {
        bestDist = dist;
        bestTop = top;
      }
    };

    if (primarySupport) consider(primarySupport);
    for (const g of placed) consider(g);
    supportY = bestTop;
  }

  group.position.y += supportY - footY;
  group.updateMatrixWorld(true);
  const maxBottom = arenaFloorY + H * 1.72;
  const after = barrelBox(group, new THREE.Box3());
  if (after.min.y > maxBottom) {
    group.position.y -= after.min.y - maxBottom;
    group.updateMatrixWorld(true);
  }
  return supportY;
}

/** @param {THREE.Box3} box @param {THREE.Group} other */
function barrelRimTouches(box, other) {
  const ob = barrelBox(other, new THREE.Box3());
  if (!boxXZOverlap(box, ob, 0.04)) return false;
  return Math.abs(box.min.y - (ob.max.y + CONTACT_PAD)) <= REST_EPS + 0.08;
}

/** @param {THREE.Box3} box @param {THREE.Group[]} placed @param {number} arenaFloorY */
function barrelRestsOnSupport(box, placed, arenaFloorY) {
  if (Math.abs(box.min.y - arenaFloorY) <= REST_EPS) return true;
  for (const g of placed) {
    if (barrelRimTouches(box, g)) return true;
    const ob = barrelBox(g);
    if (!boxXZOverlap(box, ob, 0.06)) continue;
    if (box.min.y >= ob.max.y + CONTACT_PAD - 0.1) return true;
  }
  return false;
}

/**
 * @param {THREE.Group} group
 * @param {THREE.Group[]} placed
 * @param {number} arenaFloorY
 * @param {PileRole} role
 */
function validatePhysicsPlacement(group, placed, arenaFloorY, role) {
  const box = barrelBox(group);
  const bottom = box.min.y;
  const onGround = Math.abs(bottom - arenaFloorY) <= REST_EPS;

  let onBarrel = false;
  for (const g of placed) {
    if (barrelRimTouches(box, g)) {
      onBarrel = true;
      break;
    }
  }

  const cx = (box.min.x + box.max.x) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;

  switch (role) {
    case "lean": {
      if (onBarrel) return true;
      if (!onGround) return false;
      for (const g of placed) {
        const horiz = Math.hypot(cx - g.position.x, cz - g.position.z);
        if (horiz <= 2 * R + 0.22) return true;
      }
      return false;
    }
    case "stack":
    case "stackLay":
    case "stackLean":
      return (
        bottom > arenaFloorY + 0.22 && barrelRestsOnSupport(box, placed, arenaFloorY)
      );
    case "lay":
      return onGround || onBarrel;
    default:
      return barrelRestsOnSupport(box, placed, arenaFloorY);
  }
}

/** @param {THREE.Group} group */
function isLayingOnSide(group) {
  return Math.abs(Math.abs(group.rotation.z) - Math.PI / 2) < 0.25;
}

/**
 * @param {THREE.Group[]} placed
 * @param {() => number} rng
 * @param {boolean} [preferUpright]
 */
function pickSupport(placed, rng, preferUpright = false) {
  const pool = preferUpright
    ? placed.filter((g) => !isLayingOnSide(g))
    : placed;
  const list = pool.length ? pool : placed;
  const tall = [...list].sort((a, b) => barrelTopY(b) - barrelTopY(a));
  const k = Math.min(4, tall.length);
  return tall[Math.floor(rng() * k)];
}

/**
 * @param {number} x
 * @param {number} z
 * @param {{ x: number, z: number }} hub
 */
function withinHubRadius(x, z, hub) {
  const dx = x - hub.x;
  const dz = z - hub.z;
  return dx * dx + dz * dz <= PILE_MAX_RADIUS * PILE_MAX_RADIUS;
}

/**
 * @param {PileBarrelSpec} spec
 * @param {{ x: number, z: number }} hub
 * @param {THREE.Group[]} placed
 * @param {() => number} rng
 * @param {number} arenaFloorY
 */
/**
 * @returns {{ def: Record<string, unknown>, support: THREE.Group | null }}
 */
function buildCandidateDef(spec, hub, placed, rng, arenaFloorY) {
  /** @type {Record<string, unknown>} */
  const def = {
    id: spec.id,
    type: "oilBarrel",
    topCap: spec.topCap,
    interiorFire: false,
    note: spec.note,
    y: arenaFloorY,
  };

  if (spec.role === "base") {
    def.x = hub.x + (rng() - 0.5) * 0.08;
    def.z = hub.z + (rng() - 0.5) * 0.08;
    def.rotationY = (rng() - 0.5) * 0.5;
    return { def, support: null };
  }

  const support = pickSupport(
    placed,
    rng,
    spec.role === "lean" ||
      spec.role === "stackLean" ||
      spec.role === "stack" ||
      spec.role === "stackLay"
  );
  const sp = support.position;
  const angle = rng() * Math.PI * 2;

  if (spec.role === "tumble") {
    const dist = TOUCH_UPRIGHT + (rng() - 0.5) * 0.06;
    if (placed.length === 1) {
      const a = rng() * Math.PI * 2;
      def.x = hub.x + Math.sin(a) * dist;
      def.z = hub.z + Math.cos(a) * dist;
    } else {
      def.x = sp.x + Math.sin(angle) * dist;
      def.z = sp.z + Math.cos(angle) * dist;
    }
    def.rotationY = rng() * Math.PI * 2;
    return { def, support };
  }

  if (spec.role === "lay") {
    const dist = TOUCH_LAY + (rng() - 0.5) * 0.05;
    def.x = sp.x + Math.sin(angle) * dist;
    def.z = sp.z + Math.cos(angle) * dist;
    def.layOnSide = true;
    def.rotationY = angle + Math.PI / 2 + (rng() - 0.5) * 0.4;
    return { def, support };
  }

  if (spec.role === "lean") {
    const dist = TOUCH_LEAN + (rng() - 0.5) * 0.03;
    def.x = sp.x + Math.sin(angle) * dist;
    def.z = sp.z + Math.cos(angle) * dist;
    def.rotationY = Math.atan2(sp.x - def.x, sp.z - def.z);
    def.rotationX = 0.1 + rng() * 0.16;
    return { def, support };
  }

  if (spec.role === "stack" || spec.role === "stackLean" || spec.role === "stackLay") {
    def.x = sp.x + (rng() - 0.5) * 0.14;
    def.z = sp.z + (rng() - 0.5) * 0.14;
    def.rotationY = (rng() - 0.5) * 0.85;
    if (spec.role === "stackLay") {
      def.layOnSide = true;
      def.rotationY = angle + Math.PI / 2;
    }
    return { def, support };
  }

  return { def, support };
}

/** @param {PileRole} role */
function isExplicitStackRole(role) {
  return role === "stack" || role === "stackLay" || role === "stackLean";
}

/**
 * @param {Record<string, unknown>} def
 * @param {THREE.Group} group
 */
function syncDefFromGroup(def, group) {
  def.y = barrelBox(group).min.y;
  def.x = group.position.x;
  def.z = group.position.z;
  def.rotationY = group.rotation.y;
  if (Math.abs(group.rotation.x) > 0.02) def.rotationX = group.rotation.x;
  else delete def.rotationX;
  if (Math.abs(group.rotation.z) > 0.02) def.rotationZ = group.rotation.z;
  else delete def.rotationZ;
}

/** @param {number} [placementBudget] 0–1; lower = faster interactive wizard */
function resolvePlacementBudgets(placementBudget = 1) {
  const budget = Math.max(0.05, Math.min(1, placementBudget));
  return {
    tumble: Math.max(24, Math.round(650 * budget)),
    stack: Math.max(40, Math.round(1200 * budget)),
    lean: Math.max(30, Math.round(800 * budget)),
  };
}

function tryPlaceStack(spec, hub, placed, rng, arenaFloorY, root, maxAttempts = 1200) {
  const support = [...placed].sort(
    (a, b) => barrelTopY(b) - barrelTopY(a)
  )[0];
  if (!support) return null;

  for (let n = 0; n < maxAttempts; n++) {
    const angle =
      n < 24 ? (n / 24) * Math.PI * 2 : rng() * Math.PI * 2;
    const rad = n < 24 ? 0.08 + (n % 4) * 0.05 : 0.06 + rng() * 0.2;
    const def = {
      id: spec.id,
      type: "oilBarrel",
      topCap: spec.topCap,
      interiorFire: false,
      note: spec.note,
      y: arenaFloorY,
      x: support.position.x + Math.sin(angle) * rad,
      z: support.position.z + Math.cos(angle) * rad,
      rotationY: (rng() - 0.5) * 0.7,
    };

    const group = spawnPileBarrel(root, def, arenaFloorY);
    snapBarrelToSupportSurface(group, placed, arenaFloorY, support, "stack");
    syncDefFromGroup(def, group);

    if (!validatePhysicsPlacement(group, placed, arenaFloorY, "stack")) {
      group.parent?.remove(group);
      continue;
    }
    if (pileHasOverlap(placed, group, 0.92)) {
      group.parent?.remove(group);
      continue;
    }
    return { def, group };
  }
  return null;
}

function tryPlaceLean(spec, placed, rng, arenaFloorY, root, maxAttempts = 800) {
  const support = pickSupport(placed, rng, true);
  const leanX = 0.1 + rng() * 0.18;

  for (let n = 0; n < maxAttempts; n++) {
    const angle = rng() * Math.PI * 2;
    const dist = TOUCH_LEAN + (rng() - 0.5) * 0.04;
    const def = {
      id: spec.id,
      type: "oilBarrel",
      topCap: spec.topCap,
      interiorFire: false,
      note: spec.note,
      y: arenaFloorY,
      x: support.position.x + Math.sin(angle) * dist,
      z: support.position.z + Math.cos(angle) * dist,
      rotationY: 0,
    };
    def.rotationY = Math.atan2(
      support.position.x - def.x,
      support.position.z - def.z
    );

    const group = spawnPileBarrel(root, def, arenaFloorY);
    snapBarrelToSupportSurface(group, placed, arenaFloorY, null, "tumble");
    group.rotation.x = leanX;
    group.updateMatrixWorld(true);
    snapBarrelToSupportSurface(group, placed, arenaFloorY, support, "lean");
    syncDefFromGroup(def, group);

    if (!validatePhysicsPlacement(group, placed, arenaFloorY, "lean")) {
      group.parent?.remove(group);
      continue;
    }
    if (pileHasOverlap(placed, group)) {
      group.parent?.remove(group);
      continue;
    }
    return { def, group };
  }
  return null;
}

function tryPlaceSpec(spec, hub, placed, rng, arenaFloorY, budgets) {
  const root = placed[0]?.parent ?? new THREE.Group();

  if (spec.role === "stack" || spec.role === "stackLay" || spec.role === "stackLean") {
    return tryPlaceStack(spec, hub, placed, rng, arenaFloorY, root, budgets.stack);
  }
  if (spec.role === "lean") {
    return tryPlaceLean(spec, placed, rng, arenaFloorY, root, budgets.lean);
  }

  const attempts = spec.role === "base" ? 1 : budgets.tumble;

  for (let n = 0; n < attempts; n++) {
    const { def, support } = buildCandidateDef(
      spec,
      hub,
      placed,
      rng,
      arenaFloorY
    );
    if (
      spec.role !== "stack" &&
      spec.role !== "stackLean" &&
      spec.role !== "stackLay" &&
      !withinHubRadius(def.x, def.z, hub)
    ) {
      continue;
    }

    const group = spawnPileBarrel(root, def, arenaFloorY);
    snapBarrelToSupportSurface(
      group,
      placed,
      arenaFloorY,
      isExplicitStackRole(spec.role) ? support : null,
      spec.role
    );
    syncDefFromGroup(def, group);

    if (!validatePhysicsPlacement(group, placed, arenaFloorY, spec.role)) {
      group.parent?.remove(group);
      continue;
    }
    if (pileHasOverlap(placed, group)) {
      group.parent?.remove(group);
      continue;
    }
    return { def, group };
  }
  return null;
}

/**
 * @param {object} [opts]
 * @param {number} [opts.seed]
 * @param {{ x: number, z: number }} [opts.hub]
 * @param {number} [opts.floorY]
 * @param {PileBarrelSpec[]} [opts.specs]
 * @param {number} [opts.placementBudget] 1 = CLI quality; ~0.25 = in-game wizard
 */
export function generateOilBarrelPileLayout(opts = {}) {
  const hub = opts.hub ?? { x: -7.35, z: -2.48 };
  const arenaFloorY = opts.floorY ?? 0;
  const specs = opts.specs ?? DEFAULT_PILE_SPECS;
  const rng = createPileRng(opts.seed ?? 7);
  const budgets = resolvePlacementBudgets(opts.placementBudget ?? 1);

  const root = new THREE.Group();
  const placed = [];
  const props = [];
  const failed = [];

  const stackRoles = new Set(["stack", "stackLay", "stackLean"]);
  const passA = specs.filter((s) => !stackRoles.has(s.role));
  const passB = specs.filter((s) => stackRoles.has(s.role));

  for (const spec of passA) {
    const result = tryPlaceSpec(spec, hub, placed, rng, arenaFloorY, budgets);
    if (!result) {
      failed.push(spec.id);
      continue;
    }
    placed.push(result.group);
    props.push(result.def);
  }

  for (const spec of passB) {
    const result = tryPlaceSpec(spec, hub, placed, rng, arenaFloorY, budgets);
    if (!result) {
      failed.push(spec.id);
      continue;
    }
    placed.push(result.group);
    props.push(result.def);
  }

  for (const g of placed) g.parent?.remove(g);

  return { props, failed };
}

/** @param {{ props: object[], failed: string[] }} layout */
function pileLayoutScore(layout) {
  const maxY = Math.max(0, ...layout.props.map((p) => p.y ?? 0));
  const variety =
    layout.props.filter((p) => p.layOnSide || p.rotationX != null).length;
  return (
    layout.props.length * 10000 + maxY * 800 + variety * 120 - layout.failed.length
  );
}

/** Minimum pile barrels to apply (10-spec layout often places 8–9). */
export const PILE_MIN_PROPS = 8;

/**
 * @param {object[]} defs
 * @param {{ x: number, z: number }} hub
 */
function offsetPileDefsToHub(defs, hub) {
  const dx = hub.x - PILE_HUB_DEFAULT.x;
  const dz = hub.z - PILE_HUB_DEFAULT.z;
  return defs.map((d) => ({
    ...d,
    x: d.x + dx,
    z: d.z + dz,
  }));
}

/** @param {object[]} defs */
function clonePileDefs(defs) {
  return defs.map((d) => ({ ...d }));
}

/**
 * Apply the hand-defined pile (default for level1 wizard + npm run pile:barrels).
 *
 * @param {import("./loadArena.js").ArenaConfig} arena
 * @param {object} [opts]
 */
export function applyDefinedOilBarrelPileToArena(arena, opts = {}) {
  const arenaFloorY = arena.floorY ?? 0;
  const hub = opts.hub ?? PILE_HUB_DEFAULT;
  const defs = offsetPileDefsToHub(
    opts.defs ?? LEVEL1_OIL_BARREL_PILE_DEFS,
    hub
  );
  const kept = (arena.props ?? []).filter((p) => !OIL_BARREL_PILE_ID.test(p.id));
  const props = formatPilePropsForLevel(defs, arenaFloorY);
  arena.props = [...kept, ...props];
  const minProps = opts.minProps ?? PILE_MIN_PROPS;
  const physicsOk = validatePileProps(props, arenaFloorY);
  const ok = physicsOk && props.length >= minProps;
  return {
    props,
    failed: physicsOk ? [] : ["overlap"],
    ok,
    seedUsed: null,
  };
}

/**
 * @param {import("./loadArena.js").ArenaConfig} arena
 * @param {object} [opts]
 */
export function applyOilBarrelPileToArena(arena, opts = {}) {
  if (!opts.procedural) {
    return applyDefinedOilBarrelPileToArena(arena, opts);
  }

  const arenaFloorY = arena.floorY ?? 0;
  const hub = opts.hub ?? PILE_HUB_DEFAULT;
  const baseSeed = opts.seed ?? 7;
  const specs = opts.specs ?? DEFAULT_PILE_SPECS;
  const minProps = opts.minProps ?? PILE_MIN_PROPS;
  const maxSeedAttempts = opts.maxSeedAttempts ?? 24;
  const placementBudget = opts.placementBudget ?? 1;
  const layoutOpts = {
    hub,
    floorY: arenaFloorY,
    specs,
    placementBudget,
  };

  let bestSeed = baseSeed;
  let best = generateOilBarrelPileLayout({ seed: baseSeed, ...layoutOpts });
  for (let attempt = 1; attempt < maxSeedAttempts; attempt++) {
    if (best.props.length >= minProps) break;
    const seed = baseSeed + attempt;
    const layout = generateOilBarrelPileLayout({ seed, ...layoutOpts });
    if (pileLayoutScore(layout) > pileLayoutScore(best)) {
      best = layout;
      bestSeed = seed;
    }
  }

  const kept = (arena.props ?? []).filter((p) => !OIL_BARREL_PILE_ID.test(p.id));
  const props = formatPilePropsForLevel(best.props, arenaFloorY);
  arena.props = [...kept, ...props];
  const physicsOk = validatePileProps(best.props, arenaFloorY);
  const ok = physicsOk && best.props.length >= minProps;
  return { props, failed: best.failed, ok, seedUsed: bestSeed };
}

/**
 * @param {object[]} props
 * @param {number} [arenaFloorY]
 */
export function validatePileProps(props, arenaFloorY = 0) {
  const root = new THREE.Group();
  const barrels = spawnArenaPileBarrelsFromDefs(
    root,
    clonePileDefs(props),
    arenaFloorY
  );
  return !pileHasOverlap(barrels, null, 0.88, arenaFloorY);
}

export const PILE_HUB_DEFAULT = { x: -7.35, z: -2.48 };
export const OIL_BARREL_PILE_SEED_KEY = "fps-oil-barrel-pile-seed";
export const OIL_BARREL_PILE_HUB_X_KEY = "fps-oil-barrel-pile-hub-x";
export const OIL_BARREL_PILE_HUB_Z_KEY = "fps-oil-barrel-pile-hub-z";

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

/**
 * @param {object[]} rawProps
 * @param {number} [arenaFloorY]
 */
export function formatPilePropsForLevel(rawProps, arenaFloorY = 0) {
  void arenaFloorY;
  return rawProps.map((p) => {
    const out = {
      id: p.id,
      type: "oilBarrel",
      x: round4(p.x),
      z: round4(p.z),
      ...(p.rotationY != null ? { rotationY: round4(p.rotationY) } : {}),
      ...(p.rotationX != null ? { rotationX: round4(p.rotationX) } : {}),
      ...(p.rotationZ != null ? { rotationZ: round4(p.rotationZ) } : {}),
      ...(p.layOnSide ? { layOnSide: true } : {}),
      ...(p.pileRole ? { pileRole: p.pileRole } : {}),
      ...(p.topCap === true || p.topCap === false ? { topCap: p.topCap } : {}),
      interiorFire: false,
      ...(p.note ? { note: p.note } : {}),
    };
    return out;
  });
}

/**
 * Spawn pile barrels from level props: XZ/rotation from JSON, height from floor + snap.
 * Order follows {@link PILE_SPAWN_ORDER} — put supports before stacked barrels.
 *
 * @param {THREE.Object3D} root
 * @param {object[]} pileDefs
 * @param {number} arenaFloorY
 */
export function spawnArenaPileBarrelsFromDefs(root, pileDefs, arenaFloorY = 0) {
  const placed = [];
  const meshes = [];

  for (const def of orderPileDefsForSpawn(pileDefs)) {
    const role = inferPileSnapRole(def);
    const group = spawnPileBarrel(root, def, arenaFloorY);
    snapBarrelToSupportSurface(group, placed, arenaFloorY, null, role);
    syncDefFromGroup(def, group);
    placed.push(group);
    meshes.push(group);
  }
  return meshes;
}

export function checkArenaOilBarrelPile(arena) {
  const arenaFloorY = arena.floorY ?? 0;
  const pile = (arena.props ?? []).filter((p) => OIL_BARREL_PILE_ID.test(p.id));
  if (!pile.length) return { ok: true, count: 0 };
  return { ok: validatePileProps(pile, arenaFloorY), count: pile.length };
}

export function loadPileWizardPrefs() {
  if (typeof localStorage === "undefined") {
    return { seed: 7, hub: { ...PILE_HUB_DEFAULT } };
  }
  const seed = parseInt(localStorage.getItem(OIL_BARREL_PILE_SEED_KEY) ?? "7", 10);
  const hx = parseFloat(localStorage.getItem(OIL_BARREL_PILE_HUB_X_KEY) ?? "");
  const hz = parseFloat(localStorage.getItem(OIL_BARREL_PILE_HUB_Z_KEY) ?? "");
  return {
    seed: Number.isFinite(seed) ? seed : 7,
    hub: {
      x: Number.isFinite(hx) ? hx : PILE_HUB_DEFAULT.x,
      z: Number.isFinite(hz) ? hz : PILE_HUB_DEFAULT.z,
    },
  };
}

/** @param {{ seed: number, hub: { x: number, z: number } }} prefs */
export function savePileWizardPrefs(prefs) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(OIL_BARREL_PILE_SEED_KEY, String(prefs.seed));
  localStorage.setItem(OIL_BARREL_PILE_HUB_X_KEY, String(prefs.hub.x));
  localStorage.setItem(OIL_BARREL_PILE_HUB_Z_KEY, String(prefs.hub.z));
}
