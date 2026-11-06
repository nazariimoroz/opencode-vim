# Configuration

Replace the plugin entry in `cli.json` with an object containing `options.vim`.
This example uses `Q` for session mode and `kj` to leave insert mode:

```json
{
  "plugins": [
    {
      "package": "opencode-vim@latest",
      "options": {
        "vim": {
          "sessionKey": "Q",
          "keymaps": {
            "insert": { "kj": "normal" }
          }
        }
      }
    }
  ]
}
```

## Options

All options below belong inside `options.vim`.

| Option | Default | Purpose |
| --- | --- | --- |
| `defaultMode` | `"insert"` | Vim mode on startup and when switching chats; use `"normal"` to start in normal mode |
| `sessionKey` | `"s"` | Single key to enter and leave session mode |
| `modeIndicator` | `"full"` | Mode label in the prompt footer: `"full"` (`INSERT`, `NORMAL`, ...) or `"none"` to hide it |
| `diffView` | `"after"` | Starting edit/patch view: `"after"`, `"before"`, or `"diff"`; added/deleted files use the available side |
| `keymapTimeout` | `500` | Milliseconds to wait for the rest of a custom mapping |
| `keymaps` | `{}` | Custom mappings, grouped by mode |
| `keyboard.mode` | `"logical"` | `"layout-independent"` resolves commands to US QWERTY; `"logical"` keeps the existing behavior |
| `keyboard.fallback` | `"none"` | Explicit `"uk"` letter-position fallback when usable terminal metadata is missing |
| `cursorStyles` | See below | Cursor appearance for each editing mode |
| `debug` | `false` | Enable debug logging |
| `debugPath` | `~/.cache/opencode/opencode-vim.log` | Debug log file |

### Keyboard layout

To use US QWERTY command positions with a standard Ukrainian layout, add this
inside `options.vim` (in a build containing this feature):

```json
{
  "keyboard": { "mode": "layout-independent", "fallback": "uk" }
}
```

Commands first use the terminal's optional `baseCode` (base-layout Unicode
codepoint, not a hardware scancode). Printable ASCII metadata takes priority over
the fallback and uses US Shift positions, such as `[` → `{` and `1` → `!`.
Caps Lock does not replace Shift in this command path; literal payloads keep
their actual case. Named keys keep their normal handling.
The plugin does not change terminal keyboard negotiation or your OS layout.
Support depends on alternate-key reporting by the host, terminal, and any tmux/SSH
connection; a terminal name alone does not establish support.

The `uk` fallback assumes these standard Ukrainian letter positions:

| Ukrainian | US QWERTY |
| --- | --- |
| `йцукенгшщзхї` | `qwertyuiop[]` |
| `фівапролджє` | `asdfghjkl;'` |
| `ячсмитьбю` | `zxcvbnm,.` |

Uppercase letters use US shifted positions (`Р` → `H`, `Х` → `{`, `Ж` → `:`,
`Є` → `"`, `Б` → `<`, `Ю` → `>`). Unknown letters are not guessed. ASCII
punctuation and digits are unchanged without metadata: legacy `.` cannot tell
US dot-repeat from the Ukrainian key at the US `/` position. Some Ctrl chords
are also ambiguous. This fallback is not full physical-key independence.

Normal/visual commands, command mappings, session/readers, dialog navigation,
question forms, composer navigation, and already-reserved available pane bindings
use the resolver. Insert text and insert mappings remain logical. The character
after `f/F/t/T/r` stays literal, including after an operator; registers, supported
macro registers, and marks use the canonical Latin namespace. Paste, clipboard,
attachments, and unhandled host/child input are not transliterated. Unknown
keyboard option values safely use their defaults; the feature is off by default.

### Session key

Use one character, such as `"Q"`, or key notation such as `"<C-s>"`. The key changes
both entry and exit, including the footer hints. Invalid or multi-key values fall
back to `"s"`.

A custom normal-mode mapping beginning with the same key takes precedence over
entering session mode.

### Custom keymaps

Mappings apply to `insert`, `normal`, `visual`, and `visual-line` editing modes in
the prompt and search dialogs. Insert-mode mappings also apply while typing a
question answer. Use `keymaps.session` for transcript browsing and its
message/tool modals, and `keymaps.panes` for shared prompt/terminal controls.

See [Custom Keymaps](./keymap-actions.md) for actions, key notation, and examples.
See [Keybindings and Modes](./vim-behavior.md) for the default behavior.

### Pane controls

`keymaps.panes` uses the same `command:<id>` actions as editing mappings. It works
in the prompt, transcript browsing, and live terminal input, but not in dialogs,
question forms, or the composer picker. Active pane mappings take precedence over
editing mappings; unavailable commands leave the key alone.

These defaults are active even when `panes` is omitted:

| Key | Action |
| --- | --- |
| `<C-/>` | `command:opencode-vim.terminal.toggle` |
| `<M-h>` | `command:pane.focus.left` |
| `<M-l>` | `command:pane.focus.right` |

Add this inside `options.vim` to replace them with Alt+t and Alt+a/d:

```json
{
  "keymaps": {
    "panes": {
      "<C-/>": "passthrough",
      "<M-h>": "passthrough",
      "<M-l>": "passthrough",
      "<M-t>": "command:opencode-vim.terminal.toggle",
      "<M-a>": "command:pane.focus.left",
      "<M-d>": "command:pane.focus.right"
    }
  }
}
```

Omitted defaults stay active. `passthrough` disables a pane mapping and releases
that key to Vim editing or the child application. The footer follows the mappings.
`<C-_>` and `<C-/>` refer to the same terminal chord; disabling or remapping either
also changes the legacy alias.

Pane mappings require one key or chord, not sequences like `<C-w>h`, so shell
typing is never buffered. They accept `command:<id>` or `passthrough`, and support
Alt (`<M-h>`) and Ctrl punctuation (`<C-/>`) in addition to ordinary keys. The
named terminal toggle is also usable from existing normal-mode command mappings.
It remains available only in prompt normal mode, transcript browsing, or live
terminal input; pane focus commands also work in prompt insert mode.

### Cursor styles

Insert mode defaults to a blinking line cursor. Normal, visual, and visual-line
modes default to a blinking block. Supported styles are `block`, `line`,
`underline`, and `default`. Omitted values keep their defaults.

For example, add this inside `options.vim` to disable cursor blinking:

```json
{
  "cursorStyles": {
    "insert": { "style": "line", "blinking": false },
    "normal": { "style": "block", "blinking": false }
  }
}
```

### Debugging

Set `"debug": true` or launch OpenCode with `VIM_PROMPT_DEBUG=1`. Invalid mappings
are skipped and recorded in the log. A custom `debugPath` should be absolute;
`~` is not expanded in configured paths.

`keymapTimeout` controls partially typed custom mappings. If an insert-mode
mapping times out, its pending characters are inserted as ordinary text. Pending
keys are not shown in the footer.
