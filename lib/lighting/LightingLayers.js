/** World arena / targets / outdoor geometry (sun, ambient, fill). */
export const WORLD_LAYER = 0;
/** First-person weapon — lit by the same pass as the zone the player is in. */
export const VIEWMODEL_LAYER = 1;
/** Interior rooms — only room point lights; not lit by outdoor sun/ambient. */
export const ROOM_INTERIOR_LAYER = 2;
/** Target health bar sprites — drawn after world/room so they stay visible indoors. */
export const HEALTH_BAR_LAYER = 3;
/** Sky dome, sun/moon billboards, lens flares — drawn before world (depthTest off). */
export const SKY_LAYER = 4;
/** ADS gun reticule — drawn in its own pass immediately before the viewmodel. */
export const CROSSHAIR_LAYER = 5;

/** Camera mask for all gameplay render passes (world + viewmodel + room + health bars + sky). */
export const ALL_RENDER_LAYERS_MASK =
  (1 << WORLD_LAYER) |
  (1 << VIEWMODEL_LAYER) |
  (1 << ROOM_INTERIOR_LAYER) |
  (1 << HEALTH_BAR_LAYER) |
  (1 << SKY_LAYER);

export function setHealthBarLayer(object) {
  object.layers.set(HEALTH_BAR_LAYER);
}

export function setWorldLayer(object) {
  object.layers.set(WORLD_LAYER);
}

/** Oil barrel interior video / plume meshes — skip world layer assignment. */
export const OIL_BARREL_FLAME_MESH_NAMES = new Set([
  "oil_interior_video",
  "oil_interior_plume",
  "oil_interior_flames",
]);

/** Arena / targets / doorway bridges — not under a roomInterior shell. */
export function assignWorldLayers(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    if (OIL_BARREL_FLAME_MESH_NAMES.has(obj.name)) return;
    let parent = obj.parent;
    while (parent) {
      if (parent.userData?.roomInterior || parent.userData?.containerInterior) {
        return;
      }
      parent = parent.parent;
    }
    setWorldLayer(obj);
  });
}

export function setViewmodelLayer(object) {
  object.layers.set(VIEWMODEL_LAYER);
}

export function setCrosshairLayer(object) {
  object.layers.set(CROSSHAIR_LAYER);
}

export function setRoomInteriorLayer(object) {
  object.layers.set(ROOM_INTERIOR_LAYER);
}

export function setSkyLayer(object) {
  object.layers.set(SKY_LAYER);
}

/** @param {THREE.Object3D} light @param {number[]} layerIds */
export function pinLightToLayers(light, ...layerIds) {
  light.layers.disableAll();
  for (const id of layerIds) {
    light.layers.enable(id);
  }
}

export function pinLightToWorldLayer(light) {
  pinLightToLayers(light, WORLD_LAYER);
}

export function pinLightToRoomInteriorLayer(light) {
  pinLightToLayers(light, ROOM_INTERIOR_LAYER);
}
