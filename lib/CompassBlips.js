/** Matches radar range in FpsGame.jsx */
export const COMPASS_BLIP_RANGE = 30;

/** Half-viewport bearing limit — matches LevelCollectibles compass markers. */
const COMPASS_BLIP_FOV_DEG = 52.5;
const ENEMY_BLIP_LAYER = "hudCompassEnemyBlips";
const REWARD_BLIP_LAYER = "hudCompassRewardBlips";

const _enemyRelScratch = [];
const _enemyDistSqScratch = [];
const _rewardRelScratch = [];
const _blipLayerCache = new WeakMap();

function relativeBearingDeg(playerX, playerZ, playerYaw, wx, wz) {
  const dx = wx - playerX;
  const dz = wz - playerZ;
  const targetYaw = -Math.atan2(dx, -dz);
  let rel = ((playerYaw - targetYaw) * 180) / Math.PI;
  while (rel > 180) rel -= 360;
  while (rel < -180) rel += 360;
  return { rel, distSq: dx * dx + dz * dz };
}

function syncDotChildren(container, count, className) {
  if (!container) return;
  while (container.children.length > count) container.lastChild.remove();
  while (container.children.length < count) {
    const dot = document.createElement("div");
    dot.className = className;
    container.appendChild(dot);
  }
}

function getBlipLayer(container, layerClass) {
  let cache = _blipLayerCache.get(container);
  if (!cache) {
    cache = {};
    _blipLayerCache.set(container, cache);
  }
  let layer = cache[layerClass];
  if (layer?.parentElement === container) return layer;

  layer = container.querySelector(`.${layerClass}`);
  if (!layer) {
    layer = document.createElement("div");
    layer.className = layerClass;
    container.appendChild(layer);
  }
  cache[layerClass] = layer;
  return layer;
}

/**
 * @param {HTMLElement | null} container
 * @param {import("three").Object3D[]} targets
 */
export function updateCompassEnemyBlips(
  container,
  targets,
  playerX,
  playerZ,
  playerYaw,
  viewport,
  pxPerDeg,
  centerPx = viewport.offsetWidth * 0.5
) {
  if (!container) return;

  const layer = getBlipLayer(container, ENEMY_BLIP_LAYER);
  if (!targets?.length) {
    syncDotChildren(layer, 0, "hudCompassBlip hudCompassBlipEnemy");
    return;
  }
  const rangeSq = COMPASS_BLIP_RANGE * COMPASS_BLIP_RANGE;
  let visibleCount = 0;

  for (const t of targets) {
    if (!t.visible || t.userData.health <= 0) continue;
    const { rel, distSq } = relativeBearingDeg(
      playerX,
      playerZ,
      playerYaw,
      t.position.x,
      t.position.z
    );
    if (distSq > rangeSq || Math.abs(rel) > COMPASS_BLIP_FOV_DEG) continue;
    _enemyRelScratch[visibleCount] = rel;
    _enemyDistSqScratch[visibleCount] = distSq;
    visibleCount += 1;
  }

  syncDotChildren(layer, visibleCount, "hudCompassBlip hudCompassBlipEnemy");
  for (let i = 0; i < visibleCount; i++) {
    const dot = layer.children[i];
    dot.style.left = `${centerPx + _enemyRelScratch[i] * pxPerDeg}px`;
    const dist = Math.sqrt(_enemyDistSqScratch[i]);
    dot.style.opacity = String(Math.max(0.55, 1 - (dist / COMPASS_BLIP_RANGE) * 0.4));
  }
}

/**
 * @param {HTMLElement | null} container
 * @param {{ collected?: boolean, mesh?: import("three").Object3D }[]} drops
 */
export function updateCompassRewardBlips(
  container,
  drops,
  playerX,
  playerZ,
  playerYaw,
  viewport,
  pxPerDeg,
  centerPx = viewport.offsetWidth * 0.5
) {
  if (!container) return;

  const layer = getBlipLayer(container, REWARD_BLIP_LAYER);
  const rangeSq = COMPASS_BLIP_RANGE * COMPASS_BLIP_RANGE;
  let visibleCount = 0;

  for (const d of drops) {
    if (d.collected || !d.mesh?.position) continue;
    const { rel, distSq } = relativeBearingDeg(
      playerX,
      playerZ,
      playerYaw,
      d.mesh.position.x,
      d.mesh.position.z
    );
    if (distSq > rangeSq || Math.abs(rel) > COMPASS_BLIP_FOV_DEG) continue;
    _rewardRelScratch[visibleCount] = rel;
    visibleCount += 1;
  }

  syncDotChildren(layer, visibleCount, "hudCompassBlip hudCompassBlipReward");
  for (let i = 0; i < visibleCount; i++) {
    const dot = layer.children[i];
    dot.style.left = `${centerPx + _rewardRelScratch[i] * pxPerDeg}px`;
    dot.style.opacity = "0.85";
  }
}
