import * as THREE from "three";
import {
  createOilBarrel,
  getOilBarrelTuning,
  ensureOilBarrelFlameMeshes,
  ensureOilBarrelInteriorTextures,
} from "./OilBarrel.js";
import {
  barrelShellBox3,
  LAY_ON_SIDE_ROTATION_Z,
  pileHubRotationRad,
  readOilBarrelFireState,
  rebuildOilBarrelMesh,
  resolveBarrelMeshFireOptions,
  resolveLayOnSideRotationZ,
  resolveUprightRotationZ,
} from "./OilBarrelPlacementMeshHelpers.js";
import { syncOilBarrelWorldFireOrientation } from "./OilBarrelWorldFire.js";
import { refreshOilBarrelFireLights } from "./OilBarrelFireLight.js";
import { OIL_BARREL_HEIGHT } from "./OilBarrelDimensions.js";
import {
  OIL_BARREL_PILE_COMPANION_ID,
  OIL_BARREL_PILE_ID,
  LEVEL1_OIL_BARREL_PILE_COMPANION_DEFS,
  LEVEL1_OIL_BARREL_PILE_DEFS,
  PILE_HUB_DEFAULT,
  PILE_HUB_POS_MAX,
  PILE_HUB_POS_MIN,
  PILE_HUB_POS_NUDGE,
  PILE_HUB_POS_STEP,
  PILE_HUB_ROTATION_DEFAULT,
  PILE_HUB_ROTATION_MAX,
  PILE_HUB_ROTATION_MIN,
  PILE_HUB_ROTATION_NUDGE,
  PILE_HUB_ROTATION_STEP,
  formatPileCompanionPropsForLevel,
  formatPilePropsForLevel,
  isOilBarrelPileManagedProp,
  loadPileWizardPrefs,
  savePileWizardPrefs,
} from "./OilBarrelPileLayout.js";

export const OIL_BARREL_PLACEMENT_TUNE_ENABLED_KEY =
  "fps-oil-barrel-placement-tune-enabled";
export const OIL_BARREL_PLACEMENT_TARGET_KEY = "fps-oil-barrel-placement-target";
export const OIL_BARREL_PLACEMENT_SINGLES_KEY = "fps-oil-barrel-placement-singles";
export const OIL_BARREL_PLACEMENT_ADDED_KEY = "fps-oil-barrel-placement-added";
export const OIL_BARREL_PLACEMENT_REMOVED_KEY = "fps-oil-barrel-placement-removed";

export const PILE_HUB_SE_DEFAULT = { x: 13.15, z: -13.15 };

/** @typedef {{ x: number, z: number, rotationY?: number, rotationX?: number, rotationZ?: number, layOnSide?: boolean, y?: number, yOverride?: boolean, topCap?: boolean, interiorFire?: boolean }} BarrelPlacement */
/** @typedef {{ x: number, z: number, rotationY: number }} PileHubPlacement */
/** @typedef {{ groupKey: "containerPile" | "sePile" | null, label?: string }} AddedBarrelEntry */
/**
 * @typedef {{
 *   target: string,
 *   hubs: { containerPile: PileHubPlacement, sePile: PileHubPlacement },
 *   singles: Record<string, BarrelPlacement>,
 *   addedBarrels: Record<string, AddedBarrelEntry>,
 *   removedIds: string[],
 *   stackSnapRequest?: string,
 *   hubApplyRequest?: "containerPile" | "sePile",
 *   singleApplyRequest?: string,
 *   fireApplyRequest?: string,
 *   addedApplyRequest?: string,
 *   removedApplyRequest?: string,
 * }} OilBarrelPlacementState
 */

export const BARREL_PLACEMENT_POS_LIMITS = {
  min: PILE_HUB_POS_MIN,
  max: PILE_HUB_POS_MAX,
  step: PILE_HUB_POS_STEP,
  nudge: PILE_HUB_POS_NUDGE,
};

export const BARREL_PLACEMENT_ROT_LIMITS = {
  min: PILE_HUB_ROTATION_MIN,
  max: PILE_HUB_ROTATION_MAX,
  step: PILE_HUB_ROTATION_STEP,
  nudge: PILE_HUB_ROTATION_NUDGE,
};

/** @param {number} [floorY=0] */
export function barrelPlacementYLimits(floorY = 0) {
  return {
    min: floorY - 0.05,
    max: floorY + OIL_BARREL_HEIGHT * 2.5,
    step: 0.01,
    nudge: 0.05,
  };
}

export const BARREL_PLACEMENT_GROUPS = {
  containerPile: {
    id: "containerPile",
    label: "Container pile (group)",
    hubDefault: PILE_HUB_DEFAULT,
  },
  sePile: {
    id: "sePile",
    label: "SE corner pile (group)",
    hubDefault: PILE_HUB_SE_DEFAULT,
  },
};

const PILE_PIVOT_NAMES = {
  containerPile: "oil_barrel_tune_pivot_container",
  sePile: "oil_barrel_tune_pivot_se",
};

const _worldPos = new THREE.Vector3();
const _worldQuat = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, "XYZ");
const _footBox = new THREE.Box3();
const _stackBox = new THREE.Box3();
/** Rim gap when stacking in the editor (matches pile snap). */
const STACK_CONTACT_PAD = 0.006;
/** XZ inset when testing whether a footprint point sits over a support. */
const STACK_FOOTPRINT_PAD = 0.04;
/** After snap, foot must be this close to a support rim or we drop to floor. */
const STACK_RIM_EPS = 0.1;

/** @param {number} x @param {number} z @param {THREE.Box3} box @param {number} [pad=STACK_FOOTPRINT_PAD] */
function pointXZInsideBox(x, z, box, pad = STACK_FOOTPRINT_PAD) {
  return (
    x >= box.min.x - pad &&
    x <= box.max.x + pad &&
    z >= box.min.z - pad &&
    z <= box.max.z + pad
  );
}

/**
 * XZ samples where a barrel can rest (centre + quarter points on the long axis for lay-on-side).
 * @param {THREE.Box3} candidateBox
 * @param {(x: number, z: number) => void} fn
 */
