/**
 * Filesystem-backed diagram operations.
 * All reads/writes target JSON files on disk — the same files Diagram Studio watches.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { DiagramFile, DiagramNode, DiagramEdge } from "./types.js";
import { generateId } from "./ids.js";
import { nodeRegistry } from "./node-registry.js";
import { autoLayout, type LayoutDirection } from "./layout.js";

// ── Helpers ─────────────────────────────────────────────────────────

async function readDiagram(filePath: string): Promise<DiagramFile> {
  const raw = await fs.readFile(filePath, "utf-8");
  const diagram = JSON.parse(raw) as DiagramFile;
  if (diagram.$schema !== "diagram-studio/diagram-v1") {
    throw new Error(`Not a Diagram Studio file: ${filePath}`);
  }
  return diagram;
}

async function writeDiagram(filePath: string, diagram: DiagramFile): Promise<void> {
  diagram.modifiedAt = new Date().toISOString();
  diagram.version += 1;
  const content = JSON.stringify(diagram, null, 2) + "\n";
  await fs.writeFile(filePath, content, "utf-8");
}

function ensureJsonExt(filePath: string): string {
  return filePath.endsWith(".json") ? filePath : filePath + ".json";
}

// ── Public operations ───────────────────────────────────────────────

/**
 * List all .json diagram files in a workspace directory (non-recursive).
 */
export async function listDiagrams(
  workspaceDir: string
): Promise<Array<{ name: string; path: string; id: string; diagramType: string }>> {
  const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
  const results: Array<{ name: string; path: string; id: string; diagramType: string }> = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const fullPath = path.join(workspaceDir, entry.name);
    try {
      const diagram = await readDiagram(fullPath);
      results.push({
        name: diagram.name,
        path: fullPath,
        id: diagram.id,
        diagramType: diagram.diagramType,
      });
    } catch {
      // Not a valid diagram file — skip
    }
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Read and return a diagram's full JSON contents.
 */
export async function readDiagramFile(filePath: string): Promise<DiagramFile> {
  return readDiagram(ensureJsonExt(filePath));
}

/**
 * Create a new empty diagram file.
 */
export async function createDiagram(
  filePath: string,
  name: string,
  diagramType: string = "flowchart"
): Promise<DiagramFile> {
  const resolvedPath = ensureJsonExt(filePath);
  const now = new Date().toISOString();
  const diagram: DiagramFile = {
    $schema: "diagram-studio/diagram-v1",
    id: generateId("diag"),
    name,
    description: "",
    diagramType,
    version: 0,
    createdAt: now,
    modifiedAt: now,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: [],
    metadata: { tags: [], author: "", notes: "" },
  };
  // version will become 1 after writeDiagram increments it
  await writeDiagram(resolvedPath, diagram);
  return { ...diagram, version: 1 };
}

/**
 * Add a node to an existing diagram.
 */
export async function addNode(
  diagramPath: string,
  type: string,
  label: string,
  position: { x: number; y: number },
  metadata?: {
    description?: string;
    size?: { width: number; height: number };
    data?: Record<string, unknown>;
    ports?: { top: boolean; bottom: boolean; left: boolean; right: boolean };
    style?: Record<string, string>;
  }
): Promise<{ diagram: DiagramFile; node: DiagramNode }> {
  const resolvedPath = ensureJsonExt(diagramPath);
  const diagram = await readDiagram(resolvedPath);

  const typeDef = nodeRegistry[type];
  const node: DiagramNode = {
    id: generateId("node"),
    type,
    label,
    description: metadata?.description ?? "",
    position: { x: position.x, y: position.y },
    size: metadata?.size ?? typeDef?.defaultSize ?? { width: 180, height: 60 },
    data: metadata?.data ?? typeDef?.defaultData ?? {},
    style: metadata?.style ?? {},
    ports: metadata?.ports ?? typeDef?.defaultPorts ?? { top: true, bottom: true, left: true, right: true },
  };

  diagram.nodes.push(node);
  await writeDiagram(resolvedPath, diagram);
  return { diagram, node };
}

/**
 * Add an edge between two nodes.
 */
export async function addEdge(
  diagramPath: string,
  source: string,
  target: string,
  sourceHandle: string = "bottom",
  targetHandle: string = "top",
  edgeType: string = "smoothstep",
  label?: string
): Promise<{ diagram: DiagramFile; edge: DiagramEdge }> {
  const resolvedPath = ensureJsonExt(diagramPath);
  const diagram = await readDiagram(resolvedPath);

  // Validate nodes exist
  const sourceNode = diagram.nodes.find((n) => n.id === source);
  const targetNode = diagram.nodes.find((n) => n.id === target);
  if (!sourceNode) throw new Error(`Source node not found: ${source}`);
  if (!targetNode) throw new Error(`Target node not found: ${target}`);

  const edge: DiagramEdge = {
    id: generateId("edge"),
    source,
    target,
    sourceHandle,
    targetHandle,
    type: edgeType,
    label: label ?? "",
    description: "",
    animated: false,
    style: {},
    markerEnd: "arrowclosed",
  };

  diagram.edges.push(edge);
  await writeDiagram(resolvedPath, diagram);
  return { diagram, edge };
}

/**
 * Remove a node and all its connected edges.
 */
export async function removeNode(
  diagramPath: string,
  nodeId: string
): Promise<DiagramFile> {
  const resolvedPath = ensureJsonExt(diagramPath);
  const diagram = await readDiagram(resolvedPath);

  const idx = diagram.nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) throw new Error(`Node not found: ${nodeId}`);

  diagram.nodes.splice(idx, 1);
  // Remove connected edges
  diagram.edges = diagram.edges.filter(
    (e) => e.source !== nodeId && e.target !== nodeId
  );
  // Remove children of this node
  diagram.nodes = diagram.nodes.filter((n) => n.parentId !== nodeId);

  await writeDiagram(resolvedPath, diagram);
  return diagram;
}

