use crate::ammo::WeaponAmmoState;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeaponFireTickInput {
    pub weapon_id: String,
    pub mode: String,
    pub dt: f64,
    #[serde(default)]
    pub shoot_pressed: bool,
    #[serde(default)]
    pub shoot_held: bool,
    pub burst_shot_count: i32,
    pub burst_interval: f64,
    pub auto_fire_interval: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeaponFireTickOutput {
    pub shots_fired: i32,
    pub rounds: i32,
    pub spare: i32,
    pub reloaded: bool,
    pub low_ammo: bool,
    pub empty: bool,
    pub burst_active: bool,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct WeaponFireState {
    pub burst_shots_left: i32,
    pub burst_timer: f64,
    pub auto_fire_timer: f64,
}

fn consume_round(ammo: &mut WeaponAmmoState) -> (bool, bool) {
    ammo.try_consume_round(true)
}

pub fn tick_weapon_fire(
    state: &mut WeaponFireState,
    ammo: &mut WeaponAmmoState,
    input: WeaponFireTickInput,
) -> WeaponFireTickOutput {
    let dt = input.dt.clamp(0.0, 0.25);
    let burst_interval = input.burst_interval.max(0.0);
    let auto_fire_interval = input.auto_fire_interval.max(0.0);
    let mut shots_fired = 0;
    let mut reloaded = false;

    if state.burst_shots_left == 0 && input.mode == "burst" && input.shoot_pressed {
        state.burst_shots_left = input.burst_shot_count.max(0);
        state.burst_timer = 0.0;
    }

    if state.burst_shots_left > 0 {
        state.burst_timer -= dt;
        while state.burst_shots_left > 0 && state.burst_timer <= 0.0 {
            let (fired, did_reload) = consume_round(ammo);
            reloaded |= did_reload;
            if !fired {
                state.burst_shots_left = 0;
                break;
            }
            shots_fired += 1;
            state.burst_shots_left -= 1;
            state.burst_timer = if state.burst_shots_left > 0 {
                burst_interval
            } else {
                0.0
            };
        }
    } else if input.mode == "single" && input.shoot_pressed {
        let (fired, did_reload) = consume_round(ammo);
        reloaded = did_reload;
        shots_fired = i32::from(fired);
    } else if input.mode == "auto" {
        state.auto_fire_timer -= dt;
        if input.shoot_held && (input.shoot_pressed || state.auto_fire_timer <= 0.0) {
            let (fired, did_reload) = consume_round(ammo);
            reloaded = did_reload;
            if fired {
                shots_fired = 1;
                state.auto_fire_timer = auto_fire_interval;
            }
        }
    }

    WeaponFireTickOutput {
        shots_fired,
        rounds: ammo.rounds,
        spare: ammo.spare,
        reloaded,
        low_ammo: ammo.rounds < ammo.low_ammo_threshold || ammo.empty(),
        empty: ammo.rounds <= 0 && ammo.spare <= 0,
        burst_active: state.burst_shots_left > 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(mode: &str) -> WeaponFireTickInput {
        WeaponFireTickInput {
            weapon_id: "rifle".to_string(),
            mode: mode.to_string(),
            dt: 0.016,
            shoot_pressed: true,
            shoot_held: true,
            burst_shot_count: 3,
            burst_interval: 0.085,
            auto_fire_interval: 0.1,
        }
    }

    #[test]
    fn single_fire_consumes_one_round_per_press() {
        let mut state = WeaponFireState::default();
        let mut ammo = WeaponAmmoState::new(5, 0, 12, 4);
        let output = tick_weapon_fire(&mut state, &mut ammo, input("single"));
        assert_eq!(output.shots_fired, 1);
        assert_eq!(output.rounds, 4);
        assert!(!output.burst_active);
    }

    #[test]
    fn burst_fire_emits_three_timed_rounds() {
        let mut state = WeaponFireState::default();
        let mut ammo = WeaponAmmoState::new(5, 0, 80, 15);
        let mut tick = input("burst");
        let first = tick_weapon_fire(&mut state, &mut ammo, tick.clone());
        assert_eq!(first.shots_fired, 1);
        assert!(first.burst_active);

        tick.shoot_pressed = false;
        tick.dt = 0.085;
        assert_eq!(tick_weapon_fire(&mut state, &mut ammo, tick.clone()).shots_fired, 1);
        let third = tick_weapon_fire(&mut state, &mut ammo, tick);
        assert_eq!(third.shots_fired, 1);
        assert!(!third.burst_active);
        assert_eq!(ammo.rounds, 2);
    }

    #[test]
    fn automatic_fire_obeys_interval_and_requires_hold() {
        let mut state = WeaponFireState::default();
        let mut ammo = WeaponAmmoState::new(5, 0, 80, 15);
        let mut tick = input("auto");
        assert_eq!(tick_weapon_fire(&mut state, &mut ammo, tick.clone()).shots_fired, 1);
        tick.shoot_pressed = false;
        assert_eq!(tick_weapon_fire(&mut state, &mut ammo, tick.clone()).shots_fired, 0);
        tick.dt = 0.1;
        assert_eq!(tick_weapon_fire(&mut state, &mut ammo, tick.clone()).shots_fired, 1);
        tick.shoot_held = false;
        tick.dt = 1.0;
        assert_eq!(tick_weapon_fire(&mut state, &mut ammo, tick).shots_fired, 0);
    }

    #[test]
    fn failed_burst_stops_when_ammo_is_exhausted() {
        let mut state = WeaponFireState::default();
        let mut ammo = WeaponAmmoState::new(1, 0, 80, 15);
        let mut tick = input("burst");
        tick.dt = 1.0;
        let first = tick_weapon_fire(&mut state, &mut ammo, tick.clone());
        assert_eq!(first.shots_fired, 1);
        assert!(first.empty);
        assert!(first.burst_active);

        tick.shoot_pressed = false;
        tick.dt = 0.085;
        let second = tick_weapon_fire(&mut state, &mut ammo, tick);
        assert_eq!(second.shots_fired, 0);
        assert!(!second.burst_active);
    }
}
