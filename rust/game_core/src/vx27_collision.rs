use crate::collision::{point_in_rounded_box_footprint, ColliderBoxInput};
use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vx27ColliderInput {
    #[serde(default)]
    pub rotation_y: f64,
    pub container_cx: Option<f64>,
    pub container_cz: Option<f64>,
    pub container_half_w: Option<f64>,
    pub container_half_l: Option<f64>,
    pub container_part: Option<String>,
    #[serde(default)]
    pub container_edge_radius: Option<f64>,
    #[serde(default)]
    pub exterior_corner_radius: Option<f64>,
    #[serde(default)]
    pub container_open_half_w: Option<f64>,
    #[serde(default)]
    pub container_inner_half_l: Option<f64>,
    pub bottom_y: Option<f64>,
    pub top_y: Option<f64>,
    #[serde(default)]
    pub kind: Option<String>,
}

fn world_to_container_local(cx: f64, cz: f64, rot_y: f64, world_x: f64, world_z: f64) -> (f64, f64) {
    let dx = world_x - cx;
    let dz = world_z - cz;
    let c = rot_y.cos();
    let s = rot_y.sin();
    (c * dx - s * dz, s * dx + c * dz)
}

fn apply_exterior_corner_rounding(half_x: f64, half_z: f64, corner_r: f64) -> (f64, f64, f64) {
    let max_r = half_x.min(half_z);
    let clamped = corner_r.clamp(0.0, max_r);
    if clamped <= 0.0 {
        return (half_x, half_z, 0.0);
    }
    (
        (half_x - clamped).max(0.001),
        (half_z - clamped).max(0.001),
        clamped,
    )
}

fn vx27_exterior_footprint_half_extents(
    half_w: f64,
    half_l: f64,
    edge_r: f64,
    corner_r: f64,
) -> (f64, f64, f64) {
    let shell_half_w = (half_w - edge_r).max(0.05);
    let shell_half_l = (half_l - edge_r).max(0.05);
    apply_exterior_corner_rounding(shell_half_w, shell_half_l, corner_r)
}

pub fn is_vx27_container_end_or_door_collider(box_: &Vx27ColliderInput) -> bool {
    if box_.kind.as_deref() != Some("vx27ContainerWall") {
        return false;
    }
    let Some(part) = box_.container_part.as_deref() else {
        return false;
    };
    part.starts_with("door") || part.starts_with("end") || part.starts_with("corner")
}

pub fn is_vx27_container_horizontal_collider(box_: &Vx27ColliderInput) -> bool {
    if box_.kind.as_deref() != Some("vx27ContainerWall") {
        return false;
    }
    let Some(part) = box_.container_part.as_deref() else {
        return false;
    };
    part == "wallLeft"
        || part == "wallRight"
        || part.starts_with("end")
        || part.starts_with("door")
}

pub fn is_vx27_container_collider_near_player(
    box_: &Vx27ColliderInput,
    world_x: f64,
    world_z: f64,
    margin: f64,
) -> bool {
    if box_.kind.as_deref() != Some("vx27ContainerWall") {
        return true;
    }
    let (Some(cx), Some(cz), Some(half_w), Some(half_l)) = (
        box_.container_cx,
        box_.container_cz,
        box_.container_half_w,
        box_.container_half_l,
    ) else {
        return true;
    };
    let reach = (half_w.hypot(half_l)) + margin;
    let dx = world_x - cx;
    let dz = world_z - cz;
    dx * dx + dz * dz <= reach * reach
}

