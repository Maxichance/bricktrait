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
	<legend>{label} <span class="name">{current?.name ?? value}</span></legend>
	<div class="list">
		{#each shown as c (c.code)}
			<button
				type="button"
				class="swatch"
				class:metal={c.finish}
				style:--c={c.hex}
				title={c.name}
				aria-label={c.name}
				aria-pressed={c.code === value}
				onclick={() => onchange(c.code)}
			></button>
		{/each}
		<button type="button" class="more" onclick={() => (all = !all)}>
			{all ? 'Less' : 'All colours'}
		</button>
	</div>
</fieldset>

<style>
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
	}
	legend {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		margin-bottom: 6px;
	}
	.name {
		text-transform: none;
		letter-spacing: 0;
		color: var(--text);
		margin-left: 4px;
	}
	.list {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		align-items: center;
	}
	.swatch {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 1px solid rgb(255 255 255 / 0.15);
		background: var(--c);
		padding: 0;
	}
	.swatch.metal {
		background: radial-gradient(circle at 35% 30%, #fff8 0 15%, transparent 45%), var(--c);
	}
	.swatch[aria-pressed='true'] {
		outline: 2px solid var(--text);
		outline-offset: 2px;
	}
	.more {
		background: none;
		border: 1px solid var(--line);
		border-radius: 999px;
		color: var(--muted);
		font-size: 0.78rem;
		padding: 2px 10px;
		height: 24px;
	}
</style>
