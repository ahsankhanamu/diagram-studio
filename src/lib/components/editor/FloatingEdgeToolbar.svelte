<script lang="ts">
	import { Trash2, Type } from 'lucide-svelte';
	import { selectedEdgeIds, selectedEdgeCount, clearSelection } from '$lib/stores/selectionStore';
	import { edges, updateEdge, removeEdges } from '$lib/stores/diagramStore';
	import { nodes } from '$lib/stores/diagramStore';
	import { pushHistory } from '$lib/stores/historyStore';
	import { viewport } from '$lib/stores/viewportStore';
	import type { DiagramEdge } from '$lib/types/diagram';

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

		// Get handle positions
		function handlePos(node: { size: { width: number; height: number } }, abs: { x: number; y: number }, handle: string) {
			switch (handle) {
				case 'top': return { x: abs.x + node.size.width / 2, y: abs.y };
				case 'bottom': return { x: abs.x + node.size.width / 2, y: abs.y + node.size.height };
				case 'left': return { x: abs.x, y: abs.y + node.size.height / 2 };
				case 'right': return { x: abs.x + node.size.width, y: abs.y + node.size.height / 2 };
				default: return { x: abs.x + node.size.width / 2, y: abs.y + node.size.height };
			}
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

	const hasLabel = $derived(!!selectedEdge?.label);

	const currentColor = $derived(selectedEdge?.strokeColor || '');
	const currentStrokeStyle = $derived(selectedEdge?.strokeStyle || 'solid');
	const currentStrokeWidth = $derived(selectedEdge?.strokeWidth ?? 1.5);

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

		<!-- Stroke style -->
		<div class="toolbar-strokes">
			{#each strokeStyles as ss}
				<button
					class="stroke-btn"
					class:stroke-btn-active={currentStrokeStyle === ss.value}
					title={ss.label}
					onclick={() => setStrokeStyle(ss.value)}
				>
					<svg width="20" height="10" viewBox="0 0 20 10">
						{#if ss.value === 'solid'}
							<line x1="1" y1="5" x2="19" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
						{:else if ss.value === 'dashed'}
							<line x1="1" y1="5" x2="19" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 3" />
						{:else}
							<line x1="1" y1="5" x2="19" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="1.5 3" />
						{/if}
					</svg>
				</button>
			{/each}
		</div>

		<div class="toolbar-sep"></div>

		<!-- Stroke width -->
		<div class="toolbar-widths">
			{#each strokeWidths as sw}
				<button
					class="width-btn"
					class:width-btn-active={currentStrokeWidth === sw.value}
					title={sw.label}
					onclick={() => setStrokeWidth(sw.value)}
				>
					<svg width="16" height="10" viewBox="0 0 16 10">
						<line x1="1" y1="5" x2="15" y2="5" stroke="currentColor" stroke-width={sw.value * 1.2} stroke-linecap="round" />
					</svg>
				</button>
			{/each}
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

	.toolbar-strokes, .toolbar-widths {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 0 2px;
	}

	.stroke-btn, .width-btn {
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

	.stroke-btn:hover, .width-btn:hover {
		background: var(--color-hover-overlay);
		color: var(--color-text-primary);
	}

	.stroke-btn-active, .width-btn-active {
		background: color-mix(in srgb, var(--color-accent) 15%, transparent);
		color: var(--color-accent);
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
