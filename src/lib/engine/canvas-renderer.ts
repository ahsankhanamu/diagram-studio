import type { DiagramNode, DiagramEdge, HandleDistributionMode } from '$lib/types/diagram';
import { getSmoothStepPath, getBezierPath, getStraightPath, Position } from '@xyflow/svelte';
import { get as getStoreValue } from 'svelte/store';
import { resolveHandlePosition } from '$lib/engine/handle-distribution';
import { defaultHandleDistribution } from '$lib/stores/handleDistributionStore';

// ── Types ──────────────────────────────────────────────────────────

export interface RenderOptions {
	scale?: number;
	padding?: number;
	background?: string | null; // undefined = auto (from theme), null = transparent, string = custom color
}

interface ThemeColors {
	canvasBg: string;
	bgSurface: string;
	textPrimary: string;
	textSecondary: string;
	textMuted: string;
	borderPrimary: string;
	borderSubtle: string;
	accent: string;
	edgeDefault: string;
	// Per-node-type colors
	nodeProcess: string;
	nodeDecision: string;
	nodeTerminal: string;
	nodeIo: string;
	nodeDocument: string;
	nodeService: string;
	nodeDatabase: string;
	nodeQueue: string;
	nodeApi: string;
	nodeUser: string;
	nodeErd: string;
	nodeWorkflow: string;
}

interface Rect {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

// ── Color Utilities ────────────────────────────────────────────────

function hexToRgb(color: string): [number, number, number] {
	// Handle rgb(r, g, b) and rgba(r, g, b, a) formats from getComputedStyle
	const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
	if (rgbMatch) return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
	// Handle hex
	let hex = color.replace('#', '');
	if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
	return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
	return '#' + [r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('');
}

function colorMix(c1: string, c2: string, pct: number): string {
	const [r1, g1, b1] = hexToRgb(c1);
	const [r2, g2, b2] = hexToRgb(c2);
	const p = pct / 100;
	return rgbToHex(r1 * p + r2 * (1 - p), g1 * p + g2 * (1 - p), b1 * p + b2 * (1 - p));
}

function colorAlpha(hex: string, alpha: number): string {
	const [r, g, b] = hexToRgb(hex);
	return `rgba(${r},${g},${b},${alpha})`;
}

// ── Theme Resolution ───────────────────────────────────────────────

function resolveTheme(): ThemeColors {
	const style = getComputedStyle(document.documentElement);
	const get = (v: string) => style.getPropertyValue(`--${v}`).trim() || '#888888';
	return {
		canvasBg: get('color-canvas-bg'),
		bgSurface: get('color-bg-surface'),
		textPrimary: get('color-text-primary'),
		textSecondary: get('color-text-secondary'),
		textMuted: get('color-text-muted'),
		borderPrimary: get('color-border-primary'),
		borderSubtle: get('color-border-subtle'),
		accent: get('color-accent'),
		edgeDefault: get('color-edge-default'),
		nodeProcess: get('color-node-process') || get('color-node-flowchart'),
		nodeDecision: get('color-node-decision') || get('color-node-flowchart'),
		nodeTerminal: get('color-node-terminal') || get('color-node-flowchart'),
		nodeIo: get('color-node-io') || get('color-node-flowchart'),
		nodeDocument: get('color-node-document') || get('color-node-flowchart'),
		nodeService: get('color-node-service') || get('color-node-architecture'),
		nodeDatabase: get('color-node-database') || get('color-node-architecture'),
		nodeQueue: get('color-node-queue') || get('color-node-architecture'),
		nodeApi: get('color-node-api') || get('color-node-architecture'),
		nodeUser: get('color-node-user') || get('color-node-architecture'),
		nodeErd: get('color-node-erd'),
		nodeWorkflow: get('color-node-workflow'),
	};
}

function nodeColor(node: DiagramNode, theme: ThemeColors): string {
	// Custom style override first
	if (node.style?.borderColor) return node.style.borderColor;
	const map: Record<string, string> = {
		process: theme.nodeProcess,
		decision: theme.nodeDecision,
		terminal: theme.nodeTerminal,
		io: theme.nodeIo,
		document: theme.nodeDocument,
		service: theme.nodeService,
		database: theme.nodeDatabase,
		queue: theme.nodeQueue,
		api: theme.nodeApi,
		user: theme.nodeUser,
		entity: theme.nodeErd,
		workflow: theme.nodeWorkflow,
		group: theme.accent,
		'shape-rect': theme.accent,
		'shape-circle': theme.accent,
		'shape-diamond': theme.accent,
		text: theme.accent,
	};
	return map[node.type] || theme.accent;
}

// ── Canvas Setup ───────────────────────────────────────────────────

function computeBounds(nodes: DiagramNode[], nodeMap: Map<string, DiagramNode>): Rect {
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	for (const n of nodes) {
		const abs = resolveAbsolutePosition(n, nodeMap);
		minX = Math.min(minX, abs.x);
		minY = Math.min(minY, abs.y);
		maxX = Math.max(maxX, abs.x + n.size.width);
		maxY = Math.max(maxY, abs.y + n.size.height);
	}
	return { minX, minY, maxX, maxY };
}

function resolveAbsolutePosition(node: DiagramNode, nodeMap: Map<string, DiagramNode>): { x: number; y: number } {
	let x = node.position.x;
	let y = node.position.y;
	if (node.parentId) {
		const parent = nodeMap.get(node.parentId);
		if (parent) {
			x += parent.position.x;
			y += parent.position.y;
		}
	}
	return { x, y };
}

// ── Drawing Helpers ────────────────────────────────────────────────

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	r = Math.min(r, w / 2, h / 2);
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.arcTo(x + w, y, x + w, y + r, r);
	ctx.lineTo(x + w, y + h - r);
	ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
	ctx.lineTo(x + r, y + h);
	ctx.arcTo(x, y + h, x, y + h - r, r);
	ctx.lineTo(x, y + r);
	ctx.arcTo(x, y, x + r, y, r);
	ctx.closePath();
}

function pillShape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
	roundedRect(ctx, x, y, w, h, h / 2);
}

function setLineDash(ctx: CanvasRenderingContext2D, style?: string) {
	if (style === 'dashed') ctx.setLineDash([8, 4]);
	else if (style === 'dotted') ctx.setLineDash([3, 3]);
	else ctx.setLineDash([]);
}

