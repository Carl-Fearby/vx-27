import type {
  GameCoreEngine,
  GameCoreFrameInput,
  GameCorePublicState,
  InteractionGateInput,
  OilBarrelFireProximityInput,
  WallWeaponResupplyInput,
  PlayerMovementGateInput,
  PlayerMovementGateOutput,
  CombatScoreOutput,
  GrenadeBlastOutput,
  CollectFadeInput,
  CollectFadeOutput,
  CollectibleMotionInput,
  CollectibleMotionOutput,
  CollectibleSpawnPlanInput,
  CollectibleSpawnPlanOutput,
  KillDropPlanOutput,
  KillDropScatterInput,
  KillDropScatterOutput,
  PlayerDeathOutput,
  PlayerDeathTriggerInput,
  PlayerDeathTriggerOutput,
  PrimaryWeaponSwapInput,
  PrimaryWeaponSwapOutput,
  PickupCollectInput,
  PickupCollectOutput,
  PlayerRespawnOutput,
  RagdollImpulseSeedInput,
  RagdollImpulseSeedOutput,
  RagdollLimbImpulseInput,
  RagdollLimbImpulseOutput,
  RagdollSeverPlanInput,
  RagdollSeverPlanOutput,
  RewardDropLaunchInput,
  RewardDropLaunchOutput,
  SecondarySlotInput,
  SecondarySlotOutput,
  PickupRewardOutput,
  TargetDamageOutput,
  TargetRepairOutput,
  TargetZoneDamageInput,
  TargetZoneDamageOutput,
  ArenaBounds,
  TargetOccupant,
  PickRandomSpawnOutput,
  ColliderBoxInput,
  CollisionVec2,
  ResolveBoxColliderOutput,
  SpringStepOutput,
  FireRecoilKickOutput,
  AimRecoilStepInput,
  AimRecoilStepOutput,
  AimRecoilKickInput,
  AimRecoilKickOutput,
  FlashbangBlindApplyOutput,
  ProjectileVec3,
  ProjectileLiveFloorOutput,
  ProjectileFuseTickOutput,
  ProjectilePreviewStepOutput,
  TargetRespawnOutput,
  TargetRespawnPlacementInput,
  TargetRespawnPlacementOutput,
  ThrowableOutput,
  WallShopPurchaseOutput,
  WeaponAmmoOutput,
  WeaponFireTickInput,
  WeaponFireTickOutput,
  HasHeadroomInput,
  ResolveCeilingCollisionsInput,
  ResolveCeilingCollisionsOutput,
  SampleFlatSupportInput,
  SampleFlatSupportOutput,
  ResolveSupportInfoInput,
  SupportInfoOutput,
  Vx27ColliderInput,
  ClampToBoundsOutput,
  TickRagdollHoleFallInput,
  TickRagdollHoleFallOutput,
  TickRagdollCoreToppleInput,
  TickRagdollCoreToppleOutput,
  TickRagdollLaunchInput,
  TickRagdollLaunchOutput,
  RectBoundsInput,
} from "@/lib/game-core/types";

