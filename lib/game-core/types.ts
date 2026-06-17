export type GameCorePublicState = {
  playerHealth: number;
  healthRegenTimer: number;
  radioactiveOverflowDecayTimer: number;
  missionTime: number;
  grenadeCooldownRemaining: number;
  stamina: number;
  staminaMax: number;
  sprinting: boolean;
  staminaShouldSyncFromHealth: boolean;
  grenadeCount: number;
  flashbangCount: number;
  playerScore: number;
};

export type GameCoreFrameInput = {
  dt: number;
  paused: boolean;
};

export type InteractionGateInput = {
  pointerActive: boolean;
  frozen: boolean;
  rebindActionOpen: boolean;
  settingsOpen: boolean;
  controlsOpen: boolean;
  consoleHackOpen: boolean;
};

export type OilBarrelFireProximityInput = {
  dt: number;
  inRange: boolean;
  intervalSec: number;
};

export type WallWeaponResupplyInput = {
  weaponId: string;
  stage: number;
  pistolOwned: boolean;
};

export type PlayerCoreInput = {
  dt: number;
  forward: boolean;
  backward: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
  sprint: boolean;
  crouching: boolean;
  aiming: boolean;
  staminaMax: number;
  walkSpeed: number;
  sprintSpeed: number;
  crouchSpeed: number;
  aimMoveMul: number;
};

export type PlayerCoreOutput = {
  moveX: number;
  moveZ: number;
  moving: boolean;
  sprinting: boolean;
  stamina: number;
  staminaMax: number;
  speed: number;
};

export type PlayerVerticalInput = {
  dt: number;
  y: number;
  grounded: boolean;
  jumpPressed: boolean;
  canJump: boolean;
  gravity: number;
  jumpVelocity: number;
};

export type PlayerVerticalOutput = {
  y: number;
  velocityY: number;
  grounded: boolean;
  jumped: boolean;
};

export type PlayerMovementGateInput = {
  wantCrouch: boolean;
  canStand: boolean;
  grounded: boolean;
  jumpPressed: boolean;
  jumpClearance: boolean;
};

export type WeaponAmmoOutput = {
  rounds: number;
  spare: number;
  reloaded: boolean;
  fired: boolean;
  lowAmmo: boolean;
  empty: boolean;
};

export type ThrowableOutput = {
  thrown: boolean;
  kind: string;
  grenadeCount: number;
  flashbangCount: number;
  cooldownRemaining: number;
};

export type PickupRewardOutput = {
  kind: string;
  value: number;
  playerHealth: number;
  grenadeCount: number;
  flashbangCount: number;
  playerScore: number;
};

export type TargetDamageOutput = {
  health: number;
  ratio: number;
  killed: boolean;
};

export type TargetPoseInput = {
  armAngle?: number;
  legAngle?: number;
  armOffset?: number;
  legOffset?: number;
};

export type TargetZoneDamageInput = {
  weaponId: string;
  currentHealth: number;
  maxHealth: number;
  shotDistance: number;
  height: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  hitX?: number;
  hitY?: number;
  hitZ?: number;
  bulletDirX?: number;
  bulletDirY?: number;
  bulletDirZ?: number;
  pose?: TargetPoseInput;
};

export type TargetZoneDamageOutput = {
  zone: string;
  damage: number;
};

export type ArenaBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type TargetOccupant = {
  x: number;
  z: number;
  alive: boolean;
  visible: boolean;
  skip?: boolean;
};

export type PickRandomSpawnOutput = {
  found: boolean;
  x: number;
  z: number;
};

export type ColliderBoxInput = {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  rotationY?: number;
  cornerRadius?: number;
};

export type CollisionVec2 = {
  x: number;
  z: number;
};

export type ResolveBoxColliderOutput = {
  x: number;
  z: number;
  moved: boolean;
};

