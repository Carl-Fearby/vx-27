use crate::grid::{
    apply_forward_aim_after_connect, apply_selection, compute_progress, count_security_nodes,
    finalize_hack_selection, generate_hack_grid, generate_hack_grid_after_security_death,
    get_next_column_targets, get_node, get_node_at, get_pointer_target,
    hack_progress_step_count, initial_hack_selection, is_selectable_neighbor,
    resolve_confirm_target, sync_active_pointer_for_selection,
};
use crate::rng::{mulberry32, random_u32};
use crate::state::{
    ConfirmSelectedNodeResult, CreateHackGameOptions, HackConnection, HackFailureKind,
    HackGameState, HackNodeType, HackPuzzleNode, HackRewards, HackStatus, HACK_DEBUG_SHOW_SECURITY,
    HACK_DEFAULT_TIMER_MS, HACK_MAX_RETRIES, HACK_REWARD_AMMO_MAG_CHANCE,
    HACK_REWARD_CHANCES, HACK_REWARD_CREDITS, HACK_REWARD_PISTOL_MAG_ROUNDS,
    HACK_REWARD_RIFLE_SPARE_MAGS, HACK_REWARD_NODE_ID, HACK_SECURITY_ENABLED,
    HACK_SECURITY_RETRY_TIMER_MS, HACK_START_NODE_ID,
};

pub fn roll_hack_bonus_count(rand: &mut crate::rng::Mulberry32, chance: f64) -> u32 {
    if rand.next() >= chance {
        return 0;
    }
    1 + (rand.next() * 2.0).floor() as u32
}

pub fn roll_hack_rewards(seed: u32, salt: u32) -> HackRewards {
    let mut rand = mulberry32(seed ^ 0x6c62_272e ^ salt);
    let ammo_hit = rand.next() < HACK_REWARD_AMMO_MAG_CHANCE;
    let pistol_mag = ammo_hit && rand.next() < 0.5;
    HackRewards {
        credits: HACK_REWARD_CREDITS,
        pistol_ammo: if pistol_mag {
            HACK_REWARD_PISTOL_MAG_ROUNDS
        } else {
            0
        },
        rifle_spare_mag: if ammo_hit && !pistol_mag {
            HACK_REWARD_RIFLE_SPARE_MAGS
        } else {
            0
        },
        medkit: if rand.next() < HACK_REWARD_CHANCES.medkit {
            1
        } else {
            0
        },
        rifle: rand.next() < HACK_REWARD_CHANCES.rifle,
        grenade: roll_hack_bonus_count(&mut rand, HACK_REWARD_CHANCES.grenade),
        flashbang: roll_hack_bonus_count(&mut rand, HACK_REWARD_CHANCES.flashbang),
    }
}

pub fn create_hack_game_state(opts: CreateHackGameOptions) -> HackGameState {
    let rows = opts.rows.unwrap_or(4);
    let cols = opts.cols.unwrap_or(4);
    let seed = opts.seed.unwrap_or_else(random_u32);
    let timer_ms = opts.timer_ms.unwrap_or(HACK_DEFAULT_TIMER_MS);
    let nodes = generate_hack_grid(rows, cols, seed);

    let mut partial = HackGameState {
        status: HackStatus::Idle,
        rows,
        cols,
        seed,
        selected_node_id: String::new(),
        active_node_id: String::new(),
        start_node_id: HACK_START_NODE_ID.to_string(),
        reward_node_id: HACK_REWARD_NODE_ID.to_string(),
        nodes,
        connections: Vec::new(),
        failure_connection: None,
        progress: 0,
        security_total: 0,
        timer_remaining_ms: timer_ms,
        timer_total_ms: timer_ms,
        retries_used: 0,
        failure_kind: None,
        failure_message: None,
        success_message: None,
        aim_roll: 0,
        aim_nonce: 0,
        reward_roll: 0,
        rewards: roll_hack_rewards(seed, 0),
    };

    let (active_node_id, selected_node_id) = initial_hack_selection(&partial);
    partial.active_node_id = active_node_id;
    partial.selected_node_id = selected_node_id;
    partial.security_total = count_security_nodes(&partial);
    partial.nodes = finalize_hack_selection(
        partial.nodes.clone(),
        &partial.selected_node_id,
        &partial.active_node_id,
    );
    partial
}

