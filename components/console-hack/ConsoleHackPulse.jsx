import { memo } from "react";

/**
 * @param {number} seed
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

/** @param {number} count */
function buildStatusNoiseDots(count) {
  const dots = [];
  for (let i = 0; i < count; i++) {
    const rand = mulberry32(0x9e37 + i * 17);
    dots.push({
      variant: Math.floor(rand() * 4),
      delay: rand() * 1.4,
      duration: 0.07 + rand() * 0.22,
      idle: 0.03 + rand() * 0.18,
      bright: 0.55 + rand() * 0.45,
    });
  }
  return dots;
}

/** @param {number} count */
function buildSecureBarLevels(count) {
  const rand = mulberry32(0x5ec0de);
  const levels = [];
  for (let i = 0; i < count; i++) {
    const wave =
      0.34 +
      0.28 * Math.sin(i * 0.72) +
      0.18 * Math.sin(i * 1.55 + 0.8) +
      0.12 * Math.sin(i * 2.35 + 2.1);
    const jitter = rand() * 0.22;
    levels.push(Math.min(0.98, Math.max(0.16, wave + jitter - 0.1)));
  }
  return levels;
}

const STATUS_NOISE_DOTS = buildStatusNoiseDots(44);
const SECURE_BAR_COUNT = 28;
const SECURE_BAR_LEVELS = buildSecureBarLevels(SECURE_BAR_COUNT);

export const HackStatusPulse = memo(function HackStatusPulse({ className = "", animate = true }) {
  return (
    <span
      className={["consoleHackStatusPulse", animate ? "consoleHackStatusPulse--live" : "", className]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {STATUS_NOISE_DOTS.map((dot, i) => (
        <span
          key={i}
          className={[
            "consoleHackStatusPulse__dot",
            `consoleHackStatusPulse__dot--v${dot.variant}`,
          ].join(" ")}
          style={{
            "--noise-delay": `${dot.delay}s`,
            "--noise-dur": `${dot.duration}s`,
            "--noise-idle": String(dot.idle),
            "--noise-bright": String(dot.bright),
          }}
        />
      ))}
    </span>
  );
});

export const HackSecureChannelBars = memo(function HackSecureChannelBars({
  className = "",
  animate = true,
}) {
  return (
    <span
      className={["consoleHackSecureBars", animate ? "consoleHackSecureBars--live" : "", className]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {SECURE_BAR_LEVELS.map((level, i) => (
        <span
          key={i}
          className="consoleHackSecureBars__bar"
          style={{
            "--bar-level": String(level),
            "--bar-delay": `${(i % 7) * 0.018 + (i % 3) * 0.011}s`,
            "--bar-dur": `${0.14 + (i % 5) * 0.035 + (i % 2) * 0.02}s`,
            "--bar-min": String(Math.max(0.12, level * 0.42)),
          }}
        />
      ))}
    </span>
  );
});
