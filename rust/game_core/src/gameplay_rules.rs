use serde::{Deserialize, Serialize};

const TWO_PI: f64 = std::f64::consts::PI * 2.0;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PickupCollectInput {
    pub item_x: f64,
    pub item_z: f64,
    pub player_x: f64,
    pub player_z: f64,
    pub collect_radius: f64,
    #[serde(default)]
    pub permanent: bool,
    pub player_foot_y: Option<f64>,
    pub floor_y: Option<f64>,
    #[serde(default)]
    pub floor_slack: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickupCollectOutput {
    pub collected: bool,
    pub distance_sq: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectFadeInput {
    pub time: f64,
    pub collect_time: f64,
    pub duration: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectFadeOutput {
    pub scale: f64,
    pub remove: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecondarySlotInput {
    pub slot: i32,
    pub grenade_slot: i32,
    pub flashbang_slot: i32,
    pub grenade_count: i32,
    pub flashbang_count: i32,
    pub cooldown_remaining: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecondarySlotOutput {
    pub throwable: bool,
    pub kind: String,
    pub stock: i32,
    pub cooldown_ready: bool,
    pub can_throw: bool,
    pub empty_message: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimaryWeaponSwapInput {
    pub active_id: String,
    pub slot_pick: Option<String>,
    #[serde(default)]
    pub swap_toggle: bool,
    #[serde(default)]
    pub rifle_unlocked: bool,
    #[serde(default)]
    pub pistol_owned: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimaryWeaponSwapOutput {
    pub requested: bool,
    pub allowed: bool,
    pub next_id: String,
    pub reason: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerDeathTriggerInput {
    #[serde(default)]
    pub death_state_active: bool,
    pub foot_y: f64,
    pub floor_y: f64,
    pub fall_drop: f64,
    pub player_health: f64,
    #[serde(default)]
    pub grenade_suicide: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerDeathTriggerOutput {
    pub should_die: bool,
    pub kind: String,
    pub consume_grenade_suicide: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KillDropScatterInput {
    pub angle_roll: f64,
    pub offset_roll: f64,
    pub hp_delay_roll: f64,
    pub ammo_delay_roll: f64,
    pub grenade_delay_roll: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KillDropScatterOutput {
    pub angle: f64,
    pub offset: f64,
    pub hp_delay_ms: f64,
    pub ammo_delay_ms: f64,
    pub grenade_delay_ms: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RewardDropLaunchInput {
    pub angle_roll: f64,
    pub speed_roll: f64,
    pub vel_y_roll: f64,
    pub min_speed: f64,
    pub speed_span: f64,
    pub min_vel_y: f64,
    pub vel_y_span: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RewardDropLaunchOutput {
    pub angle: f64,
    pub speed: f64,
    pub vel_x: f64,
    pub vel_y: f64,
    pub vel_z: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RagdollImpulseSeedInput {
    pub hit_zone: String,
    pub zone_mult: Option<f64>,
    pub bullet_dir_x: Option<f64>,
    pub bullet_dir_z: Option<f64>,
    pub dir_roll: f64,
    pub angular_roll: f64,
    pub launch_roll: f64,
    pub spin_sign_roll: f64,
    pub spin_roll: f64,
    pub profile_launch_mul: f64,
    pub profile_spin_mul: f64,
    pub blast_knockback: f64,
    pub death_initial_angular_vel: f64,
    pub launch_up_vel: f64,
    pub launch_back_vel: f64,
    pub spin_vel_min: f64,
    pub spin_vel_max: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RagdollImpulseSeedOutput {
    pub death_dir: f64,
    pub topple_severity: f64,
    pub angular_vel: f64,
    pub launch_vel_y: f64,
    pub launch_vel_x: f64,
    pub launch_vel_z: f64,
    pub spin_vel: f64,
}

fn clamp01(value: f64) -> f64 {
    value.clamp(0.0, 1.0)
}

fn zone_severity(hit_zone: &str, zone_mult: Option<f64>) -> f64 {
    let mult = if hit_zone == "body" || hit_zone == "miss" {
        1.0
    } else {
        zone_mult.unwrap_or(1.0)
    };
    clamp01((mult - 0.4) / (2.5 - 0.4))
}

pub fn resolve_pickup_collect(input: PickupCollectInput) -> PickupCollectOutput {
    let dx = input.item_x - input.player_x;
    let dz = input.item_z - input.player_z;
    let distance_sq = dx * dx + dz * dz;
    let mut collected = distance_sq < input.collect_radius * input.collect_radius;
    if collected && input.permanent {
        if let (Some(player_foot_y), Some(floor_y)) = (input.player_foot_y, input.floor_y) {
            collected = (player_foot_y - floor_y).abs() <= input.floor_slack;
        }
    }
    PickupCollectOutput {
        collected,
        distance_sq,
    }
}

pub fn resolve_collect_fade(input: CollectFadeInput) -> CollectFadeOutput {
    let duration = input.duration.max(0.0001);
    let since = (input.time - input.collect_time).max(0.0);
    let scale = (1.0 - since / duration).clamp(0.0, 1.0);
    CollectFadeOutput {
        scale,
        remove: scale <= 0.0,
    }
}

pub fn resolve_secondary_slot(input: SecondarySlotInput) -> SecondarySlotOutput {
    let (throwable, kind, stock, empty_message) = if input.slot == input.grenade_slot {
        (
            true,
            "grenade".to_string(),
            input.grenade_count,
            "No grenades".to_string(),
        )
    } else if input.slot == input.flashbang_slot {
        (
            true,
            "flashbang".to_string(),
            input.flashbang_count,
            "No flashbangs".to_string(),
        )
    } else {
        (false, "".to_string(), 0, "".to_string())
    };
    let cooldown_ready = input.cooldown_remaining <= 0.0;
    SecondarySlotOutput {
        throwable,
        kind,
        stock,
        cooldown_ready,
        can_throw: throwable && cooldown_ready && stock > 0,
        empty_message,
    }
}

fn other_primary_weapon(active_id: &str, rifle_unlocked: bool) -> String {
    if active_id == "rifle" {
        "pistol".to_string()
    } else if rifle_unlocked {
        "rifle".to_string()
    } else {
        "pistol".to_string()
    }
}

pub fn resolve_primary_weapon_swap(input: PrimaryWeaponSwapInput) -> PrimaryWeaponSwapOutput {
    let next_id = input
        .slot_pick
        .filter(|id| !id.is_empty())
        .unwrap_or_else(|| {
            if input.swap_toggle {
                other_primary_weapon(&input.active_id, input.rifle_unlocked)
            } else {
                String::new()
            }
        });
    if next_id.is_empty() {
        return PrimaryWeaponSwapOutput {
            requested: false,
            allowed: false,
            next_id,
            reason: "none".to_string(),
        };
    }
    if next_id == input.active_id {
        return PrimaryWeaponSwapOutput {
            requested: true,
            allowed: false,
            next_id,
            reason: "alreadyActive".to_string(),
        };
    }
    if next_id == "rifle" && !input.rifle_unlocked {
        return PrimaryWeaponSwapOutput {
            requested: true,
            allowed: false,
            next_id,
            reason: "rifleLocked".to_string(),
        };
    }
    if next_id == "pistol" && !input.pistol_owned {
        return PrimaryWeaponSwapOutput {
            requested: true,
            allowed: false,
            next_id,
            reason: "pistolNotOwned".to_string(),
        };
    }
    PrimaryWeaponSwapOutput {
        requested: true,
        allowed: true,
        next_id,
        reason: "ok".to_string(),
    }
}

pub fn resolve_player_death_trigger(input: PlayerDeathTriggerInput) -> PlayerDeathTriggerOutput {
    if input.death_state_active {
        return PlayerDeathTriggerOutput {
            should_die: false,
            kind: String::new(),
            consume_grenade_suicide: false,
        };
    }
    if input.foot_y < input.floor_y - input.fall_drop {
        return PlayerDeathTriggerOutput {
            should_die: true,
            kind: "fall".to_string(),
            consume_grenade_suicide: false,
        };
    }
    if input.player_health <= 0.0 {
        return PlayerDeathTriggerOutput {
            should_die: true,
            kind: if input.grenade_suicide {
                "suicide".to_string()
            } else {
                "enemy".to_string()
            },
            consume_grenade_suicide: input.grenade_suicide,
        };
    }
    PlayerDeathTriggerOutput {
        should_die: false,
        kind: String::new(),
        consume_grenade_suicide: false,
    }
}

pub fn plan_kill_drop_scatter(input: KillDropScatterInput) -> KillDropScatterOutput {
    KillDropScatterOutput {
        angle: clamp01(input.angle_roll) * TWO_PI,
        offset: 0.3 + clamp01(input.offset_roll) * 0.5,
        hp_delay_ms: 800.0 + clamp01(input.hp_delay_roll) * 400.0,
        ammo_delay_ms: 1800.0 + clamp01(input.ammo_delay_roll) * 400.0,
        grenade_delay_ms: 2200.0 + clamp01(input.grenade_delay_roll) * 500.0,
    }
}

pub fn plan_reward_drop_launch(input: RewardDropLaunchInput) -> RewardDropLaunchOutput {
    let angle = clamp01(input.angle_roll) * TWO_PI;
    let speed = input.min_speed + clamp01(input.speed_roll) * input.speed_span.max(0.0);
    RewardDropLaunchOutput {
        angle,
        speed,
        vel_x: angle.sin() * speed,
        vel_y: input.min_vel_y + clamp01(input.vel_y_roll) * input.vel_y_span.max(0.0),
        vel_z: angle.cos() * speed,
    }
}

pub fn resolve_ragdoll_impulse_seed(input: RagdollImpulseSeedInput) -> RagdollImpulseSeedOutput {
    let severity = zone_severity(&input.hit_zone, input.zone_mult);
    let spread = (std::f64::consts::PI * 0.52) * (1.0 - severity) + 0.03 * severity;
    let has_bullet = input.bullet_dir_x.is_some() && input.bullet_dir_z.is_some();
    let base_dir = if has_bullet {
        input.bullet_dir_x.unwrap_or(0.0).atan2(input.bullet_dir_z.unwrap_or(0.0))
    } else {
        clamp01(input.dir_roll) * TWO_PI
    };
    let death_dir = if has_bullet {
        base_dir + (clamp01(input.dir_roll) - 0.5) * 2.0 * spread
    } else {
        base_dir
    };
    let launch_vel_x = input
        .bullet_dir_x
        .unwrap_or(0.0)
        * input.launch_back_vel
        * input.profile_launch_mul
        * input.blast_knockback;
    let launch_vel_z = input
        .bullet_dir_z
        .unwrap_or(0.0)
        * input.launch_back_vel
        * input.profile_launch_mul
        * input.blast_knockback;
    let spin_sign = if input.spin_sign_roll < 0.5 { -1.0 } else { 1.0 };
    RagdollImpulseSeedOutput {
        death_dir,
        topple_severity: severity,
        angular_vel: (input.death_initial_angular_vel + clamp01(input.angular_roll) * 0.3)
            * (1.0 + (1.4 - 1.0) * severity),
        launch_vel_y: (input.launch_up_vel + clamp01(input.launch_roll) * 1.5)
            * input.profile_launch_mul
            * input.blast_knockback,
        launch_vel_x,
        launch_vel_z,
        spin_vel: spin_sign
            * (input.spin_vel_min
                + clamp01(input.spin_roll) * (input.spin_vel_max - input.spin_vel_min))
            * input.profile_spin_mul
            * (1.0 + (0.2 - 1.0) * severity),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pickup_collect_respects_floor_slack_for_permanent_items() {
        let near = resolve_pickup_collect(PickupCollectInput {
            item_x: 0.0,
            item_z: 0.0,
            player_x: 0.1,
            player_z: 0.1,
            collect_radius: 0.5,
            permanent: true,
            player_foot_y: Some(4.0),
            floor_y: Some(0.0),
            floor_slack: 0.35,
        });
        assert!(!near.collected);
    }

    #[test]
    fn secondary_slot_blocks_empty_flashbangs() {
        let slot = resolve_secondary_slot(SecondarySlotInput {
            slot: 2,
            grenade_slot: 1,
            flashbang_slot: 2,
            grenade_count: 1,
            flashbang_count: 0,
            cooldown_remaining: 0.0,
        });
        assert!(slot.throwable);
        assert!(!slot.can_throw);
        assert_eq!(slot.empty_message, "No flashbangs");
    }

    #[test]
    fn primary_swap_blocks_locked_rifle() {
        let swap = resolve_primary_weapon_swap(PrimaryWeaponSwapInput {
            active_id: "pistol".to_string(),
            slot_pick: Some("rifle".to_string()),
            swap_toggle: false,
            rifle_unlocked: false,
            pistol_owned: true,
        });
        assert!(swap.requested);
        assert!(!swap.allowed);
        assert_eq!(swap.reason, "rifleLocked");
    }

    #[test]
    fn reward_drop_launch_matches_js_ranges() {
        let launch = plan_reward_drop_launch(RewardDropLaunchInput {
            angle_roll: 0.25,
            speed_roll: 0.5,
            vel_y_roll: 0.5,
            min_speed: 1.5,
            speed_span: 1.5,
            min_vel_y: 3.0,
            vel_y_span: 2.0,
        });
        assert!((launch.speed - 2.25).abs() < 0.0001);
        assert!((launch.vel_y - 4.0).abs() < 0.0001);
    }

    #[test]
    fn death_trigger_prefers_fall_before_health() {
        let death = resolve_player_death_trigger(PlayerDeathTriggerInput {
            death_state_active: false,
            foot_y: -6.0,
            floor_y: 0.0,
            fall_drop: 5.0,
            player_health: 0.0,
            grenade_suicide: true,
        });
        assert!(death.should_die);
        assert_eq!(death.kind, "fall");
        assert!(!death.consume_grenade_suicide);
    }
}