fn build_reset_hack_state(mut state: HackGameState, nodes: Vec<HackPuzzleNode>) -> HackGameState {
    state.nodes = nodes;
    let (active_node_id, selected_node_id) = initial_hack_selection(&state);
    state.status = HackStatus::Active;
    state.selected_node_id = selected_node_id;
    state.active_node_id = active_node_id;
    state.reward_node_id = HACK_REWARD_NODE_ID.to_string();
    state.connections.clear();
    state.failure_connection = None;
    state.progress = 0;
    state.failure_kind = None;
    state.failure_message = None;
    state.success_message = None;
    state.timer_total_ms = state
        .timer_total_ms
        .max(state.timer_remaining_ms)
        .max(HACK_DEFAULT_TIMER_MS);
    state.security_total = count_security_nodes(&state);
    state.nodes = finalize_hack_selection(
        state.nodes.clone(),
        &state.selected_node_id,
        &state.active_node_id,
    );
    state
}

pub fn start_hack(mut state: HackGameState) -> HackGameState {
    let fresh = generate_hack_grid(state.rows, state.cols, state.seed);
    state.status = HackStatus::Idle;
    state.aim_roll = 0;
    state.aim_nonce = 0;
    let mut next = build_reset_hack_state(state, fresh);
    next.status = HackStatus::Active;
    next
}

pub fn reset_hack(mut state: HackGameState) -> HackGameState {
    let fresh = generate_hack_grid(state.rows, state.cols, state.seed);
    state.aim_roll = 0;
    state.aim_nonce = 0;
    state.reward_roll = state.reward_roll.wrapping_add(1);
    state.rewards = roll_hack_rewards(state.seed, state.reward_roll);
    build_reset_hack_state(state, fresh)
}

pub fn reset_hack_after_security_death_with_nonce(
    mut state: HackGameState,
    aim_nonce: u32,
) -> HackGameState {
    let aim_roll = state.aim_roll.wrapping_add(1);
    let aim_salt = crate::rng::imul(aim_roll, 0x27d4_eb2d) ^ aim_nonce;
    let tripped = state
        .failure_connection
        .as_ref()
        .map(|c| c.to_id.clone());
    let fresh = generate_hack_grid_after_security_death(
        state.rows,
        state.cols,
        state.seed,
        tripped.as_deref(),
        aim_salt,
    );
    state.timer_remaining_ms = HACK_SECURITY_RETRY_TIMER_MS;
    state.aim_roll = aim_roll;
    state.aim_nonce = aim_nonce;
    build_reset_hack_state(state, fresh)
}

pub fn reset_hack_after_security_death(state: HackGameState) -> HackGameState {
    reset_hack_after_security_death_with_nonce(state, random_u32())
}

pub fn reset_hack_after_timer_expiry(mut state: HackGameState) -> HackGameState {
    let fresh = generate_hack_grid(state.rows, state.cols, state.seed);
    state.timer_remaining_ms = state.timer_total_ms.max(HACK_DEFAULT_TIMER_MS);
    build_reset_hack_state(state, fresh)
}

pub fn can_hack_retry(state: &HackGameState) -> bool {
    state.retries_used < HACK_MAX_RETRIES
}

pub fn is_hack_retries_exhausted(state: &HackGameState) -> bool {
    state.status == HackStatus::Failed && !can_hack_retry(state)
}

pub fn get_hack_retries_label(state: &HackGameState) -> String {
    format!("{}/{}", state.retries_used, HACK_MAX_RETRIES)
}

pub fn is_hack_security_failure(state: &HackGameState) -> bool {
    state.status == HackStatus::Failed
        && state.failure_kind == Some(HackFailureKind::Security)
}

