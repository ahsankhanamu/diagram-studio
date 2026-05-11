import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import dagre from "@dagrejs/dagre";
import { DiagramEditorProvider } from "./diagramEditorProvider";
import { DiagramExplorerProvider, DiagramFolderItem, DiagramTreeItem, type DiagramTreeNode } from "./diagramExplorer";

export const log = vscode.window.createOutputChannel("Diagram Studio");

export function activate(context: vscode.ExtensionContext) {
  log.appendLine("[Diagram Studio] Extension activated");
  context.subscriptions.push(log);

  // ── Custom editor ──────────────────────────────────────────────────
  context.subscriptions.push(DiagramEditorProvider.register(context));

  // ── Diagram Explorer (sidebar tree view + Explorer panel) ─────────
  const explorer = new DiagramExplorerProvider(context);
  const treeView = vscode.window.createTreeView<DiagramTreeNode>("diagramStudio.explorer", {
    treeDataProvider: explorer,
    showCollapseAll: true,
    canSelectMany: true,
  });
  const explorerPanelView = vscode.window.createTreeView<DiagramTreeNode>("diagramStudio.explorerPanel", {
    treeDataProvider: explorer,
    showCollapseAll: true,
    canSelectMany: true,
  });
  context.subscriptions.push(treeView, explorerPanelView);

  // Refresh
  context.subscriptions.push(
    vscode.commands.registerCommand("diagramStudio.refreshExplorer", () =>
      explorer.refresh()
    )
  );

  // New diagram
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "diagramStudio.newDiagram",
      async () => {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders) {
          vscode.window.showErrorMessage(
            "Open a folder first to create a diagram."
          );
          return;
        }
        const name = await vscode.window.showInputBox({
          prompt: "Diagram name",
          value: "Untitled",
        });
        if (!name) return;

        const safe = name.replace(/[^\w\s-]/g, "").trim() || "Untitled";
        const filePath = path.join(folders[0].uri.fsPath, `${safe}.json`);
        const id =
          "diag_" +
          Math.random().toString(36).substring(2, 12).padEnd(10, "0");
        const now = new Date().toISOString();
        const diagram = {
          $schema: "diagram-studio/diagram-v1",
          id,
          name,
          description: "",
          diagramType: "flowchart",
          version: 1,
          createdAt: now,
          modifiedAt: now,
          viewport: { x: 0, y: 0, zoom: 1 },
          nodes: [],
          edges: [],
          metadata: { tags: [], author: "", notes: "" },
        };
        fs.writeFileSync(filePath, JSON.stringify(diagram, null, 2) + "\n");
        await vscode.commands.executeCommand(
          "vscode.openWith",
          vscode.Uri.file(filePath),
          "diagramStudio.diagramEditor"
        );
        explorer.refresh();
      }
    )
  );

  // Export selected diagrams as HTML (also used for folder hover and toolbar button).
  // Priority: explicit multi-selection args → folder context → single file context
  //           → active tree view selection → all diagrams in workspace.
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "diagramStudio.exportSelectedAsHtml",
      async (...args: unknown[]) => {
        const toDiagramItems = (nodes: readonly DiagramTreeNode[]): DiagramTreeItem[] =>
          nodes.flatMap(n => n.kind === "folder" ? n.children : [n]);

        let selected: DiagramTreeItem[] = [];
        let titleHint = "";

        if (Array.isArray(args[1]) && args[1].length > 0) {
          // VS Code passes the full multi-selection array as args[1]
          selected = toDiagramItems(args[1] as DiagramTreeNode[]);
        } else if ((args[0] as DiagramTreeNode)?.kind === "folder") {
          const folder = args[0] as DiagramFolderItem;
          selected = folder.children;
          titleHint = folder.label as string;
        } else if ((args[0] as DiagramTreeNode)?.kind === "diagram") {
          selected = [args[0] as DiagramTreeItem];
        } else {
          // Toolbar button with no context — use whichever tree view has a selection
          const viewSel = treeView.selection.length > 0
            ? treeView.selection
            : explorerPanelView.selection;
          selected = toDiagramItems(viewSel);
        }

        // Final fallback: export everything in the workspace
        if (selected.length === 0) {
          const all = await explorer.getAllDiagrams();
          if (all.length === 0) {
            vscode.window.showWarningMessage("No diagram files found in the workspace.");
            return;
          }
          const wsName = vscode.workspace.workspaceFolders?.[0]?.name ?? "Diagrams";
          await exportDiagramsAsHtml(all.map(d => d.diagram), wsName, all[0].uri);
          return;
        }

        const title = titleHint ||
          (selected.length === 1
            ? (selected[0].label as string)
            : vscode.workspace.workspaceFolders?.[0]?.name ?? "Diagrams");

        await exportDiagramsAsHtml(
          selected.map((i) => i.data),
          title,
          selected[0].resourceUri
        );
      }
    )
  );

  // Export ALL diagrams as HTML
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "diagramStudio.exportAllAsHtml",
      async () => {
        const all = await explorer.getAllDiagrams();
        if (all.length === 0) {
          vscode.window.showWarningMessage(
            "No diagram files found in the workspace."
          );
          return;
        }

        const title = all.length === 1
          ? (all[0].diagram.name as string) || "Untitled"
          : vscode.workspace.workspaceFolders?.[0]?.name ?? "Diagrams";

        await exportDiagramsAsHtml(all.map((d) => d.diagram), title, all[0].uri);
      }
    )
  );

  // Reformat all diagrams with auto-layout
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "diagramStudio.reformatAllDiagrams",
      async () => {
        const all = await explorer.getAllDiagrams();
        if (all.length === 0) {
          vscode.window.showWarningMessage("No diagram files found in the workspace.");
          return;
        }
        const confirm = await vscode.window.showWarningMessage(
          `Reformat ${all.length} diagram${all.length !== 1 ? "s" : ""} with auto-layout? This repositions all nodes.`,
          { modal: true },
          "Reformat"
        );
        if (confirm !== "Reformat") return;
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: "Reformatting diagrams…" },
          async () => {
            let count = 0;
            for (const { uri, diagram } of all) {
              try {
                const reformatted = applyAutoLayout(diagram);
                await vscode.workspace.fs.writeFile(
                  uri,
                  Buffer.from(JSON.stringify(reformatted, null, 2) + "\n", "utf-8")
                );
                count++;
              } catch (e) {
                log.appendLine(`[reformat] Failed for ${uri.fsPath}: ${e}`);
              }
            }
            explorer.refresh();
            vscode.window.showInformationMessage(
              `Reformatted ${count} diagram${count !== 1 ? "s" : ""}.`
            );
          }
        );
      }
    )
  );

  // Auto-refresh explorer when JSON files change
  const watcher = vscode.workspace.createFileSystemWatcher("**/*.json");
  watcher.onDidCreate(() => explorer.refresh());
  watcher.onDidDelete(() => explorer.refresh());
  context.subscriptions.push(watcher);
}

