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
	const color = 'var(--color-node-terminal)';
	const customStyle = $derived(data.customStyle as Record<string, string> | undefined);
	const effectiveColor = $derived(customStyle?.borderColor || color);
	const borderStyle = $derived(customStyle?.borderStyle || 'solid');
	const borderDash = $derived(borderStyle === 'dashed' ? 'dashed' : borderStyle === 'dotted' ? 'dotted' : 'solid');
	const ports = $derived(
		(data.ports as { top: boolean; bottom: boolean; left: boolean; right: boolean }) || {
			top: true,
			bottom: true,
			left: false,
			right: false
		}
	);

	function handleResizeEnd(_event: unknown, params: { width: number; height: number }) {
		updateNode(id, { size: { width: Math.round(params.width), height: Math.round(params.height) } });
	}
</script>

<NodeResizer
	minWidth={60}
	minHeight={28}
	isVisible={selected}
	onResizeEnd={handleResizeEnd}
	lineStyle="border-color: {color};"
	handleStyle="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 2px;"
/>

<div
	class="relative flex items-center justify-center rounded-full border px-4 py-2"
	style="
		background: color-mix(in srgb, ${effectiveColor} 8%, var(--color-bg-surface));
		border-color: {borderStyle === 'none' ? 'transparent' : (selected ? effectiveColor : `color-mix(in srgb, ${effectiveColor} 40%, var(--color-border-primary))`)};
		border-style: {borderStyle === 'none' ? 'solid' : borderDash};
		box-shadow: {selected ? `0 0 0 2px color-mix(in srgb, ${effectiveColor} 30%, transparent), 0 4px 16px rgba(0,0,0,0.1)` : '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06)'};
		width: 100%; height: 100%;
	"
>
	<EditableLabel {id} {label} class="text-[11px] font-medium" style="color: var(--color-text-primary);" />

	<NodeHandles {ports} {color} />
</div>
