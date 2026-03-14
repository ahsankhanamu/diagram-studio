<script lang="ts">
	import { BaseEdge, EdgeLabel, getBezierPath, type EdgeProps } from '@xyflow/svelte';

	const {
		id,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		data,
		selected,
		markerEnd
	}: EdgeProps = $props();

	const edgePath = $derived(
		getBezierPath({
			sourceX,
			sourceY,
			targetX,
			targetY,
			sourcePosition,
			targetPosition
		})
	);

	const label = $derived((data?.label as string) || '');
</script>

<BaseEdge
	path={edgePath[0]}
	{markerEnd}
	interactionWidth={30}
	style="stroke: {selected ? 'var(--color-edge-selected)' : 'var(--color-edge-default)'}; stroke-width: {selected ? 2.5 : 1.5};"
/>

{#if label}
	<EdgeLabel
		x={edgePath[1]}
		y={edgePath[2]}
		style="background: var(--color-bg-surface); border: 1px solid var(--color-border-primary); color: var(--color-text-secondary); border-radius: 4px; padding: 2px 6px; font-size: 11px;"
	>
		{label}
	</EdgeLabel>
{/if}
