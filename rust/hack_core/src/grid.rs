use std::collections::{HashMap, HashSet, VecDeque};

use crate::rng::{hash_node_id, imul, mulberry32, Mulberry32};
use crate::state::{
    next_col_delta, HackDirection, HackNodeType, HackPuzzleNode, HackGameState, DIR_ORDER,
    HACK_REWARD_NODE_ID, HACK_START_NODE_ID,
};

pub fn hack_node_id(row: u32, col: u32) -> String {
    format!("node-{row}-{col}")
}

pub fn pick_start_row(seed: u32, rows: u32, aim_salt: u32) -> u32 {
    let mut rand = mulberry32((seed ^ 0x510e_527f ^ aim_salt) as u32);
    (rand.next() * rows as f64).floor() as u32
}

pub fn get_node<'a>(state: &'a HackGameState, id: &str) -> Option<&'a HackPuzzleNode> {
    state.nodes.iter().find(|n| n.id == id)
}

pub fn get_node_at<'a>(state: &'a HackGameState, row: i32, col: i32) -> Option<&'a HackPuzzleNode> {
    state
        .nodes
        .iter()
        .find(|n| n.row == row && n.col == col)
}

pub fn get_start_row(state: &HackGameState) -> i32 {
    get_node(state, HACK_START_NODE_ID)
        .map(|n| n.row)
        .unwrap_or((state.rows / 2) as i32)
}

pub fn confirm_target_at(
    node: &HackPuzzleNode,
    direction: HackDirection,
    rows: u32,
    cols: u32,
    start_row: i32,
) -> Option<(i32, i32)> {
    if node.id == HACK_START_NODE_ID {
        let ref_row = start_row;
        return match direction {
            HackDirection::Right => Some((ref_row, 0)),
            HackDirection::Up if ref_row > 0 => Some((ref_row - 1, 0)),
            HackDirection::Down if ref_row < rows as i32 - 1 => Some((ref_row + 1, 0)),
            _ => None,
        };
    }

    let delta = next_col_delta(direction);
    let row = node.row + delta.dr;
    let col = node.col + delta.dc;
    if row < 0 || row >= rows as i32 || col < 0 || col >= cols as i32 {
        return None;
    }
    if col != node.col + 1 {
        return None;
    }
    Some((row, col))
}

pub fn get_node_in_direction<'a>(
    node: &HackPuzzleNode,
    direction: HackDirection,
    state: &'a HackGameState,
) -> Option<&'a HackPuzzleNode> {
    let start_row = if node.id == HACK_START_NODE_ID {
        node.row
    } else {
        get_start_row(state)
    };
    let at = confirm_target_at(node, direction, state.rows, state.cols, start_row)?;
    get_node_at(state, at.0, at.1)
}

pub fn get_valid_directions(node: &HackPuzzleNode, state: &HackGameState) -> Vec<HackDirection> {
    DIR_ORDER
        .iter()
        .copied()
        .filter(|dir| get_node_in_direction(node, *dir, state).is_some())
        .collect()
}

pub fn get_required_next_col(node: &HackPuzzleNode) -> i32 {
    if node.id == HACK_START_NODE_ID {
        0
    } else {
        node.col + 1
    }
}

pub fn get_next_column_targets<'a>(
    node: &HackPuzzleNode,
    state: &'a HackGameState,
) -> Vec<&'a HackPuzzleNode> {
    let col = get_required_next_col(node);
    let mut targets = Vec::new();
    for row in 0..state.rows {
        if let Some(target) = get_node_at(state, row as i32, col) {
            targets.push(target);
        }
    }
    targets
}

pub fn get_pointer_target<'a>(
    node: &HackPuzzleNode,
    state: &'a HackGameState,
) -> Option<&'a HackPuzzleNode> {
    let targets = get_next_column_targets(node, state);
    if targets.is_empty() {
        return None;
    }
    let idx = node.pointer_target_index as usize;
    Some(targets[idx % targets.len()])
}

pub fn get_direct_connect_targets<'a>(
    node: &HackPuzzleNode,
    state: &'a HackGameState,
) -> Vec<&'a HackPuzzleNode> {
    DIR_ORDER
        .iter()
        .filter_map(|dir| get_node_in_direction(node, *dir, state))
        .collect()
}

