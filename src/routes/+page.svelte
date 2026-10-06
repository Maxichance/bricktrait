<script lang="ts">
	import { asset } from '$app/paths';
	import {
		library,
		shortName,
		STANDARD_LEGS,
		STANDING,
		type Color,
		type Part,
		type Pose
	} from '#lib/ldraw.ts';
	import { MIN_ZOOM } from '#lib/scene.ts';
	import { renderer, type ImageFormat } from '#lib/render.ts';
	import { RING_PRESETS, setBackdropImage } from '#lib/compose.ts';
	import { fromHash, initial, portrait, randomize, toHash } from '#lib/state.svelte.ts';
	import { history as timeline, hold, redo, release, track, undo } from '#lib/history.svelte.ts';
	import { used } from '#lib/prefs.svelte.ts';
	import { changeLang, i18n, LANGS, pieces, t, type Lang } from '#lib/i18n.svelte.ts';
	import Preview from '#lib/components/Preview.svelte';
	import PartPicker from '#lib/components/PartPicker.svelte';
	import Slot from '#lib/components/Slot.svelte';
	import ColorBar from '#lib/components/ColorBar.svelte';

	type SlotId = 'headgear' | 'head' | 'neck' | 'back' | 'torso' | 'legs' | 'handR' | 'handL';
	// Top to bottom, like the figure
	const SLOTS: { id: SlotId; key: string }[] = [
		{ id: 'headgear', key: '1' },
		{ id: 'head', key: '2' },
		{ id: 'neck', key: '3' },
		{ id: 'back', key: '4' },
		{ id: 'torso', key: '5' },
		{ id: 'legs', key: '6' },
		{ id: 'handR', key: '7' },
		{ id: 'handL', key: '8' }
	];
	// Both hands pick from the same parts
	const catOf = (slot: SlotId) => (slot === 'handR' || slot === 'handL' ? 'hand' : slot);
	const BACKGROUNDS = ['space', 'solid', 'gradient', 'image', 'none'] as const;
	const SIZES = [256, 512, 1024, 2048] as const;
	const FORMATS = ['png', 'webp', 'jpeg'] as const;
	const JOINTS = [
		{ k: 'head', label: 'poseHead', min: -90, max: 90 },
		{ k: 'armR', label: 'poseArmR', min: -90, max: 180 },
		{ k: 'armL', label: 'poseArmL', min: -90, max: 180 },
		{ k: 'wristR', label: 'poseWristR', min: -180, max: 180 },
		{ k: 'wristL', label: 'poseWristL', min: -180, max: 180 },
		{ k: 'legR', label: 'poseLegR', min: -90, max: 90 },
		{ k: 'legL', label: 'poseLegL', min: -90, max: 90 }
	] as const;
	const PRESETS: {
		label: 'presetStand' | 'presetWave' | 'presetWalk' | 'presetSit' | 'presetCheer';
		pose: Partial<Pose>;
	}[] = [
		{ label: 'presetStand', pose: {} },
		{ label: 'presetWave', pose: { armL: 150, wristL: 20, head: 10 } },
		{ label: 'presetWalk', pose: { armR: -25, armL: 25, legR: 25, legL: -25 } },
		{ label: 'presetSit', pose: { armR: 30, armL: 30, legR: 90, legL: 90 } },
		{ label: 'presetCheer', pose: { armR: 160, armL: 160, head: 0 } }
	];
	const VIEW = [
		{ k: 'yaw', label: 'turn', min: -70, max: 70, step: 1 },
		{ k: 'pitch', label: 'tilt', min: -25, max: 35, step: 1 },
		{ k: 'zoom', label: 'zoom', min: MIN_ZOOM, max: 2, step: 0.01 }
	] as const;

	let active: SlotId = $state('head');
	let catalog: Part[] = $state([]);
	let colors: Color[] = $state([]);
	let ready = $state(false);
	let failed = $state('');
	let progress = $state(0);
	let size: number = $state(512);
	let format: ImageFormat = $state('png');
	let exportMenu: HTMLDetailsElement | undefined = $state();
	let copiedImage = $state(false);
	let copyError = $state(false);
	let copied = $state(false);
	const SETTINGS = ['camera', 'pose', 'scene'] as const;
	let settingsTab: (typeof SETTINGS)[number] = $state('camera');

	const standard = $derived<Part>({ id: STANDARD_LEGS, name: t('standardLegs'), cat: 'legs' });
	const of = (cat: string) => catalog.filter((p) => p.cat === cat);
	const lists = $derived<Record<SlotId, Part[]>>({
		headgear: of('headgear'),
		head: of('head'),
		neck: of('neck'),
		back: of('back'),
		torso: of('torso'),
		legs: [standard, ...of('legs')],
		handR: of('hand'),
		handL: of('hand')
	});
	const find = (id: string | null) =>
		id === STANDARD_LEGS ? standard : catalog.find((p) => p.id === id);
	const colorOf = (code: number) => colors.find((c) => c.code === code);
	const torso = $derived(find(portrait.figure.torso.id));

	// What the colour bar edits for the active slot
	const targets = $derived.by(() => {
		const f = portrait.figure;
		const target = (label: string, value: number, onchange: (c: number) => void) => ({
			label,
			value,
			onchange
		});
		switch (active) {
			case 'head':
				return [target(t('skin'), f.head.color, (c) => (f.head.color = c))];
			case 'torso':
				return [
					target(t('torso'), f.torso.color, (c) => (f.torso.color = c)),
					...(torso?.arms
						? []
						: [
								target(t('arms'), f.torso.arms, (c) => (f.torso.arms = c)),
								target(t('hands'), f.torso.hands, (c) => (f.torso.hands = c))
							])
				];
			case 'legs':
				return [
					...(f.legs.id === STANDARD_LEGS
						? [target(t('hips'), f.legs.hips, (c) => (f.legs.hips = c))]
						: []),
					target(t('legs'), f.legs.color, (c) => (f.legs.color = c))
				];
			default: {
				const slot = f[active];
				return [target(t('colour'), slot.color, (c) => (slot.color = c))];
			}
		}
	});

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
		document.documentElement.lang = i18n.lang;
		const shared = fromHash(location.hash);
		if (shared) Object.assign(portrait, shared);
		load();
	});

	// Keep the address bar shareable, and the undo history up to date
	$effect(() => {
		const snapshot = $state.snapshot(portrait);
		track(snapshot);
		const timer = setTimeout(
			() => history.replaceState(history.state, '', `#${toHash(snapshot)}`),
			300
		);
		return () => clearTimeout(timer);
	});

	function pick(slot: SlotId, id: string) {
		// Moulded heads (Sonic, E.T...) are complete: headgear is dropped, it can be added back
		if (slot === 'head' && find(id)?.moulded !== undefined) portrait.figure.headgear.id = null;
		portrait.figure[slot].id = id;
		used(id);
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

	const portraitImage = () =>
		renderer.image(size, $state.snapshot(portrait.view), $state.snapshot(portrait.style), format);

	async function download() {
		const blob = await portraitImage();
		if (!blob) return;
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `bricktrait-${size}.${format === 'jpeg' ? 'jpg' : format}`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
		if (exportMenu) exportMenu.open = false;
	}

	// Browsers only take PNG on the clipboard
	async function copyImage() {
		copyError = false;
		try {
			const blob = await renderer.image(
				size,
				$state.snapshot(portrait.view),
				$state.snapshot(portrait.style),
				'png'
			);
			if (!blob) throw new Error('no image');
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
			copiedImage = true;
			setTimeout(() => (copiedImage = false), 1800);
		} catch {
			copyError = true;
		}
	}

	function importImage(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		const img = new Image();
		img.onload = () => {
			setBackdropImage(img);
			// Redraw with the new picture
			portrait.style = { ...portrait.style };
		};
		img.src = URL.createObjectURL(file);
	}

	async function share() {
		await navigator.clipboard.writeText(location.href);
		copied = true;
		setTimeout(() => (copied = false), 1800);
	}

	// Dragging a slider is one undo step, however long it lasts
	let sliding = false;
	function sliderDown(e: PointerEvent) {
		if ((e.target as HTMLElement).matches?.('input[type=range]')) {
			sliding = true;
			hold();
		}
	}
	function sliderUp() {
		if (sliding) {
			sliding = false;
			release();
		}
	}

	function startOver() {
		Object.assign(portrait, structuredClone(initial));
	}
</script>

<svelte:window
	onkeydown={keydown}
	onpointerdown={sliderDown}
	onpointerup={sliderUp}
	onpointercancel={sliderUp}
/>

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
		<p class="tagline">{t('tagline')}</p>
		<nav class="tools" aria-label={t('undo')}>
			<button
				type="button"
				class="btn quiet"
				onclick={undo}
				disabled={!timeline.canUndo}
				title="{t('undo')} (Ctrl+Z)"
			>
				<svg viewBox="0 0 20 20" aria-hidden="true"
					><path d="M7 5 3 9l4 4M3.5 9H12a5 5 0 0 1 0 10h-2" /></svg
				>
				<span>{t('undo')}</span>
			</button>
			<button
				type="button"
				class="btn quiet"
				onclick={redo}
				disabled={!timeline.canRedo}
				title="{t('redo')} (Ctrl+Shift+Z)"
			>
				<svg viewBox="0 0 20 20" aria-hidden="true"
					><path d="m13 5 4 4-4 4m3.5-4H8a5 5 0 0 0 0 10h2" /></svg
				>
				<span>{t('redo')}</span>
			</button>
			<label class="lang">
				<span class="sr-only">{t('language')}</span>
				<select
					value={i18n.lang}
					onchange={(e) => changeLang((e.currentTarget as HTMLSelectElement).value as Lang)}
				>
					{#each Object.entries(LANGS) as [code, name] (code)}
						<option value={code} title={name}>{code.toUpperCase()}</option>
					{/each}
				</select>
			</label>
			<a class="btn quiet" href="https://github.com/Maxichance/bricktrait" title={t('star')}
				>★ GitHub</a
			>
		</nav>
	</header>

	<main>
		<aside class="stage" aria-label={t('camera')}>
			<div class="view">
				<Preview />
			</div>

			<div class="actions">
				<div class="export">
					<button type="button" class="btn primary" onclick={download} disabled={!ready}>
						{t('download')}
						<span class="mono">{format === 'jpeg' ? 'JPG' : format.toUpperCase()} · {size}</span>
					</button>
					<details class="menu" bind:this={exportMenu}>
						<summary class="btn" title={t('exportOptions')}>
							<span class="sr-only">{t('exportOptions')}</span>
							<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 8 5 5 5-5" /></svg>
						</summary>
						<div class="popover">
							<fieldset>
								<legend class="label">{t('size')}</legend>
								<div class="seg">
									{#each SIZES as s (s)}
										<button type="button" aria-pressed={size === s} onclick={() => (size = s)}
											>{s}</button
										>
									{/each}
								</div>
							</fieldset>
							<fieldset>
								<legend class="label">{t('format')}</legend>
								<div class="seg">
									{#each FORMATS as f (f)}
										<button type="button" aria-pressed={format === f} onclick={() => (format = f)}
											>{f === 'jpeg' ? 'JPG' : f.toUpperCase()}</button
										>
									{/each}
								</div>
							</fieldset>
							<button type="button" class="btn" onclick={copyImage} disabled={!ready}>
								{copiedImage ? t('imageCopied') : t('copyImage')}
							</button>
							{#if copyError}
								<p class="muted">{t('copyFailed')}</p>
							{/if}
						</div>
					</details>
				</div>
				<button
					type="button"
					class="btn icon"
					onclick={() => randomize(catalog)}
					disabled={!ready}
					title={t('random')}
				>
					<svg viewBox="0 0 20 20" aria-hidden="true">
						<rect x="3" y="3" width="14" height="14" rx="3" />
						<circle cx="7" cy="7" r="1.2" />
						<circle cx="10" cy="10" r="1.2" />
						<circle cx="13" cy="13" r="1.2" />
					</svg>
					<span class="sr-only">{t('random')}</span>
				</button>
				<button
					type="button"
					class="btn icon"
					onclick={share}
					title={copied ? t('copied') : t('share')}
				>
					{#if copied}
						<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8" /></svg>
					{:else}
						<svg viewBox="0 0 20 20" aria-hidden="true">
							<path
								d="M8 12a4 4 0 0 0 5.6 0l2.5-2.5a4 4 0 0 0-5.6-5.6L9.4 5M12 8a4 4 0 0 0-5.6 0L3.9 10.5a4 4 0 0 0 5.6 5.6l1.1-1.1"
							/>
						</svg>
					{/if}
					<span class="sr-only">{copied ? t('copied') : t('share')}</span>
				</button>
			</div>

			<section class="settings" aria-label="{t('camera')} · {t('scene')}">
				<div class="tabs" role="tablist">
					{#each SETTINGS as tab (tab)}
						<button
							type="button"
							role="tab"
							aria-selected={settingsTab === tab}
							onclick={() => (settingsTab = tab)}>{t(tab)}</button
						>
					{/each}
				</div>
				{#if settingsTab === 'camera'}
					<div class="ranges">
						{#each VIEW as r (r.k)}
							<label class="range">
								<span>{t(r.label)}</span>
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
					</div>
				{:else if settingsTab === 'pose'}
					<div class="presets" role="group" aria-label={t('pose')}>
						{#each PRESETS as p (p.label)}
							<button
								type="button"
								class="btn small"
								onclick={() => (portrait.figure.pose = { ...STANDING, ...p.pose })}
								>{t(p.label)}</button
							>
						{/each}
					</div>
					{#if torso?.arms}
						<p class="muted">{t('ownArms')}</p>
					{/if}
					<div class="ranges">
						{#each JOINTS as j (j.k)}
							<label class="range">
								<span>{t(j.label)}</span>
								<input
									type="range"
									min={j.min}
									max={j.max}
									step="5"
									bind:value={portrait.figure.pose[j.k]}
									disabled={!!torso?.arms && /^(arm|wrist)/.test(j.k)}
								/>
								<span class="mono val">{portrait.figure.pose[j.k]}°</span>
							</label>
						{/each}
					</div>
				{:else}
					<div class="seg wrap" role="group" aria-label={t('background')}>
						{#each BACKGROUNDS as b (b)}
							<button
								type="button"
								aria-pressed={portrait.style.background === b}
								onclick={() => (portrait.style.background = b)}
								>{t(b === 'none' ? 'transparent' : b)}</button
							>
						{/each}
					</div>
					<div class="row">
						{#if portrait.style.background === 'space'}
							<label class="color">
								<input type="color" bind:value={portrait.style.backdrop} />
								<span>{t('disc')}</span>
							</label>
						{:else if portrait.style.background === 'solid'}
							<label class="color">
								<input type="color" bind:value={portrait.style.backdrop} />
								<span>{t('fill')}</span>
							</label>
						{:else if portrait.style.background === 'gradient'}
							<label class="color">
								<input type="color" bind:value={portrait.style.backdrop} />
								<span>{t('top')}</span>
							</label>
							<label class="color">
								<input type="color" bind:value={portrait.style.backdrop2} />
								<span>{t('bottom')}</span>
							</label>
						{:else if portrait.style.background === 'image'}
							<label class="btn small upload">
								{t('importImage')}
								<input type="file" accept="image/*" onchange={importImage} />
							</label>
						{/if}
					</div>
					{#if portrait.style.background === 'image'}
						<p class="muted">{t('imageNote')}</p>
					{/if}

					<div class="row">
						<label class="check">
							<input type="checkbox" bind:checked={portrait.style.ring} />
							<span>{t('showRing')}</span>
						</label>
						{#if portrait.style.ring}
							<div class="rings" role="group" aria-label={t('ringPreset')}>
								{#each RING_PRESETS as c (c)}
									<button
										type="button"
										class="ringdot"
										style:--c={c}
										aria-label={c}
										aria-pressed={portrait.style.ringColor === c}
										onclick={() => (portrait.style.ringColor = c)}
									></button>
								{/each}
								<label class="color" title={t('ringPreset')}>
									<input type="color" bind:value={portrait.style.ringColor} />
								</label>
							</div>
						{:else}
							<div class="seg small" role="group" aria-label={t('shape')}>
								{#each ['round', 'square'] as const as sh (sh)}
									<button
										type="button"
										aria-pressed={portrait.style.shape === sh}
										onclick={() => (portrait.style.shape = sh)}>{t(sh)}</button
									>
								{/each}
							</div>
						{/if}
					</div>
					<div class="row">
						<label class="check">
							<input type="checkbox" bind:checked={portrait.style.retro} />
							<span>{t('retro')}</span>
						</label>
						<label class="check">
							<input type="checkbox" bind:checked={portrait.style.outline} />
							<span>{t('outline')}</span>
						</label>
					</div>
				{/if}
			</section>

			<footer>
				<p>
					{#each pieces('keys') as p, i (i)}
						{#if p.slot === 'slots'}<kbd>1</kbd>–<kbd>8</kbd>
						{:else if p.slot === 'del'}<kbd>Del</kbd>
						{:else if p.slot === 'undo'}<kbd>Ctrl</kbd>+<kbd>Z</kbd>
						{:else}{p.text}{/if}
					{/each}
					·
					<button type="button" class="link" onclick={startOver}>{t('startOver')}</button>
				</p>
				<p>
					{#each pieces('credits') as p, i (i)}
						{#if p.slot === 'ldraw'}<a href="https://www.ldraw.org">LDraw</a>
						{:else if p.slot === 'ccby'}<a href="https://creativecommons.org/licenses/by/4.0/"
								>CC BY</a
							>
						{:else if p.slot === 'credits'}<a href={asset('ldraw/CREDITS.txt')}
								>{t('creditsLink')}</a
							>
						{:else}{p.text}{/if}
					{/each}
				</p>
			</footer>
		</aside>

		<section class="editor" aria-label={t('head')}>
			<div class="slots">
				{#each SLOTS as s (s.id)}
					{@const f = portrait.figure[s.id]}
					<Slot
						label={t(s.id)}
						cat={catOf(s.id)}
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
						<p class="error">{t('loadFailed', { error: failed })}</p>
						<button type="button" class="btn" onclick={load}>{t('retry')}</button>
					</div>
				{:else if !ready}
					<div class="state">
						<p class="muted">{t('loading')}</p>
						<div
							class="bar"
							role="progressbar"
							aria-label={t('loading')}
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
							<p class="muted">{t('legsHint')}</p>
						{:else if active === 'handR' || active === 'handL'}
							{@const hand = portrait.figure[active]}
							<label class="spin">
								<span>{t('spin')}</span>
								<input type="range" min="-180" max="180" step="5" bind:value={hand.spin} />
								<span class="mono val">{hand.spin}°</span>
							</label>
						{/if}
						<div class="parts">
							<PartPicker
								parts={lists[active]}
								cat={catOf(active)}
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
	.lang select {
		height: 34px;
		padding: 0 6px;
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: var(--ink-2);
		font-weight: 600;
		cursor: pointer;
	}
	.lang select:hover {
		background: var(--sunk);
	}

	main {
		display: grid;
		grid-template-columns: minmax(300px, 420px) minmax(0, 1fr);
		gap: 24px;
		padding: 20px 0;
	}

	.actions {
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: center;
		gap: 8px;
		margin-top: 12px;
	}
	.actions .btn {
		justify-content: center;
		padding: 0 12px;
	}
	/* Download, with its options in a small menu on the side */
	.export {
		position: relative;
		display: flex;
		min-width: 0;
	}
	.export > .primary {
		flex: 1;
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
	}
	.export .primary .mono {
		opacity: 0.7;
		font-weight: 500;
	}
	.menu summary {
		list-style: none;
		width: 34px;
		padding: 0;
		justify-content: center;
		border-left: 0;
		border-top-left-radius: 0;
		border-bottom-left-radius: 0;
		background: var(--yellow);
		box-shadow: 3px 3px 0 var(--ink);
		cursor: pointer;
	}
	.menu summary::-webkit-details-marker {
		display: none;
	}
	.menu summary svg {
		width: 16px;
		height: 16px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.popover {
		position: absolute;
		top: calc(100% + 8px);
		left: 0;
		right: 0;
		z-index: 5;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 14px;
		background: var(--card);
		border: 1.5px solid var(--ink);
		border-radius: var(--radius);
		box-shadow: 4px 4px 0 var(--ink);
	}
	.popover fieldset {
		border: 0;
		margin: 0;
		padding: 0;
	}
	.popover legend {
		margin-bottom: 6px;
	}
	.actions .icon {
		width: 38px;
		padding: 0;
	}
	.icon svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.icon circle {
		fill: currentColor;
		stroke: none;
	}
	.settings {
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1.5px dashed var(--line);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.tabs {
		display: flex;
		gap: 18px;
		border-bottom: 1.5px solid var(--line);
		margin-bottom: 4px;
	}
	.tabs button {
		padding: 4px 0 6px;
		margin-bottom: -1.5px;
		border: 0;
		border-bottom: 2px solid transparent;
		background: none;
		color: var(--muted);
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.tabs button[aria-selected='true'] {
		color: var(--ink);
		border-bottom-color: var(--yellow);
	}
	/* One grid for the three sliders: labels of any length line up */
	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.btn.small {
		height: 30px;
		padding: 0 10px;
		font-size: 0.84rem;
	}
	.ranges input:disabled {
		opacity: 0.35;
	}
	.ranges {
		display: grid;
		grid-template-columns: max-content 1fr 52px;
		align-items: center;
		gap: 8px 12px;
		font-size: 0.9rem;
	}
	.range {
		display: contents;
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
	.seg.small button {
		height: 28px;
		padding: 0 12px;
	}
	.seg.wrap button {
		padding: 0 4px;
		font-size: 0.8rem;
	}
	.rings {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.ringdot {
		width: 22px;
		height: 22px;
		padding: 0;
		border: 4px solid var(--c);
		border-radius: 50%;
		background: #0b0b14;
	}
	.ringdot[aria-pressed='true'] {
		box-shadow:
			0 0 0 2px var(--paper),
			0 0 0 3.5px var(--ink);
	}
	.upload {
		position: relative;
		cursor: pointer;
	}
	.upload input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
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
		grid-template-columns: repeat(4, minmax(0, 1fr));
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
	.spin {
		display: grid;
		grid-template-columns: max-content 1fr 52px;
		align-items: center;
		gap: 12px;
		max-width: 520px;
		font-size: 0.9rem;
	}
	.spin input {
		accent-color: var(--ink);
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
			/* Scrolls only on short screens, without a visible bar */
			scrollbar-width: none;
		}
		.stage::-webkit-scrollbar {
			display: none;
		}
		.editor {
			min-height: 0;
		}
		.panel {
			flex: 1;
			min-height: 0;
		}
	}
	/* Phone: one column, the portrait sticks on top while the catalogue scrolls under it */
	@media (max-width: 820px) {
		.app {
			padding: 0 12px;
		}
		header {
			gap: 8px;
			height: 52px;
		}
		.tagline,
		.tools span {
			display: none;
		}
		.tools .btn {
			padding: 0 8px;
		}
		main {
			grid-template-columns: minmax(0, 1fr);
			gap: 12px;
			padding: 12px 0;
		}
		/* The aside's parts are laid out with the editor, in phone order */
		.stage {
			display: contents;
		}
		.view {
			order: 0;
			position: sticky;
			top: 0;
			z-index: 2;
			padding: 6px 0;
			background: var(--paper);
		}
		.view :global(.preview) {
			width: min(100%, 42vh);
			margin: 0 auto;
		}
		.actions {
			order: 1;
			margin-top: 0;
		}
		.editor {
			order: 2;
		}
		.settings {
			order: 3;
			margin-top: 0;
		}
		footer {
			order: 4;
		}
		.slots {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.panel {
			padding-bottom: 14px;
		}
		.row {
			gap: 8px 12px;
		}
	}
</style>