type WasmGameCore = {
  getPublicState(): unknown;
  tickFrame(input: GameCoreFrameInput): unknown;
  tickPlayerCore(input: unknown): unknown;
  tickPlayerVertical(input: unknown): unknown;
  computePlayerMovementGates(input: unknown): unknown;
  setPlayerHealth(value: number): void;
  damagePlayer(amount: number): number;
  healPlayer(amount: number, cap?: number): number;
  setGrenadeCooldown(seconds: number): void;
  syncThrowableCounts(grenadeCount: number, flashbangCount: number): void;
  syncPlayerScore(score: number): void;
  syncPlayerLives(lives: number): void;
  resetPlayerCore(staminaMax?: number): void;
  syncStaminaMax(staminaMax: number): void;
  syncPlayerVertical(y: number, velocityY: number, grounded: boolean): void;
  syncWeaponAmmo(
    id: string,
    rounds: number,
    spare: number,
    magazineSize: number,
    lowAmmoThreshold: number,
  ): unknown;
  tryReloadWeapon(id: string, force: boolean): unknown;
  tryConsumeWeaponRound(id: string, autoReload: boolean): unknown;
  isWeaponBurstActive(): boolean;
  tickWeaponFire(input: WeaponFireTickInput): unknown;
  addWeaponRounds(id: string, rounds: number): unknown;
  tryThrowThrowable(kind: string, cooldownSeconds: number): unknown;
  applyPickupReward(
    kind: string,
    value: number,
    defaultValue: number,
    healthCap: number,
  ): unknown;
  applyTargetDamage(health: number, maxHealth: number, damage: number): unknown;
  resolveTargetZoneDamage(input: unknown): unknown;
  resolveAdsDamageScale(aimBlend: number): number;
  resolveAdsRecoilScale(aimBlend: number): number;
  resolveDamageFalloff(weaponId: string, shotDistance: number): number;
  resolveHeadshotDamage(
    weaponId: string,
    currentHealth: number,
    maxHealth: number,
    shotDistance: number,
  ): number;
  resolveBodyZoneDamage(
    weaponId: string,
    zoneId: string,
    zoneMult: number,
    shotDistance: number,
  ): number;
  recoilSpringStepToward(
    value: number,
    velocity: number,
    target: number,
    stiffness: number,
    damping: number,
    dt: number,
  ): unknown;
  recoilSpringStep(
    value: number,
    velocity: number,
    stiffness: number,
    damping: number,
    dt: number,
  ): unknown;
  clampRecoilPitchAnim(
    pitch: number,
    recoilPitchAnim: number,
    pitchLimit: number,
  ): number;
  applyFireRecoilKick(
    fireRecoilBack: number,
    aimRecoilScale: number,
    kickVelScale: number,
    fireRecoilPitch: number,
    pitchVelScale: number,
  ): unknown;
  stepAimRecoilPair(input: unknown): unknown;
  planAimRecoilKick(input: AimRecoilKickInput): unknown;
  getFlashbangBlindDurationSec(): number;
  getFlashbangOverlayOpacity(elapsedSec: number): number;
  isFlashbangBlindExpired(simTime: number, fadeEnd: number): boolean;
  applyFlashbangBlindToTarget(
    simTime: number,
    currentlyBlinding: boolean,
    blindStart: number,
    blindFadeEnd: number,
  ): unknown;
  computeThrowVelocity(
    aimX: number,
    aimY: number,
    aimZ: number,
    throwSpeed: number,
    loftAngleDeg: number,
  ): unknown;
  projectileSubstepCount(
    speed: number,
    dt: number,
    maxMove: number,
    maxSubsteps: number,
  ): number;
  projectileIntegrate(input: unknown): unknown;
  projectileResolveFloorLive(input: unknown): unknown;
  projectileResolveBounds(input: unknown): unknown;
  projectileApplyGroundRoll(input: unknown): unknown;
  projectileFuseTick(input: unknown): unknown;
  projectilePreviewStep(input: unknown): unknown;
  projectilePreviewFloorAndBounds(input: unknown): unknown;
  overlapsTargets(
    x: number,
    z: number,
    radius: number,
    margin: number,
    occupants: unknown,
  ): boolean;
  positionInAuthoredBounds(
    x: number,
    z: number,
    bounds: unknown,
    radius: number,
    margin: number,
  ): boolean;
  shouldSpawnAuthoredPoint(isRandom: boolean, roll: number, chance: number): boolean;
  pickRandomSpawnXz(input: unknown): unknown;
  worldToBoxLocal(box: unknown, x: number, z: number): unknown;
  rotatedBoxOverlapsCircle(box: unknown, x: number, z: number, radius: number): boolean;
  pointInRoundedBoxFootprint(box: unknown, x: number, z: number, radius: number): boolean;
  resolveBoxCollider(
    posX: number,
    posZ: number,
    radius: number,
    box: unknown,
  ): unknown;
  resolveProjectileAgainstColliders(input: unknown): unknown;
  collectProjectileNearbyColliderIndices(input: unknown): unknown;
  tickTargetRepair(
    dt: number,
    health: number,
    maxHealth: number,
    repairCooldown: number,
    repairPerSecond: number,
  ): unknown;
  calculateCombatScore(
    zone: string,
    damage: number,
    killed: boolean,
    hitScoreAwarded: number,
    totalScoreAwarded: number,
  ): unknown;
  calculateGrenadeBlastHit(
    distance: number,
    blastRadius: number,
    maxDamage: number,
    falloffPower: number,
  ): unknown;
  resolvePickupCollect(input: PickupCollectInput): unknown;
  resolveCollectFade(input: CollectFadeInput): unknown;
  planCollectibleSpawn(input: CollectibleSpawnPlanInput): unknown;
  tickCollectibleMotion(input: CollectibleMotionInput): unknown;
  resolveSecondarySlot(input: SecondarySlotInput): unknown;
  resolvePrimaryWeaponSwap(input: PrimaryWeaponSwapInput): unknown;
  resolvePlayerDeathTrigger(input: PlayerDeathTriggerInput): unknown;
  planKillDropScatter(input: KillDropScatterInput): unknown;
  planRewardDropLaunch(input: RewardDropLaunchInput): unknown;
  resolveRagdollImpulseSeed(input: RagdollImpulseSeedInput): unknown;
  planRagdollLimbImpulse(input: RagdollLimbImpulseInput): unknown;
  planRagdollSever(input: RagdollSeverPlanInput): unknown;
  planKillDrops(
    zone: string,
    explosiveKill: boolean,
    playerHealth: number,
    spareMags: number,
    ammoSpareThreshold: number,
    grenadeCount: number,
    grenadeRoll: number,
    devDropAllRewards: boolean,
  ): unknown;
  planTargetRespawn(respawnDelaySec: number): unknown;
  resolveTargetRespawnPlacement(
    input: TargetRespawnPlacementInput,
  ): unknown;
  applyPlayerDeath(kind: string, nowMs: number, minDisplayMs: number): unknown;
  planPlayerRespawn(nowMs: number, fadeMs: number): unknown;
  canInteractGate(input: InteractionGateInput): boolean;
  tickOilBarrelFireProximityDamage(input: OilBarrelFireProximityInput): boolean;
  applyGrenadeExplosionDamage(): number;
  applyOilBarrelFireDamage(): number;
  canWallWeaponResupply(input: WallWeaponResupplyInput): boolean;
  purchaseWallWeapon(
    score: number,
    stage: number,
    weaponAvailable: boolean,
    rounds: number,
    spare: number,
    unlockCost: number,
    resupplyCost: number,
    unlockRounds: number,
    unlockSpare: number,
    resupplySpare: number,
  ): unknown;
  hasHeadroom(input: HasHeadroomInput): boolean;
  resolveCeilingCollisions(input: ResolveCeilingCollisionsInput): unknown;
  sampleFlatSupportAt(input: SampleFlatSupportInput): unknown;
  resolveSupportInfo(input: ResolveSupportInfoInput): unknown;
  isVx27ContainerEndOrDoorCollider(input: Vx27ColliderInput): boolean;
  isVx27ContainerHorizontalCollider(input: Vx27ColliderInput): boolean;
  isVx27ContainerColliderNearPlayer(
    input: Vx27ColliderInput,
    worldX: number,
    worldZ: number,
    margin: number,
  ): boolean;
  pointInVx27ExteriorColliderFootprint(
    input: Vx27ColliderInput,
    x: number,
    z: number,
    radius: number,
  ): boolean;
  shouldSkipVx27ContainerCollider(
    input: Vx27ColliderInput,
    worldX: number,
    worldZ: number,
    footY?: number | null,
  ): boolean;
  shouldSkipVx27ContainerHeadroom(
    input: Vx27ColliderInput,
    worldX: number,
    worldZ: number,
    footY?: number | null,
  ): boolean;
  clampToBounds(
    px: number,
    pz: number,
    radius: number,
    bounds: RectBoundsInput | null,
  ): unknown;
  tickRagdollHoleFall(input: TickRagdollHoleFallInput): unknown;
  tickRagdollCoreTopple(input: TickRagdollCoreToppleInput): unknown;
  tickRagdollLaunch(input: TickRagdollLaunchInput): unknown;
};

