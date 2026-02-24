import type { DiagramNode } from '$lib/types/diagram';

export interface GuideLine {
	orientation: 'horizontal' | 'vertical';
	position: number;
}

const THRESHOLD = 5;

export function computeSnapGuides(draggingNode: DiagramNode, otherNodes: DiagramNode[]): GuideLine[] {
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

		// Vertical guides (x-axis alignment)
		for (const [dv, ov] of [[dLeft, oLeft], [dLeft, oRight], [dCenterX, oCenterX], [dRight, oLeft], [dRight, oRight]]) {
			if (Math.abs(dv - ov) < THRESHOLD) {
				const key = `v:${Math.round(ov)}`;
				if (!seen.has(key)) {
					seen.add(key);
					guides.push({ orientation: 'vertical', position: ov });
				}
			}
		}

		// Horizontal guides (y-axis alignment)
		for (const [dv, ov] of [[dTop, oTop], [dTop, oBottom], [dCenterY, oCenterY], [dBottom, oTop], [dBottom, oBottom]]) {
			if (Math.abs(dv - ov) < THRESHOLD) {
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