pub fn is_direct_connect_target(
    active: &HackPuzzleNode,
    candidate: &HackPuzzleNode,
    state: &HackGameState,
) -> bool {
    get_direct_connect_targets(active, state)
        .iter()
        .any(|n| n.id == candidate.id)
}

fn get_selection_window(active: &HackPuzzleNode, state: &HackGameState) -> (i32, i32, i32, i32) {
    (
        (active.col - 1).max(0),
        (active.col + 1).min(state.cols as i32 - 1),
        (active.row - 1).max(0),
        (active.row + 1).min(state.rows as i32 - 1),
    )
}

pub fn get_selectable_neighbors(state: &HackGameState) -> Vec<HackPuzzleNode> {
    let active = match get_node(state, &state.active_node_id) {
        Some(n) => n,
        None => return Vec::new(),
    };

    let mut neighbors = Vec::new();
    let mut seen = HashSet::new();

    let mut add = |node: Option<&HackPuzzleNode>| {
        if let Some(node) = node {
            if seen.insert(node.id.clone()) {
                neighbors.push(node.clone());
            }
        }
    };

    if active.id == HACK_START_NODE_ID {
        add(Some(active));
        for row in 0..state.rows {
            add(get_node_at(state, row as i32, 0));
        }
        return neighbors;
    }

    let (min_col, max_col, min_row, max_row) = get_selection_window(active, state);
    for row in min_row..=max_row {
        for col in min_col..=max_col {
            add(get_node_at(state, row, col));
        }
    }

    if active.col == state.cols as i32 - 1 {
        add(get_node(state, &state.reward_node_id));
    }

    neighbors
}

pub fn is_selectable_neighbor(state: &HackGameState, node_id: &str) -> bool {
    get_selectable_neighbors(state)
        .iter()
        .any(|n| n.id == node_id)
}

pub fn get_connection_direction(
    from: &HackPuzzleNode,
    to: &HackPuzzleNode,
    state: &HackGameState,
) -> HackDirection {
    if from.id == HACK_START_NODE_ID {
        for dir in DIR_ORDER {
            if let Some(at) = confirm_target_at(from, dir, state.rows, state.cols, from.row) {
                if get_node_at(state, at.0, at.1).map(|n| n.id.as_str()) == Some(to.id.as_str()) {
                    return dir;
                }
            }
        }
        let ref_row = from.row;
        if to.row < ref_row {
            return HackDirection::Up;
        }
        if to.row > ref_row {
            return HackDirection::Down;
        }
        return HackDirection::Right;
    }

    for dir in DIR_ORDER {
        if get_node_in_direction(from, dir, state)
            .map(|n| n.id.as_str())
            == Some(to.id.as_str())
        {
            return dir;
        }
    }

    let dr = to.row - from.row;
    if dr < 0 {
        HackDirection::Up
    } else if dr > 0 {
        HackDirection::Down
    } else {
        from.pointer_direction
    }
}

pub fn resolve_outgoing_direction(
    node: &HackPuzzleNode,
    preferred_dir: HackDirection,
    state: &HackGameState,
) -> HackDirection {
    if get_node_in_direction(node, preferred_dir, state).is_some() {
        return preferred_dir;
    }
    if matches!(preferred_dir, HackDirection::Up | HackDirection::Down)
        && get_node_in_direction(node, HackDirection::Right, state).is_some()
    {
        return HackDirection::Right;
    }
    for dir in DIR_ORDER {
        if get_node_in_direction(node, dir, state).is_some() {
            return dir;
        }
    }
    preferred_dir
}

pub fn pick_biased_auto_aim_target<'a>(
    candidates: &[&'a HackPuzzleNode],
    rand: &mut Mulberry32,
) -> Option<&'a HackPuzzleNode> {
    if candidates.is_empty() {
        return None;
    }

    let pool: Vec<&'a HackPuzzleNode> = if crate::state::HACK_SECURITY_ENABLED {
        let security: Vec<&'a HackPuzzleNode> = candidates
            .iter()
            .copied()
            .filter(|n| n.node_type == HackNodeType::Security)
            .collect();
        if !security.is_empty() && rand.next() < crate::state::HACK_AUTO_AIM_SECURITY_CHANCE {
            security
        } else {
            candidates.to_vec()
        }
    } else {
        candidates.to_vec()
    };

    let idx = (rand.next() * pool.len() as f64).floor() as usize;
    pool.get(idx.min(pool.len().saturating_sub(1))).copied()
}

