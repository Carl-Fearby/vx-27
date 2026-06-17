use crate::collision::{rotated_box_overlaps_circle, world_to_box_local, ColliderBoxInput};
use crate::projectile::{ProjectileIntegrateOutput, ProjectileVec3};
use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectileColliderInput {
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
    pub container_part: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveProjectileCollidersInput {
    pub pos: ProjectileVec3,
    pub vel: ProjectileVec3,
    pub radius: f64,
    pub colliders: Vec<ProjectileColliderInput>,
    #[serde(default = "default_restitution")]
    pub restitution: f64,
    #[serde(default = "default_friction")]
    pub friction: f64,
    #[serde(default = "default_passes")]
    pub passes: u32,
}

fn default_true() -> bool {
    true
}

fn default_restitution() -> f64 {
    0.69
}

fn default_friction() -> f64 {
    0.74
}

fn default_passes() -> u32 {
    1
}

impl ProjectileColliderInput {
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
}

fn box_local_offset_to_world(rotation_y: f64, lx: f64, lz: f64) -> (f64, f64) {
    if rotation_y.abs() < 1e-12 {
        return (lx, lz);
    }
    let c = rotation_y.cos();
    let s = rotation_y.sin();
    (c * lx + s * lz, -s * lx + c * lz)
}

fn box_local_point_to_world(collider: &ProjectileColliderInput, lx: f64, lz: f64) -> (f64, f64) {
    let (ox, oz) = box_local_offset_to_world(collider.rotation_y, lx, lz);
    (collider.x + ox, collider.z + oz)
}

fn apply_bounce(vel: &mut ProjectileVec3, nx: f64, ny: f64, nz: f64, rest: f64, friction: f64) {
    let v_dot_n = vel.x * nx + vel.y * ny + vel.z * nz;
    if v_dot_n >= 0.0 {
        return;
    }
    vel.x -= (1.0 + rest) * v_dot_n * nx;
    vel.y -= (1.0 + rest) * v_dot_n * ny;
    vel.z -= (1.0 + rest) * v_dot_n * nz;
    let damp = (1.0 - friction * 0.45).max(0.0);
    vel.x *= damp;
    vel.y *= damp;
    vel.z *= damp;
}

fn is_projectile_walk_slab(collider: &ProjectileColliderInput) -> bool {
    collider.kind.as_deref() == Some("deck")
        || collider.container_part.as_deref() == Some("floor")
}

fn resolve_sphere_against_walk_slab(
    pos: &mut ProjectileVec3,
    vel: &mut ProjectileVec3,
    radius: f64,
    collider: &ProjectileColliderInput,
    rest: f64,
    friction: f64,
) -> bool {
    let Some(bottom) = collider.bottom_y else {
        return false;
    };
    let Some(top) = collider.top_y else {
        return false;
    };
    if !bottom.is_finite() || !top.is_finite() {
        return false;
    }
    if !rotated_box_overlaps_circle(collider.footprint(), pos.x, pos.z, radius) {
        return false;
    }

    let py = pos.y;
    let damp = (1.0 - friction * 0.45).max(0.0);

    if vel.y <= 0.08 && py + radius >= top - 0.02 {
        let pen = top + radius - py;
        if pen > 0.001 {
            pos.y = top + radius;
            return true;
        }
    }

    if vel.y > 0.0 && py - radius <= bottom + 0.02 {
        let pen = py + radius - bottom;
        if pen > 0.001 {
            pos.y = bottom - radius;
            vel.y = -vel.y * rest;
            vel.x *= damp;
            vel.z *= damp;
            return true;
        }
    }

    false
}

fn resolve_sphere_against_one_box(
    pos: &mut ProjectileVec3,
    vel: &mut ProjectileVec3,
    radius: f64,
    collider: &ProjectileColliderInput,
    rest: f64,
    friction: f64,
) -> bool {
    let bottom = collider.bottom_y.unwrap_or(f64::NEG_INFINITY);
    let top = collider.top_y.unwrap_or(f64::INFINITY);
    let py = pos.y;

    if py + radius < bottom - 0.001 || py - radius > top + 0.001 {
        return false;
    }
    if !rotated_box_overlaps_circle(collider.footprint(), pos.x, pos.z, radius) {
        return false;
    }

    let local = world_to_box_local(collider.footprint(), pos.x, pos.z);
    let lx = local.x;
    let lz = local.z;

    if lx.abs() <= collider.half_x
        && lz.abs() <= collider.half_z
        && py >= bottom
        && py <= top
    {
        let push_neg_x = lx + collider.half_x + radius;
        let push_pos_x = collider.half_x - lx + radius;
        let push_neg_z = lz + collider.half_z + radius;
        let push_pos_z = collider.half_z - lz + radius;
        let push_down = py - bottom + radius;
        let push_up = top - py + radius;
        let min = push_neg_x
            .min(push_pos_x)
            .min(push_neg_z)
            .min(push_pos_z)
            .min(push_down)
            .min(push_up);

        let (nx, ny, nz) = if (min - push_down).abs() < 1e-9 {
            pos.y -= push_down;
            (0.0, -1.0, 0.0)
        } else if (min - push_up).abs() < 1e-9 {
            pos.y += push_up;
            (0.0, 1.0, 0.0)
        } else if (min - push_neg_x).abs() < 1e-9 {
            let (wx, wz) = box_local_offset_to_world(collider.rotation_y, -push_neg_x, 0.0);
            pos.x += wx;
            pos.z += wz;
            let (wnx, wnz) = box_local_offset_to_world(collider.rotation_y, -1.0, 0.0);
            let len = (wnx * wnx + wnz * wnz).sqrt().max(1.0);
            (wnx / len, 0.0, wnz / len)
        } else if (min - push_pos_x).abs() < 1e-9 {
            let (wx, wz) = box_local_offset_to_world(collider.rotation_y, push_pos_x, 0.0);
            pos.x += wx;
            pos.z += wz;
            let (wnx, wnz) = box_local_offset_to_world(collider.rotation_y, 1.0, 0.0);
            let len = (wnx * wnx + wnz * wnz).sqrt().max(1.0);
            (wnx / len, 0.0, wnz / len)
        } else if (min - push_neg_z).abs() < 1e-9 {
            let (wx, wz) = box_local_offset_to_world(collider.rotation_y, 0.0, -push_neg_z);
            pos.x += wx;
            pos.z += wz;
            let (wnx, wnz) = box_local_offset_to_world(collider.rotation_y, 0.0, -1.0);
            let len = (wnx * wnx + wnz * wnz).sqrt().max(1.0);
            (wnx / len, 0.0, wnz / len)
        } else {
            let (wx, wz) = box_local_offset_to_world(collider.rotation_y, 0.0, push_pos_z);
            pos.x += wx;
            pos.z += wz;
            let (wnx, wnz) = box_local_offset_to_world(collider.rotation_y, 0.0, 1.0);
            let len = (wnx * wnx + wnz * wnz).sqrt().max(1.0);
            (wnx / len, 0.0, wnz / len)
        };

        apply_bounce(vel, nx, ny, nz, rest, friction);
        return true;
    }

    let clamp_lx = lx.clamp(-collider.half_x, collider.half_x);
    let clamp_lz = lz.clamp(-collider.half_z, collider.half_z);
    let clamp_y = py.clamp(bottom, top);
    let (closest_x, closest_z) = box_local_point_to_world(collider, clamp_lx, clamp_lz);
    let wx = pos.x - closest_x;
    let wy = py - clamp_y;
    let wz = pos.z - closest_z;
    let dist_sq = wx * wx + wy * wy + wz * wz;
    if dist_sq >= radius * radius || dist_sq < 1e-12 {
        return false;
    }
    let dist = dist_sq.sqrt();
    let pen = radius - dist;
    let nx = wx / dist;
    let ny = wy / dist;
    let nz = wz / dist;
    pos.x += nx * pen;
    pos.y += ny * pen;
    pos.z += nz * pen;
    apply_bounce(vel, nx, ny, nz, rest, friction);
    true
}

pub fn resolve_projectile_against_colliders(
    input: ResolveProjectileCollidersInput,
) -> ProjectileIntegrateOutput {
    let mut pos = input.pos;
    let mut vel = input.vel;
    let radius = input.radius;
    let rest = input.restitution;
    let friction = input.friction;
    let passes = input.passes.max(1);

    for _ in 0..passes {
        for collider in &input.colliders {
            if !collider.active || collider.skip_target {
                continue;
            }
            if is_projectile_walk_slab(collider) {
                resolve_sphere_against_walk_slab(&mut pos, &mut vel, radius, collider, rest, friction);
            } else {
                resolve_sphere_against_one_box(&mut pos, &mut vel, radius, collider, rest, friction);
            }
        }
    }

    ProjectileIntegrateOutput { pos, vel }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectProjectileNearbyInput {
    pub px: f64,
    pub py: f64,
    pub pz: f64,
    pub radius: f64,
    #[serde(default = "default_collect_margin")]
    pub margin: f64,
    pub colliders: Vec<ProjectileColliderInput>,
}

fn default_collect_margin() -> f64 {
    0.35
}

pub fn collider_overlaps_projectile_sphere(
    collider: &ProjectileColliderInput,
    px: f64,
    py: f64,
    pz: f64,
    radius: f64,
    margin: f64,
) -> bool {
    if !collider.active {
        return false;
    }
    let reach = radius + margin;
    let bottom = collider.bottom_y.unwrap_or(f64::NEG_INFINITY);
    let top = collider.top_y.unwrap_or(f64::INFINITY);
    if py + reach < bottom || py - reach > top {
        return false;
    }
    rotated_box_overlaps_circle(collider.footprint(), px, pz, reach)
}

pub fn collect_projectile_nearby_collider_indices(input: CollectProjectileNearbyInput) -> Vec<u32> {
    let mut indices = Vec::new();
    for (i, collider) in input.colliders.iter().enumerate() {
        if collider.skip_target {
            continue;
        }
        if collider_overlaps_projectile_sphere(
            collider,
            input.px,
            input.py,
            input.pz,
            input.radius,
            input.margin,
        ) {
            indices.push(i as u32);
        }
    }
    indices
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wall_box() -> ProjectileColliderInput {
        ProjectileColliderInput {
            x: 0.0,
            z: 0.0,
            half_x: 1.0,
            half_z: 0.2,
            rotation_y: 0.0,
            corner_radius: 0.0,
            bottom_y: Some(0.0),
            top_y: Some(3.0),
            active: true,
            skip_target: false,
            kind: None,
            container_part: None,
        }
    }

    #[test]
    fn bounces_off_vertical_wall() {
        let output = resolve_projectile_against_colliders(ResolveProjectileCollidersInput {
            pos: ProjectileVec3 {
                x: 0.85,
                y: 1.0,
                z: 0.0,
            },
            vel: ProjectileVec3 {
                x: -2.0,
                y: 0.0,
                z: 0.0,
            },
            radius: 0.05,
            colliders: vec![wall_box()],
            restitution: 0.69,
            friction: 0.74,
            passes: 1,
        });
        assert!(output.pos.x >= 1.05 - 1e-6);
        assert!(output.vel.x > 0.0);
    }

    #[test]
    fn walk_slab_snaps_onto_top() {
        let output = resolve_projectile_against_colliders(ResolveProjectileCollidersInput {
            pos: ProjectileVec3 {
                x: 0.0,
                y: 1.04,
                z: 0.0,
            },
            vel: ProjectileVec3 {
                x: 0.0,
                y: -1.0,
                z: 0.0,
            },
            radius: 0.05,
            colliders: vec![ProjectileColliderInput {
                x: 0.0,
                z: 0.0,
                half_x: 2.0,
                half_z: 2.0,
                rotation_y: 0.0,
                corner_radius: 0.0,
                bottom_y: Some(0.5),
                top_y: Some(1.0),
                active: true,
                skip_target: false,
                kind: Some("deck".to_string()),
                container_part: None,
            }],
            restitution: 0.69,
            friction: 0.74,
            passes: 1,
        });
        assert!((output.pos.y - 1.05).abs() < 1e-6);
    }

    #[test]
    fn skips_inactive_and_target_colliders() {
        let output = resolve_projectile_against_colliders(ResolveProjectileCollidersInput {
            pos: ProjectileVec3 {
                x: 0.85,
                y: 1.0,
                z: 0.0,
            },
            vel: ProjectileVec3 {
                x: -2.0,
                y: 0.0,
                z: 0.0,
            },
            radius: 0.05,
            colliders: vec![
                ProjectileColliderInput {
                    active: false,
                    skip_target: false,
                    ..wall_box()
                },
                ProjectileColliderInput {
                    active: true,
                    skip_target: true,
                    ..wall_box()
                },
            ],
            restitution: 0.69,
            friction: 0.74,
            passes: 1,
        });
        assert!((output.pos.x - 0.85).abs() < 1e-6);
        assert!(output.vel.x < 0.0);
    }

    #[test]
    fn collect_nearby_skips_targets_and_inactive() {
        let indices = collect_projectile_nearby_collider_indices(CollectProjectileNearbyInput {
            px: 0.0,
            py: 1.0,
            pz: 0.0,
            radius: 0.05,
            margin: 0.35,
            colliders: vec![
                wall_box(),
                ProjectileColliderInput {
                    skip_target: true,
                    ..wall_box()
                },
                ProjectileColliderInput {
                    active: false,
                    ..wall_box()
                },
            ],
        });
        assert_eq!(indices, vec![0]);
    }

    #[test]
    fn collect_rejects_vertical_miss() {
        let indices = collect_projectile_nearby_collider_indices(CollectProjectileNearbyInput {
            px: 0.0,
            py: 5.0,
            pz: 0.0,
            radius: 0.05,
            margin: 0.35,
            colliders: vec![wall_box()],
        });
        assert!(indices.is_empty());
    }
}
