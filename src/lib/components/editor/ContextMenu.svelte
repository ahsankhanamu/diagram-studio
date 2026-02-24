<script lang="ts">
	import { onMount } from 'svelte';

	export interface MenuItem {
		label: string;
		icon?: any;
		action: () => void;
		separator?: boolean;
		disabled?: boolean;
	}

	interface Props {
		x: number;
		y: number;
		items: MenuItem[];
		onClose: () => void;
	}

	const { x, y, items, onClose }: Props = $props();

	let menuEl: HTMLDivElement | undefined = $state();

	onMount(() => {
		function handleClick(e: MouseEvent) {
			if (menuEl && !menuEl.contains(e.target as Node)) onClose();
		}
		function handleKey(e: KeyboardEvent) {
			if (e.key === 'Escape') onClose();
		}
		document.addEventListener('mousedown', handleClick);
		document.addEventListener('keydown', handleKey);
		return () => {
			document.removeEventListener('mousedown', handleClick);
			document.removeEventListener('keydown', handleKey);
		};
	});

	// Ensure menu stays within viewport
	const adjustedX = $derived(Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 200));
	const adjustedY = $derived(Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 300));
</script>

<div
	bind:this={menuEl}
	class="context-menu fixed z-[100] min-w-[160px] overflow-hidden py-1"
	style="left: {adjustedX}px; top: {adjustedY}px;"
>
	{#each items as item}
		{#if item.separator}
			<div class="my-1 border-t" style="border-color: var(--color-border-subtle);"></div>
		{:else}
			<button
				onclick={() => { item.action(); onClose(); }}
				disabled={item.disabled}
				class="context-menu-item flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs"
				style="color: {item.disabled ? 'var(--color-text-muted)' : 'var(--color-text-secondary)'};"
			>
				{item.label}
			</button>
		{/if}
	{/each}
</div>
