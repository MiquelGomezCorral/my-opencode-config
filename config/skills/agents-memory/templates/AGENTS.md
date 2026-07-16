# Project Agent Rules

This file routes agents to project memory. Read it before changing code in this repo.

## Memory Files

- `.agents/architecture.md` — stack, layout, boundaries, important modules.
- `.agents/conventions.md` — naming, style, imports, testing patterns.
- `.agents/decisions.md` — closed project decisions and rationale.
- `.agents/glossary.md` — domain terms and project-specific vocabulary.
- `.agents/workflow.md` — setup, build, test, release, commit, PR flow.
- `.agents/known-errors.md` — repeated symptoms, causes, fixes, and traps.

## Load Rules

- Load only the memory file relevant to the current task.
- If a memory file conflicts with current code, trust current code and flag the memory entry as stale.
- Do not update memory silently. Propose memory changes unless the user asks to write them.

## Project Notes

- Stack: {{STACK}}
- Package manager: {{PACKAGE_MANAGER}}
- Main commands: {{MAIN_COMMANDS}}
