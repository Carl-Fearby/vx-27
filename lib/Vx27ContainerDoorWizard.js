import * as THREE from "three";
import { setWorldLayer } from "./LightingLayers.js";
import { computeVx27DoorLayout } from "./Vx27ContainerDoors.js";

const WIZARD_BLUE = 0x6ea8ff;

/** @param {number} halfX @param {number} halfY @param {number} halfZ */
function addWireBox(group, halfX, halfY, halfZ) {
  const geo = new THREE.BoxGeometry(halfX * 2, halfY * 2, halfZ * 2);
  const edges = new THREE.EdgesGeometry(geo);
  geo.dispose();
  const mat = new THREE.LineBasicMaterial({
    color: WIZARD_BLUE,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  });
  const lines = new THREE.LineSegments(edges, mat);
  lines.renderOrder = 9998;
  group.add(lines);
  return lines;
}

/** @param {THREE.Group} overlay */
function clearOverlay(overlay) {
  while (overlay.children.length) {
    const child = overlay.children[0];
    overlay.remove(child);
    child.traverse((obj) => {
      obj.geometry?.dispose();
      obj.material?.dispose();
    });
  }
}

/** Layout fields that require rebuilding wireframe geometry (not open angles). */
function doorWizardGeometryKey(container) {
  const t = container.userData.vx27DoorTuning ?? {};
  const insets = container.userData.vx27InteriorInsets ?? {};
  return [
    container.userData.vx27Width,
    container.userData.vx27Height,
    container.userData.vx27Length,
    container.userData.vx27Shell ?? 0.05,
    container.userData.vx27EdgeRadius ?? 0,
    insets.left,
    insets.right,
    insets.front,
    insets.back,
    insets.floorOffset,
    insets.ceilingOffset,
    t.width,
    t.height,
    t.sideOffset,
    t.depthOffset,
    t.bottomOffset,
    t.thickness,
    t.openingEdgeRadius,
  ].join("|");
}

/**
 * @param {THREE.Group} overlay
 * @param {ReturnType<typeof computeVx27DoorLayout>} layout
 */
function rebuildDoorWizardOverlay(overlay, layout) {
  clearOverlay(overlay);

  for (const end of layout.ends) {
    const openingCenterY = (layout.floorYLocal + layout.ceilYLocal) / 2;
    const openingHalfH = Math.max(0.025, (layout.ceilYLocal - layout.floorYLocal) / 2);
    const frame = new THREE.Group();
    frame.name = `wizard_frame_${end.key}`;
    frame.position.set(layout.openCenterX, openingCenterY, end.doorCenterZ);
    addWireBox(frame, layout.openHalfW, openingHalfH, layout.thickness * 2);
    overlay.add(frame);

    for (const leaf of end.leaves) {
      const pivot = new THREE.Group();
      pivot.name = `wizard_pivot_${end.key}_${leaf.side}`;
      pivot.position.set(leaf.hingeX, layout.doorCenterY, end.pivotZ);
      pivot.rotation.y = leaf.pivotRotY;
      const leafGroup = new THREE.Group();
      leafGroup.position.set(leaf.panelOffsetX, 0, leaf.panelOffsetZ);
      addWireBox(leafGroup, layout.leafW / 2, layout.leafH / 2, layout.thickness / 2 + 0.002);
      pivot.add(leafGroup);
      overlay.add(pivot);
    }
  }
}

/**
 * @param {THREE.Group} overlay
 * @param {ReturnType<typeof computeVx27DoorLayout>} layout
 */
function syncDoorWizardOverlay(overlay, layout) {
  for (const end of layout.ends) {
    const openingCenterY = (layout.floorYLocal + layout.ceilYLocal) / 2;
    const frame = overlay.getObjectByName(`wizard_frame_${end.key}`);
    if (frame) {
      frame.position.set(layout.openCenterX, openingCenterY, end.doorCenterZ);
    }
    for (const leaf of end.leaves) {
      const pivot = overlay.getObjectByName(`wizard_pivot_${end.key}_${leaf.side}`);
      if (!pivot) continue;
      pivot.position.set(leaf.hingeX, layout.doorCenterY, end.pivotZ);
      pivot.rotation.y = leaf.pivotRotY;
    }
  }
}

/**
 * Blue-outline door fit wizard — opening frame + each leaf bounds.
 * Rebuilds wireframe only when door/container geometry changes; open angles sync cheaply.
 * @param {THREE.Group} container
 * @param {boolean} enabled
 */
export function updateVx27ContainerDoorWizard(container, enabled) {
  if (!container?.isGroup) return;

  let overlay = container.getObjectByName("vx27_container_door_wizard");
  if (!enabled) {
    if (overlay) overlay.visible = false;
    return;
  }

  if (!overlay) {
    overlay = new THREE.Group();
    overlay.name = "vx27_container_door_wizard";
    setWorldLayer(overlay);
    container.add(overlay);
  }
  overlay.visible = true;

  const layout = computeVx27DoorLayout(
    container.userData.vx27Width,
    container.userData.vx27Height,
    container.userData.vx27Length,
    container.userData.vx27Shell ?? 0.05,
    container.userData.vx27InteriorInsets,
    container.userData.vx27EdgeRadius ?? 0,
    container.userData.vx27DoorTuning
  );

  const geometryKey = doorWizardGeometryKey(container);
  if (overlay.userData.geometryKey !== geometryKey) {
    rebuildDoorWizardOverlay(overlay, layout);
    overlay.userData.geometryKey = geometryKey;
  } else {
    syncDoorWizardOverlay(overlay, layout);
  }
}
