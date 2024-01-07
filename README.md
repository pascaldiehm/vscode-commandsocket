# CommandSocket

This extension allows you to trigger VSCode commands programmatically (through scripts or shortcuts) using WebSockets.

## Features

Every message sent to this extension has to be in JSON format and, if set, encrypted with a password (See [Encryption Details](#encryption-details)).
Every request has to contain at least two keys: `reqID` and `action`.
`reqID` can be anything and will be echoed back as `resID` in the response.
`action` has to be a valid action identifier (see below).
Invalid requests are ignored.

| Action          | Function                                  | Parameters                                                                        | Response                                                                                                                   |
| --------------- | ----------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `alert`         | Display a notification                    | `message: string`<br>`level: info\|warn\|error`<br>`options: string[]`            | `selected: string`                                                                                                         |
| `status`        | Display text in the status bar            | `message: string`<br>`timeout: number`                                            |                                                                                                                            |
| `list-commands` | Fetch a list of commands                  | `all: boolean`                                                                    | `list: string[]`                                                                                                           |
| `run-command`   | Run a command                             | `command: string`<br>`args: any[]`                                                |                                                                                                                            |
| `input`         | Display an input box                      | `title: string`<br>`placeholder: string`<br>`value: string`                       | `value: string`                                                                                                            |
| `pick`          | Display a select box                      | `title: string`<br>`placeholder: string`<br>`items: string[]`<br>`multi: boolean` | `selected: string[]` if multi<br>`selected: string` otherwise                                                              |
| `get-editor`    | Get information about the current editor. |                                                                                   | `editor: vscode.TextEditor`                                                                                                |
| `get-version`   | Get VSCode version                        |                                                                                   | `version: string`                                                                                                          |
| `get-status`    | Get status information                    | `name: string`[^1]                                                                | `name: string`<br>`value: any` (based on the requested status)<br>`value: { [key: string]: any }` (if no name is supplied) |

All request parameters are optional and have default values.
Undefined response parameters may not be included in the response.

[^1]: Possible names are: `status_debug_active_session`, `status_editor_column_number`, `status_editor_line_number`, `status_editor_document_name`, `status_editor_encoding`, `status_editor_error_count`, `status_editor_language_id`, `status_git_branch`, `status_workspace_name`

## Extension Settings

- `commandsocket.port`: The port to use for the WebSocket server.
- `commandsocket.password`: A password to encrypt transactions. Leave this blank to keep the communication unencrypted.

## Encryption details

If a password is set, the incoming data is decrypted and the outgoing data is encrypted using that password.
Encryption is handled by a scrambled xor cipher (see [crypto.ts](src/crypto.ts) for details).

## Use with Bitfocus Companion

This extension is designed to work seamlessly with the module [companion-module-microsoft-vscode](https://github.com/bitfocus/companion-module-microsoft-vscode), allowing you to control and interact with Visual Studio Code vie Elgato Streamdeck and other controllers.
You can use the provided actions to display notifications, run commands, retrieve editor information, and more, enhancing your VS Code workflow.
