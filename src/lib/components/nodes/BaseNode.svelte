<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		id: string;
		data: Record<string, unknown>;
		selected?: boolean;
		color?: string;
		children?: Snippet;
	}

	const { id, data, selected = false, color = 'var(--color-node-flowchart)', children }: Props = $props();

	const label = $derived((data.label as string) || '');
	const ports = $derived(
		(data.ports as { top: boolean; bottom: boolean; left: boolean; right: boolean }) || {
			top: true,
			bottom: true,
			left: true,
			right: true
		}
	);
	const customStyle = $derived(data.customStyle as Record<string, string> | undefined);
</script>

<div
	class="rounded-lg border transition-shadow duration-150"
	style="
		background: {customStyle?.backgroundColor || 'var(--color-bg-surface)'};
		border-color: {selected ? color : (customStyle?.borderColor || 'var(--color-border-primary)')};
		box-shadow: {selected ? `0 0 0 2px color-mix(in srgb, ${color} 30%, transparent)` : '0 1px 3px var(--color-shadow)'};
		width: 180px;
		{customStyle?.fontSize ? `font-size: ${customStyle.fontSize}px;` : ''}
	"
>
	{#if children}
		{@render children()}
	{:else}
		<!-- Header with colored tint -->
		<div
			class="flex items-center gap-2 rounded-t-lg border-b px-3 py-2"
			style="background: color-mix(in srgb, {color} 8%, var(--color-bg-surface)); border-color: var(--color-border-subtle);"
		>
			<div
				class="flex h-5 w-5 items-center justify-center rounded"
				style="background: color-mix(in srgb, {color} 20%, transparent); color: {color};"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="3" width="18" height="18" rx="2" />
				</svg>
			</div>
			<span class="flex-1 truncate text-xs font-medium" style="color: var(--color-text-primary);">
				{label}
			</span>
		</div>
		<div class="px-3 py-1.5">
			<p class="text-[10px] leading-tight" style="color: var(--color-text-muted);">
				{data.description || ''}
			</p>
		</div>
	{/if}

	{#if ports.top}
		<Handle
			type="target"
			position={Position.Top}
			id="top"
			style="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 50%;"
		/>
	{/if}
	{#if ports.bottom}
		<Handle
			type="source"
			position={Position.Bottom}
			id="bottom"
			style="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 50%;"
		/>
	{/if}
	{#if ports.left}
		<Handle
			type="target"
			position={Position.Left}
			id="left"
			style="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 50%;"
		/>
	{/if}
	{#if ports.right}
		<Handle
			type="source"
			position={Position.Right}
			id="right"
			style="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 50%;"
		/>
	{/if}
</div>
