// 2D compositing of the final picture: background, figure, ring.

export interface Style {
	/**
	 * space: stars around a glowing disc · solid: flat colour · gradient: from
	 * `backdrop` (top) to `backdrop2` · image: a picture the visitor imported · none: transparent
	 */
	background: 'space' | 'solid' | 'gradient' | 'image' | 'none';
	backdrop: string;
	backdrop2: string;
	ring: boolean;
	ringColor: string;
	/** without a ring: round or square picture */
	shape: 'round' | 'square';
	/** thick white outline around the figure, sticker style */
	outline: boolean;
	/** low resolution, softened render */
	retro: boolean;
}

export const defaultStyle: Style = {
	background: 'space',
	backdrop: '#262a72',
	backdrop2: '#0d0f2b',
	ring: true,
	ringColor: '#1f5ef5',
	shape: 'round',
	outline: false,
	retro: true
};

/** Ring colours of the classic character select screens */
export const RING_PRESETS = ['#1f5ef5', '#d6232c', '#e0a800', '#2e9e4f', '#9aa3ad', '#7b3fbf'];

// Ring geometry, relative to the picture size, measured on the game portraits
const RING_OUTER = 0.485;
const RING_WIDTH = 0.062;
// Thick black band between the blue ring and the disc
const RING_INNER_EDGE = 0.04;

// Imported backdrop: kept in memory only, it is not part of share links
let backdropImage: CanvasImageSource | null = null;
export const setBackdropImage = (image: CanvasImageSource | null) => (backdropImage = image);

export function compose(
	out: HTMLCanvasElement,
	figure: CanvasImageSource,
	size: number,
	style: Style
) {
	out.width = out.height = size;
	const ctx = out.getContext('2d')!;
	const c = size / 2;
	const round = style.ring || style.shape === 'round';
	const disc = round ? (RING_OUTER - RING_WIDTH - (style.ring ? RING_INNER_EDGE : 0)) * size : c;
	ctx.clearRect(0, 0, size, size);

	// Outside the disc: the starry sky of the space background
	if (style.background === 'space' && round) {
		ctx.fillStyle = '#020207';
		ctx.fillRect(0, 0, size, size);
		stars(ctx, size);
	}

	ctx.save();
	if (round) {
		ctx.beginPath();
		ctx.arc(c, c, disc + 1, 0, Math.PI * 2);
		ctx.clip();
	}
	backdrop(ctx, size, c, disc, style);
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';
	if (style.outline) outline(ctx, figure, size);
	// Retro: the low resolution render is upscaled, a slight blur hides the pixels
	if (style.retro) ctx.filter = `blur(${(size / 512) * 0.3}px)`;
	ctx.drawImage(figure, 0, 0, size, size);
	ctx.filter = 'none';
	ctx.restore();

	if (style.ring) ring(ctx, c, size, style.ringColor);
	if (style.retro) capture(out, ctx, size);
}

function backdrop(
	ctx: CanvasRenderingContext2D,
	size: number,
	c: number,
	disc: number,
	style: Style
) {
	switch (style.background) {
		case 'space': {
			// Lighter towards the top centre, darker at the bottom and edges
			const g = ctx.createRadialGradient(c, c - disc * 0.55, 0, c, c - disc * 0.2, disc * 1.25);
			g.addColorStop(0, shade(style.backdrop, 0.22));
			g.addColorStop(0.55, style.backdrop);
			g.addColorStop(1, shade(style.backdrop, -0.55));
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, size, size);
			stars(ctx, size, 0.3);
			break;
		}
		case 'solid':
			ctx.fillStyle = style.backdrop;
			ctx.fillRect(0, 0, size, size);
			break;
		case 'gradient': {
			const g = ctx.createLinearGradient(0, 0, 0, size);
			g.addColorStop(0, style.backdrop);
			g.addColorStop(1, style.backdrop2);
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, size, size);
			break;
		}
		case 'image':
			if (backdropImage) cover(ctx, backdropImage, size);
			else {
				ctx.fillStyle = style.backdrop;
				ctx.fillRect(0, 0, size, size);
			}
			break;
	}
}

