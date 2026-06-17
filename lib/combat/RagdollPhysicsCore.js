import { requireWasmMethod } from "@/lib/game-core/requireWasm.js";

/** @param {import("@/lib/game-core/types.ts").GameCoreEngine} gameCore */
export function clampToBoundsCore(gameCore, px, pz, radius, bounds) {
  return requireWasmMethod(gameCore, "clampToBounds")(px, pz, radius, bounds ?? null);
}

/** @param {import("@/lib/game-core/types.ts").GameCoreEngine} gameCore */
export function tickRagdollHoleFallCore(gameCore, input) {
  return requireWasmMethod(gameCore, "tickRagdollHoleFall")(input);
}

/** @param {import("@/lib/game-core/types.ts").GameCoreEngine} gameCore */
export function tickRagdollCoreToppleCore(gameCore, input) {
  return requireWasmMethod(gameCore, "tickRagdollCoreTopple")(input);
}

/** @param {import("@/lib/game-core/types.ts").GameCoreEngine} gameCore */
export function tickRagdollLaunchCore(gameCore, input) {
  return requireWasmMethod(gameCore, "tickRagdollLaunch")(input);
}