/**
 * Remove an edge by ID.
 */
export async function removeEdge(
  diagramPath: string,
  edgeId: string
): Promise<DiagramFile> {
  const resolvedPath = ensureJsonExt(diagramPath);
  const diagram = await readDiagram(resolvedPath);

  const idx = diagram.edges.findIndex((e) => e.id === edgeId);
  if (idx === -1) throw new Error(`Edge not found: ${edgeId}`);

  diagram.edges.splice(idx, 1);
  await writeDiagram(resolvedPath, diagram);
  return diagram;
}

/**
 * Update a node's properties.
 */
export async function updateNode(
  diagramPath: string,
  nodeId: string,
  updates: {
    label?: string;
    description?: string;
    position?: { x: number; y: number };
    size?: { width: number; height: number };
    data?: Record<string, unknown>;
    style?: Record<string, string>;
    ports?: { top: boolean; bottom: boolean; left: boolean; right: boolean };
    type?: string;
  }
): Promise<{ diagram: DiagramFile; node: DiagramNode }> {
  const resolvedPath = ensureJsonExt(diagramPath);
  const diagram = await readDiagram(resolvedPath);

  const node = diagram.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);

  if (updates.label !== undefined) node.label = updates.label;
  if (updates.description !== undefined) node.description = updates.description;
  if (updates.position) node.position = updates.position;
  if (updates.size) node.size = updates.size;
  if (updates.data) node.data = { ...node.data, ...updates.data };
  if (updates.style) node.style = { ...node.style, ...updates.style };
  if (updates.ports) node.ports = updates.ports;
  if (updates.type) node.type = updates.type;

  await writeDiagram(resolvedPath, diagram);
  return { diagram, node };
}

/**
 * Apply dagre auto-layout to a diagram.
 */
export async function applyAutoLayout(
  diagramPath: string,
  direction: LayoutDirection = "TB"
): Promise<DiagramFile> {
  const resolvedPath = ensureJsonExt(diagramPath);
  const diagram = await readDiagram(resolvedPath);

  diagram.nodes = autoLayout(diagram.nodes, diagram.edges, direction);
  await writeDiagram(resolvedPath, diagram);
  return diagram;
}

/**
 * Generate a complete diagram from a structured specification.
 * Used by the generate_diagram tool after parsing the natural-language description.
 */
export async function generateDiagram(
  filePath: string,
  name: string,
  diagramType: string,
  nodeSpecs: Array<{ id?: string; type: string; label: string; data?: Record<string, unknown> }>,
  edgeSpecs: Array<{
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
    label?: string;
    type?: string;
  }>,
  direction: LayoutDirection = "TB"
): Promise<DiagramFile> {
  const resolvedPath = ensureJsonExt(filePath);
  const now = new Date().toISOString();

  // Build nodes with temp-id mapping
  const idMap = new Map<string, string>();
  const nodes: DiagramNode[] = nodeSpecs.map((spec, i) => {
    const realId = generateId("node");
    const tempId = spec.id ?? `temp_${i}`;
    idMap.set(tempId, realId);
    const typeDef = nodeRegistry[spec.type];
    return {
      id: realId,
      type: spec.type,
      label: spec.label,
      description: "",
      position: { x: 0, y: 0 },
      size: typeDef?.defaultSize ?? { width: 180, height: 60 },
      data: spec.data ?? typeDef?.defaultData ?? {},
      style: {},
      ports: typeDef?.defaultPorts ?? { top: true, bottom: true, left: true, right: true },
    };
  });

  // Build edges, resolving temp IDs
  const edges: DiagramEdge[] = edgeSpecs.map((spec) => {
    const sourceId = idMap.get(spec.source) ?? spec.source;
    const targetId = idMap.get(spec.target) ?? spec.target;
    return {
      id: generateId("edge"),
      source: sourceId,
      target: targetId,
      sourceHandle: spec.sourceHandle ?? "bottom",
      targetHandle: spec.targetHandle ?? "top",
      type: spec.type ?? "smoothstep",
      label: spec.label ?? "",
      description: "",
      animated: false,
      style: {},
      markerEnd: "arrowclosed",
    };
  });

  // Apply auto-layout
  const laidOutNodes = autoLayout(nodes, edges, direction);

  const diagram: DiagramFile = {
    $schema: "diagram-studio/diagram-v1",
    id: generateId("diag"),
    name,
    description: "",
    diagramType,
    version: 0,
    createdAt: now,
    modifiedAt: now,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: laidOutNodes,
    edges,
    metadata: { tags: [], author: "mcp-server", notes: "" },
  };

  await writeDiagram(resolvedPath, diagram);
  return { ...diagram, version: 1 };
}