// ── Shared export helper ─────────────────────────────────────────────

async function exportDiagramsAsHtml(
  diagrams: Record<string, unknown>[],
  title: string,
  fallbackUri?: vscode.Uri
): Promise<void> {
  log.appendLine(`[export] Starting export of ${diagrams.length} diagram(s)`);

  let panel = DiagramEditorProvider.getActivePanel();

  if (!panel) {
    if (!fallbackUri) {
      vscode.window.showWarningMessage("Open any diagram in the editor first, then run Export.");
      return;
    }
    log.appendLine(`[export] No active panel — auto-opening ${fallbackUri.fsPath}`);
    await vscode.commands.executeCommand("vscode.openWith", fallbackUri, "diagramStudio.diagramEditor");

    // Wait for the webview panel to register and signal ready (up to 8s)
    panel = await new Promise<vscode.WebviewPanel | undefined>((resolve) => {
      const deadline = setTimeout(() => {
        clearInterval(poll);
        resolve(DiagramEditorProvider.getActivePanel());
      }, 8000);

      const poll = setInterval(() => {
        const p = DiagramEditorProvider.getActivePanel();
        if (!p) return;
        clearInterval(poll);
        // Wait for ready message from the webview
        const readySub = p.webview.onDidReceiveMessage((msg) => {
          if (msg.type !== "ready") return;
          readySub.dispose();
          clearTimeout(deadline);
          // Small extra delay to let SvelteKit finish mounting
          setTimeout(() => resolve(p), 400);
        });
        // Fallback: if ready never fires (panel already loaded), proceed after 2s
        setTimeout(() => { readySub.dispose(); clearTimeout(deadline); resolve(p); }, 2000);
      }, 150);
    });
  }

  if (!panel) {
    vscode.window.showWarningMessage("Could not open a diagram editor for export.");
    return;
  }
  log.appendLine("[export] Active panel ready");

  // Ask for save path upfront
  const folders = vscode.workspace.workspaceFolders;
  const defaultDir = folders?.[0]?.uri.fsPath ?? "";
  const saveUri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(defaultDir, `${title}.html`)),
    filters: { "HTML File": ["html"] },
  });
  if (!saveUri) {
    log.appendLine("[export] Save dialog cancelled");
    return;
  }
  log.appendLine(`[export] Save path: ${saveUri.fsPath}`);

  // Send all diagram data to the webview for rendering
  log.appendLine("[export] Posting exportAll to webview…");
  panel.webview.postMessage({
    type: "exportAll",
    data: { diagrams, title, savePath: saveUri.fsPath, showReorder: true },
  });

  const disposable = panel.webview.onDidReceiveMessage(
    async (msg) => {
      if (msg.type === "exportAllCancel") {
        disposable.dispose();
        log.appendLine("[export] Export cancelled by user in reorder dialog");
        return;
      }
      if (msg.type !== "exportAllResult") return;
      disposable.dispose();
      log.appendLine("[export] Received exportAllResult from webview");
      const { content } = msg.data as { content: string };
      if (!content) {
        log.appendLine("[export] ERROR: exportAllResult had empty content");
        vscode.window.showErrorMessage("Export failed: webview returned empty HTML.");
        return;
      }
      log.appendLine(`[export] Writing ${content.length} bytes to ${saveUri.fsPath}`);
      await vscode.workspace.fs.writeFile(
        saveUri,
        Buffer.from(content, "utf-8")
      );
      log.appendLine("[export] File written successfully");
      const open = await vscode.window.showInformationMessage(
        `Exported ${diagrams.length} diagram${diagrams.length !== 1 ? "s" : ""} to ${path.basename(saveUri.fsPath)}`,
        "Open File"
      );
      if (open) vscode.env.openExternal(saveUri);
    }
  );
}

