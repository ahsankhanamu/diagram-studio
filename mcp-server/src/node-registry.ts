/**
 * Node type registry — mirrors the main project's nodeRegistry.
 */

export interface NodeTypeDefinition {
  type: string;
  label: string;
  category: string;
  description: string;
  defaultSize: { width: number; height: number };
  defaultPorts: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  defaultData: Record<string, unknown>;
}

export const nodeRegistry: Record<string, NodeTypeDefinition> = {
  // Generic shapes
  "shape-rect": {
    type: "shape-rect",
    label: "Rectangle",
    category: "shapes",
    description: "Simple rectangle shape",
    defaultSize: { width: 120, height: 80 },
    defaultPorts: { top: true, bottom: true, left: true, right: true },
    defaultData: { width: 120, height: 80 },
  },
  "shape-circle": {
    type: "shape-circle",
    label: "Circle",
    category: "shapes",
    description: "Simple circle shape",
    defaultSize: { width: 80, height: 80 },
    defaultPorts: { top: true, bottom: true, left: true, right: true },
    defaultData: { width: 80 },
  },
  "shape-diamond": {
    type: "shape-diamond",
    label: "Diamond",
    category: "shapes",
    description: "Simple diamond shape",
    defaultSize: { width: 80, height: 80 },
    defaultPorts: { top: true, bottom: true, left: true, right: true },
    defaultData: { width: 80 },
  },
  text: {
    type: "text",
    label: "Text",
    category: "shapes",
    description: "Free text label",
    defaultSize: { width: 100, height: 30 },
    defaultPorts: { top: true, bottom: true, left: true, right: true },
    defaultData: {},
  },
  // Flowchart
  process: {
    type: "process",
    label: "Process",
    category: "flowchart",
    description: "A process or action step",
    defaultSize: { width: 180, height: 60 },
    defaultPorts: { top: true, bottom: true, left: true, right: true },
    defaultData: {},
  },
  decision: {
    type: "decision",
    label: "Decision",
    category: "flowchart",
    description: "A conditional branch point",
    defaultSize: { width: 100, height: 100 },
    defaultPorts: { top: true, bottom: true, left: true, right: true },
    defaultData: {},
  },
  terminal: {
    type: "terminal",
    label: "Terminal",
    category: "flowchart",
    description: "Start or end point",
    defaultSize: { width: 90, height: 36 },
    defaultPorts: { top: true, bottom: true, left: false, right: false },
    defaultData: {},
  },
  io: {
    type: "io",
    label: "I/O",
    category: "flowchart",
    description: "Input or output operation",
    defaultSize: { width: 150, height: 48 },
    defaultPorts: { top: true, bottom: true, left: true, right: true },
    defaultData: {},
  },
  document: {
    type: "document",
    label: "Document",
    category: "flowchart",
    description: "Document or report",
    defaultSize: { width: 150, height: 56 },
    defaultPorts: { top: true, bottom: true, left: true, right: true },
    defaultData: {},
  },
  // Architecture
  service: {
    type: "service",
    label: "Service",
    category: "architecture",
    description: "A microservice or server component",
    defaultSize: { width: 180, height: 60 },
    defaultPorts: { top: true, bottom: true, left: true, right: true },
    defaultData: {},
  },
  database: {
    type: "database",
    label: "Database",
    category: "architecture",
    description: "Database or data store",
    defaultSize: { width: 120, height: 72 },
    defaultPorts: { top: true, bottom: true, left: true, right: true },
    defaultData: {},
  },
  queue: {
    type: "queue",
    label: "Queue",
    category: "architecture",
    description: "Message queue or buffer",
    defaultSize: { width: 180, height: 60 },
    defaultPorts: { top: true, bottom: true, left: true, right: true },
    defaultData: {},
  },
  api: {
    type: "api",
    label: "API",
    category: "architecture",
    description: "API gateway or endpoint",
    defaultSize: { width: 180, height: 60 },
    defaultPorts: { top: true, bottom: true, left: true, right: true },
    defaultData: {},
  },
  user: {
    type: "user",
    label: "User",
    category: "architecture",
    description: "User or actor",
    defaultSize: { width: 180, height: 60 },
    defaultPorts: { top: true, bottom: true, left: true, right: true },
    defaultData: {},
  },
  // ERD
  entity: {
    type: "entity",
    label: "Entity",
    category: "erd",
    description: "Database entity with fields",
    defaultSize: { width: 160, height: 80 },
    defaultPorts: { top: true, bottom: true, left: true, right: true },
    defaultData: { fields: [] },
  },
  // Group
  group: {
    type: "group",
    label: "Group",
    category: "flowchart",
    description: "Container for grouping nodes",
    defaultSize: { width: 300, height: 200 },
    defaultPorts: { top: false, bottom: false, left: false, right: false },
    defaultData: {},
  },
  // Workflow
  workflow: {
    type: "workflow",
    label: "Workflow",
    category: "workflow",
    description: "Workflow step with status indicator",
    defaultSize: { width: 170, height: 44 },
    defaultPorts: { top: true, bottom: true, left: true, right: true },
    defaultData: { status: "idle" },
  },
};

export function getNodesByCategory(category: string): NodeTypeDefinition[] {
  return Object.values(nodeRegistry).filter((n) => n.category === category);
}
