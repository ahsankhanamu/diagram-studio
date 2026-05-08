import type { DiagramNode, DiagramEdge } from '$lib/types/diagram';
import { getSmoothStepPath, getBezierPath, getStraightPath, Position } from '@xyflow/svelte';
import { get as getStoreValue } from 'svelte/store';
import { resolveHandlePosition } from '$lib/engine/handle-distribution';
import { defaultHandleDistribution } from '$lib/stores/handleDistributionStore';

// ── Types ──────────────────────────────────────────────────────────

export interface SvgRenderOptions {
	padding?: number;
	background?: string | null;
	idPrefix?: string;
}

// ── Light-theme colors (hardcoded for standalone HTML) ─────────────

const T = {
	bgSurface: '#ffffff',
	textPrimary: '#1f2937',
	textSecondary: '#374151',
	textMuted: '#6b7280',
	borderPrimary: '#e5e7eb',
	borderSubtle: '#f3f4f6',
	accent: '#3b82f6',
	edgeDefault: '#94a3b8',
	canvasBg: '#f7f6f3',
	nodeProcess: '#3b82f6',
	nodeDecision: '#f59e0b',
	nodeTerminal: '#10b981',
	nodeIo: '#3b82f6',
	nodeDocument: '#6366f1',
	nodeService: '#6366f1',
	nodeDatabase: '#3b82f6',
	nodeQueue: '#f59e0b',
	nodeApi: '#8b5cf6',
	nodeUser: '#10b981',
	nodeErd: '#f59e0b',
	nodeWorkflow: '#10b981',
};

// ── Color helpers ──────────────────────────────────────────────────

