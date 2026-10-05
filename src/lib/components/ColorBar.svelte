<script lang="ts">
	import type { Color } from '#lib/ldraw.ts';
	import { COMMON_COLORS } from '#lib/state.svelte.ts';

	interface Target {
		label: string;
		value: number;
		onchange: (code: number) => void;
	}

	let { targets, colors }: { targets: Target[]; colors: Color[] } = $props();

	let index = $state(0);
	let all = $state(false);
	const target = $derived(targets[Math.min(index, targets.length - 1)]);
	const current = $derived(colors.find((c) => c.code === target.value));
	const opaque = $derived(colors.filter((c) => !c.alpha));
	const common = $derived(
		COMMON_COLORS.map((c) => colors.find((x) => x.code === c)).filter((c) => c !== undefined)
	);
	const shown = $derived(all ? opaque : common);
	const hex = (code: number) => colors.find((c) => c.code === code)?.hex;
</script>

<div class="bar">
	<div class="head">
		{#if targets.length > 1}
			<div class="targets" role="tablist" aria-label="Colour of">
				{#each targets as t, i (t.label)}
					<button type="button" role="tab" aria-selected={t === target} onclick={() => (index = i)}>
						<span class="dot" style:background={hex(t.value)}></span>{t.label}
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
			{all ? 'Common colours' : `All ${opaque.length}`}
		</button>
	</div>
	<div class="list" class:all role="group" aria-label="{target.label} colour">
		{#each shown as c (c.code)}
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
		{/each}
	</div>
</div>

<style>
	.head {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 8px;
		min-height: 26px;
	}
	.targets {
		display: flex;
		gap: 2px;
		padding: 2px;
		border-radius: var(--radius);
		background: var(--paper);
	}
	.targets button {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 24px;
		padding: 0 10px;
		border: 0;
		border-radius: 4px;
		background: none;
		color: var(--ink-2);
		font-size: 0.82rem;
		font-weight: 600;
	}
	.targets button[aria-selected='true'] {
		background: var(--card);
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
		margin-left: auto;
		border: 0;
		background: none;
		padding: 0;
		color: var(--ink-2);
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.list {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	/* The full palette stays a strip, scrolled on its own */
	.list.all {
		max-height: 108px;
		overflow-y: auto;
		padding: 3px;
		margin: -3px;
	}
	.swatch {
		width: 24px;
		height: 24px;
		padding: 0;
		border: 0;
		border-radius: 3px;
		background: var(--c);
		box-shadow:
			inset 0 0 0 1px rgb(0 0 0 / 0.18),
			inset 0 -3px 0 rgb(0 0 0 / 0.12);
	}
	.swatch.metal {
		background: linear-gradient(135deg, #fff9 0 20%, transparent 55%), var(--c);
	}
	.swatch:hover {
		transform: translateY(-1px);
	}
	.swatch[aria-pressed='true'] {
		box-shadow:
			0 0 0 2px var(--card),
			0 0 0 3.5px var(--ink);
	}
</style>
