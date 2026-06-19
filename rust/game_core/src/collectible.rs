use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectibleSpawnPlanInput {
    pub reward_types: Vec<String>,
    pub reward_roll: f64,
    pub surface_mode: String,
    pub surface_roll: f64,
    pub x_roll: f64,
    pub z_roll: f64,
    pub margin: f64,
    pub floor_min_x: f64,
    pub floor_max_x: f64,
    pub floor_min_z: f64,
    pub floor_max_z: f64,
    pub floor_y: f64,
    pub catwalk_min_x: f64,
    pub catwalk_max_x: f64,
    pub catwalk_min_z: f64,
    pub catwalk_max_z: f64,
    pub catwalk_y: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectibleSpawnPlanOutput {
    pub reward_type: String,
    pub surface: String,
    pub x: f64,
    pub z: f64,
    pub floor_y: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectibleMotionInput {
    pub kind: String,
    pub dt: f64,
    pub time: f64,
    pub y: f64,
    pub vel_y: f64,
    pub floor_y: f64,
    pub settle_y: f64,
    #[serde(default)]
    pub settled: bool,
    pub settled_time: f64,
    pub settle_blend: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectibleMotionOutput {
    pub time: f64,
    pub y: f64,
    pub vel_y: f64,
    pub settled: bool,
    pub settled_time: f64,
    pub settle_blend: f64,
}

fn clamp_roll(value: f64) -> f64 {
    value.clamp(0.0, 1.0 - f64::EPSILON)
}

fn inset_lerp(min: f64, max: f64, margin: f64, roll: f64) -> f64 {
    let low = min + margin.max(0.0);
    let high = (max - margin.max(0.0)).max(low);
    low + (high - low) * clamp_roll(roll)
}

pub fn plan_collectible_spawn(input: CollectibleSpawnPlanInput) -> CollectibleSpawnPlanOutput {
    let reward_type = if input.reward_types.is_empty() {
        "ammo".to_string()
    } else {
        let index = (clamp_roll(input.reward_roll) * input.reward_types.len() as f64) as usize;
        input.reward_types[index].clone()
    };
    let surface = match input.surface_mode.as_str() {
        "floor" => "floor",
        "catwalk" => "catwalk",
        _ if input.surface_roll < 0.5 => "floor",
        _ => "catwalk",
    };
    let (min_x, max_x, min_z, max_z, floor_y) = if surface == "catwalk" {
        (
            input.catwalk_min_x,
            input.catwalk_max_x,
            input.catwalk_min_z,
            input.catwalk_max_z,
            input.catwalk_y,
        )
    } else {
        (
            input.floor_min_x,
            input.floor_max_x,
            input.floor_min_z,
            input.floor_max_z,
            input.floor_y,
        )
    };
    CollectibleSpawnPlanOutput {
        reward_type,
        surface: surface.to_string(),
        x: inset_lerp(min_x, max_x, input.margin, input.x_roll),
        z: inset_lerp(min_z, max_z, input.margin, input.z_roll),
        floor_y,
    }
}

pub fn tick_collectible_motion(input: CollectibleMotionInput) -> CollectibleMotionOutput {
    const GRAVITY: f64 = 12.0;
    const SETTLE_SPEED: f64 = 0.35;
    const SETTLE_BLEND_SPEED: f64 = 1.8;
    const HOVER_LIFT: f64 = 0.12;
    const BOB_SPEED: f64 = 2.0;
    const BOB_HEIGHT: f64 = 0.06;
    const BOB_AMP: f64 = 1.65;

    let dt = input.dt.clamp(0.0, 0.25);
    let time = input.time + dt;
    let mut y = input.y;
    let mut vel_y = input.vel_y;
    let mut settled = input.settled;
    let mut settled_time = input.settled_time;
    let mut settle_blend = input.settle_blend;

    if !settled {
        vel_y -= GRAVITY * dt;
        y += vel_y * dt;
        let ground_y = input.floor_y + input.settle_y;
        if y <= ground_y {
            y = ground_y;
            if vel_y.abs() < SETTLE_SPEED {
                vel_y = 0.0;
                settled = true;
                settled_time = time;
                settle_blend = 0.0;
            } else {
                let bounce = if input.kind == "ammo" { 0.5 * 0.65 } else { 0.55 };
                vel_y *= -bounce;
            }
        }
    } else {
        settle_blend = (settle_blend + dt * SETTLE_BLEND_SPEED).min(1.0);
        let ease = settle_blend * settle_blend * (3.0 - 2.0 * settle_blend);
        let ground_y = input.floor_y + input.settle_y;
        let base_y = ground_y + HOVER_LIFT * ease;
        let bob = ((time - settled_time) * BOB_SPEED).sin() * BOB_HEIGHT * BOB_AMP * ease;
        y = base_y + bob;
    }

    CollectibleMotionOutput {
        time,
        y,
        vel_y,
        settled,
        settled_time,
        settle_blend,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spawn_input() -> CollectibleSpawnPlanInput {
        CollectibleSpawnPlanInput {
            reward_types: vec!["ammo".into(), "hp".into(), "score".into()],
            reward_roll: 0.5,
            surface_mode: "random".into(),
            surface_roll: 0.75,
            x_roll: 0.0,
            z_roll: 1.0,
            margin: 1.0,
            floor_min_x: -10.0,
            floor_max_x: 10.0,
            floor_min_z: -10.0,
            floor_max_z: 10.0,
            floor_y: 0.0,
            catwalk_min_x: 2.0,
            catwalk_max_x: 8.0,
            catwalk_min_z: -4.0,
            catwalk_max_z: 4.0,
            catwalk_y: 4.35,
        }
    }

    #[test]
    fn spawn_plan_selects_reward_surface_and_inset_position() {
        let output = plan_collectible_spawn(spawn_input());
        assert_eq!(output.reward_type, "hp");
        assert_eq!(output.surface, "catwalk");
        assert_eq!(output.x, 3.0);
        assert!(output.z < 3.0 && output.z > 2.999999);
        assert_eq!(output.floor_y, 4.35);
    }

    #[test]
    fn motion_bounces_then_settles_and_bobs() {
        let first = tick_collectible_motion(CollectibleMotionInput {
            kind: "hp".into(),
            dt: 0.1,
            time: 0.0,
            y: 0.1,
            vel_y: -0.1,
            floor_y: 0.0,
            settle_y: 0.085,
            settled: false,
            settled_time: 0.0,
            settle_blend: 0.0,
        });
        assert_eq!(first.y, 0.085);
        assert!(first.vel_y > 0.0);
        assert!(!first.settled);

        let bob = tick_collectible_motion(CollectibleMotionInput {
            kind: "hp".into(),
            dt: 0.5,
            time: 1.0,
            y: 0.085,
            vel_y: 0.0,
            floor_y: 0.0,
            settle_y: 0.085,
            settled: true,
            settled_time: 1.0,
            settle_blend: 0.0,
        });
        assert!(bob.settle_blend > 0.0);
        assert!(bob.y > 0.085);
    }
}
