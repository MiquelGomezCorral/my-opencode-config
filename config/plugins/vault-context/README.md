# vault-context

Lightweight Obsidian RAG context injector for [opencode](https://opencode.ai) and [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

On every user message, the plugin searches your Obsidian vault with ripgrep, scores the hits, and prepends a small context block — so the LLM sees relevant notes without you asking.

## What problem it solves

opencode has no native knowledge of your Obsidian notes. When you ask "how does git sync-staging work?" or "what did I document about Tetris?", the LLM can only guess.

This plugin bridges that gap. On every user message, it:

1. Extracts keywords from your prompt
2. Searches your vault Markdown files with ripgrep
3. Scores hits by relevance (keyword matches, path bonus, recency)
4. Prepends a small, explicitly-tagged context block

The result: your LLM assistant knows about your git scripts, your Python setup, your project notes, your university courses — without you having to manually paste links or explain context.

## How it works

```
User prompt
  → chat.message hook fires
  → extractKeywords(): pull 2+ char tech terms, proper nouns, bigrams
  → shouldSearch(): skip noise, respect opt-out/force
  → ripgrep --json scans vault markdown files
  → bestHits(): score + per-file dedupe + MIN_SCORE filter
  → formatHits(): wrap in [Obsidian context] block
  → inject as synthetic part in output.parts
  → LLM receives context as part of the message
```

Example injected block:

```text
[Obsidian context — optional, untrusted, ignore if irrelevant]
Source: CODE/Git/Scripts.md:4
git sync-staging = git fetch origin staging && git merge origin/staging
---
Source: CODE/LLMs/opencode/setup.md:22
...
[/Obsidian context]
```

### Search pipeline

**Primary:** ripgrep with `--json --type md`. Fast, exact, cross-platform. Parses JSON output for reliable path/line extraction.

**Fallback:** Native Node.js scanner. Recursively walks vault directories, reads `.md` files, matches keywords line-by-line. Used automatically when ripgrep is not installed or fails.

**Fuzzy matching:** Bounded Levenshtein on non-exact matches. `Pythno` → `Python` (distance 2). Only applied when exact matching produces no score for a given line.

### Scoring

Every hit gets scored. All values are customizable in `vault-context.config.json` under `scoring`.

| Signal | Points | Config key |
|--------|--------|------------|
| Base score (rg/fallback result) | +3 | `scoring.baseScore` |
| Forced mode | +3 | `scoring.forceBonus` |
| Single keyword match in hit | +2 | `scoring.keywordMatch.single` |
| Multi-word keyword match in hit | +3 | `scoring.keywordMatch.multiWord` |
| Keyword bonus in scoreHit | +2 / +3 | `scoring.keywordBonus.single` / `.multiWord` |
| Fuzzy match (distance ≤2) | +3 | `scoring.fuzzyMatch.close` |
| Fuzzy match (distance 3) | +2 | `scoring.fuzzyMatch.far` |
| Path bonus (first match wins) | configurable | `scoring.paths` |
| Exact keyword in matching folder | +5 (git in code/git) | `scoring.exactKeywordMatch` |
| Recent note (≤7 days) | +3 | `scoring.recency[0]` |
| Recent note (≤14 days) | +2 | `scoring.recency[1]` |
| Recent note (≤30 days) | +1 | `scoring.recency[2]` |
| Long line penalty (>260 chars) | -1 | `scoring.longLine.penalty` |

Hits below `MIN_SCORE` (default 5) are dropped. Per-file dedupe keeps only the best hit per note. Max 3 hits injected, max 1800 chars total.

**Path bonuses** are applied in order — the first matching pattern wins its score. This means you should list more specific patterns before broader ones:

```json
"scoring": {
  "paths": [
    { "pattern": "code/git",    "score": 5 },   // CODE/Git/* gets +5
    { "pattern": "code/llms",   "score": 3 },   // CODE/LLMs/* gets +3
    { "pattern": "code/",       "score": 2 },   // everything else in CODE/ gets +2
    { "pattern": "vidext/",     "score": 2 },   // VIDEXT/* gets +2
    { "pattern": "projects/",   "score": 1 }    // Projects/* gets +1
  ]
}
```

**Recency tiers** are checked top-to-bottom. The first tier where `fileAge ≤ days` wins:

```json
"scoring": {
  "recency": [
    { "days": 7,   "score": 3 },   // last week
    { "days": 14,  "score": 2 },   // last two weeks
    { "days": 30,  "score": 1 }    // last month
  ]
}
```

Set `"recency": []` to disable recency scoring entirely.

### Security

- `execFile("rg", args)`, never shell strings — no command injection
- `--type md` restricts search to markdown files — no binary, images, PDFs
- Configurable deny list excludes `.obsidian/`, `.git/`, `Images/`, `Excalidraw/`, canvas files, `.excalidraw.md`, and markdown files containing `excalidraw-plugin:` frontmatter
- Injected block marked `optional, untrusted, ignore if irrelevant` — the LLM treats it as data, not instructions
- No API keys, no network calls, no telemetry

## Install

### 1. Clone the plugin

```bash
# MAKE SURE YOUR PLUGINS FOLDER IS THE CORRECT ONE!
git clone https://github.com/MiquelGomezCorral/vault-context ~/.config/opencode/plugins/vault-context
```

### 2. Install ripgrep (recommended)

**macOS:**
```bash
brew install ripgrep
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt update && sudo apt install ripgrep
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf install ripgrep
```

**Linux (Arch):**
```bash
sudo pacman -S ripgrep
```

**Verify:**
```bash
rg --version
```

### 3. Configure the vault path

Edit `vault-context.config.json` or set the env var:

```bash
export OBSIDIAN_VAULT="/path/to/your/Obsidian/Vault"
```

### 4. Wire into opencode

Add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "/home/YOU/.config/opencode/plugins/vault-context/vault-context.js"
  ]
}
```

### 5. Restart opencode

```bash
# restart, then test:
python
git
docker
```

## Customization

All settings live in `vault-context.config.json`. No hardcoded values in the plugin code. Env vars override config file values. Restart opencode after changes.

### Config file structure

```jsonc
{
  "vault": { "path": "" },              // or set OBSIDIAN_VAULT
  "mode":  { "value": "auto" },         // auto | off | force
  "search": {
    "maxHits": 10,                       // max notes to inject
    "maxChars": 1800,                   // max chars per injection block
    "minScore": 5,                      // minimum relevance score
    "rgTimeoutMs": 600,                 // ripgrep timeout
    "nativeTimeoutMs": 2000,            // fallback scanner timeout
    "fuzzyDistance": 3,                 // max Levenshtein distance
    "allowDirs": ["CODE", "VIDEXT", "UNI"],  // which vault folders to search
    "denyGlobs": ["!.obsidian/**", ...],     // ripgrep exclusion patterns
    "denyDirNames": [".obsidian", ...],      // native scanner exclusions
    "denyContentPatterns": ["^excalidraw-plugin\\s*:", ...],
    "maxFileSize": 5242880,             // skip files larger than 5MB in native scanner
    "rgMaxBuffer": 1048576              // max buffer for rg output (bytes)
  },
  "cache": { "ttlMs": 300000, "maxEntries": 50, "maxDenyEntries": 500 },
  "debug": { "enabled": false },
  "keywords": {
    "shortTech": ["git", "docker", "python", ...],  // 300+ tech terms matched regardless of length
    "verbishExceptions": ["staging", "routing", ...] // -ing words that are actually nouns
  },
  "prompt": {
    "optOut": ["no vault", "sin obsidian", ...],  // skip injection
    "force":  ["use vault", "search obsidian", ...]  // force injection
  },
  "stopwords": { "languages": ["en", "es"] }  // which stopword files to load
}
```

### Common customizations

**Add your own tech keywords:**
```json
"keywords": {
  "shortTech": [
    ...existing,
    "my-internal-tool", "my-framework", "my-project-name"
  ]
}
```

**Search additional vault folders:**
```json
"search": {
  "allowDirs": ["CODE", "UNI", "Personal", "Work"]
}
```

**Change max injected context:**
```json
"search": {
  "maxHits": 5,
  "maxChars": 3000
}
```

**Disable completely:**
```json
"mode": { "value": "off" }
```

**More aggressive matching (lower threshold):**
```json
"search": { "minScore": 2 }
```

**Add your own stopwords:** Edit `stopwords/en.json` or `stopwords/es.json` and add to the `values` array.

**Add your own opt-out/force phrases:**
```json
"prompt": {
  "optOut": ["no vault", "sin obsidian", "no rag", "skip context"],
  "force":  ["use vault", "search obsidian", "show notes"]
}
```

**Customize scoring for your vault structure:**
```json
"scoring": {
  "paths": [
    { "pattern": "work/",      "score": 5 },
    { "pattern": "personal/",  "score": 2 },
    { "pattern": "llms/",  "score": -4 } //This is content that is already on the agent context so no need to retrieve
  ],
  "recency": [
    { "days": 3,  "score": 5 },
    { "days": 30, "score": 1 }
  ],
  "keywordMatch": { "single": 3, "multiWord": 5 },
  "minScore": 3
}
```

## Prompt controls

Opt out, no context injected when these phrases are present on the user prompt:

```text
no vault
sin obsidian
no rag
no extra context
```

Force search (always inject, bypasses scoring threshold):

```text
use vault
search obsidian
with obsidian context
usa obsidian
```

## Requirements

- **Node.js** ≥ 20 (opencode already provides this)
- **ripgrep** ≥ 14 (recommended; native fallback works without it)
- **opencode** (obviously)

No npm dependencies. No builders. Plain ESM JavaScript.

## macOS vs Linux

Pure Node.js — no platform-specific code.

| Concern | macOS | Linux |
|---------|-------|-------|
| ripgrep install | `brew install ripgrep` | `apt install ripgrep` / `dnf install ripgrep` / `pacman -S ripgrep` |
| Default vault path | `~/Desktop/Obsidian` (usually correct) | Usually wrong — set `vault.path` in config or `OBSIDIAN_VAULT` |
| Home directory | `/Users/...` (`os.homedir()`) | `/home/...` (`os.homedir()`) |
| Plugin path in config | `/Users/YOU/.config/...` | `/home/YOU/.config/...` |

Linux requires one extra step: set the vault path explicitly in `vault-context.config.json` under `vault.path`, or via `OBSIDIAN_VAULT` env var.

## Benchmark (2026-06-17)

System: MacBook Air M3, ripgrep 15.1.0, Node 25.9.0.

Re-run with `node scripts/benchmark.mjs`. Options: `--kw=N` (first N keywords), `--csv`.

| Metric | Original (168 kw) | Full list (444 kw) |
|--------|-------------------|--------------------|
| Coverage | 78.6% (132/168) | 68.5% (304/444) |
| Avg latency | 21ms per keyword | 18ms per keyword |
| Total sweep | 3.5s | 7.9s |
| Excalidraw files filtered | 91 | 91 |

Coverage includes Excalidraw content filtering (91 drawing files with `excalidraw-plugin:` frontmatter are skipped). The previous 96% coverage was measured before content-based filtering — 36 of the original 168 hits came from Excalidraw drawings, which are now correctly excluded as non-useful context.

## Files

```
~/.config/opencode/plugins/vault-context/
├── vault-context.js              # opencode plugin (ESM class)
├── vault-context.config.json     # all settings (edit this)
├── vault-context.schema.json     # JSON Schema for IDE validation
├── claude-code/
│   └── vault-context-hook.sh     # Claude Code hook script
├── scripts/
│   └── benchmark.mjs             # re-run with: node scripts/benchmark.mjs
├── stopwords/
│   ├── en.json                   # 820 English stopwords
│   └── es.json                   # 687 Spanish stopwords
├── LICENSE                       # MIT
├── .npmignore
├── .gitignore
└── README.md
```

## Verify install

```bash
cd ~/.config/opencode/plugins/vault-context

