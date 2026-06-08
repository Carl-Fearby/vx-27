/**
 * NODE BREACH puzzle logic — node-routing from START to REWARD CACHE.
 * Pure state transitions; UI renders from exported state snapshots.
 */

/** @typedef {'idle' | 'active' | 'failed' | 'complete'} HackStatus */
/** @typedef {'security' | 'timer'} HackFailureKind */
/** @typedef {'power' | 'security' | 'reward'} HackNodeType */
/** @typedef {'up' | 'down' | 'right'} HackDirection */
/** @typedef {{
 *   id: string,
 *   row: number,
 *   col: number,
 *   type: HackNodeType,
 *   revealed: boolean,
 *   connected: boolean,
 *   selected: boolean,
 *   triggered: boolean,
 *   pointerDirection: HackDirection,
 *   validDirections: HackDirection[],
 *   pointerTargetIndex: number,
 * }} HackPuzzleNode */

/** @typedef {{ fromId: string, toId: string }} HackConnection */

/** @typedef {{
 *   status: HackStatus,
 *   rows: number,
 *   cols: number,
 *   seed: number,
 *   selectedNodeId: string,
 *   activeNodeId: string,
 *   startNodeId: string,
 *   rewardNodeId: string,
 *   nodes: HackPuzzleNode[],
 *   connections: HackConnection[],
 *   failureConnection: HackConnection | null,
 *   progress: number,
 *   securityTotal: number,
 *   timerRemainingMs: number,
 *   failureKind: HackFailureKind | null,
 *   failureMessage: string | null,
 *   successMessage: string | null,
 * }} HackGameState */

export const HACK_START_NODE_ID = "start";
export const HACK_REWARD_NODE_ID = "reward";
export const HACK_DEFAULT_TIMER_MS = 90_000;
/** Auto-retry delay after a security-node failure (timer keeps running). */
export const HACK_SECURITY_AUTO_RESET_MS = 3_000;
/** Timer granted when auto-retrying after a security death (same grid layout). */
export const HACK_SECURITY_RETRY_TIMER_MS = 60_000;
/** Success screen + pickup flashes before auto-closing the hack UI. */
export const HACK_SUCCESS_DISMISS_MS = 3_000;

/** TEMP — set true before ship to spawn and enforce security nodes. */
export const HACK_SECURITY_ENABLED = true;

/** TEMP — when security is on, reveal unrevealed security nodes for playtesting. */
export const HACK_DEBUG_SHOW_SECURITY = true;

/** Per column (excl. last): chance of exactly one security node; otherwise all power. */
const HACK_SECURITY_COLUMN_CHANCE = 0.58;
/** Floor on security count after random sprinkle (still max one per column). */
const HACK_MIN_SECURITY_NODES = 3;

const DIR_ORDER = /** @type {HackDirection[]} */ (["up", "down", "right"]);

/** Confirm/pointer targets — always the next column (col + 1). */
const NEXT_COL_DELTA = {
  right: { dc: 1, dr: 0 },
  up: { dc: 1, dr: -1 },
  down: { dc: 1, dr: 1 },
};

/**
 * @param {number} n
 * @param {number} seed
 */
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {number} row @param {number} col */
export function hackNodeId(row, col) {
  return `node-${row}-${col}`;
}

/** Default highlight on column 0 row 0 while START remains active (no auto-connect). */
function initialHackSelection() {
  return {
    activeNodeId: HACK_START_NODE_ID,
    selectedNodeId: hackNodeId(0, 0),
  };
}

/** @param {HackGameState} state @param {string} id */
export function getNode(state, id) {
  return state.nodes.find((n) => n.id === id) ?? null;
}

/** @param {HackGameState} state @param {number} row @param {number} col */
export function getNodeAt(state, row, col) {
  return state.nodes.find((n) => n.row === row && n.col === col) ?? null;
}

/** @param {HackPuzzleNode} node @param {HackGameState} state */
export function getValidDirections(node, state) {
  return DIR_ORDER.filter((dir) => getNodeInDirection(node, dir, state) != null);
}

/**
 * @param {HackPuzzleNode} node
 * @param {HackDirection} direction
 * @param {HackGameState} state
 */
/**
 * @param {HackPuzzleNode} node
 * @param {HackDirection} direction
 * @param {number} rows
 * @param {number} cols
 */
function confirmTargetAt(node, direction, rows, cols) {
  if (node.id === HACK_START_NODE_ID) {
    const refRow = Math.floor(rows / 2);
    if (direction === "right") return { row: refRow, col: 0 };
    if (direction === "up" && refRow > 0) return { row: refRow - 1, col: 0 };
    if (direction === "down" && refRow < rows - 1) return { row: refRow + 1, col: 0 };
    return null;
  }

  const delta = NEXT_COL_DELTA[direction];
  if (!delta) return null;
  const row = node.row + delta.dr;
  const col = node.col + delta.dc;
  if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
  if (col !== node.col + 1) return null;
  return { row, col };
}

export function getNodeInDirection(node, direction, state) {
  const at = confirmTargetAt(node, direction, state.rows, state.cols);
  return at ? getNodeAt(state, at.row, at.col) : null;
}

/** Column the active node must connect into next (START → 0). */
export function getRequiredNextCol(node) {
  if (node.id === HACK_START_NODE_ID) return 0;
  return node.col + 1;
}

