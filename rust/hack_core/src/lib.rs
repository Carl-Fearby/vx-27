mod grid;
mod logic;
mod rng;
mod state;

pub use grid::{
    apply_forward_aim_after_connect, apply_selection, compute_progress, count_security_nodes,
    finalize_hack_selection, generate_hack_grid, generate_hack_grid_after_security_death,
    get_connection_direction, get_direct_connect_targets, get_next_column_targets, get_node,
    get_node_at, get_node_in_direction, get_pointer_target, get_required_next_col,
    get_selectable_neighbors, get_valid_directions, hack_node_id, hack_progress_step_count,
    initial_hack_selection, is_direct_connect_target, is_selectable_neighbor,
    pick_biased_auto_aim_target, pick_random_column_aim, resolve_confirm_target,
    resolve_outgoing_direction, sync_active_pointer_for_selection, sync_pointer_meta,
};
pub use logic::*;
pub use rng::*;
pub use state::*;

use serde::de::DeserializeOwned;
use serde::Serialize;
use wasm_bindgen::prelude::*;

fn from_js_value<T: DeserializeOwned>(value: JsValue) -> Result<T, JsValue> {
    serde_wasm_bindgen::from_value(value).map_err(|err| JsValue::from_str(&err.to_string()))
}

fn to_js_value<T: Serialize>(value: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(value).map_err(|err| JsValue::from_str(&err.to_string()))
}

fn parse_state(value: JsValue) -> Result<HackGameState, JsValue> {
    from_js_value(value)
}

#[wasm_bindgen(js_name = createHackGameState)]
pub fn create_hack_game_state_wasm(opts: JsValue) -> Result<JsValue, JsValue> {
    let opts: CreateHackGameOptions = if opts.is_null() || opts.is_undefined() {
        CreateHackGameOptions::default()
    } else {
        from_js_value(opts)?
    };
    to_js_value(&create_hack_game_state(opts))
}

#[wasm_bindgen(js_name = startHack)]
pub fn start_hack_wasm(state: JsValue) -> Result<JsValue, JsValue> {
    to_js_value(&start_hack(parse_state(state)?))
}

#[wasm_bindgen(js_name = resetHack)]
pub fn reset_hack_wasm(state: JsValue) -> Result<JsValue, JsValue> {
    to_js_value(&reset_hack(parse_state(state)?))
}

#[wasm_bindgen(js_name = resetHackAfterSecurityDeath)]
pub fn reset_hack_after_security_death_wasm(state: JsValue) -> Result<JsValue, JsValue> {
    to_js_value(&reset_hack_after_security_death(parse_state(state)?))
}

#[wasm_bindgen(js_name = resetHackAfterTimerExpiry)]
pub fn reset_hack_after_timer_expiry_wasm(state: JsValue) -> Result<JsValue, JsValue> {
    to_js_value(&reset_hack_after_timer_expiry(parse_state(state)?))
}

#[wasm_bindgen(js_name = tickHackTimer)]
pub fn tick_hack_timer_wasm(state: JsValue, delta_ms: u32) -> Result<JsValue, JsValue> {
    to_js_value(&tick_hack_timer(parse_state(state)?, delta_ms))
}

#[wasm_bindgen(js_name = navigateHackSelection)]
pub fn navigate_hack_selection_wasm(state: JsValue, key: &str) -> Result<JsValue, JsValue> {
    to_js_value(&navigate_hack_selection(parse_state(state)?, key))
}

#[wasm_bindgen(js_name = rotateSelectedNode)]
pub fn rotate_selected_node_wasm(state: JsValue) -> Result<JsValue, JsValue> {
    to_js_value(&rotate_selected_node(parse_state(state)?))
}

#[wasm_bindgen(js_name = selectNodeByMouse)]
pub fn select_node_by_mouse_wasm(state: JsValue, node_id: &str) -> Result<JsValue, JsValue> {
    to_js_value(&select_node_by_mouse(parse_state(state)?, node_id))
}

