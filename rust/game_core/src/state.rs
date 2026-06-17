use crate::{
    ammo::WeaponAmmoState,
    lifecycle, types::*, SPRINT_STAMINA_BASE,
};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct GameCore {
    pub(crate) player_health: f64,
    pub(crate) health_regen_timer: f64,
    pub(crate) radioactive_overflow_decay_timer: f64,
    pub(crate) mission_time: f64,
    pub(crate) grenade_cooldown_remaining: f64,
    pub(crate) stamina: f64,
    pub(crate) last_stamina_max: f64,
    pub(crate) sprinting: bool,
    pub(crate) velocity_y: f64,
    pub(crate) grounded: bool,
    pub(crate) stamina_should_sync_from_health: bool,
    pub(crate) rifle_ammo: WeaponAmmoState,
    pub(crate) pistol_ammo: WeaponAmmoState,
    pub(crate) grenade_count: i32,
    pub(crate) flashbang_count: i32,
    pub(crate) player_score: i32,
    pub(crate) player_lives: i32,
    pub(crate) oil_barrel_fire_proximity_cooldown: f64,
}

#[wasm_bindgen(js_name = createGameCore)]
pub fn create_game_core(player_health: Option<f64>) -> GameCore {
    GameCore {
        player_health: player_health.unwrap_or(100.0),
        health_regen_timer: 0.0,
        radioactive_overflow_decay_timer: 0.0,
        mission_time: 0.0,
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
        oil_barrel_fire_proximity_cooldown: 0.0,
    }
}

impl GameCore {
    pub(crate) fn public_state(&self) -> GameCorePublicState {
        GameCorePublicState {
            player_health: self.player_health,
            health_regen_timer: self.health_regen_timer,
            radioactive_overflow_decay_timer: self.radioactive_overflow_decay_timer,
            mission_time: self.mission_time,
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

    pub(crate) fn tick(&mut self, dt: f64, paused: bool) {
        self.stamina_should_sync_from_health = false;
        self.tick_grenade_cooldown(dt);
        self.tick_player_vitality(dt);
        if !paused {
            self.mission_time += dt.max(0.0);
        }
    }

    pub(crate) fn apply_pickup_reward_inner(
        &mut self,
        kind: String,
        value: i32,
        default_value: i32,
        health_cap: f64,
    ) -> PickupRewardOutput {
        lifecycle::apply_pickup_reward(self, kind, value, default_value, health_cap)
    }

    pub(crate) fn apply_target_damage_inner(
        &self,
        health: f64,
        max_health: f64,
        damage: f64,
    ) -> TargetDamageOutput {
        lifecycle::apply_target_damage(health, max_health, damage)
    }

    pub(crate) fn tick_target_repair_inner(
        &self,
        dt: f64,
        health: f64,
        max_health: f64,
        repair_cooldown: f64,
        repair_per_second: f64,
    ) -> TargetRepairOutput {
        lifecycle::tick_target_repair(dt, health, max_health, repair_cooldown, repair_per_second)
    }

    pub(crate) fn plan_target_respawn_inner(&self, respawn_delay_sec: f64) -> TargetRespawnOutput {
        lifecycle::plan_target_respawn(respawn_delay_sec)
    }

    pub(crate) fn apply_player_death_inner(
        &mut self,
        kind: &str,
        now_ms: f64,
        min_display_ms: f64,
    ) -> PlayerDeathOutput {
        lifecycle::apply_player_death(self, kind, now_ms, min_display_ms)
    }

    pub(crate) fn plan_player_respawn_inner(
        &mut self,
        now_ms: f64,
        fade_ms: f64,
    ) -> PlayerRespawnOutput {
        lifecycle::plan_player_respawn(self, now_ms, fade_ms)
    }

    pub(crate) fn can_interact_gate_inner(&self, input: InteractionGateInput) -> bool {
        input.pointer_active
            && !input.frozen
            && !input.rebind_action_open
            && !input.settings_open
            && !input.controls_open
            && !input.console_hack_open
    }

    pub(crate) fn tick_oil_barrel_fire_proximity_damage_inner(
        &mut self,
        input: OilBarrelFireProximityInput,
    ) -> bool {
        self.oil_barrel_fire_proximity_cooldown =
            (self.oil_barrel_fire_proximity_cooldown - input.dt.max(0.0)).max(0.0);
        if !input.in_range || self.oil_barrel_fire_proximity_cooldown > 0.0 {
            return false;
        }
        self.oil_barrel_fire_proximity_cooldown = input.interval_sec.max(0.0);
        true
    }

    pub(crate) fn can_wall_weapon_resupply_inner(
        &self,
        input: WallWeaponResupplyInput,
    ) -> bool {
        if input.stage < 1 {
            return false;
        }
        if input.weapon_id == "pistol" {
            return input.pistol_owned;
        }
        true
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) fn purchase_wall_weapon_inner(
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
        lifecycle::purchase_wall_weapon(
            self,
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
        )
    }

    pub(crate) fn tick_grenade_cooldown(&mut self, dt: f64) {
        crate::player::tick_grenade_cooldown(self, dt);
    }

    pub(crate) fn tick_player_vitality(&mut self, dt: f64) {
        crate::player::tick_player_vitality(self, dt);
    }

    pub(crate) fn apply_stamina_max_change(&mut self, stamina_max: f64) {
        crate::player::apply_stamina_max_change(self, stamina_max);
    }

    pub(crate) fn tick_player_core_inner(&mut self, input: PlayerCoreInput) -> PlayerCoreOutput {
        crate::player::tick_player_core(self, input)
    }

    pub(crate) fn tick_player_vertical_inner(
        &mut self,
        input: PlayerVerticalInput,
    ) -> PlayerVerticalOutput {
        crate::player::tick_player_vertical(self, input)
    }

    pub(crate) fn compute_player_movement_gates_inner(
        &self,
        input: PlayerMovementGateInput,
    ) -> PlayerMovementGateOutput {
        crate::player::compute_player_movement_gates(input)
    }

    pub(crate) fn weapon_ammo_mut(&mut self, id: &str) -> Result<&mut WeaponAmmoState, JsValue> {
        match id {
            "rifle" => Ok(&mut self.rifle_ammo),
            "pistol" => Ok(&mut self.pistol_ammo),
            _ => Err(JsValue::from_str("unknown weapon id")),
        }
    }

    pub(crate) fn try_throw_kind(&mut self, kind: &str, cooldown_seconds: f64) -> bool {
        crate::player::try_throw_kind(self, kind, cooldown_seconds)
    }
}
