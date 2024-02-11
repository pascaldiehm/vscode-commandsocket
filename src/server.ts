import { WebSocketServer } from "ws";
import { __legacy_handle_request } from "./__legacy_server";
import { getState, handleRequest, parseRequest, sendInitialState, serialize } from "./common";
import { getConfig } from "./extension";
import { State } from "./global";

let server: WebSocketServer | null = null;

export namespace Server {
  export function start() {
    stop();
    let host = getConfig<string>("host");
    if (host === "") host = undefined;
    server = new WebSocketServer({
      port: getConfig<number>("port") ?? 6783,
      host,
      clientTracking: true,
    });

    server.on("connection", async con => {
      sendInitialState(con);

      con.on("message", async msg => {
        const legacyResponse = await __legacy_handle_request(msg.toString());
        if (legacyResponse) {
          con.send(serialize(legacyResponse as any));
          return;
        }

        const request = parseRequest(msg.toString());
        if (!request) {
          con.send(serialize({ id: null, type: "error", message: "Invalid request: " + msg.toString() }));
          return;
        }

        const response = await handleRequest(request);
        con.send(serialize(response));
      });
    });
  }

  export function stop() {
    server?.close();
    server = null;
  }

  export async function update(type: State["type"]) {
    const update = serialize(await getState(type));
    server?.clients.forEach(client => client.send(update));
  }

  export function live(): boolean {
    return (server?.clients.size ?? 0) > 0;
  }
}