function applyShadow(ctx: CanvasRenderingContext2D, level: 'default' | 'none' = 'default') {
	if (level === 'none') {
		ctx.shadowColor = 'transparent';
		ctx.shadowBlur = 0;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;
		return;
	}
	ctx.shadowColor = 'rgba(0,0,0,0.08)';
	ctx.shadowBlur = 8;
	ctx.shadowOffsetX = 0;
	ctx.shadowOffsetY = 2;
}

function clearShadow(ctx: CanvasRenderingContext2D) {
	applyShadow(ctx, 'none');
}

function drawText(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	maxWidth: number,
	opts: { font?: string; color?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline } = {}
) {
	ctx.font = opts.font || '13px Inter, -apple-system, sans-serif';
	ctx.fillStyle = opts.color || '#1f2937';
	ctx.textAlign = opts.align || 'left';
	ctx.textBaseline = opts.baseline || 'middle';

	// Simple truncation with ellipsis
	let displayText = text;
	if (ctx.measureText(text).width > maxWidth) {
		while (displayText.length > 0 && ctx.measureText(displayText + '…').width > maxWidth) {
			displayText = displayText.slice(0, -1);
		}
		displayText += '…';
	}
	ctx.fillText(displayText, x, y);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const words = text.split(' ');
	const lines: string[] = [];
	let line = '';
	for (const word of words) {
		const test = line ? `${line} ${word}` : word;
		if (ctx.measureText(test).width > maxWidth && line) {
			lines.push(line);
			line = word;
		} else {
			line = test;
		}
	}
	if (line) lines.push(line);
	return lines;
}

// ── Icon Drawing (Lucide-accurate icons) ────────────────────────────

function drawNodeIcon(ctx: CanvasRenderingContext2D, type: string, x: number, y: number, boxSize: number, color: string) {
	// Icons are drawn in a 24x24 viewBox, scaled to fit ~11px in a 20px box
	const iconSize = boxSize * 0.55;
	const offset = (boxSize - iconSize) / 2;
	const sc = iconSize / 24;

	ctx.save();
	ctx.translate(x + offset, y + offset);
	ctx.scale(sc, sc);
	ctx.strokeStyle = color;
	ctx.fillStyle = 'none';
	ctx.lineWidth = 2;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.setLineDash([]);

	switch (type) {
		case 'process':
		case 'shape-rect':
			// Lucide SquareIcon: <rect x="3" y="3" width="18" height="18" rx="2"/>
			roundedRect24(ctx, 3, 3, 18, 18, 2);
			ctx.stroke();
			break;

		case 'service':
			// Lucide Server: two stacked rounded rects + indicator dots
			roundedRect24(ctx, 2, 2, 20, 8, 2);
			ctx.stroke();
			roundedRect24(ctx, 2, 14, 20, 8, 2);
			ctx.stroke();
			// Indicator dots
			ctx.beginPath();
			ctx.arc(6, 6, 0.5, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(6, 18, 0.5, 0, Math.PI * 2);
			ctx.stroke();
			break;

		case 'database':
			// Lucide Database: ellipse top + body + middle line
			ctx.beginPath();
			ctx.ellipse(12, 5, 9, 3, 0, 0, Math.PI * 2);
			ctx.stroke();
			// Body sides
			ctx.beginPath();
			ctx.moveTo(21, 5);
			ctx.lineTo(21, 19);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(3, 5);
			ctx.lineTo(3, 19);
			ctx.stroke();
			// Bottom ellipse
			ctx.beginPath();
			ctx.ellipse(12, 19, 9, 3, 0, 0, Math.PI * 2);
			ctx.stroke();
			// Middle line
			ctx.beginPath();
			ctx.ellipse(12, 12, 9, 3, 0, 0, Math.PI);
			ctx.stroke();
			break;

		case 'queue':
			// Lucide ListOrdered: three lines + numbering
			ctx.beginPath();
			ctx.moveTo(10, 6); ctx.lineTo(21, 6);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(10, 12); ctx.lineTo(21, 12);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(10, 18); ctx.lineTo(21, 18);
			ctx.stroke();
			// Numbers (simplified)
			ctx.beginPath();
			ctx.moveTo(4, 6); ctx.lineTo(5, 6); ctx.lineTo(5, 10);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(4, 10); ctx.lineTo(6, 10);
			ctx.stroke();
			break;

		case 'api':
			// Lucide Globe: circle + vertical ellipse + horizontal line
			ctx.beginPath();
			ctx.arc(12, 12, 10, 0, Math.PI * 2);
			ctx.stroke();
			// Vertical meridian
			ctx.beginPath();
			ctx.ellipse(12, 12, 4, 10, 0, 0, Math.PI * 2);
			ctx.stroke();
			// Horizontal line
			ctx.beginPath();
			ctx.moveTo(2, 12); ctx.lineTo(22, 12);
			ctx.stroke();
			break;

		case 'user':
			// Lucide User: head circle + body path
			ctx.beginPath();
			ctx.arc(12, 7, 4, 0, Math.PI * 2);
			ctx.stroke();
			// Body
			ctx.beginPath();
			ctx.moveTo(19, 21);
			ctx.lineTo(19, 19);
			// Approximate the arc: a4,4 0 0,0 -4,-4 -> quarter circle
			ctx.bezierCurveTo(19, 16.8, 17.2, 15, 15, 15);
			ctx.lineTo(9, 15);
			ctx.bezierCurveTo(6.8, 15, 5, 16.8, 5, 19);
			ctx.lineTo(5, 21);
			ctx.stroke();
			break;

		case 'workflow':
			// Lucide Workflow: two rounded rects connected by path
			roundedRect24(ctx, 3, 3, 8, 8, 2);
			ctx.stroke();
			roundedRect24(ctx, 13, 13, 8, 8, 2);
			ctx.stroke();
			// Connecting path
			ctx.beginPath();
			ctx.moveTo(7, 11);
			ctx.lineTo(7, 15);
			ctx.bezierCurveTo(7, 16.1, 7.9, 17, 9, 17);
			ctx.lineTo(13, 17);
			ctx.stroke();
			break;

		default:
			// Generic square
			roundedRect24(ctx, 3, 3, 18, 18, 2);
			ctx.stroke();
	}

	ctx.restore();
}

function roundedRect24(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.arcTo(x + w, y, x + w, y + r, r);
	ctx.lineTo(x + w, y + h - r);
	ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
	ctx.lineTo(x + r, y + h);
	ctx.arcTo(x, y + h, x, y + h - r, r);
	ctx.lineTo(x, y + r);
	ctx.arcTo(x, y, x + r, y, r);
	ctx.closePath();
}

// ── Node Drawing ───────────────────────────────────────────────────

function drawCardNode(ctx: CanvasRenderingContext2D, node: DiagramNode, pos: { x: number; y: number }, theme: ThemeColors) {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node, theme);
	const borderStyle = node.style?.borderStyle || 'solid';
	const cardBg = node.style?.backgroundColor || theme.bgSurface;
	const headerH = 28;

	// ── Layer 1: Card body (with shadow) ──
	// The app's card background: customStyle?.backgroundColor || bgSurface
	applyShadow(ctx);
	roundedRect(ctx, x, y, w, h, 8);
	ctx.fillStyle = cardBg;
	ctx.fill();
	clearShadow(ctx);

	// ── Layer 2: Header gradient (opaque, sits on top of body) ──
	// App CSS: linear-gradient(135deg, color-mix(in srgb, effectiveColor 12%, bgSurface), color-mix(in srgb, effectiveColor 4%, bgSurface))
	// Important: mixes with bgSurface (theme dark), not with the node's custom bg
	ctx.save();
	ctx.beginPath();
	ctx.moveTo(x + 8, y);
	ctx.lineTo(x + w - 8, y);
	ctx.arcTo(x + w, y, x + w, y + 8, 8);
	ctx.lineTo(x + w, y + headerH);
	ctx.lineTo(x, y + headerH);
	ctx.lineTo(x, y + 8);
	ctx.arcTo(x, y, x + 8, y, 8);
	ctx.closePath();
	ctx.clip();
	const headerGrad = ctx.createLinearGradient(x, y, x + w, y + headerH);
	headerGrad.addColorStop(0, colorMix(color, theme.bgSurface, 12));
	headerGrad.addColorStop(1, colorMix(color, theme.bgSurface, 4));
	ctx.fillStyle = headerGrad;
	ctx.fillRect(x, y, w, headerH);
	ctx.restore();

	// ── Layer 3: Header divider line ──
	ctx.beginPath();
	ctx.moveTo(x + 0.5, y + headerH + 0.5);
	ctx.lineTo(x + w - 0.5, y + headerH + 0.5);
	ctx.strokeStyle = theme.borderSubtle;
	ctx.lineWidth = 1;
	ctx.stroke();

	// ── Layer 4: Border (on top of everything) ──
	if (borderStyle !== 'none') {
		setLineDash(ctx, borderStyle);
		ctx.strokeStyle = node.style?.borderColor || theme.borderPrimary;
		ctx.lineWidth = 1;
		roundedRect(ctx, x, y, w, h, 8);
		ctx.stroke();
		ctx.setLineDash([]);
	}

	// ── Icon box ──
	// App CSS: background: color-mix(in srgb, color 25%, transparent); color: color;
	const iconBoxSize = 20;
	const iconX = x + 10;
	const iconY = y + (headerH - iconBoxSize) / 2;
	roundedRect(ctx, iconX, iconY, iconBoxSize, iconBoxSize, 4);
	ctx.fillStyle = colorAlpha(color, 0.25);
	ctx.fill();
	drawNodeIcon(ctx, node.type, iconX, iconY, iconBoxSize, color);

	// ── Label ──
	const labelX = iconX + iconBoxSize + 8;
	drawText(ctx, node.label, labelX, y + headerH / 2, w - (labelX - x) - 10, {
		font: 'bold 13px Inter, -apple-system, sans-serif',
		color: theme.textPrimary,
		baseline: 'middle',
	});

	// ── Description (below header, on top of card body bg) ──
	if (node.description) {
		drawText(ctx, node.description, x + 10, y + headerH + 12, w - 20, {
			font: '11px Inter, -apple-system, sans-serif',
			color: theme.textMuted,
		});
	}
}

