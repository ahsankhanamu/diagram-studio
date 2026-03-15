# Diagram Studio MCP Server

MCP (Model Context Protocol) server for [Diagram Studio](https://github.com/ahsan/diagram-studio) — enables AI assistants to create, edit, and manage diagrams by reading and writing the same JSON files that the Diagram Studio UI watches.

## Setup

```bash
cd mcp-server
npm install
npm run build
```

## Claude Desktop Configuration

Add this to your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "diagram-studio": {
      "command": "node",
      "args": ["/absolute/path/to/diagram-studio/mcp-server/dist/index.js"]
    }
  }
}
```

Replace `/absolute/path/to` with the actual path on your machine.

## Tools

| Tool | Description |
|------|-------------|
| `list_diagrams` | List all diagram JSON files in a workspace directory |
| `read_diagram` | Read and return a diagram's full JSON contents |
| `create_diagram` | Create a new empty diagram with proper schema |
| `add_node` | Add a node to an existing diagram |
| `add_edge` | Add an edge between two nodes |
| `remove_node` | Remove a node and its connected edges |
| `remove_edge` | Remove an edge by ID |
| `update_node` | Update a node's label, position, size, or properties |
| `auto_layout` | Apply dagre auto-layout (TB or LR direction) |
| `list_node_types` | List all available node types by category |
| `generate_diagram` | Generate a complete diagram from node/edge specs with auto-layout |

## Resources

- **diagram** — `file://{diagram_path}` — browse and read diagram JSON files

## Prompts

- **generate-erd** — template for generating entity-relationship diagrams
- **generate-flowchart** — template for generating flowcharts
- **generate-architecture** — template for generating architecture diagrams

## Node Types

| Type | Category | Description |
|------|----------|-------------|
| `process` | flowchart | Action step |
| `decision` | flowchart | Conditional branch |
| `terminal` | flowchart | Start/end point |
| `io` | flowchart | Input/output |
| `document` | flowchart | Document/report |
| `service` | architecture | Microservice |
| `database` | architecture | Data store |
| `queue` | architecture | Message queue |
| `api` | architecture | API endpoint |
| `user` | architecture | Actor |
| `entity` | erd | DB entity with fields |
| `workflow` | workflow | Step with status |

## How It Works

The server reads and writes JSON files on disk in the `diagram-studio/diagram-v1` schema. When the Diagram Studio browser app has a workspace open, it polls for file changes (or uses FileSystemObserver on Chrome 133+). Any file the MCP server writes will be detected and rendered in the UI within ~1 second.

## Development

```bash
npm run dev    # Run with tsx (no build step)
npm run build  # Compile TypeScript to dist/
npm start      # Run compiled output
```
