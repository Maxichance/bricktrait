<script lang="ts">
	import { asset } from '$app/paths';
	import { library, STANDARD_LEGS, type Color, type Part } from '#lib/ldraw.ts';
	import { MIN_ZOOM } from '#lib/scene.ts';
	import { renderer } from '#lib/render.ts';
	import { fromHash, initial, portrait, randomize, toHash } from '#lib/state.svelte.ts';
	import { history as timeline, redo, track, undo } from '#lib/history.svelte.ts';
	import Preview from '#lib/components/Preview.svelte';
	import PartPicker from '#lib/components/PartPicker.svelte';
	import Slot from '#lib/components/Slot.svelte';
	import Swatches from '#lib/components/Swatches.svelte';

	type SlotId = 'headgear' | 'head' | 'torso' | 'legs';
	// Top to bottom, like the figure
	const SLOTS: { id: SlotId; label: string; key: string }[] = [
		{ id: 'headgear', label: 'Headgear', key: '1' },
		{ id: 'head', label: 'Head', key: '2' },
		{ id: 'torso', label: 'Torso', key: '3' },
		{ id: 'legs', label: 'Legs', key: '4' }
	];
	const BACKGROUNDS = [
		{ id: 'space', label: 'Space' },
		{ id: 'solid', label: 'Solid' },
		{ id: 'none', label: 'Transparent' }
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
		torso: of('torso'),
		legs: [STANDARD, ...of('legs')]
	});
	const find = (id: string | null) =>
		id === STANDARD_LEGS ? STANDARD : catalog.find((p) => p.id === id);
	const colorOf = (code: number) => colors.find((c) => c.code === code);
	const torso = $derived(find(portrait.figure.torso.id));

	$effect(() => {
		const shared = fromHash(location.hash);
		if (shared) Object.assign(portrait, shared);
		library
			.init()
			.then(() => {
				catalog = library.catalog;
				colors = library.colors;
				ready = true;
			})
			.catch((e: Error) => (failed = e.message));
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
		if (slot === 'head' && find(id)?.neck !== undefined) portrait.figure.headgear.id = null;
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

<svelte:head>
	<title>bricktrait · minifig portrait maker</title>
	<meta
		name="description"
		content="Build a minifig profile picture from thousands of real parts, in the style of the 2005 game portraits. Free, in your browser."
	/>
</svelte:head>

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
		<a class="btn quiet" href="https://github.com/Maxichance/bricktrait">GitHub</a>
	</nav>
</header>

<main>
	<section class="stage" aria-label="Portrait">
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
			<span class="spacer"></span>
			<button type="button" class="btn" onclick={() => randomize(catalog)} disabled={!ready}>
				Random
			</button>
			<button type="button" class="btn" onclick={share}>{copied ? 'Copied' : 'Share'}</button>
		</div>

		<div class="scene">
			<h2 class="label">Camera</h2>
			{#each [{ k: 'yaw', label: 'Turn', min: -70, max: 70, step: 1, unit: '°' }, { k: 'pitch', label: 'Tilt', min: -25, max: 35, step: 1, unit: '°' }, { k: 'zoom', label: 'Zoom', min: MIN_ZOOM, max: 2, step: 0.01, unit: '×' }] as const as r (r.k)}
				<label class="range">
					<span>{r.label}</span>
					<input
						type="range"
						min={r.min}
						max={r.max}
						step={r.step}
						bind:value={portrait.view[r.k]}
					/>
					<span class="mono val"
						>{r.k === 'zoom'
							? portrait.view.zoom.toFixed(2)
							: Math.round(portrait.view[r.k])}{r.unit}</span
					>
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
		</div>
	</section>

	<section class="editor" aria-label="Figure">
		<div class="slots">
			{#each SLOTS as s (s.id)}
				{@const f = portrait.figure[s.id]}
				<Slot
					label={s.label}
					id={f.id}
					name={find(f.id)?.name ?? f.id ?? ''}
					color={colorOf(f.color)}
					active={active === s.id}
					onselect={() => (active = s.id)}
					onremove={() => remove(s.id)}
				/>
			{/each}
		</div>

		<div class="panel">
			{#if failed}
				<p class="error" role="alert">Could not load the parts: {failed}</p>
			{:else if !ready}
				<p class="muted">Loading the parts library…</p>
			{:else}
				{@const f = portrait.figure[active]}
				<div class="colors">
					{#if active === 'torso'}
						{@const t = portrait.figure.torso}
						<Swatches label="Torso" value={t.color} {colors} onchange={(c) => (t.color = c)} />
						{#if !torso?.arms}
							<Swatches label="Arms" value={t.arms} {colors} onchange={(c) => (t.arms = c)} />
							<Swatches label="Hands" value={t.hands} {colors} onchange={(c) => (t.hands = c)} />
						{/if}
					{:else if active === 'legs'}
						{@const l = portrait.figure.legs}
						{#if l.id === STANDARD_LEGS}
							<Swatches label="Hips" value={l.hips} {colors} onchange={(c) => (l.hips = c)} />
						{/if}
						<Swatches label="Legs" value={l.color} {colors} onchange={(c) => (l.color = c)} />
					{:else}
						<Swatches
							label={active === 'head' ? 'Skin' : 'Colour'}
							value={f.color}
							{colors}
							onchange={(c) => (f.color = c)}
						/>
					{/if}
				</div>
				{#if active === 'legs'}
					<p class="hint">Legs show when you zoom out.</p>
				{/if}
				{#key active}
					<PartPicker
						parts={lists[active]}
						selected={f.id}
						color={f.color}
						onpick={(id) => pick(active, id)}
					/>
				{/key}
			{/if}
		</div>

		<p class="keys">
			<kbd>1</kbd>–<kbd>4</kbd> slots · <kbd>Del</kbd> remove · <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo ·
			drag the portrait to turn it
			<button type="button" class="link" onclick={startOver}>Start over</button>
		</p>
	</section>
</main>

<footer>
	<p>
		Parts from the <a href="https://www.ldraw.org">LDraw</a> library by its contributors,
		<a href="https://creativecommons.org/licenses/by/4.0/">CC BY</a> ·
		<a href={asset('ldraw/CREDITS.txt')}>credits</a>
	</p>
	<p>
		LEGO® is a trademark of the LEGO Group, which does not sponsor, authorize or endorse this site.
	</p>
</footer>

<style>
	header,
	main,
	footer {
		max-width: 1240px;
		margin: 0 auto;
		padding: 0 20px;
	}
	header {
		display: flex;
		align-items: center;
		gap: 16px;
		height: 68px;
		border-bottom: 1.5px solid var(--ink);
		margin-bottom: 20px;
	}
	.logo {
		display: flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
	}
	.brick {
		width: 34px;
		fill: var(--red);
		stroke: var(--ink);
		stroke-width: 1.5;
	}
	.word {
		font-weight: 800;
		font-size: 1.4rem;
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
		grid-template-columns: minmax(0, 440px) minmax(0, 1fr);
		gap: 28px;
		align-items: start;
	}
	.stage {
		position: sticky;
		top: 16px;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 14px;
	}
	.spacer {
		flex: 1;
	}
	select.btn {
		padding-right: 8px;
	}

	.scene {
		margin-top: 18px;
		padding-top: 14px;
		border-top: 1.5px dashed var(--line);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.scene h2 {
		margin: 6px 0 0;
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
		height: 34px;
		border: 0;
		background: var(--card);
		font-weight: 600;
		font-size: 0.88rem;
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

	.slots {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 10px;
	}
	.panel {
		margin-top: 14px;
		padding: 16px;
		background: var(--sunk);
		border-radius: var(--radius);
		min-height: 60vh;
	}
	.colors {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin-bottom: 16px;
	}
	.hint,
	.muted {
		color: var(--muted);
		font-size: 0.85rem;
		margin: -6px 0 12px;
	}
	.error {
		color: var(--red);
	}
	.keys {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		color: var(--muted);
		font-size: 0.8rem;
	}
	.link {
		margin-left: auto;
		border: 0;
		background: none;
		padding: 0;
		color: var(--ink-2);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	footer {
		margin-top: 48px;
		padding-top: 16px;
		padding-bottom: 32px;
		border-top: 1.5px solid var(--line);
		color: var(--muted);
		font-size: 0.8rem;
	}
	footer p {
		margin: 4px 0;
	}

	@media (max-width: 1080px) {
		.slots {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 820px) {
		main {
			grid-template-columns: 1fr;
		}
		.stage {
			position: static;
			max-width: 520px;
			width: 100%;
			margin: 0 auto;
		}
		.tagline,
		.tools span {
			display: none;
		}
	}
</style>