function drawDecisionNode(ctx: CanvasRenderingContext2D, node: DiagramNode, pos: { x: number; y: number }, theme: ThemeColors) {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node, theme);
	const cx = x + w / 2;
	const cy = y + h / 2;
	const dw = w * 0.72 / 2;
	const dh = h * 0.72 / 2;

	applyShadow(ctx);
	ctx.beginPath();
	ctx.moveTo(cx, cy - dh);
	ctx.lineTo(cx + dw, cy);
	ctx.lineTo(cx, cy + dh);
	ctx.lineTo(cx - dw, cy);
	ctx.closePath();
	ctx.fillStyle = colorMix(color, theme.bgSurface, 12);
	ctx.fill();
	clearShadow(ctx);

	setLineDash(ctx, node.style?.borderStyle);
	ctx.strokeStyle = node.style?.borderStyle === 'none' ? 'transparent' : colorMix(color, theme.borderPrimary, 50);
	ctx.lineWidth = 1.5;
	ctx.stroke();
	ctx.setLineDash([]);

	// Label
	ctx.font = '11px Inter, -apple-system, sans-serif';
	ctx.fillStyle = theme.textPrimary;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	const lines = wrapText(ctx, node.label, dw * 1.2);
	const lineH = 14;
	const startY = cy - ((lines.length - 1) * lineH) / 2;
	for (let i = 0; i < lines.length; i++) {
		ctx.fillText(lines[i], cx, startY + i * lineH);
	}
}

function drawTerminalNode(ctx: CanvasRenderingContext2D, node: DiagramNode, pos: { x: number; y: number }, theme: ThemeColors) {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node, theme);

	applyShadow(ctx);
	pillShape(ctx, x, y, w, h);
	ctx.fillStyle = colorMix(color, theme.bgSurface, 12);
	ctx.fill();
	clearShadow(ctx);

	setLineDash(ctx, node.style?.borderStyle);
	ctx.strokeStyle = node.style?.borderStyle === 'none' ? 'transparent' : colorMix(color, theme.borderPrimary, 50);
	ctx.lineWidth = 1.5;
	pillShape(ctx, x, y, w, h);
	ctx.stroke();
	ctx.setLineDash([]);

	drawText(ctx, node.label, x + w / 2, y + h / 2, w - 16, {
		font: '12px Inter, -apple-system, sans-serif',
		color: theme.textPrimary,
		align: 'center',
	});
}

