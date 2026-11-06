import { afterEach, expect, test } from "bun:test"
import { createFixture } from "../helpers/fixture"
import { keyEvent } from "../helpers/key"

const keyboard = { mode: "layout-independent", fallback: "uk" } as const
let fixture: Awaited<ReturnType<typeof createFixture>> | undefined
afterEach(() => {
  fixture?.dispose()
  fixture = undefined
})

test("Ukrainian motions, operators, counts, text objects and visual selection", async () => {
  fixture = await createFixture("one two\nthree four", { keyboard })
  await fixture.keys("ц")
  expect(fixture.input.cursorOffset).toBe(4)
  await fixture.keys("р")
  expect(fixture.input.cursorOffset).toBe(3)
  await fixture.keys("д")
  expect(fixture.input.cursorOffset).toBe(4)
  await fixture.keys("ол")
  expect(fixture.input.cursorOffset).toBe(4)
  await fixture.keys("ппвшц")
  expect(fixture.input.plainText).toBe(" two\nthree four")
  await fixture.keys("вв")
  expect(fixture.input.plainText).toBe("three four")
  await fixture.keys("2дм2д")
  expect(fixture.state.mode()).toBe("visual")
  await fixture.keys("в")
  expect(fixture.input.plainText).toBe("th four")
})

test.each(["а", "е", "к", "ва"])(
  "%s keeps the following Cyrillic argument literal, even with metadata",
  async (command) => {
    fixture = await createFixture("aіbрcя", { keyboard, keymaps: { normal: { s: "x", h: "x" } } })
    await fixture.keys(command)
    expect(fixture.adapter.inputIntent()).toBe("literal")
    const event = keyEvent("і", { baseCode: 115 })
    fixture.renderer.keyInput.emit("keypress", event)
    expect(fixture.adapter.inputIntent()).toBe("command")
    if (command === "к") expect(fixture.input.plainText).toBe("ііbрcя")
    else if (command === "ва") expect(fixture.input.plainText).toBe("bрcя")
    else expect(fixture.input.cursorOffset).toBe(command === "а" ? 1 : 0)
  },
)

test("replace repeat retains Cyrillic payload", async () => {
  fixture = await createFixture("abcd", { keyboard })
  await fixture.keys("крд.")
  expect(fixture.input.plainText).toBe("ррcd")
})

test("replace keeps Caps Lock payload case while commands ignore it with metadata", async () => {
  fixture = await createFixture("abcd", { keyboard })
  await fixture.keys("к")
  fixture.renderer.keyInput.emit("keypress", keyEvent("Р", { capsLock: true, baseCode: 104 }))
  expect(fixture.input.plainText).toBe("Рbcd")
  await fixture.keys("д.")
  expect(fixture.input.plainText).toBe("РРcd")
})

test("canonical Ctrl+r reaches native redo", async () => {
  fixture = await createFixture("abcd", { keyboard })
  await fixture.keys("вв")
  expect(fixture.input.plainText).toBe("")
  await fixture.keys("г")
  expect(fixture.input.plainText).toBe("abcd")
  fixture.renderer.keyInput.emit("keypress", keyEvent("к", { ctrl: true, baseCode: 114 }))
  expect(fixture.input.plainText).toBe("")
})

test("insert and insert mappings stay logical, including metadata-backed native text", async () => {
  fixture = await createFixture("", { keyboard, keymaps: { insert: { kj: "normal" } } })
  await fixture.keys("шло")
  fixture.renderer.keyInput.emit("keypress", keyEvent("р", { baseCode: 104 }))
  await fixture.keys("і\u0301")
  expect(fixture.state.mode()).toBe("insert")
  expect(fixture.input.plainText).toBe("лорі\u0301")
  fixture.mockInput.pressEscape()
  await fixture.keys("0.")
  expect(fixture.input.plainText).toBe("лорі\u0301лорі\u0301")
})

test("mapping LHS is canonical but RHS is not translated a second time", async () => {
  fixture = await createFixture("abcd", { keyboard, keymaps: { normal: { s: "rh", Q: "x" } } })
  await fixture.keys("і")
  expect(fixture.input.plainText).toBe("hbcd")
  await fixture.keys("Й")
  expect(fixture.input.plainText).toBe("bcd")
})

test("pending cancellation and suspension restore command intent", async () => {
  fixture = await createFixture("abcd", { keyboard })
  await fixture.keys("а")
  expect(fixture.adapter.inputIntent()).toBe("literal")
  fixture.mockInput.pressEscape()
  expect(fixture.adapter.inputIntent()).toBe("command")
  await fixture.keys("а")
  fixture.adapter.suspend()
  expect(fixture.adapter.inputIntent()).toBe("command")
  await fixture.keys("д")
  expect(fixture.input.cursorOffset).toBe(1)
})

test.each(["і", "р", "я"])("metadata never transliterates the %s payload of backward find/till", async (payload) => {
  fixture = await createFixture(`a${payload}bc`, { keyboard })
  fixture.input.cursorOffset = 3
  await fixture.keys("А")
  fixture.renderer.keyInput.emit("keypress", keyEvent(payload, { baseCode: 115 }))
  expect(fixture.input.cursorOffset).toBe(1)
  fixture.input.cursorOffset = 3
  await fixture.keys("Е")
  fixture.renderer.keyInput.emit("keypress", keyEvent(payload, { baseCode: 115 }))
  expect(fixture.input.cursorOffset).toBe(2)
})

test("register, macro and mark names share the canonical Latin namespace", async () => {
  fixture = await createFixture("one two", { keyboard })
  await fixture.keys('"фншц$"ap')
  expect(fixture.input.plainText).toBe("one twoone")
  await fixture.keys("0йфкрйд@a")
  expect(fixture.input.plainText).toBe("ррe twoone")
  await fixture.keys("0ьф3д`a")
  expect(fixture.input.cursorOffset).toBe(0)
})
