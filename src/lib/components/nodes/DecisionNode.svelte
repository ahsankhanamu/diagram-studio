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
			top: true,
			bottom: true,
			left: true,
			right: true
		}
	);
</script>

<div class="relative flex items-center justify-center" style="width: 100px; height: 100px;">
	<div
		class="flex items-center justify-center border"
		style="
			width: 72px;
			height: 72px;
			transform: rotate(45deg);
			background: var(--color-bg-surface);
			border-color: {selected ? color : 'var(--color-border-primary)'};
			box-shadow: {selected ? `0 0 0 2px color-mix(in srgb, ${color} 30%, transparent)` : '0 1px 3px var(--color-shadow)'};
			border-radius: 3px;
		"
	>
		<span
			class="text-[10px] font-medium"
			style="transform: rotate(-45deg); color: var(--color-text-primary); max-width: 50px; text-align: center; overflow: hidden; text-overflow: ellipsis; display: block;"
		>
			{label}
		</span>
	</div>

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
