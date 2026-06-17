use crate::flashbang::{
    apply_flashbang_blind_to_target, get_flashbang_blind_duration_sec,
    get_flashbang_overlay_opacity, is_flashbang_blind_expired,
};
use crate::grenade::calculate_grenade_blast_hit;
use crate::gameplay_rules::{
    plan_kill_drop_scatter, plan_reward_drop_launch, resolve_collect_fade, resolve_pickup_collect,
    resolve_player_death_trigger, resolve_primary_weapon_swap, resolve_ragdoll_impulse_seed,
    resolve_secondary_slot,
    CollectFadeInput, KillDropScatterInput, PickupCollectInput, PlayerDeathTriggerInput,
    PrimaryWeaponSwapInput, RagdollImpulseSeedInput, RewardDropLaunchInput, SecondarySlotInput,
};
use crate::hit_zones::{resolve_target_zone_damage, TargetZoneDamageInput};
use crate::recoil::{
    apply_fire_recoil_kick, clamp_recoil_pitch_anim, spring_step, spring_step_toward,
    step_aim_recoil_pair, AimRecoilStepInput,
};
use crate::score::calculate_combat_score;
use crate::state::GameCore;
use crate::weapon_damage;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl GameCore {
    #[wasm_bindgen(js_name = calculateCombatScore)]
    pub fn calculate_combat_score(
        &self,
        zone: String,
        damage: f64,
        killed: bool,
        hit_score_awarded: i32,
        total_score_awarded: i32,
    ) -> Result<JsValue, JsValue> {
        let output = calculate_combat_score(
            &zone,
            damage,
            killed,
            hit_score_awarded,
            total_score_awarded,
        );
        serde_wasm_bindgen::to_value(&output).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = calculateGrenadeBlastHit)]
    pub fn calculate_grenade_blast_hit(
        &self,
        distance: f64,
        blast_radius: f64,
        max_damage: f64,
        falloff_power: f64,
    ) -> Result<JsValue, JsValue> {
        let output = calculate_grenade_blast_hit(distance, blast_radius, max_damage, falloff_power);
        serde_wasm_bindgen::to_value(&output).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = resolvePickupCollect)]
    pub fn resolve_pickup_collect_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: PickupCollectInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&resolve_pickup_collect(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = resolveCollectFade)]
    pub fn resolve_collect_fade_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: CollectFadeInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&resolve_collect_fade(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = resolveSecondarySlot)]
    pub fn resolve_secondary_slot_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: SecondarySlotInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&resolve_secondary_slot(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = resolvePrimaryWeaponSwap)]
    pub fn resolve_primary_weapon_swap_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: PrimaryWeaponSwapInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&resolve_primary_weapon_swap(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = resolvePlayerDeathTrigger)]
    pub fn resolve_player_death_trigger_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: PlayerDeathTriggerInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&resolve_player_death_trigger(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = planKillDropScatter)]
    pub fn plan_kill_drop_scatter_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: KillDropScatterInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&plan_kill_drop_scatter(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = planRewardDropLaunch)]
    pub fn plan_reward_drop_launch_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: RewardDropLaunchInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&plan_reward_drop_launch(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = resolveRagdollImpulseSeed)]
    pub fn resolve_ragdoll_impulse_seed_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: RagdollImpulseSeedInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&resolve_ragdoll_impulse_seed(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = resolveTargetZoneDamage)]
    pub fn resolve_target_zone_damage_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: TargetZoneDamageInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        let output = resolve_target_zone_damage(input);
        serde_wasm_bindgen::to_value(&output).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = resolveAdsDamageScale)]
    pub fn resolve_ads_damage_scale_wasm(&self, aim_blend: f64) -> f64 {
        weapon_damage::resolve_ads_damage_scale(aim_blend)
    }

    #[wasm_bindgen(js_name = resolveAdsRecoilScale)]
    pub fn resolve_ads_recoil_scale_wasm(&self, aim_blend: f64) -> f64 {
        weapon_damage::resolve_ads_recoil_scale(aim_blend)
    }

    #[wasm_bindgen(js_name = resolveDamageFalloff)]
    pub fn resolve_damage_falloff_wasm(&self, weapon_id: String, shot_distance: f64) -> f64 {
        weapon_damage::resolve_damage_falloff(&weapon_id, shot_distance)
    }

    #[wasm_bindgen(js_name = resolveHeadshotDamage)]
    pub fn resolve_headshot_damage_wasm(
        &self,
        weapon_id: String,
        current_health: f64,
        max_health: f64,
        shot_distance: f64,
    ) -> f64 {
        weapon_damage::resolve_headshot_damage(
            &weapon_id,
            current_health,
            max_health,
            shot_distance,
        )
    }

    #[wasm_bindgen(js_name = resolveBodyZoneDamage)]
    pub fn resolve_body_zone_damage_wasm(
        &self,
        weapon_id: String,
        zone_id: String,
        zone_mult: f64,
        shot_distance: f64,
    ) -> f64 {
        weapon_damage::resolve_body_zone_damage(&weapon_id, &zone_id, zone_mult, shot_distance)
    }

    #[wasm_bindgen(js_name = recoilSpringStepToward)]
    pub fn recoil_spring_step_toward_wasm(
        &self,
        value: f64,
        velocity: f64,
        target: f64,
        stiffness: f64,
        damping: f64,
        dt: f64,
    ) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&spring_step_toward(
            value, velocity, target, stiffness, damping, dt,
        ))
        .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = recoilSpringStep)]
    pub fn recoil_spring_step_wasm(
        &self,
        value: f64,
        velocity: f64,
        stiffness: f64,
        damping: f64,
        dt: f64,
    ) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&spring_step(value, velocity, stiffness, damping, dt))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = clampRecoilPitchAnim)]
    pub fn clamp_recoil_pitch_anim_wasm(
        &self,
        pitch: f64,
        recoil_pitch_anim: f64,
        pitch_limit: f64,
    ) -> f64 {
        clamp_recoil_pitch_anim(pitch, recoil_pitch_anim, pitch_limit)
    }

    #[wasm_bindgen(js_name = applyFireRecoilKick)]
    pub fn apply_fire_recoil_kick_wasm(
        &self,
        fire_recoil_back: f64,
        aim_recoil_scale: f64,
        kick_vel_scale: f64,
        fire_recoil_pitch: f64,
        pitch_vel_scale: f64,
    ) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&apply_fire_recoil_kick(
            fire_recoil_back,
            aim_recoil_scale,
            kick_vel_scale,
            fire_recoil_pitch,
            pitch_vel_scale,
        ))
        .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = stepAimRecoilPair)]
    pub fn step_aim_recoil_pair_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: AimRecoilStepInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&step_aim_recoil_pair(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = getFlashbangBlindDurationSec)]
    pub fn get_flashbang_blind_duration_sec_wasm(&self) -> f64 {
        get_flashbang_blind_duration_sec()
    }

    #[wasm_bindgen(js_name = getFlashbangOverlayOpacity)]
    pub fn get_flashbang_overlay_opacity_wasm(&self, elapsed_sec: f64) -> f64 {
        get_flashbang_overlay_opacity(elapsed_sec)
    }

    #[wasm_bindgen(js_name = isFlashbangBlindExpired)]
    pub fn is_flashbang_blind_expired_wasm(&self, sim_time: f64, fade_end: f64) -> bool {
        is_flashbang_blind_expired(sim_time, fade_end)
    }

    #[wasm_bindgen(js_name = applyFlashbangBlindToTarget)]
    pub fn apply_flashbang_blind_to_target_wasm(
        &self,
        sim_time: f64,
        currently_blinding: bool,
        blind_start: f64,
        blind_fade_end: f64,
    ) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&apply_flashbang_blind_to_target(
            sim_time,
            currently_blinding,
            blind_start,
            blind_fade_end,
        ))
        .map_err(|err| JsValue::from_str(&err.to_string()))
    }
}
