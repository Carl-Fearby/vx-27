import { runGameFrame } from "./runGameFrame.js";

/**
 * @param {import("./gameLoopContext.js").GameLoopContext} ctx
 * @param {{
 *   isDisposed: () => boolean,
 *   isReady: () => boolean,
 *   scheduleNextFrame: (fn: (now: number) => void) => void,
 * }} lifecycle
 */
export function createGameLoop(ctx, lifecycle) {
  return function animate(now) {
    if (lifecycle.isDisposed() || !lifecycle.isReady() || !ctx.level?.group) {
      return;
    }
    if (!ctx.level.group.parent) {
      ctx.scene.add(ctx.level.group);
    }
    try {
      runGameFrame(ctx, now);
    } catch (err) {
      if (!lifecycle.isDisposed()) {
        console.error("Frame render failed:", err);
      }
    }
    if (!lifecycle.isDisposed() && lifecycle.isReady()) {
      lifecycle.scheduleNextFrame(animate);
    }
  };
}