function drawIONode(ctx: CanvasRenderingContext2D, node: DiagramNode, pos: { x: number; y: number }, theme: ThemeColors) {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node, theme);
	const skew = w * 0.13;

	applyShadow(ctx);
	ctx.beginPath();
	ctx.moveTo(x + skew, y);
	ctx.lineTo(x + w, y);
	ctx.lineTo(x + w - skew, y + h);
	ctx.lineTo(x, y + h);
	ctx.closePath();
	ctx.fillStyle = colorMix(color, theme.bgSurface, 12);
	ctx.fill();
	clearShadow(ctx);

	setLineDash(ctx, node.style?.borderStyle);
	ctx.strokeStyle = node.style?.borderStyle === 'none' ? 'transparent' : colorMix(color, theme.borderPrimary, 50);
	ctx.lineWidth = 1.5;
	ctx.stroke();
	ctx.setLineDash([]);

	drawText(ctx, node.label, x + w / 2, y + h / 2, w - skew * 2 - 10, {
		font: '12px Inter, -apple-system, sans-serif',
		color: theme.textPrimary,
		align: 'center',
	});
}

function drawDocumentNode(ctx: CanvasRenderingContext2D, node: DiagramNode, pos: { x: number; y: number }, theme: ThemeColors) {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node, theme);
	const waveH = h * 0.18;

	applyShadow(ctx);
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(x + w, y);
	ctx.lineTo(x + w, y + h - waveH);
	ctx.quadraticCurveTo(x + w * 0.75, y + h + waveH * 0.3, x + w / 2, y + h - waveH);
	ctx.quadraticCurveTo(x + w * 0.25, y + h - waveH * 2.3, x, y + h - waveH);
	ctx.closePath();
	ctx.fillStyle = colorMix(color, theme.bgSurface, 12);
	ctx.fill();
	clearShadow(ctx);

	setLineDash(ctx, node.style?.borderStyle);
	ctx.strokeStyle = node.style?.borderStyle === 'none' ? 'transparent' : colorMix(color, theme.borderPrimary, 50);
	ctx.lineWidth = 1.5;
	ctx.stroke();
	ctx.setLineDash([]);

	drawText(ctx, node.label, x + w / 2, y + (h - waveH) / 2, w - 20, {
		font: '12px Inter, -apple-system, sans-serif',
		color: theme.textPrimary,
		align: 'center',
	});
}

function drawDatabaseNode(ctx: CanvasRenderingContext2D, node: DiagramNode, pos: { x: number; y: number }, theme: ThemeColors) {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node, theme);
	const ry = Math.min(h * 0.16, 14);
	const fillColor = colorMix(color, theme.bgSurface, 12);
	const strokeColor = node.style?.borderStyle === 'none' ? 'transparent' : colorMix(color, theme.borderPrimary, 50);

	setLineDash(ctx, node.style?.borderStyle);
	ctx.lineWidth = 1.5;

	// Body fill (rect between ellipses)
	applyShadow(ctx);
	ctx.beginPath();
	ctx.rect(x + 1, y + ry, w - 2, h - ry * 2);
	ctx.fillStyle = fillColor;
	ctx.fill();
	clearShadow(ctx);

	// Bottom ellipse
	ctx.beginPath();
	ctx.ellipse(x + w / 2, y + h - ry, w / 2 - 1, ry, 0, 0, Math.PI * 2);
	ctx.fillStyle = fillColor;
	ctx.fill();
	ctx.strokeStyle = strokeColor;
	ctx.stroke();

	// Side lines
	ctx.beginPath();
	ctx.moveTo(x + 1, y + ry);
	ctx.lineTo(x + 1, y + h - ry);
	ctx.moveTo(x + w - 1, y + ry);
	ctx.lineTo(x + w - 1, y + h - ry);
	ctx.strokeStyle = strokeColor;
	ctx.stroke();

	// Top ellipse (drawn last, on top)
	applyShadow(ctx);
	ctx.beginPath();
	ctx.ellipse(x + w / 2, y + ry, w / 2 - 1, ry, 0, 0, Math.PI * 2);
	ctx.fillStyle = fillColor;
	ctx.fill();
	clearShadow(ctx);
	ctx.strokeStyle = strokeColor;
	ctx.stroke();

	ctx.setLineDash([]);

	// Label
	drawText(ctx, node.label, x + w / 2, y + h / 2 + ry * 0.3, w - 20, {
		font: '13px Inter, -apple-system, sans-serif',
		color: theme.textPrimary,
		align: 'center',
	});
}

function drawEntityNode(ctx: CanvasRenderingContext2D, node: DiagramNode, pos: { x: number; y: number }, theme: ThemeColors) {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node, theme);
	const headerH = 26;
	const fields = (node.data?.fields as Array<{ name: string; type: string }>) || [];

	// Card
	applyShadow(ctx);
	roundedRect(ctx, x, y, w, h, 8);
	ctx.fillStyle = theme.bgSurface;
	ctx.fill();
	clearShadow(ctx);

	roundedRect(ctx, x, y, w, h, 8);
	ctx.strokeStyle = theme.borderPrimary;
	ctx.lineWidth = 1;
	ctx.stroke();

	// Header
	ctx.save();
	ctx.beginPath();
	ctx.moveTo(x + 8, y);
	ctx.lineTo(x + w - 8, y);
	ctx.arcTo(x + w, y, x + w, y + 8, 8);
	ctx.lineTo(x + w, y + headerH);
	ctx.lineTo(x, y + headerH);
	ctx.lineTo(x, y + 8);
	ctx.arcTo(x, y, x + 8, y, 8);
	ctx.closePath();
	ctx.clip();
	ctx.fillStyle = colorMix(color, theme.bgSurface, 10);
	ctx.fillRect(x, y, w, headerH);
	ctx.restore();

	// Header border
	ctx.beginPath();
	ctx.moveTo(x, y + headerH);
	ctx.lineTo(x + w, y + headerH);
	ctx.strokeStyle = theme.borderSubtle;
	ctx.lineWidth = 1;
	ctx.stroke();

	// Header label
	drawText(ctx, node.label, x + 10, y + headerH / 2, w - 20, {
		font: 'bold 12px Inter, -apple-system, sans-serif',
		color,
	});

	// Fields
	const fieldStartY = y + headerH + 4;
	const fieldH = 18;
	if (fields.length > 0) {
		for (let i = 0; i < fields.length; i++) {
			const fy = fieldStartY + i * fieldH;
			if (fy + fieldH > y + h) break;
			drawText(ctx, fields[i].name, x + 10, fy + fieldH / 2, w / 2 - 15, {
				font: '11px Inter, -apple-system, sans-serif',
				color: theme.textPrimary,
			});
			drawText(ctx, fields[i].type, x + w - 10, fy + fieldH / 2, w / 2 - 15, {
				font: '11px Inter, -apple-system, sans-serif',
				color: theme.textMuted,
				align: 'right',
			});
		}
	} else {
		drawText(ctx, 'No fields', x + 10, fieldStartY + 10, w - 20, {
			font: '11px Inter, -apple-system, sans-serif',
			color: theme.textMuted,
		});
	}
}

