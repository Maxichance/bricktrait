// How one part thumbnail is drawn, shared by the app and scripts/build-thumbs.mjs.
// Any change here (or in scene.ts) makes the build render every thumbnail again.
import { library, standardLegs, STANDARD_LEGS } from './ldraw';
import type { Stage } from './scene';

export const THUMB_SIZE = 160;
/**
 * Bump when a change elsewhere alters how parts look (materials in ldraw.ts
 * for instance), so the pre-rendered thumbnails get rebuilt.
 */
export const THUMB_VERSION = 1;

export async function drawThumb(stage: Stage, id: string, color: number) {
	const parts = id === STANDARD_LEGS ? standardLegs(color, color) : [{ id, color }];
	stage.setModel(await library.build(parts));
	stage.fit({ yaw: -25, pitch: 12, zoom: 1 });
	const canvas = stage.render(THUMB_SIZE);
	stage.setModel(null);
	return canvas;
}
