import type {
  ConfirmSelectedNodeResult,
  ConsoleHackEngine,
  CreateHackGameOptions,
  HackGameState,
  HackPuzzleNode,
  HackRewards,
} from "@/lib/hack/consoleHackTypes";

type WasmHackCore = {
  createHackGameState(opts: unknown): unknown;
  startHack(state: unknown): unknown;
  resetHack(state: unknown): unknown;
  resetHackAfterSecurityDeath(state: unknown): unknown;
  resetHackAfterTimerExpiry(state: unknown): unknown;
  tickHackTimer(state: unknown, deltaMs: number): unknown;
  navigateHackSelection(state: unknown, key: string): unknown;
  rotateSelectedNode(state: unknown): unknown;
  selectNodeByMouse(state: unknown, nodeId: string): unknown;
  confirmSelectedNode(state: unknown): unknown;
  getHackStatusText(state: unknown): string;
  getHackObjectiveCount(state: unknown): string;
  getHackRouteProgressPct(state: unknown): number;
  isHackSecurityFailure(state: unknown): boolean;
  isHackTimerExpired(state: unknown): boolean;
  isHackTimerTicking(state: unknown): boolean;
  isHackRetriesExhausted(state: unknown): boolean;
  getHackRetriesLabel(state: unknown): string;
  isSelectableNeighbor(state: unknown, nodeId: string): boolean;
  getStartPointerTarget(state: unknown): unknown;
  getActivePointerTarget(state: unknown): unknown;
  getRewardPointerTarget(state: unknown): unknown;
  getHackNodeVisualState(state: unknown, nodeId: string): string;
  getHackRoutePath(state: unknown): unknown;
  rollHackRewards(seed: number, salt: number): unknown;
};

type HackCoreModule = {
  default: () => Promise<unknown>;
} & WasmHackCore;

let hackCorePromise: Promise<HackCoreModule> | null = null;

async function loadHackCoreModule(): Promise<HackCoreModule> {
  if (!hackCorePromise) {
    hackCorePromise = import("@/rust/hack_core/pkg/hack_core.js") as Promise<HackCoreModule>;
  }
  const module = await hackCorePromise;
  await module.default();
  return module;
}

function asState(value: unknown): HackGameState {
  return value as HackGameState;
}

function asNode(value: unknown): HackPuzzleNode | null {
  if (value == null) return null;
  return value as HackPuzzleNode;
}

function asConfirm(value: unknown): ConfirmSelectedNodeResult {
  return value as ConfirmSelectedNodeResult;
}

function asRewards(value: unknown): HackRewards {
  return value as HackRewards;
}

export async function loadConsoleHackEngine(): Promise<ConsoleHackEngine> {
  const wasm = await loadHackCoreModule();

  return {
    createHackGameState(opts = {}) {
      return asState(wasm.createHackGameState(opts));
    },
    startHack(state) {
      return asState(wasm.startHack(state));
    },
    resetHack(state) {
      return asState(wasm.resetHack(state));
    },
    resetHackAfterSecurityDeath(state) {
      return asState(wasm.resetHackAfterSecurityDeath(state));
    },
    resetHackAfterTimerExpiry(state) {
      return asState(wasm.resetHackAfterTimerExpiry(state));
    },
    tickHackTimer(state, deltaMs) {
      const next = asState(wasm.tickHackTimer(state, Math.max(0, Math.round(deltaMs))));
      const prevFailure = state.failureConnection;
      const nextFailure = next.failureConnection;
      // Keep nested object identity when the timer tick did not change the failure edge.
      // React effects key off failureConnection; WASM deserializes a new object every call.
      if (
        prevFailure &&
        nextFailure &&
        prevFailure.fromId === nextFailure.fromId &&
        prevFailure.toId === nextFailure.toId
      ) {
        next.failureConnection = prevFailure;
      }
      return next;
    },
    navigateHackSelection(state, key) {
      return asState(wasm.navigateHackSelection(state, key));
    },
    rotateSelectedNode(state) {
      return asState(wasm.rotateSelectedNode(state));
    },
    selectNodeByMouse(state, nodeId) {
      return asState(wasm.selectNodeByMouse(state, nodeId));
    },
    confirmSelectedNode(state) {
      return asConfirm(wasm.confirmSelectedNode(state));
    },
    getHackStatusText(state) {
      return wasm.getHackStatusText(state);
    },
    getHackObjectiveCount(state) {
      return wasm.getHackObjectiveCount(state);
    },
    getHackRouteProgressPct(state) {
      return wasm.getHackRouteProgressPct(state);
    },
    isHackSecurityFailure(state) {
      return wasm.isHackSecurityFailure(state);
    },
    isHackTimerExpired(state) {
      return wasm.isHackTimerExpired(state);
    },
    isHackTimerTicking(state) {
      return wasm.isHackTimerTicking(state);
    },
    isHackRetriesExhausted(state) {
      return wasm.isHackRetriesExhausted(state);
    },
    getHackRetriesLabel(state) {
      return wasm.getHackRetriesLabel(state);
    },
    isSelectableNeighbor(state, nodeId) {
      return wasm.isSelectableNeighbor(state, nodeId);
    },
    getStartPointerTarget(state) {
      return asNode(wasm.getStartPointerTarget(state));
    },
    getActivePointerTarget(state) {
      return asNode(wasm.getActivePointerTarget(state));
    },
    getRewardPointerTarget(state) {
      return asNode(wasm.getRewardPointerTarget(state));
    },
    getHackNodeVisualState(state, nodeId) {
      return wasm.getHackNodeVisualState(state, nodeId);
    },
    getHackRoutePath(state) {
      return wasm.getHackRoutePath(state) as string[];
    },
    rollHackRewards(seed, salt = 0) {
      return asRewards(wasm.rollHackRewards(seed >>> 0, salt >>> 0));
    },
  };
}
