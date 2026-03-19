<script lang="ts">
	import { Trash2, Type } from 'lucide-svelte';
	import { selectedEdgeIds, selectedEdgeCount, clearSelection } from '$lib/stores/selectionStore';
	import { edges, edgeList, updateEdge, removeEdges } from '$lib/stores/diagramStore';
	import { nodes } from '$lib/stores/diagramStore';
	import { pushHistory } from '$lib/stores/historyStore';
	import { viewport } from '$lib/stores/viewportStore';
	import { defaultHandleDistribution } from '$lib/stores/handleDistributionStore';
	import { resolveHandlePosition } from '$lib/engine/handle-distribution';
	import type { DiagramEdge, DiagramNode } from '$lib/types/diagram';

	const show = $derived($selectedEdgeCount === 1);

	const selectedEdge = $derived.by((): DiagramEdge | null => {
		if ($selectedEdgeCount !== 1) return null;
		const id = Array.from($selectedEdgeIds)[0];
		return $edges.get(id) ?? null;
	});

	let toolbarEl: HTMLDivElement | undefined = $state();

	const TOOLBAR_GAP = 12;
	const VIEWPORT_PAD = 8;

	// Position toolbar at the edge's visual midpoint
	const toolbarStyle = $derived.by(() => {
		if (!selectedEdge) return '';
		const vp = $viewport;

		const sourceNode = $nodes.get(selectedEdge.source);
		const targetNode = $nodes.get(selectedEdge.target);
		if (!sourceNode || !targetNode) return '';

		// Resolve absolute positions
		function absPos(node: { position: { x: number; y: number }; parentId?: string }) {
			let x = node.position.x;
			let y = node.position.y;
			if (node.parentId) {
				const parent = $nodes.get(node.parentId);
				if (parent) { x += parent.position.x; y += parent.position.y; }
			}
			return { x, y };
		}

		const sp = absPos(sourceNode);
		const tp = absPos(targetNode);

		// Get handle positions using distribution-aware engine
		const allEdges = $edgeList;
		const globalDist = $defaultHandleDistribution;
		function handlePos(node: DiagramNode, abs: { x: number; y: number }, handle: string) {
			return resolveHandlePosition(node, abs, handle, allEdges, globalDist);
		}

		const sh = handlePos(sourceNode, sp, selectedEdge.sourceHandle || 'bottom');
		const th = handlePos(targetNode, tp, selectedEdge.targetHandle || 'top');

		// Use custom center if set, otherwise midpoint
		const midX = selectedEdge.centerX ?? (sh.x + th.x) / 2;
		const midY = selectedEdge.centerY ?? (sh.y + th.y) / 2;

		const screenX = midX * vp.zoom + vp.x;
		const screenY = midY * vp.zoom + vp.y;

		const tbW = toolbarEl?.offsetWidth ?? 320;
		const tbH = toolbarEl?.offsetHeight ?? 36;

		let left = screenX - tbW / 2;
		let top = screenY - tbH - TOOLBAR_GAP;

		if (top < VIEWPORT_PAD) top = screenY + TOOLBAR_GAP;

		const maxLeft = window.innerWidth - tbW - VIEWPORT_PAD;
		left = Math.max(VIEWPORT_PAD, Math.min(left, maxLeft));
		const maxTop = window.innerHeight - tbH - VIEWPORT_PAD;
		top = Math.min(top, maxTop);

		return `left:${left}px;top:${top}px;`;
	});

	const colors = [
		{ label: 'Default', value: '' },
		{ label: 'Blue', value: '#3b82f6' },
		{ label: 'Indigo', value: '#6366f1' },
		{ label: 'Green', value: '#10b981' },
		{ label: 'Amber', value: '#f59e0b' },
		{ label: 'Red', value: '#ef4444' },
		{ label: 'Gray', value: '#6b7280' },
	];

	const strokeStyles = [
		{ label: 'Solid', value: 'solid' },
		{ label: 'Dashed', value: 'dashed' },
		{ label: 'Dotted', value: 'dotted' },
	];

	const strokeWidths = [
		{ label: 'Thin', value: 1 },
		{ label: 'Default', value: 1.5 },
		{ label: 'Medium', value: 2.5 },
		{ label: 'Thick', value: 4 },
	];

	const edgeTypes = [
		{ label: 'Smooth Step', value: 'smoothstep' },
		{ label: 'Bezier', value: 'bezier' },
		{ label: 'Straight', value: 'straight' },
		{ label: 'Step', value: 'step' },
	];

	const currentEdgeType = $derived(selectedEdge?.type || 'smoothstep');
	const hasLabel = $derived(!!selectedEdge?.label);

	const currentColor = $derived(selectedEdge?.strokeColor || '');
	const currentStrokeStyle = $derived(selectedEdge?.strokeStyle || 'solid');
	const currentStrokeWidth = $derived(selectedEdge?.strokeWidth ?? 1.5);

	let strokeStyleOpen = $state(false);
	let strokeWidthOpen = $state(false);

	function setEdgeType(value: string) {
		if (!selectedEdge) return;
		pushHistory();
		updateEdge(selectedEdge.id, { type: value });
	}

	function setColor(value: string) {
		if (!selectedEdge) return;
		pushHistory();
		updateEdge(selectedEdge.id, { strokeColor: value });
	}

	function setStrokeStyle(value: string) {
		if (!selectedEdge) return;
		pushHistory();
		updateEdge(selectedEdge.id, { strokeStyle: value as 'solid' | 'dashed' | 'dotted' });
	}

	function setStrokeWidth(value: number) {
		if (!selectedEdge) return;
		pushHistory();
		updateEdge(selectedEdge.id, { strokeWidth: value });
	}

	function handleDelete() {
		if (!selectedEdge) return;
		pushHistory();
		removeEdges([selectedEdge.id]);
		clearSelection();
	}
