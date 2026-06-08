/**
 * Puzzle grid layout for NODE BREACH — cell math + random node placement.
 * Fractions are relative to hack-console.png frame (1024×576).
 */

/** @typedef {{ x: number, y: number, w: number, h: number }} HackRect */

/** @typedef {{
 *   col: number,
 *   row: number,
 *   index: number,
 *   variant: "live" | "dead" | "empty",
 * }} HackGridNode */

/** Fraction of grid cells left without a node icon. */
export const HACK_GRID_EMPTY_RATIO = 0.3;

/**
 * @param {number} n
 * @param {number} [seed]
 */
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {unknown[]} items @param {number} [seed] */
function shuffle(items, seed) {
  const rand = seed == null ? Math.random : mulberry32(seed);
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * @param {HackRect} gridArea
 * @param {number} col
 * @param {number} row
 * @param {number} cols
 * @param {number} rows
 */
export function hackGridCellRect(gridArea, col, row, cols, rows) {
  const cellW = gridArea.w / cols;
  const cellH = gridArea.h / rows;
  return {
    x: gridArea.x + col * cellW,
    y: gridArea.y + row * cellH,
    w: cellW,
    h: cellH,
  };
}

/**
 * Sprite templates store x/y/w/h as fractions of a single grid cell (0–1).
 * x/y offset the sprite center from the cell center; w/h are size within the cell.
 * Position sprites inside gridArea so they move/scale with the grid.
 *
 * @param {number} col
 * @param {number} row
 * @param {{ x: number, y: number, w: number, h: number, fontScale?: number }} template
 * @param {number} cols
 * @param {number} rows
 */
export function hackNodeSpriteStyleInGrid(col, row, template, cols, rows) {
  const scale = template.fontScale ?? 1;
  const w = template.w * scale;
  const h = template.h * scale;
  const cellW = 1 / cols;
  const cellH = 1 / rows;
  const cx = col * cellW + cellW * (0.5 + template.x);
  const cy = row * cellH + cellH * (0.5 + template.y);
  return {
    left: `${(cx - (w * cellW) / 2) * 100}%`,
    top: `${(cy - (h * cellH) / 2) * 100}%`,
    width: `${(w * cellW) * 100}%`,
    height: `${(h * cellH) * 100}%`,
  };
}

/**
 * Convert top-left cell-local sprite templates to center-offset form.
 *
 * @param {{ x: number, y: number, w: number, h: number, fontScale?: number }} template
 */
export function hackSpriteTemplateToCentered(template) {
  return {
    ...template,
    x: template.x + template.w / 2 - 0.5,
    y: template.y + template.h / 2 - 0.5,
  };
}

/** @param {{ x: number, y: number, w: number, h: number }} template */
export function isHackSpriteTemplateTopLeftLocal(template) {
  const centerX = template.x + template.w / 2;
  const centerY = template.y + template.h / 2;
  const centered =
    Math.abs(centerX - 0.5) < 0.06 && Math.abs(centerY - 0.5) < 0.06;
  return centered && (Math.abs(template.x) > 0.02 || Math.abs(template.y) > 0.02);
}

/** @param {number} col @param {number} row @param {number} cols @param {number} rows */
export function hackGridCellStyleInGrid(col, row, cols, rows) {
  return {
    left: `${(col / cols) * 100}%`,
    top: `${(row / rows) * 100}%`,
    width: `${(1 / cols) * 100}%`,
    height: `${(1 / rows) * 100}%`,
  };
}

/**
 * Detect layouts saved with frame-absolute sprite rects (pre cell-local).
 *
 * @param {{ x: number, y: number, w: number, h: number }} template
 * @param {HackRect} gridArea
 * @param {number} cols
 * @param {number} rows
 */
export function isHackSpriteTemplateAbsolute(template, gridArea, cols, rows) {
  const refCell = hackGridCellRect(gridArea, 0, 0, cols, rows);
  return template.w < refCell.w * 0.95 && template.h < refCell.h * 0.95;
}

/**
 * @param {{ x: number, y: number, w: number, h: number, fontScale?: number }} template
 * @param {HackRect} gridArea
 * @param {number} cols
 * @param {number} rows
 */
export function hackSpriteTemplateToCellLocal(template, gridArea, cols, rows) {
  const refCell = hackGridCellRect(gridArea, 0, 0, cols, rows);
  return {
    ...template,
    x: refCell.w > 0 ? (template.x - refCell.x) / refCell.w : template.x,
    y: refCell.h > 0 ? (template.y - refCell.y) / refCell.h : template.y,
    w: refCell.w > 0 ? template.w / refCell.w : template.w,
    h: refCell.h > 0 ? template.h / refCell.h : template.h,
  };
}

/**
 * @param {{
 *   cols: number,
 *   rows: number,
 *   liveRatio?: number,
 *   emptyRatio?: number,
 *   seed?: number,
 * }} opts
 * @returns {HackGridNode[]}
 */
export function buildRandomHackGridNodes({
  cols,
  rows,
  liveRatio = 0.55,
  emptyRatio = HACK_GRID_EMPTY_RATIO,
  seed,
}) {
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({ col, row, index: row * cols + col });
    }
  }

  const rand = seed == null ? Math.random : mulberry32(seed);
  const ordered = shuffle(cells, seed);
  const emptyCount = Math.min(
    ordered.length - 1,
    Math.max(0, Math.round(ordered.length * emptyRatio))
  );

  return ordered.map((cell, i) => {
    if (i < emptyCount) {
      return { ...cell, variant: "empty" };
    }
    return {
      ...cell,
      variant: rand() < liveRatio ? "live" : "dead",
    };
  });
}

