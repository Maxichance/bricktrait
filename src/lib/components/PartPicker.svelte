<script lang="ts">
	import { shortName, type Category, type Part } from '#lib/ldraw.ts';
	import { search } from '#lib/search.ts';
	import { isFavourite, prefs, toggleFavourite } from '#lib/prefs.svelte.ts';
	import { t, tn } from '#lib/i18n.svelte.ts';
	import Thumb from './Thumb.svelte';

	let {
		parts,
		cat,
		selected,
		color,
		onpick
	}: {
		parts: Part[];
		cat: Category;
		selected: string | null;
		/** colour used for the thumbnails */
		color: number;
		onpick: (id: string) => void;
	} = $props();

	type View = 'all' | 'favourites' | 'recent';
	type Sort = 'classic' | 'name' | 'new';

	const PAGE = 90;
	let query = $state('');
	let view: View = $state('all');
	let kind = $state('');
	let theme = $state('');
	let flag = $state(false);
	let sort: Sort = $state('classic');
	let limit = $state(PAGE);
	let focus = $state(0);
	let sentinel: HTMLElement | undefined = $state();
	let grid: HTMLElement | undefined = $state();

	// An extra filter where it makes sense
	const FLAGS: Partial<Record<Category, { label: () => string; test: (p: Part) => boolean }>> = {
		head: { label: () => t('printed'), test: (p) => /pattern/i.test(p.name) },
		torso: { label: () => t('withArms'), test: (p) => !!p.arms }
	};
	const extra = $derived(FLAGS[cat]);

	const count = (list: (string | undefined)[]) => {
		const m = new Map<string, number>();
		for (const v of list) if (v) m.set(v, (m.get(v) ?? 0) + 1);
		return [...m].sort((a, b) => b[1] - a[1]);
	};
	const kinds = $derived(count(parts.map((p) => p.kind)));
	const themes = $derived(count(parts.map((p) => p.theme)));

	const shown = $derived.by(() => {
		let list = parts;
		if (view === 'favourites') list = list.filter((p) => prefs.favourites.includes(p.id));
		if (view === 'recent') {
			const order = new Map(prefs.recent.map((id, i) => [id, i]));
			list = list
				.filter((p) => order.has(p.id))
				.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
		}
		if (kind) list = list.filter((p) => p.kind === kind);
		if (theme) list = list.filter((p) => p.theme === theme);
		if (flag && extra) list = list.filter(extra.test);
		if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
		if (sort === 'new') list = [...list].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
		return search(list, query);
	});

	$effect(() => {
		// Back to the top whenever the list changes
		void [query, view, kind, theme, flag, sort, parts];
		limit = PAGE;
		focus = Math.max(
			0,
			shown.findIndex((p) => p.id === selected)
		);
	});

	$effect(() => {
		if (!sentinel) return;
		const io = new IntersectionObserver(([e]) => e.isIntersecting && (limit += PAGE), {
			rootMargin: '400px'
		});
		io.observe(sentinel);
		return () => io.disconnect();
	});

	// Arrow keys move between parts (one tab stop for the whole grid), F toggles a favourite
	function keydown(e: KeyboardEvent) {
		if (!grid || !shown.length) return;
		const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
		const step: Record<string, number> = {
			ArrowRight: 1,
			ArrowLeft: -1,
			ArrowDown: columns,
			ArrowUp: -columns,
			Home: -Infinity,
			End: Infinity
		};
		if (e.key in step) {
			e.preventDefault();
			e.stopPropagation();
			focus = Math.min(shown.length - 1, Math.max(0, focus + step[e.key]));
			if (focus >= limit) limit = focus + PAGE;
			requestAnimationFrame(() => {
				const el = grid?.querySelectorAll<HTMLElement>('.pick')[focus];
				el?.focus();
				el?.scrollIntoView({ block: 'nearest' });
			});
		} else if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) {
			const part = shown[focus];
			if (part) toggleFavourite(part.id);
		}
	}
</script>

