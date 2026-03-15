import { writable, derived } from 'svelte/store';
import { nodeList, edgeList, diagramMeta } from '$lib/stores/diagramStore';
import { lintDiagram, type LintResult } from '$lib/engine/linter';

export const lintResults = writable<LintResult[]>([]);
export const lintPanelOpen = writable(false);

export const lintErrorCount = derived(lintResults, ($r) =>
	$r.filter((r) => r.severity === 'error').length
);
export const lintWarningCount = derived(lintResults, ($r) =>
	$r.filter((r) => r.severity === 'warning').length
);
export const lintTotalCount = derived(lintResults, ($r) => $r.length);

// ── Debounced linter runner ─────────────────────────────────────────

let lintTimer: ReturnType<typeof setTimeout> | undefined;
const LINT_DEBOUNCE = 500;

let unsubscribers: (() => void)[] = [];

/** Start reactive linting — call once on mount, returns a cleanup fn. */
export function startLinter(): () => void {
	// Avoid duplicate subscriptions
	stopLinter();

	function scheduleLint() {
		clearTimeout(lintTimer);
		lintTimer = setTimeout(runLint, LINT_DEBOUNCE);
	}

	function runLint() {
		let currentNodes: import('$lib/types/diagram').DiagramNode[] = [];
		let currentEdges: import('$lib/types/diagram').DiagramEdge[] = [];
		let diagramType = 'flowchart';

		// Read current store values
		const unsubNodes = nodeList.subscribe((v) => (currentNodes = v));
		const unsubEdges = edgeList.subscribe((v) => (currentEdges = v));
		const unsubMeta = diagramMeta.subscribe((v) => {
			if (v) diagramType = v.diagramType;
		});
		unsubNodes();
		unsubEdges();
		unsubMeta();

		const results = lintDiagram(currentNodes, currentEdges, diagramType);
		lintResults.set(results);
	}

	// Subscribe to stores and schedule lint on every change
	const u1 = nodeList.subscribe(scheduleLint);
	const u2 = edgeList.subscribe(scheduleLint);
	const u3 = diagramMeta.subscribe(scheduleLint);
	unsubscribers = [u1, u2, u3];

	// Run once immediately
	runLint();

	return stopLinter;
}

export function stopLinter(): void {
	clearTimeout(lintTimer);
	for (const unsub of unsubscribers) unsub();
	unsubscribers = [];
}

export function toggleLintPanel(): void {
	lintPanelOpen.update((v) => !v);
}
