import { writable, derived } from 'svelte/store';

export const selectedNodeIds = writable<Set<string>>(new Set());
export const selectedEdgeIds = writable<Set<string>>(new Set());

export const hasSelection = derived(
	[selectedNodeIds, selectedEdgeIds],
	([$nodes, $edges]) => $nodes.size > 0 || $edges.size > 0
);

export const selectedNodeCount = derived(selectedNodeIds, ($n) => $n.size);
export const selectedEdgeCount = derived(selectedEdgeIds, ($e) => $e.size);

export function selectNodes(ids: string[]): void {
	selectedNodeIds.set(new Set(ids));
}

export function selectEdges(ids: string[]): void {
	selectedEdgeIds.set(new Set(ids));
}

export function clearSelection(): void {
	selectedNodeIds.set(new Set());
	selectedEdgeIds.set(new Set());
}

export function toggleNodeSelection(id: string): void {
	selectedNodeIds.update(($s) => {
		const next = new Set($s);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		return next;
	});
}
