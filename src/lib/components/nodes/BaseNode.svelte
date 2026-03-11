<script lang="ts">
	import { NodeResizer } from '@xyflow/svelte';
	import type { Snippet } from 'svelte';
	import NodeHandles from './NodeHandles.svelte';
	import EditableLabel from './EditableLabel.svelte';
	import { updateNode } from '$lib/stores/diagramStore';


	interface Props {
		id: string;
		data: Record<string, unknown>;
		selected?: boolean;
		color?: string;
		children?: Snippet;
	}

	const { id, data, selected = false, color = 'var(--color-node-process)', children }: Props = $props();

	const label = $derived((data.label as string) || '');
	const ports = $derived(
		(data.ports as { top: boolean; bottom: boolean; left: boolean; right: boolean }) || {
			top: true,
			bottom: true,
			left: true,
			right: true
		}
	);
	const customStyle = $derived(data.customStyle as Record<string, string> | undefined);
	const borderStyle = $derived(customStyle?.borderStyle || 'solid');
	const borderDash = $derived(borderStyle === 'dashed' ? 'dashed' : borderStyle === 'dotted' ? 'dotted' : 'solid');
	const effectiveColor = $derived(customStyle?.borderColor || color);

	function handleResizeEnd(_event: unknown, params: { width: number; height: number }) {
		updateNode(id, { size: { width: Math.round(params.width), height: Math.round(params.height) } });
	}


</script>

<NodeResizer
	minWidth={100}
	minHeight={40}
	isVisible={selected}
	onResizeEnd={handleResizeEnd}
	lineStyle="border-color: {color};"
	handleStyle="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 2px;"
/>

<div
	class="node-card rounded-lg border transition-shadow duration-150"
	style="
		background: {customStyle?.backgroundColor || 'var(--color-bg-surface)'};
		border-color: {selected ? effectiveColor : (customStyle?.borderColor || 'var(--color-border-primary)')};
		border-style: {borderStyle === 'none' ? 'solid' : borderDash};
		{borderStyle === 'none' ? 'border-color: transparent;' : ''}
		box-shadow: {selected ? `0 0 0 2px color-mix(in srgb, ${effectiveColor} 30%, transparent), 0 4px 16px rgba(0,0,0,0.1)` : '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06)'};
		width: 100%; height: 100%;
		{customStyle?.fontSize ? `font-size: ${customStyle.fontSize}px;` : ''}
	"
>
	{#if children}
		{@render children()}
	{:else}
		<!-- Header with colored tint -->
		<div
			class="flex items-center gap-2 rounded-t-lg border-b px-3 py-2"
			style="background: linear-gradient(135deg, color-mix(in srgb, {effectiveColor} 12%, var(--color-bg-surface)), color-mix(in srgb, {effectiveColor} 4%, var(--color-bg-surface))); border-color: var(--color-border-subtle);"
		>
			<div
				class="flex h-5 w-5 items-center justify-center rounded"
				style="background: color-mix(in srgb, {color} 25%, transparent); color: {color};"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="3" width="18" height="18" rx="2" />
				</svg>
			</div>
			<EditableLabel {id} {label} class="flex-1 truncate text-xs font-semibold" style="color: var(--color-text-primary);" />
		</div>
		<div class="px-3 py-1.5">
			<p class="text-[10px] leading-tight" style="color: var(--color-text-muted);">
				{data.description || ''}
			</p>
		</div>
	{/if}

	<NodeHandles {ports} {color} />
</div>
