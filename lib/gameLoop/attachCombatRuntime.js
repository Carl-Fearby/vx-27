import * as THREE from "three";
import { getGrenadeParams } from "@/lib/combat/Grenade.js";
import { hasLineOfSightToPoint } from "@/lib/combat/LineOfSight.js";
import {
  applyCombatScore,
  formatKillCallout,
} from "@/lib/combat/Score.js";
import {
  applyTargetHit,
  startDeathAnimation,
  flushPendingRagdolls,
  spawnHpOrb,
  activateTargetAt,
  pickRandomSpawnPosition,
  resolveAuthoredSpawnPosition,
} from "@/lib/combat/Targets.js";
import {
  spawnBloodSplatter,
  spawnBloodMarkOnTarget,
} from "@/lib/combat/BloodParticles.js";
import {
  applyBulletSurfaceHit,
  pickClosestBulletHit,
} from "@/lib/combat/BulletHoles.js";
import { getLaserPalette } from "@/lib/weapons/ViewWeapon.js";
import {
  getPrimaryWeaponConfig,
  resolveFireModeForWeapon,
} from "@/lib/weapons/PrimaryWeapons.js";
import { collidersForRagdollNear } from "@/lib/vx27-container/Vx27Container.js";
import { resolveRewardDropFloorAt } from "@/lib/physics/GroundSupport.js";
import { setPickupSurface, spawnAmmoDrop } from "@/lib/pickups/AmmoCrate.js";
import { spawnGrenadeDrop } from "@/lib/combat/Grenade.js";
import { shouldDropAmmoCrate } from "@/lib/pickups/RewardDropSettings.js";
import { WORLD_LAYER, ROOM_INTERIOR_LAYER } from "@/lib/lighting/LightingLayers.js";
import { DEV_DROP_ALL_REWARDS } from "@/lib/gameLoop/constants.js";

const BULLET_MAX_RANGE = 55;
const BURST_SHOT_COUNT = 3;
const BURST_INTERVAL = 0.085;
const AUTO_FIRE_INTERVAL = 0.1;

/**
 * Attach combat + weapon-fire helpers to the game loop context.
 * @param {import("./gameLoopContext.js").GameLoopContext} ctx
 */