pub fn pick_random_column_aim(
    state: &HackGameState,
    active: &HackPuzzleNode,
) -> (u32, String, HackDirection) {
    let direct: Vec<_> = get_direct_connect_targets(active, state);
    if direct.is_empty() {
        return (
            active.pointer_target_index,
            active.id.clone(),
            active.pointer_direction,
        );
    }

    let mut rand = mulberry32(
        state
            .seed
            ^ crate::rng::get_aim_salt(state)
            ^ imul((active.col + 1) as u32, 0x9e37_79b1)
            ^ hash_node_id(&active.id),
    );
    let forward = pick_biased_auto_aim_target(&direct, &mut rand).unwrap();
    let column_targets = get_next_column_targets(active, state);
    let pointer_target_index = column_targets
        .iter()
        .position(|n| n.id == forward.id)
        .map(|i| i as u32)
        .unwrap_or(0)
        .max(0);
    let incoming_dir = get_connection_direction(active, forward, state);
    let outgoing_dir = resolve_outgoing_direction(active, incoming_dir, state);
    (
        pointer_target_index,
        forward.id.clone(),
        outgoing_dir,
    )
}

pub fn apply_selection(
    nodes: &[HackPuzzleNode],
    selected_id: &str,
    active_id: &str,
) -> Vec<HackPuzzleNode> {
    nodes
        .iter()
        .map(|n| {
            let mut next = n.clone();
            next.selected = n.id == selected_id;
            if n.id == active_id {
                // pointerTargetIndex preserved on active
            }
            next
        })
        .collect()
}

pub fn finalize_hack_selection(
    nodes: Vec<HackPuzzleNode>,
    selected_node_id: &str,
    active_node_id: &str,
) -> Vec<HackPuzzleNode> {
    let next = apply_selection(&nodes, selected_node_id, active_node_id);
    if active_node_id != HACK_START_NODE_ID {
        return next;
    }
    let selected = next.iter().find(|n| n.id == selected_node_id);
    if selected.map(|s| s.col) != Some(0) {
        return next;
    }
    let selected_row = selected.unwrap().row;
    next.into_iter()
        .map(|n| {
            if n.id == HACK_START_NODE_ID {
                let mut updated = n;
                updated.pointer_target_index = selected_row as u32;
                updated
            } else {
                n
            }
        })
        .collect()
}

pub fn initial_hack_selection(state: &HackGameState) -> (String, String) {
    let mut rand = mulberry32(
        state.seed ^ 0x7f4a_7c15 ^ crate::rng::get_aim_salt(state),
    );
    let col0: Vec<_> = (0..state.rows)
        .filter_map(|row| get_node_at(state, row as i32, 0))
        .collect();
    let picked = pick_biased_auto_aim_target(&col0, &mut rand)
        .map(|n| n.id.clone())
        .or_else(|| col0.first().map(|n| n.id.clone()))
        .unwrap_or_else(|| hack_node_id(0, 0));
    (HACK_START_NODE_ID.to_string(), picked)
}

pub fn sync_pointer_meta(nodes: Vec<HackPuzzleNode>, rows: u32, cols: u32) -> Vec<HackPuzzleNode> {
    nodes
        .into_iter()
        .map(|n| {
            let col = if n.id == HACK_START_NODE_ID {
                0
            } else {
                n.col + 1
            };
            let target_count = (0..rows)
                .filter(|_| col >= 0 && col < cols as i32)
                .count() as u32;
            let pointer_target_index = n
                .pointer_target_index
                .min(target_count.saturating_sub(1).max(0));
            let valid_directions = if target_count > 0 {
                DIR_ORDER[..target_count.min(3) as usize].to_vec()
            } else {
                Vec::new()
            };
            HackPuzzleNode {
                pointer_target_index,
                valid_directions,
                ..n
            }
        })
        .collect()
}

fn create_start_node(_rows: u32, start_row: u32) -> HackPuzzleNode {
    HackPuzzleNode {
        id: HACK_START_NODE_ID.to_string(),
        row: start_row as i32,
        col: -1,
        node_type: HackNodeType::Power,
        revealed: true,
        connected: true,
        selected: true,
        triggered: false,
        pointer_direction: HackDirection::Right,
        valid_directions: Vec::new(),
        pointer_target_index: 0,
    }
}

