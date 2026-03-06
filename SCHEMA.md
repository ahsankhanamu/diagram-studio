# Diagram Studio — JSON Schema Reference

Complete schema reference for `diagram-studio/diagram-v1` JSON files. Both the browser UI and AI (via `/diagram` command) read and write this format.

---

## Diagram File

```json
{
  "$schema": "diagram-studio/diagram-v1",
  "id": "diag_<10chars>",
  "name": "Human-readable name",
  "description": "",
  "diagramType": "flowchart",
  "version": 1,
  "createdAt": "<ISO 8601>",
  "modifiedAt": "<ISO 8601>",
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "nodes": [],
  "edges": [],
  "metadata": { "tags": [], "author": "", "notes": "" }
}
```

### diagramType values
`flowchart` | `architecture` | `erd` | `workflow` | `sequence` | `mindmap`

---

## Nodes

```json
{
  "id": "node_<10chars>",
  "type": "<type>",
  "label": "Display text",
  "description": "",
  "position": { "x": 0, "y": 0 },
  "size": { "width": 180, "height": 60 },
  "data": {},
  "style": {},
  "ports": { "top": true, "bottom": true, "left": true, "right": true }
}
```

### Node types

| Type | Category | Default Size | Use for |
|------|----------|-------------|---------|
| `process` | flowchart | 180x60 | Action/step |
| `decision` | flowchart | 100x100 | Conditional branch (diamond) |
| `terminal` | flowchart | 90x36 | Start/end (pill shape). Ports: top+bottom only |
| `io` | flowchart | 150x48 | Input/output (parallelogram) |
| `document` | flowchart | 150x56 | Document/report |
| `group` | flowchart | 300x200 | Container. Ports: all false. Children set `parentId` + `extent: "parent"` |
| `service` | architecture | 180x60 | Microservice/server |
| `database` | architecture | 120x72 | Data store (cylinder) |
| `queue` | architecture | 180x60 | Message queue |
| `api` | architecture | 180x60 | API endpoint |
| `user` | architecture | 180x60 | Actor/user |
| `entity` | erd | 160x80 | DB entity. `data: { fields: [{ name, type }] }` |
| `workflow` | workflow | 170x44 | Step with status. `data: { status: "idle"\|"running"\|"success"\|"error" }` |
| `shape-rect` | shapes | 120x80 | Plain rectangle |
| `shape-circle` | shapes | 80x80 | Circle |
| `shape-diamond` | shapes | 80x80 | Diamond |
| `text` | shapes | 100x30 | Free text label |

---

## Edges

```json
{
  "id": "edge_<10chars>",
  "source": "node_xxx",
  "target": "node_yyy",
  "sourceHandle": "bottom",
  "targetHandle": "top",
  "type": "smoothstep",
  "label": "",
  "description": "",
  "animated": false,
  "style": {},
  "markerEnd": "arrowclosed",
  "strokeStyle": "solid",
  "strokeWidth": 1.5
}
```

### Edge types
`smoothstep` (default, best for most) | `bezier` | `straight` | `step` | `labeled` | `animated`

> **Avoid same-side connections** (e.g. `right` → `right`) when possible — they create U-shaped detours. For edges going to a node that is above-left or below-right, use cross-side handles like `top` → `right` or `left` → `top`. Same-side is acceptable for retry loops and bypass edges where no cross-side option exists.

### Handle positions
`top` | `bottom` | `left` | `right` — must match an enabled port on the node.

### Markers (markerStart / markerEnd)
`arrow` | `arrowclosed` | `circle` | `diamond` | `none`

### Stroke styles
`solid` | `dashed` | `dotted`

---

## ID Generation

All IDs use the pattern `<prefix>_<10 random alphanumeric chars>`:
- `diag_a7Bx9kLm2Q`
- `node_pR3nW8vYcT`
- `edge_hK5mD1sXjF`

Use mixed-case alphanumeric characters (a-z, A-Z, 0-9). Each ID must be unique within the file.

---

## Layout Guidelines

