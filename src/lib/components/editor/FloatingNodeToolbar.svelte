<script lang="ts">
	import { Copy, Trash2 } from 'lucide-svelte';
	import { selectedNodeIds, selectedNodeCount, clearSelection } from '$lib/stores/selectionStore';
	import { nodes, updateNode, removeNodes, addNode } from '$lib/stores/diagramStore';
	import { pushHistory } from '$lib/stores/historyStore';
	import { viewport } from '$lib/stores/viewportStore';
	import type { DiagramNode } from '$lib/types/diagram';

	interface Props {
		hidden?: boolean;
	}

	const { hidden = false }: Props = $props();

	const show = $derived($selectedNodeCount === 1 && !hidden);

	const selectedNode = $derived.by((): DiagramNode | null => {
		if ($selectedNodeCount !== 1) return null;
		const id = Array.from($selectedNodeIds)[0];
		return $nodes.get(id) ?? null;
	});

	let toolbarEl: HTMLDivElement | undefined = $state();

	const TOOLBAR_GAP = 12;
	const VIEWPORT_PAD = 8;

	// Compute screen position of toolbar relative to the selected node, clamped to viewport
	const toolbarStyle = $derived.by(() => {
		if (!selectedNode) return '';
		const vp = $viewport;

		// Resolve absolute position (children store relative coords)
		let absX = selectedNode.position.x;
		let absY = selectedNode.position.y;
		if (selectedNode.parentId) {
			const parent = $nodes.get(selectedNode.parentId);
			if (parent) {
				absX += parent.position.x;
				absY += parent.position.y;
			}
		}

		const nodeScreenX = absX * vp.zoom + vp.x;
		const nodeScreenY = absY * vp.zoom + vp.y;
		const nodeScreenW = selectedNode.size.width * vp.zoom;
		const nodeScreenH = selectedNode.size.height * vp.zoom;

		// Toolbar dimensions (use measured or estimate)
		const tbW = toolbarEl?.offsetWidth ?? 340;
		const tbH = toolbarEl?.offsetHeight ?? 36;

		// Center horizontally on the node
		let left = nodeScreenX + nodeScreenW / 2 - tbW / 2;

		// Default: above the node
		let top = nodeScreenY - tbH - TOOLBAR_GAP;
		let placedBelow = false;

		// If clipped at top, flip to below the node
		if (top < VIEWPORT_PAD) {
			top = nodeScreenY + nodeScreenH + TOOLBAR_GAP;
			placedBelow = true;
		}

		// Clamp horizontal to viewport
		const maxLeft = window.innerWidth - tbW - VIEWPORT_PAD;
		left = Math.max(VIEWPORT_PAD, Math.min(left, maxLeft));

		// Clamp vertical bottom
		const maxTop = window.innerHeight - tbH - VIEWPORT_PAD;
		top = Math.min(top, maxTop);

		return `left:${left}px;top:${top}px;transform-origin:center ${placedBelow ? 'top' : 'bottom'};`;
	});

	const colors = [
		{ label: 'Blue', value: '#3b82f6' },
		{ label: 'Indigo', value: '#6366f1' },
		{ label: 'Green', value: '#10b981' },
		{ label: 'Amber', value: '#f59e0b' },
		{ label: 'Red', value: '#ef4444' },
		{ label: 'Gray', value: '#6b7280' },
	];

	const borderStyles = [
		{ label: 'None', value: 'none', icon: 'none' },
		{ label: 'Solid', value: 'solid', icon: 'solid' },
		{ label: 'Dashed', value: 'dashed', icon: 'dashed' },
		{ label: 'Dotted', value: 'dotted', icon: 'dotted' },
	];

	const currentBorderStyle = $derived(selectedNode?.style?.borderStyle || 'solid');
	const currentColor = $derived(selectedNode?.style?.borderColor || '');

	function handleDuplicate() {
		if (!selectedNode) return;
		pushHistory();
		const pos = {
			x: selectedNode.position.x + 30,
			y: selectedNode.position.y + 30
		};
		addNode(selectedNode.type, pos, selectedNode.label + ' (copy)');
	}

	function handleDelete() {
		if (!selectedNode) return;
		pushHistory();
		removeNodes([selectedNode.id]);
		clearSelection();
	}

	function handleSetColor(hex: string) {
		if (!selectedNode) return;
		pushHistory();
		const newStyle = { ...selectedNode.style };
		newStyle.borderColor = hex;
		updateNode(selectedNode.id, { style: newStyle });
	}

	function handleSetBorderStyle(style: string) {
		if (!selectedNode) return;
		pushHistory();
		const newStyle = { ...selectedNode.style };
		newStyle.borderStyle = style;
		updateNode(selectedNode.id, { style: newStyle });
	}
</script>

{#if show && selectedNode}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={toolbarEl}
		class="floating-node-toolbar"
		style={toolbarStyle}
		onpointerdown={(e) => e.stopPropagation()}
	>
		<!-- Duplicate -->
		<button class="toolbar-btn" title="Duplicate" onclick={handleDuplicate}>
			<Copy size={14} />
		</button>

		<div class="toolbar-sep"></div>

		<!-- Inline color dots -->
		<div class="toolbar-colors">
			{#each colors as c}
				<button
					class="color-dot"
					class:color-dot-active={currentColor === c.value}
					style="background: {c.value};"
					title={c.label}
					onclick={() => handleSetColor(c.value)}
				></button>
			{/each}
		</div>

		<div class="toolbar-sep"></div>

		<!-- Border style -->
		<div class="toolbar-borders">
			{#each borderStyles as bs}
				<button
					class="border-btn"
					class:border-btn-active={currentBorderStyle === bs.value}
					title={bs.label}
					onclick={() => handleSetBorderStyle(bs.value)}
				>
					{#if bs.value === 'none'}
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
							<line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
							<rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
						</svg>
					{:else if bs.value === 'solid'}
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
							<rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.5"/>
						</svg>
					{:else if bs.value === 'dashed'}
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
							<rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/>
						</svg>
					{:else}
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
							<rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.5" stroke-dasharray="1.5 2"/>
						</svg>
					{/if}
				</button>
			{/each}
		</div>

		<div class="toolbar-sep"></div>

		<!-- Delete -->
		<button class="toolbar-btn toolbar-btn-danger" title="Delete" onclick={handleDelete}>
			<Trash2 size={14} />
		</button>
	</div>
{/if}

<style>
	.floating-node-toolbar {
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

	.toolbar-btn-danger:hover {
		background: var(--color-error-bg);
		color: var(--color-error-accent);
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

	.toolbar-borders {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 0 2px;
	}

	.border-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 5px;
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background-color 0.12s, color 0.12s;
	}

	.border-btn:hover {
		background: var(--color-hover-overlay);
		color: var(--color-text-primary);
	}

	.border-btn-active {
		background: color-mix(in srgb, var(--color-accent) 15%, transparent);
		color: var(--color-accent);
	}
</style>
