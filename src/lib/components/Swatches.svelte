<script lang="ts">
	import type { Color } from '#lib/ldraw.ts';
	import { COMMON_COLORS } from '#lib/state.svelte.ts';

	let {
		label,
		value,
		colors,
		onchange
	}: { label: string; value: number; colors: Color[]; onchange: (code: number) => void } = $props();

	let all = $state(false);
	const common = $derived(
		COMMON_COLORS.map((c) => colors.find((x) => x.code === c)).filter((c) => c !== undefined)
	);
	const shown = $derived(all ? colors.filter((c) => !c.alpha) : common);
	const current = $derived(colors.find((c) => c.code === value));
</script>

<fieldset>
	<legend>
		<span class="label">{label}</span>
		<span class="name">{current?.name ?? value}</span>
		<span class="mono code">#{value}</span>
	</legend>
	<div class="list">
		{#each shown as c (c.code)}
			<button
				type="button"
				class="swatch"
				class:metal={c.finish}
				style:--c={c.hex}
				title="{c.name} ({c.code})"
				aria-label={c.name}
				aria-pressed={c.code === value}
				onclick={() => onchange(c.code)}
			></button>
		{/each}
		<button type="button" class="more" onclick={() => (all = !all)}>
			{all ? 'Fewer' : `All ${colors.filter((c) => !c.alpha).length}`}
		</button>
	</div>
</fieldset>

<style>
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}
	legend {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 0;
		margin-bottom: 8px;
	}
	.name {
		font-weight: 600;
		font-size: 0.9rem;
	}
	.code {
		color: var(--muted);
	}
	.list {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		align-items: center;
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
	.more {
		height: 24px;
		padding: 0 8px;
		margin-left: 4px;
		border: 0;
		background: none;
		color: var(--ink-2);
		font-size: 0.8rem;
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
</style>
