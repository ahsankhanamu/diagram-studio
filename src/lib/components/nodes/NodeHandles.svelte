<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';

	interface Props {
		ports: { top: boolean; bottom: boolean; left: boolean; right: boolean };
		color: string;
	}

	const { ports, color }: Props = $props();

	const handleStyle = $derived(
		`width: 8px; height: 8px; background: ${color}; border: 2px solid var(--color-bg-surface); border-radius: 50%;`
	);
	const hiddenStyle = 'width: 1px; height: 1px; opacity: 0; pointer-events: none;';
</script>

<!--
  Each port gets BOTH a source and target handle at the same position.
  Visible handles are always type="source" so dragging from any handle
  treats the starting node as the source (arrow points away from it).
  Hidden type="target" handles allow edges to connect TO any position.
-->

{#if ports.top}
	<Handle type="source" position={Position.Top} id="top" style={handleStyle} />
	<Handle type="target" position={Position.Top} id="top" style={hiddenStyle} />
{/if}
{#if ports.bottom}
	<Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle} />
	<Handle type="target" position={Position.Bottom} id="bottom" style={hiddenStyle} />
{/if}
{#if ports.left}
	<Handle type="source" position={Position.Left} id="left" style={handleStyle} />
	<Handle type="target" position={Position.Left} id="left" style={hiddenStyle} />
{/if}
{#if ports.right}
	<Handle type="source" position={Position.Right} id="right" style={handleStyle} />
	<Handle type="target" position={Position.Right} id="right" style={hiddenStyle} />
{/if}