fn create_reward_node(rows: u32, cols: u32) -> HackPuzzleNode {
    let ref_row = (rows / 2) as i32;
    HackPuzzleNode {
        id: HACK_REWARD_NODE_ID.to_string(),
        row: ref_row,
        col: cols as i32,
        node_type: HackNodeType::Reward,
        revealed: true,
        connected: false,
        selected: false,
        triggered: false,
        pointer_direction: HackDirection::Right,
        valid_directions: Vec::new(),
        pointer_target_index: 0,
    }
}

fn build_hack_grid_from_types(
    types: &HashMap<String, HackNodeType>,
    rows: u32,
    cols: u32,
    start_row: u32,
) -> Vec<HackPuzzleNode> {
    let mut nodes = Vec::new();
    for row in 0..rows {
        for col in 0..cols {
            let id = hack_node_id(row, col);
            nodes.push(HackPuzzleNode {
                id: id.clone(),
                row: row as i32,
                col: col as i32,
                node_type: *types.get(&id).unwrap_or(&HackNodeType::Power),
                revealed: false,
                connected: false,
                selected: false,
                triggered: false,
                pointer_direction: HackDirection::Right,
                valid_directions: Vec::new(),
                pointer_target_index: 0,
            });
        }
    }
    let start_node = create_start_node(rows, start_row);
    let reward_node = create_reward_node(rows, cols);
    let mut all = vec![start_node];
    all.extend(nodes);
    all.push(reward_node);
    sync_pointer_meta(all, rows, cols)
}

fn count_grid_security_nodes(types: &HashMap<String, HackNodeType>, rows: u32, cols: u32) -> u32 {
    let mut count = 0;
    for col in 0..cols - 1 {
        for row in 0..rows {
            if types.get(&hack_node_id(row, col)) == Some(&HackNodeType::Security) {
                count += 1;
            }
        }
    }
    count
}

fn column_has_security(col: u32, types: &HashMap<String, HackNodeType>, rows: u32) -> bool {
    (0..rows).any(|row| types.get(&hack_node_id(row, col)) == Some(&HackNodeType::Security))
}

fn security_row_weight(row: u32, rows: u32) -> u32 {
    (rows - row + 1).max(1)
}

fn pick_weighted_security_cell(
    candidate_ids: &[String],
    rows: u32,
    rand: &mut Mulberry32,
) -> String {
    if candidate_ids.is_empty() {
        return String::new();
    }
    if candidate_ids.len() == 1 {
        return candidate_ids[0].clone();
    }

    let mut total = 0u32;
    let weights: Vec<u32> = candidate_ids
        .iter()
        .map(|id| {
            let row = parse_node_row(id).unwrap_or(rows.saturating_sub(1));
            let w = security_row_weight(row, rows);
            total += w;
            w
        })
        .collect();

    let mut roll = rand.next() * total as f64;
    for (i, w) in weights.iter().enumerate() {
        roll -= *w as f64;
        if roll <= 0.0 {
            return candidate_ids[i].clone();
        }
    }
    candidate_ids[candidate_ids.len() - 1].clone()
}

fn parse_node_row(id: &str) -> Option<u32> {
    let rest = id.strip_prefix("node-")?;
    let (row, _) = rest.split_once('-')?;
    row.parse().ok()
}

fn parse_node_col(id: &str) -> Option<u32> {
    let rest = id.strip_prefix("node-")?;
    let (_, col) = rest.split_once('-')?;
    col.parse().ok()
}

fn place_security_in_column(
    col: u32,
    rows: u32,
    types: &mut HashMap<String, HackNodeType>,
    path_set: &HashSet<String>,
    rand: &mut Mulberry32,
) -> bool {
    if column_has_security(col, types, rows) {
        return false;
    }

    let candidates: Vec<String> = (0..rows)
        .map(|row| hack_node_id(row, col))
        .filter(|id| !path_set.contains(id) && types.get(id) == Some(&HackNodeType::Power))
        .collect();

    let pick = pick_weighted_security_cell(&candidates, rows, rand);
    if pick.is_empty() {
        return false;
    }

    types.insert(pick, HackNodeType::Security);
    true
}

fn promote_security_to_top_row(
    col: u32,
    rows: u32,
    types: &mut HashMap<String, HackNodeType>,
    path_set: &HashSet<String>,
) -> bool {
    let top_id = hack_node_id(0, col);
    if path_set.contains(&top_id) {
        return false;
    }
    if types.get(&top_id) != Some(&HackNodeType::Power) {
        return false;
    }

    for row in 1..rows {
        let id = hack_node_id(row, col);
        if types.get(&id) == Some(&HackNodeType::Security) {
            types.insert(id, HackNodeType::Power);
            types.insert(top_id.clone(), HackNodeType::Security);
            return true;
        }
    }
    false
}

