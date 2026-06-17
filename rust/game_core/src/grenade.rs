use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrenadeBlastOutput {
    pub hit: bool,
    pub falloff: f64,
    pub damage: f64,
    pub knockback_mul: f64,
}

pub fn calculate_grenade_blast_hit(
    distance: f64,
    blast_radius: f64,
    max_damage: f64,
    falloff_power: f64,
) -> GrenadeBlastOutput {
    let radius = blast_radius.max(0.001);
    if distance < 0.0 || distance >= radius {
        return GrenadeBlastOutput {
            hit: false,
            falloff: 0.0,
            damage: 0.0,
            knockback_mul: 0.0,
        };
    }
    let power = falloff_power.max(0.001);
    let falloff = (1.0 - (distance / radius).powf(power)).clamp(0.0, 1.0);
    GrenadeBlastOutput {
        hit: true,
        falloff,
        damage: max_damage.max(0.0) * falloff,
        knockback_mul: 0.85 + (1.35 - 0.85) * falloff,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grenade_blast_damage_falls_off_with_distance() {
        let output = calculate_grenade_blast_hit(2.5, 5.0, 150.0, 1.0);
        assert!(output.hit);
        assert_eq!(output.falloff, 0.5);
        assert_eq!(output.damage, 75.0);
        assert_eq!(output.knockback_mul, 1.1);
    }
}