/** Ordered row 0 → N targets in the next column (column 1 from START, then +1 each step). */
export function getNextColumnTargets(node, state) {
  const col = getRequiredNextCol(node);
  /** @type {HackPuzzleNode[]} */
  const targets = [];
  for (let row = 0; row < state.rows; row++) {
    const target = getNodeAt(state, row, col);
    if (target) targets.push(target);
  }
  return targets;
}

/** @param {HackPuzzleNode} node @param {HackGameState} state */
export function getPointerTarget(node, state) {
  const targets = getNextColumnTargets(node, state);
  if (targets.length === 0) return null;
  const idx = node.pointerTargetIndex ?? 0;
  return targets[idx % targets.length];
}

/** Nodes the active node can connect to in one step (up / down / right in next column). */
export function getDirectConnectTargets(node, state) {
  return DIR_ORDER.map((dir) => getNodeInDirection(node, dir, state)).filter(Boolean);
}

/** @param {HackPuzzleNode} active @param {HackPuzzleNode} candidate @param {HackGameState} state */
export function isDirectConnectTarget(active, candidate, state) {
  return getDirectConnectTargets(active, state).some((n) => n.id === candidate.id);
}

/** 3×3 window (incl. diagonals) centered on active — the red-box highlight zone. */
function getSelectionWindow(active, state) {
  return {
    minCol: Math.max(0, active.col - 1),
    maxCol: Math.min(state.cols - 1, active.col + 1),
    minRow: Math.max(0, active.row - 1),
    maxRow: Math.min(state.rows - 1, active.row + 1),
  };
}

/**
 * Nodes the player may highlight — the 3×3 window around active (+ reward if in reach).
 * START is only selectable while it is still the active node.
 */
export function getSelectableNeighbors(state) {
  const active = getNode(state, state.activeNodeId);
  if (!active) return [];

  /** @type {HackPuzzleNode[]} */
  const neighbors = [];
  const seen = new Set();
  const add = (node) => {
    if (!node || seen.has(node.id)) return;
    seen.add(node.id);
    neighbors.push(node);
  };

  if (active.id === HACK_START_NODE_ID) {
    add(active);
    for (let row = 0; row < state.rows; row++) {
      add(getNodeAt(state, row, 0));
    }
    return neighbors;
  }

  const win = getSelectionWindow(active, state);
  for (let row = win.minRow; row <= win.maxRow; row++) {
    for (let col = win.minCol; col <= win.maxCol; col++) {
      add(getNodeAt(state, row, col));
    }
  }

  if (active.col === state.cols - 1) {
    add(getNode(state, state.rewardNodeId));
  }

  return neighbors;
}

/** @param {HackGameState} state @param {HackPuzzleNode} candidate */
export function isSelectableNeighbor(state, candidate) {
  if (!candidate) return false;
  return getSelectableNeighbors(state).some((n) => n.id === candidate.id);
}

/**
 * @param {HackGameState} state
 * @param {HackPuzzleNode} selected
 * @param {"w" | "s"} key
 */
function cycleStartEntryRow(state, selected, key) {
  const rows = state.rows;
  if (!selected || selected.id === HACK_START_NODE_ID || selected.col !== 0) {
    return key === "s" ? 0 : rows - 1;
  }
  if (key === "w") {
    return selected.row > 0 ? selected.row - 1 : rows - 1;
  }
  return selected.row < rows - 1 ? selected.row + 1 : 0;
}

/**
 * Node Space will connect/jump to from the current active + selection.
 * Any highlighted cell in the 3×3 window is a candidate.
 *
 * @param {HackPuzzleNode} active
 * @param {HackPuzzleNode} selected
 * @param {HackGameState} state
 */
export function resolveConfirmTarget(active, selected, state) {
  if (!active || !selected) return null;

  if (selected.id === active.id) {
    return getPointerTarget(active, state);
  }

  if (isSelectableNeighbor(state, selected)) {
    return selected;
  }

  return null;
}

/** @param {HackPuzzleNode} active @param {HackPuzzleNode} target @param {HackGameState} state */
function isValidConfirmTarget(active, target, state) {
  if (!target || !active) return false;
  if (!isSelectableNeighbor(state, target)) return false;
  if (target.id === active.id) return true;

  if (active.id === HACK_START_NODE_ID) {
    return target.col === 0;
  }

  if (target.id === HACK_REWARD_NODE_ID) {
    return active.col === state.cols - 1;
  }

  return target.id !== active.id;
}

/** @param {HackPuzzleNode} from @param {HackPuzzleNode} to @param {HackGameState} state */
function getConnectionDirection(from, to, state) {
  if (from.id === HACK_START_NODE_ID) {
    for (const dir of DIR_ORDER) {
      const at = confirmTargetAt(from, dir, state.rows, state.cols);
      if (at && getNodeAt(state, at.row, at.col)?.id === to.id) return dir;
    }
    const refRow = Math.floor(state.rows / 2);
    if (to.row < refRow) return "up";
    if (to.row > refRow) return "down";
    return "right";
  }

  for (const dir of DIR_ORDER) {
    if (getNodeInDirection(from, dir, state)?.id === to.id) return dir;
  }

  const dr = to.row - from.row;
  if (dr < 0) return "up";
  if (dr > 0) return "down";
  return from.pointerDirection ?? "right";
}

/**
 * Prefer the same aim (up / down / right); level up/down to horizontal when blocked.
 * @param {HackPuzzleNode} node
 * @param {HackDirection} preferredDir
 * @param {HackGameState} state
 */
