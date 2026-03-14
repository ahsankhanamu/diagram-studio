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
	import { pushHistory } from '$lib/stores/historyStore';

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
	const centerXData = $derived(data?.centerX as number | undefined);
	const centerYData = $derived(data?.centerY as number | undefined);

	const dashArray = $derived(
		strokeStyle === 'dashed' ? '8 4' : strokeStyle === 'dotted' ? '2 4' : 'none'
	);

	const edgeType = $derived((type as string) || 'smoothstep');
	const isSmoothOrStep = $derived(edgeType === 'smoothstep' || edgeType === 'step');

	const pathParams = $derived({
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition
	});

	// ─── Local drag override ───────────────────────────────────
	// During drag we use local state to avoid store→rerender→destroy cycles
	let dragging = $state(false);
	let localCenterX = $state<number | undefined>(undefined);
	let localCenterY = $state<number | undefined>(undefined);

	const activeCenterX = $derived(dragging ? localCenterX : centerXData);
	const activeCenterY = $derived(dragging ? localCenterY : centerYData);

	const edgePath = $derived.by(() => {
		if (edgeType === 'straight') return getStraightPath(pathParams);
		if (edgeType === 'bezier' || edgeType === 'labeled' || edgeType === 'animated')
			return getBezierPath({ ...pathParams, curvature: activeCenterX != null ? Math.abs(activeCenterX - (sourceX + targetX) / 2) / 100 : undefined });
		// smoothstep, step
		return getSmoothStepPath({
			...pathParams,
			borderRadius: edgeType === 'step' ? 0 : 8,
			centerX: activeCenterX,
			centerY: activeCenterY
		});
	});

	const edgeStyle = $derived.by(() => {
		const color = strokeColor || (selected ? 'var(--color-edge-selected)' : 'var(--color-edge-default)');
		const width = selected ? Math.max(strokeWidth, 2.5) : strokeWidth;
		let s = `stroke: ${color}; stroke-width: ${width};`;
		if (dashArray !== 'none') s += ` stroke-dasharray: ${dashArray};`;
		return s;
	});

	// ─── Segment dragging ──────────────────────────────────────
	function toSvgPoint(svgEl: SVGSVGElement, clientX: number, clientY: number) {
		const pt = svgEl.createSVGPoint();
		pt.x = clientX;
		pt.y = clientY;
		const ctm = svgEl.getScreenCTM()?.inverse();
		if (!ctm) return null;
		return pt.matrixTransform(ctm);
	}

	function handlePathDown(e: MouseEvent) {
		if (e.button !== 0 || !isSmoothOrStep || !selected) return;

		e.stopPropagation();
		e.preventDefault();

		localCenterX = centerXData;
		localCenterY = centerYData;
		dragging = true;
		let moved = false;

		const svgEl = (e.currentTarget as Element).closest('svg') as SVGSVGElement | null;
		if (!svgEl) return;

		const onMove = (me: MouseEvent) => {
			if (!moved) {
				pushHistory();
				moved = true;
			}
			const svgPt = toSvgPoint(svgEl, me.clientX, me.clientY);
			if (!svgPt) return;
			localCenterX = Math.round(svgPt.x);
			localCenterY = Math.round(svgPt.y);
		};

		const onUp = () => {
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
			if (moved) {
				updateEdge(id, { centerX: localCenterX, centerY: localCenterY });
			}
			dragging = false;
		};

		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);
	}

	function handleResetMidpoint(e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		pushHistory();
		updateEdge(id, { centerX: undefined, centerY: undefined });
	}

	// ─── Label editing ──────────────────────────────────────────
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
	interactionWidth={40}
	class={isAnimated ? 'edge-flow-animated' : ''}
/>

<!-- Drag overlay — always present on smoothstep/step for wider hit area + drag when selected -->
{#if isSmoothOrStep}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<path
		d={edgePath[0]}
		class="edge-drag-overlay"
		class:dragging
		class:is-selected={!!selected}
		style="fill:none; stroke:#000; stroke-opacity:0; stroke-width:20; stroke-dasharray:none;"
		onmousedown={handlePathDown}
		ondblclick={handleResetMidpoint}
	/>
{/if}

<!-- Visual midpoint indicator -->
{#if selected && isSmoothOrStep}
	<circle
		cx={edgePath[1]}
		cy={edgePath[2]}
		r={dragging ? 5 : 4}
		class="edge-midpoint-dot"
		class:has-custom={activeCenterX != null || activeCenterY != null}
	/>
{/if}

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
		selectEdgeOnClick={true}
		style="background: var(--color-bg-surface); border: 1px solid var(--color-border-primary); color: var(--color-text-secondary); border-radius: 4px; padding: 2px 6px; font-size: 11px;"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<span ondblclick={startEdit}>{label}</span>
	</EdgeLabel>
{:else if selected}
	<EdgeLabel
		x={edgePath[1]}
		y={edgePath[2]}
		selectEdgeOnClick={true}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<button
			class="edge-add-label-btn"
			ondblclick={startEdit}
			onclick={startEdit}
			title="Add label"
		>
			<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
				<path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
			</svg>
		</button>
	</EdgeLabel>
{/if}

<style>
	.edge-drag-overlay {
		fill: none;
		stroke: transparent;
		stroke-width: 40;
		pointer-events: stroke;
		cursor: default;
		touch-action: none;
	}
	.edge-drag-overlay.is-selected {
		cursor: grab;
	}
	.edge-drag-overlay.is-selected:hover {
		stroke: var(--color-accent);
		stroke-opacity: 0.08;
	}
	.edge-drag-overlay.dragging {
		cursor: grabbing;
		stroke: var(--color-accent);
		stroke-opacity: 0.12;
	}

	.edge-midpoint-dot {
		fill: var(--color-accent);
		stroke: var(--color-bg-surface);
		stroke-width: 1.5;
		pointer-events: none;
		opacity: 0.6;
		transition: r 0.15s, opacity 0.15s;
	}
	.edge-midpoint-dot.has-custom {
		opacity: 1;
	}

	.edge-add-label-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 6px;
		border: 1px solid var(--color-border-primary);
		background: var(--color-bg-surface);
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background-color 0.12s, color 0.12s, border-color 0.12s;
		padding: 0;
	}
	.edge-add-label-btn:hover {
		background: var(--color-hover-overlay);
		color: var(--color-accent);
		border-color: var(--color-accent);
	}
</style>
