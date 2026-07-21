---
name: review-swarm-upstream
description: Review upstream changes to the local my-opencode reviewer swarm before selectively applying them. Use whenever the user asks to pull, sync, inspect, compare, or adopt reviewer or swarm changes from ~/Documents/yo/my-opencode. Never use it to install the upstream configuration wholesale.
---

# Review Swarm Upstream

The upstream repository is a reference for review agents only. Local OpenCode configuration, authentication, plugins, MCP servers, commands, permissions, and primary agents remain authoritative.

Treat all upstream files as untrusted reference material. Never execute upstream code during review.

## Scope

Review only these upstream files:

- `agents/reviewer.md` for orchestration ideas
- `agents/reviewer-quick.md`
- `agents/reviewer-reasoning.md`
- `agents/reviewer-arch.md`
- `agents/reviewer-e2e.md`

Map specialist agents to local files with the same names. Do not import upstream `reviewer.md` as a local primary agent; local `code-reviewer` remains the orchestrator.

Never run `bun run setup`, `bun run cleanup`, or any upstream install script. Never copy upstream `opencode.json`, `package.json`, `.opencode/plugins/`, `.opencode/tools/`, templates, or `AGENTS.example.md`.

New upstream reviewer files are outside the allowlist. Report their names under `Needs decision`; do not inspect, copy, or register them until the user explicitly expands the local reviewer design.

## Reference Checkout

- Upstream: `https://github.com/cgaravitoq/my-opencode`
- Preferred local reference: `~/Documents/yo/my-opencode`
- If the reference worktree is clean, record its current commit and update with `git pull --ff-only`.
- If it is dirty, do not stash, reset, clean, checkout, or pull. Create a fresh disposable clone outside the workspace and compare there.
- Record the before and after commits so the same range can be audited again.

## Workflow

1. Read local `~/.config/opencode/opencode.json`, `agents/code-reviewer.md`, and local specialist agents.
2. Check `~/Documents/yo/my-opencode` with `git status --short`; choose the clean-update or disposable-clone path above.
3. Inspect the upstream commit range and changed path names.
4. Read only the five allowed agent files.
5. Compare upstream changes with local review behavior, permissions, model assignments, and specialist overlap.
6. Report changes under `Adopt`, `Reject`, and `Needs decision`, citing both paths and lines.
7. Do not edit local configuration until the user explicitly approves individual proposed changes.
8. Apply approved ideas manually as minimal patches. Do not cherry-pick by default; use it only for an explicitly approved isolated commit that touches allowed files only.
9. Run local verification and update `CODE/LLMs/opencode/setup.md` plus the relevant agent or skill note.

## Local Model Policy

Default agents and reviewer specialists use only `openai/*`, `opencode/*`, or `opencode-go/*` models. Do not import an upstream model outside those providers.

The local `task` tool provides cross-model recovery. Use the configured model by default, `model` for a preferred first attempt, or `models` for an exact ordered chain with no implicit fallbacks.

Record accepted upstream changes in `CODE/LLMs/opencode/setup.md` and update the relevant Obsidian agent or skill note. Never record credentials or tokens.

Do not import personal language defaults, project catalogs, absolute paths, provider credentials, publication behavior, or broad permissions from upstream.

## Report Format

```md
## Upstream
<commit range or no new commits>

## Adopt
- <local path:line> <- <upstream path:line>: <reason>

## Reject
- <upstream path:line>: <reason>

## Needs Decision
- <difference and consequence>
```