function drawWorkflowNode(ctx: CanvasRenderingContext2D, node: DiagramNode, pos: { x: number; y: number }, theme: ThemeColors) {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node, theme);
	const status = (node.data?.status as string) || 'idle';

	applyShadow(ctx);
	roundedRect(ctx, x, y, w, h, 8);
	ctx.fillStyle = theme.bgSurface;
	ctx.fill();
	clearShadow(ctx);

	roundedRect(ctx, x, y, w, h, 8);
	ctx.strokeStyle = theme.borderPrimary;
	ctx.lineWidth = 1;
	ctx.stroke();

	// Icon
	drawNodeIcon(ctx, 'workflow', x + 8, y + (h - 16) / 2, 16, color);

	// Label
	drawText(ctx, node.label, x + 30, y + h / 2, w - 50, {
		font: '12px Inter, -apple-system, sans-serif',
		color: theme.textPrimary,
	});

	// Status dot
	const statusColors: Record<string, string> = {
		idle: theme.textMuted,
		running: '#f59e0b',
		success: '#22c55e',
		error: '#ef4444',
	};
	ctx.beginPath();
	ctx.arc(x + w - 14, y + h / 2, 4, 0, Math.PI * 2);
	ctx.fillStyle = statusColors[status] || theme.textMuted;
	ctx.fill();
}

function drawGroupNode(ctx: CanvasRenderingContext2D, node: DiagramNode, pos: { x: number; y: number }, theme: ThemeColors) {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = theme.accent;
	const headerH = 24;

	// Background
	roundedRect(ctx, x, y, w, h, 8);
	ctx.fillStyle = colorAlpha(color, 0.05);
	ctx.fill();

	// Dashed border
	ctx.setLineDash([8, 4]);
	ctx.strokeStyle = theme.textMuted;
	ctx.lineWidth = 2;
	roundedRect(ctx, x, y, w, h, 8);
	ctx.stroke();
	ctx.setLineDash([]);

	// Header background
	ctx.save();
	ctx.beginPath();
	ctx.moveTo(x + 8, y);
	ctx.lineTo(x + w - 8, y);
	ctx.arcTo(x + w, y, x + w, y + 8, 8);
	ctx.lineTo(x + w, y + headerH);
	ctx.lineTo(x, y + headerH);
	ctx.lineTo(x, y + 8);
	ctx.arcTo(x, y, x + 8, y, 8);
	ctx.closePath();
	ctx.clip();
	ctx.fillStyle = colorAlpha(color, 0.08);
	ctx.fillRect(x, y, w, headerH);
	ctx.restore();

	// Label
	drawText(ctx, node.label || 'Group', x + 12, y + headerH / 2, w - 24, {
		font: 'bold 11px Inter, -apple-system, sans-serif',
		color: theme.textSecondary,
	});
}

function drawShapeRect(ctx: CanvasRenderingContext2D, node: DiagramNode, pos: { x: number; y: number }, theme: ThemeColors) {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node, theme);

	applyShadow(ctx);
	roundedRect(ctx, x, y, w, h, 4);
	ctx.fillStyle = colorMix(color, theme.bgSurface, 12);
	ctx.fill();
	clearShadow(ctx);

	setLineDash(ctx, node.style?.borderStyle);
	ctx.strokeStyle = node.style?.borderStyle === 'none' ? 'transparent' : colorMix(color, theme.borderPrimary, 50);
	ctx.lineWidth = 1.5;
	roundedRect(ctx, x, y, w, h, 4);
	ctx.stroke();
	ctx.setLineDash([]);

	drawText(ctx, node.label, x + w / 2, y + h / 2, w - 16, {
		font: '13px Inter, -apple-system, sans-serif',
		color: theme.textPrimary,
		align: 'center',
	});
}

function drawShapeCircle(ctx: CanvasRenderingContext2D, node: DiagramNode, pos: { x: number; y: number }, theme: ThemeColors) {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node, theme);
	const r = Math.min(w, h) / 2;
	const cx = x + w / 2;
	const cy = y + h / 2;

	applyShadow(ctx);
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.fillStyle = colorMix(color, theme.bgSurface, 12);
	ctx.fill();
	clearShadow(ctx);

	setLineDash(ctx, node.style?.borderStyle);
	ctx.strokeStyle = node.style?.borderStyle === 'none' ? 'transparent' : colorMix(color, theme.borderPrimary, 50);
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.stroke();
	ctx.setLineDash([]);

	drawText(ctx, node.label, cx, cy, r * 1.4, {
		font: '12px Inter, -apple-system, sans-serif',
		color: theme.textPrimary,
		align: 'center',
	});
}

