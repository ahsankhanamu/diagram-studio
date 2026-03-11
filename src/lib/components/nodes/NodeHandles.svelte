<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';

	interface Props {
		ports: { top: boolean; bottom: boolean; left: boolean; right: boolean };
		color: string;
	}

	const { ports, color }: Props = $props();

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
</script>

<!--
  Each port gets BOTH a source and target handle at the same position.
  Visible handles are always type="source" so dragging from any handle
  treats the starting node as the source (arrow points away from it).
  Hidden type="target" handles allow edges to connect TO any position.

  Arrow SVGs are rendered as children inside the Handle (supported via slots).
  The handle starts as a small dot and grows to show the arrow on hover/selection.
-->

{#if ports.top}
	<Handle type="source" position={Position.Top} id="top" style={baseStyle} class="freeform-handle">
		<svg class="handle-arrow" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--color-accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
			<path d={arrowPaths.top} />
		</svg>
	</Handle>
	<Handle type="target" position={Position.Top} id="top" style={hiddenStyle} />
{/if}
{#if ports.bottom}
	<Handle type="source" position={Position.Bottom} id="bottom" style={baseStyle} class="freeform-handle">
		<svg class="handle-arrow" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--color-accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
			<path d={arrowPaths.bottom} />
		</svg>
	</Handle>
	<Handle type="target" position={Position.Bottom} id="bottom" style={hiddenStyle} />
{/if}
{#if ports.left}
	<Handle type="source" position={Position.Left} id="left" style={baseStyle} class="freeform-handle">
		<svg class="handle-arrow" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--color-accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
			<path d={arrowPaths.left} />
		</svg>
	</Handle>
	<Handle type="target" position={Position.Left} id="left" style={hiddenStyle} />
{/if}
{#if ports.right}
	<Handle type="source" position={Position.Right} id="right" style={baseStyle} class="freeform-handle">
		<svg class="handle-arrow" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--color-accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
			<path d={arrowPaths.right} />
		</svg>
	</Handle>
	<Handle type="target" position={Position.Right} id="right" style={hiddenStyle} />
{/if}

<style>
	.handle-arrow {
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.2s ease;
	}
</style>
