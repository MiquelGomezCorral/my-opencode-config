---
description: Bootstrap project agent memory files
---

Initialize persistent project memory in the current repo.

Steps:
1. Load the `agents-memory` skill.
2. Inspect the current project for existing `AGENTS.md`, `.agents/`, docs, dependency files, test/build commands, and repo conventions.
3. If memory files are missing, create `AGENTS.md` and `.agents/` files from the skill templates.
4. Fill templates only with facts found in the project. Use `None yet.` for unknown sections.
5. If memory files already exist, report what exists and update only missing files or clearly stale generated placeholders.
6. Summarize created or updated files and any missing information the user should provide.
