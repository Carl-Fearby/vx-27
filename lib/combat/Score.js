export const BASE_KILL_SCORE = 100;
export const HIT_SCORE_FACTOR = 2;
export const MAX_HIT_SCORE_PER_TARGET = 60;

export const SCORE_ZONES = {
  head: {
    label: "HEADSHOT",
    killBonus: 150,
    popup: "HEADSHOT",
  },
  neck: {
    label: "NECK SHOT",
    killBonus: 75,
    popup: "CRITICAL",
    killPopup: "CRITICAL KILL",
  },
  upper_chest: {
    label: "UPPER CHEST",
    killBonus: 45,
    popup: "VITAL HIT",
    killPopup: "VITAL KILL",
  },
  lower_chest: {
    label: "LOWER CHEST",
    killBonus: 30,
    popup: "CHEST HIT",
    killPopup: "BODY KILL",
  },
  stomach: {
    label: "STOMACH",
    killBonus: 20,
    popup: "BODY HIT",
    killPopup: "BODY KILL",
  },
  pelvis: {
    label: "PELVIS",
    killBonus: 15,
    popup: "BODY HIT",
    killPopup: "BODY KILL",
  },
  thigh: {
    label: "THIGH",
    killBonus: 10,
    popup: "LEG HIT",
  },
  knee: {
    label: "KNEE",
    killBonus: 15,
    popup: "LEG BREAK",
    killPopup: "LEG BREAK",
  },
  lower_leg: {
    label: "LOWER LEG",
    killBonus: 5,
    popup: "LEG HIT",
  },
  foot: {
    label: "FOOT",
    killBonus: 0,
    popup: "FOOT HIT",
    killPopup: "DISRESPECTFUL",
  },
  arm: {
    label: "ARM",
    killBonus: 5,
    popup: "ARM HIT",
    killPopup: "ARM KILL",
  },
  body: {
    label: "BODY",
    killBonus: 0,
    popup: "BODY HIT",
    killPopup: "BODY KILL",
  },
  grenade: {
    label: "GRENADE",
    killBonus: 75,
    popup: "EXPLOSIVE HIT",
    killPopup: "BLAST KILL",
  },
};

/** Zone-specific kill callouts — short labels, no score numbers. */
const KILL_ZONE_CALLOUTS = {
  head: "HEADSHOT",
  neck: "CRITICAL",
  upper_chest: "VITAL KILL",
  lower_chest: "CHEST KILL",
  stomach: "BODY KILL",
  pelvis: "BODY KILL",
  thigh: "LEG KILL",
  knee: "LEG BREAK",
  lower_leg: "LEG KILL",
  foot: "DISRESPECT",
  arm: "ARM KILL",
  grenade: "BLAST KILL",
};

/** Generic pool when the finishing blow is messy or unclassified. */
export const GENERIC_KILL_CALLOUTS = [
  "FATAL KILL",
  "HOSTILE DOWN",
  "CONFIRMED KILL",
  "NEUTRALIZED",
  "EXECUTION",
  "CLEAN KILL",
  "ELIMINATED",
  "LETHAL",
  "FRAGGED",
  "TERMED",
];

/**
 * Short on-screen label for an enemy kill (no point values).
 * @param {string} zone
 * @param {number} [salt] Stable pick for generic callouts (e.g. mesh.id).
 */
export function getKillCallout(zone, salt = 0) {
  const specific = KILL_ZONE_CALLOUTS[zone];
  if (specific) return specific;
  const pool = GENERIC_KILL_CALLOUTS;
  return pool[Math.abs(salt) % pool.length];
}

/** e.g. "HEADSHOT +310" — label first, points after. */
export function formatKillCallout(zone, points, salt = 0) {
  const label = getKillCallout(zone, salt);
  const pts = Math.max(0, Math.round(points));
  return pts > 0 ? `${label} +${pts}` : label;
}

/** Clear per-target hit-score cap when a target respawns. */
export function resetTargetScoreState(mesh) {
  if (!mesh?.userData) return;
  mesh.userData.scoreState = {
    hitScoreAwarded: 0,
    totalScoreAwarded: 0,
  };
}

/**
 * Award combat score for a hit or kill. Damage and kill bonus are separate:
 * damage drives hitScore (capped per target); killScore rewards finishing
 * the enemy with zone-based precision bonuses.
 *
 * @param {THREE.Mesh} mesh
 * @param {{ zone?: string, damage?: number, killed?: boolean }} hitResult
 */
export function applyCombatScore(mesh, hitResult) {
  const {
    zone = "body",
    damage = 0,
    killed = false,
  } = hitResult;

  if (!mesh.userData.scoreState) {
    resetTargetScoreState(mesh);
  }

  const scoreState = mesh.userData.scoreState;
  const scoreZone = SCORE_ZONES[zone] ?? SCORE_ZONES.body;

  let score = 0;
  const events = [];

  const rawHitScore = Math.round(damage * HIT_SCORE_FACTOR);
  const remainingHitScore =
    MAX_HIT_SCORE_PER_TARGET - scoreState.hitScoreAwarded;
  const hitScore = Math.max(0, Math.min(rawHitScore, remainingHitScore));

  if (hitScore > 0) {
    score += hitScore;
    scoreState.hitScoreAwarded += hitScore;
    events.push({
      type: "hit",
      zone,
      label: scoreZone.popup,
      points: hitScore,
    });
  }

  if (killed) {
    const killScore = BASE_KILL_SCORE + scoreZone.killBonus;
    score += killScore;
    events.push({
      type: "kill",
      zone,
      label: scoreZone.killPopup ?? scoreZone.label,
      points: killScore,
    });
  }

  scoreState.totalScoreAwarded += score;

  return {
    score,
    events,
    totalTargetScore: scoreState.totalScoreAwarded,
  };
}
