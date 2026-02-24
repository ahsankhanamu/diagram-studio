<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { initTheme } from '$lib/stores/themeStore';

	const { children } = $props();

	onMount(() => {
		initTheme();
	});
</script>

<div class="h-screen" style="background: var(--color-bg-base); color: var(--color-text-primary);">
	{@render children()}
</div>
