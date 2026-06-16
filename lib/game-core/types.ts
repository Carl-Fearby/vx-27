export type GameCorePublicState = {
  playerHealth: number;
  healthRegenTimer: number;
  radioactiveOverflowDecayTimer: number;
  grenadeCooldownRemaining: number;
  stamina: number;
  staminaMax: number;
  sprinting: boolean;
  staminaShouldSyncFromHealth: boolean;
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

export type GameCoreEngine = {
  getPublicState(): GameCorePublicState;
  tickFrame(input: GameCoreFrameInput): GameCorePublicState;
  tickPlayerCore(input: PlayerCoreInput): PlayerCoreOutput;
  tickPlayerVertical(input: PlayerVerticalInput): PlayerVerticalOutput;
  setPlayerHealth(value: number): void;
  damagePlayer(amount: number): number;
  healPlayer(amount: number, cap?: number): number;
  setGrenadeCooldown(seconds: number): void;
  resetPlayerCore(staminaMax?: number): void;
  syncStaminaMax(staminaMax: number): void;
  syncPlayerVertical(y: number, velocityY: number, grounded: boolean): void;
};
