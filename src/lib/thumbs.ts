// Part thumbnails. Most come pre-rendered from the build (static/thumbs/, see
// scripts/build-thumbs.mjs) in each slot's default colour; other colours are
// rendered here, one at a time on a single offscreen stage.
import { library, type Category } from './ldraw';
import { Stage } from './scene';
import { drawThumb } from './thumb-render';

/** Colour of the pre-rendered thumbnails, matching the default figure */
export const THUMB_COLORS: Partial<Record<Category, number>> = {
	head: 14,
	headgear: 6,
	neck: 6,
	back: 4,
	torso: 15,
	legs: 1,
	hand: 71
};

/** Where the pre-rendered thumbnail of a part is served. */
export const staticThumb = (id: string) =>
	library.base.replace(/ldraw\/$/, '') + `thumbs/${encodeURIComponent(id)}.webp`;

const cache = new Map<string, Promise<string>>();
let stage: Stage | null = null;
let queue: Promise<unknown> = Promise.resolve();

/**
 * Live render, resolves to an object URL. `wanted` is checked when the
 * thumbnail's turn comes, so items scrolled away meanwhile are skipped (rejected).
 */
export function thumbnail(id: string, color: number, wanted: () => boolean): Promise<string> {
	const key = `${id}:${color}`;
	let url = cache.get(key);
	if (!url) {
		url = queue.then(async () => {
			if (!wanted()) throw new Error('skipped');
			stage ??= new Stage();
			const canvas = await drawThumb(stage, id, color);
			const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.9));
			if (!blob) throw new Error('render failed');
			return URL.createObjectURL(blob);
		});
		queue = url.catch(() => {});
		url.catch(() => cache.delete(key));
		cache.set(key, url);
	}
	return url;
}
