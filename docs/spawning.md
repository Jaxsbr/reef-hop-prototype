# Procedural obstacle spawning

The generator replaces the fixed six-wave water sequence and alternating bird schedule with random, player-aware groups across all four lanes. Difficulty comes from the existing game speed. Generation probabilities are fixed throughout a run.

## Decisions and tuning

`src/obstacle-spawner.js` owns candidate selection and acceptance:

- Group sizes: one obstacle 40%, two 40%, three 20%, before safety filtering.
- Lane weights by distance from the player's current lane: `[6, 3, 1, 0.5]`. Lanes are selected without replacement within a group. Existing actors never change lane in response to the player.
- Birds occupy air; water selections choose sharks with probability one third and rubbish otherwise. Trash appearance, flight routes and actor animations retain their independent randomness.
- The first obstacle starts at world width + 55–125 pixels. Each following obstacle is 70–180 pixels further away. Different actor speeds can change encounter order; the safety check uses arrival times rather than group order.
- Each candidate is checked with all existing obstacles. Eight rejected groups are followed by attempts using single obstacles from another weighted candidate. If none are safe, the opportunity stays clear.
- `src/gameplay.js` shares movement, collision, speed and interval values with the live scene. The interval remains `max(0.8, 1.85 * 165 / speed)` seconds. Speed remains `165 + distance * 0.16` pixels/second.

A dedicated seeded random stream prevents decoration, blinking and sounds from consuming the obstacle generator's random choices. `scene.spawner.seed` is available for debugging. The seed reproduces candidate choices; accepted groups also depend on player input timing and the resulting scene state. Restart and fish selection create fresh generators.

## Reachable-route check

`src/spawn-route.js` exports `findRoute({ player, hazards, speed })`. It returns a witness input schedule and duration, or `null` when no safe route is found. Production spawning only needs the existence of a witness; it never moves the player automatically.

The check first completes the player's current tween or jump and reserves a further 300ms for reaction. It then searches reachable water lanes through time, using 140ms Cubic.Out lane moves plus 60ms to settle. Air is represented by a complete 780ms jump from shallow water, automatic return to shallow water, and 20ms to settle. It cannot be used as a permanent safe lane or interrupted to avoid an unsafe landing. The search continues until all hazards have passed, including any jump landing.

Hazard positions are projected using their actual speed multipliers and continuous acceleration (`speed growth = 0.16 / 20` per second). The scene adds new actors after moving existing actors, so the planner's initial positions match the next frame rather than missing an immediate advance.

Every 20ms interval uses swept horizontal and vertical bounds, avoiding missed collisions with fast hazards between sample points. These bounds include:

- Existing collision limits: 44 horizontal and 37 vertical pixels, plus a 5px safety buffer.
- The player's 3px horizontal sway, 24px forward jump excursion and 9px swimming sway/takeoff-height variation.
- The full rubbish bob/wake envelope, ±24px.
- The gull flight envelope, 97–133px vertically, covering all current flight families.
- Tween timing uncertainty of up to 40ms either side of the nominal position.

Bounds are deliberately conservative: the generator can reject a playable proposal and leave more space. A route must be reachable from the actual current state, not merely have an unoccupied lane in every group. Player choices can still lead to a collision; if they have already left no route through existing hazards, the generator adds no further obstacles.

When changing player motion, hazard flight bounds or collision rules, update the shared values/envelopes and verification together. No difficulty cap or speed ramp change is part of this implementation.

## Verification

`npm test` covers walls across four lanes, air escapes and landing traps, blocked transitions, reaction time, fast hazards crossing between samples, sharks catching up with rubbish, fresh/reproducible random streams, fixed distributions, lane bias, staggering and bounded fallback. An independent 2ms gameplay simulator checks witnesses for 600 seeded layouts across five speeds and 240 layouts during partial jumps or moves, including actual gull flight curves, rubbish wake movement and swimming sway.

For the real scene check, run Vite, then:

```sh
REEF_HOP_PLAYWRIGHT_MODULE=<path-to-playwright/index.mjs> node scripts/spawn-smoke.mjs
```

Optional `REEF_HOP_URL` and `REEF_HOP_BROWSER_CHANNEL` follow the other smoke scripts. This check requires the development server because it imports the planner modules. It drives actual Phaser clocks, tweens, actors and collisions under a manual 20ms frame clock, at starting speeds of 165, 325, 650 and 1200px/s for 30 simulated seconds each. It also checks fresh seeds after restart and an air escape through a wall of water obstacles with a complete landing. This automated route follower verifies movement feasibility; child playtesting remains the check for feel and reaction allowance.

On 2026-10-10, 108 accepted groups passed the browser check across all four lanes and all three group sizes, with no collisions or browser errors. Planning averaged 0.096ms and peaked at 0.9ms in that headless Chrome run. Whole spawn handling, including actor construction, averaged 1.48ms and peaked at 23.8ms. These measurements are local observations, not a device-independent performance guarantee. The report and actual-scale screenshot are in `captures/spawning/`.
