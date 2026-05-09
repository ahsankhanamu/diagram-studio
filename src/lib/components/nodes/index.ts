import type { NodeTypeDefinition } from '$lib/types/node-types';
import type { Component } from 'svelte';
import ProcessNode from './ProcessNode.svelte';
import DecisionNode from './DecisionNode.svelte';
import TerminalNode from './TerminalNode.svelte';
import IONode from './IONode.svelte';
import DocumentNode from './DocumentNode.svelte';
import DatabaseNode from './DatabaseNode.svelte';
import ServiceNode from './ServiceNode.svelte';
import QueueNode from './QueueNode.svelte';
import ApiNode from './ApiNode.svelte';
import UserNode from './UserNode.svelte';
import EntityNode from './EntityNode.svelte';
import WorkflowNode from './WorkflowNode.svelte';
import GroupNode from './GroupNode.svelte';
import ShapeRectNode from './ShapeRectNode.svelte';
import ShapeCircleNode from './ShapeCircleNode.svelte';
import ShapeDiamondNode from './ShapeDiamondNode.svelte';
import TextNode from './TextNode.svelte';

export const nodeRegistry: Record<string, NodeTypeDefinition> = {
	// Generic shapes
	'shape-rect': {
		type: 'shape-rect',
		label: 'Rectangle',
		category: 'shapes',
		icon: 'Square',
		color: '--color-accent',
		description: 'Simple rectangle shape',
		defaultSize: { width: 120, height: 80 },
		defaultPorts: { top: true, bottom: true, left: true, right: true },
		defaultData: { width: 120, height: 80 }
	},
	'shape-circle': {
		type: 'shape-circle',
		label: 'Circle',
		category: 'shapes',
		icon: 'Circle',
		color: '--color-accent',
		description: 'Simple circle shape',
		defaultSize: { width: 80, height: 80 },
		defaultPorts: { top: true, bottom: true, left: true, right: true },
		defaultData: { width: 80 }
	},
	'shape-diamond': {
		type: 'shape-diamond',
		label: 'Diamond',
		category: 'shapes',
		icon: 'Diamond',
		color: '--color-accent',
		description: 'Simple diamond shape',
		defaultSize: { width: 80, height: 80 },
		defaultPorts: { top: true, bottom: true, left: true, right: true },
		defaultData: { width: 80 }
	},
	text: {
		type: 'text',
		label: 'Text',
		category: 'shapes',
		icon: 'Type',
		color: '--color-accent',
		description: 'Free text label',
		defaultSize: { width: 100, height: 30 },
		defaultPorts: { top: true, bottom: true, left: true, right: true },
		defaultData: {}
	},
	// Flowchart
	process: {
		type: 'process',
		label: 'Process',
		category: 'flowchart',
		icon: 'Square',
		color: '--color-node-flowchart',
		description: 'A process or action step',
		defaultSize: { width: 180, height: 60 },
		defaultPorts: { top: true, bottom: true, left: true, right: true },
		defaultData: {}
	},
	decision: {
		type: 'decision',
		label: 'Decision',
		category: 'flowchart',
		icon: 'Diamond',
		color: '--color-node-decision',
		description: 'A conditional branch point',
		defaultSize: { width: 100, height: 100 },
		defaultPorts: { top: true, bottom: true, left: true, right: true },
		defaultData: {}
	},
	terminal: {
		type: 'terminal',
		label: 'Terminal',
		category: 'flowchart',
		icon: 'Circle',
		color: '--color-node-terminal',
		description: 'Start or end point',
		defaultSize: { width: 90, height: 36 },
		defaultPorts: { top: true, bottom: true, left: false, right: false },
		defaultData: {}
	},
	io: {
		type: 'io',
		label: 'I/O',
		category: 'flowchart',
		icon: 'ArrowLeftRight',
		color: '--color-node-io',
		description: 'Input or output operation',
		defaultSize: { width: 150, height: 48 },
		defaultPorts: { top: true, bottom: true, left: true, right: true },
		defaultData: {}
	},
	document: {
		type: 'document',
		label: 'Document',
		category: 'flowchart',
		icon: 'FileText',
		color: '--color-node-document',
		description: 'Document or report',
		defaultSize: { width: 150, height: 56 },
		defaultPorts: { top: true, bottom: true, left: true, right: true },
		defaultData: {}
	},
	// Architecture
	service: {
		type: 'service',
		label: 'Service',
		category: 'architecture',
		icon: 'Server',
		color: '--color-node-service',
		description: 'A microservice or server component',
		defaultSize: { width: 180, height: 60 },
		defaultPorts: { top: true, bottom: true, left: true, right: true },
		defaultData: {}
	},
	database: {
		type: 'database',
		label: 'Database',
		category: 'architecture',
		icon: 'Database',
		color: '--color-node-database',
		description: 'Database or data store',
		defaultSize: { width: 120, height: 72 },
		defaultPorts: { top: true, bottom: true, left: true, right: true },
		defaultData: {}
	},
	queue: {
		type: 'queue',
		label: 'Queue',
		category: 'architecture',
		icon: 'ListOrdered',
		color: '--color-node-queue',
		description: 'Message queue or buffer',
		defaultSize: { width: 180, height: 60 },
		defaultPorts: { top: true, bottom: true, left: true, right: true },
		defaultData: {}
	},
	api: {
		type: 'api',
		label: 'API',
		category: 'architecture',
		icon: 'Globe',
		color: '--color-node-api',
		description: 'API gateway or endpoint',
		defaultSize: { width: 180, height: 60 },
		defaultPorts: { top: true, bottom: true, left: true, right: true },
		defaultData: {}
	},
	user: {
		type: 'user',
		label: 'User',
		category: 'architecture',
		icon: 'User',
		color: '--color-node-user',
		description: 'User or actor',
		defaultSize: { width: 180, height: 60 },
		defaultPorts: { top: true, bottom: true, left: true, right: true },
		defaultData: {}
	},
	// ERD
	entity: {
		type: 'entity',
		label: 'Entity',
		category: 'erd',
		icon: 'Table',
		color: '--color-node-erd',
		description: 'Database entity with fields',
		defaultSize: { width: 200, height: 58 },
		defaultPorts: { top: true, bottom: true, left: true, right: true },
		defaultData: { fields: [] }
	},
	// Group
	group: {
		type: 'group',
		label: 'Group',
		category: 'flowchart',
		icon: 'Group',
		color: '--color-accent',
		description: 'Container for grouping nodes',
		defaultSize: { width: 300, height: 200 },
		defaultPorts: { top: false, bottom: false, left: false, right: false },
		defaultData: {}
	},
	// Workflow
	workflow: {
		type: 'workflow',
		label: 'Workflow',
		category: 'workflow',
		icon: 'Workflow',
		color: '--color-node-workflow',
		description: 'Workflow step with status indicator',
		defaultSize: { width: 170, height: 44 },
		defaultPorts: { top: true, bottom: true, left: true, right: true },
		defaultData: { status: 'idle' },
		backgroundTint: 8
	}
};

// SvelteFlow node type component map
export const nodeTypes: Record<string, Component<any>> = {
	'shape-rect': ShapeRectNode,
	'shape-circle': ShapeCircleNode,
	'shape-diamond': ShapeDiamondNode,
	text: TextNode,
	process: ProcessNode,
	decision: DecisionNode,
	terminal: TerminalNode,
	io: IONode,
	document: DocumentNode,
	database: DatabaseNode,
	service: ServiceNode,
	queue: QueueNode,
	api: ApiNode,
	user: UserNode,
	entity: EntityNode,
	workflow: WorkflowNode,
	group: GroupNode
};

export function getNodesByCategory(category: string): NodeTypeDefinition[] {
	return Object.values(nodeRegistry).filter((n) => n.category === category);
}
