/** Count scene meshes for WebGL error correlation. */
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { createLevelFromArena } from "../lib/level/Level.js";
import { enableShadowsOn } from "../lib/lighting/SceneEnvironment.js";

const raw = JSON.parse(
  readFileSync(new URL("../public/levels/level1.json", import.meta.url), "utf8")
);

const scene = new THREE.Scene();
const level = createLevelFromArena(scene, raw);
enableShadowsOn(level.group);

let indexedReceive = 0;
let indexedTotal = 0;
let nonIndexedReceive = 0;
let nonIndexedTotal = 0;
let shaderReceive = 0;

level.group.traverse((obj) => {
  if (!obj.isMesh) return;
  const geo = obj.geometry;
  const indexed = geo?.index != null;
  if (indexed) indexedTotal += 1;
  else nonIndexedTotal += 1;
  if (!obj.receiveShadow) return;
  if (indexed) indexedReceive += 1;
  else nonIndexedReceive += 1;
  const mat = obj.material;
  const mats = Array.isArray(mat) ? mat : [mat];
  if (mats.some((m) => m?.isShaderMaterial)) shaderReceive += 1;
});

console.log({
  indexedTotal,
  indexedReceive,
  nonIndexedTotal,
  nonIndexedReceive,
  shaderReceive,
});
