<div align="center">

# bricktrait

**Free minifigure avatar maker: build your minifig profile picture from 4,700+ real parts, right in the browser.**

### [▶ Open bricktrait](https://maxichance.github.io/bricktrait/)

[![Live demo](https://img.shields.io/badge/demo-maxichance.github.io%2Fbricktrait-ffcf1f?style=flat-square)](https://maxichance.github.io/bricktrait/)
[![Deploy](https://img.shields.io/github/actions/workflow/status/Maxichance/bricktrait/deploy.yml?branch=main&style=flat-square&label=deploy)](https://github.com/Maxichance/bricktrait/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/code-MIT-3d6bff?style=flat-square)](LICENSE)
[![Parts: CC BY](https://img.shields.io/badge/parts-CC%20BY%202.0%20%2F%204.0-ef9b0f?style=flat-square)](https://www.ldraw.org/legal-info)

[![SvelteKit](https://img.shields.io/badge/SvelteKit-3-ff3e00?style=flat-square&logo=svelte&logoColor=white)](https://svelte.dev/docs/kit)
[![Three.js](https://img.shields.io/badge/Three.js-r186-000?style=flat-square&logo=three.js)](https://threejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

![bricktrait, a minifigure avatar and profile picture maker](docs/screenshot.png)

If you like it, a ⭐ helps other people find it.

</div>

bricktrait is a **LEGO® minifigure avatar maker** and **pfp generator** for GitHub, Discord, Twitch or any profile picture. Pick a head, hair or a hat, a beard, a cape, a torso and legs among the real parts of the LDraw library, recolour them, and export a portrait in the style of the classic minifig character select screens.

## Features

- **4,700+ real parts** from the LDraw library and its Parts Tracker: 800 heads, 780 hair pieces, hats, helmets and masks, beards, capes, armour and backpacks, 1,870 torsos, 430 hips, legs and skirts, and 700 things to hold, all with their original prints.
- **Eight slots**: headgear, head, neck, back, torso, legs and one accessory in each hand. Pick a slot, browse its parts by name, theme or type, keep favourites, find recent ones.
- **Any colour** from the LDraw palette for skin, headgear, torso, arms, hands, hips, legs and accessories. Colours already on the figure come first, so matching is one click.
- **Pose the figure**: head, arms, wrists and legs, on every torso and every pair of legs, plus presets (wave, walk, sit, cheer). Advanced settings go further than a real minifig: raise the arms sideways, spread the legs.
- **Game portrait look**: starry background, coloured ring with its dark inner edge, hard key light and a soft, low-res "video capture" finish. Or a flat colour, a gradient, your own picture, a transparent background, a square or a sticker outline.
- **Drag to turn, scroll or pinch to zoom.** Zoom out and the portrait turns into the whole figure, legs included.
- **Export** as PNG, WebP or JPG from 256 to 2048 px, or copy the image straight to the clipboard.
- **Share links**: the whole portrait lives in the URL.
- **Works on a phone**: the portrait stays on screen while you browse the parts.
- **Keyboard friendly**: <kbd>1</kbd>–<kbd>8</kbd> for the slots, <kbd>/</kbd> to search, <kbd>Del</kbd> to remove a part, <kbd>Ctrl</kbd>+<kbd>Z</kbd> to undo.
- **Random** button for when you have no idea.
- No account, no install, no tracking: it all runs in your browser.

## How it works

Every part is a real model from the [LDraw parts library](https://library.ldraw.org), assembled with the standard minifig offsets, drawn in 3D with [three.js](https://threejs.org) right in your browser, then composited in 2D with the background, the ring and the retro filter.

## Credits and licences

- **Code**: [MIT](LICENSE) © Maxichance.
- **Parts**: the [LDraw.org Parts Library](https://library.ldraw.org) and, for the parts still in review, its [Parts Tracker](https://library.ldraw.org/tracker), by their contributors, licensed under [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) and [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The files are repackaged (blank lines removed, references lower-cased), their geometry is not modified. The build ships `CREDITS.txt` with the author and licence of every file, next to the library's `CAreadme.txt` and licence texts.
- **Colours**: `LDConfig.ldr` from the LDraw library, same licence.
- **Libraries**: [three.js](https://github.com/mrdoob/three.js) (MIT), [Svelte and SvelteKit](https://github.com/sveltejs/kit) (MIT), [fflate](https://github.com/101arrowz/fflate) (MIT).
- **Fonts**: [Archivo](https://github.com/Omnibus-Type/Archivo) and [IBM Plex Mono](https://github.com/IBM/plex), both under the SIL Open Font License, self-hosted through Fontsource.

The portrait style is a tribute to the character portraits of the mid-2000s brick video games. No asset from those games is used: everything is rendered from the LDraw models.

> LEGO® is a trademark of the LEGO Group, which does not sponsor, authorize or endorse this project. bricktrait is not affiliated with the LEGO Group, LDraw.org or any game publisher.
