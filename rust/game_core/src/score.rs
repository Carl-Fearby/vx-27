use serde::{Deserialize, Serialize};

const BASE_KILL_SCORE: i32 = 100;
const HIT_SCORE_FACTOR: f64 = 2.0;
const MAX_HIT_SCORE_PER_TARGET: i32 = 60;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CombatScoreOutput {
    pub score: i32,
    pub hit_score_awarded: i32,
    pub total_target_score: i32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KillDropPlanOutput {
    pub hp: bool,
    pub ammo: bool,
    pub grenade: bool,
}

pub fn calculate_combat_score(
    zone: &str,
    damage: f64,
    killed: bool,
    hit_score_awarded: i32,
    total_score_awarded: i32,
) -> CombatScoreOutput {
    let raw_hit_score = (damage.max(0.0) * HIT_SCORE_FACTOR).round() as i32;
    let remaining_hit_score = MAX_HIT_SCORE_PER_TARGET - hit_score_awarded.max(0);
    let hit_score = raw_hit_score.clamp(0, remaining_hit_score.max(0));
    let kill_score = if killed {
        BASE_KILL_SCORE + kill_bonus_for_zone(zone)
    } else {
        0
    };
    let score = hit_score + kill_score;
    CombatScoreOutput {
        score,
        hit_score_awarded: hit_score_awarded.max(0) + hit_score,
        total_target_score: total_score_awarded.max(0) + score,
    }
}

#[allow(clippy::too_many_arguments)]
pub fn plan_kill_drops(
    zone: &str,
    explosive_kill: bool,
    player_health: f64,
    spare_mags: i32,
    ammo_spare_threshold: i32,
    grenade_count: i32,
    grenade_roll: f64,
    dev_drop_all_rewards: bool,
) -> KillDropPlanOutput {
    if dev_drop_all_rewards {
        return KillDropPlanOutput {
            hp: true,
            ammo: true,
            grenade: true,
        };
    }

    KillDropPlanOutput {
        hp: explosive_kill || zone == "head" || player_health < 50.0,
        ammo: spare_mags <= ammo_spare_threshold,
        grenade: grenade_roll.clamp(0.0, 1.0) < grenade_drop_chance(grenade_count),
    }
}

fn kill_bonus_for_zone(zone: &str) -> i32 {
    match zone {
        "head" => 150,
        "neck" => 75,
        "upper_chest" => 45,
        "lower_chest" => 30,
        "stomach" => 20,
        "pelvis" => 15,
        "thigh" => 10,
        "knee" => 15,
        "lower_leg" => 5,
        "foot" => 0,
        "arm" => 5,
        "grenade" => 75,
        _ => 0,
    }
}

fn grenade_drop_chance(grenade_count: i32) -> f64 {
    match grenade_count.clamp(0, 5) {
        0 => 0.7,
        1 => 0.5,
        2 => 0.3,
        3 => 0.25,
        4 => 0.05,
        _ => 0.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn combat_score_applies_hit_cap_and_kill_bonus() {
        let value = calculate_combat_score("head", 20.0, true, 30, 100);
        assert_eq!(value.score, 280);
        assert_eq!(value.hit_score_awarded, 60);
        assert_eq!(value.total_target_score, 380);
    }

    #[test]
    fn kill_drop_plan_always_drops_hp_for_explosive_kills() {
        let output = plan_kill_drops("body", true, 100.0, 4, 1, 5, 0.99, false);
        assert!(output.hp);
    }

    #[test]
    fn dev_drop_all_rewards_overrides_drop_rules() {
        let output = plan_kill_drops("body", false, 100.0, 4, 1, 5, 0.99, true);
        assert!(output.hp);
        assert!(output.ammo);
        assert!(output.grenade);
    }

    #[test]
    fn grenade_drop_chance_decreases_with_inventory() {
        let expected = [0.7, 0.5, 0.3, 0.25, 0.05, 0.0];
        for (count, chance) in expected.into_iter().enumerate() {
            assert_eq!(grenade_drop_chance(count as i32), chance);
        }
        assert_eq!(grenade_drop_chance(-10), 0.7);
        assert_eq!(grenade_drop_chance(99), 0.0);
    }
}