export type ProjectileColliderInput = {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  rotationY?: number;
  cornerRadius?: number;
  bottomY?: number;
  topY?: number;
  active?: boolean;
  skipTarget?: boolean;
  kind?: string;
  containerPart?: string;
};

export type PlayerColliderInput = {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  rotationY?: number;
  cornerRadius?: number;
  bottomY?: number;
  topY?: number;
  active?: boolean;
  skipTarget?: boolean;
  kind?: string;
  blockForwardLocalZ?: number;
  stairFlight?: {
    walkHalfWidth?: number;
    ramp?: { zMin?: number; runEnd?: number };
  };
};

export type PushCircleOutOutput = {
  x: number;
  z: number;
};

export type FloorHoleInput = {
  x: number;
  z: number;
  radius?: number;
};

export type GroundSurfaceInput = {
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
  y?: number | null;
  stairRamp?: boolean;
  stairFlight?: boolean;
  roomInteriorFloor?: boolean;
  catwalkWalk?: boolean;
};

export type HeadroomColliderInput = {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  rotationY?: number;
  cornerRadius?: number;
  bottomY?: number | null;
  topY?: number | null;
  active?: boolean;
  kind?: string | null;
  mouthPlane?: boolean;
  exteriorCornerRadius?: number | null;
  containerCx?: number | null;
  containerCz?: number | null;
  containerHalfW?: number | null;
  containerHalfL?: number | null;
  containerPart?: string | null;
  containerEdgeRadius?: number | null;
  containerOpenHalfW?: number | null;
  containerInnerHalfL?: number | null;
  vx27RoofHeadroomMargin?: number;
};

export type HasHeadroomInput = {
  x: number;
  z: number;
  footY: number;
  desiredHeight: number;
  playerRadius: number;
  floorY: number;
  inPassage?: boolean;
  doorwayCeilingY?: number | null;
  colliders: HeadroomColliderInput[];
};

export type ResolveCeilingCollisionsInput = {
  x: number;
  z: number;
  footY: number;
  positionY: number;
  velocityY: number;
  playerRadius: number;
  floorY: number;
  inPassage?: boolean;
  colliders: HeadroomColliderInput[];
};

export type ResolveCeilingCollisionsOutput = {
  positionY: number;
  velocityY: number;
};

export type SampleFlatSupportInput = {
  x: number;
  z: number;
  footY: number;
  bodyTop: number;
  floorY: number;
  playerRadius: number;
  onArenaCatwalkDeck?: boolean;
  onRoomCatwalkDeck?: boolean;
  catwalkDeckSupportY?: number | null;
  floorBounds?: RectBoundsInput | null;
  floorHoles: FloorHoleInput[];
  groundSurfaces: GroundSurfaceInput[];
  colliders: PlayerColliderInput[];
};

export type SampleFlatSupportOutput = {
  bestFlat: number;
  highestStepUp: number;
};

export type ResolveSupportInfoInput = {
  x: number;
  z: number;
  footY: number;
  floorY: number;
  playerRadius: number;
  rampY?: number | null;
  stepUpFlat: number;
  bestFlat: number;
  climbLocalMotion: number;
  stairLocalZ?: number | null;
  onArenaCatwalkDeck?: boolean;
  onRoomCatwalkDeck?: boolean;
  catwalkDeckSupportY?: number | null;
  floorBounds?: RectBoundsInput | null;
  floorHoles: FloorHoleInput[];
};

export type SupportInfoOutput = {
  supportY: number;
  onStairs: boolean;
  stairRamp: boolean;
};

export type Vx27ColliderInput = {
  rotationY?: number;
  containerCx?: number | null;
  containerCz?: number | null;
  containerHalfW?: number | null;
  containerHalfL?: number | null;
  containerPart?: string | null;
  containerEdgeRadius?: number;
  exteriorCornerRadius?: number;
  containerOpenHalfW?: number | null;
  containerInnerHalfL?: number | null;
  bottomY?: number | null;
  topY?: number | null;
  kind?: string | null;
};

