import { requireWasmMethod } from "@/lib/game-core/requireWasm.js";
import { playerColliderToInput } from "@/lib/physics/CollisionCore.js";

/** @typedef {{ minX: number, maxX: number, minZ: number, maxZ: number, y: number, stairFlight?: boolean, stairRamp?: boolean, roomInteriorFloor?: boolean, catwalkWalk?: boolean, arenaCatwalkDeck?: boolean }} GroundSurfaceLike */

/** @param {GroundSurfaceLike} surf */
export function groundSurfaceToInput(surf) {
  return {
    minX: surf.minX ?? null,
    maxX: surf.maxX ?? null,
    minZ: surf.minZ ?? null,
    maxZ: surf.maxZ ?? null,
    y: surf.y ?? null,
    stairFlight: Boolean(surf.stairFlight),
    stairRamp: Boolean(surf.stairRamp),
    roomInteriorFloor: Boolean(surf.roomInteriorFloor),
    catwalkWalk: Boolean(surf.catwalkWalk),
  };
}

/** @param {import("@/lib/game-core/types.ts").GameCoreEngine} gameCore */
export function sampleFlatSupportAtCore(gameCore, input) {
  return requireWasmMethod(gameCore, "sampleFlatSupportAt")({
    ...input,
    groundSurfaces: (input.groundSurfaces ?? []).map(groundSurfaceToInput),
    colliders: (input.colliders ?? [])
      .map(playerColliderToInput)
      .filter(Boolean),
  });
}

/** @param {import("@/lib/game-core/types.ts").GameCoreEngine} gameCore */
export function resolveSupportInfoCore(gameCore, input) {
  return requireWasmMethod(gameCore, "resolveSupportInfo")(input);
}

export { playerColliderToInput };
