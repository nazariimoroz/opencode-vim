import type { Context } from "@opencode/plugin/tui/context"
import type { KeyEvent } from "@opentui/core"
import { inputKey } from "../vim/keys"
import type { VimKeyboard } from "../vim/config"
import { sendNativeKey, vimArrowKeys } from "./native-keys"

const keys: Record<string, [string, string]> = {
  ...vimArrowKeys,
  "<C-[>": ["escape", "\x1b"],
}

export function handleComposerKey(context: Context, event: KeyEvent, keyboard?: VimKeyboard) {
  if (context.keymap.mode.current() !== "composer") return false
  if (context.keymap.pending().length || event.meta || event.option || event.super || event.hyper) return true

  const key = inputKey(event, keyboard)
  const target = key && keys[key]
  if (!target) return true

  event.preventDefault()
  event.stopPropagation()
  sendNativeKey(context, ...target)
  return true
}
