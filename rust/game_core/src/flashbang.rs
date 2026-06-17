use serde::{Deserialize, Serialize};

pub const FLASHBANG_BLIND_FULL_SEC: f64 = 3.0;
pub const FLASHBANG_BLIND_DIM_SEC: f64 = 0.0;
pub const FLASHBANG_BLIND_FADE_SEC: f64 = 2.5;
pub const FLASHBANG_BLIND_FULL_OPACITY: f64 = 1.0;
#[allow(dead_code)]
pub const FLASHBANG_BLIND_DIM_OPACITY: f64 = 0.9;

pub fn get_flashbang_blind_duration_sec() -> f64 {
    FLASHBANG_BLIND_FULL_SEC + FLASHBANG_BLIND_DIM_SEC + FLASHBANG_BLIND_FADE_SEC
}

fn smoothstep(t: f64) -> f64 {
    let t = t.clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

pub fn get_flashbang_overlay_opacity(elapsed_sec: f64) -> f64 {
    let total = get_flashbang_blind_duration_sec();
    if elapsed_sec >= total {
        return 0.0;
    }
    if elapsed_sec < FLASHBANG_BLIND_FULL_SEC {
        return FLASHBANG_BLIND_FULL_OPACITY;
    }
    let fade_t =
        ((elapsed_sec - FLASHBANG_BLIND_FULL_SEC) / FLASHBANG_BLIND_FADE_SEC).min(1.0);
    FLASHBANG_BLIND_FULL_OPACITY * (1.0 - smoothstep(fade_t))
}

pub fn is_flashbang_blind_expired(sim_time: f64, fade_end: f64) -> bool {
    sim_time >= fade_end
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlashbangBlindApplyOutput {
    pub blind_start: f64,
    pub blind_fade_end: f64,
    pub blinding: bool,
}

pub fn apply_flashbang_blind_to_target(
    sim_time: f64,
    currently_blinding: bool,
    blind_start: f64,
    blind_fade_end: f64,
) -> FlashbangBlindApplyOutput {
    let new_fade_end = sim_time + get_flashbang_blind_duration_sec();
    let reset_start = !currently_blinding || sim_time >= blind_fade_end;
    FlashbangBlindApplyOutput {
        blind_start: if reset_start { sim_time } else { blind_start },
        blind_fade_end: blind_fade_end.max(new_fade_end),
        blinding: true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blind_duration_matches_js_constants() {
        assert!((get_flashbang_blind_duration_sec() - 5.5).abs() < 0.0001);
    }

    #[test]
    fn overlay_full_then_fades() {
        assert!((get_flashbang_overlay_opacity(0.0) - 1.0).abs() < 0.0001);
        assert!((get_flashbang_overlay_opacity(2.9) - 1.0).abs() < 0.0001);
        assert!(get_flashbang_overlay_opacity(5.5) <= 0.0001);
        assert!(get_flashbang_overlay_opacity(4.0) < 1.0);
        assert!(get_flashbang_overlay_opacity(4.0) > 0.0);
    }

    #[test]
    fn apply_extends_fade_end_and_resets_start_when_expired() {
        let first = apply_flashbang_blind_to_target(10.0, false, 0.0, 0.0);
        assert!((first.blind_start - 10.0).abs() < 0.0001);
        assert!((first.blind_fade_end - 15.5).abs() < 0.0001);
        assert!(first.blinding);

        let extend = apply_flashbang_blind_to_target(11.0, true, 10.0, 15.5);
        assert!((extend.blind_start - 10.0).abs() < 0.0001);
        assert!((extend.blind_fade_end - 16.5).abs() < 0.0001);

        let after_expiry = apply_flashbang_blind_to_target(20.0, true, 10.0, 15.5);
        assert!((after_expiry.blind_start - 20.0).abs() < 0.0001);
    }

    #[test]
    fn expired_when_sim_time_reaches_fade_end() {
        assert!(!is_flashbang_blind_expired(14.9, 15.0));
        assert!(is_flashbang_blind_expired(15.0, 15.0));
    }
}
