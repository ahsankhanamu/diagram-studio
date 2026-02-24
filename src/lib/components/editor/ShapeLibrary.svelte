<script lang="ts">
	import { onMount } from 'svelte';
	import { Trash2, Package } from 'lucide-svelte';
	import { shapePresets, loadLibrary, deleteShape } from '$lib/stores/shapeLibraryStore';
	import { nodeRegistry } from '$lib/components/nodes';

	onMount(() => {
		loadLibrary();
	});

	function handleDragStart(event: DragEvent, preset: typeof $shapePresets[0]) {
		if (!event.dataTransfer) return;
		event.dataTransfer.setData('application/diagram-node-type', preset.nodeType);
		event.dataTransfer.effectAllowed = 'move';
	}
</script>

<div class="flex flex-1 flex-col overflow-hidden">
	<div class="flex-1 overflow-y-auto p-2">
		{#if $shapePresets.length === 0}
			<div class="flex flex-col items-center justify-center p-4 text-center">
				<Package size={24} style="color: var(--color-text-muted); margin-bottom: 8px;" />
				<p class="text-[11px]" style="color: var(--color-text-muted);">
					No saved shapes yet. Right-click a node and select "Save to Library" to add presets.
				</p>
			</div>
		{:else}
			<div class="space-y-1">
				{#each $shapePresets as preset}
					{@const def = nodeRegistry[preset.nodeType]}
					<div
						class="flex cursor-grab items-center gap-2 rounded-md border px-2 py-1.5 transition-colors active:cursor-grabbing"
						style="border-color: var(--color-border-subtle); background: var(--color-bg-surface-secondary);"
						draggable="true"
						ondragstart={(e) => handleDragStart(e, preset)}
						onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-primary)')}
						onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-subtle)')}
					>
						<div
							class="flex h-5 w-5 shrink-0 items-center justify-center rounded"
							style="background: color-mix(in srgb, var({def?.color || '--color-accent'}) 15%, transparent); color: var({def?.color || '--color-accent'});"
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<rect x="3" y="3" width="18" height="18" rx="2" />
							</svg>
						</div>
						<div class="min-w-0 flex-1">
							<span class="block truncate text-[11px] font-medium" style="color: var(--color-text-primary);">
								{preset.name}
							</span>
							<span class="block text-[9px]" style="color: var(--color-text-muted);">
								{preset.nodeType}
							</span>
						</div>
						<button
							onclick={() => deleteShape(preset.id)}
							class="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity"
							style="color: var(--color-text-muted);"
							onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = 'var(--color-error-text)'; }}
							onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; }}
						>
							<Trash2 size={10} />
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