pub fn point_in_vx27_exterior_collider_footprint(
    box_: &Vx27ColliderInput,
    x: f64,
    z: f64,
    radius: f64,
) -> bool {
    let corner_r = box_.exterior_corner_radius.unwrap_or(0.0);
    if corner_r <= 0.0 {
        return true;
    }
    let (Some(cx), Some(cz), Some(half_w), Some(half_l)) = (
        box_.container_cx,
        box_.container_cz,
        box_.container_half_w,
        box_.container_half_l,
    ) else {
        return true;
    };
    let edge_r = box_.container_edge_radius.unwrap_or(0.0);
    let (half_x, half_z, corner_radius) =
        vx27_exterior_footprint_half_extents(half_w, half_l, edge_r, corner_r);
    point_in_rounded_box_footprint(
        ColliderBoxInput {
            x: cx,
            z: cz,
            half_x,
            half_z,
            rotation_y: box_.rotation_y,
            corner_radius,
        },
        x,
        z,
        radius,
    )
}

pub fn should_skip_vx27_container_collider(
    box_: &Vx27ColliderInput,
    world_x: f64,
    world_z: f64,
    foot_y: Option<f64>,
) -> bool {
    if box_.kind.as_deref() != Some("vx27ContainerWall") {
        return false;
    }
    let Some(part) = box_.container_part.as_deref() else {
        return false;
    };
    if part != "floor" && part != "roof" && part != "interiorCeiling" {
        return false;
    }

    let (Some(cx), Some(cz), Some(half_w), Some(half_l)) = (
        box_.container_cx,
        box_.container_cz,
        box_.container_half_w,
        box_.container_half_l,
    ) else {
        return false;
    };

    let rot_y = box_.rotation_y;
    let (local_x, local_z) = world_to_container_local(cx, cz, rot_y, world_x, world_z);

    let m = 0.05;
    let open_half_w = box_.container_open_half_w.unwrap_or(half_w * 0.98);
    let inner_half_l = box_.container_inner_half_l.unwrap_or(half_l);

    if part == "floor" {
        if let (Some(fy), Some(top_y)) = (foot_y, box_.top_y) {
            if fy < top_y - 0.12 {
                return true;
            }
        }
        return local_x.abs() > open_half_w + m || local_z.abs() > inner_half_l + m;
    }

    if part == "roof" {
        if let (Some(fy), Some(bottom_y)) = (foot_y, box_.bottom_y) {
            if fy + 2.2 < bottom_y {
                return true;
            }
        }
        if box_.exterior_corner_radius.unwrap_or(0.0) > 0.0 {
            return !point_in_vx27_exterior_collider_footprint(box_, world_x, world_z, m);
        }
        let edge_r = box_.container_edge_radius.unwrap_or(0.0);
        let reach_w = half_w - edge_r + m;
        let reach_l = half_l - edge_r + m;
        return local_x.abs() > reach_w || local_z.abs() > reach_l;
    }

    local_x.abs() > open_half_w + m || local_z.abs() > inner_half_l + m
}

pub fn should_skip_vx27_container_headroom(
    box_: &Vx27ColliderInput,
    world_x: f64,
    world_z: f64,
    foot_y: Option<f64>,
) -> bool {
    if box_.kind.as_deref() != Some("vx27ContainerWall") {
        return false;
    }
    if box_.container_part.as_deref() == Some("roof") {
        return should_skip_vx27_container_collider(box_, world_x, world_z, foot_y);
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn floor_box() -> Vx27ColliderInput {
        Vx27ColliderInput {
            rotation_y: 0.0,
            container_cx: Some(0.0),
            container_cz: Some(0.0),
            container_half_w: Some(2.0),
            container_half_l: Some(4.0),
            container_part: Some("floor".into()),
            container_edge_radius: None,
            exterior_corner_radius: None,
            container_open_half_w: None,
            container_inner_half_l: None,
            bottom_y: Some(0.0),
            top_y: Some(0.1),
            kind: Some("vx27ContainerWall".into()),
        }
    }

    #[test]
    fn skips_floor_outside_opening() {
        assert!(should_skip_vx27_container_collider(
            &floor_box(),
            3.0,
            0.0,
            Some(0.05)
        ));
    }

    #[test]
    fn end_door_collider_detected() {
        let mut box_ = floor_box();
        box_.container_part = Some("doorLeft".into());
        assert!(is_vx27_container_end_or_door_collider(&box_));
    }
}
