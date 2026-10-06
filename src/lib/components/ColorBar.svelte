<script lang="ts">
	import { t } from '#lib/i18n.svelte.ts';
	import type { Color } from '#lib/ldraw.ts';
	import { COMMON_COLORS } from '#lib/state.svelte.ts';

	interface Target {
		label: string;
		value: number;
		onchange: (code: number) => void;
	}

	let {
		targets,
		colors,
		used = []
	}: {
		targets: Target[];
		colors: Color[];
		/** colours already on the figure, offered first to match them */
		used?: number[];
	} = $props();

	let index = $state(0);
	let all = $state(false);
	let query = $state('');
	let strip: HTMLElement | undefined = $state();
	const target = $derived(targets[Math.min(index, targets.length - 1)]);
	const current = $derived(colors.find((c) => c.code === target.value));
	const opaque = $derived(colors.filter((c) => !c.alpha));
	const byCode = $derived(new Map(colors.map((c) => [c.code, c])));
	const figure = $derived(
		[...new Set(used)].map((c) => byCode.get(c)).filter((c) => c !== undefined)
	);
	const common = $derived(
		COMMON_COLORS.filter((c) => !used.includes(c))
			.map((c) => byCode.get(c))
			.filter((c) => c !== undefined)
	);
	const found = $derived.by(() => {
		const q = query.trim().toLowerCase().replace(/^#/, '');
		if (!q) return opaque;
		return opaque.filter((c) => c.name.toLowerCase().includes(q) || String(c.code) === q);
	});

	// The folded strip shows the chosen colour, wherever it is
	$effect(() => {
		void target.value;
		if (all || !strip) return;
		strip.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({
			block: 'nearest',
			inline: 'nearest'
		});
	});

	// A mouse wheel scrolls the strip sideways
	function wheel(e: WheelEvent) {
		if (!strip || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
		if (strip.scrollWidth <= strip.clientWidth) return;
		e.preventDefault();
		strip.scrollLeft += e.deltaY;
	}
</script>

{#snippet swatch(c: Color)}
	<button
		type="button"
		class="swatch"
		class:metal={c.finish}
		style:--c={c.hex}
		title="{c.name} ({c.code})"
		aria-label={c.name}
		aria-pressed={c.code === target.value}
		onclick={() => target.onchange(c.code)}
	></button>
{/snippet}

<div class="bar">
	<div class="head">
		{#if targets.length > 1}
			<div class="targets" role="tablist" aria-label={t('colourOf')}>
				{#each targets as t, i (t.label)}
					<button type="button" role="tab" aria-selected={t === target} onclick={() => (index = i)}>
						<span class="dot" style:background={byCode.get(t.value)?.hex}></span>{t.label}
					</button>
				{/each}
			</div>
		{:else}
			<span class="label">{target.label}</span>
		{/if}
		<span class="current">
			<span class="name">{current?.name ?? target.value}</span>
			<span class="mono code">#{target.value}</span>
		</span>
		<button type="button" class="more" aria-expanded={all} onclick={() => (all = !all)}>
			{all ? t('fewerColours') : t('allColours', { n: opaque.length })}
			<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 8 5 5 5-5" /></svg>
		</button>
	</div>

	{#if all}
		<div class="palette">
			<label class="find">
				<span class="sr-only">{t('findColour')}</span>
				<input type="search" placeholder={t('findColour')} bind:value={query} />
			</label>
			<div class="list wrap" role="group" aria-label="{t('colourOf')} {target.label}">
				{#each found as c (c.code)}
					{@render swatch(c)}
				{:else}
					<p class="none">{t('nothing')}</p>
				{/each}
			</div>
		</div>
	{:else}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="list strip"
			role="group"
			aria-label="{t('colourOf')} {target.label}"
			bind:this={strip}
			onwheel={wheel}
		>
			{#if figure.length}
				<span class="group" title={t('onFigure')}>
					{#each figure as c (c.code)}
						{@render swatch(c)}
					{/each}
				</span>
				<span class="sep" aria-hidden="true"></span>
			{/if}
			{#each common as c (c.code)}
				{@render swatch(c)}
			{/each}
		</div>
	{/if}
</div>

<style>
	.bar {
		min-width: 0;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 12px;
		margin-bottom: 8px;
		min-height: 26px;
	}
	.targets {
		display: flex;
		gap: 2px;
		padding: 2px;
		border-radius: var(--radius);
		background: var(--card);
	}
	.targets button {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 26px;
		padding: 0 10px;
		border: 0;
		border-radius: 4px;
		background: none;
		color: var(--ink-2);
		font-size: 0.82rem;
		font-weight: 600;
	}
	.targets button[aria-selected='true'] {
		background: var(--paper);
		color: var(--ink);
		box-shadow: 0 0 0 1.5px var(--ink);
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.2);
	}
	.current {
		display: flex;
		align-items: baseline;
		gap: 6px;
		min-width: 0;
	}
	.name {
		font-weight: 600;
		font-size: 0.88rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.code {
		color: var(--muted);
	}
	.more {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-left: auto;
		height: 26px;
		padding: 0 8px;
		border: 1.5px solid var(--line);
		border-radius: 13px;
		background: var(--card);
		color: var(--ink-2);
		font-size: 0.78rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.more:hover {
		border-color: var(--ink-2);
		color: var(--ink);
	}
	.more svg {
		width: 13px;
		height: 13px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: rotate 0.15s;
	}
	.more[aria-expanded='true'] svg {
		rotate: 180deg;
	}
	.list {
		display: flex;
		gap: 4px;
	}
	/* Folded: one line, scrolled sideways, edges fading out */
	.strip {
		align-items: center;
		overflow-x: auto;
		scrollbar-width: none;
		padding: 4px;
		margin: -4px;
		mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent);
	}
	.strip::-webkit-scrollbar {
		display: none;
	}
	.group {
		display: flex;
		gap: 4px;
	}
	.sep {
		flex: none;
		width: 1.5px;
		height: 20px;
		margin: 0 4px;
		background: var(--line);
	}
	.palette {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.find input {
		width: 100%;
		height: 32px;
		padding: 0 10px;
		background: var(--card);
		border: 1.5px solid var(--line);
		border-radius: var(--radius);
		font-size: 0.86rem;
	}
	.find input:focus {
		border-color: var(--ink);
		outline: none;
	}
	.wrap {
		flex-wrap: wrap;
		max-height: 132px;
		overflow-y: auto;
		padding: 4px;
		margin: -4px;
	}
	.none {
		margin: 4px 0;
		color: var(--muted);
		font-size: 0.85rem;
	}
	.swatch {
		flex: none;
		width: 26px;
		height: 26px;
		padding: 0;
		border: 0;
		border-radius: 4px;
		background: var(--c);
		box-shadow:
			inset 0 0 0 1px rgb(0 0 0 / 0.18),
			inset 0 -3px 0 rgb(0 0 0 / 0.12);
		transition: transform 0.08s;
	}
	.swatch.metal {
		background: linear-gradient(135deg, #fff9 0 20%, transparent 55%), var(--c);
	}
	.swatch:hover {
		transform: translateY(-2px);
	}
	.swatch[aria-pressed='true'] {
		box-shadow:
			0 0 0 2px var(--card),
			0 0 0 3.5px var(--ink);
	}
	@media (pointer: coarse) {
		.swatch {
			width: 32px;
			height: 32px;
		}
	}
</style>
