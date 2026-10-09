# Approved Reef Hop assets

Jaco approved the rounded glossy 3D fish set for implementation: Rosie (pink), Sunny (orange), Blue (blue), and Kiwi (green). The reference style and all four unified sheets are selected artwork, not concepts.

| Fish | Appearance | Sprite sheet | Manifest | Preview |
| --- | --- | --- | --- | --- |
| Rosie | Pink oval body and rose fan fins | [Sheet](fish/rosie/rosie-swim-blink-sheet.png) | [Manifest](fish/rosie/rosie-swim-blink.json) | [Preview](fish/rosie/rosie-swim-with-blink-preview.gif) |
| Sunny | Orange compact plump body and short rounded fins | [Sheet](fish/sunny/sunny-swim-blink-sheet.png) | [Manifest](fish/sunny/sunny-swim-blink.json) | [Preview](fish/sunny/sunny-swim-with-blink-preview.gif) |
| Blue | Blue streamlined body, swept dorsal and forked tail | [Sheet](fish/blue/blue-swim-blink-sheet.png) | [Manifest](fish/blue/blue-swim-blink.json) | [Preview](fish/blue/blue-swim-with-blink-preview.gif) |
| Kiwi | Green tall body with broad leaflike fins | [Sheet](fish/kiwi/kiwi-swim-blink-sheet.png) | [Manifest](fish/kiwi/kiwi-swim-blink.json) | [Preview](fish/kiwi/kiwi-swim-with-blink-preview.gif) |

Each transparent atlas is 2560 × 768: four columns, two rows, eight 640 × 384 cells. Normal human frame order is `1,2,3,4,5,6`; blink is `1,7,8,4,5,6`. Zero-based manifests use base loop `[0,1,2,3,4,5]` and replacements `{1:6,2:7}`. Blink alternatives are identical to their base poses outside the eye, with unchanged alpha. Suggested frame duration is 130 ms; runtime trigger timing belongs in the actor registry.

Sunny, Blue and Rosie snout anchors are `(600,192)`; Kiwi uses `(580,215)` for its taller silhouette. Use per-character visible bounds/origin and a deliberate visual scale; preserve equal gameplay stats and collision rules. Individual frames can be read directly from the atlas, so duplicate exports and processing intermediates were removed.

[Approved reference images](references/README.md) retain the main Clear turquoise reef scene and original glossy 3D Rosie design. [ART_STYLE.md](../ART_STYLE.md) is the authoritative art direction; [animation documentation](../docs/animation.md) describes the reusable runtime.

`public/assets/` contains copies required for browser loading plus still-used prototype scenery/background sprites and their license. Keep those while code depends on them. Discarded variations, old separate animation sheets, source/donor frames, duplicate previews, generation scripts and draft notes were removed at Jaco's request.

All four approved sheets are now integrated through `src/animation/actors.js`, with individual visible-center origins and uniform scales. Rosie's manifest includes a measured union of opaque bounds for the same presentation calculation. Runtime copies are byte-identical to their approved sheets. Actual-scale swimming, blink, jump and loss captures are in `captures/animation/`; the smoke report records passing checks for all four fish.

## Selected gull and implemented animation

Jaco selected the classic gull on 2026-10-09 and requested replacing the prototype air bird. [Gull sheet](gull/gull-flap-blink-sheet.png), [manifest](gull/gull-flap-blink.json), and [combined flap/blink preview](gull/gull-flap-with-blink-preview.gif) implement that selected design. Native ImageGen produced the artwork using the [selected gull reference](references/gull-classic-3d.png) and approved Rosie/reef references. The transparent atlas is 2048 × 1024, four columns and two rows of 512 × 512 cells. Its six open-eye flap frames use the same blink mapping as the fish: human frames 7 and 8 replace frames 2 and 3; zero-based replacements are `{1:6,2:7}`. Registered eye donors change only RGB inside the manifest's eye ellipse; base alpha and all outside-eye pixels are identical. Padded cells contain the complete wing tips.

The runtime copy in `public/assets/` is byte-identical. A fixed body anchor keeps the air hazard's collision position stable while the wings flap. Frame duration is 100ms; each gull independently samples the existing 3–6.5-second blink interval. Loss, removal and restart dispose its scheduler. Gameplay uses the existing air lane, speed, spawn timing, bird call and collision limits. `scripts/gull-smoke.mjs` checks the real browser renderer, pixel-level blink swaps, automatic blinking during passes, and actor lifecycle; results and screenshots live in `captures/gull/`.

## Approved shark animation

[Shark atlas](shark/shark-swim-mouth-sheet.png) and [manifest](shark/shark-swim-mouth.json) contain sixteen left-facing generated poses in a 4 × 4 grid of 384 × 256 cells. Native ImageGen generated the artwork using the approved references. These raw cells have registration drift and must not be played directly. The renderer keeps body frame 0 fixed, registers mouth donors 14, 12 and 6 locally, and continuously bends the tail. The manifest's `rig` describes those anchors and timing; `SharkMouth` owns proximity and sustained mouth state. [The animation preview](shark/shark-swim-mouth-preview.gif) is captured from the actual renderer. Jaco approved this corrected animation on 2026-10-09 and requested removal of previous attempts. The atlas remains because the approved renderer requires it; superseded generation exports and comparison data were removed.
