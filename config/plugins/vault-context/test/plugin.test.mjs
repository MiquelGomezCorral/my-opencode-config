import { describe, it, before, after } from "node:test"
import { deepStrictEqual, strictEqual, match, doesNotMatch, ok } from "node:assert"
import { mkdirSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

// Create a temporary vault for testing
const TMP = join(tmpdir(), "vault-context-test-" + Date.now())
const VAULT = join(TMP, "Obsidian")
const CODE = join(VAULT, "CODE")
const UNI = join(VAULT, "UNI")

function setupVault() {
  mkdirSync(CODE, { recursive: true })
  mkdirSync(UNI, { recursive: true })
  writeFileSync(join(CODE, "Git.md"), "# Git\n\ngit sync-staging = git fetch origin staging && git merge origin/staging\n")
  writeFileSync(join(CODE, "Docker.md"), "# Docker\n\ndocker compose up -d\n")
  writeFileSync(join(UNI, "Notes.md"), "# University Notes\n\nPython is used for data science.\n")
  writeFileSync(join(UNI, "Excalidraw.md"), "---\nexcalidraw-plugin: parsed\n---\n# Drawing\nSome text about excalidraw\n")
  writeFileSync(join(UNI, "Renamed-Drawing.md"), "---\nexcalidraw-plugin: parsed\ntags: [excalidraw]\n---\n==⚠ Switch to EXCALIDRAW VIEW\n")
}

function teardownVault() {
  rmSync(TMP, { recursive: true, force: true })
}

describe("vault-context plugin", () => {
  let plugin

  before(async () => {
    setupVault()
    process.env.OBSIDIAN_VAULT = VAULT
    const mod = await import("../vault-context.js")
    plugin = await mod.default()
  })

  after(() => {
    delete process.env.OBSIDIAN_VAULT
    teardownVault()
  })

  function makeOutput(text) {
    return {
      message: { id: "msg_test" },
      parts: [{ type: "text", text }],
    }
  }

  function makeInput() {
    return { sessionID: "sess_test" }
  }

  it("loads without error", () => {
    ok(plugin)
    ok(typeof plugin["chat.message"] === "function")
  })

  it("injects context for matching prompt", async () => {
    const out = makeOutput("git sync-staging")
    await plugin["chat.message"](makeInput(), out)
    ok(out.parts.length > 1, "should inject")
    const injected = out.parts[0]
    strictEqual(injected.synthetic, true)
    strictEqual(injected.type, "text")
    ok(injected.text.includes("Git.md"), "should reference Git.md")
  })

  it("does not inject for opt-out phrase", async () => {
    const out = makeOutput("no vault what is python?")
    await plugin["chat.message"](makeInput(), out)
    strictEqual(out.parts.length, 1, "should not inject for opt-out")
  })

  it("injects for force phrase", async () => {
    const out = makeOutput("use vault python")
    await plugin["chat.message"](makeInput(), out)
    ok(out.parts.length > 1, "should inject for force phrase")
  })

  it("does not inject for short noise", async () => {
    const out = makeOutput("hi")
    await plugin["chat.message"](makeInput(), out)
    strictEqual(out.parts.length, 1, "should not inject for short noise")
  })

  it("does not inject for off mode", async () => {
    const prev = process.env.VAULT_CONTEXT_MODE
    process.env.VAULT_CONTEXT_MODE = "off"
    // Recreate plugin with new mode
    const mod = await import("../vault-context.js")
    const offPlugin = await mod.default()
    const out = makeOutput("git")
    await offPlugin["chat.message"](makeInput(), out)
    strictEqual(out.parts.length, 1, "should not inject in off mode")
    if (prev) process.env.VAULT_CONTEXT_MODE = prev
    else delete process.env.VAULT_CONTEXT_MODE
  })

  it("skips excalidraw files by content", async () => {
    const out = makeOutput("use vault excalidraw")
    await plugin["chat.message"](makeInput(), out)
    // If only excalidraw files match, there should be no injection
    // The test notes "Excalidraw.md" and "Renamed-Drawing.md" are excalidraw
    // But "Git.md" doesn't contain "excalidraw" so it won't match
    // So we expect no injection (no non-excalidraw file has "excalidraw")
    strictEqual(out.parts.length, 1, "should not inject excalidraw content")
  })

  it("caches results within TTL", async () => {
    const out1 = makeOutput("docker")
    await plugin["chat.message"](makeInput(), out1)
    ok(out1.parts.length > 1, "first call should inject")

    const out2 = makeOutput("docker")
    await plugin["chat.message"](makeInput(), out2)
    ok(out2.parts.length > 1, "cached call should inject")
    // Both should have the same content
    strictEqual(out1.parts[0].text, out2.parts[0].text, "cached result should match")
  })
})
