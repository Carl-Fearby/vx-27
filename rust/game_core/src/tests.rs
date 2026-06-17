use crate::ammo::WeaponAmmoState;
use crate::create_game_core;

    #[test]
    fn regenerates_health_below_one_hundred() {
        let mut core = create_game_core(Some(98.0));
        core.tick(10.0, false);
        assert_eq!(core.player_health, 99.0);
        assert!(core.stamina_should_sync_from_health);
    }

    #[test]
    fn does_not_regenerate_dead_player() {
        let mut core = create_game_core(Some(0.0));
        core.tick(30.0, false);
        assert_eq!(core.player_health, 0.0);
    }

    #[test]
    fn decays_radioactive_overflow() {
        let mut core = create_game_core(Some(103.0));
        core.tick(5.0, false);
        assert_eq!(core.player_health, 102.0);
        assert!(core.stamina_should_sync_from_health);
    }

    #[test]
    fn overflow_decay_stops_at_one_hundred() {
        let mut core = create_game_core(Some(100.5));
        core.tick(5.0, false);
        assert_eq!(core.player_health, 100.0);
    }

    #[test]
    fn grenade_cooldown_ticks_to_zero() {
        let mut core = create_game_core(Some(100.0));
        core.set_grenade_cooldown(1.0);
        core.tick(0.4, false);
        assert_eq!(core.grenade_cooldown_remaining, 0.6);
        core.tick(1.0, false);
        assert_eq!(core.grenade_cooldown_remaining, 0.0);
    }

    #[test]
    fn mission_time_advances_only_when_unpaused() {
        let mut core = create_game_core(Some(100.0));
        core.tick(1.5, true);
        assert_eq!(core.mission_time, 0.0);
        core.tick(1.5, false);
        assert_eq!(core.mission_time, 1.5);
    }

    #[test]
    fn interaction_gate_blocks_open_panels() {
        let core = create_game_core(Some(100.0));
        assert!(core.can_interact_gate_inner(crate::InteractionGateInput {
            pointer_active: true,
            frozen: false,
            rebind_action_open: false,
            settings_open: false,
            controls_open: false,
            console_hack_open: false,
        }));
        assert!(!core.can_interact_gate_inner(crate::InteractionGateInput {
            pointer_active: true,
            frozen: false,
            rebind_action_open: false,
            settings_open: true,
            controls_open: false,
            console_hack_open: false,
        }));
    }

    #[test]
    fn player_movement_gates_force_crouch_and_jump() {
        let core = create_game_core(Some(100.0));
        let gates = core.compute_player_movement_gates_inner(crate::PlayerMovementGateInput {
            want_crouch: false,
            can_stand: false,
            grounded: true,
            jump_pressed: true,
            jump_clearance: true,
        });
        assert!(gates.force_crouch);
        assert!(gates.crouching);
        assert!(!gates.can_jump);

        let gates = core.compute_player_movement_gates_inner(crate::PlayerMovementGateInput {
            want_crouch: false,
            can_stand: true,
            grounded: true,
            jump_pressed: true,
            jump_clearance: true,
        });
        assert!(!gates.force_crouch);
        assert!(gates.can_jump);
    }

    #[test]
    fn oil_barrel_fire_proximity_respects_cooldown() {
        let mut core = create_game_core(Some(100.0));
        assert!(core.tick_oil_barrel_fire_proximity_damage_inner(crate::OilBarrelFireProximityInput {
            dt: 0.0,
            in_range: true,
            interval_sec: 1.0,
        }));
        assert!(!core.tick_oil_barrel_fire_proximity_damage_inner(crate::OilBarrelFireProximityInput {
            dt: 0.25,
            in_range: true,
            interval_sec: 1.0,
        }));
        assert!(core.tick_oil_barrel_fire_proximity_damage_inner(crate::OilBarrelFireProximityInput {
            dt: 0.75,
            in_range: true,
            interval_sec: 1.0,
        }));
    }

    #[test]
    fn blast_and_barrel_damage_apply_fixed_amounts() {
        let mut core = create_game_core(Some(100.0));
        assert_eq!(crate::lifecycle::apply_grenade_explosion_damage(&mut core), 40.0);
        assert_eq!(crate::lifecycle::apply_oil_barrel_fire_damage(&mut core), 30.0);
    }

    #[test]
    fn wall_weapon_resupply_rules_follow_stage_and_owned_state() {
        let core = create_game_core(Some(100.0));
        assert!(!core.can_wall_weapon_resupply_inner(crate::WallWeaponResupplyInput {
            weapon_id: "rifle".to_string(),
            stage: 0,
            pistol_owned: false,
        }));
        assert!(core.can_wall_weapon_resupply_inner(crate::WallWeaponResupplyInput {
            weapon_id: "rifle".to_string(),
            stage: 1,
            pistol_owned: false,
        }));
        assert!(!core.can_wall_weapon_resupply_inner(crate::WallWeaponResupplyInput {
            weapon_id: "pistol".to_string(),
            stage: 1,
            pistol_owned: false,
        }));
        assert!(core.can_wall_weapon_resupply_inner(crate::WallWeaponResupplyInput {
            weapon_id: "pistol".to_string(),
            stage: 1,
            pistol_owned: true,
        }));
    }

    #[test]
    fn damage_and_healing_update_health() {
        let mut core = create_game_core(Some(100.0));
        assert_eq!(core.damage_player(40.0), 60.0);
        assert_eq!(core.heal_player(15.0, Some(100.0)), 75.0);
    }

    #[test]
    fn player_core_drains_stamina_when_sprinting() {
        let mut core = create_game_core(Some(100.0));
        let output = core.tick_player_core_inner(crate::PlayerCoreInput {
            dt: 1.0,
            forward: true,
            backward: false,
            strafe_left: false,
            strafe_right: false,
            sprint: true,
            crouching: false,
            aiming: false,
            stamina_max: 1.0,
            walk_speed: 4.0,
            sprint_speed: 7.0,
            crouch_speed: 2.5,
            aim_move_mul: 0.55,
        });
        assert!(output.sprinting);
        assert_eq!(output.speed, 7.0);
        assert!(output.stamina < 1.0);
    }

    #[test]
    fn player_core_blocks_left_strafe_while_aiming() {
        let mut core = create_game_core(Some(100.0));
        let output = core.tick_player_core_inner(crate::PlayerCoreInput {
            dt: 0.016,
            forward: false,
            backward: false,
            strafe_left: true,
            strafe_right: false,
            sprint: false,
            crouching: false,
            aiming: true,
            stamina_max: 1.0,
            walk_speed: 4.0,
            sprint_speed: 7.0,
            crouch_speed: 2.5,
            aim_move_mul: 0.55,
        });
        assert_eq!(output.move_x, 0.0);
        assert!(!output.moving);
    }

    #[test]
    fn vertical_core_jumps_and_applies_gravity() {
        let mut core = create_game_core(Some(100.0));
        let output = core.tick_player_vertical_inner(crate::PlayerVerticalInput {
            dt: 0.1,
            y: 1.65,
            grounded: true,
            jump_pressed: true,
            can_jump: true,
            gravity: -22.0,
            jump_velocity: 8.5,
        });
        assert!(output.jumped);
        assert!(!output.grounded);
        assert_eq!(output.velocity_y, 6.3);
        assert!(output.y > 1.65);
    }

    #[test]
    fn vertical_core_does_not_jump_without_clearance() {
        let mut core = create_game_core(Some(100.0));
        let output = core.tick_player_vertical_inner(crate::PlayerVerticalInput {
            dt: 0.1,
            y: 1.65,
            grounded: true,
            jump_pressed: true,
            can_jump: false,
            gravity: -22.0,
            jump_velocity: 8.5,
        });
        assert!(!output.jumped);
        assert!(output.velocity_y < 0.0);
    }

    #[test]
    fn weapon_reload_uses_spare_mag_and_caps_loaded_rounds() {
        let mut ammo = WeaponAmmoState::new(70, 2, 80, 15);
        assert!(ammo.try_reload(true));
        assert_eq!(ammo.rounds, 150);
        assert_eq!(ammo.spare, 1);
        assert!(ammo.try_reload(true));
        assert_eq!(ammo.rounds, 160);
        assert_eq!(ammo.spare, 0);
    }

    #[test]
    fn weapon_reload_respects_low_ammo_threshold_without_force() {
        let mut ammo = WeaponAmmoState::new(16, 2, 80, 15);
        assert!(!ammo.try_reload(false));
        assert_eq!(ammo.rounds, 16);
        assert_eq!(ammo.spare, 2);

        ammo.rounds = 14;
        assert!(ammo.try_reload(false));
        assert_eq!(ammo.rounds, 94);
        assert_eq!(ammo.spare, 1);
    }

    #[test]
    fn weapon_consume_auto_reloads_when_empty() {
        let mut ammo = WeaponAmmoState::new(0, 1, 12, 4);
        let (fired, reloaded) = ammo.try_consume_round(true);
        assert!(fired);
        assert!(reloaded);
        assert_eq!(ammo.rounds, 11);
        assert_eq!(ammo.spare, 0);
    }

    #[test]
    fn weapon_consume_fails_when_empty_without_spare() {
        let mut ammo = WeaponAmmoState::new(0, 0, 12, 4);
        let (fired, reloaded) = ammo.try_consume_round(true);
        assert!(!fired);
        assert!(!reloaded);
        assert_eq!(ammo.rounds, 0);
    }

    #[test]
    fn throwable_throw_consumes_count_and_sets_cooldown() {
        let mut core = create_game_core(Some(100.0));
        assert!(core.try_throw_kind("grenade", 0.5));
        assert_eq!(core.grenade_count, 3);
        assert_eq!(core.grenade_cooldown_remaining, 0.5);
        assert!(!core.try_throw_kind("grenade", 0.5));
        assert_eq!(core.grenade_count, 3);
    }

    #[test]
    fn pickup_reward_updates_core_state() {
        let mut core = create_game_core(Some(80.0));
        core.apply_pickup_reward_inner("hp".to_string(), 10, 0, 100.0);
        assert_eq!(core.player_health, 90.0);
        core.apply_pickup_reward_inner("flashbang".to_string(), 2, 1, 100.0);
        assert_eq!(core.flashbang_count, 6);
        core.apply_pickup_reward_inner("score".to_string(), 0, 50, 100.0);
        assert_eq!(core.player_score, 50);
    }

    #[test]
    fn combat_score_applies_hit_cap_and_kill_bonus() {
        let value = crate::score::calculate_combat_score("head", 20.0, true, 30, 100);
        assert_eq!(value.score, 280);
        assert_eq!(value.hit_score_awarded, 60);
        assert_eq!(value.total_target_score, 380);
    }

    #[test]
    fn grenade_blast_damage_falls_off_with_distance() {
        let output = crate::grenade::calculate_grenade_blast_hit(2.5, 5.0, 150.0, 1.0);
        assert!(output.hit);
        assert_eq!(output.falloff, 0.5);
        assert_eq!(output.damage, 75.0);
        assert_eq!(output.knockback_mul, 1.1);
    }

    #[test]
    fn target_repair_ticks_cooldown_before_healing() {
        let core = create_game_core(Some(100.0));
        let output = core.tick_target_repair_inner(0.5, 10.0, 30.0, 1.25, 0.63);
        assert_eq!(output.health, 10.0);
        assert_eq!(output.repair_cooldown, 0.75);
        assert!(!output.repaired);
        assert!(output.alive);
    }

    #[test]
    fn target_repair_heals_and_clamps_to_max_health() {
        let core = create_game_core(Some(100.0));
        let output = core.tick_target_repair_inner(2.0, 29.5, 30.0, 0.0, 0.63);
        assert_eq!(output.health, 30.0);
        assert_eq!(output.ratio, 1.0);
        assert!(output.repaired);
    }

    #[test]
    fn kill_drop_plan_matches_headshot_ammo_and_grenade_rules() {
        let output = crate::score::plan_kill_drops("head", false, 100.0, 1, 1, 0, 0.69, false);
        assert!(output.hp);
        assert!(output.ammo);
        assert!(output.grenade);

        let output = crate::score::plan_kill_drops("body", false, 100.0, 2, 1, 5, 0.0, false);
        assert!(!output.hp);
        assert!(!output.ammo);
        assert!(!output.grenade);
    }

    #[test]
    fn kill_drop_plan_always_drops_hp_for_explosive_kills() {
        let output = crate::score::plan_kill_drops("grenade", true, 100.0, 4, 1, 4, 0.99, false);
        assert!(output.hp);
        assert!(!output.ammo);
        assert!(!output.grenade);
    }

    #[test]
    fn dev_drop_all_rewards_overrides_drop_rules() {
        let output = crate::score::plan_kill_drops("body", false, 100.0, 4, 1, 5, 0.99, true);
        assert!(output.hp);
        assert!(output.ammo);
        assert!(output.grenade);
    }

    #[test]
    fn target_respawn_plan_converts_seconds_to_milliseconds() {
        let core = create_game_core(Some(100.0));
        let output = core.plan_target_respawn_inner(4.25);
        assert!(output.should_schedule);
        assert_eq!(output.delay_ms, 4250);
    }

    #[test]
    fn player_death_decrements_lives_and_sets_reason() {
        let mut core = create_game_core(Some(12.0));
        core.sync_player_lives(2);
        let output = core.apply_player_death_inner("fall", 1000.0, 800.0);
        assert!(output.died);
        assert_eq!(output.reason, "You fell to your death");
        assert_eq!(output.player_lives, 1);
        assert_eq!(output.player_health, 0.0);
        assert!(!output.game_over);
        assert_eq!(output.min_display_end, 1800.0);
    }

    #[test]
    fn player_death_marks_game_over_on_last_life() {
        let mut core = create_game_core(Some(2.0));
        core.sync_player_lives(1);
        let output = core.apply_player_death_inner("suicide", 100.0, 800.0);
        assert_eq!(output.reason, "Suicide is never the answer");
        assert_eq!(output.player_lives, 0);
        assert!(output.game_over);
    }

    #[test]
    fn player_respawn_restores_health_and_sets_fade_end() {
        let mut core = create_game_core(Some(0.0));
        let output = core.plan_player_respawn_inner(2000.0, 1200.0);
        assert!(output.can_respawn);
        assert_eq!(output.player_health, 100.0);
        assert_eq!(output.fade_end_time, 3200.0);
        assert_eq!(core.player_health, 100.0);
    }

    #[test]
    fn wall_shop_first_purchase_unlocks_weapon_and_sets_starting_ammo() {
        let mut core = create_game_core(Some(100.0));
        let output = core.purchase_wall_weapon_inner(2500, 0, false, 0, 0, 2000, 500, 80, 2, 1);
        assert!(output.purchased);
        assert!(output.first_unlock);
        assert_eq!(output.player_score, 500);
        assert_eq!(output.stage, 1);
        assert!(output.weapon_unlocked);
        assert_eq!(output.rounds, 80);
        assert_eq!(output.spare, 2);
        assert_eq!(core.player_score, 500);
    }

    #[test]
    fn wall_shop_resupply_advances_stage_and_adds_spare_mags() {
        let mut core = create_game_core(Some(100.0));
        let output = core.purchase_wall_weapon_inner(900, 2, true, 40, 1, 2000, 500, 80, 2, 1);
        assert!(output.purchased);
        assert!(!output.first_unlock);
        assert!(output.can_resupply);
        assert_eq!(output.player_score, 400);
        assert_eq!(output.stage, 3);
        assert_eq!(output.rounds, 40);
        assert_eq!(output.spare, 2);
    }

    #[test]
    fn wall_shop_denies_purchase_when_score_is_too_low() {
        let mut core = create_game_core(Some(100.0));
        let output = core.purchase_wall_weapon_inner(100, 0, false, 0, 0, 2000, 500, 80, 2, 1);
        assert!(!output.purchased);
        assert!(!output.affordable);
        assert_eq!(output.player_score, 100);
        assert_eq!(output.stage, 0);
        assert_eq!(core.player_score, 0);
    }
