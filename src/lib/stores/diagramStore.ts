import { writable, derived, get as get_store_value } from 'svelte/store';
import type { DiagramNode, DiagramEdge, DiagramMetadata } from '$lib/types/diagram';
import { generateId } from '$lib/utils';
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '$lib/constants';
import { nodeRegistry } from '$lib/components/nodes';
import { defaultEdgeType } from '$lib/stores/edgePrefsStore';

export const nodes = writable<Map<string, DiagramNode>>(new Map());
export const edges = writable<Map<string, DiagramEdge>>(new Map());
export const nodeList = derived(nodes, ($n) => Array.from($n.values()));
export const edgeList = derived(edges, ($e) => Array.from($e.values()));

export const diagramMeta = writable<{
	id: string;
	name: string;
	description: string;
	diagramType: string;
	version: number;
	metadata: DiagramMetadata;
} | null>(null);

export const isDirty = writable(false);
export const saveStatus = writable<'saved' | 'saving' | 'unsaved'>('saved');

// ── Direct mutation callback ───────────────────────────────────────
// No Svelte reactivity. Page registers a callback, mutations call it.
let _onMutation: (() => void) | null = null;
export function registerOnMutation(cb: () => void) { _onMutation = cb; }
export function unregisterOnMutation() { _onMutation = null; }

export function notifyMutation() {
	isDirty.set(true);
	saveStatus.set('unsaved');
	_onMutation?.();
}

// ── Mutations ──────────────────────────────────────────────────────

export function addNode(
	type: string,
	position: { x: number; y: number },
	label?: string
): string {
	const id = generateId('node');
	const def = nodeRegistry[type];
	const node: DiagramNode = {
		id,
		type,
		label: label || def?.label || type,
		description: '',
		position,
		size: def?.defaultSize || { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT },
		data: def?.defaultData ? { ...def.defaultData } : {},
		style: {},
		ports: def?.defaultPorts || { top: true, bottom: true, left: true, right: true }
	};

	nodes.update(($n) => {
		const map = new Map($n);
		map.set(id, node);
		return map;
	});
	notifyMutation();
	return id;
}

export function updateNode(id: string, updates: Partial<DiagramNode>): void {
	nodes.update(($n) => {
		const node = $n.get(id);
		if (!node) return $n;
		const map = new Map($n);
		map.set(id, { ...node, ...updates });
		return map;
	});
	notifyMutation();
}

/** Update a node without triggering the save pipeline.
 *  Used for SvelteFlow dimension measurements which are not user edits. */
export function updateNodeSilent(id: string, updates: Partial<DiagramNode>): void {
	nodes.update(($n) => {
		const node = $n.get(id);
		if (!node) return $n;
		const map = new Map($n);
		map.set(id, { ...node, ...updates });
		return map;
	});
}

export function removeNodes(ids: string[]): void {
	const idSet = new Set(ids);
	nodes.update(($n) => {
		const map = new Map($n);
		for (const id of ids) map.delete(id);
		return map;
	});
	edges.update(($e) => {
		const map = new Map($e);
		for (const [eId, edge] of map) {
			if (idSet.has(edge.source) || idSet.has(edge.target)) {
				map.delete(eId);
			}
		}
		return map;
	});
	notifyMutation();
}

export function addEdge(
	source: string,
	target: string,
	sourceHandle: string = 'bottom',
	targetHandle: string = 'top',
	edgeType?: string
): string {
	// Use the user's default edge type preference if not explicitly set
	if (!edgeType) edgeType = get_store_value(defaultEdgeType);
	const id = generateId('edge');
	const edge: DiagramEdge = {
		id,
		source,
		target,
		sourceHandle,
		targetHandle,
		type: edgeType,
		label: '',
		description: '',
		animated: false,
		style: {},
		markerEnd: 'arrowclosed',
		strokeStyle: 'solid',
		strokeWidth: 1.5
	};

	edges.update(($e) => {
		const map = new Map($e);
		map.set(id, edge);
		return map;
	});
	notifyMutation();
	return id;
}

export function updateEdge(id: string, updates: Partial<DiagramEdge>): void {
	edges.update(($e) => {
		const edge = $e.get(id);
		if (!edge) return $e;
		const map = new Map($e);
		map.set(id, { ...edge, ...updates });
		return map;
	});
	notifyMutation();
}

export function removeEdges(ids: string[]): void {
	edges.update(($e) => {
		const map = new Map($e);
		for (const id of ids) map.delete(id);
		return map;
	});
	notifyMutation();
}

export function insertNodeOnEdge(
	edgeId: string,
	nodeType: string,
	position: { x: number; y: number }
): string | null {
	let oldEdge: DiagramEdge | undefined;
	const currentEdges = get_store_value(edges);
	oldEdge = currentEdges.get(edgeId);
	if (!oldEdge) return null;

	removeEdges([edgeId]);
	const newNodeId = addNode(nodeType, position);
	addEdge(oldEdge.source, newNodeId, oldEdge.sourceHandle, 'top', oldEdge.type);
	addEdge(newNodeId, oldEdge.target, 'bottom', oldEdge.targetHandle, oldEdge.type);
	return newNodeId;
}

export function groupNodes(nodeIds: string[]): string | null {
	console.log('[groupNodes] Input:', nodeIds.length, 'IDs:', nodeIds);
	if (nodeIds.length < 2) return null;
	const currentNodes = get_store_value(nodes);
	// Only group non-group, non-parented nodes
	const selected = nodeIds
		.map((id) => {
			const n = currentNodes.get(id);
			console.log('[groupNodes] Node', id, '→', n ? `${n.type} "${n.label}"` : 'NOT FOUND');
			return n;
		})
		.filter((n): n is DiagramNode => !!n && n.type !== 'group' && !n.parentId);
	console.log('[groupNodes] After filter:', selected.length, 'eligible nodes');
	if (selected.length < 2) return null;

	const PADDING = 40;
	const HEADER_HEIGHT = 32;
	const minX = Math.min(...selected.map((n) => n.position.x)) - PADDING;
	const minY = Math.min(...selected.map((n) => n.position.y)) - PADDING - HEADER_HEIGHT;
	const maxX = Math.max(...selected.map((n) => n.position.x + n.size.width)) + PADDING;
	const maxY = Math.max(...selected.map((n) => n.position.y + n.size.height)) + PADDING;

	const groupId = generateId('node');
	const groupNode: DiagramNode = {
		id: groupId,
		type: 'group',
		label: 'Group',
		description: '',
		position: { x: minX, y: minY },
		size: { width: maxX - minX, height: maxY - minY },
		data: {},
		style: {},
		ports: { top: false, bottom: false, left: false, right: false }
	};

	nodes.update(($n) => {
		const map = new Map($n);
		map.set(groupId, groupNode);
		for (const child of selected) {
			map.set(child.id, {
				...child,
				parentId: groupId,
				extent: 'parent',
				position: {
					x: child.position.x - minX,
					y: child.position.y - minY
				}
			});
		}
		return map;
	});
	notifyMutation();
	return groupId;
}

export function ungroupNodes(groupId: string): void {
	const currentNodes = get_store_value(nodes);
	const group = currentNodes.get(groupId);
	if (!group || group.type !== 'group') return;

	nodes.update(($n) => {
		const map = new Map($n);
		for (const [id, node] of map) {
			if (node.parentId === groupId) {
				map.set(id, {
					...node,
					parentId: undefined,
					extent: undefined,
					position: {
						x: node.position.x + group.position.x,
						y: node.position.y + group.position.y
					}
				});
			}
		}
		map.delete(groupId);
		return map;
	});
	notifyMutation();
}