export type ClampToBoundsOutput = {
  x: number;
  z: number;
};

export type TickRagdollHoleFallInput = {
  holeFallVelY: number;
  holeFallOffset: number;
  floorY: number;
  dt: number;
};

export type TickRagdollHoleFallOutput = {
  holeFallVelY: number;
  holeFallOffset: number;
  rootY: number;
  opacity: number;
  finished: boolean;
};

export type TickRagdollCoreToppleInput = {
  tipAngle: number;
  angularVel: number;
  settled: boolean;
  bounced: boolean;
  dt: number;
};

export type TickRagdollCoreToppleOutput = {
  tipAngle: number;
  angularVel: number;
  settled: boolean;
  bounced: boolean;
};

export type TickRagdollLaunchInput = {
  launchY: number;
  launchVelY: number;
  launchVelX: number;
  launchVelZ: number;
  originX: number;
  originZ: number;
  airborne: boolean;
  dt: number;
};

export type TickRagdollLaunchOutput = {
  launchY: number;
  launchVelY: number;
  launchVelX: number;
  launchVelZ: number;
  originX: number;
  originZ: number;
  airborne: boolean;
  floorImpact: number;
};

export type SpawnFootprintSampleInput = {
  sx: number;
  sz: number;
  inStairFootprint: boolean;
};

export type ResolveSpawnFootYOutput = {
  found: boolean;
  footY: number;
};

export type RectBoundsInput = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type PlayerColliderResolveEntry = {
  collider: PlayerColliderInput;
  stairLocal?: { localX: number; localZ: number };
  climbLocalMotion?: number;
};

export type ResolvePlayerCollidersInput = {
  x: number;
  z: number;
  radius: number;
  footY: number;
  bodyTop: number;
  stepUpMax: number;
  supportY: number;
  rampFootY?: number | null;
  followingRamp: boolean;
  entries: PlayerColliderResolveEntry[];
};

export type ResolvePlayerCollidersOutput = {
  x: number;
  z: number;
};

export type ComputeWalkBoundsInput = {
  x: number;
  z: number;
  footY: number;
  radius: number;
  bounds: RectBoundsInput;
  floorY: number;
  arenaBounds?: RectBoundsInput | null;
  extensionFp?: RectBoundsInput | null;
  inAttachedFootprint: boolean;
  onFloorExtension: boolean;
  catwalkBounds?: RectBoundsInput | null;
  attachWall: string;
  inPassage: boolean;
};

export type ComputeWalkBoundsOutput = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  catwalkBounds?: RectBoundsInput | null;
  inRoom: boolean;
};

export type ResolveProjectileCollidersInput = {
  pos: ProjectileVec3;
  vel: ProjectileVec3;
  radius: number;
  colliders: ProjectileColliderInput[];
  restitution?: number;
  friction?: number;
  passes?: number;
};

export type ProjectileVec3 = { x: number; y: number; z: number };

export type ProjectileBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type ProjectileLiveFloorOutput = {
  pos: ProjectileVec3;
  vel: ProjectileVec3;
  airborne: boolean;
  bounced: boolean;
  floorHit: boolean;
  floorHitImpact: number;
};

export type ProjectileFuseTickOutput = {
  time: number;
  shouldDetonate: boolean;
  shouldPlayCountdown: boolean;
  countdownPlaybackRate: number;
  countdownPlayed: boolean;
};

export type ProjectilePreviewStepOutput = {
  pos: ProjectileVec3;
  vel: ProjectileVec3;
  bounceCount: number;
  landed: boolean;
  recordBounce: boolean;
  stopSim: boolean;
};

export type TargetRepairOutput = {
  health: number;
  ratio: number;
  repairCooldown: number;
  repaired: boolean;
  alive: boolean;
};

export type CombatScoreOutput = {
  score: number;
  hitScoreAwarded: number;
  totalTargetScore: number;
};

export type GrenadeBlastOutput = {
  hit: boolean;
  falloff: number;
  damage: number;
  knockbackMul: number;
};

