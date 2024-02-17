import * as vscode from "vscode";
import { handleRequest } from "./common";
import { getConfig } from "./extension";
import { decrypt } from "./global";

const statusFetchers = {
  // Debug
  status_debug_active_session: () => typeof vscode.debug.activeDebugSession !== "undefined",

  // Editor
  status_editor_column_number: () => (vscode.window.activeTextEditor?.selection.active.character ?? -2) + 1,
  status_editor_line_number: () => (vscode.window.activeTextEditor?.selection.active.line ?? -2) + 1,
  status_editor_document_name: () =>
    vscode.window.activeTextEditor?.document.fileName.split("/").pop() ?? "#no-document-name",
  status_editor_encoding: () => {
    const uri = vscode.window.activeTextEditor?.document.uri;
    if (!uri) return "#no-editor-encoding";
    return vscode.workspace.getConfiguration("files", uri).get<string>("encoding") ?? "#no-editor-encoding";
  },
  status_editor_error_count: () => {
    const uri = vscode.window.activeTextEditor?.document.uri;
    if (!uri) return 0;
    return vscode.languages.getDiagnostics(uri).filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
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

export async function __legacy_handle_request(data: string): Promise<object | null> {
  try {
    const password = getConfig<string>("password");
    if (password) data = decrypt(data, password);

    let request;
    try {
      request = JSON.parse(data);
    } catch {
      return null;
    }

    if (!("reqID" in request && "action" in request)) return null;
    const action = request.action;

    if (getConfig<boolean>("legacyInterfaceWarning")) {
      vscode.window.showWarningMessage(
        "[Command Socket] You just received a request using the legacy interface (pre 2.0.0). Please update your client to the latest version, the legacy interface will be removed in version 2.1.0."
      );
      vscode.workspace.getConfiguration("commandsocket").update("legacyInterfaceWarning", false, true);
    }

    switch (action) {
      case "alert": {
        const response = await handleRequest({
          id: request.reqID,
          type: "alert",
          message: request.message,
          level: request.level,
          options: request.options,
        });

        if (response.type === "string") return { resID: request.reqID, selected: response.value };
        return { resID: request.reqID };
      }

      case "status": {
        await handleRequest({
          id: request.reqID,
          type: "status",
          message: request.message,
          timeout: request.timeout,
        });

        return { resID: request.reqID };
      }

      case "list-commands": {
        const result = await vscode.commands.getCommands(request.all ?? false);
        return { resID: request.reqID, list: result };
      }

      case "run-command": {
        await handleRequest({
          id: request.reqID,
          type: "command",
          command: request.command,
          args: request.args,
        });

        return { resID: request.reqID };
      }

      case "input": {
        const response = await handleRequest({
          id: request.reqID,
          type: "input",
          title: request.title,
          placeholder: request.placeholder,
          value: request.value,
        });

        if (response.type === "string") return { resID: request.reqID, value: response.value };
        return { resID: request.reqID };
      }

      case "pick": {
        const response = await handleRequest({
          id: request.reqID,
          type: "pick",
          title: request.title,
          placeholder: request.placeholder,
          options: request.items,
          multi: request.multi,
        });

        if (response.type === "string") return { resID: request.reqID, selected: response.value };
        if (response.type === "strings") return { resID: request.reqID, selected: response.value };
        return { resID: request.reqID };
      }

      case "get-editor":
        return { resID: request.reqID, editor: vscode.window.activeTextEditor };

      case "get-version":
        return { resID: request.reqID, version: vscode.version };

      case "get-status": {
        if ("name" in request)
          return {
            resID: request.reqID,
            name: request.name,
            value: statusFetchers[request.name as keyof typeof statusFetchers](),
          };

        return {
          resID: request.reqID,
          value: Object.fromEntries(Object.entries(statusFetchers).map(([k, v]) => [k, v()])),
        };
      }

      default:
        break;
    }
  } catch {}

  return null;
}
