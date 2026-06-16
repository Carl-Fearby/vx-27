/**
 * Per-line layout + colours for the NODE BREACH hack console overlay.
 * Fractions are relative to public/ui/hack-console.png (1024×576, alpha plate).
 */

import {
  hackSpriteTemplateToCellLocal,
  hackSpriteTemplateToCentered,
  isHackSpriteTemplateAbsolute,
  isHackSpriteTemplateTopLeftLocal,
} from "@/lib/console-hack/ConsoleHackGrid.js";

export const CONSOLE_HACK_LAYOUT_KEY = "fps-console-hack-layout-v25";

const LEGACY_CONSOLE_HACK_LAYOUT_PREFIX = "fps-console-hack-layout-v";
const LAYOUT_SCHEMA_VERSION = 7;

const REWARD_ICON_COLORS = {
  labelColor: "#ffd84a",
  valueColor: "#ffd84a",
  accentColor: "#ffe566",
  fontScale: 1,
};
export const CONSOLE_HACK_TUNE_ENABLED_KEY = "fps-console-hack-tune-enabled";

/** @typedef {{
 *   x: number,
 *   y: number,
 *   w: number,
 *   h: number,
 *   labelColor: string,
 *   valueColor: string,
 *   accentColor: string,
 *   fontScale: number,
 *   gridCols?: number,
 *   gridRows?: number,
 *   spriteCentered?: boolean,
 * }} HackElementTune */

/** @typedef {Record<string, HackElementTune>} ConsoleHackLayoutTuning */

const DEFAULT_COLORS = {
  labelColor: "#78c8ff",
  valueColor: "#9ee8ff",
  accentColor: "#b4ecff",
  fontScale: 1,
};

const FOOTER_COLORS = {
  labelColor: "#9ee8ff",
  valueColor: "#c8f2ff",
  accentColor: "#c8f2ff",
  fontScale: 0.88,
};

/** @param {number} x @param {number} y @param {number} w @param {number} h @param {Partial<HackElementTune>} [overrides] */
function line(x, y, w, h, overrides = {}) {
  return { x, y, w, h, ...DEFAULT_COLORS, ...overrides };
}

/** @type {Record<string, { label: string, group: string }>} */
export const HACK_ELEMENT_META = {
  headerTitle: { label: "NODE BREACH", group: "Header" },
  headerSubtitle: { label: "VX-27 CONTROL SYSTEM", group: "Header" },
  statusLabel: { label: "STATUS label", group: "Left" },
  statusValue: { label: "ACCESSING REWARD NODE", group: "Left" },
  statusPulse: { label: "Status pulse dots", group: "Left" },
  objectiveLabel: { label: "OBJECTIVE label", group: "Left" },
  objectiveLine1: { label: "> ROUTE POWER", group: "Left" },
  objectiveLine2: { label: "> BYPASS 3 SECURITY NODES", group: "Left" },
  objectiveCount: { label: "0/3", group: "Left" },
  rewardLabel: { label: "REWARD label", group: "Left" },
  rewardTitle: { label: "SUPPLY CACHE", group: "Left" },
  rewardSub: { label: "+ CREDITS / AMMO / MEDKIT", group: "Left" },
  timerLabel: { label: "TIMER label", group: "Left" },
  timerIcon: { label: "Timer clock icon", group: "Left" },
  timerValue: { label: "01:48:72", group: "Left" },
  progressLabel: { label: "PROGRESS label", group: "Left" },
  progressBar: { label: "Progress bar", group: "Left" },
  progressPct: { label: "44%", group: "Left" },
  gridStart: { label: "START", group: "Grid" },
  gridStartNode: { label: "START live node", group: "Grid" },
  gridReward: { label: "REWARD CACHE", group: "Grid" },
  gridRewardCache: { label: "Reward cache sprite", group: "Grid" },
  gridArea: { label: "Node grid area", group: "Grid" },
  nodeLive: { label: "Live node sprite", group: "Grid" },
  nodeDead: { label: "Dead node sprite", group: "Grid" },
  nodeIdLabel: { label: "NODE ID label", group: "Right" },
  nodeIdValue: { label: "VX-27-NODE-9A", group: "Right" },
  secureChannelLabel: { label: "SECURE CHANNEL", group: "Right" },
  secureChannelLock: { label: "Secure channel lock icon", group: "Right" },
  secureChannelBars: { label: "Signal bars", group: "Right" },
  rewardPreviewLabel: { label: "REWARD PREVIEW", group: "Right" },
  rewardsLabel: { label: "POTENTIAL REWARDS label", group: "Right" },
  rewardIcon1: { label: "Credits icon", group: "Right" },
  rewardLine1: { label: "+ 250 CREDITS", group: "Right" },
  rewardIcon2: { label: "Pistol mag icon", group: "Right" },
  rewardLine2: { label: "+ 1 PISTOL MAG", group: "Right" },
  rewardIcon3: { label: "Rifle mag icon", group: "Right" },
  rewardLine3: { label: "+ 1 RIFLE MAG", group: "Right" },
  rewardIcon4: { label: "Medkit icon", group: "Right" },
  rewardLine4: { label: "+ 1 MEDKIT", group: "Right" },
  rewardIcon5: { label: "Grenade icon", group: "Right" },
  rewardLine5: { label: "+ 1 GRENADE", group: "Right" },
  rewardIcon6: { label: "Flashbang icon", group: "Right" },
  rewardLine6: { label: "+ 1 FLASHBANG", group: "Right" },
  rewardIcon7: { label: "Rifle unlock icon", group: "Right" },
  rewardLine7: { label: "+ RIFLE UNLOCK", group: "Right" },
  footerMove: { label: "W A S D SELECT", group: "Footer" },
  footerRotate: { label: "E ROTATE NODE", group: "Footer" },
  footerConfirm: { label: "F CONFIRM", group: "Footer" },
  footerReset: { label: "R RESET", group: "Footer" },
  footerEndHack: { label: "H End Hack", group: "Footer" },
};

