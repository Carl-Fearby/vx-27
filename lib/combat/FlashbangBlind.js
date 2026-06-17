/**
 * Flashbang blind timing and overlay opacity — Rust via game_core (WASM required).
 */

import { requireWasmMethod } from "@/lib/game-core/requireWasm.js";

/** @typedef {import("@/lib/game-core/types.ts").GameCoreEngine} GameCoreEngine */
/** @typedef {{
 *   blindStart: number,
 *   blindFadeEnd: number,
 *   blinding: boolean,
 * }} FlashbangBlindApplyOutput */

export const FLASHBANG_BLIND_FULL_SEC = 3;
export const FLASHBANG_BLIND_DIM_SEC = 0;
export const FLASHBANG_BLIND_FADE_SEC = 2.5;
export const FLASHBANG_BLIND_FULL_OPACITY = 1;
/** @deprecated Dim phase removed — kept for compatibility. */
export const FLASHBANG_BLIND_DIM_OPACITY = 0.9;

/** @param {GameCoreEngine} gameCore */
export function getFlashbangBlindDurationSec(gameCore) {
  return requireWasmMethod(gameCore, "getFlashbangBlindDurationSec")();
}

/**
 * @param {number} elapsedSec
 * @param {GameCoreEngine} gameCore
 */
export function getFlashbangOverlayOpacity(elapsedSec, gameCore) {
  return requireWasmMethod(gameCore, "getFlashbangOverlayOpacity")(elapsedSec);
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {number} simTime
 * @param {boolean} currentlyBlinding
 * @param {number} blindStart
 * @param {number} blindFadeEnd
 * @returns {FlashbangBlindApplyOutput}
 */
export function applyFlashbangBlindToTarget(
  gameCore,
  simTime,
  currentlyBlinding,
  blindStart,
  blindFadeEnd,
) {
  return requireWasmMethod(gameCore, "applyFlashbangBlindToTarget")(
    simTime,
    currentlyBlinding,
    blindStart,
    blindFadeEnd,
  );
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {number} simTime
 * @param {number} fadeEnd
 */
export function isFlashbangBlindExpired(gameCore, simTime, fadeEnd) {
  return requireWasmMethod(gameCore, "isFlashbangBlindExpired")(simTime, fadeEnd);
}
