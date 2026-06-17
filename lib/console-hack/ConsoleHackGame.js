/**
 * NODE BREACH — JS facade over hack_core WASM.
 * Game rules live in Rust; this module exposes the same API as before plus UI helpers.
 */

import { PRIMARY_WEAPONS } from "@/lib/weapons/PrimaryWeapons.js";
import { loadConsoleHackEngine } from "@/lib/hack/consoleHackEngine.ts";

/** @typedef {import("@/lib/hack/consoleHackTypes.ts").HackStatus} HackStatus */
/** @typedef {import("@/lib/hack/consoleHackTypes.ts").HackFailureKind} HackFailureKind */
/** @typedef {import("@/lib/hack/consoleHackTypes.ts").HackNodeType} HackNodeType */
/** @typedef {import("@/lib/hack/consoleHackTypes.ts").HackDirection} HackDirection */
/** @typedef {import("@/lib/hack/consoleHackTypes.ts").HackPuzzleNode} HackPuzzleNode */
/** @typedef {import("@/lib/hack/consoleHackTypes.ts").HackConnection} HackConnection */
/** @typedef {import("@/lib/hack/consoleHackTypes.ts").HackRewards} HackRewards */
/** @typedef {import("@/lib/hack/consoleHackTypes.ts").HackGameState} HackGameState */
/** @typedef {import("@/lib/hack/consoleHackTypes.ts").ConsoleHackEngine} ConsoleHackEngine */

export const HACK_START_NODE_ID = "start";
export const HACK_REWARD_NODE_ID = "reward";
export const HACK_DEFAULT_TIMER_MS = 90_000;
export const HACK_SECURITY_AUTO_RESET_MS = 3_000;
export const HACK_SECURITY_RETRY_TIMER_MS = 60_000;
export const HACK_SUCCESS_DISMISS_MS = 3_000;
export const HACK_MAX_RETRIES = 5;
export const HACK_SECURITY_ENABLED = true;
export const HACK_DEBUG_SHOW_SECURITY = false;

export const HACK_REWARD_CREDITS = 250;
export const HACK_REWARD_PISTOL_MAG_ROUNDS = PRIMARY_WEAPONS.pistol.magazineSize;
export const HACK_REWARD_RIFLE_SPARE_MAGS = 1;
export const HACK_REWARD_AMMO_MAG_CHANCE = 0.75;

export const HACK_REWARD_CHANCES = {
  credits: 1,
  pistolAmmo: HACK_REWARD_AMMO_MAG_CHANCE,
  medkit: 0.5,
  rifle: 0.2,
  grenade: 0.5,
  flashbang: 0.3,
};

/** @type {ConsoleHackEngine | null} */
let engine = null;
/** @type {Promise<ConsoleHackEngine> | null} */
let enginePromise = null;

/** Load hack_core WASM once; safe to call repeatedly. */
export function initConsoleHackBridge() {
  if (engine) return Promise.resolve(engine);
  if (!enginePromise) {
    enginePromise = loadConsoleHackEngine().then((loaded) => {
      engine = loaded;
      return loaded;
    });
  }
  return enginePromise;
}

/** @returns {ConsoleHackEngine} */
function requireEngine() {
  if (!engine) {
    throw new Error("Console hack WASM not loaded — call initConsoleHackBridge() first");
  }
  return engine;
}

/** @param {number} row @param {number} col */
export function hackNodeId(row, col) {
  return `node-${row}-${col}`;
}

/** @param {HackGameState} state @param {string} id */
export function getNode(state, id) {
  return state.nodes.find((n) => n.id === id) ?? null;
}

/** @param {HackGameState} state @param {number} row @param {number} col */
export function getNodeAt(state, row, col) {
  return state.nodes.find((n) => n.row === row && n.col === col) ?? null;
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
  return requireEngine().createHackGameState(opts);
}

/** @param {HackGameState} state */
export function startHack(state) {
  return requireEngine().startHack(state);
}

/** @param {HackGameState} state */
export function resetHack(state) {
  return requireEngine().resetHack(state);
}

/** @param {HackGameState} state */
export function resetHackAfterSecurityDeath(state) {
  return requireEngine().resetHackAfterSecurityDeath(state);
}

/** @param {HackGameState} state */
export function resetHackAfterTimerExpiry(state) {
  return requireEngine().resetHackAfterTimerExpiry(state);
}

/** @param {HackGameState} state */
export function canHackRetry(state) {
  return (state.retriesUsed ?? 0) < HACK_MAX_RETRIES;
}

/** @param {HackGameState} state */
export function isHackRetriesExhausted(state) {
  return requireEngine().isHackRetriesExhausted(state);
}

/** @param {HackGameState} state */
export function getHackRetriesLabel(state) {
  return requireEngine().getHackRetriesLabel(state);
}

/** @param {HackGameState} state */
export function exitHack(state) {
  return { ...state, status: "idle" };
}

/** @param {HackGameState} state */
export function isHackSecurityFailure(state) {
  return requireEngine().isHackSecurityFailure(state);
}

export function isHackTimerExpired(state) {
  return requireEngine().isHackTimerExpired(state);
}

