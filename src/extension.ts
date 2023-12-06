import * as vscode from "vscode";
import { RawData, WebSocketServer } from "ws";
import crypto = require("crypto");

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const SALT = "commandsocket-salt";

let server: WebSocketServer | null = null;

function getConfig<T>(id: string): T | undefined {
    return vscode.workspace.getConfiguration("commandsocket").get(id);
}

function parseMessage(raw: RawData) {
    try {
        // Get password
        const password = getConfig<string>("password");

        // Read data
        let data = raw.toString();

        // Decrypt data if password is set
        if (password) {
            // Split data into encrypted message and IV
            const [encrypted, iv] = data.split("|");

            // Require iv
            if (!iv) return false;

            // Create key and decipher
            const key = crypto.scryptSync(password, SALT, 32);
            const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(iv, "hex"));

            // Decrypt data
            data = decipher.update(encrypted, "hex", "utf8");
        }

        // Parse JSON
        const message = JSON.parse(data);

        // Require keys
        if (!("action" in message)) return undefined;
        if (!("reqID" in message)) return undefined;

        return message;
    } catch (e) {}
}

function serializeMessage(message: any) {
    // Get password
    const password = getConfig<string>("password");

    // Serialize data
    let data = JSON.stringify(message);

    // Encrypt data if password is set
    if (password) {
        // Generate IV
        const iv = crypto.randomBytes(16);

        // Create key and cipher
        const key = crypto.scryptSync(password, SALT, 32);
        const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

        // Encrypt data
        data = [cipher.update(data, "utf8", "hex"), iv.toString("hex")].join("|");
    }

    return data;
}

// Define a function to retrieve status values based on the provided name
function getStatusValue(name: string): any {
    interface StatusTable {
        [name: string]: () => any;
    }

    const statusTable: StatusTable = {
        // Debug
        "status_debug_active_session": () =>
            typeof (vscode.debug.activeDebugSession) !== 'undefined',
        // Editor
        "status_editor_column_number": () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.selection && editor.selection.active) {
                return editor.selection.active.character + 1;
            }
            return 0;
        },
        "status_editor_document_name": () => {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const documentUri = activeEditor.document.uri.toString();
                const documentUriParts = documentUri.split('/');
                const documentName = documentUriParts[documentUriParts.length - 1];
                return documentName || '#no-document-name';
            }
            return '#no-document-name';
        },
        "status_editor_encoding": () => {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const documentUri = activeEditor.document.uri;
                const encoding = vscode.workspace.getConfiguration('files',
                    documentUri).get<string>('encoding');
                return encoding || '#no-editor-encoding';
            }
            return '#no-editor-encoding';
        },
        "status_editor_error_count": () => {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const documentUri = activeEditor?.document.uri;
                const languageId = activeEditor?.document.languageId;
                const diagnostics = vscode.languages.getDiagnostics(documentUri);

                // Filter diagnostics to exclude non Errors
                const filteredDiagnostics = diagnostics.filter(diagnostic => {
                    return diagnostic.severity === vscode.DiagnosticSeverity.Error;
                });

                return filteredDiagnostics.length;
            }
            return 0;
        },
        "status_editor_language_id": () => {
            vscode.window.activeTextEditor?.document.languageId ?? '#no-language-id'
        },
        "status_editor_line_number": () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.selection && editor.selection.active) {
                return editor.selection.active.line + 1;
            }
            return 0;
        },
        // Git extension
        "status_git_branch": () => {
            const gitExtension = vscode.extensions.getExtension("vscode.git");
            if (!gitExtension) {
                return '#no-git-extension';
            }

            const gitAPI = gitExtension.exports.getAPI(1);
            if (!gitAPI) {
                return '#no-git-api';
            }

            const repositories = gitAPI.repositories;

            if (!repositories || repositories.length === 0) {
                return '#no-git-repositories';
            }

            const branchName = repositories[0].state.HEAD?.name;
            return branchName || '';
        },
        // Workspace
        "status_workspace_name": () => {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(
                    activeEditor.document.uri);
                if (workspaceFolder) {
                    return workspaceFolder.name;
                }
            }
            return '#no-workspace';
        },
    };

    // Check if the provided name is in the table
    if (statusTable.hasOwnProperty(name)) {
        const statusFunctionOrProperty = statusTable[name];
        if (typeof statusFunctionOrProperty === "function") {
            // If it's a function, call it and return the result
            return statusFunctionOrProperty();
        }
    }
    // If the provided name is not in the table or the value is not available,
    // return the string '#undefined'
    return '#undefined';
}


function startServer() {
    // Close previous instance of server
    server?.close();

    // Create server
    server = new WebSocketServer({ port: getConfig<number>("port") });

    // Start listening for connections
    server.on("connection", (con) => {
        con.on("message", (data) => {
            // Get message
            const message = parseMessage(data);

            // Create respond helper function
            const res = (data: any) => con.send(serializeMessage({ ...data, resID: message.reqID }));

            // Handle message
            if (message.action == "alert") {
                // Get request
                const level = message.level ?? "info";
                const msg = message.message ?? "";
                const options = message.options ?? [];

                // Get notification function based on level
                let notify = vscode.window.showInformationMessage;
                if (level == "warn") notify = vscode.window.showWarningMessage;
                else if (level == "error") notify = vscode.window.showErrorMessage;

                // Show notification
                notify(msg, ...options).then((selected) => res({ selected }));
            } else if (message.action == "status") {
                // Get request
                const msg = message.message ?? "";
                const timeout = message.timeout ?? 5000;

                // Show status
                vscode.window.setStatusBarMessage(msg, timeout);
            } else if (message.action == "list-commands") {
                // Get request
                const all = message.all ?? false;

                // Fetch response
                vscode.commands.getCommands(!all).then((list) => res({ list }));
            } else if (message.action == "run-command") {
                // Get request
                const command = message.command ?? "noop";
                const args = message.arguments ?? [];

                // Run command
                vscode.commands.executeCommand(command, ...args).then(
                    (response) => res({ good: true, response }),
                    (response) => res({ good: false, response })
                );
            } else if (message.action == "input") {
                // Get request
                const title = message.title ?? "";
                const placeholder = message.placeholder ?? "";
                const value = message.value ?? "";

                // Open input box
                vscode.window.showInputBox({ title, placeHolder: placeholder, value }).then((value) => res({ value }));
            } else if (message.action == "pick") {
                // Get request
                const title = message.title ?? "";
                const placeholder = message.placeholder ?? "";
                const items = message.items ?? [];
                const multi = message.multi ?? false;

                // Open quick pick box
                vscode.window
                    .showQuickPick(items, { title, placeHolder: placeholder, canPickMany: multi })
                    .then((selected) => res({ selected }));
            } else if (message.action == "get-editor") {
                // Return data
                res({ editor: vscode.window.activeTextEditor });
            } else if (message.action == "get-version") {
                // Return version
                res({ version: vscode.version });
            } else if (message.action == "get-status") {
                // Get the name parameter from the message
                const name = message.name;

                // Get the status value based on the provided name
                const statusValue = getStatusValue(name);

                // Respond with the name and status value
                res({ name, value: statusValue });
            }
        });
    });
}

export function activate() {
    // Start server
    startServer();

    // Listen for config changes
    vscode.workspace.onDidChangeConfiguration((e) => {
        // Restart server when port is changed
        if (e.affectsConfiguration("commandsocket.port")) startServer();
    });
}

export function deactivate() {
    // Close server
    server?.close();
}
