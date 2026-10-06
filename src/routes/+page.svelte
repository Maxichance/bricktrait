<script lang="ts">
	import { asset } from '$app/paths';
	import { library, shortName, STANDARD_LEGS, type Color, type Part } from '#lib/ldraw.ts';
	import { MIN_ZOOM } from '#lib/scene.ts';
	import { renderer } from '#lib/render.ts';
	import { fromHash, initial, portrait, randomize, toHash } from '#lib/state.svelte.ts';
	import { history as timeline, redo, track, undo } from '#lib/history.svelte.ts';
	import Preview from '#lib/components/Preview.svelte';
	import PartPicker from '#lib/components/PartPicker.svelte';
	import Slot from '#lib/components/Slot.svelte';
	import ColorBar from '#lib/components/ColorBar.svelte';

	type SlotId = 'headgear' | 'head' | 'neck' | 'back' | 'torso' | 'legs';
	// Top to bottom, like the figure
	const SLOTS: { id: SlotId; label: string; key: string }[] = [
		{ id: 'headgear', label: 'Headgear', key: '1' },
		{ id: 'head', label: 'Head', key: '2' },
		{ id: 'neck', label: 'Neck', key: '3' },
		{ id: 'back', label: 'Back', key: '4' },
		{ id: 'torso', label: 'Torso', key: '5' },
		{ id: 'legs', label: 'Legs', key: '6' }
	];
	const BACKGROUNDS = [
		{ id: 'space', label: 'Space' },
		{ id: 'solid', label: 'Solid' },
		{ id: 'none', label: 'Transparent' }
	] as const;
	const VIEW = [
		{ k: 'yaw', label: 'Turn', min: -70, max: 70, step: 1 },
		{ k: 'pitch', label: 'Tilt', min: -25, max: 35, step: 1 },
		{ k: 'zoom', label: 'Zoom', min: MIN_ZOOM, max: 2, step: 0.01 }
	] as const;
	const STANDARD: Part = { id: STANDARD_LEGS, name: 'Standard hips and legs', cat: 'legs' };

	let active: SlotId = $state('head');
	let catalog: Part[] = $state([]);
	let colors: Color[] = $state([]);
	let ready = $state(false);
	let failed = $state('');
	let size = $state(512);
	let copied = $state(false);

	const of = (cat: string) => catalog.filter((p) => p.cat === cat);
	const lists = $derived<Record<SlotId, Part[]>>({
		headgear: of('headgear'),
		head: of('head'),
		neck: of('neck'),
		back: of('back'),
		torso: of('torso'),
		legs: [STANDARD, ...of('legs')]
	});
	const find = (id: string | null) =>
		id === STANDARD_LEGS ? STANDARD : catalog.find((p) => p.id === id);
	const colorOf = (code: number) => colors.find((c) => c.code === code);
	const torso = $derived(find(portrait.figure.torso.id));

	// What the colour bar edits for the active slot
	const targets = $derived.by(() => {
		const f = portrait.figure;
		const t = (label: string, value: number, onchange: (c: number) => void) => ({
			label,
			value,
			onchange
		});
		switch (active) {
			case 'head':
				return [t('Skin', f.head.color, (c) => (f.head.color = c))];
			case 'torso':
				return [
					t('Torso', f.torso.color, (c) => (f.torso.color = c)),
					...(torso?.arms
						? []
						: [
								t('Arms', f.torso.arms, (c) => (f.torso.arms = c)),
								t('Hands', f.torso.hands, (c) => (f.torso.hands = c))
							])
				];
			case 'legs':
				return [
					...(f.legs.id === STANDARD_LEGS
						? [t('Hips', f.legs.hips, (c) => (f.legs.hips = c))]
						: []),
					t('Legs', f.legs.color, (c) => (f.legs.color = c))
				];
			default: {
				const slot = f[active];
				return [t('Colour', slot.color, (c) => (slot.color = c))];
			}
		}
	});

	let progress = $state(0);

	function load() {
		failed = '';
		library.onprogress = (done, total) => (progress = done / total);
		library
			.init()
			.then(() => {
				catalog = library.catalog;
				colors = library.colors;
				ready = true;
			})
			.catch((e: Error) => (failed = e.message));
	}

	$effect(() => {
		const shared = fromHash(location.hash);
		if (shared) Object.assign(portrait, shared);
		load();
	});

	// Keep the address bar shareable, and the undo history up to date
	$effect(() => {
		const snapshot = $state.snapshot(portrait);
		track(snapshot);
		const t = setTimeout(
			() => history.replaceState(history.state, '', `#${toHash(snapshot)}`),
			300
		);
		return () => clearTimeout(t);
	});

	function pick(slot: SlotId, id: string) {
		// Moulded heads (Sonic, E.T...) are complete: headgear is dropped, it can be added back
		if (slot === 'head' && find(id)?.moulded !== undefined) portrait.figure.headgear.id = null;
		portrait.figure[slot].id = id;
	}

	function remove(slot: SlotId) {
		portrait.figure[slot].id = null;
	}

	function keydown(e: KeyboardEvent) {
		const el = e.target as HTMLElement;
		const typing = el.matches('input[type=search], input[type=text], textarea, select');
		const mod = e.ctrlKey || e.metaKey;
		const key = e.key.toLowerCase();
		if (mod && key === 'z' && !typing) {
			e.preventDefault();
			if (e.shiftKey) redo();
			else undo();
		} else if (mod && key === 'y' && !typing) {
			e.preventDefault();
			redo();
		} else if (!mod && !typing && (e.key === 'Delete' || e.key === 'Backspace')) {
			e.preventDefault();
			remove(active);
		} else if (!mod && !typing && !e.altKey) {
			const slot = SLOTS.find((s) => s.key === e.key);
			if (slot) active = slot.id;
		}
	}

	async function download() {
		const blob = await renderer.png(
			size,
			$state.snapshot(portrait.view),
			$state.snapshot(portrait.style)
		);
		if (!blob) return;
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `bricktrait-${size}.png`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
	}

	async function share() {
		await navigator.clipboard.writeText(location.href);
		copied = true;
		setTimeout(() => (copied = false), 1800);
	}

	function startOver() {
		Object.assign(portrait, structuredClone(initial));
	}
