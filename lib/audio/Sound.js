import * as THREE from "three";

/**
 * Clips in public/sounds/.
 *   laser_shot.aac — rifle fire (AAC for Safari; .ogg fallback)
 *   grenade_*.aac — throw whoosh, floor impact, detonation
 *   body_hits/*.wav — ragdoll / death floor impacts
 *   pickup_cock.ogg — ammo + grenade collect
 *   pickup_hp.ogg — health collect
 *   oil_barrel_fire.aac — open-barrel fire (trimmed segment crossfade loop)
 *   hole_fall_death.aac — player cry when dropping through a floor hole
 *   player_death_*.aac — combat death vocals (player + enemies; random pick)
 *   enemy_hit_*.aac — bullet impact pain on targets + player hurt (fire, blast)
 *   hack_death.aac — NODE BREACH security node / hack failure buzz
 *   hack_connect.aac — NODE BREACH successful power node connection
 */
const CLIP_SOURCES = {
  laser_shot: ["/sounds/laser_shot.aac", "/sounds/laser_shot.ogg"],
  grenade_whoosh: "/sounds/grenade_whoosh.aac",
  grenade_floor_hit: "/sounds/grenade_floor_hit.aac",
  grenade_explosion: "/sounds/grenade_explosion.aac",
  grenade_countdown: "/sounds/grenade_countdown.aac",
  pickup_cock: "/sounds/pickup_cock.ogg",
  pickup_hp: "/sounds/pickup_hp.ogg",
  oil_barrel_fire: "/sounds/oil_barrel_fire.aac",
  hole_fall_death: "/sounds/hole_fall_death.aac",
  hack_death: "/sounds/hack_death.aac",
  hack_connect: "/sounds/hack_connect.aac",
};

const DEATH_VOCAL_URLS = [
  "/sounds/player_death.aac",
  "/sounds/player_death_02.aac",
  "/sounds/player_death_03.aac",
];

const ENEMY_HIT_URLS = [
  "/sounds/enemy_hit_01.aac",
  "/sounds/enemy_hit_02.aac",
  "/sounds/enemy_hit_03.aac",
  "/sounds/enemy_hit_04.aac",
];

/** Rapid-fire one-shots reuse voices — Safari chokes on dozens of new THREE.Audio per second. */
const POOLED_ONE_SHOT_KEYS = new Set(["laser_shot"]);
const FOOTSTEP_POOL_SIZE = 8;
const ONE_SHOT_POOL_SIZE = 8;

/** Full level within 3 m; quadratic fade 3→7 m, silent beyond 7 m. */
const OIL_BARREL_FIRE_FULL_DISTANCE = 3;
const OIL_BARREL_FIRE_MAX_DISTANCE = 7;
const OIL_BARREL_FIRE_BASE_VOLUME = 1.05;
/** Crossfade overlapped segments (hides wrap seam + AAC head/tail silence). */
const OIL_BARREL_FIRE_LOOP_XFADE = 1.15;
const OIL_BARREL_FIRE_LOOP_AMP_THRESHOLD = 0.003;
const OIL_BARREL_FIRE_LOOP_TRIM_PAD = 0.015;
/** Distance volume — release slower than attack so walk-away fades gently. */
const OIL_BARREL_FIRE_FADE_ATTACK = 8;
const OIL_BARREL_FIRE_FADE_RELEASE = 2.2;
const OIL_BARREL_FIRE_STOP_THRESHOLD = 0.004;
/** Keep looping briefly after leaving range so a single frame drop does not cut audio. */
const OIL_BARREL_FIRE_LEAVE_HANG = 0.55;

/** @param {number} current @param {number} target @param {number} dt @param {number} attack @param {number} release */
function smoothGain(current, target, dt, attack, release) {
  const rate = target > current ? attack : release;
  const k = 1 - Math.exp(-rate * dt);
  return current + (target - current) * k;
}

/**
 * Trim AAC decode head/tail silence so loop wrap is not a quiet gap.
 * @param {AudioBuffer} buffer
 */
function detectFireLoopTrim(buffer) {
  const threshold = OIL_BARREL_FIRE_LOOP_AMP_THRESHOLD;
  let first = buffer.length;
  let last = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < ch.length; i++) {
      if (Math.abs(ch[i]) > threshold) {
        if (i < first) first = i;
        if (i > last) last = i;
      }
    }
  }
  if (last <= first) {
    return { start: 0, end: buffer.duration, length: buffer.duration };
  }
  const sr = buffer.sampleRate;
  const start = Math.max(0, first / sr - OIL_BARREL_FIRE_LOOP_TRIM_PAD);
  const end = Math.min(buffer.duration, last / sr + OIL_BARREL_FIRE_LOOP_TRIM_PAD);
  const length = Math.max(0.75, end - start);
  return { start, end, length };
}

