<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';

	interface Props {
		id: string;
		data: Record<string, unknown>;
		selected?: boolean;
	}

	const { id, data, selected = false }: Props = $props();

	const label = $derived((data.label as string) || 'Text');
	const color = 'var(--color-accent)';
	const customStyle = $derived(data.customStyle as Record<string, string> | undefined);
	const ports = $derived(
		(data.ports as { top: boolean; bottom: boolean; left: boolean; right: boolean }) || {
			top: true, bottom: true, left: true, right: true
		}
	);
</script>

<div
	class="flex items-center justify-center px-3 py-1"
	style="
		background: transparent;
		outline: {selected ? `2px solid ${color}` : 'none'};
		outline-offset: 2px;
		border-radius: 4px;
		min-width: 40px;
		{customStyle?.fontSize ? `font-size: ${customStyle.fontSize}px;` : 'font-size: 14px;'}
	"
>
	<span class="font-medium whitespace-pre-wrap" style="color: {customStyle?.backgroundColor || 'var(--color-text-primary)'};">{label}</span>

	{#if ports.top}
		<Handle type="target" position={Position.Top} id="top" style="width: 6px; height: 6px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 50%; opacity: {selected ? 1 : 0};" />
	{/if}
	{#if ports.bottom}
		<Handle type="source" position={Position.Bottom} id="bottom" style="width: 6px; height: 6px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 50%; opacity: {selected ? 1 : 0};" />
	{/if}
	{#if ports.left}
		<Handle type="target" position={Position.Left} id="left" style="width: 6px; height: 6px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 50%; opacity: {selected ? 1 : 0};" />
	{/if}
	{#if ports.right}
		<Handle type="source" position={Position.Right} id="right" style="width: 6px; height: 6px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 50%; opacity: {selected ? 1 : 0};" />
	{/if}
</div>
