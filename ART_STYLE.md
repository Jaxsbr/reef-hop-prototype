# Reef Hop art style

## Approved direction

Jaco approved **rounded, glossy 3D cartoon** as the main game style on 2026-10-08 (Pacific/Auckland). This applies to all future art in this project: fish, sharks, gulls, rubbish, plants, coral, sky, water, and effects.

The locked Rosie character starting point is [Rosie — approved 3D reference](assets/references/rosie-character-3d.png), copied unchanged from Rosie option 03 after Jaco's explicit selection. Inspect and attach this image to character ImageGen calls. Preserve Rosie's rounded oval pink body, rose fins and fan tail, pale belly, short snout, large glossy expressive eye, and small friendly smile. Treat the surrounding preview glow as presentation, not a required part of individual sprites.

The approved main scene reference is [Clear turquoise reef — option 01](assets/references/reef-hop-clear-turquoise.png), copied unchanged after Jaco's explicit selection on 2026-10-08. Use it for water, sky, plants, coral, gulls, sharks, rubbish, palette, lighting, and depth separation. For scene generation include both approved references; for isolated Rosie poses and animation use her character reference as the identity authority, with the scene reference available for world consistency.

## Visual rules

- Build soft, rounded, sculpted forms with polished satin-to-gloss surfaces and controlled highlights. Fins may be gently translucent with simple grooves.
- Use soft dimensional lighting, gentle shading, and readable silhouettes. Match the reference's friendly animated-film character treatment throughout the world.
- Keep colour families clear: Sunny orange, Blue blue, Rosie pink, Kiwi green. Their visual prominence should match; colour changes do not imply different abilities.
- Jaco approved distinct fish appearances while preserving each original colour: Sunny is compact and plump with short rounded fins; Blue is streamlined with a swept dorsal and forked tail; Kiwi is taller-bodied with broad leaflike fins. Share Rosie's materials and lighting while preserving these unique silhouettes. Visual size differences keep identical gameplay stats.
- Make sharks recognizable through body shape, dorsal fin, tail, gills, and face; keep threats approachable for a child. Rubbish should read as bottles, cans, bags, takeaway cups, and discarded boots.
- Separate gameplay objects from scenery with stronger colour and contrast. Background fish are smaller and muted; tall seagrass and broad branching coral recede through haze, lower contrast, and softer detail.
- Keep the horizontal side-view game composition: air above three water depths. Blend water depth colours softly and use a continuous curved wave surface. Preserve open swimming space and depth cues for parallax.
- Use varied clouds, irregular plant spacing, gentle arcs in fish poses, curved seagrass, bubbles, ripples, and splashes to suggest movement. Sand and small embedded seabed stones sit at the bottom.
- Avoid photorealism, flat cel shading, heavy cartoon outlines, painted storybook texture, floating rocks, or unrelated creatures and structures.

## Generation workflow

1. Read this guide and inspect the approved image. Use the existing asset as an additional shape reference when relevant.
2. Include the approved Rosie image in every generation call and describe its role as the material, form, lighting, and character-style reference. Include the approved Clear turquoise reef image for environment and scene art. For a scene, place Rosie within that world and extend the same style to every element.
3. Use session scratch for unapproved drafts. Store selected sprite sheets, manifests, and a combined swim/blink preview in `assets/fish/<character>/`; preserve approved reference images in `assets/references/`. Use transparent backgrounds for sprite assets and opaque backgrounds for scenes.
4. Inspect style fidelity, required subjects, silhouette readability, depth separation, frame count, and alignment. Keep the approved asset directory free of discarded variations and generation intermediates.
5. Record Jaco's explicit selection here before treating a generated scene as an approved reference. A generated concept does not authorize replacing game assets.

## Approved scene reference

The selected [Clear turquoise reef reference](assets/references/reef-hop-clear-turquoise.png) includes all four fish, sharks, rubbish, water movement, foreground plants, tall distant seagrass, branching coral, muted background fish, sky, clouds, and gulls. It is the authority for world art. Its four fish illustrate the art family; gameplay remains single-player.

Jaco selected Clear turquoise reef and locked the glossy 3D Rosie starting design. Other scene options and duplicate reference copies were removed at Jaco's request. Both approved reference images remain in `assets/references/`.

## Approved fish animations

