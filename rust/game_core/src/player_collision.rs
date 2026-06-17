use crate::collision::{resolve_box_collider, rotated_box_overlaps_circle, ColliderBoxInput};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StairRampInput {
    #[serde(default = "default_ramp_z_min")]
    pub z_min: f64,
    #[serde(default = "default_ramp_run_end")]
    pub run_end: f64,
}

fn default_ramp_z_min() -> f64 {
    -0.55
}

fn default_ramp_run_end() -> f64 {
    5.4
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StairFlightInput {
    #[serde(default = "default_walk_half_width")]
    pub walk_half_width: f64,
    #[serde(default)]
    pub ramp: Option<StairRampInput>,
}

fn default_walk_half_width() -> f64 {
    1.75
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerColliderInput {
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
    pub skip_target: bool,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub block_forward_local_z: Option<f64>,
    #[serde(default)]
    pub stair_flight: Option<StairFlightInput>,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StairLocalInput {
    pub local_x: f64,
    pub local_z: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnBlockedAtInput {
    pub x: f64,
    pub z: f64,
    pub foot_y: f64,
    pub body_top: f64,
    pub radius: f64,
    pub colliders: Vec<PlayerColliderInput>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushCircleOutInput {
    pub x: f64,
    pub z: f64,
    pub radius: f64,
    pub colliders: Vec<PlayerColliderInput>,
    pub foot_y: Option<f64>,
    pub body_top: Option<f64>,
    #[serde(default = "default_true")]
    pub skip_target_meshes: bool,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PushCircleOutOutput {
    pub x: f64,
    pub z: f64,
}

fn default_true() -> bool {
    true
}

impl PlayerColliderInput {
    pub(crate) fn footprint(&self) -> ColliderBoxInput {
        ColliderBoxInput {
            x: self.x,
            z: self.z,
            half_x: self.half_x,
            half_z: self.half_z,
            rotation_y: self.rotation_y,
            corner_radius: self.corner_radius,
        }
    }
}

fn vertical_overlap(foot_y: f64, body_top: f64, bottom_y: f64, top_y: f64) -> bool {
    foot_y < top_y && body_top > bottom_y
}

fn is_catwalk_skip_stair_kind(kind: Option<&str>) -> bool {
    matches!(
        kind,
        Some("stairBack")
            | Some("stairRearCurtain")
            | Some("stairBackSlice")
            | Some("stairUnderSoffit")
            | Some("stairRearWall")
    )
}

pub fn should_skip_collider(
    collider: &PlayerColliderInput,
    foot_y: f64,
    body_top: f64,
    step_up_max: f64,
    support_y: Option<f64>,
    stair_local: Option<StairLocalInput>,
    climb_local_motion: f64,
    ramp_foot_y: Option<f64>,
    following_ramp: bool,
) -> bool {
    if collider.bottom_y.is_none() && collider.top_y.is_none() {
        return false;
    }

    let bottom_y = collider.bottom_y.unwrap_or(f64::NEG_INFINITY);
    let top_y = collider.top_y.unwrap_or(f64::INFINITY);
    let kind = collider.kind.as_deref();

    if !vertical_overlap(foot_y, body_top, bottom_y, top_y) {
        return true;
    }
    if body_top <= bottom_y + 0.01 {
        return true;
    }
    if foot_y >= top_y - 0.05
        && kind != Some("stairSideInner")
        && kind != Some("stairSideOuter")
    {
        return true;
    }

    if kind == Some("stairSideTop") && foot_y >= bottom_y - 0.08 {
        return true;
    }

    if kind == Some("wall") {
        if let Some(support) = support_y {
            if support > 3.5
                && foot_y >= support - 0.2
                && top_y.is_finite()
                && foot_y >= top_y - 0.8
            {
                return true;
            }
        }
    }

    if kind == Some("deck") && top_y.is_finite() && bottom_y.is_finite() {
        return true;
    }

    if foot_y >= 3.15
        && collider.stair_flight.is_some()
        && is_catwalk_skip_stair_kind(kind)
        && top_y.is_finite()
        && top_y > 2.5
    {
        return true;
    }

    if let (Some(stair_local), Some(stair_flight)) = (stair_local, collider.stair_flight.as_ref()) {
        let half_w = stair_flight.walk_half_width;
        let ramp = stair_flight.ramp.as_ref();
        let z_min = ramp.map(|r| r.z_min).unwrap_or(-0.55);
        let run_end = ramp.map(|r| r.run_end).unwrap_or(5.4);
        let in_walk_corridor = stair_local.local_x.abs() <= half_w + 0.06
            && stair_local.local_z >= z_min - 0.06
            && stair_local.local_z <= run_end + 0.35;

        let on_center_path = stair_local.local_x.abs() <= half_w + 0.06;
        let on_arena_floor = foot_y <= 0.12;
        let exiting_bottom = on_center_path
            && foot_y <= 0.28
            && ((climb_local_motion < -0.02
                && stair_local.local_z <= 0.25
                && stair_local.local_z >= -1.35)
                || (climb_local_motion <= 0.05
                    && on_arena_floor
                    && stair_local.local_z <= 0.0
                    && stair_local.local_z >= -0.25));

        let bulkhead_approach_gap =
            climb_local_motion > 0.25 && stair_local.local_z > -1.48 && stair_local.local_z < -1.28;
        let approaching_lip =
            climb_local_motion > 0.25 && stair_local.local_z > -0.65 && stair_local.local_z < 0.15;
        let leaving_lip = exiting_bottom
            || (climb_local_motion < -0.12
                && stair_local.local_z <= 0.25
                && stair_local.local_z >= -1.35);

        let on_ramp_surface =
            following_ramp || ramp_foot_y.is_some_and(|y| foot_y >= y - 0.22);
        let stepping_onto_ramp = ramp_foot_y.is_some_and(|y| {
            foot_y >= y - 0.48 && climb_local_motion > 0.2
        });

        match kind {
            Some("stairBack") => {
                if stair_local.local_z >= -0.75 {
                    return true;
                }
                if exiting_bottom {
                    return true;
                }
                if bulkhead_approach_gap {
                    return true;
                }
                if climb_local_motion > 0.25 && stair_local.local_z < -0.5 {
                    return true;
                }
                return false;
            }
            Some("stairRearCurtain") => {
                if stair_local.local_z >= -0.03 {
                    return true;
                }
                if approaching_lip {
                    return true;
                }
                if leaving_lip {
                    return true;
                }
                if on_ramp_surface {
                    return true;
                }
                if exiting_bottom {
                    return true;
                }
                return false;
            }
            Some("stairBackSlice") => {
                if on_ramp_surface {
                    return true;
                }
                if approaching_lip {
                    return true;
                }
                if leaving_lip {
                    return true;
                }
                if stepping_onto_ramp {
                    return true;
                }
                if exiting_bottom {
                    return true;
                }
                return false;
            }
            Some("stairUnderSoffit") | Some("stairRearWall") => {
                if in_walk_corridor && on_ramp_surface {
                    return true;
                }
                let forward_z = collider.block_forward_local_z.unwrap_or(-1.0);
                if stair_local.local_z >= forward_z - 0.1 {
                    return true;
                }
                return false;
            }
            _ => {}
        }
    }

    if let Some(support) = support_y {
        if top_y.is_finite()
            && (support - top_y).abs() < 0.05
            && foot_y <= top_y + 0.05
            && kind != Some("stairSideInner")
            && kind != Some("stairSideOuter")
        {
            return true;
        }
    }

    if top_y.is_finite()
        && foot_y < top_y - 0.04
        && top_y - foot_y <= step_up_max + 0.06
        && body_top > top_y + 0.02
    {
        return true;
    }

    false
}

pub fn spawn_blocked_at(input: SpawnBlockedAtInput) -> bool {
    for collider in &input.colliders {
        if !collider.active {
            continue;
        }
        if !rotated_box_overlaps_circle(
            collider.footprint(),
            input.x,
            input.z,
            input.radius,
        ) {
            continue;
        }
        if should_skip_collider(
            collider,
            input.foot_y,
            input.body_top,
            f64::INFINITY,
            Some(input.foot_y),
            None,
            0.0,
            None,
            false,
        ) {
            continue;
        }
        return true;
    }
    false
}

pub fn push_circle_out_of_colliders(input: PushCircleOutInput) -> PushCircleOutOutput {
    let mut pos_x = input.x;
    let mut pos_z = input.z;
    for collider in &input.colliders {
        if !collider.active {
            continue;
        }
        if input.skip_target_meshes && collider.skip_target {
            continue;
        }
        if let (Some(foot_y), Some(body_top)) = (input.foot_y, input.body_top) {
            if should_skip_collider(
                collider,
                foot_y,
                body_top,
                f64::INFINITY,
                Some(foot_y),
                None,
                0.0,
                None,
                false,
            ) {
                continue;
            }
        }
        let resolved = resolve_box_collider(pos_x, pos_z, input.radius, collider.footprint());
        pos_x = resolved.x;
        pos_z = resolved.z;
    }
    PushCircleOutOutput {
        x: pos_x,
        z: pos_z,
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerColliderResolveEntry {
    pub collider: PlayerColliderInput,
    pub stair_local: Option<StairLocalInput>,
    pub climb_local_motion: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvePlayerCollidersInput {
    pub x: f64,
    pub z: f64,
    pub radius: f64,
    pub foot_y: f64,
    pub body_top: f64,
    pub step_up_max: f64,
    pub support_y: f64,
    pub ramp_foot_y: Option<f64>,
    pub following_ramp: bool,
    pub entries: Vec<PlayerColliderResolveEntry>,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvePlayerCollidersOutput {
    pub x: f64,
    pub z: f64,
}

pub fn resolve_player_colliders(input: ResolvePlayerCollidersInput) -> ResolvePlayerCollidersOutput {
    let mut pos_x = input.x;
    let mut pos_z = input.z;
    for entry in &input.entries {
        let collider = &entry.collider;
        if !collider.active {
            continue;
        }
        if should_skip_collider(
            collider,
            input.foot_y,
            input.body_top,
            input.step_up_max,
            Some(input.support_y),
            entry.stair_local,
            entry.climb_local_motion,
            input.ramp_foot_y,
            input.following_ramp,
        ) {
            continue;
        }
        let resolved = resolve_box_collider(pos_x, pos_z, input.radius, collider.footprint());
        pos_x = resolved.x;
        pos_z = resolved.z;
    }
    ResolvePlayerCollidersOutput { x: pos_x, z: pos_z }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wall_box() -> PlayerColliderInput {
        PlayerColliderInput {
            x: 0.0,
            z: 0.0,
            half_x: 1.0,
            half_z: 0.5,
            rotation_y: 0.0,
            corner_radius: 0.0,
            bottom_y: Some(0.0),
            top_y: Some(3.0),
            active: true,
            skip_target: false,
            kind: Some("wall".into()),
            block_forward_local_z: None,
            stair_flight: None,
        }
    }

    #[test]
    fn spawn_blocked_detects_intersecting_wall() {
        let blocked = spawn_blocked_at(SpawnBlockedAtInput {
            x: 0.5,
            z: 0.0,
            foot_y: 0.0,
            body_top: 2.0,
            radius: 0.45,
            colliders: vec![wall_box()],
        });
        assert!(blocked);
    }

    #[test]
    fn spawn_blocked_ignores_standing_on_deck() {
        let blocked = spawn_blocked_at(SpawnBlockedAtInput {
            x: 0.0,
            z: 0.0,
            foot_y: 3.2,
            body_top: 5.0,
            radius: 0.45,
            colliders: vec![PlayerColliderInput {
                kind: Some("deck".into()),
                bottom_y: Some(3.0),
                top_y: Some(3.15),
                ..wall_box()
            }],
        });
        assert!(!blocked);
    }

    #[test]
    fn push_circle_moves_out_of_wall() {
        let output = push_circle_out_of_colliders(PushCircleOutInput {
            x: 0.8,
            z: 0.0,
            radius: 0.35,
            colliders: vec![wall_box()],
            foot_y: Some(0.0),
            body_top: Some(2.0),
            skip_target_meshes: true,
        });
        assert!(output.x > 1.0);
    }
}
