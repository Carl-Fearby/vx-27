use serde::{Deserialize, Serialize};

#[allow(dead_code)]
pub const GRENADE_RADIUS: f64 = 0.05;
#[allow(dead_code)]
pub const PROJECTILE_MAX_MOVE: f64 = 0.018;
#[allow(dead_code)]
pub const PROJECTILE_MAX_SUBSTEPS: u32 = 6;

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectileBounds {
    pub min_x: f64,
    pub max_x: f64,
    pub min_z: f64,
    pub max_z: f64,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectileVec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectileIntegrateInput {
    pub pos: ProjectileVec3,
    pub vel: ProjectileVec3,
    pub dt: f64,
    pub gravity: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectileIntegrateOutput {
    pub pos: ProjectileVec3,
    pub vel: ProjectileVec3,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectileLiveFloorInput {
    pub pos: ProjectileVec3,
    pub vel: ProjectileVec3,
    pub floor_top: f64,
    pub airborne: bool,
    pub bounce_restitution: f64,
    pub bounce_friction: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectileLiveFloorOutput {
    pub pos: ProjectileVec3,
    pub vel: ProjectileVec3,
    pub airborne: bool,
    pub bounced: bool,
    pub floor_hit: bool,
    pub floor_hit_impact: f64,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectileBoundsInput {
    pub pos: ProjectileVec3,
    pub vel: ProjectileVec3,
    pub bounds: ProjectileBounds,
    pub radius: f64,
    pub bounce_restitution: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectileBoundsOutput {
    pub pos: ProjectileVec3,
    pub vel: ProjectileVec3,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectileGroundRollInput {
    pub vel_x: f64,
    pub vel_z: f64,
    pub dt: f64,
    pub ground_roll_friction: f64,
    pub airborne: bool,
    pub falling_through_hole: bool,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectileGroundRollOutput {
    pub vel_x: f64,
    pub vel_z: f64,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectileFuseTickInput {
    pub time: f64,
    pub dt: f64,
    pub fuse_time: f64,
    pub countdown_duration: f64,
    pub countdown_played: bool,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectileFuseTickOutput {
    pub time: f64,
    pub should_detonate: bool,
    pub should_play_countdown: bool,
    pub countdown_playback_rate: f64,
    pub countdown_played: bool,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectilePreviewStepInput {
    pub pos: ProjectileVec3,
    pub vel: ProjectileVec3,
    pub dt: f64,
    pub gravity: f64,
    pub floor_top: f64,
    pub bounce_restitution: f64,
    pub bounce_friction: f64,
    pub bounce_count: u32,
    #[serde(default)]
    pub bounds: Option<ProjectileBounds>,
    pub radius: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectilePreviewStepOutput {
    pub pos: ProjectileVec3,
    pub vel: ProjectileVec3,
    pub bounce_count: u32,
    pub landed: bool,
    pub record_bounce: bool,
    pub stop_sim: bool,
}

pub fn compute_throw_velocity(
    aim_x: f64,
    aim_y: f64,
    aim_z: f64,
    throw_speed: f64,
    loft_angle_deg: f64,
) -> ProjectileVec3 {
    let aim_len = (aim_x * aim_x + aim_y * aim_y + aim_z * aim_z).sqrt();
    let (ax, ay, az) = if aim_len > 0.0001 {
        (aim_x / aim_len, aim_y / aim_len, aim_z / aim_len)
    } else {
        (0.0, 0.0, -1.0)
    };

    let mut rx = ay * 0.0 - az * 1.0;
    let mut ry = az * 0.0 - ax * 0.0;
    let mut rz = ax * 1.0 - ay * 0.0;
    let r_len = (rx * rx + ry * ry + rz * rz).sqrt();
    if r_len > 0.0001 {
        rx /= r_len;
        ry /= r_len;
        rz /= r_len;
    } else {
        rx = 1.0;
        ry = 0.0;
        rz = 0.0;
    }

    let ux = ry * az - rz * ay;
    let uy = rz * ax - rx * az;
    let uz = rx * ay - ry * ax;
    let u_len = (ux * ux + uy * uy + uz * uz).sqrt();
    let (ux, uy, uz) = if u_len > 0.0001 {
        (ux / u_len, uy / u_len, uz / u_len)
    } else {
        (0.0, 1.0, 0.0)
    };

    let loft_rad = loft_angle_deg.to_radians();
    let cos_loft = loft_rad.cos();
    let sin_loft = loft_rad.sin();
    let dx = ax * cos_loft + ux * sin_loft;
    let dy = ay * cos_loft + uy * sin_loft;
    let dz = az * cos_loft + uz * sin_loft;
    let d_len = (dx * dx + dy * dy + dz * dz).sqrt().max(0.0001);
    let speed = throw_speed.max(0.0);
    ProjectileVec3 {
        x: dx / d_len * speed,
        y: dy / d_len * speed,
        z: dz / d_len * speed,
    }
}

pub fn projectile_substep_count(speed: f64, dt: f64, max_move: f64, max_substeps: u32) -> u32 {
    if dt <= 0.0 {
        return 1;
    }
    let travel = speed.max(0.0) * dt;
    let steps = (travel / max_move.max(0.0001)).ceil() as u32;
    steps.clamp(1, max_substeps.max(1))
}

pub fn projectile_integrate(input: ProjectileIntegrateInput) -> ProjectileIntegrateOutput {
    let dt = input.dt.max(0.0);
    ProjectileIntegrateOutput {
        pos: ProjectileVec3 {
            x: input.pos.x + input.vel.x * dt,
            y: input.pos.y + input.vel.y * dt,
            z: input.pos.z + input.vel.z * dt,
        },
        vel: ProjectileVec3 {
            x: input.vel.x,
            y: input.vel.y - input.gravity * dt,
            z: input.vel.z,
        },
    }
}

pub fn projectile_resolve_floor_live(input: ProjectileLiveFloorInput) -> ProjectileLiveFloorOutput {
    let mut pos = input.pos;
    let mut vel = input.vel;
    let mut airborne = input.airborne;
    let mut bounced = false;
    let mut floor_hit = false;
    let mut floor_hit_impact = 0.0;

    if pos.y <= input.floor_top {
        let inbound_y = vel.y;
        pos.y = input.floor_top;

        if airborne && inbound_y < -0.15 {
            floor_hit_impact = (inbound_y.abs() / 8.0).min(1.0);
            floor_hit = true;
            bounced = true;
            vel.y = -inbound_y * input.bounce_restitution;
            let slide_retain = (1.0 - input.bounce_friction).max(0.0);
            vel.x *= slide_retain;
            vel.z *= slide_retain;
            if vel.y.abs() < 0.45 {
                vel.y = 0.0;
                airborne = false;
            }
        } else {
            vel.y = 0.0;
            airborne = false;
        }
    } else {
        airborne = true;
    }

    ProjectileLiveFloorOutput {
        pos,
        vel,
        airborne,
        bounced,
        floor_hit,
        floor_hit_impact,
    }
}

pub fn projectile_resolve_bounds(input: ProjectileBoundsInput) -> ProjectileBoundsOutput {
    let mut pos = input.pos;
    let mut vel = input.vel;
    let r = input.radius;
    let rest = input.bounce_restitution;
    let b = input.bounds;

    if pos.x < b.min_x + r {
        pos.x = b.min_x + r;
        vel.x = vel.x.abs() * rest;
    }
    if pos.x > b.max_x - r {
        pos.x = b.max_x - r;
        vel.x = -vel.x.abs() * rest;
    }
    if pos.z < b.min_z + r {
        pos.z = b.min_z + r;
        vel.z = vel.z.abs() * rest;
    }
    if pos.z > b.max_z - r {
        pos.z = b.max_z - r;
        vel.z = -vel.z.abs() * rest;
    }

    ProjectileBoundsOutput { pos, vel }
}

pub fn projectile_apply_ground_roll(input: ProjectileGroundRollInput) -> ProjectileGroundRollOutput {
    if input.airborne || input.falling_through_hole {
        return ProjectileGroundRollOutput {
            vel_x: input.vel_x,
            vel_z: input.vel_z,
        };
    }

    let roll_damp = (-input.ground_roll_friction.max(0.0) * input.dt.max(0.0)).exp();
    let mut vel_x = input.vel_x * roll_damp;
    let mut vel_z = input.vel_z * roll_damp;
    let slide_speed = (vel_x * vel_x + vel_z * vel_z).sqrt();
    if slide_speed < 0.08 {
        vel_x = 0.0;
        vel_z = 0.0;
    }
    ProjectileGroundRollOutput { vel_x, vel_z }
}

pub fn projectile_fuse_tick(input: ProjectileFuseTickInput) -> ProjectileFuseTickOutput {
    let time = input.time + input.dt.max(0.0);
    let mut countdown_played = input.countdown_played;
    let mut should_play_countdown = false;
    let mut countdown_playback_rate = 1.0;

    if !countdown_played
        && input.countdown_duration > 0.0
        && input.fuse_time > 0.05
    {
        let lead = input
            .countdown_duration
            .min((input.fuse_time - 0.05).max(0.12));
        let start_at = input.fuse_time - lead;
        if time >= start_at {
            countdown_played = true;
            should_play_countdown = true;
            countdown_playback_rate = (input.countdown_duration / lead).clamp(0.85, 2.5);
        }
    }

    ProjectileFuseTickOutput {
        time,
        should_detonate: time >= input.fuse_time,
        should_play_countdown,
        countdown_playback_rate,
        countdown_played,
    }
}

pub fn projectile_preview_floor_and_bounds(
    mut pos: ProjectileVec3,
    mut vel: ProjectileVec3,
    input: ProjectilePreviewStepInput,
) -> ProjectilePreviewStepOutput {
    let mut bounce_count = input.bounce_count;
    let mut landed = false;
    let mut record_bounce = false;
    let mut stop_sim = false;

    if pos.y <= input.floor_top {
        pos.y = input.floor_top;
        if bounce_count == 0 {
            landed = true;
        } else if bounce_count == 1 {
            record_bounce = true;
        }
        bounce_count += 1;
        vel.y = -vel.y * input.bounce_restitution;
        vel.x *= 1.0 - input.bounce_friction;
        vel.z *= 1.0 - input.bounce_friction;
        if vel.y.abs() < 0.1 && bounce_count > 1 {
            stop_sim = true;
        }
    }

    if let Some(bounds) = input.bounds {
        let resolved = projectile_resolve_bounds(ProjectileBoundsInput {
            pos,
            vel,
            bounds,
            radius: input.radius,
            bounce_restitution: input.bounce_restitution,
        });
        pos = resolved.pos;
        vel = resolved.vel;
    }

    ProjectilePreviewStepOutput {
        pos,
        vel,
        bounce_count,
        landed,
        record_bounce,
        stop_sim,
    }
}

pub fn projectile_preview_step(input: ProjectilePreviewStepInput) -> ProjectilePreviewStepOutput {
    let integrated = projectile_integrate(ProjectileIntegrateInput {
        pos: input.pos,
        vel: input.vel,
        dt: input.dt,
        gravity: input.gravity,
    });
    projectile_preview_floor_and_bounds(integrated.pos, integrated.vel, input)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn throw_velocity_has_forward_and_loft() {
        let vel = compute_throw_velocity(0.0, 0.0, -1.0, 12.0, 15.0);
        assert!(vel.y > 0.0);
        assert!(vel.z < 0.0);
        let speed = (vel.x * vel.x + vel.y * vel.y + vel.z * vel.z).sqrt();
        assert!((speed - 12.0).abs() < 0.001);
    }

    #[test]
    fn live_floor_bounce_zeros_small_vertical_speed() {
        let out = projectile_resolve_floor_live(ProjectileLiveFloorInput {
            pos: ProjectileVec3 {
                x: 0.0,
                y: 0.04,
                z: 0.0,
            },
            vel: ProjectileVec3 {
                x: 2.0,
                y: -3.0,
                z: 1.0,
            },
            floor_top: 0.05,
            airborne: true,
            bounce_restitution: 0.69,
            bounce_friction: 0.74,
        });
        assert!(out.floor_hit);
        assert!(out.bounced);
        assert!(out.vel.y > 0.0);
    }

    #[test]
    fn fuse_tick_detonates_at_fuse_time() {
        let out = projectile_fuse_tick(ProjectileFuseTickInput {
            time: 2.4,
            dt: 0.2,
            fuse_time: 2.5,
            countdown_duration: 1.0,
            countdown_played: true,
        });
        assert!(out.should_detonate);
        assert!((out.time - 2.6).abs() < 0.0001);
    }
}
