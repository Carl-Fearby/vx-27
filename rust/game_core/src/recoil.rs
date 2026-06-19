use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpringStepOutput {
    pub value: f64,
    pub velocity: f64,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FireRecoilKickOutput {
    pub back_vel_delta: f64,
    pub pitch_vel_delta: f64,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AimRecoilStepInput {
    pub pitch_value: f64,
    pub pitch_velocity: f64,
    pub pitch_target: f64,
    pub yaw_value: f64,
    pub yaw_velocity: f64,
    pub yaw_target: f64,
    pub stiffness: f64,
    pub damping: f64,
    pub dt: f64,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AimRecoilStepOutput {
    pub pitch_value: f64,
    pub pitch_velocity: f64,
    pub yaw_value: f64,
    pub yaw_velocity: f64,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AimRecoilKickInput {
    pub pitch: f64,
    pub yaw: f64,
    pub strength: f64,
    pub kick_vel_scale: f64,
    pub pitch_roll: f64,
    pub yaw_roll: f64,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AimRecoilKickOutput {
    pub pitch_target_delta: f64,
    pub yaw_target_delta: f64,
    pub pitch_velocity_delta: f64,
    pub yaw_velocity_delta: f64,
}

pub fn spring_step_toward(
    value: f64,
    velocity: f64,
    target: f64,
    stiffness: f64,
    damping: f64,
    dt: f64,
) -> SpringStepOutput {
    let mut velocity = velocity;
    let mut value = value;
    velocity += (-(value - target) * stiffness - velocity * damping) * dt;
    value += velocity * dt;
    SpringStepOutput { value, velocity }
}

pub fn spring_step(
    value: f64,
    velocity: f64,
    stiffness: f64,
    damping: f64,
    dt: f64,
) -> SpringStepOutput {
    let mut velocity = velocity;
    let mut value = value;
    velocity += (-value * stiffness - velocity * damping) * dt;
    value += velocity * dt;
    SpringStepOutput { value, velocity }
}

pub fn clamp_recoil_pitch_anim(pitch: f64, recoil_pitch_anim: f64, pitch_limit: f64) -> f64 {
    let total_pitch = pitch + recoil_pitch_anim;
    if total_pitch > pitch_limit {
        pitch_limit - pitch
    } else if total_pitch < -pitch_limit {
        -pitch_limit - pitch
    } else {
        recoil_pitch_anim
    }
}

pub fn apply_fire_recoil_kick(
    fire_recoil_back: f64,
    aim_recoil_scale: f64,
    kick_vel_scale: f64,
    fire_recoil_pitch: f64,
    pitch_vel_scale: f64,
) -> FireRecoilKickOutput {
    let back = fire_recoil_back * aim_recoil_scale;
    FireRecoilKickOutput {
        back_vel_delta: back * kick_vel_scale,
        pitch_vel_delta: back * fire_recoil_pitch * pitch_vel_scale,
    }
}

pub fn step_aim_recoil_pair(input: AimRecoilStepInput) -> AimRecoilStepOutput {
    let pitch = spring_step_toward(
        input.pitch_value,
        input.pitch_velocity,
        input.pitch_target,
        input.stiffness,
        input.damping,
        input.dt,
    );
    let yaw = spring_step_toward(
        input.yaw_value,
        input.yaw_velocity,
        input.yaw_target,
        input.stiffness,
        input.damping,
        input.dt,
    );
    AimRecoilStepOutput {
        pitch_value: pitch.value,
        pitch_velocity: pitch.velocity,
        yaw_value: yaw.value,
        yaw_velocity: yaw.velocity,
    }
}

pub fn plan_aim_recoil_kick(input: AimRecoilKickInput) -> AimRecoilKickOutput {
    const PITCH_RANDOM_MIN: f64 = 0.85;
    const PITCH_RANDOM_SPREAD: f64 = 0.3;
    let strength = input.strength.max(0.0);
    let pitch_target_delta = input.pitch
        * strength
        * (PITCH_RANDOM_MIN + input.pitch_roll.clamp(0.0, 1.0) * PITCH_RANDOM_SPREAD);
    let yaw_target_delta = (input.yaw_roll.clamp(0.0, 1.0) - 0.5)
        * 2.0
        * input.yaw
        * strength;
    AimRecoilKickOutput {
        pitch_target_delta,
        yaw_target_delta,
        pitch_velocity_delta: pitch_target_delta * input.kick_vel_scale,
        yaw_velocity_delta: yaw_target_delta * input.kick_vel_scale,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spring_step_toward_settles_on_target() {
        let mut value = 0.0;
        let mut velocity = 0.0;
        let target = 0.032;
        for _ in 0..240 {
            let step = spring_step_toward(value, velocity, target, 260.0, 14.0, 1.0 / 60.0);
            value = step.value;
            velocity = step.velocity;
        }
        assert!((value - target).abs() < 0.002, "value={value}, target={target}");
        assert!(velocity.abs() < 0.05);
    }

    #[test]
    fn spring_step_returns_to_zero() {
        let mut value = 0.07;
        let mut velocity = 2.0;
        for _ in 0..300 {
            let step = spring_step(value, velocity, 445.0, 20.5, 1.0 / 60.0);
            value = step.value;
            velocity = step.velocity;
        }
        assert!(value.abs() < 0.002);
        assert!(velocity.abs() < 0.05);
    }

    #[test]
    fn clamp_recoil_pitch_anim_limits_total_pitch() {
        let limit = std::f64::consts::FRAC_PI_2 - 0.05;
        let pitch = limit - 0.01;
        let anim = 0.05;
        let clamped = clamp_recoil_pitch_anim(pitch, anim, limit);
        assert!((pitch + clamped - limit).abs() < 1e-9);
    }

    #[test]
    fn apply_fire_recoil_kick_scales_with_ads() {
        let hip = apply_fire_recoil_kick(0.07, 1.0, 9.7, -0.09, 9.2);
        let ads = apply_fire_recoil_kick(0.07, 0.6, 9.7, -0.09, 9.2);
        assert!((ads.back_vel_delta - hip.back_vel_delta * 0.6).abs() < 1e-9);
        assert!(hip.back_vel_delta > 0.0);
        assert!(hip.pitch_vel_delta < 0.0);
    }

    #[test]
    fn step_aim_recoil_pair_matches_two_springs() {
        let input = AimRecoilStepInput {
            pitch_value: 0.01,
            pitch_velocity: 0.5,
            pitch_target: 0.032,
            yaw_value: -0.002,
            yaw_velocity: 0.1,
            yaw_target: 0.004,
            stiffness: 260.0,
            damping: 14.0,
            dt: 1.0 / 60.0,
        };
        let batch = step_aim_recoil_pair(input);
        let pitch = spring_step_toward(
            input.pitch_value,
            input.pitch_velocity,
            input.pitch_target,
            input.stiffness,
            input.damping,
            input.dt,
        );
        let yaw = spring_step_toward(
            input.yaw_value,
            input.yaw_velocity,
            input.yaw_target,
            input.stiffness,
            input.damping,
            input.dt,
        );
        assert!((batch.pitch_value - pitch.value).abs() < 1e-12);
        assert!((batch.pitch_velocity - pitch.velocity).abs() < 1e-12);
        assert!((batch.yaw_value - yaw.value).abs() < 1e-12);
        assert!((batch.yaw_velocity - yaw.velocity).abs() < 1e-12);
    }

    #[test]
    fn aim_recoil_kick_maps_random_rolls_to_target_and_velocity() {
        let kick = plan_aim_recoil_kick(AimRecoilKickInput {
            pitch: 0.03,
            yaw: 0.01,
            strength: 2.0,
            kick_vel_scale: 4.0,
            pitch_roll: 0.5,
            yaw_roll: 0.0,
        });
        assert!((kick.pitch_target_delta - 0.06).abs() < 1e-12);
        assert!((kick.yaw_target_delta + 0.02).abs() < 1e-12);
        assert!((kick.pitch_velocity_delta - 0.24).abs() < 1e-12);
        assert!((kick.yaw_velocity_delta + 0.08).abs() < 1e-12);
    }
}