export function isHackTimerTicking(state) {
  return requireEngine().isHackTimerTicking(state);
}

/** @param {HackGameState} state @param {number} deltaMs */
export function tickHackTimer(state, deltaMs) {
  return requireEngine().tickHackTimer(state, deltaMs);
}

/** @param {HackGameState} state @param {string} nodeId */
export function selectNodeByMouse(state, nodeId) {
  return requireEngine().selectNodeByMouse(state, nodeId);
}

/** @param {HackGameState} state */
export function rotateSelectedNode(state) {
  return requireEngine().rotateSelectedNode(state);
}

/** @param {HackGameState} state @param {"w" | "a" | "s" | "d"} key */
export function navigateHackSelection(state, key) {
  return requireEngine().navigateHackSelection(state, key);
}

/** @param {HackGameState} state */
export function getActivePointerTarget(state) {
  return requireEngine().getActivePointerTarget(state);
}

/** @param {HackGameState} state */
export function getStartPointerTarget(state) {
  return requireEngine().getStartPointerTarget(state);
}

/** @param {HackGameState} state */
export function getRewardPointerTarget(state) {
  return requireEngine().getRewardPointerTarget(state);
}

/** @param {HackGameState} state @param {HackPuzzleNode} candidate */
export function isSelectableNeighbor(state, candidate) {
  if (!candidate) return false;
  return requireEngine().isSelectableNeighbor(state, candidate.id);
}

/** @param {HackGameState} state */
export function confirmSelectedNode(state) {
  return requireEngine().confirmSelectedNode(state);
}

/** @param {HackGameState} state */
export function getHackStatusText(state) {
  return requireEngine().getHackStatusText(state);
}

/** @param {HackGameState} state */
export function getHackObjectiveCount(state) {
  return requireEngine().getHackObjectiveCount(state);
}

/** @param {HackGameState} state */
export function getHackRouteProgressPct(state) {
  return requireEngine().getHackRouteProgressPct(state);
}

/** @param {HackGameState} state @param {string} nodeId */
export function getHackNodeVisualState(state, nodeId) {
  return requireEngine().getHackNodeVisualState(state, nodeId);
}

/** @param {HackGameState} state */
export function getHackRoutePath(state) {
  return requireEngine().getHackRoutePath(state);
}

/** @param {number} seed @param {number} [salt] */
export function rollHackRewards(seed, salt = 0) {
  return requireEngine().rollHackRewards(seed, salt);
}

/** Loot table for the hack UI — chances shown before success. */
export function getHackPotentialRewardPreview() {
  const ammoMagChance = HACK_REWARD_AMMO_MAG_CHANCE * 0.5;
  return [
    { key: "credits", text: "+ 250 CREDITS", chance: HACK_REWARD_CHANCES.credits },
    { key: "ammo", text: "+ 1 PISTOL MAG", chance: ammoMagChance },
    { key: "rifleAmmo", text: "+ 1 RIFLE MAG", chance: ammoMagChance },
    { key: "medkit", text: "+ 1 MEDKIT", chance: HACK_REWARD_CHANCES.medkit },
    { key: "grenade", text: "+ 1-2 GRENADES", chance: HACK_REWARD_CHANCES.grenade },
    { key: "flashbang", text: "+ 1-2 FLASHBANGS", chance: HACK_REWARD_CHANCES.flashbang },
    { key: "rifle", text: "+ RIFLE UNLOCK", chance: HACK_REWARD_CHANCES.rifle },
  ];
}

/**
 * @param {HackRewards} rewards
 * @returns {Array<{
 *   key: string,
 *   text: string,
 *   pickup: { type: string, label?: string },
 * }>}
 */
export function formatHackGrantedRewards(rewards, opts = {}) {
  /** @type {ReturnType<typeof formatHackGrantedRewards>} */
  const items = [];
  const grantRifleAmmo = opts.grantRifleAmmo ?? true;
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
    const text = "+ 1 PISTOL MAG";
    items.push({
      key: "ammo",
      text,
      pickup: { type: "ammo", label: text },
    });
  }
  const rifleSpareMag = rewards.rifleSpareMag ?? 0;
  if (rifleSpareMag > 0 && grantRifleAmmo) {
    const text = `+ ${rifleSpareMag} RIFLE MAG${rifleSpareMag > 1 ? "S" : ""}`;
    items.push({
      key: "rifleAmmo",
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
  const grenade = rewards.grenade ?? 0;
  if (grenade > 0) {
    const text = `+ ${grenade} GRENADE${grenade > 1 ? "S" : ""}`;
    items.push({
      key: "grenade",
      text,
      pickup: { type: "grenade", label: text },
    });
  }
  const flashbang = rewards.flashbang ?? 0;
  if (flashbang > 0) {
    const text = `+ ${flashbang} FLASHBANG${flashbang > 1 ? "S" : ""}`;
    items.push({
      key: "flashbang",
      text,
      pickup: { type: "grenade", label: text },
    });
  }
  if (rewards.rifle) {
    items.push({
      key: "rifle",
      text: "+ RIFLE UNLOCK",
      pickup: { type: "rifle", label: "+ RIFLE UNLOCK" },
    });
  }
  return items;
}
