import type { DiagramNode, DiagramEdge } from '$lib/types/diagram';

export interface LintResult {
	id: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	nodeId?: string;
	edgeId?: string;
}

type LintRule = (
	nodes: DiagramNode[],
	edges: DiagramEdge[],
	nodeMap: Map<string, DiagramNode>
) => LintResult[];

// ── Universal rules ─────────────────────────────────────────────────

const duplicateNodeIds: LintRule = (nodes) => {
	const seen = new Map<string, number>();
	const results: LintResult[] = [];
	for (const node of nodes) {
		const count = (seen.get(node.id) ?? 0) + 1;
		seen.set(node.id, count);
		if (count === 2) {
			results.push({
				id: 'duplicate-node-id',
				severity: 'error',
				message: `Duplicate node ID "${node.id}"`,
				nodeId: node.id
			});
		}
	}
	return results;
};

const danglingEdges: LintRule = (_nodes, edges, nodeMap) => {
	const results: LintResult[] = [];
	for (const edge of edges) {
		if (!nodeMap.has(edge.source)) {
			results.push({
				id: 'dangling-edge-source',
				severity: 'error',
				message: `Edge "${edge.id}" references non-existent source "${edge.source}"`,
				edgeId: edge.id
			});
		}
		if (!nodeMap.has(edge.target)) {
			results.push({
				id: 'dangling-edge-target',
				severity: 'error',
				message: `Edge "${edge.id}" references non-existent target "${edge.target}"`,
				edgeId: edge.id
			});
		}
	}
	return results;
};

const selfReferencingEdges: LintRule = (_nodes, edges) => {
	const results: LintResult[] = [];
	for (const edge of edges) {
		if (edge.source === edge.target) {
			results.push({
				id: 'self-referencing-edge',
				severity: 'error',
				message: `Edge "${edge.id}" connects a node to itself`,
				edgeId: edge.id
			});
		}
	}
	return results;
};

const orphanedNodes: LintRule = (nodes, edges) => {
	const results: LintResult[] = [];
	const connected = new Set<string>();
	for (const edge of edges) {
		connected.add(edge.source);
		connected.add(edge.target);
	}
	// Nodes that are children of groups or are groups themselves are exempt
	for (const node of nodes) {
		if (node.type === 'group' || node.type === 'text') continue;
		if (node.parentId) continue;
		if (!connected.has(node.id) && nodes.length > 1) {
			results.push({
				id: 'orphaned-node',
				severity: 'warning',
				message: `Node "${node.label || node.id}" has no connections`,
				nodeId: node.id
			});
		}
	}
	return results;
};

const missingLabels: LintRule = (nodes) => {
	const results: LintResult[] = [];
	for (const node of nodes) {
		if (node.type === 'group') continue;
		if (!node.label || node.label.trim() === '') {
			results.push({
				id: 'missing-label',
				severity: 'warning',
				message: `Node "${node.id}" has no label`,
				nodeId: node.id
			});
		}
	}
	return results;
};

const universalRules: LintRule[] = [
	duplicateNodeIds,
	danglingEdges,
	selfReferencingEdges,
	orphanedNodes,
	missingLabels
];

// ── Flowchart rules ─────────────────────────────────────────────────

const flowchartStartTerminal: LintRule = (nodes) => {
	const results: LintResult[] = [];
	const terminals = nodes.filter((n) => n.type === 'terminal');
	const starts = terminals.filter((n) => /start/i.test(n.label));
	if (starts.length === 0) {
		results.push({
			id: 'flowchart-no-start',
			severity: 'error',
			message: 'Flowchart must have a terminal node labeled "Start"'
		});
	} else if (starts.length > 1) {
		for (const s of starts) {
			results.push({
				id: 'flowchart-multiple-starts',
				severity: 'error',
				message: 'Flowchart has multiple "Start" terminals — should have exactly one',
				nodeId: s.id
			});
		}
	}
	return results;
};

const flowchartEndTerminal: LintRule = (nodes) => {
	const results: LintResult[] = [];
	const terminals = nodes.filter((n) => n.type === 'terminal');
	const ends = terminals.filter((n) => /end/i.test(n.label));
	if (ends.length === 0) {
		results.push({
			id: 'flowchart-no-end',
			severity: 'error',
			message: 'Flowchart must have at least one terminal node labeled "End"'
		});
	}
	return results;
};

const flowchartDecisionBranching: LintRule = (nodes, edges) => {
	const results: LintResult[] = [];
	const decisions = nodes.filter((n) => n.type === 'decision');
	for (const dec of decisions) {
		const outgoing = edges.filter((e) => e.source === dec.id);
		if (outgoing.length < 2) {
			results.push({
				id: 'flowchart-decision-needs-branches',
				severity: 'error',
				message: `Decision node "${dec.label || dec.id}" must have at least 2 outgoing edges (has ${outgoing.length})`,
				nodeId: dec.id
			});
		}
	}
	return results;
};

