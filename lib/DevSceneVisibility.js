/** Dev perf toggles — hide scene layers without removing collision. */

export const DEV_SHOW_BARRELS_KEY = "fps-dev-show-barrels";
export const DEV_SHOW_ENEMIES_KEY = "fps-dev-show-enemies";
export const DEV_SHOW_STAIRS_KEY = "fps-dev-show-stairs";
export const DEV_SHOW_CONTAINERS_KEY = "fps-dev-show-containers";
export const DEV_SHOW_PILLARS_KEY = "fps-dev-show-pillars";
export const DEV_SHOW_LENS_FLARE_KEY = "fps-dev-show-lens-flare";
export const DEV_SHOW_SUN_DISC_KEY = "fps-dev-show-sun-disc";

/** @param {string} key @returns {boolean} */
export function loadDevSceneShow(key) {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(key);
  if (stored === null) return true;
  return stored === "true";
}

/** @param {THREE.Object3D | null | undefined} root @param {boolean} visible */
export function setBarrelsVisible(root, visible) {
  root?.traverse((obj) => {
    if (obj.name === "oil_barrel") obj.visible = visible;
  });
}

/** @param {THREE.Mesh[]} [targets] @param {boolean} visible */
export function setTargetsVisible(targets, visible) {
  for (const mesh of targets ?? []) {
    mesh.visible = visible;
    const bar = mesh.userData?.healthBar;
    if (bar) bar.visible = visible;
  }
}

/** @param {THREE.Object3D | null | undefined} root @param {boolean} visible */
export function setStairsVisible(root, visible) {
  const stairs = root?.getObjectByName("arena_stairs");
  if (stairs) stairs.visible = visible;
}

/** @param {THREE.Object3D[]} [containers] @param {boolean} visible */
export function setContainersVisible(containers, visible) {
  for (const group of containers ?? []) {
    if (group) group.visible = visible;
  }
}

/** @param {THREE.Mesh[]} [pillars] @param {boolean} visible */
export function setPillarsVisible(pillars, visible) {
  for (const mesh of pillars ?? []) {
    if (mesh) mesh.visible = visible;
  }
}

/**
 * @param {{
 *   levelGroup?: THREE.Object3D | null,
 *   targets?: THREE.Mesh[],
 *   containers?: THREE.Object3D[],
 *   pillars?: THREE.Mesh[],
 *   sky?: { setSunDiscVisible?: (v: boolean) => void, setLensFlareEnabled?: (v: boolean) => void } | null,
 *   showBarrels?: boolean,
 *   showEnemies?: boolean,
 *   showStairs?: boolean,
 *   showContainers?: boolean,
 *   showPillars?: boolean,
 *   showLensFlare?: boolean,
 *   showSunDisc?: boolean,
 * }} opts
 */
export function applyDevSceneVisibility(opts) {
  const {
    levelGroup,
    targets,
    containers,
    pillars,
    sky,
    showBarrels = true,
    showEnemies = true,
    showStairs = true,
    showContainers = true,
    showPillars = true,
    showLensFlare = true,
    showSunDisc = true,
  } = opts;

  if (levelGroup) {
    setBarrelsVisible(levelGroup, showBarrels);
    setStairsVisible(levelGroup, showStairs);
  }
  setTargetsVisible(targets, showEnemies);
  setContainersVisible(containers, showContainers);
  setPillarsVisible(pillars, showPillars);
  sky?.setSunDiscVisible?.(showSunDisc);
  sky?.setLensFlareEnabled?.(showLensFlare);
}
