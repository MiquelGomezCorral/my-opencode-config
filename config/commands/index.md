---
description: Index or re-index current project with codegraph
---

Run `codegraph init` in the current project root to create or rebuild its CodeGraph index.

Steps:
1. Run `codegraph init` in the project root.
2. Confirm the reported index statistics.
3. If this is the first index in the current OpenCode process, remind the user to restart so `codegraph_explore` becomes available.
4. Do not run `codegraph sync` routinely; the watcher keeps the graph current.
