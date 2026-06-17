/** @typedef {import("@/lib/game-core/types.ts").GameCoreEngine} GameCoreEngine */

/**
 * @param {GameCoreEngine | null | undefined} gameCore
 * @param {keyof GameCoreEngine} method
 */
export function requireWasmMethod(gameCore, method) {
  const fn = gameCore?.[method];
  if (typeof fn !== "function") {
    throw new Error(`game_core WASM required: ${String(method)}`);
  }
  return fn.bind(gameCore);
}

/**
 * @param {GameCoreEngine | null | undefined} gameCore
 */
export function requireGameCore(gameCore) {
  if (!gameCore) {
    throw new Error("game_core WASM engine is required");
  }
  return gameCore;
}
