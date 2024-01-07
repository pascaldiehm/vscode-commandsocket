import * as vscode from "vscode";
import { startServer, stopServer } from "./server";

export function getConfig<T>(id: string): T | undefined {
  return vscode.workspace.getConfiguration("commandsocket").get(id);
}

export function activate() {
  if (getConfig<boolean>("newCryptoWarning")) {
    vscode.window.showWarningMessage(
      "[Command Socket] In version 1.1.0, the encryption algorithm was changed. If you are using my Bitfocus Companion plugin as well, make sure to upgrade it to the same version (or downgrade this extension to 1.0.x)."
    );
    vscode.workspace.getConfiguration("commandsocket").update("newCryptoWarning", false, true);
  }

  // Start server
  startServer();

  // Listen for configuration changes
  vscode.workspace.onDidChangeConfiguration(event => {
    // Restart server if port changed
    if (event.affectsConfiguration("commandsocket.port")) startServer();
  });
}

export function deactivate() {
  // Stop server
  stopServer();
}
