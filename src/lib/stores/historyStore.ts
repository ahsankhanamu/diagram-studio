import { writable, get } from 'svelte/store';
import { nodes, edges, isDirty, saveStatus } from './diagramStore';
import type { DiagramNode, DiagramEdge } from '$lib/types/diagram';
import { HISTORY_MAX_SIZE } from '$lib/constants';

// ── Post-undo/redo callback ───────────────────────────────────────
// Page registers a callback so undo/redo can trigger a save without
// going through notifyMutation (which causes cascading saves).
let _onHistoryChange: (() => void) | null = null;
export function registerOnHistoryChange(cb: () => void) { _onHistoryChange = cb; }
export function unregisterOnHistoryChange() { _onHistoryChange = null; }

interface HistoryEntry {
	nodes: Map<string, DiagramNode>;
	edges: Map<string, DiagramEdge>;
}

export const undoStack = writable<HistoryEntry[]>([]);
export const redoStack = writable<HistoryEntry[]>([]);
export const canUndo = writable(false);
export const canRedo = writable(false);

// Track undo/redo stack sizes
undoStack.subscribe(($s) => canUndo.set($s.length > 0));
redoStack.subscribe(($s) => canRedo.set($s.length > 0));

function cloneMap<K, V>(map: Map<K, V>): Map<K, V> {
	return new Map(Array.from(map.entries()).map(([k, v]) => [k, { ...(v as object) } as V]));
}

function snapshot(): HistoryEntry {
	return {
		nodes: cloneMap(get(nodes)),
		edges: cloneMap(get(edges))
	};
}

export function pushHistory(): void {
	const entry = snapshot();
	pushSnapshot(entry);
}

/** Push a pre-built snapshot to the undo stack (avoids re-cloning). */
export function pushSnapshot(entry: HistoryEntry): void {
	undoStack.update(($s) => {
		const next = [...$s, entry];
		if (next.length > HISTORY_MAX_SIZE) next.shift();
		return next;
	});
	redoStack.set([]);
}

export function undo(): void {
	const stack = get(undoStack);
	if (stack.length === 0) return;

	// Save current state to redo stack
	const current = snapshot();
	redoStack.update(($s) => [...$s, current]);

	// Restore last state
	const prev = stack[stack.length - 1];
	undoStack.update(($s) => $s.slice(0, -1));

	nodes.set(prev.nodes);
	edges.set(prev.edges);
	isDirty.set(true);
	saveStatus.set('unsaved');
	_onHistoryChange?.();
}

export function redo(): void {
	const stack = get(redoStack);
	if (stack.length === 0) return;

	// Save current state to undo stack
	const current = snapshot();
	undoStack.update(($s) => [...$s, current]);

	// Restore next state
	const next = stack[stack.length - 1];
	redoStack.update(($s) => $s.slice(0, -1));

	nodes.set(next.nodes);
	edges.set(next.edges);
	isDirty.set(true);
	saveStatus.set('unsaved');
	_onHistoryChange?.();
}

export function clearHistory(): void {
	undoStack.set([]);
	redoStack.set([]);
}