/** @type {ConsoleHackLayoutTuning} */
export const DEFAULT_CONSOLE_HACK_LAYOUT = {
  headerTitle: line(0.319, 0.054, 0.38, 0.042, {
    labelColor: "#0099ff",
    valueColor: "#00c3ff",
    accentColor: "#00bfff",
    fontScale: 1.45,
  }),
  headerSubtitle: line(0.278, 0.097, 0.46, 0.028, {
    labelColor: "#0099ff",
    valueColor: "#00c3ff",
    accentColor: "#b4ecff",
    fontScale: 0.75,
  }),
  statusLabel: line(0.037, 0.101, 0.12, 0.024, {
    labelColor: "#0099ff",
    fontScale: 1.2,
  }),
  statusValue: line(0.038, 0.142, 0.161, 0.032, {
    labelColor: "#ffffff",
    fontScale: 0.85,
  }),
  statusPulse: line(0.038, 0.176, 0.16, 0.02, {
    labelColor: "transparent",
    valueColor: "#00c3ff",
    accentColor: "#5ed4ff",
    fontScale: 1.35,
  }),
  objectiveLabel: line(0.038, 0.241, 0.12, 0.024, {
    labelColor: "#0295f7",
    fontScale: 1.15,
  }),
  objectiveLine1: line(0.038, 0.279, 0.14, 0.026, { fontScale: 0.75 }),
  objectiveLine2: line(0.038, 0.303, 0.192, 0.026, { fontScale: 0.75 }),
  objectiveCount: line(0.168, 0.347, 0.028, 0.026, {
    labelColor: "#0498fb",
    valueColor: "#00c3ff",
  }),
  rewardLabel: line(0.038, 0.416, 0.12, 0.024, {
    labelColor: "#0099ff",
    fontScale: 1.15,
  }),
  rewardTitle: line(0.082, 0.474, 0.096, 0.026, {
    labelColor: "#0498fb",
    valueColor: "#0498fb",
    fontScale: 0.85,
  }),
  rewardSub: line(0.082, 0.505, 0.113, 0.022, {
    labelColor: "#0099ff",
    valueColor: "#0498fb",
    fontScale: 0.55,
  }),
  timerLabel: line(0.038, 0.589, 0.17, 0.024, {
    labelColor: "#0099ff",
    fontScale: 1.15,
  }),
  timerIcon: line(0.037, 0.634, 0.037, 0.054, {
    labelColor: "#78c8ff",
    valueColor: "#00c3ff",
    fontScale: 1.65,
  }),
  timerValue: line(0.078, 0.643, 0.133, 0.034, {
    labelColor: "#0099ff",
    valueColor: "#00c3ff",
    fontScale: 2,
  }),
  progressLabel: line(0.038, 0.74, 0.12, 0.024, {
    labelColor: "#0099ff",
    fontScale: 1.1,
  }),
  progressBar: line(0.038, 0.782, 0.121, 0.046, { fontScale: 2.45 }),
  progressPct: line(0.169, 0.791, 0.034, 0.028),
  gridStart: line(0.225, 0.371, 0.09, 0.034),
  gridStartNode: line(0.214, 0.386, 0.108, 0.18, {
    labelColor: "transparent",
    valueColor: "transparent",
    accentColor: "transparent",
    fontScale: 1,
  }),
  gridReward: line(0.705, 0.344, 0.076, 0.09),
  gridRewardCache: line(0.693, 0.408, 0.105, 0.134, {
    labelColor: "transparent",
    valueColor: "transparent",
    accentColor: "transparent",
    fontScale: 1,
  }),
  gridArea: line(0.282, 0.145, 0.451, 0.662, {
    labelColor: "rgba(120, 200, 255, 0.35)",
    valueColor: "rgba(120, 200, 255, 0.18)",
    accentColor: "rgba(120, 200, 255, 0.55)",
    fontScale: 0.25,
    gridCols: 4,
    gridRows: 4,
  }),
  nodeLive: line(0, 0, 0.8424, 0.7751, {
    labelColor: "transparent",
    valueColor: "transparent",
    accentColor: "transparent",
    fontScale: 1,
    spriteCentered: true,
  }),
  nodeDead: line(0, 0, 0.8424, 0.7751, {
    labelColor: "transparent",
    valueColor: "transparent",
    accentColor: "transparent",
    fontScale: 0.9,
    spriteCentered: true,
  }),
  nodeIdLabel: line(0.818, 0.101, 0.12, 0.024, {
    labelColor: "#0099ff",
    fontScale: 1.15,
  }),
  nodeIdValue: line(0.818, 0.147, 0.14, 0.034, {
    labelColor: "#0099ff",
    valueColor: "#00c3ff",
    fontScale: 1.05,
  }),
  secureChannelLabel: line(0.866, 0.216, 0.101, 0.024, { fontScale: 0.75 }),
  secureChannelLock: line(0.815, 0.202, 0.053, 0.07, {
    labelColor: "#0099ff",
    valueColor: "#00c3ff",
    fontScale: 0.65,
  }),
  secureChannelBars: line(0.868, 0.248, 0.092, 0.022, {
    labelColor: "#78c8ff",
    valueColor: "#9ee8ff",
    accentColor: "#b4ecff",
    fontScale: 1,
  }),
  rewardPreviewLabel: line(0.818, 0.365, 0.14, 0.024, {
    labelColor: "#0099ff",
    fontScale: 1.15,
  }),
  rewardsLabel: line(0.819, 0.614, 0.159, 0.024, {
    labelColor: "#0099ff",
    fontScale: 1,
  }),
  rewardIcon1: line(0.812, 0.638, 0.044, 0.044, REWARD_ICON_COLORS),
  rewardLine1: line(0.854, 0.648, 0.155, 0.022, { fontScale: 0.74 }),
  rewardIcon2: line(0.812, 0.661, 0.044, 0.044, REWARD_ICON_COLORS),
  rewardLine2: line(0.854, 0.671, 0.155, 0.022, { fontScale: 0.74 }),
  rewardIcon3: line(0.812, 0.684, 0.044, 0.044, REWARD_ICON_COLORS),
  rewardLine3: line(0.854, 0.694, 0.155, 0.022, { fontScale: 0.74 }),
  rewardIcon4: line(0.812, 0.707, 0.044, 0.044, REWARD_ICON_COLORS),
  rewardLine4: line(0.854, 0.717, 0.155, 0.022, { fontScale: 0.74 }),
  rewardIcon5: line(0.812, 0.730, 0.044, 0.044, REWARD_ICON_COLORS),
  rewardLine5: line(0.854, 0.740, 0.155, 0.022, { fontScale: 0.74 }),
  rewardIcon6: line(0.812, 0.753, 0.044, 0.044, REWARD_ICON_COLORS),
  rewardLine6: line(0.854, 0.763, 0.155, 0.022, { fontScale: 0.74 }),
  rewardIcon7: line(0.812, 0.776, 0.044, 0.044, REWARD_ICON_COLORS),
  rewardLine7: line(0.854, 0.786, 0.155, 0.022, { fontScale: 0.74 }),
  footerMove: line(0.231, 0.847, 0.136, 0.03, { ...FOOTER_COLORS, fontScale: 1.05 }),
  footerRotate: line(0.346, 0.845, 0.11, 0.03, { ...FOOTER_COLORS, fontScale: 1.05 }),
  footerConfirm: line(0.415, 0.847, 0.11, 0.03, { ...FOOTER_COLORS, fontScale: 1.05 }),
  footerReset: line(0.56, 0.847, 0.11, 0.03, { ...FOOTER_COLORS, fontScale: 1.05 }),
  footerEndHack: line(0.699, 0.847, 0.12, 0.03, { ...FOOTER_COLORS, fontScale: 1.05 }),
};

