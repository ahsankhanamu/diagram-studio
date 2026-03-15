import * as vscode from "vscode";
import { DiagramEditorProvider } from "./diagramEditorProvider";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(DiagramEditorProvider.register(context));
}

export function deactivate() {}