type GameCoreModule = {
  default: () => Promise<unknown>;
  createGameCore(playerHealth?: number): WasmGameCore;
};

let gameCoreModulePromise: Promise<GameCoreModule> | null = null;

async function loadGameCoreModule(): Promise<GameCoreModule> {
  if (!gameCoreModulePromise) {
    gameCoreModulePromise = import("@/rust/game_core/pkg/game_core.js") as Promise<GameCoreModule>;
  }
  const module = await gameCoreModulePromise;
  await module.default();
  return module;
}

function asPublicState(value: unknown): GameCorePublicState {
  return value as GameCorePublicState;
}

function asPickRandomSpawnOutput(value: unknown): PickRandomSpawnOutput {
  return value as PickRandomSpawnOutput;
}

function asResolveBoxColliderOutput(value: unknown): ResolveBoxColliderOutput {
  return value as ResolveBoxColliderOutput;
}

function asCollisionVec2(value: unknown): CollisionVec2 {
  return value as CollisionVec2;
}

function asSpringStepOutput(value: unknown): SpringStepOutput {
  return value as SpringStepOutput;
}

function asFireRecoilKickOutput(value: unknown): FireRecoilKickOutput {
  return value as FireRecoilKickOutput;
}

function asAimRecoilStepOutput(value: unknown): AimRecoilStepOutput {
  return value as AimRecoilStepOutput;
}

