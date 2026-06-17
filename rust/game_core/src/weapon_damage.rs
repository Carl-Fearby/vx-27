use serde::{Deserialize, Serialize};

pub const TARGET_DAMAGE: f64 = 6.0;
pub const ADS_DAMAGE_MULTIPLIER: f64 = 1.3;
pub const ADS_RECOIL_REDUCTION: f64 = 0.4;

pub fn resolve_ads_damage_scale(aim_blend: f64) -> f64 {
    let t = aim_blend.clamp(0.0, 1.0);
    1.0 + t * (ADS_DAMAGE_MULTIPLIER - 1.0)
}

pub fn resolve_ads_recoil_scale(aim_blend: f64) -> f64 {
    let t = aim_blend.clamp(0.0, 1.0);
    1.0 - t * ADS_RECOIL_REDUCTION
}

#[derive(Clone, Copy, Debug)]
struct FalloffPoint {
    distance: f64,
    multiplier: f64,
}

#[derive(Clone, Copy, Debug)]
struct WeaponDamageProfile {
    base_damage: f64,
    headshot_health_fraction: f64,
    upper_body_scale: f64,
    lower_body_scale: f64,
    arm_scale: f64,
}

const RIFLE_PROFILE: WeaponDamageProfile = WeaponDamageProfile {
    base_damage: TARGET_DAMAGE,
    headshot_health_fraction: 1.0,
    upper_body_scale: 1.0,
    lower_body_scale: 1.0,
    arm_scale: 1.0,
};

const PISTOL_PROFILE: WeaponDamageProfile = WeaponDamageProfile {
    base_damage: TARGET_DAMAGE,
    headshot_health_fraction: 1.0,
    upper_body_scale: 0.5,
    lower_body_scale: 0.25,
    arm_scale: 0.25,
};

const PISTOL_FALLOFF: &[FalloffPoint] = &[
    FalloffPoint {
        distance: 0.0,
        multiplier: 1.0,
    },
    FalloffPoint {
        distance: 3.0,
        multiplier: 1.0,
    },
    FalloffPoint {
        distance: 5.0,
        multiplier: 0.5,
    },
    FalloffPoint {
        distance: 10.0,
        multiplier: 1.0 / 3.0,
    },
    FalloffPoint {
        distance: 50.0,
        multiplier: 0.25,
    },
];

const RIFLE_FALLOFF: &[FalloffPoint] = &[
    FalloffPoint {
        distance: 0.0,
        multiplier: 1.0,
    },
    FalloffPoint {
        distance: 10.0,
        multiplier: 1.0,
    },
    FalloffPoint {
        distance: 50.0,
        multiplier: 0.5,
    },
];

fn weapon_profile(weapon_id: &str) -> WeaponDamageProfile {
    if weapon_id == "pistol" {
        PISTOL_PROFILE
    } else {
        RIFLE_PROFILE
    }
}

pub fn resolve_damage_falloff(weapon_id: &str, shot_distance: f64) -> f64 {
    let points = if weapon_id == "pistol" {
        PISTOL_FALLOFF
    } else {
        RIFLE_FALLOFF
    };
    let distance = if shot_distance.is_finite() {
        shot_distance.max(0.0)
    } else {
        0.0
    };

    if distance <= points[0].distance {
        return points[0].multiplier;
    }
    for i in 1..points.len() {
        let prev = points[i - 1];
        let next = points[i];
        if distance > next.distance {
            continue;
        }
        let span = (next.distance - prev.distance).max(0.0001);
        let t = (distance - prev.distance) / span;
        return prev.multiplier + (next.multiplier - prev.multiplier) * t;
    }
    points[points.len() - 1].multiplier
}

fn hit_zone_body_category(zone_id: &str) -> &'static str {
    if zone_id == "head" {
        "head"
    } else if zone_id == "arm" {
        "arm"
    } else if matches!(
        zone_id,
        "pelvis" | "thigh" | "knee" | "lower_leg" | "foot"
    ) {
        "lower"
    } else {
        "upper"
    }
}

pub fn resolve_headshot_damage(
    weapon_id: &str,
    current_health: f64,
    max_health: f64,
    shot_distance: f64,
) -> f64 {
    let profile = weapon_profile(weapon_id);
    let falloff = resolve_damage_falloff(weapon_id, shot_distance);
    if profile.headshot_health_fraction >= 1.0 && falloff >= 0.999 {
        return current_health;
    }
    max_health * profile.headshot_health_fraction * falloff
}

pub fn resolve_body_zone_damage(
    weapon_id: &str,
    zone_id: &str,
    zone_mult: f64,
    shot_distance: f64,
) -> f64 {
    let profile = weapon_profile(weapon_id);
    let category = hit_zone_body_category(zone_id);
    let scale = match category {
        "lower" => profile.lower_body_scale,
        "arm" => profile.arm_scale,
        _ => profile.upper_body_scale,
    };
    profile.base_damage * zone_mult * scale * resolve_damage_falloff(weapon_id, shot_distance)
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetZoneDamageOutput {
    pub zone: String,
    pub damage: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pistol_falloff_at_five_metres() {
        assert!((resolve_damage_falloff("pistol", 5.0) - 0.5).abs() < 0.0001);
    }

    #[test]
    fn headshot_one_shot_at_full_health() {
        let dmg = resolve_headshot_damage("rifle", 30.0, 30.0, 0.0);
        assert!((dmg - 30.0).abs() < 0.0001);
    }

    #[test]
    fn pistol_pelvis_uses_lower_body_scale() {
        let dmg = resolve_body_zone_damage("pistol", "pelvis", 1.0, 0.0);
        assert!((dmg - 1.5).abs() < 0.0001);
    }

    #[test]
    fn ads_damage_scale_at_full_ads() {
        assert!((resolve_ads_damage_scale(1.0) - ADS_DAMAGE_MULTIPLIER).abs() < 0.0001);
        assert!((resolve_ads_damage_scale(0.0) - 1.0).abs() < 0.0001);
    }

    #[test]
    fn ads_recoil_scale_at_full_ads() {
        assert!((resolve_ads_recoil_scale(1.0) - 0.6).abs() < 0.0001);
        assert!((resolve_ads_recoil_scale(0.0) - 1.0).abs() < 0.0001);
    }
}