function drawShapeDiamond(ctx: CanvasRenderingContext2D, node: DiagramNode, pos: { x: number; y: number }, theme: ThemeColors) {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const color = nodeColor(node, theme);
	const cx = x + w / 2;
	const cy = y + h / 2;
	const hw = w / 2;
	const hh = h / 2;

	applyShadow(ctx);
	ctx.beginPath();
	ctx.moveTo(cx, y);
	ctx.lineTo(x + w, cy);
	ctx.lineTo(cx, y + h);
	ctx.lineTo(x, cy);
	ctx.closePath();
	ctx.fillStyle = colorMix(color, theme.bgSurface, 12);
	ctx.fill();
	clearShadow(ctx);

	setLineDash(ctx, node.style?.borderStyle);
	ctx.strokeStyle = node.style?.borderStyle === 'none' ? 'transparent' : colorMix(color, theme.borderPrimary, 50);
	ctx.lineWidth = 1.5;
	ctx.stroke();
	ctx.setLineDash([]);

	drawText(ctx, node.label, cx, cy, hw * 1.2, {
		font: '12px Inter, -apple-system, sans-serif',
		color: theme.textPrimary,
		align: 'center',
	});
}

function drawTextNode(ctx: CanvasRenderingContext2D, node: DiagramNode, pos: { x: number; y: number }, theme: ThemeColors) {
	const { x, y } = pos;
	const { width: w, height: h } = node.size;
	const fontSize = node.style?.fontSize ? `${node.style.fontSize}px` : '14px';
	// TextNode.svelte uses borderColor as text color when set
	const textColor = node.style?.borderColor || theme.textPrimary;
	drawText(ctx, node.label, x + w / 2, y + h / 2, w, {
		font: `${fontSize} Inter, -apple-system, sans-serif`,
		color: textColor,
		align: 'center',
	});
}

function drawNode(ctx: CanvasRenderingContext2D, node: DiagramNode, pos: { x: number; y: number }, theme: ThemeColors) {
	switch (node.type) {
		case 'process':
		case 'service':
		case 'queue':
		case 'api':
		case 'user':
			drawCardNode(ctx, node, pos, theme);
			break;
		case 'decision':
			drawDecisionNode(ctx, node, pos, theme);
			break;
		case 'terminal':
			drawTerminalNode(ctx, node, pos, theme);
			break;
		case 'io':
			drawIONode(ctx, node, pos, theme);
			break;
		case 'document':
			drawDocumentNode(ctx, node, pos, theme);
			break;
		case 'database':
			drawDatabaseNode(ctx, node, pos, theme);
			break;
		case 'entity':
			drawEntityNode(ctx, node, pos, theme);
			break;
		case 'workflow':
			drawWorkflowNode(ctx, node, pos, theme);
			break;
		case 'group':
			drawGroupNode(ctx, node, pos, theme);
			break;
		case 'shape-rect':
			drawShapeRect(ctx, node, pos, theme);
			break;
		case 'shape-circle':
			drawShapeCircle(ctx, node, pos, theme);
			break;
		case 'shape-diamond':
			drawShapeDiamond(ctx, node, pos, theme);
			break;
		case 'text':
			drawTextNode(ctx, node, pos, theme);
			break;
		default:
			// Fallback: card node
			drawCardNode(ctx, node, pos, theme);
	}
}

// ── Edge Drawing ───────────────────────────────────────────────────

const HANDLE_POSITION_MAP: Record<string, Position> = {
	top: Position.Top,
	bottom: Position.Bottom,
	left: Position.Left,
	right: Position.Right,
};

/** Parse handle ID like "bottom-2" to its Position enum. */
function handleToPosition(handleId: string): Position {
	const dash = handleId.indexOf('-');
	const base = dash >= 0 ? handleId.substring(0, dash) : handleId;
	return HANDLE_POSITION_MAP[base] ?? Position.Bottom;
}

function getHandlePosition(node: DiagramNode, handle: string, absPos: { x: number; y: number }, allEdges: DiagramEdge[], globalDist: HandleDistributionMode): { x: number; y: number } {
	return resolveHandlePosition(node, absPos, handle, allEdges, globalDist);
}

