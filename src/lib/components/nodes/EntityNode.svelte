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
	const fields = $derived((data.fields as Array<{ name: string; type: string }>) || []);
	const color = 'var(--color-node-erd)';
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
	minWidth={100}
	minHeight={50}
	isVisible={selected}
	onResizeEnd={handleResizeEnd}
	lineStyle="border-color: {color};"
	handleStyle="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 2px;"
/>

<div
	class="relative overflow-hidden rounded-lg border"
	style="
		background: var(--color-bg-surface);
		border-color: {selected ? color : 'var(--color-border-primary)'};
		box-shadow: {selected ? `0 0 0 2px color-mix(in srgb, ${color} 30%, transparent)` : '0 1px 3px var(--color-shadow)'};
		width: 100%; height: 100%;
	"
>
	<div class="border-b px-2.5 py-1.5" style="background: color-mix(in srgb, {color} 10%, transparent); border-color: var(--color-border-subtle);">
		<span class="text-[11px] font-semibold" style="color: {color};">{label}</span>
	</div>

	{#if fields.length > 0}
		<div class="px-2.5 py-1">
			{#each fields as field}
				<div class="flex justify-between py-0.5 text-[10px]">
					<span style="color: var(--color-text-primary);">{field.name}</span>
					<span style="color: var(--color-text-muted);">{field.type}</span>
				</div>
			{/each}
		</div>
	{:else}
		<div class="px-2.5 py-1.5 text-[10px]" style="color: var(--color-text-muted);">No fields</div>
	{/if}

	<NodeHandles {ports} {color} />
</div>
