export type GameCorePublicState = {
  playerHealth: number;
  healthRegenTimer: number;
  radioactiveOverflowDecayTimer: number;
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

export type TargetRespawnOutput = {
  delayMs: number;
  shouldSchedule: boolean;
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

export type GameCoreEngine = {
  getPublicState(): GameCorePublicState;
  tickFrame(input: GameCoreFrameInput): GameCorePublicState;
  tickPlayerCore(input: PlayerCoreInput): PlayerCoreOutput;
  tickPlayerVertical(input: PlayerVerticalInput): PlayerVerticalOutput;
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
  applyPlayerDeath(
    kind: string,
    nowMs: number,
    minDisplayMs: number,
  ): PlayerDeathOutput;
  planPlayerRespawn(nowMs: number, fadeMs: number): PlayerRespawnOutput;
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
