use crate::player_collision::{spawn_blocked_at, PlayerColliderInput, SpawnBlockedAtInput};
use crate::spawn_foot_y::{
    resolve_spawn_foot_y, FloorBoundsInput, FloorHoleInput, GroundSurfaceInput,
    ResolveSpawnFootYInput, SpawnFootprintSampleInput,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArenaBounds {
    pub min_x: f64,
    pub max_x: f64,
    pub min_z: f64,
    pub max_z: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetOccupant {
    pub x: f64,
    pub z: f64,
    pub alive: bool,
    pub visible: bool,
    #[serde(default)]
    pub skip: bool,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnRange {
    pub min_x: f64,
    pub max_x: f64,
    pub min_z: f64,
    pub max_z: f64,
    pub valid: bool,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickRandomSpawnOutput {
    pub found: bool,
    pub x: f64,
    pub z: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PickRandomSpawnInput {
    pub bounds: ArenaBounds,
    pub radius: f64,
    pub margin: f64,
    pub max_attempts: u32,
    pub rolls: Vec<f64>,
    pub occupants: Vec<TargetOccupant>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetRespawnSpawnPointInput {
    pub x: f64,
    pub z: f64,
    pub y: Option<f64>,
    pub yaw: Option<f64>,
    #[serde(default)]
    pub random: bool,
    pub chance: Option<f64>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetRespawnPlacementInput {
    pub bounds: ArenaBounds,
    pub radius: f64,
    pub margin: f64,
    pub height: f64,
    pub floor_y: f64,
    pub floor_bounds: Option<FloorBoundsInput>,
    pub floor_holes: Vec<FloorHoleInput>,
    pub ground_surfaces: Vec<GroundSurfaceInput>,
    pub colliders: Vec<PlayerColliderInput>,
    pub targets: Vec<TargetOccupant>,
    #[serde(default = "default_max_attempts")]
    pub max_attempts: u32,
    pub random_rolls: Vec<f64>,
    pub fixed_spawn: Option<TargetRespawnSpawnPointInput>,
    pub spawn_point_roll: Option<f64>,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetRespawnPlacementOutput {
    pub found: bool,
    pub x: f64,
    pub z: f64,
    pub y: f64,
    pub yaw: Option<f64>,
}

fn default_max_attempts() -> u32 {
    100
}

pub fn compute_spawn_range(bounds: ArenaBounds, radius: f64, margin: f64) -> SpawnRange {
    let pad = radius + margin;
    let min_x = bounds.min_x + pad;
    let max_x = bounds.max_x - pad;
    let min_z = bounds.min_z + pad;
    let max_z = bounds.max_z - pad;
    SpawnRange {
        min_x,
        max_x,
        min_z,
        max_z,
        valid: min_x < max_x && min_z < max_z,
    }
}

pub fn lerp_spawn_coord(min: f64, max: f64, roll: f64) -> f64 {
    min + (max - min) * roll.clamp(0.0, 1.0)
}

pub fn position_in_authored_bounds(
    x: f64,
    z: f64,
    bounds: ArenaBounds,
    radius: f64,
    margin: f64,
) -> bool {
    let pad = radius + margin;
    x >= bounds.min_x + pad
        && x <= bounds.max_x - pad
        && z >= bounds.min_z + pad
        && z <= bounds.max_z - pad
}

pub fn overlaps_targets(x: f64, z: f64, radius: f64, margin: f64, occupants: &[TargetOccupant]) -> bool {
    let min_dist = radius * 2.0 + margin;
    let min_dist_sq = min_dist * min_dist;
    for occupant in occupants {
        if occupant.skip {
            continue;
        }
        if !occupant.alive || !occupant.visible {
            continue;
        }
        let dx = x - occupant.x;
        let dz = z - occupant.z;
        if dx * dx + dz * dz < min_dist_sq {
            return true;
        }
    }
    false
}

pub fn should_spawn_authored_point(is_random: bool, roll: f64, chance: f64) -> bool {
    if !is_random {
        return true;
    }
    roll < chance.clamp(0.0, 1.0)
}

pub fn pick_random_spawn_xz(input: PickRandomSpawnInput) -> PickRandomSpawnOutput {
    let range = compute_spawn_range(input.bounds, input.radius, input.margin);
    if !range.valid {
        return PickRandomSpawnOutput {
            found: false,
            x: 0.0,
            z: 0.0,
        };
    }

    let max_attempts = input.max_attempts.max(1) as usize;
    let needed_rolls = max_attempts * 2;
    let rolls = if input.rolls.len() >= needed_rolls {
        &input.rolls[..needed_rolls]
    } else {
        return PickRandomSpawnOutput {
            found: false,
            x: 0.0,
            z: 0.0,
        };
    };

    for attempt in 0..max_attempts {
        let roll_x = rolls[attempt * 2];
        let roll_z = rolls[attempt * 2 + 1];
        let x = lerp_spawn_coord(range.min_x, range.max_x, roll_x);
        let z = lerp_spawn_coord(range.min_z, range.max_z, roll_z);
        if overlaps_targets(x, z, input.radius, input.margin, &input.occupants) {
            continue;
        }
        return PickRandomSpawnOutput { found: true, x, z };
    }

    PickRandomSpawnOutput {
        found: false,
        x: 0.0,
        z: 0.0,
    }
}

fn point_in_stair_footprint(sx: f64, sz: f64, ground_surfaces: &[GroundSurfaceInput]) -> bool {
    ground_surfaces.iter().any(|surf| {
        if !surf.stair_flight && !surf.stair_ramp {
            return false;
        }
        let (Some(min_x), Some(max_x), Some(min_z), Some(max_z)) =
            (surf.min_x, surf.max_x, surf.min_z, surf.max_z)
        else {
            return false;
        };
        sx >= min_x && sx <= max_x && sz >= min_z && sz <= max_z
    })
}

fn spawn_footprint_samples(
    x: f64,
    z: f64,
    radius: f64,
    ground_surfaces: &[GroundSurfaceInput],
) -> Vec<SpawnFootprintSampleInput> {
    const SPAWN_FOOTPRINT_INSET: f64 = 0.85;
    let r = radius * SPAWN_FOOTPRINT_INSET;
    vec![
        SpawnFootprintSampleInput {
            sx: x,
            sz: z,
            in_stair_footprint: point_in_stair_footprint(x, z, ground_surfaces),
        },
        SpawnFootprintSampleInput {
            sx: x + r,
            sz: z,
            in_stair_footprint: point_in_stair_footprint(x + r, z, ground_surfaces),
        },
        SpawnFootprintSampleInput {
            sx: x - r,
            sz: z,
            in_stair_footprint: point_in_stair_footprint(x - r, z, ground_surfaces),
        },
        SpawnFootprintSampleInput {
            sx: x,
            sz: z + r,
            in_stair_footprint: point_in_stair_footprint(x, z + r, ground_surfaces),
        },
        SpawnFootprintSampleInput {
            sx: x,
            sz: z - r,
            in_stair_footprint: point_in_stair_footprint(x, z - r, ground_surfaces),
        },
    ]
}

fn resolve_spawn_foot_y_for_respawn(
    x: f64,
    z: f64,
    height: f64,
    radius: f64,
    floor_y: f64,
    floor_bounds: Option<FloorBoundsInput>,
    floor_holes: &[FloorHoleInput],
    ground_surfaces: &[GroundSurfaceInput],
    colliders: &[PlayerColliderInput],
) -> Option<f64> {
    let output = resolve_spawn_foot_y(ResolveSpawnFootYInput {
        x,
        z,
        height,
        radius,
        floor_y,
        floor_bounds,
        floor_holes: floor_holes.to_vec(),
        ground_surfaces: ground_surfaces.to_vec(),
        colliders: colliders.to_vec(),
        footprint_samples: spawn_footprint_samples(x, z, radius, ground_surfaces),
    });
    output.found.then_some(output.foot_y)
}

fn pick_random_spawn_placement(
    bounds: ArenaBounds,
    radius: f64,
    margin: f64,
    height: f64,
    floor_y: f64,
    floor_bounds: Option<FloorBoundsInput>,
    floor_holes: &[FloorHoleInput],
    ground_surfaces: &[GroundSurfaceInput],
    colliders: &[PlayerColliderInput],
    targets: &[TargetOccupant],
    max_attempts: u32,
    random_rolls: &[f64],
) -> TargetRespawnPlacementOutput {
    let range = compute_spawn_range(bounds, radius, margin);
    if !range.valid {
        return TargetRespawnPlacementOutput {
            found: false,
            x: 0.0,
            z: 0.0,
            y: 0.0,
            yaw: None,
        };
    }

    let max_attempts = max_attempts.max(1) as usize;
    let needed_rolls = max_attempts * 2;
    if random_rolls.len() < needed_rolls {
        return TargetRespawnPlacementOutput {
            found: false,
            x: 0.0,
            z: 0.0,
            y: 0.0,
            yaw: None,
        };
    }

    for attempt in 0..max_attempts {
        let roll_x = random_rolls[attempt * 2];
        let roll_z = random_rolls[attempt * 2 + 1];
        let x = lerp_spawn_coord(range.min_x, range.max_x, roll_x);
        let z = lerp_spawn_coord(range.min_z, range.max_z, roll_z);
        if overlaps_targets(x, z, radius, margin, targets) {
            continue;
        }
        let Some(foot_y) = resolve_spawn_foot_y_for_respawn(
            x,
            z,
            height,
            radius,
            floor_y,
            floor_bounds,
            floor_holes,
            ground_surfaces,
            colliders,
        ) else {
            continue;
        };
        return TargetRespawnPlacementOutput {
            found: true,
            x,
            z,
            y: foot_y,
            yaw: None,
        };
    }

    TargetRespawnPlacementOutput {
        found: false,
        x: 0.0,
        z: 0.0,
        y: 0.0,
        yaw: None,
    }
}

pub fn resolve_target_respawn_placement(
    input: TargetRespawnPlacementInput,
) -> TargetRespawnPlacementOutput {
    let TargetRespawnPlacementInput {
        bounds,
        radius,
        margin,
        height,
        floor_y,
        floor_bounds,
        floor_holes,
        ground_surfaces,
        colliders,
        targets,
        max_attempts,
        random_rolls,
        fixed_spawn,
        spawn_point_roll,
    } = input;

    if let Some(spawn_point) = fixed_spawn {
        if spawn_point.random {
            let roll = spawn_point_roll.unwrap_or(1.0);
            let chance = spawn_point.chance.unwrap_or(0.5);
            if !should_spawn_authored_point(true, roll, chance) {
                return TargetRespawnPlacementOutput {
                    found: false,
                    x: 0.0,
                    z: 0.0,
                    y: 0.0,
                    yaw: None,
                };
            }
        }

        if !position_in_authored_bounds(
            spawn_point.x,
            spawn_point.z,
            bounds,
            radius,
            margin,
        ) {
            return TargetRespawnPlacementOutput {
                found: false,
                x: 0.0,
                z: 0.0,
                y: 0.0,
                yaw: None,
            };
        }

        if let Some(foot_y) = spawn_point.y {
            let body_top = foot_y + height;
            if overlaps_targets(
                spawn_point.x,
                spawn_point.z,
                radius,
                margin,
                &targets,
            ) {
                return TargetRespawnPlacementOutput {
                    found: false,
                    x: 0.0,
                    z: 0.0,
                    y: 0.0,
                    yaw: None,
                };
            }
            if spawn_blocked_at(SpawnBlockedAtInput {
                x: spawn_point.x,
                z: spawn_point.z,
                foot_y,
                body_top,
                radius,
                colliders,
            }) {
                return TargetRespawnPlacementOutput {
                    found: false,
                    x: 0.0,
                    z: 0.0,
                    y: 0.0,
                    yaw: None,
                };
            }
            return TargetRespawnPlacementOutput {
                found: true,
                x: spawn_point.x,
                z: spawn_point.z,
                y: foot_y,
                yaw: spawn_point.yaw,
            };
        }

        if let Some(foot_y) = resolve_spawn_foot_y_for_respawn(
            spawn_point.x,
            spawn_point.z,
            height,
            radius,
            floor_y,
            floor_bounds,
            &floor_holes,
            &ground_surfaces,
            &colliders,
        ) {
            return TargetRespawnPlacementOutput {
                found: true,
                x: spawn_point.x,
                z: spawn_point.z,
                y: foot_y,
                yaw: spawn_point.yaw,
            };
        }

        return TargetRespawnPlacementOutput {
            found: false,
            x: 0.0,
            z: 0.0,
            y: 0.0,
            yaw: None,
        };
    }

    pick_random_spawn_placement(
        bounds,
        radius,
        margin,
        height,
        floor_y,
        floor_bounds,
        &floor_holes,
        &ground_surfaces,
        &colliders,
        &targets,
        max_attempts,
        &random_rolls,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_bounds() -> ArenaBounds {
        ArenaBounds {
            min_x: -10.0,
            max_x: 10.0,
            min_z: -10.0,
            max_z: 10.0,
        }
    }

    #[test]
    fn spawn_range_respects_padding() {
        let range = compute_spawn_range(test_bounds(), 0.45, 1.5);
        assert!(range.valid);
        assert!((range.min_x - (-8.05)).abs() < 0.0001);
        assert!((range.max_x - 8.05).abs() < 0.0001);
    }

    #[test]
    fn authored_bounds_rejects_outside_pad() {
        assert!(!position_in_authored_bounds(9.9, 0.0, test_bounds(), 0.45, 1.5));
        assert!(position_in_authored_bounds(0.0, 0.0, test_bounds(), 0.45, 1.5));
    }

    #[test]
    fn overlaps_targets_respects_skip_and_dead() {
        let occupants = vec![
            TargetOccupant {
                x: 0.0,
                z: 0.0,
                alive: true,
                visible: true,
                skip: false,
            },
            TargetOccupant {
                x: 5.0,
                z: 0.0,
                alive: false,
                visible: true,
                skip: false,
            },
        ];
        assert!(overlaps_targets(0.1, 0.0, 0.45, 1.5, &occupants));
        let skipped = vec![TargetOccupant {
            x: 0.0,
            z: 0.0,
            alive: true,
            visible: true,
            skip: true,
        }];
        assert!(!overlaps_targets(0.1, 0.0, 0.45, 1.5, &skipped));
        assert!(!overlaps_targets(5.1, 0.0, 0.45, 1.5, &occupants));
    }

    #[test]
    fn authored_random_roll_matches_js_threshold() {
        assert!(!should_spawn_authored_point(true, 0.6, 0.5));
        assert!(should_spawn_authored_point(true, 0.4, 0.5));
        assert!(should_spawn_authored_point(false, 0.99, 0.1));
    }

    #[test]
    fn pick_random_spawn_finds_open_spot() {
        let occupants = vec![TargetOccupant {
            x: 0.0,
            z: 0.0,
            alive: true,
            visible: true,
            skip: false,
        }];
        let mut rolls = Vec::with_capacity(40);
        for i in 0..20 {
            rolls.push(0.1 + (i as f64) * 0.04);
            rolls.push(0.2 + (i as f64) * 0.03);
        }
        let output = pick_random_spawn_xz(PickRandomSpawnInput {
            bounds: test_bounds(),
            radius: 0.45,
            margin: 1.5,
            max_attempts: 20,
            rolls,
            occupants,
        });
        assert!(output.found);
    }

    #[test]
    fn resolve_target_respawn_placement_accepts_fixed_spawn() {
        let output = resolve_target_respawn_placement(TargetRespawnPlacementInput {
            bounds: test_bounds(),
            radius: 0.45,
            margin: 1.5,
            height: 2.0,
            floor_y: 0.0,
            floor_bounds: None,
            floor_holes: vec![],
            ground_surfaces: vec![],
            colliders: vec![],
            targets: vec![],
            max_attempts: 1,
            random_rolls: vec![],
            spawn_point_roll: None,
            fixed_spawn: Some(TargetRespawnSpawnPointInput {
                x: 0.0,
                z: 0.0,
                y: Some(0.0),
                yaw: Some(1.5),
                random: false,
                chance: None,
            }),
        });
        assert!(output.found);
        assert!((output.x - 0.0).abs() < 0.0001);
        assert!((output.z - 0.0).abs() < 0.0001);
        assert!((output.y - 0.0).abs() < 0.0001);
        assert!((output.yaw.unwrap_or_default() - 1.5).abs() < 0.0001);
    }

    #[test]
    fn resolve_target_respawn_placement_falls_back_to_random() {
        let output = resolve_target_respawn_placement(TargetRespawnPlacementInput {
            bounds: test_bounds(),
            radius: 0.45,
            margin: 1.5,
            height: 2.0,
            floor_y: 0.0,
            floor_bounds: None,
            floor_holes: vec![],
            ground_surfaces: vec![],
            colliders: vec![],
            targets: vec![],
            max_attempts: 1,
            random_rolls: vec![0.5, 0.5],
            spawn_point_roll: None,
            fixed_spawn: None,
        });
        assert!(output.found);
        assert!(output.yaw.is_none());
    }

    #[test]
    fn resolve_target_respawn_placement_retries_after_invalid_foot_y() {
        let output = resolve_target_respawn_placement(TargetRespawnPlacementInput {
            bounds: test_bounds(),
            radius: 0.45,
            margin: 1.5,
            height: 2.0,
            floor_y: 0.0,
            floor_bounds: None,
            floor_holes: vec![FloorHoleInput {
                x: 0.0,
                z: 0.0,
                radius: 2.5,
            }],
            ground_surfaces: vec![],
            colliders: vec![],
            targets: vec![],
            max_attempts: 2,
            random_rolls: vec![0.5, 0.5, 0.99, 0.99],
            spawn_point_roll: None,
            fixed_spawn: None,
        });
        assert!(output.found);
        assert!(output.x.abs() > 1.0 || output.z.abs() > 1.0);
    }
}