pub fn is_hack_timer_expired(state: &HackGameState) -> bool {
    state.status == HackStatus::Failed && state.failure_kind == Some(HackFailureKind::Timer)
}

pub fn is_hack_timer_ticking(state: &HackGameState) -> bool {
    state.status == HackStatus::Active
        || (state.status == HackStatus::Failed
            && matches!(
                state.failure_kind,
                Some(HackFailureKind::Security) | Some(HackFailureKind::Timer)
            )
            && can_hack_retry(state))
}

pub fn tick_hack_timer(mut state: HackGameState, delta_ms: u32) -> HackGameState {
    if !is_hack_timer_ticking(&state) {
        return state;
    }
    let timer_remaining_ms = state.timer_remaining_ms.saturating_sub(delta_ms);
    if timer_remaining_ms > 0 {
        state.timer_remaining_ms = timer_remaining_ms;
        return state;
    }
    state.timer_remaining_ms = 0;
    state.status = HackStatus::Failed;
    state.failure_kind = Some(HackFailureKind::Timer);
    state.failure_message = Some("TIME EXPIRED".to_string());
    state.retries_used = state.retries_used.saturating_add(1);
    state
}

fn cycle_start_entry_row(state: &HackGameState, selected: Option<&HackPuzzleNode>, key: &str) -> i32 {
    let rows = state.rows as i32;
    if selected.map(|s| s.id.as_str()) == Some(HACK_START_NODE_ID)
        || selected.map(|s| s.col) != Some(0)
    {
        return if key == "s" { 0 } else { rows - 1 };
    }
    let selected = selected.unwrap();
    if key == "w" {
        if selected.row > 0 {
            selected.row - 1
        } else {
            rows - 1
        }
    } else if selected.row < rows - 1 {
        selected.row + 1
    } else {
        0
    }
}

pub fn navigate_hack_selection(mut state: HackGameState, key: &str) -> HackGameState {
    if state.status != HackStatus::Active {
        return state;
    }

    let active_id = state.active_node_id.clone();
    let selected_id = state.selected_node_id.clone();
    let active = match get_node(&state, &active_id) {
        Some(n) => n.clone(),
        None => return state,
    };
    let selected = get_node(&state, &selected_id).cloned();

    let start_row = if active.id == HACK_START_NODE_ID {
        active.row
    } else {
        crate::grid::get_start_row(&state)
    };

    let mut target: Option<HackPuzzleNode> = None;

    if active.id == HACK_START_NODE_ID {
        match key {
            "w" | "s" => {
                let row = cycle_start_entry_row(&state, selected.as_ref(), key);
                target = get_node_at(&state, row, 0).cloned();
            }
            "d" => {
                target = if selected.as_ref().map(|s| s.col) == Some(0) {
                    selected
                } else {
                    get_node_at(&state, start_row, 0).cloned()
                };
            }
            _ => {}
        }
    } else {
        let anchor = selected
            .as_ref()
            .filter(|s| is_selectable_neighbor(&state, &s.id))
            .cloned()
            .unwrap_or_else(|| active.clone());

        match key {
            "a" => {
                if anchor.id != HACK_START_NODE_ID && anchor.col > 0 {
                    target = get_node_at(&state, anchor.row, anchor.col - 1).cloned();
                }
            }
            "w" if anchor.id != HACK_START_NODE_ID && anchor.row > 0 => {
                target = get_node_at(&state, anchor.row - 1, anchor.col).cloned();
            }
            "s" if anchor.id != HACK_START_NODE_ID && anchor.row < state.rows as i32 - 1 => {
                target = get_node_at(&state, anchor.row + 1, anchor.col).cloned();
            }
            "d" if anchor.id != HACK_START_NODE_ID => {
                if anchor.col == state.cols as i32 - 1 {
                    target = get_node(&state, &state.reward_node_id).cloned();
                } else if anchor.col < state.cols as i32 - 1 {
                    target = get_node_at(&state, anchor.row, anchor.col + 1).cloned();
                }
            }
            _ => {}
        }
    }

    let target = match target {
        Some(t) if is_selectable_neighbor(&state, &t.id) => t,
        _ => return state,
    };

    state.selected_node_id = target.id.clone();
    state.nodes = apply_selection(&state.nodes, &target.id, &state.active_node_id);
    sync_active_pointer_for_selection(state, &target)
}

