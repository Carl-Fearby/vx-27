import * as THREE from "three";
import {
  BULLET_MAX_RANGE,
  resolveRifleBodyDamageAtDistance,
} from "./WeaponDamage.js";
import { sampleWalkerFootYAt } from "../physics/GroundSupport.js";
import { getPrimaryWeaponStartingAmmo } from "../weapons/PrimaryWeapons.js";
import { updateEnemyRigAnimation, getEnemyMuzzleWorldPosition } from "./EnemyRig.js";

const RIFLE_STARTING_AMMO = getPrimaryWeaponStartingAmmo("rifle");

/**
 * Kill-or-be-killed rifle AI: limited magazines, reload downtime, and cover
 * when exposed or vulnerable. Arena JSON can override under `target.ai`.
 */
export const ROOKIE_ENEMY_AI = Object.freeze({
  enabled: true,
  maxRange: BULLET_MAX_RANGE,
  perceptionIntervalMin: 0.18,
  perceptionIntervalMax: 0.3,
  nearPerceptionInterval: 0.1,
  awarenessRadius: 10,
  awarenessMemorySec: 5,
  /** Horizontal cone (degrees) for spotting and shooting the player. */
  perceptionFovDeg: 100,
  reactionMin: 1.2,
  reactionMax: 2.8,
  accuracy: 0.28,
  burstMin: 1,
  burstMax: 3,
  burstSpacingMin: 0.28,
  burstSpacingMax: 0.48,
  cooldownMin: 1.8,
  cooldownMax: 3.4,
  missRadiusMin: 0.75,
  missRadiusMax: 2.5,
  movementEnabled: true,
  moveSpeed: 1.28,
  /** Run clip playback reference — keep in sync with rig anim scaling. */
  runSpeed: 2.05,
  /** World movement while panic-running (can exceed runSpeed). */
  runMoveSpeed: 3.55,
  panicRunSec: 2.8,
  turnSpeed: 5.5,
  patrolRadius: 6,
  repositionRadius: 4.5,
  holdPositionMin: 2.4,
  holdPositionMax: 4.8,
  waypointTolerance: 0.28,
  magazineSize: RIFLE_STARTING_AMMO.rounds,
  spareMagazines: RIFLE_STARTING_AMMO.spare,
  lowAmmoThreshold: 15,
  reloadMinSec: 2.1,
  reloadMaxSec: 2.9,
  coverRadius: 9,
  coverMinSec: 2.2,
  coverMaxSec: 5.5,
  dangerHealthRatio: 0.42,
  lowAmmoDangerHealthRatio: 0.62,
  recentHitDangerSec: 2.8,
  hideWhileReloading: true,
});

const _muzzle = new THREE.Vector3();
const _playerAim = new THREE.Vector3();
const _shotEnd = new THREE.Vector3();
const _shotDir = new THREE.Vector3();
const _coverChest = new THREE.Vector3();
const _coverPlayerAim = new THREE.Vector3();

function finite(value, fallback, min = -Infinity, max = Infinity) {
  const number = Number(value);
  return Number.isFinite(number)
    ? THREE.MathUtils.clamp(number, min, max)
    : fallback;
}