export const HACK_NODE_LIVE_SRC = "/ui/hack/node-live.png";
export const HACK_NODE_DEAD_SRC = "/ui/hack/node-dead.png";
export const HACK_REWARD_CACHE_SRC = "/ui/hack/reward-cache.png";
export const HACK_POINTER_SRC = "/ui/hack/pointer.png";
export const HACK_SELECTED_POINTER_SRC = "/ui/hack/selected-pointer.png";
export const HACK_LINE_SRC = "/ui/hack/line.png";
export const HACK_ERROR_LINE_SRC = "/ui/hack/error-line.png";
/** Native line.png size on hack-console.png (1024×576). */
export const HACK_LINE_NATIVE_H = 23;
export const HACK_CONSOLE_PLATE_W = 1024;
export const HACK_CONSOLE_PLATE_H = 576;

/**
 * Position line.png center-to-center; long asset is cropped at the strip edges
 * (node sprites sit above and hide the decorative end caps).
 *
 * @param {{ x: number, y: number }} from overlay viewBox 0–100
 * @param {{ x: number, y: number }} to
 */
export function hackConnectionStripStyle(from, to) {
  const plateAspect = HACK_CONSOLE_PLATE_H / HACK_CONSOLE_PLATE_W;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const widthPct = Math.hypot(dx, dy * plateAspect);
  const angle = (Math.atan2(dy * plateAspect, dx) * 180) / Math.PI;
  return {
    left: `${(from.x + to.x) / 2}%`,
    top: `${(from.y + to.y) / 2}%`,
    width: `${widthPct}%`,
    height: `${(HACK_LINE_NATIVE_H / HACK_CONSOLE_PLATE_H) * 100}%`,
    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
  };
}

/** Baked START marker — tuned on hack-console.png plate. */
export function hackGridStartNodeDefaultRect() {
  return {
    x: 0.214,
    y: 0.386,
    w: 0.108,
    h: 0.18,
    labelY: 0.371,
  };
}

/** Baked REWARD CACHE marker — tuned on hack-console.png plate. */
export function hackGridRewardCacheDefaultRect() {
  return {
    x: 0.693,
    y: 0.408,
    w: 0.105,
    h: 0.134,
    labelY: 0.344,
  };
}

/** @param {{ x: number, y: number, w: number, h: number }} rect */
export function hackRectCenter(rect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

/** @param {{ x: number, y: number }} point */
export function hackOverlayPointToViewBox(point) {
  return { x: point.x * 100, y: point.y * 100 };
}

/**
 * Connection anchor in overlay space (0–1) — matches sprite centers and START marker.
 *
 * @param {{ id: string, col: number, row: number }} node
 * @param {HackRect} gridArea
 * @param {{ x?: number, y?: number }} spriteTemplate
 * @param {number} cols
 * @param {number} rows
 * @param {HackRect | undefined} gridStartNode
 * @param {string} [startNodeId]
 * @param {HackRect | undefined} [gridRewardCache]
 * @param {string} [rewardNodeId]
 */
export function hackConnectionNodeCenterInOverlay(
  node,
  gridArea,
  spriteTemplate,
  cols,
  rows,
  gridStartNode,
  startNodeId = "start",
  gridRewardCache,
  rewardNodeId = "reward"
) {
  if (node.id === startNodeId && gridStartNode) {
    return hackRectCenter(gridStartNode);
  }
  if (node.id === rewardNodeId && gridRewardCache) {
    return hackRectCenter(gridRewardCache);
  }
  return hackGridSpriteCenterInOverlay(gridArea, node.col, node.row, spriteTemplate, cols, rows);
}

/**
 * Sprite visual center on the console overlay (0–1), matching hackNodeSpriteStyleInGrid.
 *
 * @param {HackRect} gridArea
 * @param {number} col
 * @param {number} row
 * @param {{ x?: number, y?: number }} [template]
 * @param {number} cols
 * @param {number} rows
 */
export function hackGridSpriteCenterInOverlay(gridArea, col, row, template, cols, rows) {
  const cellW = gridArea.w / cols;
  const cellH = gridArea.h / rows;
  return {
    x: gridArea.x + col * cellW + cellW * (0.5 + (template?.x ?? 0)),
    y: gridArea.y + row * cellH + cellH * (0.5 + (template?.y ?? 0)),
  };
}

/**
 * Aim pointer.png (triangle at 12 o'clock) from `from` toward `to` in overlay space.
 *
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 */
export function hackPointerRingAngleBetweenOverlay(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI + 90;
}

/** Per-node glow/pulse CSS vars for live grid sprites. */
export function hackNodePulseTimingStyle(index) {
  return {
    "--pulse-dur": `${2.35 + (index % 9) * 0.42}s`,
    "--pulse-delay": `${(index % 13) * 0.21}s`,
  };
}
