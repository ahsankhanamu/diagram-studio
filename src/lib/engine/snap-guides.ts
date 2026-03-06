import type { DiagramNode } from '$lib/types/diagram';
import type { SnapSettings } from '$lib/stores/snapStore';
import { SNAP_THRESHOLD, GRID_SIZE } from '$lib/constants';

export interface GuideLine {
	orientation: 'horizontal' | 'vertical';
	position: number;
}

export interface SnapResult {
	correctedPosition: { x: number; y: number };
	guides: GuideLine[];
}

interface SnapCandidate {
	snappedValue: number;
	distance: number;
	guide: GuideLine;
}

/** Get handle positions (absolute coordinates) for a node */
function getHandlePositions(node: DiagramNode, pos?: { x: number; y: number }) {
	const x = pos?.x ?? node.position.x;
	const y = pos?.y ?? node.position.y;
	const w = node.size.width;
	const h = node.size.height;
	const handles: { x: number; y: number; port: string }[] = [];
	if (node.ports.top) handles.push({ x: x + w / 2, y, port: 'top' });
	if (node.ports.bottom) handles.push({ x: x + w / 2, y: y + h, port: 'bottom' });
	if (node.ports.left) handles.push({ x, y: y + h / 2, port: 'left' });
	if (node.ports.right) handles.push({ x: x + w, y: y + h / 2, port: 'right' });
	return handles;
}

/** Legacy function — computes visual guides only (no position correction) */
export function computeSnapGuides(draggingNode: DiagramNode, otherNodes: DiagramNode[]): GuideLine[] {
	const threshold = SNAP_THRESHOLD;
	const guides: GuideLine[] = [];
	const seen = new Set<string>();

	const dLeft = draggingNode.position.x;
	const dCenterX = draggingNode.position.x + draggingNode.size.width / 2;
	const dRight = draggingNode.position.x + draggingNode.size.width;
	const dTop = draggingNode.position.y;
	const dCenterY = draggingNode.position.y + draggingNode.size.height / 2;
	const dBottom = draggingNode.position.y + draggingNode.size.height;

	for (const other of otherNodes) {
		const oLeft = other.position.x;
		const oCenterX = other.position.x + other.size.width / 2;
		const oRight = other.position.x + other.size.width;
		const oTop = other.position.y;
		const oCenterY = other.position.y + other.size.height / 2;
		const oBottom = other.position.y + other.size.height;

		for (const [dv, ov] of [[dLeft, oLeft], [dLeft, oRight], [dCenterX, oCenterX], [dRight, oLeft], [dRight, oRight]]) {
			if (Math.abs(dv - ov) < threshold) {
				const key = `v:${Math.round(ov)}`;
				if (!seen.has(key)) {
					seen.add(key);
					guides.push({ orientation: 'vertical', position: ov });
				}
			}
		}

		for (const [dv, ov] of [[dTop, oTop], [dTop, oBottom], [dCenterY, oCenterY], [dBottom, oTop], [dBottom, oBottom]]) {
			if (Math.abs(dv - ov) < threshold) {
				const key = `h:${Math.round(ov)}`;
				if (!seen.has(key)) {
					seen.add(key);
					guides.push({ orientation: 'horizontal', position: ov });
				}
			}
		}
	}

	return guides;
}

