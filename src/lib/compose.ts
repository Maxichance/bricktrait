// 2D compositing of the final picture: background, figure, ring.

export interface Style {
	/** space: stars around a glowing disc, solid: flat colour, none: transparent */
	background: 'space' | 'solid' | 'none';
	/** disc colour for space, fill colour for solid */
	backdrop: string;
	ring: boolean;
	ringColor: string;
	/** low resolution, softened render */
	retro: boolean;
}

export const defaultStyle: Style = {
	background: 'space',
	backdrop: '#262a72',
	ring: true,
	ringColor: '#1f5ef5',
	retro: true
};

// Ring geometry, relative to the picture size, measured on the game portraits
const RING_OUTER = 0.485;
const RING_WIDTH = 0.062;
// Thick black band between the blue ring and the disc
const RING_INNER_EDGE = 0.04;

export function compose(
	out: HTMLCanvasElement,
	figure: CanvasImageSource,
	size: number,
	style: Style
) {
	out.width = out.height = size;
	const ctx = out.getContext('2d')!;
	const c = size / 2;
	const disc = (RING_OUTER - RING_WIDTH - (style.ring ? RING_INNER_EDGE : 0)) * size;
	const round = style.ring || style.background === 'space';
	ctx.clearRect(0, 0, size, size);

	if (style.background === 'space') {
		ctx.fillStyle = '#020207';
		ctx.fillRect(0, 0, size, size);
		stars(ctx, size);
	}

	// Disc behind the figure
	ctx.save();
	if (round) {
		ctx.beginPath();
		ctx.arc(c, c, disc + 1, 0, Math.PI * 2);
		ctx.clip();
	}
	if (style.background === 'space') {
		// Lighter towards the top centre, darker at the bottom and edges
		const g = ctx.createRadialGradient(c, c - disc * 0.55, 0, c, c - disc * 0.2, disc * 1.25);
		g.addColorStop(0, shade(style.backdrop, 0.22));
		g.addColorStop(0.55, style.backdrop);
		g.addColorStop(1, shade(style.backdrop, -0.55));
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, size, size);
		stars(ctx, size, 0.3);
	} else if (style.background === 'solid') {
		ctx.fillStyle = style.backdrop;
		ctx.fillRect(0, 0, size, size);
	}
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';
	// Retro: the low resolution render is upscaled, a slight blur hides the pixels
	if (style.retro) ctx.filter = `blur(${(size / 512) * 0.3}px)`;
	ctx.drawImage(figure, 0, 0, size, size);
	ctx.filter = 'none';
	ctx.restore();

	if (style.ring) ring(ctx, c, size, style.ringColor);
	if (style.retro) capture(out, ctx, size);
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
	// Flat blue band
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
