import type {
  GameCoreEngine,
  GameCoreFrameInput,
  GameCorePublicState,
  CombatScoreOutput,
  GrenadeBlastOutput,
  KillDropPlanOutput,
  PlayerDeathOutput,
  PlayerRespawnOutput,
  PickupRewardOutput,
  TargetDamageOutput,
  TargetRepairOutput,
  TargetRespawnOutput,
  ThrowableOutput,
  WallShopPurchaseOutput,
  WeaponAmmoOutput,
} from "@/lib/game-core/types";

type WasmGameCore = {
  getPublicState(): unknown;
  tickFrame(input: GameCoreFrameInput): unknown;
  tickPlayerCore(input: unknown): unknown;
  tickPlayerVertical(input: unknown): unknown;
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
  addWeaponRounds(id: string, rounds: number): unknown;
  tryThrowThrowable(kind: string, cooldownSeconds: number): unknown;
  applyPickupReward(
    kind: string,
    value: number,
    defaultValue: number,
    healthCap: number,
  ): unknown;
  applyTargetDamage(health: number, maxHealth: number, damage: number): unknown;
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
  applyPlayerDeath(kind: string, nowMs: number, minDisplayMs: number): unknown;
  planPlayerRespawn(nowMs: number, fadeMs: number): unknown;
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

function asTargetRepairOutput(value: unknown): TargetRepairOutput {
  return value as TargetRepairOutput;
}

function asCombatScoreOutput(value: unknown): CombatScoreOutput {
  return value as CombatScoreOutput;
}

function asGrenadeBlastOutput(value: unknown): GrenadeBlastOutput {
  return value as GrenadeBlastOutput;
}

function asKillDropPlanOutput(value: unknown): KillDropPlanOutput {
  return value as KillDropPlanOutput;
}

function asTargetRespawnOutput(value: unknown): TargetRespawnOutput {
  return value as TargetRespawnOutput;
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
    applyPlayerDeath(kind, nowMs, minDisplayMs) {
      return asPlayerDeathOutput(core.applyPlayerDeath(kind, nowMs, minDisplayMs));
    },
    planPlayerRespawn(nowMs, fadeMs) {
      return asPlayerRespawnOutput(core.planPlayerRespawn(nowMs, fadeMs));
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
