import * as vscode from "vscode";
import { AlertLevel } from "./types";

const statusFetchers = {
  // Debug
  status_debug_active_session: () => typeof vscode.debug.activeDebugSession !== "undefined",

  // Editor
  status_editor_column_number: () => (vscode.window.activeTextEditor?.selection.active.character ?? -2) + 1,
  status_editor_line_number: () => (vscode.window.activeTextEditor?.selection.active.line ?? -2) + 1,
  status_editor_document_name: () =>
    vscode.window.activeTextEditor?.document.uri.toString().split("/").pop() ?? "#no-document-name",
  status_editor_encoding: () => {
    const uri = vscode.window.activeTextEditor?.document.uri;
    if (!uri) return "#no-editor-encoding";
    return vscode.workspace.getConfiguration("files", uri).get<string>("encoding") ?? "#no-editor-encoding";
  },
  status_editor_error_count: () => {
    const uri = vscode.window.activeTextEditor?.document.uri;
    if (!uri) return 0;
    return vscode.languages.getDiagnostics(uri).filter(d => d.severity == vscode.DiagnosticSeverity.Error).length;
  },
  status_editor_language_id: () => vscode.window.activeTextEditor?.document.languageId ?? "#no-language-id",

  // Git extension
  status_git_branch: () => {
    const extension = vscode.extensions.getExtension("vscode.git");
    if (!extension) return "#no-git-extension";

    const api = extension.exports.getAPI(1);
    if (!api) return "#no-git-api";

    const repo = api.repositories[0];
    if (!repo) return "#no-git-repository";

    const branch = repo.state.HEAD?.name;
    if (!branch) return "#no-git-branch";

    return branch;
  },

  // Workspace
  status_workspace_name: () => vscode.workspace.name ?? "#no-workspace",
};

export type StatusName = keyof typeof statusFetchers;

export function alert(message: string, level: AlertLevel, options: string[], res: (selected?: string) => void) {
  let notify = vscode.window.showInformationMessage;
  if (level === "warn") notify = vscode.window.showWarningMessage;
  else if (level === "error") notify = vscode.window.showErrorMessage;

  notify(message, ...options).then(res);
}

export function status(message: string, timeout: number, res: () => void) {
  vscode.window.setStatusBarMessage(message, timeout);
  res();
}

export function listCommands(all: boolean, res: (list: string[]) => void) {
  vscode.commands.getCommands(!all).then(res);
}

export function runCommand(command: string, args: any[], res: () => void) {
  vscode.commands.executeCommand(command, ...args).then(() => res());
}

export function input(title: string, placeholder: string, value: string, res: (value?: string) => void) {
  vscode.window.showInputBox({ title, placeHolder: placeholder, value }).then(res);
}

export function pick(
  title: string,
  placeholder: string,
  items: string[],
  multi: boolean,
  res: (selected?: string) => void
) {
  vscode.window.showQuickPick(items, { title, placeHolder: placeholder, canPickMany: multi }).then(res);
}

export function getEditor(res: (editor?: vscode.TextEditor) => void) {
  res(vscode.window.activeTextEditor);
}

export function getVersion(res: (version: string) => void) {
  res(vscode.version);
}

export function getStatus(name: StatusName | null, res: (value: any) => void) {
  if (name) res(statusFetchers[name]());
  else res(Object.fromEntries(Object.entries(statusFetchers).map(([k, v]) => [k, v()])));
}