export function resolveEnemyAiConfig(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    enabled: source.enabled !== false,
    maxRange: finite(source.maxRange, ROOKIE_ENEMY_AI.maxRange, 2, 100),
    perceptionIntervalMin: finite(
      source.perceptionIntervalMin,
      ROOKIE_ENEMY_AI.perceptionIntervalMin,
      0.08,
      2,
    ),
    perceptionIntervalMax: finite(
      source.perceptionIntervalMax,
      ROOKIE_ENEMY_AI.perceptionIntervalMax,
      0.08,
      3,
    ),
    nearPerceptionInterval: finite(
      source.nearPerceptionInterval,
      ROOKIE_ENEMY_AI.nearPerceptionInterval,
      0.06,
      1,
    ),
    awarenessRadius: finite(
      source.awarenessRadius,
      ROOKIE_ENEMY_AI.awarenessRadius,
      2,
      40,
    ),
    awarenessMemorySec: finite(
      source.awarenessMemorySec,
      ROOKIE_ENEMY_AI.awarenessMemorySec,
      0.5,
      30,
    ),
    perceptionFovDeg: finite(
      source.perceptionFovDeg,
      ROOKIE_ENEMY_AI.perceptionFovDeg,
      20,
      360,
    ),
    reactionMin: finite(source.reactionMin, ROOKIE_ENEMY_AI.reactionMin, 0.1, 10),
    reactionMax: finite(source.reactionMax, ROOKIE_ENEMY_AI.reactionMax, 0.1, 12),
    accuracy: finite(source.accuracy, ROOKIE_ENEMY_AI.accuracy, 0, 1),
    burstMin: Math.round(finite(source.burstMin, ROOKIE_ENEMY_AI.burstMin, 1, 8)),
    burstMax: Math.round(finite(source.burstMax, ROOKIE_ENEMY_AI.burstMax, 1, 12)),
    burstSpacingMin: finite(
      source.burstSpacingMin,
      ROOKIE_ENEMY_AI.burstSpacingMin,
      0.08,
      5,
    ),
    burstSpacingMax: finite(
      source.burstSpacingMax,
      ROOKIE_ENEMY_AI.burstSpacingMax,
      0.08,
      6,
    ),
    cooldownMin: finite(source.cooldownMin, ROOKIE_ENEMY_AI.cooldownMin, 0.1, 20),
    cooldownMax: finite(source.cooldownMax, ROOKIE_ENEMY_AI.cooldownMax, 0.1, 24),
    missRadiusMin: finite(
      source.missRadiusMin,
      ROOKIE_ENEMY_AI.missRadiusMin,
      0.25,
      20,
    ),
    missRadiusMax: finite(
      source.missRadiusMax,
      ROOKIE_ENEMY_AI.missRadiusMax,
      0.25,
      30,
    ),
    movementEnabled: source.movementEnabled !== false,
    moveSpeed: finite(source.moveSpeed, ROOKIE_ENEMY_AI.moveSpeed, 0.2, 8),
    runSpeed: finite(source.runSpeed, ROOKIE_ENEMY_AI.runSpeed, 0.5, 10),
    runMoveSpeed: finite(source.runMoveSpeed, ROOKIE_ENEMY_AI.runMoveSpeed, 0.5, 12),
    panicRunSec: finite(source.panicRunSec, ROOKIE_ENEMY_AI.panicRunSec, 0.5, 12),
    turnSpeed: finite(source.turnSpeed, ROOKIE_ENEMY_AI.turnSpeed, 1, 16),
    patrolRadius: finite(source.patrolRadius, ROOKIE_ENEMY_AI.patrolRadius, 1, 30),
    repositionRadius: finite(
      source.repositionRadius,
      ROOKIE_ENEMY_AI.repositionRadius,
      1,
      20,
    ),
    holdPositionMin: finite(
      source.holdPositionMin,
      ROOKIE_ENEMY_AI.holdPositionMin,
      0.25,
      30,
    ),
    holdPositionMax: finite(
      source.holdPositionMax,
      ROOKIE_ENEMY_AI.holdPositionMax,
      0.25,
      40,
    ),
    waypointTolerance: finite(
      source.waypointTolerance,
      ROOKIE_ENEMY_AI.waypointTolerance,
      0.05,
      2,
    ),
    magazineSize: Math.round(
      finite(source.magazineSize, ROOKIE_ENEMY_AI.magazineSize, 1, 200),
    ),
    spareMagazines: Math.round(
      finite(source.spareMagazines, ROOKIE_ENEMY_AI.spareMagazines, 0, 20),
    ),
    lowAmmoThreshold: Math.round(
      finite(source.lowAmmoThreshold, ROOKIE_ENEMY_AI.lowAmmoThreshold, 0, 100),
    ),
    reloadMinSec: finite(source.reloadMinSec, ROOKIE_ENEMY_AI.reloadMinSec, 0.5, 12),
    reloadMaxSec: finite(source.reloadMaxSec, ROOKIE_ENEMY_AI.reloadMaxSec, 0.5, 14),
    coverRadius: finite(source.coverRadius, ROOKIE_ENEMY_AI.coverRadius, 2, 30),
    coverMinSec: finite(source.coverMinSec, ROOKIE_ENEMY_AI.coverMinSec, 0.5, 20),
    coverMaxSec: finite(source.coverMaxSec, ROOKIE_ENEMY_AI.coverMaxSec, 0.5, 30),
    dangerHealthRatio: finite(
      source.dangerHealthRatio,
      ROOKIE_ENEMY_AI.dangerHealthRatio,
      0.05,
      1,
    ),
    lowAmmoDangerHealthRatio: finite(
      source.lowAmmoDangerHealthRatio,
      ROOKIE_ENEMY_AI.lowAmmoDangerHealthRatio,
      0.05,
      1,
    ),
    recentHitDangerSec: finite(
      source.recentHitDangerSec,
      ROOKIE_ENEMY_AI.recentHitDangerSec,
      0.2,
      15,
    ),
    hideWhileReloading: source.hideWhileReloading !== false,
  };
}

function randomBetween(min, max) {
  return min + Math.random() * Math.max(0, max - min);
}

function randomIntBetween(min, max) {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Math.floor(randomBetween(low, high + 1));
}

function isReloading(state, simTime) {
  return state.reloadingUntil > simTime;
}

