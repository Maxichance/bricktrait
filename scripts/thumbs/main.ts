// Renders part thumbnails for scripts/build-thumbs.mjs, with the app's own code.
import { library, STANDARD_LEGS, type Part } from '../../src/lib/ldraw';
import { Stage } from '../../src/lib/scene';
import { drawThumb, THUMB_COLORS } from '../../src/lib/thumbs';

declare global {
	interface Window {
		/** Every part that gets a thumbnail, with its colour */
		thumbsReady: Promise<{ id: string; color: number }[]>;
		/** WebP data URLs, in order */
		renderThumbs: (items: { id: string; color: number }[]) => Promise<string[]>;
	}
}

library.base = '/ldraw/';
const stage = new Stage();

window.thumbsReady = library.init().then(() => {
	const standard: Part = { id: STANDARD_LEGS, name: 'Standard hips and legs', cat: 'legs' };
	return [...library.catalog, standard]
		.filter((p) => THUMB_COLORS[p.cat] !== undefined)
		.map((p) => ({ id: p.id, color: THUMB_COLORS[p.cat]! }));
});

window.renderThumbs = async (items) => {
	const out: string[] = [];
	for (const { id, color } of items) {
		try {
			out.push((await drawThumb(stage, id, color)).toDataURL('image/webp', 0.9));
		} catch {
			out.push('');
		}
	}
	return out;
};
