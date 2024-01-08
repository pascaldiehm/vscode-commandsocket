import * as vscode from "vscode";
import { WebSocket, WebSocketServer } from "ws";
import { alert, getEditor, getStatus, getVersion, input, listCommands, pick, runCommand, status } from "./api";
import { decrypt, encrypt } from "./crypto";
import { getConfig } from "./extension";
import { Request } from "./types";

let server: WebSocketServer | null = null;

export function startServer() {
  // Close existing server
  if (server) server.close();

  // Start new server
  server = new WebSocketServer({
    port: getConfig<number>("port") ?? 6783,
    host: getConfig<string>("host") ?? "0.0.0.0",
  });

  // Listen for connections
  server.on("connection", con => {
    con.on("message", data => {
      const request = parseRequest(data.toString());
      if (request) handleRequest(con, request);
    });
  });
}

export function stopServer() {
  server?.close();
}

function parseRequest(data: string): Request | null {
  const password = getConfig<string>("password");
  if (password) data = decrypt(data, password);

  let message: Request | null = null;
  try {
    message = JSON.parse(data);
  } catch (e) {}

  if (!message) return null;
  if (!("reqID" in message)) return null;
  if (!("action" in message)) return null;

  return message;
}

function serializeResponse(resID: any, data: Object): string {
  const message = { ...data, resID };
  const password = getConfig<string>("password");

  if (password) return encrypt(JSON.stringify(message), password);
  return JSON.stringify(message);
}

function handleRequest(con: WebSocket, request: Request) {
  const res = (data: Object) => con.send(serializeResponse(request.reqID, data));

  if (request.action == "alert") {
    const { message, level, options } = request;
    alert(message ?? "", level ?? "info", options ?? [], (selected?: string) => res({ selected }));
  } else if (request.action == "status") {
    const { message, timeout } = request;
    status(message ?? "", timeout ?? 5000, () => res({}));
  } else if (request.action == "list-commands") {
    const { all } = request;
    listCommands(all ?? false, (list: string[]) => res({ list }));
  } else if (request.action == "run-command") {
    const { command, args } = request;
    runCommand(command ?? "noop", args ?? [], () => res({}));
  } else if (request.action == "input") {
    const { title, placeholder, value } = request;
    input(title ?? "", placeholder ?? "", value ?? "", (value?: string) => res({ value }));
  } else if (request.action == "pick") {
    const { title, placeholder, items, multi } = request;
    pick(title ?? "", placeholder ?? "", items ?? [], multi ?? false, (selected?: string) => res({ selected }));
  } else if (request.action == "get-editor") {
    getEditor((editor?: vscode.TextEditor) => res({ editor }));
  } else if (request.action == "get-version") {
    getVersion((version: string) => res({ version }));
  } else if (request.action == "get-status") {
    const { name } = request;
    getStatus(name ?? null, (value: any) => res({ name, value }));
  }
}