#[wasm_bindgen(js_name = confirmSelectedNode)]
pub fn confirm_selected_node_wasm(state: JsValue) -> Result<JsValue, JsValue> {
    to_js_value(&confirm_selected_node(parse_state(state)?))
}

#[wasm_bindgen(js_name = getHackStatusText)]
pub fn get_hack_status_text_wasm(state: JsValue) -> Result<String, JsValue> {
    Ok(get_hack_status_text(&parse_state(state)?))
}

#[wasm_bindgen(js_name = getHackObjectiveCount)]
pub fn get_hack_objective_count_wasm(state: JsValue) -> Result<String, JsValue> {
    Ok(get_hack_objective_count(&parse_state(state)?))
}

#[wasm_bindgen(js_name = getHackRouteProgressPct)]
pub fn get_hack_route_progress_pct_wasm(state: JsValue) -> Result<u32, JsValue> {
    Ok(get_hack_route_progress_pct(&parse_state(state)?))
}

#[wasm_bindgen(js_name = isHackSecurityFailure)]
pub fn is_hack_security_failure_wasm(state: JsValue) -> Result<bool, JsValue> {
    Ok(is_hack_security_failure(&parse_state(state)?))
}

#[wasm_bindgen(js_name = isHackTimerExpired)]
pub fn is_hack_timer_expired_wasm(state: JsValue) -> Result<bool, JsValue> {
    Ok(is_hack_timer_expired(&parse_state(state)?))
}

#[wasm_bindgen(js_name = isHackTimerTicking)]
pub fn is_hack_timer_ticking_wasm(state: JsValue) -> Result<bool, JsValue> {
    Ok(is_hack_timer_ticking(&parse_state(state)?))
}

#[wasm_bindgen(js_name = isHackRetriesExhausted)]
pub fn is_hack_retries_exhausted_wasm(state: JsValue) -> Result<bool, JsValue> {
    Ok(is_hack_retries_exhausted(&parse_state(state)?))
}

#[wasm_bindgen(js_name = getHackRetriesLabel)]
pub fn get_hack_retries_label_wasm(state: JsValue) -> Result<String, JsValue> {
    Ok(get_hack_retries_label(&parse_state(state)?))
}

#[wasm_bindgen(js_name = isSelectableNeighbor)]
pub fn is_selectable_neighbor_wasm(state: JsValue, node_id: &str) -> Result<bool, JsValue> {
    Ok(is_selectable_neighbor(&parse_state(state)?, node_id))
}

#[wasm_bindgen(js_name = getStartPointerTarget)]
pub fn get_start_pointer_target_wasm(state: JsValue) -> Result<JsValue, JsValue> {
    to_js_value(&get_start_pointer_target(&parse_state(state)?))
}

#[wasm_bindgen(js_name = getActivePointerTarget)]
pub fn get_active_pointer_target_wasm(state: JsValue) -> Result<JsValue, JsValue> {
    to_js_value(&get_active_pointer_target(&parse_state(state)?))
}

#[wasm_bindgen(js_name = getRewardPointerTarget)]
pub fn get_reward_pointer_target_wasm(state: JsValue) -> Result<JsValue, JsValue> {
    to_js_value(&get_reward_pointer_target(&parse_state(state)?))
}

#[wasm_bindgen(js_name = getHackNodeVisualState)]
pub fn get_hack_node_visual_state_wasm(state: JsValue, node_id: &str) -> Result<String, JsValue> {
    Ok(get_hack_node_visual_state(&parse_state(state)?, node_id))
}

#[wasm_bindgen(js_name = getHackRoutePath)]
pub fn get_hack_route_path_wasm(state: JsValue) -> Result<JsValue, JsValue> {
    to_js_value(&grid::get_hack_route_path(&parse_state(state)?))
}

#[wasm_bindgen(js_name = rollHackRewards)]
pub fn roll_hack_rewards_wasm(seed: u32, salt: u32) -> Result<JsValue, JsValue> {
    to_js_value(&roll_hack_rewards(seed, salt))
}
