import * as THREE from "three";
import { isBindingDown, wasBindingPressed } from "./KeyBindings.js";
import {
  resolveBoxCollider,
  rotatedBoxOverlapsCircle,
  shouldSkipCollider,
  pointInDoorwayPassage,
  pointInFloorHole,
  pointInRoundedBoxFootprint,
  beginHoleFall,
  tickHoleFallY,
  resolvePlayerColliders,
  computeResolvedWalkBounds as computeResolvedWalkBoundsWasm,
} from "../physics/Collision.js";
import {
  getDoorwayHeadroomCeilingY,
} from "../rooms/DoorwayWall.js";
import { STAIRS_STEP_RUN } from "../stairs/LevelStairs.js";
import { sampleStairRampFootY, sampleStairRampFootYRaw } from "../stairs/StairRamp.js";
import {
  getVx27RoofHeadroomMargin,
} from "../vx27-container/Vx27Container.js";
import {
  isVx27ContainerColliderNearPlayerCore,
  isVx27ContainerEndOrDoorColliderCore,
  isVx27ContainerHorizontalColliderCore,
  pointInVx27ExteriorColliderFootprintCore,
  shouldSkipVx27ContainerColliderCore,
} from "../vx27-container/Vx27CollisionCore.js";
import {
  groundSurfaceToInput,
  playerColliderToInput,
  resolveSupportInfoCore,
  sampleFlatSupportAtCore,
} from "./GroundSupportCore.js";
import {
  hasHeadroomCore,
  headroomColliderToInput,
  resolveCeilingCollisionsCore,
} from "./PlayerHeadroomCore.js";
import { DEFAULT_WALK_BOB_SIMPLE, resolveWalkBobTuning } from "./WalkBobTuning.js";
import { DEFAULT_RECOIL_TUNING } from "./RecoilTuning.js";
import { clampRecoilPitchAnim, stepAimRecoilPair } from "./RecoilPhysics.js";
import {
  DEFAULT_STAIR_WALK_TUNING,
  normalizeStairWalkTuning,
} from "../stairs/StairWalkTuning.js";
import { AIM_LOOK_MUL, AIM_MOVE_MUL } from "./AimTuning.js";
import { requireWasmMethod } from "@/lib/game-core/requireWasm.js";

const MOUSE_SENS_BASE = 0.0022;
const ARROW_MAX_SPEED_BASE = 2.2;
const ARROW_ACCEL_BASE = 5.6;
const MOUSE_ACCEL_BASE = 5.6;
const LOOK_DAMP = 5.5;
const AIM_RECOIL_PITCH_RANDOM_MIN = 0.85;
const AIM_RECOIL_PITCH_RANDOM_SPREAD = 0.3;

const CROUCH_SPEED = 2.5;
const GRAVITY = -22;
const JUMP_VELOCITY = 8.5;
/** Base sprint pool (~5s drain at 100%); max scales with radioactive HP above 100. */
const SPRINT_STAMINA_BASE = 1;
/** Full sprint drain in ~3.75s at base stamina (33% faster than 5s). */
const SPRINT_DRAIN_PER_SEC = (1 / 5) * 1.33;
/** Refill in 4× the drain duration (~15s at base stamina). */
const SPRINT_RECOVER_PER_SEC = SPRINT_DRAIN_PER_SEC / 4;
/** Bonus above 100% (HP or stamina display) bleeds 1% per interval (test tuning). */
export const RADIOACTIVE_OVERFLOW_DECAY_PCT = 1;
export const RADIOACTIVE_OVERFLOW_DECAY_INTERVAL_SEC = 5;
const DEFAULT_STAND_EYE = 1.65;
const DEFAULT_CROUCH_EYE = 0.85;
const CROUCH_RATIO = DEFAULT_CROUCH_EYE / DEFAULT_STAND_EYE;
const CROUCH_LERP = 12;
const PLAYER_RADIUS = 0.35;
/** Inset when testing the body centre against a hole — smaller than PLAYER_RADIUS
 *  so stepping over the pit lip still commits before you can walk across. */
const HOLE_COMMIT_CENTER_INSET = PLAYER_RADIUS * 0.35;
/** Max camera bank (rad) during a hole fall — corkscrew with yaw, not a barrel roll. */
const HOLE_FALL_ROLL_MAX = 0.13;
/** Ease pitch toward looking up at the receding floor (rad; +pitch = up). */
const HOLE_FALL_PITCH_TARGET = 0.52;
/** Fall depth (m) over which the look-up / spin ramps in. */
const HOLE_FALL_CAMERA_RAMP = 4.5;
/** Max yaw turn (rad) by mid-fall — capped so it swirls but never goes full ballet. */
const HOLE_FALL_YAW_MAX = 1.15;
/** Extra yaw (rad) added over the long drop after the main spin kicks in. */
const HOLE_FALL_YAW_EXTRA = 0.38;
/** Below this horizontal speed, ground snaps hard and step/walk bob decay (no soft step-up while idle). */
const IDLE_MOVE_SPEED = 0.15;
/** Foot-circle samples for hole detection (center + four cardinals). */
const FOOT_SAMPLE_OFFSETS = [
  [0, 0],
  [PLAYER_RADIUS * 0.85, 0],
  [-PLAYER_RADIUS * 0.85, 0],
  [0, PLAYER_RADIUS * 0.85],
  [0, -PLAYER_RADIUS * 0.85],
];
/** Max distance below a flat surface the player can still land on it. */
const FLAT_LAND_REACH = 2.5;
/** Vertical slack required to leave crouch — slightly larger than to enter it, to avoid oscillation at a ceiling exactly at standing height. */
const STAND_CLEARANCE_MARGIN = 0.05;

/** @typedef {{ minX: number, maxX: number, minZ: number, maxZ: number, y: number }} GroundSurface */

