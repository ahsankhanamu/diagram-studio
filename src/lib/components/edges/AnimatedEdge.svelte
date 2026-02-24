<script lang="ts">
	import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/svelte';

	const {
		id,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
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
</script>

<BaseEdge
	path={edgePath[0]}
	{markerEnd}
	interactionWidth={20}
	style="stroke: {selected ? 'var(--color-edge-selected)' : 'var(--color-edge-active)'}; stroke-width: 2; stroke-dasharray: 5 5;"
	class="edge-flow-animated"
/>