fn step_pointer_target_index(mut state: HackGameState, step: i32) -> HackGameState {
    if state.status != HackStatus::Active {
        return state;
    }
    if state.selected_node_id != state.active_node_id {
        return state;
    }

    let active = match get_node(&state, &state.active_node_id) {
        Some(n) => n.clone(),
        None => return state,
    };

    let targets = get_next_column_targets(&active, &state);
    if targets.len() <= 1 {
        return state;
    }

    let current = active.pointer_target_index as i32;
    let len = targets.len() as i32;
    let pointer_target_index = ((current + step).rem_euclid(len)) as u32;

    state.nodes = state
        .nodes
        .iter()
        .map(|n| {
            if n.id == active.id {
                let mut updated = n.clone();
                updated.pointer_target_index = pointer_target_index;
                updated
            } else {
                n.clone()
            }
        })
        .collect();
    state
}

pub fn rotate_selected_node(state: HackGameState) -> HackGameState {
    step_pointer_target_index(state, 1)
}

pub fn select_node_by_mouse(mut state: HackGameState, node_id: &str) -> HackGameState {
    if state.status != HackStatus::Active {
        return state;
    }
    let clicked = match get_node(&state, node_id) {
        Some(n) => n.clone(),
        None => return state,
    };
    if !is_selectable_neighbor(&state, node_id) {
        return state;
    }
    state.selected_node_id = node_id.to_string();
    state.nodes = apply_selection(&state.nodes, node_id, &state.active_node_id);
    sync_active_pointer_for_selection(state, &clicked)
}

fn is_valid_confirm_target(
    active: &HackPuzzleNode,
    target: &HackPuzzleNode,
    state: &HackGameState,
) -> bool {
    if !is_selectable_neighbor(state, &target.id) {
        return false;
    }
    if target.id == active.id {
        return true;
    }
    if active.id == HACK_START_NODE_ID {
        return target.col == 0;
    }
    if target.id == HACK_REWARD_NODE_ID {
        return active.col == state.cols as i32 - 1;
    }
    target.id != active.id
}

pub fn connect_power_node(
    mut state: HackGameState,
    from: &HackPuzzleNode,
    to: &HackPuzzleNode,
) -> HackGameState {
    let already_linked = state
        .connections
        .iter()
        .any(|c| c.from_id == from.id && c.to_id == to.id);
    if !already_linked {
        state.connections.push(HackConnection {
            from_id: from.id.clone(),
            to_id: to.id.clone(),
        });
    }

    state.nodes = state
        .nodes
        .iter()
        .map(|n| {
            if n.id == to.id || n.id == from.id {
                let mut updated = n.clone();
                updated.revealed = true;
                updated.connected = true;
                updated
            } else {
                n.clone()
            }
        })
        .collect();

    state.active_node_id = to.id.clone();
    state.selected_node_id = to.id.clone();
    state.progress = compute_progress(&state);
    apply_forward_aim_after_connect(state, from, to)
}

pub fn trigger_security_failure(
    mut state: HackGameState,
    node: &HackPuzzleNode,
) -> HackGameState {
    state.nodes = state
        .nodes
        .iter()
        .map(|n| {
            if n.id == node.id {
                let mut updated = n.clone();
                updated.revealed = true;
                updated.triggered = true;
                updated
            } else {
                n.clone()
            }
        })
        .collect();
    state.retries_used = state.retries_used.saturating_add(1);
    state.status = HackStatus::Failed;
    state.failure_kind = Some(HackFailureKind::Security);
    state.failure_connection = Some(HackConnection {
        from_id: state.active_node_id.clone(),
        to_id: node.id.clone(),
    });
    state.selected_node_id = state.active_node_id.clone();
    state.nodes = apply_selection(
        &state.nodes,
        &state.active_node_id,
        &state.active_node_id,
    );
    state.failure_message = Some("SECURITY NODE TRIGGERED".to_string());
    state
}

