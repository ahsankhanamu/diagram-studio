<script lang="ts">
	import { NodeResizer } from '@xyflow/svelte';
	import { updateNode } from '$lib/stores/diagramStore';

	interface Props {
		id: string;
		data: Record<string, unknown>;
		selected?: boolean;
	}

	const { id, data, selected = false }: Props = $props();

	const label = $derived((data.label as string) || 'Group');

	function handleResizeEnd(_event: unknown, params: { width: number; height: number }) {
		updateNode(id, { size: { width: Math.round(params.width), height: Math.round(params.height) } });
	}
</script>

<NodeResizer
	minWidth={200}
	minHeight={150}
	isVisible={selected}
	onResizeEnd={handleResizeEnd}
	lineStyle="border-color: var(--color-accent);"
	handleStyle="width: 8px; height: 8px; background: var(--color-accent); border: 2px solid var(--color-bg-surface); border-radius: 50%;"
/>

<div
	class="h-full w-full rounded-lg border-2"
	style="
		pointer-events: none;
		border-style: dashed;
		border-color: {selected ? 'var(--color-accent)' : 'var(--color-text-muted)'};
		background: color-mix(in srgb, var(--color-accent) 5%, transparent);
	"
>
	<div
		class="group-drag-handle flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-semibold cursor-grab"
		style="pointer-events: auto; color: {selected ? 'var(--color-accent)' : 'var(--color-text-secondary)'}; background: color-mix(in srgb, var(--color-accent) 8%, transparent);"
	>
		{label}
	</div>
</div>
