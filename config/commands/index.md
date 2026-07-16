---
description: Index or re-index current project with codegraph
---

Run `codegraph init -i` in the current working directory to index (or re-index) the project, then bootstrap project memory when missing.

Steps:
1. Run: `codegraph init -i` in the project root
2. Confirm output: files scanned, nodes/edges count
3. Load the `agents-memory` skill and check whether `AGENTS.md` + `.agents/` exist
4. If project memory is missing, create it using the `/init` workflow
5. Remind user to run `codegraph sync` for incremental updates going forward
6. Remind user that MCP tools are auto-loaded when `.codegraph/` exists — restart opencode if this is the first index
