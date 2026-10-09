# Reef Hop — throwaway movement prototype

[Play Reef Hop](https://jaxsbr.github.io/reef-hop-prototype/) — desktop browser. GitHub Actions verifies and deploys pushes to `main`.

Art direction: [ART_STYLE.md](ART_STYLE.md). Jaco approved the rounded glossy 3D fish set and Clear turquoise reef scene reference. [Project agent instructions](AGENTS.md) require these references for future art generation. [Approved sheets, manifests, and previews](assets/README.md) live in `assets/fish/`. All four selected fish now use their approved swimming/blink sheets. Scenery and hazards still use prototype graphics.

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

Seagrass scrolls at the same speed as drifting rubbish; distant seabed patches, clouds, and bubbles scroll at slower speeds for depth. A moving surface wave and subtle fish body animation reinforce swimming forward. Air hazards are flapping gulls. Water hazards are discarded bottles and sharks with visible fins, tails, gills, and eyes. Floating rocks are no longer spawned. Birds, sharks, and bottles are original Phaser vector drawings; Kenney art remains for decorative background fish, bubbles and seagrass.

Player swimming uses a gentle 9-pixel vertical arc with a matching 4-degree tilt and slight forward sway. Lane changes tween an independent lane position so the swim motion continues smoothly through transitions. All four fish retain this motion with actual frame animation and fixed proportions, replacing the old rapid squash. The scrolling-scenery recording is `captures/reef-hop-scrolling-playtest.mp4` (recorded before the added swimming arc).

## Reusable animation

Every fish uses six swimming frames. An occasional blink replaces only the second and third poses with matching halfway/fully closed eyes from its own eight-frame sheet. Each cycle runs at 130 ms per frame; independent blink waits default to a random 3–6.5 seconds and start at a cycle boundary. These are implementation timing choices. Per-fish bounds determine a stable visible-center origin and uniform scale, preserving distinct silhouettes.

The renderer-independent scheduler accepts configurable base frames, named replacement maps, timed or external triggers and priorities. It supports future actions such as bites without changing the scene's animation logic. The synthetic bite fixture adds no shark art or gameplay. [Architecture, lifecycle, sizing and verification](docs/animation.md) describe the interface and defaults.

Run `npm test` for scheduler/asset checks and `npm run build` for production validation. The [browser smoke script](scripts/browser-smoke.mjs) checks real rendering, lane changes, jumps, collision, fish selection and restart; see the animation documentation for its Playwright setup. Actual-scale captures are under `captures/animation/`.

All-four-fish integration passed 27 tests, the production build and Chrome smoke verification on 2026-10-08. Each fish showed all eight frames and two automatic blink cycles, with no browser errors. All four passed the same movement, collision and restart checks. The production build retains Vite's large-bundle warning.

## Current playtest revision

The screen contains only the game name, four fish choices, distance score, and Up/Down/Restart controls. The unexplained seabed ovals were removed. Speed increases continuously with distance (`165 + distance * 0.7` pixels/second), and spawn intervals shorten to preserve obstacle spacing. Air jumps follow a 780ms parabolic arc with orientation changing through takeoff and landing. Clouds use layered, irregular puff shapes with varied size and spacing; grass uses four Kenney variants with varied spacing, height and mirroring. Sound is original Web Audio synthesis: quiet ocean wash and tonal ambience, splash noise, bird calls, impact, and a descending loss phrase. Audio starts on the first movement interaction. Old recordings document earlier versions.

## Distant underwater layers (2026-10-07)

A muted rear reef layer contains tall, curved seagrass up to 315 pixels high and wide branching coral silhouettes. It drifts at 13–20% of foreground speed with gentle swaying. A second layer above it contains twelve smaller, tinted fish with individual arc sizes, rhythms, and back-and-forth paths; it scrolls at 34% of foreground speed. Both layers sit behind foreground grass, hazards, and the player, and are purely decorative without collision. Plant and coral shapes are original Phaser drawings; background fish reuse the credited Kenney sprites. Production build and browser playtest passed without browser errors.

Water lane boundaries now blend through soft depth gradients instead of straight divider lines. The water fill is clipped to the same animated wave path as its surface highlight, so the air/water boundary follows the curve precisely. Lane positions and controls remain the same. Build and browser verification passed.

## Trash and pacing revision (2026-10-08)

Trash now varies between bottles, drinks cans, plastic bags, takeaway cups and discarded boots, all original Phaser drawings. Trash gently bobs and rotates; nearby pieces react to the passing player with faster, stronger motion that decays over about 1.4 seconds. Collision follows the moving piece. Global speed growth changed from 0.7 to 0.16 pixels/second per metre, retaining initial speed and fish controls. The scrolling foreground seabed now has a thin irregular sand edge, grains and small embedded stones. Build passed and browser smoke check showed no errors.

## Animated shark (2026-10-09)

Sharks use the transparent glossy 3D artwork. The renderer fixes the head and body to one registered pose and gives the rear body/tail a continuous 1.1-second stroke. Mouth alternatives affect only the jaw region, blending through closed, slightly open, half-open and open artwork. This fixes the head drift and uneven tail jumps in the original full-cell playback.

An approaching shark opens within 260 horizontal pixels and 125 vertical pixels of the player. Opening and closing each take 260ms, without resetting the swim clock. Swimming continues with the jaw held open until the shark is 80 pixels behind the fish, even if the fish changes lanes. Collision limits and movement speeds are unchanged. Animation freezes on loss; per-shark canvas textures are released on removal and restart. `scripts/shark-motion-smoke.mjs` verifies head registration, mouth-only changes, continuous tail motion and a complete gameplay pass; `captures/shark/motion-report.json` holds the measurements.
