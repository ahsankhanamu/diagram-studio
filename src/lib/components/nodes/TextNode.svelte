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

	const label = $derived((data.label as string) || 'Text');
	const color = 'var(--color-accent)';
	const customStyle = $derived(data.customStyle as Record<string, string> | undefined);
	const ports = $derived(
		(data.ports as { top: boolean; bottom: boolean; left: boolean; right: boolean }) || {
			top: false, bottom: false, left: false, right: false
		}
	);

	function handleResizeEnd(_event: unknown, params: { width: number; height: number }) {
		updateNode(id, { size: { width: Math.round(params.width), height: Math.round(params.height) } });
	}
</script>

<NodeResizer
	minWidth={30}
	minHeight={20}
	isVisible={selected}
	onResizeEnd={handleResizeEnd}
	lineStyle="border-color: {color};"
	handleStyle="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 2px;"
/>

<div
	class="flex items-center justify-center px-3 py-1"
	style="
		background: transparent;
		border: {selected ? '1px dashed color-mix(in srgb, var(--color-accent) 50%, transparent)' : '1px dashed transparent'};
		border-radius: 4px;
		width: 100%; height: 100%;
		{customStyle?.fontSize ? `font-size: ${customStyle.fontSize}px;` : 'font-size: 14px;'}
	"
>
	<EditableLabel {id} {label} class="font-medium whitespace-pre-wrap" style="color: {customStyle?.backgroundColor || 'var(--color-text-primary)'};" />

	<NodeHandles {ports} {color} />
</div>
