<script lang="ts">
	import type { Part } from '#lib/ldraw.ts';
	import Thumb from './Thumb.svelte';

	let {
		parts,
		selected,
		color,
		none = false,
		onpick
	}: {
		parts: Part[];
		selected: string | null;
		/** colour used for the thumbnails */
		color: number;
		/** offers a "nothing" choice */
		none?: boolean;
		onpick: (id: string | null) => void;
	} = $props();

	const PAGE = 90;
	let query = $state('');
	let kind = $state('');
	let limit = $state(PAGE);
	let sentinel: HTMLElement | undefined = $state();

	const kinds = $derived([...new Set(parts.map((p) => p.kind).filter(Boolean))] as string[]);
	const filtered = $derived.by(() => {
		const words = query.toLowerCase().split(/\s+/).filter(Boolean);
		return parts.filter(
			(p) =>
				(!kind || p.kind === kind) &&
				words.every((w) => p.name.toLowerCase().includes(w) || p.id.includes(w))
		);
	});

	$effect(() => {
		// Back to the first page whenever the filter changes
		void [query, kind, parts];
		limit = PAGE;
	});

	$effect(() => {
		if (!sentinel) return;
		const io = new IntersectionObserver(([e]) => e.isIntersecting && (limit += PAGE), {
			rootMargin: '400px'
		});
		io.observe(sentinel);
		return () => io.disconnect();
	});
</script>

<div class="picker">
	<div class="filters">
		<label class="search">
			<span class="sr-only">Search</span>
			<input type="search" placeholder="Search {parts.length} parts…" bind:value={query} />
		</label>
		{#if kinds.length > 1}
			<div class="kinds" role="group" aria-label="Type">
				<button type="button" aria-pressed={!kind} onclick={() => (kind = '')}>All</button>
				{#each kinds as k (k)}
					<button type="button" aria-pressed={kind === k} onclick={() => (kind = k)}>{k}</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="grid">
		{#if none && !query && !kind}
			<button
				type="button"
				class="item none"
				aria-pressed={selected === null}
				title="Nothing"
				onclick={() => onpick(null)}
			>
				<span class="empty">None</span>
			</button>
		{/if}
		{#each filtered.slice(0, limit) as p (p.id)}
			<button
				type="button"
				class="item"
				aria-pressed={p.id === selected}
				title={p.name}
				onclick={() => onpick(p.id)}
			>
				<Thumb id={p.id} {color} />
				<span class="sr-only">{p.name}</span>
			</button>
		{/each}
	</div>
	{#if filtered.length > limit}
		<div bind:this={sentinel} class="sentinel"></div>
	{:else if !filtered.length}
		<p class="nothing">No part matches “{query}”.</p>
	{/if}
</div>

<style>
	.filters {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 10px;
	}
	input {
		width: 100%;
		background: var(--panel-2);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 8px 12px;
	}
	.kinds {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.kinds button {
		background: var(--panel-2);
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 2px 12px;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.kinds button[aria-pressed='true'] {
		background: var(--accent);
		border-color: var(--accent);
		color: #fff;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
		gap: 6px;
	}
	.item {
		background: var(--panel-2);
		border: 1px solid transparent;
		border-radius: 10px;
		padding: 4px;
		transition: border-color 0.15s;
	}
	.item:hover {
		border-color: var(--line);
	}
	.item[aria-pressed='true'] {
		border-color: var(--accent-2);
		background: #24222a;
	}
	.none {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
	}
	.empty {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.sentinel {
		height: 1px;
	}
	.nothing {
		color: var(--muted);
	}
</style>
