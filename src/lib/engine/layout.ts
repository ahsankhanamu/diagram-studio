import dagre from '@dagrejs/dagre';
import type { DiagramNode, DiagramEdge } from '$lib/types/diagram';
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '$lib/constants';

export type LayoutDirection = 'TB' | 'LR';

export function autoLayout(
	nodes: DiagramNode[],
	edges: DiagramEdge[],
	direction: LayoutDirection = 'TB'
): DiagramNode[] {
	const g = new dagre.graphlib.Graph();
	g.setDefaultEdgeLabel(() => ({}));

	g.setGraph({
		rankdir: direction,
		nodesep: 60,
		ranksep: 80,
		edgesep: 30,
		marginx: 40,
		marginy: 40
	});

	for (const node of nodes) {
		g.setNode(node.id, {
			width: node.size?.width || DEFAULT_NODE_WIDTH,
			height: node.size?.height || DEFAULT_NODE_HEIGHT
		});
	}

	for (const edge of edges) {
		if (edge.label) {
			// Reserve space around the label so it doesn't overlap nodes or other edges
			const labelW = Math.round(edge.label.length * 6.5 + 20);
			g.setEdge(edge.source, edge.target, { label: edge.label, width: labelW, height: 22 });
		} else {
			g.setEdge(edge.source, edge.target);
		}
	}

	dagre.layout(g);

	return nodes.map((node) => {
		const positioned = g.node(node.id);
		if (!positioned) return node;
		return {
			...node,
			position: {
				x: positioned.x - (node.size?.width || DEFAULT_NODE_WIDTH) / 2,
				y: positioned.y - (node.size?.height || DEFAULT_NODE_HEIGHT) / 2
			}
		};
	});
}
