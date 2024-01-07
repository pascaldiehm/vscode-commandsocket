# CommandSocket

This extension allows you to trigger VSCode commands programmatically (through scripts or shortcuts) using websockets.

## Features

Every message sent to this extension has to be in JSON format and, if set, encrypted with a password (See [Encryption Details](#encryption-details)).
Every request has to have two keys: `reqID` and `action`.
`reqID` can be _anything_ and will be echoed back as `resID` in the response.
Action hast to be a valid action, otherwise the request is ignored.

| action          | Function                | Request parameters                                                                                       | Response parameters                                                    |
| --------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `alert`         | Display notification    | `message: string`<br/>`level: info\|warn\|error`<br/>`options: string[]`                                 | `selected?: string`                                                    |
| `status`        | Display status bar text | `message: string`<br/>`timeout: number` (ms)                                                             |                                                                        |
| `list-commands` | Fetch list of commands  | `all: boolean`<br/>                                                                                      | `list: string[]`                                                       |
| `run-command`   | Run command             | `command: string`<br/>`arguments: any[]` ([more](https://code.visualstudio.com/api/references/commands)) | `good: boolean`<br/>`response: any`                                    |
| `input`         | Get user input          | `title: string`<br/>`placeholder: string`<br/>`value: string`                                            | `value?: string`                                                       |
| `pick`          | Get user selection      | `title: string`<br/>`placeholder: string`<br/>`items: string[]`<br/>`multi: boolean`                     | `selected: string` (if `!multi`)<br/>`selected: string[]` (if `multi`) |
| `get-editor`    | Get editor information  |                                                                                                          | `editor: vscode.TextEditor`                                            |
| `get-version`   | Get VSCode version      |                                                                                                          | `version: string`                                                      |
| `get-status`    | Get status information  | `name: string`[^1]                                                                                       | `name: string`<br/>`value: any` (based on the requested status)        |

All request parameters are optional and have a default value.
Response parameters marked with a question mark are not included at all, if they don't have a value.

[^1]: Possible names are: `status_debug_active_session`, `status_editor_column_number`, `status_editor_line_number`, `status_editor_document_name`, `status_editor_encoding`, `status_editor_error_count`, `status_editor_language_id`, `status_git_branch`, `status_workspace_name`

## Extension Settings

This extension has two configuration options:

- `commandsocket.port`: The port to use for the WebSocket server.
- `commandsocket.password`: A password to encrypt transactions. Leave this blank to keep the communication unencrypted.

## Encryption details

If a password is [set](#extension-settings), the incoming data is decrypted and the outgoing data is encrypted using that password.
Encryption is handled using the node `crypto` module using `aes-256-gcm`.
The key is generated from the password using a key length of 32 and the salt `commandsocket-salt`.
The encrypted message (in hex format) is then joined with the IV (in hex format) using a pipe symbol (`encrypted-message|IV`).
For more details find the functions `serializeMessage` and `parseMessage` in the extensions source code.

## Use with Bitfocus Companion

This extension is designed to work seamlessly with the module [`companion-module-microsoft-vscode`](https://github.com/bitfocus/companion-module-microsoft-vscode), allowing you to control and interact with Visual Studio Code via Elgato Streamdeck and other controllers. You can use the provided actions to display notifications, run commands, retrieve editor information, and more, enhancing your VS Code workflow.