export type KillDropPlanOutput = {
  hp: boolean;
  ammo: boolean;
  grenade: boolean;
};

export type PickupCollectInput = {
  itemX: number;
  itemZ: number;
  playerX: number;
  playerZ: number;
  collectRadius: number;
  permanent?: boolean;
  playerFootY?: number | null;
  floorY?: number | null;
  floorSlack?: number;
};

export type PickupCollectOutput = {
  collected: boolean;
  distanceSq: number;
};

export type CollectFadeInput = {
  time: number;
  collectTime: number;
  duration: number;
};

export type CollectFadeOutput = {
  scale: number;
  remove: boolean;
};

export type SecondarySlotInput = {
  slot: number;
  grenadeSlot: number;
  flashbangSlot: number;
  grenadeCount: number;
  flashbangCount: number;
  cooldownRemaining: number;
};

export type SecondarySlotOutput = {
  throwable: boolean;
  kind: string;
  stock: number;
  cooldownReady: boolean;
  canThrow: boolean;
  emptyMessage: string;
};

export type PrimaryWeaponSwapInput = {
  activeId: string;
  slotPick?: string | null;
  swapToggle?: boolean;
  rifleUnlocked?: boolean;
  pistolOwned?: boolean;
};

export type PrimaryWeaponSwapOutput = {
  requested: boolean;
  allowed: boolean;
  nextId: string;
  reason: string;
};

export type PlayerDeathTriggerInput = {
  deathStateActive?: boolean;
  footY: number;
  floorY: number;
  fallDrop: number;
  playerHealth: number;
  grenadeSuicide?: boolean;
};

export type PlayerDeathTriggerOutput = {
  shouldDie: boolean;
  kind: string;
  consumeGrenadeSuicide: boolean;
};

export type KillDropScatterInput = {
  angleRoll: number;
  offsetRoll: number;
  hpDelayRoll: number;
  ammoDelayRoll: number;
  grenadeDelayRoll: number;
};

export type KillDropScatterOutput = {
  angle: number;
  offset: number;
  hpDelayMs: number;
  ammoDelayMs: number;
  grenadeDelayMs: number;
};

export type RewardDropLaunchInput = {
  angleRoll: number;
  speedRoll: number;
  velYRoll: number;
  minSpeed: number;
  speedSpan: number;
  minVelY: number;
  velYSpan: number;
};

export type RewardDropLaunchOutput = {
  angle: number;
  speed: number;
  velX: number;
  velY: number;
  velZ: number;
};

export type RagdollImpulseSeedInput = {
  hitZone: string;
  zoneMult?: number | null;
  bulletDirX?: number | null;
  bulletDirZ?: number | null;
  dirRoll: number;
  angularRoll: number;
  launchRoll: number;
  spinSignRoll: number;
  spinRoll: number;
  profileLaunchMul: number;
  profileSpinMul: number;
  blastKnockback: number;
  deathInitialAngularVel: number;
  launchUpVel: number;
  launchBackVel: number;
  spinVelMin: number;
  spinVelMax: number;
};

export type RagdollImpulseSeedOutput = {
  deathDir: number;
  toppleSeverity: number;
  angularVel: number;
  launchVelY: number;
  launchVelX: number;
  launchVelZ: number;
  spinVel: number;
};

export type TargetRespawnOutput = {
  delayMs: number;
  shouldSchedule: boolean;
};

export type TargetRespawnSpawnPointInput = {
  x: number;
  z: number;
  y?: number | null;
  yaw?: number | null;
  random?: boolean;
  chance?: number | null;
};

export type TargetRespawnPlacementInput = {
  bounds: ArenaBounds;
  radius: number;
  margin: number;
  height: number;
  floorY: number;
  floorBounds?: RectBoundsInput | null;
  floorHoles: FloorHoleInput[];
  groundSurfaces: GroundSurfaceInput[];
  colliders: PlayerColliderInput[];
  targets: TargetOccupant[];
  maxAttempts?: number;
  randomRolls: number[];
  fixedSpawn?: TargetRespawnSpawnPointInput | null;
  spawnPointRoll?: number | null;
};

