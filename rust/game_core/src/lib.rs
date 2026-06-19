mod ammo;
mod lifecycle;
mod collision;
mod collectible;
mod flashbang;
mod gameplay_rules;
mod grenade;
mod ground_support;
mod hit_zones;
mod player_collision;
mod player_headroom;
mod player;
mod exports;
mod projectile;
mod projectile_collision;
mod ragdoll;
mod recoil;
mod score;
mod spawn_foot_y;
mod target_spawn;
mod types;
mod vx27_collision;
mod walk_bounds;
mod weapon_damage;
mod weapon_fire;
mod state;

pub use state::{create_game_core, GameCore};
pub use ammo::WeaponAmmoState;
pub use types::*;

const SPRINT_STAMINA_BASE: f64 = 1.0;

#[cfg(test)]
mod tests;
