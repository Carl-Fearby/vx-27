use serde::Serialize;
use wasm_bindgen::prelude::*;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum NodeType {
    Power,
    Security,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum PointerDirection {
    Right,
    Up,
    Down,
}

#[derive(Clone, Debug)]
struct Node {
    kind: NodeType,
    discovered: bool,
}

#[derive(Clone, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HackConnection {
    from_x: i32,
    from_y: u32,
    to_x: u32,
    to_y: u32,
    #[serde(rename = "type")]
    kind: &'static str,
}

#[derive(Clone, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmResult {
    succeeded: bool,
    failed: bool,
    complete: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    connection: Option<HackConnection>,
    #[serde(skip_serializing_if = "Option::is_none")]
    revealed_type: Option<&'static str>,
}

#[derive(Clone, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PublicHackNode {
    x: u32,
    y: u32,
    locked: bool,
    discovered: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    revealed_type: Option<&'static str>,
}

#[derive(Clone, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PublicHackState {
    width: u32,
    height: u32,
    start_x: i32,
    start_y: u32,
    selected_x: u32,
    selected_y: u32,
    pointer_target_x: u32,
    pointer_target_y: u32,
    nodes: Vec<PublicHackNode>,
    connections: Vec<HackConnection>,
    failed: bool,
    complete: bool,
}

#[wasm_bindgen]
pub struct HackGame {
    width: u32,
    height: u32,
    seed: u32,
    nodes: Vec<Node>,
    selected_x: u32,
    selected_y: u32,
    pointer_direction: PointerDirection,
    connections: Vec<HackConnection>,
    started: bool,
    failed: bool,
    complete: bool,
}

#[wasm_bindgen(js_name = createHackGame)]
pub fn create_hack_game(width: u32, height: u32, seed: Option<u32>) -> Result<HackGame, JsValue> {
    HackGame::new(width, height, seed.unwrap_or(0x7a11_c0de))
        .map_err(|message| JsValue::from_str(message))
}

#[wasm_bindgen]
impl HackGame {
    #[wasm_bindgen(js_name = getPublicState)]
    pub fn get_public_state(&self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&self.public_state())
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = moveSelection)]
    pub fn move_selection(&mut self, direction: &str) -> bool {
        if self.failed || self.complete {
            return false;
        }

        let (dx, dy) = match direction {
            "up" => (0, -1),
            "down" => (0, 1),
            "left" => (-1, 0),
            "right" => (1, 0),
            _ => return false,
        };

        let next_x = self.selected_x as i32 + dx;
        let next_y = self.selected_y as i32 + dy;
        if !self.in_bounds(next_x, next_y) {
            return false;
        }
        if !self.started && next_x != 0 {
            return false;
        }

        self.selected_x = next_x as u32;
        self.selected_y = next_y as u32;
        if self.pointer_target().is_none() {
            self.pointer_direction = self.valid_pointer_directions()[0];
        }
        true
    }

    #[wasm_bindgen(js_name = rotatePointer)]
    pub fn rotate_pointer(&mut self) -> bool {
        if self.failed || self.complete || !self.started {
            return false;
        }

        let valid = self.valid_pointer_directions();
        let current_index = valid
            .iter()
            .position(|direction| *direction == self.pointer_direction)
            .unwrap_or(0);
        self.pointer_direction = valid[(current_index + 1) % valid.len()];
        true
    }

    #[wasm_bindgen(js_name = confirmSelection)]
    pub fn confirm_selection(&mut self) -> Result<JsValue, JsValue> {
        let result = self.confirm_selection_inner();
        serde_wasm_bindgen::to_value(&result).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = resetHack)]
    pub fn reset_hack(&mut self) {
        if let Ok(next) = HackGame::new(self.width, self.height, self.seed) {
            *self = next;
        }
    }

    #[wasm_bindgen(js_name = isComplete)]
    pub fn is_complete(&self) -> bool {
        self.complete
    }

    #[wasm_bindgen(js_name = isFailed)]
    pub fn is_failed(&self) -> bool {
        self.failed
    }
}

impl HackGame {
    fn new(width: u32, height: u32, seed: u32) -> Result<Self, &'static str> {
        if width == 0 {
            return Err("hack grid width must be at least 1");
        }
        if height < 2 {
            return Err("hack grid height must be at least 2");
        }

