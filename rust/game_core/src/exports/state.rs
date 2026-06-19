use crate::ammo::WeaponAmmoState;
use crate::lifecycle;
use crate::score;
use crate::state::GameCore;
use crate::types::*;
use crate::weapon_fire::{tick_weapon_fire, WeaponFireTickInput};
use wasm_bindgen::prelude::*;

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
        self.tick(input.dt.clamp(0.0, 0.25), input.paused);
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

    #[wasm_bindgen(js_name = computePlayerMovementGates)]
    pub fn compute_player_movement_gates(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: PlayerMovementGateInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        let output = self.compute_player_movement_gates_inner(input);
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
        self.stamina = 1.0;
        self.last_stamina_max = stamina_max.unwrap_or(1.0).max(1.0);
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

    #[wasm_bindgen(js_name = isWeaponBurstActive)]
    pub fn is_weapon_burst_active(&self) -> bool {
        self.weapon_fire.burst_shots_left > 0
    }

    #[wasm_bindgen(js_name = tickWeaponFire)]
    pub fn tick_weapon_fire_wasm(&mut self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: WeaponFireTickInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        let weapon_id = input.weapon_id.clone();
        let mut ammo = *self.weapon_ammo_mut(&weapon_id)?;
        let output = tick_weapon_fire(&mut self.weapon_fire, &mut ammo, input);
        *self.weapon_ammo_mut(&weapon_id)? = ammo;
        serde_wasm_bindgen::to_value(&output).map_err(|err| JsValue::from_str(&err.to_string()))
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
        let output =
            self.tick_target_repair_inner(dt, health, max_health, repair_cooldown, repair_per_second);
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

    #[wasm_bindgen(js_name = canInteractGate)]
    pub fn can_interact_gate(&self, input: JsValue) -> Result<bool, JsValue> {
        let input: InteractionGateInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        Ok(self.can_interact_gate_inner(input))
    }

    #[wasm_bindgen(js_name = tickOilBarrelFireProximityDamage)]
    pub fn tick_oil_barrel_fire_proximity_damage(&mut self, input: JsValue) -> Result<bool, JsValue> {
        let input: OilBarrelFireProximityInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        Ok(self.tick_oil_barrel_fire_proximity_damage_inner(input))
    }

    #[wasm_bindgen(js_name = applyGrenadeExplosionDamage)]
    pub fn apply_grenade_explosion_damage(&mut self) -> f64 {
        lifecycle::apply_grenade_explosion_damage(self)
    }

    #[wasm_bindgen(js_name = applyOilBarrelFireDamage)]
    pub fn apply_oil_barrel_fire_damage(&mut self) -> f64 {
        lifecycle::apply_oil_barrel_fire_damage(self)
    }

    #[wasm_bindgen(js_name = canWallWeaponResupply)]
    pub fn can_wall_weapon_resupply(&self, input: JsValue) -> Result<bool, JsValue> {
        let input: WallWeaponResupplyInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        Ok(self.can_wall_weapon_resupply_inner(input))
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
        let output = score::plan_kill_drops(
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
}
