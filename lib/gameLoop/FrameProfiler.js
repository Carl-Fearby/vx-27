const PROFILER_KEYS = ["fps-frame-profiler", "fps-frame-hitch-profiler"];
const ENABLE_CHECK_INTERVAL_FRAMES = 60;
const REPORT_SAMPLE_COUNT = 300;
const HITCH_MS = 30;
const REPORT_P95_MS = 18;

function readProfilerEnabled() {
  if (typeof localStorage === "undefined") return false;
  return PROFILER_KEYS.some((key) => localStorage.getItem(key) === "true");
}

function percentile(sorted, pct) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * pct) - 1)
  );
  return sorted[index];
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

function fmt(n) {
  return `${n.toFixed(2)}ms`;
}

function createFrameProfiler() {
  let enabled = false;
  let frameIndex = 0;
  let frameStart = 0;
  let phaseStart = 0;
  /** @type {Map<string, number[]>} */
  const samples = new Map();

  function refreshEnabled() {
    enabled = readProfilerEnabled();
    if (!enabled) {
      samples.clear();
    }
  }

  function pushSample(name, ms) {
    let list = samples.get(name);
    if (!list) {
      list = [];
      samples.set(name, list);
    }
    list.push(ms);
  }

  function resetSamples() {
    for (const list of samples.values()) list.length = 0;
  }

  function maybeReport() {
    const totals = samples.get("total");
    if (!totals || totals.length < REPORT_SAMPLE_COUNT) return;

    const totalStats = summarize(totals);
    const hitchCount = totals.reduce((acc, ms) => acc + (ms >= HITCH_MS ? 1 : 0), 0);
    if (totalStats.p95 < REPORT_P95_MS && totalStats.max < HITCH_MS) {
      resetSamples();
      return;
    }

    const rows = [...samples.entries()]
      .filter(([name]) => name !== "total")
      .map(([phase, values]) => {
        const stats = summarize(values);
        return {
          phase,
          p95: fmt(stats.p95),
          max: fmt(stats.max),
        };
      })
      .sort((a, b) => parseFloat(b.max) - parseFloat(a.max));

    console.groupCollapsed(
      `[game-loop-profiler] ${totals.length} frames, total p95 ${fmt(totalStats.p95)}, max ${fmt(totalStats.max)}, hitches ${hitchCount}`
    );
    console.table(rows);
    console.groupEnd();
    resetSamples();
  }

  function begin() {
    frameIndex += 1;
    if (frameIndex === 1 || frameIndex % ENABLE_CHECK_INTERVAL_FRAMES === 0) {
      refreshEnabled();
    }
    if (!enabled) return null;
    frameStart = performance.now();
    phaseStart = frameStart;
    return api;
  }

  const api = {
    mark(name) {
      const now = performance.now();
      pushSample(name, now - phaseStart);
      phaseStart = now;
    },
    end(name = "render") {
      api.mark(name);
      pushSample("total", performance.now() - frameStart);
      maybeReport();
    },
  };

  return { begin };
}

/** @param {import("./gameLoopContext.js").GameLoopContext} ctx */
export function startFrameProfile(ctx) {
  if (!ctx.frameProfiler) ctx.frameProfiler = createFrameProfiler();
  return ctx.frameProfiler.begin();
}