function asAimRecoilKickOutput(value: unknown): AimRecoilKickOutput {
  return value as AimRecoilKickOutput;
}

function asPlayerMovementGateOutput(value: unknown) {
  return value as ReturnType<GameCoreEngine["computePlayerMovementGates"]>;
}

function asFlashbangBlindApplyOutput(value: unknown): FlashbangBlindApplyOutput {
  return value as FlashbangBlindApplyOutput;
}

function asWeaponAmmoOutput(value: unknown): WeaponAmmoOutput {
  return value as WeaponAmmoOutput;
}

function asThrowableOutput(value: unknown): ThrowableOutput {
  return value as ThrowableOutput;
}

function asPickupRewardOutput(value: unknown): PickupRewardOutput {
  return value as PickupRewardOutput;
}

function asTargetDamageOutput(value: unknown): TargetDamageOutput {
  return value as TargetDamageOutput;
}

function asProjectileVec3(value: unknown): ProjectileVec3 {
  return value as ProjectileVec3;
}

function asProjectileLiveFloorOutput(value: unknown): ProjectileLiveFloorOutput {
  return value as ProjectileLiveFloorOutput;
}

function asProjectileFuseTickOutput(value: unknown): ProjectileFuseTickOutput {
  return value as ProjectileFuseTickOutput;
}

function asProjectilePreviewStepOutput(value: unknown): ProjectilePreviewStepOutput {
  return value as ProjectilePreviewStepOutput;
}

function asTargetZoneDamageOutput(value: unknown): TargetZoneDamageOutput {
  return value as TargetZoneDamageOutput;
}

function asTargetRepairOutput(value: unknown): TargetRepairOutput {
  return value as TargetRepairOutput;
}

function asCombatScoreOutput(value: unknown): CombatScoreOutput {
  return value as CombatScoreOutput;
}

function asGrenadeBlastOutput(value: unknown): GrenadeBlastOutput {
  return value as GrenadeBlastOutput;
}

function asPickupCollectOutput(value: unknown): PickupCollectOutput {
  return value as PickupCollectOutput;
}

function asCollectFadeOutput(value: unknown): CollectFadeOutput {
  return value as CollectFadeOutput;
}

function asCollectibleSpawnPlanOutput(value: unknown): CollectibleSpawnPlanOutput {
  return value as CollectibleSpawnPlanOutput;
}

function asCollectibleMotionOutput(value: unknown): CollectibleMotionOutput {
  return value as CollectibleMotionOutput;
}

function asSecondarySlotOutput(value: unknown): SecondarySlotOutput {
  return value as SecondarySlotOutput;
}

function asPrimaryWeaponSwapOutput(value: unknown): PrimaryWeaponSwapOutput {
  return value as PrimaryWeaponSwapOutput;
}

function asPlayerDeathTriggerOutput(value: unknown): PlayerDeathTriggerOutput {
  return value as PlayerDeathTriggerOutput;
}

function asKillDropScatterOutput(value: unknown): KillDropScatterOutput {
  return value as KillDropScatterOutput;
}

function asRewardDropLaunchOutput(value: unknown): RewardDropLaunchOutput {
  return value as RewardDropLaunchOutput;
}

function asRagdollImpulseSeedOutput(value: unknown): RagdollImpulseSeedOutput {
  return value as RagdollImpulseSeedOutput;
}

function asRagdollLimbImpulseOutput(value: unknown): RagdollLimbImpulseOutput {
  return value as RagdollLimbImpulseOutput;
}

function asRagdollSeverPlanOutput(value: unknown): RagdollSeverPlanOutput {
  return value as RagdollSeverPlanOutput;
}

function asKillDropPlanOutput(value: unknown): KillDropPlanOutput {
  return value as KillDropPlanOutput;
}

function asTargetRespawnOutput(value: unknown): TargetRespawnOutput {
  return value as TargetRespawnOutput;
}

function asTargetRespawnPlacementOutput(
  value: unknown,
): TargetRespawnPlacementOutput {
  return value as TargetRespawnPlacementOutput;
}

function asPlayerDeathOutput(value: unknown): PlayerDeathOutput {
  return value as PlayerDeathOutput;
}

function asPlayerRespawnOutput(value: unknown): PlayerRespawnOutput {
  return value as PlayerRespawnOutput;
}

