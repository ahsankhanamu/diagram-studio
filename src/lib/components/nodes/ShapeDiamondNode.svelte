<script lang="ts">
	import { NodeResizer } from '@xyflow/svelte';
	import NodeHandles from './NodeHandles.svelte';
	import EditableLabel from './EditableLabel.svelte';

	import { updateNode } from '$lib/stores/diagramStore';

	interface Props {
		id: string;
		data: Record<string, unknown>;
		selected?: boolean;
	}

	const { id, data, selected = false }: Props = $props();

	const label = $derived((data.label as string) || '');
	const color = 'var(--color-accent)';
	const customStyle = $derived(data.customStyle as Record<string, string> | undefined);
	const effectiveColor = $derived(customStyle?.borderColor || color);
	const borderStyle = $derived(customStyle?.borderStyle || 'solid');
	const strokeDash = $derived(borderStyle === 'dashed' ? '8 4' : borderStyle === 'dotted' ? '3 3' : borderStyle === 'none' ? '' : '');
	const ports = $derived(
		(data.ports as { top: boolean; bottom: boolean; left: boolean; right: boolean }) || {
			top: true, bottom: true, left: true, right: true
		}
	);

	function handleResizeEnd(_event: unknown, params: { width: number; height: number }) {
		const size = Math.round(Math.max(params.width, params.height));
		updateNode(id, { size: { width: size, height: size } });
	}
</script>

<NodeResizer
	minWidth={40}
	minHeight={40}
	isVisible={selected}
	onResizeEnd={handleResizeEnd}
	lineStyle="border-color: {color};"
	handleStyle="width: 8px; height: 8px; background: {color}; border: 2px solid var(--color-bg-surface); border-radius: 2px;"
/>

<div
	class="relative flex items-center justify-center"
	style="width: 100%; height: 100%;"
>
	<svg
		viewBox="0 0 100 100"
		class="absolute inset-0"
		style="width: 100%; height: 100%;"
	>
		<polygon
			points="50,2 98,50 50,98 2,50"
			fill={customStyle?.backgroundColor || `color-mix(in srgb, ${effectiveColor} 8%, var(--color-bg-surface))`}
			stroke={borderStyle === 'none' ? 'transparent' : (selected ? effectiveColor : (customStyle?.borderColor || `color-mix(in srgb, ${effectiveColor} 40%, var(--color-border-primary))`))}
			stroke-width="2"
			stroke-dasharray={strokeDash}
		/>
	</svg>
	<EditableLabel {id} {label} class="relative z-10 text-xs font-medium text-center px-4" style="color: var(--color-text-primary); {customStyle?.fontSize ? `font-size: ${customStyle.fontSize}px;` : ''}" />

	<NodeHandles {ports} {color} />
</div>