fn count_top_row_security_nodes(types: &HashMap<String, HackNodeType>, cols: u32) -> u32 {
    let mut count = 0;
    for col in 0..cols - 1 {
        if types.get(&hack_node_id(0, col)) == Some(&HackNodeType::Security) {
            count += 1;
        }
    }
    count
}

fn ensure_top_row_security_nodes(
    rows: u32,
    cols: u32,
    types: &mut HashMap<String, HackNodeType>,
    rand: &mut Mulberry32,
    path_set: &HashSet<String>,
) {
    let mut top_count = count_top_row_security_nodes(types, cols);
    if top_count >= crate::state::HACK_MIN_TOP_ROW_SECURITY {
        return;
    }

    let mut cols_by_priority: Vec<u32> = (0..cols - 1).collect();
    for i in (1..cols_by_priority.len()).rev() {
        let j = (rand.next() * (i + 1) as f64).floor() as usize;
        cols_by_priority.swap(i, j);
    }

    for col in cols_by_priority {
        if top_count >= crate::state::HACK_MIN_TOP_ROW_SECURITY {
            break;
        }
        if types.get(&hack_node_id(0, col)) == Some(&HackNodeType::Security) {
            continue;
        }

        if promote_security_to_top_row(col, rows, types, path_set) {
            top_count += 1;
            continue;
        }

        let top_id = hack_node_id(0, col);
        if path_set.contains(&top_id) || types.get(&top_id) != Some(&HackNodeType::Power) {
            continue;
        }
        if column_has_security(col, types, rows) {
            continue;
        }
        if place_security_in_column(col, rows, types, path_set, rand) {
            top_count += 1;
        }
    }
}

fn sprinkle_column_securities(
    rows: u32,
    cols: u32,
    types: &mut HashMap<String, HackNodeType>,
    rand: &mut Mulberry32,
    path_set: &HashSet<String>,
) {
    for col in 0..cols - 1 {
        if rand.next() > crate::state::HACK_SECURITY_COLUMN_CHANCE {
            continue;
        }
        place_security_in_column(col, rows, types, path_set, rand);
    }
}

fn ensure_minimum_security_nodes(
    rows: u32,
    cols: u32,
    types: &mut HashMap<String, HackNodeType>,
    rand: &mut Mulberry32,
    path_set: &HashSet<String>,
) {
    let mut count = count_grid_security_nodes(types, rows, cols);
    if count >= crate::state::HACK_MIN_SECURITY_NODES {
        return;
    }

    let mut open_cols: Vec<u32> = (0..cols - 1)
        .filter(|col| !column_has_security(*col, types, rows))
        .collect();

    for i in (1..open_cols.len()).rev() {
        let j = (rand.next() * (i + 1) as f64).floor() as usize;
        open_cols.swap(i, j);
    }

    for col in open_cols {
        if count >= crate::state::HACK_MIN_SECURITY_NODES {
            break;
        }
        if place_security_in_column(col, rows, types, path_set, rand) {
            count += 1;
        }
    }
}

fn enforce_max_one_security_per_column(
    rows: u32,
    cols: u32,
    types: &mut HashMap<String, HackNodeType>,
    path_set: &HashSet<String>,
) {
    for col in 0..cols - 1 {
        let security_ids: Vec<String> = (0..rows)
            .map(|row| hack_node_id(row, col))
            .filter(|id| types.get(id) == Some(&HackNodeType::Security))
            .collect();

        if security_ids.len() <= 1 {
            continue;
        }

        let keep = security_ids
            .iter()
            .find(|id| !path_set.contains(*id))
            .cloned()
            .unwrap_or_else(|| security_ids[0].clone());

        for id in security_ids {
            if id != keep {
                types.insert(id, HackNodeType::Power);
            }
        }
    }
}

