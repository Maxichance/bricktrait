// Turns a portrait into pixels: owns the stage and the current figure model.
import type { Box3 } from 'three';
import { library, placements, type Figure } from './ldraw';
import { Stage, type View } from './scene';
import { compose, type Style } from './compose';

// Retro mode renders at about a third of the size and lets the upscale soften it
const RETRO_SCALE = 0.3;

export type ImageFormat = 'png' | 'webp' | 'jpeg';

class PortraitRenderer {
	private stage: Stage | null = null;
	private focus: Box3 | null = null;
	private body: Box3 | null = null;
	private key = '';
	private version = 0;

	/** Rebuilds the model if the figure changed. Resolves false if a newer call won. */
	async update(figure: Figure) {
		const key = JSON.stringify(figure);
		if (key === this.key) return true;
		const version = ++this.version;
		await library.init();
		const find = (id: string | null) => library.catalog.find((p) => p.id === id);
		const model = await library.build(
			placements(figure, find(figure.torso.id), find(figure.head.id))
		);
		if (version !== this.version) return false;
		this.stage ??= new Stage();
		this.stage.setModel(model);
		const names = [figure.head.id, figure.headgear.id].filter(Boolean).map((id) => `${id}.dat`);
		this.focus = this.stage.box(names);
		this.body = this.stage.box();
		this.key = key;
		return true;
	}

	draw(out: HTMLCanvasElement, size: number, view: View, style: Style) {
		if (!this.stage || !this.focus || !this.body) return;
		this.stage.frame(this.focus, this.body, view);
		const figure = this.stage.render(style.retro ? Math.round(size * RETRO_SCALE) : size);
		compose(out, figure, size, style);
	}

	/** The portrait as an image file. JPEG has no transparency: it gets a white background. */
	async image(size: number, view: View, style: Style, format: ImageFormat = 'png') {
		const canvas = document.createElement('canvas');
		this.draw(canvas, size, view, style);
		let out = canvas;
		if (format === 'jpeg') {
			out = document.createElement('canvas');
			out.width = out.height = size;
			const ctx = out.getContext('2d')!;
			ctx.fillStyle = '#fff';
			ctx.fillRect(0, 0, size, size);
			ctx.drawImage(canvas, 0, 0);
		}
		return new Promise<Blob | null>((r) => out.toBlob(r, `image/${format}`, 0.92));
	}
}

export const renderer = new PortraitRenderer();

/** False on browsers or machines without WebGL, where nothing can be drawn. */
export function webglAvailable() {
	try {
		const c = document.createElement('canvas');
		return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
	} catch {
		return false;
	}
}
