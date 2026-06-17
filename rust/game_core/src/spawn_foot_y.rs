use crate::collision::{rotated_box_overlaps_circle, ColliderBoxInput};
use crate::player_collision::{spawn_blocked_at, PlayerColliderInput, SpawnBlockedAtInput};
use serde::de::IgnoredAny;
use serde::{Deserialize, Deserializer, Serialize};

const SPAWN_FOOTPRINT_MAX_DELTA: f64 = 0.06;

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

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FloorHoleInput {
    pub x: f64,
    pub z: f64,
    #[serde(default)]
    pub radius: f64,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FloorBoundsInput {
    pub min_x: f64,
    pub max_x: f64,
    pub min_z: f64,
    pub max_z: f64,
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
    pub stair_ramp: bool,
    #[serde(default)]
    #[serde(deserialize_with = "bool_or_runtime_object")]
    pub stair_flight: bool,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnFootprintSampleInput {
    pub sx: f64,
    pub sz: f64,
    pub in_stair_footprint: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveSpawnFootYInput {
    pub x: f64,
    pub z: f64,
    pub height: f64,
    pub radius: f64,
    pub floor_y: f64,
    pub floor_bounds: Option<FloorBoundsInput>,
    pub floor_holes: Vec<FloorHoleInput>,
    pub ground_surfaces: Vec<GroundSurfaceInput>,
    pub colliders: Vec<PlayerColliderInput>,
    pub footprint_samples: Vec<SpawnFootprintSampleInput>,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveSpawnFootYOutput {
    pub found: bool,
    pub foot_y: f64,
}

pub fn point_in_floor_hole(x: f64, z: f64, holes: &[FloorHoleInput], inset: f64) -> bool {
    for hole in holes {
        let dx = x - hole.x;
        let dz = z - hole.z;
        let r = (hole.radius - inset).max(0.0);
        if dx * dx + dz * dz < r * r {
            return true;
        }
    }
    false
}

fn is_stair_step_collider_kind(kind: Option<&str>) -> bool {
    matches!(kind, Some("stairBackSlice") | Some("stairTread"))
}

fn collider_footprint(collider: &PlayerColliderInput) -> ColliderBoxInput {
    ColliderBoxInput {
        x: collider.x,
        z: collider.z,
        half_x: collider.half_x,
        half_z: collider.half_z,
        rotation_y: collider.rotation_y,
        corner_radius: collider.corner_radius,
    }
}

fn stair_step_top_at(sx: f64, sz: f64, colliders: &[PlayerColliderInput]) -> Option<f64> {
    let mut best: Option<f64> = None;
    for collider in colliders {
        if !collider.active {
            continue;
        }
        let top_y = collider.top_y?;
        let kind = collider.kind.as_deref();
        let footprint = collider_footprint(collider);
        if kind == Some("stairSideTop") {
            if !rotated_box_overlaps_circle(footprint, sx, sz, 0.05) {
                continue;
            }
            best = Some(best.map_or(top_y, |current| current.max(top_y)));
            continue;
        }
        if !is_stair_step_collider_kind(kind) {
            continue;
        }
        if !rotated_box_overlaps_circle(footprint, sx, sz, 0.05) {
            continue;
        }
        best = Some(best.map_or(top_y, |current| current.max(top_y)));
    }
    best
}

fn sample_spawn_support_y_at(
    sx: f64,
    sz: f64,
    ground_surfaces: &[GroundSurfaceInput],
    floor_y: f64,
    floor_bounds: Option<&FloorBoundsInput>,
    floor_holes: &[FloorHoleInput],
) -> Option<f64> {
    let in_floor_bounds = floor_bounds.is_none_or(|bounds| {
        sx >= bounds.min_x && sx <= bounds.max_x && sz >= bounds.min_z && sz <= bounds.max_z
    });
    let on_implicit_floor = in_floor_bounds && !point_in_floor_hole(sx, sz, floor_holes, 0.0);

    let mut best = f64::NEG_INFINITY;
    for surf in ground_surfaces {
        if surf.stair_ramp || surf.stair_flight {
            continue;
        }
        let (Some(min_x), Some(max_x), Some(min_z), Some(max_z)) =
            (surf.min_x, surf.max_x, surf.min_z, surf.max_z)
        else {
            continue;
        };
        if sx < min_x || sx > max_x || sz < min_z || sz > max_z {
            continue;
        }
        let Some(surf_y) = surf.y else {
            continue;
        };
        if surf_y <= floor_y + 0.02 && point_in_floor_hole(sx, sz, floor_holes, 0.0) {
            continue;
        }
        best = best.max(surf_y);
    }
    if on_implicit_floor {
        best = best.max(floor_y);
    }
    best.is_finite().then_some(best)
}

pub fn resolve_spawn_foot_y(input: ResolveSpawnFootYInput) -> ResolveSpawnFootYOutput {
    let mut support_ys = Vec::with_capacity(input.footprint_samples.len());
    for sample in &input.footprint_samples {
        let y = if sample.in_stair_footprint {
            stair_step_top_at(sample.sx, sample.sz, &input.colliders)
        } else {
            sample_spawn_support_y_at(
                sample.sx,
                sample.sz,
                &input.ground_surfaces,
                input.floor_y,
                input.floor_bounds.as_ref(),
                &input.floor_holes,
            )
        };
        let Some(y) = y else {
            return ResolveSpawnFootYOutput {
                found: false,
                foot_y: 0.0,
            };
        };
        support_ys.push(y);
    }

    let min_y = support_ys.iter().copied().fold(f64::INFINITY, f64::min);
    let max_y = support_ys.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    if max_y - min_y > SPAWN_FOOTPRINT_MAX_DELTA {
        return ResolveSpawnFootYOutput {
            found: false,
            foot_y: 0.0,
        };
    }

    let foot_y = max_y;
    let body_top = foot_y + input.height;
    if spawn_blocked_at(SpawnBlockedAtInput {
        x: input.x,
        z: input.z,
        foot_y,
        body_top,
        radius: input.radius,
        colliders: input.colliders,
    }) {
        return ResolveSpawnFootYOutput {
            found: false,
            foot_y: 0.0,
        };
    }

    ResolveSpawnFootYOutput { found: true, foot_y }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn point_in_floor_hole_respects_inset() {
        let holes = vec![FloorHoleInput {
            x: 0.0,
            z: 0.0,
            radius: 2.0,
        }];
        assert!(point_in_floor_hole(0.5, 0.0, &holes, 0.0));
        assert!(!point_in_floor_hole(1.9, 0.0, &holes, 0.5));
    }

    #[test]
    fn resolve_spawn_foot_y_on_flat_floor() {
        let output = resolve_spawn_foot_y(ResolveSpawnFootYInput {
            x: 0.0,
            z: 0.0,
            height: 2.0,
            radius: 0.45,
            floor_y: 0.0,
            floor_bounds: None,
            floor_holes: vec![],
            ground_surfaces: vec![],
            colliders: vec![],
            footprint_samples: vec![
                SpawnFootprintSampleInput {
                    sx: 0.0,
                    sz: 0.0,
                    in_stair_footprint: false,
                },
                SpawnFootprintSampleInput {
                    sx: 0.2,
                    sz: 0.0,
                    in_stair_footprint: false,
                },
            ],
        });
        assert!(output.found);
        assert!((output.foot_y - 0.0).abs() < 0.0001);
    }

    #[test]
    fn resolve_spawn_foot_y_rejects_uneven_footprint() {
        let output = resolve_spawn_foot_y(ResolveSpawnFootYInput {
            x: 0.0,
            z: 0.0,
            height: 2.0,
            radius: 0.45,
            floor_y: 0.0,
            floor_bounds: None,
            floor_holes: vec![],
            ground_surfaces: vec![
                GroundSurfaceInput {
                    min_x: Some(-1.0),
                    max_x: Some(1.0),
                    min_z: Some(-1.0),
                    max_z: Some(1.0),
                    y: Some(0.0),
                    stair_ramp: false,
                    stair_flight: false,
                },
                GroundSurfaceInput {
                    min_x: Some(4.0),
                    max_x: Some(6.0),
                    min_z: Some(-1.0),
                    max_z: Some(1.0),
                    y: Some(3.0),
                    stair_ramp: false,
                    stair_flight: false,
                },
            ],
            colliders: vec![],
            footprint_samples: vec![
                SpawnFootprintSampleInput {
                    sx: 0.0,
                    sz: 0.0,
                    in_stair_footprint: false,
                },
                SpawnFootprintSampleInput {
                    sx: 5.0,
                    sz: 0.0,
                    in_stair_footprint: false,
                },
            ],
        });
        assert!(!output.found);
    }
}
