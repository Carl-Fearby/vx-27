use crate::weapon_damage::{resolve_body_zone_damage, resolve_headshot_damage, TargetZoneDamageOutput};

#[derive(Clone, Copy, Debug)]
struct HitZone {
    id: &'static str,
    from_top: f64,
    to_top: f64,
    mult: f64,
}

const HIT_ZONES: &[HitZone] = &[
    HitZone {
        id: "head",
        from_top: 0.0,
        to_top: 0.08,
        mult: 2.5,
    },
    HitZone {
        id: "neck",
        from_top: 0.08,
        to_top: 0.14,
        mult: 2.0,
    },
    HitZone {
        id: "upper_chest",
        from_top: 0.14,
        to_top: 0.25,
        mult: 1.5,
    },
    HitZone {
        id: "lower_chest",
        from_top: 0.25,
        to_top: 0.32,
        mult: 1.25,
    },
    HitZone {
        id: "stomach",
        from_top: 0.32,
        to_top: 0.42,
        mult: 1.1,
    },
    HitZone {
        id: "pelvis",
        from_top: 0.42,
        to_top: 0.48,
        mult: 1.0,
    },
    HitZone {
        id: "thigh",
        from_top: 0.48,
        to_top: 0.70,
        mult: 0.75,
    },
    HitZone {
        id: "knee",
        from_top: 0.70,
        to_top: 0.78,
        mult: 1.0,
    },
    HitZone {
        id: "lower_leg",
        from_top: 0.78,
        to_top: 0.92,
        mult: 0.6,
    },
    HitZone {
        id: "foot",
        from_top: 0.92,
        to_top: 1.0,
        mult: 0.4,
    },
    HitZone {
        id: "arm",
        from_top: 0.14,
        to_top: 0.46,
        mult: 0.65,
    },
];

const TORSO_ZONE_RADII: [(&str, f64); 6] = [
    ("head", 0.058),
    ("neck", 0.042),
    ("upper_chest", 0.135),
    ("lower_chest", 0.115),
    ("stomach", 0.105),
    ("pelvis", 0.110),
];

const ARM_RADIUS_FRAC: f64 = 0.032;

#[derive(Clone, Copy, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TargetPoseInput {
    pub arm_angle: f64,
    pub leg_angle: f64,
    pub arm_offset: f64,
    pub leg_offset: f64,
}

impl Default for TargetPoseInput {
    fn default() -> Self {
        Self {
            arm_angle: 0.45,
            leg_angle: 0.10,
            arm_offset: 0.12,
            leg_offset: 0.048,
        }
    }
}

#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetZoneDamageInput {
    pub weapon_id: String,
    pub current_health: f64,
    pub max_health: f64,
    pub shot_distance: f64,
    pub height: f64,
    pub target_x: f64,
    pub target_y: f64,
    pub target_z: f64,
    #[serde(default)]
    pub hit_x: Option<f64>,
    #[serde(default)]
    pub hit_y: Option<f64>,
    #[serde(default)]
    pub hit_z: Option<f64>,
    #[serde(default)]
    pub bullet_dir_x: Option<f64>,
    #[serde(default)]
    pub bullet_dir_y: Option<f64>,
    #[serde(default)]
    pub bullet_dir_z: Option<f64>,
    #[serde(default)]
    pub pose: TargetPoseInput,
}

#[derive(Clone, Copy)]
struct Vec3 {
    x: f64,
    y: f64,
    z: f64,
}

struct ArmEndpoints {
    sx: f64,
    sy: f64,
    hx: f64,
    hy: f64,
}

struct LegEndpoints {
    top_x: f64,
    top_y: f64,
    bot_x: f64,
    bot_y: f64,
}

fn hit_zone(id: &str) -> Option<&'static HitZone> {
    HIT_ZONES.iter().find(|z| z.id == id)
}

fn body_zones() -> impl Iterator<Item = &'static HitZone> {
    HIT_ZONES.iter().filter(|z| z.id != "arm")
}

fn is_leg_zone(id: &str) -> bool {
    matches!(id, "thigh" | "knee" | "lower_leg" | "foot")
}

fn torso_radius(zone_id: &str) -> f64 {
    TORSO_ZONE_RADII
        .iter()
        .find(|(id, _)| *id == zone_id)
        .map(|(_, r)| *r)
        .unwrap_or(0.105)
}

fn leg_radius(zone_id: &str, height: f64) -> f64 {
    let frac = match zone_id {
        "thigh" => 0.050,
        "knee" => 0.042,
        "foot" => 0.040,
        _ => 0.037,
    };
    frac * height
}