function ensureAmmoState(state, mesh, config) {
  if (state.roundsInMag == null) state.roundsInMag = config.magazineSize;
  if (state.spareMags == null) state.spareMags = config.spareMagazines;
  state.reloadingUntil ??= 0;
  state.lastHealth ??= mesh.userData.health ?? mesh.userData.maxHealth ?? 1;
  state.lastHitAt ??= 0;
  state.coverUntil ??= 0;
}

function ensureAiState(mesh, simTime, config) {
  let state = mesh.userData.enemyAi;
  if (state) {
    state.nextPerceptionAt ??= simTime;
    state.hasPlayerLineOfSight ??= false;
    state.path ??= [];
    state.pathIndex ??= 0;
    state.mode ??= "patrol";
    state.nextMoveDecisionAt ??= simTime;
    state.holdPositionUntil ??= 0;
    state.awareUntil ??= 0;
    state.lastKnownPlayerAt ??= 0;
    state.moveDirectionX ??= 0;
    state.moveDirectionZ ??= 0;
    state.panicRunUntil ??= 0;
    ensureAmmoState(state, mesh, config);
    return state;
  }
  state = {
    nextShotAt: simTime + randomBetween(config.reactionMin, config.reactionMax),
    burstRemaining: 0,
    mode: "patrol",
    path: [],
    pathIndex: 0,
    nextMoveDecisionAt: simTime + randomBetween(0.4, 1.4),
    holdPositionUntil: 0,
    lastKnownPlayer: null,
    nextPerceptionAt: simTime + randomBetween(
      0,
      config.perceptionIntervalMax,
    ),
    hasPlayerLineOfSight: false,
    awareUntil: 0,
    lastKnownPlayerAt: 0,
    roundsInMag: config.magazineSize,
    spareMags: config.spareMagazines,
    reloadingUntil: 0,
    lastHealth: mesh.userData.health ?? mesh.userData.maxHealth ?? 1,
    lastHitAt: 0,
    panicRunUntil: 0,
    coverUntil: 0,
    moveDirectionX: 0,
    moveDirectionZ: 0,
  };
  mesh.userData.enemyAi = state;
  return state;
}

function updateDangerMemory(mesh, state, simTime, config) {
  const health = mesh.userData.health ?? 0;
  if (health < state.lastHealth) {
    state.lastHitAt = simTime;
    state.panicRunUntil = simTime + config.panicRunSec;
  }
  state.lastHealth = health;
}

function isFleeing(state, simTime, config) {
  return panicRunBlend(state, simTime, config) > 0;
}

function chooseFleeAwayPath(state, navigation, mesh, playerPosition, config) {
  if (!navigation || !playerPosition) return false;
  const footPosition = footPositionFromMesh(mesh);
  const awayX = footPosition.x - playerPosition.x;
  const awayZ = footPosition.z - playerPosition.z;
  const awayLen = Math.hypot(awayX, awayZ) || 1;
  const dirX = awayX / awayLen;
  const dirZ = awayZ / awayLen;
  const fleeDistances = [
    config.coverRadius * 0.9,
    config.coverRadius * 0.65,
    config.patrolRadius * 0.75,
  ];
  for (const distance of fleeDistances) {
    const destination = {
      x: footPosition.x + dirX * distance,
      y: footPosition.y,
      z: footPosition.z + dirZ * distance,
    };
    if (setPath(state, navigation, mesh, destination)) return true;
  }
  return false;
}

function beginFlee(
  state,
  navigation,
  mesh,
  playerPosition,
  simTime,
  config,
  levelHitMeshes,
  hasLineOfSight,
) {
  state.mode = "cover";
  state.coverUntil = Math.max(
    state.coverUntil,
    simTime + config.panicRunSec,
  );
  clearPath(state);
  if (
    chooseCoverPath(
      state,
      navigation,
      mesh,
      playerPosition,
      config,
      levelHitMeshes,
      hasLineOfSight,
    )
  ) {
    return;
  }
  chooseFleeAwayPath(state, navigation, mesh, playerPosition, config);
}

function panicRunBlend(state, simTime, config) {
  if (state.panicRunUntil <= simTime) return 0;
  const remaining = state.panicRunUntil - simTime;
  return THREE.MathUtils.clamp(remaining / config.panicRunSec, 0, 1);
}

function resolveMoveSpeed(state, simTime, config) {
  const blend = panicRunBlend(state, simTime, config);
  if (blend <= 0) return config.moveSpeed;
  return THREE.MathUtils.lerp(config.moveSpeed, config.runMoveSpeed, blend);
}

function rotateTowardAngle(current, target, maxDelta) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

