use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoundsInput {
    pub min_x: f64,
    pub max_x: f64,
    pub min_z: f64,
    pub max_z: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClampToBoundsOutput {
    pub x: f64,
    pub z: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RagdollLimbImpulseInput {
    pub mode: String,
    pub is_arm: bool,
    pub is_lower: bool,
    pub is_hit_limb: bool,
    pub profile_impulse_mul: f64,
    pub blast_knockback: f64,
    pub bullet_dir_x: Option<f64>,
    pub bullet_dir_z: Option<f64>,
    pub strength_roll: f64,
    pub x_roll: f64,
    pub y_roll: f64,
    pub z_roll: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RagdollLimbImpulseOutput {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub activation_delay: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RagdollSeverPlanInput {
    pub root_id: String,
    pub blast_falloff: f64,
    pub knockback_mul: f64,
    pub spine_dir_x: f64,
    pub spine_dir_z: f64,
    pub chance_roll: f64,
    pub horizontal_roll: f64,
    pub vel_x_roll: f64,
    pub vel_y_roll: f64,
    pub vel_z_roll: f64,
    pub angular_x_roll: f64,
    pub angular_y_roll: f64,
    pub angular_z_roll: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RagdollSeverPlanOutput {
    pub sever: bool,
    pub blood_damage: i32,
    pub vel_x: f64,
    pub vel_y: f64,
    pub vel_z: f64,
    pub angular_x: f64,
    pub angular_y: f64,
    pub angular_z: f64,
}

pub fn plan_ragdoll_limb_impulse(input: RagdollLimbImpulseInput) -> RagdollLimbImpulseOutput {
    const FLAIL_INITIAL_VEL: f64 = 12.0;
    let rx = input.x_roll.clamp(0.0, 1.0) - 0.5;
    let ry = input.y_roll.clamp(0.0, 1.0) - 0.5;
    let rz = input.z_roll.clamp(0.0, 1.0) - 0.5;
    let bullet_x = input.bullet_dir_x.unwrap_or(0.0);
    let bullet_z = input.bullet_dir_z.unwrap_or(0.0);
    let (x, y, z) = if input.mode == "grenade" {
        let strength = FLAIL_INITIAL_VEL
            * input.profile_impulse_mul
            * input.blast_knockback
            * (0.65 + input.strength_roll.clamp(0.0, 1.0) * 0.7);
        (
            bullet_z * strength + rx * strength * 0.35,
            ry * strength * 0.25 + input.blast_knockback * 0.2,
            -bullet_x * strength + rz * strength * 0.35,
        )
    } else if input.mode == "hit" {
        let strength = FLAIL_INITIAL_VEL * input.profile_impulse_mul;
        (
            bullet_z * strength + rx * 2.0,
            ry * strength * 0.2,
            -bullet_x * strength + rz * 2.0,
        )
    } else {
        let base = if input.is_arm {
            FLAIL_INITIAL_VEL * 1.4
        } else if input.is_lower {
            FLAIL_INITIAL_VEL * 0.7
        } else {
            FLAIL_INITIAL_VEL * 0.5
        };
        (rx * base, ry * base * 0.5, rz * base)
    };
    let activation_delay = if input.is_hit_limb {
        0.0
    } else if input.is_arm {
        0.03
    } else if input.is_lower {
        0.12
    } else {
        0.06
    };
    RagdollLimbImpulseOutput {
        x,
        y,
        z,
        activation_delay,
    }
}

pub fn plan_ragdoll_sever(input: RagdollSeverPlanInput) -> RagdollSeverPlanOutput {
    const CHANCE: f64 = 0.42;
    const HORIZONTAL: f64 = 4.4;
    const UP: f64 = 2.1;
    const SPIN: f64 = 9.0;
    let chance = CHANCE * input.blast_falloff.clamp(0.0, 1.0) * input.knockback_mul;
    let sever = input.chance_roll.clamp(0.0, 1.0) < chance;
    let horizontal = HORIZONTAL
        * input.knockback_mul
        * (0.85 + input.horizontal_roll.clamp(0.0, 1.0) * 0.45);
    let side_bias = if input.root_id.ends_with('L') || input.root_id.ends_with('R') {
        1.12
    } else {
        1.0
    };
    let centered = |roll: f64| roll.clamp(0.0, 1.0) - 0.5;
    RagdollSeverPlanOutput {
        sever,
        blood_damage: (8.0 + input.blast_falloff * 16.0).round().max(8.0) as i32,
        vel_x: input.spine_dir_x * horizontal * side_bias + centered(input.vel_x_roll) * 0.45,
        vel_y: UP * input.knockback_mul * (0.65 + input.vel_y_roll.clamp(0.0, 1.0) * 0.75),
        vel_z: input.spine_dir_z * horizontal * side_bias + centered(input.vel_z_roll) * 0.45,
        angular_x: input.spine_dir_z * SPIN * 0.35 + centered(input.angular_x_roll) * SPIN * 0.5,
        angular_y: centered(input.angular_y_roll) * SPIN * 0.4,
        angular_z: -input.spine_dir_x * SPIN * 0.35 + centered(input.angular_z_roll) * SPIN * 0.5,
    }
}

pub fn clamp_to_bounds(px: f64, pz: f64, radius: f64, bounds: Option<BoundsInput>) -> ClampToBoundsOutput {
    let Some(bounds) = bounds else {
        return ClampToBoundsOutput { x: px, z: pz };
    };
    ClampToBoundsOutput {
        x: px.clamp(bounds.min_x + radius, bounds.max_x - radius),
        z: pz.clamp(bounds.min_z + radius, bounds.max_z - radius),
    }
}

const HOLE_FALL_GRAVITY: f64 = 22.0;

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TickRagdollHoleFallInput {
    pub hole_fall_vel_y: f64,
    pub hole_fall_offset: f64,
    pub floor_y: f64,
    pub dt: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TickRagdollHoleFallOutput {
    pub hole_fall_vel_y: f64,
    pub hole_fall_offset: f64,
    pub root_y: f64,
    pub opacity: f64,
    pub finished: bool,
}

pub fn tick_ragdoll_hole_fall(input: TickRagdollHoleFallInput) -> TickRagdollHoleFallOutput {
    let hole_fall_vel_y = input.hole_fall_vel_y - HOLE_FALL_GRAVITY * input.dt;
    let hole_fall_offset = input.hole_fall_offset + hole_fall_vel_y * input.dt;
    let root_y = input.floor_y + hole_fall_offset;
    let fall_depth = input.floor_y - root_y;
    let mut opacity = 1.0;
    let mut finished = false;
    if fall_depth > 1.0 {
        let fade_t = ((fall_depth - 1.0) / 4.0).clamp(0.0, 1.0);
        opacity = (1.0 - fade_t).clamp(0.0, 1.0);
        if fade_t >= 1.0 {
            finished = true;
        }
    }
    TickRagdollHoleFallOutput {
        hole_fall_vel_y,
        hole_fall_offset,
        root_y,
        opacity,
        finished,
    }
}

const DEATH_GRAVITY: f64 = 12.0;
const DEATH_BOUNCE_RESTITUTION: f64 = 0.3;
const DEATH_BOUNCE_FRICTION: f64 = 0.6;
const DEATH_REST_THRESHOLD: f64 = 0.05;

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TickRagdollCoreToppleInput {
    pub tip_angle: f64,
    pub angular_vel: f64,
    pub settled: bool,
    pub bounced: bool,
    pub dt: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TickRagdollCoreToppleOutput {
    pub tip_angle: f64,
    pub angular_vel: f64,
    pub settled: bool,
    pub bounced: bool,
}

pub fn tick_ragdoll_core_topple(input: TickRagdollCoreToppleInput) -> TickRagdollCoreToppleOutput {
    if input.settled {
        return TickRagdollCoreToppleOutput {
            tip_angle: input.tip_angle,
            angular_vel: input.angular_vel,
            settled: true,
            bounced: input.bounced,
        };
    }

    let dt = input.dt;
    let half_pi = std::f64::consts::FRAC_PI_2;
    let mut tip_angle = input.tip_angle;
    let mut angular_vel = input.angular_vel;
    let mut settled = false;
    let mut bounced = input.bounced;

    let gravity = DEATH_GRAVITY * (tip_angle + 0.15).sin();
    angular_vel += gravity * dt;
    tip_angle += angular_vel * dt;

    if tip_angle >= half_pi {
        tip_angle = half_pi;
        if angular_vel.abs() > DEATH_REST_THRESHOLD {
            angular_vel *= -DEATH_BOUNCE_RESTITUTION;
            bounced = true;
        } else {
            angular_vel = 0.0;
            settled = true;
        }
    }
    if bounced && tip_angle >= half_pi - 0.01 && angular_vel.abs() < DEATH_REST_THRESHOLD {
        angular_vel = 0.0;
        tip_angle = half_pi;
        settled = true;
    }
    angular_vel *= 1.0 - DEATH_BOUNCE_FRICTION * dt;

    TickRagdollCoreToppleOutput {
        tip_angle,
        angular_vel,
        settled,
        bounced,
    }
}

const LAUNCH_GRAVITY: f64 = 22.0;

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TickRagdollLaunchInput {
    pub launch_y: f64,
    pub launch_vel_y: f64,
    pub launch_vel_x: f64,
    pub launch_vel_z: f64,
    pub origin_x: f64,
    pub origin_z: f64,
    pub airborne: bool,
    pub dt: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TickRagdollLaunchOutput {
    pub launch_y: f64,
    pub launch_vel_y: f64,
    pub launch_vel_x: f64,
    pub launch_vel_z: f64,
    pub origin_x: f64,
    pub origin_z: f64,
    pub airborne: bool,
    pub floor_impact: f64,
}

pub fn tick_ragdoll_launch(input: TickRagdollLaunchInput) -> TickRagdollLaunchOutput {
    if !input.airborne {
        return TickRagdollLaunchOutput {
            launch_y: input.launch_y,
            launch_vel_y: input.launch_vel_y,
            launch_vel_x: input.launch_vel_x,
            launch_vel_z: input.launch_vel_z,
            origin_x: input.origin_x,
            origin_z: input.origin_z,
            airborne: false,
            floor_impact: 0.0,
        };
    }

    let launch_vel_y = input.launch_vel_y - LAUNCH_GRAVITY * input.dt;
    let launch_y = input.launch_y + launch_vel_y * input.dt;
    let origin_x = input.origin_x + input.launch_vel_x * input.dt;
    let origin_z = input.origin_z + input.launch_vel_z * input.dt;

    if launch_y <= 0.0 {
        let impact = (launch_vel_y.abs() / 7.0).min(1.0);
        return TickRagdollLaunchOutput {
            launch_y: 0.0,
            launch_vel_y: 0.0,
            launch_vel_x: input.launch_vel_x,
            launch_vel_z: input.launch_vel_z,
            origin_x,
            origin_z,
            airborne: false,
            floor_impact: impact,
        };
    }

    TickRagdollLaunchOutput {
        launch_y,
        launch_vel_y,
        launch_vel_x: input.launch_vel_x,
        launch_vel_z: input.launch_vel_z,
        origin_x,
        origin_z,
        airborne: true,
        floor_impact: 0.0,
    }
}

#[cfg(test)]
mod planning_tests {
    use super::*;

    #[test]
    fn hit_limb_impulse_uses_bullet_direction() {
        let output = plan_ragdoll_limb_impulse(RagdollLimbImpulseInput {
            mode: "hit".into(),
            is_arm: true,
            is_lower: false,
            is_hit_limb: true,
            profile_impulse_mul: 1.0,
            blast_knockback: 1.0,
            bullet_dir_x: Some(1.0),
            bullet_dir_z: Some(0.0),
            strength_roll: 0.5,
            x_roll: 0.5,
            y_roll: 0.5,
            z_roll: 0.5,
        });
        assert_eq!(output.x, 0.0);
        assert_eq!(output.z, -12.0);
        assert_eq!(output.activation_delay, 0.0);
    }

    #[test]
    fn sever_plan_obeys_chance_and_returns_impulse() {
        let output = plan_ragdoll_sever(RagdollSeverPlanInput {
            root_id: "upperArmL".into(),
            blast_falloff: 1.0,
            knockback_mul: 1.0,
            spine_dir_x: 1.0,
            spine_dir_z: 0.0,
            chance_roll: 0.1,
            horizontal_roll: 0.0,
            vel_x_roll: 0.5,
            vel_y_roll: 0.0,
            vel_z_roll: 0.5,
            angular_x_roll: 0.5,
            angular_y_roll: 0.5,
            angular_z_roll: 0.5,
        });
        assert!(output.sever);
        assert_eq!(output.blood_damage, 24);
        assert!(output.vel_x > 4.0);
        assert!(output.vel_y > 1.0);
    }
}
