export type Request = { id: any } & (
  | { type: "alert"; message: string; level?: "info" | "warn" | "error"; options?: string[] }
  | { type: "status"; message: string; timeout?: number }
  | { type: "input"; title: string; placeholder?: string; value?: string; password?: boolean }
  | { type: "pick"; title: string; options: string[]; placeholder?: string; multi?: boolean }
  | { type: "command"; command: string; args?: any[] }
  | { type: "debug-start"; name: string; folder?: string }
  | { type: "debug-stop" }
  | { type: "activate"; extension: string }
);

export type Response = { id: any } & (
  | { type: "ok" }
  | { type: "error"; message: string }
  | { type: "string"; value: string }
  | { type: "strings"; value: string[] }
);

export type State =
  | { type: "version"; version: string }
  | { type: "focus"; focus: boolean }
  | { type: "commands"; commands: string[] }
  | { type: "debug"; debug: boolean; name: string | null; breakpoints: number }
  | { type: "environment"; host: string; name: string; language: string; remote: string | null; shell: string }
  | { type: "extensions"; extensions: string[]; active: string[] }
  | { type: "workspace"; trusted: boolean; name: string | null; folders: string[] | null }
  | {
      type: "git";
      branch: string | null;
      commit: string | null;
      ahead: number | null;
      behind: number | null;
      remote: string | null;
      url: string | null;
      changes: number | null;
    }
  | {
      type: "editor";
      name: string | null;
      path: string | null;
      language: string | null;
      encoding: string | null;
      eol: string | null;
      indent: number | null;
      tabs: boolean | null;
      dirty: boolean | null;
      column: number | null;
      line: number | null;
      lines: number | null;
      warnings: number | null;
      errors: number | null;
    };

export function encrypt(data: string, password: string): string {
  let encrypted = "";
  let li = 0;
  let ri = data.length - 1;
  let si = 0;
  let sc = (password.charCodeAt(0) & 15) + 1;
  let ei = 0;

  while (li <= ri) {
    let chr = 0;

    if (sc === 0) {
      si = (si + 1) % password.length;
      sc = (password.charCodeAt(si) & 15) + 1;
    }

    if (si & 1) chr = data.charCodeAt(ri--);
    else chr = data.charCodeAt(li++);
    sc--;

    chr ^= password.charCodeAt(ei++);
    if (ei >= password.length) ei = 0;

    encrypted += String.fromCharCode(chr);
  }

  return encrypted;
}

export function decrypt(data: string, password: string): string {
  let decrypted = new Array(data.length);
  let li = 0;
  let ri = data.length - 1;
  let si = 0;
  let sc = (password.charCodeAt(0) & 15) + 1;
  let ei = 0;

  for (let i = 0; i < data.length; i++) {
    let chr = data.charCodeAt(i);

    chr ^= password.charCodeAt(ei++);
    if (ei >= password.length) ei = 0;

    if (sc === 0) {
      si = (si + 1) % password.length;
      sc = (password.charCodeAt(si) & 15) + 1;
    }

    if (si & 1) decrypted[ri--] = String.fromCharCode(chr);
    else decrypted[li++] = String.fromCharCode(chr);
    sc--;
  }

  return decrypted.join("");
}