fn get_arm_endpoints(height: f64, pose: TargetPoseInput, sign: f64) -> ArmEndpoints {
    let arm_zone = hit_zone("arm").expect("arm zone");
    let shoulder_y = height * (0.5 - arm_zone.from_top - 0.03);
    let arm_len = height * (arm_zone.to_top - arm_zone.from_top);
    let arm_off = pose.arm_offset * height;
    let angle = pose.arm_angle;
    ArmEndpoints {
        sx: sign * arm_off,
        sy: shoulder_y,
        hx: sign * arm_off + sign * arm_len * angle.sin(),
        hy: shoulder_y - arm_len * angle.cos(),
    }
}

fn get_leg_endpoints(height: f64, pose: TargetPoseInput, sign: f64, zone: &HitZone) -> LegEndpoints {
    let leg_off = pose.leg_offset * height;
    let angle = pose.leg_angle;
    let hip_y = height * (0.5 - zone.from_top);
    let seg_len = height * (zone.to_top - zone.from_top);
    LegEndpoints {
        top_x: sign * leg_off,
        top_y: hip_y,
        bot_x: sign * leg_off + sign * seg_len * angle.sin(),
        bot_y: hip_y - seg_len * angle.cos(),
    }
}

fn closest_dist_segment_to_line(seg_a: Vec3, seg_b: Vec3, line_o: Vec3, line_d: Vec3) -> f64 {
    let u = Vec3 {
        x: seg_b.x - seg_a.x,
        y: seg_b.y - seg_a.y,
        z: seg_b.z - seg_a.z,
    };
    let w = Vec3 {
        x: line_o.x - seg_a.x,
        y: line_o.y - seg_a.y,
        z: line_o.z - seg_a.z,
    };
    let a = u.x * u.x + u.y * u.y + u.z * u.z;
    let b = u.x * line_d.x + u.y * line_d.y + u.z * line_d.z;
    let c = line_d.x * line_d.x + line_d.y * line_d.y + line_d.z * line_d.z;
    let d = u.x * w.x + u.y * w.y + u.z * w.z;
    let e = line_d.x * w.x + line_d.y * w.y + line_d.z * w.z;
    let denom = a * c - b * b;
    let sc = if denom > 0.0001 {
        ((d * c - b * e) / denom).clamp(0.0, 1.0)
    } else {
        0.0
    };
    let tc = (b * sc - e) / if c > 0.0001 { c } else { 1.0 };
    let px = seg_a.x + u.x * sc - (line_o.x + line_d.x * tc);
    let py = seg_a.y + u.y * sc - (line_o.y + line_d.y * tc);
    let pz = seg_a.z + u.z * sc - (line_o.z + line_d.z * tc);
    (px * px + py * py + pz * pz).sqrt()
}

fn fallback_zone(top: f64, height: f64, y: f64) -> Option<&'static HitZone> {
    let frac = ((top - y) / height).clamp(0.0, 1.0);
    if frac < 0.10 {
        return hit_zone("head");
    }
    for zone in body_zones() {
        if zone.id == "head" {
            continue;
        }
        if frac >= zone.from_top && frac < zone.to_top {
            return Some(zone);
        }
    }
    hit_zone("foot")
}

fn headshot_damage(
    weapon_id: &str,
    current_health: f64,
    max_health: f64,
    shot_distance: f64,
) -> f64 {
    resolve_headshot_damage(weapon_id, current_health, max_health, shot_distance)
}

fn body_damage(weapon_id: &str, zone_id: &str, zone_mult: f64, shot_distance: f64) -> f64 {
    resolve_body_zone_damage(weapon_id, zone_id, zone_mult, shot_distance)
}

fn zone_output(zone: &str, damage: f64) -> TargetZoneDamageOutput {
    TargetZoneDamageOutput {
        zone: zone.to_string(),
        damage,
    }
}