function eachBarrelFootprintSampleXZ(candidateBox, fn) {
  const cx = (candidateBox.min.x + candidateBox.max.x) * 0.5;
  const cz = (candidateBox.min.z + candidateBox.max.z) * 0.5;
  fn(cx, cz);
  const sx = candidateBox.max.x - candidateBox.min.x;
  const sz = candidateBox.max.z - candidateBox.min.z;
  if (sx >= sz) {
    fn(candidateBox.min.x + sx * 0.25, cz);
    fn(candidateBox.min.x + sx * 0.75, cz);
  } else {
    fn(cx, candidateBox.min.z + sz * 0.25);
    fn(cx, candidateBox.min.z + sz * 0.75);
  }
}

/** @param {THREE.Box3} candidateBox @param {THREE.Box3} supportBox */
function candidateFootprintOverSupport(candidateBox, supportBox) {
  let hit = false;
  eachBarrelFootprintSampleXZ(candidateBox, (x, z) => {
    if (hit) return;
    if (pointXZInsideBox(x, z, supportBox)) hit = true;
  });
  return hit;
}

/** @param {THREE.Object3D} root @param {string | null} [excludeId] @returns {THREE.Group[]} */
function collectBarrelGroups(root, excludeId = null) {
  /** @type {THREE.Group[]} */
  const groups = [];
  root.traverse((obj) => {
    if (obj.name !== "oil_barrel" || !obj.isGroup) return;
    const id = obj.userData.oilBarrelPropId ?? obj.userData.pileId;
    if (excludeId && id === excludeId) return;
    groups.push(obj);
  });
  return groups;
}

/**
 * Drop the barrel onto the floor or the highest rim under its XZ footprint.
 * @param {THREE.Group} barrel
 * @param {THREE.Group[]} others
 * @param {number} floorY
 */
function snapBarrelToStackSupport(barrel, others, floorY) {
  barrel.updateMatrixWorld(true);
  barrelShellBox3(barrel, _footBox);
  let supportY = floorY;
  for (const other of others) {
    if (other === barrel) continue;
    other.updateMatrixWorld(true);
    barrelShellBox3(other, _stackBox);
    if (!candidateFootprintOverSupport(_footBox, _stackBox)) continue;
    supportY = Math.max(supportY, _stackBox.max.y + STACK_CONTACT_PAD);
  }
  snapBarrelFootToWorldY(barrel, supportY);
  barrel.updateMatrixWorld(true);
  barrelShellBox3(barrel, _footBox);

  if (supportY > floorY + 0.02) {
    let rimContact = false;
    for (const other of others) {
      if (other === barrel) continue;
      barrelShellBox3(other, _stackBox);
      if (!candidateFootprintOverSupport(_footBox, _stackBox)) continue;
      const expectedFoot = _stackBox.max.y + STACK_CONTACT_PAD;
      if (Math.abs(_footBox.min.y - expectedFoot) <= STACK_RIM_EPS) {
        rimContact = true;
        break;
      }
    }
    if (!rimContact) {
      snapBarrelFootToWorldY(barrel, floorY);
    }
  }

  barrel.updateMatrixWorld(true);
  barrelShellBox3(barrel, _footBox);
  const maxBottom = floorY + OIL_BARREL_HEIGHT * 1.72;
  if (_footBox.min.y > maxBottom) {
    snapBarrelFootToWorldY(barrel, maxBottom);
  }
}

/** @param {BarrelPlacement} p @param {number} floorY */
function exportStackFields(p, floorY) {
  /** @type {Record<string, number | string>} */
  const out = {};
  if (typeof p.y === "number" && (p.yOverride || p.y > floorY + 0.22)) {
    out.y = +p.y.toFixed(4);
  }
  if (p.y != null && p.y > floorY + 0.22) {
    out.pileRole = "stack";
  }
  return out;
}

/** @param {THREE.Object3D | null | undefined} parent */
function isPilePivotParent(parent) {
  return (
    !!parent &&
    (parent.name === PILE_PIVOT_NAMES.containerPile ||
      parent.name === PILE_PIVOT_NAMES.sePile)
  );
}

/** @param {THREE.Euler} euler */
function barrelPlacementRotationFromEuler(euler) {
  const layOnSide = Math.abs(euler.z) > 1.4;
  if (layOnSide) {
    return {
      layOnSide: true,
      rotationY: euler.y,
      rotationZ: euler.z,
    };
  }
  return {
    rotationX: euler.x,
    rotationY: euler.y,
    rotationZ: euler.z,
  };
}

/** @param {THREE.Group} barrel @returns {number} World Y of the barrel footprint (bbox min). */
function readBarrelFootWorldY(barrel) {
  return barrelShellBox3(barrel, _footBox).min.y;
}

/** @param {THREE.Group} barrel @param {number} footY */
function snapBarrelFootToWorldY(barrel, footY) {
  barrel.updateMatrixWorld(true);
  barrelShellBox3(barrel, _footBox);
  const delta = footY - _footBox.min.y;
  if (Math.abs(delta) < 1e-5) return;
  barrel.getWorldPosition(_worldPos);
  _worldPos.y += delta;
  const parent = barrel.parent;
  if (parent) {
    parent.worldToLocal(_worldPos);
    barrel.position.copy(_worldPos);
  } else {
    barrel.position.y = _worldPos.y;
  }
}

/** Loose + service barrels tunable individually (not pile-group managed). */
export const LEVEL1_LOOSE_BARREL_OPTIONS = [
  { id: "oil_barrel_cargo_front_corner", label: "Cargo module barrel" },
  { id: "oil_barrel_service_nw", label: "Service room NW" },
  { id: "oil_barrel_service_ne", label: "Service room NE" },
  { id: "oil_barrel_service_sw", label: "Service room SW" },
  { id: "oil_barrel_service_se", label: "Service room SE" },
];