const flowchartDeadEndProcess: LintRule = (nodes, edges) => {
	const results: LintResult[] = [];
	const processTypes = new Set(['process', 'io', 'document']);
	for (const node of nodes) {
		if (!processTypes.has(node.type)) continue;
		const outgoing = edges.filter((e) => e.source === node.id);
		if (outgoing.length === 0) {
			results.push({
				id: 'flowchart-dead-end-process',
				severity: 'warning',
				message: `Process node "${node.label || node.id}" has no outgoing edges (dead end)`,
				nodeId: node.id
			});
		}
	}
	return results;
};

const flowchartRules: LintRule[] = [
	flowchartStartTerminal,
	flowchartEndTerminal,
	flowchartDecisionBranching,
	flowchartDeadEndProcess
];

// ── ERD rules ───────────────────────────────────────────────────────

const erdEntityFields: LintRule = (nodes) => {
	const results: LintResult[] = [];
	const entities = nodes.filter((n) => n.type === 'entity');
	for (const entity of entities) {
		const fields = entity.data?.fields;
		if (!fields || !Array.isArray(fields) || fields.length === 0) {
			results.push({
				id: 'erd-entity-no-fields',
				severity: 'warning',
				message: `Entity "${entity.label || entity.id}" has no fields defined`,
				nodeId: entity.id
			});
		}
	}
	return results;
};

const erdEntityRelationships: LintRule = (nodes, edges) => {
	const results: LintResult[] = [];
	const entities = nodes.filter((n) => n.type === 'entity');
	for (const entity of entities) {
		const connected = edges.some(
			(e) => e.source === entity.id || e.target === entity.id
		);
		if (!connected) {
			results.push({
				id: 'erd-entity-no-relationship',
				severity: 'warning',
				message: `Entity "${entity.label || entity.id}" has no relationships`,
				nodeId: entity.id
			});
		}
	}
	return results;
};

const erdRules: LintRule[] = [erdEntityFields, erdEntityRelationships];

// ── Architecture rules ──────────────────────────────────────────────

const archDatabaseIncoming: LintRule = (nodes, edges) => {
	const results: LintResult[] = [];
	const databases = nodes.filter((n) => n.type === 'database');
	for (const db of databases) {
		const incoming = edges.filter((e) => e.target === db.id);
		if (incoming.length === 0) {
			results.push({
				id: 'arch-database-no-incoming',
				severity: 'warning',
				message: `Database "${db.label || db.id}" has no incoming edges — nothing uses it`,
				nodeId: db.id
			});
		}
	}
	return results;
};

const archApiEdges: LintRule = (nodes, edges) => {
	const results: LintResult[] = [];
	const apis = nodes.filter((n) => n.type === 'api');
	for (const api of apis) {
		const incoming = edges.filter((e) => e.target === api.id);
		const outgoing = edges.filter((e) => e.source === api.id);
		if (incoming.length === 0) {
			results.push({
				id: 'arch-api-no-incoming',
				severity: 'warning',
				message: `API "${api.label || api.id}" has no incoming edges`,
				nodeId: api.id
			});
		}
		if (outgoing.length === 0) {
			results.push({
				id: 'arch-api-no-outgoing',
				severity: 'warning',
				message: `API "${api.label || api.id}" has no outgoing edges`,
				nodeId: api.id
			});
		}
	}
	return results;
};

const architectureRules: LintRule[] = [archDatabaseIncoming, archApiEdges];

// ── Workflow rules ──────────────────────────────────────────────────

const workflowNodeStatus: LintRule = (nodes) => {
	const results: LintResult[] = [];
	const workflowNodes = nodes.filter((n) => n.type === 'workflow');
	for (const wf of workflowNodes) {
		if (!wf.data?.status) {
			results.push({
				id: 'workflow-no-status',
				severity: 'warning',
				message: `Workflow node "${wf.label || wf.id}" has no status field`,
				nodeId: wf.id
			});
		}
	}
	return results;
};

const workflowRules: LintRule[] = [workflowNodeStatus];

// ── Rule sets per diagram type ──────────────────────────────────────

const rulesByType: Record<string, LintRule[]> = {
	flowchart: flowchartRules,
	erd: erdRules,
	architecture: architectureRules,
	workflow: workflowRules
};

// ── Public API ──────────────────────────────────────────────────────

/**
 * Lint a diagram and return all issues found.
 * Runs universal rules first, then type-specific rules.
 */
export function lintDiagram(
	nodes: DiagramNode[],
	edges: DiagramEdge[],
	diagramType: string
): LintResult[] {
	// Skip group nodes for linting purposes
	const lintableNodes = nodes.filter((n) => n.type !== 'group');
	const nodeMap = new Map<string, DiagramNode>();
	for (const n of lintableNodes) nodeMap.set(n.id, n);

	const results: LintResult[] = [];

	// Run universal rules
	for (const rule of universalRules) {
		results.push(...rule(lintableNodes, edges, nodeMap));
	}

	// Run type-specific rules
	const typeRules = rulesByType[diagramType];
	if (typeRules) {
		for (const rule of typeRules) {
			results.push(...rule(lintableNodes, edges, nodeMap));
		}
	}

	// Sort: errors first, then warnings, then info
	const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
	results.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

	return results;
}
