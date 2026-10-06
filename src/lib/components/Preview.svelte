<script lang="ts">
	import { renderer, webglAvailable } from '#lib/render.ts';
	import { initial, portrait } from '#lib/state.svelte.ts';
	import { MIN_ZOOM } from '#lib/scene.ts';
	import { t } from '#lib/i18n.svelte.ts';

	const SIZE = 640;
	const webgl = webglAvailable();
	let canvas: HTMLCanvasElement;
	let busy = $state(true);
	let error = $state('');
	let attempt = $state(0);

	const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

	// Figure changes need a rebuild, view and style changes only a redraw
	$effect(() => {
		const figure = $state.snapshot(portrait.figure);
		void attempt;
		if (!webgl) return;
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

	// One pointer turns the figure, two (touch) pinch to zoom
	const pointers = new Map<number, { x: number; y: number }>();
	let pinch = 0;
	const spread = () => {
		const [a, b] = [...pointers.values()];
		return Math.hypot(a.x - b.x, a.y - b.y);
	};

	function down(e: PointerEvent) {
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		canvas.setPointerCapture(e.pointerId);
		if (pointers.size === 2) pinch = spread();
	}
	function move(e: PointerEvent) {
		const last = pointers.get(e.pointerId);
		if (!last) return;
		const v = portrait.view;
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (pointers.size === 2) {
			const now = spread();
			if (pinch > 0) v.zoom = clamp((v.zoom * now) / pinch, MIN_ZOOM, 2);
			pinch = now;
		} else if (pointers.size === 1) {
			v.yaw = clamp(v.yaw + (e.clientX - last.x) * 0.4, -70, 70);
			v.pitch = clamp(v.pitch + (e.clientY - last.y) * 0.3, -25, 35);
		}
	}
	function up(e: PointerEvent) {
		pointers.delete(e.pointerId);
		pinch = 0;
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
		aria-label={t('preview')}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
		onwheel={wheel}
		onkeydown={keys}
		ondblclick={() => (portrait.view = { ...initial.view })}
	></canvas>
	{#if !webgl}
		<p class="notice" role="alert">{t('noWebgl')}</p>
	{:else if busy}
		<span class="spinner" aria-label="Loading"></span>
	{/if}
	{#if error}
		<p class="error" role="alert">
			<span>{t('partsFailed', { error })}</span>
			<button type="button" onclick={() => attempt++}>{t('retry')}</button>
		</p>
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
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin: 0;
		padding: 8px 8px 8px 12px;
		border-radius: 8px;
		background: var(--red);
		color: #fff;
		font-size: 0.9rem;
	}
	.error button {
		flex: none;
		height: 30px;
		padding: 0 12px;
		border: 0;
		border-radius: 6px;
		background: #fff;
		color: var(--red);
		font-weight: 700;
	}
	.notice {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		margin: 0;
		padding: 40px;
		color: #fff;
		text-align: center;
		line-height: 1.5;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