function buildSePileCanonicalDefs() {
  const mainHub = PILE_HUB_DEFAULT;
  const seHub = PILE_HUB_SE_DEFAULT;
  const defs = [
    ...LEVEL1_OIL_BARREL_PILE_DEFS,
    ...LEVEL1_OIL_BARREL_PILE_COMPANION_DEFS,
  ];
  return defs.map((d) => {
    const lx = d.x - mainHub.x;
    const lz = d.z - mainHub.z;
    const next = {
      ...d,
      id: d.id.replace(/^oil_barrel_/, "oil_barrel_se_"),
      x: seHub.x - lx,
      z: seHub.z - lz,
    };
    if (d.rotationY != null) {
      next.rotationY = d.rotationY + Math.PI;
    }
    return next;
  });
}

/** Every pile barrel id for single-item mode. */
export const LEVEL1_PILE_BARREL_OPTIONS = [
  ...LEVEL1_OIL_BARREL_PILE_DEFS.map((d) => ({
    id: d.id,
    label: d.id.replace(/^oil_barrel_/, ""),
  })),
  ...LEVEL1_OIL_BARREL_PILE_COMPANION_DEFS.map((d) => ({
    id: d.id,
    label: d.id.replace(/^oil_barrel_/, ""),
  })),
  ...buildSePileCanonicalDefs().map((d) => ({
    id: d.id,
    label: d.id.replace(/^oil_barrel_se_/, "se "),
  })),
];

const _canonicalPileBarrelIds = new Set(
  LEVEL1_PILE_BARREL_OPTIONS.map((o) => o.id),
);

/** @param {string} propId */
function isCanonicalPileBarrelId(propId) {
  return _canonicalPileBarrelIds.has(propId);
}

/**
 * @typedef {{
 *   stackSnap?: boolean,
 *   stackSnapId?: string | null,
 *   applyHubGroup?: "containerPile" | "sePile" | null,
 *   applySingleIds?: string[],
 *   fireSyncIds?: string[],
 *   applyAddedId?: string | null,
 *   applyRemovedId?: string | null,
 * }} OilBarrelPlacementApplyOptions
 * Auto-stack in XZ is editor-only and only for the barrel that moved in X/Z.
 */
function containerPileCanonicalDefs() {
  return [
    ...LEVEL1_OIL_BARREL_PILE_DEFS,
    ...LEVEL1_OIL_BARREL_PILE_COMPANION_DEFS,
  ];
}

function sePileCanonicalDefs() {
  return buildSePileCanonicalDefs();
}

function canonicalDefsForGroup(groupKey) {
  return groupKey === "sePile"
    ? sePileCanonicalDefs()
    : containerPileCanonicalDefs();
}

/** @param {"containerPile" | "sePile"} groupKey @param {OilBarrelPlacementState | null | undefined} [state] @returns {string[]} */
export function getGroupMemberIds(groupKey, state = null) {
  const removed = new Set(state?.removedIds ?? []);
  const base = canonicalDefsForGroup(groupKey)
    .map((d) => d.id)
    .filter((id) => !removed.has(id));
  if (!state?.addedBarrels) return base;
  const added = Object.entries(state.addedBarrels)
    .filter(([, entry]) => entry.groupKey === groupKey)
    .map(([id]) => id);
  return [...base, ...added];
}

/** @param {OilBarrelPlacementState} state @returns {{ id: string, label: string }[]} */
export function getAddedBarrelOptions(state) {
  return Object.entries(state.addedBarrels ?? {}).map(([id, entry]) => ({
    id,
    label: entry.label ?? id.replace(/^oil_barrel_/, ""),
  }));
}

/** @param {string} propId @param {OilBarrelPlacementState | null | undefined} [state] @returns {"containerPile" | "sePile" | null} */
export function resolveBarrelGroupForPropId(propId, state = null) {
  const addedGroup = state?.addedBarrels?.[propId]?.groupKey;
  if (addedGroup) return addedGroup;
  if (propId.includes("_se_") && isOilBarrelPileManagedProp({ id: propId })) {
    return "sePile";
  }
  if (isOilBarrelPileManagedProp({ id: propId }) && !propId.includes("_se_")) {
    return "containerPile";
  }
  return null;
}

/** @param {OilBarrelPlacementState} state @returns {"containerPile" | "sePile" | null} */
export function resolveAddBarrelGroupKey(state) {
  if (isBarrelPlacementGroupTarget(state.target)) return state.target;
  return resolveBarrelGroupForPropId(state.target, state);
}

/**
 * Spawn a new tunable barrel and track it in placement state.
 * @param {OilBarrelPlacementState} state
 * @param {THREE.Object3D} root
 * @param {number} [floorY=0]
 * @returns {OilBarrelPlacementState}
 */
export function addBarrelToPlacement(state, root, floorY = 0) {
  void root;
  void floorY;
  const id = nextAddedBarrelId(state);
  const groupKey = resolveAddBarrelGroupKey(state);
  const hub = groupKey ? state.hubs[groupKey] : null;
  const base =
    !groupKey && !isBarrelPlacementGroupTarget(state.target)
      ? getBarrelPlacementForTarget(root, state, state.target)
      : null;
  const addedInGroup = Object.values(state.addedBarrels ?? {}).filter(
    (e) => e.groupKey === groupKey,
  ).length;
  const placement = {
    x: base?.x ?? hub?.x ?? 0,
    z: (base?.z ?? hub?.z ?? 0) + addedInGroup * 0.55,
    rotationY: base?.rotationY ?? 0,
    rotationX: base?.rotationX ?? 0,
    rotationZ: base?.rotationZ ?? 0,
  };

  return {
    ...state,
    target: id,
    addedBarrels: {
      ...state.addedBarrels,
      [id]: {
        groupKey,
        label: id.replace(/^oil_barrel_/, ""),
      },
    },
    singles: {
      ...state.singles,
      [id]: placement,
    },
    stackSnapRequest: id,
    addedApplyRequest: id,
    singleApplyRequest: id,
  };
}

/**
 * Remove a barrel from the scene and mark it removed (or drop from added list).
 * @param {OilBarrelPlacementState} state
 * @param {THREE.Object3D} root
 * @param {string} propId
 * @returns {OilBarrelPlacementState}
 */
