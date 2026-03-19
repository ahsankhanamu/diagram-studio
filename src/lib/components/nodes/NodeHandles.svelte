<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { nodes, edgeList } from '$lib/stores/diagramStore';
	import { defaultHandleDistribution } from '$lib/stores/handleDistributionStore';
	import { computeHandleLayout } from '$lib/engine/handle-distribution';

	interface Props {
		ports: { top: boolean; bottom: boolean; left: boolean; right: boolean };
		color: string;
		nodeId: string;
	}

	const { ports, color, nodeId }: Props = $props();

	const node = $derived($nodes.get(nodeId));

	const layout = $derived.by(() => {
		if (!node) return { top: [], bottom: [], left: [], right: [] };
		return computeHandleLayout(node, $edgeList, $defaultHandleDistribution);
	});

	const baseStyle = $derived(
		`--handle-color: ${color};`
	);
	const hiddenStyle = 'width: 1px; height: 1px; opacity: 0; pointer-events: none;';

	const arrowPaths: Record<string, string> = {
		top: 'M5 8V2M2.5 4.5L5 2l2.5 2.5',
		bottom: 'M5 2V8M2.5 5.5L5 8l2.5-2.5',
		left: 'M8 5H2M4.5 2.5L2 5l2.5 2.5',
		right: 'M2 5H8M5.5 2.5L8 5l-2.5 2.5'
	};

	const positionMap: Record<string, Position> = {
		top: Position.Top,
		bottom: Position.Bottom,
		left: Position.Left,
		right: Position.Right
	};

	type Side = 'top' | 'bottom' | 'left' | 'right';

	function sourceStyle(side: Side, percent: number): string {
		if (side === 'top' || side === 'bottom') {
			return `${baseStyle} left: ${percent}%; transform: translateX(-50%);`;
		}
		return `${baseStyle} top: ${percent}%; transform: translateY(-50%);`;
	}

	function targetStyle(side: Side, percent: number): string {
		if (side === 'top' || side === 'bottom') {
			return `${hiddenStyle} left: ${percent}%; transform: translateX(-50%);`;
		}
		return `${hiddenStyle} top: ${percent}%; transform: translateY(-50%);`;
	}
</script>

<!--
  Each port gets BOTH a source and target handle at the same position.
  In distributed mode, multiple handles are rendered per side with CSS offset overrides.
  An extra "next" target handle is placed at the next available index for new incoming connections.
-->

{#each (['top', 'bottom', 'left', 'right'] as Side[]) as side}
	{#if ports[side]}
		{#each layout[side] as handle (handle.id)}
			<Handle
				type="source"
				position={positionMap[side]}
				id={handle.id}
				style={sourceStyle(side, handle.percent)}
				class="freeform-handle"
			>
				<svg class="handle-arrow" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--color-accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
					<path d={arrowPaths[side]} />
				</svg>
			</Handle>
			<Handle
				type="target"
				position={positionMap[side]}
				id={handle.id}
				style={targetStyle(side, handle.percent)}
			/>
		{/each}
		<!-- Extra "next" target handle for new incoming connections in distributed mode -->
		{#if layout[side].length > 0 && layout[side][0].id !== side}
			{@const nextIdx = layout[side].length}
			{@const nextPct = ((nextIdx + 1) / (nextIdx + 2)) * 100}
			<Handle
				type="target"
				position={positionMap[side]}
				id="{side}-{nextIdx}"
				style={targetStyle(side, nextPct)}
			/>
		{/if}
	{/if}
{/each}

<style>
	.handle-arrow {
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.2s ease;
	}
</style>
