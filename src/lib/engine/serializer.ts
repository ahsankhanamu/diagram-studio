import type { Node, Edge, MarkerType as XYMarkerType } from '@xyflow/svelte';
import type { DiagramNode, DiagramEdge, MarkerType } from '$lib/types/diagram';

/**
 * Convert DiagramNode[] to SvelteFlow Node[]
 */
export function toFlowNodes(diagramNodes: DiagramNode[], selectedIds?: Set<string>): Node[] {
	// Sort so parents come before children (SvelteFlow requirement)
	const sorted = [...diagramNodes].sort((a, b) => {
		if (a.id === b.parentId) return -1;
		if (b.id === a.parentId) return 1;
		if (a.parentId && !b.parentId) return 1;
		if (!a.parentId && b.parentId) return -1;
		return 0;
	});

	return sorted.map((n) => {
		const node: Node = {
			id: n.id,
			type: n.type,
			position: { x: n.position.x, y: n.position.y },
			width: n.size.width,
			height: n.size.height,
			selected: selectedIds ? selectedIds.has(n.id) : undefined,
			data: {
				label: n.label,
				description: n.description,
				ports: n.ports,
				nodeWidth: n.size.width,
				nodeHeight: n.size.height,
				customStyle: Object.keys(n.style).length > 0 ? n.style : undefined,
				...n.data
			}
		};
		if (n.parentId) {
			node.parentId = n.parentId;
			node.extent = n.extent || 'parent';
		}
		if (n.type === 'group') {
			node.style = `width: ${n.size.width}px; height: ${n.size.height}px;`;
			node.dragHandle = '.group-drag-handle';
		}
		return node;
	});
}

function mapMarker(marker: MarkerType | undefined): { type: XYMarkerType; color?: string } | undefined {
	if (!marker || marker === 'none') return undefined;
	const typeMap: Record<string, XYMarkerType> = {
		arrow: 'arrow' as XYMarkerType,
		arrowclosed: 'arrowclosed' as XYMarkerType,
	};
	return { type: typeMap[marker] || ('arrowclosed' as XYMarkerType) };
}

/**
 * Convert DiagramEdge[] to SvelteFlow Edge[]
 */
export function toFlowEdges(diagramEdges: DiagramEdge[]): Edge[] {
	return diagramEdges.map((e) => {
		const strokeWidth = e.strokeWidth ?? 1.5;
		const strokeColor = e.strokeColor || 'var(--color-edge-default)';
		const strokeStyle = e.strokeStyle || 'solid';
		const dashArray = strokeStyle === 'dashed' ? '8 4' : strokeStyle === 'dotted' ? '2 4' : '';

		let style = `stroke: ${strokeColor}; stroke-width: ${strokeWidth};`;
		if (dashArray) style += ` stroke-dasharray: ${dashArray};`;

		const edge: Edge = {
			id: e.id,
			source: e.source,
			target: e.target,
			sourceHandle: e.sourceHandle,
			targetHandle: e.targetHandle,
			type: e.type || 'smoothstep',
			label: e.label || undefined,
			animated: e.animated,
			selectable: true,
			focusable: true,
			data: {
				description: e.description,
				strokeStyle,
				strokeWidth,
				strokeColor: e.strokeColor || '',
				animated: e.animated
			},
			style
		};

		const markerEnd = mapMarker(e.markerEnd ?? 'arrowclosed');
		const markerStart = mapMarker(e.markerStart);
		if (markerEnd) edge.markerEnd = markerEnd;
		if (markerStart) edge.markerStart = markerStart;

		return edge;
	});
}
