#!/usr/bin/env node
// Benchmark vault-context coverage and latency.
// Runs rg for each keyword in shortTech list, filters Excalidraw drawings by content,
// reports coverage and average time.
// Usage: node scripts/benchmark.mjs [--kw N] [--csv]

import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { existsSync, readFileSync, statSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const run = promisify(execFile)
const __dirname = new URL(".", import.meta.url).pathname
const root = join(__dirname, "..")
const cfg = JSON.parse(readFileSync(join(root, "vault-context.config.json"), "utf8"))
const vault = process.env.OBSIDIAN_VAULT || join(homedir(), "Desktop", "Obsidian")

const LIMIT = parseInt(process.argv.find(a => a.startsWith("--kw="))?.split("=")[1] || "0", 10)
const CSV = process.argv.includes("--csv")

const roots = ["CODE", "VIDEXT", "UNI"].map(d => join(vault, d)).filter(existsSync)
const denyGlobs = cfg.search.denyGlobs || []
const denyPatterns = (cfg.search.denyContentPatterns || []).map(p => new RegExp(p, "im"))

// Build Excalidraw content-deny set
const excalidrawFiles = new Set()
for (const dir of roots) {
  const stack = [dir]
  while (stack.length) {
    const d = stack.pop()
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      const s = statSync(p)
      if (s.isDirectory()) {
        const name = e.toLowerCase()
        if (![".obsidian", ".git", "images", "excalidraw"].includes(name)) stack.push(p)
      } else if (p.endsWith(".md")) {
        try {
          if (denyPatterns.some(pat => pat.test(readFileSync(p, "utf8").slice(0, 200000)))) {
            excalidrawFiles.add(p)
          }
        } catch { /* skip unreadable */ }
      }
    }
  }
}

const keywords = LIMIT > 0 ? cfg.keywords.shortTech.slice(0, LIMIT) : cfg.keywords.shortTech
let found = 0, totalMs = 0, complete = 0
const results = []

for (const kw of keywords) {
  const args = ["--json", "-i", "-n", "--type", "md", "--max-count", "1"]
  for (const g of denyGlobs) args.push("--glob", g)
  args.push("-e", kw, ...roots)

  const start = Date.now()
  try {
    const { stdout } = await run("rg", args, { timeout: 600, maxBuffer: 512 * 1024 })
    const elapsed = Date.now() - start
    totalMs += elapsed
    complete++

    const match = stdout.trim().split("\n").filter(Boolean).some(line => {
      try {
        const ev = JSON.parse(line)
        return ev.type === "match" && ev.data?.path?.text && !excalidrawFiles.has(ev.data.path.text)
      } catch { return false }
    })
    if (match) found++
    results.push({ keyword: kw, found: match, ms: elapsed })
  } catch {
    totalMs += Date.now() - start
    complete++
    results.push({ keyword: kw, found: false, ms: Date.now() - start })
  }
}

const avg = (totalMs / complete).toFixed(1)
const pct = ((found / complete) * 100).toFixed(1)

if (CSV) {
  console.log("keyword,found,ms")
  for (const r of results) console.log(`${r.keyword},${r.found},${r.ms}`)
} else {
  console.log(`Keywords: ${complete}`)
  console.log(`Found: ${found}`)
  console.log(`Coverage: ${pct}%`)
  console.log(`Avg time: ${avg}ms`)
  console.log(`Total time: ${totalMs}ms`)

  const missed = results.filter(r => !r.found)
  if (missed.length) {
    console.log(`\nMissed (${missed.length}):`)
    // group by file or pattern
    for (const m of missed.slice(0, 20)) console.log(`  ${m.keyword} (${m.ms}ms)`)
    if (missed.length > 20) console.log(`  ... and ${missed.length - 20} more`)
  }
}
