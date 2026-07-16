---
name: obsidian-vault
description: Use for Obsidian vault tasks via vault-context and filesystem tools. Trigger on words like "obsidian", "vault", "note", "daily note", "frontmatter", "append note", "move note".
---

# Obsidian Vault Operations

Use this skill when user asks to work with notes in the Obsidian vault.

## Primary access

- Vault root: `$OBSIDIAN_VAULT`, defaulting to `$HOME/Desktop/Obsidian`.
- Search/list with `grep`, `glob`, and `read`.
- Edit with `apply_patch` after reading the target note.
- Skip `.obsidian`, `.git`, `Images`, `Excalidraw`, `*.canvas`, and `*.excalidraw.md`.

## Execution rules

1. Prefer `grep` or `glob` before edits when path is uncertain.
2. Treat paths as vault-relative and confirm exact target note before destructive actions.
3. Read a note before changing it.
4. Preserve frontmatter and existing note style.
5. Summarize changed note paths in final response.

## Safety defaults

- Do not delete notes unless explicitly requested.
- If multiple notes match, choose best match from user context; if still ambiguous, ask one short clarification.
- Keep note formatting consistent with existing note style.
