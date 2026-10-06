<script lang="ts">
	import { t } from '#lib/i18n.svelte.ts';
	import type { Category, Color } from '#lib/ldraw.ts';
	import Thumb from './Thumb.svelte';

	let {
		label,
		cat,
		id,
		name,
		fullName = '',
		color,
		active,
		shortcut,
		onselect,
		onremove
	}: {
		label: string;
		cat: Category;
		/** null when the slot is empty */
		id: string | null;
		name: string;
		/** full LDraw name, as a tooltip */
		fullName?: string;
		color: Color | undefined;
		active: boolean;
		/** keyboard shortcut, shown in the tooltip */
		shortcut: string;
		onselect: () => void;
		onremove: () => void;
	} = $props();
</script>

<div class="slot" class:active class:empty={!id}>
	<button
		type="button"
		class="pick"
		aria-pressed={active}
		aria-label="{label}: {id ? fullName || name : t('empty')}"
		title="{label} · {id ? fullName || name : t('empty')} ({shortcut})"
		onclick={onselect}
	>
		<span class="tile">
			{#if id}
				<Thumb {id} {cat} color={color?.code ?? 16} />
			{:else}
				<span class="plus" aria-hidden="true">+</span>
			{/if}
		</span>
		<span class="label">{label}</span>
	</button>
	{#if id}
		<button
			type="button"
			class="remove"
			title={t('remove', { slot: label.toLowerCase() })}
			onclick={onremove}
		>
			<span aria-hidden="true">×</span>
			<span class="sr-only">{t('remove', { slot: label.toLowerCase() })}</span>
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
		flex-direction: column;
		align-items: center;
		gap: 4px;
		width: 100%;
		height: 100%;
		padding: 5px 4px 6px;
		background: var(--card);
		border: 1.5px solid var(--line);
		border-radius: var(--radius);
		transition:
			border-color 0.12s,
			box-shadow 0.12s,
			transform 0.12s;
	}
	.pick:hover {
		border-color: var(--ink-2);
	}
	.active .pick {
		border-color: var(--ink);
		background: #fff3c4;
		box-shadow: 3px 3px 0 var(--ink);
		transform: translate(-1px, -1px);
	}
	.tile {
		display: grid;
		place-items: center;
		width: 100%;
		max-width: 64px;
		aspect-ratio: 1;
		border-radius: 4px;
	}
	.empty .tile {
		border: 1.5px dashed var(--line);
		width: 70%;
	}
	.empty .pick {
		background: transparent;
		border-style: dashed;
	}
	.plus {
		color: var(--muted);
		font-size: 1.3rem;
		line-height: 1;
	}
	.label {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		max-width: 100%;
		font-size: 0.64rem;
		line-height: 1.15;
		letter-spacing: 0.04em;
		text-align: center;
	}
	.active .label {
		color: var(--ink);
	}
	.remove {
		position: absolute;
		top: -7px;
		right: -7px;
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		padding: 0;
		border: 1.5px solid var(--ink);
		border-radius: 50%;
		background: var(--card);
		color: var(--ink);
		font-size: 0.9rem;
		line-height: 1;
		opacity: 0;
		transition: opacity 0.12s;
	}
	.slot:hover .remove,
	.active .remove,
	.remove:focus-visible {
		opacity: 1;
	}
	/* No hover on touch screens: the cross of the active slot is enough */
	@media (hover: none) {
		.slot:not(.active) .remove {
			display: none;
		}
	}
	.remove:hover {
		background: var(--red);
		border-color: var(--red);
		color: #fff;
	}
</style>
