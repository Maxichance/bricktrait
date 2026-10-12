<script lang="ts">
	import { asset } from '$app/paths';
	import {
		needsLegs,
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

	// Colours already worn, offered first so parts can match
	const usedColours = $derived.by(() => {
		const f = portrait.figure;
		const list: number[] = [];
		if (f.head.id) list.push(f.head.color);
		if (f.headgear.id) list.push(f.headgear.color);
		if (f.torso.id) list.push(f.torso.color, ...(torso?.arms ? [] : [f.torso.arms, f.torso.hands]));
		if (f.legs.id) list.push(f.legs.color);
		if (f.legs.id === STANDARD_LEGS || needsLegs(find(f.legs.id))) list.push(f.legs.hips);
		for (const s of [f.neck, f.back, f.handR, f.handL]) if (s.id) list.push(s.color);
		return list;
	});

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
					...(f.legs.id === STANDARD_LEGS || needsLegs(find(f.legs.id))
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
		} else if (e.key === '/' && !mod && !typing) {
			// Straight to the parts search
			e.preventDefault();
			mode = 'parts';
			requestAnimationFrame(() =>
				document.querySelector<HTMLInputElement>('.picker input[type=search]')?.focus()
			);
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

	// Phone: the portrait gets smaller once the catalogue is scrolled, with
	// some slack so it does not flicker around the threshold
	let compact = $state(false);
	function shrink() {
		if (!compact && scrollY > 240) compact = true;
		else if (compact && scrollY < 40) compact = false;
	}

	// Tabs: arrow keys go to the next or previous one
	function tabKeys(e: KeyboardEvent) {
		const step = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity }[e.key];
		if (step === undefined) return;
		e.preventDefault();
		const i = Math.min(MODES.length - 1, Math.max(0, MODES.indexOf(mode) + step));
		mode = MODES[i];
		requestAnimationFrame(() =>
			document.querySelectorAll<HTMLElement>('.modes [role=tab]')[i]?.focus()
		);
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
	onscroll={shrink}
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
			<div class="brick-wrap">
				<svg class="brick" viewBox="0 0 40 28" aria-hidden="true">
					<rect x="1" y="9" width="38" height="18" rx="2" />
					<rect x="6" y="3" width="10" height="7" rx="1.5" />
					<rect x="24" y="3" width="10" height="7" rx="1.5" />
				</svg>
			</div>
			<div class="brand">
				<span class="word">bricktrait</span>
				<span class="pro-tag">STUDIO</span>
			</div>
		</a>
		<p class="tagline">{t('tagline')}</p>
		<nav class="tools" aria-label={t('undo')}>
			<button
				type="button"
				class="btn quiet tool-btn"
				onclick={undo}
				disabled={!timeline.canUndo}
				title="{t('undo')} (Ctrl+Z)"
			>
				{@render icon('undo')}
				<span class="text">{t('undo')}</span>
			</button>
			<button
				type="button"
				class="btn quiet tool-btn"
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
			<a
				class="btn quiet gh-link"
				href="https://github.com/Maxichance/bricktrait"
				title={t('star')}
			>
				<span class="star-icon">★</span>
				<span class="text">GitHub</span>
			</a>
			<button
				type="button"
				class="btn primary header-download"
				onclick={download}
				disabled={!ready}
			>
				{@render icon('download')}
				<span class="text">{t('download')}</span>
			</button>
		</nav>
	</header>

	<main class:compact>
		<section class="stage" aria-label={t('preview')}>
			<div class="view">
				<div class="preview-frame">
					<Preview />
				</div>
				<div class="float">
					<button
						type="button"
						class="chip"
						onclick={() => randomize(catalog)}
						disabled={!ready}
						title="{t('random')} (Space)"
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
				<div class="stage-hint">
					<span>{t('cameraHint')}</span>
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
						<button type="button" class="btn copy-btn" onclick={copyImage} disabled={!ready}>
							{copiedImage ? t('imageCopied') : t('copyImage')}
						</button>
						{#if copyError}
							<p class="muted error-text">{t('copyFailed')}</p>
						{/if}
					</div>
				</details>
			</div>
		</section>

		<section class="panel">
			<!-- svelte-ignore a11y_interactive_supports_focus -->
			<div class="modes" role="tablist" aria-label={t('editing')} onkeydown={tabKeys}>
				{#each MODES as m (m)}
					<button
						type="button"
						role="tab"
						aria-selected={mode === m}
						tabindex={mode === m ? 0 : -1}
						onclick={() => (mode = m)}
					>
						{@render icon(m)}<span>{t(m)}</span>
					</button>
				{/each}
			</div>

			<div class="body" class:parts={mode === 'parts'} role="tabpanel">
				{#if mode === 'parts'}
					<div class="parts-layout">
						<div class="slots" role="group" aria-label={t('parts')}>
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

						<div class="parts-workspace">
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
									<div class="inspector">
										<div class="current">
											<span class="badge label">{t(active)}</span>
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
											<ColorBar {targets} {colors} used={usedColours} />
											{#if active === 'handR' || active === 'handL'}
												{@const hand = portrait.figure[active]}
												<label class="range spin">
													<span class="name">{t('spin')}</span>
													<input
														type="range"
														min="-180"
														max="180"
														step="5"
														bind:value={hand.spin}
													/>
													<span class="mono val">{hand.spin}°</span>
												</label>
											{/if}
										</div>
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
						</div>
					</div>
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
					{#if p.slot === 'ldraw'}<a href="https://www.ldraw.org" target="_blank" rel="noreferrer"
							>LDraw</a
						>
					{:else if p.slot === 'ccby'}<a
							href="https://creativecommons.org/licenses/by/4.0/"
							target="_blank"
							rel="noreferrer">CC BY</a
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
		--header: 62px;
		max-width: 1720px;
		margin: 0 auto;
		padding: 0 24px;
	}

	/* --- header ---------------------------------------------------------- */
	header {
		display: flex;
		align-items: center;
		gap: 18px;
		height: var(--header);
		border-bottom: 1px solid var(--line);
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 12px;
		text-decoration: none;
	}

	.brick-wrap {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		background: rgba(229, 37, 33, 0.12);
		border: 1px solid rgba(229, 37, 33, 0.35);
		border-radius: 9px;
		transition: transform 0.16s ease;
	}
	.logo:hover .brick-wrap {
		transform: rotate(-6deg) scale(1.05);
	}

	.brick {
		width: 26px;
		fill: var(--red);
		stroke: rgba(255, 255, 255, 0.3);
		stroke-width: 1.2;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.word {
		font-weight: 850;
		font-size: 1.4rem;
		letter-spacing: -0.04em;
		color: #ffffff;
	}

	.pro-tag {
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		padding: 2px 6px;
		border-radius: 4px;
		background: rgba(255, 208, 0, 0.16);
		color: var(--yellow);
		border: 1px solid rgba(255, 208, 0, 0.3);
	}

	.tagline {
		margin: 0;
		padding-left: 16px;
		border-left: 1px solid var(--line);
		color: var(--ink-2);
		font-size: 0.88rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.tools {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-left: auto;
	}

	.tool-btn {
		height: 34px;
		padding: 0 10px;
	}

	.sep {
		width: 1px;
		height: 20px;
		margin: 0 4px;
		background: var(--line);
	}

	.lang select {
		height: 34px;
		padding: 0 10px;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--card);
		color: var(--ink-2);
		font-weight: 600;
		font-size: 0.82rem;
		cursor: pointer;
		transition:
			border-color 0.14s,
			color 0.14s;
	}
	.lang select:hover {
		border-color: var(--line-focus);
		color: var(--ink);
	}

	.gh-link {
		height: 34px;
		padding: 0 12px;
		gap: 6px;
	}
	.star-icon {
		color: var(--yellow);
		font-size: 1rem;
	}

	.header-download {
		height: 34px;
		padding: 0 14px;
		font-size: 0.82rem;
		margin-left: 4px;
	}

	svg {
		width: 18px;
		height: 18px;
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	svg .dot {
		fill: currentColor;
		stroke: none;
	}

	/* --- stage: the portrait and tools ---------------------------------- */
	main {
		display: grid;
		gap: 16px;
		padding: 16px 0;
	}

	.view {
		position: relative;
		border-radius: var(--radius-lg);
		background: var(--bg-stage);
		border: 1px solid var(--line);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
		overflow: hidden;
	}

	.preview-frame {
		width: 100%;
		aspect-ratio: 1;
	}

	.float {
		position: absolute;
		top: 12px;
		right: 12px;
		display: flex;
		gap: 8px;
		z-index: 5;
	}

	.chip {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		padding: 0;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 50%;
		background: rgba(15, 18, 28, 0.7);
		color: #ffffff;
		backdrop-filter: blur(12px);
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
		transition: all 0.16s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.chip:hover:not(:disabled) {
		background: rgba(30, 36, 56, 0.95);
		border-color: rgba(255, 255, 255, 0.3);
		transform: translateY(-2px) scale(1.05);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
	}
	.chip:disabled {
		opacity: 0.35;
	}

	.stage-hint {
		padding: 8px 14px;
		text-align: center;
		font-size: 0.75rem;
		color: var(--muted);
		border-top: 1px solid rgba(255, 255, 255, 0.05);
		background: rgba(0, 0, 0, 0.2);
	}

	.export {
		position: relative;
		display: flex;
		margin-top: 12px;
		box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
		border-radius: var(--radius);
	}

	.export > .primary {
		flex: 1;
		justify-content: center;
		height: 48px;
		font-size: 0.96rem;
		font-weight: 700;
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
	}

	.fmt {
		opacity: 0.75;
		font-weight: 600;
		font-size: 0.8rem;
		margin-left: 4px;
	}

	.menu summary {
		list-style: none;
		width: 46px;
		height: 48px;
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
		transform: rotate(180deg);
	}

	.popover {
		position: absolute;
		bottom: calc(100% + 10px);
		left: 0;
		right: 0;
		z-index: 20;
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 16px;
		background: var(--card);
		border: 1px solid var(--line-focus);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		backdrop-filter: blur(16px);
	}
	.popover fieldset {
		border: 0;
		margin: 0;
		padding: 0;
	}
	.popover legend {
		margin-bottom: 8px;
	}
	.popover .copy-btn {
		justify-content: center;
		height: 36px;
	}
	.error-text {
		color: var(--red);
		font-size: 0.82rem;
		margin: 0;
		text-align: center;
	}

	/* --- panel: what is being edited ------------------------------------ */
	.panel {
		display: flex;
		flex-direction: column;
		min-width: 0;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: var(--radius-lg);
		container-type: inline-size;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
	}

	.modes {
		display: flex;
		padding: 4px 6px;
		border-bottom: 1px solid var(--line);
		background: rgba(0, 0, 0, 0.25);
		gap: 4px;
	}
	.modes button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		flex: 1;
		height: 44px;
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--ink-2);
		font-weight: 700;
		font-size: 0.88rem;
		transition: all 0.15s ease;
	}
	.modes button:hover {
		color: #ffffff;
		background: rgba(255, 255, 255, 0.05);
	}
	.modes button[aria-selected='true'] {
		color: #ffffff;
		background: var(--card-hover);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
	}
	.modes button[aria-selected='true'] svg {
		color: var(--yellow);
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 18px 20px 20px;
		min-height: 0;
	}

	/* Parts: slots strip, what is selected, colours, then the catalogue */
	.parts-layout {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-height: 0;
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
		flex: 1;
	}

	.parts-workspace {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
		max-width: 100%;
		min-height: 0;
		overflow: hidden;
		flex: 1;
	}

	.slots {
		display: grid;
		grid-template-columns: repeat(8, minmax(0, 1fr));
		gap: 8px;
	}

	.inspector {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 14px;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid var(--line);
		min-height: 40px;
	}

	.current {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 10px;
	}
	.badge {
		padding: 2px 8px;
		border-radius: 4px;
		background: rgba(255, 208, 0, 0.12);
		color: var(--yellow);
		font-size: 0.68rem;
		font-weight: 700;
	}
	.current strong {
		font-size: 0.94rem;
		letter-spacing: -0.01em;
		color: #ffffff;
	}
	.current .none {
		color: var(--muted);
		font-weight: 600;
	}
	.current .id {
		color: var(--muted);
		font-size: 0.74rem;
	}
	.hint {
		flex-basis: 100%;
		font-size: 0.78rem;
	}

	.colors {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}

	.catalogue {
		flex: 1;
		min-height: 0;
	}

	/* Sliders */
	.ranges {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr) 58px;
		align-items: center;
		gap: 10px 14px;
		font-size: 0.88rem;
	}
	.range {
		display: contents;
	}
	.range input {
		width: 100%;
		accent-color: var(--yellow);
		cursor: pointer;
	}
	.spin {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr) 58px;
		align-items: center;
		gap: 14px;
		font-size: 0.88rem;
	}
	.val {
		height: 28px;
		padding: 0 6px;
		border: 1px solid var(--line);
		border-radius: 5px;
		background: rgba(0, 0, 0, 0.3);
		text-align: right;
		color: var(--ink);
		font-size: 0.82rem;
		transition: all 0.12s ease;
	}
	button.val:not(:disabled):hover {
		background: var(--card-hover);
		border-color: var(--line-focus);
		color: var(--yellow);
	}
	button.val:disabled {
		cursor: default;
		color: var(--muted);
		opacity: 0.5;
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
		margin: 0;
		padding: 14px 16px 16px;
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		background: rgba(0, 0, 0, 0.2);
	}
	.group legend {
		padding: 0 8px;
		margin-left: -4px;
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
		border: 1px solid var(--line);
		border-radius: 18px;
		background: var(--card);
		color: var(--ink);
		font-weight: 600;
		font-size: 0.86rem;
		transition: all 0.14s ease;
		box-shadow: var(--shadow-sm);
	}
	.preset:hover {
		border-color: rgba(255, 208, 0, 0.5);
		background: rgba(255, 208, 0, 0.1);
		color: var(--yellow);
		transform: translateY(-1px);
	}
	.preset:active {
		transform: translateY(0);
	}

	.advanced summary {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 10px;
		padding: 10px 0;
		cursor: pointer;
		list-style: none;
		color: var(--ink);
	}
	.advanced summary::-webkit-details-marker {
		display: none;
	}
	.advanced summary::before {
		content: '▸';
		transition: transform 0.15s;
		color: var(--muted);
	}
	.advanced[open] summary::before {
		transform: rotate(90deg);
		color: var(--yellow);
	}
	.advanced .title {
		font-weight: 700;
	}

	/* Segmented choices */
	.seg {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: rgba(0, 0, 0, 0.4);
		padding: 3px;
	}
	.seg button {
		flex: 1 1 82px;
		min-width: 0;
		height: 34px;
		padding: 0 10px;
		border: 0;
		border-radius: 4px;
		background: none;
		color: var(--ink-2);
		font-weight: 600;
		font-size: 0.84rem;
		white-space: nowrap;
		transition: all 0.14s ease;
	}
	.seg button:hover:not([aria-pressed='true']) {
		color: #ffffff;
		background: rgba(255, 255, 255, 0.05);
	}
	.seg button[aria-pressed='true'] {
		background: var(--card-hover);
		color: #ffffff;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
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
		width: 28px;
		height: 28px;
		padding: 0;
		border: 4px solid var(--c);
		border-radius: 50%;
		background: #0b0d14;
		cursor: pointer;
		transition: transform 0.12s ease;
	}
	.ringdot:hover {
		transform: scale(1.15);
	}
	.ringdot[aria-pressed='true'] {
		box-shadow:
			0 0 0 2px var(--card),
			0 0 0 4px var(--c),
			0 0 12px var(--c);
		transform: scale(1.1);
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
		gap: 12px 20px;
		font-size: 0.88rem;
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
		border: 1px solid var(--line);
		border-radius: 6px;
		background: none;
		cursor: pointer;
	}
	input[type='color']::-webkit-color-swatch-wrapper {
		padding: 2px;
	}
	input[type='color']::-webkit-color-swatch {
		border: 0;
		border-radius: 4px;
	}

	.check input {
		accent-color: var(--yellow);
		width: 17px;
		height: 17px;
		cursor: pointer;
	}

	/* --- footer --------------------------------------------------------- */
	footer {
		color: var(--muted);
		font-size: 0.76rem;
		line-height: 1.6;
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
		cursor: pointer;
	}
	.link:hover {
		color: var(--yellow);
	}
	footer a {
		color: var(--ink-2);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	footer a:hover {
		color: var(--yellow);
	}

	.muted {
		color: var(--muted);
		font-size: 0.82rem;
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
		border: 1px solid var(--line);
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.4);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--yellow);
		box-shadow: 0 0 10px var(--yellow-glow);
		transition: width 0.2s;
	}

	/* --- responsive rules ----------------------------------------------- */
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

	/* Desktop layout */
	@media (min-width: 900px) and (min-aspect-ratio: 1/1) {
		.app {
			display: flex;
			flex-direction: column;
			height: 100dvh;
		}
		main {
			--sv: clamp(320px, min(calc(100dvh - var(--header) - 170px), 43vw), 800px);
			flex: 1;
			min-height: 0;
			grid-template-columns: var(--sv) minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr) auto;
			gap: 16px 28px;
			padding: 16px 0 14px;
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
			overflow: hidden;
		}
		.body {
			flex: 1;
			overflow-y: auto;
		}
		.body.parts {
			overflow: hidden;
			padding: 12px 14px 14px;
		}
		.parts-layout {
			display: grid;
			grid-template-columns: 76px minmax(0, 1fr);
			gap: 12px;
			height: 100%;
			min-height: 0;
			min-width: 0;
			max-width: 100%;
			overflow: hidden;
		}
		.slots {
			width: 76px;
			flex: 0 0 76px;
			display: flex;
			flex-direction: column;
			gap: 6px;
			overflow-y: auto;
			overflow-x: hidden;
			scrollbar-width: none;
			padding-right: 2px;
		}
		.slots::-webkit-scrollbar {
			display: none;
		}
		.slots :global(.slot) {
			height: 70px;
			flex: none;
		}
		.slots :global(.slot .pick) {
			padding: 5px 4px 5px;
			gap: 2px;
		}
		.slots :global(.slot .tile) {
			max-width: 36px;
			margin-top: 2px;
		}
		.slots :global(.slot .label) {
			font-size: 0.63rem;
			color: var(--ink-2);
			line-height: 1.1;
		}
		.parts-workspace {
			display: flex;
			flex-direction: column;
			gap: 8px;
			min-width: 0;
			max-width: 100%;
			width: 100%;
			height: 100%;
			min-height: 0;
			overflow: hidden;
		}
		.inspector {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			padding: 6px 12px;
			border-radius: var(--radius-sm);
			background: rgba(0, 0, 0, 0.25);
			border: 1px solid var(--line);
			min-height: 38px;
			flex: none;
			min-width: 0;
			max-width: 100%;
			overflow: hidden;
		}
		.inspector .current {
			display: flex;
			align-items: center;
			gap: 6px;
			background: none;
			border: none;
			padding: 0;
			flex: none;
			min-width: 0;
		}
		.inspector .current strong {
			max-width: 160px;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.inspector .colors {
			display: flex;
			align-items: center;
			gap: 8px;
			background: none;
			border: none;
			padding: 0;
			margin-left: auto;
			min-width: 0;
			max-width: 100%;
			flex: 1;
			justify-content: flex-end;
		}
		.catalogue {
			flex: 1;
			min-height: 0;
			min-width: 0;
			max-width: 100%;
			width: 100%;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}
	}

	@media (min-width: 900px) and (max-width: 1180px) and (min-aspect-ratio: 1/1) {
		.tagline {
			display: none;
		}
	}

	@media (pointer: coarse) {
		.keys {
			display: none;
		}
	}

	/* Mobile & small devices */
	@media (max-width: 899px), (max-aspect-ratio: 999/1000) {
		.app {
			padding: 0 12px;
		}
		.tagline {
			display: none;
		}
		.header-download {
			display: none;
		}
		main {
			--sv: min(54vw, 36dvh, 360px);
			--stage-h: calc(var(--sv) + 24px);
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
			background: var(--bg-app);
		}
		.stage-hint {
			display: none;
		}
		.view {
			position: static;
			width: var(--sv);
		}
		.float {
			top: 10px;
			right: auto;
			left: calc(50% + var(--sv) / 2 - 26px + 12px);
			flex-direction: column;
			gap: 6px;
		}
		.chip {
			width: 40px;
			height: 40px;
			background: var(--card);
			color: var(--ink);
			backdrop-filter: none;
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
			font-size: 0.72rem;
			border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		}
		.export .text {
			display: none;
		}
		.fmt {
			font-size: 0.66rem;
		}
		.menu summary {
			width: 64px;
			height: 32px;
			border-left: 1px solid rgba(255, 255, 255, 0.2);
			border-top: 0;
			border-radius: 0 0 var(--radius-sm) var(--radius-sm);
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
			box-shadow: none;
			overflow: visible;
		}
		.modes {
			position: sticky;
			top: var(--stage-h);
			z-index: 3;
			margin: 0 -12px;
			padding: 4px 8px;
			background: var(--bg-app);
			border-radius: 0;
			border-top: 1px solid var(--line);
		}
		.body {
			padding: 14px 0 0;
		}
		.parts-layout {
			display: contents;
		}
		.parts-workspace {
			display: contents;
		}
		.inspector {
			display: flex;
			flex-direction: column;
			gap: 8px;
			padding: 0;
			background: none;
			border: none;
		}
		main.compact {
			--sv: min(32vw, 20dvh, 180px);
		}
		main.compact .float {
			display: none;
		}
		main.compact .export > .primary {
			height: 52px;
		}
		.slots {
			position: sticky;
			top: calc(var(--stage-h) + 52px);
			z-index: 2;
			grid-template-columns: repeat(8, minmax(0, 1fr));
			gap: 6px;
			margin: -14px -12px 0;
			padding: 10px 12px;
			background: var(--bg-app);
			border-bottom: 1px solid var(--line);
		}
		footer {
			margin-top: 28px;
			padding-top: 14px;
			border-top: 1px solid var(--line);
		}
		.tools .text {
			display: none;
		}
		header {
			height: 54px;
			gap: 10px;
		}
	}

	@media (max-width: 560px) {
		.slots :global(.label) {
			display: none;
		}
		.slots :global(.pick) {
			padding: 4px;
		}
	}
	@media (max-width: 380px) {
		.word {
			display: none;
		}
	}
</style>
