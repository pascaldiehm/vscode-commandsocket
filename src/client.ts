import { WebSocket } from "ws";
import { getState, handleRequest, parseRequest, sendInitialState, serialize } from "./common";
import { getConfig } from "./extension";
import { State } from "./global";

let client: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;

export namespace Client {
  export function start() {
    stop();
    let host = getConfig<string>("host");
    if (host === undefined || host === "") host = "127.0.0.1";
    client = new WebSocket(`ws://${host}:${getConfig<number>("port") ?? 6783}`);

    client.on("open", async () => client && sendInitialState(client));

    client.on("message", async msg => {
      const request = parseRequest(msg.toString());
      if (!request) {
        client?.send(serialize({ id: null, type: "error", message: "Invalid request: " + msg.toString() }));
        return;
      }

      const response = await handleRequest(request);
      client?.send(serialize(response));
    });

    function connectionLost() {
      client = null;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(start, getConfig<number>("timeoutReconnect"));
    }

    client.on("error", connectionLost);
    client.on("close", connectionLost);
  }

  export function stop() {
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    reconnectTimeout = null;

    client?.removeAllListeners();
    client?.close();
    client = null;
  }

  export async function update(type: State["type"]) {
    const update = serialize(await getState(type));
    client?.send(update);
  }

  export function live(): boolean {
    return client !== null;
  }
}