/** True when the player lies inside the enemy's horizontal facing cone. */
export function isPlayerInEnemyFov(mesh, playerPosition, fovDeg) {
  const dx = playerPosition.x - mesh.position.x;
  const dz = playerPosition.z - mesh.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.05) return true;
  const forwardX = Math.sin(mesh.rotation.y);
  const forwardZ = Math.cos(mesh.rotation.y);
  const dot = (dx * forwardX + dz * forwardZ) / dist;
  const minDot = Math.cos(THREE.MathUtils.degToRad(fovDeg * 0.5));
  return dot >= minDot;
}

function healthRatio(mesh) {
  const maxHealth = mesh.userData.maxHealth ?? 1;
  return THREE.MathUtils.clamp((mesh.userData.health ?? 0) / maxHealth, 0, 1);
}

function feelsInDanger(mesh, state, config, hasPlayerLineOfSight, simTime) {
  const ratio = healthRatio(mesh);
  if (ratio <= config.dangerHealthRatio) return true;
  if (
    state.lastHitAt > 0 &&
    simTime - state.lastHitAt <= config.recentHitDangerSec
  ) {
    return true;
  }
  if (
    isReloading(state, simTime) &&
    hasPlayerLineOfSight &&
    config.hideWhileReloading
  ) {
    return true;
  }
  if (
    state.roundsInMag <= 0 &&
    state.spareMags > 0 &&
    hasPlayerLineOfSight
  ) {
    return true;
  }
  if (
    state.roundsInMag <= 0 &&
    state.spareMags <= 0 &&
    hasPlayerLineOfSight
  ) {
    return true;
  }
  if (
    state.roundsInMag <= config.lowAmmoThreshold &&
    hasPlayerLineOfSight &&
    ratio <= config.lowAmmoDangerHealthRatio
  ) {
    return true;
  }
  return false;
}

function tickReload(state, simTime, config) {
  if (state.reloadingUntil <= 0 || simTime < state.reloadingUntil) return;
  state.reloadingUntil = 0;
  state.roundsInMag = config.magazineSize;
}

function maybeStartReload(state, simTime, config) {
  if (
    state.roundsInMag > 0 ||
    state.spareMags <= 0 ||
    isReloading(state, simTime)
  ) {
    return false;
  }
  state.spareMags -= 1;
  state.reloadingUntil = simTime + randomBetween(
    config.reloadMinSec,
    config.reloadMaxSec,
  );
  state.burstRemaining = 0;
  return true;
}

function clearPath(state) {
  state.path.length = 0;
  state.pathIndex = 0;
}

function setPath(state, navigation, mesh, destination) {
  const start = {
    x: mesh.position.x,
    y: mesh.position.y - (mesh.userData.height ?? 1.75) / 2,
    z: mesh.position.z,
  };
  const path = navigation?.findPath(start, destination) ?? [];
  if (path.length < 2) return false;
  state.path = path;
  state.pathIndex = 1;
  return true;
}

function footPositionFromMesh(mesh) {
  return {
    x: mesh.position.x,
    y: mesh.position.y - (mesh.userData.height ?? 1.75) / 2,
    z: mesh.position.z,
  };
}

function chooseRandomPath(state, navigation, mesh, radius, playerPosition = null) {
  const footPosition = footPositionFromMesh(mesh);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const destination = navigation?.randomPointAround(footPosition, radius);
    if (!destination) continue;
    if (Math.hypot(destination.x - footPosition.x, destination.z - footPosition.z) < 1.4) {
      continue;
    }
    if (playerPosition) {
      const playerDistance = Math.hypot(
        destination.x - playerPosition.x,
        destination.z - playerPosition.z,
      );
      if (playerDistance < 5 || playerDistance > 20) continue;
    }
    if (setPath(state, navigation, mesh, destination)) return true;
  }
  return false;
}

function isCoverFromPlayer(
  destination,
  mesh,
  playerPosition,
  levelHitMeshes,
  hasLineOfSight,
) {
  if (!hasLineOfSight || !levelHitMeshes?.length) return false;
  const height = mesh.userData.height ?? 1.75;
  _coverChest.set(destination.x, destination.y + height * 0.55, destination.z);
  _coverPlayerAim.set(playerPosition.x, playerPosition.y - 0.18, playerPosition.z);
  return !hasLineOfSight(_coverPlayerAim, _coverChest, levelHitMeshes);
}

