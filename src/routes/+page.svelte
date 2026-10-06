<script lang="ts">
	import { asset } from '$app/paths';
	import {
		hipsOnly,
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
	// Joints by body part, right and left side by side
	type Joint = { k: keyof Pose; label: 'right' | 'left' | 'turn'; min: number; max: number };
	const side = (r: keyof Pose, l: keyof Pose, min: number, max: number): Joint[] => [
		{ k: r, label: 'right', min, max },
		{ k: l, label: 'left', min, max }
	];
	const JOINTS: { label: 'head' | 'arms' | 'wrists' | 'legs'; joints: Joint[] }[] = [
		{ label: 'head', joints: [{ k: 'head', label: 'turn', min: -90, max: 90 }] },
		{ label: 'arms', joints: side('armR', 'armL', -90, 180) },
		{ label: 'wrists', joints: side('wristR', 'wristL', -180, 180) },
		{ label: 'legs', joints: side('legR', 'legL', -90, 90) }
	];
	// Beyond what a real minifig can do
	const ADVANCED: { label: 'poseRaise' | 'poseSpread'; joints: Joint[] }[] = [
		{ label: 'poseRaise', joints: side('raiseR', 'raiseL', -20, 160) },
		{ label: 'poseSpread', joints: side('spreadR', 'spreadL', -30, 90) }
	];
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
	let copiedImage = $state(false);
	let copyError = $state(false);
	let copied = $state(false);
	// The panel next to the portrait: what is being edited
	const MODES = ['parts', 'pose', 'camera', 'scene'] as const;
	let mode: (typeof MODES)[number] = $state('parts');

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
					...(f.legs.id === STANDARD_LEGS || hipsOnly(find(f.legs.id))
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
			if (slot) {
				active = slot.id;
				mode = 'parts';
			}
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
		closeMenus();
	}

	const closeMenus = () =>
		document.querySelectorAll<HTMLDetailsElement>('details.menu').forEach((d) => (d.open = false));

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

	// A share link pasted in the address bar of an open tab
	function openLink() {
		const shared = fromHash(location.hash);
		if (shared && toHash(shared) !== toHash($state.snapshot(portrait)))
			Object.assign(portrait, shared);
	}

	function resetView() {
		portrait.view = { ...initial.view };
	}

	function startOver() {
		Object.assign(portrait, structuredClone(initial));
	}
</script>

<svelte:window
	onkeydown={keydown}
	onhashchange={openLink}
	onpointerdown={sliderDown}
	onpointerup={sliderUp}
	onpointercancel={sliderUp}
/>

{#snippet icon(name: string)}
	<svg viewBox="0 0 20 20" aria-hidden="true">
		{#if name === 'parts'}
			<rect x="2.5" y="8" width="15" height="8.5" rx="1.5" />
			<rect x="5" y="4.5" width="4" height="3.5" rx="0.8" />
			<rect x="11" y="4.5" width="4" height="3.5" rx="0.8" />
		{:else if name === 'pose'}
			<circle cx="10" cy="4" r="2" />
			<path d="M4 8.5 10 7l6-2.5M10 7v5m0 0-3.5 5.5M10 12l3.5 5.5" />
		{:else if name === 'camera'}
			<rect x="2.5" y="6" width="15" height="10.5" rx="2" />
			<path d="M7 6l1.2-2h3.6L13 6" />
			<circle cx="10" cy="11.2" r="2.8" />
		{:else if name === 'scene'}
			<rect x="2.5" y="3.5" width="15" height="13" rx="2" />
			<circle cx="7" cy="8" r="1.6" />
			<path d="m3 15 4.5-4 3 2.5 3-3 4 3.5" />
		{:else if name === 'dice'}
			<rect x="3" y="3" width="14" height="14" rx="3" />
			<circle class="dot" cx="7" cy="7" r="1.2" />
			<circle class="dot" cx="10" cy="10" r="1.2" />
			<circle class="dot" cx="13" cy="13" r="1.2" />
		{:else if name === 'link'}
			<path
				d="M8 12a4 4 0 0 0 5.6 0l2.5-2.5a4 4 0 0 0-5.6-5.6L9.4 5M12 8a4 4 0 0 0-5.6 0L3.9 10.5a4 4 0 0 0 5.6 5.6l1.1-1.1"
			/>
		{:else if name === 'check'}
			<path d="m4 10 4 4 8-8" />
		{:else if name === 'recenter'}
			<path d="M3 7V3h4M17 7V3h-4M3 13v4h4M17 13v4h-4" />
			<circle cx="10" cy="10" r="2.5" />
		{:else if name === 'download'}
			<path d="M10 3v10m-4-4 4 4 4-4M3.5 14.5V17h13v-2.5" />
		{:else if name === 'chevron'}
			<path d="m5 8 5 5 5-5" />
		{:else if name === 'undo'}
			<path d="M7 5 3 9l4 4M3.5 9H12a5 5 0 0 1 0 10h-2" />
		{:else if name === 'redo'}
			<path d="m13 5 4 4-4 4m3.5-4H8a5 5 0 0 0 0 10h2" />
		{/if}
	</svg>
{/snippet}

{#snippet joint(j: Joint)}
	<label class="range">
		<span class="name">{t(j.label)}</span>
		<input type="range" min={j.min} max={j.max} step="5" bind:value={portrait.figure.pose[j.k]} />
		<button
			type="button"
			class="val mono"
			title={t('resetJoint')}
			disabled={!portrait.figure.pose[j.k]}
			onclick={() => (portrait.figure.pose[j.k] = 0)}>{portrait.figure.pose[j.k] ?? 0}°</button
		>
	</label>
{/snippet}

{#snippet group(g: { label: Parameters<typeof t>[0]; joints: Joint[] })}
	<fieldset class="group">
		<legend class="label">{t(g.label)}</legend>
		<div class="ranges">
			{#each g.joints as j (j.k)}
				{@render joint(j)}
			{/each}
		</div>
	</fieldset>
{/snippet}

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
				{@render icon('undo')}
				<span class="text">{t('undo')}</span>
			</button>
			<button
				type="button"
				class="btn quiet"
				onclick={redo}
				disabled={!timeline.canRedo}
				title="{t('redo')} (Ctrl+Shift+Z)"
			>
				{@render icon('redo')}
				<span class="text">{t('redo')}</span>
			</button>
			<span class="sep" aria-hidden="true"></span>
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
				>★<span class="text">GitHub</span></a
			>
		</nav>
	</header>

	<main>
		<section class="stage" aria-label={t('preview')}>
			<div class="view">
				<Preview />
				<div class="float">
					<button
						type="button"
						class="chip"
						onclick={() => randomize(catalog)}
						disabled={!ready}
						title={t('random')}
					>
						{@render icon('dice')}<span class="sr-only">{t('random')}</span>
					</button>
					<button
						type="button"
						class="chip"
						onclick={share}
						title={copied ? t('copied') : t('share')}
					>
						{@render icon(copied ? 'check' : 'link')}
						<span class="sr-only">{copied ? t('copied') : t('share')}</span>
					</button>
					<button type="button" class="chip" onclick={resetView} title={t('resetView')}>
						{@render icon('recenter')}<span class="sr-only">{t('resetView')}</span>
					</button>
				</div>
			</div>

			<div class="export">
				<button type="button" class="btn primary" onclick={download} disabled={!ready}>
					{@render icon('download')}
					<span class="text">{t('download')}</span>
					<span class="mono fmt">{format === 'jpeg' ? 'JPG' : format.toUpperCase()} · {size}</span>
				</button>
				<details class="menu">
					<summary class="btn primary" title={t('exportOptions')}>
						<span class="sr-only">{t('exportOptions')}</span>
						{@render icon('chevron')}
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
		</section>

		<section class="panel">
			<div class="modes" role="tablist" aria-label={t('editing')}>
				{#each MODES as m (m)}
					<button type="button" role="tab" aria-selected={mode === m} onclick={() => (mode = m)}>
						{@render icon(m)}<span>{t(m)}</span>
					</button>
				{/each}
			</div>

			<div class="body" class:parts={mode === 'parts'} role="tabpanel">
				{#if mode === 'parts'}
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
								shortcut={s.key}
								onselect={() => (active = s.id)}
								onremove={() => remove(s.id)}
							/>
						{/each}
					</div>

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
						{@const part = find(f.id)}
						{#key active}
							<div class="current">
								<span class="label">{t(active)}</span>
								{#if f.id}
									<strong title={part?.name}>{shortName(part?.name ?? f.id)}</strong>
									<span class="mono id">{f.id}</span>
								{:else}
									<strong class="none">{t('empty')}</strong>
								{/if}
								{#if active === 'legs'}
									<span class="muted hint">{t('legsHint')}</span>
								{/if}
							</div>
							<div class="colors">
								<ColorBar {targets} {colors} />
								{#if active === 'handR' || active === 'handL'}
									{@const hand = portrait.figure[active]}
									<label class="range spin">
										<span class="name">{t('spin')}</span>
										<input type="range" min="-180" max="180" step="5" bind:value={hand.spin} />
										<span class="mono val">{hand.spin}°</span>
									</label>
								{/if}
							</div>
							<div class="catalogue">
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
				{:else if mode === 'pose'}
					<div class="presets" role="group" aria-label={t('pose')}>
						{#each PRESETS as p (p.label)}
							<button
								type="button"
								class="preset"
								onclick={() => (portrait.figure.pose = { ...STANDING, ...p.pose })}
								>{t(p.label)}</button
							>
						{/each}
					</div>
					<div class="groups">
						{#each JOINTS as g (g.label)}
							{@render group(g)}
						{/each}
					</div>
					<details class="advanced">
						<summary>
							<span class="title">{t('poseAdvanced')}</span>
							<span class="muted">{t('poseAdvancedHint')}</span>
						</summary>
						<div class="groups">
							{#each ADVANCED as g (g.label)}
								{@render group(g)}
							{/each}
						</div>
					</details>
				{:else if mode === 'camera'}
					<fieldset class="group">
						<legend class="label">{t('camera')}</legend>
						<div class="ranges">
							{#each VIEW as r (r.k)}
								<label class="range">
									<span class="name">{t(r.label)}</span>
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
					</fieldset>
					<div class="row">
						<button type="button" class="btn" onclick={resetView}>
							{@render icon('recenter')}{t('resetView')}
						</button>
						<p class="muted">{t('cameraHint')}</p>
					</div>
				{:else}
					<fieldset class="group">
						<legend class="label">{t('background')}</legend>
						<div class="seg" role="group" aria-label={t('background')}>
							{#each BACKGROUNDS as b (b)}
								<button
									type="button"
									aria-pressed={portrait.style.background === b}
									onclick={() => (portrait.style.background = b)}
									>{t(b === 'none' ? 'transparent' : b)}</button
								>
							{/each}
						</div>
						{#if portrait.style.background !== 'none'}
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
									<label class="btn upload">
										{t('importImage')}
										<input type="file" accept="image/*" onchange={importImage} />
									</label>
									<p class="muted">{t('imageNote')}</p>
								{/if}
							</div>
						{/if}
					</fieldset>

					<fieldset class="group">
						<legend class="label">{t('ring')}</legend>
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
					</fieldset>

					<fieldset class="group">
						<legend class="label">{t('rendering')}</legend>
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
					</fieldset>
				{/if}
			</div>
		</section>

		<footer>
			<p class="keys">
				{#each pieces('keys') as p, i (i)}
					{#if p.slot === 'slots'}<kbd>1</kbd>–<kbd>8</kbd>
					{:else if p.slot === 'del'}<kbd>Del</kbd>
					{:else if p.slot === 'undo'}<kbd>Ctrl</kbd>+<kbd>Z</kbd>
					{:else}{p.text}{/if}
				{/each}
			</p>
			<p>
				<button type="button" class="link" onclick={startOver}>{t('startOver')}</button>
				·
				{#each pieces('credits') as p, i (i)}
					{#if p.slot === 'ldraw'}<a href="https://www.ldraw.org">LDraw</a>
					{:else if p.slot === 'ccby'}<a href="https://creativecommons.org/licenses/by/4.0/"
							>CC BY</a
						>
					{:else if p.slot === 'credits'}<a href={asset('ldraw/CREDITS.txt')}>{t('creditsLink')}</a>
					{:else}{p.text}{/if}
				{/each}
			</p>
		</footer>
	</main>
</div>

<style>
	.app {
		--header: 58px;
		max-width: 1680px;
		margin: 0 auto;
		padding: 0 24px;
	}

	/* --- header ---------------------------------------------------------- */
	header {
		display: flex;
		align-items: center;
		gap: 16px;
		height: var(--header);
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
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}
	.tools {
		display: flex;
		align-items: center;
		gap: 2px;
		margin-left: auto;
	}
	.tools a {
		text-decoration: none;
	}
	.sep {
		width: 1.5px;
		height: 20px;
		margin: 0 6px;
		background: var(--line);
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

	svg {
		width: 18px;
		height: 18px;
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.7;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	svg .dot {
		fill: currentColor;
		stroke: none;
	}

	/* --- stage: the portrait and how to get it out ---------------------- */
	main {
		display: grid;
		gap: 16px;
		padding: 16px 0;
	}
	.view {
		position: relative;
	}
	.float {
		position: absolute;
		top: 10px;
		right: 10px;
		display: flex;
		gap: 6px;
	}
	.chip {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		padding: 0;
		border: 1px solid rgb(255 255 255 / 0.18);
		border-radius: 50%;
		background: rgb(10 10 20 / 0.55);
		color: #fff;
		backdrop-filter: blur(6px);
		transition: background 0.12s;
	}
	.chip:hover:not(:disabled) {
		background: rgb(10 10 20 / 0.85);
	}
	.chip:disabled {
		opacity: 0.4;
	}
	.export {
		position: relative;
		display: flex;
		margin-top: 12px;
	}
	.export > .primary {
		flex: 1;
		justify-content: center;
		height: 46px;
		font-size: 1.02rem;
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
	}
	.fmt {
		opacity: 0.65;
		font-weight: 500;
	}
	.menu summary {
		list-style: none;
		width: 44px;
		height: 46px;
		padding: 0;
		justify-content: center;
		border-left: 0;
		border-top-left-radius: 0;
		border-bottom-left-radius: 0;
		cursor: pointer;
	}
	.menu summary::-webkit-details-marker {
		display: none;
	}
	.menu[open] summary svg {
		rotate: 180deg;
	}
	.popover {
		position: absolute;
		bottom: calc(100% + 10px);
		left: 0;
		right: 0;
		z-index: 10;
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
	.popover .btn {
		justify-content: center;
	}

	/* --- panel: what is being edited ------------------------------------ */
	.panel {
		display: flex;
		flex-direction: column;
		min-width: 0;
		background: var(--card);
		border: 1.5px solid var(--ink);
		border-radius: 10px;
		container-type: inline-size;
	}
	.modes {
		display: flex;
		padding: 0 8px;
		border-bottom: 1.5px solid var(--ink);
		background: var(--card);
		border-radius: 10px 10px 0 0;
	}
	.modes button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		flex: 1;
		height: 50px;
		margin-bottom: -1.5px;
		border: 0;
		border-bottom: 3px solid transparent;
		background: none;
		color: var(--muted);
		font-weight: 700;
		font-size: 0.92rem;
		transition: color 0.12s;
	}
	.modes button:hover {
		color: var(--ink);
	}
	.modes button[aria-selected='true'] {
		color: var(--ink);
		border-bottom-color: var(--yellow);
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 18px 20px 20px;
		min-height: 0;
	}

	/* Parts: slots strip, what is selected, colours, then the catalogue */
	.slots {
		display: grid;
		grid-template-columns: repeat(8, minmax(0, 1fr));
		gap: 8px;
	}
	.current {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 10px;
		margin-bottom: -6px;
	}
	.current strong {
		font-size: 1.08rem;
		letter-spacing: -0.01em;
	}
	.current .none {
		color: var(--muted);
		font-weight: 600;
	}
	.current .id {
		color: var(--muted);
	}
	.hint {
		flex-basis: 100%;
	}
	.colors {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px 14px;
		border-radius: var(--radius);
		background: var(--paper);
	}
	.catalogue {
		flex: 1;
		min-height: 0;
	}

	/* Sliders: one grid per group so labels of any length line up */
	.ranges {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr) 58px;
		align-items: center;
		gap: 10px 14px;
		font-size: 0.9rem;
	}
	.range {
		display: contents;
	}
	.range input {
		width: 100%;
		accent-color: var(--ink);
	}
	.spin {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr) 58px;
		align-items: center;
		gap: 14px;
		font-size: 0.88rem;
	}
	.val {
		height: 26px;
		padding: 0 4px;
		border: 0;
		border-radius: 4px;
		background: none;
		text-align: right;
		color: var(--ink-2);
	}
	button.val:not(:disabled):hover {
		background: var(--sunk);
		color: var(--ink);
	}
	button.val:disabled {
		cursor: default;
		color: var(--muted);
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
		margin: 0;
		padding: 14px 16px 16px;
		border: 1.5px solid var(--line);
		border-radius: var(--radius);
	}
	.group legend {
		padding: 0 6px;
		margin-left: -6px;
	}
	.groups {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 12px;
	}
	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.preset {
		height: 36px;
		padding: 0 16px;
		border: 1.5px solid var(--ink);
		border-radius: 18px;
		background: var(--card);
		font-weight: 600;
		box-shadow: 2px 2px 0 var(--ink);
		transition:
			transform 0.08s,
			box-shadow 0.08s;
	}
	.preset:hover {
		background: #fff3c4;
	}
	.preset:active {
		transform: translate(2px, 2px);
		box-shadow: none;
	}
	.advanced summary {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 10px;
		padding: 10px 0;
		cursor: pointer;
		list-style: none;
	}
	.advanced summary::-webkit-details-marker {
		display: none;
	}
	.advanced summary::before {
		content: '▸';
		transition: rotate 0.15s;
	}
	.advanced[open] summary::before {
		rotate: 90deg;
	}
	.advanced .title {
		font-weight: 700;
	}

	/* Segmented choice: the ink shows through the gaps as separators, and
	   the options wrap on a second line rather than being cut */
	.seg {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5px;
		border: 1.5px solid var(--ink);
		border-radius: var(--radius);
		background: var(--ink);
		overflow: hidden;
	}
	.seg button {
		flex: 1 1 82px;
		min-width: 0;
		height: 36px;
		padding: 0 8px;
		border: 0;
		background: var(--card);
		font-weight: 600;
		font-size: 0.86rem;
		white-space: nowrap;
	}
	.seg button:hover:not([aria-pressed='true']) {
		background: #fff3c4;
	}
	.seg button[aria-pressed='true'] {
		background: var(--ink);
		color: var(--paper);
	}
	.seg.small button {
		flex: 0 0 auto;
		height: 30px;
		padding: 0 14px;
	}
	.rings {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.ringdot {
		width: 26px;
		height: 26px;
		padding: 0;
		border: 5px solid var(--c);
		border-radius: 50%;
		background: #0b0b14;
	}
	.ringdot[aria-pressed='true'] {
		box-shadow:
			0 0 0 2px var(--card),
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
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 18px;
		font-size: 0.9rem;
	}
	.color,
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}
	input[type='color'] {
		width: 32px;
		height: 32px;
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
		width: 17px;
		height: 17px;
	}

	footer {
		color: var(--muted);
		font-size: 0.74rem;
		line-height: 1.5;
	}
	footer p {
		margin: 0 0 4px;
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

	/* Narrow panel: slots on two rows, mode icons only when really tight */
	@container (max-width: 620px) {
		.slots {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
	@container (max-width: 380px) {
		.modes button {
			flex-direction: column;
			gap: 2px;
			font-size: 0.72rem;
		}
		.body {
			padding: 14px 12px 16px;
		}
		.ranges {
			gap: 8px 10px;
		}
	}

	/* --- desktop and landscape tablets: an app, not a page --------------- */
	/* The portrait takes all the height it can, the panel scrolls inside. */
	@media (min-width: 900px) and (min-aspect-ratio: 1/1) {
		.app {
			display: flex;
			flex-direction: column;
			height: 100dvh;
		}
		main {
			--sv: clamp(300px, min(calc(100dvh - var(--header) - 160px), 44vw), 820px);
			flex: 1;
			min-height: 0;
			grid-template-columns: var(--sv) minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr) auto;
			gap: 14px 28px;
			padding: 20px 0 16px;
		}
		.stage {
			grid-column: 1;
			grid-row: 1;
		}
		footer {
			grid-column: 1;
			grid-row: 2;
		}
		.panel {
			grid-column: 2;
			grid-row: 1 / 3;
			min-height: 0;
		}
		.body {
			flex: 1;
			overflow-y: auto;
			scrollbar-width: thin;
			scrollbar-color: var(--line) transparent;
		}
		/* The catalogue fills the rest, only its grid scrolls */
		.body.parts {
			overflow: hidden;
			padding-bottom: 0;
		}
	}
	@media (min-width: 900px) and (max-width: 1180px) and (min-aspect-ratio: 1/1) {
		.tagline {
			display: none;
		}
	}
	/* Short desktop screens: everything a notch tighter so the catalogue shows */
	@media (min-width: 900px) and (max-height: 860px) and (min-aspect-ratio: 1/1) {
		.body {
			gap: 12px;
			padding: 14px 16px 16px;
		}
		.slots :global(.tile) {
			max-width: 42px;
		}
		.slots :global(.pick) {
			padding: 4px 3px 5px;
		}
		.colors {
			padding: 10px 12px;
		}
		.modes button {
			height: 44px;
		}
	}
	@media (pointer: coarse) {
		.keys {
			display: none;
		}
	}

	/* --- phone and small tablet: one column ------------------------------ */
	/* The portrait and its buttons stick on top, the mode tabs right under. */
	/* (also screens taller than wide: tablets held upright, half-screen windows) */
	@media (max-width: 899px), (max-aspect-ratio: 999/1000) {
		.app {
			padding: 0 12px;
		}
		.tagline {
			display: none;
		}
		main {
			--sv: min(52vw, 34dvh, 360px);
			--stage-h: calc(var(--sv) + 20px);
			gap: 0;
			padding: 0 0 20px;
		}
		.stage {
			position: sticky;
			top: 0;
			z-index: 4;
			display: grid;
			grid-template-columns: var(--sv) auto;
			justify-content: center;
			align-items: end;
			gap: 12px;
			height: var(--stage-h);
			padding: 10px 0;
			background: var(--paper);
		}
		/* Tools in a column next to the portrait: shortcuts on top, download at the bottom */
		.view {
			position: static;
			width: var(--sv);
		}
		.float {
			top: 10px;
			right: auto;
			/* second grid column: centred grid of var(--sv) + 12px gap + 64px */
			left: calc(50% + var(--sv) / 2 - 26px + 12px);
			flex-direction: column;
			gap: 6px;
		}
		.chip {
			width: 40px;
			height: 40px;
			border: 1.5px solid var(--ink);
			background: var(--card);
			color: var(--ink);
			backdrop-filter: none;
		}
		.chip:hover:not(:disabled) {
			background: #fff3c4;
		}
		.export {
			flex-direction: column;
			margin: 0;
			gap: 0;
		}
		.export > .primary {
			flex-direction: column;
			gap: 2px;
			width: 64px;
			height: 64px;
			padding: 0;
			font-size: 0.7rem;
			border-radius: var(--radius) var(--radius) 0 0;
		}
		.export .text {
			display: none;
		}
		.fmt {
			font-size: 0.66rem;
		}
		.menu summary {
			width: 64px;
			height: 30px;
			border-left: 1.5px solid var(--ink);
			border-top: 0;
			border-radius: 0 0 var(--radius) var(--radius);
		}
		.popover {
			left: auto;
			right: 0;
			bottom: auto;
			top: calc(100% + 8px);
			width: min(300px, calc(100vw - 24px));
		}
		.panel {
			border: 0;
			background: none;
			border-radius: 0;
		}
		.modes {
			position: sticky;
			top: var(--stage-h);
			z-index: 3;
			margin: 0 -12px;
			padding: 0 4px;
			background: var(--paper);
			border-radius: 0;
		}
		.modes button {
			height: 46px;
			font-size: 0.86rem;
			gap: 6px;
		}
		.body {
			padding: 14px 0 0;
		}
		.preset {
			height: 32px;
			padding: 0 13px;
			font-size: 0.88rem;
		}
		.colors {
			background: var(--sunk);
		}
		/* Slots stay in reach under the tabs while the catalogue scrolls */
		.slots {
			position: sticky;
			top: calc(var(--stage-h) + 46px);
			z-index: 2;
			grid-template-columns: repeat(8, minmax(0, 1fr));
			gap: 6px;
			margin: -14px -12px 0;
			padding: 10px 12px;
			background: var(--paper);
			border-bottom: 1.5px solid var(--line);
		}
		footer {
			margin-top: 28px;
			padding-top: 12px;
			border-top: 1.5px solid var(--line);
		}
		.tools .text {
			display: none;
		}
		.tools .btn {
			padding: 0 9px;
		}
		header {
			height: 52px;
			gap: 8px;
		}
	}
	@media (max-width: 560px) {
		.slots :global(.label) {
			display: none;
		}
		.slots :global(.pick) {
			padding: 3px;
		}
		.slots :global(.empty .tile) {
			width: 100%;
			border: 0;
		}
		.slots :global(.remove) {
			top: -6px;
			right: -6px;
			width: 18px;
			height: 18px;
		}
	}
	@media (max-width: 380px) {
		.word {
			display: none;
		}
	}
</style>