Generate frames with a fixed right-facing side view, camera, character proportions, material, lighting, scale, and anchor. Blink alternatives change only the eye. Swimming frames use a gentle lateral tail stroke, subtle rear-body flex, and coordinated pectoral/lower-fin paddling; dorsal motion stays restrained. Loop poses should close smoothly and preserve anatomical fin attachments.

Jaco approved all four unified eight-frame sheets for implementation: Rosie, Sunny, Blue, and Kiwi. [The approved asset index](assets/README.md) lists sheets, manifests, previews, and per-character geometry. Six open-eye swimming frames use two eye-only alternatives: human frames 7 and 8 replace 2 and 3; the blink order is `1,7,8,4,5,6`. Zero-based replacement mapping is `{1:6,2:7}`. Blink alternatives must match their base poses exactly outside the eye, with unchanged alpha.

The fish keep their original orange, blue, pink, and green colour families. Approved art lives in `assets/fish/`; browser-loaded copies live in `public/assets/`. Prototype fish sprites remain available for still-used background fish. The reusable animation implementation belongs to chat `01a11a05-3e5a-7931-adb7-7187923741be`; Jaco authorized that chat to integrate Sunny, Blue, and Kiwi as well as Rosie.

Jaco requested removal of unselected concepts, superseded sheets, donor/source frame exports, draft prompts, and processing intermediates. Keep only the approved set and reference images in the project asset directory. Future generated artwork still requires an explicit selection before it becomes part of this approved set.

## Selected gull design

On 2026-10-09 Jaco selected the first, classic gull concept as the winner and explicitly requested its wing-flap/blink sprite sheet and replacement of the prototype air bird. [Classic gull reference](assets/references/gull-classic-3d.png) is the identity authority: rounded white body, glossy expressive dark eye, orange-yellow beak and orange feet, broad grey-white wings with charcoal tips. Preserve its left-facing side/three-quarter view and friendly expression. The requested sheet follows the fish layout: six open-eye movement poses and two eye-only blink alternatives replacing human frames 2 and 3. This selection authorizes generation and game integration; it does not select either of the other gull concepts.

Jaco explicitly approved the implemented animation ("looks good") and requested committing and pushing it on 2026-10-09. The approved atlas, manifest and renderer-derived flap/blink preview live in `assets/gull/`. Its browser-loaded copy is in `public/assets/`. Preserve complete wing-tip padding, registered head/body positions, the fixed body origin, and exact eye-only blink substitutions with unchanged alpha. The game uses the existing independent frame-loop scheduler, with a 600ms flap cycle and occasional blinks. Browser verification found no pixel changes outside the eye during swaps and less than one source pixel of head/eye drift across open-eye wing poses.

## Approved shark animation

On 2026-10-09 Jaco explicitly approved the corrected shark animation ("perfect") and requested keeping only this latest version. The assets in `assets/shark/` and the current renderer are the selected implementation. They follow the approved Rosie materials and reef shark silhouette. The mouth remains open across swim cycles until the player has passed.

Jaco's motion critique requires a smooth tail stroke and stable vertical registration throughout opening, open swimming and closing; only the mouth should change when switching jaw poses. The initial sixteen generated cells drifted and must not be played as whole-body frames. `shark-renderer.js` now holds one body/head plate, substitutes only registered jaw regions and continuously bends the tail on an independent clock. Preserve that fixed head anchor and mouth-only substitution boundary in future shark revisions.

Keep the required source atlas, manifest, current runtime copy and renderer-captured preview. Superseded generation attempts, duplicate generation exports, draft prompt and before-fix comparison data were discarded at Jaco's request.

## Selected trash artwork

On 2026-10-09 Jaco selected **bottle A, can A, bag B, cup A, and boot A** (called "shoe A" in the selection) and requested replacing the temporary trash art in the game. These five transparent glossy 3D images are the approved trash set: blue-capped clear bottle, coral-red drinks can, warm-cream plastic bag, tan takeaway cup with white sip lid, and olive-brown lace-up boot. Preserve their chosen designs and the approved Rosie/reef materials and lighting.

Approved originals and measured presentation geometry live in `assets/trash/`; browser-loaded copies live in `public/assets/trash/`. Use a uniform scale and center each visible object on its existing hazard container. Preserve the existing five-type random selection, bobbing, rotation, passing-player wake response, lane rules and collision limits. Unselected concepts remain outside the approved asset directory.
