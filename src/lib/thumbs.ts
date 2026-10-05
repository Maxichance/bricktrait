// Part thumbnails, rendered one at a time on a single offscreen stage.
import { library } from './ldraw';
import { Stage } from './scene';

const SIZE = 160;
const cache = new Map<string, Promise<string>>();
let stage: Stage | null = null;
let queue: Promise<unknown> = Promise.resolve();

/**
 * Resolves to an object URL. `wanted` is checked when the thumbnail's turn
 * comes, so items scrolled away in the meantime are skipped (and rejected).
 */
export function thumbnail(id: string, color: number, wanted: () => boolean): Promise<string> {
	const key = `${id}:${color}`;
	let url = cache.get(key);
	if (!url) {
		url = queue.then(async () => {
			if (!wanted()) throw new Error('skipped');
			stage ??= new Stage();
			stage.setModel(await library.build([{ id, color }]));
			stage.fit({ yaw: -25, pitch: 12, zoom: 1 });
			const canvas = stage.render(SIZE);
			const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r));
			stage.setModel(null);
			if (!blob) throw new Error('render failed');
			return URL.createObjectURL(blob);
		});
		queue = url.catch(() => {});
		url.catch(() => cache.delete(key));
		cache.set(key, url);
	}
	return url;
}
