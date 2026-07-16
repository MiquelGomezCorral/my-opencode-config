---
name: agents-memory
description: Persistent project memory bootstrap and maintenance. Use in any repository with (or needing) an `AGENTS.md` + `./agents/` system. **Triggers:**\n* **Initialization:** Starting in a new repo, running `/init`, or requests to "set up agents memory."\n* **Development:** Planning features, proposing architecture (→ decisions), writing code (→ conventions), or navigating the codebase (→ architecture).\n* **Debugging:** Fixing complex bugs, investigating issues, or encountering recurring mistakes (→ known-errors).\n* **Memory Management:** Fetching or proposing workflows, glossary terms, conventions, decisions, or known errors.
---

# Agents Memory

Persistent memory system for coding projects. It creates one router file (`AGENTS.md`) plus topical memory files under `.agents/` so agents can load only the project context they need.

## Use When

- The user runs `/init` or asks to initialize project memory.
- Starting work in a repo that lacks `AGENTS.md` or `.agents/`.
- The user asks to set up, inspect, or update agent memory files.
- A repeated project convention, decision, workflow, glossary term, or known error should be proposed for memory.

## Files

```text
AGENTS.md
.agents/
  architecture.md
  conventions.md
  decisions.md
  glossary.md
  workflow.md
  known-errors.md
```

## Bootstrap Workflow

1. Inspect the current project before writing memory files: root files, package/dependency files, existing docs, and existing `AGENTS.md` or `CLAUDE.md`.
2. If project memory already exists, update only missing files or clearly stale references after confirming the intent.
3. Create `AGENTS.md` from `templates/AGENTS.md` and `.agents/*` from the matching templates.
4. Replace placeholders with facts discovered in the repo. Leave sections as `None yet.` when there is no evidence.
5. Do not invent conventions, decisions, commands, or architecture.
6. Summarize created or updated memory files and any sections that still need user input.

## Operating Rules

- Read `AGENTS.md` first in projects that have it.
- Lazy-load `.agents/*` by need; do not read all memory files by default.
- Treat closed decisions in `.agents/decisions.md` as authoritative unless the user explicitly reopens them.
- If code contradicts memory, trust the current code and flag the memory entry as stale.
- Memory updates during normal work are propose-only unless the user explicitly asks to write them.

## Trigger Map

| Situation | Read or update |
|---|---|
| Navigating repo or changing module boundaries | `.agents/architecture.md` |
| Writing code | `.agents/conventions.md` |
| Refactor, dependency swap, architecture choice | `.agents/decisions.md` |
| Project-specific acronym, domain term, entity | `.agents/glossary.md` |
| Build, test, release, commit, PR | `.agents/workflow.md` |
| Debugging a repeated failure | `.agents/known-errors.md` |

## Templates

Templates live in `templates/` next to this skill. Use them as structure, not as final content.
