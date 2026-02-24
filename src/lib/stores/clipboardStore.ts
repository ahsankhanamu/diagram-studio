import { writable, get } from 'svelte/store';
import { nodes, edges, addNode, addEdge } from './diagramStore';
import { selectedNodeIds } from './selectionStore';
import { pushHistory } from './historyStore';
import type { DiagramNode, DiagramEdge } from '$lib/types/diagram';
import { generateId } from '$lib/utils';

interface ClipboardData {
	nodes: DiagramNode[];
	edges: DiagramEdge[];
}

export const clipboard = writable<ClipboardData | null>(null);

const PASTE_OFFSET = 40;

export function copySelected(): void {
	const $nodes = get(nodes);
	const $edges = get(edges);
	const $selected = get(selectedNodeIds);

	if ($selected.size === 0) return;

	const copiedNodes: DiagramNode[] = [];
	for (const id of $selected) {
		const node = $nodes.get(id);
		if (node) copiedNodes.push({ ...node });
	}

	// Copy edges where both source and target are selected
	const copiedEdges: DiagramEdge[] = [];
	for (const [, edge] of $edges) {
		if ($selected.has(edge.source) && $selected.has(edge.target)) {
			copiedEdges.push({ ...edge });
		}
	}

	clipboard.set({ nodes: copiedNodes, edges: copiedEdges });
}

export function paste(): void {
	const data = get(clipboard);
	if (!data || data.nodes.length === 0) return;

	pushHistory();

	// Generate new IDs
	const idMap = new Map<string, string>();
	for (const node of data.nodes) {
		idMap.set(node.id, generateId('node'));
	}
	for (const edge of data.edges) {
		idMap.set(edge.id, generateId('edge'));
	}

	// Paste nodes with new IDs and offset position
	const $nodes = get(nodes);
	const newNodeMap = new Map($nodes);
	for (const node of data.nodes) {
		const newId = idMap.get(node.id)!;
		newNodeMap.set(newId, {
			...node,
			id: newId,
			position: {
				x: node.position.x + PASTE_OFFSET,
				y: node.position.y + PASTE_OFFSET
			}
		});
	}
	nodes.set(newNodeMap);

	// Paste edges with remapped source/target
	const $edges = get(edges);
	const newEdgeMap = new Map($edges);
	for (const edge of data.edges) {
		const newId = idMap.get(edge.id)!;
		const newSource = idMap.get(edge.source);
		const newTarget = idMap.get(edge.target);
		if (newSource && newTarget) {
			newEdgeMap.set(newId, {
				...edge,
				id: newId,
				source: newSource,
				target: newTarget
			});
		}
	}
	edges.set(newEdgeMap);

	// Select pasted nodes
	const newIds = new Set(data.nodes.map((n) => idMap.get(n.id)!));
	selectedNodeIds.set(newIds);

	// Update clipboard with offset for repeated paste
	clipboard.set({
		nodes: data.nodes.map((n) => ({
			...n,
			position: { x: n.position.x + PASTE_OFFSET, y: n.position.y + PASTE_OFFSET }
		})),
		edges: data.edges
	});
}