fn zone_damage_with_hit(
    input: &TargetZoneDamageInput,
    hit: Vec3,
    bullet_dir: Option<Vec3>,
) -> TargetZoneDamageOutput {
    let weapon_id = input.weapon_id.as_str();
    let h = input.height;
    let cx = input.target_x;
    let cz = input.target_z;
    let base_y = input.target_y;
    let top = input.target_y + h / 2.0;
    let frac = ((top - hit.y) / h).clamp(0.0, 1.0);
    let pose = input.pose;

    if frac < 0.08 {
        return zone_output(
            "head",
            headshot_damage(
                weapon_id,
                input.current_health,
                input.max_health,
                input.shot_distance,
            ),
        );
    }

    if let Some(dir) = bullet_dir {
        if let Some(arm_zone) = hit_zone("arm") {
            if frac >= arm_zone.from_top && frac <= arm_zone.to_top {
                let arm_r = ARM_RADIUS_FRAC * h;
                for sign in [-1.0, 1.0] {
                    let ep = get_arm_endpoints(h, pose, sign);
                    let seg_a = Vec3 {
                        x: cx + ep.sx,
                        y: base_y + ep.sy,
                        z: cz,
                    };
                    let seg_b = Vec3 {
                        x: cx + ep.hx,
                        y: base_y + ep.hy,
                        z: cz,
                    };
                    if closest_dist_segment_to_line(seg_a, seg_b, hit, dir) <= arm_r {
                        return zone_output(
                            "arm",
                            body_damage(weapon_id, "arm", arm_zone.mult, input.shot_distance),
                        );
                    }
                }
            }
        }

        for zone in body_zones() {
            if zone.id == "head" {
                continue;
            }
            if frac < zone.from_top || frac >= zone.to_top {
                continue;
            }

            if is_leg_zone(zone.id) {
                let leg_r = leg_radius(zone.id, h);
                for sign in [-1.0, 1.0] {
                    let ep = get_leg_endpoints(h, pose, sign, zone);
                    let seg_a = Vec3 {
                        x: cx + ep.top_x,
                        y: base_y + ep.top_y,
                        z: cz,
                    };
                    let seg_b = Vec3 {
                        x: cx + ep.bot_x,
                        y: base_y + ep.bot_y,
                        z: cz,
                    };
                    if closest_dist_segment_to_line(seg_a, seg_b, hit, dir) <= leg_r {
                        return zone_output(
                            zone.id,
                            body_damage(weapon_id, zone.id, zone.mult, input.shot_distance),
                        );
                    }
                }
                continue;
            }

            let torso_r = torso_radius(zone.id) * h;
            let radial_dist = ((hit.x - cx).powi(2) + (hit.z - cz).powi(2)).sqrt();
            if radial_dist <= torso_r {
                return zone_output(
                    zone.id,
                    body_damage(weapon_id, zone.id, zone.mult, input.shot_distance),
                );
            }
        }

        if let Some(fb) = fallback_zone(top, h, hit.y) {
            if fb.id == "head" {
                return zone_output(
                    "head",
                    headshot_damage(
                        weapon_id,
                        input.current_health,
                        input.max_health,
                        input.shot_distance,
                    ),
                );
            }
            return zone_output(
                fb.id,
                body_damage(weapon_id, fb.id, fb.mult, input.shot_distance),
            );
        }

        return zone_output(
            "body",
            body_damage(weapon_id, "body", 1.0, input.shot_distance),
        );
    }

    if let Some(fb) = fallback_zone(top, h, hit.y) {
        if fb.id == "head" {
            return zone_output(
                "head",
                headshot_damage(
                    weapon_id,
                    input.current_health,
                    input.max_health,
                    input.shot_distance,
                ),
            );
        }
        return zone_output(
            fb.id,
            body_damage(weapon_id, fb.id, fb.mult, input.shot_distance),
        );
    }

    zone_output(
        "body",
        body_damage(weapon_id, "body", 1.0, input.shot_distance),
    )
}

pub fn resolve_target_zone_damage(input: TargetZoneDamageInput) -> TargetZoneDamageOutput {
    let weapon_id = input.weapon_id.as_str();
    let bullet_dir = match (
        input.bullet_dir_x,
        input.bullet_dir_y,
        input.bullet_dir_z,
    ) {
        (Some(x), Some(y), Some(z)) => Some(Vec3 { x, y, z }),
        _ => None,
    };

    match (input.hit_x, input.hit_y, input.hit_z) {
        (Some(x), Some(y), Some(z)) => {
            zone_damage_with_hit(&input, Vec3 { x, y, z }, bullet_dir)
        }
        _ => zone_output(
            "body",
            body_damage(weapon_id, "body", 1.0, input.shot_distance),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_input() -> TargetZoneDamageInput {
        TargetZoneDamageInput {
            weapon_id: "rifle".to_string(),
            current_health: 30.0,
            max_health: 30.0,
            shot_distance: 0.0,
            height: 1.75,
            target_x: 0.0,
            target_y: 0.0,
            target_z: 0.0,
            hit_x: Some(0.0),
            hit_y: Some(1.75),
            hit_z: Some(0.0),
            bullet_dir_x: None,
            bullet_dir_y: None,
            bullet_dir_z: None,
            pose: TargetPoseInput::default(),
        }
    }

    #[test]
    fn head_band_uses_headshot_damage() {
        let mut input = base_input();
        input.hit_y = Some(1.72);
        let out = resolve_target_zone_damage(input);
        assert_eq!(out.zone, "head");
        assert!((out.damage - 30.0).abs() < 0.0001);
    }

    #[test]
    fn missing_hit_point_defaults_to_body() {
        let mut input = base_input();
        input.hit_x = None;
        input.hit_y = None;
        input.hit_z = None;
        let out = resolve_target_zone_damage(input);
        assert_eq!(out.zone, "body");
        assert!((out.damage - 6.0).abs() < 0.0001);
    }
}