function resolveOutgoingDirection(node, preferredDir, state) {
  if (getNodeInDirection(node, preferredDir, state)) return preferredDir;
  if (
    (preferredDir === "up" || preferredDir === "down") &&
    getNodeInDirection(node, "right", state)
  ) {
    return "right";
  }
  for (const dir of DIR_ORDER) {
    if (getNodeInDirection(node, dir, state)) return dir;
  }
  return preferredDir;
}

/** @param {HackPuzzleNode} node @param {HackDirection} direction @param {HackGameState} state */
function getPointerIndexForDirection(node, direction, state) {
  const resolved = resolveOutgoingDirection(node, direction, state);
  const target = getNodeInDirection(node, resolved, state);
  if (!target) return node.pointerTargetIndex ?? 0;
  const targets = getNextColumnTargets(node, state);
  const idx = targets.findIndex((n) => n.id === target.id);
  return idx >= 0 ? idx : node.pointerTargetIndex ?? 0;
}

/**
 * After a forward connect, keep pointer direction and auto-highlight the next column.
 * @param {HackGameState} state
 * @param {HackPuzzleNode} from
 * @param {HackPuzzleNode} to
 */
function applyForwardAimAfterConnect(state, from, to) {
  const active = getNode(state, to.id);
  if (!active) return state;

  const isForward =
    from.id === HACK_START_NODE_ID ||
    (to.id !== HACK_REWARD_NODE_ID && to.col > from.col);

  if (!isForward) {
    return {
      ...state,
      nodes: applySelection(state.nodes, to.id, to.id),
      selectedNodeId: to.id,
    };
  }

  const incomingDir = getConnectionDirection(from, to, state);
  const outgoingDir = resolveOutgoingDirection(active, incomingDir, state);
  const pointerTargetIndex = getPointerIndexForDirection(active, incomingDir, state);

  let selectedNodeId = active.id;

  if (active.col === state.cols - 1) {
    const reward = getNode(state, state.rewardNodeId);
    if (reward && isSelectableNeighbor(state, reward)) {
      selectedNodeId = reward.id;
    }
  } else {
    const forward =
      getNodeInDirection(active, outgoingDir, state) ??
      getNodeInDirection(active, "right", state);
    if (forward) selectedNodeId = forward.id;
  }

  const nodes = applySelection(
    state.nodes.map((n) =>
      n.id === active.id
        ? { ...n, pointerDirection: outgoingDir, pointerTargetIndex }
        : n
    ),
    selectedNodeId,
    active.id
  );

  return { ...state, nodes, selectedNodeId };
}

/** @param {HackGameState} state @param {HackPuzzleNode} selected */
function syncActivePointerForSelection(state, selected) {
  const active = getNode(state, state.activeNodeId);
  if (!active || !selected) return state;
  const forward = resolveConfirmTarget(active, selected, state);
  if (!forward) return state;
  if (
    active.id === HACK_START_NODE_ID ||
    forward.col !== getRequiredNextCol(active)
  ) {
    return state;
  }
  const targets = getNextColumnTargets(active, state);
  const pointerTargetIndex = targets.findIndex((n) => n.id === forward.id);
  if (pointerTargetIndex < 0) return state;
  return {
    ...state,
    nodes: state.nodes.map((n) =>
      n.id === active.id ? { ...n, pointerTargetIndex } : n
    ),
  };
}

/** Ordered node ids along the confirmed route START → … → active. */
export function getHackRoutePath(state) {
  /** @type {string[]} */
  const path = [HACK_START_NODE_ID];
  const nextByFrom = new Map(state.connections.map((c) => [c.fromId, c.toId]));
  let current = HACK_START_NODE_ID;
  while (nextByFrom.has(current)) {
    current = nextByFrom.get(current);
    path.push(current);
  }
  return path;
}

/**
 * WASD — move the blue highlight inside the 3×3 window around active.
 * START: W/S cycles column 0. Grid: cardinal steps, clamped to the nine-cell zone.
 *
 * @param {HackGameState} state
 * @param {"w" | "a" | "s" | "d"} key
 */
export function navigateHackSelection(state, key) {
  if (state.status !== "active") return state;

  const active = getNode(state, state.activeNodeId);
  const selected = getNode(state, state.selectedNodeId);
  if (!active) return state;

  const { rows, cols } = state;
  const startRow = Math.floor(rows / 2);
  let target = null;

  if (active.id === HACK_START_NODE_ID) {
    if (key === "w" || key === "s") {
      const row = cycleStartEntryRow(state, selected, key);
      target = getNodeAt(state, row, 0);
    } else if (key === "d") {
      target =
        selected && selected.col === 0
          ? selected
          : getNodeAt(state, startRow, 0);
    }
  } else {
    const anchor =
      selected && isSelectableNeighbor(state, selected) ? selected : active;

    if (key === "a") {
      if (anchor.id === HACK_START_NODE_ID) {
        return state;
      }
      if (anchor.col > 0) {
        target = getNodeAt(state, anchor.row, anchor.col - 1);
      }
    } else if (anchor.id !== HACK_START_NODE_ID) {
      if (key === "w" && anchor.row > 0) {
        target = getNodeAt(state, anchor.row - 1, anchor.col);
      } else if (key === "s" && anchor.row < rows - 1) {
        target = getNodeAt(state, anchor.row + 1, anchor.col);
      } else if (key === "d") {
        if (anchor.col === cols - 1) {
          target = getNode(state, HACK_REWARD_NODE_ID);
        } else if (anchor.col < cols - 1) {
          target = getNodeAt(state, anchor.row, anchor.col + 1);
        }
      }
    }
  }

  if (!target || !isSelectableNeighbor(state, target)) return state;

  const next = {
    ...state,
    selectedNodeId: target.id,
    nodes: applySelection(state.nodes, target.id, state.activeNodeId),
  };

  return syncActivePointerForSelection(next, target);
}

