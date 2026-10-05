<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';
	import { asset } from '$app/paths';
	import { library } from '#lib/ldraw.ts';

	// Parts are served from static/ldraw/, under the base path on GitHub Pages
	library.base = asset('ldraw/catalog.json').replace(/catalog\.json$/, '');

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