function chooseCoverPath(
  state,
  navigation,
  mesh,
  playerPosition,
  config,
  levelHitMeshes,
  hasLineOfSight,
) {
  if (!navigation) return false;
  const footPosition = footPositionFromMesh(mesh);
  const currentPlayerDistance = Math.hypot(
    footPosition.x - playerPosition.x,
    footPosition.z - playerPosition.z,
  );

  let bestDestination = null;
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const destination = navigation.randomPointAround(footPosition, config.coverRadius);
    if (!destination) continue;
    const travel = Math.hypot(
      destination.x - footPosition.x,
      destination.z - footPosition.z,
    );
    if (travel < 1.2) continue;

    const playerDistance = Math.hypot(
      destination.x - playerPosition.x,
      destination.z - playerPosition.z,
    );
    if (playerDistance < currentPlayerDistance - 0.25) continue;
    const blocked = isCoverFromPlayer(
      destination,
      mesh,
      playerPosition,
      levelHitMeshes,
      hasLineOfSight,
    );
    const score =
      (blocked ? 16 : 0) +
      Math.max(0, playerDistance - currentPlayerDistance) * 1.5 +
      travel * 0.12;
    if (score > bestScore) {
      bestScore = score;
      bestDestination = destination;
    }
  }

  if (bestDestination && bestScore > 0) {
    return setPath(state, navigation, mesh, bestDestination);
  }

  const awayX = mesh.position.x - playerPosition.x;
  const awayZ = mesh.position.z - playerPosition.z;
  const awayLen = Math.hypot(awayX, awayZ) || 1;
  const fleeDestination = {
    x: footPosition.x + (awayX / awayLen) * config.coverRadius * 0.75,
    y: footPosition.y,
    z: footPosition.z + (awayZ / awayLen) * config.coverRadius * 0.75,
  };
  return setPath(state, navigation, mesh, fleeDestination);
}

function targetBlocksStep(mesh, x, z, targets) {
  const radius = (mesh.userData.radius ?? 0.45) * 1.7;
  for (const other of targets) {
    if (other === mesh || !other.visible || other.userData.health <= 0) continue;
    if (Math.hypot(other.position.x - x, other.position.z - z) < radius) return true;
  }
  return false;
}

function followPath(mesh, state, targets, dt, config, groundSupport, simTime) {
  state.moveDirectionX = 0;
  state.moveDirectionZ = 0;
  const waypoint = state.path[state.pathIndex];
  if (!waypoint) {
    clearPath(state);
    return false;
  }

  const dx = waypoint.x - mesh.position.x;
  const dz = waypoint.z - mesh.position.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= config.waypointTolerance) {
    state.pathIndex += 1;
    if (state.pathIndex >= state.path.length) {
      clearPath(state);
      return false;
    }
    return followPath(mesh, state, targets, dt, config, groundSupport, simTime);
  }

  const speed = resolveMoveSpeed(state, simTime, config);
  const step = Math.min(distance, speed * dt);
  const x = mesh.position.x + (dx / distance) * step;
  const z = mesh.position.z + (dz / distance) * step;
  if (targetBlocksStep(mesh, x, z, targets)) return false;

  const height = mesh.userData.height ?? 1.75;
  mesh.position.x = x;
  mesh.position.z = z;
  state.moveDirectionX = dx / distance;
  state.moveDirectionZ = dz / distance;
  if (groundSupport) {
    const radius = mesh.userData.radius ?? 0.45;
    const currentFootY = mesh.position.y - height / 2;
    const supportCtx = {
      ...groundSupport,
      inset: Math.max(groundSupport.inset ?? 0, radius * 0.5),
    };
    const supportedFootY = sampleWalkerFootYAt(x, z, currentFootY, supportCtx);
    if (Number.isFinite(supportedFootY)) {
      mesh.position.y = supportedFootY + height / 2;
    }
  }
  const collider = mesh.userData.collider;
  if (collider) {
    collider.x = x;
    collider.z = z;
  }
  return true;
}

function rememberPlayer(state, playerPosition, simTime = null) {
  state.lastKnownPlayer ??= { x: 0, y: 0, z: 0 };
  state.lastKnownPlayer.x = playerPosition.x;
  state.lastKnownPlayer.y = playerPosition.y;
  state.lastKnownPlayer.z = playerPosition.z;
  if (Number.isFinite(simTime)) state.lastKnownPlayerAt = simTime;
}