export type TargetRespawnPlacementOutput = {
  found: boolean;
  x: number;
  z: number;
  y: number;
  yaw?: number | null;
};

export type PlayerDeathOutput = {
  died: boolean;
  reason: string;
  playerLives: number;
  playerHealth: number;
  gameOver: boolean;
  minDisplayEnd: number;
  fadeEndTime: number;
};

export type PlayerRespawnOutput = {
  canRespawn: boolean;
  playerHealth: number;
  fadeEndTime: number;
};

export type WallShopPurchaseOutput = {
  purchased: boolean;
  affordable: boolean;
  firstUnlock: boolean;
  canResupply: boolean;
  playerScore: number;
  stage: number;
  weaponUnlocked: boolean;
  rounds: number;
  spare: number;
};

export type SpringStepOutput = {
  value: number;
  velocity: number;
};

export type FireRecoilKickOutput = {
  backVelDelta: number;
  pitchVelDelta: number;
};

export type AimRecoilStepInput = {
  pitchValue: number;
  pitchVelocity: number;
  pitchTarget: number;
  yawValue: number;
  yawVelocity: number;
  yawTarget: number;
  stiffness: number;
  damping: number;
  dt: number;
};

export type AimRecoilStepOutput = {
  pitchValue: number;
  pitchVelocity: number;
  yawValue: number;
  yawVelocity: number;
};

export type FlashbangBlindApplyOutput = {
  blindStart: number;
  blindFadeEnd: number;
  blinding: boolean;
};

