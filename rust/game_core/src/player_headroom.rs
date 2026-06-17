use crate::collision::{point_in_rounded_box_footprint, rotated_box_overlaps_circle, ColliderBoxInput};
use crate::vx27_collision::{
    point_in_vx27_exterior_collider_footprint, should_skip_vx27_container_headroom,
    Vx27ColliderInput,
};
use serde::{Deserialize, Serialize};

const STAND_CLEARANCE_MARGIN: f64 = 0.05;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeadroomColliderInput {
    pub x: f64,
    pub z: f64,
    pub half_x: f64,
    pub half_z: f64,
    #[serde(default)]
    pub rotation_y: f64,
    #[serde(default)]
    pub corner_radius: f64,
    pub bottom_y: Option<f64>,
    pub top_y: Option<f64>,
    #[serde(default = "default_true")]
    pub active: bool,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub mouth_plane: bool,
    #[serde(default)]
    pub exterior_corner_radius: Option<f64>,
    #[serde(default)]
    pub container_cx: Option<f64>,
    #[serde(default)]
    pub container_cz: Option<f64>,
    #[serde(default)]
    pub container_half_w: Option<f64>,
    #[serde(default)]
    pub container_half_l: Option<f64>,
    #[serde(default)]
    pub container_part: Option<String>,
    #[serde(default)]
    pub container_edge_radius: Option<f64>,
    #[serde(default)]
    pub container_open_half_w: Option<f64>,
    #[serde(default)]
    pub container_inner_half_l: Option<f64>,
    #[serde(default)]
    pub vx27_roof_headroom_margin: f64,
}

fn default_true() -> bool {
    true
}

impl HeadroomColliderInput {
    fn footprint(&self) -> ColliderBoxInput {
        ColliderBoxInput {
            x: self.x,
            z: self.z,
            half_x: self.half_x,
            half_z: self.half_z,
            rotation_y: self.rotation_y,
            corner_radius: self.corner_radius,
        }
    }

    fn vx27_input(&self) -> Vx27ColliderInput {
        Vx27ColliderInput {
            rotation_y: self.rotation_y,
            container_cx: self.container_cx,
            container_cz: self.container_cz,
            container_half_w: self.container_half_w,
            container_half_l: self.container_half_l,
            container_part: self.container_part.clone(),
            container_edge_radius: self.container_edge_radius,
            exterior_corner_radius: self.exterior_corner_radius,
            container_open_half_w: self.container_open_half_w,
            container_inner_half_l: self.container_inner_half_l,
            bottom_y: self.bottom_y,
            top_y: self.top_y,
            kind: self.kind.clone(),
        }
    }
}

fn is_headroom_skip_kind(kind: Option<&str>) -> bool {
    matches!(
        kind,
        Some("stairRearWall")
            | Some("stairUnderSoffit")
            | Some("stairSideInner")
            | Some("stairSideOuter")
            | Some("stairSideTop")
            | Some("stairBack")
            | Some("stairRearCurtain")
            | Some("stairBackSlice")
            | Some("deck")
            | Some("controlPanel")
            | Some("oilBarrel")
    )
}

fn should_skip_mouth_plane_headroom(
    box_: &HeadroomColliderInput,
    foot_y: f64,
    floor_y: f64,
    in_passage: bool,
) -> bool {
    if !box_.mouth_plane {
        return false;
    }
    if foot_y >= floor_y + 3.0 {
        return false;
    }
    !in_passage
}

