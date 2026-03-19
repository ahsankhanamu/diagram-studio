# Diagram Studio — Create & Edit Diagrams

You are creating or modifying a **Diagram Studio** diagram. Instead of ASCII art, you produce a JSON file that renders as an interactive, editable diagram in the browser.

> **Viewer**: https://diagram-studio.vercel.app — open the app, select a workspace folder, and view/edit any `.json` diagram file.

## Instructions

1. **Read first.** If the user references an existing diagram, read the `.json` file before modifying it. Preserve fields you don't need to change.
2. **Write the JSON file** to the current working directory (or a subdirectory the user specifies). Use filename: `<slug>.json` (e.g., `auth-flow.json`).
3. **Visual verification (when possible).** If the Playwright screenshot tool is available at `~/Downloads/diagram-iterations/screenshot.mjs` and the diagram-studio dev server is running at `localhost:3001`, use the visual feedback loop to verify and refine the diagram before presenting it to the user. See **Visual Feedback Loop** below.
4. **After writing**, tell the user: _"Open https://diagram-studio.vercel.app, point it at this folder, and you'll see your diagram. Any edits you make there save back to the same file — ask me to read it if you want me to continue from your changes."_
5. **If the user says they edited the diagram**, re-read the file to pick up their changes before making further modifications.

### Visual Feedback Loop

When the diagram-studio dev server is running at `localhost:3001`, use this two-phase loop to produce high-quality diagrams:

```
Write JSON → Detect defects (JSON) → Fix → Render PNG → Read PNG → Fix visuals → Done
```

**Phase 1 — Programmatic defect detection** (no browser needed):

The screenshot tool at `~/Downloads/diagram-iterations/screenshot.mjs` runs pure JSON analysis to catch:
- **Truncated text**: calculates if description fits at `(nodeWidth - 48px) / 6.5px` chars
- **Node overlaps**: bounding box intersection check
- **Tight horizontal spacing**: detects gaps < 40px between adjacent nodes
- **Small architecture nodes**: flags nodes under 240px wide with descriptions
- **Port convergence**: warns when > 4 edges converge on one port
- **Section label collisions**: checks vertical gaps between text labels and nodes

Fix ALL programmatic defects before moving to Phase 2.

**Phase 2 — Visual rendering and verification**:

The tool then renders a pixel-perfect PNG via the canvas renderer. Three ways to get the PNG:

| Method | When to use |
|--------|-------------|
| `node ~/Downloads/diagram-iterations/screenshot.mjs <file> <output> [label]` | Full pipeline: defect report + canvas PNG |
| `/preview` | Drop zone — drag-and-drop a .json file to preview + export PNG |
| `/preview?path=/abs/path.json` | Interactive read-only preview (SvelteFlow, pan/zoom) |
| `/preview?path=...&export` | Canvas-rendered PNG with Download button |
| `/preview?path=...&download=true` | Auto-downloads the PNG (for automation) |

Read the PNG (multimodal vision) and check for:
- Edge labels overlapping nodes → remove label or add `centerX`/`centerY`
- Edges routing through intermediate nodes → increase layer gap or change handles
- U-shaped detours → switch to cross-side handles

**Stop after 3 iterations** or when no defects remain.

**Starting the dev server** (if not running):
```bash
cd ~/Desktop/projects/diagram-studio && npm run dev &
```

**Screenshot tool setup** (first time only):
```bash
cd ~/Downloads/diagram-iterations && npm install playwright && npx playwright install chromium
```

## Argument

`$ARGUMENTS` — a natural-language description of what diagram to create or how to modify an existing one.

---

## JSON Schema — `diagram-studio/diagram-v1`

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

### Node style properties

The `style` object on nodes supports these optional keys:

| Property | Type | Description |
|----------|------|-------------|
| `backgroundColor` | string | Card background color (hex, e.g. `"#1e293b"`) |
| `borderColor` | string | Border color (hex). Also tints the header gradient |
| `borderStyle` | string | `"solid"` (default), `"dashed"`, `"dotted"`, `"none"` |
| `fontSize` | string | Font size in px (e.g. `"14"`) |

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
  "strokeWidth": 1.5,
  "strokeColor": "",
  "centerX": null,
  "centerY": null
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