fn ensure_column_has_power(
    col_cell_ids: &[String],
    types: &mut HashMap<String, HackNodeType>,
    rand: &mut Mulberry32,
    protected_ids: &HashSet<String>,
) {
    if col_cell_ids.is_empty() {
        return;
    }
    if col_cell_ids
        .iter()
        .any(|id| types.get(id) == Some(&HackNodeType::Power))
    {
        return;
    }

    let candidates: Vec<&String> = col_cell_ids
        .iter()
        .filter(|id| !protected_ids.contains(*id))
        .collect();
    let idx = (rand.next() * candidates.len() as f64).floor() as usize;
    let pick = candidates
        .get(idx)
        .copied()
        .or_else(|| col_cell_ids.first());
    if let Some(pick) = pick {
        types.insert(pick.clone(), HackNodeType::Power);
    }
}

fn find_power_path(rows: u32, cols: u32, start_row: u32, end_row: u32) -> Vec<String> {
    let start_id = hack_node_id(start_row, 0);
    let end_id = hack_node_id(end_row, cols - 1);
    let mut queue = VecDeque::from([start_id.clone()]);
    let mut prev: HashMap<String, Option<String>> = HashMap::new();
    prev.insert(start_id.clone(), None);

    while let Some(id) = queue.pop_front() {
        if id == end_id {
            break;
        }
        let row = parse_node_row(&id).unwrap_or(0);
        let col = parse_node_col(&id).unwrap_or(0);

        for dir in DIR_ORDER {
            let delta = next_col_delta(dir);
            let nr = row as i32 + delta.dr;
            let nc = col as i32 + delta.dc;
            if nr < 0 || nr >= rows as i32 || nc != col as i32 + 1 {
                continue;
            }
            let next_id = hack_node_id(nr as u32, nc as u32);
            if prev.contains_key(&next_id) {
                continue;
            }
            prev.insert(next_id.clone(), Some(id.clone()));
            queue.push_back(next_id);
        }
    }

    if !prev.contains_key(&end_id) {
        return Vec::new();
    }

    let mut path = Vec::new();
    let mut cur = Some(end_id);
    while let Some(id) = cur {
        path.insert(0, id.clone());
        cur = prev.get(&id).cloned().flatten();
    }
    path
}

fn ensure_valid_route_exists(
    rows: u32,
    cols: u32,
    _types: &mut HashMap<String, HackNodeType>,
    end_id: &str,
    rand: &mut Mulberry32,
) -> Vec<String> {
    let end_row = parse_node_row(end_id).unwrap_or(0);
    let entry_row = (rand.next() * rows as f64).floor() as u32;
    let entry_id = hack_node_id(entry_row, 0);

    let path = find_power_path(rows, cols, entry_row, end_row);
    if !path.is_empty() {
        return path;
    }

    let fallback = find_power_path(rows, cols, rows / 2, end_row);
    if !fallback.is_empty() {
        return fallback;
    }

    vec![entry_id, end_id.to_string()]
}

fn generate_hack_node_types(
    rows: u32,
    cols: u32,
    seed: u32,
) -> (HashMap<String, HackNodeType>, HashSet<String>) {
    let mut rand = mulberry32(seed);
    let mut types: HashMap<String, HackNodeType> = HashMap::new();

    for col in 0..cols {
        for row in 0..rows {
            types.insert(hack_node_id(row, col), HackNodeType::Power);
        }
    }

    let end_row = (rand.next() * rows as f64).floor() as u32;
    let end_id = hack_node_id(end_row, cols - 1);
    let path = ensure_valid_route_exists(rows, cols, &mut types, &end_id, &mut rand);
    let path_set: HashSet<String> = path.iter().cloned().collect();
    for id in &path {
        types.insert(id.clone(), HackNodeType::Power);
    }

    if crate::state::HACK_SECURITY_ENABLED {
        sprinkle_column_securities(rows, cols, &mut types, &mut rand, &path_set);
        ensure_minimum_security_nodes(rows, cols, &mut types, &mut rand, &path_set);
        ensure_top_row_security_nodes(rows, cols, &mut types, &mut rand, &path_set);
    }

    for col in 0..cols {
        let col_cells: Vec<String> = (0..rows).map(|row| hack_node_id(row, col)).collect();
        ensure_column_has_power(&col_cells, &mut types, &mut rand, &path_set);
    }

    enforce_max_one_security_per_column(rows, cols, &mut types, &path_set);
    (types, path_set)
}

fn column_has_security_in_types(col: u32, types: &HashMap<String, HackNodeType>, rows: u32) -> bool {
    column_has_security(col, types, rows)
}

