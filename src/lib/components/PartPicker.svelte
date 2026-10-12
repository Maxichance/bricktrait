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
			<svg viewBox="0 0 20 20" aria-hidden="true">
				<circle cx="8.5" cy="8.5" r="5.5" />
				<path d="m13 13 4 4" />
			</svg>
			<input type="search" placeholder={t('search')} bind:value={query} />
			{#if query}
				<button type="button" class="clear-btn" aria-label="Clear" onclick={() => (query = '')}
					>×</button
				>
			{/if}
		</label>
		<div class="views" role="group" aria-label={t('all')}>
			<button type="button" aria-pressed={view === 'all'} onclick={() => (view = 'all')}>
				{t('all')}
			</button>
			<button
				type="button"
				class="fav-btn"
				aria-pressed={view === 'favourites'}
				onclick={() => (view = 'favourites')}
			>
				<span class="star-icon" aria-hidden="true">★</span>
				<span>{t('favourites')}</span>
			</button>
			<button type="button" aria-pressed={view === 'recent'} onclick={() => (view = 'recent')}>
				{t('recent')}
			</button>
		</div>
	</div>

	<div class="sub-filters">
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
			<button type="button" aria-pressed={!kind} onclick={() => (kind = '')}>
				<span>{t('all')}</span>
			</button>
			{#each kinds as [k, n] (k)}
				<button type="button" aria-pressed={kind === k} onclick={() => (kind = k)}>
					<span>{tn(k)}</span>
					<span class="n">{n}</span>
				</button>
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
						<div class="thumb-wrap">
							<Thumb id={p.id} {color} cat={p.cat} />
						</div>
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
						onclick={(e) => {
							e.stopPropagation();
							toggleFavourite(p.id);
						}}>★</button
					>
				</div>
			{/each}
		</div>
		{#if shown.length > limit}
			<div bind:this={sentinel} class="sentinel"></div>
		{:else if !shown.length}
			<div class="empty-state">
				<p class="nothing">
					{view === 'favourites' && !query
						? t('noFavourites')
						: view === 'recent' && !query
							? t('noRecent')
							: t('nothing')}
				</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-height: 0;
		height: 100%;
		min-width: 0;
		max-width: 100%;
		width: 100%;
		overflow: hidden;
		box-sizing: border-box;
	}

	.scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		margin: 0;
		padding: 2px 2px 16px;
		scrollbar-width: thin;
		min-width: 0;
		max-width: 100%;
		width: 100%;
		box-sizing: border-box;
	}

	.filters {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		max-width: 100%;
		width: 100%;
		box-sizing: border-box;
	}

	.sub-filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		min-width: 0;
		max-width: 100%;
		width: 100%;
		box-sizing: border-box;
	}

	.search {
		position: relative;
		flex: 1 1 auto;
		min-width: 0;
	}

	.search svg {
		position: absolute;
		left: 10px;
		top: 50%;
		width: 14px;
		height: 14px;
		transform: translateY(-50%);
		fill: none;
		stroke: var(--muted);
		stroke-width: 2.2;
		stroke-linecap: round;
		stroke-linejoin: round;
		pointer-events: none;
	}

	input[type='search'],
	select {
		height: 32px;
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		color: var(--ink);
		font-size: 0.82rem;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}

	input[type='search'] {
		width: 100%;
		padding: 0 32px 0 36px;
	}

	.clear-btn {
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
		width: 20px;
		height: 20px;
		display: grid;
		place-items: center;
		color: var(--muted);
		font-size: 1.1rem;
		line-height: 1;
		border-radius: 50%;
		transition: color 0.12s;
	}
	.clear-btn:hover {
		color: var(--ink);
	}

	select {
		max-width: 100%;
		height: 32px;
		padding: 0 10px;
		font-size: 0.82rem;
		font-weight: 500;
		cursor: pointer;
		background-color: var(--card);
	}

	.select {
		min-width: 0;
	}

	input:focus,
	select:focus {
		border-color: var(--yellow);
		outline: none;
		box-shadow: 0 0 0 1px var(--yellow);
	}

	.count {
		margin-left: auto;
		color: var(--muted);
		font-size: 0.76rem;
		white-space: nowrap;
	}

	.views {
		display: flex;
		gap: 3px;
		padding: 3px;
		border-radius: var(--radius-sm);
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid var(--line);
	}

	.views button {
		display: flex;
		align-items: center;
		gap: 5px;
		height: 30px;
		padding: 0 12px;
		border: 0;
		border-radius: 4px;
		background: none;
		color: var(--ink-2);
		font-size: 0.82rem;
		font-weight: 600;
		white-space: nowrap;
		transition: all 0.14s ease;
	}

	.views button:hover {
		color: #ffffff;
	}

	.views button[aria-pressed='true'] {
		background: var(--card-hover);
		color: #ffffff;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
	}

	.fav-btn[aria-pressed='true'] .star-icon {
		color: var(--yellow);
	}

	.check {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 0.82rem;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
		color: var(--ink-2);
	}

	.check input {
		accent-color: var(--yellow);
		width: 15px;
		height: 15px;
		cursor: pointer;
	}

	/* Kinds Chips: Modern horizontal scrollable pills */
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
		display: flex;
		align-items: center;
		gap: 5px;
		flex: none;
		height: 28px;
		padding: 0 11px;
		border: 1px solid var(--line);
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.03);
		color: var(--ink-2);
		font-weight: 600;
		font-size: 0.78rem;
		transition: all 0.14s ease;
	}

	.kinds button:hover {
		border-color: var(--line-focus);
		color: var(--ink);
		background: rgba(255, 255, 255, 0.06);
	}

	.kinds button[aria-pressed='true'] {
		border-color: rgba(255, 208, 0, 0.4);
		background: rgba(255, 208, 0, 0.12);
		color: var(--yellow);
	}

	.n {
		opacity: 0.6;
		font-size: 0.7rem;
		font-weight: 500;
	}

	/* Parts Grid */
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
		gap: 8px;
		width: 100%;
		max-width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}

	.item {
		position: relative;
		min-width: 0;
		box-sizing: border-box;
	}

	.pick {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		width: 100%;
		height: 100%;
		min-width: 0;
		box-sizing: border-box;
		padding: 8px 5px 6px;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		text-align: center;
		transition: all 0.16s cubic-bezier(0.16, 1, 0.3, 1);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
	}

	.thumb-wrap {
		width: 100%;
		max-width: 60px;
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.pick:hover .thumb-wrap {
		transform: scale(1.08) translateY(-2px);
	}

	.pick:hover {
		border-color: var(--line-focus);
		background: var(--card-hover);
		transform: translateY(-2px);
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
	}

	.selected .pick {
		background: rgba(255, 208, 0, 0.08);
		border-color: var(--yellow);
		box-shadow:
			0 0 0 1px var(--yellow),
			0 0 16px var(--yellow-glow),
			0 4px 12px rgba(0, 0, 0, 0.4);
		transform: translateY(-1.5px);
	}

	.name {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		font-size: 0.72rem;
		font-weight: 600;
		line-height: 1.25;
		color: var(--ink-2);
		overflow-wrap: anywhere;
		margin-top: 2px;
	}

	.id {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--muted);
		font-size: 0.62rem;
		opacity: 0.8;
	}

	.selected .name {
		color: #ffffff;
		font-weight: 700;
	}

	.star {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 24px;
		height: 24px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.4);
		color: rgba(255, 255, 255, 0.3);
		font-size: 0.95rem;
		line-height: 1;
		opacity: 0;
		transform: scale(0.85);
		transition: all 0.14s ease;
		display: grid;
		place-items: center;
	}

	.item:hover .star,
	.item:focus-within .star,
	.star.on {
		opacity: 1;
		transform: scale(1);
	}

	@media (hover: none) {
		.star {
			opacity: 1;
			transform: scale(1);
		}
	}

	.star:hover {
		color: #ffffff;
		transform: scale(1.15);
	}

	.star.on {
		color: var(--yellow);
		background: rgba(0, 0, 0, 0.6);
		text-shadow: 0 0 8px var(--yellow-glow);
	}

	.sentinel {
		height: 1px;
	}

	.empty-state {
		display: grid;
		place-items: center;
		padding: 32px 16px;
	}

	.nothing {
		color: var(--muted);
		font-size: 0.88rem;
		text-align: center;
		margin: 0;
	}

	@media (max-width: 520px) {
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
			gap: 6px;
		}
		.pick {
			padding: 8px 4px 6px;
		}
		.thumb-wrap {
			max-width: 54px;
		}
		.name {
			font-size: 0.68rem;
		}
		.id {
			display: none;
		}
		.search {
			min-width: 100%;
		}
	}
</style>
