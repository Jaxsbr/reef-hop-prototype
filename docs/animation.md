# Actor frame animation

Sunny, Blue, Rosie and Kiwi use their approved eight-cell sheets. Each `assets/fish/<character>/<character>-swim-blink-sheet.png` is copied unchanged to `public/assets/`. Its adjacent manifest owns the frame mapping, dimensions, anchor and bounds. All frame numbers below are zero-based. The prototype colour fish remain loaded separately for decorative background use.

## Runtime modules

- `src/animation/frame-loop.js`: renderer-independent `FrameLoop`. Supply a base loop, frame duration, named replacement maps, optional intervals and priorities. `advance(deltaMs)` returns the current frame and cycle state. `request(name)` queues an external action. `reset()` starts a fresh base cycle; `dispose()` freezes the current state permanently.
- `src/animation/actors.js`: actor registry. It imports all four art manifests and adds runtime timing, texture loading and presentation choices. A small factory shares configuration structure; manifest bounds supply each fish's origin and sizing. New sheets belong here; the scene does not contain blink rules.
- `src/animation/phaser-frame-loop.js`: binds a scheduler to a Phaser image and applies frame changes without changing its origin or scale. Each attachment creates its own scheduler; there are no timers, global Phaser animations or shared mutable actor state.

The scene loads configured sheets, attaches the selected actor's animation and advances it with the full Phaser delta. Gameplay retains its existing capped delta. Animation runs both before starting and during swimming/jumps, freezes on loss and is disposed on shutdown. Restart and fish selection create a fresh attachment. Restart also clears any previous jump and turn tilt.

## Cycle and trigger rules

The first cycle is always the base loop. Variants are selected only at subsequent cycle starts, never midway through a pose. A selected map replaces matching **base frame IDs**, rather than ordinal loop positions. The chosen variant stays fixed for one entire cycle, followed by at least one complete base cycle. Missing map entries use their base frames.

An `intervalMs: [min, max]` variant samples a uniform deadline after reset and after each selected variant's end. When that deadline passes, it becomes eligible at the next available cycle boundary. A variant with no interval runs only through `request(name)`. External requests are coalesced by name until selected. Requests do not restart the loop or move its phase; they can wait longer if another variant or the required base cycle occupies the next boundary.

Only one variant runs per cycle. Highest numeric priority wins among queued/due variants; ties use configuration order. Losing candidates remain eligible. A continuously eligible higher-priority action can delay lower-priority actions. Replacement maps never combine. A manually selected timed variant also renews its timer.

Large deltas process every crossed cycle boundary, preserving random draws and future timing relative to smaller updates. Only the final frame is rendered; skipped frames are not flashed afterward. Work scales with crossed cycles, rather than elapsed frames. Deltas must be non-negative and finite. Inject `random` returning values in `[0, 1)` for repeatable tests; fixed intervals do not consume random samples. Reset resamples deadlines but does not rewind the supplied random generator.

## Fish presentation and timing

- Base loop: `[0,1,2,3,4,5]`. Blink replacements: `{1:6,2:7}`, producing `[0,6,7,3,4,5]`.
- Frame duration: 130 ms, using the manifest suggestion; one swim cycle lasts 780 ms. Half/fully closed poses each last 130 ms.
- Blink wait: randomly 3000–6500 ms, starting at the next available cycle boundary. This timing is an implementation default, not an approved numeric target.
- Each attachment samples its own deadlines and maintains independent phase/state. All four fish have the same timing defaults, stats and collision checks.
- The gentle position arc, forward sway and tilt remain. The old rapid width/height squash is disabled for all four selected fish.

Origins use the center of the union of visible bounds, fixed for every pose. Uniform scale preserves proportions; padded cell size is not used as visible fish size. These target widths are implementation presentation choices, preserving compact Sunny, wider Blue and taller Kiwi:

| Fish | Source bounds (left, top, right, bottom) | Origin in cell pixels | Maximum visible size in game pixels |
| --- | --- | --- | --- |
| Sunny | 212, 43, 602, 307 | 407, 175 | 64 × 43.3 |
| Blue | 112, 14, 601, 299 | 356.5, 156.5 | 76 × 44.3 |
| Rosie | 116, 23, 601, 334 | 358.5, 178.5 | 70 × 44.9 |
| Kiwi | 183, 10, 582, 354 | 382.5, 182 | 64 × 55.2 |

Sunny's inclusive min/max bounds are converted to exclusive right/bottom edges. Blue's union bounds and Kiwi's visual bounds are used as provided. Rosie's manifest now includes the measured union at alpha ≥ 128, with exclusive right/bottom edges; the approved image is unchanged. All frames use the same origin/scale, so tail motion cannot move the anchor. Rosie, Sunny and Blue retain their `(600,192)` snout registration; Kiwi retains `(580,215)`. The registry records each snout's offset from the visible center, including Kiwi's distinct vertical offset. Rotation is around that visible center, while collision remains around the existing gameplay position with the same horizontal/vertical limits.

## Another action using the same interface

This synthetic fixture is tested; it adds no shark art or gameplay behavior:

```js
const shark = new FrameLoop({
  baseLoop: [20, 22, 21, 23],
  frameDurationMs: 100,
  variants: {
    bite: { replacements: { 22: 30, 21: 31 }, priority: 10 },
  },
});
shark.request('bite'); // Select at the next eligible cycle boundary.
shark.advance(400);   // Cycle: 20, 30, 31, 23; then a complete base cycle.
```

An automatic bite could instead add an `intervalMs` range. Gameplay-driven triggers call `request` when appropriate; scheduling stays independent of collision or targeting logic.

## Verification

`npm test` runs the Node test suite covering frame order, exact substitutions, return to base, deterministic random timing, mixed/large deltas, independent actors, priorities, external bite requests, reset/disposal and invalid inputs. Actor tests exercise each real registry configuration, check all four approved/runtime atlas copies and dimensions, preserve decorative fish dependencies, and verify distinct presentation geometry and snout offsets.

`npm run build` creates the production bundle. The existing Phaser bundle produces Vite's warning about chunks over 500 kB.

`scripts/browser-smoke.mjs` requires Playwright and an available browser. Start/check the preview at `http://127.0.0.1:5178/`, then run `node scripts/browser-smoke.mjs`. Optional environment variables:

- `REEF_HOP_PLAYWRIGHT_MODULE`: path to an available Playwright `index.mjs` if not locally installed.
- `REEF_HOP_BROWSER_CHANNEL`: installed browser channel, such as `chrome`.
- `REEF_HOP_URL`: alternative preview URL.

The smoke test observes each fish for 16 seconds at normal game speed and captures actual-scale normal/blink/jump/collision images in `captures/animation/`. For every fish it checks buttons and keyboard movement, automatic air return, scoring, the same real collision limits just outside/inside 44 horizontal and 37 vertical pixels, loss freezing and restart during a jump. Fish switching checks fresh animation state and disposal of the previous fish's queued blink; decorative background textures are checked too. It reports page errors, console errors and failing HTTP responses. Audio calls still use the unchanged synthesized implementation; listening and child playtesting remain human checks.

The saved browser result is `captures/animation/smoke-report.json`.

Verified on 2026-10-08: all 27 Node tests and the production build passed. Each fish's 16-second Chrome observation included all eight frames, two automatic blink cycles and 19 base cycles, with stable origin/scale and zero collected browser errors. All four passed movement, jump, score, collision-limit, loss, fish-switching and restart assertions. Normal/blink captures were visually inspected at game scale; each silhouette and closed eye remains readable. Vite retains its established large-bundle warning.