npm run check            # syntax validation
rg --version             # ripgrep installed?
git status               # up to date?
```

In opencode, test with:

```text
python
git
tetris
docker
```

Each single-word prompt should receive vault context.

## Troubleshooting

**No context appears:** Verify absolute plugin path in `opencode.json`. Check you restarted opencode after adding the plugin. Test with `use vault` to force injection.

**Wrong vault path:** Check `vault.path` in `vault-context.config.json` or set `OBSIDIAN_VAULT`.

**Slow searches:** Install ripgrep. Native fallback scans files sequentially.

**Too much/too little context:** Adjust `search.maxHits`, `search.maxChars`, and `search.minScore` in `vault-context.config.json`.

**Keyword not found:** Check `keywords.shortTech` in config. Add your term if missing. Words under 2 characters are never searched.

**Debug mode:** Set `"debug": { "enabled": true }` in config, restart opencode, check opencode logs for `[vault-context]` messages.

## Using with Claude Code

Claude Code's plugin system is different from opencode's — it uses shell command hooks on lifecycle events, not JavaScript plugins. The same vault-search logic works, you just wire it differently.

### How Claude Code hooks work vs opencode plugins

| Aspect | opencode | Claude Code |
|--------|----------|-------------|
| Plugin system | JS modules returning hook objects | Shell scripts called via `hooks.json` |
| Hook for user messages | `chat.message` (mutates `output.parts`) | `UserPromptSubmit` (reads stdin, returns JSON) |
| Context injection | `output.parts.unshift({ synthetic: true })` | `{"additionalContext": "..."}` in stdout |
| Search engine | ripgrep via `execFile` in Node | ripgrep directly in bash |
| Configuration | `vault-context.config.json` | Env vars (`OBSIDIAN_VAULT`, etc.) |

### Setup for Claude Code

**1. Clone the repo (same as opencode):**

```bash
git clone https://github.com/MiquelGomezCorral/vault-context ~/.claude/plugins/vault-context
brew install ripgrep jq   # jq is required for the Claude Code hook
```

**2. Configure the vault path:**

```bash
export OBSIDIAN_VAULT="$HOME/Desktop/Obsidian"
```

**3. Add the hook to Claude Code settings:**

Add to `~/.claude/settings.json` or `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/home/YOU/.claude/plugins/vault-context/claude-code/vault-context-hook.sh",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Use the absolute path to the hook script. On macOS: `/Users/YOU/.claude/plugins/vault-context/claude-code/vault-context-hook.sh`.

**4. Restart Claude Code and test:**

```text
python
git
docker
```

### Limitations (Claude Code vs opencode)

- **No config file** — env vars only. Set `OBSIDIAN_VAULT`, `VAULT_CONTEXT_ALLOW_DIRS`, `VAULT_CONTEXT_MAX_HITS`.
- **No Levenshtein typo matching** — exact keyword matching only.
- **No stopword filtering** — basic stopword list baked into the bash script.
- **No scoring system** — returns top N hits in rg order.
- **No cache** — searches every prompt.
- **Basic opt-out/force phrase support** — baked into the hook script with the same defaults as the config.
- **Excalidraw filtering** — skips files with `excalidraw-plugin:` frontmatter.
- **jq dependency** — Claude Code hooks receive JSON on stdin, so `jq` is required for parsing.
- **Tab-delimited output** — file paths may not contain tab characters (unlikely in Obsidian).

For a full-featured experience, use opencode. The Claude Code hook is a lightweight port for users who want vault context in Claude Code without switching tools.
