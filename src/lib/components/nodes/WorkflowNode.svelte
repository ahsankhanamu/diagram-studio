<script lang="ts">
	import { NodeResizer } from '@xyflow/svelte';
	import { Workflow } from 'lucide-svelte';
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
	const status = $derived((data.status as string) || 'idle');
	const color = 'var(--color-node-workflow)';
	const ports = $derived(
		(data.ports as { top: boolean; bottom: boolean; left: boolean; right: boolean }) || {
			top: true, bottom: true, left: true, right: true
		}
	);

	const statusColors: Record<string, string> = {
		idle: 'var(--color-text-muted)',
		running: 'var(--color-warning-accent)',
		success: 'var(--color-success-accent)',
		error: 'var(--color-error-accent)'
	};

	function handleResizeEnd(_event: unknown, params: { width: number; height: number }) {
		updateNode(id, { size: { width: Math.round(params.width), height: Math.round(params.height) } });
	}
</script>

<NodeResizer
	minWidth={100}
	minHeight={36}
	isVisible={selected}
	onResizeEnd={handleResizeEnd}
	lineStyle="border-color: {color};"
	handleStyle="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 2px;"
/>

<div
	class="relative rounded-lg border"
	style="
		background: color-mix(in srgb, var(--color-node-workflow) 8%, var(--color-bg-surface));
		border-color: {selected ? color : 'color-mix(in srgb, var(--color-node-workflow) 40%, var(--color-border-primary))'};
		box-shadow: {selected ? `0 0 0 2px color-mix(in srgb, ${color} 30%, transparent), 0 4px 16px rgba(0,0,0,0.1)` : '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06)'};
		width: 100%; height: 100%;
	"
>
	<div class="flex items-center gap-2 px-3 py-2.5">
		<div class="flex h-5 w-5 items-center justify-center rounded" style="background: color-mix(in srgb, {color} 25%, transparent); color: {color};">
			<Workflow size={11} />
		</div>
		<EditableLabel {id} {label} class="flex-1 truncate text-xs font-medium" style="color: var(--color-text-primary);" />
		<div
			class="h-2 w-2 rounded-full"
			class:status-running={status === 'running'}
			style="background: {statusColors[status] || statusColors.idle};"
		></div>
	</div>

	<NodeHandles {ports} {color} />
</div>