// Lightweight SVG path parser for the subset used by @xyflow
function parseSvgPathToCanvas(ctx: CanvasRenderingContext2D, d: string) {
	const tokens = d.match(/[MLCQAZmlcqaz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
	if (!tokens) return;

	let i = 0;
	let curX = 0, curY = 0;

	function num(): number { return parseFloat(tokens![i++]); }

	ctx.beginPath();
	while (i < tokens.length) {
		const cmd = tokens[i];
		if (/^[MLCQAZmlcqaz]$/.test(cmd)) {
			i++;
			switch (cmd) {
				case 'M':
					curX = num(); curY = num();
					ctx.moveTo(curX, curY);
					// Implicit L after M
					while (i < tokens.length && /^[-+\d.]/.test(tokens[i])) {
						curX = num(); curY = num();
						ctx.lineTo(curX, curY);
					}
					break;
				case 'L':
					while (i < tokens.length && /^[-+\d.]/.test(tokens[i])) {
						curX = num(); curY = num();
						ctx.lineTo(curX, curY);
					}
					break;
				case 'C':
					while (i < tokens.length && /^[-+\d.]/.test(tokens[i])) {
						const x1 = num(), y1 = num(), x2 = num(), y2 = num();
						curX = num(); curY = num();
						ctx.bezierCurveTo(x1, y1, x2, y2, curX, curY);
					}
					break;
				case 'Q':
					while (i < tokens.length && /^[-+\d.]/.test(tokens[i])) {
						const qx1 = num(), qy1 = num();
						curX = num(); curY = num();
						ctx.quadraticCurveTo(qx1, qy1, curX, curY);
					}
					break;
				case 'A':
					while (i < tokens.length && /^[-+\d.]/.test(tokens[i])) {
						const rx = num(), ry = num();
						const rotation = num();
						const largeArc = num();
						const sweep = num();
						const ax = num(), ay = num();
						// Approximate arc with canvas arcTo or lineTo
						// For xyflow smoothstep rounded corners, rx === ry (quarter circles)
						svgArcToCanvas(ctx, curX, curY, rx, ry, rotation, !!largeArc, !!sweep, ax, ay);
						curX = ax; curY = ay;
					}
					break;
				case 'Z':
				case 'z':
					ctx.closePath();
					break;
				// Relative commands (xyflow mostly uses absolute, but handle basics)
				case 'm':
					curX += num(); curY += num();
					ctx.moveTo(curX, curY);
					break;
				case 'l':
					while (i < tokens.length && /^[-+\d.]/.test(tokens[i])) {
						curX += num(); curY += num();
						ctx.lineTo(curX, curY);
					}
					break;
				case 'c':
					while (i < tokens.length && /^[-+\d.]/.test(tokens[i])) {
						const dx1 = num(), dy1 = num(), dx2 = num(), dy2 = num();
						const dx = num(), dy = num();
						ctx.bezierCurveTo(curX + dx1, curY + dy1, curX + dx2, curY + dy2, curX + dx, curY + dy);
						curX += dx; curY += dy;
					}
					break;
				case 'q':
					while (i < tokens.length && /^[-+\d.]/.test(tokens[i])) {
						const qdx1 = num(), qdy1 = num(), qdx = num(), qdy = num();
						ctx.quadraticCurveTo(curX + qdx1, curY + qdy1, curX + qdx, curY + qdy);
						curX += qdx; curY += qdy;
					}
					break;
				case 'a':
					while (i < tokens.length && /^[-+\d.]/.test(tokens[i])) {
						const arx = num(), ary = num();
						const arot = num();
						const ala = num();
						const asw = num();
						const adx = num(), ady = num();
						svgArcToCanvas(ctx, curX, curY, arx, ary, arot, !!ala, !!asw, curX + adx, curY + ady);
						curX += adx; curY += ady;
					}
					break;
			}
		} else {
			// If it's a number and we haven't matched a command, skip
			i++;
		}
	}
}

// Convert SVG arc params to canvas drawing (approximation using bezier curves)
function svgArcToCanvas(
	ctx: CanvasRenderingContext2D,
	x1: number, y1: number,
	rx: number, ry: number,
	rotation: number,
	largeArc: boolean, sweep: boolean,
	x2: number, y2: number
) {
	// If radii are 0 or points are the same, just draw a line
	if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) {
		ctx.lineTo(x2, y2);
		return;
	}

	// For the simple case xyflow uses (quarter-circle arcs with rx === ry),
	// we can approximate well with arcTo
	if (Math.abs(rx - ry) < 0.1 && rotation === 0) {
		// Find the corner point for arcTo
		// The arc goes from (x1,y1) to (x2,y2) with radius rx
		// The corner is where the tangent lines from the endpoints meet
		const dx = x2 - x1;
		const dy = y2 - y1;

		// For a quarter-circle: the corner is at the right-angle intersection
		if (!sweep) {
			// Counter-clockwise
			ctx.arcTo(x1, y2, x2, y2, rx);
		} else {
			// Clockwise
			ctx.arcTo(x2, y1, x2, y2, rx);
		}
		return;
	}

	// Fallback: just draw a line
	ctx.lineTo(x2, y2);
}

function drawArrowhead(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, type: string, color: string, size: number = 8) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(angle);
	ctx.fillStyle = color;
	ctx.strokeStyle = color;
	ctx.lineWidth = 1;

	if (type === 'arrowclosed') {
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(-size, -size * 0.5);
		ctx.lineTo(-size, size * 0.5);
		ctx.closePath();
		ctx.fill();
	} else if (type === 'arrow') {
		ctx.beginPath();
		ctx.moveTo(-size, -size * 0.5);
		ctx.lineTo(0, 0);
		ctx.lineTo(-size, size * 0.5);
		ctx.lineWidth = 1.5;
		ctx.stroke();
	}

	ctx.restore();
}

function drawEdge(ctx: CanvasRenderingContext2D, edge: DiagramEdge, nodeMap: Map<string, DiagramNode>, absPositions: Map<string, { x: number; y: number }>, theme: ThemeColors, allEdges: DiagramEdge[], globalDist: HandleDistributionMode) {
	const sourceNode = nodeMap.get(edge.source);
	const targetNode = nodeMap.get(edge.target);
	if (!sourceNode || !targetNode) return;

	const sourcePos = absPositions.get(edge.source)!;
	const targetPos = absPositions.get(edge.target)!;

	const sourceHandle = getHandlePosition(sourceNode, edge.sourceHandle || 'bottom', sourcePos, allEdges, globalDist);
	const targetHandle = getHandlePosition(targetNode, edge.targetHandle || 'top', targetPos, allEdges, globalDist);

	const sourcePosition = handleToPosition(edge.sourceHandle || 'bottom');
	const targetPosition = handleToPosition(edge.targetHandle || 'top');

	let pathResult: [string, number, number, number, number];
	const edgeType = edge.type || 'smoothstep';

	const pathParams = {
		sourceX: sourceHandle.x,
		sourceY: sourceHandle.y,
		targetX: targetHandle.x,
		targetY: targetHandle.y,
		sourcePosition,
		targetPosition,
	};

	try {
		switch (edgeType) {
			case 'straight':
				pathResult = getStraightPath(pathParams) as [string, number, number, number, number];
				break;
			case 'bezier':
			case 'labeled':
			case 'animated':
				pathResult = getBezierPath(pathParams) as [string, number, number, number, number];
				break;
			case 'step':
				pathResult = getSmoothStepPath({
					...pathParams,
					borderRadius: 0,
					centerX: edge.centerX,
					centerY: edge.centerY,
				}) as [string, number, number, number, number];
				break;
			default: // smoothstep
				pathResult = getSmoothStepPath({
					...pathParams,
					borderRadius: 8,
					centerX: edge.centerX,
					centerY: edge.centerY,
				}) as [string, number, number, number, number];
		}
	} catch {
		// Fallback to straight line
		pathResult = [
			`M ${sourceHandle.x} ${sourceHandle.y} L ${targetHandle.x} ${targetHandle.y}`,
			(sourceHandle.x + targetHandle.x) / 2,
			(sourceHandle.y + targetHandle.y) / 2,
			0, 0,
		];
	}

	const [svgPath, labelX, labelY] = pathResult;

	// Draw path
	const strokeWidth = edge.strokeWidth ?? 1.5;
	const strokeColor = edge.strokeColor || theme.edgeDefault;
	const strokeStyle = edge.strokeStyle || 'solid';

	ctx.lineWidth = strokeWidth;
	ctx.strokeStyle = strokeColor;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	setLineDash(ctx, strokeStyle);

	parseSvgPathToCanvas(ctx, svgPath);
	ctx.stroke();
	ctx.setLineDash([]);

	// Draw markers
	const markerEnd = edge.markerEnd ?? 'arrowclosed';
	if (markerEnd && markerEnd !== 'none') {
		// Calculate angle at the end of the path
		const angle = Math.atan2(targetHandle.y - sourceHandle.y, targetHandle.x - sourceHandle.x);
		// Use a better angle estimate from the last segment
		const endAngle = estimateEndAngle(svgPath, targetHandle);
		drawArrowhead(ctx, targetHandle.x, targetHandle.y, endAngle, markerEnd, strokeColor);
	}

	const markerStart = edge.markerStart;
	if (markerStart && markerStart !== 'none') {
		const startAngle = Math.atan2(sourceHandle.y - targetHandle.y, sourceHandle.x - targetHandle.x);
		drawArrowhead(ctx, sourceHandle.x, sourceHandle.y, startAngle, markerStart, strokeColor);
	}

	// Edge label
	if (edge.label) {
		const fontSize = 11;
		ctx.font = `${fontSize}px Inter, -apple-system, sans-serif`;
		const textWidth = ctx.measureText(edge.label).width;
		const padX = 6, padY = 3;

		// Background
		roundedRect(ctx, labelX - textWidth / 2 - padX, labelY - fontSize / 2 - padY, textWidth + padX * 2, fontSize + padY * 2, 4);
		ctx.fillStyle = theme.bgSurface;
		ctx.fill();
		ctx.strokeStyle = theme.borderPrimary;
		ctx.lineWidth = 1;
		ctx.stroke();

		// Text
		drawText(ctx, edge.label, labelX, labelY, textWidth + 20, {
			font: `${fontSize}px Inter, -apple-system, sans-serif`,
			color: theme.textSecondary,
			align: 'center',
		});
	}
}