function asWallShopPurchaseOutput(value: unknown): WallShopPurchaseOutput {
  return value as WallShopPurchaseOutput;
}

function asResolveCeilingCollisionsOutput(
  value: unknown,
): ResolveCeilingCollisionsOutput {
  return value as ResolveCeilingCollisionsOutput;
}

function asSampleFlatSupportOutput(value: unknown): SampleFlatSupportOutput {
  return value as SampleFlatSupportOutput;
}

function asSupportInfoOutput(value: unknown): SupportInfoOutput {
  return value as SupportInfoOutput;
}

function asClampToBoundsOutput(value: unknown): ClampToBoundsOutput {
  return value as ClampToBoundsOutput;
}

function asWeaponFireTickOutput(value: unknown): WeaponFireTickOutput {
  return value as WeaponFireTickOutput;
}

function asTickRagdollHoleFallOutput(value: unknown): TickRagdollHoleFallOutput {
  return value as TickRagdollHoleFallOutput;
}

function asTickRagdollCoreToppleOutput(
  value: unknown,
): TickRagdollCoreToppleOutput {
  return value as TickRagdollCoreToppleOutput;
}

function asTickRagdollLaunchOutput(value: unknown): TickRagdollLaunchOutput {
  return value as TickRagdollLaunchOutput;
}