function hexToRgb(color: string): [number, number, number] {
	const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
	if (m) return [+m[1], +m[2], +m[3]];
	let h = color.replace('#', '');
	if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
	return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

function rgbToHex(r: number, g: number, b: number): string {
	return '#' + [r,g,b].map(c => Math.round(Math.max(0,Math.min(255,c))).toString(16).padStart(2,'0')).join('');
}

function colorMix(c1: string, c2: string, pct: number): string {
	const [r1,g1,b1] = hexToRgb(c1);
	const [r2,g2,b2] = hexToRgb(c2);
	const p = pct / 100;
	return rgbToHex(r1*p + r2*(1-p), g1*p + g2*(1-p), b1*p + b2*(1-p));
}

function colorAlpha(hex: string, alpha: number): string {
	const [r,g,b] = hexToRgb(hex);
	return `rgba(${r},${g},${b},${alpha})`;
}

// ── Node color ─────────────────────────────────────────────────────

function nodeColor(node: DiagramNode): string {
	if (node.style?.borderColor) return node.style.borderColor;
	const map: Record<string, string> = {
		process: T.nodeProcess,
		decision: T.nodeDecision,
		terminal: T.nodeTerminal,
		io: T.nodeIo,
		document: T.nodeDocument,
		service: T.nodeService,
		database: T.nodeDatabase,
		queue: T.nodeQueue,
		api: T.nodeApi,
		user: T.nodeUser,
		entity: T.nodeErd,
		workflow: T.nodeWorkflow,
		group: T.accent,
		'shape-rect': T.accent,
		'shape-circle': T.accent,
		'shape-diamond': T.accent,
		text: T.accent,
	};
	return map[node.type] || T.accent;
}

// ── SVG text escaping ──────────────────────────────────────────────

function esc(s: string): string {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

// ── Bounds ─────────────────────────────────────────────────────────

function resolveAbsolutePosition(
	node: DiagramNode,
	nodeMap: Map<string, DiagramNode>,
	cache: Map<string, { x: number; y: number }>
): { x: number; y: number } {
	const cached = cache.get(node.id);
	if (cached) return cached;
	let x = node.position.x, y = node.position.y;
	if (node.parentId) {
		const p = nodeMap.get(node.parentId);
		if (p) {
			const parentAbs = resolveAbsolutePosition(p, nodeMap, cache);
			x += parentAbs.x;
			y += parentAbs.y;
		}
	}
	const result = { x, y };
	cache.set(node.id, result);
	return result;
}

function computeBounds(
	nodes: DiagramNode[],
	absPositions: Map<string, { x: number; y: number }>
) {
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	for (const n of nodes) {
		const abs = absPositions.get(n.id)!;
		minX = Math.min(minX, abs.x);
		minY = Math.min(minY, abs.y);
		maxX = Math.max(maxX, abs.x + n.size.width);
		maxY = Math.max(maxY, abs.y + n.size.height);
	}
	return { minX, minY, maxX, maxY };
}

// ── Icons ──────────────────────────────────────────────────────────

function svgNodeIcon(type: string, bx: number, by: number, boxSize: number, color: string): string {
	const s = (boxSize * 0.55) / 24;
	const tx = bx + (boxSize - boxSize * 0.55) / 2;
	const ty = by + (boxSize - boxSize * 0.55) / 2;
	const t = `translate(${tx},${ty}) scale(${s})`;
	const a = `fill="none" stroke="${esc(color)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
	switch (type) {
		case 'process':
		case 'shape-rect':
			return `<rect x="3" y="3" width="18" height="18" rx="2" ${a} transform="${t}"/>`;
		case 'service':
			return `<g transform="${t}" ${a}><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6" stroke-width="3"/><line x1="6" y1="18" x2="6.01" y2="18" stroke-width="3"/></g>`;
		case 'database':
			return `<g transform="${t}" ${a}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 5v14c0 1.66-4.03 3-9 3s-9-1.34-9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></g>`;
		case 'queue':
			return `<g transform="${t}" ${a}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6" stroke-width="3"/><line x1="3" y1="12" x2="3.01" y2="12" stroke-width="3"/><line x1="3" y1="18" x2="3.01" y2="18" stroke-width="3"/></g>`;
		case 'api':
			return `<g transform="${t}" ${a}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></g>`;
		case 'user':
			return `<g transform="${t}" ${a}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></g>`;
		case 'workflow':
			return `<g transform="${t}" ${a}><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/><path d="M7 11v2a2 2 0 0 0 2 2h2"/></g>`;
		default:
			return `<rect x="3" y="3" width="18" height="18" rx="2" ${a} transform="${t}"/>`;
	}
}

// ── Arrowhead ──────────────────────────────────────────────────────

function drawArrowhead(x: number, y: number, angle: number, type: string, color: string): string {
	const size = 8;
	const cos = Math.cos(angle), sin = Math.sin(angle);
	function rot(px: number, py: number): [number, number] {
		return [x + px * cos - py * sin, y + px * sin + py * cos];
	}
	if (type === 'arrowclosed') {
		const [x1, y1] = rot(-size, -size * 0.5);
		const [x2, y2] = rot(0, 0);
		const [x3, y3] = rot(-size, size * 0.5);
		return `<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="${esc(color)}" stroke="none"/>`;
	} else if (type === 'arrow') {
		const [x1, y1] = rot(-size, -size * 0.5);
		const [x2, y2] = rot(0, 0);
		const [x3, y3] = rot(-size, size * 0.5);
		return `<polyline points="${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="none" stroke="${esc(color)}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
	}
	return '';
}

// ── Edge end-angle estimation ──────────────────────────────────────

function estimateEndAngle(svgPath: string, _target: { x: number; y: number }): number {
	const tokens = svgPath.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
	if (!tokens || tokens.length < 4) return 0;
	const nums = tokens.map(parseFloat);
	const tx = nums[nums.length - 2];
	const ty = nums[nums.length - 1];
	let px = nums.length >= 4 ? nums[nums.length - 4] : nums[0];
	let py = nums.length >= 4 ? nums[nums.length - 3] : nums[1];
	if (Math.abs(px - tx) < 0.1 && Math.abs(py - ty) < 0.1 && nums.length >= 6) {
		px = nums[nums.length - 6];
		py = nums[nums.length - 5];
	}
	return Math.atan2(ty - py, tx - px);
}

// ── Handle position map ────────────────────────────────────────────

const HANDLE_POS: Record<string, Position> = {
	top: Position.Top,
	bottom: Position.Bottom,
	left: Position.Left,
	right: Position.Right,
};

function handleToPosition(handleId: string): Position {
	const base = handleId.indexOf('-') >= 0 ? handleId.substring(0, handleId.indexOf('-')) : handleId;
	return HANDLE_POS[base] ?? Position.Bottom;
}

// ── Node renderers ─────────────────────────────────────────────────

function svgCardNode(node: DiagramNode, pos: { x: number; y: number }): string {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node);
	const headerH = 28;
	const cardBg = node.style?.backgroundColor || T.bgSurface;
	const borderStyle = node.style?.borderStyle || 'solid';
	const clipId = `clip-${node.id.replace(/[^a-z0-9]/gi, '')}`;
	const headerFill = colorMix(color, T.bgSurface, 15);
	const iconBoxFill = colorAlpha(color, 0.18);
	const borderColor = node.style?.borderColor || T.borderPrimary;
	const dashArray = borderStyle === 'dashed' ? 'stroke-dasharray="8 4"' : borderStyle === 'dotted' ? 'stroke-dasharray="3 3"' : '';
	const borderAttr = borderStyle !== 'none' ? `stroke="${esc(borderColor)}" stroke-width="1" ${dashArray}` : '';

	const iconBoxSize = 20;
	const iconBoxX = 10;
	const iconBoxY = (headerH - iconBoxSize) / 2;
	const iconCenterX = iconBoxX + iconBoxSize / 2;
	const iconCenterY = iconBoxY + iconBoxSize / 2;

	const labelX = iconBoxX + iconBoxSize + 8;
	const labelMaxW = w - labelX - 10;
	const labelClipId = `lclip-${node.id.replace(/[^a-z0-9]/gi, '')}`;

	// Build description lines: split on \n first, then wrap long lines to card width.
	// SVG <text> ignores newlines, so each line must be a separate element.
	const descLineH = 14;
	const descStartY = headerH + 14; // baseline of first description line
	const bodyH = h - headerH;
	const maxDescLines = Math.max(1, Math.floor((bodyH - 6) / descLineH));
	const descMaxW = w - 20;
	const descLines: string[] = [];
	if (node.description) {
		for (const raw of node.description.split('\n')) {
			const trimmed = raw.trim();
			if (trimmed) descLines.push(...wrapText(trimmed, 11, descMaxW));
		}
	}
	const descHtml = descLines.slice(0, maxDescLines).map((line, i) =>
		`<text x="10" y="${descStartY + i * descLineH}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="11" fill="${T.textMuted}" clip-path="url(#${clipId})">${esc(line)}</text>`
	).join('\n  ');

	return `<g transform="translate(${x},${y})" filter="url(#ds)">
  <defs>
    <clipPath id="${clipId}">
      <rect width="${w}" height="${h}" rx="8" ry="8"/>
    </clipPath>
    <clipPath id="${labelClipId}">
      <rect x="${labelX}" y="0" width="${labelMaxW}" height="${headerH}"/>
    </clipPath>
  </defs>
  <rect width="${w}" height="${h}" rx="8" ry="8" fill="${esc(cardBg)}" ${borderAttr}/>
  <rect width="${w}" height="${headerH}" fill="${esc(headerFill)}" clip-path="url(#${clipId})"/>
  <line x1="0.5" y1="${headerH + 0.5}" x2="${w - 0.5}" y2="${headerH + 0.5}" stroke="${T.borderSubtle}" stroke-width="1"/>
  <rect x="${iconBoxX}" y="${iconBoxY}" width="${iconBoxSize}" height="${iconBoxSize}" rx="4" fill="${esc(iconBoxFill)}"/>
  ${svgNodeIcon(node.type, iconBoxX, iconBoxY, iconBoxSize, color)}
  <text x="${labelX}" y="${headerH / 2}" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="13" font-weight="700" fill="${T.textPrimary}" clip-path="url(#${labelClipId})">${esc(node.label || '')}</text>
  ${descHtml}
</g>`;
}

function svgDecisionNode(node: DiagramNode, pos: { x: number; y: number }): string {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node);
	const fill = colorMix(color, T.bgSurface, 15);
	const stroke = colorMix(color, T.borderPrimary, 50);
	const cx = w / 2, cy = h / 2;
	const dw = (w * 0.72) / 2, dh = (h * 0.72) / 2;
	const borderStyle = node.style?.borderStyle || 'solid';
	const dashArray = borderStyle === 'dashed' ? 'stroke-dasharray="8 4"' : borderStyle === 'dotted' ? 'stroke-dasharray="3 3"' : '';
	const strokeAttr = borderStyle !== 'none' ? `stroke="${esc(stroke)}" stroke-width="1.5" ${dashArray}` : '';
	const lines = wrapText(node.label || '', 11, dw * 1.2);
	const lineH = 14;
	const textStartY = cy - ((lines.length - 1) * lineH) / 2;
	const textEls = lines.map((ln, i) =>
		`<text x="${cx}" y="${textStartY + i * lineH}" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="11" fill="${T.textPrimary}">${esc(ln)}</text>`
	).join('\n  ');
	return `<g transform="translate(${x},${y})" filter="url(#ds)">
  <polygon points="${cx},${cy - dh} ${cx + dw},${cy} ${cx},${cy + dh} ${cx - dw},${cy}" fill="${esc(fill)}" ${strokeAttr}/>
  ${textEls}
</g>`;
}

function svgTerminalNode(node: DiagramNode, pos: { x: number; y: number }): string {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node);
	const fill = colorMix(color, T.bgSurface, 15);
	const stroke = colorMix(color, T.borderPrimary, 50);
	const borderStyle = node.style?.borderStyle || 'solid';
	const dashArray = borderStyle === 'dashed' ? 'stroke-dasharray="8 4"' : borderStyle === 'dotted' ? 'stroke-dasharray="3 3"' : '';
	const strokeAttr = borderStyle !== 'none' ? `stroke="${esc(stroke)}" stroke-width="1.5" ${dashArray}` : '';

	const descLineH = 13;
	const descLines: string[] = [];
	if (node.description) {
		for (const raw of node.description.split('\n')) {
			const trimmed = raw.trim();
			if (trimmed) descLines.push(...wrapText(trimmed, 11, w - 28));
		}
	}

	const labelH = 16;
	const gap = 3;
	const vPad = Math.min(h * 0.2, 8);
	const usableH = h - vPad * 2;
	const maxDescLines = descLines.length > 0 ? Math.max(0, Math.floor((usableH - labelH - gap) / descLineH)) : 0;
	const visDesc = descLines.slice(0, maxDescLines);

	const totalH = labelH + (visDesc.length > 0 ? gap + visDesc.length * descLineH : 0);
	const labelY = h / 2 - totalH / 2 + labelH / 2;
	const labelEl = `<text x="${w / 2}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="12" fill="${T.textPrimary}">${esc(node.label || '')}</text>`;

	const descEls = visDesc.map((line, i) => {
		const lineY = h / 2 - totalH / 2 + labelH + gap + (i + 0.5) * descLineH;
		return `<text x="${w / 2}" y="${lineY}" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="11" fill="${T.textMuted}">${esc(line)}</text>`;
	}).join('\n  ');

	return `<g transform="translate(${x},${y})" filter="url(#ds)">
  <rect width="${w}" height="${h}" rx="${h / 2}" ry="${h / 2}" fill="${esc(fill)}" ${strokeAttr}/>
  ${labelEl}
  ${visDesc.length > 0 ? descEls : ''}
</g>`;
}

