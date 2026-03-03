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
	const color = 'var(--color-node-architecture)';
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
	<svg viewBox="0 0 120 72" class="w-full h-full" preserveAspectRatio="none" style="filter: {selected ? `drop-shadow(0 0 2px var(--color-node-architecture))` : 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'};">
		<!-- Top ellipse -->
		<ellipse cx="60" cy="12" rx="58" ry="10" fill="var(--color-bg-surface)" stroke={selected ? color : 'var(--color-border-primary)'} stroke-width="1.5" />
		<!-- Body sides -->
		<line x1="2" y1="12" x2="2" y2="58" stroke={selected ? color : 'var(--color-border-primary)'} stroke-width="1.5" />
		<line x1="118" y1="12" x2="118" y2="58" stroke={selected ? color : 'var(--color-border-primary)'} stroke-width="1.5" />
		<!-- Body fill -->
		<rect x="2" y="12" width="116" height="46" fill="var(--color-bg-surface)" />
		<!-- Bottom ellipse -->
		<ellipse cx="60" cy="58" rx="58" ry="10" fill="var(--color-bg-surface)" stroke={selected ? color : 'var(--color-border-primary)'} stroke-width="1.5" />
		<!-- Re-draw top ellipse on top -->
		<ellipse cx="60" cy="12" rx="58" ry="10" fill="var(--color-bg-surface)" stroke={selected ? color : 'var(--color-border-primary)'} stroke-width="1.5" />
	</svg>
	<span class="absolute inset-0 flex items-center justify-center text-[11px] font-medium" style="color: var(--color-text-primary);">{label}</span>

	<NodeHandles {ports} {color} />
</div>
