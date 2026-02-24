<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';

	interface Props {
		id: string;
		data: Record<string, unknown>;
		selected?: boolean;
	}

	const { id, data, selected = false }: Props = $props();

	const label = $derived((data.label as string) || '');
	const color = 'var(--color-accent)';
	const customStyle = $derived(data.customStyle as Record<string, string> | undefined);
	const ports = $derived(
		(data.ports as { top: boolean; bottom: boolean; left: boolean; right: boolean }) || {
			top: true, bottom: true, left: true, right: true
		}
	);

	const size = $derived(Number(data.width) || 80);
</script>

<div
	class="relative flex items-center justify-center"
	style="width: {size}px; height: {size}px;"
>
	<svg
		viewBox="0 0 100 100"
		class="absolute inset-0"
		style="width: 100%; height: 100%;"
	>
		<polygon
			points="50,2 98,50 50,98 2,50"
			fill={customStyle?.backgroundColor || 'var(--color-bg-surface)'}
			stroke={selected ? color : (customStyle?.borderColor || 'var(--color-border-primary)')}
			stroke-width="2"
			style={selected ? `filter: drop-shadow(0 0 0 2px color-mix(in srgb, ${color} 30%, transparent))` : ''}
		/>
	</svg>
	<span class="relative z-10 text-xs font-medium text-center px-4" style="color: var(--color-text-primary); {customStyle?.fontSize ? `font-size: ${customStyle.fontSize}px;` : ''}">{label}</span>

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
