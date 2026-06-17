export type HackStatus = "idle" | "active" | "failed" | "complete";
export type HackFailureKind = "security" | "timer";
export type HackNodeType = "power" | "security" | "reward";
export type HackDirection = "up" | "down" | "right";

export type HackPuzzleNode = {
  id: string;
  row: number;
  col: number;
  type: HackNodeType;
  revealed: boolean;
  connected: boolean;
  selected: boolean;
  triggered: boolean;
  pointerDirection: HackDirection;
  validDirections: HackDirection[];
  pointerTargetIndex: number;
};

export type HackConnection = {
  fromId: string;
  toId: string;
};

export type HackRewards = {
  credits: number;
  pistolAmmo: number;
  rifleSpareMag: number;
  medkit: number;
  rifle: boolean;
  grenade: number;
  flashbang: number;
};

export type HackGameState = {
  status: HackStatus;
  rows: number;
  cols: number;
  seed: number;
  selectedNodeId: string;
  activeNodeId: string;
  startNodeId: string;
  rewardNodeId: string;
  nodes: HackPuzzleNode[];
  connections: HackConnection[];
  failureConnection: HackConnection | null;
  progress: number;
  securityTotal: number;
  timerRemainingMs: number;
  timerTotalMs: number;
  retriesUsed: number;
  failureKind: HackFailureKind | null;
  failureMessage: string | null;
  successMessage: string | null;
  aimRoll: number;
  aimNonce: number;
  rewardRoll: number;
  rewards: HackRewards;
};

export type CreateHackGameOptions = {
  rows?: number;
  cols?: number;
  seed?: number;
  timerMs?: number;
};

export type ConfirmSelectedNodeResult = {
  state: HackGameState;
  event: string | null;
};

export type ConsoleHackEngine = {
  createHackGameState(opts?: CreateHackGameOptions): HackGameState;
  startHack(state: HackGameState): HackGameState;
  resetHack(state: HackGameState): HackGameState;
  resetHackAfterSecurityDeath(state: HackGameState): HackGameState;
  resetHackAfterTimerExpiry(state: HackGameState): HackGameState;
  tickHackTimer(state: HackGameState, deltaMs: number): HackGameState;
  navigateHackSelection(state: HackGameState, key: string): HackGameState;
  rotateSelectedNode(state: HackGameState): HackGameState;
  selectNodeByMouse(state: HackGameState, nodeId: string): HackGameState;
  confirmSelectedNode(state: HackGameState): ConfirmSelectedNodeResult;
  getHackStatusText(state: HackGameState): string;
  getHackObjectiveCount(state: HackGameState): string;
  getHackRouteProgressPct(state: HackGameState): number;
  isHackSecurityFailure(state: HackGameState): boolean;
  isHackTimerExpired(state: HackGameState): boolean;
  isHackTimerTicking(state: HackGameState): boolean;
  isHackRetriesExhausted(state: HackGameState): boolean;
  getHackRetriesLabel(state: HackGameState): string;
  isSelectableNeighbor(state: HackGameState, nodeId: string): boolean;
  getStartPointerTarget(state: HackGameState): HackPuzzleNode | null;
  getActivePointerTarget(state: HackGameState): HackPuzzleNode | null;
  getRewardPointerTarget(state: HackGameState): HackPuzzleNode | null;
  getHackNodeVisualState(state: HackGameState, nodeId: string): string;
  getHackRoutePath(state: HackGameState): string[];
  rollHackRewards(seed: number, salt?: number): HackRewards;
};
