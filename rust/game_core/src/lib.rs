use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

const HEALTH_REGEN_INTERVAL_SEC: f64 = 10.0;
const HEALTH_REGEN_AMOUNT: f64 = 1.0;
const RADIOACTIVE_OVERFLOW_DECAY_INTERVAL_SEC: f64 = 5.0;
const RADIOACTIVE_OVERFLOW_DECAY_AMOUNT: f64 = 1.0;
const SPRINT_STAMINA_BASE: f64 = 1.0;
const SPRINT_DRAIN_PER_SEC: f64 = (1.0 / 5.0) * 1.33;
const SPRINT_RECOVER_PER_SEC: f64 = SPRINT_DRAIN_PER_SEC / 4.0;
const BASE_KILL_SCORE: i32 = 100;
const HIT_SCORE_FACTOR: f64 = 2.0;
const MAX_HIT_SCORE_PER_TARGET: i32 = 60;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameCoreFrameInput {
    dt: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameCorePublicState {
    player_health: f64,
    health_regen_timer: f64,
    radioactive_overflow_decay_timer: f64,
    grenade_cooldown_remaining: f64,
    stamina: f64,
    stamina_max: f64,
    sprinting: bool,
    stamina_should_sync_from_health: bool,
    grenade_count: i32,
    flashbang_count: i32,
    player_score: i32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerCoreInput {
    dt: f64,
    forward: bool,
    backward: bool,
    strafe_left: bool,
    strafe_right: bool,
    sprint: bool,
    crouching: bool,
    aiming: bool,
    stamina_max: f64,
    walk_speed: f64,
    sprint_speed: f64,
    crouch_speed: f64,
    aim_move_mul: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerCoreOutput {
    move_x: f64,
    move_z: f64,
    moving: bool,
    sprinting: bool,
    stamina: f64,
    stamina_max: f64,
    speed: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerVerticalInput {
    dt: f64,
    y: f64,
    grounded: bool,
    jump_pressed: bool,
    can_jump: bool,
    gravity: f64,
    jump_velocity: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerVerticalOutput {
    y: f64,
    velocity_y: f64,
    grounded: bool,
    jumped: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeaponAmmoOutput {
    rounds: i32,
    spare: i32,
    reloaded: bool,
    fired: bool,
    low_ammo: bool,
    empty: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThrowableOutput {
    thrown: bool,
    kind: String,
    grenade_count: i32,
    flashbang_count: i32,
    cooldown_remaining: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickupRewardOutput {
    kind: String,
    value: i32,
    player_health: f64,
    grenade_count: i32,
    flashbang_count: i32,
    player_score: i32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetDamageOutput {
    health: f64,
    ratio: f64,
    killed: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetRepairOutput {
    health: f64,
    ratio: f64,
    repair_cooldown: f64,
    repaired: bool,
    alive: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CombatScoreOutput {
    score: i32,
    hit_score_awarded: i32,
    total_target_score: i32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrenadeBlastOutput {
    hit: bool,
    falloff: f64,
    damage: f64,
    knockback_mul: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KillDropPlanOutput {
    hp: bool,
    ammo: bool,
    grenade: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetRespawnOutput {
    delay_ms: i32,
    should_schedule: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerDeathOutput {
    died: bool,
    reason: String,
    player_lives: i32,
    player_health: f64,
    game_over: bool,
    min_display_end: f64,
    fade_end_time: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerRespawnOutput {
    can_respawn: bool,
    player_health: f64,
    fade_end_time: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WallShopPurchaseOutput {
    purchased: bool,
    affordable: bool,
    first_unlock: bool,
    can_resupply: bool,
    player_score: i32,
    stage: i32,
    weapon_unlocked: bool,
    rounds: i32,
    spare: i32,
}

#[derive(Clone, Debug)]
struct WeaponAmmoState {
    rounds: i32,
    spare: i32,
    magazine_size: i32,
    low_ammo_threshold: i32,
}

#[wasm_bindgen]
pub struct GameCore {
    player_health: f64,
    health_regen_timer: f64,
    radioactive_overflow_decay_timer: f64,
    grenade_cooldown_remaining: f64,
    stamina: f64,
    last_stamina_max: f64,
    sprinting: bool,
    velocity_y: f64,
    grounded: bool,
    stamina_should_sync_from_health: bool,
    rifle_ammo: WeaponAmmoState,
    pistol_ammo: WeaponAmmoState,
    grenade_count: i32,
    flashbang_count: i32,
    player_score: i32,
    player_lives: i32,
}

#[wasm_bindgen(js_name = createGameCore)]
pub fn create_game_core(player_health: Option<f64>) -> GameCore {
    GameCore {
        player_health: player_health.unwrap_or(100.0),
        health_regen_timer: 0.0,
        radioactive_overflow_decay_timer: 0.0,
        grenade_cooldown_remaining: 0.0,
        stamina: SPRINT_STAMINA_BASE,
        last_stamina_max: SPRINT_STAMINA_BASE,
        sprinting: false,
        velocity_y: 0.0,
        grounded: true,
        stamina_should_sync_from_health: false,
        rifle_ammo: WeaponAmmoState::new(0, 0, 80, 15),
        pistol_ammo: WeaponAmmoState::new(12, 2, 12, 4),
        grenade_count: 4,
        flashbang_count: 4,
        player_score: 0,
        player_lives: 3,
    }
}

#[wasm_bindgen]
impl GameCore {
    #[wasm_bindgen(js_name = getPublicState)]
    pub fn get_public_state(&self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&self.public_state())
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = tickFrame)]
    pub fn tick_frame(&mut self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: GameCoreFrameInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        self.tick(input.dt.clamp(0.0, 0.25));
        self.get_public_state()
    }

    #[wasm_bindgen(js_name = tickPlayerCore)]
    pub fn tick_player_core(&mut self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: PlayerCoreInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        let output = self.tick_player_core_inner(input);
        serde_wasm_bindgen::to_value(&output).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = tickPlayerVertical)]
    pub fn tick_player_vertical(&mut self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: PlayerVerticalInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        let output = self.tick_player_vertical_inner(input);
        serde_wasm_bindgen::to_value(&output).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = setPlayerHealth)]
    pub fn set_player_health(&mut self, value: f64) {
        self.player_health = value.max(0.0);
        self.stamina_should_sync_from_health = true;
    }

    #[wasm_bindgen(js_name = damagePlayer)]
    pub fn damage_player(&mut self, amount: f64) -> f64 {
        self.player_health = (self.player_health - amount.max(0.0)).max(0.0);
        self.stamina_should_sync_from_health = true;
        self.player_health
    }

    #[wasm_bindgen(js_name = healPlayer)]
    pub fn heal_player(&mut self, amount: f64, cap: Option<f64>) -> f64 {
        let cap = cap.unwrap_or(100.0).max(0.0);
        self.player_health = (self.player_health + amount.max(0.0)).min(cap);
        self.stamina_should_sync_from_health = true;
        self.player_health
    }

    #[wasm_bindgen(js_name = setGrenadeCooldown)]
    pub fn set_grenade_cooldown(&mut self, seconds: f64) {
        self.grenade_cooldown_remaining = seconds.max(0.0);
    }

    #[wasm_bindgen(js_name = syncThrowableCounts)]
    pub fn sync_throwable_counts(&mut self, grenade_count: i32, flashbang_count: i32) {
        self.grenade_count = grenade_count.max(0);
        self.flashbang_count = flashbang_count.max(0);
    }

    #[wasm_bindgen(js_name = syncPlayerScore)]
    pub fn sync_player_score(&mut self, score: i32) {
        self.player_score = score.max(0);
    }

    #[wasm_bindgen(js_name = syncPlayerLives)]
    pub fn sync_player_lives(&mut self, lives: i32) {
        self.player_lives = lives.max(0);
    }

    #[wasm_bindgen(js_name = resetPlayerCore)]
    pub fn reset_player_core(&mut self, stamina_max: Option<f64>) {
        self.stamina = SPRINT_STAMINA_BASE;
        self.last_stamina_max = stamina_max
            .unwrap_or(SPRINT_STAMINA_BASE)
            .max(SPRINT_STAMINA_BASE);
        self.sprinting = false;
        self.velocity_y = 0.0;
        self.grounded = true;
        self.apply_stamina_max_change(self.last_stamina_max);
    }

    #[wasm_bindgen(js_name = syncStaminaMax)]
    pub fn sync_stamina_max(&mut self, stamina_max: f64) {
        self.apply_stamina_max_change(stamina_max);
    }

    #[wasm_bindgen(js_name = syncPlayerVertical)]
    pub fn sync_player_vertical(&mut self, y: f64, velocity_y: f64, grounded: bool) {
        let _ = y;
        self.velocity_y = velocity_y;
        self.grounded = grounded;
    }

    #[wasm_bindgen(js_name = syncWeaponAmmo)]
    pub fn sync_weapon_ammo(
        &mut self,
        id: String,
        rounds: i32,
        spare: i32,
        magazine_size: i32,
        low_ammo_threshold: i32,
    ) -> Result<JsValue, JsValue> {
        let ammo = self.weapon_ammo_mut(&id)?;
        *ammo = WeaponAmmoState::new(rounds, spare, magazine_size, low_ammo_threshold);
        serde_wasm_bindgen::to_value(&ammo.to_output(false, false))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = tryReloadWeapon)]
    pub fn try_reload_weapon(&mut self, id: String, force: bool) -> Result<JsValue, JsValue> {
        let ammo = self.weapon_ammo_mut(&id)?;
        let reloaded = ammo.try_reload(force);
        serde_wasm_bindgen::to_value(&ammo.to_output(reloaded, false))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = tryConsumeWeaponRound)]
    pub fn try_consume_weapon_round(
        &mut self,
        id: String,
        auto_reload: bool,
    ) -> Result<JsValue, JsValue> {
        let ammo = self.weapon_ammo_mut(&id)?;
        let (fired, reloaded) = ammo.try_consume_round(auto_reload);
        serde_wasm_bindgen::to_value(&ammo.to_output(reloaded, fired))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = addWeaponRounds)]
    pub fn add_weapon_rounds(&mut self, id: String, rounds: i32) -> Result<JsValue, JsValue> {
        let ammo = self.weapon_ammo_mut(&id)?;
        ammo.rounds = ammo.rounds.saturating_add(rounds.max(0));
        serde_wasm_bindgen::to_value(&ammo.to_output(false, false))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = tryThrowThrowable)]
    pub fn try_throw_throwable(
        &mut self,
        kind: String,
        cooldown_seconds: f64,
    ) -> Result<JsValue, JsValue> {
        let thrown = self.try_throw_kind(&kind, cooldown_seconds);
        serde_wasm_bindgen::to_value(&ThrowableOutput {
            thrown,
            kind,
            grenade_count: self.grenade_count,
            flashbang_count: self.flashbang_count,
            cooldown_remaining: self.grenade_cooldown_remaining,
        })
        .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = applyPickupReward)]
    pub fn apply_pickup_reward(
        &mut self,
        kind: String,
        value: i32,
        default_value: i32,
        health_cap: f64,
    ) -> Result<JsValue, JsValue> {
        let output = self.apply_pickup_reward_inner(kind, value, default_value, health_cap);
        serde_wasm_bindgen::to_value(&output).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = applyTargetDamage)]
    pub fn apply_target_damage(
        &self,
        health: f64,
        max_health: f64,
        damage: f64,
    ) -> Result<JsValue, JsValue> {
        let output = self.apply_target_damage_inner(health, max_health, damage);
        serde_wasm_bindgen::to_value(&output).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = tickTargetRepair)]
    pub fn tick_target_repair(
        &self,
        dt: f64,
        health: f64,
        max_health: f64,
        repair_cooldown: f64,
        repair_per_second: f64,
    ) -> Result<JsValue, JsValue> {
        let output = self.tick_target_repair_inner(
            dt,
            health,
            max_health,
            repair_cooldown,
            repair_per_second,
        );
        serde_wasm_bindgen::to_value(&output).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = calculateCombatScore)]
    pub fn calculate_combat_score(
        &self,
        zone: String,
        damage: f64,
        killed: bool,
        hit_score_awarded: i32,
        total_score_awarded: i32,
    ) -> Result<JsValue, JsValue> {
        let output = self.calculate_combat_score_inner(
            &zone,
            damage,
            killed,
            hit_score_awarded,
            total_score_awarded,
        );
        serde_wasm_bindgen::to_value(&output).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = calculateGrenadeBlastHit)]
    pub fn calculate_grenade_blast_hit(
        &self,
        distance: f64,
        blast_radius: f64,
        max_damage: f64,
        falloff_power: f64,
    ) -> Result<JsValue, JsValue> {
        let output = self.calculate_grenade_blast_hit_inner(
            distance,
            blast_radius,
            max_damage,
            falloff_power,
        );
        serde_wasm_bindgen::to_value(&output).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = planKillDrops)]
    #[allow(clippy::too_many_arguments)]
    pub fn plan_kill_drops(
        &self,
        zone: String,
        explosive_kill: bool,
        player_health: f64,
        spare_mags: i32,
        ammo_spare_threshold: i32,
        grenade_count: i32,
        grenade_roll: f64,
        dev_drop_all_rewards: bool,
    ) -> Result<JsValue, JsValue> {
        let output = self.plan_kill_drops_inner(
            &zone,
            explosive_kill,
            player_health,
            spare_mags,
            ammo_spare_threshold,
            grenade_count,
            grenade_roll,
            dev_drop_all_rewards,
        );
        serde_wasm_bindgen::to_value(&output).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = planTargetRespawn)]
    pub fn plan_target_respawn(&self, respawn_delay_sec: f64) -> Result<JsValue, JsValue> {
        let output = self.plan_target_respawn_inner(respawn_delay_sec);
        serde_wasm_bindgen::to_value(&output).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = applyPlayerDeath)]
    pub fn apply_player_death(
        &mut self,
        kind: String,
        now_ms: f64,
        min_display_ms: f64,
    ) -> Result<JsValue, JsValue> {
        let output = self.apply_player_death_inner(&kind, now_ms, min_display_ms);
        serde_wasm_bindgen::to_value(&output).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = planPlayerRespawn)]
    pub fn plan_player_respawn(&mut self, now_ms: f64, fade_ms: f64) -> Result<JsValue, JsValue> {
        let output = self.plan_player_respawn_inner(now_ms, fade_ms);
        serde_wasm_bindgen::to_value(&output).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = purchaseWallWeapon)]
    #[allow(clippy::too_many_arguments)]
    pub fn purchase_wall_weapon(
        &mut self,
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
    ) -> Result<JsValue, JsValue> {
        let output = self.purchase_wall_weapon_inner(
            score,
            stage,
            weapon_available,
            rounds,
            spare,
            unlock_cost,
            resupply_cost,
            unlock_rounds,
            unlock_spare,
            resupply_spare,
        );
        serde_wasm_bindgen::to_value(&output).map_err(|err| JsValue::from_str(&err.to_string()))
    }
}

