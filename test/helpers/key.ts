import { KeyEvent } from "@opentui/core"

export function keyEvent(name: string, options: Partial<ConstructorParameters<typeof KeyEvent>[0]> = {}) {
  return new KeyEvent({
    name,
    sequence: name,
    raw: name,
    ctrl: false,
    meta: false,
    shift: false,
    option: false,
    number: false,
    eventType: "press",
    source: "raw",
    ...options,
  })
}
