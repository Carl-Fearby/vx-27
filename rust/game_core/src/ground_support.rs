use crate::collision::rotated_box_overlaps_circle;
use crate::player_collision::PlayerColliderInput;
use crate::spawn_foot_y::{point_in_floor_hole, FloorHoleInput as SpawnFloorHoleInput};
use serde::de::IgnoredAny;
use serde::{Deserialize, Deserializer, Serialize};

const STEP_UP_MAX: f64 = 0.42;
const FLAT_LAND_REACH: f64 = 2.5;
const FOOT_SAMPLE_RADIUS_SCALE: f64 = 0.85;

#[derive(Deserialize)]
#[serde(untagged)]
enum BoolOrRuntimeObject {
    Bool(bool),
    RuntimeObject(IgnoredAny),
}

fn bool_or_runtime_object<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: Deserializer<'de>,
{
    let value = Option::<BoolOrRuntimeObject>::deserialize(deserializer)?;
    Ok(match value {
        Some(BoolOrRuntimeObject::Bool(value)) => value,
        Some(BoolOrRuntimeObject::RuntimeObject(_)) => true,
        None => false,
    })
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroundSurfaceInput {
    pub min_x: Option<f64>,
    pub max_x: Option<f64>,
    pub min_z: Option<f64>,
    pub max_z: Option<f64>,
    pub y: Option<f64>,
    #[serde(default)]
    #[serde(deserialize_with = "bool_or_runtime_object")]
    pub stair_flight: bool,
    #[serde(default)]
    pub stair_ramp: bool,
    #[serde(default)]
    pub room_interior_floor: bool,
    #[serde(default)]
    pub catwalk_walk: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FloorHoleInput {
    pub x: f64,
    pub z: f64,
    pub radius: f64,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArenaBoundsInput {
    pub min_x: f64,
    pub max_x: f64,
    pub min_z: f64,
    pub max_z: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SampleFlatSupportInput {
    pub x: f64,
    pub z: f64,
    pub foot_y: f64,
    pub body_top: f64,
    pub floor_y: f64,
    pub player_radius: f64,
    #[serde(default)]
    pub on_arena_catwalk_deck: bool,
    #[serde(default)]
    pub on_room_catwalk_deck: bool,
    #[serde(default)]
    pub catwalk_deck_support_y: Option<f64>,
    pub floor_bounds: Option<ArenaBoundsInput>,
    pub floor_holes: Vec<FloorHoleInput>,
    pub ground_surfaces: Vec<GroundSurfaceInput>,
    pub colliders: Vec<PlayerColliderInput>,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SampleFlatSupportOutput {
    pub best_flat: f64,
    pub highest_step_up: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveSupportInfoInput {
    pub x: f64,
    pub z: f64,
    pub foot_y: f64,
    pub floor_y: f64,
    pub player_radius: f64,
    pub ramp_y: Option<f64>,
    pub step_up_flat: f64,
    pub best_flat: f64,
    pub climb_local_motion: f64,
    pub stair_local_z: Option<f64>,
    #[serde(default)]
    pub on_arena_catwalk_deck: bool,
    #[serde(default)]
    pub on_room_catwalk_deck: bool,
    #[serde(default)]
    pub catwalk_deck_support_y: Option<f64>,
    pub floor_bounds: Option<ArenaBoundsInput>,
    pub floor_holes: Vec<FloorHoleInput>,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupportInfoOutput {
    pub support_y: f64,
    pub on_stairs: bool,
    pub stair_ramp: bool,
}

fn to_spawn_holes(holes: &[FloorHoleInput]) -> Vec<SpawnFloorHoleInput> {
    holes
        .iter()
        .map(|h| SpawnFloorHoleInput {
            x: h.x,
            z: h.z,
            radius: h.radius,
        })
        .collect()
}

fn point_in_surface_bounds(x: f64, z: f64, surf: &GroundSurfaceInput) -> bool {
    let (Some(min_x), Some(max_x), Some(min_z), Some(max_z)) =
        (surf.min_x, surf.max_x, surf.min_z, surf.max_z)
    else {
        return false;
    };
    x >= min_x && x <= max_x && z >= min_z && z <= max_z
}

fn capsule_overlaps_surface(x: f64, z: f64, radius: f64, surf: &GroundSurfaceInput) -> bool {
    let (Some(min_x), Some(max_x), Some(min_z), Some(max_z)) =
        (surf.min_x, surf.max_x, surf.min_z, surf.max_z)
    else {
        return false;
    };
    let closest_x = x.clamp(min_x, max_x);
    let closest_z = z.clamp(min_z, max_z);
    let dx = x - closest_x;
    let dz = z - closest_z;
    dx * dx + dz * dz <= radius * radius
}

fn elevated_surface_supports_body(x: f64, z: f64, radius: f64, surf: &GroundSurfaceInput) -> bool {
    if surf.catwalk_walk {
        return point_in_surface_bounds(x, z, surf);
    }
    capsule_overlaps_surface(x, z, radius, surf)
}

fn has_implicit_floor_support(
    x: f64,
    z: f64,
    _floor_y: f64,
    radius: f64,
    floor_bounds: Option<ArenaBoundsInput>,
    floor_holes: &[FloorHoleInput],
) -> bool {
    if let Some(fb) = floor_bounds {
        if x < fb.min_x || x > fb.max_x || z < fb.min_z || z > fb.max_z {
            return false;
        }
    }
    !point_in_floor_hole(x, z, &to_spawn_holes(floor_holes), radius)
}

fn flat_surface_blocked_by_hole(
    x: f64,
    z: f64,
    surf_y: f64,
    floor_y: f64,
    radius: f64,
    floor_holes: &[FloorHoleInput],
) -> bool {
    surf_y <= floor_y + 0.02 && point_in_floor_hole(x, z, &to_spawn_holes(floor_holes), radius)
}

fn sample_collider_ledge_top(
    sx: f64,
    sz: f64,
    foot_y: f64,
    body_top: f64,
    min_support_y: f64,
    radius: f64,
    colliders: &[PlayerColliderInput],
) -> Option<f64> {
    let mut best = f64::NEG_INFINITY;
    let max_top = foot_y + STEP_UP_MAX + 0.06;
    for box_ in colliders {
        if !box_.active {
            continue;
        }
        let Some(top_y) = box_.top_y else {
            continue;
        };
        if top_y < min_support_y || top_y > max_top {
            continue;
        }
        if body_top <= top_y + 0.02 {
            continue;
        }
        let reach = box_.half_x.max(box_.half_z) + radius;
        if (sx - box_.x).abs() > reach || (sz - box_.z).abs() > reach {
            continue;
        }
        if !rotated_box_overlaps_circle(box_.footprint(), sx, sz, radius) {
            continue;
        }
        if top_y <= foot_y + STEP_UP_MAX + 0.02 {
            best = best.max(top_y);
        }
    }
    if best.is_finite() {
        Some(best)
    } else {
        None
    }
}

pub fn sample_flat_support_at(input: SampleFlatSupportInput) -> SampleFlatSupportOutput {
    let mut best_at_or_below = f64::NEG_INFINITY;
    let mut best_step_up = f64::NEG_INFINITY;
    let mut best_fall_reach = f64::NEG_INFINITY;
    let mut highest_step_up = f64::NEG_INFINITY;

    let min_support_y = if input.on_arena_catwalk_deck || input.on_room_catwalk_deck {
        input.catwalk_deck_support_y.unwrap_or(input.foot_y) - 0.1
    } else {
        f64::NEG_INFINITY
    };

    let sample_r = input.player_radius * FOOT_SAMPLE_RADIUS_SCALE;
    let samples: [(f64, f64); 5] = [
        (0.0, 0.0),
        (sample_r, 0.0),
        (-sample_r, 0.0),
        (0.0, sample_r),
        (0.0, -sample_r),
    ];

    for (dx, dz) in samples {
        let sx = input.x + dx;
        let sz = input.z + dz;

        if has_implicit_floor_support(
            sx,
            sz,
            input.floor_y,
            input.player_radius,
            input.floor_bounds,
            &input.floor_holes,
        ) && input.foot_y < input.floor_y + 3.0
        {
            if input.foot_y <= input.floor_y + 0.02 {
                best_at_or_below = best_at_or_below.max(input.floor_y);
            } else if input.foot_y <= input.floor_y + STEP_UP_MAX && input.foot_y < input.floor_y + 2.0
            {
                best_step_up = best_step_up.max(input.floor_y);
                highest_step_up = highest_step_up.max(input.floor_y);
            } else if input.foot_y <= input.floor_y + 0.05
                && input.foot_y >= input.floor_y - FLAT_LAND_REACH
            {
                best_fall_reach = best_fall_reach.max(input.floor_y);
            }
        }

        for surf in &input.ground_surfaces {
            if surf.stair_flight || surf.stair_ramp {
                continue;
            }
            if surf.room_interior_floor && input.foot_y >= input.floor_y + 3.0 {
                continue;
            }
            if let Some(y) = surf.y {
                if y <= input.floor_y + 0.02 && input.foot_y >= input.floor_y + 3.0 {
                    continue;
                }
                if y < min_support_y {
                    continue;
                }
            }
            if let Some(y) = surf.y {
                if y > input.floor_y + 2.0
                    && !elevated_surface_supports_body(sx, sz, input.player_radius, surf)
                {
                    continue;
                }
            }
            if !point_in_surface_bounds(sx, sz, surf) {
                continue;
            }
            let surf_y = surf.y.unwrap_or(input.floor_y);
            if flat_surface_blocked_by_hole(
                sx,
                sz,
                surf_y,
                input.floor_y,
                input.player_radius,
                &input.floor_holes,
            ) {
                continue;
            }
            if surf_y <= input.foot_y + 0.02 {
                best_at_or_below = best_at_or_below.max(surf_y);
            } else if surf_y <= input.foot_y + STEP_UP_MAX {
                best_step_up = best_step_up.max(surf_y);
                highest_step_up = highest_step_up.max(surf_y);
            } else if input.foot_y <= surf_y + 0.05 && input.foot_y >= surf_y - FLAT_LAND_REACH {
                best_fall_reach = best_fall_reach.max(surf_y);
            }
        }

        if let Some(ledge_y) = sample_collider_ledge_top(
            sx,
            sz,
            input.foot_y,
            input.body_top,
            min_support_y,
            input.player_radius,
            &input.colliders,
        ) {
            if ledge_y <= input.foot_y + 0.02 {
                best_at_or_below = best_at_or_below.max(ledge_y);
            } else if ledge_y <= input.foot_y + STEP_UP_MAX {
                best_step_up = best_step_up.max(ledge_y);
                highest_step_up = highest_step_up.max(ledge_y);
            } else if input.foot_y <= ledge_y + 0.05 && input.foot_y >= ledge_y - FLAT_LAND_REACH {
                best_fall_reach = best_fall_reach.max(ledge_y);
            }
        }
    }

    let mut best_flat = best_at_or_below;
    if !best_flat.is_finite() {
        best_flat = best_step_up;
    }
    if !best_flat.is_finite() {
        best_flat = best_fall_reach;
    }

    SampleFlatSupportOutput {
        best_flat,
        highest_step_up,
    }
}

fn stabilize_catwalk_support(
    on_deck: bool,
    catwalk_deck_y: Option<f64>,
    support_y: f64,
) -> f64 {
    if !support_y.is_finite() || !on_deck {
        return support_y;
    }
    if let Some(deck_y) = catwalk_deck_y {
        support_y.max(deck_y)
    } else {
        support_y
    }
}

fn finish_support_info(
    input: &ResolveSupportInfoInput,
    support_y: f64,
    on_stairs: bool,
    stair_ramp: bool,
) -> SupportInfoOutput {
    let on_deck = input.on_arena_catwalk_deck || input.on_room_catwalk_deck;
    let mut y = stabilize_catwalk_support(on_deck, input.catwalk_deck_support_y, support_y);
    if !stair_ramp
        && !on_stairs
        && input.foot_y < input.floor_y + 3.0
        && y.is_finite()
        && y < input.floor_y - 0.001
        && has_implicit_floor_support(
            input.x,
            input.z,
            input.floor_y,
            input.player_radius,
            input.floor_bounds,
            &input.floor_holes,
        )
    {
        y = input.floor_y;
    }
    SupportInfoOutput {
        support_y: y,
        on_stairs,
        stair_ramp,
    }
}

pub fn resolve_support_info(input: ResolveSupportInfoInput) -> SupportInfoOutput {
    let mut best_flat = input.best_flat;
    let step_up_flat = input.step_up_flat;

    if input.ramp_y.is_none()
        && step_up_flat.is_finite()
        && best_flat.is_finite()
        && step_up_flat > best_flat + 0.01
        && input.foot_y >= step_up_flat - STEP_UP_MAX
    {
        best_flat = step_up_flat;
    }

    if let Some(ramp_y) = input.ramp_y {
        let deck_y = if step_up_flat.is_finite() && step_up_flat > ramp_y + 0.01 {
            Some(step_up_flat)
        } else {
            None
        };

        if let Some(deck_y) = deck_y {
            let can_step_to_deck = input.foot_y >= deck_y - STEP_UP_MAX
                && ramp_y >= deck_y - 0.15
                && input.foot_y < deck_y - 0.01;
            if can_step_to_deck {
                return finish_support_info(&input, deck_y, false, false);
            }

            let ramp_below_deck = ramp_y < deck_y - 0.005;
            let on_stair_top_flat = !ramp_below_deck
                && input.foot_y >= deck_y - 0.08
                && input.foot_y <= deck_y + 0.08;
            if on_stair_top_flat && step_up_flat.is_finite() && step_up_flat >= deck_y - 0.02 {
                return finish_support_info(&input, step_up_flat, false, false);
            }

            let should_follow_ramp = ramp_below_deck
                && (input.foot_y > ramp_y + 0.008 || input.foot_y >= deck_y - 0.04);
            if should_follow_ramp {
                return finish_support_info(&input, ramp_y, true, true);
            }

            if input.foot_y >= deck_y - 0.05 && !ramp_below_deck {
                return finish_support_info(&input, deck_y, false, false);
            }
        }

        if let Some(stair_local_z) = input.stair_local_z {
            if stair_local_z <= 0.2
                && stair_local_z >= -0.45
                && ramp_y <= input.floor_y + 0.12
                && input.climb_local_motion <= 0.12
                && best_flat.is_finite()
                && best_flat <= input.floor_y + 0.02
                && input.foot_y <= input.floor_y + 0.1
            {
                return finish_support_info(&input, best_flat, false, false);
            }
        }

        return finish_support_info(&input, ramp_y, true, true);
    }

    if !best_flat.is_finite()
        && has_implicit_floor_support(
            input.x,
            input.z,
            input.floor_y,
            input.player_radius,
            input.floor_bounds,
            &input.floor_holes,
        )
        && input.foot_y <= input.floor_y + FLAT_LAND_REACH
    {
        best_flat = input.floor_y;
    }

    finish_support_info(&input, best_flat, false, false)
}
