use crate::collision::{
    point_in_rounded_box_footprint, resolve_box_collider, rotated_box_overlaps_circle,
    world_to_box_local, ColliderBoxInput,
};
use crate::ground_support::{
    resolve_support_info, sample_flat_support_at, ResolveSupportInfoInput, SampleFlatSupportInput,
};
use crate::player_collision::{
    push_circle_out_of_colliders, resolve_player_colliders, spawn_blocked_at,
    PushCircleOutInput, ResolvePlayerCollidersInput, SpawnBlockedAtInput,
};
use crate::player_headroom::{
    has_headroom, resolve_ceiling_collisions, HasHeadroomInput, ResolveCeilingCollisionsInput,
};
use crate::projectile::{
    compute_throw_velocity, projectile_apply_ground_roll, projectile_fuse_tick,
    projectile_integrate, projectile_preview_floor_and_bounds, projectile_preview_step,
    projectile_resolve_bounds, projectile_resolve_floor_live, projectile_substep_count,
    ProjectileBoundsInput, ProjectileFuseTickInput, ProjectileGroundRollInput,
    ProjectileIntegrateInput, ProjectileLiveFloorInput, ProjectilePreviewStepInput,
};
use crate::projectile_collision::{
    collect_projectile_nearby_collider_indices, resolve_projectile_against_colliders,
    CollectProjectileNearbyInput, ResolveProjectileCollidersInput,
};
use crate::ragdoll::{
    clamp_to_bounds, tick_ragdoll_core_topple, tick_ragdoll_hole_fall, tick_ragdoll_launch,
    TickRagdollCoreToppleInput, TickRagdollHoleFallInput, TickRagdollLaunchInput,
};
use crate::spawn_foot_y::{
    point_in_floor_hole, resolve_spawn_foot_y, ResolveSpawnFootYInput,
};
use crate::state::GameCore;
use crate::target_spawn::{
    overlaps_targets, pick_random_spawn_xz, position_in_authored_bounds,
    resolve_target_respawn_placement, should_spawn_authored_point, ArenaBounds,
    PickRandomSpawnInput, TargetOccupant, TargetRespawnPlacementInput,
};
use crate::vx27_collision::{
    is_vx27_container_collider_near_player, is_vx27_container_end_or_door_collider,
    is_vx27_container_horizontal_collider, point_in_vx27_exterior_collider_footprint,
    should_skip_vx27_container_collider, should_skip_vx27_container_headroom,
    Vx27ColliderInput,
};
use crate::walk_bounds::{compute_resolved_walk_bounds, ComputeWalkBoundsInput};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl GameCore {
    #[wasm_bindgen(js_name = computeThrowVelocity)]
    pub fn compute_throw_velocity_wasm(
        &self,
        aim_x: f64,
        aim_y: f64,
        aim_z: f64,
        throw_speed: f64,
        loft_angle_deg: f64,
    ) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&compute_throw_velocity(
            aim_x,
            aim_y,
            aim_z,
            throw_speed,
            loft_angle_deg,
        ))
        .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = projectileSubstepCount)]
    pub fn projectile_substep_count_wasm(
        &self,
        speed: f64,
        dt: f64,
        max_move: f64,
        max_substeps: u32,
    ) -> u32 {
        projectile_substep_count(speed, dt, max_move, max_substeps)
    }

    #[wasm_bindgen(js_name = projectileIntegrate)]
    pub fn projectile_integrate_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: ProjectileIntegrateInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&projectile_integrate(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = projectileResolveFloorLive)]
    pub fn projectile_resolve_floor_live_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: ProjectileLiveFloorInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&projectile_resolve_floor_live(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = projectileResolveBounds)]
    pub fn projectile_resolve_bounds_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: ProjectileBoundsInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&projectile_resolve_bounds(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = projectileApplyGroundRoll)]
    pub fn projectile_apply_ground_roll_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: ProjectileGroundRollInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&projectile_apply_ground_roll(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = projectileFuseTick)]
    pub fn projectile_fuse_tick_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: ProjectileFuseTickInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&projectile_fuse_tick(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = projectilePreviewFloorAndBounds)]
    pub fn projectile_preview_floor_and_bounds_wasm(
        &self,
        input: JsValue,
    ) -> Result<JsValue, JsValue> {
        let input: ProjectilePreviewStepInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        let output = projectile_preview_floor_and_bounds(input.pos, input.vel, input);
        serde_wasm_bindgen::to_value(&output).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = projectilePreviewStep)]
    pub fn projectile_preview_step_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: ProjectilePreviewStepInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&projectile_preview_step(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = overlapsTargets)]
    pub fn overlaps_targets_wasm(
        &self,
        x: f64,
        z: f64,
        radius: f64,
        margin: f64,
        occupants: JsValue,
    ) -> Result<bool, JsValue> {
        let occupants: Vec<TargetOccupant> = serde_wasm_bindgen::from_value(occupants)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        Ok(overlaps_targets(x, z, radius, margin, &occupants))
    }

    #[wasm_bindgen(js_name = positionInAuthoredBounds)]
    pub fn position_in_authored_bounds_wasm(
        &self,
        x: f64,
        z: f64,
        bounds: JsValue,
        radius: f64,
        margin: f64,
    ) -> Result<bool, JsValue> {
        let bounds: ArenaBounds = serde_wasm_bindgen::from_value(bounds)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        Ok(position_in_authored_bounds(x, z, bounds, radius, margin))
    }

    #[wasm_bindgen(js_name = shouldSpawnAuthoredPoint)]
    pub fn should_spawn_authored_point_wasm(
        &self,
        is_random: bool,
        roll: f64,
        chance: f64,
    ) -> bool {
        should_spawn_authored_point(is_random, roll, chance)
    }

    #[wasm_bindgen(js_name = pickRandomSpawnXz)]
    pub fn pick_random_spawn_xz_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: PickRandomSpawnInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&pick_random_spawn_xz(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = resolveTargetRespawnPlacement)]
    pub fn resolve_target_respawn_placement_wasm(
        &self,
        input: JsValue,
    ) -> Result<JsValue, JsValue> {
        let input: TargetRespawnPlacementInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&resolve_target_respawn_placement(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = worldToBoxLocal)]
    pub fn world_to_box_local_wasm(
        &self,
        box_input: JsValue,
        x: f64,
        z: f64,
    ) -> Result<JsValue, JsValue> {
        let box_input: ColliderBoxInput = serde_wasm_bindgen::from_value(box_input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&world_to_box_local(box_input, x, z))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = rotatedBoxOverlapsCircle)]
    pub fn rotated_box_overlaps_circle_wasm(
        &self,
        box_input: JsValue,
        x: f64,
        z: f64,
        radius: f64,
    ) -> Result<bool, JsValue> {
        let box_input: ColliderBoxInput = serde_wasm_bindgen::from_value(box_input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        Ok(rotated_box_overlaps_circle(box_input, x, z, radius))
    }

    #[wasm_bindgen(js_name = pointInRoundedBoxFootprint)]
    pub fn point_in_rounded_box_footprint_wasm(
        &self,
        box_input: JsValue,
        x: f64,
        z: f64,
        radius: f64,
    ) -> Result<bool, JsValue> {
        let box_input: ColliderBoxInput = serde_wasm_bindgen::from_value(box_input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        Ok(point_in_rounded_box_footprint(box_input, x, z, radius))
    }

    #[wasm_bindgen(js_name = resolveBoxCollider)]
    pub fn resolve_box_collider_wasm(
        &self,
        pos_x: f64,
        pos_z: f64,
        radius: f64,
        box_input: JsValue,
    ) -> Result<JsValue, JsValue> {
        let box_input: ColliderBoxInput = serde_wasm_bindgen::from_value(box_input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&resolve_box_collider(pos_x, pos_z, radius, box_input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = resolveProjectileAgainstColliders)]
    pub fn resolve_projectile_against_colliders_wasm(
        &self,
        input: JsValue,
    ) -> Result<JsValue, JsValue> {
        let input: ResolveProjectileCollidersInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&resolve_projectile_against_colliders(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = collectProjectileNearbyColliderIndices)]
    pub fn collect_projectile_nearby_collider_indices_wasm(
        &self,
        input: JsValue,
    ) -> Result<JsValue, JsValue> {
        let input: CollectProjectileNearbyInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        let indices = collect_projectile_nearby_collider_indices(input);
        serde_wasm_bindgen::to_value(&indices).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = spawnBlockedAt)]
    pub fn spawn_blocked_at_wasm(&self, input: JsValue) -> Result<bool, JsValue> {
        let input: SpawnBlockedAtInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        Ok(spawn_blocked_at(input))
    }

    #[wasm_bindgen(js_name = pushCircleOutOfColliders)]
    pub fn push_circle_out_of_colliders_wasm(
        &self,
        input: JsValue,
    ) -> Result<JsValue, JsValue> {
        let input: PushCircleOutInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&push_circle_out_of_colliders(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = pointInFloorHole)]
    pub fn point_in_floor_hole_wasm(
        &self,
        x: f64,
        z: f64,
        holes: JsValue,
        inset: f64,
    ) -> Result<bool, JsValue> {
        let holes: Vec<crate::spawn_foot_y::FloorHoleInput> = serde_wasm_bindgen::from_value(holes)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        Ok(point_in_floor_hole(x, z, &holes, inset))
    }

    #[wasm_bindgen(js_name = resolveSpawnFootY)]
    pub fn resolve_spawn_foot_y_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: ResolveSpawnFootYInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&resolve_spawn_foot_y(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = resolvePlayerColliders)]
    pub fn resolve_player_colliders_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: ResolvePlayerCollidersInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&resolve_player_colliders(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = computeResolvedWalkBounds)]
    pub fn compute_resolved_walk_bounds_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: ComputeWalkBoundsInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&compute_resolved_walk_bounds(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = isVx27ContainerEndOrDoorCollider)]
    pub fn is_vx27_container_end_or_door_collider_wasm(
        &self,
        input: JsValue,
    ) -> Result<bool, JsValue> {
        let input: Vx27ColliderInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        Ok(is_vx27_container_end_or_door_collider(&input))
    }

    #[wasm_bindgen(js_name = isVx27ContainerHorizontalCollider)]
    pub fn is_vx27_container_horizontal_collider_wasm(
        &self,
        input: JsValue,
    ) -> Result<bool, JsValue> {
        let input: Vx27ColliderInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        Ok(is_vx27_container_horizontal_collider(&input))
    }

    #[wasm_bindgen(js_name = isVx27ContainerColliderNearPlayer)]
    pub fn is_vx27_container_collider_near_player_wasm(
        &self,
        input: JsValue,
        world_x: f64,
        world_z: f64,
        margin: f64,
    ) -> Result<bool, JsValue> {
        let input: Vx27ColliderInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        Ok(is_vx27_container_collider_near_player(
            &input, world_x, world_z, margin,
        ))
    }

    #[wasm_bindgen(js_name = pointInVx27ExteriorColliderFootprint)]
    pub fn point_in_vx27_exterior_collider_footprint_wasm(
        &self,
        input: JsValue,
        x: f64,
        z: f64,
        radius: f64,
    ) -> Result<bool, JsValue> {
        let input: Vx27ColliderInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        Ok(point_in_vx27_exterior_collider_footprint(&input, x, z, radius))
    }

    #[wasm_bindgen(js_name = shouldSkipVx27ContainerCollider)]
    pub fn should_skip_vx27_container_collider_wasm(
        &self,
        input: JsValue,
        world_x: f64,
        world_z: f64,
        foot_y: Option<f64>,
    ) -> Result<bool, JsValue> {
        let input: Vx27ColliderInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        Ok(should_skip_vx27_container_collider(
            &input, world_x, world_z, foot_y,
        ))
    }

    #[wasm_bindgen(js_name = shouldSkipVx27ContainerHeadroom)]
    pub fn should_skip_vx27_container_headroom_wasm(
        &self,
        input: JsValue,
        world_x: f64,
        world_z: f64,
        foot_y: Option<f64>,
    ) -> Result<bool, JsValue> {
        let input: Vx27ColliderInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        Ok(should_skip_vx27_container_headroom(
            &input, world_x, world_z, foot_y,
        ))
    }

    #[wasm_bindgen(js_name = sampleFlatSupportAt)]
    pub fn sample_flat_support_at_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: SampleFlatSupportInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&sample_flat_support_at(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = resolveSupportInfo)]
    pub fn resolve_support_info_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: ResolveSupportInfoInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&resolve_support_info(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = hasHeadroom)]
    pub fn has_headroom_wasm(&self, input: JsValue) -> Result<bool, JsValue> {
        let input: HasHeadroomInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        Ok(has_headroom(input))
    }

    #[wasm_bindgen(js_name = resolveCeilingCollisions)]
    pub fn resolve_ceiling_collisions_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: ResolveCeilingCollisionsInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&resolve_ceiling_collisions(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = clampToBounds)]
    pub fn clamp_to_bounds_wasm(
        &self,
        px: f64,
        pz: f64,
        radius: f64,
        bounds: JsValue,
    ) -> Result<JsValue, JsValue> {
        let bounds: Option<crate::ragdoll::BoundsInput> = if bounds.is_null() || bounds.is_undefined()
        {
            None
        } else {
            Some(
                serde_wasm_bindgen::from_value(bounds)
                    .map_err(|err| JsValue::from_str(&err.to_string()))?,
            )
        };
        serde_wasm_bindgen::to_value(&clamp_to_bounds(px, pz, radius, bounds))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = tickRagdollHoleFall)]
    pub fn tick_ragdoll_hole_fall_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: TickRagdollHoleFallInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&tick_ragdoll_hole_fall(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = tickRagdollCoreTopple)]
    pub fn tick_ragdoll_core_topple_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: TickRagdollCoreToppleInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&tick_ragdoll_core_topple(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = tickRagdollLaunch)]
    pub fn tick_ragdoll_launch_wasm(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let input: TickRagdollLaunchInput = serde_wasm_bindgen::from_value(input)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        serde_wasm_bindgen::to_value(&tick_ragdoll_launch(input))
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }
}
