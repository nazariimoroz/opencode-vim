import assert from "node:assert/strict"
import type { Fixture } from "../support/fixture"
import { readerContains } from "../support/screens"
import { createTerminalRecorder } from "../support/terminal-recorder"

// Inject CSI u through the test PTY. This tests parser/routing, not physical
// keyboard support or the user's terminal negotiation.
function csi(char: string, base: string, modifiers = 1) {
  return `\x1b[${char.codePointAt(0)}::${base.codePointAt(0)};${modifiers}u`
}

export async function keyboardPrompt({ terminal, probe }: Fixture) {
  const { type, keys, screen } = terminal
  await type("шaіbрcя")
  await keys("Escape")
  await type("0а" + csi("і", "s"))
  await screen("literal-find-not-session", async () => {
    const state = await probe()
    return state.mode === "base" && state.editor?.cursor === 1 && state.editor.text === "aіbрcя"
  })
  await type("к" + csi("я", "z"))
  await screen("literal-replace", async () => (await probe()).editor?.text === "aяbрcя")
  await type(csi("р", "l") + ".")
  await screen("metadata-priority-and-repeat", async () => (await probe()).editor?.text === "aяярcя")
  await type("0ввг")
  await screen("fallback-delete-undo", async () => (await probe()).editor?.text === "aяярcя")
  await type(csi("к", "r", 5))
  await screen("canonical-control-redo", async () => (await probe()).editor?.text === "")
  await type("шло")
  await screen(
    "insert-mapping-is-logical",
    async (text) => text.includes("INSERT") && (await probe()).editor?.text === "ло",
  )
  await keys("Escape")
  await type("0" + csi("р", "a", 2) + " текст")
  await screen(
    "us-shift-command",
    async (text) => text.includes("INSERT") && (await probe()).editor?.text === "ло текст",
  )
  await keys("Escape", "C-p")
  await screen("palette-normal", (text) => text.includes("Commands") && text.includes("NORMAL"))
  await type("шфільтрло")
  await screen("literal-dialog-filter", async () => (await probe()).editor?.text === "фільтрло")
  await keys("Escape", "Escape")
  await screen("palette-closed", (text) => !text.includes("Commands") && text.includes("NORMAL"))
  await probe("select")
  await screen("choices-open", (text) => text.includes("E2E choices"))
  await type("о")
  await keys("Enter")
  await screen("canonical-dialog-navigation", async () => (await probe()).result === "2")
  await type("0і")
  await screen("mapping-precedes-session-toggle", async () => (await probe()).editor?.text === "о текст")
  await probe("dispatch", { command: "opencode-vim.toggle" })
  await screen("vim-disabled", (text) => !text.includes("NORMAL") && !text.includes("INSERT"))
  await keys("C-c")
  await type("р" + csi("д", "l"))
  await screen("disabled-input-is-literal", async () => (await probe()).editor?.text === "рд")
}

export async function keyboardQueue({ terminal, clipboard, probe }: Fixture) {
  assert(clipboard)
  await terminal.keys("Escape")
  await terminal.type("з")
  await clipboard.waitForRead()
  await terminal.type("шло" + csi("р", "h"))
  await clipboard.release()
  await terminal.screen("queued-keys-reinterpreted", async (text) => {
    const state = await probe()
    return text.includes("INSERT") && state.editor?.text.includes("лор") && !state.editor.text.includes("ш")
  })
}

export async function keyboardReader({ terminal, probe }: Fixture) {
  await terminal.keys("Escape")
  await terminal.type("і")
  await terminal.screen("uk-session", async () => (await probe()).mode === "opencode-vim.session")
  await terminal.type("ппП")
  await terminal.keys("Enter")
  await terminal.screen("uk-reader", (text) => readerContains(text, "one two"))
  const start = terminal.cursor()
  await terminal.type("цмд")
  await terminal.screen("uk-reader-visual", (text) => text.includes("VISUAL"))
  assert.deepEqual(terminal.cursor(), { x: start.x + 5, y: start.y })
  await terminal.keys("Escape")
  await terminal.type("і")
  await terminal.screen("uk-reader-to-prompt", async () => (await probe()).mode === "base")
}

export async function keyboardForm({ terminal, request, sessionID }: Fixture) {
  const endpoint = `/api/session/${sessionID}/form`
  const form = (
    await request(endpoint, {
      title: "Keyboard question",
      metadata: { kind: "question" },
      fields: [
        {
          key: "answer",
          title: "Answer",
          type: "string",
          custom: true,
          options: [
            { value: "one", label: "First" },
            { value: "two", label: "Second" },
          ],
        },
      ],
    })
  ).data
  await terminal.screen("uk-form-open", (text) => text.includes("Keyboard question") && text.includes("NORMAL"))
  // Focus opening/closing and native typing all occur in one burst.
  await terminal.type("оолош\x1b[27uшвідповідьло")
  await terminal.screen("uk-form-literal-answer", (text) => text.includes("INSERT") && text.includes("відповідьло"))
  await terminal.keys("Enter")
  await terminal.screen("uk-form-submitted", (text) => !text.includes("Keyboard question"))
  assert.equal((await request(`${endpoint}/${form.id}`)).data.state.answer.answer, "відповідьло")
}

export async function keyboardTerminal(fixture: Fixture) {
  const { terminal, probe } = fixture
  await terminal.keys("Escape")
  const recorder = await createTerminalRecorder(fixture)
  try {
    await recorder.input("uk-child-literal", () => terminal.type("рло"), Buffer.from("рло").toString("hex"))
    await recorder.input(
      "uk-child-metadata-is-literal",
      () => terminal.type(csi("р", "h")),
      Buffer.from("р").toString("hex"),
    )
    await recorder.input("uk-child-escape", () => terminal.keys("Escape"), "1b")
    await recorder.input("uk-child-control", () => terminal.keys("C-r"), "12")
    const before = await recorder.bytes()
    await terminal.type(csi("р", "h", 3))
    await terminal.screen("uk-pane-left", async () => !!(await probe()).editor)
    await terminal.type("\x1b[1076;3u")
    await terminal.screen("uk-pane-right", async () =>
      (await probe()).terminals.some((item: { focused: boolean }) => item.focused),
    )
    assert.equal(await recorder.bytes(), before)
    await terminal.type(csi("р", "h", 3))
    await terminal.screen("uk-pane-left-again", async () => !!(await probe()).editor)
    await terminal.keys("Down")
    await terminal.screen("uk-composer", async () => (await probe()).mode === "composer")
    await terminal.type("дд")
    await terminal.screen("uk-composer-terminal-tab", (text) => text.includes("+ New terminal"))
    await terminal.keys("Escape")
  } finally {
    await recorder.remove()
  }
}
