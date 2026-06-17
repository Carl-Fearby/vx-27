use serde::{Deserialize, Serialize};

pub const HACK_START_NODE_ID: &str = "start";
pub const HACK_REWARD_NODE_ID: &str = "reward";
pub const HACK_DEFAULT_TIMER_MS: u32 = 90_000;
pub const HACK_SECURITY_AUTO_RESET_MS: u32 = 3_000;
pub const HACK_SECURITY_RETRY_TIMER_MS: u32 = 60_000;
pub const HACK_SUCCESS_DISMISS_MS: u32 = 3_000;
pub const HACK_MAX_RETRIES: u32 = 5;
pub const HACK_SECURITY_ENABLED: bool = true;
pub const HACK_DEBUG_SHOW_SECURITY: bool = false;

pub const HACK_SECURITY_COLUMN_CHANCE: f64 = 0.88;
pub const HACK_MIN_SECURITY_NODES: u32 = 4;
pub const HACK_MIN_TOP_ROW_SECURITY: u32 = 2;
pub const HACK_AUTO_AIM_SECURITY_CHANCE: f64 = 0.25;

pub const HACK_REWARD_CREDITS: u32 = 250;
pub const HACK_REWARD_PISTOL_MAG_ROUNDS: u32 = 12;
pub const HACK_REWARD_RIFLE_SPARE_MAGS: u32 = 1;
pub const HACK_REWARD_AMMO_MAG_CHANCE: f64 = 0.75;

pub struct HackRewardChances {
    pub credits: f64,
    pub pistol_ammo: f64,
    pub medkit: f64,
    pub rifle: f64,
    pub grenade: f64,
    pub flashbang: f64,
}

pub const HACK_REWARD_CHANCES: HackRewardChances = HackRewardChances {
    credits: 1.0,
    pistol_ammo: HACK_REWARD_AMMO_MAG_CHANCE,
    medkit: 0.5,
    rifle: 0.2,
    grenade: 0.5,
    flashbang: 0.3,
};

pub const DIR_ORDER: [HackDirection; 3] = [HackDirection::Up, HackDirection::Down, HackDirection::Right];

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HackStatus {
    Idle,
    Active,
    Failed,
    Complete,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HackFailureKind {
    Security,
    Timer,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HackNodeType {
    Power,
    Security,
    Reward,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HackDirection {
    Up,
    Down,
    Right,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HackPuzzleNode {
    pub id: String,
    pub row: i32,
    pub col: i32,
    #[serde(rename = "type")]
    pub node_type: HackNodeType,
    pub revealed: bool,
    pub connected: bool,
    pub selected: bool,
    pub triggered: bool,
    pub pointer_direction: HackDirection,
    pub valid_directions: Vec<HackDirection>,
    pub pointer_target_index: u32,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HackConnection {
    #[serde(rename = "fromId")]
    pub from_id: String,
    #[serde(rename = "toId")]
    pub to_id: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HackRewards {
    pub credits: u32,
    pub pistol_ammo: u32,
    pub rifle_spare_mag: u32,
    pub medkit: u32,
    pub rifle: bool,
    pub grenade: u32,
    pub flashbang: u32,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HackGameState {
    pub status: HackStatus,
    pub rows: u32,
    pub cols: u32,
    pub seed: u32,
    pub selected_node_id: String,
    pub active_node_id: String,
    pub start_node_id: String,
    pub reward_node_id: String,
    pub nodes: Vec<HackPuzzleNode>,
    pub connections: Vec<HackConnection>,
    pub failure_connection: Option<HackConnection>,
    pub progress: u32,
    pub security_total: u32,
    pub timer_remaining_ms: u32,
    pub timer_total_ms: u32,
    pub retries_used: u32,
    pub failure_kind: Option<HackFailureKind>,
    pub failure_message: Option<String>,
    pub success_message: Option<String>,
    pub aim_roll: u32,
    pub aim_nonce: u32,
    pub reward_roll: u32,
    pub rewards: HackRewards,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHackGameOptions {
    pub rows: Option<u32>,
    pub cols: Option<u32>,
    pub seed: Option<u32>,
    pub timer_ms: Option<u32>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmSelectedNodeResult {
    pub state: HackGameState,
    pub event: Option<String>,
}

pub struct ColDelta {
    pub dc: i32,
    pub dr: i32,
}

pub fn next_col_delta(direction: HackDirection) -> ColDelta {
    match direction {
        HackDirection::Right => ColDelta { dc: 1, dr: 0 },
        HackDirection::Up => ColDelta { dc: 1, dr: -1 },
        HackDirection::Down => ColDelta { dc: 1, dr: 1 },
    }
}
