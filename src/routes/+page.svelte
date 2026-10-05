<script lang="ts">
	import { asset } from '$app/paths';
	import { library, type Part } from '#lib/ldraw.ts';
	import { renderer } from '#lib/render.ts';
	import { fromHash, initial, portrait, randomize, toHash } from '#lib/state.svelte.ts';
	import Preview from '#lib/components/Preview.svelte';
	import PartPicker from '#lib/components/PartPicker.svelte';
	import Swatches from '#lib/components/Swatches.svelte';

	type Tab = 'head' | 'headgear' | 'torso' | 'style';
	const TABS: { id: Tab; label: string }[] = [
		{ id: 'head', label: 'Head' },
		{ id: 'headgear', label: 'Headgear' },
		{ id: 'torso', label: 'Torso' },
		{ id: 'style', label: 'Style' }
	];
	const BACKGROUNDS = [
		{ id: 'space', label: 'Space' },
		{ id: 'solid', label: 'Solid' },
		{ id: 'none', label: 'Transparent' }
	] as const;

	let tab: Tab = $state('head');
	let catalog: Part[] = $state([]);
	let ready = $state(false);
	let failed = $state('');
	let size = $state(512);
	let copied = $state(false);

	const of = (cat: string) => catalog.filter((p) => p.cat === cat);
	const heads = $derived(of('head'));
	const headgear = $derived(of('headgear'));
	const torsos = $derived(of('torso'));
	const torso = $derived(catalog.find((p) => p.id === portrait.figure.torso.id));

	$effect(() => {
		const shared = fromHash(location.hash);
		if (shared) Object.assign(portrait, shared);
		library
			.init()
			.then(() => {
				catalog = library.catalog;
				ready = true;
			})
			.catch((e: Error) => (failed = e.message));
	});

	// Keep the address bar shareable
	$effect(() => {
		const hash = toHash($state.snapshot(portrait));
		const t = setTimeout(() => history.replaceState(history.state, '', `#${hash}`), 300);
		return () => clearTimeout(t);
	});

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

	function reset() {
		Object.assign(portrait, structuredClone(initial));
	}
</script>

<svelte:head>
	<title>bricktrait · minifig portrait maker</title>
	<meta
		name="description"
		content="Build a minifig profile picture from thousands of real parts, in the style of the 2005 game portraits. Free, in your browser."
	/>
</svelte:head>

<header>
	<a class="logo" href="./" aria-label="bricktrait home">
		<span class="stud" aria-hidden="true"></span>bricktrait
	</a>
	<a class="gh" href="https://github.com/Maxichance/bricktrait">GitHub</a>
</header>