/** @param {HackElementTune} r */
export function hackRectStyle(r) {
  return {
    left: `${r.x * 100}%`,
    top: `${r.y * 100}%`,
    width: `${r.w * 100}%`,
    height: `${r.h * 100}%`,
  };
}

/** @param {Partial<HackElementTune>} patch */
function normalizeElement(patch) {
  const base = { ...DEFAULT_COLORS, x: 0, y: 0, w: 0.1, h: 0.024 };
  const merged = { ...base, ...patch };
  if (merged.spriteCentered) {
    merged.x = clamp(merged.x, -0.5, 0.5);
    merged.y = clamp(merged.y, -0.5, 0.5);
  } else {
    merged.x = clamp(merged.x, 0, 1);
    merged.y = clamp(merged.y, 0, 1);
  }
  merged.w = clamp(merged.w, 0.008, 1);
  merged.h = clamp(merged.h, 0.008, 1);
  merged.fontScale = clamp(merged.fontScale, 0.25, 3);
  if (merged.gridCols != null) merged.gridCols = clamp(Math.round(merged.gridCols), 2, 12);
  if (merged.gridRows != null) merged.gridRows = clamp(Math.round(merged.gridRows), 2, 8);
  return merged;
}

/** @param {string} id */
export function isHackSpriteElement(id) {
  return id === "nodeLive" || id === "nodeDead";
}