function svgIONode(node: DiagramNode, pos: { x: number; y: number }): string {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node);
	const fill = colorMix(color, T.bgSurface, 15);
	const stroke = colorMix(color, T.borderPrimary, 50);
	const skew = w * 0.13;
	const borderStyle = node.style?.borderStyle || 'solid';
	const dashArray = borderStyle === 'dashed' ? 'stroke-dasharray="8 4"' : borderStyle === 'dotted' ? 'stroke-dasharray="3 3"' : '';
	const strokeAttr = borderStyle !== 'none' ? `stroke="${esc(stroke)}" stroke-width="1.5" ${dashArray}` : '';
	const pts = `${skew},0 ${w},0 ${w - skew},${h} 0,${h}`;
	return `<g transform="translate(${x},${y})" filter="url(#ds)">
  <polygon points="${pts}" fill="${esc(fill)}" ${strokeAttr}/>
  <text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="12" fill="${T.textPrimary}">${esc(node.label || '')}</text>
</g>`;
}

function svgDocumentNode(node: DiagramNode, pos: { x: number; y: number }): string {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node);
	const fill = colorMix(color, T.bgSurface, 15);
	const stroke = colorMix(color, T.borderPrimary, 50);
	const waveH = h * 0.18;
	const borderStyle = node.style?.borderStyle || 'solid';
	const dashArray = borderStyle === 'dashed' ? 'stroke-dasharray="8 4"' : borderStyle === 'dotted' ? 'stroke-dasharray="3 3"' : '';
	const strokeAttr = borderStyle !== 'none' ? `stroke="${esc(stroke)}" stroke-width="1.5" ${dashArray}` : '';
	const d = `M 0 0 L ${w} 0 L ${w} ${h - waveH} Q ${w * 0.75} ${h + waveH * 0.3} ${w / 2} ${h - waveH} Q ${w * 0.25} ${h - waveH * 2.3} 0 ${h - waveH} Z`;
	return `<g transform="translate(${x},${y})" filter="url(#ds)">
  <path d="${d}" fill="${esc(fill)}" ${strokeAttr}/>
  <text x="${w / 2}" y="${(h - waveH) / 2}" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="12" fill="${T.textPrimary}">${esc(node.label || '')}</text>
</g>`;
}

