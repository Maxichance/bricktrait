<script lang="ts">
	import type { Color } from '#lib/ldraw.ts';
	import Thumb from './Thumb.svelte';

	let {
		label,
		id,
		name,
		color,
		active,
		onselect,
		onremove
	}: {
		label: string;
		/** null when the slot is empty */
		id: string | null;
		name: string;
		color: Color | undefined;
		active: boolean;
		onselect: () => void;
		onremove: () => void;
	} = $props();
</script>

<div class="slot" class:active class:empty={!id}>
	<button
		type="button"
		class="pick"
		aria-pressed={active}
		aria-label="{label}: {id ? name : 'empty'}"
		onclick={onselect}
	>
		<span class="tile">
			{#if id}
				<Thumb {id} color={color?.code ?? 16} />
			{:else}
				<span class="plus" aria-hidden="true">+</span>
			{/if}
		</span>
		<span class="text">
			<span class="label">{label}</span>
			{#if id}
				<span class="name">{name}</span>
				<span class="meta">
					<span class="dot" style:background={color?.hex}></span>
					<span class="mono">{id}</span>
				</span>
			{:else}
				<span class="name none">Empty</span>
			{/if}
		</span>
	</button>
	{#if id}
		<button type="button" class="remove" title="Remove {label.toLowerCase()}" onclick={onremove}>
			<span aria-hidden="true">×</span>
			<span class="sr-only">Remove {label.toLowerCase()}</span>
		</button>
	{/if}
</div>

<style>
	.slot {
		position: relative;
		min-width: 0;
	}
	.pick {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		height: 100%;
		padding: 8px;
		padding-right: 28px;
		text-align: left;
		background: var(--card);
		border: 1.5px solid var(--line);
		border-radius: var(--radius);
		transition:
			border-color 0.12s,
			box-shadow 0.12s;
	}
	.pick:hover {
		border-color: var(--ink-2);
	}
	.active .pick {
		border-color: var(--ink);
		box-shadow: 3px 3px 0 var(--ink);
	}
	.tile {
		flex: none;
		display: grid;
		place-items: center;
		width: 54px;
		height: 54px;
		border-radius: 4px;
		background: var(--sunk);
	}
	.empty .tile {
		background: none;
		border: 1.5px dashed var(--line);
	}
	.plus {
		color: var(--muted);
		font-size: 1.4rem;
		line-height: 1;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.name {
		font-weight: 600;
		font-size: 0.88rem;
		line-height: 1.2;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.name.none {
		color: var(--muted);
		font-weight: 500;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--muted);
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.2);
	}
	.remove {
		position: absolute;
		top: 4px;
		right: 4px;
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border: 0;
		border-radius: 4px;
		background: none;
		color: var(--muted);
		font-size: 1.1rem;
		line-height: 1;
	}
	.remove:hover {
		background: var(--red);
		color: #fff;
	}
</style>
