use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

const HEALTH_REGEN_INTERVAL_SEC: f64 = 10.0;
const HEALTH_REGEN_AMOUNT: f64 = 1.0;
const RADIOACTIVE_OVERFLOW_DECAY_INTERVAL_SEC: f64 = 5.0;
const RADIOACTIVE_OVERFLOW_DECAY_AMOUNT: f64 = 1.0;
const SPRINT_STAMINA_BASE: f64 = 1.0;
const SPRINT_DRAIN_PER_SEC: f64 = (1.0 / 5.0) * 1.33;
const SPRINT_RECOVER_PER_SEC: f64 = SPRINT_DRAIN_PER_SEC / 4.0;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameCoreFrameInput {
    dt: f64,
}

#[derive(Clone, Debug, Serialize)]
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

#[derive(Clone, Debug, Serialize)]
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

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerVerticalOutput {
    y: f64,
    velocity_y: f64,
    grounded: bool,
    jumped: bool,
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
        }
    }

    fn tick(&mut self, dt: f64) {
        self.stamina_should_sync_from_health = false;
        self.tick_grenade_cooldown(dt);
        self.tick_player_vitality(dt);
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
            let decay_per_sec =
                RADIOACTIVE_OVERFLOW_DECAY_AMOUNT / (RADIOACTIVE_OVERFLOW_DECAY_INTERVAL_SEC * 100.0);
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
}
