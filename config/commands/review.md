---
description: Review the current diff without editing it
agent: code-reviewer
---

Load the `code-review` skill. Review `$ARGUMENTS` when supplied; otherwise review the current working-tree diff against the user's stated goal. If no goal is available, state that limitation and review only for regressions. Run relevant verification when available. Do not edit files, commit, push, or modify remote state.
