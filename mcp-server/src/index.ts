#!/usr/bin/env node

/**
 * Diagram Studio MCP Server
 *
 * Exposes diagram CRUD, layout, and generation tools over the
 * Model Context Protocol (stdio transport). Reads and writes the
 * same JSON files that Diagram Studio's browser UI watches.
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";

import {
  listDiagrams,
  readDiagramFile,
  createDiagram,
  addNode,
  addEdge,
  removeNode,
  removeEdge,
  updateNode,
  applyAutoLayout,
  generateDiagram,
} from "./diagram-ops.js";
import { nodeRegistry, getNodesByCategory } from "./node-registry.js";

// ── Server setup ────────────────────────────────────────────────────

const server = new McpServer({
  name: "diagram-studio",
  version: "1.0.0",
});

// ── Tools ───────────────────────────────────────────────────────────

server.tool(
  "list_diagrams",
  "List all Diagram Studio JSON files in a workspace directory",
  {
    workspace_dir: z.string().describe("Absolute path to the workspace directory"),
  },
  async ({ workspace_dir }) => {
    try {
      const diagrams = await listDiagrams(workspace_dir);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(diagrams, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "read_diagram",
  "Read and return a diagram's full JSON contents",
  {
    diagram_path: z.string().describe("Absolute path to the diagram JSON file"),
  },
  async ({ diagram_path }) => {
    try {
      const diagram = await readDiagramFile(diagram_path);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(diagram, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "create_diagram",
  "Create a new empty diagram JSON file with proper schema",
  {
    file_path: z.string().describe("Absolute path where the diagram file will be created (e.g. /path/to/MyDiagram.json)"),
    name: z.string().describe("Human-readable name for the diagram"),
    diagram_type: z
      .enum(["flowchart", "architecture", "erd", "workflow"])
      .default("flowchart")
      .describe("Type of diagram"),
  },
  async ({ file_path, name, diagram_type }) => {
    try {
      const diagram = await createDiagram(file_path, name, diagram_type);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(diagram, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "add_node",
  "Add a node to an existing diagram",
  {
    diagram_path: z.string().describe("Absolute path to the diagram JSON file"),
    type: z.string().describe("Node type (e.g. process, decision, terminal, service, database, entity, workflow)"),
    label: z.string().describe("Display label for the node"),
    position: z
      .object({ x: z.number(), y: z.number() })
      .describe("Position {x, y} on the canvas"),
    description: z.string().optional().describe("Optional description text"),
    size: z
      .object({ width: z.number(), height: z.number() })
      .optional()
      .describe("Optional size override {width, height}"),
    data: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Optional extra data (e.g. {fields: [...]} for entity nodes)"),
    ports: z
      .object({
        top: z.boolean(),
        bottom: z.boolean(),
        left: z.boolean(),
        right: z.boolean(),
      })
      .optional()
      .describe("Optional port config override"),
  },
  async ({ diagram_path, type, label, position, description, size, data, ports }) => {
    try {
      if (!nodeRegistry[type]) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Unknown node type "${type}". Use list_node_types to see available types.`,
            },
          ],
          isError: true,
        };
      }
      const result = await addNode(diagram_path, type, label, position, {
        description,
        size,
        data: data as Record<string, unknown> | undefined,
        ports,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { message: "Node added", node: result.node, diagram_id: result.diagram.id },
              null,
              2
            ),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "add_edge",
  "Add an edge (connection) between two nodes in a diagram",
  {
    diagram_path: z.string().describe("Absolute path to the diagram JSON file"),
    source: z.string().describe("Source node ID"),
    target: z.string().describe("Target node ID"),
    sourceHandle: z
      .enum(["top", "bottom", "left", "right"])
      .default("bottom")
      .describe("Which port on the source node"),
    targetHandle: z
      .enum(["top", "bottom", "left", "right"])
      .default("top")
      .describe("Which port on the target node"),
    type: z
      .enum(["smoothstep", "straight", "step", "bezier"])
      .default("smoothstep")
      .describe("Edge routing style"),
    label: z.string().optional().describe("Optional label on the edge"),
  },
  async ({ diagram_path, source, target, sourceHandle, targetHandle, type, label }) => {
    try {
      const result = await addEdge(diagram_path, source, target, sourceHandle, targetHandle, type, label);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { message: "Edge added", edge: result.edge, diagram_id: result.diagram.id },
              null,
              2
            ),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "remove_node",
  "Remove a node and all its connected edges from a diagram",
  {
    diagram_path: z.string().describe("Absolute path to the diagram JSON file"),
    node_id: z.string().describe("ID of the node to remove"),
  },
  async ({ diagram_path, node_id }) => {
    try {
      const diagram = await removeNode(diagram_path, node_id);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Node ${node_id} and connected edges removed`,
                remaining_nodes: diagram.nodes.length,
                remaining_edges: diagram.edges.length,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "remove_edge",
  "Remove an edge from a diagram by its ID",
  {
    diagram_path: z.string().describe("Absolute path to the diagram JSON file"),
    edge_id: z.string().describe("ID of the edge to remove"),
  },
  async ({ diagram_path, edge_id }) => {
    try {
      const diagram = await removeEdge(diagram_path, edge_id);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Edge ${edge_id} removed`,
                remaining_edges: diagram.edges.length,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "update_node",
  "Update a node's label, position, size, or other properties",
  {
    diagram_path: z.string().describe("Absolute path to the diagram JSON file"),
    node_id: z.string().describe("ID of the node to update"),
    label: z.string().optional().describe("New label"),
    description: z.string().optional().describe("New description"),
    position: z
      .object({ x: z.number(), y: z.number() })
      .optional()
      .describe("New position"),
    size: z
      .object({ width: z.number(), height: z.number() })
      .optional()
      .describe("New size"),
    data: z.record(z.string(), z.unknown()).optional().describe("Merge into node data"),
    style: z.record(z.string(), z.string()).optional().describe("Merge into node style"),
    ports: z
      .object({
        top: z.boolean(),
        bottom: z.boolean(),
        left: z.boolean(),
        right: z.boolean(),
      })
      .optional()
      .describe("New port config"),
    type: z.string().optional().describe("Change node type"),
  },
  async ({ diagram_path, node_id, ...updates }) => {
    try {
      const result = await updateNode(diagram_path, node_id, {
        ...updates,
        style: updates.style as Record<string, string> | undefined,
        data: updates.data as Record<string, unknown> | undefined,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { message: "Node updated", node: result.node },
              null,
              2
            ),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "auto_layout",
  "Apply dagre auto-layout to rearrange all nodes in a diagram",
  {
    diagram_path: z.string().describe("Absolute path to the diagram JSON file"),
    direction: z
      .enum(["TB", "LR"])
      .default("TB")
      .describe("Layout direction: TB = top-to-bottom, LR = left-to-right"),
  },
  async ({ diagram_path, direction }) => {
    try {
      const diagram = await applyAutoLayout(diagram_path, direction);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Auto-layout applied (${direction})`,
                nodes: diagram.nodes.length,
                edges: diagram.edges.length,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "list_node_types",
  "Return all available node types with descriptions, grouped by category",
  {
    category: z
      .string()
      .optional()
      .describe("Filter by category: flowchart, architecture, erd, workflow, shapes"),
  },
  async ({ category }) => {
    try {
      const types = category
        ? getNodesByCategory(category)
        : Object.values(nodeRegistry);

      const grouped: Record<string, Array<{ type: string; label: string; description: string; defaultSize: object }>> = {};
      for (const t of types) {
        if (!grouped[t.category]) grouped[t.category] = [];
        grouped[t.category].push({
          type: t.type,
          label: t.label,
          description: t.description,
          defaultSize: t.defaultSize,
        });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(grouped, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "generate_diagram",
  `Natural language to diagram: takes a description and generates a complete diagram with nodes, edges, and auto-layout. Describe what you want (e.g. "user authentication flow with login, MFA check, and dashboard") and this tool will create it.`,
  {
    file_path: z.string().describe("Absolute path where the diagram file will be created"),
    name: z.string().describe("Human-readable name for the diagram"),
    description: z
      .string()
      .describe(
        "Natural language description of the diagram to generate. The server will interpret this and create appropriate nodes and edges."
      ),
    diagram_type: z
      .enum(["flowchart", "architecture", "erd", "workflow"])
      .default("flowchart")
      .describe("Type of diagram to generate"),
    direction: z
      .enum(["TB", "LR"])
      .default("TB")
      .describe("Layout direction"),
    nodes: z
      .array(
        z.object({
          id: z.string().describe("Temporary ID for referencing in edges (e.g. 'n1', 'n2')"),
          type: z.string().describe("Node type from the registry"),
          label: z.string().describe("Display label"),
          data: z.record(z.string(), z.unknown()).optional().describe("Optional node data"),
        })
      )
      .describe("Array of node specifications"),
    edges: z
      .array(
        z.object({
          source: z.string().describe("Temp ID of source node"),
          target: z.string().describe("Temp ID of target node"),
          sourceHandle: z.enum(["top", "bottom", "left", "right"]).optional(),
          targetHandle: z.enum(["top", "bottom", "left", "right"]).optional(),
          label: z.string().optional().describe("Optional edge label"),
          type: z.enum(["smoothstep", "straight", "step", "bezier"]).optional(),
        })
      )
      .default([])
      .describe("Array of edge specifications referencing temp node IDs"),
  },
  async ({ file_path, name, description, diagram_type, direction, nodes, edges }) => {
    try {
      // Validate node types
      for (const n of nodes) {
        if (!nodeRegistry[n.type]) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: Unknown node type "${n.type}". Use list_node_types to see available types.`,
              },
            ],
            isError: true,
          };
        }
      }

      const diagram = await generateDiagram(
        file_path,
        name,
        diagram_type,
        nodes,
        edges,
        direction
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Diagram "${name}" generated successfully`,
                path: file_path.endsWith(".json") ? file_path : file_path + ".json",
                id: diagram.id,
                nodes: diagram.nodes.length,
                edges: diagram.edges.length,
                diagram,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ── Resources ───────────────────────────────────────────────────────

server.resource(
  "diagram",
  new ResourceTemplate("file://{diagram_path}", { list: undefined }),
  {
    description: "A Diagram Studio diagram JSON file. Browse and read diagram contents.",
  },
  async (uri, variables) => {
    const filePath = typeof variables.diagram_path === "string"
      ? variables.diagram_path
      : uri.pathname;
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: raw,
          },
        ],
      };
    } catch (err: any) {
      throw new Error(`Cannot read diagram: ${err.message}`);
    }
  }
);

// ── Prompts ─────────────────────────────────────────────────────────

server.prompt(
  "generate-erd",
  "Generate an Entity-Relationship Diagram from a description of entities and their relationships",
  {
    description: z
      .string()
      .describe("Description of the entities and relationships (e.g. 'Users have many Orders, Orders have many LineItems, Products belong to Categories')"),
    file_path: z
      .string()
      .describe("Absolute path where the diagram file will be created"),
  },
  ({ description, file_path }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Generate an Entity-Relationship Diagram for the following description. Use the generate_diagram tool with diagram_type "erd" and entity nodes. Each entity should have a "fields" array in its data.

Description: ${description}

Save to: ${file_path}

Guidelines:
- Use "entity" node type for each table/entity
- Include a "fields" array in each node's data with objects like: {"name": "id", "type": "uuid", "pk": true}
- Connect related entities with labeled edges (e.g. "has many", "belongs to")
- Use sourceHandle "right" and targetHandle "left" for horizontal relationships
- Apply auto-layout with direction "LR" for ERDs`,
        },
      },
    ],
  })
);

server.prompt(
  "generate-flowchart",
  "Generate a flowchart from a description of a process or workflow",
  {
    description: z
      .string()
      .describe("Description of the process (e.g. 'User login flow: enter credentials, validate, if valid go to dashboard, else show error and retry')"),
    file_path: z
      .string()
      .describe("Absolute path where the diagram file will be created"),
  },
  ({ description, file_path }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Generate a flowchart for the following process description. Use the generate_diagram tool with diagram_type "flowchart".

Description: ${description}

Save to: ${file_path}

Guidelines:
- Use "terminal" nodes for start/end points
- Use "process" nodes for action steps
- Use "decision" nodes for conditional branches (Yes/No)
- Use "io" nodes for input/output operations
- Use "document" nodes for reports or documents
- Label edges coming from decision nodes with "Yes" / "No"
- Use sourceHandle "bottom" / targetHandle "top" for the main flow
- Use sourceHandle "right" / targetHandle "left" for alternate paths from decisions
- Apply auto-layout with direction "TB"`,
        },
      },
    ],
  })
);

server.prompt(
  "generate-architecture",
  "Generate a system architecture diagram from a description of services and their interactions",
  {
    description: z
      .string()
      .describe("Description of the architecture (e.g. 'React frontend talks to API gateway, which routes to auth service and order service, both use PostgreSQL, order service publishes to SQS queue')"),
    file_path: z
      .string()
      .describe("Absolute path where the diagram file will be created"),
  },
  ({ description, file_path }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Generate a system architecture diagram for the following description. Use the generate_diagram tool with diagram_type "architecture".

Description: ${description}

Save to: ${file_path}

Guidelines:
- Use "user" nodes for actors/clients
- Use "api" nodes for API gateways or endpoints
- Use "service" nodes for microservices/servers
- Use "database" nodes for databases and data stores
- Use "queue" nodes for message queues or event buses
- Label edges with the communication protocol or purpose (e.g. "REST", "gRPC", "publishes events")
- Use sourceHandle "bottom" / targetHandle "top" for vertical flows
- Use sourceHandle "right" / targetHandle "left" for horizontal connections
- Apply auto-layout with direction "TB" (or "LR" for wide architectures)`,
        },
      },
    ],
  })
);

// ── Start ───────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
