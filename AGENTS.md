# Reef Hop

## Art direction

For art generation, asset edits, scene concepts, or art integration, read [ART_STYLE.md](ART_STYLE.md) first and inspect its approved references: `assets/references/rosie-character-3d.png` for Rosie's locked starting design and `assets/references/reef-hop-clear-turquoise.png` for the selected game world. Apply the approved rounded, glossy 3D cartoon style to every new character, hazard, environment, and effect unless Jaco explicitly changes direction.

Use the built-in ImageGen tool for raster artwork and include the approved reference images. Approved fish sheets, manifests, and combined swim/blink previews live in `assets/fish/<character>/`; references live in `assets/references/`. Read `assets/README.md` for the approved set and geometry. Jaco approved all four fish and requested removal of discarded concepts and generation intermediates. Keep this approved asset directory tidy; place future unapproved drafts outside it and remove unselected drafts when Jaco requests cleanup. Record explicit selections in the style guide before treating new artwork as approved.

## Gameplay context

The child-friendly Phaser prototype has four horizontal lanes: air and three softly blended water depths. Sunny (orange), Blue (blue), Rosie (pink), and Kiwi (green) have identical stats. Gulls occupy air; sharks and rubbish occupy water. Background fish and reef plants are decorative. Read `README.md` and `src/main.js` for current behavior before depicting or integrating assets.
