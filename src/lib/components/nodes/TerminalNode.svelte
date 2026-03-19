<script lang="ts">
	import { NodeResizer } from '@xyflow/svelte';
	import { onMount } from 'svelte';
	import NodeHandles from './NodeHandles.svelte';
	import EditableLabel from './EditableLabel.svelte';

	import { updateNode, updateNodeSilent, notifyMutation } from '$lib/stores/diagramStore';

	interface Props {
		id: string;
		data: Record<string, unknown>;
		selected?: boolean;
	}

	const { id, data, selected = false }: Props = $props();

	const label = $derived((data.label as string) || '');
	const color = 'var(--color-node-terminal)';
	const storedHeight = $derived((data.nodeHeight as number) || 40);
	const storedWidth = $derived((data.nodeWidth as number) || 120);
	const customStyle = $derived(data.customStyle as Record<string, string> | undefined);
	const effectiveColor = $derived(customStyle?.borderColor || color);
	const borderStyle = $derived(customStyle?.borderStyle || 'solid');
	const borderDash = $derived(borderStyle === 'dashed' ? 'dashed' : borderStyle === 'dotted' ? 'dotted' : 'solid');
	const ports = $derived(
		(data.ports as { top: boolean; bottom: boolean; left: boolean; right: boolean }) || {
			top: true,
			bottom: true,
			left: false,
			right: false
		}
	);

	function handleResizeEnd(_event: unknown, params: { width: number; height: number }) {
		updateNode(id, { size: { width: Math.round(params.width), height: Math.round(params.height) } });
	}

	let pillEl: HTMLDivElement | undefined = $state();
	let growTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		if (!pillEl) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const h = Math.ceil(entry.borderBoxSize[0].blockSize);
				const w = Math.ceil(entry.borderBoxSize[0].inlineSize);
				if (h > storedHeight + 2 || w > storedWidth + 2) {
					updateNodeSilent(id, {
						size: {
							width: Math.max(w, storedWidth),
							height: Math.max(h, storedHeight)
						}
					});
					clearTimeout(growTimer);
					growTimer = setTimeout(() => notifyMutation(), 800);
				}
			}
		});
		ro.observe(pillEl);
		return () => { ro.disconnect(); clearTimeout(growTimer); };
	});
</script>

<NodeResizer
	minWidth={60}
	minHeight={28}
	isVisible={selected}
	onResizeEnd={handleResizeEnd}
	lineStyle="border-color: {color};"
	handleStyle="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 2px;"
/>

<div
	bind:this={pillEl}
	class="relative flex items-center justify-center rounded-full border px-4 py-2"
	style="
		background: color-mix(in srgb, ${effectiveColor} 8%, var(--color-bg-surface));
		border-color: {borderStyle === 'none' ? 'transparent' : (selected ? effectiveColor : `color-mix(in srgb, ${effectiveColor} 40%, var(--color-border-primary))`)};
		border-style: {borderStyle === 'none' ? 'solid' : borderDash};
		box-shadow: {selected ? `0 0 0 2px color-mix(in srgb, ${effectiveColor} 30%, transparent), 0 4px 16px rgba(0,0,0,0.1)` : '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06)'};
		width: 100%;
	"
>
	<EditableLabel {id} {label} class="text-sm font-medium text-center" style="color: var(--color-text-primary);" />

	<NodeHandles {ports} {color} nodeId={id} />
</div>