export function deactivate() {}

// ── Auto-layout helper ─────────────────────────────────────────────────

function applyAutoLayout(diagram: Record<string, unknown>): Record<string, unknown> {
  const nodes = (diagram.nodes as any[]) || [];
  const edges = (diagram.edges as any[]) || [];
  if (nodes.length === 0) return diagram;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80, edgesep: 30, marginx: 40, marginy: 40 });

  for (const node of nodes) {
    if (node.type === "group") continue;
    g.setNode(node.id, { width: node.size?.width || 180, height: node.size?.height || 60 });
  }

  for (const edge of edges) {
    if (!g.hasNode(edge.source) || !g.hasNode(edge.target)) continue;
    if (edge.label) {
      const lw = Math.round(String(edge.label).length * 6.5 + 20);
      g.setEdge(edge.source, edge.target, { label: edge.label, width: lw, height: 22 });
    } else {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const newNodes = nodes.map((node: any) => {
    if (node.type === "group") return node;
    const pos = g.node(node.id);
    if (!pos) return node;
    return {
      ...node,
      position: {
        x: Math.round(pos.x - (node.size?.width || 180) / 2),
        y: Math.round(pos.y - (node.size?.height || 60) / 2),
      },
    };
  });

  return { ...diagram, nodes: newNodes, modifiedAt: new Date().toISOString() };
}
