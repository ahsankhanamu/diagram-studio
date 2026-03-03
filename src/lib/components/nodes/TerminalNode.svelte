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
	const color = 'var(--color-node-flowchart)';
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
		background: var(--color-bg-surface);
		border-color: {selected ? color : 'var(--color-border-primary)'};
		box-shadow: {selected ? `0 0 0 2px color-mix(in srgb, ${color} 30%, transparent)` : '0 1px 3px var(--color-shadow)'};
		width: 100%; height: 100%;
	"
>
	<span class="text-[11px] font-medium" style="color: var(--color-text-primary);">{label}</span>

	<NodeHandles {ports} {color} />
</div>