</script>

<svelte:window onkeydown={keydown} />

<div class="app">
	<header>
		<a class="logo" href="./">
			<svg class="brick" viewBox="0 0 40 28" aria-hidden="true">
				<rect x="1" y="9" width="38" height="18" rx="2" />
				<rect x="6" y="3" width="10" height="7" rx="1.5" />
				<rect x="24" y="3" width="10" height="7" rx="1.5" />
			</svg>
			<span class="word">bricktrait</span>
		</a>
		<p class="tagline">Minifig portraits from real parts</p>
		<nav class="tools" aria-label="History">
			<button
				type="button"
				class="btn quiet"
				onclick={undo}
				disabled={!timeline.canUndo}
				title="Undo (Ctrl+Z)"
			>
				<svg viewBox="0 0 20 20" aria-hidden="true"
					><path d="M7 5 3 9l4 4M3.5 9H12a5 5 0 0 1 0 10h-2" /></svg
				>
				<span>Undo</span>
			</button>
			<button
				type="button"
				class="btn quiet"
				onclick={redo}
				disabled={!timeline.canRedo}
				title="Redo (Ctrl+Shift+Z)"
			>
				<svg viewBox="0 0 20 20" aria-hidden="true"
					><path d="m13 5 4 4-4 4m3.5-4H8a5 5 0 0 0 0 10h2" /></svg
				>
				<span>Redo</span>
			</button>
			<a class="btn quiet" href="https://github.com/Maxichance/bricktrait" title="Star it on GitHub"
				>★ GitHub</a
			>
		</nav>
	</header>

	<main>
		<aside class="stage" aria-label="Portrait">
			<Preview />

			<div class="actions">
				<button type="button" class="btn primary" onclick={download} disabled={!ready}>
					Download PNG
				</button>
				<label>
					<span class="sr-only">Image size</span>
					<select class="btn" bind:value={size}>
						<option value={256}>256 px</option>
						<option value={512}>512 px</option>
						<option value={1024}>1024 px</option>
					</select>
				</label>
				<button type="button" class="btn" onclick={() => randomize(catalog)} disabled={!ready}>
					Random
				</button>
				<button type="button" class="btn" onclick={share}>{copied ? 'Copied' : 'Share'}</button>
			</div>

			<section class="settings" aria-label="Camera and scene">
				<h2 class="label">Camera</h2>
				{#each VIEW as r (r.k)}
					<label class="range">
						<span>{r.label}</span>
						<input
							type="range"
							min={r.min}
							max={r.max}
							step={r.step}
							bind:value={portrait.view[r.k]}
						/>
						<span class="mono val">
							{r.k === 'zoom'
								? `${portrait.view.zoom.toFixed(2)}×`
								: `${Math.round(portrait.view[r.k])}°`}
						</span>
					</label>
				{/each}

				<h2 class="label">Scene</h2>
				<div class="seg" role="group" aria-label="Background">
					{#each BACKGROUNDS as b (b.id)}
						<button
							type="button"
							aria-pressed={portrait.style.background === b.id}
							onclick={() => (portrait.style.background = b.id)}>{b.label}</button
						>
					{/each}
				</div>
				<div class="row">
					{#if portrait.style.background !== 'none'}
						<label class="color">
							<input type="color" bind:value={portrait.style.backdrop} />
							<span>{portrait.style.background === 'space' ? 'Disc' : 'Fill'}</span>
						</label>
					{/if}
					<label class="color" class:off={!portrait.style.ring}>
						<input
							type="color"
							bind:value={portrait.style.ringColor}
							disabled={!portrait.style.ring}
						/>
						<span>Ring</span>
					</label>
					<label class="check">
						<input type="checkbox" bind:checked={portrait.style.ring} />
						<span>Show ring</span>
					</label>
					<label class="check">
						<input type="checkbox" bind:checked={portrait.style.retro} />
						<span>Retro blur</span>
					</label>
				</div>
			</section>

			<footer>
				<p>
					<kbd>1</kbd>–<kbd>6</kbd> slots · <kbd>Del</kbd> remove · <kbd>Ctrl</kbd>+<kbd>Z</kbd>
					undo · drag the portrait to turn it ·
					<button type="button" class="link" onclick={startOver}>start over</button>
				</p>
				<p>
					Parts from the <a href="https://www.ldraw.org">LDraw</a> library by its contributors,
					<a href="https://creativecommons.org/licenses/by/4.0/">CC BY</a> ·
					<a href={asset('ldraw/CREDITS.txt')}>credits</a>. LEGO® is a trademark of the LEGO Group,
					which does not sponsor, authorize or endorse this site.
				</p>
			</footer>
		</aside>

		<section class="editor" aria-label="Figure">
			<div class="slots">
				{#each SLOTS as s (s.id)}
					{@const f = portrait.figure[s.id]}
					<Slot
						label={s.label}
						cat={s.id}
						id={f.id}
						name={shortName(find(f.id)?.name ?? f.id ?? '')}
						fullName={find(f.id)?.name ?? ''}
						color={colorOf(f.color)}
						active={active === s.id}
						onselect={() => (active = s.id)}
						onremove={() => remove(s.id)}
					/>
				{/each}
			</div>

			<div class="panel">
				{#if failed}
					<div class="state" role="alert">
						<p class="error">Could not load the parts library ({failed}).</p>
						<button type="button" class="btn" onclick={load}>Retry</button>
					</div>
				{:else if !ready}
					<div class="state">
						<p class="muted">Loading the parts library…</p>
						<div
							class="bar"
							role="progressbar"
							aria-label="Loading"
							aria-valuemin="0"
							aria-valuemax="100"
							aria-valuenow={Math.round(progress * 100)}
						>
							<span style:width="{progress * 100}%"></span>
						</div>
					</div>
				{:else}
					{@const f = portrait.figure[active]}
					{#key active}
						<ColorBar {targets} {colors} />
						{#if active === 'legs'}
							<p class="muted">Legs show when you zoom out.</p>
						{/if}
						<div class="parts">
							<PartPicker
								parts={lists[active]}
								selected={f.id}
								color={f.color}
								onpick={(id) => pick(active, id)}
							/>
						</div>
					{/key}
				{/if}
			</div>
		</section>
	</main>
</div>

<style>
	.app {
		max-width: 1440px;
		margin: 0 auto;
		padding: 0 20px;
	}
	header {
		display: flex;
		align-items: center;
		gap: 16px;
		height: 60px;
		flex: none;
		border-bottom: 1.5px solid var(--ink);
	}
	.logo {
		display: flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
	}
	.brick {
		width: 32px;
		fill: var(--red);
		stroke: var(--ink);
		stroke-width: 1.5;
	}
	.word {
		font-weight: 800;
		font-size: 1.35rem;
		letter-spacing: -0.03em;
	}
	.tagline {
		margin: 0;
		padding-left: 16px;
		border-left: 1.5px solid var(--line);
		color: var(--ink-2);
		font-size: 0.9rem;
	}
	.tools {
		display: flex;
		gap: 2px;
		margin-left: auto;
	}
	.tools svg {
		width: 16px;
		height: 16px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.tools a {
		text-decoration: none;
	}

	main {
		display: grid;
		grid-template-columns: minmax(300px, 420px) minmax(0, 1fr);
		gap: 24px;
		padding: 20px 0;
	}

	.actions {
		display: grid;
		grid-template-columns: 1fr auto auto auto;
		gap: 8px;
		margin-top: 12px;
	}
	.actions .btn {
		justify-content: center;
		padding: 0 12px;
	}
	select.btn {
		padding-right: 8px;
	}
	.settings {
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1.5px dashed var(--line);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.settings h2 {
		margin: 4px 0 0;
	}
	.range {
		display: grid;
		grid-template-columns: 44px 1fr 52px;
		align-items: center;
		gap: 10px;
		font-size: 0.9rem;
	}
	.range input {
		accent-color: var(--ink);
	}
	.val {
		text-align: right;
		color: var(--ink-2);
	}
	.seg {
		display: flex;
		border: 1.5px solid var(--ink);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.seg button {
		flex: 1;
		height: 32px;
		border: 0;
		background: var(--card);
		font-weight: 600;
		font-size: 0.86rem;
	}
	.seg button + button {
		border-left: 1.5px solid var(--ink);
	}
	.seg button[aria-pressed='true'] {
		background: var(--ink);
		color: var(--paper);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
		font-size: 0.9rem;
	}
	.color,
	.check {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}
	.color.off {
		opacity: 0.4;
	}
	input[type='color'] {
		width: 28px;
		height: 28px;
		padding: 0;
		border: 1.5px solid var(--ink);
		border-radius: 4px;
		background: none;
		cursor: pointer;
	}
	input[type='color']::-webkit-color-swatch-wrapper {
		padding: 2px;
	}
	input[type='color']::-webkit-color-swatch {
		border: 0;
		border-radius: 2px;
	}
	.check input {
		accent-color: var(--ink);
		width: 16px;
		height: 16px;
	}

	footer {
		margin-top: 20px;
		padding-top: 12px;
		border-top: 1.5px solid var(--line);
		color: var(--muted);
		font-size: 0.76rem;
	}
	footer p {
		margin: 0 0 6px;
	}
	.link {
		border: 0;
		background: none;
		padding: 0;
		color: var(--ink-2);
		font: inherit;
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.editor {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
	}
	.slots {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 14px 16px 0;
		background: var(--sunk);
		border-radius: var(--radius);
		min-height: 60vh;
	}
	.parts {
		flex: 1;
		min-height: 0;
	}
	.muted {
		color: var(--muted);
		font-size: 0.85rem;
		margin: 0;
	}
	.error {
		color: var(--red);
		margin: 0;
	}
	.state {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		max-width: 360px;
		margin: 40px auto;
		width: 100%;
	}
	.bar {
		width: 100%;
		height: 8px;
		border: 1.5px solid var(--ink);
		border-radius: 4px;
		background: var(--card);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--yellow);
		transition: width 0.2s;
	}

	/* Desktop: an app, not a page. Header and portrait stay, the catalogue scrolls. */
	@media (min-width: 821px) {
		.app {
			display: flex;
			flex-direction: column;
			height: 100dvh;
		}
		main {
			flex: 1;
			min-height: 0;
		}
		.stage {
			min-height: 0;
			overflow-y: auto;
			scrollbar-width: thin;
			padding-right: 4px;
		}
		.editor {
			min-height: 0;
		}
		.panel {
			flex: 1;
			min-height: 0;
		}
	}
	@media (max-width: 820px) {
		main {
			grid-template-columns: 1fr;
		}
		.slots {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.stage {
			max-width: 520px;
			width: 100%;
			margin: 0 auto;
		}
		.tagline,
		.tools span {
			display: none;
		}
		.panel {
			padding-bottom: 14px;
		}
	}
</style>