</script>

{#if show && selectedEdge}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={toolbarEl}
		class="floating-edge-toolbar"
		style={toolbarStyle}
		onpointerdown={(e) => e.stopPropagation()}
	>
		<!-- Edge type -->
		<div class="toolbar-edge-types">
			{#each edgeTypes as et}
				<button
					class="edge-type-btn"
					class:edge-type-btn-active={currentEdgeType === et.value}
					title={et.label}
					onclick={() => setEdgeType(et.value)}
				>
					<svg width="20" height="14" viewBox="0 0 20 14">
						{#if et.value === 'smoothstep'}
							<path d="M2 2 L2 7 Q2 9 4 9 L16 9 Q18 9 18 11 L18 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						{:else if et.value === 'bezier'}
							<path d="M2 2 C2 10 18 4 18 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						{:else if et.value === 'straight'}
							<line x1="2" y1="2" x2="18" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						{:else}
							<path d="M2 2 L2 7 L18 7 L18 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="miter"/>
						{/if}
					</svg>
				</button>
			{/each}
		</div>

		<div class="toolbar-sep"></div>

		<!-- Color dots -->
		<div class="toolbar-colors">
			{#each colors as c}
				<button
					class="color-dot"
					class:color-dot-active={currentColor === c.value}
					style="background: {c.value || 'var(--color-edge-default)'};"
					title={c.label}
					onclick={() => setColor(c.value)}
				></button>
			{/each}
		</div>

		<div class="toolbar-sep"></div>

		<!-- Stroke style — split button -->
		<div class="split-btn" class:split-btn-open={strokeStyleOpen}>
			<button
				class="split-btn-main"
				title="Stroke style: {currentStrokeStyle}"
				onclick={() => { strokeStyleOpen = !strokeStyleOpen; strokeWidthOpen = false; }}
			>
				<svg width="24" height="10" viewBox="0 0 24 10">
					{#if currentStrokeStyle === 'solid'}
						<line x1="1" y1="5" x2="23" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
					{:else if currentStrokeStyle === 'dashed'}
						<line x1="1" y1="5" x2="23" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 3" />
					{:else}
						<line x1="1" y1="5" x2="23" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="1.5 3" />
					{/if}
				</svg>
				<svg class="split-chevron" width="8" height="8" viewBox="0 0 8 8"><path d="M2 3l2 2 2-2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
			</button>
			{#if strokeStyleOpen}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<button class="split-backdrop" onclick={() => (strokeStyleOpen = false)} aria-label="Close"></button>
				<div class="split-dropdown">
					{#each strokeStyles as ss}
						<button
							class="split-option"
							class:split-option-active={currentStrokeStyle === ss.value}
							onclick={() => { setStrokeStyle(ss.value); strokeStyleOpen = false; }}
						>
							<svg width="32" height="10" viewBox="0 0 32 10">
								{#if ss.value === 'solid'}
									<line x1="1" y1="5" x2="31" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
								{:else if ss.value === 'dashed'}
									<line x1="1" y1="5" x2="31" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 3" />
								{:else}
									<line x1="1" y1="5" x2="31" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="1.5 3" />
								{/if}
							</svg>
							<span class="split-label">{ss.label}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Stroke width — split button -->
		<div class="split-btn" class:split-btn-open={strokeWidthOpen}>
			<button
				class="split-btn-main"
				title="Stroke width: {currentStrokeWidth}"
				onclick={() => { strokeWidthOpen = !strokeWidthOpen; strokeStyleOpen = false; }}
			>
				<svg width="20" height="10" viewBox="0 0 20 10">
					<line x1="1" y1="5" x2="19" y2="5" stroke="currentColor" stroke-width={currentStrokeWidth * 1.2} stroke-linecap="round" />
				</svg>
				<svg class="split-chevron" width="8" height="8" viewBox="0 0 8 8"><path d="M2 3l2 2 2-2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
			</button>
			{#if strokeWidthOpen}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<button class="split-backdrop" onclick={() => (strokeWidthOpen = false)} aria-label="Close"></button>
				<div class="split-dropdown">
					{#each strokeWidths as sw}
						<button
							class="split-option"
							class:split-option-active={currentStrokeWidth === sw.value}
							onclick={() => { setStrokeWidth(sw.value); strokeWidthOpen = false; }}
						>
							<svg width="32" height="12" viewBox="0 0 32 12">
								<line x1="1" y1="6" x2="31" y2="6" stroke="currentColor" stroke-width={sw.value * 1.5} stroke-linecap="round" />
							</svg>
							<span class="split-label">{sw.label}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="toolbar-sep"></div>

		<!-- Add/Edit Label -->
		<button
			class="toolbar-btn"
			class:toolbar-btn-active={hasLabel}
			title={hasLabel ? 'Has label (double-click edge label to edit)' : 'Add label'}
			onclick={() => {
				if (!selectedEdge || hasLabel) return;
				pushHistory();
				updateEdge(selectedEdge.id, { label: 'Label' });
			}}
		>
			<Type size={14} />
		</button>

		<div class="toolbar-sep"></div>

		<!-- Delete -->
		<button class="toolbar-btn toolbar-btn-danger" title="Delete" onclick={handleDelete}>
			<Trash2 size={14} />
		</button>
	</div>
{/if}

<style>
	.floating-edge-toolbar {
		position: absolute;
		z-index: 35;
		display: flex;
		align-items: center;
		gap: 2px;
		height: 36px;
		padding: 0 5px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--color-bg-surface) 88%, transparent);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		border: 1px solid var(--color-border-primary);
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
		pointer-events: auto;
		animation: float-in 0.2s ease-out;
		white-space: nowrap;
	}

	@keyframes float-in {
		from { opacity: 0; scale: 0.95; }
		to { opacity: 1; scale: 1; }
	}

	.toolbar-sep {
		width: 1px;
		height: 18px;
		background: var(--color-border-primary);
		margin: 0 3px;
	}

	.toolbar-colors {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 3px;
	}

	.color-dot {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		transition: transform 0.12s ease, border-color 0.12s ease;
	}

	.color-dot:hover {
		transform: scale(1.2);
	}

	.color-dot-active {
		border-color: var(--color-text-primary);
	}

	.toolbar-edge-types {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 0 2px;
	}

	.edge-type-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 24px;
		border-radius: 5px;
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background-color 0.12s, color 0.12s;
	}

	.edge-type-btn:hover {
		background: var(--color-hover-overlay);
		color: var(--color-text-primary);
	}

	.edge-type-btn-active {
		background: color-mix(in srgb, var(--color-accent) 15%, transparent);
		color: var(--color-accent);
	}

	/* Split buttons for stroke style & width */
	.split-btn {
		position: relative;
		display: flex;
		align-items: center;
	}
	.split-btn-main {
		display: flex;
		align-items: center;
		gap: 3px;
		height: 26px;
		padding: 0 4px 0 8px;
		border-radius: 6px;
		border: 1px solid var(--color-border-primary);
		background: var(--color-bg-surface);
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: background-color 0.12s, color 0.12s, border-color 0.12s;
	}
	.split-btn-main:hover {
		background: var(--color-hover-overlay);
		color: var(--color-text-primary);
		border-color: var(--color-border-primary);
	}
	.split-btn-open .split-btn-main {
		background: color-mix(in srgb, var(--color-accent) 10%, var(--color-bg-surface));
		border-color: var(--color-accent);
		color: var(--color-accent);
	}
	.split-chevron {
		opacity: 0.4;
		flex-shrink: 0;
	}
	.split-btn-main:hover .split-chevron,
	.split-btn-open .split-chevron {
		opacity: 0.8;
	}
	.split-backdrop {
		position: fixed;
		inset: 0;
		z-index: 49;
		background: transparent;
		border: none;
		cursor: default;
	}
	.split-dropdown {
		position: absolute;
		bottom: calc(100% + 6px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 4px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--color-bg-surface) 95%, transparent);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		border: 1px solid var(--color-border-primary);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
		animation: float-in 0.15s ease-out;
		white-space: nowrap;
	}
	.split-option {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 10px;
		border-radius: 5px;
		border: none;
		background: transparent;
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: background-color 0.1s, color 0.1s;
	}
	.split-option:hover {
		background: var(--color-hover-overlay);
		color: var(--color-text-primary);
	}
	.split-option-active {
		background: color-mix(in srgb, var(--color-accent) 12%, transparent);
		color: var(--color-accent);
	}
	.split-label {
		font-size: 11px;
	}

	.toolbar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: background-color 0.12s, color 0.12s;
	}

	.toolbar-btn:hover {
		background: var(--color-hover-overlay);
		color: var(--color-text-primary);
	}

	.toolbar-btn-active {
		color: var(--color-accent);
	}

	.toolbar-btn-danger:hover {
		background: var(--color-error-bg);
		color: var(--color-error-accent);
	}
</style>
