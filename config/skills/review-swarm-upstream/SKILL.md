---
name: review-swarm-upstream
description: Review upstream changes to the local my-opencode reviewer swarm before selectively applying them. Use whenever the user asks to pull, sync, inspect, compare, or adopt reviewer or swarm changes from ~/Documents/yo/my-opencode. Never use it to install the upstream configuration wholesale.
---

# Review Swarm Upstream

The upstream repository is a reference for review agents only. Local OpenCode configuration, authentication, plugins, MCP servers, commands, permissions, and primary agents remain authoritative.

## Scope

Review only these upstream files:

- `agents/reviewer.md` for orchestration ideas
- `agents/reviewer-quick.md`
- `agents/reviewer-reasoning.md`
- `agents/reviewer-arch.md`
- `agents/reviewer-e2e.md`

Map specialist agents to local files with the same names. Do not import upstream `reviewer.md` as a local primary agent; local `code-reviewer` remains the orchestrator.

Never run `bun run setup`, `bun run cleanup`, or any upstream install script. Never copy upstream `opencode.json`, `package.json`, `.opencode/plugins/`, `.opencode/tools/`, templates, or `AGENTS.example.md`.

## Workflow

1. Read local `~/.config/opencode/opencode.json`, `agents/code-reviewer.md`, and local specialist agents.
2. Check `~/Documents/yo/my-opencode` with `git status --short`. Stop if it is dirty.
3. Run `git pull --ff-only` in the upstream repository.
4. Inspect the upstream commit range and the five allowed agent files only.
5. Compare upstream changes with local review behavior and model assignments.
6. Report changes under `Adopt`, `Reject`, and `Needs decision`, citing both paths and lines.
7. Do not edit local configuration until the user explicitly approves individual proposed changes.

## Local Model Policy

Default agents and reviewer specialists use only `openai/*`, `opencode/*`, or `opencode-go/*` models. Do not import an upstream model outside those providers.

The local `task` tool provides cross-model recovery. Use the configured model by default, `model` for a preferred first attempt, or `models` for an exact ordered chain with no implicit fallbacks.

Record accepted upstream changes in `CODE/LLMs/opencode/setup.md` and update the relevant Obsidian agent or skill note. Never record credentials or tokens.

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
