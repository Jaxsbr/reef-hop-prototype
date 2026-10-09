# Reef Hop — throwaway movement prototype

[Play Reef Hop](https://jaxsbr.github.io/reef-hop-prototype/) — desktop browser. GitHub Actions verifies and deploys pushes to `main`.

Art direction: [ART_STYLE.md](ART_STYLE.md). Jaco approved the rounded glossy 3D fish set and Clear turquoise reef scene reference. [Project agent instructions](AGENTS.md) require these references for future art generation. [Sheets, manifests, and previews](assets/README.md) include the four fish, animated shark, selected classic gull, and selected trash sprites. Scenery still uses prototype graphics.

A small Phaser game for trying four-lane movement and obstacle timing. Exactly one air lane and three water lanes. One Up/Down press moves one lane in 140 ms. Air lasts 850 ms before an automatic dive. Avoid approaching obstacles; distance is the score. Restart with the button or Space after a bump. No saved data.

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates a static production build in `dist/`.

## Responsive screen sizing

The game always retains its 960 × 520 landscape world (24:13 aspect ratio), including on portrait devices. The page fills the current viewport, with compact fish choices and movement controls above and below the game area. The canvas scales uniformly by `min(availableWidth / 960, availableHeight / 520)` to use the largest fitting dimensions. Unused space is black, with the canvas centered horizontally and vertically. There is no desktop width cap. Mobile safe areas and dynamic viewport height are respected.

Phaser FIT owns the canvas size; a ResizeObserver refreshes it whenever the available game area changes. Window resizing, orientation changes, and control wrapping preserve the current run and world coordinates.

With the development server running, use `REEF_HOP_URL=<local URL> npm run test:resize`. Like the existing browser smoke script, this needs Playwright; set `REEF_HOP_PLAYWRIGHT_MODULE` to a bundled `index.mjs` and optionally `REEF_HOP_BROWSER_CHANNEL=chrome` to use installed Chrome. The check covers ten sizes in both desktop and mobile touch contexts (320 × 568 through 3840 × 2160), largest fitting dimensions, landscape proportions, centering, black bars, no page overflow, visible controls, and preservation of an active run across rotation. Screenshots and measurements are saved under `captures/resizing/`.

On 2026-10-09, all 20 simulated layouts passed with no browser errors; portrait and landscape captures were visually inspected. All 30 unit tests and the production build passed. The existing Vite large-bundle warning remains. Physical device testing of browser chrome and safe-area insets is still pending.

## Art and reuse

Fish, rocks, seaweed and bubbles: Kenney, **Fish Pack 2.0**.
- Source: https://kenney.nl/assets/fish-pack
- Download: https://kenney.nl/media/pages/assets/fish-pack/07ae98c5b6-1747237960/kenney_fish-pack_2.zip
- License: CC0 1.0, https://creativecommons.org/publicdomain/zero/1.0/
- Verified 2026-10-04 against the source page and included license, retained in `public/assets/Kenney-LICENSE.txt`.

Background and warning markers are drawn in Phaser. This is an initial playtest, not a production game. The movement/timing verdict is pending the child's playtest.

## Verification

`npm run build` passed. Browser playtest confirmed sprite loading, Up button movement, brief air jump and automatic shallow return, collision/score feedback, restart, and Down arrow keyboard movement. No browser error/warning logs were reported. Child playtesting is still needed to judge difficulty and feel.

## Fish picker and recorded playtest

Choose Sunny (orange), Blue, Rosie (pink), or Kiwi (green) before swimming. All four have identical stats and collision rules; choosing another fish resets the run and animation. Each uses its approved 3D swimming/blink sheet: compact Sunny, streamlined Blue with a forked tail, oval Rosie, and taller Kiwi with broad fins. The small Kenney fish remain in the decorative background.

`captures/reef-hop-playtest.mp4` is a 15-second real browser playtest recorded from the game canvas: Rosie starts, jumps into air, returns to shallow water and reaches collision feedback. MP4 conversion uses H.264 for convenient playback. The on-page recording button also allows fresh 15-second WebM captures.

The project is a standalone Git repository on the `main` branch, published with GitHub Pages.

## Forward-swimming revision

Seagrass scrolls at the same speed as drifting rubbish; distant seabed patches, clouds, and bubbles scroll at slower speeds for depth. A moving surface wave and subtle fish body animation reinforce swimming forward. Air hazards are flapping gulls. Water hazards are discarded bottles and sharks with visible fins, tails, gills, and eyes. Floating rocks are no longer spawned. Birds and sharks originally used Phaser vector drawings and now use the glossy 3D art described below; rubbish remains drawn in Phaser. Kenney art remains for decorative background fish, bubbles and seagrass.

Player swimming uses a gentle 9-pixel vertical arc with a matching 4-degree tilt and slight forward sway. Lane changes tween an independent lane position so the swim motion continues smoothly through transitions. All four fish retain this motion with actual frame animation and fixed proportions, replacing the old rapid squash. The scrolling-scenery recording is `captures/reef-hop-scrolling-playtest.mp4` (recorded before the added swimming arc).

## Reusable animation

Every fish uses six swimming frames. An occasional blink replaces only the second and third poses with matching halfway/fully closed eyes from its own eight-frame sheet. Each cycle runs at 130 ms per frame; independent blink waits default to a random 3–6.5 seconds and start at a cycle boundary. These are implementation timing choices. Per-fish bounds determine a stable visible-center origin and uniform scale, preserving distinct silhouettes.

The renderer-independent scheduler accepts configurable base frames, named replacement maps, timed or external triggers and priorities. It supports future actions such as bites without changing the scene's animation logic. The synthetic bite fixture adds no shark art or gameplay. [Architecture, lifecycle, sizing and verification](docs/animation.md) describe the interface and defaults.

Run `npm test` for scheduler/asset checks and `npm run build` for production validation. The [browser smoke script](scripts/browser-smoke.mjs) checks real rendering, lane changes, jumps, collision, fish selection and restart; see the animation documentation for its Playwright setup. Actual-scale captures are under `captures/animation/`.

All-four-fish integration passed 27 tests, the production build and Chrome smoke verification on 2026-10-08. Each fish showed all eight frames and two automatic blink cycles, with no browser errors. All four passed the same movement, collision and restart checks. The production build retains Vite's large-bundle warning.

## Current playtest revision

The screen contains only the game name, four fish choices, distance score, and Up/Down/Restart controls. The unexplained seabed ovals were removed. Speed increases continuously with distance (`165 + distance * 0.7` pixels/second), and spawn intervals shorten to preserve obstacle spacing. Air jumps follow a 780ms parabolic arc with orientation changing through takeoff and landing. Clouds use layered, irregular puff shapes with varied size and spacing; grass uses four Kenney variants with varied spacing, height and mirroring. Sound uses original Web Audio synthesis for quiet ocean wash and tonal ambience, splash noise, impact, and a descending loss phrase. The gull uses the approved real recording described below. Audio starts on the first movement interaction. Old recordings document earlier versions.

## Procedural obstacles (2026-10-10)

Obstacle groups now use random choices across all four lanes instead of a repeating six-wave sequence. Each group proposes one, two or three obstacles with fixed probabilities (40%, 40%, 20%). The player's current lane is favoured, followed by adjacent lanes; distant lanes remain possible. Multiple obstacles occupy distinct lanes and are staggered horizontally by 70–180 pixels. Birds participate in these groups instead of spawning every second wave. Their flight, animation and call policies remain independent.

A shared route check rejects groups that would remove every reachable escape. It includes existing obstacles, acceleration, different hazard speeds, the current movement/jump, swept collision bounds, a 300ms initial reaction allowance, complete lane transitions and air jumps with automatic shallow-water landing. Unsafe proposals are retried; if necessary, a single obstacle or a clear gap replaces the group. Counts, type probabilities and lane weights do not increase with distance; the existing speed growth and spawn interval formula continue to supply progression.

Each restart has a fresh obstacle seed. [Planner details, tuning and verification](docs/spawning.md) describe the safety model. `npm test` includes route traps, stagger/count/targeting distributions and 840 generated scenarios. `scripts/spawn-smoke.mjs` checks the real Phaser scene over two simulated minutes at four starting speeds, including a complete air escape and landing; reports/captures live in `captures/spawning/`.

## Recorded gull call (2026-10-10)

Jaco selected recorded option 1: the unmodified 1.556-second `Seagull Ambient 2.wav` from [Solo Seagull Sound Effects](https://opengameart.org/content/solo-seagull-sound-effects), uploaded by Rango Mango under CC0. [Source and license metadata](assets/audio/gull-call.json) accompanies the approved WAV in `assets/audio/`; Vite bundles the file with the correct deployment base path.

Each spawned gull independently has a 50% chance of one call and a 50% chance of silence. Calling gulls choose a random point across their visible flight. There is no startup delay, shared cooldown or double call. Separate audio sources let nearby callers play their selected sounds, including overlapping recordings, so staggered spawn groups do not suppress each other's choices. The percentage is a probability per bird, not an alternating pattern or a quota for each small group.

Call choices and timing are independent of obstacle spawn timing. No new calls trigger offscreen, while idle, muted, or after a loss. The WAV loads and decodes on the first movement interaction; a call is skipped if its buffer has not loaded yet. Each call uses the shared master volume. `src/gull-calls.js` owns the per-gull schedule; its tests cover the 50/50 probability, single calls, visibility and independent opportunities for nearby birds.

## Varied gull flight (2026-10-10)

Gulls have four vertical routes: a short bob, a swoop down near the water then up and back down, a low pass that climbs and settles, and a broad descending/rising glide. Consecutive birds use different route families. Individual routes vary in amplitude, height and turning point; short bobs also vary in phase and frequency. Smooth curves and a restrained beak tilt follow the flight direction. The existing wing-flap/blink sprites remain the approved artwork.

Flight follows the bird's progress across the screen, so the route completes naturally at any game speed. Horizontal travel stays at exactly `1.28 * game speed`. The moving bird body owns the collision position, and its warning marker follows its height. Birds remain air hazards; even the low passes cannot collide with a player settled in the shallow water lane. Loss freezes flight and wing animation; removal/restart clear the actor. `scripts/gull-flight-smoke.mjs` checks the real renderer, route variety, horizontal pacing and recorded audio policy, with captures in `captures/gull-flight/`.

## Distant underwater layers (2026-10-07)

A muted rear reef layer contains tall, curved seagrass up to 315 pixels high and wide branching coral silhouettes. It drifts at 13–20% of foreground speed with gentle swaying. A second layer above it contains twelve smaller, tinted fish with individual arc sizes, rhythms, and back-and-forth paths; it scrolls at 34% of foreground speed. Both layers sit behind foreground grass, hazards, and the player, and are purely decorative without collision. Plant and coral shapes are original Phaser drawings; background fish reuse the credited Kenney sprites. Production build and browser playtest passed without browser errors.

Water lane boundaries now blend through soft depth gradients instead of straight divider lines. The water fill is clipped to the same animated wave path as its surface highlight, so the air/water boundary follows the curve precisely. Lane positions and controls remain the same. Build and browser verification passed.

## Trash and pacing revision (2026-10-08)

Trash now varies between bottles, drinks cans, plastic bags, takeaway cups and discarded boots, all original Phaser drawings. Trash gently bobs and rotates; nearby pieces react to the passing player with faster, stronger motion that decays over about 1.4 seconds. Collision follows the moving piece. Global speed growth changed from 0.7 to 0.16 pixels/second per metre, retaining initial speed and fish controls. The scrolling foreground seabed now has a thin irregular sand edge, grains and small embedded stones. Build passed and browser smoke check showed no errors.

## Animated classic gull (2026-10-09)

Jaco selected classic gull option 01 and requested its integration. Air hazards now use the glossy 3D gull's [eight-cell sheet](assets/gull/gull-flap-blink-sheet.png) and [flap/blink preview](assets/gull/gull-flap-with-blink-preview.gif). Six open-eye wing poses loop at 100ms per frame; occasional whole-cycle blink substitutions replace frames 2 and 3 with matching half/fully closed eye alternatives. Each bird owns an independent scheduler using the same frame-loop system as the fish. The fixed body anchor retains the existing air-lane movement and collision position. Blink frames differ only inside the eye region and preserve alpha exactly.

All 32 unit tests, production build and gull browser check passed. The browser rendered all eight frames, observed automatic blinks during natural gull passes, confirmed unchanged pixels outside the eye and alpha, and checked collision limits, loss freezing, removal and restart. Measured head/eye drift was under one source pixel. [Browser report](captures/gull/smoke-report.json) and open/blink screenshots live in `captures/gull/`. Vite retains the established large-bundle warning.

## Selected trash artwork (2026-10-09)

The temporary trash drawings are replaced by Jaco's selected glossy 3D sprites: bottle A, can A, bag B, cup A and boot A ("shoe A"). Their transparent originals and presentation manifest live in `assets/trash/`, with exact runtime copies in `public/assets/trash/`. Visible shapes are centered and uniformly scaled near the previous artwork's dimensions. Five-type random spawning, bobbing, rotation, passing-player wake response, lanes and collision limits remain unchanged.

All 32 existing unit tests and the production build passed. `scripts/trash-smoke.mjs` checked all five sprites in Chrome, uniform proportions, wake movement, cleanup, collision for every type and restart, with no browser errors. Its actual-scale capture and report are in `captures/trash/`. Run with `REEF_HOP_PLAYWRIGHT_MODULE` set to a bundled Playwright `index.mjs` and optionally `REEF_HOP_URL` set to the local game URL. The established Vite bundle-size warning remains.

## Animated shark (2026-10-09)

Sharks use the transparent glossy 3D artwork. The renderer fixes the head and body to one registered pose and gives the rear body/tail a continuous 1.1-second stroke. Mouth alternatives affect only the jaw region, blending through closed, slightly open, half-open and open artwork. This fixes the head drift and uneven tail jumps in the original full-cell playback.

An approaching shark opens within 260 horizontal pixels and 125 vertical pixels of the player. Opening and closing each take 260ms, without resetting the swim clock. Swimming continues with the jaw held open until the shark is 80 pixels behind the fish, even if the fish changes lanes. Collision limits and movement speeds are unchanged. Animation freezes on loss; per-shark canvas textures are released on removal and restart. `scripts/shark-motion-smoke.mjs` verifies head registration, mouth-only changes, continuous tail motion and a complete gameplay pass; `captures/shark/motion-report.json` holds the measurements.

## Rendering quality (2026-10-10)

The backing canvas now follows the fitted display size and device pixel density instead of stretching a fixed 960 × 520 bitmap. Rendering density uses up to 2× device density and is capped at 3× the logical world dimensions (2880 × 1560) to bound GPU fill-rate and framebuffer memory. Small displays retain at least the original resolution. The camera maps the backing pixels to the same 960 × 520 gameplay world; resizing and restarting preserve object sizes, collision coordinates, and controls. Approved assets and download sizes are unchanged. Existing linear texture filtering and antialiasing remain enabled. `npm run test:resize` checks physical rendering resolution and camera world dimensions alongside desktop/mobile layout and control behavior.
