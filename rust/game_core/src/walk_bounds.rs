use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RectBoundsInput {
    pub min_x: f64,
    pub max_x: f64,
    pub min_z: f64,
    pub max_z: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputeWalkBoundsInput {
    #[allow(dead_code)]
    pub x: f64,
    #[allow(dead_code)]
    pub z: f64,
    pub foot_y: f64,
    pub radius: f64,
    pub bounds: RectBoundsInput,
    pub floor_y: f64,
    pub arena_bounds: Option<RectBoundsInput>,
    pub extension_fp: Option<RectBoundsInput>,
    pub in_attached_footprint: bool,
    pub on_floor_extension: bool,
    pub catwalk_bounds: Option<RectBoundsInput>,
    pub attach_wall: String,
    pub in_passage: bool,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputeWalkBoundsOutput {
    pub min_x: f64,
    pub max_x: f64,
    pub min_z: f64,
    pub max_z: f64,
    pub catwalk_bounds: Option<RectBoundsInput>,
    pub in_room: bool,
}

pub fn compute_resolved_walk_bounds(input: ComputeWalkBoundsInput) -> ComputeWalkBoundsOutput {
    let r = input.radius;
    let mut min_x = input.bounds.min_x + r;
    let mut max_x = input.bounds.max_x - r;
    let mut min_z = input.bounds.min_z + r;
    let mut max_z = input.bounds.max_z - r;

    let on_catwalk_height = input.foot_y >= input.floor_y + 3.0;
    let in_room_at_floor = input.in_attached_footprint && !on_catwalk_height;

    if let Some(extension_fp) = input.extension_fp {
        if input.on_floor_extension && !on_catwalk_height {
            min_x = min_x.max(extension_fp.min_x + r);
            max_x = max_x.min(extension_fp.max_x - r);
            if input.attach_wall == "north" {
                min_z = min_z.max(extension_fp.min_z + r);
                if !input.in_passage {
                    max_z = max_z.min(extension_fp.max_z - r);
                }
            } else {
                max_z = max_z.min(extension_fp.max_z - r);
                if !input.in_passage {
                    min_z = min_z.max(extension_fp.min_z + r);
                }
            }
        }
    }

    let catwalk_bounds = if in_room_at_floor {
        None
    } else {
        input.catwalk_bounds
    };

    if let Some(cb) = catwalk_bounds {
        min_x = min_x.max(cb.min_x);
        max_x = max_x.min(cb.max_x);
        min_z = min_z.max(cb.min_z);
        max_z = max_z.min(cb.max_z);
    } else if let Some(arena_bounds) = input.arena_bounds {
        if !input.in_attached_footprint {
            min_x = min_x.max(arena_bounds.min_x + r);
            max_x = max_x.min(arena_bounds.max_x - r);

            if input.attach_wall == "south" {
                min_z = min_z.max(arena_bounds.min_z + r);
                if !input.in_passage && !on_catwalk_height {
                    max_z = max_z.min(arena_bounds.max_z - r);
                }
            } else {
                if !input.in_passage && !on_catwalk_height {
                    min_z = min_z.max(arena_bounds.min_z + r);
                }
                max_z = max_z.min(arena_bounds.max_z - r);
            }
        }
    }

    ComputeWalkBoundsOutput {
        min_x,
        max_x,
        min_z,
        max_z,
        catwalk_bounds,
        in_room: input.in_attached_footprint,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rect(min_x: f64, max_x: f64, min_z: f64, max_z: f64) -> RectBoundsInput {
        RectBoundsInput {
            min_x,
            max_x,
            min_z,
            max_z,
        }
    }

    #[test]
    fn clamps_to_base_bounds_with_radius() {
        let output = compute_resolved_walk_bounds(ComputeWalkBoundsInput {
            x: 0.0,
            z: 0.0,
            foot_y: 0.0,
            radius: 0.35,
            bounds: rect(-20.0, 20.0, -20.0, 20.0),
            floor_y: 0.0,
            arena_bounds: None,
            extension_fp: None,
            in_attached_footprint: false,
            on_floor_extension: false,
            catwalk_bounds: None,
            attach_wall: "south".into(),
            in_passage: false,
        });
        assert!((output.min_x - (-19.65)).abs() < 0.001);
        assert!((output.max_x - 19.65).abs() < 0.001);
    }
}