/** START / reward cache flanking markers (frame-anchored sprites, not grid-cell templates). */
export function isHackGridMarkerElement(id) {
  return id === "gridStartNode" || id === "gridRewardCache";
}

/** @param {string} id */
export function isHackMarkerOrSpriteElement(id) {
  return isHackSpriteElement(id) || isHackGridMarkerElement(id);
}

/** @param {string} id */
export function isHackGridAreaElement(id) {
  return id === "gridArea";
}

/** @param {HackElementTune} gridArea */
export function getHackGridDimensions(gridArea) {
  return {
    cols: gridArea?.gridCols ?? 5,
    rows: gridArea?.gridRows ?? 3,
  };
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function purgeLegacyConsoleHackLayoutKeys() {
  if (typeof localStorage === "undefined") return;
  const remove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(LEGACY_CONSOLE_HACK_LAYOUT_PREFIX) && key !== CONSOLE_HACK_LAYOUT_KEY) {
      remove.push(key);
    }
  }
  for (const key of remove) localStorage.removeItem(key);
}

/** @param {ConsoleHackLayoutTuning} layout */
function migrateSpriteTemplatesToCellLocal(layout) {
  const gridArea = layout.gridArea;
  if (!gridArea) return layout;
  const { cols, rows } = getHackGridDimensions(gridArea);
  for (const id of ["nodeLive", "nodeDead"]) {
    const template = layout[id];
    if (!template || !isHackSpriteTemplateAbsolute(template, gridArea, cols, rows)) continue;
    layout[id] = normalizeElement({
      ...template,
      ...hackSpriteTemplateToCellLocal(template, gridArea, cols, rows),
    });
  }
  return layout;
}