function svgDatabaseNode(node: DiagramNode, pos: { x: number; y: number }): string {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node);
	const fill = colorMix(color, T.bgSurface, 15);
	const stroke = colorMix(color, T.borderPrimary, 50);
	const ry = Math.min(h * 0.16, 14);
	const borderStyle = node.style?.borderStyle || 'solid';
	const dashArray = borderStyle === 'dashed' ? 'stroke-dasharray="8 4"' : borderStyle === 'dotted' ? 'stroke-dasharray="3 3"' : '';
	const strokeAttr = borderStyle !== 'none' ? `stroke="${esc(stroke)}" stroke-width="1.5" ${dashArray}` : '';

	const clipId = `dbclip-${node.id.replace(/[^a-z0-9]/gi, '')}`;
	const bodyTop = ry;
	const bodyH = h - ry * 2;

	const descLineH = 14;
	const descLines: string[] = [];
	if (node.description) {
		for (const raw of node.description.split('\n')) {
			const trimmed = raw.trim();
			if (trimmed) descLines.push(...wrapText(trimmed, 11, w - 20));
		}
	}

	const labelH = 16;
	const gap = 4;
	const maxDescLines = descLines.length > 0 ? Math.max(0, Math.floor((bodyH - labelH - gap - 4) / descLineH)) : 0;
	const visDesc = descLines.slice(0, maxDescLines);

	const totalH = labelH + (visDesc.length > 0 ? gap + visDesc.length * descLineH : 0);
	const bodyMidY = bodyTop + bodyH / 2;
	const labelY = bodyMidY - totalH / 2 + labelH / 2;
	const labelEl = `<text x="${w / 2}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="13" fill="${T.textPrimary}" clip-path="url(#${clipId})">${esc(node.label || '')}</text>`;

	const descEls = visDesc.map((line, i) => {
		const lineY = bodyMidY - totalH / 2 + labelH + gap + (i + 0.5) * descLineH;
		return `<text x="${w / 2}" y="${lineY}" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="11" fill="${T.textMuted}" clip-path="url(#${clipId})">${esc(line)}</text>`;
	}).join('\n  ');

	return `<g transform="translate(${x},${y})" filter="url(#ds)">
  <defs>
    <clipPath id="${clipId}">
      <rect x="1" y="${bodyTop}" width="${w - 2}" height="${bodyH}"/>
    </clipPath>
  </defs>
  <rect x="1" y="${ry}" width="${w - 2}" height="${h - ry * 2}" fill="${esc(fill)}"/>
  <ellipse cx="${w / 2}" cy="${h - ry}" rx="${w / 2 - 1}" ry="${ry}" fill="${esc(fill)}" ${strokeAttr}/>
  <line x1="1" y1="${ry}" x2="1" y2="${h - ry}" ${strokeAttr}/>
  <line x1="${w - 1}" y1="${ry}" x2="${w - 1}" y2="${h - ry}" ${strokeAttr}/>
  <ellipse cx="${w / 2}" cy="${ry}" rx="${w / 2 - 1}" ry="${ry}" fill="${esc(fill)}" ${strokeAttr}/>
  ${labelEl}
  ${visDesc.length > 0 ? descEls : ''}
</g>`;
}

