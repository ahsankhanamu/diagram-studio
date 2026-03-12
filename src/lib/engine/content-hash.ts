import type { DiagramNode, DiagramEdge } from '$lib/types/diagram';

/**
 * Build a deterministic canonical string from nodes + edges.
 * Used for snapshot comparison — only model-significant fields are included.
 * Viewport, version, timestamps, and metadata are excluded.
 */
export function buildCanonicalSnapshot(
	nodes: Map<string, DiagramNode>,
	edges: Map<string, DiagramEdge>
): string {
	const sortedNodes = Array.from(nodes.values())
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((n) => ({
			id: n.id,
			type: n.type,
			label: n.label,
			description: n.description,
			position: n.position,
			size: n.size,
			ports: n.ports,
			style: n.style,
			data: n.data,
			parentId: n.parentId
		}));

	const sortedEdges = Array.from(edges.values())
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((e) => ({
			id: e.id,
			source: e.source,
			target: e.target,
			sourceHandle: e.sourceHandle,
			targetHandle: e.targetHandle,
			type: e.type,
			label: e.label,
			description: e.description,
			animated: e.animated,
			strokeColor: e.strokeColor,
			strokeWidth: e.strokeWidth,
			strokeStyle: e.strokeStyle,
			markerStart: e.markerStart,
			markerEnd: e.markerEnd
		}));

	return JSON.stringify({ n: sortedNodes, e: sortedEdges });
}