fn relocate_tripped_security_node(
    types: &mut HashMap<String, HackNodeType>,
    path_set: &HashSet<String>,
    security_id: &str,
    rows: u32,
    cols: u32,
    pick_seed: u32,
) -> bool {
    if types.get(security_id) != Some(&HackNodeType::Security) {
        return false;
    }

    let from_row = parse_node_row(security_id);
    let from_col = parse_node_col(security_id);
    let (Some(from_row), Some(from_col)) = (from_row, from_col) else {
        return false;
    };

    let mut rand = mulberry32(pick_seed);
    types.insert(security_id.to_string(), HackNodeType::Power);

    let mut candidates: Vec<String> = (0..rows)
        .filter(|row| *row != from_row)
        .map(|row| hack_node_id(row, from_col))
        .filter(|id| !path_set.contains(id) && types.get(id) == Some(&HackNodeType::Power))
        .collect();

    if candidates.is_empty() {
        for col in 0..cols - 1 {
            if col == from_col {
                continue;
            }
            if column_has_security_in_types(col, types, rows) {
                continue;
            }
            for row in 0..rows {
                let id = hack_node_id(row, col);
                if !path_set.contains(&id) && types.get(&id) == Some(&HackNodeType::Power) {
                    candidates.push(id);
                }
            }
        }
    }

    if candidates.is_empty() {
        types.insert(security_id.to_string(), HackNodeType::Security);
        return false;
    }

    let pick = pick_weighted_security_cell(&candidates, rows, &mut rand);
    types.insert(pick, HackNodeType::Security);
    true
}

pub fn generate_hack_grid(rows: u32, cols: u32, seed: u32) -> Vec<HackPuzzleNode> {
    let (types, _) = generate_hack_node_types(rows, cols, seed);
    build_hack_grid_from_types(&types, rows, cols, pick_start_row(seed, rows, 0))
}

pub fn generate_hack_grid_after_security_death(
    rows: u32,
    cols: u32,
    seed: u32,
    tripped_security_id: Option<&str>,
    aim_salt: u32,
) -> Vec<HackPuzzleNode> {
    let (mut types, path_set) = generate_hack_node_types(rows, cols, seed);

    if let Some(security_id) = tripped_security_id {
        let pick_seed = seed ^ hash_node_id(security_id);
        if relocate_tripped_security_node(
            &mut types,
            &path_set,
            security_id,
            rows,
            cols,
            pick_seed,
        ) {
            enforce_max_one_security_per_column(rows, cols, &mut types, &path_set);
            let mut rand = mulberry32(pick_seed.wrapping_add(1));
            for col in 0..cols {
                let col_cells: Vec<String> = (0..rows).map(|row| hack_node_id(row, col)).collect();
                ensure_column_has_power(&col_cells, &mut types, &mut rand, &path_set);
            }
            ensure_top_row_security_nodes(rows, cols, &mut types, &mut rand, &path_set);
        }
    }

    build_hack_grid_from_types(
        &types,
        rows,
        cols,
        pick_start_row(seed, rows, aim_salt),
    )
}

pub fn count_security_nodes(state: &HackGameState) -> u32 {
    state
        .nodes
        .iter()
        .filter(|n| n.id != HACK_START_NODE_ID && n.node_type == HackNodeType::Security)
        .count() as u32
}

pub fn hack_progress_step_count(cols: u32) -> u32 {
    (cols + 1).max(1)
}

pub fn resolve_confirm_target<'a>(
    active: &HackPuzzleNode,
    selected: &HackPuzzleNode,
    state: &'a HackGameState,
) -> Option<&'a HackPuzzleNode> {
    if selected.id == active.id {
        return get_pointer_target(active, state);
    }
    if is_selectable_neighbor(state, &selected.id) {
        return get_node(state, &selected.id);
    }
    None
}

pub fn sync_active_pointer_for_selection(
    mut state: HackGameState,
    selected: &HackPuzzleNode,
) -> HackGameState {
    let active = match get_node(&state, &state.active_node_id) {
        Some(n) => n.clone(),
        None => return state,
    };
    let forward = match resolve_confirm_target(&active, selected, &state) {
        Some(n) => n.clone(),
        None => return state,
    };
    if active.id == HACK_START_NODE_ID || forward.col != get_required_next_col(&active) {
        return state;
    }
    let targets = get_next_column_targets(&active, &state);
    if let Some(pointer_target_index) = targets.iter().position(|n| n.id == forward.id) {
        state.nodes = state
            .nodes
            .iter()
            .map(|n| {
                if n.id == active.id {
                    let mut updated = n.clone();
                    updated.pointer_target_index = pointer_target_index as u32;
                    updated
                } else {
                    n.clone()
                }
            })
            .collect();
    }
    state
}