function svgEntityNode(node: DiagramNode, pos: { x: number; y: number }): string {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node);
	const headerH = 26;
	const fields = (node.data?.fields as Array<{ name: string; type: string }>) || [];
	const clipId = `eclip-${node.id.replace(/[^a-z0-9]/gi, '')}`;
	const headerFill = colorMix(color, T.bgSurface, 10);
	const maxFields = Math.floor((h - headerH - 4) / 18);
	const fieldRows = fields.slice(0, maxFields).map((f, i) => {
		const fy = headerH + 4 + i * 18 + 9;
		return `<text x="10" y="${fy}" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="11" fill="${T.textPrimary}">${esc(f.name || '')}</text>
  <text x="${w - 10}" y="${fy}" text-anchor="end" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="11" fill="${T.textMuted}">${esc(f.type || '')}</text>`;
	}).join('\n  ');
	const emptyRow = fields.length === 0
		? `<text x="10" y="${headerH + 14}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="11" fill="${T.textMuted}">No fields</text>`
		: '';
	return `<g transform="translate(${x},${y})" filter="url(#ds)">
  <defs>
    <clipPath id="${clipId}">
      <rect width="${w}" height="${h}" rx="8" ry="8"/>
    </clipPath>
  </defs>
  <rect width="${w}" height="${h}" rx="8" ry="8" fill="${T.bgSurface}" stroke="${T.borderPrimary}" stroke-width="1"/>
  <rect width="${w}" height="${headerH}" fill="${esc(headerFill)}" clip-path="url(#${clipId})"/>
  <line x1="0" y1="${headerH}" x2="${w}" y2="${headerH}" stroke="${T.borderSubtle}" stroke-width="1"/>
  <text x="10" y="${headerH / 2}" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="12" font-weight="700" fill="${esc(color)}">${esc(node.label || '')}</text>
  ${fieldRows}
  ${emptyRow}
</g>`;
}

