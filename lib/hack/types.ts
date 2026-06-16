export type HackDirection = "up" | "down" | "left" | "right";

export type HackNodeType = "power" | "security";

export type PublicHackNode = {
  x: number;
  y: number;
  locked: boolean;
  discovered: boolean;
  revealedType?: HackNodeType;
};

export type HackConnection = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  type: "power";
};

export type PublicHackState = {
  width: number;
  height: number;
  startX: number;
  startY: number;
  selectedX: number;
  selectedY: number;
  pointerTargetX: number;
  pointerTargetY: number;
  nodes: PublicHackNode[];
  connections: HackConnection[];
  failed: boolean;
  complete: boolean;
};

export type HackConfirmResult = {
  succeeded: boolean;
  failed: boolean;
  complete: boolean;
  connection?: HackConnection;
  revealedType?: HackNodeType;
};

export type HackEngineOptions = {
  width: number;
  height: number;
  seed?: number;
};

export type HackEngine = {
  getPublicState(): PublicHackState;
  moveSelection(direction: HackDirection): boolean;
  rotatePointer(): boolean;
  confirmSelection(): HackConfirmResult;
  resetHack(): void;
  isComplete(): boolean;
  isFailed(): boolean;
};
