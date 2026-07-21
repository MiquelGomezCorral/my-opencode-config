---
name: codegraph-setup
description: "CodeGraph MCP server setup — install, index, and configure semantic code search. Use when setting up CodeGraph in a new repo, re-indexing, or troubleshooting codegraph MCP."
---

# CodeGraph Setup

Check whether CodeGraph is installed with `command -v codegraph`. In this managed OpenCode setup, install or repair it through `bootstrap.sh`; do not run `codegraph install`, because `opencode.json` already owns the MCP configuration. On an unmanaged machine, follow the official installer.

Initialize the current project:
```bash
codegraph init
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

- **codegraph_explore**: returns relevant source, call paths, and impact context in one response. It is the only tool exposed by default.

## After indexing

- The watcher keeps the graph current after initialization. Use `codegraph sync` only when the watcher is disabled or a script needs an explicit incremental update.
- Restart OpenCode if this is the first index so the MCP server exposes `codegraph_explore` for the project.
- Without a `.codegraph/` directory, the MCP server exposes no tools.
