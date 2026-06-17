import { requireWasmMethod } from "@/lib/game-core/requireWasm.js";
import { playerColliderToInput } from "@/lib/physics/CollisionCore.js";

/** @param {import("../physics/Collision.js").ColliderBox} box */
export function headroomColliderToInput(box) {
  return {
    x: box.x,
    z: box.z,
    halfX: box.halfX,
    halfZ: box.halfZ,
    rotationY: box.rotationY ?? 0,
    cornerRadius: box.cornerRadius ?? 0,
    bottomY: box.bottomY ?? null,
    topY: box.topY ?? null,
    active: box.active !== false,
    kind: box.kind ?? null,
    mouthPlane: Boolean(box.mouthPlane),
    exteriorCornerRadius: box.exteriorCornerRadius ?? null,
    containerCx: box.containerCx ?? null,
    containerCz: box.containerCz ?? null,
    containerHalfW: box.containerHalfW ?? null,
    containerHalfL: box.containerHalfL ?? null,
    containerPart: box.containerPart ?? null,
    containerEdgeRadius: box.containerEdgeRadius ?? null,
    containerOpenHalfW: box.containerOpenHalfW ?? null,
    containerInnerHalfL: box.containerInnerHalfL ?? null,
    vx27RoofHeadroomMargin: box.vx27RoofHeadroomMargin ?? 0,
  };
}

/** @param {import("@/lib/game-core/types.ts").GameCoreEngine} gameCore */
export function hasHeadroomCore(gameCore, input) {
  return requireWasmMethod(gameCore, "hasHeadroom")(input);
}

/** @param {import("@/lib/game-core/types.ts").GameCoreEngine} gameCore */
export function resolveCeilingCollisionsCore(gameCore, input) {
  return requireWasmMethod(gameCore, "resolveCeilingCollisions")(input);
}

export { playerColliderToInput };
