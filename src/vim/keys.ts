import type { KeyEvent } from "@opentui/core"
import type { VimKeyboard } from "./config"

export type InputIntent = "command" | "literal"

const SHIFT_BASE = "`1234567890-=[]\\;',./"
const SHIFT_KEYS = '~!@#$%^&*()_+{}|:"<>?'
const UK = new Map<string, string>()
for (const [letters, positions] of [
  ["йцукенгшщзхї", "qwertyuiop[]"],
  ["фівапролджє", "asdfghjkl;'"],
  ["ячсмитьбю", "zxcvbnm,."],
] as const) {
  Array.from(letters).forEach((letter, index) => {
    const key = positions![index]!
    UK.set(letter, key)
    UK.set(letter.toUpperCase(), usShift(key))
  })
}

function usShift(key: string) {
  const index = SHIFT_BASE.indexOf(key)
  return index < 0 ? key.toUpperCase() : SHIFT_KEYS[index]!
}

// baseCode is an optional base-layout Unicode codepoint, never a scancode.
// Keep this structural so hosts without alternate-key reporting remain supported.
export function resolveKey(event: KeyEvent, keyboard?: VimKeyboard) {
  const notation = keyNotation(event)
  // Preserve actual text case (including Caps Lock) in payloads. Some parsers
  // lowercase name and report Shift separately, so retain that legacy signal.
  const literal =
    keyboard?.mode === "layout-independent" &&
    !event.ctrl &&
    !event.meta &&
    !event.option &&
    !event.super &&
    !event.hyper &&
    event.name &&
    [...graphemes.segment(event.name)].length === 1
      ? event.shift
        ? event.name.toUpperCase()
        : event.name
      : notation
  const logical = { literal, command: notation, source: "logical" as const }
  if (keyboard?.mode !== "layout-independent" || event.super || event.hyper) return logical
  const name = event.name
  // Named keys, composed text and control input are not physical command keys.
  if (!name || Array.from(name).length !== 1 || /\p{C}/u.test(name)) return logical
  const base = (event as KeyEvent & { baseCode?: number }).baseCode
  let key: string | undefined
  let source: "baseCode" | "uk"
  if (typeof base === "number" && Number.isInteger(base) && base >= 32 && base <= 126) {
    key = String.fromCodePoint(base).toLowerCase()
    if (event.shift) key = usShift(key)
    source = "baseCode"
  } else {
    key = keyboard.fallback === "uk" ? UK.get(event.shift ? name.toUpperCase() : name) : undefined
    source = "uk"
  }
  if (!key) return logical
  const modified = key === " " ? "space" : key.toLowerCase()
  const command = event.ctrl
    ? `<C-${modified}>`
    : event.meta || event.option
      ? `<M-${modified}>`
      : key === " "
        ? "<Space>"
        : key
  return { literal, command, source }
}

export function inputKey(event: KeyEvent, keyboard?: VimKeyboard, intent: InputIntent = "command") {
  const resolved = resolveKey(event, keyboard)
  return intent === "literal" ? resolved.literal : resolved.command
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" })

const NAMED_KEYS: Record<string, string> = {
  escape: "<Esc>",
  esc: "<Esc>",
  return: "<CR>",
  enter: "<CR>",
  tab: "<Tab>",
  backspace: "<BS>",
  delete: "<Del>",
  space: "<Space>",
  up: "<Up>",
  down: "<Down>",
  left: "<Left>",
  right: "<Right>",
  home: "<Home>",
  end: "<End>",
  pageup: "<PageUp>",
  pagedown: "<PageDown>",
}

export function keyNotation(event: KeyEvent) {
  const name = event.name?.toLowerCase()
  if (!name) return undefined

  if (event.ctrl) return `<C-${ctrlKey(name, event.shift)}>`
  if (event.meta || event.option) return `<M-${name}>`
  if ([...graphemes.segment(name)].length === 1) return event.shift ? name.toUpperCase() : name
  return NAMED_KEYS[name] ?? `<${name}>`
}

function ctrlKey(name: string, shift: boolean) {
  if (name === "escape" || name === "esc") return "["
  // Ctrl+Shift+[ is not Escape; keep it free for host bindings like tab switching.
  if (name === "[" && shift) return "{"
  return name
}

export function keyForVimee(event: KeyEvent, key: string) {
  if (key === "<C-[>") return "Escape"
  if (event.ctrl) return keyToken(key)
  const token = keyToken(key)
  return token.startsWith("<") ? undefined : token
}

export function keyToken(token: string) {
  if (token === "<Esc>" || token === "<C-[>") return "Escape"
  if (token === "<CR>") return "Enter"
  if (token === "<Tab>") return "Tab"
  if (token === "<BS>") return "Backspace"
  if (token === "<Del>") return "Delete"
  if (token === "<Space>") return " "
  if (token === "<Up>") return "ArrowUp"
  if (token === "<Down>") return "ArrowDown"
  if (token === "<Left>") return "ArrowLeft"
  if (token === "<Right>") return "ArrowRight"
  if (token === "<Home>") return "Home"
  if (token === "<End>") return "End"
  if (token.startsWith("<C-") && token.endsWith(">")) return token.slice(3, -1).toLowerCase()
  return token
}

export function tokenCtrl(token: string) {
  return token.startsWith("<C-") && token !== "<C-[>"
}

// Pane controls use one chord, not editing sequences. This also supports Alt
// and Ctrl punctuation, which the editing engine's sequence parser omits.
export function paneMappingKey(key: string) {
  if (key === "<C-_>") return "<C-/>"
  if (/^[!-~]$/.test(key) || Object.values(NAMED_KEYS).includes(key)) return key
  if (/^<[CM]-[!-~]>$/.test(key) && !/^<[CM]-[A-Z]>$/.test(key)) return key
  throw new Error("Pane mappings require a single key or chord, such as <M-h> or <C-/>")
}

export function paneEventKey(event: KeyEvent, keyboard?: VimKeyboard) {
  if (event.super || event.hyper || (event.ctrl && (event.meta || event.option))) return
  const key = inputKey(event, keyboard)
  if (!key) return
  // Shifted letters and named keys must not match their unshifted bindings.
  if (event.shift && (/^<[CM]-[a-z]>$/.test(key) || Object.values(NAMED_KEYS).includes(key))) return
  return key === "<C-_>" ? "<C-/>" : key
}