/** Draws an image filling the square, cropped to keep its proportions */
function cover(ctx: CanvasRenderingContext2D, image: CanvasImageSource, size: number) {
	const w = (image as HTMLImageElement).naturalWidth || (image as HTMLCanvasElement).width;
	const h = (image as HTMLImageElement).naturalHeight || (image as HTMLCanvasElement).height;
	const s = Math.max(size / w, size / h);
	ctx.drawImage(image, (size - w * s) / 2, (size - h * s) / 2, w * s, h * s);
}

/** White silhouette, grown in every direction, under the figure */
function outline(ctx: CanvasRenderingContext2D, figure: CanvasImageSource, size: number) {
	const mask = document.createElement('canvas');
	mask.width = mask.height = size;
	const m = mask.getContext('2d')!;
	m.drawImage(figure, 0, 0, size, size);
	m.globalCompositeOperation = 'source-in';
	m.fillStyle = '#fff';
	m.fillRect(0, 0, size, size);
	const r = size * 0.018;
	for (let a = 0; a < 16; a++) {
		const t = (a / 16) * Math.PI * 2;
		ctx.drawImage(mask, Math.cos(t) * r, Math.sin(t) * r);
	}
}

// The reference portraits are video captures: soft all over, a little washed out
function capture(out: HTMLCanvasElement, ctx: CanvasRenderingContext2D, size: number) {
	const copy = document.createElement('canvas');
	copy.width = copy.height = size;
	copy.getContext('2d')!.drawImage(out, 0, 0);
	ctx.clearRect(0, 0, size, size);
	ctx.filter = `blur(${(size / 512) * 1.1}px) contrast(0.92) saturate(0.88) brightness(1.03)`;
	ctx.drawImage(copy, 0, 0);
	ctx.filter = 'none';
}

function ring(ctx: CanvasRenderingContext2D, c: number, size: number, color: string) {
	const outer = RING_OUTER * size;
	const w = RING_WIDTH * size;
	ctx.save();
	const edge = RING_INNER_EDGE * size;
	// Edges barely softened, a vector-perfect circle looks out of place
	ctx.filter = `blur(${(size / 512) * 0.4}px)`;
	// Black band first, slightly overlapping the disc and the ring
	ctx.lineWidth = edge + 2;
	ctx.strokeStyle = '#04040a';
	ctx.beginPath();
	ctx.arc(c, c, outer - w - edge / 2, 0, Math.PI * 2);
	ctx.stroke();
	// Flat coloured band
	ctx.lineWidth = w;
	ctx.strokeStyle = color;
	ctx.beginPath();
	ctx.arc(c, c, outer - w / 2, 0, Math.PI * 2);
	ctx.stroke();
	// Thin dark line outside
	ctx.lineWidth = Math.max(1, size * 0.005);
	ctx.strokeStyle = shade(color, -0.6);
	ctx.beginPath();
	ctx.arc(c, c, outer, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();
}

function stars(ctx: CanvasRenderingContext2D, size: number, intensity = 1) {
	// Same sky every time
	let seed = 1337;
	const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	const scale = size / 512;
	for (let i = 0; i < 140; i++) {
		const x = rand() * size;
		const y = rand() * size;
		const r = (0.3 + rand() ** 3 * 1.4) * scale;
		ctx.fillStyle = `rgba(255, 255, 255, ${(0.15 + rand() * 0.55) * intensity})`;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
	}
}

/** Lightens (amount > 0) or darkens (amount < 0) a #rrggbb colour. */
function shade(hex: string, amount: number) {
	const n = parseInt(hex.slice(1), 16);
	const mix = (v: number) =>
		Math.round(amount > 0 ? v + (255 - v) * amount : v * (1 + amount))
			.toString(16)
			.padStart(2, '0');
	return `#${mix(n >> 16)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}
