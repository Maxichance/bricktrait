<script lang="ts">
	import type { Category } from '#lib/ldraw.ts';
	import { staticThumb, THUMB_COLORS, thumbnail } from '#lib/thumbs.ts';

	let { id, color, cat }: { id: string; color: number; cat: Category } = $props();

	let el: HTMLElement;
	let visible = $state(false);
	let live = $state('');
	let missing = $state(false);
	let failed = $state(false);

	// The pre-rendered image is shown right away; another colour, or a missing
	// image, gets a live render once the thumbnail scrolls into view.
	const needsLive = $derived(missing || color !== THUMB_COLORS[cat]);

	$effect(() => {
		void id;
		missing = false;
		live = '';
	});

	$effect(() => {
		const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), {
			rootMargin: '200px'
		});
		io.observe(el);
		return () => io.disconnect();
	});

	$effect(() => {
		if (!visible || !needsLive) return;
		let alive = true;
		failed = false;
		thumbnail(id, color, () => alive && visible)
			.then((url) => alive && (live = url))
			.catch((e: Error) => alive && e.message !== 'skipped' && (failed = true));
		return () => (alive = false);
	});
</script>

<span class="thumb" bind:this={el}>
	{#if live && needsLive}
		<img src={live} alt="" draggable="false" />
	{:else if !missing}
		<img
			src={staticThumb(id)}
			alt=""
			draggable="false"
			loading="lazy"
			decoding="async"
			class:stale={needsLive}
			onerror={() => (missing = true)}
		/>
	{:else if failed}
		<span class="err" aria-hidden="true">?</span>
	{:else}
		<span class="wait" aria-hidden="true"></span>
	{/if}
</span>

<style>
	.thumb {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		width: 100%;
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		transition: opacity 0.2s;
	}
	/* Default colour shown while the right one renders */
	img.stale {
		opacity: 0.55;
	}
	.wait {
		width: 40%;
		aspect-ratio: 1;
		border-radius: 50%;
		background: var(--line);
		animation: pulse 1.2s ease-in-out infinite;
	}
	.err {
		color: var(--muted);
	}
	@keyframes pulse {
		50% {
			opacity: 0.4;
		}
	}
</style>
