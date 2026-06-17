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