export function removeBarrelFromPlacement(state, root, propId) {
  if (isBarrelPlacementGroupTarget(propId)) return state;

  const barrel = findBarrelGroupById(root, propId);
  if (barrel) disposeOilBarrelGroup(barrel);

  const isAdded = Boolean(state.addedBarrels?.[propId]);
  /** @type {Record<string, BarrelPlacement>} */
  const singles = { ...state.singles };
  delete singles[propId];

  /** @type {Record<string, AddedBarrelEntry>} */
  const addedBarrels = { ...state.addedBarrels };
  if (isAdded) {
    delete addedBarrels[propId];
  }

  const removedIds = isAdded
    ? [...(state.removedIds ?? [])]
    : [...new Set([...(state.removedIds ?? []), propId])];

  let target = state.target;
  if (target === propId) {
    const group = resolveBarrelGroupForPropId(propId, state);
    target = group ?? "containerPile";
  }

  return {
    ...state,
    target,
    singles,
    addedBarrels,
    removedIds,
    removedApplyRequest: propId,
  };
}

/** @returns {boolean} */
export function canRemoveBarrelTarget(state) {
  return !isBarrelPlacementGroupTarget(state.target);
}

function nextAddedBarrelId(state) {
  let n = 1;
  while (state.addedBarrels?.[`oil_barrel_added_${n}`]) {
    n += 1;
  }
  return `oil_barrel_added_${n}`;
}

/** @param {THREE.Group | null} barrel */
export function disposeOilBarrelGroup(barrel) {
  if (!barrel) return;
  barrel.parent?.remove(barrel);
  barrel.traverse((obj) => {
    obj.geometry?.dispose();
    if (Array.isArray(obj.material)) {
      for (const m of obj.material) m.dispose();
    } else {
      obj.material?.dispose();
    }
  });
}

function defaultHubs() {
  const prefs = loadPileWizardPrefs();
  let seX = PILE_HUB_SE_DEFAULT.x;
  let seZ = PILE_HUB_SE_DEFAULT.z;
  let seRot = PILE_HUB_ROTATION_DEFAULT;
  if (typeof localStorage !== "undefined") {
    const hx = parseFloat(localStorage.getItem("fps-oil-barrel-se-pile-hub-x") ?? "");
    const hz = parseFloat(localStorage.getItem("fps-oil-barrel-se-pile-hub-z") ?? "");
    const hr = parseFloat(
      localStorage.getItem("fps-oil-barrel-se-pile-hub-rotation") ?? "",
    );
    if (Number.isFinite(hx)) seX = hx;
    if (Number.isFinite(hz)) seZ = hz;
    if (Number.isFinite(hr)) seRot = hr;
  }
  return {
    containerPile: {
      x: prefs.hub.x,
      z: prefs.hub.z,
      rotationY: prefs.hub.rotationY ?? PILE_HUB_ROTATION_DEFAULT,
    },
    sePile: { x: seX, z: seZ, rotationY: seRot },
  };
}

/** @returns {OilBarrelPlacementState} */
export function loadOilBarrelPlacementState() {
  const hubs = defaultHubs();
  /** @type {Record<string, BarrelPlacement>} */
  let singles = {};
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(OIL_BARREL_PLACEMENT_SINGLES_KEY);
      if (raw) singles = JSON.parse(raw);
    } catch {
      singles = {};
    }
  }
  const target =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(OIL_BARREL_PLACEMENT_TARGET_KEY) ?? "containerPile"
      : "containerPile";
  /** @type {Record<string, AddedBarrelEntry>} */
  let addedBarrels = {};
  /** @type {string[]} */
  let removedIds = [];
  if (typeof localStorage !== "undefined") {
    try {
      const rawAdded = localStorage.getItem(OIL_BARREL_PLACEMENT_ADDED_KEY);
      if (rawAdded) addedBarrels = JSON.parse(rawAdded);
    } catch {
      addedBarrels = {};
    }
    try {
      const rawRemoved = localStorage.getItem(OIL_BARREL_PLACEMENT_REMOVED_KEY);
      if (rawRemoved) removedIds = JSON.parse(rawRemoved);
    } catch {
      removedIds = [];
    }
  }
  return { target, hubs, singles, addedBarrels, removedIds };
}

/** @param {OilBarrelPlacementState} state @returns {OilBarrelPlacementApplyOptions} */
export function placementApplyOptionsFromState(state) {
  return {
    stackSnap: Boolean(state.stackSnapRequest),
    stackSnapId: state.stackSnapRequest ?? null,
    applyHubGroup: state.hubApplyRequest ?? null,
    applySingleIds: state.singleApplyRequest ? [state.singleApplyRequest] : [],
    fireSyncIds: state.fireApplyRequest ? [state.fireApplyRequest] : [],
    applyAddedId: state.addedApplyRequest ?? null,
    applyRemovedId: state.removedApplyRequest ?? null,
  };
}

/** @param {OilBarrelPlacementState} state @returns {OilBarrelPlacementState} */
export function clearPlacementApplyRequests(state) {
  const {
    stackSnapRequest: _a,
    hubApplyRequest: _b,
    singleApplyRequest: _c,
    fireApplyRequest: _d,
    addedApplyRequest: _e,
    removedApplyRequest: _f,
    ...rest
  } = state;
  return rest;
}

/** @param {OilBarrelPlacementState} state */
export function saveOilBarrelPlacementState(state) {
  if (typeof localStorage === "undefined") return;
  const persisted = clearPlacementApplyRequests(state);
  localStorage.setItem(OIL_BARREL_PLACEMENT_TARGET_KEY, persisted.target);
  localStorage.setItem(
    OIL_BARREL_PLACEMENT_SINGLES_KEY,
    JSON.stringify(persisted.singles),
  );
  localStorage.setItem(
    OIL_BARREL_PLACEMENT_ADDED_KEY,
    JSON.stringify(persisted.addedBarrels ?? {}),
  );
  localStorage.setItem(
    OIL_BARREL_PLACEMENT_REMOVED_KEY,
    JSON.stringify(persisted.removedIds ?? []),
  );
  savePileWizardPrefs({
    seed: loadPileWizardPrefs().seed,
    hub: {
      x: persisted.hubs.containerPile.x,
      z: persisted.hubs.containerPile.z,
      rotationY: persisted.hubs.containerPile.rotationY,
    },
  });
  localStorage.setItem(
    "fps-oil-barrel-se-pile-hub-x",
    String(persisted.hubs.sePile.x),
  );
  localStorage.setItem(
    "fps-oil-barrel-se-pile-hub-z",
    String(persisted.hubs.sePile.z),
  );
  localStorage.setItem(
    "fps-oil-barrel-se-pile-hub-rotation",
    String(persisted.hubs.sePile.rotationY),
  );
}

