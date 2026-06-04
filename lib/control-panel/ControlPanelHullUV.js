/**
 * End caps K/L — side-profile UV on every vertex (incl. bevel). No screen mirror.
 */
export function applyControlPanelCapUVs(geometry, height, depth, width) {
  void width;
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  if (!pos || !uv) return;

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const u = (x + depth * 0.5) / depth;
    const v = y / height;
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;

  const uv2 = geometry.attributes.uv2;
  if (uv2) {
    for (let i = 0; i < pos.count; i += 1) {
      uv2.setXY(i, uv.getX(i), uv.getY(i));
    }
    uv2.needsUpdate = true;
  }
}

/**
 * Flat rear panel (surface A): u along console width, v along height.
 * @param {THREE.Mesh} mesh
 * @param {number} width
 * @param {number} height
 */
export function applyBackPanelCapUV(mesh, width, height) {
  const pos = mesh.geometry?.attributes?.position;
  const uv = mesh.geometry?.attributes?.uv;
  if (!pos || !uv) return;

  const halfW = width * 0.5;
  const write = (uvAttr) => {
    if (!uvAttr) return;
    for (let i = 0; i < pos.count; i += 1) {
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      uvAttr.setXY(i, (pz + halfW) / width, py / height);
    }
    uvAttr.needsUpdate = true;
  };
  write(uv);
  write(mesh.geometry?.attributes?.uv2);
}
