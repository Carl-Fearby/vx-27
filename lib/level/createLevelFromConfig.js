import { createLevelFromArena } from "./Level.js";
import { createCorridorLevel } from "./CorridorLevel.js";

/**
 * @param {THREE.Scene} scene
 * @param {import("./loadArena.js").ArenaConfig} arena
 * @param {Awaited<ReturnType<import("./LevelTextures.js").loadLevelTextureLibrary>>} [textureLibrary]
 */
export function createLevelFromConfig(scene, arena, textureLibrary = null) {
  if (arena.levelType === "corridor" || arena.corridor) {
    return createCorridorLevel(scene, arena, textureLibrary);
  }
  return createLevelFromArena(scene, arena, textureLibrary);
}
