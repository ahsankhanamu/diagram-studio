import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export class DiagramEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = "diagramStudio.diagramEditor";
  private static activePanels = new Map<string, vscode.WebviewPanel>();

  public static getActivePanel(): vscode.WebviewPanel | undefined {
    return DiagramEditorProvider.activePanels.values().next().value;
  }

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new DiagramEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      DiagramEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Validate that this is a diagram-studio file
    if (!this.isDiagramStudioFile(document)) {
      webviewPanel.webview.html = this.getErrorHtml(
        "This JSON file is not a Diagram Studio diagram. Expected '\"$schema\": \"diagram-studio/diagram-v1\"'."
      );
      return;
    }

    const webviewDir = path.join(this.context.extensionPath, "dist", "webview");

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(webviewDir)],
    };

    webviewPanel.webview.html = this.getHtmlForWebview(
      webviewPanel.webview,
      webviewDir
    );

    // Skip-next-update flag to avoid echo loops
    let skipNextUpdate = false;

    const updateWebview = () => {
      if (!webviewPanel.visible) return;
      try {
        const json = JSON.parse(document.getText());
        webviewPanel.webview.postMessage({ type: "update", data: json });
      } catch {
        // Invalid JSON, ignore
      }
    };

    const messageDisposable = webviewPanel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case "ready":
            updateWebview();
            return;
          case "save": {
            const text = JSON.stringify(message.data, null, 2) + "\n";
            if (text === document.getText()) return;
            skipNextUpdate = true;
            const edit = new vscode.WorkspaceEdit();
            edit.replace(
              document.uri,
              new vscode.Range(0, 0, document.lineCount, 0),
              text
            );
            vscode.workspace.applyEdit(edit);
            return;
          }
          case "exportPng": {
            const { data, filename } = message.data as { data: string; filename: string };
            const dir = path.dirname(document.uri.fsPath);
            const uri = await vscode.window.showSaveDialog({
              defaultUri: vscode.Uri.file(path.join(dir, `${filename}.png`)),
              filters: { "PNG Image": ["png"] },
            });
            if (uri) {
              await vscode.workspace.fs.writeFile(uri, Buffer.from(data, "base64"));
            }
            return;
          }
          case "exportHtml": {
            const { content, filename } = message.data as { content: string; filename: string };
            const dir = path.dirname(document.uri.fsPath);
            const uri = await vscode.window.showSaveDialog({
              defaultUri: vscode.Uri.file(path.join(dir, `${filename}.html`)),
              filters: { "HTML File": ["html"] },
            });
            if (uri) {
              await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
            }
            return;
          }
        }
      }
    );

    const changeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString()) return;
      if (e.contentChanges.length === 0) return;
      if (skipNextUpdate) {
        skipNextUpdate = false;
        return;
      }
      updateWebview();
    });

    // Track active panels so export-all can use any open webview
    DiagramEditorProvider.activePanels.set(document.uri.toString(), webviewPanel);
    webviewPanel.onDidDispose(() => {
      DiagramEditorProvider.activePanels.delete(document.uri.toString());
      messageDisposable.dispose();
      changeDisposable.dispose();
    });
  }

  private isDiagramStudioFile(document: vscode.TextDocument): boolean {
    try {
      const json = JSON.parse(document.getText());
      return json.$schema === "diagram-studio/diagram-v1";
    } catch {
      return false;
    }
  }

  private getHtmlForWebview(
    webview: vscode.Webview,
    webviewDir: string
  ): string {
    const indexPath = path.join(webviewDir, "index.html");
    let html = fs.readFileSync(indexPath, "utf-8");

    const base = webview
      .asWebviewUri(vscode.Uri.file(webviewDir))
      .toString();

    // Rewrite all root-relative paths to webview URIs.
    // Handles href="/_app/...", import("/_app/..."), href="/favicon.ico", etc.
    html = html.replace(/\/_app\//g, `${base}/_app/`);
    html = html.replace(/\/favicon\.ico/g, `${base}/favicon.ico`);

    // SvelteKit router checks window.location to find matching routes.
    // In a webview the URL isn't "/" so the router shows 404.
    // Inject a history.replaceState before SvelteKit boots to fix this.
    html = html.replace(
      "<body",
      `<body`
    );
    // Insert route fix script right before the first SvelteKit script
    html = html.replace(
      /(<script>[\s\S]*?__sveltekit)/,
      `<script>history.replaceState({}, '', '/');</script>\n$1`
    );

    // CSP: allow inline scripts (SvelteKit bootstrap) + webview source (ES module imports)
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'unsafe-inline' ${webview.cspSource}`,
      `font-src ${webview.cspSource} https://fonts.gstatic.com`,
      `img-src ${webview.cspSource} data:`,
      `connect-src ${webview.cspSource} https://fonts.googleapis.com https://fonts.gstatic.com`,
      `frame-src blob: 'self'`,
    ].join("; ");

    html = html.replace(
      "<head>",
      `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">`
    );

    return html;
  }

  private getErrorHtml(message: string): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
           display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .msg { text-align: center; max-width: 400px; }
  </style>
</head>
<body>
  <div class="msg"><p>${message}</p></div>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
