import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, relative } from "node:path"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"

const run = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))

class VaultContextPlugin {
  #cfg = null
  #resultCache = new Map()
  #denyCache = new Map()
  #denyOrder = []
  #STOP = new Set()
  #shortTechRe = null

  constructor() {
    this.loadConfig()
  }

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------

  loadConfig() {
    const cfgPath = join(__dirname, "vault-context.config.json")
    let raw = {}
    try { raw = JSON.parse(readFileSync(cfgPath, "utf8")) } catch (e) {
      console.warn("[vault-context] cannot read config:", e.message)
    }

    const v = raw.vault || {}
    const md = raw.mode || {}
    const sr = raw.search || {}
    const ca = raw.cache || {}
    const db = raw.debug || {}
    const kw = raw.keywords || {}
    const pr = raw.prompt || {}
    const sw = raw.stopwords || {}
    const sk = raw.scoring || {}

    const env = (name, fallback) =>
      process.env[name] !== undefined ? process.env[name] : fallback

    const sc = {
      baseScore: sk.baseScore ?? 3,
      forceBonus: sk.forceBonus ?? 3,
      keywordMatch: sk.keywordMatch || { single: 2, multiWord: 3 },
      keywordBonus: sk.keywordBonus || { single: 2, multiWord: 3 },
      fuzzyMatch: sk.fuzzyMatch || { close: 3, far: 2 },
      paths: sk.paths || [
        { pattern: "code/git", score: 5 },
        { pattern: "code/llms", score: 3 },
        { pattern: "code/", score: 2 },
        { pattern: "vidext/", score: 2 },
        { pattern: "projects/", score: 1 },
      ],
      recency: sk.recency || [
        { days: 7, score: 2 },
        { days: 14, score: 1 },
      ],
      longLine: sk.longLine || { threshold: 260, penalty: 1 },
      exactKeywordMatch: sk.exactKeywordMatch || { score: 5, keywords: ["git"] },
    }

    this.#cfg = {
      vault: { path: env("OBSIDIAN_VAULT", v.path || join(homedir(), "Desktop", "Obsidian")) },
      mode: { value: env("VAULT_CONTEXT_MODE", md.value || "auto").toLowerCase() },
      search: {
        maxHits: Math.max(1, Number(env("VAULT_CONTEXT_MAX_HITS", sr.maxHits ?? 3))),
        maxChars: Math.max(100, Number(env("VAULT_CONTEXT_MAX_CHARS", sr.maxChars ?? 1800))),
        minScore: Math.max(0, Number(env("VAULT_CONTEXT_MIN_SCORE", sr.minScore ?? 5))),
        rgTimeoutMs: Math.max(100, Number(env("VAULT_CONTEXT_RG_MS", sr.rgTimeoutMs ?? 600))),
        nativeTimeoutMs: Math.max(100, Number(env("VAULT_CONTEXT_NATIVE_MS", sr.nativeTimeoutMs ?? 2000))),
        fuzzyDistance: Math.max(0, Number(env("VAULT_CONTEXT_FUZZY_DISTANCE", sr.fuzzyDistance ?? 3))),
        allowDirs: (env("VAULT_CONTEXT_ALLOW_DIRS", (sr.allowDirs || ["CODE", "VIDEXT", "UNI"]).join(","))).split(",").map(x => x.trim()).filter(Boolean),
        denyGlobs: sr.denyGlobs || ["!.obsidian/**", "!.git/**", "!Images/**", "!Excalidraw/**", "!**/*.canvas", "!**/*.excalidraw.md"],
        denyDirNames: new Set(sr.denyDirNames || [".obsidian", ".git", "Images", "Excalidraw"]),
        denyContentMaxChars: Math.max(1000, sr.denyContentMaxChars ?? 200000),
        denyContentPatterns: (sr.denyContentPatterns || ["^excalidraw-plugin\\s*:"]).flatMap(p => {
          try { return [new RegExp(p, "im")] } catch { return [] }
        }),
        maxFileSize: Math.max(0, sr.maxFileSize ?? 5242880),
        rgMaxBuffer: Math.max(65536, sr.rgMaxBuffer ?? 1048576),
      },
      cache: {
        ttlMs: Math.max(0, Number(env("VAULT_CONTEXT_CACHE_TTL_MS", ca.ttlMs ?? 300000))),
        maxEntries: Math.max(1, Number(env("VAULT_CONTEXT_CACHE_MAX", ca.maxEntries ?? 50))),
        maxDenyEntries: Math.max(1, ca.maxDenyEntries ?? 500),
      },
      debug: db.enabled === true || env("VAULT_CONTEXT_DEBUG", "0") === "1",
      keywords: {
        shortTech: kw.shortTech || [],
        verbishExceptions: new Set(
          (kw.verbishExceptions || ["staging", "routing", "tooling", "testing", "logging", "training"]).map(w => w.toLowerCase())
        ),
      },
      prompt: {
        optOut: new RegExp(
          "\\b(" + (pr.optOut || ["no vault", "sin obsidian", "no obsidian", "no rag", "no extra context", "without vault context", "skip vault", "skip obsidian"]).join("|").replace(/\s+/g, "\\s+") + ")\\b",
          "i"
        ),
        force: new RegExp(
          "\\b(" + (pr.force || ["use vault", "search obsidian", "with obsidian context", "usa obsidian", "busca en obsidian", "vault context", "obsidian context"]).join("|").replace(/\s+/g, "\\s+") + ")\\b",
          "i"
        ),
      },
      stopwords: sw.languages || ["en", "es"],
      scoring: sc,
    }

