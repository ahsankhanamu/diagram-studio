import type { DiagramNode } from '$lib/types/diagram';

export type AlignDirection = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeDirection = 'horizontal' | 'vertical';

export function alignNodes(nodes: DiagramNode[], direction: AlignDirection): DiagramNode[] {
	if (nodes.length < 2) return nodes;

	switch (direction) {
		case 'left': {
			const minX = Math.min(...nodes.map((n) => n.position.x));
			return nodes.map((n) => ({ ...n, position: { ...n.position, x: minX } }));
		}
		case 'center': {
			const centers = nodes.map((n) => n.position.x + n.size.width / 2);
			const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
			return nodes.map((n) => ({
				...n,
				position: { ...n.position, x: avgCenter - n.size.width / 2 }
			}));
		}
		case 'right': {
			const maxRight = Math.max(...nodes.map((n) => n.position.x + n.size.width));
			return nodes.map((n) => ({
				...n,
				position: { ...n.position, x: maxRight - n.size.width }
			}));
		}
		case 'top': {
			const minY = Math.min(...nodes.map((n) => n.position.y));
			return nodes.map((n) => ({ ...n, position: { ...n.position, y: minY } }));
		}
		case 'middle': {
			const middles = nodes.map((n) => n.position.y + n.size.height / 2);
			const avgMiddle = middles.reduce((a, b) => a + b, 0) / middles.length;
			return nodes.map((n) => ({
				...n,
				position: { ...n.position, y: avgMiddle - n.size.height / 2 }
			}));
		}
		case 'bottom': {
			const maxBottom = Math.max(...nodes.map((n) => n.position.y + n.size.height));
			return nodes.map((n) => ({
				...n,
				position: { ...n.position, y: maxBottom - n.size.height }
			}));
		}
	}
}

export function distributeNodes(nodes: DiagramNode[], direction: DistributeDirection): DiagramNode[] {
	if (nodes.length < 3) return nodes;

	if (direction === 'horizontal') {
		const sorted = [...nodes].sort((a, b) => a.position.x - b.position.x);
		const first = sorted[0];
		const last = sorted[sorted.length - 1];
		const totalWidth = sorted.reduce((sum, n) => sum + n.size.width, 0);
		const totalSpace = last.position.x + last.size.width - first.position.x - totalWidth;
		const gap = totalSpace / (sorted.length - 1);

		let x = first.position.x;
		return sorted.map((n) => {
			const result = { ...n, position: { ...n.position, x } };
			x += n.size.width + gap;
			return result;
		});
	} else {
		const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y);
		const first = sorted[0];
		const last = sorted[sorted.length - 1];
		const totalHeight = sorted.reduce((sum, n) => sum + n.size.height, 0);
		const totalSpace = last.position.y + last.size.height - first.position.y - totalHeight;
		const gap = totalSpace / (sorted.length - 1);

		let y = first.position.y;
		return sorted.map((n) => {
			const result = { ...n, position: { ...n.position, y } };
			y += n.size.height + gap;
			return result;
		});
	}
}
