/**
 * Stagger depth among a filtered visible stack (cycles through visibleOrder only).
 * @param {number} itemId
 * @param {number} selectedId
 * @param {number[]} visibleOrder
 */
export function getStackDepthInOrder(itemId, selectedId, visibleOrder) {
  if (visibleOrder.length <= 1 || itemId === selectedId) return 0;
  let depth = 0;
  let current = selectedId;
  while (current !== itemId) {
    const i = visibleOrder.indexOf(current);
    if (i < 0) return 0;
    current = visibleOrder[(i + 1) % visibleOrder.length];
    depth += 1;
  }
  return depth;
}

/**
 * @param {number} selectedId
 * @param {number[]} visibleOrder
 */
export function resolveStackSelection(selectedId, visibleOrder) {
  if (visibleOrder.length === 0) return null;
  return visibleOrder.includes(selectedId) ? selectedId : visibleOrder[0];
}

const MAX_STACK_TUNE_DEPTH = 3;

/**
 * Map logical stack depth (1..visibleCount-1) onto tune steps so fewer
 * visible items compress into the front layers — no gap for hidden slots.
 * @param {number} logicalDepth
 * @param {number} visibleCount
 */
export function compressStackTuneDepth(logicalDepth, visibleCount) {
  if (logicalDepth <= 0 || visibleCount <= 1) return 0;
  const maxLogical = visibleCount - 1;
  return Math.max(
    1,
    Math.min(
      MAX_STACK_TUNE_DEPTH,
      Math.ceil((logicalDepth / maxLogical) * MAX_STACK_TUNE_DEPTH),
    ),
  );
}

/**
 * @param {number} depth — logical steps from selected in the visible ring
 * @param {Record<number, { x: number, y: number, scale: number }>} tune
 * @param {number} [visibleCount] — how many frames are actually shown
 */
export function getStackFrameStyleFromDepth(depth, tune, visibleCount = 4) {
  if (depth === 0) {
    return {
      "--slot-x": "0px",
      "--slot-y": "0px",
      "--slot-scale": "1",
      "--slot-z": 4,
    };
  }
  const tuneDepth = compressStackTuneDepth(depth, visibleCount);
  const t = tune[tuneDepth] ?? tune[1];
  return {
    "--slot-x": `${t.x}px`,
    "--slot-y": `${t.y}px`,
    "--slot-scale": String(t.scale),
    "--slot-z": Math.max(1, 4 - depth),
  };
}