        let mut game = Self {
            width,
            height,
            seed,
            nodes: build_nodes(width, height, seed),
            selected_x: 0,
            selected_y: height / 2,
            pointer_direction: PointerDirection::Right,
            connections: Vec::new(),
            started: false,
            failed: false,
            complete: false,
        };
        game.pointer_direction = game.valid_pointer_directions()[0];
        Ok(game)
    }

    fn index(&self, x: u32, y: u32) -> usize {
        (y * self.width + x) as usize
    }

    fn in_bounds(&self, x: i32, y: i32) -> bool {
        x >= 0 && y >= 0 && x < self.width as i32 && y < self.height as i32
    }

    fn pointer_target_for(&self, direction: PointerDirection) -> Option<(u32, u32)> {
        let (dx, dy) = match direction {
            PointerDirection::Right => (1, 0),
            PointerDirection::Up => (0, -1),
            PointerDirection::Down => (0, 1),
        };
        let x = self.selected_x as i32 + dx;
        let y = self.selected_y as i32 + dy;
        self.in_bounds(x, y).then_some((x as u32, y as u32))
    }

    fn valid_pointer_directions(&self) -> Vec<PointerDirection> {
        [
            PointerDirection::Right,
            PointerDirection::Up,
            PointerDirection::Down,
        ]
        .into_iter()
        .filter(|direction| self.pointer_target_for(*direction).is_some())
        .collect()
    }

    fn pointer_target(&self) -> Option<(u32, u32)> {
        self.pointer_target_for(self.pointer_direction)
    }

    fn confirm_selection_inner(&mut self) -> ConfirmResult {
        if self.failed || self.complete {
            return ConfirmResult {
                succeeded: false,
                failed: self.failed,
                complete: self.complete,
                connection: None,
                revealed_type: None,
            };
        }

        let (target_x, target_y) = if self.started {
            let Some(target) = self.pointer_target() else {
                return ConfirmResult {
                    succeeded: false,
                    failed: false,
                    complete: false,
                    connection: None,
                    revealed_type: None,
                };
            };
            target
        } else {
            (self.selected_x, self.selected_y)
        };

        let target_index = self.index(target_x, target_y);
        let revealed_type = self.nodes[target_index].kind.as_public_str();
        self.nodes[target_index].discovered = true;

        if self.nodes[target_index].kind == NodeType::Security {
            self.failed = true;
            return ConfirmResult {
                succeeded: false,
                failed: true,
                complete: false,
                connection: None,
                revealed_type: Some(revealed_type),
            };
        }

        let connection = HackConnection {
            from_x: if self.started { self.selected_x as i32 } else { -1 },
            from_y: if self.started { self.selected_y } else { self.height / 2 },
            to_x: target_x,
            to_y: target_y,
            kind: "power",
        };
        self.connections.push(connection.clone());
        self.started = true;
        self.selected_x = target_x;
        self.selected_y = target_y;
        self.complete = self.selected_x == self.width - 1;
        if !self.complete && self.pointer_target().is_none() {
            self.pointer_direction = self.valid_pointer_directions()[0];
        }

        ConfirmResult {
            succeeded: true,
            failed: false,
            complete: self.complete,
            connection: Some(connection),
            revealed_type: Some(revealed_type),
        }
    }

    fn public_state(&self) -> PublicHackState {
        let (pointer_target_x, pointer_target_y) = if self.started {
            self.pointer_target()
                .unwrap_or((self.selected_x, self.selected_y))
        } else {
            (self.selected_x, self.selected_y)
        };
        let nodes = self
            .nodes
            .iter()
            .enumerate()
            .map(|(index, node)| {
                let x = index as u32 % self.width;
                let y = index as u32 / self.width;
                PublicHackNode {
                    x,
                    y,
                    locked: !node.discovered,
                    discovered: node.discovered,
                    revealed_type: node.discovered.then_some(node.kind.as_public_str()),
                }
            })
            .collect();

        PublicHackState {
            width: self.width,
            height: self.height,
            start_x: -1,
            start_y: self.height / 2,
            selected_x: self.selected_x,
            selected_y: self.selected_y,
            pointer_target_x,
            pointer_target_y,
            nodes,
            connections: self.connections.clone(),
            failed: self.failed,
            complete: self.complete,
        }
    }
}

impl NodeType {
    fn as_public_str(self) -> &'static str {
        match self {
            NodeType::Power => "power",
            NodeType::Security => "security",
        }
    }
}

fn build_nodes(width: u32, height: u32, seed: u32) -> Vec<Node> {
    let mut nodes = Vec::with_capacity((width * height) as usize);
    for y in 0..height {
        for x in 0..width {
            let mixed = mix_seed(seed, x, y);
            let kind = if mixed % 100 < 64 {
                NodeType::Power
            } else {
                NodeType::Security
            };
            nodes.push(Node {
                kind,
                discovered: false,
            });
        }
    }

    for x in 0..width {
        ensure_column_kind(&mut nodes, width, height, x, NodeType::Power, seed);
        ensure_column_kind(&mut nodes, width, height, x, NodeType::Security, seed ^ 0x9e37_79b9);
    }

    nodes
}

fn ensure_column_kind(
    nodes: &mut [Node],
    width: u32,
    height: u32,
    x: u32,
    kind: NodeType,
    seed: u32,
) {
    let has_kind = (0..height).any(|y| nodes[(y * width + x) as usize].kind == kind);
    if has_kind {
        return;
    }

    let y = mix_seed(seed, x, height) % height;
    nodes[(y * width + x) as usize].kind = kind;
}