pub fn complete_hack(mut state: HackGameState) -> HackGameState {
    state.nodes = state
        .nodes
        .iter()
        .map(|n| {
            if n.node_type == HackNodeType::Reward {
                let mut updated = n.clone();
                updated.revealed = true;
                updated.connected = true;
                updated
            } else {
                n.clone()
            }
        })
        .collect();
    state.status = HackStatus::Complete;
    state.nodes = apply_selection(
        &state.nodes,
        &state.selected_node_id,
        &state.active_node_id,
    );
    state.success_message = Some("ACCESS GRANTED".to_string());
    state.progress = hack_progress_step_count(state.cols);
    state
}

pub fn confirm_selected_node(state: HackGameState) -> ConfirmSelectedNodeResult {
    if state.status != HackStatus::Active {
        return ConfirmSelectedNodeResult {
            state,
            event: None,
        };
    }

    let active = match get_node(&state, &state.active_node_id) {
        Some(n) => n.clone(),
        None => {
            return ConfirmSelectedNodeResult {
                state,
                event: None,
            }
        }
    };
    let selected = match get_node(&state, &state.selected_node_id) {
        Some(n) => n.clone(),
        None => {
            return ConfirmSelectedNodeResult {
                state,
                event: None,
            }
        }
    };

    let target = match resolve_confirm_target(&active, &selected, &state) {
        Some(t) => t.clone(),
        None => {
            return ConfirmSelectedNodeResult {
                state,
                event: Some("confirm_blocked".to_string()),
            }
        }
    };

    if !is_valid_confirm_target(&active, &target, &state) {
        return ConfirmSelectedNodeResult {
            state,
            event: Some("no_target".to_string()),
        };
    }

    if HACK_SECURITY_ENABLED && target.node_type == HackNodeType::Security {
        let next = trigger_security_failure(state, &target);
        return ConfirmSelectedNodeResult {
            state: next,
            event: Some("security_triggered".to_string()),
        };
    }

    if target.id == HACK_REWARD_NODE_ID {
        let next = complete_hack(connect_power_node(state, &active, &target));
        return ConfirmSelectedNodeResult {
            state: next,
            event: Some("hack_complete".to_string()),
        };
    }

    let next = connect_power_node(state, &active, &target);
    let event = if target.col < active.col || target.col == active.col {
        "walked_back"
    } else {
        "power_connected"
    };
    ConfirmSelectedNodeResult {
        state: next,
        event: Some(event.to_string()),
    }
}

pub fn get_hack_status_text(state: &HackGameState) -> String {
    if state.status == HackStatus::Complete {
        return state
            .success_message
            .clone()
            .unwrap_or_else(|| "ACCESS GRANTED".to_string());
    }
    if is_hack_retries_exhausted(state) {
        return if state.failure_kind == Some(HackFailureKind::Timer) {
            "TIME EXPIRED".to_string()
        } else {
            state
                .failure_message
                .clone()
                .unwrap_or_else(|| "RETRIES EXHAUSTED".to_string())
        };
    }
    if is_hack_timer_expired(state) {
        return "TIME EXPIRED".to_string();
    }
    if is_hack_security_failure(state) {
        return state
            .failure_message
            .clone()
            .unwrap_or_else(|| "SECURITY NODE TRIGGERED".to_string());
    }
    if state.status == HackStatus::Active {
        return "ACCESSING REWARD NODE".to_string();
    }
    "STANDBY".to_string()
}

pub fn get_hack_objective_count(state: &HackGameState) -> String {
    let cleared = state.progress;
    let total = hack_progress_step_count(state.cols);
    format!("{cleared}/{total}")
}

