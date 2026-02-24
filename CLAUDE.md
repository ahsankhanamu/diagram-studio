# Diagram Studio

AI-collaborative diagramming tool. Humans and AI edit the same JSON files on disk — changes sync automatically.

## Architecture

**Local-first, no server for data.** The browser reads/writes JSON files directly via the [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access). The server only serves static assets.

```
Browser (SvelteKit CSR)
  ├─ workspaceStore    → holds FileSystemDirectoryHandle (persisted in IndexedDB)
  ├─ fs-access.ts      → all file I/O via FSAA (read/write/list/delete)
  ├─ diagramStore      → reactive node/edge state (Svelte stores)
  └─ watchDiagram()    → polls file.lastModified every 1s for external changes

Local Filesystem
  └─ <user-chosen-folder>/
       ├─ proj_xxx/
       │    ├─ project.json
       │    ├─ diag_aaa.json
       │    └─ diag_bbb.json
       └─ proj_yyy/
            └─ ...
```

### Data flow

- **User edits in UI** → store updates → auto-save (1s debounce) → `saveDiagram()` writes via FSAA
- **AI edits JSON on disk** → `watchDiagram()` detects mtime change → reloads diagram → UI updates
- **Self-write lock** → `markSelfWrite()` prevents the poller from echoing app-generated saves

### Key files

| File | Purpose |
|------|---------|
| `src/lib/engine/fs-access.ts` | All filesystem operations via File System Access API |
| `src/lib/stores/workspaceStore.ts` | Directory handle + IndexedDB persistence |
| `src/lib/stores/diagramStore.ts` | Core diagram state (nodes, edges, metadata) |
| `src/lib/engine/serializer.ts` | DiagramNode ↔ SvelteFlow Node conversion |
| `src/lib/engine/layout.ts` | Dagre-based auto-layout |
| `src/lib/engine/export.ts` | Export (JSON/SVG/PNG) + import via FSAA |
| `src/lib/components/nodes/index.ts` | Node type registry (12 types, 4 categories) |

## Tech stack

- **Svelte 5** + **SvelteKit** (CSR mode, `ssr = false`)
- **@xyflow/svelte** — node graph visualization
- **@dagrejs/dagre** — auto-layout engine
- **Tailwind CSS 4** — styling
- **bits-ui** — accessible UI primitives
- **lucide-svelte** — icons

## Commands

```sh
npm run dev          # dev server on :3001
npm run build        # production build
npm run preview      # preview production build on :3001
```

## JSON schema

Diagrams are `diagram-studio/diagram-v1` JSON files. AI can create/edit them directly:

```json
{
  "$schema": "diagram-studio/diagram-v1",
  "id": "diag_xxxxxxxxxx",
  "name": "My Diagram",
  "diagramType": "flowchart",
  "version": 1,
  "nodes": [
    {
      "id": "node_xxxxxxxxxx",
      "type": "process",
      "label": "Step 1",
      "position": { "x": 0, "y": 0 },
      "size": { "width": 180, "height": 60 },
      "ports": { "top": true, "bottom": true, "left": true, "right": true }
    }
  ],
  "edges": [
    {
      "id": "edge_xxxxxxxxxx",
      "source": "node_1",
      "target": "node_2",
      "sourceHandle": "bottom",
      "targetHandle": "top",
      "type": "smoothstep"
    }
  ]
}
```

### Node types

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

### ID conventions

- Projects: `proj_` + 10-char nanoid
- Diagrams: `diag_` + 10-char nanoid
- Nodes: `node_` + 10-char nanoid
- Edges: `edge_` + 10-char nanoid

## Browser requirements

Requires File System Access API: **Chrome 86+**, **Edge 86+**, **Opera 72+**. Not supported in Firefox or Safari.
