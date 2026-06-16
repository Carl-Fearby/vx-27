import type {
  HackConfirmResult,
  HackDirection,
  HackEngine,
  HackEngineOptions,
  PublicHackState,
} from "@/lib/hack/types";

type WasmHackGame = {
  getPublicState(): unknown;
  moveSelection(direction: HackDirection): boolean;
  rotatePointer(): boolean;
  confirmSelection(): unknown;
  resetHack(): void;
  isComplete(): boolean;
  isFailed(): boolean;
};

type HackCoreModule = {
  default: () => Promise<unknown>;
  createHackGame(width: number, height: number, seed?: number): WasmHackGame;
};

let hackCorePromise: Promise<HackCoreModule> | null = null;

async function loadHackCore(): Promise<HackCoreModule> {
  if (!hackCorePromise) {
    hackCorePromise = import("@/rust/hack_core/pkg/hack_core.js") as Promise<HackCoreModule>;
  }
  const module = await hackCorePromise;
  await module.default();
  return module;
}

function asPublicHackState(value: unknown): PublicHackState {
  return value as PublicHackState;
}

function asHackConfirmResult(value: unknown): HackConfirmResult {
  return value as HackConfirmResult;
}

export async function createHackEngine(options: HackEngineOptions): Promise<HackEngine> {
  const { createHackGame } = await loadHackCore();
  const game = createHackGame(options.width, options.height, options.seed);

  return {
    getPublicState() {
      return asPublicHackState(game.getPublicState());
    },
    moveSelection(direction) {
      return game.moveSelection(direction);
    },
    rotatePointer() {
      return game.rotatePointer();
    },
    confirmSelection() {
      return asHackConfirmResult(game.confirmSelection());
    },
    resetHack() {
      game.resetHack();
    },
    isComplete() {
      return game.isComplete();
    },
    isFailed() {
      return game.isFailed();
    },
  };
}