/** @returns {boolean} */
export function loadOilBarrelPlacementTuneEnabled() {
  if (typeof localStorage === "undefined") return false;
  return (
    localStorage.getItem(OIL_BARREL_PLACEMENT_TUNE_ENABLED_KEY) === "true"
  );
}

/** @param {boolean} enabled */
export function saveOilBarrelPlacementTuneEnabled(enabled) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(OIL_BARREL_PLACEMENT_TUNE_ENABLED_KEY, String(enabled));
}

/** @param {THREE.Object3D} root @param {string} propId @returns {THREE.Group | null} */
function findBarrelGroupById(root, propId) {
  let found = null;
  root.traverse((obj) => {
    if (found || obj.name !== "oil_barrel" || !obj.isGroup) return;
    const id = obj.userData.oilBarrelPropId ?? obj.userData.pileId;
    if (id === propId) found = obj;
  });
  return found;
}

/** Loose pile companions spawn without pileId — match authored XZ once, then stamp. */
const _COMPANION_MATCH_EPS = 1.25;

/** @param {THREE.Object3D} root @param {{ x: number, z: number }} def @param {Set<THREE.Group>} claimed */
function findBarrelNearAuthoredPosition(root, def, claimed) {
  let best = null;
  let bestDist = _COMPANION_MATCH_EPS;
  root.traverse((obj) => {
    if (!obj.isGroup || obj.name !== "oil_barrel") return;
    if (claimed.has(obj)) return;
    const existingId = obj.userData.oilBarrelPropId ?? obj.userData.pileId;
    if (existingId) return;
    obj.getWorldPosition(_worldPos);
    const dist = Math.hypot(_worldPos.x - def.x, _worldPos.z - def.z);
    if (dist < bestDist) {
      bestDist = dist;
      best = obj;
    }
  });
  return best;
}

/** @param {THREE.Object3D} root @param {OilBarrelPlacementState} state */
function stampMissingPileMemberIds(root, state) {
  const claimed = new Set();
  for (const groupKey of /** @type {const} */ (["containerPile", "sePile"])) {
    for (const id of getGroupMemberIds(groupKey, state)) {
      if (findBarrelGroupById(root, id)) continue;
      const def = canonicalDefsForGroup(groupKey).find((d) => d.id === id);
      if (!def || typeof def.x !== "number" || typeof def.z !== "number") continue;
      const barrel = findBarrelNearAuthoredPosition(root, def, claimed);
      if (!barrel) continue;
      barrel.userData.pileId = id;
      claimed.add(barrel);
    }
  }
}

/** @param {THREE.Object3D} root @param {"containerPile" | "sePile"} groupKey */
function findPilePivot(root, groupKey) {
  return root.getObjectByName(PILE_PIVOT_NAMES[groupKey]) ?? null;
}

/** @param {THREE.Object3D} root */
export function detachAllPileHubPivots(root) {
  if (!root) return;
  for (const groupKey of /** @type {const} */ (["containerPile", "sePile"])) {
    const pivot = findPilePivot(root, groupKey);
    if (!pivot) continue;
    for (const child of [...pivot.children]) {
      if (child.name !== "oil_barrel" || !child.isGroup) continue;
      root.attach(child);
    }
    delete pivot.userData.pileGroupMounted;
    pivot.parent?.remove(pivot);
  }
}

/** @param {THREE.Object3D} root @param {"containerPile" | "sePile"} groupKey @returns {PileHubPlacement | null} */
function readPileHubFromScene(root, groupKey) {
  const anchorIds =
    groupKey === "sePile"
      ? ["oil_barrel_se_pile_08", "oil_barrel_se_textured"]
      : ["oil_barrel_pile_stop_begin"];
  for (const id of anchorIds) {
    const barrel = findBarrelGroupById(root, id);
    if (!barrel) continue;
    barrel.getWorldPosition(_worldPos);
    return { x: _worldPos.x, z: _worldPos.z, rotationY: 0 };
  }
  return null;
}

/**
 * Enter editor: barrels stay at level JSON spawn; hub sliders match the scene;
 * drop stale localStorage overrides until the user edits something.
 * @param {THREE.Object3D} root
 * @param {OilBarrelPlacementState} state
 * @returns {OilBarrelPlacementState}
 */
export function enterBarrelPlacementEditor(root, state) {
  detachAllPileHubPivots(root);
  stampMissingPileMemberIds(root, state);
  const container = readPileHubFromScene(root, "containerPile");
  const se = readPileHubFromScene(root, "sePile");
  const nextState = clearPlacementApplyRequests({
    ...state,
    hubs: {
      containerPile: container
        ? { ...state.hubs.containerPile, x: container.x, z: container.z }
        : state.hubs.containerPile,
      sePile: se
        ? { ...state.hubs.sePile, x: se.x, z: se.z }
        : state.hubs.sePile,
    },
    singles: {},
    addedBarrels: {},
    removedIds: [],
  });
  if (container) {
    mountPileGroupOnPivot(
      root,
      "containerPile",
      nextState.hubs.containerPile,
      nextState,
    );
  }
  if (se) {
    mountPileGroupOnPivot(root, "sePile", nextState.hubs.sePile, nextState);
  }
  return nextState;
}

/** @param {THREE.Object3D} root @param {"containerPile" | "sePile"} groupKey */
function ensurePilePivot(root, groupKey) {
  const existing = findPilePivot(root, groupKey);
  if (existing) return existing;
  const pivot = new THREE.Group();
  pivot.name = PILE_PIVOT_NAMES[groupKey];
  root.add(pivot);
  return pivot;
}

