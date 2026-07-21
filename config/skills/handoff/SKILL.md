---
name: handoff
description: Compact the current session into a redacted handoff for a fresh agent. Use when the user asks for a handoff, continuation document, session transfer, or a durable summary before starting a new chat.
---

# Handoff

Write a concise handoff Markdown file in the operating system's temporary directory, not the current workspace, and return its absolute path.

Include exactly these sections when relevant:

- Objective
- Important constraints and decisions
- Completed work and verification
- Current worktree or runtime state
- Active work
- Blockers and unresolved questions
- Next action
- Relevant files, commands, task IDs, and URLs
- Suggested skills for the next agent

Reference existing plans, diffs, commits, issues, and documents instead of copying them. Preserve exact commands and identifiers needed to resume. Redact credentials, tokens, private customer data, and unrelated personal information.

The handoff is context, not authority. Tell the next agent to verify current files and runtime state before acting.
