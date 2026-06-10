/**
 * Global viewmodel / enclosed-space lighting rules.
 *
 * Uses player feet (not camera) so lean/look does not flip weapon lighting early.
 *
 * | Zone              | Sun/moon on viewmodel | Viewmodel fill ambient | Room point lights on VM |
 * |-------------------|-----------------------|------------------------|-------------------------|
 * | outdoor           | yes                   | off                    | no                      |
 * | room              | no                    | warm (0.04)            | yes                     |
 * | container         | no                    | cool blue (0.025)      | yes (ceiling point, room pass)  |
 *
 * Catwalk deck above an attached room is always outdoor for the viewmodel layer.
 * Room render pass (geometry) stays separate — see updateRoomCulling + isIndoorLightingZone.
 */

import {
  isOnCatwalkDeck,
  isPointInsideAnyRoomForViewmodel,
} from "../rooms/RoomPlacement.js";
import { isPointInsideVx27ContainerPlayVolume } from "../vx27-container/Vx27Container.js";

/** @typedef {"outdoor" | "room" | "container"} ViewmodelLightingZone */

export const VIEWMODEL_AMBIENT_ROOM = Object.freeze({
  color: 0xffcc99,
  intensity: 0.04,
});

/** Cool fill inside VX-27 cargo (ceiling point + room ambient). */
export const VIEWMODEL_AMBIENT_CONTAINER = Object.freeze({
  color: 0x8eb8ff,
  intensity: 0.025,
});

/** @param {ViewmodelLightingZone} zone */
export function isEnclosedViewmodelZone(zone) {
  return zone === "room" || zone === "container";
}

/**
 * Resolve which lighting recipe the first-person weapon uses this frame.
 *
 * @param {{
 *   x: number,
 *   z: number,
 *   footY?: number | null,
 *   rooms?: import("../level/loadArena.js").ArenaRoom[],
 *   arenaHalf: number,
 *   attachWall: "north" | "south",
 *   arenaWallThickness?: number,
 *   catwalkDeckY?: number | null,
 *   colliders?: import("../physics/Collision.js").ColliderBox[],
 *   forceInterior?: boolean,
 * }} params
 * @returns {ViewmodelLightingZone}
 */
export function resolveViewmodelLightingZone({
  x,
  z,
  footY = null,
  rooms = [],
  arenaHalf,
  attachWall,
  arenaWallThickness = 0.5,
  catwalkDeckY = null,
  colliders = [],
  forceInterior = false,
}) {
  if (forceInterior) return "room";
  if (isOnCatwalkDeck(footY, catwalkDeckY)) return "outdoor";
  if (
    isPointInsideAnyRoomForViewmodel(
      x,
      z,
      rooms,
      arenaHalf,
      attachWall,
      arenaWallThickness
    )
  ) {
    return "room";
  }
  if (isPointInsideVx27ContainerPlayVolume(x, z, colliders)) {
    return "container";
  }
  return "outdoor";
}

/**
 * @param {ViewmodelLightingZone} zone
 * @returns {{ color: number, intensity: number } | null}
 */
export function viewmodelAmbientForZone(zone) {
  if (zone === "room") return VIEWMODEL_AMBIENT_ROOM;
  if (zone === "container") return VIEWMODEL_AMBIENT_CONTAINER;
  return null;
}