export type GameCoreEngine = {
  getPublicState(): GameCorePublicState;
  tickFrame(input: GameCoreFrameInput): GameCorePublicState;
  tickPlayerCore(input: PlayerCoreInput): PlayerCoreOutput;
  tickPlayerVertical(input: PlayerVerticalInput): PlayerVerticalOutput;
  computePlayerMovementGates(input: PlayerMovementGateInput): PlayerMovementGateOutput;
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
  ): WeaponAmmoOutput;
  tryReloadWeapon(id: string, force: boolean): WeaponAmmoOutput;
  tryConsumeWeaponRound(id: string, autoReload: boolean): WeaponAmmoOutput;
  addWeaponRounds(id: string, rounds: number): WeaponAmmoOutput;
  tryThrowThrowable(kind: string, cooldownSeconds: number): ThrowableOutput;
  applyPickupReward(
    kind: string,
    value: number,
    defaultValue: number,
    healthCap: number,
  ): PickupRewardOutput;
  applyTargetDamage(
    health: number,
    maxHealth: number,
    damage: number,
  ): TargetDamageOutput;
  resolveTargetZoneDamage(input: TargetZoneDamageInput): TargetZoneDamageOutput;
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
  ): SpringStepOutput;
  recoilSpringStep(
    value: number,
    velocity: number,
    stiffness: number,
    damping: number,
    dt: number,
  ): SpringStepOutput;
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
  ): FireRecoilKickOutput;
  stepAimRecoilPair(input: AimRecoilStepInput): AimRecoilStepOutput;
  getFlashbangBlindDurationSec(): number;
  getFlashbangOverlayOpacity(elapsedSec: number): number;
  isFlashbangBlindExpired(simTime: number, fadeEnd: number): boolean;
  applyFlashbangBlindToTarget(
    simTime: number,
    currentlyBlinding: boolean,
    blindStart: number,
    blindFadeEnd: number,
  ): FlashbangBlindApplyOutput;
  computeThrowVelocity(
    aimX: number,
    aimY: number,
    aimZ: number,
    throwSpeed: number,
    loftAngleDeg: number,
  ): ProjectileVec3;
  projectileSubstepCount(
    speed: number,
    dt: number,
    maxMove: number,
    maxSubsteps: number,
  ): number;
  projectileIntegrate(input: {
    pos: ProjectileVec3;
    vel: ProjectileVec3;
    dt: number;
    gravity: number;
  }): { pos: ProjectileVec3; vel: ProjectileVec3 };
  projectileResolveFloorLive(input: {
    pos: ProjectileVec3;
    vel: ProjectileVec3;
    floorTop: number;
    airborne: boolean;
    bounceRestitution: number;
    bounceFriction: number;
  }): ProjectileLiveFloorOutput;
  projectileResolveBounds(input: {
    pos: ProjectileVec3;
    vel: ProjectileVec3;
    bounds: ProjectileBounds;
    radius: number;
    bounceRestitution: number;
  }): { pos: ProjectileVec3; vel: ProjectileVec3 };
  projectileApplyGroundRoll(input: {
    velX: number;
    velZ: number;
    dt: number;
    groundRollFriction: number;
    airborne: boolean;
    fallingThroughHole: boolean;
  }): { velX: number; velZ: number };
  projectileFuseTick(input: {
    time: number;
    dt: number;
    fuseTime: number;
    countdownDuration: number;
    countdownPlayed: boolean;
  }): ProjectileFuseTickOutput;
  projectilePreviewStep(input: {
    pos: ProjectileVec3;
    vel: ProjectileVec3;
    dt: number;
    gravity: number;
    floorTop: number;
    bounceRestitution: number;
    bounceFriction: number;
    bounceCount: number;
    bounds?: ProjectileBounds | null;
    radius: number;
  }): ProjectilePreviewStepOutput;
  projectilePreviewFloorAndBounds(input: {
    pos: ProjectileVec3;
    vel: ProjectileVec3;
    dt: number;
    gravity: number;
    floorTop: number;
    bounceRestitution: number;
    bounceFriction: number;
    bounceCount: number;
    bounds?: ProjectileBounds | null;
    radius: number;
  }): ProjectilePreviewStepOutput;
  overlapsTargets(
    x: number,
    z: number,
    radius: number,
    margin: number,
    occupants: TargetOccupant[],
  ): boolean;
  positionInAuthoredBounds(
    x: number,
    z: number,
    bounds: ArenaBounds,
    radius: number,
    margin: number,
  ): boolean;
  shouldSpawnAuthoredPoint(isRandom: boolean, roll: number, chance: number): boolean;
  pickRandomSpawnXz(input: {
    bounds: ArenaBounds;
    radius: number;
    margin: number;
    maxAttempts: number;
    rolls: number[];
    occupants: TargetOccupant[];
  }): PickRandomSpawnOutput;
  worldToBoxLocal(box: ColliderBoxInput, x: number, z: number): CollisionVec2;
  rotatedBoxOverlapsCircle(
    box: ColliderBoxInput,
    x: number,
    z: number,
    radius: number,
  ): boolean;
  pointInRoundedBoxFootprint(
    box: ColliderBoxInput,
    x: number,
    z: number,
    radius: number,
  ): boolean;
  resolveBoxCollider(
    posX: number,
    posZ: number,
    radius: number,
    box: ColliderBoxInput,
  ): ResolveBoxColliderOutput;
  resolveProjectileAgainstColliders(
    input: ResolveProjectileCollidersInput,
  ): { pos: ProjectileVec3; vel: ProjectileVec3 };
  collectProjectileNearbyColliderIndices(input: {
    px: number;
    py: number;
    pz: number;
    radius: number;
    margin?: number;
    colliders: ProjectileColliderInput[];
  }): number[];
  spawnBlockedAt(input: {
    x: number;
    z: number;
    footY: number;
    bodyTop: number;
    radius: number;
    colliders: PlayerColliderInput[];
  }): boolean;
  pushCircleOutOfColliders(input: {
    x: number;
    z: number;
    radius: number;
    colliders: PlayerColliderInput[];
    footY?: number;
    bodyTop?: number;
    skipTargetMeshes?: boolean;
  }): PushCircleOutOutput;
  pointInFloorHole(
    x: number,
    z: number,
    holes: FloorHoleInput[],
    inset?: number,
  ): boolean;
  resolveSpawnFootY(input: {
    x: number;
    z: number;
    height: number;
    radius: number;
    floorY: number;
    floorBounds?: { minX: number; maxX: number; minZ: number; maxZ: number } | null;
    floorHoles: FloorHoleInput[];
    groundSurfaces: GroundSurfaceInput[];
    colliders: PlayerColliderInput[];
    footprintSamples: SpawnFootprintSampleInput[];
  }): ResolveSpawnFootYOutput;
  resolvePlayerColliders(input: ResolvePlayerCollidersInput): ResolvePlayerCollidersOutput;
  computeResolvedWalkBounds(input: ComputeWalkBoundsInput): ComputeWalkBoundsOutput;
  hasHeadroom(input: HasHeadroomInput): boolean;
  resolveCeilingCollisions(
    input: ResolveCeilingCollisionsInput,
  ): ResolveCeilingCollisionsOutput;
  sampleFlatSupportAt(input: SampleFlatSupportInput): SampleFlatSupportOutput;
  resolveSupportInfo(input: ResolveSupportInfoInput): SupportInfoOutput;
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
  ): ClampToBoundsOutput;
  tickRagdollHoleFall(input: TickRagdollHoleFallInput): TickRagdollHoleFallOutput;
  tickRagdollCoreTopple(
    input: TickRagdollCoreToppleInput,
  ): TickRagdollCoreToppleOutput;
  tickRagdollLaunch(input: TickRagdollLaunchInput): TickRagdollLaunchOutput;
  tickTargetRepair(
    dt: number,
    health: number,
    maxHealth: number,
    repairCooldown: number,
    repairPerSecond: number,
  ): TargetRepairOutput;
  calculateCombatScore(
    zone: string,
    damage: number,
    killed: boolean,
    hitScoreAwarded: number,
    totalScoreAwarded: number,
  ): CombatScoreOutput;
  calculateGrenadeBlastHit(
    distance: number,
    blastRadius: number,
    maxDamage: number,
    falloffPower: number,
  ): GrenadeBlastOutput;
  resolvePickupCollect(input: PickupCollectInput): PickupCollectOutput;
  resolveCollectFade(input: CollectFadeInput): CollectFadeOutput;
  resolveSecondarySlot(input: SecondarySlotInput): SecondarySlotOutput;
  resolvePrimaryWeaponSwap(
    input: PrimaryWeaponSwapInput,
  ): PrimaryWeaponSwapOutput;
  resolvePlayerDeathTrigger(
    input: PlayerDeathTriggerInput,
  ): PlayerDeathTriggerOutput;
  planKillDropScatter(input: KillDropScatterInput): KillDropScatterOutput;
  planRewardDropLaunch(input: RewardDropLaunchInput): RewardDropLaunchOutput;
  resolveRagdollImpulseSeed(
    input: RagdollImpulseSeedInput,
  ): RagdollImpulseSeedOutput;
  planKillDrops(
    zone: string,
    explosiveKill: boolean,
    playerHealth: number,
    spareMags: number,
    ammoSpareThreshold: number,
    grenadeCount: number,
    grenadeRoll: number,
    devDropAllRewards: boolean,
  ): KillDropPlanOutput;
  planTargetRespawn(respawnDelaySec: number): TargetRespawnOutput;
  resolveTargetRespawnPlacement(
    input: TargetRespawnPlacementInput,
  ): TargetRespawnPlacementOutput;
  applyPlayerDeath(
    kind: string,
    nowMs: number,
    minDisplayMs: number,
  ): PlayerDeathOutput;
  planPlayerRespawn(nowMs: number, fadeMs: number): PlayerRespawnOutput;
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
  ): WallShopPurchaseOutput;
};
