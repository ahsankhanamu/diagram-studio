import type { DiagramNode, DiagramEdge, HandleDistributionMode } from '$lib/types/diagram';

type Side = 'top' | 'bottom' | 'left' | 'right';

/**
 * Resolve the effective distribution mode for a given side of a node.
 * Priority: per-side > per-node (data.handleDistribution) > global default.
 */
export function resolveDistributionMode(
	node: DiagramNode,
	side: Side,
	globalDefault: HandleDistributionMode
): HandleDistributionMode {
	// Per-side override
	const sideKey = `${side}Distribution` as keyof typeof node.ports;
	const perSide = node.ports[sideKey] as HandleDistributionMode | undefined;
	if (perSide) return perSide;

	// Per-node override
	const perNode = node.data?.handleDistribution as HandleDistributionMode | undefined;
	if (perNode) return perNode;

	return globalDefault;
}

/** Get edges connected to a specific side of a node (as source or target). */
function getEdgesForSide(
	nodeId: string,
	side: Side,
	edges: DiagramEdge[]
): DiagramEdge[] {
	return edges.filter((e) => {
		if (e.source === nodeId) {
			const handle = e.sourceHandle || 'bottom';
			return parseSide(handle) === side;
		}
		if (e.target === nodeId) {
			const handle = e.targetHandle || 'top';
			return parseSide(handle) === side;
		}
		return false;
	});
}

/** Parse a handle ID like "bottom-2" into its side. */
function parseSide(handleId: string): Side {
	const dash = handleId.indexOf('-');
	const base = dash >= 0 ? handleId.substring(0, dash) : handleId;
	if (base === 'top' || base === 'bottom' || base === 'left' || base === 'right') return base;
	return 'bottom'; // fallback
}

/**
 * Compute all handle positions for a node, accounting for distribution mode.
 * Returns an array of { id, x, y, side } in absolute coordinates.
 */
export function computeHandlePositions(
	node: DiagramNode,
	absPos: { x: number; y: number },
	edges: DiagramEdge[],
	globalDefault: HandleDistributionMode
): { id: string; x: number; y: number; side: Side }[] {
	const { width: w, height: h } = node.size;
	const result: { id: string; x: number; y: number; side: Side }[] = [];
	const sides: Side[] = ['top', 'bottom', 'left', 'right'];

	for (const side of sides) {
		if (!node.ports[side]) continue;

		const mode = resolveDistributionMode(node, side, globalDefault);

		if (mode === 'center') {
			const pos = centerPosition(side, absPos, w, h);
			result.push({ id: side, ...pos, side });
		} else {
			const sideEdges = getEdgesForSide(node.id, side, edges);
			const count = Math.max(sideEdges.length, 1);
			for (let i = 0; i < count; i++) {
				const pos = distributedPosition(side, absPos, w, h, i, count);
				result.push({ id: count === 1 ? side : `${side}-${i}`, ...pos, side });
			}
		}
	}

	return result;
}

/** Resolve a single handle's absolute position. */
export function resolveHandlePosition(
	node: DiagramNode,
	absPos: { x: number; y: number },
	handleId: string,
	edges: DiagramEdge[],
	globalDefault: HandleDistributionMode
): { x: number; y: number } {
	const side = parseSide(handleId);
	const { width: w, height: h } = node.size;
	const mode = resolveDistributionMode(node, side, globalDefault);

	if (mode === 'center' || handleId === side) {
		// Bare handle ID or center mode → center point
		return centerPosition(side, absPos, w, h);
	}

	// Indexed handle: extract index
	const dash = handleId.indexOf('-');
	const index = dash >= 0 ? parseInt(handleId.substring(dash + 1), 10) : 0;
	const sideEdges = getEdgesForSide(node.id, side, edges);
	const count = Math.max(sideEdges.length, 1);

	return distributedPosition(side, absPos, w, h, Math.min(index, count - 1), count);
}

function centerPosition(
	side: Side,
	absPos: { x: number; y: number },
	w: number,
	h: number
): { x: number; y: number } {
	switch (side) {
		case 'top': return { x: absPos.x + w / 2, y: absPos.y };
		case 'bottom': return { x: absPos.x + w / 2, y: absPos.y + h };
		case 'left': return { x: absPos.x, y: absPos.y + h / 2 };
		case 'right': return { x: absPos.x + w, y: absPos.y + h / 2 };
	}
}

/**
 * Compute the position for handle at index `i` out of `count` handles on a side.
 * Uses equidistant distribution: sideLength * (i + 1) / (count + 1).
 */
function distributedPosition(
	side: Side,
	absPos: { x: number; y: number },
	w: number,
	h: number,
	i: number,
	count: number
): { x: number; y: number } {
	const fraction = (i + 1) / (count + 1);
	switch (side) {
		case 'top': return { x: absPos.x + w * fraction, y: absPos.y };
		case 'bottom': return { x: absPos.x + w * fraction, y: absPos.y + h };
		case 'left': return { x: absPos.x, y: absPos.y + h * fraction };
		case 'right': return { x: absPos.x + w, y: absPos.y + h * fraction };
	}
}

