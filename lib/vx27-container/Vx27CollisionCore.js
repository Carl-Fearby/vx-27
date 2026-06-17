import { requireWasmMethod } from "@/lib/game-core/requireWasm.js";

/** @param {import("../physics/Collision.js").ColliderBox} box */
export function vx27ColliderToInput(box) {
  return {
    rotationY: box.rotationY ?? 0,
    containerCx: box.containerCx ?? null,
    containerCz: box.containerCz ?? null,
    containerHalfW: box.containerHalfW ?? null,
    containerHalfL: box.containerHalfL ?? null,
    containerPart: box.containerPart ?? null,
    containerEdgeRadius: box.containerEdgeRadius ?? 0,
    exteriorCornerRadius: box.exteriorCornerRadius ?? 0,
    containerOpenHalfW: box.containerOpenHalfW ?? null,
    containerInnerHalfL: box.containerInnerHalfL ?? null,
    bottomY: box.bottomY ?? null,
    topY: box.topY ?? null,
    kind: box.kind ?? null,
  };
}

/** @param {import("@/lib/game-core/types.ts").GameCoreEngine} gameCore @param {import("../physics/Collision.js").ColliderBox} box */
export function isVx27ContainerEndOrDoorColliderCore(gameCore, box) {
  return requireWasmMethod(gameCore, "isVx27ContainerEndOrDoorCollider")(
    vx27ColliderToInput(box),
  );
}

/** @param {import("@/lib/game-core/types.ts").GameCoreEngine} gameCore @param {import("../physics/Collision.js").ColliderBox} box */
export function isVx27ContainerHorizontalColliderCore(gameCore, box) {
  return requireWasmMethod(gameCore, "isVx27ContainerHorizontalCollider")(
    vx27ColliderToInput(box),
  );
}

/** @param {import("@/lib/game-core/types.ts").GameCoreEngine} gameCore */
export function isVx27ContainerColliderNearPlayerCore(
  gameCore,
  box,
  worldX,
  worldZ,
  margin = 1.25,
) {
  return requireWasmMethod(gameCore, "isVx27ContainerColliderNearPlayer")(
    vx27ColliderToInput(box),
    worldX,
    worldZ,
    margin,
  );
}

/** @param {import("@/lib/game-core/types.ts").GameCoreEngine} gameCore */
export function pointInVx27ExteriorColliderFootprintCore(
  gameCore,
  box,
  x,
  z,
  radius = 0,
) {
  return requireWasmMethod(gameCore, "pointInVx27ExteriorColliderFootprint")(
    vx27ColliderToInput(box),
    x,
    z,
    radius,
  );
}

/** @param {import("@/lib/game-core/types.ts").GameCoreEngine} gameCore */
export function shouldSkipVx27ContainerColliderCore(
  gameCore,
  box,
  worldX,
  worldZ,
  footY = null,
) {
  return requireWasmMethod(gameCore, "shouldSkipVx27ContainerCollider")(
    vx27ColliderToInput(box),
    worldX,
    worldZ,
    footY,
  );
}

/** @param {import("@/lib/game-core/types.ts").GameCoreEngine} gameCore */
export function shouldSkipVx27ContainerHeadroomCore(
  gameCore,
  box,
  worldX,
  worldZ,
  footY = null,
) {
  return requireWasmMethod(gameCore, "shouldSkipVx27ContainerHeadroom")(
    vx27ColliderToInput(box),
    worldX,
    worldZ,
    footY,
  );
}