/** @param {ConsoleHackLayoutTuning} layout */
function migrateSpriteTemplatesToCentered(layout) {
  for (const id of ["nodeLive", "nodeDead"]) {
    const template = layout[id];
    if (!template || !isHackSpriteTemplateTopLeftLocal(template)) continue;
    layout[id] = normalizeElement({
      ...template,
      ...hackSpriteTemplateToCentered(template),
      spriteCentered: true,
    });
  }
  return layout;
}

/** @param {ConsoleHackLayoutTuning} layout */
function syncSpriteTemplates(layout) {
  const live = layout.nodeLive;
  if (!live) return layout;
  layout.nodeDead = normalizeElement({
    ...layout.nodeDead,
    x: live.x,
    y: live.y,
    w: live.w,
    h: live.h,
    spriteCentered: true,
  });
  layout.nodeLive = normalizeElement({ ...live, spriteCentered: true });
  return layout;
}

/** @param {Record<string, Partial<HackElementTune>>} saved */
function mergeSavedLayout(saved) {
  const out = structuredClone(DEFAULT_CONSOLE_HACK_LAYOUT);
  for (const id of Object.keys(HACK_ELEMENT_META)) {
    if (saved[id]) out[id] = normalizeElement({ ...out[id], ...saved[id] });
  }
  return out;
}

/** @param {unknown} raw */
function parseStoredLayout(raw) {
  const parsed = JSON.parse(raw);
  if (parsed && typeof parsed === "object" && parsed.layout && typeof parsed.layout === "object") {
    return {
      schemaVersion: Number(parsed.schemaVersion) || 0,
      layout: /** @type {Record<string, Partial<HackElementTune>>} */ (parsed.layout),
    };
  }
  return {
    schemaVersion: 0,
    layout: /** @type {Record<string, Partial<HackElementTune>>} */ (parsed),
  };
}

function runLegacySpriteMigrations(layout) {
  migrateSpriteTemplatesToCellLocal(layout);
  migrateSpriteTemplatesToCentered(layout);
  syncSpriteTemplates(layout);
  return layout;
}

const BAKED_GRID_MARKER_IDS = [
  "gridStart",
  "gridStartNode",
  "gridReward",
  "gridRewardCache",
  "secureChannelLabel",
  "secureChannelBars",
];

/** @param {ConsoleHackLayoutTuning} layout */
function ensureGridMarkers(layout) {
  for (const id of ["gridStartNode", "gridRewardCache"]) {
    const el = layout[id];
    if (!el || el.w < 0.02 || el.h < 0.02) {
      layout[id] = structuredClone(DEFAULT_CONSOLE_HACK_LAYOUT[id]);
    }
  }
  return layout;
}

/** @param {ConsoleHackLayoutTuning} layout */
function applyBakedGridMarkerDefaults(layout) {
  for (const id of BAKED_GRID_MARKER_IDS) {
    layout[id] = structuredClone(DEFAULT_CONSOLE_HACK_LAYOUT[id]);
  }
  return layout;
}