function updateCoverMovement(
  mesh,
  state,
  targets,
  navigation,
  playerPosition,
  hasPlayerLineOfSight,
  dt,
  simTime,
  config,
  groundSupport,
  levelHitMeshes,
  hasLineOfSight,
) {
  const fleeing = isFleeing(state, simTime, config);
  if (state.mode !== "cover") {
    state.mode = "cover";
    state.coverUntil = simTime + randomBetween(config.coverMinSec, config.coverMaxSec);
    chooseCoverPath(
      state,
      navigation,
      mesh,
      playerPosition,
      config,
      levelHitMeshes,
      hasLineOfSight,
    ) || chooseFleeAwayPath(state, navigation, mesh, playerPosition, config);
  } else if (
    !state.path.length &&
    (hasPlayerLineOfSight || fleeing)
  ) {
    chooseCoverPath(
      state,
      navigation,
      mesh,
      playerPosition,
      config,
      levelHitMeshes,
      hasLineOfSight,
    ) || chooseFleeAwayPath(state, navigation, mesh, playerPosition, config);
    state.coverUntil = simTime + randomBetween(
      fleeing ? config.panicRunSec : config.coverMinSec,
      fleeing ? config.panicRunSec + 0.5 : config.coverMaxSec,
    );
  }

  if (hasPlayerLineOfSight) rememberPlayer(state, playerPosition, simTime);

  const moving = followPath(mesh, state, targets, dt, config, groundSupport, simTime);
  const danger = feelsInDanger(mesh, state, config, hasPlayerLineOfSight, simTime);
  const reloading = isReloading(state, simTime);

  if (
    !moving &&
    simTime >= state.coverUntil &&
    !fleeing &&
    !danger &&
    !reloading &&
    (!hasPlayerLineOfSight || !feelsInDanger(mesh, state, config, true, simTime))
  ) {
    state.mode = hasPlayerLineOfSight ? "engage" : "investigate";
    state.holdPositionUntil = simTime + randomBetween(
      config.holdPositionMin,
      config.holdPositionMax,
    );
  }
  return moving;
}

function updateMovement(
  mesh,
  state,
  targets,
  navigation,
  playerPosition,
  hasPlayerLineOfSight,
  playerAware,
  playerInFov,
  dt,
  simTime,
  config,
  groundSupport,
  levelHitMeshes,
  hasLineOfSight,
) {
  if (!config.movementEnabled || !navigation) return false;

  const fleeing = isFleeing(state, simTime, config);
  const danger = feelsInDanger(mesh, state, config, hasPlayerLineOfSight, simTime);
  const shouldHide =
    fleeing ||
    (danger &&
      (hasPlayerLineOfSight ||
        isReloading(state, simTime) ||
        state.roundsInMag <= 0));

  if (fleeing && state.mode !== "cover") {
    beginFlee(
      state,
      navigation,
      mesh,
      playerPosition,
      simTime,
      config,
      levelHitMeshes,
      hasLineOfSight,
    );
  }

  if (state.mode === "cover" || shouldHide) {
    return updateCoverMovement(
      mesh,
      state,
      targets,
      navigation,
      playerPosition,
      hasPlayerLineOfSight,
      dt,
      simTime,
      config,
      groundSupport,
      levelHitMeshes,
      hasLineOfSight,
    );
  }

  if (hasPlayerLineOfSight && !fleeing) {
    rememberPlayer(state, playerPosition, simTime);
    if (
      state.mode === "patrol" ||
      state.mode === "investigate" ||
      (state.mode === "reposition" && playerInFov)
    ) {
      clearPath(state);
      state.mode = "engage";
      state.holdPositionUntil = simTime + randomBetween(
        config.holdPositionMin,
        config.holdPositionMax,
      );
    }
    if (state.mode === "engage" && simTime >= state.holdPositionUntil) {
      if (chooseRandomPath(
        state,
        navigation,
        mesh,
        config.repositionRadius,
        playerPosition,
      )) {
        state.mode = "reposition";
      } else {
        state.holdPositionUntil = simTime + randomBetween(
          config.holdPositionMin,
          config.holdPositionMax,
        );
      }
    }
  } else if (
    !fleeing &&
    (hasPlayerLineOfSight ||
      (state.lastHitAt > 0 && simTime - state.lastHitAt <= config.awarenessMemorySec)) &&
    state.lastKnownPlayer &&
    state.mode !== "investigate"
  ) {
    clearPath(state);
    if (setPath(state, navigation, mesh, state.lastKnownPlayer)) {
      state.mode = "investigate";
    }
  } else if (!state.path.length && simTime >= state.nextMoveDecisionAt) {
    state.mode = "patrol";
    chooseRandomPath(state, navigation, mesh, config.patrolRadius);
    state.nextMoveDecisionAt = simTime + randomBetween(2.5, 5.5);
  }

  const moving = followPath(mesh, state, targets, dt, config, groundSupport, simTime);
  if (!moving && state.mode === "reposition") {
    state.mode = "engage";
    state.holdPositionUntil = simTime + randomBetween(
      config.holdPositionMin,
      config.holdPositionMax,
    );
  }
  return moving;
}

function deferReaction(state, simTime, config) {
  state.burstRemaining = 0;
  if (state.nextShotAt >= simTime + config.reactionMin) return;
  state.nextShotAt = simTime + randomBetween(config.reactionMin, config.reactionMax);
}