/** @param {PileHubPlacement} hub @param {THREE.Group} pivot */
function setPilePivotHubPose(hub, pivot) {
  pivot.position.set(hub.x, 0, hub.z);
  pivot.rotation.set(0, pileHubRotationRad(hub.rotationY), 0);
}

/**
 * Parent pile barrels under a hub pivot once; local transforms stay fixed after that.
 * @param {THREE.Object3D} root
 * @param {"containerPile" | "sePile"} groupKey
 * @param {PileHubPlacement} hub
 */
function mountPileGroupOnPivot(root, groupKey, hub, state) {
  stampMissingPileMemberIds(root, state);
  const pivot = ensurePilePivot(root, groupKey);
  if (pivot.userData.pileGroupMounted === groupKey) {
    for (const id of getGroupMemberIds(groupKey, state)) {
      const barrel = findBarrelGroupById(root, id);
      if (!barrel || barrel.parent === pivot) continue;
      pivot.attach(barrel);
    }
    return pivot;
  }

  setPilePivotHubPose(hub, pivot);
  pivot.updateMatrixWorld(true);

  for (const id of getGroupMemberIds(groupKey, state)) {
    const barrel = findBarrelGroupById(root, id);
    if (!barrel || barrel.parent === pivot) continue;
    pivot.attach(barrel);
  }

  pivot.userData.pileGroupMounted = groupKey;
  return pivot;
}

/**
 * Move/rotate the whole pile as one rigid unit via the hub pivot.
 * @param {THREE.Object3D} root
 * @param {"containerPile" | "sePile"} groupKey
 * @param {PileHubPlacement} hub
 * @param {OilBarrelPlacementState} state
 */
function applyPileGroupHub(root, groupKey, hub, state) {
  const pivot = mountPileGroupOnPivot(root, groupKey, hub, state);
  setPilePivotHubPose(hub, pivot);
}

/** @param {THREE.Group} barrel @returns {BarrelPlacement} */
export function readBarrelWorldPlacement(barrel) {
  barrel.getWorldPosition(_worldPos);
  if (isPilePivotParent(barrel.parent)) {
    _euler.setFromQuaternion(barrel.quaternion, "XYZ");
  } else {
    barrel.getWorldQuaternion(_worldQuat);
    _euler.setFromQuaternion(_worldQuat, "XYZ");
  }
  return {
    x: _worldPos.x,
    y: _worldPos.y,
    z: _worldPos.z,
    ...barrelPlacementRotationFromEuler(_euler),
    ...readOilBarrelFireState(barrel),
  };
}

export { LAY_ON_SIDE_ROTATION_Z };

/** @param {Pick<BarrelPlacement, "layOnSide" | "rotationZ">} placement */
export function layOnSideTiltZ(placement) {
  if (placement.layOnSide !== true) return placement.rotationZ ?? 0;
  return resolveLayOnSideRotationZ(placement.rotationZ);
}

/** @param {THREE.Group} barrel @param {BarrelPlacement} placement @param {THREE.Group[] | null} stackOthers @param {number} [floorY=0] @param {boolean} [yOverride=false] @param {number} [footYOverride=0] @param {number | null} [preserveFootY=null] */
function applyBarrelRotation(
  barrel,
  placement,
  stackOthers,
  floorY = 0,
  yOverride = false,
  footYOverride = 0,
  preserveFootY = null,
) {
  if (placement.layOnSide === true) {
    barrel.rotation.set(
      0,
      placement.rotationY ?? 0,
      layOnSideTiltZ(placement),
    );
  } else {
    barrel.rotation.set(
      placement.rotationX ?? 0,
      placement.rotationY ?? 0,
      resolveUprightRotationZ(placement.rotationZ),
    );
  }
  barrel.updateMatrixWorld(true);
  if (stackOthers !== null) {
    snapBarrelToStackSupport(barrel, stackOthers, floorY);
  } else if (yOverride) {
    snapBarrelFootToWorldY(barrel, footYOverride);
  } else if (preserveFootY != null) {
    snapBarrelFootToWorldY(barrel, preserveFootY);
  }
  syncOilBarrelWorldFireOrientation(barrel);
}

/** @param {THREE.Group} barrel @param {BarrelPlacement} placement @param {number} [floorY=0] @param {THREE.Object3D} [root] @param {string | null} [propId] @param {boolean} [stackSnap=false] @param {string | null} [stackSnapId=null] */
function applyWorldBarrelPlacement(
  barrel,
  placement,
  floorY = 0,
  root = null,
  propId = null,
  stackSnap = false,
  stackSnapId = null,
) {
  const pivot = isPilePivotParent(barrel.parent) ? barrel.parent : null;
  const yOverride =
    placement.yOverride === true && typeof placement.y === "number";
  const stackOthers =
    stackSnap && stackSnapId === propId && !yOverride && root && propId
      ? collectBarrelGroups(root, propId)
      : null;

  barrel.updateMatrixWorld(true);
  barrelShellBox3(barrel, _footBox);
  const preserveFootY = _footBox.min.y;

  if (pivot) {
    barrel.getWorldPosition(_worldPos);
    _worldPos.x = placement.x;
    _worldPos.z = placement.z;
    pivot.updateMatrixWorld(true);
    pivot.worldToLocal(_worldPos);
    barrel.position.copy(_worldPos);
    applyBarrelRotation(
      barrel,
      placement,
      stackOthers,
      floorY,
      yOverride,
      placement.y ?? floorY,
      preserveFootY,
    );
    return;
  }

  barrel.position.set(placement.x, barrel.position.y, placement.z);
  applyBarrelRotation(
    barrel,
    placement,
    stackOthers,
    floorY,
    yOverride,
    placement.y ?? floorY,
    preserveFootY,
  );
}

/**
 * @param {THREE.Object3D} root
 * @param {OilBarrelPlacementState} state
 * @returns {Record<string, BarrelPlacement>}
 */