/** @returns {ConsoleHackLayoutTuning} */
export function loadConsoleHackLayout() {
  const fallback = structuredClone(DEFAULT_CONSOLE_HACK_LAYOUT);
  try {
    const currentRaw = localStorage.getItem(CONSOLE_HACK_LAYOUT_KEY);
    const legacyRaw = currentRaw
      ? null
      : localStorage.getItem("fps-console-hack-layout-v21") ??
        localStorage.getItem("fps-console-hack-layout-v20") ??
        localStorage.getItem("fps-console-hack-layout-v19") ??
        localStorage.getItem("fps-console-hack-layout-v18");
    const raw = currentRaw ?? legacyRaw;
    if (!raw) {
      purgeLegacyConsoleHackLayoutKeys();
      return fallback;
    }

    const { schemaVersion, layout: saved } = parseStoredLayout(raw);
    let layout = mergeSavedLayout(saved);
    const needsMigration = legacyRaw != null || schemaVersion < LAYOUT_SCHEMA_VERSION;
    if (needsMigration) {
      if (schemaVersion < LAYOUT_SCHEMA_VERSION) {
        layout = structuredClone(DEFAULT_CONSOLE_HACK_LAYOUT);
      } else {
        layout = runLegacySpriteMigrations(layout);
        if (schemaVersion < 3) layout = ensureGridMarkers(layout);
        if (schemaVersion < 4) layout = applyBakedGridMarkerDefaults(layout);
      }
      saveConsoleHackLayout(layout);
    }
    purgeLegacyConsoleHackLayoutKeys();
    return layout;
  } catch {
    purgeLegacyConsoleHackLayoutKeys();
  }
  return fallback;
}

/** @param {ConsoleHackLayoutTuning} layout */
export function saveConsoleHackLayout(layout) {
  localStorage.setItem(
    CONSOLE_HACK_LAYOUT_KEY,
    JSON.stringify({
      schemaVersion: LAYOUT_SCHEMA_VERSION,
      layout,
    })
  );
}

/** @param {Record<string, Partial<HackElementTune>>} saved @returns {ConsoleHackLayoutTuning} */
export function applyConsoleHackLayoutFromObject(saved) {
  let layout = runLegacySpriteMigrations(mergeSavedLayout(saved));
  saveConsoleHackLayout(layout);
  return layout;
}

/** @param {string} json @returns {ConsoleHackLayoutTuning} */
export function applyConsoleHackLayoutFromJson(json) {
  const saved = JSON.parse(json);
  return applyConsoleHackLayoutFromObject(saved);
}

/** @param {ConsoleHackLayoutTuning} layout */
export function formatConsoleHackLayoutForCopy(layout) {
  const rounded = {};
  for (const id of Object.keys(HACK_ELEMENT_META)) {
    const el = layout[id] ?? DEFAULT_CONSOLE_HACK_LAYOUT[id];
    rounded[id] = {
      x: round4(el.x),
      y: round4(el.y),
      w: round4(el.w),
      h: round4(el.h),
      labelColor: el.labelColor,
      valueColor: el.valueColor,
      accentColor: el.accentColor,
      fontScale: round4(el.fontScale),
      ...(el.gridCols != null ? { gridCols: el.gridCols } : {}),
      ...(el.gridRows != null ? { gridRows: el.gridRows } : {}),
      ...(el.spriteCentered ? { spriteCentered: true } : {}),
    };
  }
  return JSON.stringify(rounded, null, 2);
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

export function loadConsoleHackTuneEnabled() {
  return localStorage.getItem(CONSOLE_HACK_TUNE_ENABLED_KEY) === "true";
}

export function saveConsoleHackTuneEnabled(enabled) {
  localStorage.setItem(CONSOLE_HACK_TUNE_ENABLED_KEY, String(enabled));
}

/** @returns {ConsoleHackLayoutTuning} */
export function resetConsoleHackLayout() {
  purgeLegacyConsoleHackLayoutKeys();
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(CONSOLE_HACK_LAYOUT_KEY);
  }
  const layout = structuredClone(DEFAULT_CONSOLE_HACK_LAYOUT);
  saveConsoleHackLayout(layout);
  return layout;
}

/** @param {ConsoleHackLayoutTuning} layout @param {string} id */
export function resetConsoleHackElement(layout, id) {
  if (!DEFAULT_CONSOLE_HACK_LAYOUT[id]) return layout;
  const next = structuredClone(layout);
  next[id] = structuredClone(DEFAULT_CONSOLE_HACK_LAYOUT[id]);
  saveConsoleHackLayout(next);
  return next;
}