/**
 * After an edge add/remove or mode change, reassign indexed handle IDs for all edges
 * connected to a node. Sorts edges by the connected node's spatial position for consistency.
 *
 * Returns a map of edgeId → { sourceHandle?, targetHandle? } updates to apply.
 */
export function reassignEdgeHandles(
	nodeId: string,
	nodesMap: Map<string, DiagramNode>,
	edgesArr: DiagramEdge[],
	globalDefault: HandleDistributionMode
): Map<string, Partial<Pick<DiagramEdge, 'sourceHandle' | 'targetHandle'>>> {
	const node = nodesMap.get(nodeId);
	if (!node) return new Map();

	const updates = new Map<string, Partial<Pick<DiagramEdge, 'sourceHandle' | 'targetHandle'>>>();
	const sides: Side[] = ['top', 'bottom', 'left', 'right'];

	for (const side of sides) {
		if (!node.ports[side]) continue;

		const mode = resolveDistributionMode(node, side, globalDefault);

		// Collect edges on this side (split by source vs target)
		const sourceEdges: DiagramEdge[] = [];
		const targetEdges: DiagramEdge[] = [];
		for (const e of edgesArr) {
			if (e.source === nodeId && parseSide(e.sourceHandle || 'bottom') === side) {
				sourceEdges.push(e);
			}
			if (e.target === nodeId && parseSide(e.targetHandle || 'top') === side) {
				targetEdges.push(e);
			}
		}

		if (mode === 'center') {
			// All edges on this side get the bare handle ID
			for (const e of sourceEdges) {
				if (e.sourceHandle !== side) {
					const existing = updates.get(e.id) || {};
					updates.set(e.id, { ...existing, sourceHandle: side });
				}
			}
			for (const e of targetEdges) {
				if (e.targetHandle !== side) {
					const existing = updates.get(e.id) || {};
					updates.set(e.id, { ...existing, targetHandle: side });
				}
			}
		} else {
			// Sort by connected node position for spatial consistency
			const isHorizontalSide = side === 'top' || side === 'bottom';

			const sortedSource = [...sourceEdges].sort((a, b) => {
				const na = nodesMap.get(a.target);
				const nb = nodesMap.get(b.target);
				if (!na || !nb) return 0;
				return isHorizontalSide
					? na.position.x - nb.position.x
					: na.position.y - nb.position.y;
			});

			const sortedTarget = [...targetEdges].sort((a, b) => {
				const na = nodesMap.get(a.source);
				const nb = nodesMap.get(b.source);
				if (!na || !nb) return 0;
				return isHorizontalSide
					? na.position.x - nb.position.x
					: na.position.y - nb.position.y;
			});

			// All edges on this side share the same set of indices
			const allEdges = [...sortedSource, ...sortedTarget];
			// Re-sort combined set
			allEdges.sort((a, b) => {
				const connA = a.source === nodeId ? a.target : a.source;
				const connB = b.source === nodeId ? b.target : b.source;
				const na = nodesMap.get(connA);
				const nb = nodesMap.get(connB);
				if (!na || !nb) return 0;
				return isHorizontalSide
					? na.position.x - nb.position.x
					: na.position.y - nb.position.y;
			});

			const count = allEdges.length;
			for (let i = 0; i < count; i++) {
				const e = allEdges[i];
				const newHandle = count === 1 ? side : `${side}-${i}`;

				if (e.source === nodeId && parseSide(e.sourceHandle || 'bottom') === side) {
					if (e.sourceHandle !== newHandle) {
						const existing = updates.get(e.id) || {};
						updates.set(e.id, { ...existing, sourceHandle: newHandle });
					}
				}
				if (e.target === nodeId && parseSide(e.targetHandle || 'top') === side) {
					if (e.targetHandle !== newHandle) {
						const existing = updates.get(e.id) || {};
						updates.set(e.id, { ...existing, targetHandle: newHandle });
					}
				}
			}
		}
	}

	return updates;
}

/**
 * Compute handle data for rendering in NodeHandles.svelte.
 * Returns per-side arrays of { id, percent } for positioning handles.
 */
export function computeHandleLayout(
	node: DiagramNode,
	edges: DiagramEdge[],
	globalDefault: HandleDistributionMode
): Record<Side, { id: string; percent: number }[]> {
	const result: Record<Side, { id: string; percent: number }[]> = {
		top: [],
		bottom: [],
		left: [],
		right: []
	};
	const sides: Side[] = ['top', 'bottom', 'left', 'right'];

	for (const side of sides) {
		if (!node.ports[side]) continue;

		const mode = resolveDistributionMode(node, side, globalDefault);

		if (mode === 'center') {
			result[side] = [{ id: side, percent: 50 }];
		} else {
			const sideEdges = getEdgesForSide(node.id, side, edges);
			const count = Math.max(sideEdges.length, 1);
			const handles: { id: string; percent: number }[] = [];
			for (let i = 0; i < count; i++) {
				const pct = ((i + 1) / (count + 1)) * 100;
				handles.push({ id: count === 1 ? side : `${side}-${i}`, percent: pct });
			}
			result[side] = handles;
		}
	}

	return result;
}
