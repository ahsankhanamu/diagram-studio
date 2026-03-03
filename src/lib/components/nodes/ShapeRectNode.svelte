<script lang="ts">
	import { NodeResizer } from '@xyflow/svelte';
	import NodeHandles from './NodeHandles.svelte';
	import { updateNode } from '$lib/stores/diagramStore';

	interface Props {
		id: string;
		data: Record<string, unknown>;
		selected?: boolean;
	}

	const { id, data, selected = false }: Props = $props();

	const label = $derived((data.label as string) || '');
	const color = 'var(--color-accent)';
	const customStyle = $derived(data.customStyle as Record<string, string> | undefined);
	const ports = $derived(
		(data.ports as { top: boolean; bottom: boolean; left: boolean; right: boolean }) || {
			top: true, bottom: true, left: true, right: true
		}
	);

	function handleResizeEnd(_event: unknown, params: { width: number; height: number }) {
		updateNode(id, { size: { width: Math.round(params.width), height: Math.round(params.height) } });
	}
</script>

<NodeResizer
	minWidth={40}
	minHeight={30}
	isVisible={selected}
	onResizeEnd={handleResizeEnd}
	lineStyle="border-color: {color};"
	handleStyle="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 2px;"
/>

<div
	class="flex items-center justify-center rounded-md border"
	style="
		background: {customStyle?.backgroundColor || 'var(--color-bg-surface)'};
		border-color: {selected ? color : (customStyle?.borderColor || 'var(--color-border-primary)')};
		box-shadow: {selected ? `0 0 0 2px color-mix(in srgb, ${color} 30%, transparent)` : '0 1px 3px var(--color-shadow)'};
		width: 100%; height: 100%;
		{customStyle?.fontSize ? `font-size: ${customStyle.fontSize}px;` : ''}
	"
>
	<span class="text-xs font-medium" style="color: var(--color-text-primary);">{label}</span>

	<NodeHandles {ports} {color} />
</div>
