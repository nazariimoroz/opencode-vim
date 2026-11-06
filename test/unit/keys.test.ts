import { expect, test } from "bun:test"
import { createVimConfig, type VimKeyboard } from "../../src/vim/config"
import { inputKey, keyForVimee, keyNotation, paneEventKey, resolveKey } from "../../src/vim/keys"
import { keyEvent } from "../helpers/key"

const keyboard: VimKeyboard = { mode: "layout-independent", fallback: "uk" }

test("keyboard options are opt-in and invalid fields independently use defaults", () => {
  expect(createVimConfig({}).keyboard).toEqual({ mode: "logical", fallback: "none" })
  expect(createVimConfig({ vim: { keyboard } }).keyboard).toEqual(keyboard)
  for (const value of [null, false, "uk", { mode: "physical", fallback: "ru" }]) {
    expect(createVimConfig({ keyboard: value }).keyboard).toEqual({ mode: "logical", fallback: "none" })
  }
  expect(createVimConfig({ keyboard: { mode: "layout-independent", fallback: "invalid" } }).keyboard).toEqual({
    mode: "layout-independent",
    fallback: "none",
  })
})

test("logical mode preserves existing notation including named keys and modifiers", () => {
  for (const name of ["h", "H", "р", ".", "/", "escape", "left", "tab", "space", "f1", "e\u0301"]) {
    for (const options of [{}, { shift: true }, { ctrl: true }, { meta: true }]) {
      const event = keyEvent(name, { ...options, baseCode: 104 })
      expect(inputKey(event)).toBe(keyNotation(event))
      expect(inputKey(event, { mode: "logical", fallback: "uk" })).toBe(keyNotation(event))
      const literal = name === "H" && !options.ctrl && !options.meta ? "H" : keyNotation(event)
      expect(inputKey(event, keyboard, "literal")).toBe(literal)
    }
  }
})

test("metadata wins over fallback, uses US Shift once and ignores Caps Lock", () => {
  for (const [base, shifted] of [
    ["h", "H"],
    ["[", "{"],
    ["1", "!"],
    [";", ":"],
    ["'", '"'],
    ["/", "?"],
  ]) {
    expect(resolveKey(keyEvent("р", { baseCode: base!.charCodeAt(0) }), keyboard)).toMatchObject({
      literal: "р",
      command: base,
      source: "baseCode",
    })
    expect(inputKey(keyEvent("р", { baseCode: base!.charCodeAt(0), shift: true }), keyboard)).toBe(shifted)
  }
  expect(inputKey(keyEvent("Р", { baseCode: 104 }), keyboard)).toBe("h")
  expect(inputKey(keyEvent("Р", { baseCode: 104, capsLock: true }), keyboard)).toBe("h")
  expect(inputKey(keyEvent("Р", { baseCode: 104, capsLock: true }), keyboard, "literal")).toBe("Р")
  expect(inputKey(keyEvent("р", { baseCode: 72 }), keyboard)).toBe("h")
  expect(inputKey(keyEvent("р", { baseCode: 123, shift: true }), keyboard)).toBe("{")
  expect(inputKey(keyEvent("р", { baseCode: 32 }), keyboard)).toBe("<Space>")
})

test("invalid metadata safely falls back; named keys never use metadata", () => {
  for (const baseCode of [-1, 0, 31, 127, 104.5, NaN, Infinity, 0xd800, 0x110000, 0x440]) {
    expect(resolveKey(keyEvent("р", { baseCode }), keyboard)).toMatchObject({ command: "h", source: "uk" })
    expect(inputKey(keyEvent("р", { baseCode }), { ...keyboard, fallback: "none" })).toBe("р")
  }
  expect(inputKey(keyEvent("escape", { baseCode: 104 }), keyboard)).toBe("<Esc>")
  expect(inputKey(keyEvent("left", { baseCode: 104 }), keyboard)).toBe("<Left>")
  expect(inputKey(keyEvent("і\u0301", { baseCode: 104 }), keyboard)).toBe("і\u0301")
  expect(inputKey(keyEvent("👩‍💻", { baseCode: 104 }), keyboard)).toBe("👩‍💻")
  expect(inputKey(keyEvent("\x1b", { baseCode: 104 }), keyboard)).toBe("\x1b")
  expect(inputKey(keyEvent("р", { code: "KeyH" }), { ...keyboard, fallback: "none" })).toBe("р")
})

test("the complete Ukrainian letter profile includes US shifted punctuation", () => {
  const lower = "йцукенгшщзхїфівапролджєячсмитьбю"
  const plain = "qwertyuiop[]asdfghjkl;'zxcvbnm,."
  const shifted = 'QWERTYUIOP{}ASDFGHJKL:"ZXCVBNM<>'
  Array.from(lower).forEach((letter, index) => {
    expect(inputKey(keyEvent(letter), keyboard)).toBe(plain[index])
    expect(inputKey(keyEvent(letter.toUpperCase()), keyboard)).toBe(shifted[index])
    expect(inputKey(keyEvent(letter, { shift: true }), keyboard)).toBe(shifted[index])
  })
  for (const char of [".", "/", "1", "!", "@", "ґ", "ё", "ы", "ў", "中", "👩‍💻", "і\u0301"]) {
    expect(inputKey(keyEvent(char), keyboard)).toBe(char)
  }
})

test("Ctrl execution uses the resolved token and keeps Escape distinct from Ctrl+Shift+[", () => {
  const redo = keyEvent("к", { ctrl: true, baseCode: 114 })
  const key = inputKey(redo, keyboard)!
  expect(key).toBe("<C-r>")
  expect(keyForVimee(redo, key)).toBe("r")
  expect(inputKey(keyEvent("х", { ctrl: true }), keyboard)).toBe("<C-[>")
  expect(inputKey(keyEvent("х", { ctrl: true, shift: true, baseCode: 91 }), keyboard)).toBe("<C-{>")
  expect(keyForVimee(keyEvent("[", { ctrl: true }), "<C-[>")).toBe("Escape")
})

test("pane resolution preserves modifier restrictions, aliases and original event data", () => {
  const event = keyEvent("р", { meta: true, baseCode: 104 })
  const before = { ...event }
  expect(paneEventKey(event, keyboard)).toBe("<M-h>")
  expect(event).toMatchObject(before)
  expect(paneEventKey(keyEvent("д", { option: true }), keyboard)).toBe("<M-l>")
  expect(paneEventKey(keyEvent("_", { ctrl: true, shift: true }), keyboard)).toBe("<C-/>")
  for (const options of [{ super: true }, { hyper: true }, { ctrl: true, meta: true }, { meta: true, shift: true }]) {
    expect(paneEventKey(keyEvent("р", options), keyboard)).toBeUndefined()
  }
})
