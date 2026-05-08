/**
 * node-sizing.ts — Deterministic minimum-size calculator for diagram nodes.
 *
 * Uses the same char-width approximations as wrapText() in svg-renderer.ts so
 * the calculated dimensions guarantee text fits without clipping or truncation.
 *
 * Used by:
 *  - The AI diagram-creation skill (to set correct sizes in JSON output)
 *  - Node creation UI (to set sensible defaults when adding a node)
 *  - svg-renderer.ts (can call calcNodeSize to validate/override sizes)
 *
 * No DOM, no canvas, no rendering required — pure arithmetic.
 */

export interface NodeSizeInput {
	type: string;
	label?: string;
	description?: string;
}

export interface NodeSize {
	width: number;
	height: number;
}

// Approximate character widths (px) at a given font-size using system sans-serif.
// These match the constants used in wrapText() in svg-renderer.ts (factor 0.6).
const CHAR_WIDTH_FACTOR = 0.6;

function approxTextWidth(text: string, fontSize: number): number {
	return text.length * fontSize * CHAR_WIDTH_FACTOR;
}

function wrapCount(text: string, fontSize: number, maxWidth: number): number {
	const charsPerLine = Math.max(1, Math.floor(maxWidth / (fontSize * CHAR_WIDTH_FACTOR)));
	const words = text.split(' ');
	let lines = 1, col = 0;
	for (const word of words) {
		if (col > 0 && col + word.length > charsPerLine) { lines++; col = word.length; }
		else col = col === 0 ? word.length : col + 1 + word.length;
	}
	return lines;
}

/** Count total wrapped lines for a description string (handles embedded \n). */
function descLineCount(description: string, fontSize: number, maxWidth: number): number {
	let total = 0;
	for (const raw of description.split('\n')) {
		const trimmed = raw.trim();
		if (trimmed) total += wrapCount(trimmed, fontSize, maxWidth);
	}
	return total;
}

// ── Card-style nodes (process, service, queue, api, user) ──────────────

const CARD_HEADER_H = 28;
const CARD_ICON_BOX_W = 38; // icon box (20px) + gap (8px) + left margin (10px)
const CARD_LABEL_FONT = 13;
const CARD_DESC_FONT = 11;
const CARD_DESC_LINE_H = 14;
const CARD_DESC_TOP_PAD = 14; // space above first desc line
const CARD_DESC_BOT_PAD = 10;
const CARD_MIN_W = 160;
const CARD_MAX_W = 320;
const CARD_MIN_H = 56; // header + a small body

function calcCardSize(label: string, description?: string): NodeSize {
	// Width: wide enough for the label in the header
	const labelW = approxTextWidth(label, CARD_LABEL_FONT) + CARD_ICON_BOX_W + 20;
	const w = Math.max(CARD_MIN_W, Math.min(CARD_MAX_W, Math.ceil(labelW / 10) * 10));

	if (!description?.trim()) return { width: w, height: CARD_MIN_H };

	const descMaxW = w - 20;
	const lines = descLineCount(description, CARD_DESC_FONT, descMaxW);
	const bodyH = CARD_DESC_TOP_PAD + lines * CARD_DESC_LINE_H + CARD_DESC_BOT_PAD;
	return { width: w, height: Math.max(CARD_MIN_H, CARD_HEADER_H + bodyH) };
}

// ── Decision (diamond) ─────────────────────────────────────────────────

function calcDecisionSize(label: string): NodeSize {
	const inner = approxTextWidth(label, 11);
	const side = Math.max(100, Math.ceil(inner * 1.6 / 10) * 10);
	return { width: side, height: Math.round(side * 0.65) };
}

// ── Terminal (pill / start-end) ────────────────────────────────────────

function calcTerminalSize(label: string, description?: string): NodeSize {
	const w = Math.max(120, Math.ceil((approxTextWidth(label, 12) + 40) / 10) * 10);
	if (!description?.trim()) return { width: w, height: 36 };
	const lines = descLineCount(description, 11, w - 28);
	return { width: w, height: Math.max(36, 20 + 16 + lines * 13 + 8) };
}

// ── IO (parallelogram) ────────────────────────────────────────────────