function targetMuzzleWorld(mesh, out) {
  const rifle = mesh.userData.enemyRifle ??
    mesh.getObjectByName("enemy-rifle-muzzle");
  if (rifle && !mesh.userData.enemyRifle) mesh.userData.enemyRifle = rifle;
  return getEnemyMuzzleWorldPosition(mesh, out);
}

/** Face movement, or turn toward an alert target when the player is discovered. */
function updateEnemyFacing(mesh, state, moving, dt, config, lookTarget) {
  if (lookTarget) {
    const dx = lookTarget.x - mesh.position.x;
    const dz = lookTarget.z - mesh.position.z;
    if (Math.hypot(dx, dz) >= 1e-4) {
      const targetY = Math.atan2(dx, dz);
      mesh.rotation.y = rotateTowardAngle(
        mesh.rotation.y,
        targetY,
        config.turnSpeed * dt,
      );
      return;
    }
  }
  if (!moving) return;
  const moveX = state.moveDirectionX;
  const moveZ = state.moveDirectionZ;
  if (Math.hypot(moveX, moveZ) < 1e-4) return;
  const targetY = Math.atan2(moveX, moveZ);
  mesh.rotation.y = rotateTowardAngle(
    mesh.rotation.y,
    targetY,
    config.turnSpeed * dt,
  );
}

function resolveEnemyLookTarget(
  state,
  playerPosition,
  hasPlayerLineOfSight,
  playerInFov,
  playerAware,
  fleeing,
) {
  if (fleeing) return null;
  if (hasPlayerLineOfSight && playerPosition) return playerPosition;
  if (playerAware && playerInFov && state.lastKnownPlayer) {
    return state.lastKnownPlayer;
  }
  return null;
}

function scheduleNextShot(state, simTime, config) {
  if (state.burstRemaining > 0) {
    state.nextShotAt = simTime + randomBetween(
      config.burstSpacingMin,
      config.burstSpacingMax,
    );
    return;
  }
  state.nextShotAt = simTime + randomBetween(config.cooldownMin, config.cooldownMax);
}

function fireShot(mesh, state, simTime, playerPosition, config, callbacks) {
  if (state.roundsInMag <= 0) return false;

  targetMuzzleWorld(mesh, _muzzle);
  _playerAim.copy(playerPosition);
  _playerAim.y -= 0.18;

  const shotDistance = _muzzle.distanceTo(_playerAim);
  if (shotDistance > config.maxRange) return false;

  const hit = Math.random() < config.accuracy;
  _shotEnd.copy(_playerAim);
  if (!hit) {
    const missRadius = randomBetween(config.missRadiusMin, config.missRadiusMax);
    const missAngle = Math.random() * Math.PI * 2;
    _shotEnd.x += Math.cos(missAngle) * missRadius;
    _shotEnd.z += Math.sin(missAngle) * missRadius;
    _shotEnd.y += randomBetween(-0.8, 1.2);
  }

  _shotDir.subVectors(_shotEnd, _muzzle).normalize();
  callbacks.laserTracers?.spawn(_muzzle, _shotEnd, {
    enemy: true,
    missDirection: hit ? null : _shotDir,
    missRange: hit ? 0 : _muzzle.distanceTo(_shotEnd),
    impactPoint: hit ? _shotEnd.clone() : null,
  });
  callbacks.playShot?.(mesh, _muzzle);
  if (hit && callbacks.gameCore) {
    const damage = resolveRifleBodyDamageAtDistance(
      shotDistance,
      callbacks.gameCore,
    );
    if (damage > 0) callbacks.onPlayerHit?.(damage, mesh);
  }

  state.roundsInMag -= 1;

  if (state.burstRemaining <= 0) {
    state.burstRemaining = randomIntBetween(config.burstMin, config.burstMax);
  }
  state.burstRemaining -= 1;
  scheduleNextShot(state, simTime, config);
  return true;
}

function canEngageWithFire(state, simTime, config, mesh, playerPosition) {
  if (state.mode === "cover") return false;
  if (isReloading(state, simTime)) return false;
  if (state.roundsInMag <= 0) return false;
  if (!isPlayerInEnemyFov(mesh, playerPosition, config.perceptionFovDeg)) return false;
  return true;
}

/**
 * Armed targets with rifle magazines, reload downtime, and cover-seeking
 * when exposed or low on health/ammo.
 */