/** Compute magnetic snapping — returns corrected position + visual guides */
export function computeSnap(
	draggingNode: DiagramNode,
	dragPosition: { x: number; y: number },
	otherNodes: DiagramNode[],
	settings: SnapSettings
): SnapResult {
	const threshold = settings.threshold;
	const xCandidates: SnapCandidate[] = [];
	const yCandidates: SnapCandidate[] = [];

	const dW = draggingNode.size.width;
	const dH = draggingNode.size.height;
	const dLeft = dragPosition.x;
	const dCenterX = dragPosition.x + dW / 2;
	const dRight = dragPosition.x + dW;
	const dTop = dragPosition.y;
	const dCenterY = dragPosition.y + dH / 2;
	const dBottom = dragPosition.y + dH;

	for (const other of otherNodes) {
		const oLeft = other.position.x;
		const oCenterX = other.position.x + other.size.width / 2;
		const oRight = other.position.x + other.size.width;
		const oTop = other.position.y;
		const oCenterY = other.position.y + other.size.height / 2;
		const oBottom = other.position.y + other.size.height;

		// ── Alignment snap: edges and centers ──
		if (settings.alignmentSnap) {
			// X-axis: left-left, left-right, center-center, right-left, right-right
			const xPairs: [number, number][] = [
				[dLeft, oLeft], [dLeft, oRight], [dCenterX, oCenterX], [dRight, oLeft], [dRight, oRight]
			];
			for (const [dv, ov] of xPairs) {
				const dist = Math.abs(dv - ov);
				if (dist < threshold) {
					const correctedX = dragPosition.x + (ov - dv);
					xCandidates.push({
						snappedValue: correctedX,
						distance: dist,
						guide: { orientation: 'vertical', position: ov }
					});
				}
			}

			// Y-axis: top-top, top-bottom, center-center, bottom-top, bottom-bottom
			const yPairs: [number, number][] = [
				[dTop, oTop], [dTop, oBottom], [dCenterY, oCenterY], [dBottom, oTop], [dBottom, oBottom]
			];
			for (const [dv, ov] of yPairs) {
				const dist = Math.abs(dv - ov);
				if (dist < threshold) {
					const correctedY = dragPosition.y + (ov - dv);
					yCandidates.push({
						snappedValue: correctedY,
						distance: dist,
						guide: { orientation: 'horizontal', position: ov }
					});
				}
			}
		}

		// ── Connector snap: handle-to-handle alignment ──
		if (settings.connectorSnap) {
			const dHandles = getHandlePositions(draggingNode, dragPosition);
			const oHandles = getHandlePositions(other);

			for (const dh of dHandles) {
				for (const oh of oHandles) {
					// Snap X
					const dx = Math.abs(dh.x - oh.x);
					if (dx < threshold) {
						const correctedX = dragPosition.x + (oh.x - dh.x);
						xCandidates.push({
							snappedValue: correctedX,
							distance: dx,
							guide: { orientation: 'vertical', position: oh.x }
						});
					}
					// Snap Y
					const dy = Math.abs(dh.y - oh.y);
					if (dy < threshold) {
						const correctedY = dragPosition.y + (oh.y - dh.y);
						yCandidates.push({
							snappedValue: correctedY,
							distance: dy,
							guide: { orientation: 'horizontal', position: oh.y }
						});
					}
				}
			}
		}

		// ── Geometric snap: face midpoints ──
		if (settings.geometricSnap) {
			// Midpoints of each face of the other node
			const oMidpoints = [
				{ x: oCenterX, y: oTop },     // top face midpoint
				{ x: oCenterX, y: oBottom },   // bottom face midpoint
				{ x: oLeft, y: oCenterY },     // left face midpoint
				{ x: oRight, y: oCenterY }     // right face midpoint
			];

			const dMidpoints = [
				{ x: dCenterX, y: dTop },
				{ x: dCenterX, y: dBottom },
				{ x: dLeft, y: dCenterY },
				{ x: dRight, y: dCenterY }
			];

			for (const dm of dMidpoints) {
				for (const om of oMidpoints) {
					const dx = Math.abs(dm.x - om.x);
					if (dx < threshold) {
						xCandidates.push({
							snappedValue: dragPosition.x + (om.x - dm.x),
							distance: dx,
							guide: { orientation: 'vertical', position: om.x }
						});
					}
					const dy = Math.abs(dm.y - om.y);
					if (dy < threshold) {
						yCandidates.push({
							snappedValue: dragPosition.y + (om.y - dm.y),
							distance: dy,
							guide: { orientation: 'horizontal', position: om.y }
						});
					}
				}
			}
		}
	}

	// Pick closest snap per axis — alignment wins, grid snap is fallback
	const guides: GuideLine[] = [];
	let correctedX = dragPosition.x;
	let correctedY = dragPosition.y;

	if (xCandidates.length > 0) {
		xCandidates.sort((a, b) => a.distance - b.distance);
		const best = xCandidates[0];
		correctedX = best.snappedValue;
		if (settings.showGuides) {
			guides.push(best.guide);
		}
	} else if (settings.gridSnap) {
		correctedX = Math.round(dragPosition.x / GRID_SIZE) * GRID_SIZE;
	}

	if (yCandidates.length > 0) {
		yCandidates.sort((a, b) => a.distance - b.distance);
		const best = yCandidates[0];
		correctedY = best.snappedValue;
		if (settings.showGuides) {
			guides.push(best.guide);
		}
	} else if (settings.gridSnap) {
		correctedY = Math.round(dragPosition.y / GRID_SIZE) * GRID_SIZE;
	}

	return {
		correctedPosition: { x: correctedX, y: correctedY },
		guides
	};
}