pub fn apply_forward_aim_after_connect(
    mut state: HackGameState,
    from: &HackPuzzleNode,
    to: &HackPuzzleNode,
) -> HackGameState {
    let active = match get_node(&state, &to.id) {
        Some(n) => n.clone(),
        None => return state,
    };

    let is_forward = from.id == HACK_START_NODE_ID
        || (to.id != HACK_REWARD_NODE_ID && to.col > from.col);

    if !is_forward {
        state.nodes = apply_selection(&state.nodes, &to.id, &to.id);
        state.selected_node_id = to.id.clone();
        return state;
    }

    let (pointer_target_index, selected_node_id, outgoing_dir) = if active.col
        == state.cols as i32
        - 1
    {
        let reward = get_node(&state, &state.reward_node_id);
        let selected = if reward.map(|r| is_selectable_neighbor(&state, &r.id)) == Some(true) {
            state.reward_node_id.clone()
        } else {
            active.id.clone()
        };
        (active.pointer_target_index, selected, active.pointer_direction)
    } else {
        let (idx, sel, dir) = pick_random_column_aim(&state, &active);
        (idx, sel, dir)
    };

    state.nodes = apply_selection(
        &state
            .nodes
            .iter()
            .map(|n| {
                if n.id == active.id {
                    let mut updated = n.clone();
                    updated.pointer_direction = outgoing_dir;
                    updated.pointer_target_index = pointer_target_index;
                    updated
                } else {
                    n.clone()
                }
            })
            .collect::<Vec<_>>(),
        &selected_node_id,
        &active.id,
    );
    state.selected_node_id = selected_node_id;
    state
}

pub fn get_hack_route_path(state: &HackGameState) -> Vec<String> {
    let mut path = vec![HACK_START_NODE_ID.to_string()];
    let next_by_from: HashMap<&str, &str> = state
        .connections
        .iter()
        .map(|c| (c.from_id.as_str(), c.to_id.as_str()))
        .collect();
    let mut current = HACK_START_NODE_ID;
    while let Some(next) = next_by_from.get(current) {
        path.push(next.to_string());
        current = next;
    }
    path
}

pub fn compute_progress(state: &HackGameState) -> u32 {
    let active = match get_node(state, &state.active_node_id) {
        Some(n) => n,
        None => return 0,
    };
    if active.id == HACK_START_NODE_ID {
        return 0;
    }
    if active.id == HACK_REWARD_NODE_ID {
        return hack_progress_step_count(state.cols);
    }
    (active.col + 1) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_column_has_at_least_one_power_node() {
        for seed in [1, 42, 999, 12345] {
            let (types, _) = generate_hack_node_types(4, 4, seed);
            for col in 0..4 {
                assert!(
                    (0..4).any(|row| types.get(&hack_node_id(row, col)) == Some(&HackNodeType::Power)),
                    "seed {seed} col {col}"
                );
            }
        }
    }

    #[test]
    fn max_one_security_per_column() {
        for seed in [1, 42, 999] {
            let (types, _) = generate_hack_node_types(4, 4, seed);
            for col in 0..3 {
                let count = (0..4)
                    .filter(|row| types.get(&hack_node_id(*row, col)) == Some(&HackNodeType::Security))
                    .count();
                assert!(count <= 1, "seed {seed} col {col} has {count} securities");
            }
        }
    }

    #[test]
    fn mulberry32_matches_js_sequence() {
        let mut rand = mulberry32(12345);
        let expected = [
            0.979_728_267_760_947_3,
            0.306_752_264_499_664_3,
            0.484_205_421_525_985,
            0.817_934_412_509_203,
            0.509_428_369_347_006_1,
        ];
        for value in expected {
            assert!((rand.next() - value).abs() < 1e-12);
        }
    }

    #[test]
    fn valid_route_exists_for_generated_grids() {
        for seed in [0, 1, 100, 0xdead_beef] {
            let (types, path_set) = generate_hack_node_types(4, 4, seed);
            assert!(!path_set.is_empty());
            for id in &path_set {
                assert_eq!(types.get(id), Some(&HackNodeType::Power));
            }
        }
    }
}