fn overlaps_xz(box_: &HeadroomColliderInput, x: f64, z: f64, reach: f64) -> bool {
    if box_.kind.as_deref() == Some("vx27ContainerWall")
        && box_.exterior_corner_radius.unwrap_or(0.0) > 0.0
    {
        return point_in_vx27_exterior_collider_footprint(&box_.vx27_input(), x, z, reach);
    }
    if box_.corner_radius > 0.0 {
        return point_in_rounded_box_footprint(box_.footprint(), x, z, reach);
    }
    rotated_box_overlaps_circle(box_.footprint(), x, z, reach)
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HasHeadroomInput {
    pub x: f64,
    pub z: f64,
    pub foot_y: f64,
    pub desired_height: f64,
    pub player_radius: f64,
    pub floor_y: f64,
    #[serde(default)]
    pub in_passage: bool,
    pub doorway_ceiling_y: Option<f64>,
    pub colliders: Vec<HeadroomColliderInput>,
}

pub fn has_headroom(input: HasHeadroomInput) -> bool {
    if let Some(ceiling_y) = input.doorway_ceiling_y {
        return input.foot_y + input.desired_height
            <= ceiling_y + STAND_CLEARANCE_MARGIN;
    }

    let head_y = input.foot_y + input.desired_height - 0.03;
    let reach = input.player_radius;

    for box_ in &input.colliders {
        if !box_.active {
            continue;
        }
        if box_.bottom_y.is_none() && box_.top_y.is_none() {
            continue;
        }
        if is_headroom_skip_kind(box_.kind.as_deref()) {
            continue;
        }
        if should_skip_mouth_plane_headroom(box_, input.foot_y, input.floor_y, input.in_passage) {
            continue;
        }
        if box_.kind.as_deref() == Some("vx27ContainerWall")
            && should_skip_vx27_container_headroom(
                &box_.vx27_input(),
                input.x,
                input.z,
                Some(input.foot_y),
            )
        {
            continue;
        }

        let bottom = box_.bottom_y.unwrap_or(f64::NEG_INFINITY);
        let top = box_.top_y.unwrap_or(f64::INFINITY);
        if head_y > top + 0.04 {
            continue;
        }
        if matches!(
            box_.kind.as_deref(),
            Some("pillar") | Some("oilBarrel") | Some("controlPanel")
        ) && top > head_y + 0.25
            && head_y < top - 0.35
        {
            continue;
        }
        if head_y < bottom - 0.04 {
            continue;
        }

        let corner_pad = box_
            .exterior_corner_radius
            .unwrap_or(box_.corner_radius)
            .max(0.0);
        let max_half = box_.half_x.max(box_.half_z) + reach + corner_pad;
        if (input.x - box_.x).abs() > max_half || (input.z - box_.z).abs() > max_half {
            continue;
        }
        if overlaps_xz(box_, input.x, input.z, reach) {
            return false;
        }
    }
    true
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveCeilingCollisionsInput {
    pub x: f64,
    pub z: f64,
    pub foot_y: f64,
    pub position_y: f64,
    pub velocity_y: f64,
    pub player_radius: f64,
    pub floor_y: f64,
    #[serde(default)]
    pub in_passage: bool,
    pub colliders: Vec<HeadroomColliderInput>,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveCeilingCollisionsOutput {
    pub position_y: f64,
    pub velocity_y: f64,
}

pub fn resolve_ceiling_collisions(
    input: ResolveCeilingCollisionsInput,
) -> ResolveCeilingCollisionsOutput {
    if input.velocity_y <= 0.0 {
        return ResolveCeilingCollisionsOutput {
            position_y: input.position_y,
            velocity_y: input.velocity_y,
        };
    }

    let reach = input.player_radius;
    let eye_margin = STAND_CLEARANCE_MARGIN;
    let mut position_y = input.position_y;
    let mut velocity_y = input.velocity_y;

    for box_ in &input.colliders {
        if !box_.active {
            continue;
        }
        let Some(ceiling_bottom) = box_.bottom_y else {
            continue;
        };
        if is_headroom_skip_kind(box_.kind.as_deref()) {
            continue;
        }
        if should_skip_mouth_plane_headroom(box_, input.foot_y, input.floor_y, input.in_passage) {
            continue;
        }
        if box_.kind.as_deref() == Some("vx27ContainerWall")
            && should_skip_vx27_container_headroom(
                &box_.vx27_input(),
                input.x,
                input.z,
                Some(input.foot_y),
            )
        {
            continue;
        }

        let roof_margin = box_.vx27_roof_headroom_margin;
        let top = box_.top_y.unwrap_or(f64::INFINITY);
        let ceiling_eye_margin = eye_margin + if roof_margin > 0.0 { 0.12 } else { 0.0 };

        if input.foot_y >= ceiling_bottom - 0.08 {
            continue;
        }
        if position_y <= ceiling_bottom - ceiling_eye_margin {
            continue;
        }

        let head_y = position_y;
        if head_y > top + 0.04 {
            continue;
        }
        if matches!(
            box_.kind.as_deref(),
            Some("pillar") | Some("oilBarrel") | Some("controlPanel")
        ) && top > head_y + 0.25
            && head_y < top - 0.35
        {
            continue;
        }

        if box_.kind.as_deref() == Some("vx27ContainerWall")
            && box_.exterior_corner_radius.unwrap_or(0.0) > 0.0
        {
            if !point_in_vx27_exterior_collider_footprint(&box_.vx27_input(), input.x, input.z, reach)
            {
                continue;
            }
        } else if !overlaps_xz(box_, input.x, input.z, reach) {
            continue;
        }

        let max_eye_y = ceiling_bottom - ceiling_eye_margin;
        if position_y > max_eye_y {
            position_y = max_eye_y;
            velocity_y = 0.0;
        }
    }

    ResolveCeilingCollisionsOutput {
        position_y,
        velocity_y,
    }
}
