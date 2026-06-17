/** @deprecated Use loadConsoleHackEngine from @/lib/hack/consoleHackEngine instead. */
export { loadConsoleHackEngine as createHackEngine } from "@/lib/hack/consoleHackEngine";
export type {
  ConsoleHackEngine as HackEngine,
  CreateHackGameOptions as HackEngineOptions,
  HackGameState as PublicHackState,
} from "@/lib/hack/consoleHackTypes";