### Edge properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `strokeStyle` | string | `"solid"` | Line style: `solid`, `dashed`, `dotted` |
| `strokeWidth` | number | `1.5` | Line thickness: `1` (thin), `1.5` (default), `2.5` (medium), `4` (thick) |
| `strokeColor` | string | `""` | Hex color (e.g. `"#3b82f6"`). Empty = theme default |
| `centerX` | number \| null | `null` | Custom midpoint X for smoothstep/step routing. Set by UI drag |
| `centerY` | number \| null | `null` | Custom midpoint Y for smoothstep/step routing. Set by UI drag |
| `label` | string | `""` | Text displayed at the edge midpoint. Users can add/edit labels visually |

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

- **Vertical spacing**: 160px between rows (gap from bottom of one row to top of next)
- **Horizontal spacing**: 60px minimum between node edges (right edge to left edge of next column)
- **Starting position**: (60, 50)
- **Align nodes** in the same row to the same Y value
- Leave extra space around decision nodes and nodes with many connections

For **left-to-right** flows, use source `right` → target `left` with 160px horizontal spacing.

### Architecture diagram layout

Architecture diagrams need **generous sizing and spacing** to be readable. The default node sizes (180x60) are too small — descriptions get truncated.

**Node sizing (IMPORTANT):**
- Use **260–320px wide** nodes for `service`, `api`, `user` types (not 180px default)
- Use **90–110px tall** nodes that include a description (not 60px default)
- Use **200px wide** for `database` nodes
- Keep descriptions under **~50 characters** — longer text gets truncated with `...`
- A good description is a short phrase, not a sentence: `"HTTP client — OAuth2 tokens, retry"` not `"HTTP client for ECAS API with OAuth2 token management, retry with exponential backoff, and response logging"`

**Layer spacing:**
- **200px vertical gap** between logical layers (e.g. controllers → services → orchestration)
- **40px gap** between section `text` label and the first node below it
- **60px horizontal gap** between columns of nodes

**Section labels** (`text` type nodes):
- Place **40px above** their associated nodes (e.g., `y=390` for label, `y=430` for nodes)
- Never place a label at the same Y as a node — it will overlap
- Use `borderColor` to color-code sections

**Edge best practices for architecture diagrams:**
- **Label only the most important edges** — unlabeled edges are cleaner for secondary connections
- Use **`strokeWidth: 2`** for primary data flows, **`strokeWidth: 1`** for secondary/implied connections
- Use **`bezier`** type for long-distance diagonal connections (e.g., a node in column 4 connecting to one in column 1) — it produces smooth curves instead of angular steps
- Use **`smoothstep`** for direct vertical/horizontal connections within the same column
- When many edges converge on one node, **distribute across ports** (some to `top`, some to `left`/`right`) to avoid a tangled mess at one port
- Use **`dashed` stroke** for implied/secondary relationships
- Avoid routing edges through nodes — if two layers are far apart, increase the gap rather than letting edges cross over intermediate nodes

**Typical layer structure** (y positions for a 4-layer architecture):
```
Section label:  y=20,  nodes: y=60   (h=100)  — External Systems
Section label:  y=200, nodes: y=250  (h=90)   — Auth/Middleware
Section label:  y=390, nodes: y=430  (h=100)  — Controllers
Section label:  y=590, nodes: y=630  (h=95)   — Core Services
Section label:  y=790, nodes: y=830  (h=110)  — Orchestration
Section label:  y=1000, nodes: y=1050 (h=95)  — Workers/Processors
Section label:  y=1380, nodes: y=1420 (h=100) — Downstream Services
```
Add/remove layers as needed. The key principle: **leave at least 50px of empty space between the bottom of one layer's nodes and the top of the section label below.**

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
- [ ] Nodes don't overlap (check positions + sizes — verify `x + width + 60 < next_x` horizontally)
- [ ] Terminal nodes only have `top` and `bottom` ports
- [ ] Group nodes have all ports `false`
- [ ] Entity nodes include `fields` array in `data`
- [ ] Workflow nodes include `status` in `data`
- [ ] For architecture diagrams: nodes are at least 260px wide and 90px tall (not default 180x60)
- [ ] Descriptions are under ~50 characters (truncation occurs at node width)
- [ ] Section labels have ≥50px clear space above and below neighboring layers
- [ ] No more than 3–4 edges converge on a single port — distribute across ports if needed