export function resolveOilBarrelPlacements(root, state) {
  /** @type {Record<string, BarrelPlacement>} */
  const out = {};
  for (const groupKey of /** @type {const} */ (["containerPile", "sePile"])) {
    for (const id of getGroupMemberIds(groupKey, state)) {
      const barrel = findBarrelGroupById(root, id);
      if (barrel) {
        out[id] = readBarrelWorldPlacement(barrel);
        out[id].y = readBarrelFootWorldY(barrel);
      }
    }
  }
  for (const id of LEVEL1_LOOSE_BARREL_OPTIONS.map((o) => o.id)) {
    const barrel = findBarrelGroupById(root, id);
    if (barrel) {
      out[id] = readBarrelWorldPlacement(barrel);
      out[id].y = readBarrelFootWorldY(barrel);
    }
  }
  for (const [id, placement] of Object.entries(state.singles)) {
    const { yOverride, y, ...rest } = placement;
    out[id] = { ...out[id], ...rest };
    if (yOverride && typeof y === "number") {
      out[id].y = y;
    } else {
      const barrel = findBarrelGroupById(root, id);
      if (barrel) out[id].y = readBarrelFootWorldY(barrel);
    }
  }
  return out;
}

/** @param {string} target */
export function isBarrelPlacementGroupTarget(target) {
  return target === "containerPile" || target === "sePile";
}

/** @param {THREE.Object3D} root @param {OilBarrelPlacementState} state @param {string} propId */
export function getBarrelPlacementForTarget(root, state, propId) {
  const barrel = findBarrelGroupById(root, propId);
  const scenePlacement = barrel
    ? {
        ...readBarrelWorldPlacement(barrel),
        y: readBarrelFootWorldY(barrel),
      }
    : null;
  const override = state.singles[propId];
  if (!override) return scenePlacement;
  const { yOverride, y, ...rest } = override;
  const merged = { ...(scenePlacement ?? {}), ...rest };
  if (yOverride && typeof y === "number") {
    merged.y = y;
    merged.yOverride = true;
  } else if (barrel) {
    merged.y = readBarrelFootWorldY(barrel);
  }
  return merged;
}

/**
 * Merge a single-barrel slider/checkbox patch into placement state.
 * X/Z changes re-run auto-stack; Y sets an explicit foot-height override.
 * @param {OilBarrelPlacementState} state
 * @param {THREE.Object3D | null | undefined} root
 * @param {string} target
 * @param {number} [floorY=0]
 * @param {Partial<BarrelPlacement>} partial
 */
export function patchOilBarrelSingle(state, root, target, floorY, partial) {
  const prev = state.singles[target];
  const base = root
    ? getBarrelPlacementForTarget(root, state, target)
    : { x: 0, z: 0, rotationY: 0, y: floorY };
  /** @type {BarrelPlacement} */
  const entry = { ...(prev ?? {}), ...base, ...partial };

  if (("x" in partial || "z" in partial) && !("y" in partial)) {
    delete entry.yOverride;
    delete entry.y;
  }
  if ("y" in partial) {
    entry.yOverride = true;
  }
  if (!entry.yOverride) {
    delete entry.y;
    delete entry.yOverride;
  }

  const stackSnapRequest =
    ("x" in partial || "z" in partial) && !("y" in partial) ? target : undefined;
  const positionPatch =
    "x" in partial ||
    "z" in partial ||
    "y" in partial ||
    "rotationX" in partial ||
    "rotationY" in partial ||
    "rotationZ" in partial ||
    "layOnSide" in partial;
  const firePatch = "interiorFire" in partial || "topCap" in partial;

  return {
    ...state,
    singles: { ...state.singles, [target]: entry },
    stackSnapRequest,
    singleApplyRequest: positionPatch ? target : undefined,
    fireApplyRequest: firePatch ? target : undefined,
  };
}

/**
 * @param {"containerPile" | "sePile"} groupKey
 * @param {OilBarrelPlacementState} state
 * @param {Partial<PileHubPlacement>} partial
 */
export function patchOilBarrelGroupHub(state, groupKey, partial) {
  const singles = { ...state.singles };
  for (const id of getGroupMemberIds(groupKey, state)) {
    delete singles[id];
  }
  return {
    ...state,
    singles,
    hubs: {
      ...state.hubs,
      [groupKey]: { ...state.hubs[groupKey], ...partial },
    },
    hubApplyRequest:
      "x" in partial || "z" in partial || "rotationY" in partial
        ? groupKey
        : undefined,
  };
}

function exportBarrelFireFields(p) {
  /** @type {Record<string, boolean>} */
  const out = {};
  if (p.interiorFire === true) {
    out.interiorFire = true;
    out.topCap = false;
  } else if (p.interiorFire === false) {
    out.interiorFire = false;
    if (p.topCap === false) out.topCap = false;
    else if (p.topCap === true) out.topCap = true;
  }
  return out;
}

function desiredBarrelFireFromPlacement(placement) {
  if (placement.interiorFire === true) {
    return resolveBarrelMeshFireOptions({ interiorFire: true });
  }
  if (placement.interiorFire === false) {
    return resolveBarrelMeshFireOptions({
      interiorFire: false,
      topCap: placement.topCap,
    });
  }
  return null;
}

function syncBarrelFireFromPlacement(barrel, placement, root) {
  const desired = desiredBarrelFireFromPlacement(placement);
  if (!desired) return barrel;
  const current = readOilBarrelFireState(barrel);
  if (
    current.interiorFire === desired.interiorFire &&
    current.topCap === desired.topCap
  ) {
    return barrel;
  }
  rebuildOilBarrelMesh(barrel, desired);
  const finish = () => {
    ensureOilBarrelFlameMeshes(root);
    refreshOilBarrelFireLights(root, getOilBarrelTuning());
  };
  if (desired.interiorFire) {
    ensureOilBarrelInteriorTextures().then(finish);
  } else {
    finish();
  }
  return barrel;
}

