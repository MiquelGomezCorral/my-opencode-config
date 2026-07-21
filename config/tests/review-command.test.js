import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"

test("review uses the current TUI agent and model", async () => {
  const command = await readFile(new URL("../commands/review.md", import.meta.url), "utf8")

  expect(command).not.toMatch(/^agent:/m)
  expect(command).not.toMatch(/^model:/m)
})