export async function createGameCoreEngine(playerHealth = 100): Promise<GameCoreEngine> {
  const { createGameCore } = await loadGameCoreModule();
  const core = createGameCore(playerHealth);

  return {
    getPublicState() {
      return asPublicState(core.getPublicState());
    },
    tickFrame(input) {
      return asPublicState(core.tickFrame(input));
    },
    tickPlayerCore(input) {
      return core.tickPlayerCore(input) as ReturnType<GameCoreEngine["tickPlayerCore"]>;
    },
    tickPlayerVertical(input) {
      return core.tickPlayerVertical(input) as ReturnType<GameCoreEngine["tickPlayerVertical"]>;
    },
    computePlayerMovementGates(input) {
      return asPlayerMovementGateOutput(core.computePlayerMovementGates(input));
    },
    setPlayerHealth(value) {
      core.setPlayerHealth(value);
    },
    damagePlayer(amount) {
      return core.damagePlayer(amount);
    },
    healPlayer(amount, cap) {
      return core.healPlayer(amount, cap);
    },
    setGrenadeCooldown(seconds) {
      core.setGrenadeCooldown(seconds);
    },
    syncThrowableCounts(grenadeCount, flashbangCount) {
      core.syncThrowableCounts(grenadeCount, flashbangCount);
    },
    syncPlayerScore(score) {
      core.syncPlayerScore(score);
    },
    syncPlayerLives(lives) {
      core.syncPlayerLives(lives);
    },
    resetPlayerCore(staminaMax) {
      core.resetPlayerCore(staminaMax);
    },
    syncStaminaMax(staminaMax) {
      core.syncStaminaMax(staminaMax);
    },
    syncPlayerVertical(y, velocityY, grounded) {
      core.syncPlayerVertical(y, velocityY, grounded);
    },
    syncWeaponAmmo(id, rounds, spare, magazineSize, lowAmmoThreshold) {
      return asWeaponAmmoOutput(
        core.syncWeaponAmmo(id, rounds, spare, magazineSize, lowAmmoThreshold),
      );
    },
    tryReloadWeapon(id, force) {
      return asWeaponAmmoOutput(core.tryReloadWeapon(id, force));
    },
    tryConsumeWeaponRound(id, autoReload) {
      return asWeaponAmmoOutput(core.tryConsumeWeaponRound(id, autoReload));
    },
    isWeaponBurstActive() {
      return core.isWeaponBurstActive();
    },
    tickWeaponFire(input) {
      return asWeaponFireTickOutput(core.tickWeaponFire(input));
    },
    addWeaponRounds(id, rounds) {
      return asWeaponAmmoOutput(core.addWeaponRounds(id, rounds));
    },
    tryThrowThrowable(kind, cooldownSeconds) {
      return asThrowableOutput(core.tryThrowThrowable(kind, cooldownSeconds));
    },
    applyPickupReward(kind, value, defaultValue, healthCap) {
      return asPickupRewardOutput(
        core.applyPickupReward(kind, value, defaultValue, healthCap),
      );
    },
    applyTargetDamage(health, maxHealth, damage) {
      return asTargetDamageOutput(core.applyTargetDamage(health, maxHealth, damage));
    },
    resolveTargetZoneDamage(input) {
      return asTargetZoneDamageOutput(core.resolveTargetZoneDamage(input));
    },
    resolveAdsDamageScale(aimBlend) {
      return core.resolveAdsDamageScale(aimBlend);
    },
    resolveAdsRecoilScale(aimBlend) {
      return core.resolveAdsRecoilScale(aimBlend);
    },
    resolveDamageFalloff(weaponId, shotDistance) {
      return core.resolveDamageFalloff(weaponId, shotDistance);
    },
    resolveHeadshotDamage(weaponId, currentHealth, maxHealth, shotDistance) {
      return core.resolveHeadshotDamage(
        weaponId,
        currentHealth,
        maxHealth,
        shotDistance,
      );
    },
    resolveBodyZoneDamage(weaponId, zoneId, zoneMult, shotDistance) {
      return core.resolveBodyZoneDamage(weaponId, zoneId, zoneMult, shotDistance);
    },
    recoilSpringStepToward(value, velocity, target, stiffness, damping, dt) {
      return asSpringStepOutput(
        core.recoilSpringStepToward(value, velocity, target, stiffness, damping, dt),
      );
    },
    recoilSpringStep(value, velocity, stiffness, damping, dt) {
      return asSpringStepOutput(
        core.recoilSpringStep(value, velocity, stiffness, damping, dt),
      );
    },
    clampRecoilPitchAnim(pitch, recoilPitchAnim, pitchLimit) {
      return core.clampRecoilPitchAnim(pitch, recoilPitchAnim, pitchLimit);
    },
    applyFireRecoilKick(
      fireRecoilBack,
      aimRecoilScale,
      kickVelScale,
      fireRecoilPitch,
      pitchVelScale,
    ) {
      return asFireRecoilKickOutput(
        core.applyFireRecoilKick(
          fireRecoilBack,
          aimRecoilScale,
          kickVelScale,
          fireRecoilPitch,
          pitchVelScale,
        ),
      );
    },
    stepAimRecoilPair(input) {
      return asAimRecoilStepOutput(core.stepAimRecoilPair(input));
    },
    planAimRecoilKick(input) {
      return asAimRecoilKickOutput(core.planAimRecoilKick(input));
    },
    getFlashbangBlindDurationSec() {
      return core.getFlashbangBlindDurationSec();
    },
    getFlashbangOverlayOpacity(elapsedSec) {
      return core.getFlashbangOverlayOpacity(elapsedSec);
    },
    isFlashbangBlindExpired(simTime, fadeEnd) {
      return core.isFlashbangBlindExpired(simTime, fadeEnd);
    },
    applyFlashbangBlindToTarget(
      simTime,
      currentlyBlinding,
      blindStart,
      blindFadeEnd,
    ) {
      return asFlashbangBlindApplyOutput(
        core.applyFlashbangBlindToTarget(
          simTime,
          currentlyBlinding,
          blindStart,
          blindFadeEnd,
        ),
      );
    },
    computeThrowVelocity(aimX, aimY, aimZ, throwSpeed, loftAngleDeg) {
      return asProjectileVec3(
        core.computeThrowVelocity(aimX, aimY, aimZ, throwSpeed, loftAngleDeg),
      );
    },
    projectileSubstepCount(speed, dt, maxMove, maxSubsteps) {
      return core.projectileSubstepCount(speed, dt, maxMove, maxSubsteps);
    },
    projectileIntegrate(input) {
      return core.projectileIntegrate(input) as ReturnType<GameCoreEngine["projectileIntegrate"]>;
    },
    projectileResolveFloorLive(input) {
      return asProjectileLiveFloorOutput(core.projectileResolveFloorLive(input));
    },
    projectileResolveBounds(input) {
      return core.projectileResolveBounds(input) as ReturnType<
        GameCoreEngine["projectileResolveBounds"]
      >;
    },
    projectileApplyGroundRoll(input) {
      return core.projectileApplyGroundRoll(input) as ReturnType<
        GameCoreEngine["projectileApplyGroundRoll"]
      >;
    },
    projectileFuseTick(input) {
      return asProjectileFuseTickOutput(core.projectileFuseTick(input));
    },
    projectilePreviewStep(input) {
      return asProjectilePreviewStepOutput(core.projectilePreviewStep(input));
    },
    projectilePreviewFloorAndBounds(input) {
      return asProjectilePreviewStepOutput(core.projectilePreviewFloorAndBounds(input));
    },
    overlapsTargets(x, z, radius, margin, occupants) {
      return core.overlapsTargets(x, z, radius, margin, occupants);
    },
    positionInAuthoredBounds(x, z, bounds, radius, margin) {
      return core.positionInAuthoredBounds(x, z, bounds, radius, margin);
    },
    shouldSpawnAuthoredPoint(isRandom, roll, chance) {
      return core.shouldSpawnAuthoredPoint(isRandom, roll, chance);
    },
    pickRandomSpawnXz(input) {
      return asPickRandomSpawnOutput(core.pickRandomSpawnXz(input));
    },
    worldToBoxLocal(box, x, z) {
      return asCollisionVec2(core.worldToBoxLocal(box, x, z));
    },
    rotatedBoxOverlapsCircle(box, x, z, radius) {
      return core.rotatedBoxOverlapsCircle(box, x, z, radius);
    },
    pointInRoundedBoxFootprint(box, x, z, radius) {
      return core.pointInRoundedBoxFootprint(box, x, z, radius);
    },
    resolveBoxCollider(posX, posZ, radius, box) {
      return asResolveBoxColliderOutput(core.resolveBoxCollider(posX, posZ, radius, box));
    },
    resolveProjectileAgainstColliders(input) {
      return core.resolveProjectileAgainstColliders(input) as ReturnType<
        GameCoreEngine["resolveProjectileAgainstColliders"]
      >;
    },
    collectProjectileNearbyColliderIndices(input) {
      return core.collectProjectileNearbyColliderIndices(input) as ReturnType<
        GameCoreEngine["collectProjectileNearbyColliderIndices"]
      >;
    },
    spawnBlockedAt(input) {
      return core.spawnBlockedAt(input);
    },
    pushCircleOutOfColliders(input) {
      return core.pushCircleOutOfColliders(input) as ReturnType<
        GameCoreEngine["pushCircleOutOfColliders"]
      >;
    },
    pointInFloorHole(x, z, holes, inset = 0) {
      return core.pointInFloorHole(x, z, holes, inset);
    },
    resolveSpawnFootY(input) {
      return core.resolveSpawnFootY(input) as ReturnType<
        GameCoreEngine["resolveSpawnFootY"]
      >;
    },
    resolvePlayerColliders(input) {
      return core.resolvePlayerColliders(input) as ReturnType<
        GameCoreEngine["resolvePlayerColliders"]
      >;
    },
    computeResolvedWalkBounds(input) {
      return core.computeResolvedWalkBounds(input) as ReturnType<
        GameCoreEngine["computeResolvedWalkBounds"]
      >;
    },
    hasHeadroom(input) {
      return core.hasHeadroom(input);
    },
    resolveCeilingCollisions(input) {
      return asResolveCeilingCollisionsOutput(core.resolveCeilingCollisions(input));
    },
    sampleFlatSupportAt(input) {
      return asSampleFlatSupportOutput(core.sampleFlatSupportAt(input));
    },
    resolveSupportInfo(input) {
      return asSupportInfoOutput(core.resolveSupportInfo(input));
    },
    isVx27ContainerEndOrDoorCollider(input) {
      return core.isVx27ContainerEndOrDoorCollider(input);
    },
    isVx27ContainerHorizontalCollider(input) {
      return core.isVx27ContainerHorizontalCollider(input);
    },
    isVx27ContainerColliderNearPlayer(input, worldX, worldZ, margin) {
      return core.isVx27ContainerColliderNearPlayer(input, worldX, worldZ, margin);
    },
    pointInVx27ExteriorColliderFootprint(input, x, z, radius) {
      return core.pointInVx27ExteriorColliderFootprint(input, x, z, radius);
    },
    shouldSkipVx27ContainerCollider(input, worldX, worldZ, footY) {
      return core.shouldSkipVx27ContainerCollider(input, worldX, worldZ, footY);
    },
    shouldSkipVx27ContainerHeadroom(input, worldX, worldZ, footY) {
      return core.shouldSkipVx27ContainerHeadroom(input, worldX, worldZ, footY);
    },
    clampToBounds(px, pz, radius, bounds) {
      return asClampToBoundsOutput(core.clampToBounds(px, pz, radius, bounds));
    },
    tickRagdollHoleFall(input) {
      return asTickRagdollHoleFallOutput(core.tickRagdollHoleFall(input));
    },
    tickRagdollCoreTopple(input) {
      return asTickRagdollCoreToppleOutput(core.tickRagdollCoreTopple(input));
    },
    tickRagdollLaunch(input) {
      return asTickRagdollLaunchOutput(core.tickRagdollLaunch(input));
    },
    tickTargetRepair(dt, health, maxHealth, repairCooldown, repairPerSecond) {
      return asTargetRepairOutput(
        core.tickTargetRepair(dt, health, maxHealth, repairCooldown, repairPerSecond),
      );
    },
    calculateCombatScore(zone, damage, killed, hitScoreAwarded, totalScoreAwarded) {
      return asCombatScoreOutput(
        core.calculateCombatScore(
          zone,
          damage,
          killed,
          hitScoreAwarded,
          totalScoreAwarded,
        ),
      );
    },
    calculateGrenadeBlastHit(distance, blastRadius, maxDamage, falloffPower) {
      return asGrenadeBlastOutput(
        core.calculateGrenadeBlastHit(distance, blastRadius, maxDamage, falloffPower),
      );
    },
    resolvePickupCollect(input) {
      return asPickupCollectOutput(core.resolvePickupCollect(input));
    },
    resolveCollectFade(input) {
      return asCollectFadeOutput(core.resolveCollectFade(input));
    },
    planCollectibleSpawn(input) {
      return asCollectibleSpawnPlanOutput(core.planCollectibleSpawn(input));
    },
    tickCollectibleMotion(input) {
      return asCollectibleMotionOutput(core.tickCollectibleMotion(input));
    },
    resolveSecondarySlot(input) {
      return asSecondarySlotOutput(core.resolveSecondarySlot(input));
    },
    resolvePrimaryWeaponSwap(input) {
      return asPrimaryWeaponSwapOutput(core.resolvePrimaryWeaponSwap(input));
    },
    resolvePlayerDeathTrigger(input) {
      return asPlayerDeathTriggerOutput(core.resolvePlayerDeathTrigger(input));
    },
    planKillDropScatter(input) {
      return asKillDropScatterOutput(core.planKillDropScatter(input));
    },
    planRewardDropLaunch(input) {
      return asRewardDropLaunchOutput(core.planRewardDropLaunch(input));
    },
    resolveRagdollImpulseSeed(input) {
      return asRagdollImpulseSeedOutput(core.resolveRagdollImpulseSeed(input));
    },
    planRagdollLimbImpulse(input) {
      return asRagdollLimbImpulseOutput(core.planRagdollLimbImpulse(input));
    },
    planRagdollSever(input) {
      return asRagdollSeverPlanOutput(core.planRagdollSever(input));
    },
    planKillDrops(
      zone,
      explosiveKill,
      playerHealth,
      spareMags,
      ammoSpareThreshold,
      grenadeCount,
      grenadeRoll,
      devDropAllRewards,
    ) {
      return asKillDropPlanOutput(
        core.planKillDrops(
          zone,
          explosiveKill,
          playerHealth,
          spareMags,
          ammoSpareThreshold,
          grenadeCount,
          grenadeRoll,
          devDropAllRewards,
        ),
      );
    },
    planTargetRespawn(respawnDelaySec) {
      return asTargetRespawnOutput(core.planTargetRespawn(respawnDelaySec));
    },
    resolveTargetRespawnPlacement(input) {
      return asTargetRespawnPlacementOutput(core.resolveTargetRespawnPlacement(input));
    },
    applyPlayerDeath(kind, nowMs, minDisplayMs) {
      return asPlayerDeathOutput(core.applyPlayerDeath(kind, nowMs, minDisplayMs));
    },
    planPlayerRespawn(nowMs, fadeMs) {
      return asPlayerRespawnOutput(core.planPlayerRespawn(nowMs, fadeMs));
    },
    canInteractGate(input) {
      return core.canInteractGate(input);
    },
    tickOilBarrelFireProximityDamage(input) {
      return core.tickOilBarrelFireProximityDamage(input);
    },
    applyGrenadeExplosionDamage() {
      return core.applyGrenadeExplosionDamage();
    },
    applyOilBarrelFireDamage() {
      return core.applyOilBarrelFireDamage();
    },
    canWallWeaponResupply(input) {
      return core.canWallWeaponResupply(input);
    },
    purchaseWallWeapon(
      score,
      stage,
      weaponAvailable,
      rounds,
      spare,
      unlockCost,
      resupplyCost,
      unlockRounds,
      unlockSpare,
      resupplySpare,
    ) {
      return asWallShopPurchaseOutput(
        core.purchaseWallWeapon(
          score,
          stage,
          weaponAvailable,
          rounds,
          spare,
          unlockCost,
          resupplyCost,
          unlockRounds,
          unlockSpare,
          resupplySpare,
        ),
      );
    },
  };
}