function svgWorkflowNode(node: DiagramNode, pos: { x: number; y: number }): string {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node);
	const status = (node.data?.status as string) || 'idle';
	const statusColors: Record<string, string> = {
		idle: T.textMuted,
		running: '#f59e0b',
		success: '#22c55e',
		error: '#ef4444',
	};
	const dotColor = statusColors[status] || T.textMuted;
	const iconSize = 16;
	const iconX = 8;
	const iconY = (h - iconSize) / 2;
	return `<g transform="translate(${x},${y})" filter="url(#ds)">
  <rect width="${w}" height="${h}" rx="8" fill="${T.bgSurface}" stroke="${T.borderPrimary}" stroke-width="1"/>
  ${svgNodeIcon('workflow', iconX, iconY, iconSize, color)}
  <text x="30" y="${h / 2}" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="12" fill="${T.textPrimary}">${esc(node.label || '')}</text>
  <circle cx="${w - 14}" cy="${h / 2}" r="4" fill="${esc(dotColor)}"/>
</g>`;
}

function svgGroupNode(node: DiagramNode, pos: { x: number; y: number }): string {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const headerH = 24;
	const clipId = `gclip-${node.id.replace(/[^a-z0-9]/gi, '')}`;
	return `<g transform="translate(${x},${y})">
  <defs>
    <clipPath id="${clipId}">
      <rect width="${w}" height="${h}" rx="8" ry="8"/>
    </clipPath>
  </defs>
  <rect width="${w}" height="${h}" rx="8" ry="8" fill="rgba(59,130,246,0.05)" stroke="#9ca3af" stroke-width="2" stroke-dasharray="8 4"/>
  <rect width="${w}" height="${headerH}" fill="rgba(59,130,246,0.08)" clip-path="url(#${clipId})"/>
  <text x="12" y="${headerH / 2}" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="11" font-weight="700" fill="${T.textSecondary}">${esc(node.label || 'Group')}</text>
</g>`;
}

function svgShapeRect(node: DiagramNode, pos: { x: number; y: number }): string {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node);
	const fill = colorMix(color, T.bgSurface, 12);
	const stroke = colorMix(color, T.borderPrimary, 50);
	const borderStyle = node.style?.borderStyle || 'solid';
	const dashArray = borderStyle === 'dashed' ? 'stroke-dasharray="8 4"' : borderStyle === 'dotted' ? 'stroke-dasharray="3 3"' : '';
	const strokeAttr = borderStyle !== 'none' ? `stroke="${esc(stroke)}" stroke-width="1.5" ${dashArray}` : '';
	return `<g transform="translate(${x},${y})" filter="url(#ds)">
  <rect width="${w}" height="${h}" rx="4" fill="${esc(fill)}" ${strokeAttr}/>
  <text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="13" fill="${T.textPrimary}">${esc(node.label || '')}</text>
</g>`;
}

function svgShapeCircle(node: DiagramNode, pos: { x: number; y: number }): string {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node);
	const fill = colorMix(color, T.bgSurface, 12);
	const stroke = colorMix(color, T.borderPrimary, 50);
	const r = Math.min(w, h) / 2;
	const cx = w / 2, cy = h / 2;
	const borderStyle = node.style?.borderStyle || 'solid';
	const dashArray = borderStyle === 'dashed' ? 'stroke-dasharray="8 4"' : borderStyle === 'dotted' ? 'stroke-dasharray="3 3"' : '';
	const strokeAttr = borderStyle !== 'none' ? `stroke="${esc(stroke)}" stroke-width="1.5" ${dashArray}` : '';
	return `<g transform="translate(${x},${y})" filter="url(#ds)">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${esc(fill)}" ${strokeAttr}/>
  <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="12" fill="${T.textPrimary}">${esc(node.label || '')}</text>
</g>`;
}

