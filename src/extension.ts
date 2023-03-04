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