Use a **top-to-bottom** flow by default (source `bottom` → target `top`). Space nodes on a grid:

- **Vertical spacing**: 160px between rows
- **Horizontal spacing**: 100px between columns
- **Starting position**: (100, 50)
- **Align nodes** in the same row to the same Y value
- Leave extra space around decision nodes and nodes with many connections

For **left-to-right** flows, use source `right` → target `left` with 160px horizontal spacing.

For **architecture diagrams**, use a layered layout (200px between layers):
- Top row: users/clients (y=50)
- Middle row: services/APIs (y=250)
- Bottom row: databases/queues (y=450)

---

## Example — Minimal Flowchart

```json
{
  "$schema": "diagram-studio/diagram-v1",
  "id": "diag_a7Bx9kLm2Q",
  "name": "Login Flow",
  "description": "User authentication flow",
  "diagramType": "flowchart",
  "version": 1,
  "createdAt": "2026-02-25T00:00:00.000Z",
  "modifiedAt": "2026-02-25T00:00:00.000Z",
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "nodes": [
    { "id": "node_001aSTARTx", "type": "terminal", "label": "Start", "description": "", "position": { "x": 145, "y": 50 }, "size": { "width": 90, "height": 36 }, "data": {}, "style": {}, "ports": { "top": true, "bottom": true, "left": false, "right": false } },
    { "id": "node_002aPROCSx", "type": "process", "label": "Enter Credentials", "description": "", "position": { "x": 100, "y": 150 }, "size": { "width": 180, "height": 60 }, "data": {}, "style": {}, "ports": { "top": true, "bottom": true, "left": true, "right": true } },
    { "id": "node_003aDECSx", "type": "decision", "label": "Valid?", "description": "", "position": { "x": 140, "y": 280 }, "size": { "width": 100, "height": 100 }, "data": {}, "style": {}, "ports": { "top": true, "bottom": true, "left": true, "right": true } },
    { "id": "node_004aENDxx", "type": "terminal", "label": "End", "description": "", "position": { "x": 145, "y": 450 }, "size": { "width": 90, "height": 36 }, "data": {}, "style": {}, "ports": { "top": true, "bottom": true, "left": false, "right": false } }
  ],
  "edges": [
    { "id": "edge_001aE1xxx", "source": "node_001aSTARTx", "target": "node_002aPROCSx", "sourceHandle": "bottom", "targetHandle": "top", "type": "smoothstep", "label": "", "description": "", "animated": false, "style": {}, "markerEnd": "arrowclosed" },
    { "id": "edge_002aE2xxx", "source": "node_002aPROCSx", "target": "node_003aDECSx", "sourceHandle": "bottom", "targetHandle": "top", "type": "smoothstep", "label": "", "description": "", "animated": false, "style": {}, "markerEnd": "arrowclosed" },
    { "id": "edge_003aE3YES", "source": "node_003aDECSx", "target": "node_004aENDxx", "sourceHandle": "bottom", "targetHandle": "top", "type": "smoothstep", "label": "Yes", "description": "", "animated": false, "style": {}, "markerEnd": "arrowclosed" },
    { "id": "edge_004aE3NOx", "source": "node_003aDECSx", "target": "node_002aPROCSx", "sourceHandle": "right", "targetHandle": "right", "type": "smoothstep", "label": "No", "description": "", "animated": false, "style": {}, "markerEnd": "arrowclosed" }
  ],
  "metadata": { "tags": ["auth"], "author": "", "notes": "" }
}
```

---

## Checklist before writing

- [ ] Every node has a unique `node_<10chars>` ID
- [ ] Every edge has a unique `edge_<10chars>` ID
- [ ] Edge `source`/`target` reference valid node IDs
- [ ] Edge handles match enabled ports on their nodes
- [ ] Nodes don't overlap (check positions + sizes)
- [ ] Terminal nodes only have `top` and `bottom` ports
- [ ] Group nodes have all ports `false`
- [ ] Entity nodes include `fields` array in `data`
- [ ] Workflow nodes include `status` in `data`
