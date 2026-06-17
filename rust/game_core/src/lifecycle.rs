use crate::{
    GameCore, PickupRewardOutput, PlayerDeathOutput, PlayerRespawnOutput, TargetDamageOutput,
    TargetRepairOutput, TargetRespawnOutput, WallShopPurchaseOutput,
};

pub fn apply_pickup_reward(
    core: &mut GameCore,
    kind: String,
    value: i32,
    default_value: i32,
    health_cap: f64,
) -> PickupRewardOutput {
    let applied = if value > 0 {
        value
    } else {
        default_value.max(0)
    };
    match kind.as_str() {
        "hp" => {
            core.player_health = (core.player_health + applied as f64).min(health_cap.max(0.0));
            core.stamina_should_sync_from_health = true;
        }
        "grenade" => {
            core.grenade_count = core.grenade_count.saturating_add(applied).max(0);
        }
        "flashbang" => {
            core.flashbang_count = core.flashbang_count.saturating_add(applied).max(0);
        }
        "score" => {
            core.player_score = core.player_score.saturating_add(applied).max(0);
        }
        _ => {}
    }
    PickupRewardOutput {
        kind,
        value: applied,
        player_health: core.player_health,
        grenade_count: core.grenade_count,
        flashbang_count: core.flashbang_count,
        player_score: core.player_score,
    }
}

pub fn apply_target_damage(health: f64, max_health: f64, damage: f64) -> TargetDamageOutput {
    let next_health = (health - damage.max(0.0)).max(0.0);
    let ratio = if max_health > 0.0 {
        (next_health / max_health).clamp(0.0, 1.0)
    } else {
        0.0
    };
    TargetDamageOutput {
        health: next_health,
        ratio,
        killed: next_health <= 0.0,
    }
}

pub fn apply_grenade_explosion_damage(core: &mut GameCore) -> f64 {
    core.damage_player(60.0)
}

pub fn apply_oil_barrel_fire_damage(core: &mut GameCore) -> f64 {
    core.damage_player(10.0)
}

pub fn tick_target_repair(
    dt: f64,
    health: f64,
    max_health: f64,
    repair_cooldown: f64,
    repair_per_second: f64,
) -> TargetRepairOutput {
    let max_health = max_health.max(0.0);
    let mut next_health = health.clamp(0.0, max_health);
    let mut next_cooldown = repair_cooldown.max(0.0);
    let mut repaired = false;

    if next_health <= 0.0 || max_health <= 0.0 {
        return TargetRepairOutput {
            health: next_health,
            ratio: 0.0,
            repair_cooldown: next_cooldown,
            repaired: false,
            alive: false,
        };
    }

    if next_cooldown > 0.0 {
        next_cooldown = (next_cooldown - dt.max(0.0)).max(0.0);
    } else if next_health < max_health {
        let before = next_health;
        next_health = (next_health + repair_per_second.max(0.0) * dt.max(0.0)).min(max_health);
        repaired = next_health > before;
    }

    TargetRepairOutput {
        health: next_health,
        ratio: (next_health / max_health).clamp(0.0, 1.0),
        repair_cooldown: next_cooldown,
        repaired,
        alive: next_health > 0.0,
    }
}

pub fn plan_target_respawn(respawn_delay_sec: f64) -> TargetRespawnOutput {
    TargetRespawnOutput {
        delay_ms: (respawn_delay_sec.max(0.0) * 1000.0).round() as i32,
        should_schedule: true,
    }
}

fn player_death_reason(kind: &str) -> &'static str {
    match kind {
        "fall" => "You fell to your death",
        "suicide" => "Suicide is never the answer",
        _ => "You were killed by an enemy",
    }
}

pub fn apply_player_death(core: &mut GameCore, kind: &str, now_ms: f64, min_display_ms: f64) -> PlayerDeathOutput {
    core.player_lives = (core.player_lives - 1).max(0);
    core.player_health = 0.0;
    core.stamina_should_sync_from_health = true;
    PlayerDeathOutput {
        died: true,
        reason: player_death_reason(kind).to_string(),
        player_lives: core.player_lives,
        player_health: core.player_health,
        game_over: core.player_lives <= 0,
        min_display_end: now_ms + min_display_ms.max(0.0),
        fade_end_time: f64::INFINITY,
    }
}

pub fn plan_player_respawn(core: &mut GameCore, now_ms: f64, fade_ms: f64) -> PlayerRespawnOutput {
    core.player_health = 100.0;
    core.stamina_should_sync_from_health = true;
    PlayerRespawnOutput {
        can_respawn: true,
        player_health: core.player_health,
        fade_end_time: now_ms + fade_ms.max(0.0),
    }
}

#[allow(clippy::too_many_arguments)]
pub fn purchase_wall_weapon(
    core: &mut GameCore,
    score: i32,
    stage: i32,
    weapon_available: bool,
    rounds: i32,
    spare: i32,
    unlock_cost: i32,
    resupply_cost: i32,
    unlock_rounds: i32,
    unlock_spare: i32,
    resupply_spare: i32,
) -> WallShopPurchaseOutput {
    let can_resupply = stage >= 1 && weapon_available;
    let cost = if can_resupply {
        resupply_cost.max(0)
    } else {
        unlock_cost.max(0)
    };
    if score < cost {
        return WallShopPurchaseOutput {
            purchased: false,
            affordable: false,
            first_unlock: !can_resupply,
            can_resupply,
            player_score: score.max(0),
            stage: stage.max(0),
            weapon_unlocked: stage >= 1,
            rounds: rounds.max(0),
            spare: spare.max(0),
        };
    }

    let first_unlock = !can_resupply;
    let next_score = (score - cost).max(0);
    core.player_score = next_score;
    let (next_stage, next_rounds, next_spare) = if first_unlock {
        (1, unlock_rounds.max(0), unlock_spare.max(0))
    } else {
        (
            stage.max(1) + 1,
            rounds.max(0),
            spare.max(0).saturating_add(resupply_spare.max(0)),
        )
    };

    WallShopPurchaseOutput {
        purchased: true,
        affordable: true,
        first_unlock,
        can_resupply,
        player_score: next_score,
        stage: next_stage,
        weapon_unlocked: true,
        rounds: next_rounds,
        spare: next_spare,
    }
}