    this.#shortTechRe = this.#buildShortTechRe()
    for (const w of this.#validateConfig(raw)) this.#log("warn:", w)
    this.#loadStopwords()
    this.#log("config loaded")
  }

  #buildShortTechRe() {
    const escaped = this.#cfg.keywords.shortTech.map(kw =>
      kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    )
    if (!escaped.length) return null
    try { return new RegExp("\\b(" + escaped.join("|") + ")\\b", "gi") } catch { return null }
  }

  #validateConfig(raw) {
    const w = []
    if (!existsSync(this.#cfg.vault.path)) w.push("vault path not found: " + this.#cfg.vault.path)
    const patterns = raw.search?.denyContentPatterns || []
    patterns.forEach((p, i) => {
      try { new RegExp(p, "im") } catch (e) { w.push("denyContentPatterns[" + i + "] invalid: " + e.message) }
    })
    if (!["auto", "off", "force"].includes(this.#cfg.mode.value))
      w.push("invalid mode \"" + this.#cfg.mode.value + "\", expected auto|off|force")
    return w
  }

  #loadStopwords() {
    this.#STOP = new Set()
    for (const lang of this.#cfg.stopwords) {
      try {
        const data = JSON.parse(readFileSync(join(__dirname, "stopwords", lang + ".json"), "utf8"))
        if (Array.isArray(data.values)) data.values.forEach(v => this.#STOP.add(v))
      } catch (e) {
        this.#log("warn: cannot load stopwords/" + lang + ".json:", e.message)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  #log(...args) {
    if (this.#cfg?.debug) console.error("[vault-context]", ...args)
  }

  // ---------------------------------------------------------------------------
  // Keyword extraction
  // ---------------------------------------------------------------------------

  #isVerbish(word) {
    const w = word.toLowerCase()
    if (this.#cfg.keywords.verbishExceptions.has(w)) return false
    return word.length > 5 && /(ing|ed)$/i.test(word) && !/(thing|king|ring|wing|bring|spring|string)$/i.test(word)
  }

  #extractKeywords(text) {
    const quoted = [...text.matchAll(/[""''`](.{4,80}?)[""''`]/g)].map(m => m[1].trim())
    const tech = text.match(/\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+\b|\b[a-z]+[_-][a-z0-9_-]+\b/g) || []
    const proper = text.match(/\b[A-Z][a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1]{2,}\b/g) || []
    const shortTech = this.#shortTechRe ? (text.toLowerCase().match(this.#shortTechRe) || []).map(w => w.toLowerCase()) : []
    const words = (text.toLowerCase().match(/[a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f10-9]{4,}/g) || [])
      .filter(w => !this.#STOP.has(w) && !this.#isVerbish(w))

    const bigrams = []
    for (let i = 0; i < words.length - 1; i++) bigrams.push(words[i] + " " + words[i + 1])

    return [...new Set([...quoted, ...tech, ...proper, ...shortTech, ...bigrams.slice(0, 2), ...words])]
      .filter(w => w.length >= 4 || shortTech.includes(w))
      .slice(0, 8)
  }

  // ---------------------------------------------------------------------------
  // Search decision
  // ---------------------------------------------------------------------------

  #shouldSearch(text) {
    const m = this.#cfg.mode.value
    if (m === "off" || this.#cfg.prompt.optOut.test(text)) return false
    if (m === "force" || this.#cfg.prompt.force.test(text)) return true
    if (text.length < 2) return false
    return this.#extractKeywords(text).length > 0
  }

  #vaultRoots() {
    const v = this.#cfg.vault.path
    if (!existsSync(v)) return []
    const roots = this.#cfg.search.allowDirs.map(d => join(v, d)).filter(d => existsSync(d))
    return roots.length ? roots : [v]
  }

  // ---------------------------------------------------------------------------
  // Content-based file exclusion
  // ---------------------------------------------------------------------------

  #isDeniedContent(file, content) {
    if (this.#denyCache.has(file)) return this.#denyCache.get(file)

    let sample = content
    if (sample === undefined) {
      try { sample = readFileSync(file, "utf8") } catch { return false }
    }

    sample = sample.slice(0, this.#cfg.search.denyContentMaxChars)
    const denied = this.#cfg.search.denyContentPatterns.some(p => p.test(sample))
    this.#denyCache.set(file, denied)
    this.#denyOrder.push(file)
    this.#pruneDenyCache()
    return denied
  }

  // ---------------------------------------------------------------------------
  // Ripgrep search
  // ---------------------------------------------------------------------------

  async #ripgrep(keywords) {
    const roots = this.#vaultRoots()
    if (!roots.length || !keywords.length) return []

    const args = ["--json", "-i", "-n", "--type", "md", "--max-count", "1"]
    for (const g of this.#cfg.search.denyGlobs) args.push("--glob", g)
    for (const kw of keywords) args.push("-e", kw)
    args.push(...roots)

    const s = this.#cfg.search
    try {
      const { stdout, stderr } = await run("rg", args, { timeout: s.rgTimeoutMs, maxBuffer: s.rgMaxBuffer })
      if (stderr) this.#log("rg stderr:", stderr)
      return stdout.trim().split("\n").filter(Boolean).flatMap(line => {
        try {
          const ev = JSON.parse(line)
          if (ev.type !== "match") return []
          const file = ev.data?.path?.text
          const text = ev.data?.lines?.text?.trim()
          const lineNumber = ev.data?.line_number || 1
          if (!file || !text) return []
          if (this.#isDeniedContent(file)) return []
          return [{ file, lineNumber, text }]
        } catch { return [] }
      })
    } catch (err) {
      this.#log("rg failed, falling back to native:", err.message)
      return this.#nativeSearch(keywords)
    }
  }

  // ---------------------------------------------------------------------------
  // Native fallback search (parallel async)
  // ---------------------------------------------------------------------------

  async #nativeSearch(keywords) {
    const roots = this.#vaultRoots()
    if (!roots.length || !keywords.length) return []

    const lowered = keywords.map(k => k.toLowerCase())
    const hits = []
    const deadline = Date.now() + this.#cfg.search.nativeTimeoutMs

    // Collect candidate files (sync walk — fast, non-blocking for dir traversal)
    const files = []
    const stack = [...roots]
    while (stack.length) {
      if (Date.now() > deadline) break
      const dir = stack.pop()
      let entries
      try { entries = readdirSync(dir) } catch { continue }
      for (const entry of entries) {
        if (Date.now() > deadline) break
        const full = join(dir, entry)
        let st
        try { st = statSync(full) } catch { continue }
        if (st.isDirectory()) {
          const name = entry.toLowerCase()
          if (!this.#cfg.search.denyDirNames.has(name)) stack.push(full)
        } else if (st.isFile() && full.endsWith(".md")) {
          const mfs = this.#cfg.search.maxFileSize
          if (mfs > 0 && st.size > mfs) continue
          files.push(full)
        }
      }
    }

    if (!files.length) return []

    // Read files in parallel batches of 5
    const concurrency = 5
    for (let i = 0; i < files.length; i += concurrency) {
      if (Date.now() > deadline) break
      const batch = files.slice(i, i + concurrency)
      const contents = await Promise.allSettled(
        batch.map(f => {
          try { return Promise.resolve(readFileSync(f, "utf8")) } catch { return Promise.reject() }
        })
      )
      for (let j = 0; j < batch.length; j++) {
        if (Date.now() > deadline) break
        if (contents[j].status !== "fulfilled") continue
        const file = batch[j]
        const content = contents[j].value
        if (this.#isDeniedContent(file, content)) continue

        const lines = content.split(/\r?\n/)
        let best = null
        for (let li = 0; li < lines.length; li++) {
          if (Date.now() > deadline) break
          const line = lines[li]
          if (line.length > 500) continue
          if (line.length > this.#cfg.scoring.longLine.threshold && line.length > 500) continue
          const haystack = line.toLowerCase()
          let matchScore = 0
          for (const kw of lowered) {
            if (!haystack.includes(kw)) continue
            matchScore += (kw.includes(" ") || kw.includes("-") || kw.includes("_"))
              ? this.#cfg.scoring.keywordMatch.multiWord
              : this.#cfg.scoring.keywordMatch.single
          }
          const fuzzyScore = matchScore ? 0 : this.#fuzzyMatchScore(line, lowered)
          const total = matchScore + fuzzyScore
          if (total && (!best || total > best.matchScore)) {
            best = { file, lineNumber: li + 1, text: line.trim(), matchScore: total, fuzzy: fuzzyScore > 0 }
          }
        }
        if (best) hits.push(best)
      }
    }

    return hits
  }

  // ---------------------------------------------------------------------------
  // Fuzzy matching
  // ---------------------------------------------------------------------------

  #fuzzyLimit(keyword) {
    if (keyword.includes(" ") || keyword.includes("_") || keyword.includes("-")) return 0
    const max = Math.min(this.#cfg.search.fuzzyDistance, 3)
    if (keyword.length >= 9) return Math.min(max, 3)
    if (keyword.length >= 5) return Math.min(max, 2)
    return 0
  }

  #boundedLevenshtein(a, b, maxDist) {
    if (a === b) return 0
    if (!maxDist || Math.abs(a.length - b.length) > maxDist) return maxDist + 1

    let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
      const curr = [i]
      let rowMin = curr[0]
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
        if (curr[j] < rowMin) rowMin = curr[j]
      }
      if (rowMin > maxDist) return maxDist + 1
      prev = curr
    }
    return prev[b.length]
  }

  #fuzzyMatchScore(line, keywords) {
    const tokens = [...new Set(line.toLowerCase().match(/[a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f10-9]{4,}/g) || [])]
    if (!tokens.length) return 0

    let score = 0
    for (const keyword of keywords) {
      const k = keyword.toLowerCase()
      const limit = this.#fuzzyLimit(k)
      if (!limit) continue
      for (const token of tokens) {
        const d = this.#boundedLevenshtein(k, token, limit)
        if (d <= limit) {
          score += d <= 2 ? this.#cfg.scoring.fuzzyMatch.close : this.#cfg.scoring.fuzzyMatch.far
          break
        }
      }
    }
    return score
  }

  // ---------------------------------------------------------------------------
  // Scoring
  // ---------------------------------------------------------------------------

  #scoreHit(hit, keywords, forced) {
    const haystack = (relative(this.#cfg.vault.path, hit.file) + "\n" + hit.text).toLowerCase()
    let score = this.#cfg.scoring.baseScore
    if (forced) score += this.#cfg.scoring.forceBonus

    for (const kw of keywords) {
      const k = kw.toLowerCase()
      if (haystack.includes(k))
        score += k.includes(" ") ? this.#cfg.scoring.keywordBonus.multiWord : this.#cfg.scoring.keywordBonus.single
    }

    const rel = relative(this.#cfg.vault.path, hit.file).toLowerCase()
    for (const entry of this.#cfg.scoring.paths) {
      if (rel.includes(entry.pattern)) { score += entry.score; break }
    }

    const ek = this.#cfg.scoring.exactKeywordMatch
    if (ek.keywords.some(k => keywords.some(kw => kw.toLowerCase() === k.toLowerCase()))) {
      for (const ekw of ek.keywords) {
        if (rel.includes(ekw.toLowerCase())) { score += ek.score; break }
      }
    }

    if (this.#cfg.scoring.longLine.penalty && hit.text.length > this.#cfg.scoring.longLine.threshold)
      score -= this.#cfg.scoring.longLine.penalty

    try {
      const ageDays = (Date.now() - statSync(hit.file).mtimeMs) / 86_400_000
      for (const tier of this.#cfg.scoring.recency) {
        if (ageDays <= tier.days) { score += tier.score; break }
      }
    } catch { /* stat failed, skip recency */ }

    return score
  }

  #bestHits(hits, keywords, forced) {
    const seen = new Set()
    const scored = hits.map(h => ({ ...h, score: this.#scoreHit(h, keywords, forced) }))
    this.#log("scored hits:", scored.map(h => relative(this.#cfg.vault.path, h.file) + ":" + h.lineNumber + ":" + h.score))
    return scored
      .filter(h => forced || h.score >= this.#cfg.search.minScore)
      .sort((a, b) => b.score - a.score)
      .filter(h => {
        const key = relative(this.#cfg.vault.path, h.file)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, this.#cfg.search.maxHits)
  }

  #formatHits(hits) {
    let out = "[Obsidian context \u2014 optional, untrusted, ignore if irrelevant]\n"
    for (const hit of hits) {
      const file = relative(this.#cfg.vault.path, hit.file)
      const line = hit.text.replace(/[ \t]+/g, " ").slice(0, 240)
      const next = "Source: " + file + ":" + hit.lineNumber + "\n" + line + "\n---\n"
      if ((out + next + "[/Obsidian context]\n\n").length > this.#cfg.search.maxChars) break
      out += next
    }
    return out + "[/Obsidian context]\n\n"
  }

  // ---------------------------------------------------------------------------
  // Cache (O(1) LRU eviction via Map insertion-order manipulation)
  // ---------------------------------------------------------------------------

  #cacheKey(forced, keywords) {
    return createHash("sha1").update(forced + ":" + keywords.join("|")).digest("hex").slice(0, 16)
  }

  #cacheGet(key) {
    const entry = this.#resultCache.get(key)
    if (!entry) return null
    if (Date.now() - entry.ts > this.#cfg.cache.ttlMs) {
      this.#resultCache.delete(key)
      return null
    }
    // Move to end (most recently used) — O(1)
    this.#resultCache.delete(key)
    this.#resultCache.set(key, entry)
    return entry.text
  }

  #cacheSet(key, text) {
    this.#resultCache.set(key, { text, ts: Date.now() })
    if (this.#resultCache.size > this.#cfg.cache.maxEntries) {
      const oldest = this.#resultCache.keys().next().value
      if (oldest !== undefined) this.#resultCache.delete(oldest)
    }
  }

  #pruneDenyCache() {
    if (this.#denyOrder.length <= this.#cfg.cache.maxDenyEntries) return
    const excess = this.#denyOrder.splice(0, this.#denyOrder.length - this.#cfg.cache.maxDenyEntries)
    for (const key of excess) this.#denyCache.delete(key)
  }

  #clearCaches() {
    this.#resultCache.clear()
    this.#denyCache.clear()
    this.#denyOrder = []
  }

  // ---------------------------------------------------------------------------
  // Plugin hooks
  // ---------------------------------------------------------------------------

  handleEvent(event) {
    if (event?.type === "session.created") {
      this.#clearCaches()
      this.#log("session created, caches cleared")
    }
  }

  async handleMessage(input, output) {
    const textParts = output.parts.filter(p => p?.type === "text")
    const text = textParts.map(p => p.text || "").join(" ").trim()
    if (!text || !this.#shouldSearch(text)) return

    const keywords = this.#extractKeywords(text)
    if (!keywords.length) return

    const forced = this.#cfg.mode.value === "force" || this.#cfg.prompt.force.test(text)
    const key = this.#cacheKey(forced, keywords)

    const cached = this.#cacheGet(key)
    if (cached) {
      output.parts.unshift({
        id: "prt_vault-context-" + Date.now(),
        sessionID: input.sessionID,
        messageID: output.message.id,
        type: "text",
        text: cached,
        synthetic: true,
      })
      this.#log("cache hit", keywords)
      return
    }

    const rawHits = await this.#ripgrep(keywords)
    const hits = this.#bestHits(rawHits, keywords, forced)
    if (!hits.length) { this.#log("no hits", keywords); return }

    const injected = this.#formatHits(hits)
    this.#cacheSet(key, injected)

    output.parts.unshift({
      id: "prt_vault-context-" + Date.now(),
      sessionID: input.sessionID,
      messageID: output.message.id,
      type: "text",
      text: injected,
      synthetic: true,
    })
    this.#log("injected", hits.map(h => relative(this.#cfg.vault.path, h.file) + ":" + h.lineNumber + ":" + h.score))
  }
}

export default async function VaultContext() {
  const plugin = new VaultContextPlugin()
  return {
    event: ({ event }) => plugin.handleEvent(event),
    "chat.message": (input, output) => plugin.handleMessage(input, output),
  }
}
