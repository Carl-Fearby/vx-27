/**
 * Attached-room consoles use outdoor-tuned screen/shelf brightness and emissive
 * scales. Point lights + high diffuse scalars blow them out — trim diffuse only;
 * screen/button emissive stays at the outdoor bake.
 */

/** Diffuse color scalar for screen C and shelf D in attached rooms. */
export const CONTROL_PANEL_ROOM_BRIGHTNESS_SCALE = 0.15;

/** Hull / extrusion shell albedo under room point lights. */
export const CONTROL_PANEL_ROOM_HULL_COLOR_SCALE = 0.48;

/** Hull emissive trim in rooms (shell accents only — not screen C / shelf D). */
export const CONTROL_PANEL_ROOM_HULL_EMISSIVE_SCALE = 0.22;

/**
 * Outdoor consoles on the sheltered arena floor (under the catwalk ring).
 * Trim diffuse + hull emissive so deck sun shadows read; screen/shelf emissive
 * stays at the outdoor bake for UI glow in shade.
 */
export const CONTROL_PANEL_SHELTERED_BRIGHTNESS_SCALE = 0.42;

/** Hull albedo under catwalk shadow (outdoor pass, world layer). */
export const CONTROL_PANEL_SHELTERED_HULL_COLOR_SCALE = 0.72;

/** Hull emissive under catwalk shadow. */
export const CONTROL_PANEL_SHELTERED_HULL_EMISSIVE_SCALE = 0.35;
