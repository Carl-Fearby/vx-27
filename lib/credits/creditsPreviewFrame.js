import * as THREE from "three";

/** Move object so its bounding-box center sits at the origin. */
export function centerObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  box.getCenter(center);
  object.position.sub(center);
  object.updateMatrixWorld(true);
}

/** Uniform scale so the largest axis matches targetSize. */
export function fitObjectUniform(object, targetSize) {
  centerObject(object);
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) {
    object.scale.multiplyScalar(targetSize / maxDim);
  }
  object.updateMatrixWorld(true);
}

/** Bounding sphere radius — safe for Y-axis spin (uses AABB circumsphere). */
export function getObjectBoundingRadius(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return 0.25;

  const size = new THREE.Vector3();
  box.getSize(size);
  const half = size.multiplyScalar(0.5);
  // Circumsphere of the AABB — stays valid while the object spins on Y.
  return Math.max(Math.sqrt(half.x * half.x + half.y * half.y + half.z * half.z), 0.08);
}

function setCameraClipPlanes(camera, distance, radius) {
  camera.near = Math.max(0.01, distance * 0.02);
  camera.far = Math.max(camera.near + 2, distance + radius * 8 + 4);
  camera.updateProjectionMatrix();
}

/**
 * Pull the camera back so a centered object fits entirely in frame while spinning.
 */
export function frameCameraOnObject(
  camera,
  object,
  {
    padding = 1.28,
    aspect = 1,
    yaw = 0.28,
    pitch = 0.1,
    lookAtX = 0,
    lookAtY = 0,
    screenOffsetX = 0,
  } = {},
) {
  const radius = getObjectBoundingRadius(object);
  const vFovRad = THREE.MathUtils.degToRad(camera.fov);
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);
  const distance =
    Math.max(radius / Math.sin(vFovRad / 2), radius / Math.sin(hFovRad / 2)) * padding;

  const dir = new THREE.Vector3(Math.sin(yaw) * 0.35, pitch, Math.cos(yaw)).normalize();
  camera.position.copy(dir.multiplyScalar(distance));
  camera.lookAt(lookAtX, lookAtY, 0);
  setCameraClipPlanes(camera, distance, radius);

  if (screenOffsetX) {
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    camera.getWorldDirection(forward);
    right.crossVectors(forward, camera.up).normalize();
    object.position.addScaledVector(right, screenOffsetX);
    object.updateMatrixWorld(true);
  }

  return { radius, distance };
}

/** Frame on a spread-out group (e.g. finale stage). */
export function frameCameraOnBounds(
  camera,
  object,
  {
    padding = 1.2,
    aspect = 1,
    yaw = 0.22,
    pitch = 0.12,
  } = {},
) {
  const box = new THREE.Box3().setFromObject(object);
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);

  const radius = Math.max(sphere.radius, 0.08);
  const vFovRad = THREE.MathUtils.degToRad(camera.fov);
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);
  const distance =
    Math.max(radius / Math.sin(vFovRad / 2), radius / Math.sin(hFovRad / 2)) * padding;

  const dir = new THREE.Vector3(Math.sin(yaw) * 0.25, pitch, Math.cos(yaw)).normalize();
  camera.position.copy(sphere.center).add(dir.multiplyScalar(distance));
  camera.lookAt(sphere.center);
  setCameraClipPlanes(camera, distance, radius);

  return { center: sphere.center.clone(), radius, distance };
}
