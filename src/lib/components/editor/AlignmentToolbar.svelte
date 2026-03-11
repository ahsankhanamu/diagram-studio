<script lang="ts">
	import {
		AlignLeft,
		AlignCenter,
		AlignRight,
		AlignStartVertical,
		AlignCenterVertical,
		AlignEndVertical,
		AlignHorizontalSpaceAround,
		AlignVerticalSpaceAround,
		Group,
		Ungroup
	} from 'lucide-svelte';
	import { selectedNodeIds, selectedNodeCount, clearSelection } from '$lib/stores/selectionStore';
	import { nodes, updateNode, groupNodes, ungroupNodes } from '$lib/stores/diagramStore';
	import { pushHistory } from '$lib/stores/historyStore';
	import { alignNodes, distributeNodes, type AlignDirection, type DistributeDirection } from '$lib/engine/alignment';
	import type { DiagramNode } from '$lib/types/diagram';

	const show = $derived($selectedNodeCount >= 2);

	// Check if any selected node is a group or is inside a group
	const canUngroup = $derived.by(() => {
		const ids = $selectedNodeIds;
		const all = $nodes;
		for (const id of ids) {
			const node = all.get(id);
			if (node?.type === 'group' || node?.parentId) return true;
		}
		return false;
	});

	function getSelectedNodes(): DiagramNode[] {
		const ids = $selectedNodeIds;
		const all = $nodes;
		return Array.from(ids)
			.map((id) => all.get(id))
			.filter(Boolean) as DiagramNode[];
	}

	function applyAlignment(direction: AlignDirection) {
		pushHistory();
		const selected = getSelectedNodes();
		const aligned = alignNodes(selected, direction);
		for (const n of aligned) {
			updateNode(n.id, { position: n.position });
		}
	}

	function applyDistribute(direction: DistributeDirection) {
		pushHistory();
		const selected = getSelectedNodes();
		const distributed = distributeNodes(selected, direction);
		for (const n of distributed) {
			updateNode(n.id, { position: n.position });
		}
	}

	function handleGroup() {
		const ids = Array.from($selectedNodeIds);
		console.log('[AlignmentToolbar.handleGroup] Selected:', ids.length, ids);
		if (ids.length < 2) return;
		pushHistory();
		const groupId = groupNodes(ids);
		console.log('[AlignmentToolbar.handleGroup] Result:', groupId);
		if (groupId) clearSelection();
	}

	function handleUngroup() {
		const ids = Array.from($selectedNodeIds);
		const all = $nodes;
		for (const id of ids) {
			const node = all.get(id);
			if (node?.type === 'group') {
				pushHistory();
				ungroupNodes(id);
				clearSelection();
				return;
			}
			if (node?.parentId) {
				pushHistory();
				ungroupNodes(node.parentId);
				clearSelection();
				return;
			}
		}
	}

	const buttons = [
		{ icon: AlignLeft, title: 'Align Left', action: () => applyAlignment('left') },
		{ icon: AlignCenter, title: 'Align Center', action: () => applyAlignment('center') },
		{ icon: AlignRight, title: 'Align Right', action: () => applyAlignment('right') },
		{ icon: AlignStartVertical, title: 'Align Top', action: () => applyAlignment('top') },
		{ icon: AlignCenterVertical, title: 'Align Middle', action: () => applyAlignment('middle') },
		{ icon: AlignEndVertical, title: 'Align Bottom', action: () => applyAlignment('bottom') },
		{ icon: AlignHorizontalSpaceAround, title: 'Distribute Horizontal', action: () => applyDistribute('horizontal') },
		{ icon: AlignVerticalSpaceAround, title: 'Distribute Vertical', action: () => applyDistribute('vertical') }
	];
</script>

{#if show}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-full border px-2 py-1 shadow-md"
		style="background: color-mix(in srgb, var(--color-bg-surface) 88%, transparent); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border-color: var(--color-border-primary);"
		onpointerdown={(e) => e.stopPropagation()}
	>
		<span class="px-1 text-[10px] font-medium" style="color: var(--color-text-muted);">
			{$selectedNodeCount} selected
		</span>
		<div class="mx-0.5 h-4 w-px" style="background: var(--color-border-primary);"></div>
		{#each buttons as btn, i}
			{#if i === 6}
				<div class="mx-0.5 h-4 w-px" style="background: var(--color-border-primary);"></div>
			{/if}
			<button
				onclick={btn.action}
				title={btn.title}
				class="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
				style="color: var(--color-text-secondary);"
				onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
				onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
			>
				<btn.icon size={14} />
			</button>
		{/each}

		<!-- Group / Ungroup -->
		<div class="mx-0.5 h-4 w-px" style="background: var(--color-border-primary);"></div>
		<button
			onclick={handleGroup}
			title="Group (Cmd+G)"
			class="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
			style="color: var(--color-text-secondary);"
			onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
			onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
		>
			<Group size={14} />
		</button>
		{#if canUngroup}
			<button
				onclick={handleUngroup}
				title="Ungroup (Cmd+Shift+G)"
				class="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
				style="color: var(--color-text-secondary);"
				onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover-overlay)')}
				onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
			>
				<Ungroup size={14} />
			</button>
		{/if}
	</div>
{/if}