pub fn get_hack_route_progress_pct(state: &HackGameState) -> u32 {
    if state.status == HackStatus::Complete {
        return 100;
    }
    let total = hack_progress_step_count(state.cols);
    ((state.progress as f64 / total as f64) * 100.0).round() as u32
}

pub fn get_active_aim_target(state: &HackGameState) -> Option<HackPuzzleNode> {
    if state.status != HackStatus::Active {
        return None;
    }
    let active = get_node(state, &state.active_node_id)?;
    let selected = get_node(state, &state.selected_node_id)?;
    resolve_confirm_target(active, selected, state).cloned()
}

pub fn get_active_pointer_target(state: &HackGameState) -> Option<HackPuzzleNode> {
    if state.status != HackStatus::Active {
        return None;
    }
    let active = get_node(state, &state.active_node_id)?.clone();
    let selected = get_node(state, &state.selected_node_id)?.clone();

    if selected.id != active.id {
        return Some(selected);
    }

    get_active_aim_target(state).or_else(|| get_pointer_target(&active, state).cloned())
}

pub fn get_start_pointer_target(state: &HackGameState) -> Option<HackPuzzleNode> {
    if state.status != HackStatus::Active {
        return None;
    }
    let active = get_node(state, &state.active_node_id)?;
    if active.id != HACK_START_NODE_ID {
        return None;
    }
    get_active_pointer_target(state)
}

pub fn get_reward_pointer_target(state: &HackGameState) -> Option<HackPuzzleNode> {
    if state.status != HackStatus::Active {
        return None;
    }
    let active = get_node(state, &state.active_node_id)?;
    if active.col != state.cols as i32 - 1 {
        return None;
    }
    get_active_pointer_target(state)
}

pub fn get_hack_node_visual_state(state: &HackGameState, node_id: &str) -> String {
    let node = match get_node(state, node_id) {
        Some(n) => n,
        None => return "locked".to_string(),
    };

    if node.id == HACK_START_NODE_ID {
        if state.status == HackStatus::Failed {
            return "start".to_string();
        }
        return if node.selected {
            "startSelected".to_string()
        } else {
            "start".to_string()
        };
    }

    if node.triggered || (node.node_type == HackNodeType::Security && node.revealed) {
        return "revealedSecurity".to_string();
    }
    if node.node_type == HackNodeType::Reward {
        if node.connected || state.status == HackStatus::Complete {
            return "reward".to_string();
        }
        if state.status == HackStatus::Active && is_selectable_neighbor(state, node_id) {
            return "reward".to_string();
        }
    }
    if node.connected && node.node_type == HackNodeType::Power {
        return "connectedPower".to_string();
    }
    if HACK_SECURITY_ENABLED
        && HACK_DEBUG_SHOW_SECURITY
        && node.node_type == HackNodeType::Security
        && !node.revealed
    {
        return "debugSecurity".to_string();
    }
    "empty".to_string()
}

