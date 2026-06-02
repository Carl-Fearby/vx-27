VX-27 Square Container Texture Pack — PBR Version

Sorry — the previous ZIP only had albedo plus emissive masks. This version includes the proper PBR support maps.

Included for each surface:
- Albedo / base colour
- Normal
- Roughness
- Metallic
- Height
- AO
- Alpha
- Emissive mask
- ORM packed map: R = AO, G = Roughness, B = Metallic

Surface set:
- side: outside side panel, use for both long sides
- inside_wall: interior wall wrap
- top_bottom: use for roof and floor
- endcap_square: square end opening surround only
- door: single door, flip for the opposite door

Lighting:
- Emissive masks are aligned to the current albedo files.
- White pixels in emissive masks are light sources.
- Recommended in-engine tint: VX-27 blue/cyan.
- Keep bloom controlled in the engine rather than baked into the base texture.

Notes:
- The endcap alpha has the central opening transparent/black.
- Runtime assets are lossy WebP (see `npm run textures:vx27-container`).
- PBR maps are generated from the current artwork and are intended as a usable game-art starting point.
