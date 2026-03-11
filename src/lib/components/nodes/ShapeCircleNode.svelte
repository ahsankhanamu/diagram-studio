<script lang="ts">
	import { NodeResizer } from '@xyflow/svelte';
	import NodeHandles from './NodeHandles.svelte';
	import EditableLabel from './EditableLabel.svelte';

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
		const size = Math.round(Math.max(params.width, params.height));
		updateNode(id, { size: { width: size, height: size } });
	}
</script>

<NodeResizer
	minWidth={40}
	minHeight={40}
	isVisible={selected}
	onResizeEnd={handleResizeEnd}
	lineStyle="border-color: {color};"
	handleStyle="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 2px;"
/>

<div
	class="flex items-center justify-center rounded-full border"
	style="
		background: {customStyle?.backgroundColor || `color-mix(in srgb, ${color} 8%, var(--color-bg-surface))`};
		border-color: {selected ? color : (customStyle?.borderColor || `color-mix(in srgb, ${color} 40%, var(--color-border-primary))`)};
		box-shadow: {selected ? `0 0 0 2px color-mix(in srgb, ${color} 30%, transparent), 0 4px 16px rgba(0,0,0,0.1)` : '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06)'};
		width: 100%; height: 100%;
		{customStyle?.fontSize ? `font-size: ${customStyle.fontSize}px;` : ''}
	"
>
	<EditableLabel {id} {label} class="text-xs font-medium text-center px-2" style="color: var(--color-text-primary);" />

	<NodeHandles {ports} {color} />
</div>
