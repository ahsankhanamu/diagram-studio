<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';

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
			top: true, bottom: true, left: true, right: true
		}
	);
</script>

<div class="relative" style="width: 150px; height: 48px;">
	<svg viewBox="0 0 150 48" class="w-full h-full" style="filter: {selected ? `drop-shadow(0 0 2px var(--color-node-flowchart))` : 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'};">
		<polygon
			points="20,0 150,0 130,48 0,48"
			fill="var(--color-bg-surface)"
			stroke={selected ? color : 'var(--color-border-primary)'}
			stroke-width="1.5"
		/>
		<text x="75" y="28" text-anchor="middle" fill="var(--color-text-primary)" font-size="11" font-weight="500" font-family="Inter, sans-serif">{label}</text>
	</svg>

	{#if ports.top}
		<Handle type="target" position={Position.Top} id="top" style="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 50%;" />
	{/if}
	{#if ports.bottom}
		<Handle type="source" position={Position.Bottom} id="bottom" style="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 50%;" />
	{/if}
	{#if ports.left}
		<Handle type="target" position={Position.Left} id="left" style="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 50%;" />
	{/if}
	{#if ports.right}
		<Handle type="source" position={Position.Right} id="right" style="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 50%;" />
	{/if}
</div>
