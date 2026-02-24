<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';

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
</script>

<div class="relative" style="width: 120px; height: 72px;">
	<svg viewBox="0 0 120 72" class="w-full h-full" style="filter: {selected ? `drop-shadow(0 0 2px var(--color-node-architecture))` : 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'};">
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
		<text x="60" y="40" text-anchor="middle" fill="var(--color-text-primary)" font-size="11" font-weight="500" font-family="Inter, sans-serif">{label}</text>
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
