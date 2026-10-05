<script lang="ts">
	import type { Part } from '#lib/ldraw.ts';
	import Thumb from './Thumb.svelte';

	let {
		parts,
		selected,
		color,
		onpick
	}: {
		parts: Part[];
		selected: string | null;
		/** colour used for the thumbnails */
		color: number;
		onpick: (id: string) => void;
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
			<span class="sr-only">Search parts</span>
			<svg viewBox="0 0 20 20" aria-hidden="true"
				><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg
			>
			<input type="search" placeholder="Name or part number" bind:value={query} />
		</label>
		<span class="count mono">{filtered.length} / {parts.length}</span>
	</div>
	{#if kinds.length > 1}
		<div class="kinds" role="group" aria-label="Type">
			<button type="button" aria-pressed={!kind} onclick={() => (kind = '')}>All</button>
			{#each kinds as k (k)}
				<button type="button" aria-pressed={kind === k} onclick={() => (kind = k)}>{k}</button>
			{/each}
		</div>
	{/if}

	<div class="scroll">
		<div class="grid">
			{#each filtered.slice(0, limit) as p (p.id)}
				<button
					type="button"
					class="item"
					aria-pressed={p.id === selected}
					title={p.name}
					onclick={() => onpick(p.id)}
				>
					<Thumb id={p.id} {color} />
					<span class="id mono">{p.id}</span>
					<span class="sr-only">{p.name}</span>
				</button>
			{/each}
		</div>
		{#if filtered.length > limit}
			<div bind:this={sentinel} class="sentinel"></div>
		{:else if !filtered.length}
			<p class="nothing">Nothing matches “{query}”.</p>
		{/if}
	</div>
</div>

<style>
	/* Filters stay put, only the grid scrolls */
	.picker {
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
	}
	.scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		margin: 0 -6px;
		padding: 0 6px 12px;
	}
	.filters {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 10px;
	}
	.search {
		position: relative;
		flex: 1;
	}
	.search svg {
		position: absolute;
		left: 11px;
		top: 50%;
		width: 16px;
		height: 16px;
		translate: 0 -50%;
		fill: none;
		stroke: var(--muted);
		stroke-width: 2;
		stroke-linecap: round;
	}
	input {
		width: 100%;
		height: 38px;
		padding: 0 12px 0 34px;
		background: var(--card);
		border: 1.5px solid var(--line);
		border-radius: var(--radius);
	}
	input:focus {
		border-color: var(--ink);
		outline: none;
	}
	.count {
		color: var(--muted);
		white-space: nowrap;
	}
	.kinds {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 14px;
		margin-bottom: 12px;
	}
	.kinds button {
		padding: 2px 0;
		border: 0;
		border-bottom: 2px solid transparent;
		background: none;
		color: var(--ink-2);
		font-weight: 600;
		font-size: 0.88rem;
	}
	.kinds button:hover {
		color: var(--ink);
	}
	.kinds button[aria-pressed='true'] {
		color: var(--ink);
		border-bottom-color: var(--yellow);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
		gap: 6px;
	}
	.item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 6px 4px 4px;
		background: var(--card);
		border: 1.5px solid transparent;
		border-radius: var(--radius);
	}
	.item:hover {
		border-color: var(--line);
	}
	.item[aria-pressed='true'] {
		background: #fff3c4;
		border-color: var(--ink);
	}
	.id {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--muted);
		font-size: 0.68rem;
	}
	.item[aria-pressed='true'] .id {
		color: var(--ink);
	}
	.sentinel {
		height: 1px;
	}
	.nothing {
		color: var(--muted);
	}
</style>
