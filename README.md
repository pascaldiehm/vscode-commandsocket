# CommandSocket

The CommandSocket extension allows you to receive updates about the state of your VSCode editor and trigger commands, alerts and the like from an external application or script using a simple WebSocket API.

## Features

The extension can act as a server, listening for incoming WebSocket connections, and as a client, connecting to a remote WebSocket server (see `commandsocket.role` in [settings](#settings)). Every message sent to and from this extension is a JSON object [encrypted](#encryption-details) with a password, if set.

### Requests

Each request has to specify an `id` (echoed back in the response) and a `type` (see the table below).

| Type          | Description                    | Parameters                                                                            | Responses                                                                                                                                               |
| ------------- | ------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alert`       | Display a message box          | `message: string`<br>`level?: {info,warn,error}`<br>`options?: string[]`              | `ok` - The message box was dismissed<br>`string` - An option was selected                                                                               |
| `status`      | Display a status message       | `message: string`<br>`timeout?: number`                                               | `ok`                                                                                                                                                    |
| `input`       | Display an input box           | `title: string`<br>`placeholder?: string`<br>`value?: string`<br>`password?: boolean` | `string` - An input has been received<br>`error` - The input was cancelled                                                                              |
| `pick`        | Display a quick pick           | `title: string`<br>`options: string[]`<br>`placeholder?: string`<br>`multi?: boolean` | `string` - An option was selected (`multi` is falsy)<br>`strings` - Options were selected (`multi` is truthy)<br>`error` - The quick pick was cancelled |
| `command`     | Run a command                  | `command: string`<br>`args?: any[]`                                                   | `ok`                                                                                                                                                    |
| `debug-start` | Start a debugging target       | `name: string`<br>`folder?: string`                                                   | `ok` - The debugging target was started<br>`error` - The debugging target could not be started                                                          |
| `debug-stop`  | Stop debugging                 |                                                                                       | `ok` - The debugging target was stopped                                                                                                                 |
| `activate`    | Manually activate an extension | `extension: string`                                                                   | `ok` - The extension was activated<br>`error` - The extension could not be activated                                                                    |

### Responses

Each response contains an `id` (echoed back from the request) and a `type` (see the table below). Responses are only sent in response to a request. When responding to an invalid request, `null` is used as the `id`.

| Type      | Description                          | Parameters         |
| --------- | ------------------------------------ | ------------------ |
| `ok`      | Request successful                   |                    |
| `error`   | Request failed                       | `message: string`  |
| `string`  | Request returned a string            | `value: string`    |
| `strings` | Request returned an array of strings | `values: string[]` |

### State updates

Each state update contains a `type` (see the table below). State updates are sent whenever the state of the editor changes. Parameters marked optional are always included but may be `null`.

| Type          | Description                      | Parameters                                                                                                                                                                                                                                                              |
| ------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`     | Version of the editor            | `version: string`                                                                                                                                                                                                                                                       |
| `focus`       | Focus state of the editor window | `focus: boolean`                                                                                                                                                                                                                                                        |
| `commands`    | List of available commands       | `commands: string[]`                                                                                                                                                                                                                                                    |
| `debug`       | State of the debugger            | `debug: boolean`<br>`name?: string`<br>`breakpoints: number`                                                                                                                                                                                                            |
| `environment` | Environment of the editor        | `host: string`<br>`name: string`<br>`language: string`<br>`remote?: string`<br>`shell: string`                                                                                                                                                                          |
| `extensions`  | List of installed extensions     | `extensions: string[]`<br>`active: string[]`                                                                                                                                                                                                                            |
| `workspace`   | Workspace information            | `trusted: boolean`<br>`name?: string`<br>`folders?: string[]`                                                                                                                                                                                                           |
| `git`         | Git information                  | `branch?: string`<br>`commit?: string`<br>`ahead?: number`<br>`behind?: number`<br>`remote?: string`<br>`url?: string`<br>`changes?: number`                                                                                                                            |
| `editor`      | Editor information               | `name?: string`<br>`path?: string`<br>`language?: string`<br>`encoding?: string`<br>`eol?: string`<br>`indent?: number`<br>`tabs?: number`<br>`dirty?: boolean`<br>`column?: number`<br>`line?: number`<br>`lines?: number`<br>`warnings?: number`<br>`errors?: number` |

## Settings

| Name                                   | Description                                                  | Default  |
| -------------------------------------- | ------------------------------------------------------------ | -------- |
| `commandsocket.role`                   | Role of the extension (`server` or `client`)                 | `client` |
| `commandsocket.host`                   | Bind address or remote address                               | _empty_  |
| `commandsocket.port`                   | Bind port or remote port                                     | `6783`   |
| `commandsocket.password`               | Password for [encryption](#encryption-details)               | _empty_  |
| `commandsocket.timeoutReconnect`       | Client reconnection timeout (ms)                             | `5000`   |
| `commandsocket.timeoutManualUpdate`    | Frequency of manual state update detection (ms)              | `1000`   |
| `commandsocket.newCryptoWarning`       | Temporary setting, show warning about new encryption method  | `true`   |
| `commandsocket.legacyInterfaceWarning` | Temporary setting, show warning about legacy interface usage | `true`   |

## Encryption details

If a password is set, all incoming data is decrypted and all outgoing data is encrypted using that password. Encryption is handled by a combination of scrambling and XORing the data with the password, see [global.ts](src/global.ts) (`encrypt` and `decrypt` functions) for details.

## Use with Bitfocus Companion

This extension is designed to work seamlessly with the module [companion-module-microsoft-vscode](https://github.com/bitfocus/companion-module-microsoft-vscode), allowing you to control and interact with Visual Studio Code vie Elgato Streamdeck and other controllers. You can use the provided actions to display notifications, run commands, retrieve editor information, and more, enhancing your VS Code workflow.
