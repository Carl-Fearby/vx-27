/** One RAF loop; at most one WebGL credits preview renders per frame. */

const entries = new Map();
let rafId = 0;
let globalPaused = false;

export function setCreditsPreviewPaused(paused) {
  globalPaused = paused;
}

function tick() {
  rafId = requestAnimationFrame(tick);
  if (globalPaused) return;

  let best = null;
  let bestPriority = Infinity;

  for (const entry of entries.values()) {
    if (!entry.wantsRender) continue;
    const priority = entry.getPriority();
    if (priority < bestPriority) {
      bestPriority = priority;
      best = entry;
    }
  }

  if (best) best.render();
}

function ensureLoop() {
  if (!rafId) rafId = requestAnimationFrame(tick);
}

function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

export function registerCreditsPreview(id, { render, getPriority }) {
  entries.set(id, {
    render,
    getPriority,
    wantsRender: false,
  });
  ensureLoop();

  return {
    setWantsRender(wantsRender) {
      const entry = entries.get(id);
      if (entry) entry.wantsRender = wantsRender;
    },
    dispose() {
      entries.delete(id);
      if (entries.size === 0) stopLoop();
    },
  };
}

/** Distance from viewport vertical center — lower wins the single render slot. */
export function creditsPreviewPriorityFromHost(host) {
  if (!host) return Infinity;
  const rect = host.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > window.innerHeight) return Infinity;
  const centerY = rect.top + rect.height * 0.5;
  return Math.abs(centerY - window.innerHeight * 0.5);
}
