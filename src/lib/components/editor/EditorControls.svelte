<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { viewport } from '$lib/stores/viewportStore';
	import { ZOOM_MIN, ZOOM_MAX } from '$lib/constants';
	import { Minus, Plus, ChevronDown, Crosshair, RotateCcw, Map as MapIcon } from 'lucide-svelte';
	import SnapSettingsPopover from './SnapSettingsPopover.svelte';

	interface Props {
		showMinimap: boolean;
	}

	let { showMinimap = $bindable(true) }: Props = $props();

	const { zoomIn, zoomOut, fitView, setViewport: setFlowViewport } = useSvelteFlow();

	const zoomPresets = [25, 50, 75, 100, 125, 150, 200];
	const zoomPercent = $derived(Math.round($viewport.zoom * 100));
	let showZoomDropdown = $state(false);
	function handleZoomOut() {
		zoomOut({ duration: 200 });
	}

	function handleZoomIn() {
		zoomIn({ duration: 200 });
	}

	function handlePresetClick(preset: number) {
		setFlowViewport({ x: $viewport.x, y: $viewport.y, zoom: preset / 100 }, { duration: 200 });
		showZoomDropdown = false;
	}

	function handleResetZoom() {
		setFlowViewport({ x: $viewport.x, y: $viewport.y, zoom: 1 }, { duration: 200 });
	}

	function handleCenterView() {
		fitView({ padding: 0.2, duration: 200 });
	}
</script>

<!-- Custom ZoomBar (positioned like venturi: centered bottom, pill, ghost opacity) -->
<div
	class="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border px-2 py-1.5 opacity-40 shadow-lg transition-opacity duration-200 hover:opacity-100"
	style="background: var(--color-bg-surface); border-color: var(--color-border-primary);"
>
	<button
		onclick={handleZoomOut}
		class="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
		style="color: var(--color-text-secondary);"
		title="Zoom out"
		onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
		onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
	>
		<Minus size={14} />
	</button>

	<div class="relative">
		<button
			onclick={() => (showZoomDropdown = !showZoomDropdown)}
			class="flex min-w-[56px] items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
			style="color: var(--color-text-secondary);"
		>
			{zoomPercent}%
			<ChevronDown
				size={10}
				style="transform: rotate({showZoomDropdown ? '180deg' : '0deg'}); transition: transform 0.15s;"
			/>
		</button>

		{#if showZoomDropdown}
			<div
				class="absolute bottom-full left-1/2 z-50 mb-2 min-w-[110px] -translate-x-1/2 rounded-lg border py-1 shadow-lg"
				style="background: var(--color-bg-surface); border-color: var(--color-border-primary);"
			>
				{#each zoomPresets as preset}
					<button
						onclick={() => handlePresetClick(preset)}
						class="flex w-full items-center justify-between px-3 py-1.5 text-xs transition-colors"
						style="color: {zoomPercent === preset ? 'var(--color-accent)' : 'var(--color-text-secondary)'};"
						onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
						onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
					>
						{preset}%
						{#if zoomPercent === preset}
							<div class="h-1.5 w-1.5 rounded-full" style="background: var(--color-accent);"></div>
						{/if}
					</button>
				{/each}
				<div class="my-1 border-t" style="border-color: var(--color-border-primary);"></div>
				<button
					onclick={handleCenterView}
					class="flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors"
					style="color: var(--color-text-secondary);"
					onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
				>
						Fit to screen
				</button>
			</div>
		{/if}
	</div>

	<button
		onclick={handleZoomIn}
		class="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
		style="color: var(--color-text-secondary);"
		title="Zoom in"
		onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
		onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
	>
		<Plus size={14} />
	</button>

	<div class="mx-1 h-5 w-px" style="background: var(--color-border-primary);"></div>

	<button
		onclick={handleCenterView}
		class="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
		style="color: var(--color-text-secondary);"
		title="Center view"
		onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
		onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
	>
		<Crosshair size={14} />
	</button>

	<button
		onclick={handleResetZoom}
		class="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
		style="color: var(--color-text-secondary);"
		title="Reset to 100%"
		onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
		onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
	>
		<RotateCcw size={14} />
	</button>

	<button
		onclick={() => (showMinimap = !showMinimap)}
		class="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
		style="color: {showMinimap ? 'var(--color-accent)' : 'var(--color-text-muted)'};"
		title="Toggle minimap"
		onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
		onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
	>
		<MapIcon size={14} />
	</button>

	<SnapSettingsPopover />
</div>

<!-- Keyboard hints -->
<div
	class="absolute bottom-4 left-14 z-20 rounded-md border px-2.5 py-1.5 text-[10px] opacity-40 shadow-sm transition-opacity duration-200 hover:opacity-100"
	style="background: var(--color-bg-surface); border-color: var(--color-border-primary); color: var(--color-text-tertiary);"
>
	<kbd class="kbd-key">Drag</kbd> select
	· <kbd class="kbd-key">Scroll</kbd> pan
	· <kbd class="kbd-key">Ctrl</kbd>+<kbd class="kbd-key">Scroll</kbd> zoom
	· <kbd class="kbd-key">Space</kbd>+<kbd class="kbd-key">Drag</kbd> pan
	· <kbd class="kbd-key">Del</kbd> delete
</div>