export function updateEnemyAi({
  targets,
  playerPosition,
  levelHitMeshes,
  hasLineOfSight,
  navigation,
  groundSupport,
  dt,
  simTime,
  active,
  config,
  laserTracers,
  playShot,
  onPlayerHit,
  gameCore,
}) {
  if (!targets?.length || !playerPosition) return;
  const aiConfig = resolveEnemyAiConfig(config);

  if (!aiConfig.enabled) {
    for (const mesh of targets) {
      if (!mesh?.userData?.hasRifle) continue;
      updateEnemyRigAnimation(
        mesh,
        dt,
        false,
        aiConfig.moveSpeed,
        1,
        playerPosition,
      );
    }
    return;
  }

  for (const mesh of targets) {
    if (!mesh?.userData?.hasRifle) continue;
    const state = ensureAiState(mesh, simTime, aiConfig);
    const alive = mesh.visible && mesh.userData.health > 0 && !mesh.userData.dying;
    if (!active || !alive || mesh.userData.flashbangBlinding) {
      updateEnemyRigAnimation(mesh, dt, false, aiConfig.moveSpeed, 1, playerPosition);
      deferReaction(state, simTime, aiConfig);
      continue;
    }

    updateDangerMemory(mesh, state, simTime, aiConfig);
    tickReload(state, simTime, aiConfig);

    const dx = playerPosition.x - mesh.position.x;
    const dz = playerPosition.z - mesh.position.z;
    const distanceSq = dx * dx + dz * dz;
    const nearby = distanceSq <= aiConfig.awarenessRadius * aiConfig.awarenessRadius;
    const playerInFov = isPlayerInEnemyFov(mesh, playerPosition, aiConfig.perceptionFovDeg);
    if (
      state.lastHitAt > 0 &&
      simTime - state.lastHitAt <= aiConfig.recentHitDangerSec
    ) {
      rememberPlayer(state, playerPosition, simTime);
      state.awareUntil = Math.max(
        state.awareUntil,
        state.lastHitAt + aiConfig.awarenessMemorySec,
      );
    }

    if (simTime >= state.nextPerceptionAt) {
      state.nextPerceptionAt = simTime + (nearby && playerInFov
        ? aiConfig.nearPerceptionInterval
        : randomBetween(
          aiConfig.perceptionIntervalMin,
          aiConfig.perceptionIntervalMax,
        ));
      if (
        playerInFov &&
        distanceSq <= aiConfig.maxRange * aiConfig.maxRange
      ) {
        targetMuzzleWorld(mesh, _muzzle);
        _playerAim.copy(playerPosition);
        _playerAim.y -= 0.18;
        state.hasPlayerLineOfSight = !hasLineOfSight || hasLineOfSight(
          _muzzle,
          _playerAim,
          levelHitMeshes,
        );
      } else {
        state.hasPlayerLineOfSight = false;
      }
      if (state.hasPlayerLineOfSight) {
        rememberPlayer(state, playerPosition, simTime);
        state.awareUntil = simTime + aiConfig.awarenessMemorySec;
      }
    }

    const hasPlayerLineOfSight = state.hasPlayerLineOfSight && playerInFov;
    const playerAware = hasPlayerLineOfSight || simTime < state.awareUntil;
    const fleeing = isFleeing(state, simTime, aiConfig);
    const lookTarget = resolveEnemyLookTarget(
      state,
      playerPosition,
      hasPlayerLineOfSight,
      playerInFov,
      playerAware,
      fleeing,
    );
    const moving = updateMovement(
        mesh,
        state,
        targets,
        navigation,
        playerPosition,
        hasPlayerLineOfSight,
        playerAware,
        playerInFov,
        dt,
        simTime,
        aiConfig,
        groundSupport,
        levelHitMeshes,
        hasLineOfSight,
      );
    updateEnemyFacing(mesh, state, moving, dt, aiConfig, lookTarget);

    const worldSpeed = moving
      ? resolveMoveSpeed(state, simTime, aiConfig)
      : aiConfig.moveSpeed;
    const facingX = Math.sin(mesh.rotation.y);
    const facingZ = Math.cos(mesh.rotation.y);
    const movementFacingDot =
      state.moveDirectionX * facingX + state.moveDirectionZ * facingZ;
    updateEnemyRigAnimation(
      mesh,
      dt,
      moving,
      worldSpeed,
      movementFacingDot < -0.2 ? -1 : 1,
      playerPosition,
    );

    if (moving || !hasPlayerLineOfSight) {
      deferReaction(state, simTime, aiConfig);
      if (state.roundsInMag <= 0) maybeStartReload(state, simTime, aiConfig);
      continue;
    }

    if (!canEngageWithFire(state, simTime, aiConfig, mesh, playerPosition)) {
      deferReaction(state, simTime, aiConfig);
      if (state.roundsInMag <= 0) maybeStartReload(state, simTime, aiConfig);
      continue;
    }

    if (simTime < state.nextShotAt) continue;
    fireShot(mesh, state, simTime, playerPosition, aiConfig, {
      laserTracers,
      playShot,
      onPlayerHit,
      gameCore,
    });
    if (state.roundsInMag <= 0) maybeStartReload(state, simTime, aiConfig);
  }
}
