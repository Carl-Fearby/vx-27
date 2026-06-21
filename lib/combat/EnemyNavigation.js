import * as THREE from "three";
import { NavMeshQuery, init } from "recast-navigation";
import { generateSoloNavMesh } from "recast-navigation/generators";

let _recastInitPromise = null;

function initRecast() {
  _recastInitPromise ??= init();
  return _recastInitPromise;
}

function belongsToTarget(object, targets) {
  let node = object;
  while (node) {
    if (targets.has(node)) return true;
    node = node.parent;
  }
  return false;
}

function navigationMeshes(level) {
  const meshes = [];
  const targets = new Set(level.targets ?? []);
  level.group.updateMatrixWorld(true);
  level.group.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes?.position) return;
    if (!object.visible || belongsToTarget(object, targets)) return;
    if (
      object.userData?.isShadowOccluder ||
      object.userData?.healthBar ||
      object.userData?.bulletHole ||
      object.userData?.bulletImpactFlash ||
      object.userData?.roomArenaWallOverlay ||
      object.userData?.roomCornerSeal
    ) {
      return;
    }
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    if (materials.some((material) => material?.transparent && material.opacity < 0.5)) {
      return;
    }
    meshes.push(object);
  });
  return meshes;
}

function navigationGeometry(meshes) {
  let vertexCount = 0;
  let indexCount = 0;
  for (const mesh of meshes) {
    vertexCount += mesh.geometry.attributes.position.count;
    indexCount += mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count;
  }

  const positions = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(indexCount);
  const vertex = new THREE.Vector3();
  let vertexOffset = 0;
  let indexOffset = 0;

  for (const mesh of meshes) {
    const attribute = mesh.geometry.attributes.position;
    mesh.updateWorldMatrix(true, false);
    for (let i = 0; i < attribute.count; i += 1) {
      vertex.fromBufferAttribute(attribute, i).applyMatrix4(mesh.matrixWorld);
      const output = (vertexOffset + i) * 3;
      positions[output] = vertex.x;
      positions[output + 1] = vertex.y;
      positions[output + 2] = vertex.z;
    }

    const sourceIndex = mesh.geometry.index;
    const meshIndexCount = sourceIndex?.count ?? attribute.count;
    for (let i = 0; i < meshIndexCount; i += 1) {
      indices[indexOffset + i] = vertexOffset + (sourceIndex ? sourceIndex.getX(i) : i);
    }
    vertexOffset += attribute.count;
    indexOffset += meshIndexCount;
  }

  return { positions, indices };
}

/** Build one static arena navmesh. Temporary/dynamic obstacles come in a later tier. */
export async function createEnemyNavigation(level) {
  if (!level?.group) return null;
  await initRecast();
  const meshes = navigationMeshes(level);
  if (!meshes.length) return null;
  const { positions, indices } = navigationGeometry(meshes);

  const result = generateSoloNavMesh(positions, indices, {
    cs: 0.2,
    ch: 0.2,
    walkableSlopeAngle: 48,
    walkableHeight: 9,
    walkableClimb: 2,
    walkableRadius: 2,
    minRegionArea: 4,
    mergeRegionArea: 8,
    maxEdgeLen: 16,
    maxSimplificationError: 1.15,
    detailSampleDist: 5,
    detailSampleMaxError: 1,
  });
  if (!result.success || !result.navMesh) {
    console.warn("Enemy navmesh generation failed:", result.error ?? "unknown error");
    return null;
  }

  const navMesh = result.navMesh;
  const query = new NavMeshQuery(navMesh, { maxNodes: 2048 });
  query.defaultQueryHalfExtents = { x: 1.5, y: 3, z: 1.5 };

  return {
    findPath(start, end) {
      const result = query.computePath(start, end, {
        halfExtents: query.defaultQueryHalfExtents,
        maxPathPolys: 128,
        maxStraightPathPoints: 64,
      });
      return result.success ? result.path : [];
    },

    randomPointAround(position, radius) {
      const result = query.findRandomPointAroundCircle(position, radius, {
        halfExtents: query.defaultQueryHalfExtents,
      });
      return result.success ? result.randomPoint : null;
    },

    closestPoint(position) {
      const result = query.findClosestPoint(position, {
        halfExtents: query.defaultQueryHalfExtents,
      });
      return result.success ? result.point : null;
    },

    dispose() {
      query.destroy();
      navMesh.destroy();
    },
  };
}

export function disposeEnemyNavigation(level) {
  level?.enemyNavigation?.dispose?.();
  if (level) level.enemyNavigation = null;
}
