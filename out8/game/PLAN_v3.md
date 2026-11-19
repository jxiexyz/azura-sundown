# PLAN v3 — visual upgrade to match the Solaris-style reference

Auditor: operator (vision). Coder: glm-5.3-flash:free. Reference: /home/ubuntu/makefun_workspace/gta6_brief/solaris_ref/*.png
Current frames: screenshots/01-cover.jpg 02-character.jpg 03-driving.jpg 04-harbor.jpg
Goal: make the four frames read as cohesive, warm, art-deco-sunset city like the reference — WITHOUT copying the reference's source (different stack; original three.js only).

Implement in this priority order. Each item names the file(s) and an acceptance check.

## P1 — Architecture: art-deco / Miami-modern towers (biggest gap)
File: game/src/world.js (building generation)
- Replace plain box towers with varied silhouettes: cylindrical/curved towers (CylinderGeometry with radial segments, radius top<bottom or stepped), stepped art-deco ziggurats, and slabs — mix 3-4 types.
- Every building gets horizontal bands of emissive windows (repeating rows via instanced quads or a canvas texture with horizontal lit-window stripes, warm amber/orange). Some windows dark for variation.
- Ground-floor storefronts: colored awning strips (red/blue/green) at street level on downtown blocks.
- Acceptance: 03-driving and 02-character show curved/stepped towers with warm lit window bands and awnings — not plain boxes.

## P2 — Street furniture + signage density
File: game/src/world.js (props)
- Add along sidewalks: rounded canopy trees (sphere cluster on trunk) mixed with palms, curved street lamps, benches, planters with shrubs, bollards/hydrant, parasols near storefronts.
- Backlit neon signs on storefronts with ORIGINAL names (e.g. "MERIDIAN CAFE", "BAYSIDE MARKET", "HOTEL AZURA", "AUTO 24H", "NOODLE BAR") — emissive colored panels, varied colors (green/magenta/cyan/amber).
- Acceptance: downtown/driving frames show populated sidewalks with props + glowing signs, not empty.

## P3 — Pedestrian clustering
File: game/src/pedestrians.js
- Spawn pedestrians in small clusters (2-4) on sidewalks, bright varied clothing, simple walk anim. Increase density on downtown/onfoot pose.
- Acceptance: 02-character shows several pedestrians in clusters on sidewalks.

## P4 — Lighting / atmosphere cohesion
Files: game/src/world.js (sky, fog, lights), game/src/postfx.js (bloom), game/src/effects.js
- Warm sunset palette: pink→orange→gold gradient sky, low sun with bloom, distance haze tinted warm, long soft shadows.
- Bloom: slightly stronger on sun + neon signs only (not wash out HUD). Keep HUD crisp.
- Road: reflective wet sheen with warm streaks under lights; keep charcoal base.
- Acceptance: all frames share one warm cohesive palette; signs/sun glow, road reflects.

## P5 — HUD refinement
Files: game/src/hud.js, game/style.css
- Add a small row of icon buttons top-right next to cash (sound / camera / save / pause glyphs drawn in CSS or canvas).
- Add control hints bottom-center (e.g. "WASD drive · SHIFT sprint · SPACE handbrake · F exit · V reload · ESC pause").
- Minimap: add district label under it + 3 small status bars. Speedometer: keep redline arc + gear + digital speed + car name.
- Keep AZURA SUNDOWN identity. Readable at 1280x720.
- Acceptance: HUD reads clean and complete in all four frames.

## P6 — Composition
File: game/src/main.js (shot poses), game/src/camera.js
- 01-cover: low chase cam down the avenue toward sunset, car lower-middle, police flanking, heli, cranes on horizon.
- 03-driving: same avenue, traffic + towers, vanishing point center.
- 02-character: over-shoulder on populated sidewalk.
- 04-harbor: cranes/containers/ship + mission objective.
- Acceptance: each frame has a clear focal point and depth.

## HARD CONSTRAINTS (coder must obey)
- Original three.js code only; do NOT copy reference source. Static files, offline, procedural assets, no network.
- Determinism: seeded RNG, no Math.random in world paths; ?shot&seed reproduces bytes; keep preserveDrawingBuffer.
- vendor/makefun-game.ts untouched; main.ts kept; `MAKEFUN_OUTPUT_DIR=out8 node main.ts` exit 0.
- Caps: game/ <=48MiB, <=993 files; index.html <=1MiB; screenshots <=256KiB, long<=1280 short>=480.
- Performance: instancing/merged geometry, limited lights, half-res post. No three/examples/jsm.
- Preserve all gameplay + exports.
- Verify each batch with `bash tools/shoot_ibx.sh` and read the JPEGs.
