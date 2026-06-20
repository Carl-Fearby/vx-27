use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameCoreFrameInput {
    pub dt: f64,
    pub paused: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameCorePublicState {
    pub player_health: f64,
    pub health_regen_timer: f64,
    pub radioactive_overflow_decay_timer: f64,
    pub mission_time: f64,
    pub grenade_cooldown_remaining: f64,
    pub stamina: f64,
    pub stamina_max: f64,
    pub sprinting: bool,
    pub stamina_should_sync_from_health: bool,
    pub grenade_count: i32,
    pub flashbang_count: i32,
    pub player_score: i32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerCoreInput {
    pub dt: f64,
    pub forward: bool,
    pub backward: bool,
    pub strafe_left: bool,
    pub strafe_right: bool,
    pub sprint: bool,
    pub crouching: bool,
    pub aiming: bool,
    pub stamina_max: f64,
    pub walk_speed: f64,
    pub sprint_speed: f64,
    pub crouch_speed: f64,
    pub aim_move_mul: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerCoreOutput {
    pub move_x: f64,
    pub move_z: f64,
    pub moving: bool,
    pub sprinting: bool,
    pub stamina: f64,
    pub stamina_max: f64,
    pub speed: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerVerticalInput {
    pub dt: f64,
    pub y: f64,
    pub grounded: bool,
    pub jump_pressed: bool,
    pub can_jump: bool,
    pub gravity: f64,
    pub jump_velocity: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerVerticalOutput {
    pub y: f64,
    pub velocity_y: f64,
    pub grounded: bool,
    pub jumped: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerMovementGateInput {
    pub want_crouch: bool,
    pub can_stand: bool,
    pub grounded: bool,
    #[serde(default)]
    pub stair_supported: bool,
    pub jump_pressed: bool,
    pub jump_clearance: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerMovementGateOutput {
    pub crouching: bool,
    pub force_crouch: bool,
    pub can_jump: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeaponAmmoOutput {
    pub rounds: i32,
    pub spare: i32,
    pub reloaded: bool,
    pub fired: bool,
    pub low_ammo: bool,
    pub empty: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThrowableOutput {
    pub thrown: bool,
    pub kind: String,
    pub grenade_count: i32,
    pub flashbang_count: i32,
    pub cooldown_remaining: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickupRewardOutput {
    pub kind: String,
    pub value: i32,
    pub player_health: f64,
    pub grenade_count: i32,
    pub flashbang_count: i32,
    pub player_score: i32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetDamageOutput {
    pub health: f64,
    pub ratio: f64,
    pub killed: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetRepairOutput {
    pub health: f64,
    pub ratio: f64,
    pub repair_cooldown: f64,
    pub repaired: bool,
    pub alive: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetRespawnOutput {
    pub delay_ms: i32,
    pub should_schedule: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerDeathOutput {
    pub died: bool,
    pub reason: String,
    pub player_lives: i32,
    pub player_health: f64,
    pub game_over: bool,
    pub min_display_end: f64,
    pub fade_end_time: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerRespawnOutput {
    pub can_respawn: bool,
    pub player_health: f64,
    pub fade_end_time: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WallShopPurchaseOutput {
    pub purchased: bool,
    pub affordable: bool,
    pub first_unlock: bool,
    pub can_resupply: bool,
    pub player_score: i32,
    pub stage: i32,
    pub weapon_unlocked: bool,
    pub rounds: i32,
    pub spare: i32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InteractionGateInput {
    pub pointer_active: bool,
    pub frozen: bool,
    pub rebind_action_open: bool,
    pub settings_open: bool,
    pub controls_open: bool,
    pub console_hack_open: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OilBarrelFireProximityInput {
    pub dt: f64,
    pub in_range: bool,
    pub interval_sec: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WallWeaponResupplyInput {
    pub weapon_id: String,
    pub stage: i32,
    pub pistol_owned: bool,
}
