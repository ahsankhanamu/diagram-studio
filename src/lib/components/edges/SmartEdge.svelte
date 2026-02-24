<script lang="ts">
	import {
		BaseEdge,
		EdgeLabel,
		getBezierPath,
		getSmoothStepPath,
		getStraightPath,
		type EdgeProps
	} from '@xyflow/svelte';
	import { updateEdge } from '$lib/stores/diagramStore';

	const {
		id,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		data,
		selected,
		markerEnd,
		markerStart,
		type
	}: EdgeProps = $props();

	let editing = $state(false);
	let editValue = $state('');

	const label = $derived((data?.label as string) || '');
	const strokeStyle = $derived((data?.strokeStyle as string) || 'solid');
	const strokeWidth = $derived((data?.strokeWidth as number) || 1.5);
	const strokeColor = $derived((data?.strokeColor as string) || '');
	const isAnimated = $derived((data?.animated as boolean) || false);

	const dashArray = $derived(
		strokeStyle === 'dashed' ? '8 4' : strokeStyle === 'dotted' ? '2 4' : 'none'
	);

	const pathParams = $derived({
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition
	});

	const edgePath = $derived.by(() => {
		const edgeType = (type as string) || 'smoothstep';
		if (edgeType === 'straight') return getStraightPath(pathParams);
		if (edgeType === 'bezier' || edgeType === 'labeled' || edgeType === 'animated')
			return getBezierPath(pathParams);
		// smoothstep, step
		return getSmoothStepPath({ ...pathParams, borderRadius: edgeType === 'step' ? 0 : 8 });
	});

	const edgeStyle = $derived.by(() => {
		const color = strokeColor || (selected ? 'var(--color-edge-selected)' : 'var(--color-edge-default)');
		const width = selected ? Math.max(strokeWidth, 2.5) : strokeWidth;
		let s = `stroke: ${color}; stroke-width: ${width};`;
		if (dashArray !== 'none') s += ` stroke-dasharray: ${dashArray};`;
		return s;
	});

	function startEdit() {
		editValue = label;
		editing = true;
	}

	function commitEdit() {
		editing = false;
		if (editValue !== label) {
			updateEdge(id, { label: editValue });
		}
	}

	function handleEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') commitEdit();
		if (e.key === 'Escape') { editing = false; }
	}
</script>

<BaseEdge
	path={edgePath[0]}
	{markerEnd}
	{markerStart}
	style={edgeStyle}
	interactionWidth={20}
	class={isAnimated ? 'edge-flow-animated' : ''}
/>

{#if editing}
	<EdgeLabel x={edgePath[1]} y={edgePath[2]}>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			autofocus
			value={editValue}
			oninput={(e) => (editValue = (e.target as HTMLInputElement).value)}
			onblur={commitEdit}
			onkeydown={handleEditKeydown}
			class="rounded border px-1.5 py-0.5 text-[11px] outline-none"
			style="background: var(--color-bg-surface); border-color: var(--color-accent); color: var(--color-text-primary); min-width: 60px;"
		/>
	</EdgeLabel>
{:else if label}
	<EdgeLabel
		x={edgePath[1]}
		y={edgePath[2]}
		style="background: var(--color-bg-surface); border: 1px solid var(--color-border-primary); color: var(--color-text-secondary); border-radius: 4px; padding: 2px 6px; font-size: 11px; cursor: text;"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<span ondblclick={startEdit}>{label}</span>
	</EdgeLabel>
{/if}