pub fn get_hack_route_path(state: &HackGameState) -> Vec<String> {
    crate::grid::get_hack_route_path(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::HackNodeType;

    fn active_state(seed: u32) -> HackGameState {
        let state = create_hack_game_state(CreateHackGameOptions {
            rows: Some(4),
            cols: Some(4),
            seed: Some(seed),
            timer_ms: Some(HACK_DEFAULT_TIMER_MS),
        });
        start_hack(state)
    }

    #[test]
    fn confirm_power_connect_from_start() {
        let mut state = active_state(42);
        let col0_power = state
            .nodes
            .iter()
            .find(|n| n.col == 0 && n.node_type == HackNodeType::Power)
            .unwrap()
            .id
            .clone();
        state.selected_node_id = col0_power.clone();
        state.nodes = apply_selection(&state.nodes, &col0_power, &state.active_node_id);

        let result = confirm_selected_node(state);
        assert_eq!(result.event.as_deref(), Some("power_connected"));
        assert_eq!(result.state.active_node_id, col0_power);
        assert!(!result.state.connections.is_empty());
    }

    #[test]
    fn security_failure_on_confirm() {
        let state = active_state(777);
        let security_id = state
            .nodes
            .iter()
            .find(|n| n.node_type == HackNodeType::Security && n.col == 0)
            .map(|n| n.id.clone());
        let Some(security_id) = security_id else {
            // Seed 777 may not place security in column 0 — force one for this test.
            let mut forced = state;
            let target_id = forced
                .nodes
                .iter()
                .find(|n| n.col == 0 && n.node_type == HackNodeType::Power)
                .unwrap()
                .id
                .clone();
            forced.nodes = forced
                .nodes
                .into_iter()
                .map(|n| {
                    if n.id == target_id {
                        let mut updated = n;
                        updated.node_type = HackNodeType::Security;
                        updated
                    } else {
                        n
                    }
                })
                .collect();
            forced.selected_node_id = target_id.clone();
            forced.nodes =
                apply_selection(&forced.nodes, &target_id, &forced.active_node_id);
            let result = confirm_selected_node(forced);
            assert_eq!(result.event.as_deref(), Some("security_triggered"));
            assert_eq!(result.state.status, HackStatus::Failed);
            assert_eq!(
                result.state.failure_kind,
                Some(HackFailureKind::Security)
            );
            assert!(is_hack_security_failure(&result.state));
            return;
        };

        let mut state = state;
        state.selected_node_id = security_id.clone();
        state.nodes = apply_selection(&state.nodes, &security_id, &state.active_node_id);

        let result = confirm_selected_node(state);
        assert_eq!(result.event.as_deref(), Some("security_triggered"));
        assert_eq!(result.state.status, HackStatus::Failed);
        assert_eq!(
            result.state.failure_kind,
            Some(HackFailureKind::Security)
        );
        assert!(is_hack_security_failure(&result.state));
    }

    #[test]
    fn timer_expiry_marks_failed() {
        let mut state = active_state(1);
        state.timer_remaining_ms = 100;
        let next = tick_hack_timer(state, 200);
        assert_eq!(next.status, HackStatus::Failed);
        assert_eq!(next.failure_kind, Some(HackFailureKind::Timer));
        assert!(is_hack_timer_expired(&next));
        assert_eq!(next.retries_used, 1);
    }

    #[test]
    fn retries_exhausted_after_max_failures() {
        let mut state = active_state(2);
        state.retries_used = HACK_MAX_RETRIES;
        state.status = HackStatus::Failed;
        state.failure_kind = Some(HackFailureKind::Timer);
        assert!(is_hack_retries_exhausted(&state));
        assert!(!can_hack_retry(&state));
    }

    #[test]
    fn roll_hack_rewards_always_includes_credits() {
        let rewards = roll_hack_rewards(123, 0);
        assert_eq!(rewards.credits, HACK_REWARD_CREDITS);
    }

    #[test]
    fn get_hack_status_text_standby_and_active() {
        let idle = create_hack_game_state(CreateHackGameOptions {
            seed: Some(1),
            ..Default::default()
        });
        assert_eq!(get_hack_status_text(&idle), "STANDBY");
        let active = start_hack(idle);
        assert_eq!(get_hack_status_text(&active), "ACCESSING REWARD NODE");
    }

    #[test]
    fn navigate_wasd_on_start_cycles_column_zero() {
        let state = active_state(55);
        let next = navigate_hack_selection(state, "s");
        let selected = get_node(&next, &next.selected_node_id).unwrap();
        assert_eq!(selected.col, 0);
    }

    #[test]
    fn visual_state_hides_security_when_debug_off() {
        let state = active_state(99);
        let security = state
            .nodes
            .iter()
            .find(|n| n.node_type == HackNodeType::Security)
            .unwrap();
        assert_eq!(
            get_hack_node_visual_state(&state, &security.id),
            "empty"
        );
    }
}