/** @param {HackPuzzleNode[]} nodes @param {number} rows @param {number} cols */
function syncPointerMeta(nodes, rows, cols) {
  return nodes.map((n) => {
    const col = n.id === HACK_START_NODE_ID ? 0 : n.col + 1;
    const targetCount = Array.from({ length: rows }, (_, row) => row).filter(
      (row) => col >= 0 && col < cols
    ).length;
    return {
      ...n,
      pointerTargetIndex: Math.min(n.pointerTargetIndex ?? 0, Math.max(0, targetCount - 1)),
      validDirections: targetCount > 0 ? DIR_ORDER.slice(0, targetCount) : [],
    };
  });
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {number} seed
 * @returns {{ types: Map<string, HackNodeType>, pathSet: Set<string> }}
 */
function generateHackNodeTypes(rows, cols, seed) {
  const rand = mulberry32(seed);
  /** @type {Map<string, HackNodeType>} */
  const types = new Map();

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      types.set(hackNodeId(row, col), "power");
    }
  }

  const endRow = Math.floor(rand() * rows);
  const endId = hackNodeId(endRow, cols - 1);
  const path = ensureValidRouteExists(rows, cols, types, endId, rand);
  const pathSet = new Set(path);
  for (const id of path) {
    types.set(id, "power");
  }

  if (HACK_SECURITY_ENABLED) {
    sprinkleColumnSecurities(rows, cols, types, rand, pathSet);
    ensureMinimumSecurityNodes(rows, cols, types, rand, pathSet);
  }

  for (let col = 0; col < cols; col++) {
    const colCells = [];
    for (let row = 0; row < rows; row++) {
      colCells.push(hackNodeId(row, col));
    }
    ensureColumnHasPower(colCells, types, rand, pathSet);
  }

  enforceMaxOneSecurityPerColumn(rows, cols, types, pathSet);
  return { types, pathSet };
}

/** @param {Map<string, HackNodeType>} types @param {number} rows @param {number} cols */
function buildHackGridFromTypes(types, rows, cols) {
  /** @type {HackPuzzleNode[]} */
  const nodes = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = hackNodeId(row, col);
      nodes.push({
        id,
        row,
        col,
        type: types.get(id) ?? "power",
        revealed: false,
        connected: false,
        selected: false,
        triggered: false,
        pointerDirection: "right",
        validDirections: [],
        pointerTargetIndex: 0,
      });
    }
  }

  const startNode = createStartNode(rows);
  const rewardNode = createRewardNode(rows, cols);
  return syncPointerMeta([startNode, ...nodes, rewardNode], rows, cols);
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {number} seed
 */
export function generateHackGrid(rows, cols, seed) {
  const { types } = generateHackNodeTypes(rows, cols, seed);
  return buildHackGridFromTypes(types, rows, cols);
}

/** @param {string} id */
function hashNodeId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/** @param {number} col @param {Map<string, HackNodeType>} types @param {number} rows */
function columnHasSecurityInTypes(col, types, rows) {
  for (let row = 0; row < rows; row++) {
    if (types.get(hackNodeId(row, col)) === "security") return true;
  }
  return false;
}

/**
 * After a security death, keep the seeded layout but move the tripped node.
 *
 * @param {Map<string, HackNodeType>} types
 * @param {Set<string>} pathSet
 * @param {string} securityId
 * @param {number} rows
 * @param {number} cols
 * @param {number} pickSeed
 */
