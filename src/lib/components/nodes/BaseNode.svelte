<script lang="ts">
	import { NodeResizer } from '@xyflow/svelte';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import NodeHandles from './NodeHandles.svelte';
	import EditableLabel from './EditableLabel.svelte';
	import { updateNode, updateNodeSilent, notifyMutation } from '$lib/stores/diagramStore';


	interface Props {
		id: string;
		data: Record<string, unknown>;
		selected?: boolean;
		color?: string;
		children?: Snippet;
	}

	const { id, data, selected = false, color = 'var(--color-node-process)', children }: Props = $props();

	const label = $derived((data.label as string) || '');
	const storedHeight = $derived((data.nodeHeight as number) || 60);
	const ports = $derived(
		(data.ports as { top: boolean; bottom: boolean; left: boolean; right: boolean }) || {
			top: true,
			bottom: true,
			left: true,
			right: true
		}
	);
	const customStyle = $derived(data.customStyle as Record<string, string> | undefined);
	const borderStyle = $derived(customStyle?.borderStyle || 'solid');
	const borderDash = $derived(borderStyle === 'dashed' ? 'dashed' : borderStyle === 'dotted' ? 'dotted' : 'solid');
	const effectiveColor = $derived(customStyle?.borderColor || color);

	function handleResizeEnd(_event: unknown, params: { width: number; height: number }) {
		updateNode(id, { size: { width: Math.round(params.width), height: Math.round(params.height) } });
	}

	// Auto-grow: if rendered content is taller than the stored height,
	// update the store and schedule a save. The snapshot comparison in
	// performSave() prevents infinite save loops — once the grown sizes
	// are written, subsequent auto-grow produces the same snapshot → skip.
	let cardEl: HTMLDivElement | undefined = $state();
	let growTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		if (!cardEl) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const contentH = Math.ceil(entry.contentRect.height + entry.target.clientTop * 2);
				if (contentH > storedHeight + 2) {
					updateNodeSilent(id, { size: { width: data.nodeWidth as number, height: contentH } });
					// Debounce: let all nodes finish measuring before triggering one save
					clearTimeout(growTimer);
					growTimer = setTimeout(() => notifyMutation(), 800);
				}
			}
		});
		ro.observe(cardEl);
		return () => { ro.disconnect(); clearTimeout(growTimer); };
	});
</script>

<NodeResizer
	minWidth={100}
	minHeight={40}
	isVisible={selected}
	onResizeEnd={handleResizeEnd}
	lineStyle="border-color: {color};"
	handleStyle="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 2px;"
/>

<div
	bind:this={cardEl}
	class="node-card rounded-lg border transition-shadow duration-150"
	style="
		background: {customStyle?.backgroundColor || 'var(--color-bg-surface)'};
		border-color: {selected ? effectiveColor : (customStyle?.borderColor || 'var(--color-border-primary)')};
		border-style: {borderStyle === 'none' ? 'solid' : borderDash};
		{borderStyle === 'none' ? 'border-color: transparent;' : ''}
		box-shadow: {selected ? `0 0 0 2px color-mix(in srgb, ${effectiveColor} 30%, transparent), 0 4px 16px rgba(0,0,0,0.1)` : '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06)'};
		width: 100%; height: 100%;
		{customStyle?.fontSize ? `font-size: ${customStyle.fontSize}px;` : ''}
	"
>
	{#if children}
		{@render children()}
	{:else}
		<!-- Header with colored tint -->
		<div
			class="flex items-center gap-2 rounded-t-lg border-b px-3 py-2"
			style="background: linear-gradient(135deg, color-mix(in srgb, {effectiveColor} 12%, var(--color-bg-surface)), color-mix(in srgb, {effectiveColor} 4%, var(--color-bg-surface))); border-color: var(--color-border-subtle);"
		>
			<div
				class="flex h-5 w-5 items-center justify-center rounded"
				style="background: color-mix(in srgb, {color} 25%, transparent); color: {color};"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="3" width="18" height="18" rx="2" />
				</svg>
			</div>
			<EditableLabel {id} {label} class="flex-1 min-w-0 text-sm font-semibold leading-snug" style="color: var(--color-text-primary); overflow-wrap: break-word;" />
		</div>
		{#if data.description}
			<div class="px-3 py-1.5">
				<p class="text-xs leading-snug" style="color: var(--color-text-muted);">
					{data.description}
				</p>
			</div>
		{/if}
	{/if}

	<NodeHandles {ports} {color} />
</div>