<div class="picker">
	<div class="filters">
		<label class="search">
			<span class="sr-only">{t('searchLabel')}</span>
			<svg viewBox="0 0 20 20" aria-hidden="true"
				><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg
			>
			<input type="search" placeholder={t('search')} bind:value={query} />
		</label>
		<div class="views" role="group" aria-label={t('all')}>
			<button type="button" aria-pressed={view === 'all'} onclick={() => (view = 'all')}
				>{t('all')}</button
			>
			<button
				type="button"
				aria-pressed={view === 'favourites'}
				onclick={() => (view = 'favourites')}
				><span aria-hidden="true">★</span> {t('favourites')}</button
			>
			<button type="button" aria-pressed={view === 'recent'} onclick={() => (view = 'recent')}
				>{t('recent')}</button
			>
		</div>
	</div>

	<div class="row">
		{#if themes.length > 1}
			<label class="select">
				<span class="sr-only">{t('theme')}</span>
				<select bind:value={theme}>
					<option value="">{t('allThemes')}</option>
					{#each themes as [name, n] (name)}
						<option value={name}>{tn(name)} ({n})</option>
					{/each}
				</select>
			</label>
		{/if}
		<label class="select">
			<span class="sr-only">{t('sort')}</span>
			<select bind:value={sort}>
				<option value="classic">{t('sortClassic')}</option>
				<option value="name">{t('sortName')}</option>
				<option value="new">{t('sortNew')}</option>
			</select>
		</label>
		{#if extra}
			<label class="check">
				<input type="checkbox" bind:checked={flag} />
				<span>{extra.label()}</span>
			</label>
		{/if}
		<span class="count mono">{shown.length} / {parts.length}</span>
	</div>

	{#if kinds.length > 1}
		<div class="kinds" role="group" aria-label={t('type')}>
			<button type="button" aria-pressed={!kind} onclick={() => (kind = '')}>{t('all')}</button>
			{#each kinds as [k, n] (k)}
				<button type="button" aria-pressed={kind === k} onclick={() => (kind = k)}
					>{tn(k)} <span class="n">{n}</span></button
				>
			{/each}
		</div>
	{/if}

	<div class="scroll">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="grid" role="list" bind:this={grid} onkeydown={keydown}>
			{#each shown.slice(0, limit) as p, i (p.id)}
				{@const fav = isFavourite(p.id)}
				<div class="item" role="listitem" class:selected={p.id === selected}>
					<button
						type="button"
						class="pick"
						aria-pressed={p.id === selected}
						tabindex={i === focus ? 0 : -1}
						title="{p.name} · {p.id}{p.unofficial ? ` · ${t('unofficialPart')}` : ''}"
						onfocus={() => (focus = i)}
						onclick={() => onpick(p.id)}
					>
						<Thumb id={p.id} {color} cat={p.cat} />
						<span class="name">{shortName(p.name)}</span>
						<span class="id mono">{p.id}</span>
					</button>
					<button
						type="button"
						class="star"
						class:on={fav}
						tabindex="-1"
						title={fav ? t('unfavourite') : t('favourite')}
						aria-label={fav ? t('unfavourite') : t('favourite')}
						onclick={() => toggleFavourite(p.id)}>★</button
					>
				</div>
			{/each}
		</div>
		{#if shown.length > limit}
			<div bind:this={sentinel} class="sentinel"></div>
		{:else if !shown.length}
			<p class="nothing">
				{view === 'favourites' && !query
					? t('noFavourites')
					: view === 'recent' && !query
						? t('noRecent')
						: t('nothing')}
			</p>
		{/if}
	</div>
</div>

<style>
	/* Filters stay put, only the grid scrolls */
	.picker {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-height: 0;
		height: 100%;
	}
	.scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		margin: 0 -6px;
		padding: 2px 6px 16px;
		scrollbar-width: thin;
		scrollbar-color: var(--line) transparent;
	}
	.filters,
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.search {
		position: relative;
		flex: 1;
		min-width: 200px;
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
	input[type='search'],
	select {
		height: 36px;
		background: var(--card);
		border: 1.5px solid var(--line);
		border-radius: var(--radius);
	}
	input[type='search'] {
		width: 100%;
		padding: 0 12px 0 34px;
	}
	select {
		max-width: 100%;
		height: 32px;
		padding: 0 6px;
		font-size: 0.84rem;
		cursor: pointer;
	}
	.select {
		min-width: 0;
	}
	input:focus,
	select:focus {
		border-color: var(--ink);
		outline: none;
	}
	.count {
		margin-left: auto;
		color: var(--muted);
		white-space: nowrap;
	}
	.views {
		display: flex;
		gap: 2px;
		padding: 2px;
		border-radius: var(--radius);
		background: var(--sunk);
	}
	.views button {
		height: 32px;
		padding: 0 12px;
		border: 0;
		border-radius: 4px;
		background: none;
		color: var(--ink-2);
		font-size: 0.84rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.views button[aria-pressed='true'] {
		background: var(--card);
		color: var(--ink);
		box-shadow: 0 0 0 1.5px var(--ink);
	}
	.check {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.84rem;
		cursor: pointer;
		white-space: nowrap;
	}
	.check input {
		accent-color: var(--ink);
	}
	/* Kinds: one line of chips, scrolled sideways when they do not fit */
	.kinds {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		scrollbar-width: none;
		margin: 0 -2px;
		padding: 2px;
	}
	.kinds::-webkit-scrollbar {
		display: none;
	}
	.kinds button {
		flex: none;
		height: 28px;
		padding: 0 11px;
		border: 1.5px solid var(--line);
		border-radius: 14px;
		background: var(--card);
		color: var(--ink-2);
		font-weight: 600;
		font-size: 0.82rem;
	}
	.kinds button:hover {
		border-color: var(--ink-2);
	}
	.kinds button[aria-pressed='true'] {
		border-color: var(--ink);
		background: var(--ink);
		color: var(--paper);
	}
	.n {
		opacity: 0.55;
		font-weight: 500;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		gap: 8px;
	}
	.item {
		position: relative;
	}
	.pick {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		width: 100%;
		height: 100%;
		padding: 8px 6px 7px;
		background: var(--card);
		border: 1.5px solid transparent;
		border-radius: var(--radius);
		text-align: center;
	}
	.pick :global(.thumb) {
		width: 82%;
	}
	.pick:hover {
		border-color: var(--line);
	}
	.selected .pick {
		background: #fff3c4;
		border-color: var(--ink);
	}
	.name {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		font-size: 0.74rem;
		font-weight: 600;
		line-height: 1.2;
		color: var(--ink-2);
		overflow-wrap: anywhere;
	}
	.id {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--muted);
		font-size: 0.64rem;
	}
	.selected .name {
		color: var(--ink);
	}
	.star {
		position: absolute;
		top: 3px;
		right: 3px;
		width: 24px;
		height: 24px;
		padding: 0;
		border: 0;
		border-radius: 4px;
		background: none;
		color: var(--line);
		font-size: 1rem;
		line-height: 1;
		opacity: 0;
		transition: opacity 0.12s;
	}
	.item:hover .star,
	.item:focus-within .star,
	.star.on {
		opacity: 1;
	}
	@media (hover: none) {
		.star {
			opacity: 1;
		}
	}
	.star:hover {
		color: var(--ink-2);
	}
	.star.on {
		color: #e0a800;
	}
	.sentinel {
		height: 1px;
	}
	.nothing {
		color: var(--muted);
		margin: 24px 0;
	}
	@media (max-width: 520px) {
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
			gap: 6px;
		}
		.pick {
			padding: 6px 3px 6px;
		}
		.pick :global(.thumb) {
			width: 90%;
		}
		.name {
			font-size: 0.68rem;
		}
		/* The part number stays in the tooltip */
		.id {
			display: none;
		}
		.search {
			min-width: 100%;
		}
	}
</style>