function relocateTrippedSecurityNode(types, pathSet, securityId, rows, cols, pickSeed) {
  if (types.get(securityId) !== "security") return false;

  const match = securityId.match(/node-(\d+)-(\d+)/);
  if (!match) return false;
  const fromRow = Number(match[1]);
  const fromCol = Number(match[2]);
  const rand = mulberry32(pickSeed);

  types.set(securityId, "power");

  /** @type {string[]} */
  const candidates = [];
  for (let row = 0; row < rows; row++) {
    if (row === fromRow) continue;
    const id = hackNodeId(row, fromCol);
    if (pathSet.has(id)) continue;
    if (types.get(id) === "power") candidates.push(id);
  }

  if (candidates.length === 0) {
    for (let col = 0; col < cols - 1; col++) {
      if (col === fromCol) continue;
      if (columnHasSecurityInTypes(col, types, rows)) continue;
      for (let row = 0; row < rows; row++) {
        const id = hackNodeId(row, col);
        if (pathSet.has(id)) continue;
        if (types.get(id) === "power") candidates.push(id);
      }
    }
  }

  if (candidates.length === 0) {
    types.set(securityId, "security");
    return false;
  }

  types.set(candidates[Math.floor(rand() * candidates.length)], "security");
  return true;
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {number} seed
 * @param {string | null | undefined} trippedSecurityId
 */
function generateHackGridAfterSecurityDeath(rows, cols, seed, trippedSecurityId) {
  const { types, pathSet } = generateHackNodeTypes(rows, cols, seed);

  if (trippedSecurityId) {
    const pickSeed = (seed ^ hashNodeId(trippedSecurityId)) >>> 0;
    if (relocateTrippedSecurityNode(types, pathSet, trippedSecurityId, rows, cols, pickSeed)) {
      enforceMaxOneSecurityPerColumn(rows, cols, types, pathSet);
      const rand = mulberry32(pickSeed + 1);
      for (let col = 0; col < cols; col++) {
        const colCells = [];
        for (let row = 0; row < rows; row++) {
          colCells.push(hackNodeId(row, col));
        }
        ensureColumnHasPower(colCells, types, rand, pathSet);
      }
    }
  }

  return buildHackGridFromTypes(types, rows, cols);
}

/** @param {number} rows */
function createStartNode(rows) {
  const refRow = Math.floor(rows / 2);
  return {
    id: HACK_START_NODE_ID,
    row: refRow,
    col: -1,
    type: "power",
    revealed: true,
    connected: true,
    selected: true,
    triggered: false,
    pointerDirection: "right",
    validDirections: [],
    pointerTargetIndex: 0,
  };
}

/** @param {number} rows @param {number} cols */
function createRewardNode(rows, cols) {
  const refRow = Math.floor(rows / 2);
  return {
    id: HACK_REWARD_NODE_ID,
    row: refRow,
    col: cols,
    type: "reward",
    revealed: true,
    connected: false,
    selected: false,
    triggered: false,
    pointerDirection: "right",
    validDirections: [],
    pointerTargetIndex: 0,
  };
}

/**
 * At most one security per column; many columns stay all power.
 * @param {number} rows
 * @param {number} cols
 * @param {Map<string, HackNodeType>} types
 * @param {() => number} rand
 * @param {Set<string>} pathSet
 */
function countGridSecurityNodes(types, rows, cols) {
  let count = 0;
  for (let col = 0; col < cols - 1; col++) {
    for (let row = 0; row < rows; row++) {
      if (types.get(hackNodeId(row, col)) === "security") count++;
    }
  }
  return count;
}

function columnHasSecurity(col, types, rows) {
  for (let row = 0; row < rows; row++) {
    if (types.get(hackNodeId(row, col)) === "security") return true;
  }
  return false;
}

/** @param {number} col @param {number} rows @param {Map<string, HackNodeType>} types @param {Set<string>} pathSet @param {() => number} rand */
function placeSecurityInColumn(col, rows, types, pathSet, rand) {
  if (columnHasSecurity(col, types, rows)) return false;

  /** @type {string[]} */
  const candidates = [];
  for (let row = 0; row < rows; row++) {
    const id = hackNodeId(row, col);
    if (pathSet.has(id)) continue;
    if (types.get(id) === "power") candidates.push(id);
  }
  if (candidates.length === 0) return false;

  types.set(candidates[Math.floor(rand() * candidates.length)], "security");
  return true;
}

function sprinkleColumnSecurities(rows, cols, types, rand, pathSet) {
  for (let col = 0; col < cols - 1; col++) {
    if (rand() > HACK_SECURITY_COLUMN_CHANCE) continue;
    placeSecurityInColumn(col, rows, types, pathSet, rand);
  }
}

/** Guarantee at least HACK_MIN_SECURITY_NODES without breaking one-security-per-column. */
function ensureMinimumSecurityNodes(rows, cols, types, rand, pathSet) {
  let count = countGridSecurityNodes(types, rows, cols);
  if (count >= HACK_MIN_SECURITY_NODES) return;

  /** @type {number[]} */
  const openCols = [];
  for (let col = 0; col < cols - 1; col++) {
    if (!columnHasSecurity(col, types, rows)) openCols.push(col);
  }

  for (let i = openCols.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [openCols[i], openCols[j]] = [openCols[j], openCols[i]];
  }

  for (const col of openCols) {
    if (count >= HACK_MIN_SECURITY_NODES) break;
    if (placeSecurityInColumn(col, rows, types, pathSet, rand)) count++;
  }
}

/** @param {number} rows @param {number} cols @param {Map<string, HackNodeType>} types @param {Set<string>} pathSet */
function enforceMaxOneSecurityPerColumn(rows, cols, types, pathSet) {
  for (let col = 0; col < cols - 1; col++) {
    /** @type {string[]} */
    const securityIds = [];
    for (let row = 0; row < rows; row++) {
      const id = hackNodeId(row, col);
      if (types.get(id) === "security") securityIds.push(id);
    }
    if (securityIds.length <= 1) continue;

    const keep =
      securityIds.find((id) => !pathSet.has(id)) ?? securityIds[0];
    for (const id of securityIds) {
      if (id !== keep) types.set(id, "power");
    }
  }
}

/**
 * @param {string[]} colCellIds
 * @param {Map<string, HackNodeType>} types
 * @param {() => number} rand
 * @param {Set<string>} [protectedIds]
 */
function ensureColumnHasPower(colCellIds, types, rand, protectedIds = new Set()) {
  if (colCellIds.length === 0) return;
  if (colCellIds.some((id) => types.get(id) === "power")) return;

  const candidates = colCellIds.filter((id) => !protectedIds.has(id));
  const pick = candidates[Math.floor(rand() * candidates.length)] ?? colCellIds[0];
  types.set(pick, "power");
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {Map<string, HackNodeType>} types
 * @param {string} endId
 * @param {() => number} rand
 */
function ensureValidRouteExists(rows, cols, types, endId, rand) {
  const endMatch = endId.match(/node-(\d+)-(\d+)/);
  if (!endMatch) return [endId];

  const endRow = Number(endMatch[1]);
  const entryRow = Math.floor(rand() * rows);
  const entryId = hackNodeId(entryRow, 0);

  const path = findPowerPath(rows, cols, entryRow, endRow);
  if (path.length > 0) return path;

  const fallback = findPowerPath(rows, cols, Math.floor(rows / 2), endRow);
  if (fallback.length > 0) return fallback;

  return [entryId, endId];
}

/** BFS — each step must enter the next column (col + 1). */
function findPowerPath(rows, cols, startRow, endRow) {
  const startId = hackNodeId(startRow, 0);
  const endId = hackNodeId(endRow, cols - 1);
  const queue = [startId];
  const prev = new Map([[startId, null]]);

  while (queue.length > 0) {
    const id = queue.shift();
    if (id === endId) break;
    const match = id.match(/node-(\d+)-(\d+)/);
    if (!match) continue;
    const row = Number(match[1]);
    const col = Number(match[2]);

    for (const dir of DIR_ORDER) {
      const delta = NEXT_COL_DELTA[dir];
      const nr = row + delta.dr;
      const nc = col + delta.dc;
      if (nr < 0 || nr >= rows || nc !== col + 1) continue;
      const nextId = hackNodeId(nr, nc);
      if (prev.has(nextId)) continue;
      prev.set(nextId, id);
      queue.push(nextId);
    }
  }

  if (!prev.has(endId)) return [];

  /** @type {string[]} */
  const path = [];
  let cur = endId;
  while (cur) {
    path.unshift(cur);
    cur = prev.get(cur) ?? null;
  }
  return path;
}

/** @param {HackPuzzleNode[]} nodes @param {string} selectedId @param {string} activeId */
function applySelection(nodes, selectedId, activeId) {
  return nodes.map((n) => ({
    ...n,
    selected: n.id === selectedId,
    pointerTargetIndex: n.id === activeId ? (n.pointerTargetIndex ?? 0) : n.pointerTargetIndex,
  }));
}

/** @param {HackGameState} state */
function countSecurityNodes(state) {
  return state.nodes.filter((n) => n.id !== HACK_START_NODE_ID && n.type === "security").length;
}

/** Route steps: one per grid column (20% each) plus reward cache at 100%. */
function hackProgressStepCount(cols) {
  return Math.max(1, cols + 1);
}

/** @param {HackGameState} state */
function computeProgress(state) {
  const active = getNode(state, state.activeNodeId);
  if (!active || active.id === HACK_START_NODE_ID) return 0;
  if (active.id === HACK_REWARD_NODE_ID) return hackProgressStepCount(state.cols);
  return active.col + 1;
}

/**
 * @param {{
 *   rows?: number,
 *   cols?: number,
 *   seed?: number,
 *   timerMs?: number,
 * }} [opts]
 * @returns {HackGameState}
 */
export function createHackGameState(opts = {}) {
  const rows = opts.rows ?? 4;
  const cols = opts.cols ?? 4;
  const seed = opts.seed ?? Math.floor(Math.random() * 0xffffffff);
  const nodes = generateHackGrid(rows, cols, seed);

  const { activeNodeId, selectedNodeId } = initialHackSelection();
  const state = {
    status: "idle",
    rows,
    cols,
    seed,
    selectedNodeId,
    activeNodeId,
    startNodeId: HACK_START_NODE_ID,
    rewardNodeId: HACK_REWARD_NODE_ID,
    nodes,
    connections: [],
    failureConnection: null,
    progress: 0,
    securityTotal: 0,
    timerRemainingMs: opts.timerMs ?? HACK_DEFAULT_TIMER_MS,
    failureKind: null,
    failureMessage: null,
    successMessage: null,
  };

  return {
    ...state,
    securityTotal: countSecurityNodes(state),
    nodes: applySelection(state.nodes, state.selectedNodeId, state.activeNodeId),
  };
}

/** @param {HackGameState} state */
export function startHack(state) {
  const next = resetHack({ ...state, status: "idle" });
  return { ...next, status: "active" };
}

/** @param {HackGameState} state @param {HackPuzzleNode[]} nodes */
function buildResetHackState(state, nodes) {
  const { activeNodeId, selectedNodeId } = initialHackSelection();
  const base = {
    ...state,
    status: "active",
    selectedNodeId,
    activeNodeId,
    rewardNodeId: HACK_REWARD_NODE_ID,
    nodes,
    connections: [],
    failureConnection: null,
    progress: 0,
    failureKind: null,
    failureMessage: null,
    successMessage: null,
    timerRemainingMs: state.timerRemainingMs,
  };
  return {
    ...base,
    securityTotal: countSecurityNodes(base),
    nodes: applySelection(base.nodes, base.selectedNodeId, base.activeNodeId),
  };
}

/** @param {HackGameState} state */
export function resetHack(state) {
  const fresh = generateHackGrid(state.rows, state.cols, state.seed);
  return buildResetHackState(state, fresh);
}

/** @param {HackGameState} state */
export function resetHackAfterSecurityDeath(state) {
  const fresh = generateHackGridAfterSecurityDeath(
    state.rows,
    state.cols,
    state.seed,
    state.failureConnection?.toId
  );
  return buildResetHackState(
    { ...state, timerRemainingMs: HACK_SECURITY_RETRY_TIMER_MS },
    fresh
  );
}

/** @param {HackGameState} state */
export function exitHack(state) {
  return { ...state, status: "idle" };
}

/**
 * @param {HackGameState} state
 * @param {number} deltaMs
 */
export function isHackSecurityFailure(state) {
  return state.status === "failed" && state.failureKind === "security";
}

export function isHackTimerExpired(state) {
  return state.status === "failed" && state.failureKind === "timer";
}

export function isHackTimerTicking(state) {
  return (
    state.status === "active" ||
    (state.status === "failed" && state.failureKind === "security")
  );
}

export function tickHackTimer(state, deltaMs) {
  if (!isHackTimerTicking(state)) return state;
  const timerRemainingMs = Math.max(0, state.timerRemainingMs - deltaMs);
  if (timerRemainingMs > 0) return { ...state, timerRemainingMs };
  return {
    ...state,
    timerRemainingMs: 0,
    status: "failed",
    failureKind: "timer",
    failureMessage: "TIME EXPIRED",
  };
}

/**
 * @param {HackGameState} state
 * @param {string} nodeId
 */
export function selectNodeByMouse(state, nodeId) {
  if (state.status !== "active") return state;
  const clicked = getNode(state, nodeId);
  if (!clicked) return state;

  if (state.status === "active" && !isSelectableNeighbor(state, clicked)) {
    return state;
  }

  const next = {
    ...state,
    selectedNodeId: nodeId,
    nodes: applySelection(state.nodes, nodeId, state.activeNodeId),
  };
  return state.status === "active" ? syncActivePointerForSelection(next, clicked) : next;
}

/**
 * @param {HackGameState} state
 * @param {1 | -1} step
 */
function stepPointerTargetIndex(state, step) {
  if (state.status !== "active") return state;
  if (state.selectedNodeId !== state.activeNodeId) return state;

  const active = getNode(state, state.activeNodeId);
  if (!active) return state;

  const targets = getNextColumnTargets(active, state);
  if (targets.length <= 1) return state;

  const current = active.pointerTargetIndex ?? 0;
  const pointerTargetIndex = (current + step + targets.length) % targets.length;

  return {
    ...state,
    nodes: state.nodes.map((n) =>
      n.id === active.id ? { ...n, pointerTargetIndex } : n
    ),
  };
}

/** @param {HackGameState} state */
export function rotateSelectedNode(state) {
  return stepPointerTargetIndex(state, 1);
}

/** @param {HackGameState} state @param {"up" | "down"} direction */
export function aimPointerTarget(state, direction) {
  return stepPointerTargetIndex(state, direction === "up" ? -1 : 1);
}

/** Active node has at least one direct connect target in the next column. */
export function isHackAiming(state) {
  if (state.status !== "active") return false;
  const active = getNode(state, state.activeNodeId);
  if (!active) return false;
  return getDirectConnectTargets(active, state).length > 0;
}

/** @param {HackGameState} state */
export function getActiveAimTarget(state) {
  if (state.status !== "active") return null;
  const active = getNode(state, state.activeNodeId);
  const selected = getNode(state, state.selectedNodeId);
  if (!active || !selected) return null;
  return resolveConfirmTarget(active, selected, state);
}

/** Orange pointer visual — aims at the blue ring when selection has moved. */
export function getActivePointerTarget(state) {
  if (state.status !== "active") return null;
  const active = getNode(state, state.activeNodeId);
  const selected = getNode(state, state.selectedNodeId);
  if (!active || !selected) return null;

  if (selected.id !== active.id) {
    return selected;
  }

  return getActiveAimTarget(state) ?? getPointerTarget(active, state);
}

/** Orange pointer on START — tracks the current selection. */
export function getStartPointerTarget(state) {
  if (state.status !== "active") return null;
  const active = getNode(state, state.activeNodeId);
  if (!active || active.id !== HACK_START_NODE_ID) return null;
  return getActivePointerTarget(state);
}

/** Orange pointer on REWARD CACHE — when active is in the last grid column. */
export function getRewardPointerTarget(state) {
  if (state.status !== "active") return null;
  const active = getNode(state, state.activeNodeId);
  if (!active || active.col !== state.cols - 1) return null;
  return getActivePointerTarget(state);
}

/**
 * @param {HackPuzzleNode} from
 * @param {HackPuzzleNode} to
 * @param {HackGameState} state
 */
export function connectPowerNode(from, to, state) {
  const alreadyLinked = state.connections.some(
    (c) => c.fromId === from.id && c.toId === to.id
  );
  const connections = alreadyLinked
    ? state.connections
    : [...state.connections, { fromId: from.id, toId: to.id }];
  const nodes = state.nodes.map((n) => {
    if (n.id === to.id) {
      return { ...n, revealed: true, connected: true };
    }
    if (n.id === from.id) {
      return { ...n, revealed: true, connected: true };
    }
    return n;
  });

  const next = {
    ...state,
    connections,
    nodes,
    activeNodeId: to.id,
    selectedNodeId: to.id,
    progress: 0,
  };
  const progressed = { ...next, progress: computeProgress(next) };
  return applyForwardAimAfterConnect(progressed, from, to);
}

/** @param {HackPuzzleNode} node @param {HackGameState} state */
export function triggerSecurityFailure(node, state) {
  const nodes = state.nodes.map((n) =>
    n.id === node.id ? { ...n, revealed: true, triggered: true } : n
  );
  return {
    ...state,
    status: "failed",
    failureKind: "security",
    failureConnection: { fromId: state.activeNodeId, toId: node.id },
    selectedNodeId: state.activeNodeId,
    nodes: applySelection(nodes, state.activeNodeId, state.activeNodeId),
    failureMessage: "SECURITY NODE TRIGGERED",
  };
}

/** @param {HackGameState} state */
export function completeHack(state) {
  const nodes = state.nodes.map((n) =>
    n.type === "reward" ? { ...n, revealed: true, connected: true } : n
  );
  return {
    ...state,
    status: "complete",
    nodes: applySelection(nodes, state.selectedNodeId, state.activeNodeId),
    successMessage: "ACCESS GRANTED",
    progress: hackProgressStepCount(state.cols),
  };
}

/** @param {HackGameState} state */
export function confirmSelectedNode(state) {
  if (state.status !== "active") return { state, event: null };

  const active = getNode(state, state.activeNodeId);
  if (!active) return { state, event: null };

  const selected = getNode(state, state.selectedNodeId);
  if (!selected) return { state, event: null };

  const target = resolveConfirmTarget(active, selected, state);
  if (!target) return { state, event: "confirm_blocked" };
  if (!isValidConfirmTarget(active, target, state)) {
    return { state, event: "no_target" };
  }

  if (HACK_SECURITY_ENABLED && target.type === "security") {
    const next = triggerSecurityFailure(target, state);
    return { state: next, event: "security_triggered" };
  }

  if (target.id === HACK_REWARD_NODE_ID) {
    let next = connectPowerNode(active, target, state);
    next = completeHack(next);
    return { state: next, event: "hack_complete" };
  }

  const next = connectPowerNode(active, target, state);
  const event =
    target.col < active.col || target.col === active.col
      ? "walked_back"
      : "power_connected";
  return { state: next, event };
}

/** @param {HackGameState} state */
export function getHackStatusText(state) {
  if (state.status === "complete") return state.successMessage ?? "ACCESS GRANTED";
  if (isHackTimerExpired(state)) return "TIME EXPIRED";
  if (isHackSecurityFailure(state)) {
    return state.failureMessage ?? "SECURITY NODE TRIGGERED";
  }
  if (state.status === "active") return "ACCESSING REWARD NODE";
  return "STANDBY";
}

/** @param {HackGameState} state */
export function getHackObjectiveCount(state) {
  const cleared = Math.max(0, state.progress);
  const total = hackProgressStepCount(state.cols);
  return `${cleared}/${total}`;
}

/** @param {HackGameState} state */
export function getHackRouteProgressPct(state) {
  if (state.status === "complete") return 100;
  const total = hackProgressStepCount(state.cols);
  return Math.round((state.progress / total) * 100);
}

/** @param {HackGameState} state @param {string} nodeId */
export function getHackNodeVisualState(state, nodeId) {
  const node = getNode(state, nodeId);
  if (!node) return "locked";

  if (node.id === HACK_START_NODE_ID) {
    if (state.status === "failed") return "start";
    return node.selected ? "startSelected" : "start";
  }

  if (node.triggered || (node.type === "security" && node.revealed)) {
    return "revealedSecurity";
  }
  if (node.type === "reward") {
    if (node.connected || state.status === "complete") return "reward";
    if (state.status === "active" && isSelectableNeighbor(state, node)) {
      return "reward";
    }
  }
  if (node.connected && node.type === "power") return "connectedPower";
  if (
    HACK_SECURITY_ENABLED &&
    HACK_DEBUG_SHOW_SECURITY &&
    node.type === "security" &&
    !node.revealed
  ) {
    return "debugSecurity";
  }
  return "empty";
}

/** Default reward bundle granted on success (wired to player systems later). */
export const HACK_DEFAULT_REWARDS = {
  credits: 250,
  pistolAmmo: 50,
  medkit: 1,
};

/**
 * @param {typeof HACK_DEFAULT_REWARDS} rewards
 * @returns {Array<{
 *   key: string,
 *   text: string,
 *   pickup: { type: string, label?: string },
 * }>}
 */
export function formatHackGrantedRewards(rewards) {
  /** @type {ReturnType<typeof formatHackGrantedRewards>} */
  const items = [];
  const credits = rewards.credits ?? 0;
  if (credits > 0) {
    items.push({
      key: "credits",
      text: `+ ${credits} CREDITS`,
      pickup: { type: "score", label: `+ ${credits} CREDITS` },
    });
  }
  const pistolAmmo = rewards.pistolAmmo ?? 0;
  if (pistolAmmo > 0) {
    const text = `+ ${pistolAmmo} PISTOL AMMO`;
    items.push({
      key: "ammo",
      text,
      pickup: { type: "ammo", label: text },
    });
  }
  const medkit = rewards.medkit ?? 0;
  if (medkit > 0) {
    const text = `+ ${medkit} MEDKIT${medkit > 1 ? "S" : ""}`;
    items.push({
      key: "medkit",
      text,
      pickup: { type: "hp", label: text },
    });
  }
  return items;
}
