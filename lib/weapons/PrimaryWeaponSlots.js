import {
  getStackDepthInOrder,
  getStackFrameStyleFromDepth,
  resolveStackSelection,
} from "../ui/WeaponStackLayout.js";

/** @typedef {import("./PrimaryWeapons.js").PrimaryWeaponId} PrimaryWeaponId */

/** Bottom-left primary stack — V/B/N (keeps 1–4 free for bombs on the right). */
export const PRIMARY_SLOT_KEYS = ["V", "B", "N"];

export const RIFLE_PRIMARY_SLOT = "V";
export const PISTOL_PRIMARY_SLOT = "B";
export const RESERVED_PRIMARY_SLOT = "N";

/**
 * @type {Record<string, { weaponId: PrimaryWeaponId, keyCode: string, icon?: string } | null>}
 */
export const PRIMARY_SLOT_UI = {
  [RIFLE_PRIMARY_SLOT]: { weaponId: "rifle", keyCode: "KeyV" },
  [PISTOL_PRIMARY_SLOT]: { weaponId: "pistol", keyCode: "KeyB" },
  [RESERVED_PRIMARY_SLOT]: null,
};

/** Mirror of the right super-weapon stack fan (negate X, same Y/scale). */
export const DEFAULT_PRIMARY_STACK_TUNE = {
  1: { x: 39, y: -137, scale: 0.8 },
  2: { x: 21, y: -94, scale: 0.8 },
  3: { x: 12, y: -52, scale: 0.8 },
};

/** @param {PrimaryWeaponId} id */
export function getPrimarySlotForWeapon(id) {
  return id === "pistol" ? PISTOL_PRIMARY_SLOT : RIFLE_PRIMARY_SLOT;
}

/** @param {string} slotKey */
export function getWeaponIdForPrimarySlot(slotKey) {
  return PRIMARY_SLOT_UI[slotKey]?.weaponId ?? null;
}

/** @param {string} slotKey */
export function getPrimarySlotKeyCode(slotKey) {
  return PRIMARY_SLOT_UI[slotKey]?.keyCode ?? null;
}

/** Either key cycles rifle ↔ pistol (labels stay on the HUD cards). */
export const PRIMARY_TOGGLE_KEY_CODES = ["KeyV", "KeyB"];

/** @param {{ wasPressed: (code: string) => boolean }} input */
export function wasPrimaryTogglePressed(input) {
  return PRIMARY_TOGGLE_KEY_CODES.some((code) => input.wasPressed(code));
}

/** Slot keys that have a configured primary weapon. */
export function getVisiblePrimarySlotKeys() {
  return PRIMARY_SLOT_KEYS.filter((key) => PRIMARY_SLOT_UI[key]?.weaponId);
}

/**
 * @param {string} slotKey
 * @param {string} activeSlotKey
 * @param {string[]} [visibleOrder]
 */
export function getPrimarySlotStackFrameStyle(
  slotKey,
  activeSlotKey,
  visibleOrder = getVisiblePrimarySlotKeys(),
) {
  const selected = resolveStackSelection(activeSlotKey, visibleOrder);
  if (selected == null) {
    return getStackFrameStyleFromDepth(0, DEFAULT_PRIMARY_STACK_TUNE);
  }
  const depth = getStackDepthInOrder(slotKey, selected, visibleOrder);
  return getStackFrameStyleFromDepth(
    depth,
    DEFAULT_PRIMARY_STACK_TUNE,
    visibleOrder.length,
  );
}
