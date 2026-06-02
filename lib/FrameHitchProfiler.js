/**
 * Dev-only frame hitch logger. Enable with localStorage `fps-frame-hitch-profiler=true`.
 * When a frame exceeds `thresholdMs`, logs a breakdown of marked sections to the console.
 * Also logs browser "long tasks" (>50ms) and flags hitches in the first 45s after Start Game.
 */

export const FRAME_HITCH_PROFILER_KEY = "fps-frame-hitch-profiler";

const STARTUP_WINDOW_MS = 45_000;

export function loadFrameHitchProfilerEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(FRAME_HITCH_PROFILER_KEY) === "true";
}

/**
 * @param {{ enabled?: boolean, thresholdMs?: number, startupThresholdMs?: number }} [options]
 */
export function createFrameHitchProfiler(options = {}) {
  let enabled = options.enabled ?? false;
  let thresholdMs = options.thresholdMs ?? 22;
  let startupThresholdMs = options.startupThresholdMs ?? 18;
  let hitchCount = 0;
  let startupHitchCount = 0;
  let frameStart = 0;
  let lastMark = 0;
  let gameplayStartMs = 0;
  /** @type {{ label: string, ms: number }[]} */
  let marks = [];
  /** @type {PerformanceObserver | null} */
  let longTaskObserver = null;

  function attachLongTaskObserver() {
    if (longTaskObserver || typeof PerformanceObserver === "undefined") return;
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        if (!enabled) return;
        for (const entry of list.getEntries()) {
          if (entry.duration < 50) continue;
          const inStartup =
            gameplayStartMs > 0 &&
            entry.startTime + entry.duration - gameplayStartMs < STARTUP_WINDOW_MS;
          const tag = inStartup ? "[startup long task]" : "[long task]";
          console.warn(
            `${tag} ${entry.duration.toFixed(0)}ms` +
              (entry.name ? ` (${entry.name})` : "")
          );
        }
      });
      longTaskObserver.observe({ entryTypes: ["longtask"] });
    } catch {
      longTaskObserver = null;
    }
  }

  function detachLongTaskObserver() {
    longTaskObserver?.disconnect();
    longTaskObserver = null;
  }

  return {
    setEnabled(value) {
      enabled = value;
      if (enabled) attachLongTaskObserver();
      else detachLongTaskObserver();
    },
    isEnabled() {
      return enabled;
    },
    markGameplayStart(now = performance.now()) {
      gameplayStartMs = now;
    },
    frameStart(now) {
      if (!enabled) return;
      marks = [];
      frameStart = now;
      lastMark = now;
    },
    mark(label) {
      if (!enabled) return;
      const t = performance.now();
      marks.push({ label, ms: t - lastMark });
      lastMark = t;
    },
    frameEnd(now) {
      if (!enabled) return;
      const total = now - frameStart;
      const inStartup =
        gameplayStartMs > 0 && now - gameplayStartMs < STARTUP_WINDOW_MS;
      const limit = inStartup ? startupThresholdMs : thresholdMs;
      if (total < limit) return;

      if (inStartup) startupHitchCount += 1;
      else hitchCount += 1;

      const body = marks
        .map((m) => `  ${m.label}: ${m.ms.toFixed(1)}ms`)
        .join("\n");
      const prefix = inStartup
        ? `[startup hitch #${startupHitchCount}]`
        : `[frame hitch #${hitchCount}]`;
      console.warn(`${prefix} ${total.toFixed(1)}ms\n${body}`);
    },
    dispose() {
      detachLongTaskObserver();
    },
  };
}
