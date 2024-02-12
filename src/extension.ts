import * as vscode from "vscode";
import { Client } from "./client";
import { getState } from "./common";
import { State } from "./global";
import { Server } from "./server";

let manualUpdateInterval: NodeJS.Timeout | null = null;
const prevState: { [key in State["type"]]?: string } = { commands: "", editor: "", git: "", extensions: "" };

export function getConfig<T>(id: string): T | undefined {
  return vscode.workspace.getConfiguration("commandsocket").get<T>(id);
}

function iface(): typeof Server {
  return getConfig<string>("role") === "server" ? Server : Client;
}

function start() {
  iface().start();

  if (manualUpdateInterval) clearInterval(manualUpdateInterval);
  manualUpdateInterval = setInterval(async () => {
    if (!iface().live()) return;

    for (const k in prevState) {
      const key = k as keyof typeof prevState;
      const state = JSON.stringify(await getState(key));
      if (state !== prevState[key]) {
        prevState[key] = state;
        iface().update(key);
      }
    }
  }, getConfig<number>("timeoutManualUpdate") ?? 1000);
}

export function activate() {
  if (getConfig<boolean>("newCryptoWarning")) {
    vscode.window.showWarningMessage(
      "[Command Socket] In version 1.1.0, the encryption algorithm was changed. If you are using my Bitfocus Companion plugin as well, make sure to upgrade it to the same version (or downgrade this extension to 1.0.x)."
    );
    vscode.workspace.getConfiguration("commandsocket").update("newCryptoWarning", false, true);
  }

  vscode.workspace.onDidChangeConfiguration(e => {
    if (!e.affectsConfiguration("commandsocket")) return;

    Server.stop();
    Client.stop();
    iface().start();
  });

  vscode.window.onDidChangeWindowState(() => iface().update("focus"));
  vscode.debug.onDidChangeActiveDebugSession(() => iface().update("debug"));
  vscode.debug.onDidChangeBreakpoints(() => iface().update("debug"));
  vscode.env.onDidChangeShell(() => iface().update("environment"));
  vscode.workspace.onDidChangeWorkspaceFolders(() => iface().update("workspace"));
  vscode.workspace.onDidGrantWorkspaceTrust(() => iface().update("workspace"));

  start();
}

export function deactivate() {
  iface().stop();
  if (manualUpdateInterval) clearInterval(manualUpdateInterval);
}
