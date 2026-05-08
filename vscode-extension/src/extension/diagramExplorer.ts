import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export interface DiagramFileData {
  uri: vscode.Uri;
  diagram: Record<string, unknown>;
}

export type DiagramTreeNode = DiagramFolderItem | DiagramTreeItem;

// ── Folder colors — cycle through chart colors, stable per folder name ──────
const FOLDER_COLORS = [
  "charts.blue",
  "charts.purple",
  "charts.orange",
  "charts.yellow",
  "charts.red",
  "charts.green",
] as const;

const _folderColorCache = new Map<string, string>();
let _folderColorIndex = 0;

function folderColor(name: string): string {
  if (!_folderColorCache.has(name)) {
    _folderColorCache.set(
      name,
      FOLDER_COLORS[_folderColorIndex % FOLDER_COLORS.length]
    );
    _folderColorIndex++;
  }
  return _folderColorCache.get(name)!;
}

// ── Tree items ───────────────────────────────────────────────────────────────

export class DiagramFolderItem extends vscode.TreeItem {
  readonly kind = "folder" as const;

  constructor(
    public readonly folderPath: string,
    name: string,
    public readonly children: DiagramTreeItem[]
  ) {
    super(name, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon(
      "folder",
      new vscode.ThemeColor(folderColor(name))
    );
    this.description = `${children.length} diagram${children.length !== 1 ? "s" : ""}`;
    this.tooltip = folderPath;
    this.resourceUri = vscode.Uri.file(folderPath);
    this.contextValue = "diagramFolder";
  }
}

export class DiagramTreeItem extends vscode.TreeItem {
  readonly kind = "diagram" as const;

  constructor(
    public readonly label: string,
    public readonly diagramType: string,
    public override readonly resourceUri: vscode.Uri,
    public readonly data: Record<string, unknown>
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = diagramType;
    this.tooltip = `${label} (${diagramType})\n${resourceUri.fsPath}`;
    this.command = {
      command: "vscode.openWith",
      title: "Open Diagram",
      arguments: [resourceUri, "diagramStudio.diagramEditor"],
    };
    this.contextValue = "diagramFile";
    const icons: Record<string, string> = {
      flowchart: "symbol-misc",
      architecture: "server",
      erd: "database",
      workflow: "symbol-event",
    };
    this.iconPath = new vscode.ThemeIcon(icons[diagramType] ?? "symbol-misc");
  }
}

// ── Provider ─────────────────────────────────────────────────────────────────

export class DiagramExplorerProvider
  implements vscode.TreeDataProvider<DiagramTreeNode>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DiagramTreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: DiagramTreeNode): Promise<DiagramTreeNode[]> {
    if (element?.kind === "folder") return element.children;
    if (element) return [];

    const wsFolders = vscode.workspace.workspaceFolders;
    if (!wsFolders) return [];

    // Multi-root workspace: group by workspace folder name (e.g. "adeo-fe",
    // "adeo-agenda-service") — mirrors the log-viewer pattern where each service
    // directory is a top-level group regardless of where the files sit inside it.
    //
    // Single-root workspace: group by top-level subdirectory instead, since the
    // workspace folder itself is not a meaningful label.
    if (wsFolders.length > 1) {
      const result: DiagramTreeNode[] = [];
      for (const wsFolder of wsFolders) {
        const items = await this.scan(wsFolder.uri.fsPath);
        if (items.length === 0) continue;
        result.push(new DiagramFolderItem(wsFolder.uri.fsPath, wsFolder.name, items));
      }
      return result;
    }

    // Single-root: group by immediate top-level subdirectory
    const wsRoot = wsFolders[0].uri.fsPath;
    const byFolder = new Map<string, DiagramTreeItem[]>();
    const rootItems: DiagramTreeItem[] = [];

    for (const item of await this.scan(wsRoot)) {
      const rel = path.relative(wsRoot, item.resourceUri!.fsPath);
      const parts = rel.split(path.sep);
      if (parts.length === 1) {
        rootItems.push(item);
      } else {
        const topDir = path.join(wsRoot, parts[0]);
        if (!byFolder.has(topDir)) byFolder.set(topDir, []);
        byFolder.get(topDir)!.push(item);
      }
    }

    const result: DiagramTreeNode[] = [];
    const sortedFolders = [...byFolder.entries()].sort(([a], [b]) =>
      path.basename(a).localeCompare(path.basename(b))
    );
    for (const [folderPath, children] of sortedFolders) {
      result.push(new DiagramFolderItem(folderPath, path.basename(folderPath), children));
    }
    result.push(...rootItems);
    return result;
  }

  private async scan(dir: string, depth = 0): Promise<DiagramTreeItem[]> {
    if (depth > 4) return [];
    const items: DiagramTreeItem[] = [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        items.push(...(await this.scan(full, depth + 1)));
      } else if (e.isFile() && e.name.endsWith(".json")) {
        try {
          const json = JSON.parse(fs.readFileSync(full, "utf-8"));
          if (json.$schema === "diagram-studio/diagram-v1") {
            items.push(
              new DiagramTreeItem(
                json.name || e.name.replace(".json", ""),
                json.diagramType || "flowchart",
                vscode.Uri.file(full),
                json
              )
            );
          }
        } catch {
          /* skip invalid JSON */
        }
      }
    }
    return items;
  }

  async getAllDiagrams(): Promise<DiagramFileData[]> {
    const children = await this.getChildren();
    const result: DiagramFileData[] = [];
    for (const child of children) {
      if (child.kind === "folder") {
        for (const item of child.children) {
          result.push({ uri: item.resourceUri!, diagram: item.data });
        }
      } else {
        result.push({ uri: child.resourceUri!, diagram: child.data });
      }
    }
    return result;
  }
}