const FOOTSTEP_COUNT = 16;
const FOOTSTEP_URLS = Array.from(
  { length: FOOTSTEP_COUNT },
  (_, i) =>
    `/sounds/footsteps/footstep_gravel_${String(i + 1).padStart(2, "0")}.wav`,
);

const BODY_HIT_COUNT = 4;
const BODY_HIT_URLS = Array.from(
  { length: BODY_HIT_COUNT },
  (_, i) =>
    `/sounds/body_hits/body_hit_concrete_${String(i + 1).padStart(2, "0")}.wav`,
);

export const MUSIC_TRACKS = [
  { id: "galactic-drifter", label: "Galactic Drifter", url: "/music/galactic-drifter.mp3" },
  { id: "galactic-drifter-2", label: "Galactic Drifter II", url: "/music/galactic-drifter-2.mp3" },
  { id: "neon-gate-rush", label: "Neon Gate Rush", url: "/music/neon-gate-rush.mp3" },
];

export const MUSIC_TRACK_KEY = "fps-music-track";
export const DEFAULT_LOADING_TRACK_ID = MUSIC_TRACKS[0].id;
export const DEFAULT_LEVEL_TRACK_ID = MUSIC_TRACKS[1].id;
export const DEFAULT_HACK_TRACK_ID = "neon-gate-rush";
const DEFAULT_MUSIC_VOLUME = 0.65;
/** Level combat mix is muted during hack; volume restored when hack ends. */
const HACK_LEVEL_MUTE_VOLUME = 0;

const _listenerPos = new THREE.Vector3();

/** @param {number} dist */
function oilBarrelFireDistanceGain(dist) {
  if (dist >= OIL_BARREL_FIRE_MAX_DISTANCE) return 0;
  if (dist <= OIL_BARREL_FIRE_FULL_DISTANCE) return 1;
  const t =
    (dist - OIL_BARREL_FIRE_FULL_DISTANCE) /
    (OIL_BARREL_FIRE_MAX_DISTANCE - OIL_BARREL_FIRE_FULL_DISTANCE);
  return (1 - t) * (1 - t);
}

/** @param {number} dist */
function distanceVolumeScale(
  dist,
  { refDistance = 5, maxDistance = 42, minGain = 0.03 } = {},
) {
  if (dist >= maxDistance) return 0;
  if (dist <= refDistance) return 1;
  const t = (dist - refDistance) / (maxDistance - refDistance);
  return minGain + (1 - minGain) * (1 - t * t);
}

