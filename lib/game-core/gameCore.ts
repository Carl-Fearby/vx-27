import type {
  GameCoreEngine,
  GameCoreFrameInput,
  GameCorePublicState,
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
  resetPlayerCore(staminaMax?: number): void;
  syncStaminaMax(staminaMax: number): void;
  syncPlayerVertical(y: number, velocityY: number, grounded: boolean): void;
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
    resetPlayerCore(staminaMax) {
      core.resetPlayerCore(staminaMax);
    },
    syncStaminaMax(staminaMax) {
      core.syncStaminaMax(staminaMax);
    },
    syncPlayerVertical(y, velocityY, grounded) {
      core.syncPlayerVertical(y, velocityY, grounded);
    },
  };
}