function calcIOSize(label: string): NodeSize {
	const w = Math.max(140, Math.ceil((approxTextWidth(label, 12) + 56) / 10) * 10);
	return { width: w, height: 48 };
}

// ── Document ──────────────────────────────────────────────────────────

function calcDocumentSize(label: string): NodeSize {
	const w = Math.max(150, Math.ceil((approxTextWidth(label, 12) + 40) / 10) * 10);
	return { width: w, height: 64 };
}

// ── Database (cylinder) ───────────────────────────────────────────────

const DB_MIN_W = 140;
const DB_LABEL_FONT = 13;
const DB_DESC_LINE_H = 14;

function calcDatabaseSize(label: string, description?: string): NodeSize {
	const w = Math.max(DB_MIN_W, Math.ceil((approxTextWidth(label, DB_LABEL_FONT) + 30) / 10) * 10);
	if (!description?.trim()) return { width: w, height: 80 };
	const lines = descLineCount(description, 11, w - 20);
	// ry ≈ min(h * 0.16, 14) — solve for h given desired body height
	// body = h - 2*ry. With small h, ry = h*0.16, body = h*0.68. With ry capped at 14, body = h - 28.
	// Approximate: add 30px for caps, 16px for label, gap, desc lines.
	const h = Math.max(80, Math.ceil((30 + 16 + 6 + lines * DB_DESC_LINE_H + 10) / 10) * 10);
	return { width: w, height: h };
}

// ── Entity (ERD) ──────────────────────────────────────────────────────

function calcEntitySize(label: string, fields: Array<{ name: string; type: string }> = []): NodeSize {
	const headerH = 26;
	const fieldH = 18;
	const maxFieldNameW = fields.reduce((m, f) => Math.max(m, approxTextWidth(f.name, 11)), 0);
	const maxFieldTypeW = fields.reduce((m, f) => Math.max(m, approxTextWidth(f.type, 11)), 0);
	const labelW = approxTextWidth(label, 12) + 20;
	const fieldsW = maxFieldNameW + maxFieldTypeW + 40;
	const w = Math.max(160, Math.ceil(Math.max(labelW, fieldsW) / 10) * 10);
	const h = Math.max(80, headerH + fields.length * fieldH + 12);
	return { width: w, height: h };
}

// ── Workflow ──────────────────────────────────────────────────────────

function calcWorkflowSize(label: string): NodeSize {
	const w = Math.max(160, Math.ceil((approxTextWidth(label, 12) + 64) / 10) * 10);
	return { width: w, height: 44 };
}

// ── Shapes ────────────────────────────────────────────────────────────

function calcShapeSize(label: string): NodeSize {
	const inner = approxTextWidth(label, 13);
	const side = Math.max(80, Math.ceil((inner + 32) / 10) * 10);
	return { width: side, height: Math.round(side * 0.6) };
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Calculate the minimum node size that fits the label and description
 * without clipping. Pass `fields` for entity nodes.
 */
export function calcNodeSize(
	input: NodeSizeInput & { fields?: Array<{ name: string; type: string }> }
): NodeSize {
	const label = (input.label ?? '').trim();
	const desc = input.description?.trim();

	switch (input.type) {
		case 'process':
		case 'service':
		case 'queue':
		case 'api':
		case 'user':
			return calcCardSize(label, desc);

		case 'decision':
			return calcDecisionSize(label);

		case 'terminal':
			return calcTerminalSize(label, desc);

		case 'io':
			return calcIOSize(label);

		case 'document':
			return calcDocumentSize(label);

		case 'database':
			return calcDatabaseSize(label, desc);

		case 'entity':
			return calcEntitySize(label, input.fields ?? []);

		case 'workflow':
			return calcWorkflowSize(label);

		case 'shape-rect':
		case 'shape-circle':
		case 'shape-diamond':
			return calcShapeSize(label);

		default:
			return calcCardSize(label, desc);
	}
}

/**
 * Convenience: returns a size rounded up to the nearest 10px grid.
 * Useful when you want predictable snapping in the editor.
 */
export function calcNodeSizeSnapped(
	input: NodeSizeInput & { fields?: Array<{ name: string; type: string }> }
): NodeSize {
	const { width, height } = calcNodeSize(input);
	return {
		width: Math.ceil(width / 10) * 10,
		height: Math.ceil(height / 10) * 10,
	};
}