impl GameCore {
    fn public_state(&self) -> GameCorePublicState {
        GameCorePublicState {
            player_health: self.player_health,
            health_regen_timer: self.health_regen_timer,
            radioactive_overflow_decay_timer: self.radioactive_overflow_decay_timer,
            grenade_cooldown_remaining: self.grenade_cooldown_remaining,
            stamina: self.stamina,
            stamina_max: self.last_stamina_max.max(SPRINT_STAMINA_BASE),
            sprinting: self.sprinting,
            stamina_should_sync_from_health: self.stamina_should_sync_from_health,
            grenade_count: self.grenade_count,
            flashbang_count: self.flashbang_count,
            player_score: self.player_score,
        }
    }

    fn tick(&mut self, dt: f64) {
        self.stamina_should_sync_from_health = false;
        self.tick_grenade_cooldown(dt);
        self.tick_player_vitality(dt);
    }

    fn apply_pickup_reward_inner(
        &mut self,
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
                self.player_health = (self.player_health + applied as f64).min(health_cap.max(0.0));
                self.stamina_should_sync_from_health = true;
            }
            "grenade" => {
                self.grenade_count = self.grenade_count.saturating_add(applied).max(0);
            }
            "flashbang" => {
                self.flashbang_count = self.flashbang_count.saturating_add(applied).max(0);
            }
            "score" => {
                self.player_score = self.player_score.saturating_add(applied).max(0);
            }
            _ => {}
        }
        PickupRewardOutput {
            kind,
            value: applied,
            player_health: self.player_health,
            grenade_count: self.grenade_count,
            flashbang_count: self.flashbang_count,
            player_score: self.player_score,
        }
    }

    fn apply_target_damage_inner(
        &self,
        health: f64,
        max_health: f64,
        damage: f64,
    ) -> TargetDamageOutput {
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

    fn tick_target_repair_inner(
        &self,
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

    fn calculate_combat_score_inner(
        &self,
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

    fn calculate_grenade_blast_hit_inner(
        &self,
        distance: f64,
        blast_radius: f64,
        max_damage: f64,
        falloff_power: f64,
    ) -> GrenadeBlastOutput {
        let radius = blast_radius.max(0.001);
        if distance < 0.0 || distance >= radius {
            return GrenadeBlastOutput {
                hit: false,
                falloff: 0.0,
                damage: 0.0,
                knockback_mul: 0.0,
            };
        }
        let power = falloff_power.max(0.001);
        let falloff = (1.0 - (distance / radius).powf(power)).clamp(0.0, 1.0);
        GrenadeBlastOutput {
            hit: true,
            falloff,
            damage: max_damage.max(0.0) * falloff,
            knockback_mul: 0.85 + (1.35 - 0.85) * falloff,
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn plan_kill_drops_inner(
        &self,
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

    fn plan_target_respawn_inner(&self, respawn_delay_sec: f64) -> TargetRespawnOutput {
        TargetRespawnOutput {
            delay_ms: (respawn_delay_sec.max(0.0) * 1000.0).round() as i32,
            should_schedule: true,
        }
    }

    fn apply_player_death_inner(
        &mut self,
        kind: &str,
        now_ms: f64,
        min_display_ms: f64,
    ) -> PlayerDeathOutput {
        self.player_lives = (self.player_lives - 1).max(0);
        self.player_health = 0.0;
        self.stamina_should_sync_from_health = true;
        PlayerDeathOutput {
            died: true,
            reason: player_death_reason(kind).to_string(),
            player_lives: self.player_lives,
            player_health: self.player_health,
            game_over: self.player_lives <= 0,
            min_display_end: now_ms + min_display_ms.max(0.0),
            fade_end_time: f64::INFINITY,
        }
    }

    fn plan_player_respawn_inner(&mut self, now_ms: f64, fade_ms: f64) -> PlayerRespawnOutput {
        self.player_health = 100.0;
        self.stamina_should_sync_from_health = true;
        PlayerRespawnOutput {
            can_respawn: true,
            player_health: self.player_health,
            fade_end_time: now_ms + fade_ms.max(0.0),
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn purchase_wall_weapon_inner(
        &mut self,
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
        self.player_score = next_score;
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

    fn tick_grenade_cooldown(&mut self, dt: f64) {
        if self.grenade_cooldown_remaining <= 0.0 {
            self.grenade_cooldown_remaining = 0.0;
            return;
        }
        self.grenade_cooldown_remaining = (self.grenade_cooldown_remaining - dt).max(0.0);
    }

    fn tick_player_vitality(&mut self, dt: f64) {
        if self.player_health > 0.0 && self.player_health < 100.0 {
            self.health_regen_timer += dt;
            while self.health_regen_timer >= HEALTH_REGEN_INTERVAL_SEC && self.player_health < 100.0
            {
                self.health_regen_timer -= HEALTH_REGEN_INTERVAL_SEC;
                self.player_health = (self.player_health + HEALTH_REGEN_AMOUNT).min(100.0);
                self.stamina_should_sync_from_health = true;
            }
            self.radioactive_overflow_decay_timer = 0.0;
        } else if self.player_health > 100.0 {
            self.health_regen_timer = 0.0;
            self.radioactive_overflow_decay_timer += dt;
            while self.radioactive_overflow_decay_timer >= RADIOACTIVE_OVERFLOW_DECAY_INTERVAL_SEC
                && self.player_health > 100.0
            {
                self.radioactive_overflow_decay_timer -= RADIOACTIVE_OVERFLOW_DECAY_INTERVAL_SEC;
                self.player_health =
                    (self.player_health - RADIOACTIVE_OVERFLOW_DECAY_AMOUNT).max(100.0);
                self.stamina_should_sync_from_health = true;
            }
        } else {
            self.health_regen_timer = 0.0;
            self.radioactive_overflow_decay_timer = 0.0;
        }
    }

    fn apply_stamina_max_change(&mut self, stamina_max: f64) {
        let gain_cap = stamina_max.max(SPRINT_STAMINA_BASE);
        if gain_cap > self.last_stamina_max {
            let delta = gain_cap - self.last_stamina_max;
            if self.stamina <= gain_cap {
                self.stamina = (self.stamina + delta).min(gain_cap);
            }
        } else if gain_cap < self.last_stamina_max && gain_cap <= SPRINT_STAMINA_BASE {
            self.stamina = self.stamina.min(SPRINT_STAMINA_BASE);
        }
        self.last_stamina_max = gain_cap;
    }

    fn tick_player_core_inner(&mut self, input: PlayerCoreInput) -> PlayerCoreOutput {
        let dt = input.dt.clamp(0.0, 0.25);
        self.apply_stamina_max_change(input.stamina_max);

        let mut move_x = 0.0;
        let mut move_z = 0.0;
        if input.forward {
            move_z += 1.0;
        }
        if input.backward {
            move_z -= 1.0;
        }
        if !input.aiming && input.strafe_left {
            move_x -= 1.0;
        }
        if input.strafe_right {
            move_x += 1.0;
        }
        let moving = move_x != 0.0 || move_z != 0.0;

        self.sprinting = input.sprint && !input.crouching && moving && self.stamina > 0.001;
        if self.sprinting {
            self.stamina = (self.stamina - SPRINT_DRAIN_PER_SEC * dt).max(0.0);
        } else if self.stamina < SPRINT_STAMINA_BASE {
            self.stamina = (self.stamina + SPRINT_RECOVER_PER_SEC * dt).min(SPRINT_STAMINA_BASE);
        }

        if self.stamina > SPRINT_STAMINA_BASE {
            let decay_per_sec = RADIOACTIVE_OVERFLOW_DECAY_AMOUNT
                / (RADIOACTIVE_OVERFLOW_DECAY_INTERVAL_SEC * 100.0);
            self.stamina = (self.stamina - decay_per_sec * dt).max(SPRINT_STAMINA_BASE);
        }

        let mut speed = if input.crouching {
            input.crouch_speed
        } else if self.sprinting {
            input.sprint_speed
        } else {
            input.walk_speed
        };
        if input.aiming {
            speed *= input.aim_move_mul;
        }

        PlayerCoreOutput {
            move_x,
            move_z,
            moving,
            sprinting: self.sprinting,
            stamina: self.stamina,
            stamina_max: self.last_stamina_max.max(SPRINT_STAMINA_BASE),
            speed,
        }
    }

    fn tick_player_vertical_inner(&mut self, input: PlayerVerticalInput) -> PlayerVerticalOutput {
        let dt = input.dt.clamp(0.0, 0.25);
        self.grounded = input.grounded;
        let mut jumped = false;

        if input.grounded && input.can_jump && input.jump_pressed {
            self.velocity_y = input.jump_velocity;
            self.grounded = false;
            jumped = true;
        }

        self.velocity_y += input.gravity * dt;
        let y = input.y + self.velocity_y * dt;

        PlayerVerticalOutput {
            y,
            velocity_y: self.velocity_y,
            grounded: self.grounded,
            jumped,
        }
    }

    fn weapon_ammo_mut(&mut self, id: &str) -> Result<&mut WeaponAmmoState, JsValue> {
        match id {
            "rifle" => Ok(&mut self.rifle_ammo),
            "pistol" => Ok(&mut self.pistol_ammo),
            _ => Err(JsValue::from_str("unknown weapon id")),
        }
    }

    fn try_throw_kind(&mut self, kind: &str, cooldown_seconds: f64) -> bool {
        if self.grenade_cooldown_remaining > 0.0 {
            return false;
        }
        match kind {
            "grenade" if self.grenade_count > 0 => {
                self.grenade_count -= 1;
            }
            "flashbang" if self.flashbang_count > 0 => {
                self.flashbang_count -= 1;
            }
            _ => return false,
        }
        self.grenade_cooldown_remaining = cooldown_seconds.max(0.0);
        true
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

fn player_death_reason(kind: &str) -> &'static str {
    match kind {
        "fall" => "You fell to your death",
        "suicide" => "Suicide is never the answer",
        _ => "You were killed by an enemy",
    }
}

impl WeaponAmmoState {
    fn new(rounds: i32, spare: i32, magazine_size: i32, low_ammo_threshold: i32) -> Self {
        Self {
            rounds: rounds.max(0),
            spare: spare.max(0),
            magazine_size: magazine_size.max(1),
            low_ammo_threshold: low_ammo_threshold.max(0),
        }
    }

    fn try_reload(&mut self, force: bool) -> bool {
        if self.spare <= 0 {
            return false;
        }
        if !force && self.rounds >= self.low_ammo_threshold {
            return false;
        }
        self.spare -= 1;
        self.rounds = (self.rounds + self.magazine_size).min(self.magazine_size * 2);
        true
    }

    fn try_consume_round(&mut self, auto_reload: bool) -> (bool, bool) {
        let mut reloaded = false;
        if self.rounds <= 0 {
            if !auto_reload || !self.try_reload(true) {
                return (false, false);
            }
            reloaded = true;
        }
        self.rounds = (self.rounds - 1).max(0);
        (true, reloaded)
    }

    fn to_output(&self, reloaded: bool, fired: bool) -> WeaponAmmoOutput {
        WeaponAmmoOutput {
            rounds: self.rounds,
            spare: self.spare,
            reloaded,
            fired,
            low_ammo: self.rounds < self.low_ammo_threshold || self.empty(),
            empty: self.empty(),
        }
    }

    fn empty(&self) -> bool {
        self.rounds <= 0 && self.spare <= 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn regenerates_health_below_one_hundred() {
        let mut core = create_game_core(Some(98.0));
        core.tick(10.0);
        assert_eq!(core.player_health, 99.0);
        assert!(core.stamina_should_sync_from_health);
    }

    #[test]
    fn does_not_regenerate_dead_player() {
        let mut core = create_game_core(Some(0.0));
        core.tick(30.0);
        assert_eq!(core.player_health, 0.0);
    }

    #[test]
    fn decays_radioactive_overflow() {
        let mut core = create_game_core(Some(103.0));
        core.tick(5.0);
        assert_eq!(core.player_health, 102.0);
        assert!(core.stamina_should_sync_from_health);
    }

    #[test]
    fn overflow_decay_stops_at_one_hundred() {
        let mut core = create_game_core(Some(100.5));
        core.tick(5.0);
        assert_eq!(core.player_health, 100.0);
    }

    #[test]
    fn grenade_cooldown_ticks_to_zero() {
        let mut core = create_game_core(Some(100.0));
        core.set_grenade_cooldown(1.0);
        core.tick(0.4);
        assert_eq!(core.grenade_cooldown_remaining, 0.6);
        core.tick(1.0);
        assert_eq!(core.grenade_cooldown_remaining, 0.0);
    }

    #[test]
    fn damage_and_healing_update_health() {
        let mut core = create_game_core(Some(100.0));
        assert_eq!(core.damage_player(40.0), 60.0);
        assert_eq!(core.heal_player(15.0, Some(100.0)), 75.0);
    }

    #[test]
    fn player_core_drains_stamina_when_sprinting() {
        let mut core = create_game_core(Some(100.0));
        let output = core.tick_player_core_inner(PlayerCoreInput {
            dt: 1.0,
            forward: true,
            backward: false,
            strafe_left: false,
            strafe_right: false,
            sprint: true,
            crouching: false,
            aiming: false,
            stamina_max: 1.0,
            walk_speed: 4.0,
            sprint_speed: 7.0,
            crouch_speed: 2.5,
            aim_move_mul: 0.55,
        });
        assert!(output.sprinting);
        assert_eq!(output.speed, 7.0);
        assert!(output.stamina < 1.0);
    }

    #[test]
    fn player_core_blocks_left_strafe_while_aiming() {
        let mut core = create_game_core(Some(100.0));
        let output = core.tick_player_core_inner(PlayerCoreInput {
            dt: 0.016,
            forward: false,
            backward: false,
            strafe_left: true,
            strafe_right: false,
            sprint: false,
            crouching: false,
            aiming: true,
            stamina_max: 1.0,
            walk_speed: 4.0,
            sprint_speed: 7.0,
            crouch_speed: 2.5,
            aim_move_mul: 0.55,
        });
        assert_eq!(output.move_x, 0.0);
        assert!(!output.moving);
    }

    #[test]
    fn vertical_core_jumps_and_applies_gravity() {
        let mut core = create_game_core(Some(100.0));
        let output = core.tick_player_vertical_inner(PlayerVerticalInput {
            dt: 0.1,
            y: 1.65,
            grounded: true,
            jump_pressed: true,
            can_jump: true,
            gravity: -22.0,
            jump_velocity: 8.5,
        });
        assert!(output.jumped);
        assert!(!output.grounded);
        assert_eq!(output.velocity_y, 6.3);
        assert!(output.y > 1.65);
    }

    #[test]
    fn vertical_core_does_not_jump_without_clearance() {
        let mut core = create_game_core(Some(100.0));
        let output = core.tick_player_vertical_inner(PlayerVerticalInput {
            dt: 0.1,
            y: 1.65,
            grounded: true,
            jump_pressed: true,
            can_jump: false,
            gravity: -22.0,
            jump_velocity: 8.5,
        });
        assert!(!output.jumped);
        assert!(output.velocity_y < 0.0);
    }

    #[test]
    fn weapon_reload_uses_spare_mag_and_caps_loaded_rounds() {
        let mut ammo = WeaponAmmoState::new(70, 2, 80, 15);
        assert!(ammo.try_reload(true));
        assert_eq!(ammo.rounds, 150);
        assert_eq!(ammo.spare, 1);
        assert!(ammo.try_reload(true));
        assert_eq!(ammo.rounds, 160);
        assert_eq!(ammo.spare, 0);
    }

    #[test]
    fn weapon_reload_respects_low_ammo_threshold_without_force() {
        let mut ammo = WeaponAmmoState::new(16, 2, 80, 15);
        assert!(!ammo.try_reload(false));
        assert_eq!(ammo.rounds, 16);
        assert_eq!(ammo.spare, 2);

        ammo.rounds = 14;
        assert!(ammo.try_reload(false));
        assert_eq!(ammo.rounds, 94);
        assert_eq!(ammo.spare, 1);
    }

    #[test]
    fn weapon_consume_auto_reloads_when_empty() {
        let mut ammo = WeaponAmmoState::new(0, 1, 12, 4);
        let (fired, reloaded) = ammo.try_consume_round(true);
        assert!(fired);
        assert!(reloaded);
        assert_eq!(ammo.rounds, 11);
        assert_eq!(ammo.spare, 0);
    }

    #[test]
    fn weapon_consume_fails_when_empty_without_spare() {
        let mut ammo = WeaponAmmoState::new(0, 0, 12, 4);
        let (fired, reloaded) = ammo.try_consume_round(true);
        assert!(!fired);
        assert!(!reloaded);
        assert_eq!(ammo.rounds, 0);
    }

    #[test]
    fn throwable_throw_consumes_count_and_sets_cooldown() {
        let mut core = create_game_core(Some(100.0));
        assert!(core.try_throw_kind("grenade", 0.5));
        assert_eq!(core.grenade_count, 3);
        assert_eq!(core.grenade_cooldown_remaining, 0.5);
        assert!(!core.try_throw_kind("grenade", 0.5));
        assert_eq!(core.grenade_count, 3);
    }

    #[test]
    fn pickup_reward_updates_core_state() {
        let mut core = create_game_core(Some(80.0));
        core.apply_pickup_reward_inner("hp".to_string(), 10, 0, 100.0);
        assert_eq!(core.player_health, 90.0);
        core.apply_pickup_reward_inner("flashbang".to_string(), 2, 1, 100.0);
        assert_eq!(core.flashbang_count, 6);
        core.apply_pickup_reward_inner("score".to_string(), 0, 50, 100.0);
        assert_eq!(core.player_score, 50);
    }

    #[test]
    fn combat_score_applies_hit_cap_and_kill_bonus() {
        let value = core_score("head", 20.0, true, 30, 100);
        assert_eq!(value.score, 280);
        assert_eq!(value.hit_score_awarded, 60);
        assert_eq!(value.total_target_score, 380);
    }

    #[test]
    fn grenade_blast_damage_falls_off_with_distance() {
        let core = create_game_core(Some(100.0));
        let output = core.calculate_grenade_blast_hit_inner(2.5, 5.0, 150.0, 1.0);
        assert!(output.hit);
        assert_eq!(output.falloff, 0.5);
        assert_eq!(output.damage, 75.0);
        assert_eq!(output.knockback_mul, 1.1);
    }

    #[test]
    fn target_repair_ticks_cooldown_before_healing() {
        let core = create_game_core(Some(100.0));
        let output = core.tick_target_repair_inner(0.5, 10.0, 30.0, 1.25, 0.63);
        assert_eq!(output.health, 10.0);
        assert_eq!(output.repair_cooldown, 0.75);
        assert!(!output.repaired);
        assert!(output.alive);
    }

    #[test]
    fn target_repair_heals_and_clamps_to_max_health() {
        let core = create_game_core(Some(100.0));
        let output = core.tick_target_repair_inner(2.0, 29.5, 30.0, 0.0, 0.63);
        assert_eq!(output.health, 30.0);
        assert_eq!(output.ratio, 1.0);
        assert!(output.repaired);
    }

    #[test]
    fn kill_drop_plan_matches_headshot_ammo_and_grenade_rules() {
        let core = create_game_core(Some(100.0));
        let output = core.plan_kill_drops_inner("head", false, 100.0, 1, 1, 0, 0.69, false);
        assert!(output.hp);
        assert!(output.ammo);
        assert!(output.grenade);

        let output = core.plan_kill_drops_inner("body", false, 100.0, 2, 1, 5, 0.0, false);
        assert!(!output.hp);
        assert!(!output.ammo);
        assert!(!output.grenade);
    }

    #[test]
    fn kill_drop_plan_always_drops_hp_for_explosive_kills() {
        let core = create_game_core(Some(100.0));
        let output = core.plan_kill_drops_inner("grenade", true, 100.0, 4, 1, 4, 0.99, false);
        assert!(output.hp);
        assert!(!output.ammo);
        assert!(!output.grenade);
    }

    #[test]
    fn dev_drop_all_rewards_overrides_drop_rules() {
        let core = create_game_core(Some(100.0));
        let output = core.plan_kill_drops_inner("body", false, 100.0, 4, 1, 5, 0.99, true);
        assert!(output.hp);
        assert!(output.ammo);
        assert!(output.grenade);
    }

    #[test]
    fn target_respawn_plan_converts_seconds_to_milliseconds() {
        let core = create_game_core(Some(100.0));
        let output = core.plan_target_respawn_inner(4.25);
        assert!(output.should_schedule);
        assert_eq!(output.delay_ms, 4250);
    }

    #[test]
    fn player_death_decrements_lives_and_sets_reason() {
        let mut core = create_game_core(Some(12.0));
        core.sync_player_lives(2);
        let output = core.apply_player_death_inner("fall", 1000.0, 800.0);
        assert!(output.died);
        assert_eq!(output.reason, "You fell to your death");
        assert_eq!(output.player_lives, 1);
        assert_eq!(output.player_health, 0.0);
        assert!(!output.game_over);
        assert_eq!(output.min_display_end, 1800.0);
    }

    #[test]
    fn player_death_marks_game_over_on_last_life() {
        let mut core = create_game_core(Some(2.0));
        core.sync_player_lives(1);
        let output = core.apply_player_death_inner("suicide", 100.0, 800.0);
        assert_eq!(output.reason, "Suicide is never the answer");
        assert_eq!(output.player_lives, 0);
        assert!(output.game_over);
    }

    #[test]
    fn player_respawn_restores_health_and_sets_fade_end() {
        let mut core = create_game_core(Some(0.0));
        let output = core.plan_player_respawn_inner(2000.0, 1200.0);
        assert!(output.can_respawn);
        assert_eq!(output.player_health, 100.0);
        assert_eq!(output.fade_end_time, 3200.0);
        assert_eq!(core.player_health, 100.0);
    }

    #[test]
    fn wall_shop_first_purchase_unlocks_weapon_and_sets_starting_ammo() {
        let mut core = create_game_core(Some(100.0));
        let output = core.purchase_wall_weapon_inner(2500, 0, false, 0, 0, 2000, 500, 80, 2, 1);
        assert!(output.purchased);
        assert!(output.first_unlock);
        assert_eq!(output.player_score, 500);
        assert_eq!(output.stage, 1);
        assert!(output.weapon_unlocked);
        assert_eq!(output.rounds, 80);
        assert_eq!(output.spare, 2);
        assert_eq!(core.player_score, 500);
    }

    #[test]
    fn wall_shop_resupply_advances_stage_and_adds_spare_mags() {
        let mut core = create_game_core(Some(100.0));
        let output = core.purchase_wall_weapon_inner(900, 2, true, 40, 1, 2000, 500, 80, 2, 1);
        assert!(output.purchased);
        assert!(!output.first_unlock);
        assert!(output.can_resupply);
        assert_eq!(output.player_score, 400);
        assert_eq!(output.stage, 3);
        assert_eq!(output.rounds, 40);
        assert_eq!(output.spare, 2);
    }

    #[test]
    fn wall_shop_denies_purchase_when_score_is_too_low() {
        let mut core = create_game_core(Some(100.0));
        let output = core.purchase_wall_weapon_inner(100, 0, false, 0, 0, 2000, 500, 80, 2, 1);
        assert!(!output.purchased);
        assert!(!output.affordable);
        assert_eq!(output.player_score, 100);
        assert_eq!(output.stage, 0);
        assert_eq!(core.player_score, 0);
    }

    fn core_score(
        zone: &str,
        damage: f64,
        killed: bool,
        hit_score_awarded: i32,
        total_score_awarded: i32,
    ) -> CombatScoreOutput {
        let core = create_game_core(Some(100.0));
        core.calculate_combat_score_inner(
            zone,
            damage,
            killed,
            hit_score_awarded,
            total_score_awarded,
        )
    }
}