fn mix_seed(seed: u32, x: u32, y: u32) -> u32 {
    let mut value = seed ^ x.wrapping_mul(0x85eb_ca6b) ^ y.wrapping_mul(0xc2b2_ae35);
    value ^= value >> 16;
    value = value.wrapping_mul(0x7feb_352d);
    value ^= value >> 15;
    value = value.wrapping_mul(0x846c_a68b);
    value ^ (value >> 16)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn game() -> HackGame {
        HackGame::new(5, 4, 12345).expect("valid game")
    }

    fn set_node_type(game: &mut HackGame, x: u32, y: u32, kind: NodeType) {
        let index = game.index(x, y);
        game.nodes[index].kind = kind;
    }

    #[test]
    fn every_column_has_at_least_one_power_node() {
        let game = game();
        for x in 0..game.width {
            assert!((0..game.height).any(|y| game.nodes[game.index(x, y)].kind == NodeType::Power));
        }
    }

    #[test]
    fn every_column_has_at_least_one_security_node() {
        let game = game();
        for x in 0..game.width {
            assert!(
                (0..game.height).any(|y| game.nodes[game.index(x, y)].kind == NodeType::Security)
            );
        }
    }

    #[test]
    fn pointer_never_points_outside_the_grid() {
        let mut game = game();
        game.started = true;
        for x in 0..game.width {
            for y in 0..game.height {
                game.selected_x = x;
                game.selected_y = y;
                for _ in 0..6 {
                    game.rotate_pointer();
                    let (target_x, target_y) = game.pointer_target().expect("valid target");
                    assert!(target_x < game.width);
                    assert!(target_y < game.height);
                }
            }
        }
    }

    #[test]
    fn rotating_pointer_only_selects_valid_targets() {
        let mut game = game();
        game.started = true;
        game.selected_x = game.width - 1;
        game.selected_y = 0;
        for _ in 0..4 {
            game.rotate_pointer();
            assert_eq!(game.pointer_target(), Some((game.width - 1, 1)));
        }
    }

    #[test]
    fn confirming_a_power_node_advances_state() {
        let mut game = game();
        let (x, y) = (game.selected_x, game.selected_y);
        set_node_type(&mut game, x, y, NodeType::Power);

        let result = game.confirm_selection_inner();

        assert!(result.succeeded);
        assert_eq!((game.selected_x, game.selected_y), (x, y));
        assert_eq!(game.connections.len(), 1);
        assert_eq!(game.connections[0].from_x, -1);
        assert_eq!(game.connections[0].from_y, game.height / 2);
        assert_eq!((game.connections[0].to_x, game.connections[0].to_y), (x, y));
        assert!(!game.failed);
    }

    #[test]
    fn confirming_a_security_node_fails_the_hack() {
        let mut game = game();
        let (x, y) = (game.selected_x, game.selected_y);
        set_node_type(&mut game, x, y, NodeType::Security);

        let result = game.confirm_selection_inner();

        assert!(!result.succeeded);
        assert!(result.failed);
        assert!(game.failed);
        assert!(game.connections.is_empty());
    }

    #[test]
    fn start_phase_cannot_move_selection_out_of_first_column() {
        let mut game = game();
        assert!(!game.move_selection("right"));
        assert_eq!(game.selected_x, 0);
    }

    #[test]
    fn second_power_confirmation_connects_from_active_grid_node() {
        let mut game = game();
        let first = (game.selected_x, game.selected_y);
        set_node_type(&mut game, first.0, first.1, NodeType::Power);
        assert!(game.confirm_selection_inner().succeeded);

        let second = game.pointer_target().expect("valid second target");
        set_node_type(&mut game, second.0, second.1, NodeType::Power);
        assert!(game.confirm_selection_inner().succeeded);

        assert_eq!(game.connections.len(), 2);
        assert_eq!(game.connections[1].from_x, first.0 as i32);
        assert_eq!(game.connections[1].from_y, first.1);
        assert_eq!((game.connections[1].to_x, game.connections[1].to_y), second);
    }

    #[test]
    fn reset_clears_progress() {
        let mut game = game();
        let (x, y) = (game.selected_x, game.selected_y);
        set_node_type(&mut game, x, y, NodeType::Power);
        game.confirm_selection_inner();

        game.reset_hack();

        assert_eq!(game.connections.len(), 0);
        assert_eq!((game.selected_x, game.selected_y), (0, game.height / 2));
        assert!(!game.failed);
        assert!(!game.complete);
        assert!(game.nodes.iter().all(|node| !node.discovered));
    }

    #[test]
    fn public_state_does_not_reveal_hidden_node_types_too_early() {
        let mut game = game();
        let (x, y) = (game.selected_x, game.selected_y);
        set_node_type(&mut game, x, y, NodeType::Power);

        let before = game.public_state();
        assert!(before.nodes.iter().all(|node| node.revealed_type.is_none()));

        game.confirm_selection_inner();
        let after = game.public_state();
        let revealed = after
            .nodes
            .iter()
            .filter(|node| node.revealed_type.is_some())
            .collect::<Vec<_>>();
        assert_eq!(revealed.len(), 1);
        assert_eq!(revealed[0].revealed_type, Some("power"));
    }
}
