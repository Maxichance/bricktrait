<script lang="ts">
	import { renderer } from '#lib/render.ts';
	import { initial, portrait } from '#lib/state.svelte.ts';
	import { MIN_ZOOM } from '#lib/scene.ts';

	const SIZE = 640;
	let canvas: HTMLCanvasElement;
	let busy = $state(true);
	let error = $state('');

	const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

	// Figure changes need a rebuild, view and style changes only a redraw
	$effect(() => {
		const figure = $state.snapshot(portrait.figure);
		busy = true;
		renderer
			.update(figure)
			.then((current) => {
				if (!current) return;
				error = '';
				busy = false;
				draw();
			})
			.catch((e: Error) => {
				busy = false;
				error = e.message;
			});
	});

	$effect(() => {
		void [portrait.view.yaw, portrait.view.pitch, portrait.view.zoom, { ...portrait.style }];
		draw();
	});

	function draw() {
		renderer.draw(canvas, SIZE, $state.snapshot(portrait.view), $state.snapshot(portrait.style));
	}

	let drag: { x: number; y: number } | null = null;

	function down(e: PointerEvent) {
		drag = { x: e.clientX, y: e.clientY };
		canvas.setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (!drag) return;
		const v = portrait.view;
		v.yaw = clamp(v.yaw + (e.clientX - drag.x) * 0.4, -70, 70);
		v.pitch = clamp(v.pitch + (e.clientY - drag.y) * 0.3, -25, 35);
		drag = { x: e.clientX, y: e.clientY };
	}
	function wheel(e: WheelEvent) {
		e.preventDefault();
		portrait.view.zoom = clamp(portrait.view.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06), MIN_ZOOM, 2);
	}
	function keys(e: KeyboardEvent) {
		const v = portrait.view;
		const step = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -3], ArrowDown: [0, 3] }[
			e.key
		];
		if (!step) return;
		e.preventDefault();
		v.yaw = clamp(v.yaw + step[0], -70, 70);
		v.pitch = clamp(v.pitch + step[1], -25, 35);
	}
</script>

<div class="preview" class:busy>
	<canvas
		bind:this={canvas}
		width={SIZE}
		height={SIZE}
		tabindex="0"
		aria-label="Portrait preview. Drag or use the arrow keys to turn, scroll to zoom, double click to reset."
		onpointerdown={down}
		onpointermove={move}
		onpointerup={() => (drag = null)}
		onpointercancel={() => (drag = null)}
		onwheel={wheel}
		onkeydown={keys}
		ondblclick={() => (portrait.view = { ...initial.view })}
	></canvas>
	{#if busy}
		<span class="spinner" aria-label="Loading"></span>
	{/if}
	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}
</div>

<style>
	.preview {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		border-radius: var(--radius);
		overflow: hidden;
		background: #020309;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		cursor: grab;
		touch-action: none;
	}
	canvas:active {
		cursor: grabbing;
	}
	.spinner {
		position: absolute;
		top: 14px;
		right: 14px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 3px solid rgb(255 255 255 / 0.2);
		border-top-color: var(--yellow);
		animation: spin 0.8s linear infinite;
	}
	.error {
		position: absolute;
		inset: auto 12px 12px;
		margin: 0;
		padding: 8px 12px;
		border-radius: 8px;
		background: var(--red);
		color: #fff;
		font-size: 0.9rem;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