function svgShapeDiamond(node: DiagramNode, pos: { x: number; y: number }): string {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node);
	const fill = colorMix(color, T.bgSurface, 12);
	const stroke = colorMix(color, T.borderPrimary, 50);
	const cx = w / 2, cy = h / 2;
	const borderStyle = node.style?.borderStyle || 'solid';
	const dashArray = borderStyle === 'dashed' ? 'stroke-dasharray="8 4"' : borderStyle === 'dotted' ? 'stroke-dasharray="3 3"' : '';
	const strokeAttr = borderStyle !== 'none' ? `stroke="${esc(stroke)}" stroke-width="1.5" ${dashArray}` : '';
	const pts = `${cx},0 ${w},${cy} ${cx},${h} 0,${cy}`;
	return `<g transform="translate(${x},${y})" filter="url(#ds)">
  <polygon points="${pts}" fill="${esc(fill)}" ${strokeAttr}/>
  <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="12" fill="${T.textPrimary}">${esc(node.label || '')}</text>
</g>`;
}

function svgTextNode(node: DiagramNode, pos: { x: number; y: number }): string {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const textColor = node.style?.borderColor || T.textPrimary;
	const fontSize = node.style?.fontSize ? parseInt(String(node.style.fontSize)) : 14;
	return `<g transform="translate(${x},${y})">
  <text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="${fontSize}" fill="${esc(textColor)}">${esc(node.label || '')}</text>
</g>`;
}

// ── Text wrapping helper ───────────────────────────────────────────

function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
	const approxCharW = fontSize * 0.6;
	const charsPerLine = Math.max(1, Math.floor(maxWidth / approxCharW));
	const words = text.split(' ');
	const lines: string[] = [];
	let line = '';
	for (const word of words) {
		const test = line ? `${line} ${word}` : word;
		if (test.length > charsPerLine && line) {
			lines.push(line);
			line = word;
		} else {
			line = test;
		}
	}
	if (line) lines.push(line);
	return lines.length > 0 ? lines : [''];
}

// ── Node dispatcher ────────────────────────────────────────────────

function svgNode(node: DiagramNode, pos: { x: number; y: number }): string {
	switch (node.type) {
		case 'process': case 'service': case 'queue': case 'api': case 'user':
			return svgCardNode(node, pos);
		case 'decision': return svgDecisionNode(node, pos);
		case 'terminal': return svgTerminalNode(node, pos);
		case 'io': return svgIONode(node, pos);
		case 'document': return svgDocumentNode(node, pos);
		case 'database': return svgDatabaseNode(node, pos);
		case 'entity': return svgEntityNode(node, pos);
		case 'workflow': return svgWorkflowNode(node, pos);
		case 'group': return svgGroupNode(node, pos);
		case 'shape-rect': return svgShapeRect(node, pos);
		case 'shape-circle': return svgShapeCircle(node, pos);
		case 'shape-diamond': return svgShapeDiamond(node, pos);
		case 'text': return svgTextNode(node, pos);
		default: return svgCardNode(node, pos);
	}
}

// ── Edge renderer ──────────────────────────────────────────────────

