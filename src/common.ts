import * as vscode from "vscode";
import { WebSocket } from "ws";
import { getConfig } from "./extension";
import { Request, Response, State, decrypt, encrypt } from "./global";

export function parseRequest(request: string): Request | null {
  const password = getConfig<string>("password");
  if (password) request = decrypt(request, password);

  try {
    const parsed = JSON.parse(request);
    if (!("id" in parsed && "type" in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function serialize(obj: Request | Response | State): string {
  let serialized = JSON.stringify(obj);
  const password = getConfig<string>("password");
  if (password) serialized = encrypt(serialized, password);
  return serialized;
}

export async function handleRequest(request: Request): Promise<Response> {
  switch (request.type) {
    case "alert": {
      let func = vscode.window.showInformationMessage;
      if (request.level === "warn") func = vscode.window.showWarningMessage;
      else if (request.level === "error") func = vscode.window.showErrorMessage;

      const result = await func(request.message ?? "", ...(request.options ?? []));
      if (result === undefined) return { id: request.id, type: "ok" };
      return { id: request.id, type: "string", value: result };
    }

    case "status": {
      vscode.window.setStatusBarMessage(request.message, request.timeout ?? 10000);
      return { id: request.id, type: "ok" };
    }

    case "input": {
      const result = await vscode.window.showInputBox({
        title: request.title,
        placeHolder: request.placeholder,
        value: request.value,
        password: request.password,
      });

      if (result === undefined) return { id: request.id, type: "error", message: "User cancelled input" };
      return { id: request.id, type: "string", value: result };
    }

    case "pick": {
      const result = await vscode.window.showQuickPick(request.options, {
        title: request.title,
        placeHolder: request.placeholder,
        canPickMany: request.multi,
      });

      if (result === undefined) return { id: request.id, type: "error", message: "User cancelled pick" };
      if (request.multi) return { id: request.id, type: "strings", value: result as unknown as string[] };
      return { id: request.id, type: "string", value: result };
    }

    case "command": {
      await vscode.commands.executeCommand(request.command ?? "noop", ...(request.args ?? []));
      return { id: request.id, type: "ok" };
    }

    case "debug-start": {
      const folders = vscode.workspace.workspaceFolders;
      const folder = request.folder ? folders?.find(f => f.uri.fsPath === request.folder) : folders?.[0];
      if (!folder) return { id: request.id, type: "error", message: "Folder not found" };

      const result = await vscode.debug.startDebugging(folder, request.name);
      if (result) return { id: request.id, type: "ok" };
      return { id: request.id, type: "error", message: "Failed to start debug session" };
    }

    case "debug-stop": {
      await vscode.debug.stopDebugging();
      return { id: request.id, type: "ok" };
    }

    case "activate": {
      const extension = vscode.extensions.getExtension(request.extension);
      if (!extension) return { id: request.id, type: "error", message: "Extension not found" };

      await extension.activate();
      return { id: request.id, type: "ok" };
    }
  }
}

export async function getState(type: State["type"]): Promise<State> {
  switch (type) {
    case "version":
      return { type, version: vscode.version };

    case "focus":
      return { type, focus: vscode.window.state.focused };

    case "commands":
      return { type, commands: await vscode.commands.getCommands(true) };

    case "debug":
      return {
        type,
        debug: !!vscode.debug.activeDebugSession,
        name: vscode.debug.activeDebugSession?.name ?? null,
        breakpoints: vscode.debug.breakpoints.length,
      };

    case "environment":
      return {
        type,
        host: vscode.env.appHost,
        name: vscode.env.appName,
        language: vscode.env.language,
        remote: vscode.env.remoteName ?? null,
        shell: vscode.env.shell,
      };

    case "extensions":
      return {
        type,
        extensions: vscode.extensions.all.map(e => e.id),
        active: vscode.extensions.all.filter(e => e.isActive).map(e => e.id),
      };

    case "workspace":
      return {
        type,
        trusted: vscode.workspace.isTrusted,
        name: vscode.workspace.name ?? null,
        folders: vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) ?? null,
      };

    case "git": {
      const extension = vscode.extensions.getExtension("vscode.git");
      const state = extension?.exports.getAPI(1)?.repositories[0]?.state;

      return {
        type,
        branch: state?.HEAD?.name ?? null,
        commit: state?.HEAD?.commit ?? null,
        ahead: state?.HEAD?.ahead ?? null,
        behind: state?.HEAD?.behind ?? null,
        remote: state?.remotes[0]?.name ?? null,
        url: state?.remotes[0]?.fetchUrl ?? null,
        changes: state?.workingTreeChanges.length ?? null,
      };
    }

    case "editor": {
      const editor = vscode.window.activeTextEditor;
      const getEncoding = (uri: vscode.Uri) => vscode.workspace.getConfiguration("files", uri).get<string>("encoding");
      const getDiagnostics = (editor: vscode.TextEditor) => vscode.languages.getDiagnostics(editor.document.uri);
      const filterWarning = (diag: vscode.Diagnostic) => diag.severity === vscode.DiagnosticSeverity.Warning;
      const filterError = (diag: vscode.Diagnostic) => diag.severity === vscode.DiagnosticSeverity.Error;

      return {
        type,
        name: editor?.document.fileName.split("/").pop() ?? null,
        path: editor?.document.uri.fsPath ?? null,
        language: editor?.document.languageId ?? null,
        encoding: editor ? getEncoding(editor.document.uri) ?? null : null,
        eol: editor ? (editor.document.eol === vscode.EndOfLine.CRLF ? "CRLF" : "LF") : null,
        indent: typeof editor?.options.tabSize === "number" ? editor.options.tabSize : null,
        tabs: !editor?.options.insertSpaces ?? null,
        dirty: editor?.document.isDirty ?? null,
        column: editor ? editor.selection.active.character + 1 : null,
        line: editor ? editor.selection.active.line + 1 : null,
        lines: editor?.document.lineCount ?? null,
        warnings: editor ? getDiagnostics(editor).filter(filterWarning).length : null,
        errors: editor ? getDiagnostics(editor).filter(filterError).length : null,
      };
    }
  }
}

export async function sendInitialState(socket: WebSocket) {
  socket.send(serialize(await getState("version")));
  socket.send(serialize(await getState("focus")));
  socket.send(serialize(await getState("commands")));
  socket.send(serialize(await getState("debug")));
  socket.send(serialize(await getState("environment")));
  socket.send(serialize(await getState("extensions")));
  socket.send(serialize(await getState("workspace")));
  setTimeout(async () => socket.send(serialize(await getState("git"))), 1000);
  socket.send(serialize(await getState("editor")));
}