async function decodeClip(ctx, url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sound fetch failed: ${url}`);
  const data = await res.arrayBuffer();
  return ctx.decodeAudioData(data);
}

/** @param {string | string[]} sources */
async function loadClipWithFallback(ctx, sources) {
  const urls = Array.isArray(sources) ? sources : [sources];
  for (const url of urls) {
    try {
      return await decodeClip(ctx, url);
    } catch (err) {
      console.warn(`SFX failed to load (${url}):`, err);
    }
  }
  return null;
}

export function loadStoredLoadingTrackId() {
  if (typeof window === "undefined") return DEFAULT_LOADING_TRACK_ID;
  const stored = window.localStorage.getItem(MUSIC_TRACK_KEY);
  if (stored && MUSIC_TRACKS.some((track) => track.id === stored)) return stored;
  return DEFAULT_LOADING_TRACK_ID;
}

/** @deprecated Use loadStoredLoadingTrackId */
export function loadStoredMusicTrackId() {
  return loadStoredLoadingTrackId();
}

function tapMusicAnalysers(audio, displayAnalyser, beatAnalyser, listener) {
  const output = audio.getOutput?.() ?? audio.gain;
  output.disconnect();
  output.connect(displayAnalyser);
  output.connect(beatAnalyser);
  displayAnalyser.connect(listener.getInput());
}

function connectMusicDirect(audio, listener) {
  const output = audio.getOutput?.() ?? audio.gain;
  output.disconnect();
  output.connect(listener.getInput());
}

export function createSoundManager(camera) {
  const listener = new THREE.AudioListener();
  camera.add(listener);

  const buffers = new Map();
  /** @type {Map<string, THREE.Audio[]>} */
  const oneShotPools = new Map();
  /** @type {AudioBuffer[]} */
  const footstepBuffers = [];
  /** @type {THREE.Audio[]} */
  const footstepPool = [];
  let lastFootstepIndex = -1;
  /** @type {AudioBuffer[]} */
  const bodyHitBuffers = [];
  let lastBodyHitIndex = -1;
  /** @type {AudioBuffer[]} */
  const deathVocalBuffers = [];
  let lastPlayerDeathIndex = -1;
  let lastEnemyDeathIndex = -1;
  /** @type {AudioBuffer[]} */
  const enemyHitBuffers = [];
  let lastEnemyHitIndex = -1;
  /** One ouch at a time — rapid hits queue a single follow-up after the current clip ends. */
  let enemyHitVoice = {
    audio: null,
    pending: null,
    playing: false,
  };
  /** Player burn / blast pain — separate queue so enemy hit vocals are not stolen. */
  let playerHurtVoice = {
    audio: null,
    pending: null,
    playing: false,
  };
  let enemyHitLoadPromise = null;
  const musicBuffers = new Map();
  let preloadPromise = null;
  let loadingTrackId = loadStoredLoadingTrackId();
  let levelTrackId = DEFAULT_LEVEL_TRACK_ID;
  let loadingMusicAudio = null;
  let loadingAnalyser = null;
  let loadingBeatAnalyser = null;
  let levelMusicAudio = null;
  let hackMusicAudio = null;
  let musicPreloaded = false;
  let audioPreloaded = false;
  let grenadeCountdownDuration = 0;
  /** @type {[THREE.Audio | null, THREE.Audio | null]} */
  let oilBarrelFireLayers = [null, null];
  let oilBarrelFireActiveLayer = 0;
  let oilBarrelFireSegmentStart = 0;
  let oilBarrelFireCrossfadeActive = false;
  /** @type {{ start: number, end: number, length: number }} */
  let oilBarrelFireLoopTrim = { start: 0.18, end: 27, length: 26.8 };
  let oilBarrelFireGainSmooth = 0;
  let oilBarrelFireLastUpdate = 0;
  let oilBarrelFireOutOfRangeFor = 0;
  const _oilBarrelFirePos = new THREE.Vector3();

  function getMusicBuffer(trackId) {
    return musicBuffers.get(trackId) ?? musicBuffers.get(MUSIC_TRACKS[0].id);
  }

  function pickVariantIndex(buffersList, getLast, setLast) {
    const loadedIndices = [];
    for (let i = 0; i < buffersList.length; i++) {
      if (buffersList[i]) loadedIndices.push(i);
    }
    if (!loadedIndices.length) return -1;
    let pick = Math.floor(Math.random() * loadedIndices.length);
    const last = getLast();
    if (loadedIndices.length > 1) {
      let guard = 0;
      while (loadedIndices[pick] === last && guard++ < 8) {
        pick = Math.floor(Math.random() * loadedIndices.length);
      }
    }
    const index = loadedIndices[pick];
    setLast(index);
    return index;
  }

  async function preloadMusic() {
    if (musicPreloaded && musicBuffers.size > 0) return;
    const ctx = listener.context;
    await Promise.all(
      MUSIC_TRACKS.map(async (track) => {
        if (musicBuffers.has(track.id)) return;
        try {
          musicBuffers.set(track.id, await decodeClip(ctx, track.url));
        } catch (err) {
          console.error(`Music track failed to load (${track.label}):`, err);
        }
      })
    );
    musicPreloaded = musicBuffers.size > 0;
  }

  async function loadEnemyHitBuffers() {
    if (enemyHitLoadPromise) return enemyHitLoadPromise;
    const ctx = listener.context;
    enemyHitLoadPromise = Promise.all(
      ENEMY_HIT_URLS.map(async (url, index) => {
        if (enemyHitBuffers[index]) return;
        try {
          enemyHitBuffers[index] = await decodeClip(ctx, url);
        } catch (err) {
          console.warn(`Enemy hit SFX failed to load (${url}):`, err);
        }
      }),
    ).finally(() => {
      enemyHitLoadPromise = null;
    });
    return enemyHitLoadPromise;
  }

  async function preloadSfx() {
    const ctx = listener.context;
    if (!audioPreloaded) {
      await Promise.all(
        Object.entries(CLIP_SOURCES).map(async ([key, sources]) => {
          if (buffers.has(key)) return;
          const buffer = await loadClipWithFallback(ctx, sources);
          if (buffer) buffers.set(key, buffer);
        }),
      );
      await Promise.all(
        FOOTSTEP_URLS.map(async (url, index) => {
          if (footstepBuffers[index]) return;
          try {
            footstepBuffers[index] = await decodeClip(ctx, url);
          } catch (err) {
            console.warn(`Footstep failed to load (${url}):`, err);
          }
        }),
      );
      await Promise.all(
        BODY_HIT_URLS.map(async (url, index) => {
          if (bodyHitBuffers[index]) return;
          try {
            bodyHitBuffers[index] = await decodeClip(ctx, url);
          } catch (err) {
            console.warn(`Body hit failed to load (${url}):`, err);
          }
        }),
      );
      await Promise.all(
        DEATH_VOCAL_URLS.map(async (url, index) => {
          if (deathVocalBuffers[index]) return;
          try {
            deathVocalBuffers[index] = await decodeClip(ctx, url);
          } catch (err) {
            console.warn(`Death vocal SFX failed to load (${url}):`, err);
          }
        }),
      );
      audioPreloaded = true;
      grenadeCountdownDuration = buffers.get("grenade_countdown")?.duration ?? 0;
      const fireBuf = buffers.get("oil_barrel_fire");
      if (fireBuf) oilBarrelFireLoopTrim = detectFireLoopTrim(fireBuf);
    }
    await loadEnemyHitBuffers();
  }

  async function preload() {
    if (preloadPromise) return preloadPromise;
    preloadPromise = (async () => {
      await preloadMusic();
      await preloadSfx();
    })();
    return preloadPromise;
  }

  function resume() {
    const ctx = listener.context;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  function playPooledOneShot(key, buffer, volume) {
    let pool = oneShotPools.get(key);
    if (!pool) {
      pool = [];
      oneShotPools.set(key, pool);
    }

    let audio = pool.find((entry) => !entry.isPlaying);
    if (!audio) {
      if (pool.length < ONE_SHOT_POOL_SIZE) {
        audio = new THREE.Audio(listener);
        audio.setBuffer(buffer);
        pool.push(audio);
      } else {
        audio = pool[0];
        if (audio.isPlaying) audio.stop();
        audio.setBuffer(buffer);
      }
    }

    audio.setVolume(volume);
    audio.play();
  }

  function play(key, { volume = 1 } = {}) {
    resume();
    const buffer = buffers.get(key);
    if (!buffer) return;
    if (POOLED_ONE_SHOT_KEYS.has(key)) {
      playPooledOneShot(key, buffer, volume);
      return;
    }
    const audio = new THREE.Audio(listener);
    audio.setBuffer(buffer);
    audio.setVolume(volume);
    audio.play();
  }

  /**
   * @param {AudioBuffer | undefined | null} buffer
   * @param {THREE.Scene} scene
   * @param {THREE.Vector3} position
   * @param {{ volume?: number, refDistance?: number, maxDistance?: number, rolloffFactor?: number }} [opts]
   */
  function playWorldBuffer(buffer, scene, position, opts = {}) {
    resume();
    if (!buffer || !scene || !position) return;

    const {
      volume = 1,
      refDistance = 5,
      maxDistance = 42,
      rolloffFactor = 1.35,
      playbackRate = 1,
    } = opts;

    listener.getWorldPosition(_listenerPos);
    const dist = _listenerPos.distanceTo(position);
    const distGain = distanceVolumeScale(dist, { refDistance, maxDistance });
    const finalVolume = volume * distGain;
    if (finalVolume < 0.02) return;

    const holder = new THREE.Object3D();
    holder.position.copy(position);
    scene.add(holder);
    const audio = new THREE.PositionalAudio(listener);
    audio.setBuffer(buffer);
    audio.setVolume(finalVolume);
    audio.setRefDistance(refDistance);
    audio.setMaxDistance(maxDistance);
    audio.setRolloffFactor(rolloffFactor);
    if (typeof audio.setPlaybackRate === "function") {
      audio.setPlaybackRate(THREE.MathUtils.clamp(playbackRate, 0.5, 2.5));
    }
    holder.add(audio);
    audio.play();
    audio.onEnded = () => {
      holder.removeFromParent();
    };
  }

  function playWorldClip(key, scene, position, opts = {}) {
    playWorldBuffer(buffers.get(key), scene, position, opts);
  }

  function playGrenadeWhoosh({ volume = 0.78 } = {}) {
    play("grenade_whoosh", { volume });
  }

  function playHoleFallDeath({ volume = 0.92 } = {}) {
    play("hole_fall_death", { volume });
  }

  function playHoleFallDeathWorld(scene, position, { volume = 0.82 } = {}) {
    playWorldClip("hole_fall_death", scene, position, {
      volume,
      refDistance: 3.5,
      maxDistance: 40,
      rolloffFactor: 1.35,
      playbackRate: 0.94 + Math.random() * 0.12,
    });
  }

  function playPlayerDeath({ volume = 0.9 } = {}) {
    const index = pickVariantIndex(
      deathVocalBuffers,
      () => lastPlayerDeathIndex,
      (i) => {
        lastPlayerDeathIndex = i;
      },
    );
    if (index < 0) return;
    resume();
    const audio = new THREE.Audio(listener);
    audio.setBuffer(deathVocalBuffers[index]);
    audio.setVolume(volume);
    audio.play();
  }

  function playEnemyDeath(
    scene,
    position,
    { volume = 0.76, headshot = false, blast = false } = {},
  ) {
    const index = pickVariantIndex(
      deathVocalBuffers,
      () => lastEnemyDeathIndex,
      (i) => {
        lastEnemyDeathIndex = i;
      },
    );
    if (index < 0) return;
    const pitchJitter = 0.94 + Math.random() * 0.14;
    playWorldBuffer(deathVocalBuffers[index], scene, position, {
      volume: volume * (headshot ? 1.08 : blast ? 0.92 : 1),
      playbackRate: headshot ? pitchJitter * 1.04 : pitchJitter,
      refDistance: 3.5,
      maxDistance: 42,
      rolloffFactor: 1.35,
    });
  }

  function stopEnemyHitVoice() {
    if (enemyHitVoice.audio?.isPlaying) {
      enemyHitVoice.audio.stop();
    }
    enemyHitVoice = { audio: null, pending: null, playing: false };
  }

  function playEnemyHitVoiceNow(opts = {}) {
    const index = pickVariantIndex(
      enemyHitBuffers,
      () => lastEnemyHitIndex,
      (i) => {
        lastEnemyHitIndex = i;
      },
    );
    const buffer = index >= 0 ? enemyHitBuffers[index] : null;
    if (!buffer) {
      enemyHitVoice.pending = null;
      enemyHitVoice.playing = false;
      return false;
    }

    if (!enemyHitVoice.audio) {
      enemyHitVoice.audio = new THREE.Audio(listener);
    }

    const { volume = 0.88, headshot = false } = opts;
    const audio = enemyHitVoice.audio;
    if (audio.isPlaying) audio.stop();

    audio.setBuffer(buffer);
    audio.setVolume(volume * (headshot ? 1.05 : 1));
    if (typeof audio.setPlaybackRate === "function") {
      audio.setPlaybackRate(
        THREE.MathUtils.clamp(0.92 + Math.random() * 0.16, 0.5, 2.5),
      );
    }
    enemyHitVoice.playing = true;
    audio.onEnded = () => {
      enemyHitVoice.playing = false;
      const next = enemyHitVoice.pending;
      enemyHitVoice.pending = null;
      if (next) playEnemyHitVoiceNow(next);
    };
    audio.play();
    if (!audio.isPlaying) {
      enemyHitVoice.playing = false;
    }
    return true;
  }

  function playEnemyHit(
    _scene,
    _position,
    { volume = 0.88, headshot = false } = {},
  ) {
    resume();
    const opts = { volume, headshot };
    if (enemyHitVoice.playing) {
      enemyHitVoice.pending = opts;
      return;
    }
    if (enemyHitBuffers.some(Boolean)) {
      playEnemyHitVoiceNow(opts);
      return;
    }
    void loadEnemyHitBuffers().then(() => {
      if (enemyHitVoice.playing) {
        enemyHitVoice.pending = opts;
        return;
      }
      playEnemyHitVoiceNow(opts);
    });
  }

  function stopPlayerHurtVoice() {
    if (playerHurtVoice.audio?.isPlaying) {
      playerHurtVoice.audio.stop();
    }
    playerHurtVoice = { audio: null, pending: null, playing: false };
  }

  function playPlayerHurtVoiceNow({ volume = 0.82 } = {}) {
    const index = pickVariantIndex(
      enemyHitBuffers,
      () => lastEnemyHitIndex,
      (i) => {
        lastEnemyHitIndex = i;
      },
    );
    const buffer = index >= 0 ? enemyHitBuffers[index] : null;
    if (!buffer) {
      playerHurtVoice.pending = null;
      playerHurtVoice.playing = false;
      return false;
    }

    if (!playerHurtVoice.audio) {
      playerHurtVoice.audio = new THREE.Audio(listener);
    }

    const audio = playerHurtVoice.audio;
    if (audio.isPlaying) audio.stop();

    audio.setBuffer(buffer);
    audio.setVolume(volume);
    if (typeof audio.setPlaybackRate === "function") {
      audio.setPlaybackRate(
        THREE.MathUtils.clamp(0.9 + Math.random() * 0.14, 0.5, 2.5),
      );
    }
    playerHurtVoice.playing = true;
    audio.onEnded = () => {
      playerHurtVoice.playing = false;
      const next = playerHurtVoice.pending;
      playerHurtVoice.pending = null;
      if (next) playPlayerHurtVoiceNow(next);
    };
    audio.play();
    if (!audio.isPlaying) {
      playerHurtVoice.playing = false;
    }
    return true;
  }

  /** Player pain vocal (fire, grenades, etc.) — same clips as enemy hits, non-positional. */
  function playPlayerHurt({ volume = 0.82 } = {}) {
    resume();
    const opts = { volume };
    if (playerHurtVoice.playing) {
      playerHurtVoice.pending = opts;
      return;
    }
    if (enemyHitBuffers.some(Boolean)) {
      playPlayerHurtVoiceNow(opts);
      return;
    }
    void loadEnemyHitBuffers().then(() => {
      if (playerHurtVoice.playing) {
        playerHurtVoice.pending = opts;
        return;
      }
      playPlayerHurtVoiceNow(opts);
    });
  }

  function playGrenadeFloorHit(scene, position, { volume = 0.62, impact = 1 } = {}) {
    playWorldClip("grenade_floor_hit", scene, position, {
      volume: volume * THREE.MathUtils.clamp(0.45 + impact * 0.55, 0.35, 1),
      refDistance: 4.5,
      maxDistance: 40,
      rolloffFactor: 1.4,
    });
  }

  function playGrenadeExplosion(scene, position, { volume = 0.88 } = {}) {
    playWorldClip("grenade_explosion", scene, position, {
      volume,
      refDistance: 7,
      maxDistance: 55,
      rolloffFactor: 1.25,
    });
  }

  function getGrenadeCountdownDuration() {
    return grenadeCountdownDuration;
  }

  function playGrenadeCountdown(scene, position, { volume = 0.72, playbackRate = 1 } = {}) {
    playWorldBuffer(buffers.get("grenade_countdown"), scene, position, {
      volume,
      playbackRate,
      refDistance: 5,
      maxDistance: 48,
      rolloffFactor: 1.3,
    });
  }

  function playBodyFloorHit(scene, position, { volume = 0.82, impact = 1 } = {}) {
    const index = pickVariantIndex(
      bodyHitBuffers,
      () => lastBodyHitIndex,
      (i) => { lastBodyHitIndex = i; },
    );
    if (index < 0) return;
    playWorldBuffer(bodyHitBuffers[index], scene, position, {
      volume: volume * THREE.MathUtils.clamp(0.45 + impact * 0.55, 0.35, 1),
      refDistance: 4,
      maxDistance: 38,
      rolloffFactor: 1.45,
    });
  }

  function playSupplyPickup({ volume = 0.65 } = {}) {
    play("pickup_cock", { volume });
  }

  function playHpPickup({ volume = 0.6 } = {}) {
    play("pickup_hp", { volume });
  }

  function playHackDeath({ volume = 0.85 } = {}) {
    play("hack_death", { volume });
  }

  function playHackConnect({ volume = 0.72 } = {}) {
    play("hack_connect", { volume });
  }

  function stopOilBarrelFire() {
    for (const audio of oilBarrelFireLayers) {
      if (audio?.isPlaying) audio.stop();
    }
    oilBarrelFireLayers = [null, null];
    oilBarrelFireActiveLayer = 0;
    oilBarrelFireSegmentStart = 0;
    oilBarrelFireCrossfadeActive = false;
    oilBarrelFireGainSmooth = 0;
    oilBarrelFireLastUpdate = 0;
    oilBarrelFireOutOfRangeFor = 0;
  }

  /**
   * @param {number} index
   * @param {AudioBuffer} buffer
   */
  function ensureOilBarrelFireLayer(index, buffer) {
    if (!oilBarrelFireLayers[index]) {
      const audio = new THREE.Audio(listener);
      audio.setBuffer(buffer);
      audio.setLoop(false);
      oilBarrelFireLayers[index] = audio;
    }
    return oilBarrelFireLayers[index];
  }

  /**
   * @param {number} index
   * @param {AudioBuffer} buffer
   * @param {number} volume
   */
  function playOilBarrelFireSegment(index, buffer, volume) {
    const trim = oilBarrelFireLoopTrim;
    const audio = ensureOilBarrelFireLayer(index, buffer);
    if (audio.isPlaying) audio.stop();
    audio.offset = trim.start;
    audio.duration = trim.length;
    audio.setLoop(false);
    audio.setVolume(volume);
    audio.play();
  }

  /** Overlap two trimmed segments; crossfade before each ends (no native loop wrap). */
  function tickOilBarrelFireLoop(buffer, masterVolume) {
    resume();
    const ctx = listener.context;
    const trim =
      oilBarrelFireLoopTrim.length > 0
        ? oilBarrelFireLoopTrim
        : detectFireLoopTrim(buffer);
    oilBarrelFireLoopTrim = trim;

    const segmentLen = trim.length;
    const xf = Math.min(OIL_BARREL_FIRE_LOOP_XFADE, segmentLen * 0.28);
    const crossAt = segmentLen - xf;

    ensureOilBarrelFireLayer(0, buffer);
    ensureOilBarrelFireLayer(1, buffer);
    const activeIdx = oilBarrelFireActiveLayer;
    const nextIdx = 1 - activeIdx;
    const active = oilBarrelFireLayers[activeIdx];
    const next = oilBarrelFireLayers[nextIdx];
    const elapsed = ctx.currentTime - oilBarrelFireSegmentStart;

    // Active segment ended — promote crossfaded layer (never restart over the incoming one).
    if (!active?.isPlaying && next?.isPlaying) {
      oilBarrelFireActiveLayer = nextIdx;
      oilBarrelFireSegmentStart = ctx.currentTime - xf;
      oilBarrelFireCrossfadeActive = false;
      next.setVolume(masterVolume);
      return;
    }

    if (!active?.isPlaying) {
      playOilBarrelFireSegment(activeIdx, buffer, masterVolume);
      oilBarrelFireSegmentStart = ctx.currentTime;
      oilBarrelFireCrossfadeActive = false;
      if (next?.isPlaying) next.stop();
      return;
    }

    if (elapsed >= crossAt) {
      if (!next?.isPlaying) {
        playOilBarrelFireSegment(nextIdx, buffer, 0);
        oilBarrelFireCrossfadeActive = true;
      }
      const t = THREE.MathUtils.clamp((elapsed - crossAt) / xf, 0, 1);
      active.setVolume(masterVolume * (1 - t));
      next.setVolume(masterVolume * t);
      return;
    }

    active.setVolume(masterVolume);
    if (next?.isPlaying && !oilBarrelFireCrossfadeActive) {
      next.stop();
    }
  }

  /**
   * Looping furnace/fire SFX while barrels burn; volume follows nearest visible flame.
   * @param {THREE.Object3D[]} [fireLights] Pre-indexed fire rig nodes from {@link buildOilBarrelRuntimeIndex}.
   * @param {boolean} [enabled]
   */
  function updateOilBarrelFire(fireLights, enabled = true) {
    const now = performance.now();
    const dt = oilBarrelFireLastUpdate
      ? Math.min((now - oilBarrelFireLastUpdate) / 1000, 0.05)
      : 1 / 60;
    oilBarrelFireLastUpdate = now;

    if (!enabled) {
      stopOilBarrelFire();
      return;
    }
    const buffer = buffers.get("oil_barrel_fire");
    if (!buffer || !fireLights?.length) {
      stopOilBarrelFire();
      return;
    }

    listener.getWorldPosition(_listenerPos);
    let bestGain = 0;
    for (let i = 0; i < fireLights.length; i += 1) {
      const fireLight = fireLights[i];
      if (!fireLight) continue;
      fireLight.getWorldPosition(_oilBarrelFirePos);
      const dist = _listenerPos.distanceTo(_oilBarrelFirePos);
      const gain = oilBarrelFireDistanceGain(dist);
      if (gain > bestGain) bestGain = gain;
    }

    if (bestGain > 0) {
      oilBarrelFireOutOfRangeFor = 0;
    } else {
      oilBarrelFireOutOfRangeFor += dt;
    }

    oilBarrelFireGainSmooth = smoothGain(
      oilBarrelFireGainSmooth,
      bestGain,
      dt,
      OIL_BARREL_FIRE_FADE_ATTACK,
      OIL_BARREL_FIRE_FADE_RELEASE
    );

    if (
      oilBarrelFireGainSmooth <= OIL_BARREL_FIRE_STOP_THRESHOLD &&
      oilBarrelFireOutOfRangeFor >= OIL_BARREL_FIRE_LEAVE_HANG
    ) {
      stopOilBarrelFire();
      return;
    }

    if (
      oilBarrelFireGainSmooth > OIL_BARREL_FIRE_STOP_THRESHOLD ||
      oilBarrelFireLayers[0] ||
      oilBarrelFireLayers[1]
    ) {
      tickOilBarrelFireLoop(
        buffer,
        OIL_BARREL_FIRE_BASE_VOLUME * oilBarrelFireGainSmooth
      );
    }
  }

  /**
   * @param {{ volume?: number, playbackRate?: number }} [opts]
   */
  function playFootstep({ volume = 0.52, playbackRate = 1 } = {}) {
    resume();
    const index = pickVariantIndex(
      footstepBuffers,
      () => lastFootstepIndex,
      (i) => {
        lastFootstepIndex = i;
      },
    );
    if (index < 0) return;
    const buffer = footstepBuffers[index];
    if (!buffer) return;

    let audio = footstepPool.find((entry) => !entry.isPlaying);
    if (!audio) {
      if (footstepPool.length < FOOTSTEP_POOL_SIZE) {
        audio = new THREE.Audio(listener);
        footstepPool.push(audio);
      } else {
        audio = footstepPool[0];
        if (audio.isPlaying) audio.stop();
      }
    }

    audio.setBuffer(buffer);
    audio.setVolume(volume);
    if (typeof audio.setPlaybackRate === "function") {
      audio.setPlaybackRate(
        THREE.MathUtils.clamp(playbackRate, 0.5, 2),
      );
    }
    audio.play();
  }

  function startLoadingMusic({ trackId = loadingTrackId, volume = DEFAULT_MUSIC_VOLUME } = {}) {
    resume();
    if (trackId) loadingTrackId = trackId;
    const buffer = getMusicBuffer(loadingTrackId);
    if (!buffer) return;
    if (loadingMusicAudio?.isPlaying) return;

    const ctx = listener.context;
    loadingAnalyser = ctx.createAnalyser();
    loadingAnalyser.fftSize = 512;
    loadingAnalyser.smoothingTimeConstant = 0.82;
    loadingBeatAnalyser = ctx.createAnalyser();
    loadingBeatAnalyser.fftSize = 512;
    loadingBeatAnalyser.smoothingTimeConstant = 0.28;

    loadingMusicAudio = new THREE.Audio(listener);
    loadingMusicAudio.setBuffer(buffer);
    loadingMusicAudio.setLoop(true);
    loadingMusicAudio.setVolume(volume);
    tapMusicAnalysers(loadingMusicAudio, loadingAnalyser, loadingBeatAnalyser, listener);
    loadingMusicAudio.play();
  }

  function stopLoadingMusic() {
    if (loadingMusicAudio?.isPlaying) loadingMusicAudio.stop();
    loadingMusicAudio = null;
    loadingAnalyser = null;
    loadingBeatAnalyser = null;
  }

  function setLoadingTrack(trackId) {
    if (!musicBuffers.has(trackId)) return;
    const wasPlaying = loadingMusicAudio?.isPlaying;
    loadingTrackId = trackId;
    if (wasPlaying) {
      stopLoadingMusic();
      startLoadingMusic({ trackId });
    }
  }

  function startLevelMusic({ trackId = levelTrackId, volume = DEFAULT_MUSIC_VOLUME } = {}) {
    resume();
    if (trackId) levelTrackId = trackId;
    const buffer = getMusicBuffer(levelTrackId);
    if (!buffer) return;
    if (levelMusicAudio?.isPlaying) return;

    levelMusicAudio = new THREE.Audio(listener);
    levelMusicAudio.setBuffer(buffer);
    levelMusicAudio.setLoop(true);
    levelMusicAudio.setVolume(volume);
    connectMusicDirect(levelMusicAudio, listener);
    levelMusicAudio.play();
  }

  function stopLevelMusic() {
    if (levelMusicAudio?.isPlaying) levelMusicAudio.stop();
    levelMusicAudio = null;
  }

  function muteLevelMusicForHack() {
    if (levelMusicAudio?.isPlaying) {
      levelMusicAudio.setVolume(HACK_LEVEL_MUTE_VOLUME);
    }
  }

  function restoreLevelMusicVolume() {
    if (levelMusicAudio?.isPlaying) {
      levelMusicAudio.setVolume(DEFAULT_MUSIC_VOLUME);
    }
  }

  function startHackMusic({
    trackId = DEFAULT_HACK_TRACK_ID,
    volume = DEFAULT_MUSIC_VOLUME,
  } = {}) {
    resume();
    muteLevelMusicForHack();
    const buffer = getMusicBuffer(trackId);
    if (!buffer) return;
    if (hackMusicAudio?.isPlaying) return;

    hackMusicAudio = new THREE.Audio(listener);
    hackMusicAudio.setBuffer(buffer);
    hackMusicAudio.setLoop(true);
    hackMusicAudio.setVolume(volume);
    connectMusicDirect(hackMusicAudio, listener);
    hackMusicAudio.play();
  }

  function stopHackMusic() {
    if (hackMusicAudio?.isPlaying) hackMusicAudio.stop();
    hackMusicAudio = null;
    restoreLevelMusicVolume();
  }

  function isHackMusicPlaying() {
    return !!(hackMusicAudio?.isPlaying);
  }

  function getLoadingAnalyser() {
    return loadingAnalyser;
  }

  function getLoadingBeatAnalyser() {
    return loadingBeatAnalyser;
  }

  function isMusicPreloaded() {
    return musicPreloaded;
  }

  function isAudioPreloaded() {
    return audioPreloaded;
  }

  function isLoadingMusicPlaying() {
    return !!(loadingMusicAudio?.isPlaying);
  }

  function dispose() {
    stopOilBarrelFire();
    stopLoadingMusic();
    stopLevelMusic();
    stopHackMusic();
    camera.remove(listener);
    buffers.clear();
    oneShotPools.clear();
    footstepPool.length = 0;
    footstepBuffers.length = 0;
    lastFootstepIndex = -1;
    bodyHitBuffers.length = 0;
    lastBodyHitIndex = -1;
    deathVocalBuffers.length = 0;
    lastPlayerDeathIndex = -1;
    lastEnemyDeathIndex = -1;
    enemyHitBuffers.length = 0;
    lastEnemyHitIndex = -1;
    stopEnemyHitVoice();
    stopPlayerHurtVoice();
    musicBuffers.clear();
    preloadPromise = null;
    audioPreloaded = false;
    musicPreloaded = false;
  }

  return {
    preload,
    preloadMusic,
    preloadSfx,
    resume,
    play,
    playGrenadeWhoosh,
    playHoleFallDeath,
    playHoleFallDeathWorld,
    playPlayerDeath,
    playEnemyDeath,
    playEnemyHit,
    playPlayerHurt,
    playGrenadeFloorHit,
    playGrenadeExplosion,
    playGrenadeCountdown,
    getGrenadeCountdownDuration,
    playBodyFloorHit,
    playSupplyPickup,
    playHpPickup,
    playHackDeath,
    playHackConnect,
    playFootstep,
    updateOilBarrelFire,
    stopOilBarrelFire,
    startLoadingMusic,
    stopLoadingMusic,
    setLoadingTrack,
    startLevelMusic,
    stopLevelMusic,
    startHackMusic,
    stopHackMusic,
    isHackMusicPlaying,
    getLoadingAnalyser,
    getLoadingBeatAnalyser,
    isMusicPreloaded,
    isAudioPreloaded,
    isLoadingMusicPlaying,
    dispose,
  };
}
