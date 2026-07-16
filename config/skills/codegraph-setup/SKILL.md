---
name: codegraph-setup
description: "CodeGraph MCP server setup — install, index, and configure semantic code search. Use when setting up CodeGraph in a new repo, re-indexing, or troubleshooting codegraph MCP."
---

# CodeGraph Setup

Check if codegraph is installed (`which codegraph`). If not, tell user to install:
```bash
npm install -g @colbymchenry/codegraph
```

Index the current project:
```bash
codegraph init -i
```

## MCP config

CodeGraph is configured as an MCP server in `opencode.json`:
```json
"codegraph": {
  "type": "local",
  "command": ["codegraph", "serve", "--mcp"]
}
```

On macOS with Homebrew: `/opt/homebrew/bin/codegraph serve --mcp`

## MCP tools

- **symbol_search**: search for symbols by name/pattern
- **context**: get surrounding context for a symbol
- **explore**: explore the codebase structure
- **callers**: find callers of a function/method
- **callees**: find callees of a function/method

## After indexing

- Run `codegraph sync` for incremental updates going forward.
- Restart opencode if this is the first index so MCP tools are picked up.
- MCP tools are auto-loaded when `.codegraph/` directory exists in the project root.
