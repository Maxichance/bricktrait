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
		<span class="shortcut" aria-hidden="true">{shortcut}</span>
		{#if id && color}
			<span class="color-dot" style:background={color.hex} title={color.name}></span>
		{/if}
		<span class="tile">
			{#if id}
				<Thumb {id} {cat} color={color?.code ?? 16} />
			{:else}
				<span class="plus" aria-hidden="true">
					<svg viewBox="0 0 16 16" fill="currentColor">
						<path
							d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"
						/>
					</svg>
				</span>
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
			<svg viewBox="0 0 16 16" fill="currentColor">
				<path
					d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"
				/>
			</svg>
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
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		width: 100%;
		height: 100%;
		padding: 7px 5px 7px;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		transition: all 0.16s cubic-bezier(0.16, 1, 0.3, 1);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
	}

	.pick:hover {
		border-color: var(--line-focus);
		background: var(--card-hover);
		transform: translateY(-1.5px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
	}

	.active .pick {
		border-color: var(--yellow);
		background: rgba(255, 208, 0, 0.08);
		box-shadow:
			0 0 0 1px var(--yellow),
			0 0 16px var(--yellow-glow),
			0 4px 12px rgba(0, 0, 0, 0.4);
		transform: translateY(-1.5px);
	}

	.shortcut {
		position: absolute;
		top: 4px;
		left: 5px;
		font-family: var(--mono);
		font-size: 0.62rem;
		font-weight: 600;
		color: var(--muted);
		opacity: 0.75;
		line-height: 1;
	}

	.active .shortcut {
		color: var(--yellow);
		opacity: 1;
	}

	.color-dot {
		position: absolute;
		top: 5px;
		right: 6px;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.5),
			0 0 4px rgba(255, 255, 255, 0.2);
	}

	.tile {
		display: grid;
		place-items: center;
		width: 100%;
		max-width: 58px;
		aspect-ratio: 1;
		border-radius: 6px;
		margin-top: 2px;
	}

	.empty .tile {
		border: 1.5px dashed rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.02);
		width: 76%;
		border-radius: 8px;
	}

	.empty .pick {
		background: rgba(255, 255, 255, 0.02);
		border-style: dashed;
		border-color: rgba(255, 255, 255, 0.1);
	}

	.empty .pick:hover {
		border-color: var(--line-focus);
		background: rgba(255, 255, 255, 0.04);
	}

	.plus {
		display: grid;
		place-items: center;
		color: var(--muted);
		width: 14px;
		height: 14px;
		opacity: 0.6;
		transition:
			opacity 0.15s,
			color 0.15s;
	}

	.plus svg {
		width: 100%;
		height: 100%;
	}

	.empty:hover .plus {
		opacity: 1;
		color: var(--ink);
	}

	.label {
		display: -webkit-box;
		-webkit-line-clamp: 1;
		line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
		max-width: 100%;
		font-size: 0.68rem;
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: 0.02em;
		text-align: center;
		color: var(--ink-2);
		text-transform: capitalize;
	}

	.active .label {
		color: #ffffff;
		font-weight: 800;
	}

	.remove {
		position: absolute;
		top: -6px;
		right: -6px;
		z-index: 2;
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		padding: 0;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 50%;
		background: #242938;
		color: var(--ink-2);
		opacity: 0;
		transform: scale(0.85);
		transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
	}

	.remove svg {
		width: 10px;
		height: 10px;
	}

	.slot:hover .remove,
	.active .remove,
	.remove:focus-visible {
		opacity: 1;
		transform: scale(1);
	}

	.remove:hover {
		background: var(--red);
		border-color: var(--red);
		color: #ffffff;
		transform: scale(1.1);
		box-shadow: 0 2px 10px var(--red-glow);
	}

	@media (hover: none) and (pointer: coarse) {
		.slot:not(.active) .remove {
			display: none;
		}
		.remove {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