function svgEdge(
	edge: DiagramEdge,
	nodeMap: Map<string, DiagramNode>,
	absPositions: Map<string, { x: number; y: number }>,
	offset: { ox: number; oy: number },
	allEdges: DiagramEdge[],
	globalDist: import('$lib/types/diagram').HandleDistributionMode
): string {
	const sourceNode = nodeMap.get(edge.source);
	const targetNode = nodeMap.get(edge.target);
	if (!sourceNode || !targetNode) return '';

	const sourceAbsPos = absPositions.get(edge.source)!;
	const targetAbsPos = absPositions.get(edge.target)!;

	const sourceHandle = resolveHandlePosition(sourceNode, sourceAbsPos, edge.sourceHandle || 'bottom', allEdges, globalDist);
	const targetHandle = resolveHandlePosition(targetNode, targetAbsPos, edge.targetHandle || 'top', allEdges, globalDist);

	const sourcePosition = handleToPosition(edge.sourceHandle || 'bottom');
	const targetPosition = handleToPosition(edge.targetHandle || 'top');

	const sourceX = sourceHandle.x + offset.ox;
	const sourceY = sourceHandle.y + offset.oy;
	const targetX = targetHandle.x + offset.ox;
	const targetY = targetHandle.y + offset.oy;

	const pathParams = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };

	let pathResult: [string, number, number, number, number];
	const edgeType = edge.type || 'smoothstep';
	try {
		switch (edgeType) {
			case 'straight':
				pathResult = getStraightPath(pathParams) as [string, number, number, number, number];
				break;
			case 'bezier': case 'labeled': case 'animated':
				pathResult = getBezierPath(pathParams) as [string, number, number, number, number];
				break;
			case 'step':
				pathResult = getSmoothStepPath({ ...pathParams, borderRadius: 0, centerX: edge.centerX, centerY: edge.centerY }) as [string, number, number, number, number];
				break;
			default:
				pathResult = getSmoothStepPath({ ...pathParams, borderRadius: 8, centerX: edge.centerX, centerY: edge.centerY }) as [string, number, number, number, number];
		}
	} catch {
		pathResult = [`M ${sourceX} ${sourceY} L ${targetX} ${targetY}`, (sourceX+targetX)/2, (sourceY+targetY)/2, 0, 0];
	}

	const [svgPath, labelX, labelY] = pathResult;

	const strokeColor = edge.strokeColor || T.edgeDefault;
	const strokeWidth = edge.strokeWidth ?? 1.5;
	const strokeStyle = edge.strokeStyle || 'solid';
	const dashArray = strokeStyle === 'dashed' ? 'stroke-dasharray="8 4"' : strokeStyle === 'dotted' ? 'stroke-dasharray="3 3"' : '';

	const parts: string[] = [];

	parts.push(`<path d="${svgPath}" fill="none" stroke="${esc(strokeColor)}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" ${dashArray}/>`);

	const markerEnd = edge.markerEnd ?? 'arrowclosed';
	if (markerEnd && markerEnd !== 'none') {
		const angle = estimateEndAngle(svgPath, { x: targetX, y: targetY });
		parts.push(drawArrowhead(targetX, targetY, angle, markerEnd, strokeColor));
	}

	const markerStart = edge.markerStart;
	if (markerStart && markerStart !== 'none') {
		const angle = Math.atan2(sourceY - targetY, sourceX - targetX);
		parts.push(drawArrowhead(sourceX, sourceY, angle, markerStart, strokeColor));
	}

	if (edge.label) {
		const fontSize = 11;
		const padX = 8, padY = 4;
		const approxW = edge.label.length * fontSize * 0.58 + padX * 2;
		const rectH = fontSize + padY * 2;
		parts.push(`<rect x="${labelX - approxW / 2}" y="${labelY - rectH / 2}" width="${approxW}" height="${rectH}" rx="5" fill="${T.bgSurface}" stroke="${T.borderPrimary}" stroke-width="1"/>`);
		parts.push(`<text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="${fontSize}" fill="${T.textSecondary}">${esc(edge.label)}</text>`);
	}

	return parts.join('\n');
}

// ── Main export ────────────────────────────────────────────────────

export function renderToSvg(
	nodes: DiagramNode[],
	edges: DiagramEdge[],
	options: SvgRenderOptions = {}
): string {
	if (nodes.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"></svg>';

	const { padding = 40, background } = options;

	const nodeMap = new Map(nodes.map((n) => [n.id, n]));
	const posCache = new Map<string, { x: number; y: number }>();
	const absPositions = new Map(nodes.map((n) => [n.id, resolveAbsolutePosition(n, nodeMap, posCache)]));

	// Use non-group nodes for bounds so that large transparent group containers
	// don't inflate the SVG canvas and produce an artificially small fit zoom.
	const contentNodes = nodes.filter((n) => n.type !== 'group');
	const boundsSource = contentNodes.length > 0 ? contentNodes : nodes;
	const bounds = computeBounds(boundsSource, absPositions);
	const W = Math.round(bounds.maxX - bounds.minX + padding * 2);
	const H = Math.round(bounds.maxY - bounds.minY + padding * 2);
	const ox = padding - bounds.minX;
	const oy = padding - bounds.minY;

	const globalDist = getStoreValue(defaultHandleDistribution);

	const parts: string[] = [];

	const bg = background === null ? null : (background ?? T.canvasBg);
	if (bg) parts.push(`<rect width="${W}" height="${H}" fill="${esc(bg)}"/>`);

	const groups = nodes.filter((n) => n.type === 'group');
	const nonGroups = nodes.filter((n) => n.type !== 'group');

	for (const node of groups) {
		const abs = absPositions.get(node.id)!;
		parts.push(svgNode(node, { x: abs.x + ox, y: abs.y + oy }));
	}

	for (const edge of edges) {
		parts.push(svgEdge(edge, nodeMap, absPositions, { ox, oy }, edges, globalDist));
	}

	for (const node of nonGroups) {
		const abs = absPositions.get(node.id)!;
		parts.push(svgNode(node, { x: abs.x + ox, y: abs.y + oy }));
	}

	const filterId = options.idPrefix ? `ds-${options.idPrefix}` : 'ds';
	const svgParts = parts.filter(Boolean).join('\n').replace(/filter="url\(#ds\)"/g, `filter="url(#${filterId})"`);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width:100%;height:auto;display:block">
<defs>
  <filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.08)"/>
  </filter>
</defs>
${svgParts}
</svg>`;
}
