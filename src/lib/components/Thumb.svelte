<script lang="ts">
	import { thumbnail } from '#lib/thumbs.ts';

	let { id, color }: { id: string; color: number } = $props();

	let el: HTMLElement;
	let visible = $state(false);
	let src = $state('');
	let failed = $state(false);

	$effect(() => {
		const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), {
			rootMargin: '200px'
		});
		io.observe(el);
		return () => io.disconnect();
	});

	$effect(() => {
		if (!visible) return;
		let alive = true;
		failed = false;
		thumbnail(id, color, () => alive && visible)
			.then((url) => alive && (src = url))
			.catch((e: Error) => alive && e.message !== 'skipped' && (failed = true));
		return () => (alive = false);
	});
</script>

<span class="thumb" bind:this={el}>
	{#if src}
		<img {src} alt="" draggable="false" />
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
