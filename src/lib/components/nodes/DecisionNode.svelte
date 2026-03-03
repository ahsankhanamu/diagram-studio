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
			left: true,
			right: true
		}
	);

	function handleResizeEnd(_event: unknown, params: { width: number; height: number }) {
		const size = Math.round(Math.max(params.width, params.height));
		updateNode(id, { size: { width: size, height: size } });
	}
</script>

<NodeResizer
	minWidth={60}
	minHeight={60}
	isVisible={selected}
	onResizeEnd={handleResizeEnd}
	lineStyle="border-color: {color};"
	handleStyle="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 2px;"
/>

<div class="relative flex items-center justify-center" style="width: 100%; height: 100%;">
	<div
		class="flex items-center justify-center border"
		style="
			width: 72%;
			height: 72%;
			transform: rotate(45deg);
			background: var(--color-bg-surface);
			border-color: {selected ? color : 'var(--color-border-primary)'};
			box-shadow: {selected ? `0 0 0 2px color-mix(in srgb, ${color} 30%, transparent)` : '0 1px 3px var(--color-shadow)'};
			border-radius: 3px;
		"
	>
		<span
			class="text-[10px] font-medium"
			style="transform: rotate(-45deg); color: var(--color-text-primary); max-width: 50px; text-align: center; overflow: hidden; text-overflow: ellipsis; display: block;"
		>
			{label}
		</span>
	</div>

	<NodeHandles {ports} {color} />
</div>