export function attachCombatRuntime(ctx) {
  const _muzzlePos = new THREE.Vector3();
  const _muzzleDir = new THREE.Vector3();
  const flashbangLosRaycaster = new THREE.Raycaster();
  flashbangLosRaycaster.layers.enable(WORLD_LAYER);
  flashbangLosRaycaster.layers.enable(ROOM_INTERIOR_LAYER);
  const _flashBlindPos = new THREE.Vector3();
  const _flashBlindDir = new THREE.Vector3();
  const _flashBlindNdc = new THREE.Vector3();

  let burstShotsLeft = 0;
  let burstTimer = 0;
  let autoFireTimer = 0;

  function refreshLiveTargets() {
    ctx.liveTargetsScratch.length = 0;
    for (const t of ctx.level.targets) {
      if (t.visible && t.userData.health > 0) ctx.liveTargetsScratch.push(t);
    }
    return ctx.liveTargetsScratch;
  }

  function getLiveTargets() {
    return refreshLiveTargets();
  }

  function canFlashbangBlindPlayer(explosionPos) {
    const blindRadius = getGrenadeParams().flashbangBlindRadius ?? 18;
    _flashBlindPos.copy(explosionPos);
    _flashBlindPos.y += 0.35;

    const dist = ctx.camera.position.distanceTo(_flashBlindPos);
    if (dist > blindRadius) return false;

    _flashBlindNdc.copy(_flashBlindPos).project(ctx.camera);
    if (_flashBlindNdc.z > 1) return false;
    if (
      Math.abs(_flashBlindNdc.x) > 1.3 ||
      Math.abs(_flashBlindNdc.y) > 1.3
    ) {
      return false;
    }

    _flashBlindDir.subVectors(_flashBlindPos, ctx.camera.position);
    const distLen = _flashBlindDir.length();
    if (distLen < 0.08) return true;

    if (
      !hasLineOfSightToPoint(
        ctx.camera.position,
        _flashBlindPos,
        ctx.levelHitMeshes,
      )
    ) {
      return false;
    }

    _flashBlindDir.multiplyScalar(1 / distLen);
    flashbangLosRaycaster.set(ctx.camera.position, _flashBlindDir);
    flashbangLosRaycaster.far = distLen + 0.2;
    flashbangLosRaycaster.near = 0.05;

    for (const hit of flashbangLosRaycaster.intersectObjects(
      getLiveTargets(),
      true,
    )) {
      if (hit.object.isSprite) continue;
      if (hit.distance < distLen - 0.45) return false;
    }

    return true;
  }

  function scheduleRespawn(mesh) {
    const targetConfig = ctx.level.targetConfig;
    const delayMs = targetConfig.respawnDelay * 1000;
    setTimeout(() => {
      if (ctx.isDisposed()) return;
      const fixed = mesh.userData.fixedSpawn;
      if (fixed) {
        const pos = resolveAuthoredSpawnPosition(fixed.x, fixed.z, {
          bounds: ctx.level.arenaBounds,
          colliders: ctx.allColliders,
          targets: ctx.level.targets,
          config: targetConfig,
          skip: mesh,
          spawnPoint: fixed,
          spawnCtx: ctx.targetSpawnCtx,
        });
        if (!pos) return;
        activateTargetAt(
          mesh,
          pos.x,
          pos.z,
          targetConfig,
          pos.y ?? fixed.y ?? 0,
          fixed.yaw,
        );
        return;
      }
      const pos = pickRandomSpawnPosition({
        bounds: ctx.level.arenaBounds,
        colliders: ctx.allColliders,
        targets: ctx.level.targets,
        config: targetConfig,
        skip: mesh,
        floorHoles: ctx.level.floorHoles,
        spawnCtx: ctx.targetSpawnCtx,
      });
      if (!pos) return;
      activateTargetAt(mesh, pos.x, pos.z, targetConfig, pos.y);
    }, delayMs);
  }

  function tagKillRewardDrop(drop, surface) {
    if (!drop) return drop;
    drop.surface = surface;
    if (surface === "catwalk" && drop.type === "ammo" && drop.mesh) {
      setPickupSurface(drop.mesh, "catwalk");
    }
    return drop;
  }

  function spawnKillRewardAt(position, refY, spawn) {
    const { floorY, surface } = resolveRewardDropFloorAt(
      position.x,
      position.z,
      refY,
      ctx.level,
    );
    return tagKillRewardDrop(spawn(position, floorY), surface);
  }

  function scheduleKillDrops(deathPos, zone) {
    const rndAngle = Math.random() * Math.PI * 2;
    const rndOff = 0.3 + Math.random() * 0.5;
    const hpDelay = 800 + Math.random() * 400;
    const ammoDelay = 1800 + Math.random() * 400;
    const grenDelay = 2200 + Math.random() * 500;

    const dropAt = (angle, delayMs, push) => {
      setTimeout(() => {
        const p = new THREE.Vector3(
          deathPos.x + Math.cos(angle) * rndOff,
          deathPos.y,
          deathPos.z + Math.sin(angle) * rndOff,
        );
        push(spawnKillRewardAt(p, deathPos.y, (pos, floorY) =>
          spawnHpOrb(ctx.scene, pos, floorY)
        ));
      }, delayMs);
    };

    const dropAmmoAt = (angle, delayMs) => {
      setTimeout(() => {
        const p = new THREE.Vector3(
          deathPos.x + Math.cos(angle) * rndOff,
          deathPos.y,
          deathPos.z + Math.sin(angle) * rndOff,
        );
        ctx.ammoDrops.push(
          spawnKillRewardAt(p, deathPos.y, (pos, floorY) =>
            spawnAmmoDrop(ctx.scene, pos, floorY)
          ),
        );
      }, delayMs);
    };

    const dropGrenAt = (angle, delayMs) => {
      setTimeout(() => {
        const p = new THREE.Vector3(
          deathPos.x + Math.cos(angle) * rndOff,
          deathPos.y,
          deathPos.z + Math.sin(angle) * rndOff,
        );
        ctx.grenadeDrops.push(
          spawnKillRewardAt(p, deathPos.y, (pos, floorY) =>
            spawnGrenadeDrop(ctx.scene, pos, floorY)
          ),
        );
      }, delayMs);
    };

    if (DEV_DROP_ALL_REWARDS) {
      dropAt(rndAngle, hpDelay, (drop) => ctx.hpOrbs.push(drop));
      dropAmmoAt(rndAngle + Math.PI * 0.66, ammoDelay);
      dropGrenAt(rndAngle + Math.PI * 1.33, grenDelay);
      return;
    }

    if (zone === "head" || ctx.playerHealthRef.current < 50) {
      dropAt(rndAngle, hpDelay, (drop) => ctx.hpOrbs.push(drop));
    }
    if (
      shouldDropAmmoCrate(
        ctx.spareMagsRef.current,
        ctx.ammoDropSpareThresholdRef.current,
      )
    ) {
      dropAmmoAt(rndAngle + Math.PI, ammoDelay);
    }
    if (ctx.rollGrenadeDrop(ctx.grenadeCountRef.current)) {
      dropGrenAt(rndAngle + Math.PI * 0.5, grenDelay);
    }
  }

  function scheduleGrenadeKillDrops(deathPos) {
    const rndAngle = Math.random() * Math.PI * 2;
    const rndOff = 0.3 + Math.random() * 0.5;
    const hpDelay = 800 + Math.random() * 400;
    const ammoDelay = 1800 + Math.random() * 400;
    const grenDelay = 2200 + Math.random() * 500;

    const dropAt = (angle, delayMs, push) => {
      setTimeout(() => {
        const p = new THREE.Vector3(
          deathPos.x + Math.cos(angle) * rndOff,
          deathPos.y,
          deathPos.z + Math.sin(angle) * rndOff,
        );
        push(spawnKillRewardAt(p, deathPos.y, (pos, floorY) =>
          spawnHpOrb(ctx.scene, pos, floorY)
        ));
      }, delayMs);
    };

    const dropAmmoAt = (angle, delayMs) => {
      setTimeout(() => {
        const p = new THREE.Vector3(
          deathPos.x + Math.cos(angle) * rndOff,
          deathPos.y,
          deathPos.z + Math.sin(angle) * rndOff,
        );
        ctx.ammoDrops.push(
          spawnKillRewardAt(p, deathPos.y, (pos, floorY) =>
            spawnAmmoDrop(ctx.scene, pos, floorY)
          ),
        );
      }, delayMs);
    };

    const dropGrenAt = (angle, delayMs) => {
      setTimeout(() => {
        const p = new THREE.Vector3(
          deathPos.x + Math.cos(angle) * rndOff,
          deathPos.y,
          deathPos.z + Math.sin(angle) * rndOff,
        );
        ctx.grenadeDrops.push(
          spawnKillRewardAt(p, deathPos.y, (pos, floorY) =>
            spawnGrenadeDrop(ctx.scene, pos, floorY)
          ),
        );
      }, delayMs);
    };

    if (DEV_DROP_ALL_REWARDS) {
      dropAt(rndAngle, hpDelay, (drop) => ctx.hpOrbs.push(drop));
      dropAmmoAt(rndAngle + Math.PI * 0.66, ammoDelay);
      dropGrenAt(rndAngle + Math.PI * 1.33, grenDelay);
      return;
    }

    dropAt(rndAngle, hpDelay, (drop) => ctx.hpOrbs.push(drop));
    if (
      shouldDropAmmoCrate(
        ctx.spareMagsRef.current,
        ctx.ammoDropSpareThresholdRef.current,
      )
    ) {
      dropAmmoAt(rndAngle + Math.PI, ammoDelay);
    }
    if (ctx.rollGrenadeDrop(ctx.grenadeCountRef.current)) {
      dropGrenAt(rndAngle + Math.PI * 0.5, grenDelay);
    }
  }

  function flushBloodAfterRagdoll() {
    if (!ctx.bloodAfterRagdoll.length) return;
    for (const pending of ctx.bloodAfterRagdoll) {
      const splatter = spawnBloodSplatter(
        ctx.scene,
        pending.point,
        pending.dir,
        pending.damage,
      );
      if (splatter) ctx.bloodSplatters.push(splatter);
      if (pending.mesh) {
        spawnBloodMarkOnTarget(
          pending.mesh,
          pending.point,
          pending.face ?? null,
          pending.dir,
          pending.damage,
        );
      }
    }
    ctx.bloodAfterRagdoll.length = 0;
  }

  function flushPendingKillBlood() {
    if (!ctx.pendingKillBlood.length) return;
    for (let i = ctx.pendingKillBlood.length - 1; i >= 0; i -= 1) {
      const pending = ctx.pendingKillBlood[i];
      if (!pending.mesh?.userData?.ragdoll) continue;
      ctx.bloodAfterRagdoll.push(pending);
      ctx.pendingKillBlood.splice(i, 1);
    }
  }

  function playTargetHitSound(mesh, hitPoint, hitZone) {
    ctx.sounds.playEnemyHit(ctx.scene, hitPoint, {
      headshot: hitZone === "head",
    });
  }

  function playTargetDeathSound(mesh, hitPoint, hitZone) {
    const pos = hitPoint?.clone?.() ?? mesh.position.clone();
    if (!hitPoint) {
      const h = mesh.userData?.height ?? 1.8;
      pos.y += h * 0.55;
    }
    ctx.sounds.playEnemyDeath(ctx.scene, pos, {
      headshot: hitZone === "head",
      blast: hitZone === "grenade",
    });
  }

  function playTargetHoleFallSound(mesh, position) {
    const pos = position?.clone?.() ?? mesh.position.clone();
    ctx.sounds.playHoleFallDeathWorld(ctx.scene, pos);
  }

  function awardCombatScoreAt(mesh, hitResult, hitPoint) {
    const scoreResult = applyCombatScore(mesh, hitResult);
    if (scoreResult.score <= 0) return;

    ctx.playerScoreRef.current += scoreResult.score;
    if (ctx.showHudRef.current) {
      ctx.updateScoreHud(ctx.scoreHudRef.current, ctx.playerScoreRef.current);
    }

    if (
      hitResult.killed &&
      hitPoint &&
      ctx.scorePopupLayer &&
      !ctx.deathStateRef.current
    ) {
      ctx.scorePopupLayer.spawn({
        point: hitPoint,
        text: formatKillCallout(hitResult.zone, scoreResult.score, mesh.id),
        zone: hitResult.zone,
      });
    }
  }

  function applyHit(hit, bulletDirection, targetMesh) {
    const mesh = targetMesh ?? hit.object;
    const { killed, zone, damage } = applyTargetHit(
      mesh,
      hit.point,
      bulletDirection,
      ctx.activePrimaryId,
    );
    if (zone !== "miss") {
      awardCombatScoreAt(mesh, { zone, damage, killed }, hit.point);
      playTargetHitSound(mesh, hit.point, zone);
      if (killed) {
        playTargetDeathSound(mesh, hit.point, zone);
      }
      const splatterDamage = Math.max(damage, 4);
      if (killed) {
        ctx.pendingKillBlood.push({
          mesh,
          point: hit.point.clone(),
          dir: bulletDirection?.clone?.() ?? bulletDirection,
          face: hit.face ?? null,
          damage: splatterDamage,
        });
      } else {
        const splatter = spawnBloodSplatter(
          ctx.scene,
          hit.point,
          bulletDirection,
          splatterDamage,
        );
        if (splatter) ctx.bloodSplatters.push(splatter);
        spawnBloodMarkOnTarget(
          mesh,
          hit.point,
          hit.face,
          bulletDirection,
          splatterDamage,
        );
      }
    }
    if (killed) {
      const deathPos = mesh.position.clone();
      scheduleKillDrops(deathPos, zone);
      startDeathAnimation(mesh, bulletDirection, {
        scene: ctx.scene,
        colliders:
          mesh.userData.predictiveDeathColliders ??
          collidersForRagdollNear(
            deathPos.x,
            deathPos.z,
            ctx.allColliders,
            ctx.vx27ContainersRef.current,
          ),
        floorY: ctx.level.floorY,
        bounds: ctx.level.bounds,
        hitZone: zone,
        hitPoint: hit.point,
      });
    }
  }

  function applyGrenadeHit(mesh, hitPoint, blastDir, damage) {
    const ud = mesh.userData;
    if (ud.health <= 0) return { killed: false };
    ud.health = Math.max(0, ud.health - damage);
    ud.repairCooldown = ud.repairDelayAfterHit ?? 3;
    const ratio = ud.health / ud.maxHealth;
    const killed = ud.health <= 0;
    awardCombatScoreAt(mesh, { zone: "grenade", damage, killed }, hitPoint);
    if (killed) {
      scheduleGrenadeKillDrops(mesh.position.clone());
    }
    return { killed, health: ud.health, ratio };
  }

  function flashMuzzle() {
    if (!ctx.weapon) return;
    const palette = getLaserPalette(ctx.playerHealthRef.current > 100);
    ctx.weapon.muzzleFlash.color.setHex(palette.muzzle);
    ctx.weapon.muzzleFlash.intensity = 5;
    if (ctx.flashTimeout) clearTimeout(ctx.flashTimeout);
    ctx.flashTimeout = setTimeout(() => {
      ctx.weapon.muzzleFlash.intensity = 0;
    }, 60);
  }

  function getActiveWeaponConfig() {
    return getPrimaryWeaponConfig(ctx.activePrimaryId);
  }

  function getActiveTuningRef() {
    return ctx.activePrimaryId === "pistol"
      ? ctx.pistolTuningRef
      : ctx.weaponTuningRef;
  }

  function syncAmmoPoolSnapshot() {
    ctx.ammoPoolSnapshotRef.current = {
      rifle: {
        rounds: ctx.ammoPool.rifle.rounds,
        spare: ctx.ammoPool.rifle.spare,
      },
      pistol: {
        rounds: ctx.ammoPool.pistol.rounds,
        spare: ctx.ammoPool.pistol.spare,
      },
    };
  }

  function persistActiveAmmo() {
    ctx.ammoPool[ctx.activePrimaryId].rounds = ctx.roundsInMagRef.current;
    ctx.ammoPool[ctx.activePrimaryId].spare = ctx.spareMagsRef.current;
    syncAmmoPoolSnapshot();
  }

  function applyFireModeForWeapon(id) {
    const mode = resolveFireModeForWeapon(
      id,
      ctx.fireModeByWeaponRef.current[id],
    );
    ctx.fireModeByWeaponRef.current[id] = mode;
    ctx.fireModeRef.current = mode;
    ctx.setFireMode(mode);
  }

  function setFireModeForActiveWeapon(mode) {
    const resolved = resolveFireModeForWeapon(ctx.activePrimaryId, mode);
    ctx.fireModeByWeaponRef.current[ctx.activePrimaryId] = resolved;
    ctx.fireModeRef.current = resolved;
    ctx.setFireMode(resolved);
  }

  function loadActiveAmmo(id) {
    const cfg = getPrimaryWeaponConfig(id);
    const store = ctx.ammoPool[id];
    ctx.roundsInMagRef.current = store.rounds;
    ctx.spareMagsRef.current = store.spare;
    ctx.activePrimaryIdRef.current = id;
    ctx.setActivePrimaryWeapon(id);
    ctx.setActiveMagazineSize(cfg.magazineSize);
    ctx.setActiveLowAmmoThreshold(cfg.lowAmmoThreshold);
    ctx.setRoundsInMag(store.rounds);
    ctx.setSpareMags(store.spare);
    applyFireModeForWeapon(id);
  }

  function setActivePrimaryWeaponView(id) {
    ctx.activePrimaryId = id;
    ctx.activePrimaryIdRef.current = id;
    ctx.weapon = ctx.primaryWeapons[id];
    ctx.weaponRef.current = ctx.weapon;
  }

  function tryReload(force) {
    const cfg = getActiveWeaponConfig();
    if (ctx.spareMagsRef.current <= 0) return false;
    if (!force && ctx.roundsInMagRef.current >= cfg.lowAmmoThreshold) {
      return false;
    }
    ctx.spareMagsRef.current -= 1;
    ctx.roundsInMagRef.current = Math.min(
      ctx.roundsInMagRef.current + cfg.magazineSize,
      cfg.magazineSize * 2,
    );
    persistActiveAmmo();
    ctx.scheduleGameplayHudSyncRef.current();
    ctx.sounds.playSupplyPickup();
    return true;
  }

  function fireOneRound() {
    if (ctx.roundsInMagRef.current <= 0 && !tryReload(true)) return false;

    ctx.roundsInMagRef.current -= 1;
    persistActiveAmmo();
    ctx.scheduleGameplayHudSyncRef.current();

    ctx.weapon.getMuzzleWorld(_muzzlePos, _muzzleDir, ctx.camera);
    ctx.hitRaycaster.setFromCamera(ctx.screenCenter, ctx.camera);

    const camDir = ctx.hitRaycaster.ray.direction.clone();
    const radioactive = ctx.playerHealthRef.current > 100;
    flashMuzzle();
    ctx.sounds.play("laser_shot", { volume: 0.65 });
    const ads = ctx.weapon.getAimBlend?.() ?? 0;
    const scale = 1 - ads * 0.45;
    ctx.player.addAimRecoil(scale);
    ctx.weapon.applyFireKick(ads);

    refreshLiveTargets();
    ctx.shootRaycaster.set(ctx.hitRaycaster.ray.origin, camDir);
    ctx.shootRaycaster.far = BULLET_MAX_RANGE;
    const targetHits = ctx.shootRaycaster.intersectObjects(
      ctx.liveTargetsScratch,
      true,
    );
    const surfaceHits = ctx.shootRaycaster.intersectObjects(
      ctx.levelHitMeshes,
      false,
    );
    const bestHit = pickClosestBulletHit(targetHits, surfaceHits);
    if (bestHit) {
      let targetNode = bestHit.object;
      while (targetNode && !targetNode.userData?.isTarget) {
        targetNode = targetNode.parent;
      }
      if (
        targetNode?.userData?.isTarget &&
        targetNode.userData.health > 0
      ) {
        applyHit(bestHit, camDir, targetNode);
      } else {
        applyBulletSurfaceHit(bestHit, camDir, radioactive);
      }
    }
    return true;
  }

  function processWeaponFire(dt) {
    if (!ctx.weapon || ctx.weaponSwap.isBusy()) return;
    if ((ctx.weapon.getHolsterAmount?.() ?? 0) > 0.02) return;

    const cfg = getActiveWeaponConfig();
    const mode =
      cfg.fireModes.length === 1 ? cfg.fireModes[0] : ctx.fireModeRef.current;
    if (
      burstShotsLeft === 0 &&
      mode === "burst" &&
      ctx.input.consumeShoot()
    ) {
      burstShotsLeft = BURST_SHOT_COUNT;
      burstTimer = 0;
    }

    if (burstShotsLeft > 0) {
      burstTimer -= dt;
      while (burstShotsLeft > 0 && burstTimer <= 0) {
        if (!fireOneRound()) {
          burstShotsLeft = 0;
          break;
        }
        burstShotsLeft -= 1;
        burstTimer = burstShotsLeft > 0 ? BURST_INTERVAL : 0;
      }
      return;
    }

    if (mode === "single" && ctx.input.consumeShoot()) {
      fireOneRound();
    } else if (mode === "auto") {
      autoFireTimer -= dt;
      if (
        ctx.input.isShootHeld() &&
        (ctx.input.consumeShoot() || autoFireTimer <= 0)
      ) {
        if (fireOneRound()) autoFireTimer = AUTO_FIRE_INTERVAL;
      }
    }
  }

  ctx.combat = {
    flushBloodAfterRagdoll,
    flushPendingRagdolls,
    flushPendingKillBlood,
    applyHit,
    applyGrenadeHit,
    processWeaponFire,
    fireOneRound,
    refreshLiveTargets,
    getLiveTargets,
    canFlashbangBlindPlayer,
    scheduleRespawn,
    scheduleKillDrops,
    scheduleGrenadeKillDrops,
    playTargetDeathSound,
    playTargetHoleFallSound,
  };

  ctx.persistActiveAmmo = persistActiveAmmo;
  ctx.tryReload = tryReload;
  ctx.getActiveWeaponConfig = getActiveWeaponConfig;
  ctx.getActiveTuningRef = getActiveTuningRef;
  ctx.loadActiveAmmo = loadActiveAmmo;
  ctx.setActivePrimaryWeaponView = setActivePrimaryWeaponView;
  ctx.setFireModeForActiveWeapon = setFireModeForActiveWeapon;
}
