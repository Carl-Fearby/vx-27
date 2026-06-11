/**
 * @typedef {Object} GameLoopContext
 * @property {() => boolean} isDisposed
 * @property {THREE.Scene} scene
 * @property {object} level
 * @property {THREE.PerspectiveCamera} camera
 * @property {import("@/lib/player/PlayerController.js").PlayerController} player
 * @property {import("@/lib/player/Input.js").GameInput} input
 * @property {object | null} weapon
 * @property {ReturnType<import("@/lib/audio/Sound.js").createSoundManager>} sounds
 * @property {THREE.WebGLRenderer} renderer
 * @property {object | null} sky
 * @property {object} arena
 * @property {object | null} rain
 * @property {object | null} snow
 * @property {number} lastTime
 * @property {number} simTime
 * @property {boolean} grenadeHeld
 * @property {number} healthRegenTimer
 * @property {number} radioactiveOverflowDecayTimer
 * @property {number} _lastHostileCount
 * @property {string} activePrimaryId
 * @property {ReturnType<typeof setTimeout> | null} flashTimeout
 * @property {object[]} grenades
 * @property {object[]} bloodSplatters
 * @property {object[]} pendingKillBlood
 * @property {object[]} bloodAfterRagdoll
 * @property {object[]} hpOrbs
 * @property {object[]} ammoDrops
 * @property {object[]} grenadeDrops
 * @property {object[]} collectibleEntries
 * @property {object[]} liveTargetsScratch
 * @property {object[]} allColliders
 * @property {THREE.Object3D[]} levelHitMeshes
 * @property {object | null} laserTracers
 * @property {object} laserEmitterTuningRef
 * @property {{ current: boolean }} primaryWeaponTuneEnabledRef
 * @property {{ current: string }} primaryWeaponTuneWeaponRef
 * @property {{ current: string }} primaryWeaponTuneModeRef
 * @property {{ current: string | null }} pendingPrimaryWeaponTuneSwapRef
 * @property {object} combat
 * @property {object} [key: string] - refs, HUD callbacks, weapon helpers
 */

export {};
