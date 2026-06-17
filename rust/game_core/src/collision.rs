use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColliderBoxInput {
    pub x: f64,
    pub z: f64,
    pub half_x: f64,
    pub half_z: f64,
    #[serde(default)]
    pub rotation_y: f64,
    #[serde(default)]
    pub corner_radius: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Vec2 {
    pub x: f64,
    pub z: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveBoxColliderOutput {
    pub x: f64,
    pub z: f64,
    pub moved: bool,
}

pub fn world_to_box_local(collider: ColliderBoxInput, x: f64, z: f64) -> Vec2 {
    let dx = x - collider.x;
    let dz = z - collider.z;
    if collider.rotation_y.abs() < 1e-12 {
        return Vec2 { x: dx, z: dz };
    }
    let c = collider.rotation_y.cos();
    let s = collider.rotation_y.sin();
    Vec2 {
        x: c * dx - s * dz,
        z: s * dx + c * dz,
    }
}

pub fn rotated_box_overlaps_circle(
    collider: ColliderBoxInput,
    x: f64,
    z: f64,
    radius: f64,
) -> bool {
    let local = world_to_box_local(collider, x, z);
    if local.x.abs() < collider.half_x && local.z.abs() < collider.half_z {
        return true;
    }
    let closest_x = local.x.clamp(-collider.half_x, collider.half_x);
    let closest_z = local.z.clamp(-collider.half_z, collider.half_z);
    let diff_x = local.x - closest_x;
    let diff_z = local.z - closest_z;
    let r_sq = radius * radius;
    diff_x * diff_x + diff_z * diff_z < r_sq
}

pub fn point_in_rounded_box_footprint(
    collider: ColliderBoxInput,
    x: f64,
    z: f64,
    radius: f64,
) -> bool {
    let corner_r = collider.corner_radius.max(0.0);
    let local = world_to_box_local(collider, x, z);
    if corner_r <= 0.0 {
        return local.x.abs() <= collider.half_x + radius
            && local.z.abs() <= collider.half_z + radius;
    }
    let inner_x = (collider.half_x - corner_r).max(0.0);
    let inner_z = (collider.half_z - corner_r).max(0.0);
    let ax = local.x.abs();
    let az = local.z.abs();
    if ax <= inner_x + radius && az <= inner_z + radius {
        if ax <= inner_x || az <= inner_z {
            return true;
        }
    }
    let cdx = (ax - inner_x).max(0.0);
    let cdz = (az - inner_z).max(0.0);
    let r = corner_r + radius;
    cdx * cdx + cdz * cdz <= r * r
}

pub fn resolve_box_collider(
    pos_x: f64,
    pos_z: f64,
    radius: f64,
    collider: ColliderBoxInput,
) -> ResolveBoxColliderOutput {
    let local = world_to_box_local(collider, pos_x, pos_z);
    let mut push_x = 0.0;
    let mut push_z = 0.0;

    if local.x.abs() < collider.half_x && local.z.abs() < collider.half_z {
        let push_left = local.x + collider.half_x + radius;
        let push_right = collider.half_x - local.x + radius;
        let push_back = local.z + collider.half_z + radius;
        let push_forward = collider.half_z - local.z + radius;
        let min = push_left
            .min(push_right)
            .min(push_back)
            .min(push_forward);
        if (min - push_left).abs() < 1e-12 {
            push_x = -push_left;
        } else if (min - push_right).abs() < 1e-12 {
            push_x = push_right;
        } else if (min - push_back).abs() < 1e-12 {
            push_z = -push_back;
        } else {
            push_z = push_forward;
        }
    } else {
        let closest_x = local.x.clamp(-collider.half_x, collider.half_x);
        let closest_z = local.z.clamp(-collider.half_z, collider.half_z);
        let diff_x = local.x - closest_x;
        let diff_z = local.z - closest_z;
        let dist_sq = diff_x * diff_x + diff_z * diff_z;
        let r_sq = radius * radius;
        if dist_sq >= r_sq || dist_sq < 1e-10 {
            return ResolveBoxColliderOutput {
                x: pos_x,
                z: pos_z,
                moved: false,
            };
        }
        let dist = dist_sq.sqrt();
        let push = (radius - dist) / dist;
        push_x = diff_x * push;
        push_z = diff_z * push;
    }

    let (out_x, out_z) = if collider.rotation_y.abs() >= 1e-12 {
        let c = collider.rotation_y.cos();
        let s = collider.rotation_y.sin();
        (
            pos_x + c * push_x + s * push_z,
            pos_z + (-s * push_x + c * push_z),
        )
    } else {
        (pos_x + push_x, pos_z + push_z)
    };

    ResolveBoxColliderOutput {
        x: out_x,
        z: out_z,
        moved: true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn box_at(origin_x: f64, origin_z: f64) -> ColliderBoxInput {
        ColliderBoxInput {
            x: origin_x,
            z: origin_z,
            half_x: 1.0,
            half_z: 0.5,
            rotation_y: 0.0,
            corner_radius: 0.0,
        }
    }

    #[test]
    fn pushes_circle_out_of_axis_aligned_box() {
        let output = resolve_box_collider(0.8, 0.0, 0.35, box_at(0.0, 0.0));
        assert!(output.moved);
        assert!((output.x - 1.35).abs() < 0.0001);
        assert!(output.z.abs() < 0.0001);
    }

    #[test]
    fn overlap_detects_penetrating_circle() {
        assert!(rotated_box_overlaps_circle(box_at(0.0, 0.0), 0.5, 0.0, 0.35));
        assert!(!rotated_box_overlaps_circle(box_at(0.0, 0.0), 3.0, 0.0, 0.35));
    }

    #[test]
    fn rounded_footprint_allows_corner_inset() {
        let rounded = ColliderBoxInput {
            corner_radius: 0.3,
            ..box_at(0.0, 0.0)
        };
        assert!(!point_in_rounded_box_footprint(rounded, 1.2, 0.45, 0.0));
        assert!(point_in_rounded_box_footprint(rounded, 0.2, 0.0, 0.0));
    }
}