export function createPlayerController(camera, bounds, floorY, options = {}) {
  const colliders = options.colliders ?? [];
  /** @type {GroundSurface[]} */
  const groundSurfaces = options.groundSurfaces ?? [];
  const getGroundSurfaces =
    options.getGroundSurfaces ?? (() => groundSurfaces);
  const getColliders = options.getColliders ?? (() => colliders);
  /** Circular cutouts in the arena floor — at points inside any hole the
   *  implicit `floorY` support is suppressed so the player falls through. */
  const getFloorHoles = options.getFloorHoles ?? (() => []);
  /** Rectangular area where the implicit `floorY` applies. Outside these
   *  bounds the player has no implicit floor and will fall unless a
   *  groundSurface supports them. */
  const getFloorBounds = options.getFloorBounds ?? (() => null);
  /** Uniform arena inset on all four walls (same distance from inner wall faces). */
  const arenaBounds = options.arenaBounds ?? null;
  const wallStandoff = options.wallStandoff ?? 0.5;
  const getDoorwayPassages = options.getDoorwayPassages ?? (() => []);
  const getDoorwayOpenings = options.getDoorwayOpenings ?? (() => []);
  const getAttachWall = options.getAttachWall ?? (() => "north");
  const getIsInRoom = options.getIsInRoom ?? (() => false);
  const findFloorExtensionAtZ = options.findFloorExtensionAtZ ?? (() => null);
  const STEP_UP_MAX = 0.42;
  const getInvertYLook = options.getInvertYLook ?? (() => false);
  const getKeyboardLookSpeed = options.getKeyboardLookSpeed ?? (() => 5);
  const getKeyboardLookEase = options.getKeyboardLookEase ?? (() => 0);
  const getMouseLookSpeed = options.getMouseLookSpeed ?? (() => 7);
  const getMouseLookEase = options.getMouseLookEase ?? (() => 1);
  /** Max look velocity in rad/s (caps quick mouse flicks and arrow spam). */
  const getMaxLookRate = options.getMaxLookRate ?? (() => 8);
  const getStandEyeHeight = options.getStandEyeHeight ?? (() => DEFAULT_STAND_EYE);
  const getBindings = options.getBindings ?? (() => ({}));
  const getWalkBobTuning =
    options.getWalkBobTuning ??
    (() => resolveWalkBobTuning(DEFAULT_WALK_BOB_SIMPLE));
  const getRecoilTuning = options.getRecoilTuning ?? (() => DEFAULT_RECOIL_TUNING);
  const getStairWalkTuning =
    options.getStairWalkTuning ??
    (() => normalizeStairWalkTuning(DEFAULT_STAIR_WALK_TUNING));
  /** 1 at normal HP; HP/100 when radioactive (e.g. 120 HP → 1.2 pool). */
  const getStaminaMax =
    options.getStaminaMax ?? (() => SPRINT_STAMINA_BASE);
  const gameCore = options.gameCore ?? null;
  const onFootstep = options.onFootstep ?? null;
  /** Spawn point used by `respawn()` after a death-fall. Defaults to the
   *  legacy player start so existing levels behave the same. */
  const initialPosition = options.initialPosition
    ? new THREE.Vector3(
        options.initialPosition.x ?? 0,
        options.initialPosition.y ?? DEFAULT_STAND_EYE,
        options.initialPosition.z ?? 6
      )
    : new THREE.Vector3(0, DEFAULT_STAND_EYE, 6);
  const initialYaw = options.initialYaw ?? 0;
  const position = initialPosition.clone();
  const velocity = new THREE.Vector3();
  const stairLocalScratch = new THREE.Vector3();
  const moveForward = new THREE.Vector3();
  const moveUp = new THREE.Vector3(0, 1, 0);
  const moveRight = new THREE.Vector3();
  const moveDir = new THREE.Vector3();
  /** Reused while foot Y is unchanged across X/Z collision substeps. */
  let collisionResolveCtx = null;
  let yaw = initialYaw;
  let pitch = 0;
  let eyeHeight = DEFAULT_STAND_EYE;
  let grounded = true;
  let prevSupportY = floorY;
  let stepBobY = 0;
  let stepBobVel = 0;
  let walkBobPhase = 0;
  let walkBobY = 0;
  let walkBobPitch = 0;
  let walkBobRoll = 0;
  let walkBobActivity = 0;
  let stamina = SPRINT_STAMINA_BASE;
  let isSprinting = false;
  let lastStaminaMax = SPRINT_STAMINA_BASE;
  let onStairs = false;
  const arrowLookVel = { yaw: 0, pitch: 0 };
  const mouseLookVel = { yaw: 0, pitch: 0 };
  /** Committed hole fall — horizontal movement is locked so the player cannot
   *  walk out of the pit before the death handler fires. */
  const holeFallState = { fallingThroughHole: false, holeFallVelY: -2 };
  let holeFallRoll = 0;
  let holeFallPitch = 0;
  let holeFallYaw = 0;
  let recoilPitchAnim = 0;
  let recoilPitchVel = 0;
  let recoilPitchTarget = 0;
  let recoilYawAnim = 0;
  let recoilYawVel = 0;
  let recoilYawTarget = 0;

  camera.position.copy(position);

  function isOverFloorHole(x, z) {
    const holes = getFloorHoles();
    if (!holes?.length) return false;
    if (pointInFloorHole(x, z, holes, HOLE_COMMIT_CENTER_INSET, gameCore)) return true;
    for (const [ox, oz] of FOOT_SAMPLE_OFFSETS) {
      if (pointInFloorHole(x + ox, z + oz, holes, 0, gameCore)) return true;
    }
    return false;
  }

  function tryBeginHoleFall() {
    if (holeFallState.fallingThroughHole) return;
    if (!getFloorHoles()?.length) return;
    if (!isOverFloorHole(position.x, position.z)) return;
    const footY = position.y - eyeHeight;
    if (footY > floorY + 0.12) return;
    const supportY = getSupportY(position.x, position.z, footY);
    if (Number.isFinite(supportY) && supportY > floorY + 0.05) return;
    beginHoleFall(holeFallState);
    holeFallRoll = walkBobRoll;
    holeFallPitch = pitch + walkBobPitch;
    holeFallYaw = 0;
  }

  function updateHoleFallCamera(dt) {
    const footY = position.y - eyeHeight;
    const fallDepth = Math.max(0, floorY - footY);
    const fallT = THREE.MathUtils.clamp(
      fallDepth / HOLE_FALL_CAMERA_RAMP,
      0,
      1
    );
    const spinT = fallT * fallT;

    holeFallPitch +=
      (HOLE_FALL_PITCH_TARGET - holeFallPitch) * (1 - Math.exp(-2.2 * dt));

    const extraT = THREE.MathUtils.clamp(
      (fallDepth - HOLE_FALL_CAMERA_RAMP) / HOLE_FALL_CAMERA_RAMP,
      0,
      1
    );
    const targetYaw = HOLE_FALL_YAW_MAX * spinT + HOLE_FALL_YAW_EXTRA * extraT;
    holeFallYaw += (targetYaw - holeFallYaw) * (1 - Math.exp(-2.6 * dt));

    const targetRoll =
      Math.sin(holeFallYaw * 1.65) * HOLE_FALL_ROLL_MAX * spinT;
    holeFallRoll += (targetRoll - holeFallRoll) * (1 - Math.exp(-5 * dt));
  }

  function integrateHoleFall(dt) {
    velocity.x = 0;
    velocity.z = 0;
    grounded = false;
    onStairs = false;
    walkBobY = 0;
    walkBobPitch = 0;
    walkBobRoll = 0;
    stepBobY = 0;
    stepBobVel = 0;

    updateHoleFallCamera(dt);

    const footY = position.y - eyeHeight;
    const { nextY } = tickHoleFallY(holeFallState, footY, floorY, dt);
    position.y = nextY + eyeHeight;
    velocity.y = holeFallState.holeFallVelY ?? -2;
    resolveBounds();
    syncCamera();
  }

  function aimLookMultiplier(input) {
    return isBindingDown(input, getBindings(), "aim") ? AIM_LOOK_MUL : 1;
  }

  function updateArrowLook(input, dt) {
    const bindings = getBindings();
    const invert = getInvertYLook();
    const wantYaw =
      (isBindingDown(input, bindings, "lookRight") ? 1 : 0) -
      (isBindingDown(input, bindings, "lookLeft") ? 1 : 0);
    const rawPitch =
      (isBindingDown(input, bindings, "lookUp") ? 1 : 0) -
      (isBindingDown(input, bindings, "lookDown") ? 1 : 0);
    const wantPitch = rawPitch * (invert ? 1 : -1);

    const arrowMaxSpeed =
      ARROW_MAX_SPEED_BASE * getKeyboardLookSpeed() * aimLookMultiplier(input);

    const targetYaw = wantYaw * arrowMaxSpeed;
    const targetPitch = wantPitch * arrowMaxSpeed;

    const keyboardEase = getKeyboardLookEase();
    if (keyboardEase <= 0) {
      arrowLookVel.yaw = targetYaw;
      arrowLookVel.pitch = targetPitch;
    } else {
      const arrowAccel = ARROW_ACCEL_BASE / keyboardEase;
      const ease = 1 - Math.exp(-arrowAccel * dt);
      arrowLookVel.yaw += (targetYaw - arrowLookVel.yaw) * ease;
      arrowLookVel.pitch += (targetPitch - arrowLookVel.pitch) * ease;
    }

    const damp = Math.exp(-LOOK_DAMP * dt);
    if (wantYaw === 0) arrowLookVel.yaw *= damp;
    if (wantPitch === 0) arrowLookVel.pitch *= damp;

  }

  function applyMouseLook(input, dt) {
    const { dx, dy } = input.getMouseDelta();
    const touchLook = input.isTouchMode?.() && input.isTouchLookActive?.();
    if (!input.isLocked() && !touchLook) {
      mouseLookVel.yaw = 0;
      mouseLookVel.pitch = 0;
      arrowLookVel.yaw = 0;
      arrowLookVel.pitch = 0;
      return;
    }

    const mouseSens =
      MOUSE_SENS_BASE * getMouseLookSpeed() * aimLookMultiplier(input);
    const mousePitchSign = getInvertYLook() ? -1 : 1;
    const easeSetting = getMouseLookEase();
    const mouseAccel =
      easeSetting > 0 ? MOUSE_ACCEL_BASE / easeSetting : Number.POSITIVE_INFINITY;
    const invDt = 1 / Math.max(dt, 0.001);

    const targetYaw = dx * mouseSens * invDt;
    const targetPitch = dy * mouseSens * mousePitchSign * invDt;

    if (easeSetting <= 0) {
      mouseLookVel.yaw = targetYaw;
      mouseLookVel.pitch = targetPitch;
    } else {
      const ease = 1 - Math.exp(-mouseAccel * dt);
      mouseLookVel.yaw += (targetYaw - mouseLookVel.yaw) * ease;
      mouseLookVel.pitch += (targetPitch - mouseLookVel.pitch) * ease;

      const damp = Math.exp(-LOOK_DAMP * dt);
      if (dx === 0) mouseLookVel.yaw *= damp;
      if (dy === 0) mouseLookVel.pitch *= damp;
    }

  }

  function clampPitch() {
    const limit = Math.PI / 2 - 0.05;
    pitch = THREE.MathUtils.clamp(pitch, -limit, limit);
    recoilPitchAnim = clampRecoilPitchAnim(
      gameCore,
      pitch,
      recoilPitchAnim,
      limit,
    );
  }

  function stepAimRecoil(dt) {
    const t = getRecoilTuning();
    const next = stepAimRecoilPair(gameCore, {
      pitchValue: recoilPitchAnim,
      pitchVelocity: recoilPitchVel,
      pitchTarget: recoilPitchTarget,
      yawValue: recoilYawAnim,
      yawVelocity: recoilYawVel,
      yawTarget: recoilYawTarget,
      stiffness: t.springStiffness,
      damping: t.springDamping,
      dt,
    });
    recoilPitchAnim = next.pitchValue;
    recoilPitchVel = next.pitchVelocity;
    recoilYawAnim = next.yawValue;
    recoilYawVel = next.yawVelocity;
    clampPitch();
  }

  function clampLookVelocities(aimLookMul = 1) {
    const maxRate = Math.max(0.5, getMaxLookRate()) * aimLookMul;
    mouseLookVel.yaw = THREE.MathUtils.clamp(mouseLookVel.yaw, -maxRate, maxRate);
    mouseLookVel.pitch = THREE.MathUtils.clamp(
      mouseLookVel.pitch,
      -maxRate,
      maxRate
    );
    arrowLookVel.yaw = THREE.MathUtils.clamp(arrowLookVel.yaw, -maxRate, maxRate);
    arrowLookVel.pitch = THREE.MathUtils.clamp(
      arrowLookVel.pitch,
      -maxRate,
      maxRate
    );
  }

  function applyLookVelocities(dt, aimLookMul = 1) {
    const maxDelta = Math.max(0.5, getMaxLookRate()) * aimLookMul * dt;
    yaw -= THREE.MathUtils.clamp(mouseLookVel.yaw * dt, -maxDelta, maxDelta);
    yaw -= THREE.MathUtils.clamp(arrowLookVel.yaw * dt, -maxDelta, maxDelta);
    pitch -= THREE.MathUtils.clamp(mouseLookVel.pitch * dt, -maxDelta, maxDelta);
    pitch -= THREE.MathUtils.clamp(arrowLookVel.pitch * dt, -maxDelta, maxDelta);
  }

  function syncCamera() {
    camera.position.set(
      position.x,
      position.y + stepBobY + walkBobY,
      position.z
    );
    const euler = holeFallState.fallingThroughHole
      ? new THREE.Euler(holeFallPitch, yaw + holeFallYaw, holeFallRoll, "YXZ")
      : new THREE.Euler(
          pitch + recoilPitchAnim + walkBobPitch,
          yaw + recoilYawAnim,
          walkBobRoll,
          "YXZ",
        );
    camera.quaternion.setFromEuler(euler);
  }

  function updateWalkBob(horizontalSpeed, crouching, aiming, dt) {
    const t = getWalkBobTuning();
    const stairWalk = getStairWalkTuning();
    const fade = Math.exp(-10 * dt);
    const bobEase = 1 - Math.exp(-t.walkSmooth * dt);
    const moving = horizontalSpeed > 0.15;
    const airborne = !grounded && velocity.y > 0.35;
    const activityTarget = moving && !airborne ? 1 : 0;

    const bobFreq = onStairs
      ? Math.max(
          stairWalk.bobFreqMin,
          (horizontalSpeed / STAIRS_STEP_RUN) * stairWalk.bobFreqSpeedScale
        )
      : t.walkFreqBase + horizontalSpeed * t.walkFreqPerSpeed;

    const canStep = moving && !airborne && grounded;

    walkBobActivity +=
      (activityTarget - walkBobActivity) *
      (1 - Math.exp(-t.walkFade * dt));

    if (walkBobActivity < 0.01) {
      walkBobY *= fade;
      walkBobPitch *= fade;
      walkBobRoll *= fade;
      walkBobPhase = 0;
      return;
    }

    const speedFactor = THREE.MathUtils.clamp(
      horizontalSpeed / Math.max(t.walkSpeed, 0.1),
      0.4,
      1.2
    );
    const crouchFactor = crouching ? 0.55 : 1;
    const aimFactor = aiming ? AIM_MOVE_MUL : 1;
    const intensity = speedFactor * crouchFactor * aimFactor * walkBobActivity;

    const phaseBefore = walkBobPhase;
    walkBobPhase += dt * bobFreq * Math.PI * 2 * walkBobActivity;

    if (onFootstep && canStep && walkBobActivity > 0.35) {
      const beforeHalf = Math.floor(phaseBefore / Math.PI);
      const afterHalf = Math.floor(walkBobPhase / Math.PI);
      for (let half = beforeHalf + 1; half <= afterHalf; half++) {
        onFootstep({
          speed: horizontalSpeed,
          crouching,
          sprinting: isSprinting,
          onStairs,
        });
      }
    }

    if (onStairs) {
      const amp = t.walkAmp * intensity * stairWalk.cameraBobScale;
      const targetY = Math.sin(walkBobPhase) * amp;
      const targetPitch =
        Math.cos(walkBobPhase) *
        t.walkPitch *
        intensity *
        stairWalk.cameraBobPitchScale;
      const targetRoll =
        Math.sin(walkBobPhase * 0.5) *
        t.walkRoll *
        intensity *
        stairWalk.cameraBobRollScale;

      walkBobY += (targetY - walkBobY) * bobEase;
      walkBobPitch += (targetPitch - walkBobPitch) * bobEase;
      walkBobRoll += (targetRoll - walkBobRoll) * bobEase;
      return;
    }

    const amp = t.walkAmp * intensity;

    const targetY = Math.sin(walkBobPhase) * amp;
    const targetPitch = Math.cos(walkBobPhase) * t.walkPitch * intensity;
    const targetRoll = Math.sin(walkBobPhase * 0.5) * t.walkRoll * intensity;

    walkBobY += (targetY - walkBobY) * bobEase;
    walkBobPitch += (targetPitch - walkBobPitch) * bobEase;
    walkBobRoll += (targetRoll - walkBobRoll) * bobEase;
  }

  function springStepBob(value, velocity, stiffness, damping, dt) {
    velocity += (-value * stiffness - velocity * damping) * dt;
    value += velocity * dt;
    return { value, velocity };
  }

  function isCatwalkSurface(surf, footY, ySlack) {
    return (
      !surf.stairFlight &&
      !surf.stairRamp &&
      surf.y != null &&
      Math.abs(surf.y - footY) <= ySlack &&
      surf.minX != null &&
      (surf.arenaCatwalkDeck || surf.catwalkWalk)
    );
  }

  /** True when the player capsule stands on room exterior catwalk geometry. */
  function onRoomCatwalkDeck(footY, x, z) {
    const ySlack = 0.15;
    const r = PLAYER_RADIUS;
    for (const surf of getGroundSurfaces()) {
      if (!surf.catwalkWalk || surf.y == null) continue;
      if (Math.abs(surf.y - footY) > ySlack) continue;
      if (capsuleOverlapsSurface(x, z, r, surf)) return true;
    }
    return false;
  }

  /** True when the player capsule stands on real deck geometry at catwalk height. */
  function onArenaCatwalkDeck(footY, x, z) {
    const ySlack = 0.15;
    const r = PLAYER_RADIUS;
    for (const surf of getGroundSurfaces()) {
      if (!surf.arenaCatwalkDeck || surf.y == null) continue;
      if (Math.abs(surf.y - footY) > ySlack) continue;
      if (capsuleOverlapsSurface(x, z, r, surf)) return true;
    }
    return false;
  }

  /** Highest catwalk slab under the foot capsule (arena L-deck + room exterior). */
  function catwalkDeckSupportY(x, z) {
    let best = Number.NEGATIVE_INFINITY;
    const r = PLAYER_RADIUS;
    for (const surf of getGroundSurfaces()) {
      if ((!surf.arenaCatwalkDeck && !surf.catwalkWalk) || surf.y == null) continue;
      if (!capsuleOverlapsSurface(x, z, r, surf)) continue;
      best = Math.max(best, surf.y);
    }
    return Number.isFinite(best) ? best : null;
  }

  /** True when standing on the flat top of a stair stringer side wall. */
  function onStairSideWalk(footY, x, z) {
    const ySlack = 0.15;
    const r = PLAYER_RADIUS;
    for (const surf of getGroundSurfaces()) {
      if (!surf.stairSideWalk || surf.y == null) continue;
      if (Math.abs(surf.y - footY) > ySlack) continue;
      if (capsuleOverlapsSurface(x, z, r, surf)) return true;
    }
    return false;
  }

  function isStairSideWalkSurface(surf, footY, ySlack) {
    return (
      surf.stairSideWalk &&
      surf.y != null &&
      Math.abs(surf.y - footY) <= ySlack &&
      surf.minX != null
    );
  }

  function capsuleOverlapsSurface(x, z, radius, surf) {
    return (
      x >= surf.minX - radius &&
      x <= surf.maxX + radius &&
      z >= surf.minZ - radius &&
      z <= surf.maxZ + radius
    );
  }

  /** Coplanar catwalk deck pieces flush within this gap count as one walk surface. */
  const SLAB_ADJACENCY_EPS = 0.08;

  function catwalkSlabSharesEdge(a, b, edge) {
    if (a === b) return false;
    const overlapX =
      a.minX < b.maxX - SLAB_ADJACENCY_EPS && a.maxX > b.minX + SLAB_ADJACENCY_EPS;
    const overlapZ =
      a.minZ < b.maxZ - SLAB_ADJACENCY_EPS && a.maxZ > b.minZ + SLAB_ADJACENCY_EPS;
    if (edge === "north") {
      return overlapX && Math.abs(a.minZ - b.maxZ) <= SLAB_ADJACENCY_EPS;
    }
    if (edge === "south") {
      return overlapX && Math.abs(a.maxZ - b.minZ) <= SLAB_ADJACENCY_EPS;
    }
    if (edge === "west") {
      return overlapZ && Math.abs(a.minX - b.maxX) <= SLAB_ADJACENCY_EPS;
    }
    if (edge === "east") {
      return overlapZ && Math.abs(a.maxX - b.minX) <= SLAB_ADJACENCY_EPS;
    }
    return false;
  }

  function catwalkSlabHasNeighbor(slab, deckSlabs, edge) {
    for (const other of deckSlabs) {
      if (catwalkSlabSharesEdge(slab, other, edge)) return true;
    }
    return false;
  }

  function isNorthAttachCatwalkDropLip(slab, attachWall) {
    if (attachWall !== "north" || !arenaBounds) return false;
    if (slab.roomCatwalkDeck) return true;
    return Math.abs(slab.maxZ - arenaBounds.minZ) <= 0.75;
  }

  function isSouthAttachCatwalkDropLip(slab, attachWall) {
    if (attachWall !== "south" || !arenaBounds) return false;
    if (slab.roomCatwalkDeck) return true;
    return Math.abs(slab.minZ - arenaBounds.maxZ) <= 0.75;
  }

  function catwalkSlabExteriorRect(slab, deckSlabs, r, inPassage, attachWall) {
    let minX = slab.minX;
    let maxX = slab.maxX;
    let minZ = slab.minZ;
    let maxZ = slab.maxZ;
    const es = slab.edgeStandoff ?? {};

    if (!catwalkSlabHasNeighbor(slab, deckSlabs, "west")) {
      // west: 0 is the clerestory open edge on the main L-deck only — not extension slabs.
      if (es.west === 0 && !slab.roomCatwalkDeck) {
        minX = bounds.minX;
      } else if (es.west > 0) {
        minX += es.west;
      } else {
        minX += wallStandoff;
      }
    }
    if (!catwalkSlabHasNeighbor(slab, deckSlabs, "east") && es.east > 0) {
      maxX -= es.east;
    }
    if (!catwalkSlabHasNeighbor(slab, deckSlabs, "south")) {
      if (isNorthAttachCatwalkDropLip(slab, attachWall)) {
        maxZ = bounds.maxZ;
      } else if (inPassage && attachWall === "north" && arenaBounds) {
        maxZ = Math.max(maxZ, arenaBounds.minZ);
      } else if (es.south > 0) {
        maxZ -= es.south;
      }
    } else if (isNorthAttachCatwalkDropLip(slab, attachWall)) {
      maxZ = bounds.maxZ;
    }

    if (!catwalkSlabHasNeighbor(slab, deckSlabs, "north")) {
      if (isSouthAttachCatwalkDropLip(slab, attachWall)) {
        minZ = bounds.minZ;
      } else if (inPassage && attachWall === "south" && arenaBounds) {
        minZ = Math.min(minZ, arenaBounds.maxZ);
      } else if (es.north > 0) {
        minZ += es.north;
      }
    } else if (isSouthAttachCatwalkDropLip(slab, attachWall)) {
      minZ = bounds.minZ;
    }

    return {
      minX: minX + r,
      maxX: maxX - r,
      minZ: minZ + r,
      maxZ: maxZ - r,
    };
  }

  function findCatwalkWalkBounds(footY, x, z) {
    if (footY <= floorY + 0.5) return null;

    const ySlack = 0.15;
    const r = PLAYER_RADIUS;
    const surfaces = getGroundSurfaces();

    const onDeck = onArenaCatwalkDeck(footY, x, z);
    const onSideWalk = onStairSideWalk(footY, x, z);
    const onStairAtCatwalk = onStairs && footY >= floorY + 3 - ySlack;

    let onCatwalk = onDeck || onSideWalk || onStairAtCatwalk;
    if (!onCatwalk) {
      for (const surf of surfaces) {
        if (!isCatwalkSurface(surf, footY, ySlack) || surf.arenaCatwalkDeck) continue;
        if (pointInSurfaceBounds(x, z, surf)) {
          onCatwalk = true;
          break;
        }
      }
    }
    if (!onCatwalk) return null;

    const inPassage = pointInDoorwayPassage(x, z, getDoorwayPassages());
    const attachWall = getAttachWall();

    /** @type {GroundSurface[]} */
    const deckSlabs = [];
    for (const surf of surfaces) {
      if (
        isCatwalkSurface(surf, footY, ySlack) ||
        isStairSideWalkSurface(surf, footY, ySlack)
      ) {
        if (surf.minX != null) deckSlabs.push(surf);
      }
    }

    /** @type {GroundSurface[]} */
    const supporting = [];
    for (const surf of deckSlabs) {
      if (
        (onSideWalk && surf.stairSideWalk) ||
        capsuleOverlapsSurface(x, z, r, surf) ||
        pointInSurfaceBounds(x, z, surf)
      ) {
        supporting.push(surf);
      }
    }
    if (!supporting.length) return null;

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const slab of supporting) {
      const rect = catwalkSlabExteriorRect(
        slab,
        deckSlabs,
        r,
        inPassage,
        attachWall
      );
      minX = Math.min(minX, rect.minX);
      maxX = Math.max(maxX, rect.maxX);
      minZ = Math.min(minZ, rect.minZ);
      maxZ = Math.max(maxZ, rect.maxZ);
    }

    if (!Number.isFinite(minX)) return null;
    return { minX, maxX, minZ, maxZ };
  }

  function computeResolvedWalkBounds(x, z, footY) {
    const r = PLAYER_RADIUS;
    const inRoomFootprint = arenaBounds ? getIsInRoom(x, z) : false;
    const extensionFp = findFloorExtensionAtZ(z);
    const onFloorExtension =
      extensionFp != null &&
      (inRoomFootprint ||
        (x >= extensionFp.minX - r && x <= extensionFp.maxX + r));
    const inAttachedFootprint = inRoomFootprint || onFloorExtension;
    const onCatwalkHeight = footY >= floorY + 3;
    const inRoomAtFloor = inAttachedFootprint && !onCatwalkHeight;
    const catwalkBounds =
      !inRoomAtFloor ? findCatwalkWalkBounds(footY, x, z) : null;

    return computeResolvedWalkBoundsWasm(
      {
        x,
        z,
        footY,
        radius: r,
        bounds,
        floorY,
        arenaBounds,
        extensionFp,
        inAttachedFootprint,
        onFloorExtension,
        catwalkBounds,
        attachWall: getAttachWall(),
        inPassage: pointInDoorwayPassage(x, z, getDoorwayPassages()),
      },
      gameCore,
    );
  }

  function resolveBounds() {
    const footY = position.y - eyeHeight;
    const walk = computeResolvedWalkBounds(position.x, position.z, footY);
    position.x = THREE.MathUtils.clamp(position.x, walk.minX, walk.maxX);
    position.z = THREE.MathUtils.clamp(position.z, walk.minZ, walk.maxZ);
  }

  function worldToStairLocal(stairFlight, x, z) {
    stairLocalScratch.set(x, 0, z);
    stairLocalScratch.applyMatrix4(stairFlight.inverseMatrix);
    return { localX: stairLocalScratch.x, localZ: stairLocalScratch.z };
  }

  function sampleStairLocalZ(x, z) {
    for (const surf of getGroundSurfaces()) {
      if (!surf.stairFlight?.inverseMatrix) continue;
      stairLocalScratch.set(x, 0, z);
      stairLocalScratch.applyMatrix4(surf.stairFlight.inverseMatrix);
      return stairLocalScratch.z;
    }
    return null;
  }

  function stairClimbLocalMotion(stairFlight) {
    const speed = Math.hypot(velocity.x, velocity.z);
    if (speed < 0.05) return 0;
    const yawRad = stairFlight.rotationY ?? 0;
    return (
      (velocity.x * Math.sin(yawRad) + velocity.z * Math.cos(yawRad)) / speed
    );
  }

  function sampleRawRampFootY(x, z) {
    for (const surf of getGroundSurfaces()) {
      if (!surf.stairRamp || !surf.stairFlight?.ramp) continue;
      const y = sampleStairRampFootYRaw(
        surf.stairFlight,
        x,
        z,
        stairLocalScratch
      );
      if (y != null) return y;
    }
    return null;
  }

  function sampleRampSupportY(x, z, footY) {
    const stepUpReach = onStairs ? STEP_UP_MAX + 0.12 : STEP_UP_MAX;
    for (const surf of getGroundSurfaces()) {
      if (!surf.stairRamp || !surf.stairFlight?.ramp) continue;
      const y = sampleStairRampFootY(
        surf.stairFlight,
        x,
        z,
        stairLocalScratch,
        footY,
        stepUpReach,
        onStairs
      );
      if (y != null) return y;
    }
    return null;
  }

  function pointInSurfaceBounds(x, z, surf) {
    return (
      x >= surf.minX &&
      x <= surf.maxX &&
      z >= surf.minZ &&
      z <= surf.maxZ
    );
  }

  function hasImplicitFloorSupport(x, z) {
    const fb = getFloorBounds();
    if (fb && (x < fb.minX || x > fb.maxX || z < fb.minZ || z > fb.maxZ)) {
      return false;
    }
    return !pointInFloorHole(x, z, getFloorHoles(), PLAYER_RADIUS, gameCore);
  }

  function buildFloorHolesInput() {
    return getFloorHoles().map((h) => ({
      x: h.x,
      z: h.z,
      radius: h.radius,
    }));
  }

  function sampleFlatSupportAt(x, z, footY, colliders) {
    return sampleFlatSupportAtCore(gameCore, {
      x,
      z,
      footY,
      bodyTop: footY + eyeHeight,
      floorY,
      playerRadius: PLAYER_RADIUS,
      onArenaCatwalkDeck: onArenaCatwalkDeck(footY, x, z),
      onRoomCatwalkDeck: onRoomCatwalkDeck(footY, x, z),
      catwalkDeckSupportY: catwalkDeckSupportY(x, z),
      floorBounds: getFloorBounds(),
      floorHoles: buildFloorHolesInput(),
      groundSurfaces: getGroundSurfaces().map(groundSurfaceToInput),
      colliders: colliders.map(playerColliderToInput),
    });
  }

  function getSupportInfo(x, z, footY) {
    const colliders = getColliders();
    const rampY = sampleRampSupportY(x, z, footY);
    const { bestFlat: sampledFlat, highestStepUp } = sampleFlatSupportAt(
      x,
      z,
      footY,
      colliders,
    );

    let climbLocalMotion = 0;
    for (const surf of getGroundSurfaces()) {
      if (surf.stairFlight) {
        climbLocalMotion = stairClimbLocalMotion(surf.stairFlight);
        break;
      }
    }

    return resolveSupportInfoCore(gameCore, {
      x,
      z,
      footY,
      floorY,
      playerRadius: PLAYER_RADIUS,
      rampY,
      stepUpFlat: highestStepUp,
      bestFlat: sampledFlat,
      climbLocalMotion,
      stairLocalZ: sampleStairLocalZ(x, z),
      onArenaCatwalkDeck: onArenaCatwalkDeck(footY, x, z),
      onRoomCatwalkDeck: onRoomCatwalkDeck(footY, x, z),
      catwalkDeckSupportY: catwalkDeckSupportY(x, z),
      floorBounds: getFloorBounds(),
      floorHoles: buildFloorHolesInput(),
    });
  }

  function getSupportY(x, z, footY) {
    return getSupportInfo(x, z, footY).supportY;
  }


  /**
   * Does the player have enough vertical clearance at (x, z) to occupy a body
   * of `desiredHeight` standing on `footY`? Returns false when any active
   * bounded collider straddles the desired vertical span AND overlaps the
   * player's XZ circle. Unbounded colliders (full-height walls) are ignored —
   * they're handled by the normal push-out resolver, not the ceiling check.
   *
   * Used to gate stand-up and jump so the player can't uncrouch into the
   * underside of a step / overhang or jump up into one.
   *
   * @param {number} x
   * @param {number} z
   * @param {number} footY
   * @param {number} desiredHeight
   */
  function buildHeadroomColliders() {
    return getColliders().map((box) => ({
      ...headroomColliderToInput(box),
      vx27RoofHeadroomMargin: getVx27RoofHeadroomMargin(box),
    }));
  }

  function hasHeadroom(x, z, footY, desiredHeight) {
    return hasHeadroomCore(gameCore, {
      x,
      z,
      footY,
      desiredHeight,
      playerRadius: PLAYER_RADIUS,
      floorY,
      inPassage: pointInDoorwayPassage(x, z, getDoorwayPassages()),
      doorwayCeilingY: getDoorwayHeadroomCeilingY(
        x,
        z,
        getDoorwayPassages(),
        getDoorwayOpenings(),
        footY,
        floorY,
        PLAYER_RADIUS,
      ),
      colliders: buildHeadroomColliders(),
    });
  }

  /** Stop upward movement when the camera hits a collider underside from below. */
  function resolveCeilingCollisions() {
    if (velocity.y <= 0) return;

    const footY = position.y - eyeHeight;
    const resolved = resolveCeilingCollisionsCore(gameCore, {
      x: position.x,
      z: position.z,
      footY,
      positionY: position.y,
      velocityY: velocity.y,
      playerRadius: PLAYER_RADIUS,
      floorY,
      inPassage: pointInDoorwayPassage(
        position.x,
        position.z,
        getDoorwayPassages(),
      ),
      colliders: buildHeadroomColliders(),
    });
    position.y = resolved.positionY;
    velocity.y = resolved.velocityY;
  }

  function getCollisionResolveCtx(footY) {
    if (
      collisionResolveCtx &&
      collisionResolveCtx.footY === footY &&
      collisionResolveCtx.x === position.x &&
      collisionResolveCtx.z === position.z
    ) {
      return collisionResolveCtx;
    }
    const colliders = getColliders();
    const supportInfo = getSupportInfo(position.x, position.z, footY);
    let climbLocalMotion = 0;
    for (const box of colliders) {
      if (box.stairFlight) {
        climbLocalMotion = stairClimbLocalMotion(box.stairFlight);
        break;
      }
    }
    collisionResolveCtx = {
      footY,
      x: position.x,
      z: position.z,
      bodyTop: position.y,
      rampFootY: sampleRawRampFootY(position.x, position.z),
      supportInfo,
      supportY: supportInfo.supportY,
      climbLocalMotion,
      colliders,
    };
    return collisionResolveCtx;
  }

  function resolveColliders() {
    const colliders = getColliders();
    let footY = position.y - eyeHeight;
    let bodyTop = position.y;
    let climbLocalMotion = 0;
    for (const box of colliders) {
      if (box.stairFlight) {
        climbLocalMotion = stairClimbLocalMotion(box.stairFlight);
        break;
      }
    }

    let supportInfo = getSupportInfo(position.x, position.z, footY);
    let supportY = supportInfo.supportY;
    let rampFootY = sampleRawRampFootY(position.x, position.z);

    /** @type {import("../physics/Collision.js").ColliderBox[]} */
    const entries = [];
    for (const box of colliders) {
      if (box.active === false) continue;

      if (
        (box.kind === "pillar" || box.kind === "oilBarrel" || box.kind === "controlPanel") &&
        (box.cornerRadius ?? 0) > 0 &&
        !pointInRoundedBoxFootprint(box, position.x, position.z, PLAYER_RADIUS, gameCore)
      ) {
        continue;
      }

      if (
        box.kind === "vx27ContainerWall" &&
        isVx27ContainerEndOrDoorColliderCore(gameCore, box) &&
        !isVx27ContainerColliderNearPlayerCore(gameCore, box, position.x, position.z)
      ) {
        continue;
      }

      if (
        box.kind === "vx27ContainerWall" &&
        isVx27ContainerHorizontalColliderCore(gameCore, box) &&
        !isVx27ContainerEndOrDoorColliderCore(gameCore, box) &&
        !pointInVx27ExteriorColliderFootprintCore(
          gameCore,
          box,
          position.x,
          position.z,
          PLAYER_RADIUS,
        )
      ) {
        continue;
      }

      const stairLocal = box.stairFlight
        ? worldToStairLocal(box.stairFlight, position.x, position.z)
        : null;
      const boxClimb = box.stairFlight
        ? stairClimbLocalMotion(box.stairFlight)
        : climbLocalMotion;

      if (
        box.kind === "vx27ContainerWall" &&
        !isVx27ContainerHorizontalColliderCore(gameCore, box)
      ) {
        continue;
      }
      if (
        box.kind === "vx27ContainerWall" &&
        shouldSkipVx27ContainerColliderCore(gameCore, box, position.x, position.z, footY)
      ) {
        continue;
      }

      entries.push({
        collider: box,
        stairLocal,
        climbLocalMotion: boxClimb,
      });
    }

    const resolved = resolvePlayerColliders(
      {
        x: position.x,
        z: position.z,
        radius: PLAYER_RADIUS,
        footY,
        bodyTop,
        stepUpMax: STEP_UP_MAX,
        supportY,
        rampFootY,
        followingRamp: supportInfo.stairRamp,
        entries,
      },
      gameCore,
    );
    position.x = resolved.x;
    position.z = resolved.z;

    collisionResolveCtx = {
      footY,
      x: position.x,
      z: position.z,
      bodyTop,
      rampFootY,
      supportInfo,
      supportY,
      climbLocalMotion,
      colliders,
    };
  }

  /**
   * HP sets the gain cap for stamina (120 HP → can earn up to 120%).
   * Damage only lowers HP — never strips stamina. After hurt, stamina may
   * stay above HP (run buffer) but regen won't refill back up to the HP cap;
   * only HP pickups/heals raise stamina into a higher band.
   */
  function applyStaminaMaxChange() {
    requireWasmMethod(gameCore, "syncStaminaMax")(
      Math.max(SPRINT_STAMINA_BASE, getStaminaMax()),
    );
    const state = requireWasmMethod(gameCore, "getPublicState")();
    stamina = state.stamina ?? stamina;
    lastStaminaMax = state.staminaMax ?? lastStaminaMax;
    isSprinting = Boolean(state.sprinting);
  }

  return {
    update(input, dt) {
      collisionResolveCtx = null;
      if (!holeFallState.fallingThroughHole) {
        const aimLookMul = aimLookMultiplier(input);
        applyMouseLook(input, dt);
        updateArrowLook(input, dt);
        clampLookVelocities(aimLookMul);
        applyLookVelocities(dt, aimLookMul);
        clampPitch();
      } else {
        integrateHoleFall(dt);
        return;
      }

      const bindings = getBindings();
      const wantCrouch = isBindingDown(input, bindings, "crouch");
      // Test stand-up clearance from where the player actually is right now —
      // before this frame's eyeHeight lerp / movement integration.
      const headroomFootY = position.y - eyeHeight;
      const canStand = hasHeadroom(
        position.x,
        position.z,
        headroomFootY,
        getStandEyeHeight() + STAND_CLEARANCE_MARGIN
      );
      const jumpClearance = hasHeadroom(
        position.x,
        position.z,
        headroomFootY,
        getStandEyeHeight() + STAND_CLEARANCE_MARGIN + 0.15
      );
      const jumpPressed = wasBindingPressed(input, bindings, "jump");
      const movementGates = requireWasmMethod(gameCore, "computePlayerMovementGates")({
        wantCrouch: Boolean(wantCrouch),
        canStand: Boolean(canStand),
        grounded: Boolean(grounded),
        jumpPressed: Boolean(jumpPressed),
        jumpClearance: Boolean(jumpClearance),
      });
      const forceCrouch = movementGates.forceCrouch;
      const crouching = movementGates.crouching;
      const wantsSprint =
        isBindingDown(input, bindings, "sprint") && !crouching;
      const standEye = getStandEyeHeight();
      const targetEye = crouching ? standEye * CROUCH_RATIO : standEye;
      eyeHeight += (targetEye - eyeHeight) * (1 - Math.exp(-CROUCH_LERP * dt));

      moveForward.set(0, 0, -1).applyAxisAngle(moveUp, yaw);
      moveRight.crossVectors(moveForward, moveUp).normalize();

      const aiming = isBindingDown(input, bindings, "aim");

      const bobTuning = getWalkBobTuning();
      let moveX = 0;
      let moveZ = 0;
      let speed = crouching ? CROUCH_SPEED : bobTuning.walkSpeed;
      let isMoving = false;
      const coreMove = requireWasmMethod(gameCore, "tickPlayerCore")({
        dt,
        forward: Boolean(isBindingDown(input, bindings, "forward")),
        backward: Boolean(isBindingDown(input, bindings, "backward")),
        strafeLeft: Boolean(isBindingDown(input, bindings, "strafeLeft")),
        strafeRight: Boolean(isBindingDown(input, bindings, "strafeRight")),
        sprint: Boolean(isBindingDown(input, bindings, "sprint")),
        crouching: Boolean(crouching),
        aiming: Boolean(aiming),
        staminaMax: Math.max(SPRINT_STAMINA_BASE, getStaminaMax()),
        walkSpeed: bobTuning.walkSpeed,
        sprintSpeed: bobTuning.sprintSpeed,
        crouchSpeed: CROUCH_SPEED,
        aimMoveMul: AIM_MOVE_MUL,
      });
      moveX = coreMove.moveX;
      moveZ = coreMove.moveZ;
      isMoving = Boolean(coreMove.moving);
      isSprinting = Boolean(coreMove.sprinting);
      stamina = coreMove.stamina;
      lastStaminaMax = coreMove.staminaMax;
      speed = coreMove.speed;

      if (moveX !== 0 || moveZ !== 0) {
        moveDir
          .set(0, 0, 0)
          .addScaledVector(moveRight, moveX)
          .addScaledVector(moveForward, moveZ)
          .normalize();
      } else {
        moveDir.set(0, 0, 0);
      }

      velocity.x = moveDir.x * speed;
      velocity.z = moveDir.z * speed;

      const canJump = movementGates.canJump;
      const vertical = requireWasmMethod(gameCore, "tickPlayerVertical")({
        dt,
        y: position.y,
        grounded: Boolean(grounded),
        jumpPressed: Boolean(jumpPressed),
        canJump: Boolean(canJump),
        gravity: GRAVITY,
        jumpVelocity: JUMP_VELOCITY,
      });
      velocity.y = vertical.velocityY;
      position.y = vertical.y;
      grounded = Boolean(vertical.grounded);

      position.x += velocity.x * dt;
      resolveColliders();
      resolveBounds();
      position.z += velocity.z * dt;
      resolveColliders();
      resolveBounds();
      resolveCeilingCollisions();

      collisionResolveCtx = null;
      const wasGrounded = grounded;
      const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
      const footY = position.y - eyeHeight;
      const supportInfo = getSupportInfo(position.x, position.z, footY);
      const supportY = supportInfo.supportY;
      onStairs = supportInfo.onStairs;
      const groundLevel = supportY + eyeHeight;

      if (supportInfo.stairRamp && wasGrounded && Number.isFinite(supportY)) {
        position.y = groundLevel;
        velocity.y = 0;
        grounded = true;
      } else if (Number.isFinite(supportY) && position.y <= groundLevel) {
        const riseNeeded = groundLevel - position.y;
        const isStepUp =
          horizontalSpeed > IDLE_MOVE_SPEED &&
          wasGrounded &&
          riseNeeded > 0.015 &&
          riseNeeded <= STEP_UP_MAX;

        if (isStepUp) {
          position.y +=
            riseNeeded * (1 - Math.exp(-bobTuning.stepUpSmooth * dt));
          if (Math.abs(groundLevel - position.y) < 0.002) {
            position.y = groundLevel;
          }
        } else {
          position.y = groundLevel;
        }
        velocity.y = 0;
        grounded = true;
      } else {
        grounded = false;
      }
      requireWasmMethod(gameCore, "syncPlayerVertical")(
        position.y,
        velocity.y,
        grounded,
      );

      tryBeginHoleFall();
      if (holeFallState.fallingThroughHole) {
        integrateHoleFall(dt);
        return;
      }

      if (
        grounded &&
        !onStairs &&
        horizontalSpeed > 0.35 &&
        supportY - prevSupportY > 0.04 &&
        supportY - prevSupportY <= STEP_UP_MAX &&
        !onArenaCatwalkDeck(footY, position.x, position.z) &&
        !onStairSideWalk(footY, position.x, position.z) &&
        prevSupportY <= floorY + 1
      ) {
        // Spring bob fires on one-off curb / wall step-ups for a satisfying
        // weight transfer. It's skipped on stairs because each tread would
        // re-trigger it and stack into a per-step bounce — walkBob's
        // stair-specific amplitude already provides the right rhythm there.
        const stepHeight = supportY - prevSupportY;
        stepBobY = -Math.min(bobTuning.stepDip, stepHeight * 0.22);
        stepBobVel = stepHeight * bobTuning.stepKick;
      }

      if (grounded) {
        prevSupportY = supportY;
      }

      if (onStairs) {
        stepBobY = 0;
        stepBobVel = 0;
      } else {
        const bob = springStepBob(
          stepBobY,
          stepBobVel,
          bobTuning.stepStiffness,
          bobTuning.stepDamping,
          dt
        );
        stepBobY = bob.value;
        stepBobVel = bob.velocity;
      }
      if (horizontalSpeed < IDLE_MOVE_SPEED) {
        const idleBobFade = Math.exp(-14 * dt);
        stepBobY *= idleBobFade;
        stepBobVel *= idleBobFade;
        if (Math.abs(stepBobY) < 0.0005 && Math.abs(stepBobVel) < 0.0005) {
          stepBobY = 0;
          stepBobVel = 0;
        }
      }
      if (!grounded && Math.abs(stepBobY) < 0.0005 && Math.abs(stepBobVel) < 0.0005) {
        stepBobY = 0;
        stepBobVel = 0;
      }

      updateWalkBob(horizontalSpeed, crouching, aiming, dt);

      resolveColliders();
      resolveBounds();
      syncCamera();
    },

    getHorizontalSpeed() {
      return Math.hypot(velocity.x, velocity.z);
    },

    getStamina() {
      return stamina;
    },

    getStaminaMax() {
      return Math.max(SPRINT_STAMINA_BASE, getStaminaMax());
    },

    /** Call when HP changes outside the movement tick (pickups, decay). */
    syncStaminaMaxFromHp() {
      applyStaminaMaxChange();
    },

    isSprinting() {
      return isSprinting;
    },

    isOnStairs() {
      return onStairs;
    },

    /** Current camera-relative Y of the player's eyes (= world Y of the camera). */
    getY() {
      return position.y;
    },

    getX() {
      return position.x;
    },

    getZ() {
      return position.z;
    },

    getFootY() {
      return position.y - eyeHeight;
    },

    /** True once the player's feet commit to a floor hole — movement is locked. */
    isFallingThroughHole() {
      return holeFallState.fallingThroughHole;
    },

    getEyeHeight() {
      return eyeHeight;
    },

    /**
     * Reset the player to the spawn point and zero out velocity / step-bob /
     * stair state. Called from the death-fall handler when the player drops
     * below the world's kill threshold.
     */
    respawn() {
      position.copy(initialPosition);
      velocity.set(0, 0, 0);
      yaw = initialYaw;
      pitch = 0;
      eyeHeight = getStandEyeHeight();
      grounded = true;
      onStairs = false;
      prevSupportY = floorY;
      stepBobY = 0;
      stepBobVel = 0;
      walkBobPhase = 0;
      walkBobY = 0;
      walkBobPitch = 0;
      walkBobRoll = 0;
      walkBobActivity = 0;
      stamina = SPRINT_STAMINA_BASE;
      isSprinting = false;
      lastStaminaMax = SPRINT_STAMINA_BASE;
      requireWasmMethod(gameCore, "resetPlayerCore")(
        Math.max(SPRINT_STAMINA_BASE, getStaminaMax()),
      );
      arrowLookVel.yaw = 0;
      arrowLookVel.pitch = 0;
      mouseLookVel.yaw = 0;
      mouseLookVel.pitch = 0;
      holeFallState.fallingThroughHole = false;
      holeFallState.holeFallVelY = -2;
      holeFallRoll = 0;
      holeFallPitch = 0;
      holeFallYaw = 0;
      recoilPitchAnim = 0;
      recoilPitchVel = 0;
      recoilPitchTarget = 0;
      recoilYawAnim = 0;
      recoilYawVel = 0;
      recoilYawTarget = 0;
      syncCamera();
    },

    /** Nudge aim upward — springs up then settles to the same net offset as before. */
    addAimRecoil(strength = 1) {
      const t = getRecoilTuning();
      const s = Math.max(0, strength);
      const netPitch =
        t.aimRecoilPitch *
        s *
        (AIM_RECOIL_PITCH_RANDOM_MIN + Math.random() * AIM_RECOIL_PITCH_RANDOM_SPREAD);
      const netYaw = (Math.random() - 0.5) * 2 * t.aimRecoilYaw * s;
      recoilPitchTarget += netPitch;
      recoilYawTarget += netYaw;
      recoilPitchVel += netPitch * t.kickVelScale;
      recoilYawVel += netYaw * t.kickVelScale;
      clampPitch();
    },
    tickAimRecoil(dt) {
      stepAimRecoil(dt);
      syncCamera();
    },

    /** Horizontal look angle (rad); 0 = facing world −Z (north). */
    getYaw() {
      return yaw;
    },

    getAimDirection() {
      return new THREE.Vector3(0, 0, -1)
        .applyQuaternion(camera.quaternion)
        .normalize();
    },

    getShootRay(origin) {
      const from = origin ?? camera.position;
      return new THREE.Raycaster(from.clone(), this.getAimDirection());
    },

    /** Dev overlay — walk clamp, deck pieces, and colliders blocking movement right now. */
    getMovementDebugSnapshot() {
      const footY = position.y - eyeHeight;
      const bodyTop = position.y;
      const x = position.x;
      const z = position.z;
      const walk = computeResolvedWalkBounds(x, z, footY);
      const ctx = getCollisionResolveCtx(footY);
      const { rampFootY, supportInfo, supportY, climbLocalMotion, colliders } = ctx;

      /** @type {import("../physics/Collision.js").ColliderBox[]} */
      const blockingColliders = [];
      for (const box of colliders) {
        if (box.active === false) continue;
        if (!rotatedBoxOverlapsCircle(box, x, z, PLAYER_RADIUS, gameCore)) continue;
        const stairLocal = box.stairFlight
          ? worldToStairLocal(box.stairFlight, x, z)
          : null;
        const boxClimb = box.stairFlight
          ? stairClimbLocalMotion(box.stairFlight)
          : climbLocalMotion;
        if (
          shouldSkipCollider(
            box,
            footY,
            bodyTop,
            STEP_UP_MAX,
            supportY,
            stairLocal,
            boxClimb,
            rampFootY,
            supportInfo.stairRamp
          )
        ) {
          continue;
        }
        blockingColliders.push(box);
      }

      const ySlack = 0.15;
      const deckPieces = [];
      for (const surf of getGroundSurfaces()) {
        if (!surf.arenaCatwalkDeck || surf.y == null) continue;
        if (Math.abs(surf.y - footY) > ySlack) continue;
        deckPieces.push({
          minX: surf.minX,
          maxX: surf.maxX,
          minZ: surf.minZ,
          maxZ: surf.maxZ,
          y: surf.y,
        });
      }

      return {
        footY,
        walkClamp: {
          minX: walk.minX,
          maxX: walk.maxX,
          minZ: walk.minZ,
          maxZ: walk.maxZ,
        },
        catwalkUnion: walk.catwalkBounds,
        onArenaDeck: onArenaCatwalkDeck(footY, x, z),
        blockingColliders,
        deckPieces,
      };
    },
  };
}
