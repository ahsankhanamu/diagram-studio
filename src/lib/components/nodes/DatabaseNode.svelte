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
	const color = 'var(--color-node-database)';
	const customStyle = $derived(data.customStyle as Record<string, string> | undefined);
	const effectiveColor = $derived(customStyle?.borderColor || color);
	const borderStyle = $derived(customStyle?.borderStyle || 'solid');
	const strokeDash = $derived(borderStyle === 'dashed' ? '8 4' : borderStyle === 'dotted' ? '3 3' : '');
	const strokeColor = $derived(borderStyle === 'none' ? 'transparent' : (selected ? effectiveColor : `color-mix(in srgb, ${effectiveColor} 40%, var(--color-border-primary))`));
	const fillColor = $derived(`color-mix(in srgb, ${effectiveColor} 8%, var(--color-bg-surface))`);
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
	minWidth={60}
	minHeight={48}
	isVisible={selected}
	onResizeEnd={handleResizeEnd}
	lineStyle="border-color: {color};"
	handleStyle="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 2px;"
/>

<div class="relative" style="width: 100%; height: 100%;">
	<svg viewBox="0 0 120 72" class="w-full h-full" preserveAspectRatio="none" style="filter: {selected ? `drop-shadow(0 0 4px var(--color-node-database))` : 'drop-shadow(0 1px 2px rgba(0,0,0,0.04)) drop-shadow(0 2px 8px rgba(0,0,0,0.06))'};">
		<!-- Top ellipse -->
		<ellipse cx="60" cy="12" rx="58" ry="10" fill={fillColor} stroke={strokeColor} stroke-width="1.5" stroke-dasharray={strokeDash} />
		<!-- Body sides -->
		<line x1="2" y1="12" x2="2" y2="58" stroke={strokeColor} stroke-width="1.5" stroke-dasharray={strokeDash} />
		<line x1="118" y1="12" x2="118" y2="58" stroke={strokeColor} stroke-width="1.5" stroke-dasharray={strokeDash} />
		<!-- Body fill -->
		<rect x="2" y="12" width="116" height="46" fill={fillColor} />
		<!-- Bottom ellipse -->
		<ellipse cx="60" cy="58" rx="58" ry="10" fill={fillColor} stroke={strokeColor} stroke-width="1.5" stroke-dasharray={strokeDash} />
		<!-- Re-draw top ellipse on top -->
		<ellipse cx="60" cy="12" rx="58" ry="10" fill={fillColor} stroke={strokeColor} stroke-width="1.5" stroke-dasharray={strokeDash} />
	</svg>
	<span class="absolute inset-0 flex items-center justify-center text-[11px] font-medium" style="color: var(--color-text-primary);"><EditableLabel {id} {label} /></span>

	<NodeHandles {ports} {color} />
</div>
