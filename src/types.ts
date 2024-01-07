import { StatusName } from "./api";

export type AlertLevel = "info" | "warn" | "error";

export type Request = {
  reqID: any;
} & (
  | { action: "alert"; message?: string; level?: AlertLevel; options?: string[] }
  | { action: "status"; message?: string; timeout?: number }
  | { action: "list-commands"; all?: boolean }
  | { action: "run-command"; command?: string; args?: any[] }
  | { action: "input"; title?: string; placeholder?: string; value?: string }
  | { action: "pick"; title?: string; placeholder?: string; items?: string[]; multi?: boolean }
  | { action: "get-editor" }
  | { action: "get-version" }
  | { action: "get-status"; name?: StatusName }
);
