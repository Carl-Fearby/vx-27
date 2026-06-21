import * as THREE from "three";
import { sampleWalkerFootYAt } from "../physics/GroundSupport.js";

/**
 * Intentionally weak first-tier rifle AI. Arena JSON can override these under
 * `target.ai`; later levels can improve the same profile without changing the
 * frame-loop integration.
 */
export const ROOKIE_ENEMY_AI = Object.freeze({
  enabled: true,
  maxRange: 32,
  perceptionIntervalMin: 0.18,
  perceptionIntervalMax: 0.3,
  reactionMin: 1.2,
  reactionMax: 2.8,
  accuracy: 0.28,
  damage: 6,
  burstMin: 1,
  burstMax: 3,
  burstSpacingMin: 0.28,
  burstSpacingMax: 0.48,
  cooldownMin: 1.8,
  cooldownMax: 3.4,
  missRadiusMin: 0.75,
  missRadiusMax: 2.5,
  movementEnabled: true,
  moveSpeed: 1.15,
  patrolRadius: 6,
  repositionRadius: 4.5,
  holdPositionMin: 2.4,
  holdPositionMax: 4.8,
  waypointTolerance: 0.28,
});

const _muzzle = new THREE.Vector3();
const _playerAim = new THREE.Vector3();
const _shotEnd = new THREE.Vector3();
const _shotDir = new THREE.Vector3();

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
    reactionMin: finite(source.reactionMin, ROOKIE_ENEMY_AI.reactionMin, 0.1, 10),
    reactionMax: finite(source.reactionMax, ROOKIE_ENEMY_AI.reactionMax, 0.1, 12),
    accuracy: finite(source.accuracy, ROOKIE_ENEMY_AI.accuracy, 0, 1),
    damage: finite(source.damage, ROOKIE_ENEMY_AI.damage, 0, 100),
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
  };
  mesh.userData.enemyAi = state;
  return state;
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

function chooseRandomPath(state, navigation, mesh, radius, playerPosition = null) {
  const footPosition = {
    x: mesh.position.x,
    y: mesh.position.y - (mesh.userData.height ?? 1.75) / 2,
    z: mesh.position.z,
  };
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

function targetBlocksStep(mesh, x, z, targets) {
  const radius = (mesh.userData.radius ?? 0.45) * 1.7;
  for (const other of targets) {
    if (other === mesh || !other.visible || other.userData.health <= 0) continue;
    if (Math.hypot(other.position.x - x, other.position.z - z) < radius) return true;
  }
  return false;
}

function followPath(mesh, state, targets, dt, config, groundSupport) {
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
    if (state.pathIndex >= state.path.length) clearPath(state);
    return state.path.length > 0;
  }

  const step = Math.min(distance, config.moveSpeed * dt);
  const x = mesh.position.x + (dx / distance) * step;
  const z = mesh.position.z + (dz / distance) * step;
  if (targetBlocksStep(mesh, x, z, targets)) return true;

  const height = mesh.userData.height ?? 1.75;
  mesh.position.x = x;
  mesh.position.z = z;
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
  mesh.rotation.y = Math.atan2(dx, dz);
  const collider = mesh.userData.collider;
  if (collider) {
    collider.x = x;
    collider.z = z;
  }
  return true;
}

function updateMovement(
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
) {
  if (!config.movementEnabled || !navigation) return false;

  if (hasPlayerLineOfSight) {
    state.lastKnownPlayer ??= { x: 0, y: 0, z: 0 };
    state.lastKnownPlayer.x = playerPosition.x;
    state.lastKnownPlayer.y = playerPosition.y;
    state.lastKnownPlayer.z = playerPosition.z;
    if (state.mode === "patrol" || state.mode === "investigate") {
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
  } else if (state.lastKnownPlayer && state.mode !== "investigate" && !state.path.length) {
    if (setPath(state, navigation, mesh, state.lastKnownPlayer)) {
      state.mode = "investigate";
    }
    state.lastKnownPlayer = null;
  } else if (!state.path.length && simTime >= state.nextMoveDecisionAt) {
    state.mode = "patrol";
    chooseRandomPath(state, navigation, mesh, config.patrolRadius);
    state.nextMoveDecisionAt = simTime + randomBetween(1.5, 3.5);
  }

  const moving = followPath(mesh, state, targets, dt, config, groundSupport);
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
    mesh.getObjectByName("target-rifle-placeholder");
  if (rifle && !mesh.userData.enemyRifle) mesh.userData.enemyRifle = rifle;
  const localMuzzle = rifle?.userData?.muzzleLocal;
  if (rifle && localMuzzle) {
    out.copy(localMuzzle);
    return rifle.localToWorld(out);
  }
  out.set(0, (mesh.userData.height ?? 1.75) * 0.36, 0.3);
  return mesh.localToWorld(out);
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
  targetMuzzleWorld(mesh, _muzzle);
  _playerAim.copy(playerPosition);
  _playerAim.y -= 0.18;

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
  if (hit) callbacks.onPlayerHit?.(config.damage, mesh);

  if (state.burstRemaining <= 0) {
    state.burstRemaining = randomIntBetween(config.burstMin, config.burstMax);
  }
  state.burstRemaining -= 1;
  scheduleNextShot(state, simTime, config);
}

/**
 * Rotate and fire armed targets. No pathfinding, leading, cover use, pursuit,
 * communication, or memory: this is deliberately a stationary rookie tier.
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
}) {
  if (!targets?.length || !playerPosition || !config?.enabled) return;

  for (const mesh of targets) {
    if (!mesh?.userData?.hasRifle) continue;
    const state = ensureAiState(mesh, simTime, config);
    const alive = mesh.visible && mesh.userData.health > 0 && !mesh.userData.dying;
    if (!active || !alive || mesh.userData.flashbangBlinding) {
      deferReaction(state, simTime, config);
      continue;
    }

    const dx = playerPosition.x - mesh.position.x;
    const dz = playerPosition.z - mesh.position.z;
    const distanceSq = dx * dx + dz * dz;

    if (simTime >= state.nextPerceptionAt) {
      state.nextPerceptionAt = simTime + randomBetween(
        config.perceptionIntervalMin,
        config.perceptionIntervalMax,
      );
      if (distanceSq <= config.maxRange * config.maxRange) {
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
    }

    const hasPlayerLineOfSight = state.hasPlayerLineOfSight;
    const moving = updateMovement(
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
    );
    if (hasPlayerLineOfSight) {
      // Armed enemies strafe/reposition while already facing their target.
      mesh.rotation.y = Math.atan2(dx, dz);
    }
    if (moving) {
      deferReaction(state, simTime, config);
      continue;
    }
    if (!hasPlayerLineOfSight) {
      deferReaction(state, simTime, config);
      continue;
    }

    if (simTime < state.nextShotAt) continue;
    fireShot(mesh, state, simTime, playerPosition, config, {
      laserTracers,
      playShot,
      onPlayerHit,
    });
  }
}