/** @param {OilBarrelPlacementState} state @param {THREE.Object3D} root */
export function formatOilBarrelPlacementJson(state, root, floorY = 0) {
  const placements = resolveOilBarrelPlacements(root, state);
  const removed = new Set(state.removedIds ?? []);
  const pileIds = new Set(
    [...containerPileCanonicalDefs(), ...sePileCanonicalDefs()].map((d) => d.id),
  );
  const pileProps = [];
  const companionProps = [];
  const looseProps = [];

  for (const [id, p] of Object.entries(placements)) {
    if (removed.has(id)) continue;
    const addedEntry = state.addedBarrels?.[id];
    if (addedEntry?.groupKey) {
      pileProps.push({
        id,
        type: "oilBarrel",
        x: +p.x.toFixed(4),
        z: +p.z.toFixed(4),
        ...(p.rotationY != null ? { rotationY: +p.rotationY.toFixed(4) } : {}),
        ...(p.rotationX != null ? { rotationX: +p.rotationX.toFixed(4) } : {}),
        ...(p.rotationZ != null ? { rotationZ: +p.rotationZ.toFixed(4) } : {}),
        ...(p.layOnSide ? { layOnSide: true } : {}),
        ...exportBarrelFireFields(p),
        ...exportStackFields(p, floorY),
      });
      continue;
    }
    if (!pileIds.has(id)) {
      if (
        LEVEL1_LOOSE_BARREL_OPTIONS.some((o) => o.id === id) ||
        addedEntry
      ) {
        looseProps.push({
          id,
          type: "oilBarrel",
          x: +p.x.toFixed(4),
          z: +p.z.toFixed(4),
          ...(p.rotationY != null ? { rotationY: +p.rotationY.toFixed(4) } : {}),
          ...(p.rotationX != null ? { rotationX: +p.rotationX.toFixed(4) } : {}),
          ...(p.rotationZ != null ? { rotationZ: +p.rotationZ.toFixed(4) } : {}),
          ...(p.layOnSide ? { layOnSide: true } : {}),
          ...exportBarrelFireFields(p),
          ...exportStackFields(p, floorY),
        });
      }
      continue;
    }
    const base = { id, x: p.x, z: p.z, rotationY: p.rotationY };
    if (OIL_BARREL_PILE_COMPANION_ID.test(id)) {
      companionProps.push({ ...base, ...exportBarrelFireFields(p) });
    } else if (OIL_BARREL_PILE_ID.test(id)) {
      const canonical = [...containerPileCanonicalDefs(), ...sePileCanonicalDefs()].find(
        (d) => d.id === id,
      );
      pileProps.push({
        ...canonical,
        ...base,
        type: "oilBarrel",
        ...(p.rotationX != null ? { rotationX: +p.rotationX.toFixed(4) } : {}),
        ...(p.rotationZ != null ? { rotationZ: +p.rotationZ.toFixed(4) } : {}),
        ...(p.layOnSide ? { layOnSide: true } : {}),
        ...exportBarrelFireFields(p),
        ...exportStackFields(p, floorY),
      });
    }
  }

  return JSON.stringify(
    [
      ...formatPileCompanionPropsForLevel(companionProps),
      ...formatPilePropsForLevel(pileProps),
      ...looseProps.map((p) => JSON.parse(JSON.stringify(p))),
    ],
    null,
    2,
  );
}

/** @returns {OilBarrelPlacementState} */
export function resetOilBarrelPlacementState() {
  return {
    target: "containerPile",
    hubs: {
      containerPile: {
        x: PILE_HUB_DEFAULT.x,
        z: PILE_HUB_DEFAULT.z,
        rotationY: PILE_HUB_ROTATION_DEFAULT,
      },
      sePile: {
        x: PILE_HUB_SE_DEFAULT.x,
        z: PILE_HUB_SE_DEFAULT.z,
        rotationY: PILE_HUB_ROTATION_DEFAULT,
      },
    },
    singles: {},
    addedBarrels: {},
    removedIds: [],
  };
}

/**
 * Apply a single editor edit (hub move, barrel patch, add/remove).
 * Opening the panel does not call this — barrels stay at level JSON until edited.
 * @param {THREE.Object3D} root
 * @param {OilBarrelPlacementState} state
 * @param {number} [floorY=0]
 * @param {OilBarrelPlacementApplyOptions} [options]
 */
export function applyOilBarrelPlacements(root, state, floorY = 0, options = {}) {
  const stackSnap = options.stackSnap === true;
  const stackSnapId = options.stackSnapId ?? null;

  if (options.applyRemovedId) {
    const barrel = findBarrelGroupById(root, options.applyRemovedId);
    if (barrel) disposeOilBarrelGroup(barrel);
  }

  if (options.applyAddedId) {
    const id = options.applyAddedId;
    const entry = state.addedBarrels?.[id];
    if (entry && !findBarrelGroupById(root, id)) {
      const placement = state.singles[id] ?? {
        x: entry.groupKey ? state.hubs[entry.groupKey].x : 0,
        z: entry.groupKey ? state.hubs[entry.groupKey].z : 0,
        rotationY: 0,
      };
      createOilBarrel(
        root,
        placement.x,
        placement.z,
        placement.y ?? floorY,
        placement.rotationY ?? 0,
        {
          propId: id,
          interiorFire: placement.interiorFire,
          topCap: placement.topCap,
          layOnSide: placement.layOnSide,
          rotationX: placement.rotationX,
          rotationZ: placement.rotationZ,
        },
      );
    }
  }

  if (options.applyHubGroup) {
    applyPileGroupHub(
      root,
      options.applyHubGroup,
      state.hubs[options.applyHubGroup],
      state,
    );
  }

  for (const id of options.fireSyncIds ?? []) {
    const obj = findBarrelGroupById(root, id);
    if (!obj) continue;
    const resolved = getBarrelPlacementForTarget(root, state, id);
    if (resolved) syncBarrelFireFromPlacement(obj, resolved, root);
  }

  for (const id of options.applySingleIds ?? []) {
    if (state.removedIds?.includes(id)) continue;
    let obj = findBarrelGroupById(root, id);
    if (!obj) continue;
    const resolved = getBarrelPlacementForTarget(root, state, id);
    if (!resolved) continue;
    obj = syncBarrelFireFromPlacement(obj, resolved, root);
    applyWorldBarrelPlacement(
      obj,
      resolved,
      floorY,
      root,
      id,
      stackSnap,
      stackSnapId,
    );
  }
}
