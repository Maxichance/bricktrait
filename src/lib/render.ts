// Turns a portrait into pixels: owns the stage and the current figure model.
import type { Box3 } from 'three';
import { library, placements, type Figure } from './ldraw';
import { Stage, type View } from './scene';
import { compose, type Style } from './compose';

// Retro mode renders at about a third of the size and lets the upscale soften it
const RETRO_SCALE = 0.3;

class PortraitRenderer {
	private stage: Stage | null = null;
	private focus: Box3 | null = null;
	private key = '';
	private version = 0;

	/** Rebuilds the model if the figure changed. Resolves false if a newer call won. */
	async update(figure: Figure) {
		const key = JSON.stringify(figure);
		if (key === this.key) return true;
		const version = ++this.version;
		await library.init();
		const torso = library.catalog.find((p) => p.id === figure.torso.id);
		const model = await library.build(placements(figure, torso?.arms ?? false));
		if (version !== this.version) return false;
		this.stage ??= new Stage();
		this.stage.setModel(model);
		const names = [figure.head.id, figure.headgear.id].filter(Boolean).map((id) => `${id}.dat`);
		this.focus = this.stage.box(names);
		this.key = key;
		return true;
	}

	draw(out: HTMLCanvasElement, size: number, view: View, style: Style) {
		if (!this.stage || !this.focus) return;
		this.stage.frame(this.focus, view);
		const figure = this.stage.render(style.retro ? Math.round(size * RETRO_SCALE) : size);
		compose(out, figure, size, style);
	}

	async png(size: number, view: View, style: Style) {
		const canvas = document.createElement('canvas');
		this.draw(canvas, size, view, style);
		return new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
	}
}

export const renderer = new PortraitRenderer();
