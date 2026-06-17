use crate::{
    GameCore, PlayerCoreInput, PlayerCoreOutput, PlayerMovementGateInput,
    PlayerMovementGateOutput, PlayerVerticalInput, PlayerVerticalOutput,
};

const HEALTH_REGEN_INTERVAL_SEC: f64 = 10.0;
const HEALTH_REGEN_AMOUNT: f64 = 1.0;
const RADIOACTIVE_OVERFLOW_DECAY_INTERVAL_SEC: f64 = 5.0;
const RADIOACTIVE_OVERFLOW_DECAY_AMOUNT: f64 = 1.0;
const SPRINT_STAMINA_BASE: f64 = 1.0;
const SPRINT_DRAIN_PER_SEC: f64 = (1.0 / 5.0) * 1.33;
const SPRINT_RECOVER_PER_SEC: f64 = SPRINT_DRAIN_PER_SEC / 4.0;

pub fn tick_grenade_cooldown(core: &mut GameCore, dt: f64) {
    if core.grenade_cooldown_remaining <= 0.0 {
        core.grenade_cooldown_remaining = 0.0;
        return;
    }
    core.grenade_cooldown_remaining = (core.grenade_cooldown_remaining - dt).max(0.0);
}

pub fn tick_player_vitality(core: &mut GameCore, dt: f64) {
    if core.player_health > 0.0 && core.player_health < 100.0 {
        core.health_regen_timer += dt;
        while core.health_regen_timer >= HEALTH_REGEN_INTERVAL_SEC && core.player_health < 100.0 {
            core.health_regen_timer -= HEALTH_REGEN_INTERVAL_SEC;
            core.player_health = (core.player_health + HEALTH_REGEN_AMOUNT).min(100.0);
            core.stamina_should_sync_from_health = true;
        }
        core.radioactive_overflow_decay_timer = 0.0;
    } else if core.player_health > 100.0 {
        core.health_regen_timer = 0.0;
        core.radioactive_overflow_decay_timer += dt;
        while core.radioactive_overflow_decay_timer >= RADIOACTIVE_OVERFLOW_DECAY_INTERVAL_SEC
            && core.player_health > 100.0
        {
            core.radioactive_overflow_decay_timer -= RADIOACTIVE_OVERFLOW_DECAY_INTERVAL_SEC;
            core.player_health =
                (core.player_health - RADIOACTIVE_OVERFLOW_DECAY_AMOUNT).max(100.0);
            core.stamina_should_sync_from_health = true;
        }
    } else {
        core.health_regen_timer = 0.0;
        core.radioactive_overflow_decay_timer = 0.0;
    }
}

pub fn apply_stamina_max_change(core: &mut GameCore, stamina_max: f64) {
    let gain_cap = stamina_max.max(SPRINT_STAMINA_BASE);
    if gain_cap > core.last_stamina_max {
        let delta = gain_cap - core.last_stamina_max;
        if core.stamina <= gain_cap {
            core.stamina = (core.stamina + delta).min(gain_cap);
        }
    } else if gain_cap < core.last_stamina_max && gain_cap <= SPRINT_STAMINA_BASE {
        core.stamina = core.stamina.min(SPRINT_STAMINA_BASE);
    }
    core.last_stamina_max = gain_cap;
}

pub fn tick_player_core(core: &mut GameCore, input: PlayerCoreInput) -> PlayerCoreOutput {
    let dt = input.dt.clamp(0.0, 0.25);
    apply_stamina_max_change(core, input.stamina_max);

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

    core.sprinting = input.sprint && !input.crouching && moving && core.stamina > 0.001;
    if core.sprinting {
        core.stamina = (core.stamina - SPRINT_DRAIN_PER_SEC * dt).max(0.0);
    } else if core.stamina < SPRINT_STAMINA_BASE {
        core.stamina = (core.stamina + SPRINT_RECOVER_PER_SEC * dt).min(SPRINT_STAMINA_BASE);
    }

    if core.stamina > SPRINT_STAMINA_BASE {
        let decay_per_sec =
            RADIOACTIVE_OVERFLOW_DECAY_AMOUNT / (RADIOACTIVE_OVERFLOW_DECAY_INTERVAL_SEC * 100.0);
        core.stamina = (core.stamina - decay_per_sec * dt).max(SPRINT_STAMINA_BASE);
    }

    let mut speed = if input.crouching {
        input.crouch_speed
    } else if core.sprinting {
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
        sprinting: core.sprinting,
        stamina: core.stamina,
        stamina_max: core.last_stamina_max.max(SPRINT_STAMINA_BASE),
        speed,
    }
}

pub fn tick_player_vertical(core: &mut GameCore, input: PlayerVerticalInput) -> PlayerVerticalOutput {
    let dt = input.dt.clamp(0.0, 0.25);
    core.grounded = input.grounded;
    let mut jumped = false;

    if input.grounded && input.can_jump && input.jump_pressed {
        core.velocity_y = input.jump_velocity;
        core.grounded = false;
        jumped = true;
    }

    core.velocity_y += input.gravity * dt;
    let y = input.y + core.velocity_y * dt;

    PlayerVerticalOutput {
        y,
        velocity_y: core.velocity_y,
        grounded: core.grounded,
        jumped,
    }
}

pub fn compute_player_movement_gates(input: PlayerMovementGateInput) -> PlayerMovementGateOutput {
    let force_crouch = !input.can_stand;
    let crouching = input.want_crouch || force_crouch;
    let can_jump = input.grounded && !force_crouch && input.jump_pressed && input.jump_clearance;
    PlayerMovementGateOutput {
        crouching,
        force_crouch,
        can_jump,
    }
}

pub fn try_throw_kind(core: &mut GameCore, kind: &str, cooldown_seconds: f64) -> bool {
    if core.grenade_cooldown_remaining > 0.0 {
        return false;
    }
    match kind {
        "grenade" if core.grenade_count > 0 => {
            core.grenade_count -= 1;
        }
        "flashbang" if core.flashbang_count > 0 => {
            core.flashbang_count -= 1;
        }
        _ => return false,
    }
    core.grenade_cooldown_remaining = cooldown_seconds.max(0.0);
    true
}
