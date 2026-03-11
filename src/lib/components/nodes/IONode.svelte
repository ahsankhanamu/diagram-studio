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
	const color = 'var(--color-node-io)';
	const customStyle = $derived(data.customStyle as Record<string, string> | undefined);
	const effectiveColor = $derived(customStyle?.borderColor || color);
	const borderStyle = $derived(customStyle?.borderStyle || 'solid');
	const strokeDash = $derived(borderStyle === 'dashed' ? '8 4' : borderStyle === 'dotted' ? '3 3' : '');
	const ports = $derived(
		(data.ports as { top: boolean; bottom: boolean; left: boolean; right: boolean }) || {
			top: true, bottom: true, left: true, right: true
		}
	);
	const nodeWidth = $derived(Number(data.nodeWidth) || 150);
	const nodeHeight = $derived(Number(data.nodeHeight) || 48);

	function handleResizeEnd(_event: unknown, params: { width: number; height: number }) {
		updateNode(id, { size: { width: Math.round(params.width), height: Math.round(params.height) } });
	}
</script>

<NodeResizer
	minWidth={80}
	minHeight={32}
	isVisible={selected}
	onResizeEnd={handleResizeEnd}
	lineStyle="border-color: {color};"
	handleStyle="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 2px;"
/>

<div class="relative" style="width: 100%; height: 100%;">
	<svg viewBox="0 0 150 48" class="w-full h-full" preserveAspectRatio="none" style="filter: {selected ? `drop-shadow(0 0 4px var(--color-node-io))` : 'drop-shadow(0 1px 2px rgba(0,0,0,0.04)) drop-shadow(0 2px 8px rgba(0,0,0,0.06))'};">
		<polygon
			points="20,0 150,0 130,48 0,48"
			fill={`color-mix(in srgb, ${effectiveColor} 8%, var(--color-bg-surface))`}
			stroke={borderStyle === 'none' ? 'transparent' : (selected ? effectiveColor : `color-mix(in srgb, ${effectiveColor} 40%, var(--color-border-primary))`)}
			stroke-width="1.5"
			stroke-dasharray={strokeDash}
		/>
	</svg>
	<span class="absolute inset-0 flex items-center justify-center text-[11px] font-medium" style="color: var(--color-text-primary); padding-left: 16px;"><EditableLabel {id} {label} /></span>

	<NodeHandles {ports} {color} />
</div>