<main>
	<section class="stage" aria-label="Portrait">
		<Preview />
		<div class="actions">
			<button type="button" class="primary" onclick={download} disabled={!ready}>
				Download PNG
			</button>
			<label>
				<span class="sr-only">Size</span>
				<select bind:value={size}>
					<option value={256}>256 px</option>
					<option value={512}>512 px</option>
					<option value={1024}>1024 px</option>
				</select>
			</label>
			<button type="button" onclick={() => randomize(catalog)} disabled={!ready}>Random</button>
			<button type="button" onclick={share}>{copied ? 'Link copied' : 'Share link'}</button>
			<button type="button" class="ghost" onclick={reset}>Reset</button>
		</div>
		<p class="hint">Drag to turn, scroll to zoom, double click to reset the view.</p>
	</section>

	<section class="panel" aria-label="Editor">
		<div class="tabs" role="tablist">
			{#each TABS as t (t.id)}
				<button
					type="button"
					role="tab"
					id="tab-{t.id}"
					aria-selected={tab === t.id}
					aria-controls="panel"
					onclick={() => (tab = t.id)}
				>
					{t.label}
				</button>
			{/each}
		</div>

		<div class="body" role="tabpanel" id="panel" aria-labelledby="tab-{tab}">
			{#if failed}
				<p class="error" role="alert">Could not load the parts: {failed}</p>
			{:else if !ready}
				<p class="muted">Loading parts…</p>
			{:else if tab === 'head'}
				{@const f = portrait.figure.head}
				<Swatches
					label="Skin"
					value={f.color}
					colors={library.colors}
					onchange={(c) => (f.color = c)}
				/>
				<PartPicker
					parts={heads}
					selected={f.id}
					color={f.color}
					onpick={(id) => id && (f.id = id)}
				/>
			{:else if tab === 'headgear'}
				{@const f = portrait.figure.headgear}
				<Swatches
					label="Colour"
					value={f.color}
					colors={library.colors}
					onchange={(c) => (f.color = c)}
				/>
				<PartPicker
					parts={headgear}
					selected={f.id}
					color={f.color}
					none
					onpick={(id) => (f.id = id)}
				/>
			{:else if tab === 'torso'}
				{@const f = portrait.figure.torso}
				<Swatches
					label="Torso"
					value={f.color}
					colors={library.colors}
					onchange={(c) => (f.color = c)}
				/>
				{#if !torso?.arms}
					<Swatches
						label="Arms"
						value={f.arms}
						colors={library.colors}
						onchange={(c) => (f.arms = c)}
					/>
					<Swatches
						label="Hands"
						value={f.hands}
						colors={library.colors}
						onchange={(c) => (f.hands = c)}
					/>
				{/if}
				<PartPicker
					parts={torsos}
					selected={f.id}
					color={f.color}
					onpick={(id) => id && (f.id = id)}
				/>
			{:else}
				{@const s = portrait.style}
				{@const v = portrait.view}
				<div class="style">
					<fieldset>
						<legend>Background</legend>
						<div class="seg">
							{#each BACKGROUNDS as b (b.id)}
								<button
									type="button"
									aria-pressed={s.background === b.id}
									onclick={() => (s.background = b.id)}
								>
									{b.label}
								</button>
							{/each}
						</div>
					</fieldset>
					{#if s.background !== 'none'}
						<label class="row">
							<span>{s.background === 'space' ? 'Disc colour' : 'Colour'}</span>
							<input type="color" bind:value={s.backdrop} />
						</label>
					{/if}
					<label class="row">
						<span>Ring</span>
						<input type="checkbox" bind:checked={s.ring} />
					</label>
					{#if s.ring}
						<label class="row">
							<span>Ring colour</span>
							<input type="color" bind:value={s.ringColor} />
						</label>
					{/if}
					<label class="row">
						<span>Retro look <small>soft, low resolution render</small></span>
						<input type="checkbox" bind:checked={s.retro} />
					</label>
					<label class="row">
						<span>Turn <small>{Math.round(v.yaw)}°</small></span>
						<input type="range" min="-70" max="70" bind:value={v.yaw} />
					</label>
					<label class="row">
						<span>Tilt <small>{Math.round(v.pitch)}°</small></span>
						<input type="range" min="-25" max="35" bind:value={v.pitch} />
					</label>
					<label class="row">
						<span>Zoom <small>{v.zoom.toFixed(2)}×</small></span>
						<input type="range" min="0.6" max="2" step="0.01" bind:value={v.zoom} />
					</label>
				</div>
			{/if}
		</div>
	</section>
</main>

<footer>
	<p>
		Parts from the <a href="https://www.ldraw.org">LDraw</a> Parts Library by its contributors,
		licensed under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY</a>
		(<a href={asset('ldraw/CREDITS.txt')}>full credits</a>).
	</p>
	<p>
		LEGO® is a trademark of the LEGO Group, which does not sponsor, authorize or endorse this site.
	</p>
</footer>

<style>
	header,
	main,
	footer {
		max-width: 1180px;
		margin: 0 auto;
		padding: 0 16px;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 64px;
	}
	.logo {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--text);
		text-decoration: none;
		font-weight: 800;
		font-size: 1.25rem;
		letter-spacing: -0.02em;
	}
	.stud {
		width: 22px;
		height: 22px;
		border-radius: 6px;
		background:
			radial-gradient(circle, #ffe36b 0 34%, #d9a400 35% 42%, transparent 43%), var(--accent-2);
	}
	.gh {
		color: var(--muted);
		text-decoration: none;
	}
	.gh:hover {
		color: var(--text);
	}
	main {
		display: grid;
		grid-template-columns: minmax(0, 460px) minmax(0, 1fr);
		gap: 24px;
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
		margin-top: 12px;
	}
	.actions button,
	.actions select {
		background: var(--panel-2);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 8px 14px;
	}
	.actions .primary {
		background: var(--accent-2);
		border-color: var(--accent-2);
		color: #1a1500;
		font-weight: 700;
	}
	.actions .ghost {
		background: none;
		color: var(--muted);
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.hint,
	.muted {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.panel {
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		min-height: 60vh;
	}
	.tabs {
		display: flex;
		border-bottom: 1px solid var(--line);
		padding: 0 8px;
		overflow-x: auto;
	}
	.tabs button {
		background: none;
		border: 0;
		border-bottom: 2px solid transparent;
		padding: 14px 14px 12px;
		color: var(--muted);
		font-weight: 600;
	}
	.tabs button[aria-selected='true'] {
		color: var(--text);
		border-bottom-color: var(--accent-2);
	}
	.body {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.style {
		display: flex;
		flex-direction: column;
		gap: 14px;
		max-width: 420px;
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
	}
	legend {
		color: var(--muted);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-bottom: 6px;
	}
	.seg {
		display: flex;
		gap: 6px;
	}
	.seg button {
		flex: 1;
		background: var(--panel-2);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 6px 10px;
	}
	.seg button[aria-pressed='true'] {
		border-color: var(--accent-2);
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.row small {
		color: var(--muted);
		margin-left: 6px;
	}
	.row input[type='range'] {
		width: 55%;
	}
	input[type='color'] {
		width: 44px;
		height: 30px;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: none;
		padding: 2px;
	}
	.error {
		color: #ffb3c4;
	}
	footer {
		margin-top: 40px;
		padding-bottom: 32px;
		color: var(--muted);
		font-size: 0.8rem;
	}
	footer p {
		margin: 4px 0;
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
	}
</style>
