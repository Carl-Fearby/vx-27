import * as THREE from "three";
import { readFileSync } from "node:fs";
import { createLevelFromArena } from "../lib/Level.js";
import { getDefaultStairPlacement } from "../lib/StairTuning.js";
import { getRoomCatwalkDeckPiece } from "../lib/RoomPlacement.js";

// Minimal DOM stub for target health bar sprites in headless probe.
if (typeof globalThis.document === "undefined") {
  globalThis.document = {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            fillRect() {},
            fillText() {},
            measureText() {
              return { width: 0 };
            },
            clearRect() {},
          };
        },
      };
    },
  };
}

const raw = JSON.parse(
  readFileSync(new URL("../public/levels/level1.json", import.meta.url), "utf8")
);
raw.stairs = getDefaultStairPlacement();

const scene = new THREE.Scene();
const level = createLevelFromArena(scene, raw);
const arena = raw;
const catwalkY = level.catwalkDeckY;
const half = arena.size / 2;
const innerHalf = half - (arena.wallStandoff ?? 0.5);
const attachWall = arena.attachWall ?? "north";
const room = arena.rooms?.[0];

console.log("catwalkDeckY", catwalkY);
console.log("room", room?.id, room?.centerX, room?.width, room?.depth);

const piece = getRoomCatwalkDeckPiece(
  room,
  attachWall,
  half,
  arena.wallThickness ?? 0.5,
  innerHalf
);
console.log("room deck piece", piece);

const decks = [];
level.group.traverse((obj) => {
  if (!obj.isMesh) return;
  if (!obj.userData?.arenaCeiling && !obj.userData?.roomCatwalkDeck) return;
  const box = new THREE.Box3().setFromObject(obj);
  const overlaps =
    box.max.x > piece.minX &&
    box.min.x < piece.maxX &&
    box.max.z > piece.minZ &&
    box.min.z < piece.maxZ;
  if (!overlaps) return;
  decks.push({
    roomDeck: !!obj.userData.roomCatwalkDeck,
    minX: +box.min.x.toFixed(2),
    maxX: +box.max.x.toFixed(2),
    minZ: +box.min.z.toFixed(2),
    maxZ: +box.max.z.toFixed(2),
    y: +box.max.y.toFixed(3),
    cast: obj.castShadow,
    receive: obj.receiveShadow,
    shadowReceive: obj.userData.shadowReceive,
    layer: obj.layers.mask,
  });
});

console.log("\nDeck meshes overlapping room footprint:", decks.length);
for (const d of decks) console.log(d);

const occluders = [];
const fireLights = [];
level.group.traverse((obj) => {
  if (obj.userData?.isShadowOccluder) {
    const p = new THREE.Vector3();
    obj.getWorldPosition(p);
    occluders.push({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), cast: obj.castShadow, layer: obj.layers.mask });
  }
  if (obj.name === "oil_barrel_fire_light" && obj.isPointLight) {
    const p = new THREE.Vector3();
    obj.getWorldPosition(p);
    fireLights.push({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), cast: obj.castShadow, intensity: obj.intensity, layer: obj.layers.mask });
  }
});

console.log("\nShadow occluders:", occluders.length);
for (const o of occluders) console.log(o);
console.log("\nFire lights:", fireLights.length);
for (const l of fireLights) console.log(l);