function estimateEndAngle(svgPath: string, target: { x: number; y: number }): number {
	// Parse the last segment of the SVG path to estimate the approach angle
	const tokens = svgPath.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
	if (!tokens || tokens.length < 4) return 0;

	// Get the second-to-last pair of coordinates
	const nums = tokens.map(parseFloat);
	const tx = nums[nums.length - 2];
	const ty = nums[nums.length - 1];
	let px = nums.length >= 4 ? nums[nums.length - 4] : nums[0];
	let py = nums.length >= 4 ? nums[nums.length - 3] : nums[1];

	// If the second-to-last point is very close to target, go further back
	if (Math.abs(px - tx) < 0.1 && Math.abs(py - ty) < 0.1 && nums.length >= 6) {
		px = nums[nums.length - 6];
		py = nums[nums.length - 5];
	}

	return Math.atan2(ty - py, tx - px);
}

// ── Main Renderer ──────────────────────────────────────────────────

export function renderToCanvas(
	nodes: DiagramNode[],
	edges: DiagramEdge[],
	options: RenderOptions = {}
): HTMLCanvasElement {
	const { scale = 2, padding = 40, background } = options;
	const theme = resolveTheme();

	// Build node map and resolve absolute positions
	const nodeMap = new Map<string, DiagramNode>();
	for (const n of nodes) nodeMap.set(n.id, n);

	const absPositions = new Map<string, { x: number; y: number }>();
	for (const n of nodes) {
		absPositions.set(n.id, resolveAbsolutePosition(n, nodeMap));
	}

	// Compute content bounds
	const bounds = computeBounds(nodes, nodeMap);
	const contentW = bounds.maxX - bounds.minX;
	const contentH = bounds.maxY - bounds.minY;
	const canvasW = (contentW + padding * 2) * scale;
	const canvasH = (contentH + padding * 2) * scale;

	const canvas = document.createElement('canvas');
	canvas.width = canvasW;
	canvas.height = canvasH;
	const ctx = canvas.getContext('2d')!;

	// Apply scale
	ctx.scale(scale, scale);

	// Background — use 'auto' or undefined to pick from current theme
	const bgColor = background === null ? null : (background || theme.canvasBg);
	if (bgColor !== null) {
		ctx.fillStyle = bgColor;
		ctx.fillRect(0, 0, contentW + padding * 2, contentH + padding * 2);
	}

	// Translate so content starts at padding
	ctx.translate(padding - bounds.minX, padding - bounds.minY);

	// Sort nodes: groups first (rendered behind), then others
	const groups = nodes.filter((n) => n.type === 'group');
	const nonGroups = nodes.filter((n) => n.type !== 'group');

	// Draw groups
	for (const node of groups) {
		drawNode(ctx, node, absPositions.get(node.id)!, theme);
	}

	// Read global distribution default
	const globalDist = getStoreValue(defaultHandleDistribution);

	// Draw edges
	for (const edge of edges) {
		drawEdge(ctx, edge, nodeMap, absPositions, theme, edges, globalDist);
	}

	// Draw non-group nodes
	for (const node of nonGroups) {
		drawNode(ctx, node, absPositions.get(node.id)!, theme);
	}

	return canvas;
}

// ── Export Helper ──────────────────────────────────────────────────

export async function exportCanvasPng(
	nodes: DiagramNode[],
	edges: DiagramEdge[],
	filename: string,
	options: RenderOptions = {}
): Promise<void> {
	const canvas = renderToCanvas(nodes, edges, options);

	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
	if (!blob) return;

	// Try File System Access API
	if ('showSaveFilePicker' in window) {
		try {
			const handle = await (window as any).showSaveFilePicker({
				suggestedName: `${filename}.png`,
				types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
			});
			const writable = await handle.createWritable();
			await writable.write(blob);
			await writable.close();
			return;
		} catch (err: any) {
			if (err?.name === 'AbortError') return;
		}
	}

	// Fallback: blob download
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${filename}.png`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

export async function copyCanvasToClipboard(
	nodes: DiagramNode[],
	edges: DiagramEdge[],
	options: RenderOptions = {}
): Promise<boolean> {
	const canvas = renderToCanvas(nodes, edges, options);

	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
	if (!blob) return false;

	try {
		await navigator.clipboard.write([
			new ClipboardItem({ 'image/png': blob }),
		]);
		return true;
	} catch {
		return false;
	}
}
