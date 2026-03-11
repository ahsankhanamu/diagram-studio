<script lang="ts">
	import { Copy, Lock, Trash2, Group } from 'lucide-svelte';
	import { selectedNodeIds, selectedNodeCount, clearSelection } from '$lib/stores/selectionStore';
	import { nodes, updateNode, removeNodes, addNode } from '$lib/stores/diagramStore';
	import { pushHistory } from '$lib/stores/historyStore';
	import type { DiagramNode } from '$lib/types/diagram';

	const show = $derived($selectedNodeCount === 1);

	const selectedNode = $derived.by((): DiagramNode | null => {
		if ($selectedNodeCount !== 1) return null;
		const id = Array.from($selectedNodeIds)[0];
		return $nodes.get(id) ?? null;
	});

	const colors = [
		{ label: 'Blue', value: '#3b82f6' },
		{ label: 'Indigo', value: '#6366f1', active: true },
		{ label: 'Green', value: '#10b981' },
		{ label: 'Amber', value: '#f59e0b' },
		{ label: 'Red', value: '#ef4444' },
	];

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
		updateNode(selectedNode.id, {
			style: { ...selectedNode.style, borderColor: hex, backgroundColor: undefined }
		});
	}
</script>

{#if show && selectedNode}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="floating-node-toolbar"
		onpointerdown={(e) => e.stopPropagation()}
	>
		<!-- Duplicate -->
		<button class="toolbar-btn" title="Duplicate" onclick={handleDuplicate}>
			<Copy size={14} />
		</button>

		<!-- Lock (placeholder) -->
		<button class="toolbar-btn" title="Lock position">
			<Lock size={14} />
		</button>

		<div class="toolbar-sep"></div>

		<!-- Inline color dots -->
		<div class="toolbar-colors">
			{#each colors as c}
				<button
					class="color-dot"
					class:color-dot-active={selectedNode.style?.borderColor === c.value}
					style="background: {c.value};"
					title={c.label}
					onclick={() => handleSetColor(c.value)}
				></button>
			{/each}
		</div>

		<div class="toolbar-sep"></div>

		<!-- Group -->
		<button class="toolbar-btn" title="Group">
			<Group size={14} />
		</button>

		<!-- Delete -->
		<button class="toolbar-btn toolbar-btn-danger" title="Delete" onclick={handleDelete}>
			<Trash2 size={14} />
		</button>
	</div>
{/if}

<style>
	.floating-node-toolbar {
		position: absolute;
		top: 8px;
		right: 8px;
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
		animation: float-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes float-in {
		from { opacity: 0; transform: translateY(6px) scale(0.95); }
		to { opacity: 1; transform: translateY(0) scale(1); }
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
</style>
